// C Breeze Notary and Signing — Stripe Checkout payment flow.
//
// Businesses pay the per-signing fee through Stripe Checkout BEFORE the job is
// offered to any notary. Unpaid jobs (`paid_at IS NULL`) never dispatch — the
// dispatch engine gates on `paid_at` (see src/lib/dispatch.ts).
//
// Flow:
//   post job  -> job row created (unpaid) -> Checkout Session created
//             -> `stripe_session_id` saved -> browser redirected to session.url
//   return    -> /dashboard?checkout=success&session_id=cs_... -> confirmCheckout()
//             -> Stripe says payment_status === 'paid' AND the session belongs to
//                one of this business's jobs -> `paid_at = now()` -> dispatch runs
//
// The Stripe SDK is loaded LAZILY inside the server-only helpers: this module is
// imported by client routes (for the server-function wrappers), and `stripe`
// touches Node globals at load time, so a top-level import would break the
// browser bundle. Same pattern as `~/lib/dispatch.ts`.
//
// The secret key comes from STRIPE_SECRET_KEY (server-only env). It is never
// logged, returned or committed.
import { createServerFn } from "@tanstack/react-start";
import { getCurrentBusiness } from "./auth";
import { runSweepCore } from "./dispatch";

/** Fallback signing fee (USD) when a job carries no usable fee_amount. */
export const DEFAULT_SIGNING_FEE_USD = (() => {
  const raw = Number(process.env.DEFAULT_SIGNING_FEE_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 100;
})();

type StripeClient = import("stripe").default;
type StripeCheckoutSession = import("stripe").Stripe.Checkout.Session;

let stripePromise: Promise<StripeClient> | null = null;

/** Lazily construct the Stripe client (server only). */
async function stripe(): Promise<StripeClient> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      "Payments are not configured yet (STRIPE_SECRET_KEY is missing).",
    );
  }
  if (!stripePromise) {
    stripePromise = import("stripe").then(
      (mod) => new mod.default(process.env.STRIPE_SECRET_KEY as string),
    );
  }
  return stripePromise;
}

/** Effective signing fee in whole cents; falls back to the default fee. */
export function feeInCents(feeAmount: unknown): number {
  const n = Number(feeAmount);
  const dollars = Number.isFinite(n) && n > 0 ? n : DEFAULT_SIGNING_FEE_USD;
  return Math.round(dollars * 100);
}

/** Only http(s) origins are accepted for the redirect URLs. */
function safeOrigin(origin: unknown): string {
  const raw = String(origin ?? "").trim();
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.origin;
    }
  } catch {
    /* fall through */
  }
  throw new Error("Could not determine the site address for payment.");
}

/**
 * Create a Checkout Session for one job and return its hosted page URL.
 * `client_reference_id` and `metadata.job_id` both carry the job id so the
 * return trip can be validated against the signed-in business.
 */
