import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getCurrentNotary, logoutNotary } from "~/lib/notary-auth";
import { getMyOffers, respondToOffer } from "~/lib/dispatch";
import type { MyOffers, NotaryOffer } from "~/lib/dispatch";
import { stateName } from "~/lib/states";

export const Route = createFileRoute("/notary/dashboard")({
  beforeLoad: async () => {
    const notary = await getCurrentNotary();
    if (!notary) {
      throw redirect({ to: "/notary/login" });
    }
    return { notary };
  },
  component: NotaryDashboard,
});

const EMPTY_OFFERS: MyOffers = {
  current: [],
  history: [],
  offer_timeout_minutes: 15,
};

function NotaryDashboard() {
  const { notary } = Route.useRouteContext();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const [offers, setOffers] = useState<MyOffers>(EMPTY_OFFERS);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [respondError, setRespondError] = useState<string | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const refreshOffers = useCallback(async () => {
    setLoadingOffers(true);
    try {
      setOffers(await getMyOffers());
    } catch {
      setOffers(EMPTY_OFFERS);
    } finally {
      setLoadingOffers(false);
    }
  }, []);

  // Loading the dashboard runs the dispatch sweep, so stale offers expire and
  // the next matching notary is offered as soon as this page opens.
  useEffect(() => {
    void refreshOffers();
  }, [refreshOffers]);

  async function onRespond(offer: NotaryOffer, action: "accept" | "decline") {
    setRespondError(null);
    setRespondingTo(offer.assignment_id);
    try {
      await respondToOffer({
        data: { assignment_id: offer.assignment_id, action },
      });
      await refreshOffers();
    } catch (err) {
      setRespondError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
      await refreshOffers();
    } finally {
      setRespondingTo(null);
    }
  }

  async function onLogout() {
    setBusy(true);
    try {
      await logoutNotary();
      navigate({ to: "/notary/login" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="relative overflow-hidden py-16 sm:py-20">
      {/* Soft brand wash behind the workspace */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(13,148,136,0.09),transparent_75%)]" />

      <div className="relative mx-auto max-w-4xl px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="eyebrow">Notary dashboard</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
              Welcome, {notary.name}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {notary.commission_number
                ? `Commission #${notary.commission_number}`
                : "Commission number not on file"}{" "}
              · {notary.email}
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

        {/* Offers — live offers from the automated dispatch engine */}
        <div className="mt-10">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Signing offers</h2>
              <p className="mt-1 text-sm text-slate-600">
                Offers are sent to you automatically when a job is posted in a
                state you serve. Respond within {offers.offer_timeout_minutes}{" "}
                minutes or the offer passes to the next notary.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshOffers()}
              disabled={loadingOffers}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-teal-600 hover:bg-teal-50 hover:text-teal-800 disabled:opacity-60"
            >
              {loadingOffers ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {respondError && <p className="alert-error mt-4">{respondError}</p>}

          {loadingOffers ? (
            <p className="mt-4 text-sm text-slate-600">Loading offers…</p>
          ) : offers.current.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <p className="text-sm text-slate-700">
                No open offers right now — when a signing job is posted in your
                states, an offer will appear here.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-4">
              {offers.current.map((offer) => (
                <OfferCard
                  key={offer.assignment_id}
                  offer={offer}
                  busy={respondingTo === offer.assignment_id}
                  onRespond={(action) => void onRespond(offer, action)}
                />
              ))}
            </ul>
          )}

          {offers.history.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Recent offers
              </h3>
              <ul className="mt-3 space-y-2">
                {offers.history.map((offer) => (
                  <HistoryRow key={offer.assignment_id} offer={offer} />
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Profile summary */}
        <div className="card mt-10 p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Your profile</h2>
          <p className="mt-1 text-sm text-slate-600">
            This is what we match signing jobs against.
          </p>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <ProfileItem label="Full name" value={notary.name} />
            <ProfileItem label="Email" value={notary.email} />
            <ProfileItem label="Phone" value={notary.phone ?? "—"} />
            <ProfileItem
              label="Commission number"
              value={notary.commission_number ?? "—"}
            />
            <ProfileItem
              label="Commission expiry"
              value={formatExpiry(notary.commission_expiry)}
            />
            <ProfileItem
              label="States served"
              value={`${notary.states_served.length} ${
                notary.states_served.length === 1 ? "state" : "states"
              }`}
            />
          </dl>

          <div className="mt-6">
            <p className="label">States you serve</p>
            {notary.states_served.length === 0 ? (
              <p className="text-sm text-slate-600">No states on file yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {notary.states_served.map((code) => (
                  <li
                    key={code}
                    title={stateName(code)}
                    className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800"
                  >
                    {code}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {notary.bio && (
            <div className="mt-6">
              <p className="label">Bio</p>
              <p className="text-sm leading-relaxed text-slate-700">
                {notary.bio}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function OfferCard({
  offer,
  busy,
  onRespond,
}: {
  offer: NotaryOffer;
  busy: boolean;
  onRespond: (action: "accept" | "decline") => void;
}) {
  return (
    <li className="glass border-amber-300 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            New signing offer
          </p>
          <p className="mt-1.5 text-lg font-semibold text-slate-900">
            {offer.borrower_name}
          </p>
          <p className="mt-0.5 text-sm text-slate-600">
            {[offer.loan_type, offer.company_name].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          Expires in {minutesLeft(offer.expires_at)} min
        </span>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <OfferItem
          label="Signing date & time"
          value={offer.signing_date_time ? formatDateTime(offer.signing_date_time) : "To be confirmed"}
        />
        <OfferItem label="Location" value={locationLabel(offer)} />
        <OfferItem label="State" value={offer.state ? stateName(offer.state) : "—"} />
        <OfferItem label="Your pay" value={payLabel(offer)} strong />
      </dl>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={busy}
          onClick={() => onRespond("accept")}
          className="btn-primary px-5 py-2.5"
        >
          {busy ? "Sending…" : "Accept signing"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRespond("decline")}
          className="btn-ghost px-5 py-2.5"
        >
          Decline
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Declining passes the job to the next available notary automatically.
      </p>
    </li>
  );
}

function HistoryRow({ offer }: { offer: NotaryOffer }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">
          {offer.borrower_name}
        </p>
        <p className="mt-0.5 text-xs text-slate-600">
          {[
            offer.loan_type,
            offer.state,
            offer.signing_date_time ? formatDateTime(offer.signing_date_time) : null,
            payLabel(offer),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <OfferStatusBadge status={offer.status} jobStatus={offer.job_status} />
    </li>
  );
}

function OfferStatusBadge({
  status,
  jobStatus,
}: {
  status: string;
  jobStatus: string;
}) {
  const styles: Record<string, string> = {
    accepted: "bg-teal-50 text-teal-700 ring-teal-200",
    assigned: "bg-teal-50 text-teal-700 ring-teal-200",
    completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    declined: "bg-red-50 text-red-700 ring-red-200",
    expired: "bg-slate-100 text-slate-600 ring-slate-200",
    cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
    offered: "bg-amber-50 text-amber-700 ring-amber-200",
  };
  let label = status;
  if (status === "accepted" && jobStatus === "completed") label = "completed";
  if (status === "offered") label = "offer open";
  const style = styles[status] ?? styles.expired;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function OfferItem({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm ${strong ? "font-semibold text-teal-700" : "text-slate-700"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-700">{value}</dd>
    </div>
  );
}

function locationLabel(offer: NotaryOffer): string {
  const cityState = [offer.city, offer.state].filter(Boolean).join(", ");
  const parts = [offer.address, cityState].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Address to be confirmed";
}

function payLabel(offer: NotaryOffer): string {
  const amount = offer.notary_pay_amount ?? offer.fee_amount;
  if (amount == null) return "Fee TBD";
  return `$${amount.toFixed(2)}`;
}

/** Whole minutes left on an offer (0 when it has lapsed). */
function minutesLeft(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.round(ms / 60000));
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** "2027-03-15" → "Mar 15, 2027"; keeps unknown values visible as-is. */
function formatExpiry(value: string | null): string {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}
