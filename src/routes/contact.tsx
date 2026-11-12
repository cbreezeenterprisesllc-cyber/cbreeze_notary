import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/contact")({
  component: Contact,
});

const HERO_GRADIENT =
  "bg-[linear-gradient(135deg,#f0fdfa_0%,#ecfeff_28%,#f5f3ff_62%,#fff7ed_100%)]";

function Contact() {
  return (
    <>
      {/* ───── Hero ───── */}
      <section className={`relative overflow-hidden text-slate-900 ${HERO_GRADIENT}`}>
        <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-teal-300/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-violet-300/40 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="eyebrow">We reply within one business day</span>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Get in{" "}
              <span className="bg-gradient-to-br from-teal-600 via-violet-600 to-orange-600 bg-clip-text text-transparent">
                Touch
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-700 sm:text-xl">
              Have a question, want to sign up, or need a signing urgently?
              We're here to help.
            </p>
          </div>
        </div>
      </section>

      {/* ───── Contact ───── */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-16 lg:grid-cols-2">
              {/* Contact Form */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Send Us a Message
                </h2>
                <p className="mt-2 text-slate-600">
                  Fill out the form and we'll get back to you within 24 hours.
                </p>
                <form
                  className="mt-8 space-y-6"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <div>
                    <label htmlFor="name" className="label">
                      Full name
                    </label>
                    <input
                      id="name"
                      type="text"
                      placeholder="Jane Smith"
                      className="input mt-2 px-4 py-3"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="label">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="jane@example.com"
                      className="input mt-2 px-4 py-3"
                    />
                  </div>
                  <div>
                    <label htmlFor="subject" className="label">
                      Subject
                    </label>
                    <select
                      id="subject"
                      className="input mt-2 px-4 py-3"
                      defaultValue=""
                    >
                      <option value="">Select a subject</option>
                      <option value="business">I need a signing</option>
                      <option value="notary">I want to join as a notary</option>
                      <option value="general">General inquiry</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="message" className="label">
                      Message
                    </label>
                    <textarea
                      id="message"
                      rows={5}
                      placeholder="Tell us how we can help..."
                      className="input mt-2 px-4 py-3"
                    />
                  </div>
                  <button type="submit" className="btn-primary w-full px-6 py-3.5 text-base">
                    Send Message
                  </button>
                </form>
              </div>

              {/* Contact Info */}
              <div className="lg:pt-16">
                <div className="card p-8">
                  <h3 className="text-xl font-semibold text-slate-900">
                    Contact Information
                  </h3>
                  <div className="mt-8 space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-700">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">
                          Phone
                        </h4>
                        <p className="mt-1 text-slate-700">
                          609-547-9169
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-700">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">
                          Office
                        </h4>
                        <p className="mt-1 text-slate-700">
                          Serving clients nationwide
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-teal-800 via-teal-700 to-violet-800 p-8 text-white shadow-lg shadow-teal-900/20 ring-1 ring-teal-900/10">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-300/25 blur-2xl" />
                  <h3 className="relative text-xl font-semibold text-white">
                    Need a signing urgently?
                  </h3>
                  <p className="relative mt-2 text-teal-50">
                    Call us at 609-547-9169 for same-day assignments when
                    available.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
