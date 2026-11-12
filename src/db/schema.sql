-- C Breeze Notary and Signing — database schema.
-- Executed idempotently by src/db/index.ts (migrate()).

CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notaries are the supply side of the marketplace: independent, commissioned
-- signing agents who receive offers. `states_served` is a JSONB array of
-- two-letter state codes (e.g. ["TX","OK"]) — JSONB (not TEXT[]) so the
-- dispatch engine can match with `states_served @> '["TX"]'::jsonb` against the
-- existing GIN index. Verified against the live database (information_schema).
CREATE TABLE IF NOT EXISTS notaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT,
  commission_number TEXT,
  commission_expiry DATE,
  states_served JSONB NOT NULL DEFAULT '[]'::jsonb,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- `CREATE TABLE IF NOT EXISTS` never alters an existing table, so each notary
-- column is also added idempotently here. On the live database these are no-ops;
-- they keep a legacy/partial `notaries` table from drifting out of shape.
ALTER TABLE notaries ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE notaries ADD COLUMN IF NOT EXISTS commission_number TEXT;
ALTER TABLE notaries ADD COLUMN IF NOT EXISTS commission_expiry DATE;
ALTER TABLE notaries ADD COLUMN IF NOT EXISTS states_served JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE notaries ADD COLUMN IF NOT EXISTS bio TEXT;

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  borrower_name TEXT NOT NULL,
  borrower_email TEXT,
  loan_type TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  signing_date_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','assigned','completed','cancelled')),
  fee_amount NUMERIC(10,2),
  notary_pay_amount NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per (job, notary) offer/assignment. The automated dispatch engine walks
-- a job through candidate notaries sequentially: `offered` -> `declined`/`expired`
-- cascades to the next notary, while `offered` -> `accepted` stops the cascade.
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  notary_id UUID NOT NULL REFERENCES notaries(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('offered','accepted','declined','expired','assigned','completed','cancelled')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (job_id, notary_id)
);

-- Dispatch engine columns (idempotent — no-ops once applied). `offered_at` marks
-- when an offer went out, `expires_at` when it lapses, `responded_at` when the
-- notary accepted/declined (or when the sweep expired it), `note` is free text.
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS offered_at TIMESTAMPTZ;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS note TEXT;

-- Widen the legacy status CHECK (assigned/accepted/completed/cancelled) to the
-- full dispatch vocabulary. DROP + ADD keeps this idempotent on every cold start.
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_status_check;
ALTER TABLE assignments ADD CONSTRAINT assignments_status_check
  CHECK (status IN ('offered','accepted','declined','expired','assigned','completed','cancelled'));

-- jobs.assigned_at records when the cascade produced an accepted notary.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_business_id ON jobs(business_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state);
CREATE INDEX IF NOT EXISTS idx_assignments_job_id ON assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_assignments_notary_id ON assignments(notary_id);
-- Sweep lookups: open offers per job, and stale offers by expiry.
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_status_expires ON assignments(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_notaries_states_served ON notaries USING GIN (states_served);
