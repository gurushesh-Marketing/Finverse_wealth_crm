-- Migration 0012 — CEO (CEO-01..CEO-11) Workflows & Persistence
-- Enforces executive multi-vertical visibility: cross-vertical scope with Wealth deep dive;
-- atomic targets cascade to National Managers; board packs and executive commitments.

-- 1. Demo Executive: Rajiv Mehta (CEO)
INSERT INTO employees (id, email, password_hash, display_name, status)
VALUES (
  'EMP-010',
  'rajiv@finverse.demo',
  -- SHA-256 of 'demo1234'
  '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
  'Rajiv Mehta',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- CEO assignment across all verticals
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-EXEC-CEO-W', 'EMP-010', 'CEO', 'wealth', 'TEAM-WEALTH-ALPHA', CURRENT_DATE, NULL),
  ('ASG-EXEC-CEO-B', 'EMP-010', 'CEO', 'banking', 'TEAM-BANKING-ALPHA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. CEO-04: Company & Vertical Targets (Cascade to NM)
CREATE TABLE IF NOT EXISTS company_targets (
  id text PRIMARY KEY,
  ceo_employee_id text NOT NULL REFERENCES employees(id),
  period_label text NOT NULL,
  fiscal_year text NOT NULL DEFAULT 'FY2026-27',
  total_revenue_target numeric NOT NULL,
  total_wins_target numeric NOT NULL,
  vertical_allocations jsonb NOT NULL DEFAULT '[]',
  unallocated_revenue_buffer numeric NOT NULL DEFAULT 0,
  unallocated_wins_buffer numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved_by_ceo', 'board_ratified')),
  approved_at timestamptz,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fiscal_year, period_label, version)
);

-- Seed baseline company target
INSERT INTO company_targets (
  id, ceo_employee_id, period_label, fiscal_year, total_revenue_target, total_wins_target,
  vertical_allocations, unallocated_revenue_buffer, unallocated_wins_buffer, status, version
) VALUES (
  'CT-FY27-OCT', 'EMP-010', 'October', 'FY2026-27', 150000000, 1000,
  '[
    {"vertical": "wealth", "revenueTarget": 75000000, "winsTarget": 500, "nmEmployeeId": "EMP-009", "nmName": "Vikram Malhotra"},
    {"vertical": "banking", "revenueTarget": 45000000, "winsTarget": 350, "nmEmployeeId": "EMP-004", "nmName": "Dev Kapoor"},
    {"vertical": "real-estate", "revenueTarget": 20000000, "winsTarget": 100, "nmEmployeeId": null, "nmName": "TBD"}
  ]'::jsonb,
  10000000, 50, 'approved_by_ceo', 1
) ON CONFLICT (fiscal_year, period_label, version) DO NOTHING;

