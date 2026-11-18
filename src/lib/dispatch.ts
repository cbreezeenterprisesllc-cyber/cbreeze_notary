// C Breeze Notary and Signing — AUTOMATED DISPATCH ENGINE.
//
// Owner requirement: "it sends out signing info for notaries to accept or
// decline automatically." Nobody assigns anything by hand, ever.
//
// How it works (sequential cascade):
//   1. A business posts a job  ->  jobs.status = 'pending'.
//   2. The engine picks the best matching notary (`states_served @> job.state`,
//      fewest past offers first, then oldest account) and writes ONE
//      assignments row with status = 'offered' + offered_at / expires_at.
//   3. The notary sees the offer on their dashboard and accepts or declines.
//   4. ACCEPT  -> assignment 'accepted', job 'assigned' + assigned_at. Cascade stops.
//      DECLINE -> assignment 'declined', the next matching notary is offered.
//      TIMEOUT -> the lazy sweep expires the offer and offers the next notary.
//
// There are no background workers, so expiry is a LAZY SWEEP: `runSweepCore()`
// is invoked on job creation, on every notary dashboard load, on every business
// dashboard load, and before an accept/decline. It is idempotent and safe to run
// concurrently: stale offers are expired with a single conditional UPDATE (only
// one caller can win each row) and `offerNextNotary()` locks the job row
// (`SELECT ... FOR UPDATE`) before checking for an open offer, so a job can never
// carry two live offers.
//
// Every `.handler()` below runs on the server only; `pg` is never shipped to the
// browser (same pattern as ~/lib/jobs.ts and ~/lib/auth.ts).
import { createServerFn } from "@tanstack/react-start";
import { getCurrentBusiness } from "./auth";
import { getCurrentNotary } from "./notary-auth";
import type { Job } from "./jobs";

/**
 * The database layer is loaded LAZILY, only from server code paths.
 *
 * `dispatch.ts` is imported by client routes (they need the server-function
 * wrappers and the exported types), so a top-level `import "~/db/index"` would
 * pull `pg` into the browser bundle — `pg` touches Node globals at load time and
 * crashes the page with "Buffer is not defined". A dynamic import inside these
 * server-only helpers keeps the client chunk clean.
 */
type DbModule = typeof import("~/db/index");
let dbPromise: Promise<DbModule> | null = null;
function db(): Promise<DbModule> {
  if (!dbPromise) dbPromise = import("~/db/index");
  return dbPromise;
}

/**
 * How long a notary has to accept an offer before it cascades to the next one.
 * Defaults to 15 minutes; override with DISPATCH_OFFER_TIMEOUT_MINUTES.
 */
export const OFFER_TIMEOUT_MINUTES = (() => {
  const raw = Number(process.env.DISPATCH_OFFER_TIMEOUT_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : 15;
})();

/** Maximum jobs examined per sweep — bounds the work a single page load can do. */
const SWEEP_BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Status vocabulary
// ---------------------------------------------------------------------------

/** assignments.status — the lifecycle of a single offer. */
export type AssignmentStatus =
  | "offered" // sent to a notary, waiting for accept/decline (live offer)
  | "accepted" // notary accepted; job is now assigned to them
  | "declined" // notary declined; cascade moved on
  | "expired" // offer lapsed (timeout, or job left 'pending')
  | "assigned" // legacy/manual value, treated like accepted
  | "completed" // signing completed
  | "cancelled"; // assignment cancelled

/** jobs.status — unchanged from the base schema, plus `assigned_at`. */
export type DispatchJobStatus = "pending" | "assigned" | "completed" | "cancelled";

/** Business-facing summary of where a job sits in the cascade. */
export interface DispatchInfo {
  code: "assigned" | "awaiting" | "waiting" | "completed" | "cancelled";
  /** Short headline shown on the job card. */
  label: string;
  /** Secondary line: expiry, decline count, coverage gap, etc. */
  detail: string | null;
  /** Name of the notary the job is currently offered to (if any). */
  offered_to: string | null;
  /** Name of the notary who accepted (if any). */
  assigned_to: string | null;
  /** Number of notaries who have declined this job so far. */
  declines: number;
  /** Vetted notaries whose states_served cover this job's state. */
  matching_notaries: number;
  /** ISO timestamp when the live offer lapses. */
  expires_at: string | null;
}

export interface BusinessJob extends Job {
  assigned_at: string | null;
  dispatch: DispatchInfo;
}

/** An offer (or a past offer) as shown on the notary dashboard. */
export interface NotaryOffer {
  assignment_id: string;
  status: AssignmentStatus;
  offered_at: string | null;
  responded_at: string | null;
  expires_at: string | null;
  job_id: string;
  job_status: DispatchJobStatus;
  borrower_name: string;
  loan_type: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  signing_date_time: string | null;
  fee_amount: number | null;
  notary_pay_amount: number | null;
  company_name: string | null;
}

export interface MyOffers {
  /** Live offers (status 'offered' on a job that is still 'pending'). */
  current: NotaryOffer[];
  /** Recently answered/lapsed offers, newest first. */
  history: NotaryOffer[];
  /** Offer window in minutes, so the UI can explain the countdown. */
  offer_timeout_minutes: number;
}

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------

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
  assigned_at?: string | Date | null;
  paid_at?: string | Date | null;
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
    status: row.status as Job["status"],
    fee_amount: normNumber(row.fee_amount),
    notary_pay_amount: normNumber(row.notary_pay_amount),
    paid_at: norm(row.paid_at),
    created_at: norm(row.created_at) ?? "",
  };
}

