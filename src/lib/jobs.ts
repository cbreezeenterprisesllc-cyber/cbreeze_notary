// C Breeze Notary and Signing — signing job server functions.
//
// Server functions: the `.handler()` bodies (and their server-only imports) run
// only on the server; the browser receives thin fetch wrappers. `pg` (via ~/db)
// and the session helper are therefore never shipped to the client.
import { createServerFn } from "@tanstack/react-start";
import { ensureDb, query } from "~/db/index";
import { getCurrentBusiness } from "./auth";
// Runtime import of the dispatch engine: posting a job kicks the cascade.
// `dispatch.ts` only imports this module's types (`import type`), so there is no
// runtime cycle.
import { runSweepCore } from "./dispatch";

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
    created_at: norm(row.created_at) ?? "",
  };
}

function validateJob(input: NewJobInput): NewJobInput {
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
  };
}

/** Create a job owned by the currently logged-in business. */
export const createJob = createServerFn({ method: "POST" })
  .validator(validateJob)
  .handler(async ({ data }) => {
    const user = await getCurrentBusiness();
    if (!user) throw new Error("Please log in to post a job.");
    const businessId = user.id;
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
        data.fee_amount,
      ],
    );
    // Dispatch: the new job is 'pending' — hand it to the first matching notary
    // right away. Nobody assigns anything by hand. A failure here must not lose
    // the job (it simply stays pending and the next sweep picks it up).
    try {
      await runSweepCore();
    } catch (err) {
      console.error("[dispatch] sweep after job creation failed:", err);
    }
    return mapJob(rows[0]);
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
