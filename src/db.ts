// C Breeze Notary and Signing — database entry point.
//
// The real database layer lives in src/db/index.ts (standard Postgres over TCP
// via `pg`, schema in src/db/schema.sql). This file just re-exports it so the
// conventional `~/db` import path keeps working. Import only from server
// functions or API routes — never from client code.
export { ensureDb, isDbConfigured, migrate, query } from "./db/index";