interface OfferRow {
  assignment_id: string;
  status: string;
  offered_at: string | Date | null;
  responded_at: string | Date | null;
  expires_at: string | Date | null;
  job_id: string;
  job_status: string;
  borrower_name: string;
  loan_type: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  signing_date_time: string | Date | null;
  fee_amount: string | number | null;
  notary_pay_amount: string | number | null;
  company_name: string | null;
}

function mapOffer(row: OfferRow): NotaryOffer {
  return {
    assignment_id: row.assignment_id,
    status: row.status as AssignmentStatus,
    offered_at: norm(row.offered_at),
    responded_at: norm(row.responded_at),
    expires_at: norm(row.expires_at),
    job_id: row.job_id,
    job_status: row.job_status as DispatchJobStatus,
    borrower_name: row.borrower_name,
    loan_type: norm(row.loan_type),
    address: norm(row.address),
    city: norm(row.city),
    state: norm(row.state),
    signing_date_time: norm(row.signing_date_time),
    fee_amount: normNumber(row.fee_amount),
    notary_pay_amount: normNumber(row.notary_pay_amount),
    company_name: norm(row.company_name),
  };
}

// ---------------------------------------------------------------------------
// Core engine (server-side only, no session required)
// ---------------------------------------------------------------------------

export interface SweepResult {
  /** Offers that lapsed on this sweep. */
  expired: number;
  /** New offers sent on this sweep. */
  offered: number;
}

/**
 * Offer `jobId` to the next matching notary.
 *
 * Selection: a vetted notary whose `states_served` contains the job's state and
 * who has never been offered this job before. Fairness: fewest lifetime offers
 * first, then the oldest account, then a stable id tiebreak.
 *
 * Concurrency: the job row is locked FOR UPDATE for the duration of the
 * transaction, so two concurrent sweeps cannot both create an offer, and the
 * "is there already a live offer?" check is authoritative. Returns the new
 * assignment id, or null when nothing was offered.
 */
