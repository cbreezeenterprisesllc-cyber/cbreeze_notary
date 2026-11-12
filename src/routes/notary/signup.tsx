import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";
import { signupNotary } from "~/lib/notary-auth";
import { US_STATES } from "~/lib/states";

export const Route = createFileRoute("/notary/signup")({
  component: NotarySignupPage,
});

function NotarySignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [commissionNumber, setCommissionNumber] = useState("");
  const [commissionExpiry, setCommissionExpiry] = useState("");
  const [states, setStates] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleState(code: string) {
    setStates((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code],
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (states.length === 0) {
      setError("Select at least one state you are commissioned in.");
      return;
    }
    setLoading(true);
    try {
      await signupNotary({
        data: {
          name,
          email,
          password,
          phone: phone || null,
          commission_number: commissionNumber,
          commission_expiry: commissionExpiry || null,
          states_served: states,
          bio: bio || null,
        },
      });
      navigate({ to: "/notary/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative overflow-hidden py-16 sm:py-24">
      {/* Soft brand wash behind the auth card */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(13,148,136,0.10),transparent_70%)]" />
      <div className="pointer-events-none absolute -bottom-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-200/50 blur-3xl" />

      <div className="relative mx-auto max-w-xl px-6">
        <div className="text-center">
          <span className="eyebrow">Notary network</span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
            Join as a signing notary
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Get pre-screened signing assignments in the states you serve.
          </p>
        </div>

        <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6">
          <Field label="Full name" required>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Jordan Ellis"
              autoComplete="name"
            />
          </Field>

          <Field label="Email" required>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="jordan@example.com"
              autoComplete="email"
            />
          </Field>

          <Field label="Password" required>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </Field>

          <Field label="Phone">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="(555) 123-4567"
              autoComplete="tel"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Commission number" required>
              <input
                type="text"
                required
                value={commissionNumber}
                onChange={(e) => setCommissionNumber(e.target.value)}
                className="input"
                placeholder="e.g. 1234567-1"
              />
            </Field>

            <Field label="Commission expiry">
              <input
                type="date"
                value={commissionExpiry}
                onChange={(e) => setCommissionExpiry(e.target.value)}
                className="input"
              />
            </Field>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="label mb-1.5">
                States served{" "}
                <span className="text-orange-600" aria-hidden="true">
                  *
                </span>
              </span>
              {states.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStates([])}
                  className="text-xs font-medium text-slate-600 underline-offset-4 hover:text-teal-700 hover:underline"
                >
                  Clear ({states.length})
                </button>
              )}
            </div>
            <div
              role="group"
              aria-label="States served"
              className="grid grid-cols-4 gap-2 sm:grid-cols-6"
            >
              {US_STATES.map((state) => {
                const selected = states.includes(state.code);
                return (
                  <button
                    key={state.code}
                    type="button"
                    aria-pressed={selected}
                    title={state.name}
                    onClick={() => toggleState(state.code)}
                    className={`rounded-lg border px-2 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                      selected
                        ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                        : "border-slate-300 bg-white text-slate-700 hover:border-teal-500 hover:bg-teal-50"
                    }`}
                  >
                    {state.code}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {states.length === 0
                ? "Tap every state where you hold an active commission."
                : `${states.length} selected: ${states.join(", ")}`}
            </p>
          </div>

          <Field label="Short bio">
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="input resize-y"
              placeholder="Years of experience, signing specialties, availability…"
            />
          </Field>

          {error && <p className="alert-error">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account…" : "Create notary account"}
          </button>

          <p className="text-center text-sm text-slate-600">
            Already have a notary account?{" "}
            <Link
              to="/notary/login"
              className="font-semibold text-teal-700 underline-offset-4 hover:text-teal-800 hover:underline"
            >
              Log in
            </Link>
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          We only use your details to match and confirm signings.
        </p>
      </div>
    </section>
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
