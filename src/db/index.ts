// C Breeze Notary and Signing — database layer (standard Postgres over TCP).
//
// This module is server-only: import it from server functions (`createServerFn`)
// or API routes (`src/routes/api/*`), never from client components.
//
// It connects using `pg` (node-postgres) with `process.env.DATABASE_URL` — a
// standard Postgres connection string (the Neon *pooler* endpoint works here
// because it speaks ordinary Postgres over TCP; this is NOT the Neon serverless
// HTTP driver). If the variable is not configured, `query()` / `migrate()` throw
// a clear error — static/landing pages keep working, only DB features fail.
//
// The schema (src/db/schema.sql) is applied idempotently via `migrate()`.
import { Pool } from "pg";
import type { PoolClient, QueryResultRow } from "pg";
import schemaSql from "./schema.sql?raw";

let pool: Pool | null = null;

/** True when a DATABASE_URL is present (connection is attempted lazily). */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Pool size. Each serverless invocation may hold its own pool, so the default is
 * small on Vercel (many instances × many connections exhausts Neon's limit) and
 * larger for the long-lived port-3000 preview server. Override with PG_POOL_MAX.
 */
function poolMax(): number {
  const override = Number.parseInt(process.env.PG_POOL_MAX ?? "", 10);
  if (Number.isFinite(override) && override > 0) return override;
  return process.env.VERCEL ? 3 : 10;
}

function getPool(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Set the DATABASE_URL environment variable " +
        "(standard Postgres connection string) and republish before using database features.",
    );
  }
  pool = new Pool({
    connectionString: url,
    // Neon requires TLS; rejectUnauthorized:false skips CA-chain verification
    // (the connection itself is still encrypted).
    ssl: { rejectUnauthorized: false },
    max: poolMax(),
    // Serverless instances come and go, so don't hold idle sockets for long.
    // No connectionTimeoutMillis: Neon suspends when idle and the first connect
    // can take a while — a timeout there would surface as a 500 on a cold start.
    idleTimeoutMillis: 10_000,
  });
  return pool;
}

/**
 * Run a parameterized SQL statement and return its rows.
 *
 * `pg` returns timestamps/dates as JS `Date` objects — coerce them to strings
 * before returning them to the client (React will refuse to render a `Date`).
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await getPool().query(text, params as never[] | undefined);
  return result.rows as T[];
}

/**
 * Run `fn` inside a single transaction on one pooled connection.
 *
 * The dispatch engine needs row locks (`SELECT ... FOR UPDATE`) and multi-step
 * atomic updates (accept an offer *and* flip the job to `assigned`), which a
 * bare `query()` cannot guarantee because each call may use a different
 * connection from the pool. Rolls back and rethrows on any error.
 */
export async function withTx<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* connection already broken — nothing to roll back */
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Apply the schema idempotently. Safe to call on every cold start. */
export async function migrate(): Promise<void> {
  // Strip full-line `--` comments BEFORE splitting on ";" — otherwise a
  // semicolon inside a comment would split a statement in half and the tail
  // would be sent to Postgres as SQL.
  const statements = schemaSql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    await getPool().query(statement);
  }
}

let migrated = false;

/** Apply the schema once per process/cold-start, then no-op. */
export async function ensureDb(): Promise<void> {
  if (!migrated) {
    await migrate();
    migrated = true;
  }
}
