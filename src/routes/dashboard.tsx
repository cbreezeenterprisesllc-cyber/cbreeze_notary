import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getCurrentBusiness, logoutBusiness } from "~/lib/auth";
import { createJob } from "~/lib/jobs";
import { confirmCheckout, createCheckoutForJob } from "~/lib/payments";
import { listMyJobsWithDispatch } from "~/lib/dispatch";
import type { BusinessJob } from "~/lib/dispatch";

export const Route = createFileRoute("/dashboard")({
  // Stripe Checkout returns here: ?checkout=success&session_id=cs_… or ?checkout=cancelled
  validateSearch: (search: Record<string, unknown>) => ({
    checkout:
      typeof search.checkout === "string" ? search.checkout : undefined,
    session_id:
      typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  beforeLoad: async () => {
    const user = await getCurrentBusiness();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    return { user };
  },
  component: Dashboard,
});

const LOAN_TYPES = ["Refinance", "Purchase", "HELOC", "Home Equity", "Other"];

function Dashboard() {
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<BusinessJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [notice, setNotice] = useState<{
    tone: "success" | "info" | "error";
    text: string;
  } | null>(null);
  const [payingJobId, setPayingJobId] = useState<string | null>(null);

  // job form state
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerEmail, setBorrowerEmail] = useState("");
  const [loanType, setLoanType] = useState("Refinance");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [signingDateTime, setSigningDateTime] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refreshJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      setJobs(await listMyJobsWithDispatch());
    } catch {
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  // Return trip from Stripe Checkout. Only a session Stripe reports as PAID (and
  // that belongs to one of this business's jobs) marks the job paid and lets the
  // dispatch engine offer it to a notary.
  useEffect(() => {
    const checkout = search.checkout;
    if (!checkout) return;
    let cancelled = false;

    (async () => {
      if (checkout === "success" && search.session_id) {
        try {
          const result = await confirmCheckout({
            data: { session_id: search.session_id },
          });
          if (cancelled) return;
          setNotice(
            result.paid
              ? {
                  tone: "success",
                  text: "Payment received — job sent to notaries.",
                }
              : {
                  tone: "info",
                  text: "Payment not completed — job saved, pay to dispatch it.",
                },
          );
        } catch {
          if (cancelled) return;
          setNotice({
            tone: "error",
            text: "We couldn't confirm that payment. If you were charged, the job will show as paid once Stripe confirms it.",
          });
        }
      } else if (checkout === "cancelled") {
        setNotice({
          tone: "info",
          text: "Payment cancelled — job saved, pay to dispatch it.",
        });
      }

      await refreshJobs();
      if (cancelled) return;
      // Drop the Stripe query params so a refresh doesn't re-run the check.
      void navigate({
        to: "/dashboard",
        search: { checkout: undefined, session_id: undefined },
        replace: true,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [search.checkout, search.session_id, refreshJobs, navigate]);

  async function onPay(jobId: string) {
    setPayingJobId(jobId);
    setNotice(null);
    try {
      const { url } = await createCheckoutForJob({
        data: { job_id: jobId, origin: window.location.origin },
      });
      if (url) {
        window.location.href = url;
        return;
      }
      setNotice({ tone: "info", text: "That job is already paid." });
      await refreshJobs();
    } catch (err) {
      setNotice({
        tone: "error",
        text:
          err instanceof Error
            ? err.message
            : "We couldn't start the payment. Please try again.",
      });
    } finally {
      setPayingJobId(null);
    }
  }

  async function onLogout() {
    setBusy(true);
    try {
      await logoutBusiness();
      navigate({ to: "/" });
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitJob(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const created = await createJob({
        data: {
          borrower_name: borrowerName,
          borrower_email: borrowerEmail || null,
          loan_type: loanType,
          address: address || null,
          city: city || null,
          state: state || null,
          signing_date_time: signingDateTime || null,
          fee_amount: feeAmount ? Number(feeAmount) : null,
          origin: window.location.origin,
        },
      });
      // reset form
      setBorrowerName("");
      setBorrowerEmail("");
      setLoanType("Refinance");
      setAddress("");
      setCity("");
      setState("");
      setSigningDateTime("");
      setFeeAmount("");
      if (created.checkout_url) {
        // Pay first: the job is saved as unpaid and dispatches only after payment.
        window.location.href = created.checkout_url;
        return;
      }
      setNotice({
        tone: "error",
        text: "Job saved, but we couldn't start the payment. Use “Pay now” on the job below.",
      });
      await refreshJobs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="relative overflow-hidden py-16 sm:py-20">
      {/* Soft brand wash behind the workspace */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(13,148,136,0.09),transparent_75%)]" />

      <div className="relative mx-auto max-w-4xl px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="eyebrow">Business dashboard</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              Welcome, {user.name}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {user.company_name ?? "Your business"} · {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            disabled={busy}
            className="btn-ghost self-start px-4 py-2 text-sm"
          >
            {busy ? "Logging out…" : "Log out"}
          </button>
        </div>

        {notice && (
          <div
            role="status"
            className={`mt-6 flex items-start gap-3 rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${
              notice.tone === "success"
                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                : notice.tone === "error"
                  ? "bg-rose-50 text-rose-800 ring-rose-200"
                  : "bg-amber-50 text-amber-800 ring-amber-200"
            }`}
          >
            <span aria-hidden="true" className="mt-0.5 font-bold">
              {notice.tone === "success" ? "✓" : notice.tone === "error" ? "!" : "•"}
            </span>
            <p>{notice.text}</p>
          </div>
        )}

        {/* Post a signing job */}
        <div className="card mt-10 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-500 text-base font-bold text-white">
              +
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Post a signing job
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Fill in the signing details and pay the signing fee — once
                payment clears we match a vetted local notary automatically.
              </p>
            </div>
          </div>

          <form onSubmit={onSubmitJob} className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Borrower name" required>
              <input
                type="text"
                required
                value={borrowerName}
                onChange={(e) => setBorrowerName(e.target.value)}
                className="input"
                placeholder="Borrower's full name"
              />
            </Field>

            <Field label="Borrower email">
              <input
                type="email"
                value={borrowerEmail}
                onChange={(e) => setBorrowerEmail(e.target.value)}
                className="input"
                placeholder="borrower@example.com"
              />
            </Field>

            <Field label="Loan type">
              <select
                value={loanType}
                onChange={(e) => setLoanType(e.target.value)}
                className="input"
              >
                {LOAN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Signing date & time">
              <input
                type="datetime-local"
                value={signingDateTime}
                onChange={(e) => setSigningDateTime(e.target.value)}
                className="input"
              />
            </Field>

            <Field label="Street address">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input"
                placeholder="123 Main St"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="City">
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="input"
                  placeholder="Austin"
                />
              </Field>
              <Field label="State">
                <input
                  type="text"
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  className="input"
                  placeholder="TX"
                />
              </Field>
            </div>

            <Field label="Fee ($, optional)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                className="input"
                placeholder="150.00"
              />
            </Field>

            <div className="sm:col-span-2">
              {formError && <p className="alert-error mb-3">{formError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full sm:w-auto"
              >
                {submitting ? "Starting payment…" : "Continue to payment"}
              </button>
            </div>
          </form>
        </div>

        {/* Your jobs */}
        <div className="mt-10">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Your jobs</h2>
              <p className="mt-1 text-sm text-slate-600">
                Offers go out to vetted notaries automatically — no manual
                assignment.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {!loadingJobs && jobs.length > 0 && (
                <span className="text-sm text-slate-600">
                  {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
                </span>
              )}
              <button
                type="button"
                onClick={() => void refreshJobs()}
                disabled={loadingJobs}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-teal-600 hover:bg-teal-50 hover:text-teal-800 disabled:opacity-60"
              >
                {loadingJobs ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>
          {loadingJobs ? (
            <p className="mt-3 text-sm text-slate-600">Loading…</p>
          ) : jobs.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <p className="text-sm text-slate-700">
                No jobs yet. Post your first signing above.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  paying={payingJobId === job.id}
                  onPay={onPay}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function JobCard({
  job,
  paying,
  onPay,
}: {
  job: BusinessJob;
  paying: boolean;
  onPay: (jobId: string) => void;
}) {
  const dispatch = job.dispatch;
  const unpaid = !job.paid_at;
  return (
    <li className="glass p-5 transition hover:border-teal-300 hover:bg-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-slate-900">{job.borrower_name}</p>
          <p className="mt-0.5 text-sm text-slate-600">
            {[job.loan_type, locationLabel(job)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {unpaid ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Awaiting payment
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                Paid
              </span>
              <StatusBadge status={job.status} />
            </>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
        {job.signing_date_time && (
          <span>{formatDate(job.signing_date_time)}</span>
        )}
        {job.fee_amount != null && (
          <span className="font-medium text-slate-700">
            ${job.fee_amount.toFixed(2)}
          </span>
        )}
      </div>

      {unpaid ? (
        // Unpaid jobs are never dispatched — payment comes first.
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">
              Awaiting payment
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              This job is offered to notaries as soon as the signing fee is paid.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onPay(job.id)}
            disabled={paying}
            className="btn-primary px-4 py-2 text-sm"
          >
            {paying ? "Opening…" : "Pay now"}
          </button>
        </div>
      ) : (
        /* Dispatch state — updated automatically by the cascade, never manually */
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <span
            aria-hidden="true"
            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dispatchDot(dispatch.code)}`}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">{dispatch.label}</p>
            {dispatch.detail && (
              <p className="mt-0.5 text-xs text-slate-600">{dispatch.detail}</p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

/** Dot colour per dispatch state (matches the status badge palette). */
function dispatchDot(code: BusinessJob["dispatch"]["code"]): string {
  switch (code) {
    case "assigned":
      return "bg-teal-500";
    case "awaiting":
      return "bg-amber-500";
    case "completed":
      return "bg-emerald-500";
    case "cancelled":
      return "bg-slate-400";
    default:
      return "bg-amber-400";
  }
}

function locationLabel(job: BusinessJob): string {
  const parts = [job.city, job.state].filter(Boolean);
  return parts.length ? parts.join(", ") : job.address ?? "";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    assigned: "bg-teal-50 text-teal-700 ring-teal-200",
    completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  const style = styles[status] ?? styles.pending;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {required && (
          <span className="text-orange-600" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
