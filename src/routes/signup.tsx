import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";
import { signupBusiness } from "~/lib/auth";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signupBusiness({
        data: {
          name,
          email,
          password,
          company_name: companyName || null,
          phone: phone || null,
        },
      });
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      {/* Soft brand wash behind the auth card */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(13,148,136,0.10),transparent_70%)]" />
      <div className="pointer-events-none absolute -bottom-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-200/50 blur-3xl" />

      <div className="relative mx-auto max-w-md px-6">
        <div className="text-center">
          <span className="eyebrow">Business account</span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
            Create your business account
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            For title companies, lenders &amp; escrow firms.
          </p>
        </div>

        <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6">
          <Field label="Contact name">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Jane Doe"
            />
          </Field>

          <Field label="Company name">
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="input"
              placeholder="Acme Title & Escrow"
            />
          </Field>

          <Field label="Work email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="jane@acmetitle.com"
            />
          </Field>

          <Field label="Phone">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="(555) 123-4567"
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="At least 8 characters"
            />
          </Field>

          {error && <p className="alert-error">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account…" : "Create account"}
          </button>

          <p className="text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link
              to="/login"
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
