-- ====================================================================
-- Migration: 0022_data_entry_workflows.sql
-- Data Entry Workspace Implementation (DE-01 through DE-07)
-- Action Deck Reference: P263–P276
-- Invariants:
--  - Zero arbitrary lead ownership for Data Entry (owner_employee_id remains NULL)
--  - Idempotent repeated batch publication (duplicate-safe)
--  - Preserved original source provenance in raw_payload and correction history
--  - No cross-vertical record disclosure during duplicate review
--  - Source suspension holds dependent intake
-- ====================================================================

-- 1. Demo Data Entry Operator: Deepa Patel (DE)
INSERT INTO employees (id, email, password_hash, display_name, status)
VALUES (
  'EMP-015',
  'deepa@finverse.demo',
  -- scrypt hash of 'demo1234'
  'scrypt$m156EmNbQXHZCVT0RATogw==$CUqGh5bV/tFwF9jTpFCzTL6W4y9kkFPtCd04bhdYuet3OdmIx+9Hq8gcMS6babqkcczMBw6r6/fidfprnHImKA==',
  'Deepa Patel',
  'active'
)
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- Assignments across Wealth and Banking
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-DE-W', 'EMP-015', 'DE', 'wealth', 'TEAM-WEALTH-ALPHA', CURRENT_DATE, NULL),
  ('ASG-DE-B', 'EMP-015', 'DE', 'banking', 'TEAM-BANKING-ALPHA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO UPDATE SET employee_id = 'EMP-015';

-- 2. DE-06: Source Register & Consent Provenance (P273–P274)
CREATE TABLE IF NOT EXISTS intake_sources (
  id TEXT PRIMARY KEY,
  source_code TEXT NOT NULL UNIQUE,
  source_name TEXT NOT NULL,
  vendor_name TEXT,
  collection_basis TEXT NOT NULL,
  evidence_document_url TEXT,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  permitted_verticals TEXT[] NOT NULL DEFAULT ARRAY['wealth', 'banking', 'markets', 'real-estate'],
  permitted_products TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'under_review', 'suspended')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_sources_status ON intake_sources(status);
CREATE INDEX IF NOT EXISTS idx_intake_sources_code ON intake_sources(source_code);

-- 3. DE-02, DE-05, DE-07: Intake Batches (P265–P266, P271–P272, P275–P276)
CREATE TABLE IF NOT EXISTS intake_batches (
  id TEXT PRIMARY KEY,
  batch_name TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES intake_sources(id),
  vertical TEXT NOT NULL CHECK (vertical IN ('wealth', 'banking', 'markets', 'real-estate')),
  target_team_id TEXT NOT NULL REFERENCES teams(id),
  uploaded_by_employee_id TEXT NOT NULL REFERENCES employees(id),
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_rows INT NOT NULL DEFAULT 0,
  valid_rows INT NOT NULL DEFAULT 0,
  rejected_rows INT NOT NULL DEFAULT 0,
  duplicate_rows INT NOT NULL DEFAULT 0,
  published_rows INT NOT NULL DEFAULT 0,
  held_rows INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'staging' CHECK (status IN ('staging', 'validating', 'ready_for_publish', 'partially_published', 'published', 'archived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_batches_source ON intake_batches(source_id);
CREATE INDEX IF NOT EXISTS idx_intake_batches_vertical ON intake_batches(vertical);
CREATE INDEX IF NOT EXISTS idx_intake_batches_status ON intake_batches(status);
CREATE INDEX IF NOT EXISTS idx_intake_batches_hash ON intake_batches(file_hash);

-- 4. DE-01, DE-02, DE-03, DE-04, DE-05: Intake Rows (P263–P272)
CREATE TABLE IF NOT EXISTS intake_rows (
  id TEXT PRIMARY KEY,
  batch_id TEXT REFERENCES intake_batches(id) ON DELETE CASCADE,
  row_index INT NOT NULL DEFAULT 1,
  raw_payload JSONB NOT NULL,
  parsed_name TEXT NOT NULL,
  parsed_phone TEXT NOT NULL,
  parsed_email TEXT,
  parsed_product TEXT NOT NULL,
  parsed_source TEXT NOT NULL,
  permission_evidence TEXT NOT NULL,
  permission_date DATE DEFAULT CURRENT_DATE,
  need_summary TEXT,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_duplicate BOOLEAN NOT NULL DEFAULT false,
  duplicate_match_lead_id TEXT REFERENCES leads(id),
  duplicate_decision TEXT CHECK (duplicate_decision IN ('pending', 'linked', 'new_enquiry', 'escalated')),
  duplicate_decision_notes TEXT,
  duplicate_decided_by TEXT REFERENCES employees(id),
  duplicate_decided_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'staged' CHECK (status IN ('staged', 'valid', 'rejected', 'duplicate_hold', 'published', 'archived')),
  correction_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_lead_id TEXT REFERENCES leads(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_rows_batch ON intake_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_intake_rows_status ON intake_rows(status);
CREATE INDEX IF NOT EXISTS idx_intake_rows_phone ON intake_rows(parsed_phone);
CREATE INDEX IF NOT EXISTS idx_intake_rows_email ON intake_rows(parsed_email);

-- 5. DE-07: Intake Export Audits (P275–P276)
CREATE TABLE IF NOT EXISTS intake_export_audits (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  period_label TEXT NOT NULL,
  export_type TEXT NOT NULL CHECK (export_type IN ('quality_report_pdf', 'correction_worklist_csv', 'batch_reconciliation_json')),
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  record_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Link leads to intake provenance (FKs)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS intake_batch_id TEXT REFERENCES intake_batches(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS intake_row_id TEXT REFERENCES intake_rows(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS consent_reference TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS consent_date DATE;

-- 7. Seed Initial Baseline Sources (DE-06)
INSERT INTO intake_sources (
  id, source_code, source_name, vendor_name, collection_basis,
  evidence_document_url, effective_from, effective_to,
  permitted_verticals, permitted_products, status, notes
)
VALUES
  (
    'SRC-WEB-01',
    'WEB-DIRECT',
    'Website Direct Inbound',
    'Finverse Digital Inbound',
    'Explicit Web Form Opt-in with OTP Mobile Verification',
    '/evidence/sources/web-direct-consent-spec.pdf',
    '2026-01-01',
    NULL,
    ARRAY['wealth', 'banking', 'markets', 'real-estate'],
    ARRAY['V1 Wealth Portfolio', 'V1 Savings Plus', 'V1 Current Account', 'V1 Demat Account', 'V1 Commercial Property Fund'],
    'active',
    'Primary authorized direct organic website acquisition pipeline.'
  ),
  (
    'SRC-VEND-104',
    'VEND-APEX',
    'Apex Strategic Co-Marketing Batch',
    'Apex Marketing Solutions LLP',
    'Double Opt-In Co-Marketing Consent Card with Digital Timestamp',
    '/evidence/sources/apex-co-marketing-sla-2026.pdf',
    '2026-06-01',
    '2026-12-31',
    ARRAY['wealth', 'banking'],
    ARRAY['V1 Wealth Portfolio', 'V1 Savings Plus', 'V1 Current Account'],
    'active',
    'Authorized HNW vendor lead pipeline under mutual GDPR/DPDP-compliant data transfer agreement.'
  ),
  (
    'SRC-EVENT-BLR',
    'EVENT-BLR26',
    'Bengaluru HNWI Investment Summit 2026',
    'Finverse Corporate Events',
    'Signed Physical Registration Consent Slip and Business Card Exchange',
    '/evidence/sources/blr-summit-consent-forms.pdf',
    '2026-09-01',
    '2026-11-30',
    ARRAY['wealth', 'real-estate'],
    ARRAY['V1 Wealth Portfolio', 'V1 Commercial Property Fund'],
    'active',
    'Exclusive private summit delegate intake with physical signed consent provenance.'
  ),
  (
    'SRC-SUSP-LEGACY',
    'VEND-LEGACY-X',
    'Legacy Lead Aggregator X',
    'Broker Direct Data Ltd',
    'Third-Party Unverified List',
    NULL,
    '2025-01-01',
    '2026-03-31',
    ARRAY['wealth'],
    ARRAY['V1 Wealth Portfolio'],
    'suspended',
    'Suspended pending data privacy provenance audit [DE-06]. Intake quarantined.'
  )
ON CONFLICT (id) DO NOTHING;

-- 8. Seed Sample Baseline Batch: B-104 (Deck P266, P268, P270, P272)
INSERT INTO intake_batches (
  id, batch_name, source_id, vertical, target_team_id, uploaded_by_employee_id,
  file_name, file_hash, column_mapping, total_rows, valid_rows, rejected_rows,
  duplicate_rows, published_rows, held_rows, status, notes
)
VALUES (
  'B-104',
  'Apex HNW Batch Q3-B104',
  'SRC-VEND-104',
  'wealth',
  'TEAM-WEALTH-ALPHA',
  'EMP-015',
  'apex_hnw_leads_oct2026.csv',
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  '{"name": "Client Name", "phone": "Primary Mobile", "email": "Email Address", "product": "Target Product", "evidence": "Consent Reference"}'::jsonb,
  5,
  2,
  1,
  1,
  1,
  3,
  'ready_for_publish',
  'Staged vendor batch with validation errors and candidate duplicate for operator resolution.'
)
ON CONFLICT (id) DO NOTHING;

-- Seed rows for Batch B-104
-- Row 1: Valid clean row (ready to publish)
INSERT INTO intake_rows (
  id, batch_id, row_index, raw_payload, parsed_name, parsed_phone, parsed_email,
  parsed_product, parsed_source, permission_evidence, permission_date, need_summary,
  validation_errors, is_duplicate, status
)
VALUES (
  'ROW-B104-01',
  'B-104',
  1,
  '{"Client Name": "Anand Mahindra Rao", "Primary Mobile": "+91 98765 99001", "Email Address": "anand.rao@enterprise.test", "Target Product": "V1 Wealth Portfolio", "Consent Reference": "APEX-2026-09-12-881"}'::jsonb,
  'Anand Mahindra Rao',
  '+91 98765 99001',
  'anand.rao@enterprise.test',
  'V1 Wealth Portfolio',
  'Apex Strategic Co-Marketing Batch',
  'APEX-2026-09-12-881',
  '2026-09-12',
  'Seeking bespoke discretionary portfolio advisory for family estate.',
  '[]'::jsonb,
  false,
  'valid'
)
ON CONFLICT (id) DO NOTHING;

-- Row 2: Rejected row (Missing valid product / invalid phone, DE-03 target)
INSERT INTO intake_rows (
  id, batch_id, row_index, raw_payload, parsed_name, parsed_phone, parsed_email,
  parsed_product, parsed_source, permission_evidence, permission_date, need_summary,
  validation_errors, is_duplicate, status
)
VALUES (
  'ROW-B104-02',
  'B-104',
  2,
  '{"Client Name": "Sunita Kapoor", "Primary Mobile": "98765", "Email Address": "sunita.k@test.com", "Target Product": "Unknown Hedge Option", "Consent Reference": "APEX-2026-09-12-882"}'::jsonb,
  'Sunita Kapoor',
  '98765',
  'sunita.k@test.com',
  'Unknown Hedge Option',
  'Apex Strategic Co-Marketing Batch',
  'APEX-2026-09-12-882',
  '2026-09-12',
  'Aggressive capital growth allocation inquiry.',
  '[{"field": "phone", "code": "INVALID_PHONE", "message": "Phone must be a valid 10-digit mobile number."}, {"field": "product", "code": "UNAPPROVED_PRODUCT", "message": "Product is outside granted Wealth catalog."}]'::jsonb,
  false,
  'rejected'
)
ON CONFLICT (id) DO NOTHING;

-- Row 3: Duplicate candidate row (Phone matches existing lead FV-1001, DE-04 target)
INSERT INTO intake_rows (
  id, batch_id, row_index, raw_payload, parsed_name, parsed_phone, parsed_email,
  parsed_product, parsed_source, permission_evidence, permission_date, need_summary,
  validation_errors, is_duplicate, duplicate_match_lead_id, duplicate_decision, status
)
VALUES (
  'ROW-B104-03',
  'B-104',
  3,
  '{"Client Name": "Prospect A (Apex Repeat)", "Primary Mobile": "+91 98765 40001", "Email Address": "prospect.a@example.test", "Target Product": "V1 Wealth Portfolio", "Consent Reference": "APEX-2026-09-12-883"}'::jsonb,
  'Prospect A (Apex Repeat)',
  '+91 98765 40001',
  'prospect.a@example.test',
  'V1 Wealth Portfolio',
  'Apex Strategic Co-Marketing Batch',
  'APEX-2026-09-12-883',
  '2026-09-12',
  'Second inquiry from affiliate campaign.',
  '[]'::jsonb,
  true,
  'FV-1001',
  'pending',
  'duplicate_hold'
)
ON CONFLICT (id) DO NOTHING;

-- Row 4: Clean row (ready to publish)
INSERT INTO intake_rows (
  id, batch_id, row_index, raw_payload, parsed_name, parsed_phone, parsed_email,
  parsed_product, parsed_source, permission_evidence, permission_date, need_summary,
  validation_errors, is_duplicate, status
)
VALUES (
  'ROW-B104-04',
  'B-104',
  4,
  '{"Client Name": "Gautam Singhania", "Primary Mobile": "+91 98765 99004", "Email Address": "gautam.s@corp.test", "Target Product": "V1 Savings Plus", "Consent Reference": "APEX-2026-09-12-884"}'::jsonb,
  'Gautam Singhania',
  '+91 98765 99004',
  'gautam.s@corp.test',
  'V1 Savings Plus',
  'Apex Strategic Co-Marketing Batch',
  'APEX-2026-09-12-884',
  '2026-09-12',
  'Fixed-income yield parking query.',
  '[]'::jsonb,
  false,
  'valid'
)
ON CONFLICT (id) DO NOTHING;

-- Row 5: Already published row (demonstrating provenance linkage)
INSERT INTO intake_rows (
  id, batch_id, row_index, raw_payload, parsed_name, parsed_phone, parsed_email,
  parsed_product, parsed_source, permission_evidence, permission_date, need_summary,
  validation_errors, is_duplicate, status, published_lead_id, published_at
)
VALUES (
  'ROW-B104-05',
  'B-104',
  5,
  '{"Client Name": "Ramesh Damani", "Primary Mobile": "+91 98765 99005", "Email Address": "ramesh.d@invest.test", "Target Product": "V1 Wealth Portfolio", "Consent Reference": "APEX-2026-09-12-885"}'::jsonb,
  'Ramesh Damani',
  '+91 98765 99005',
  'ramesh.d@invest.test',
  'V1 Wealth Portfolio',
  'Apex Strategic Co-Marketing Batch',
  'APEX-2026-09-12-885',
  '2026-09-12',
  'Equity advisory onboarding.',
  '[]'::jsonb,
  false,
  'published',
  'FV-1002',
  now()
)
ON CONFLICT (id) DO NOTHING;
