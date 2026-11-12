// C Breeze Notary and Signing — business authentication (Postgres-backed).
//
// Server functions are defined here with `createServerFn`; TanStack Start splits
// the `.handler()` bodies (and their server-only imports) into the server bundle
// so the browser only ever receives the thin fetch wrappers. `bcryptjs`, `pg`
// (via ~/db) and `@tanstack/start-server-core` are therefore never shipped to
// the client.
import { createServerFn } from "@tanstack/react-start";
import { compare, hash } from "bcryptjs";
import {
  clearSession,
  getRequestProtocol,
  getSession,
  useSession,
} from "@tanstack/start-server-core";
import { ensureDb, query } from "~/db/index";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  company_name?: string | null;
  phone?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

interface SessionShape {
  businessId?: string;
}

/** Row shape returned by pg for the `businesses` table. */
interface BusinessRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  company_name: string | null;
  phone: string | null;
  created_at: string | Date;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// The session cookie is sealed with a secret. In production set SESSION_SECRET
// (>= 32 chars) in the environment; the fallback below is for local dev only.
function getSessionConfig() {
  const password =
    (typeof process !== "undefined" && process.env?.SESSION_SECRET) ||
    "cbreeze-notary-dev-secret-0123456789-32chars";
  // Set the Secure flag only when the request arrived over HTTPS (the reverse
  // proxy sets x-forwarded-proto on the published site), so the cookie stays
  // secure in prod but still works over plain HTTP during local dev.
  let secure = true;
  try {
    secure = getRequestProtocol() === "https";
  } catch {
    secure = true;
  }
  return {
    password,
    name: "cbreeze",
    maxAge: SESSION_MAX_AGE,
    cookie: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure,
      path: "/",
    },
  };
}

function toAuthUser(b: BusinessRow): AuthUser {
  return {
    id: b.id,
    name: b.name,
    email: b.email,
    company_name: b.company_name,
  };
}

function validateSignup(input: SignupInput): SignupInput {
  const raw = (input ?? {}) as Partial<SignupInput>;
  const name = (raw.name ?? "").trim();
  const email = (raw.email ?? "").trim().toLowerCase();
  const password = raw.password ?? "";
  if (!name) throw new Error("Full name is required.");
  if (!EMAIL_RE.test(email)) throw new Error("A valid email address is required.");
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  return {
    name,
    email,
    password,
    company_name: raw.company_name?.trim() || null,
    phone: raw.phone?.trim() || null,
  };
}

function validateLogin(input: LoginInput): LoginInput {
  const raw = (input ?? {}) as Partial<LoginInput>;
  const email = (raw.email ?? "").trim().toLowerCase();
  const password = raw.password ?? "";
  if (!EMAIL_RE.test(email)) throw new Error("A valid email address is required.");
  if (!password) throw new Error("Password is required.");
  return { email, password };
}

/** Return the currently authenticated business, or null if not logged in. */
export const getCurrentBusiness = createServerFn().handler(async () => {
  const session = await getSession<SessionShape>(getSessionConfig());
  const id = session.data?.businessId;
  if (!id) return null;
  await ensureDb();
  try {
    const rows = await query<BusinessRow>(
      "SELECT id, name, email, company_name FROM businesses WHERE id = $1 LIMIT 1",
      [id],
    );
    const business = rows[0];
    return business ? toAuthUser(business) : null;
  } catch {
    return null;
  }
});

export const signupBusiness = createServerFn({ method: "POST" })
  .validator(validateSignup)
  .handler(async ({ data }) => {
    await ensureDb();
    const existing = await query<{ id: string }>(
      "SELECT id FROM businesses WHERE email = $1 LIMIT 1",
      [data.email],
    );
    if (existing.length > 0) {
      throw new Error("An account with that email already exists.");
    }
    const password_hash = await hash(data.password, 10);
    const rows = await query<BusinessRow>(
      `INSERT INTO businesses (name, email, password_hash, company_name, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, company_name`,
      [data.name, data.email, password_hash, data.company_name ?? null, data.phone ?? null],
    );
    const business = rows[0];
    const session = await useSession<SessionShape>(getSessionConfig());
    await session.update({ businessId: business.id });
    return toAuthUser(business);
  });

export const loginBusiness = createServerFn({ method: "POST" })
  .validator(validateLogin)
  .handler(async ({ data }) => {
    await ensureDb();
    const rows = await query<BusinessRow>(
      "SELECT id, name, email, password_hash, company_name FROM businesses WHERE email = $1 LIMIT 1",
      [data.email],
    );
    const business = rows[0];
    if (!business) {
      throw new Error("Invalid email or password.");
    }
    const ok = await compare(data.password, business.password_hash);
    if (!ok) {
      throw new Error("Invalid email or password.");
    }
    const session = await useSession<SessionShape>(getSessionConfig());
    await session.update({ businessId: business.id });
    return toAuthUser(business);
  });

export const logoutBusiness = createServerFn({ method: "POST" }).handler(async () => {
  await clearSession(getSessionConfig());
  return { ok: true };
});
