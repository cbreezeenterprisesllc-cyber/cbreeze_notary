import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

const HERO_GRADIENT =
  "bg-[linear-gradient(135deg,#f0fdfa_0%,#ecfeff_28%,#f5f3ff_62%,#fff7ed_100%)]";

function Home() {
  return (
    <>
      {/* ───── Hero ───── */}
      <section className={`relative overflow-hidden text-slate-900 ${HERO_GRADIENT}`}>
        <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-teal-300/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-violet-300/40 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow">
              Nationwide Loan Signing Service
            </span>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Reliable Signings.{" "}
              <span className="bg-gradient-to-br from-teal-600 via-violet-600 to-orange-600 bg-clip-text text-transparent">
                One Call.
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-700 sm:text-xl">
              Title companies, lenders, and escrow firms — stop hunting for
              notaries. Post a job, we assign a vetted local professional. No
              no-shows, no headaches.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/for-businesses"
                className="w-full btn-primary w-full px-8 py-4 text-base sm:w-auto sm:w-auto"
              >
                I Need a Signing
              </Link>
              <Link
                to="/notary/signup"
                className="w-full btn-ghost w-full px-8 py-4 text-base backdrop-blur-sm sm:w-auto sm:w-auto"
              >
                I'm a Notary
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Trust Signals ───── */}
      <section className="border-b border-slate-200 py-12">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-600">
            Trusted by professionals nationwide
          </p>
          <div className="mt-8 grid grid-cols-2 gap-8 md:grid-cols-4">
            {["TitleCo", "SecureLend", "EscrowFirst", "Prime Settlements"].map(
              (name) => (
                <div
                  key={name}
                  className="flex items-center justify-center text-lg font-bold text-slate-500"
                >
                  {name}
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ───── How It Works ───── */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Three simple steps to get your documents signed.
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Post a Job",
                body: "Tell us the location, date, and document type. Our platform instantly matches you with vetted notaries in that area.",
              },
              {
                title: "We Assign a Notary",
                body: "We hand-pick a qualified signing agent and confirm the appointment. You get one point of contact — no back-and-forth with a dozen notaries.",
              },
              {
                title: "Signing Done",
                body: "The notary handles the signing professionally. Documents are returned promptly. You get notified the moment it's complete.",
              },
            ].map((step, i) => (
              <div key={step.title} className="glass p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-violet-500 text-xl font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-6 text-xl font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-3 text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Value Props ───── */}
      <section className="bg-wash py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Why Choose C Breeze?
            </h2>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Vetted Notaries",
              "Nationwide Coverage",
              "One Point of Contact",
              "Fast Turnaround",
              "Reliable & Professional",
              "Simple Pricing",
            ].map((title) => (
              <div key={title} className="glass p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-2xl text-teal-700 ring-1 ring-teal-100">
                  &#10003;
                </div>
                <h3 className="mt-6 text-lg font-semibold text-slate-900">
                  {title}
                </h3>
                <p className="mt-3 text-slate-600">{valueBody(title)}</p>
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
            Join the businesses that trust C Breeze for their loan document
            signings. Get started in minutes.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/signup"
              className="w-full btn-primary w-full px-8 py-4 text-base sm:w-auto sm:w-auto"
            >
              Start Now
            </Link>
            <Link
              to="/contact"
              className="btn-ghost w-full px-8 py-4 text-base sm:w-auto"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function valueBody(title: string): string {
  const bodies: Record<string, string> = {
    "Vetted Notaries":
      "Every notary in our network is background-checked, commissioned, and experienced in loan signings.",
    "Nationwide Coverage":
      "Active notaries in all 50 states. No matter where your closing is, we've got you covered.",
    "One Point of Contact":
      "You deal with us, not a dozen individual notaries. We handle scheduling, confirmations, and follow-ups.",
    "Fast Turnaround":
      "Average time from job post to notary assignment is under 2 hours. Urgent? We can often assign same-day.",
    "Reliable & Professional":
      "No no-shows. Our notaries are committed professionals with strong ratings. If something changes, we find a replacement immediately.",
    "Simple Pricing":
      "Flat, transparent per-signing fees. No hidden costs, no subscription required. Pay only when you book.",
  };
  return bodies[title] ?? "";
}
