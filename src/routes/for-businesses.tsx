import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/for-businesses")({
  component: ForBusinesses,
});

const HERO_GRADIENT =
  "bg-[linear-gradient(135deg,#f0fdfa_0%,#ecfeff_28%,#f5f3ff_62%,#fff7ed_100%)]";

function ForBusinesses() {
  return (
    <>
      {/* ───── Hero ───── */}
      <section className={`relative overflow-hidden text-slate-900 ${HERO_GRADIENT}`}>
        <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-teal-300/40 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Post a Job. We Handle the Rest.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-700 sm:text-xl">
              Stop wasting time tracking down notaries. C Breeze gives you a
              single point of contact for reliable, vetted signing agents in all
              50 states.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/signup"
                className="w-full btn-primary px-8 py-4 text-base sm:w-auto"
              >
                Get Started
              </Link>
              <Link
                to="/login"
                className="btn-ghost w-full px-8 py-4 text-base sm:w-auto"
              >
                Business log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Features ───── */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Built for Title Companies, Lenders &amp; Escrow Firms
            </h2>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Post a Signing Job",
                body: "Tell us the location, date, and loan type. Our system immediately scans our vetted notary network for the best match.",
              },
              {
                title: "Vetted Professionals",
                body: "Every notary is background-checked, properly commissioned, and experienced in loan document signings. No surprises.",
              },
              {
                title: "One Point of Contact",
                body: "You deal with C Breeze — not a dozen individual notaries. We manage scheduling, confirmations, and logistics end-to-end.",
              },
              {
                title: "Nationwide Coverage",
                body: "Active, vetted notaries in every state. Multi-state closings? We handle all locations seamlessly.",
              },
              {
                title: "Fast Turnaround",
                body: "Average assignment time is under 2 hours. Need someone today? We can often assign a notary the same day.",
              },
              {
                title: "Transparent Pricing",
                body: "Flat per-signing fee, no hidden charges, no monthly commitment. You only pay when you book a signing.",
              },
            ].map((f) => (
              <div key={f.title} className="glass p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-violet-500 text-xl font-bold text-white">
                  &#9741;
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

      {/* ───── How It Works ───── */}
      <section className="bg-wash py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              How It Works for Businesses
            </h2>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-4">
            {[
              {
                title: "Create an Account",
                body: "Sign up in minutes. Tell us about your company and how we can reach you.",
              },
              {
                title: "Post a Signing",
                body: "Enter the details — location, date, document type. Our system finds the best notary for the job.",
              },
              {
                title: "Notary Assigned",
                body: "We assign a vetted notary and confirm the appointment. You get a notification with all the details.",
              },
              {
                title: "Signing Complete",
                body: "The notary completes the signing professionally. Documents are returned, and you're notified immediately.",
              },
            ].map((step, i) => (
              <div key={step.title} className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-violet-500 text-2xl font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-6 text-lg font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-3 text-slate-600">{step.body}</p>
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
            Ready to simplify your signings?
          </h2>
          <p className="mt-4 text-lg text-slate-700">
            Join other title companies, lenders, and escrow firms who trust C
            Breeze.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/signup"
              className="btn-primary px-8 py-4 text-base"
            >
              Create an account
            </Link>
            <Link
              to="/contact"
              className="btn-ghost px-8 py-4 text-base"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
