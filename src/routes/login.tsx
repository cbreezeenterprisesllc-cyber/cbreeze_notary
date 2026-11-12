import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";
import { loginBusiness } from "~/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginBusiness({ data: { email, password } });
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
          <span className="eyebrow">Welcome back</span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">
            Log in to your account
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Post signing jobs and manage your notaries.
          </p>
        </div>

        <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6">
          <label className="block">
            <span className="label">Work email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="jane@acmetitle.com"
            />
          </label>

          <label className="block">
            <span className="label">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Your password"
            />
          </label>

          {error && <p className="alert-error">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Logging in…" : "Log in"}
          </button>

          <p className="text-center text-sm text-slate-600">
            Don&apos;t have an account?{" "}
            <Link
              to="/signup"
              className="font-semibold text-teal-700 underline-offset-4 hover:text-teal-800 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </section>
  );
}
