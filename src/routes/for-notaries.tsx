import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/for-notaries")({
  component: ForNotaries,
});

const HERO_GRADIENT =
  "bg-[linear-gradient(135deg,#f0fdfa_0%,#ecfeff_28%,#f5f3ff_62%,#fff7ed_100%)]";

function ForNotaries() {
  return (
    <>
      {/* ───── Hero ───── */}
      <section className={`relative overflow-hidden text-slate-900 ${HERO_GRADIENT}`}>
        <div className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-violet-300/40 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Steady Signing Work, Without the Marketing
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-700 sm:text-xl">
              You're a great notary. Let us handle finding the clients. Join our
              network and get a steady stream of pre-screened signing
              assignments in the states you serve.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/notary/signup"
                className="w-full btn-primary px-8 py-4 text-base sm:w-auto"
              >
                Apply to Join
              </Link>
              <Link
                to="/notary/login"
                className="btn-ghost w-full px-8 py-4 text-base sm:w-auto"
              >
                Notary log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Benefits ───── */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Why Join the C Breeze Network?
            </h2>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Consistent Assignments",
                body: "Stop spending time and money on marketing. We bring the clients to you — pre-screened and ready to book.",
              },
              {
                title: "Set Your States",
                body: "Tell us which states you're commissioned in and we'll only send you assignments that match your coverage area.",
              },
              {
                title: "Guaranteed Payment",
                body: "We handle the billing. You get paid a flat rate per signing — no chasing invoices, no payment delays.",
              },
              {
                title: "Flexible Schedule",
                body: "Accept the assignments that fit your schedule. You decide when and where you work.",
              },
              {
                title: "Vetted & Respected",
                body: "Being part of the C Breeze network signals professionalism. You'll be matched with reputable title companies and lenders.",
              },
              {
                title: "Simple Onboarding",
                body: "Submit your commission information and credentials. Once approved, you're live and ready to receive assignments.",
              },
            ].map((f) => (
              <div key={f.title} className="glass p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-orange-500 text-xl font-bold text-white">
                  &#9733;
                </div>
                <h3 className="mt-6 text-lg font-semibold text-slate-900">
                  {f.title}
                </h3>
                <p className="mt-3 text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Requirements ───── */}
      <section className="bg-wash py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              What You Need
            </h2>
          </div>
          <div className="mx-auto mt-12 max-w-2xl space-y-6">
            {[
              {
                title: "Active Notary Commission",
                body: "You must hold a current, valid notary commission in at least one state.",
              },
              {
                title: "Loan Signing Experience",
                body: "Experience with loan document signings is preferred. NNA certification or equivalent a plus.",
              },
              {
                title: "Reliable & Professional",
                body: "You show up on time, dress professionally, and handle documents with care. Your reputation is our reputation.",
              },
              {
                title: "Background Check",
                body: "All network notaries must pass a background check. We take trust and security seriously.",
              },
            ].map((r, i) => (
              <div key={r.title} className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-700">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{r.title}</h3>
                  <p className="mt-1 text-slate-600">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="relative overflow-hidden py-24">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,#ccfbf1_0%,#ede9fe_55%,#ffedd5_100%)]" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Ready to join our network?
          </h2>
          <p className="mt-4 text-lg text-slate-700">
            Get consistent signing work without the hassle of marketing
            yourself. Apply today.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/notary/signup"
              className="btn-primary px-8 py-4 text-base"
            >
              Apply Now
            </Link>
            <Link
              to="/notary/login"
              className="btn-ghost px-8 py-4 text-base"
            >
              Notary log in
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
