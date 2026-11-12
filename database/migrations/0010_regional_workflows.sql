-- Migration 0010 — Wealth Regional Manager (RM-01..RM-10) workflows and persistence
-- Enforces regional scope: assigned region & teams only; atomic updates; audit tracking.

-- 1. Regions table & team region linkage
CREATE TABLE IF NOT EXISTS regions (
  id text PRIMARY KEY,
  name text NOT NULL,
  vertical text NOT NULL
);

ALTER TABLE teams ADD COLUMN IF NOT EXISTS region_id text REFERENCES regions(id);

INSERT INTO regions (id, name, vertical)
VALUES ('REGION-SOUTH', 'South Region', 'wealth')
ON CONFLICT (id) DO NOTHING;

INSERT INTO teams (id, name, vertical)
VALUES
  ('TEAM-WEALTH-ALPHA', 'Wealth Alpha', 'wealth'),
  ('TEAM-WEALTH-BETA', 'Wealth Beta', 'wealth'),
  ('TEAM-WEALTH-GAMMA', 'Wealth Gamma', 'wealth'),
  ('TEAM-BANKING-ALPHA', 'Banking Alpha', 'banking')
ON CONFLICT (id) DO NOTHING;

UPDATE teams SET region_id = 'REGION-SOUTH'
WHERE id IN ('TEAM-WEALTH-ALPHA', 'TEAM-WEALTH-BETA', 'TEAM-WEALTH-GAMMA');

