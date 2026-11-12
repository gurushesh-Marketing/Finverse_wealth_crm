-- Migration 0009 — Wealth Manager (MG-01..MG-13) workflows and persistence
-- Enforces scope: assigned teams only; atomic updates; audit tracking.

-- MG-06: TL forecast reviews
ALTER TABLE team_forecasts
  ADD COLUMN IF NOT EXISTS manager_decision text CHECK (manager_decision IN ('accepted', 'returned')),
  ADD COLUMN IF NOT EXISTS manager_feedback text,
  ADD COLUMN IF NOT EXISTS manager_decided_at timestamptz;

-- MG-07: Manager forecast submission to RM
CREATE TABLE IF NOT EXISTS manager_forecasts (
  id text PRIMARY KEY,
  manager_employee_id text NOT NULL REFERENCES employees(id),
  period_label text NOT NULL,
  bottom_up_revenue numeric NOT NULL,
  management_adjustment numeric NOT NULL DEFAULT 0,
  adjusted_revenue numeric NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  accepted_forecast_ids jsonb NOT NULL DEFAULT '[]',
  override_reason text,
  risk_notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted_to_rm')),
  submitted_at timestamptz,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_manager_forecasts_period ON manager_forecasts (manager_employee_id, period_label);

-- MG-05: Manager targets allocated to TLs
CREATE TABLE IF NOT EXISTS manager_targets (
  id text PRIMARY KEY,
  manager_employee_id text NOT NULL REFERENCES employees(id),
  period_label text NOT NULL,
  metric text NOT NULL DEFAULT 'approved-wins',
  approved_parent_target numeric NOT NULL,
  unallocated_remainder numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manager_employee_id, period_label, metric, version)
);

-- MG-04: Capacity recovery plans
CREATE TABLE IF NOT EXISTS capacity_plans (
  id text PRIMARY KEY,
  manager_employee_id text NOT NULL REFERENCES employees(id),
  name text NOT NULL,
  period_label text NOT NULL,
  team_ids jsonb NOT NULL DEFAULT '[]',
  current_backlog int NOT NULL DEFAULT 0,
  available_callers int NOT NULL DEFAULT 0,
  planned_reallocations jsonb NOT NULL DEFAULT '[]',
  required_additional_staff int NOT NULL DEFAULT 0,
  operational_deadline timestamptz,
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- MG-03: Cross-team lead transfer requests
CREATE TABLE IF NOT EXISTS lead_transfer_requests (
  id text PRIMARY KEY,
  manager_employee_id text NOT NULL REFERENCES employees(id),
  source_team_id text NOT NULL REFERENCES teams(id),
  destination_team_id text NOT NULL REFERENCES teams(id),
  lead_ids jsonb NOT NULL DEFAULT '[]',
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'returned')),
  resolution_notes text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- MG-10: Source quality remediation requests
CREATE TABLE IF NOT EXISTS source_remediations (
  id text PRIMARY KEY,
  manager_employee_id text NOT NULL REFERENCES employees(id),
  source_name text NOT NULL,
  cohort_period text NOT NULL,
  sample_size int NOT NULL DEFAULT 0,
  invalid_intake_count int NOT NULL DEFAULT 0,
  contact_failed_count int NOT NULL DEFAULT 0,
  commercial_loss_count int NOT NULL DEFAULT 0,
  remediation_type text NOT NULL CHECK (remediation_type IN ('routing-change', 'intake-correction', 'quality-warning', 'pause-source')),
  justification text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'in-review', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- MG-12: Employee lifecycle requests (transfers / promotions)
CREATE TABLE IF NOT EXISTS employee_lifecycle_requests (
  id text PRIMARY KEY,
  manager_employee_id text NOT NULL REFERENCES employees(id),
  employee_id text NOT NULL REFERENCES employees(id),
  proposed_role text NOT NULL CHECK (proposed_role IN ('SC', 'TL', 'MG')),
  proposed_team_id text REFERENCES teams(id),
  effective_date date NOT NULL,
  business_justification text NOT NULL,
  handoff_plan text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved_by_rm', 'activated_by_admin', 'rejected')),
  hr_notified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- MG-09: Commercial exceptions (delegated authority limit)
CREATE TABLE IF NOT EXISTS commercial_exceptions (
  id text PRIMARY KEY,
  proposal_id text,
  lead_id text REFERENCES leads(id),
  requested_by_employee_id text NOT NULL REFERENCES employees(id),
  decided_by_manager_employee_id text REFERENCES employees(id),
  exception_type text NOT NULL CHECK (exception_type IN ('fee-waiver', 'rate-discount', 'custom-terms', 'turnaround-sla')),
  requested_terms text NOT NULL,
  standard_terms text NOT NULL,
  business_justification text NOT NULL,
  delegated_limit_met boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'escalated_to_rm')),
  decision_notes text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_exceptions_status ON commercial_exceptions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON lead_transfer_requests (status, created_at DESC);