export async function createCheckoutSessionForJob(input: {
  jobId: string;
  businessId: string;
  borrowerName: string;
  state: string | null;
  feeAmount: unknown;
  origin: unknown;
}): Promise<{ url: string; sessionId: string }> {
  const client = await stripe();
  const origin = safeOrigin(input.origin);
  const where = input.state ? ` (${input.state.toUpperCase()})` : "";

  const session = await client.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: feeInCents(input.feeAmount),
          product_data: {
            name: `C Breeze signing fee — ${input.borrowerName}${where}`,
            description: "Loan signing appointment dispatched to a vetted notary.",
          },
        },
      },
    ],
    success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/dashboard?checkout=cancelled`,
    client_reference_id: input.jobId,
    metadata: { job_id: input.jobId, business_id: input.businessId },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a payment page. Please try again.");
  }
  return { url: session.url, sessionId: session.id };
}

/** Retrieve a Checkout Session by id (server only). */
export async function retrieveCheckoutSession(
  sessionId: string,
): Promise<StripeCheckoutSession> {
  const client = await stripe();
  return client.checkout.sessions.retrieve(sessionId);
}

// ---------------------------------------------------------------------------
// Server functions (client-callable)
// ---------------------------------------------------------------------------

function validateJobId(input: unknown): { job_id: string; origin: string } {
  const raw = (input ?? {}) as { job_id?: unknown; origin?: unknown };
  const jobId = String(raw.job_id ?? "").trim();
  if (!jobId) throw new Error("Missing job.");
  return { job_id: jobId, origin: safeOrigin(raw.origin) };
}

/**
 * "Pay now": create a FRESH Checkout Session for an existing unpaid job.
 * Stale sessions expire after 24h anyway, so a new one is always created and
 * `stripe_session_id` is replaced.
 */
export const createCheckoutForJob = createServerFn({ method: "POST" })
  .validator(validateJobId)
  .handler(async ({ data }): Promise<{ url: string }> => {
    const user = await getCurrentBusiness();
    if (!user) throw new Error("Please log in to pay for a job.");

    const { ensureDb, query } = await import("~/db/index");
    await ensureDb();
    const rows = await query<{
      id: string;
      borrower_name: string;
      state: string | null;
      fee_amount: string | number | null;
      paid_at: string | Date | null;
    }>(
      `SELECT id, borrower_name, state, fee_amount, paid_at
         FROM jobs WHERE id = $1 AND business_id = $2`,
      [data.job_id, user.id],
    );
    const job = rows[0];
    if (!job) throw new Error("That job was not found on your account.");
    if (job.paid_at) return { url: "" }; // already paid — nothing to charge

    const session = await createCheckoutSessionForJob({
      jobId: job.id,
      businessId: user.id,
      borrowerName: job.borrower_name,
      state: job.state,
      feeAmount: job.fee_amount,
      origin: data.origin,
    });

    await query("UPDATE jobs SET stripe_session_id = $2 WHERE id = $1", [
      job.id,
      session.sessionId,
    ]);

    return { url: session.url };
  });

export interface ConfirmResult {
  paid: boolean;
  job_id: string | null;
}

/**
 * Return trip from Stripe: verify the session really was paid and belongs to a
 * job of the signed-in business, then mark the job paid and dispatch it.
 * Safe to call repeatedly — `paid_at` is only ever set once.
 */
export const confirmCheckout = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { session_id?: unknown };
    const sessionId = String(raw.session_id ?? "").trim();
    if (!sessionId) throw new Error("Missing payment reference.");
    return { session_id: sessionId };
  })
  .handler(async ({ data }): Promise<ConfirmResult> => {
    const user = await getCurrentBusiness();
    if (!user) throw new Error("Please log in to confirm your payment.");

    const session = await retrieveCheckoutSession(data.session_id);
    const jobId =
      session.metadata?.job_id ?? session.client_reference_id ?? null;

    const { ensureDb, query } = await import("~/db/index");
    await ensureDb();

    const rows = await query<{ id: string; paid_at: string | Date | null }>(
      "SELECT id, paid_at FROM jobs WHERE id = $1 AND business_id = $2",
      [jobId, user.id],
    );
    const job = rows[0];
    if (!job) {
      throw new Error("That payment does not match a job on your account.");
    }

    if (session.payment_status !== "paid") {
      // Card not completed / still processing: the job simply stays unpaid.
      return { paid: false, job_id: job.id };
    }

    if (!job.paid_at) {
      await query(
        "UPDATE jobs SET paid_at = now(), stripe_session_id = COALESCE(stripe_session_id, $2) WHERE id = $1 AND paid_at IS NULL",
        [job.id, session.id],
      );
    }

    // Paid — only now does the job go out to notaries.
    try {
      await runSweepCore();
    } catch (err) {
      console.error("[payments] dispatch after payment failed:", err);
    }

    return { paid: true, job_id: job.id };
  });