-- Add TL/SC/MG employees & assignments for synthetic demo access
INSERT INTO employees (id, email, password_hash, display_name, status)
VALUES
  ('EMP-005', 'meera@finverse.demo', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 'Meera Nair', 'active'),
  ('EMP-006', 'karan@finverse.demo', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 'Karan Shah', 'active'),
  ('EMP-007', 'neel@finverse.demo', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 'Neel Verma', 'active'),
  ('EMP-008', 'kavita@finverse.demo', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 'Kavita Rao', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-WEALTH-005', 'EMP-005', 'TL', 'wealth', 'TEAM-WEALTH-GAMMA', CURRENT_DATE, NULL),
  ('ASG-WEALTH-006', 'EMP-006', 'SC', 'wealth', 'TEAM-WEALTH-GAMMA', CURRENT_DATE, NULL),
  ('ASG-WEALTH-MG-A', 'EMP-007', 'MG', 'wealth', 'TEAM-WEALTH-ALPHA', CURRENT_DATE, NULL),
  ('ASG-WEALTH-MG-B', 'EMP-007', 'MG', 'wealth', 'TEAM-WEALTH-BETA', CURRENT_DATE, NULL),
  ('ASG-WEALTH-MG-C', 'EMP-007', 'MG', 'wealth', 'TEAM-WEALTH-GAMMA', CURRENT_DATE, NULL),
  ('ASG-WEALTH-RM-A', 'EMP-008', 'RM', 'wealth', 'TEAM-WEALTH-ALPHA', CURRENT_DATE, NULL),
  ('ASG-WEALTH-RM-B', 'EMP-008', 'RM', 'wealth', 'TEAM-WEALTH-BETA', CURRENT_DATE, NULL),
  ('ASG-WEALTH-RM-C', 'EMP-008', 'RM', 'wealth', 'TEAM-WEALTH-GAMMA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. RM-01, RM-02, RM-08, RM-09: Regional management actions / interventions
CREATE TABLE IF NOT EXISTS regional_management_actions (
  id text PRIMARY KEY,
  rm_employee_id text NOT NULL REFERENCES employees(id),
  source_action text NOT NULL CHECK (source_action IN ('RM-01', 'RM-02', 'RM-08', 'RM-09')),
  kind text NOT NULL CHECK (kind IN ('regional-intervention', 'manager-coaching', 'capacity-reallocation', 'sla-recovery')),
  subject_manager_employee_id text NOT NULL REFERENCES employees(id),
  owner_employee_id text NOT NULL REFERENCES employees(id),
  region_id text REFERENCES regions(id),
  metric_key text,
  period_label text,
  title text NOT NULL,
  detail text,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reg_actions_rm ON regional_management_actions (rm_employee_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_reg_actions_mgr ON regional_management_actions (subject_manager_employee_id, status);

-- 3. RM-03: Territory Coverage Plans
CREATE TABLE IF NOT EXISTS territory_coverage_plans (
  id text PRIMARY KEY,
  rm_employee_id text NOT NULL REFERENCES employees(id),
  region_id text NOT NULL REFERENCES regions(id),
  territory_name text NOT NULL,
  sub_region text NOT NULL,
  product_scope text NOT NULL,
  language_queues jsonb NOT NULL DEFAULT '[]',
  target_team_ids jsonb NOT NULL DEFAULT '[]',
  capacity_gap int NOT NULL DEFAULT 0,
  routing_proposal text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted_for_activation', 'activated')),
  activation_date date NOT NULL,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. RM-04: Regional Targets
CREATE TABLE IF NOT EXISTS regional_targets (
  id text PRIMARY KEY,
  rm_employee_id text NOT NULL REFERENCES employees(id),
  region_id text NOT NULL REFERENCES regions(id),
  period_label text NOT NULL,
  metric text NOT NULL DEFAULT 'approved-wins',
  approved_nm_target numeric NOT NULL,
  unallocated_remainder numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (region_id, period_label, metric, version)
);

-- Seed initial regional target from National Manager
INSERT INTO regional_targets (id, rm_employee_id, region_id, period_label, metric, approved_nm_target, unallocated_remainder, status, version)
VALUES ('RT-OCT-2026', 'EMP-008', 'REGION-SOUTH', 'October', 'approved-wins', 250, 0, 'published', 1)
ON CONFLICT (region_id, period_label, metric, version) DO NOTHING;

-- 5. RM-05: Cross-Manager Transfers
CREATE TABLE IF NOT EXISTS cross_manager_transfers (
  id text PRIMARY KEY,
  rm_employee_id text NOT NULL REFERENCES employees(id),
  source_manager_employee_id text NOT NULL REFERENCES employees(id),
  destination_manager_employee_id text NOT NULL REFERENCES employees(id),
  source_team_id text NOT NULL REFERENCES teams(id),
  destination_team_id text NOT NULL REFERENCES teams(id),
  lead_ids jsonb NOT NULL DEFAULT '[]',
  reason text NOT NULL,
  forecast_impact_notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. RM-06: Regional Staffing Plans
CREATE TABLE IF NOT EXISTS regional_staffing_plans (
  id text PRIMARY KEY,
  rm_employee_id text NOT NULL REFERENCES employees(id),
  region_id text NOT NULL REFERENCES regions(id),
  period_label text NOT NULL,
  planned_headcount int NOT NULL DEFAULT 0,
  approved_headcount int NOT NULL DEFAULT 0,
  active_headcount int NOT NULL DEFAULT 0,
  requisitions jsonb NOT NULL DEFAULT '[]',
  business_justification text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved_by_rm', 'submitted_to_hr', 'active')),
  decided_at timestamptz,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. RM-07: Regional Forecasts
CREATE TABLE IF NOT EXISTS regional_forecasts (
  id text PRIMARY KEY,
  rm_employee_id text NOT NULL REFERENCES employees(id),
  region_id text NOT NULL REFERENCES regions(id),
  period_label text NOT NULL,
  bottom_up_revenue numeric NOT NULL,
  regional_adjustment numeric NOT NULL DEFAULT 0,
  adjusted_revenue numeric NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  accepted_manager_forecast_ids jsonb NOT NULL DEFAULT '[]',
  top_regional_risks jsonb NOT NULL DEFAULT '[]',
  regional_assumptions text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted_to_nm')),
  submitted_at timestamptz,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. RM-08: Regional Escalations & Exceptions
CREATE TABLE IF NOT EXISTS regional_escalations (
  id text PRIMARY KEY,
  rm_employee_id text NOT NULL REFERENCES employees(id),
  region_id text REFERENCES regions(id),
  source_type text NOT NULL CHECK (source_type IN ('commercial_exception', 'source_quality', 'sla_breach', 'operational_risk')),
  source_id text,
  title text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  accountable_manager_employee_id text REFERENCES employees(id),
  detail text NOT NULL,
  recovery_decision text,
  deadline timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'recovery_plan_assigned', 'resolved', 'escalated_to_nm')),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. RM-09: Manager Reviews
CREATE TABLE IF NOT EXISTS manager_reviews (
  id text PRIMARY KEY,
  rm_employee_id text NOT NULL REFERENCES employees(id),
  manager_employee_id text NOT NULL REFERENCES employees(id),
  period_label text NOT NULL,
  performance_rating text NOT NULL CHECK (performance_rating IN ('exceeding', 'achieving', 'needs_improvement', 'critical')),
  strengths text NOT NULL,
  blockers text NOT NULL,
  improvement_commitments jsonb NOT NULL DEFAULT '[]',
  support_actions text,
  private_rm_notes text,
  next_review_date date NOT NULL,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. RM-10: Regional Report Schedules
CREATE TABLE IF NOT EXISTS regional_report_schedules (
  id text PRIMARY KEY,
  rm_employee_id text NOT NULL REFERENCES employees(id),
  region_id text NOT NULL REFERENCES regions(id),
  name text NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'quarterly')),
  cadence text NOT NULL,
  recipients jsonb NOT NULL DEFAULT '[]',
  sections jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed some realistic baseline records for RM so views are rich immediately
INSERT INTO territory_coverage_plans (
  id, rm_employee_id, region_id, territory_name, sub_region, product_scope, language_queues, target_team_ids, capacity_gap, routing_proposal, status, activation_date, version
) VALUES (
  'TCP-001', 'EMP-008', 'REGION-SOUTH', 'South Metro Hub', 'Karnataka & Tamil Nadu', 'V1 Wealth Portfolio',
  '["English", "Kannada", "Tamil"]'::jsonb, '["TEAM-WEALTH-ALPHA", "TEAM-WEALTH-BETA"]'::jsonb,
  4, 'Reallocate 4 senior associates from general intake to HNI wealth portfolio queue.', 'activated', CURRENT_DATE, 1
) ON CONFLICT (id) DO NOTHING;

INSERT INTO regional_escalations (
  id, rm_employee_id, region_id, source_type, source_id, title, severity, accountable_manager_employee_id, detail, deadline, status
) VALUES (
  'ESC-001', 'EMP-008', 'REGION-SOUTH', 'commercial_exception', 'CE-001',
  'Advisory fee waiver 35 bps exceeding Manager limit', 'high', 'EMP-007',
  'Prospect A request for 35 bps fee reduction on 10 Cr AUM exceeds Neel Verma delegated limit of 20 bps.',
  now() + interval '2 days', 'open'
),
(
  'ESC-002', 'EMP-008', 'REGION-SOUTH', 'source_quality', 'SR-001',
  'Paid Search intake invalid number rate 38%', 'critical', 'EMP-007',
  'Bangalore HNI campaign showing 38% invalid contact numbers over past 7 days.',
  now() + interval '1 day', 'open'
) ON CONFLICT (id) DO NOTHING;