export async function offerNextNotary(jobId: string): Promise<string | null> {
  const { withTx } = await db();
  return withTx(async (client) => {
    const jobRes = await client.query<{
      id: string;
      status: string;
      state: string | null;
      paid_at: string | Date | null;
    }>(
      "SELECT id, status, state, paid_at FROM jobs WHERE id = $1 FOR UPDATE",
      [jobId],
    );
    const job = jobRes.rows[0];
    // Guardrail: only a pending, PAID job may receive an offer. An unpaid job
    // (paid_at IS NULL) never reaches a notary.
    if (!job || job.status !== "pending" || job.paid_at == null) return null;

    const open = await client.query(
      "SELECT 1 FROM assignments WHERE job_id = $1 AND status = 'offered' LIMIT 1",
      [jobId],
    );
    if ((open.rowCount ?? 0) > 0) return null; // already has a live offer

    const candidate = await client.query<{ id: string }>(
      `SELECT n.id
         FROM notaries n
        WHERE $2::text IS NOT NULL
          AND n.states_served @> to_jsonb($2::text)
          AND NOT EXISTS (
            SELECT 1 FROM assignments a
             WHERE a.job_id = $1 AND a.notary_id = n.id
          )
        ORDER BY (SELECT count(*) FROM assignments a2 WHERE a2.notary_id = n.id) ASC,
                 n.created_at ASC,
                 n.id ASC
        LIMIT 1`,
      [jobId, job.state],
    );
    const next = candidate.rows[0];
    if (!next) return null; // no (more) matching notaries — job stays pending

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO assignments (job_id, notary_id, status, offered_at, expires_at)
       VALUES ($1, $2, 'offered', now(), now() + make_interval(mins => $3))
       ON CONFLICT (job_id, notary_id) DO NOTHING
       RETURNING id`,
      [jobId, next.id, OFFER_TIMEOUT_MINUTES],
    );
    return inserted.rows[0]?.id ?? null;
  });
}

/**
 * The lazy sweep. Idempotent; safe to call from anywhere, as often as you like.
 *
 *  1. Expire every live offer that has passed `expires_at` — and any live offer
 *     whose job is no longer 'pending' (assigned / completed / cancelled). The
 *     conditional UPDATE is the lock: a row can only be expired once, so
 *     concurrent sweeps cannot double-cascade.
 *  2. For every pending, PAID job without a live offer, offer it to the next
 *     matching notary (this is what makes decline/timeout cascade). Unpaid jobs
 *     (`paid_at IS NULL`) are never offered — they wait for their payment.
 */
export async function runSweepCore(): Promise<SweepResult> {
  const { ensureDb, query } = await db();
  await ensureDb();

  const expired = await query<{ job_id: string }>(
    `UPDATE assignments a
        SET status = 'expired',
            responded_at = COALESCE(a.responded_at, now()),
            note = COALESCE(a.note, 'Offer expired without a response')
       FROM jobs j
      WHERE a.job_id = j.id
        AND a.status = 'offered'
        AND (
          (a.expires_at IS NOT NULL AND a.expires_at <= now())
          OR j.status <> 'pending'
        )
      RETURNING a.job_id`,
  );

  const pending = await query<{ id: string }>(
    `SELECT j.id
       FROM jobs j
      WHERE j.status = 'pending'
        AND j.paid_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM assignments a
           WHERE a.job_id = j.id AND a.status = 'offered'
        )
      ORDER BY j.created_at ASC
      LIMIT $1`,
    [SWEEP_BATCH_SIZE],
  );

  let offered = 0;
  for (const row of pending) {
    const assignmentId = await offerNextNotary(row.id);
    if (assignmentId) offered += 1;
  }

  return { expired: expired.length, offered };
}

/** Dispatch summary for one job row (business-facing wording). */
function describeDispatch(row: JobRow & {
  offered_to_name: string | null;
  offered_expires_at: string | Date | null;
  assigned_name: string | null;
  decline_count: string | number | null;
  matching_notaries: string | number | null;
}): DispatchInfo {
  const declines = Number(row.decline_count ?? 0) || 0;
  const matching = Number(row.matching_notaries ?? 0) || 0;
  const state = row.state ? String(row.state).toUpperCase() : null;
  const where = state ? `in ${state}` : "in your area";
  const offeredTo = norm(row.offered_to_name);
  const assignedTo = norm(row.assigned_name);
  const expiresAt = norm(row.offered_expires_at);

  if (row.status === "assigned") {
    return {
      code: "assigned",
      label: assignedTo ? `Assigned to ${assignedTo}` : "Notary assigned",
      detail: assignedTo ? "Offer accepted — signing is confirmed" : null,
      offered_to: null,
      assigned_to: assignedTo,
      declines,
      matching_notaries: matching,
      expires_at: null,
    };
  }

  if (row.status === "completed") {
    return {
      code: "completed",
      label: "Completed",
      detail: assignedTo ? `Signed by ${assignedTo}` : null,
      offered_to: null,
      assigned_to: assignedTo,
      declines,
      matching_notaries: matching,
      expires_at: null,
    };
  }

  if (row.status === "cancelled") {
    return {
      code: "cancelled",
      label: "Cancelled",
      detail: "Open offers were expired automatically",
      offered_to: null,
      assigned_to: null,
      declines,
      matching_notaries: matching,
      expires_at: null,
    };
  }

  // status === 'pending'
  if (offeredTo) {
    return {
      code: "awaiting",
      label: `Offered to ${offeredTo}`,
      detail: expiresAt
        ? `Awaiting response · expires ${formatShort(expiresAt)}`
        : "Awaiting response",
      offered_to: offeredTo,
      assigned_to: null,
      declines,
      matching_notaries: matching,
      expires_at: expiresAt,
    };
  }

  let detail: string;
  if (matching === 0) {
    detail = `No vetted notaries ${where} yet — we'll dispatch as soon as one joins`;
  } else if (declines > 0) {
    detail = `${declines} ${declines === 1 ? "notary has" : "notaries have"} declined — finding the next match`;
  } else {
    detail = "Matching a vetted local notary now";
  }

  return {
    code: "waiting",
    label: `Waiting for an available notary ${where}`,
    detail,
    offered_to: null,
    assigned_to: null,
    declines,
    matching_notaries: matching,
    expires_at: null,
  };
}

