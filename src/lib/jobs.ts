// C Breeze Notary and Signing — signing job server functions.
//
// Server functions: the `.handler()` bodies (and their server-only imports) run
// only on the server; the browser receives thin fetch wrappers. `pg` (via ~/db)
// and the session helper are therefore never shipped to the client.
import { createServerFn } from "@tanstack/react-start";
import { ensureDb, query } from "~/db/index";
import { getCurrentBusiness } from "./auth";
import { DEFAULT_SIGNING_FEE_USD, createCheckoutSessionForJob } from "./payments";

export type JobStatus = "pending" | "assigned" | "completed" | "cancelled";

export interface Job {
  id: string;
  business_id: string;
  borrower_name: string;
  borrower_email: string | null;
  loan_type: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  signing_date_time: string | null;
  status: JobStatus;
  fee_amount: number | null;
  notary_pay_amount: number | null;
  /** Set once Stripe Checkout reports the signing fee as paid. */
  paid_at: string | null;
  created_at: string;
}

export interface NewJobInput {
  borrower_name: string;
  borrower_email?: string | null;
  loan_type?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  signing_date_time?: string | null;
  fee_amount?: number | null;
  /** Site origin (https://…) used to build the Stripe Checkout redirect URLs. */
  origin?: string | null;
}

/** Row shape returned by pg for the `jobs` table (timestamps arrive as Dates). */
interface JobRow {
  id: string;
  business_id: string;
  borrower_name: string;
  borrower_email: string | null;
  loan_type: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  signing_date_time: string | Date | null;
  status: string;
  fee_amount: string | number | null;
  notary_pay_amount: string | number | null;
  paid_at?: string | Date | null;
  created_at: string | Date;
}

function norm(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapJob(row: JobRow): Job {
  return {
    id: row.id,
    business_id: row.business_id,
    borrower_name: row.borrower_name,
    borrower_email: norm(row.borrower_email),
    loan_type: norm(row.loan_type),
    address: norm(row.address),
    city: norm(row.city),
    state: norm(row.state),
    signing_date_time: norm(row.signing_date_time),
    status: row.status as JobStatus,
    fee_amount: normNumber(row.fee_amount),
    notary_pay_amount: normNumber(row.notary_pay_amount),
    paid_at: norm(row.paid_at),
    created_at: norm(row.created_at) ?? "",
  };
}

function validateJob(input: NewJobInput): NewJobInput & { origin: string } {
  const raw = (input ?? {}) as Partial<NewJobInput>;
  const borrower_name = (raw.borrower_name ?? "").trim();
  if (!borrower_name) throw new Error("Borrower name is required.");
  return {
    borrower_name,
    borrower_email: raw.borrower_email?.trim() || null,
    loan_type: raw.loan_type?.trim() || null,
    address: raw.address?.trim() || null,
    city: raw.city?.trim() || null,
    state: raw.state?.trim()?.toUpperCase() || null,
    signing_date_time: raw.signing_date_time || null,
    fee_amount: normNumber(raw.fee_amount),
    origin: String(raw.origin ?? "").trim(),
  };
}

/** Effective fee in dollars: the posted fee, or the default when it is 0/missing. */
function effectiveFee(fee: number | null | undefined): number {
  return fee != null && Number.isFinite(fee) && fee > 0
    ? Math.round(fee * 100) / 100
    : DEFAULT_SIGNING_FEE_USD;
}

export interface CreatedJob {
  job: Job;
  /** Stripe Checkout URL the browser should be sent to (null if Stripe failed). */
  checkout_url: string | null;
}

/**
 * Create a job owned by the currently logged-in business and start its Stripe
 * Checkout payment.
 *
 * The job is created UNPAID: nothing is offered to a notary here. The dispatch
 * cascade only starts once Stripe reports the fee as paid (see
 * `confirmCheckout` in ~/lib/payments and the `paid_at` gates in ~/lib/dispatch).
 */
export const createJob = createServerFn({ method: "POST" })
  .validator(validateJob)
  .handler(async ({ data }): Promise<CreatedJob> => {
    const user = await getCurrentBusiness();
    if (!user) throw new Error("Please log in to post a job.");
    const businessId = user.id;
    const fee = effectiveFee(data.fee_amount);
    const origin = data.origin;
    await ensureDb();
    const rows = await query<JobRow>(
      `INSERT INTO jobs
         (business_id, borrower_name, borrower_email, loan_type, address, city, state, signing_date_time, fee_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        businessId,
        data.borrower_name,
        data.borrower_email,
        data.loan_type,
        data.address,
        data.city,
        data.state,
        data.signing_date_time,
        fee,
      ],
    );
    const job = mapJob(rows[0]);

    // Payment first, dispatch second. If Stripe is unreachable the job still
    // exists as unpaid and the business can retry with "Pay now" on the job card.
    let checkoutUrl: string | null = null;
    try {
      const session = await createCheckoutSessionForJob({
        jobId: job.id,
        businessId,
        borrowerName: job.borrower_name,
        state: job.state,
        feeAmount: job.fee_amount,
        origin,
      });
      await query("UPDATE jobs SET stripe_session_id = $2 WHERE id = $1", [
        job.id,
        session.sessionId,
      ]);
      checkoutUrl = session.url;
    } catch (err) {
      console.error("[payments] could not create Checkout Session:", err);
    }

    return { job, checkout_url: checkoutUrl };
  });

/** List the current business's jobs, newest first. */
export const listMyJobs = createServerFn().handler(async () => {
  const user = await getCurrentBusiness();
  if (!user) return [];
  const businessId = user.id;
  await ensureDb();
  const rows = await query<JobRow>(
    "SELECT * FROM jobs WHERE business_id = $1 ORDER BY created_at DESC",
    [businessId],
  );
  return rows.map(mapJob);
});
