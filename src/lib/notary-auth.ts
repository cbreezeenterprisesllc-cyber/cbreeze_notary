// C Breeze Notary and Signing — notary authentication (Postgres-backed).
//
// Mirrors ~/lib/auth.ts (business auth) exactly: bcrypt password hashing, a
// unique-email check, and a sealed session cookie. The ONE deliberate
// difference is the cookie name ("cbreeze_notary" vs "cbreeze") so a business
// session and a notary session can never collide in the same browser.
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
import { STATE_CODES } from "./states";

export interface NotaryUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  commission_number: string | null;
  /** ISO date, YYYY-MM-DD (or null when the notary did not supply it). */
  commission_expiry: string | null;
  /** Two-letter state codes, e.g. ["TX", "OK"]. Stored as JSONB in Postgres. */
  states_served: string[];
  bio: string | null;
  created_at: string | null;
}

export interface NotarySignupInput {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
  commission_number?: string | null;
  commission_expiry?: string | null;
  states_served?: string[];
  bio?: string | null;
}

export interface NotaryLoginInput {
  email: string;
  password: string;
}

interface SessionShape {
  notaryId?: string;
}

/** Row shape returned by pg for the `notaries` table. */
interface NotaryRow {
  id: string;
  name: string;
  email: string;
  password_hash?: string;
  phone: string | null;
  commission_number: string | null;
  commission_expiry: string | null;
  states_served: unknown;
  bio: string | null;
  created_at: string | Date | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * The notary session cookie is sealed with the same SESSION_SECRET as the
 * business cookie but stored under its own name, so the two sessions are
 * independent. In production set SESSION_SECRET (>= 32 chars) in the
 * environment; the fallback below is for local dev only.
 */
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
    name: "cbreeze_notary",
    maxAge: SESSION_MAX_AGE,
    cookie: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure,
      path: "/",
    },
  };
}

/** Normalise a JSONB `states_served` value into a clean string array. */
function parseStates(value: unknown): string[] {
  let raw: unknown = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => String(s ?? "").trim().toUpperCase())
    .filter((s) => s.length === 2);
}

/** Normalise a DATE column (pg returns a JS Date) to YYYY-MM-DD. */
function normDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const text = String(value);
  return text.slice(0, 10) || null;
}

function normText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function toNotaryUser(row: NotaryRow): NotaryUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    commission_number: row.commission_number,
    commission_expiry: normDate(row.commission_expiry),
    states_served: parseStates(row.states_served),
    bio: row.bio,
    created_at: normText(row.created_at),
  };
}

/** Columns returned to the client — never includes password_hash. */
const SELECT_COLUMNS = `id, name, email, phone, commission_number,
  commission_expiry::text AS commission_expiry, states_served, bio, created_at`;

function validateSignup(input: NotarySignupInput): NotarySignupInput {
  const raw = (input ?? {}) as Partial<NotarySignupInput>;
  const name = (raw.name ?? "").trim();
  const email = (raw.email ?? "").trim().toLowerCase();
  const password = raw.password ?? "";
  const commissionNumber = (raw.commission_number ?? "").trim();
  const commissionExpiry = (raw.commission_expiry ?? "").trim();

  if (!name) throw new Error("Full name is required.");
  if (!EMAIL_RE.test(email)) throw new Error("A valid email address is required.");
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  if (!commissionNumber) {
    throw new Error("Commission number is required.");
  }
  if (commissionExpiry && !DATE_RE.test(commissionExpiry)) {
    throw new Error("Commission expiry must be a valid date (YYYY-MM-DD).");
  }

  const states = Array.from(
    new Set(
      (Array.isArray(raw.states_served) ? raw.states_served : [])
        .map((s) => String(s ?? "").trim().toUpperCase())
        .filter((s) => s.length === 2),
    ),
  );
  if (states.length === 0) {
    throw new Error("Select at least one state you are commissioned in.");
  }
  const invalid = states.filter((s) => !STATE_CODES.includes(s));
  if (invalid.length > 0) {
    throw new Error(`Unknown state code(s): ${invalid.join(", ")}`);
  }

  return {
    name,
    email,
    password,
    phone: raw.phone?.trim() || null,
    commission_number: commissionNumber,
    commission_expiry: commissionExpiry || null,
    states_served: states,
    bio: raw.bio?.trim() || null,
  };
}

function validateLogin(input: NotaryLoginInput): NotaryLoginInput {
  const raw = (input ?? {}) as Partial<NotaryLoginInput>;
  const email = (raw.email ?? "").trim().toLowerCase();
  const password = raw.password ?? "";
  if (!EMAIL_RE.test(email)) throw new Error("A valid email address is required.");
  if (!password) throw new Error("Password is required.");
  return { email, password };
}

/** Return the currently authenticated notary, or null if not logged in. */
export const getCurrentNotary = createServerFn().handler(async () => {
  const session = await getSession<SessionShape>(getSessionConfig());
  const id = session.data?.notaryId;
  if (!id) return null;
  await ensureDb();
  try {
    const rows = await query<NotaryRow>(
      `SELECT ${SELECT_COLUMNS} FROM notaries WHERE id = $1 LIMIT 1`,
      [id],
    );
    const notary = rows[0];
    return notary ? toNotaryUser(notary) : null;
  } catch {
    return null;
  }
});

export const signupNotary = createServerFn({ method: "POST" })
  .validator(validateSignup)
  .handler(async ({ data }) => {
    await ensureDb();
    const existing = await query<{ id: string }>(
      "SELECT id FROM notaries WHERE email = $1 LIMIT 1",
      [data.email],
    );
    if (existing.length > 0) {
      throw new Error("An account with that email already exists.");
    }
    const password_hash = await hash(data.password, 10);
    const rows = await query<NotaryRow>(
      `INSERT INTO notaries
         (name, email, password_hash, phone, commission_number, commission_expiry, states_served, bio)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       RETURNING ${SELECT_COLUMNS}`,
      [
        data.name,
        data.email,
        password_hash,
        data.phone ?? null,
        data.commission_number ?? null,
        data.commission_expiry ?? null,
        JSON.stringify(data.states_served ?? []),
        data.bio ?? null,
      ],
    );
    const notary = rows[0];
    const session = await useSession<SessionShape>(getSessionConfig());
    await session.update({ notaryId: notary.id });
    return toNotaryUser(notary);
  });

export const loginNotary = createServerFn({ method: "POST" })
  .validator(validateLogin)
  .handler(async ({ data }) => {
    await ensureDb();
    const rows = await query<NotaryRow>(
      `SELECT ${SELECT_COLUMNS}, password_hash FROM notaries WHERE email = $1 LIMIT 1`,
      [data.email],
    );
    const notary = rows[0];
    if (!notary || !notary.password_hash) {
      throw new Error("Invalid email or password.");
    }
    const ok = await compare(data.password, notary.password_hash);
    if (!ok) {
      throw new Error("Invalid email or password.");
    }
    const session = await useSession<SessionShape>(getSessionConfig());
    await session.update({ notaryId: notary.id });
    return toNotaryUser(notary);
  });

export const logoutNotary = createServerFn({ method: "POST" }).handler(async () => {
  await clearSession(getSessionConfig());
  return { ok: true };
});
