-- Migration 0045: Relationship Manager Workflow & Role Model Correction
-- Client-approved replacement of Team Lead (TL) with Relationship Manager (REL).
-- New hierarchy: Sales Caller (SC) -> Relationship Manager (REL) -> Manager (MG) -> Regional Manager (RM) -> National Manager (NM).
-- Preserves historical TL records and audit trails; safely migrates active TL accounts/assignments to REL.

CREATE TABLE IF NOT EXISTS lead_handoffs (
  id text PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id),
  vertical text NOT NULL,
  caller_employee_id text NOT NULL REFERENCES employees(id),
  rel_employee_id text NOT NULL REFERENCES employees(id),
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'returned')),
  loan_requirement jsonb NOT NULL DEFAULT '{}'::jsonb,
  required_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  qualification_evidence text NOT NULL,
  handoff_time timestamptz NOT NULL DEFAULT now(),
  decision_time timestamptz,
  decision_reason text,
  institution_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_step text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_handoffs_lead ON lead_handoffs (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_handoffs_rel ON lead_handoffs (rel_employee_id, status);
CREATE INDEX IF NOT EXISTS idx_lead_handoffs_caller ON lead_handoffs (caller_employee_id, status);
CREATE INDEX IF NOT EXISTS idx_lead_handoffs_vertical ON lead_handoffs (vertical, status);

-- Add loan requirement and handoff status columns to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS requested_amount numeric;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rel_owner_id text REFERENCES employees(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS handoff_status text CHECK (handoff_status IN ('pending', 'accepted', 'returned', 'none')) DEFAULT 'none';

-- Safely migrate active assignments from TL to REL, preserving historical records
UPDATE assignments
SET role = 'REL'
WHERE role = 'TL' AND (effective_to IS NULL OR effective_to > CURRENT_DATE);

-- Update any active approver configurations
UPDATE approver_configurations
SET role = 'REL'
WHERE role = 'TL';

UPDATE approver_configurations
SET approver_title = 'Relationship Manager'
WHERE approver_title = 'Team Lead';