-- 3. CEO-05: Consolidated Company Revenue Forecast
CREATE TABLE IF NOT EXISTS company_forecasts (
  id text PRIMARY KEY,
  ceo_employee_id text NOT NULL REFERENCES employees(id),
  period_label text NOT NULL,
  bottom_up_sum numeric NOT NULL,
  executive_macro_adjustment numeric NOT NULL DEFAULT 0,
  signed_off_revenue numeric NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  vertical_submissions jsonb NOT NULL DEFAULT '[]',
  macro_assumptions text NOT NULL,
  board_risk_notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed_off_by_ceo', 'presented_to_board')),
  signed_off_at timestamptz,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. CEO-06: Growth & Capacity Initiatives
CREATE TABLE IF NOT EXISTS growth_initiatives (
  id text PRIMARY KEY,
  ceo_employee_id text NOT NULL REFERENCES employees(id),
  title text NOT NULL,
  vertical text NOT NULL,
  initiative_type text NOT NULL CHECK (initiative_type IN ('geographic_expansion', 'digital_channel', 'talent_surge', 'product_launch')),
  capital_required numeric NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  projected_roi_percent numeric NOT NULL,
  timeline_months int NOT NULL,
  sponsor_executive text NOT NULL,
  justification text NOT NULL,
  implementation_tasks jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved_by_ceo', 'funded', 'rejected')),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. CEO-07: Cross-Vertical Priority Conflicts
CREATE TABLE IF NOT EXISTS cross_vertical_conflicts (
  id text PRIMARY KEY,
  ceo_employee_id text NOT NULL REFERENCES employees(id),
  source_vertical text NOT NULL,
  conflicting_vertical text NOT NULL,
  prospect_or_client_name text NOT NULL,
  conflict_nature text NOT NULL CHECK (conflict_nature IN ('client_ownership', 'revenue_attribution', 'fee_splitting', 'channel_cannibalization')),
  summary text NOT NULL,
  source_argument text NOT NULL,
  counter_argument text NOT NULL,
  ceo_determination text,
  awarded_lead_id text REFERENCES leads(id),
  resolved_attribution text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_ceo_arbitration', 'resolved')),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. CEO-08: Critical Complaints & Operating Risks
CREATE TABLE IF NOT EXISTS critical_operating_risks (
  id text PRIMARY KEY,
  ceo_employee_id text NOT NULL REFERENCES employees(id),
  vertical text NOT NULL,
  source_action text NOT NULL DEFAULT 'CEO-08',
  risk_category text NOT NULL CHECK (risk_category IN ('regulatory_breach', 'client_litigation', 'reputational_loss', 'operational_failure')),
  severity text NOT NULL CHECK (severity IN ('high', 'critical', 'existential')),
  title text NOT NULL,
  details text NOT NULL,
  exposure_amount numeric,
  mitigation_mandate text,
  accountable_executive text NOT NULL,
  decision_deadline timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mitigation_in_progress', 'resolved')),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. CEO-09: National Manager Leadership Reviews
CREATE TABLE IF NOT EXISTS nm_leadership_reviews (
  id text PRIMARY KEY,
  ceo_employee_id text NOT NULL REFERENCES employees(id),
  nm_employee_id text NOT NULL REFERENCES employees(id),
  vertical text NOT NULL,
  period_label text NOT NULL,
  overall_leadership_rating text NOT NULL CHECK (overall_leadership_rating IN ('role_model', 'strong_performer', 'developing', 'off_track')),
  strategic_alignment text NOT NULL,
  operational_execution text NOT NULL,
  team_health_and_retention text NOT NULL,
  board_visibility_readiness text NOT NULL,
  strategic_commitments jsonb NOT NULL DEFAULT '[]',
  support_from_ceo text,
  next_review_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. CEO-10: Board & Executive Meeting Packs
CREATE TABLE IF NOT EXISTS board_report_schedules (
  id text PRIMARY KEY,
  ceo_employee_id text NOT NULL REFERENCES employees(id),
  title text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'annual')),
  delivery_cadence text NOT NULL,
  stakeholders jsonb NOT NULL DEFAULT '[]',
  sections jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. CEO-11: Executive Commitments & Actions Tracker
CREATE TABLE IF NOT EXISTS executive_commitments (
  id text PRIMARY KEY,
  ceo_employee_id text NOT NULL REFERENCES employees(id),
  source_action text NOT NULL CHECK (source_action IN ('CEO-01', 'CEO-02', 'CEO-06', 'CEO-07', 'CEO-08', 'CEO-11')),
  title text NOT NULL,
  accountable_leader text NOT NULL,
  vertical text,
  actionable_mandate text NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'fulfilled', 'escalated_to_board')),
  evidence_url text,
  fulfilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed realistic baseline records for CEO workspace
INSERT INTO growth_initiatives (
  id, ceo_employee_id, title, vertical, initiative_type, capital_required,
  projected_roi_percent, timeline_months, sponsor_executive, justification, status
) VALUES (
  'GI-001', 'EMP-010', 'West Region Wealth Advisory Hub Expansion', 'wealth', 'geographic_expansion',
  15000000, 32.5, 6, 'Vikram Malhotra (NM)',
  'Establish dedicated advisory office in Mumbai BKC to capture Tier-1 HNI market demand.', 'proposed'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO cross_vertical_conflicts (
  id, ceo_employee_id, source_vertical, conflicting_vertical, prospect_or_client_name,
  conflict_nature, summary, source_argument, counter_argument, status
) VALUES (
  'CVC-001', 'EMP-010', 'banking', 'wealth', 'Mehta Conglomerate Treasury',
  'revenue_attribution', 'Dual coverage claim between Corporate Banking and Wealth Management for 50 Cr corporate liquidity.',
  'Banking originated the treasury current account and debt syndication.',
  'Wealth structured the custom mutual fund and PMS yield strategy yielding higher gross margins.',
  'open'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO critical_operating_risks (
  id, ceo_employee_id, vertical, risk_category, severity, title, details,
  exposure_amount, accountable_executive, decision_deadline, status
) VALUES (
  'COR-001', 'EMP-010', 'wealth', 'regulatory_breach', 'high',
  'SEBI Advisory Fee Schedule Disclosure Compliance',
  'Tier-1 advisory clients requesting fee tier adjustments require formal audit committee disclosure to prevent regulatory inquiry.',
  2500000, 'Kavita Rao / Vikram Malhotra', now() + interval '7 days', 'open'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO executive_commitments (
  id, ceo_employee_id, source_action, title, accountable_leader, vertical,
  actionable_mandate, due_date, status
) VALUES (
  'EXC-001', 'EMP-010', 'CEO-01', 'FY27 Wealth Capacity Surge Alignment', 'Vikram Malhotra', 'wealth',
  'Finalize regional staffing requisition approvals with HR by mid-month to prevent target slippage.',
  CURRENT_DATE + interval '14 days', 'in_progress'
) ON CONFLICT (id) DO NOTHING;
