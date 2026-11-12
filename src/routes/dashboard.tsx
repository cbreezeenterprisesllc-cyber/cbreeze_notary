import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getCurrentBusiness, logoutBusiness } from "~/lib/auth";
import { createJob } from "~/lib/jobs";
import { listMyJobsWithDispatch } from "~/lib/dispatch";
import type { BusinessJob } from "~/lib/dispatch";

export const Route = createFileRoute("/dashboard")({
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
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<BusinessJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

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
    setSubmitting(true);
    try {
      await createJob({
        data: {
          borrower_name: borrowerName,
          borrower_email: borrowerEmail || null,
          loan_type: loanType,
          address: address || null,
          city: city || null,
          state: state || null,
          signing_date_time: signingDateTime || null,
          fee_amount: feeAmount ? Number(feeAmount) : null,
        },
      });
      // reset form and refresh list
      setBorrowerName("");
      setBorrowerEmail("");
      setLoanType("Refinance");
      setAddress("");
      setCity("");
      setState("");
      setSigningDateTime("");
      setFeeAmount("");
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
                Fill in the signing details and we&apos;ll match a vetted local
                notary.
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
                {submitting ? "Posting…" : "Post job"}
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
                <JobCard key={job.id} job={job} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function JobCard({ job }: { job: BusinessJob }) {
  const dispatch = job.dispatch;
  return (
    <li className="glass p-5 transition hover:border-teal-300 hover:bg-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-slate-900">{job.borrower_name}</p>
          <p className="mt-0.5 text-sm text-slate-600">
            {[job.loan_type, locationLabel(job)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <StatusBadge status={job.status} />
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

      {/* Dispatch state — updated automatically by the cascade, never manually */}
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
