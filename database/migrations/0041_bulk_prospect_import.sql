-- ====================================================================
-- Migration: 0041_bulk_prospect_import.sql
-- Project Owner Revised Bulk Prospect Import & Automated Lead Assignment
-- Invariants:
--   - Valid rows become canonical CRM prospects (leads table) in selected vertical
--   - Automatic, fair, deterministic routing to active eligible Sales Caller (SC)
--   - If all callers at capacity / on leave, rows enter UNASSIGNED exception queue for authorized TL
--   - Duplicate phone / email in file or existing in CRM detected and not overwritten
--   - Bounded background chunks for 10,000+ rows; idempotent and retry-safe
--   - Reconciliation: total = assigned + duplicate + invalid + unassigned_exception
-- ====================================================================

CREATE TABLE IF NOT EXISTS prospect_import_jobs (
  id TEXT PRIMARY KEY,
  operator_employee_id TEXT NOT NULL REFERENCES employees(id),
  vertical TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('csv', 'xlsx', 'paste')),
  total_rows INT NOT NULL DEFAULT 0,
  processed_rows INT NOT NULL DEFAULT 0,
  assigned_count INT NOT NULL DEFAULT 0,
  duplicate_count INT NOT NULL DEFAULT 0,
  invalid_count INT NOT NULL DEFAULT 0,
  unassigned_exception_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'staged' CHECK (status IN ('staged', 'processing', 'completed', 'failed')),
  reconciliation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prospect_import_rows (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES prospect_import_jobs(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  raw_data JSONB NOT NULL,
  parsed_name TEXT,
  parsed_phone TEXT,
  parsed_email TEXT,
  parsed_whatsapp TEXT,
  parsed_location TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'duplicate', 'invalid', 'unassigned_exception')),
  canonical_lead_id TEXT REFERENCES leads(id),
  assigned_employee_id TEXT REFERENCES employees(id),
  assigned_team_id TEXT REFERENCES teams(id),
  rejection_reason TEXT,
  error_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_prospect_import_row UNIQUE (job_id, row_index)
);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS import_id TEXT REFERENCES prospect_import_jobs(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS location TEXT;

CREATE INDEX IF NOT EXISTS idx_prospect_import_jobs_op ON prospect_import_jobs(operator_employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospect_import_jobs_hash ON prospect_import_jobs(file_hash);
CREATE INDEX IF NOT EXISTS idx_prospect_import_rows_job_status ON prospect_import_rows(job_id, status);
CREATE INDEX IF NOT EXISTS idx_prospect_import_rows_lead ON prospect_import_rows(canonical_lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_import_id ON leads(import_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