/** Compact "Oct 15, 3:42 PM" for offer expiry text. */
function formatShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Server functions (client-callable)
// ---------------------------------------------------------------------------

/**
 * Trigger the sweep manually. Called automatically by job creation and by both
 * dashboards; exposed as a server function so anything else (a cron ping, an
 * admin screen) can nudge the cascade too.
 */
export const runDispatchSweep = createServerFn({ method: "POST" }).handler(
  async (): Promise<SweepResult> => runSweepCore(),
);

/**
 * Business dashboard: the current business's jobs, each with its live dispatch
 * state. Runs the sweep first so the list is never stale (expired offers are
 * cascaded and pending jobs get offered on load).
 */
export const listMyJobsWithDispatch = createServerFn().handler(
  async (): Promise<BusinessJob[]> => {
    const user = await getCurrentBusiness();
    if (!user) return [];
    const businessId = user.id;

    await runSweepCore();

    const { query } = await db();
    const rows = await query<
      JobRow & {
        offered_to_name: string | null;
        offered_expires_at: string | Date | null;
        assigned_name: string | null;
        decline_count: string | number | null;
        matching_notaries: string | number | null;
      }
    >(
      `SELECT j.*,
              off.notary_name   AS offered_to_name,
              off.expires_at    AS offered_expires_at,
              asg.notary_name   AS assigned_name,
              (SELECT count(*) FROM assignments a
                WHERE a.job_id = j.id AND a.status = 'declined') AS decline_count,
              (SELECT count(*) FROM notaries n
                WHERE j.state IS NOT NULL
                  AND n.states_served @> to_jsonb(j.state)) AS matching_notaries
         FROM jobs j
         LEFT JOIN LATERAL (
           SELECT n.name AS notary_name, a.expires_at
             FROM assignments a
             JOIN notaries n ON n.id = a.notary_id
            WHERE a.job_id = j.id AND a.status = 'offered'
            ORDER BY a.offered_at DESC NULLS LAST
            LIMIT 1
         ) off ON true
         LEFT JOIN LATERAL (
           SELECT n.name AS notary_name
             FROM assignments a
             JOIN notaries n ON n.id = a.notary_id
            WHERE a.job_id = j.id
              AND a.status IN ('accepted','assigned','completed')
            ORDER BY a.assigned_at DESC NULLS LAST
            LIMIT 1
         ) asg ON true
        WHERE j.business_id = $1
        ORDER BY j.created_at DESC`,
      [businessId],
    );

    return rows.map((row) => ({
      ...mapJob(row),
      assigned_at: norm(row.assigned_at),
      dispatch: describeDispatch(row),
    }));
  },
);

/**
 * Notary dashboard: live offers plus a short history. Runs the sweep first, so
 * loading the dashboard expires anything stale and pulls in the next cascade.
 */
