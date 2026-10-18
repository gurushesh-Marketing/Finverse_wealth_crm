-- ====================================================================
-- Migration: 0021_lifecycle_approval_verification.sql
-- Close HR -> Superadmin Approval Gap
-- Enforce Genuine Lifecycle Approvals, Auditable Verification,
-- Request Versioning and Approval Invalidation on Parameter Mutation
-- ====================================================================

-- 1. Add request_version tracking to lifecycle tables
ALTER TABLE hr_lifecycle_requests
  ADD COLUMN IF NOT EXISTS request_version INT NOT NULL DEFAULT 1;

ALTER TABLE employee_lifecycle_requests
  ADD COLUMN IF NOT EXISTS request_version INT NOT NULL DEFAULT 1;

-- 2. Create lifecycle_request_approvals table
CREATE TABLE IF NOT EXISTS lifecycle_request_approvals (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  request_version INT NOT NULL DEFAULT 1,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  target_role TEXT NOT NULL,
  target_team_id TEXT REFERENCES teams(id),
  effective_date DATE NOT NULL,
  approval_type TEXT NOT NULL CHECK (approval_type IN ('authorized_leader', 'verified_external_document')),
  approver_employee_id TEXT REFERENCES employees(id),
  external_reference TEXT,
  verification_notes TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'invalidated', 'superseded')),
  created_by_employee_id TEXT NOT NULL REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invalidated_at TIMESTAMPTZ,
  invalidation_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_request_approvals_lookup
  ON lifecycle_request_approvals(request_id, request_version, status);

CREATE INDEX IF NOT EXISTS idx_lifecycle_request_approvals_emp
  ON lifecycle_request_approvals(employee_id, status);

-- 3. Seed verified approval records for existing baseline fixture requests
-- MOVE-081: Regional Manager approved transfer
INSERT INTO lifecycle_request_approvals (
  id, request_id, request_version, employee_id, target_role, target_team_id, effective_date,
  approval_type, approver_employee_id, external_reference, verification_notes, status, created_by_employee_id
)
VALUES (
  'APPR-MOVE-081',
  'MOVE-081',
  1,
  'EMP-001',
  'SC',
  'TEAM-WEALTH-BETA',
  '2026-10-01',
  'authorized_leader',
  'EMP-008',
  'RM-APPROVAL-2026-09-28',
  'Formally approved by Regional Manager Kavita Rao for regional capacity rebalancing.',
  'valid',
  'EMP-008'
)
ON CONFLICT (id) DO NOTHING;

-- REQ-HR-002: HR-submitted team transfer with RM Kavita Rao signoff
INSERT INTO lifecycle_request_approvals (
  id, request_id, request_version, employee_id, target_role, target_team_id, effective_date,
  approval_type, approver_employee_id, external_reference, verification_notes, status, created_by_employee_id
)
VALUES (
  'APPR-REQ-HR-002',
  'REQ-HR-002',
  1,
  'EMP-001',
  'SC',
  'TEAM-WEALTH-BETA',
  '2026-10-15',
  'authorized_leader',
  'EMP-008',
  'RM-SIGNOFF-KAVITA-RAO',
  'Verified Regional Manager sign-off held by Human Resources operations.',
  'valid',
  'EMP-014'
)
ON CONFLICT (id) DO NOTHING;