export const getMyOffers = createServerFn().handler(
  async (): Promise<MyOffers> => {
    const notary = await getCurrentNotary();
    if (!notary) {
      return { current: [], history: [], offer_timeout_minutes: OFFER_TIMEOUT_MINUTES };
    }

    await runSweepCore();

    const { query } = await db();
    const rows = await query<OfferRow>(
      `SELECT a.id            AS assignment_id,
              a.status        AS status,
              a.offered_at    AS offered_at,
              a.responded_at  AS responded_at,
              a.expires_at    AS expires_at,
              j.id            AS job_id,
              j.status        AS job_status,
              j.borrower_name AS borrower_name,
              j.loan_type     AS loan_type,
              j.address       AS address,
              j.city          AS city,
              j.state         AS state,
              j.signing_date_time AS signing_date_time,
              j.fee_amount    AS fee_amount,
              j.notary_pay_amount AS notary_pay_amount,
              COALESCE(b.company_name, b.name) AS company_name
         FROM assignments a
         JOIN jobs j ON j.id = a.job_id
         JOIN businesses b ON b.id = j.business_id
        WHERE a.notary_id = $1
        ORDER BY COALESCE(a.responded_at, a.offered_at) DESC NULLS LAST
        LIMIT 25`,
      [notary.id],
    );

    const offers = rows.map(mapOffer);
    return {
      current: offers.filter(
        (o) => o.status === "offered" && o.job_status === "pending",
      ),
      history: offers
        .filter((o) => !(o.status === "offered" && o.job_status === "pending"))
        .slice(0, 8),
      offer_timeout_minutes: OFFER_TIMEOUT_MINUTES,
    };
  },
);

export interface RespondInput {
  assignment_id: string;
  action: "accept" | "decline";
}

function validateRespond(input: RespondInput): RespondInput {
  const raw = (input ?? {}) as Partial<RespondInput>;
  const assignmentId = String(raw.assignment_id ?? "").trim();
  const action = raw.action;
  if (!assignmentId) throw new Error("Missing offer.");
  if (action !== "accept" && action !== "decline") {
    throw new Error("Choose accept or decline.");
  }
  return { assignment_id: assignmentId, action };
}

/**
 * Accept or decline a live offer. The sweep runs first so a lapsed offer can
 * never be accepted. The UPDATE is conditional on `status = 'offered'` and on the
 * offer belonging to the signed-in notary, so a double-click, a stale tab or a
 * timeout race cannot accept twice — only one caller wins the row.
 */
export const respondToOffer = createServerFn({ method: "POST" })
  .validator(validateRespond)
  .handler(async ({ data }): Promise<{ ok: true; job_id: string; status: string }> => {
    const notary = await getCurrentNotary();
    if (!notary) throw new Error("Please log in as a notary to respond to an offer.");

    await runSweepCore();

    const { query, withTx } = await db();

    if (data.action === "accept") {
      return withTx(async (client) => {
        const updated = await client.query<{ job_id: string }>(
          `UPDATE assignments
              SET status = 'accepted', responded_at = now()
            WHERE id = $1 AND notary_id = $2 AND status = 'offered'
            RETURNING job_id`,
          [data.assignment_id, notary.id],
        );
        const accepted = updated.rows[0];
        if (!accepted) {
          throw new Error("That offer is no longer available.");
        }
        // Job must still be pending AND paid — an accepted offer closes the cascade.
        const jobUpdate = await client.query(
          `UPDATE jobs
              SET status = 'assigned', assigned_at = now()
            WHERE id = $1 AND status = 'pending' AND paid_at IS NOT NULL`,
          [accepted.job_id],
        );
        if ((jobUpdate.rowCount ?? 0) === 0) {
          throw new Error("That job is no longer available.");
        }
        // Defensive: nothing else may stay open on this job.
        await client.query(
          `UPDATE assignments
              SET status = 'expired',
                  responded_at = now(),
                  note = COALESCE(note, 'Job was assigned to another notary')
            WHERE job_id = $1 AND status = 'offered' AND id <> $2`,
          [accepted.job_id, data.assignment_id],
        );
        return { ok: true as const, job_id: accepted.job_id, status: "accepted" };
      });
    }

    const declined = await query<{ job_id: string }>(
      `UPDATE assignments
          SET status = 'declined', responded_at = now()
        WHERE id = $1 AND notary_id = $2 AND status = 'offered'
        RETURNING job_id`,
      [data.assignment_id, notary.id],
    );
    const row = declined[0];
    if (!row) {
      throw new Error("That offer is no longer available.");
    }
    // Cascade immediately — the next matching notary is offered right away.
    await offerNextNotary(row.job_id);
    return { ok: true as const, job_id: row.job_id, status: "declined" };
  });
