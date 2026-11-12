-- Migration 0011 — Wealth National Manager (NM-01..NM-11) workflows and persistence
-- Enforces national vertical scope: across all regions in vertical; atomic updates; audit tracking.

-- 1. Additional Region & National Manager seed
INSERT INTO regions (id, name, vertical)
VALUES ('REGION-WEST', 'West Region', 'wealth')
ON CONFLICT (id) DO NOTHING;

-- Demo user: Vikram Malhotra (National Manager)
INSERT INTO employees (id, email, password_hash, display_name, status)
VALUES (
  'EMP-009',
  'vikram@finverse.demo',
  -- SHA-256 of 'demo1234'
  '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
  'Vikram Malhotra',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- NM assignment across all wealth teams
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-WEALTH-NM-A', 'EMP-009', 'NM', 'wealth', 'TEAM-WEALTH-ALPHA', CURRENT_DATE, NULL),
  ('ASG-WEALTH-NM-B', 'EMP-009', 'NM', 'wealth', 'TEAM-WEALTH-BETA', CURRENT_DATE, NULL),
  ('ASG-WEALTH-NM-C', 'EMP-009', 'NM', 'wealth', 'TEAM-WEALTH-GAMMA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. NM-01 / NM-02: National Management Actions
CREATE TABLE IF NOT EXISTS national_management_actions (
  id text PRIMARY KEY,
  nm_employee_id text NOT NULL REFERENCES employees(id),
  source_action text NOT NULL CHECK (source_action IN ('NM-01', 'NM-02', 'NM-09', 'NM-10')),
  kind text NOT NULL CHECK (kind IN ('regional-directive', 'rm-coaching', 'resource-rebalancing', 'policy-compliance')),
  subject_rm_employee_id text NOT NULL REFERENCES employees(id),
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
CREATE INDEX IF NOT EXISTS idx_nat_actions_nm ON national_management_actions (nm_employee_id, status, due_at);

-- 3. NM-03: National Vertical Targets
CREATE TABLE IF NOT EXISTS national_targets (
  id text PRIMARY KEY,
  nm_employee_id text NOT NULL REFERENCES employees(id),
  vertical text NOT NULL,
  period_label text NOT NULL,
  metric text NOT NULL DEFAULT 'approved-wins',
  approved_ceo_target numeric NOT NULL,
  unallocated_remainder numeric NOT NULL DEFAULT 0,
  regional_allocations jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vertical, period_label, metric, version)
);

INSERT INTO national_targets (id, nm_employee_id, vertical, period_label, metric, approved_ceo_target, unallocated_remainder, status, version)
VALUES ('NT-OCT-2026', 'EMP-009', 'wealth', 'October', 'approved-wins', 500, 250, 'published', 1)
ON CONFLICT (vertical, period_label, metric, version) DO NOTHING;

-- 4. NM-05: Product & Pipeline Rule Proposals
CREATE TABLE IF NOT EXISTS product_rule_proposals (
  id text PRIMARY KEY,
  nm_employee_id text NOT NULL REFERENCES employees(id),
  vertical text NOT NULL,
  rule_name text NOT NULL,
  current_version text NOT NULL,
  proposed_version text NOT NULL,
  reason text NOT NULL,
  effective_date date NOT NULL,
  affected_products jsonb NOT NULL DEFAULT '[]',
  preview_impact text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved_by_product', 'activated', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. NM-06: National Forecasts (Rollup to CEO & CFO)
CREATE TABLE IF NOT EXISTS national_forecasts (
  id text PRIMARY KEY,
  nm_employee_id text NOT NULL REFERENCES employees(id),
  vertical text NOT NULL,
  period_label text NOT NULL,
  bottom_up_revenue numeric NOT NULL,
  national_adjustment numeric NOT NULL DEFAULT 0,
  adjusted_revenue numeric NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  accepted_regional_forecast_ids jsonb NOT NULL DEFAULT '[]',
  top_national_risks jsonb NOT NULL DEFAULT '[]',
  national_assumptions text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted_to_executives')),
  submitted_at timestamptz,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. NM-07: Cross-Region Work Transfers
CREATE TABLE IF NOT EXISTS cross_region_transfers (
  id text PRIMARY KEY,
  nm_employee_id text NOT NULL REFERENCES employees(id),
  source_region_id text NOT NULL REFERENCES regions(id),
  destination_region_id text NOT NULL REFERENCES regions(id),
  lead_ids jsonb NOT NULL DEFAULT '[]',
  reason text NOT NULL,
  handoff_plan text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. NM-08: Cross-Vertical Referrals
CREATE TABLE IF NOT EXISTS cross_vertical_referrals (
  id text PRIMARY KEY,
  referral_code text NOT NULL UNIQUE,
  source_vertical text NOT NULL,
  receiving_vertical text NOT NULL,
  prospect_name text NOT NULL,
  prospect_contact text NOT NULL,
  customer_consent_evidence text NOT NULL,
  commercial_context text NOT NULL,
  decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'accepted', 'declined')),
  receiving_lead_id text REFERENCES leads(id),
  decline_reason text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. NM-09: National Commercial & Strategic Escalations (Dual Executive Routing)
CREATE TABLE IF NOT EXISTS national_escalations (
  id text PRIMARY KEY,
  nm_employee_id text NOT NULL REFERENCES employees(id),
  vertical text NOT NULL,
  category text NOT NULL CHECK (category IN ('revenue_assumption', 'strategic_exception', 'pricing_policy', 'governance_risk')),
  target_executive text NOT NULL CHECK (target_executive IN ('CEO', 'CFO', 'BOTH')),
  title text NOT NULL,
  detail text NOT NULL,
  evidence_summary text,
  decision_deadline timestamptz NOT NULL,
  executive_decision text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_executive_review', 'resolved')),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. NM-10: Regional Manager Performance Reviews
CREATE TABLE IF NOT EXISTS rm_reviews (
  id text PRIMARY KEY,
  nm_employee_id text NOT NULL REFERENCES employees(id),
  rm_employee_id text NOT NULL REFERENCES employees(id),
  period_label text NOT NULL,
  performance_rating text NOT NULL CHECK (performance_rating IN ('exceeding', 'achieving', 'needs_improvement', 'critical')),
  strengths text NOT NULL,
  blockers text NOT NULL,
  growth_commitments jsonb NOT NULL DEFAULT '[]',
  coverage_commitments jsonb NOT NULL DEFAULT '[]',
  support_needed text,
  private_nm_notes text,
  next_review_date date NOT NULL,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. NM-11: National Executive Report Schedules
CREATE TABLE IF NOT EXISTS national_report_schedules (
  id text PRIMARY KEY,
  nm_employee_id text NOT NULL REFERENCES employees(id),
  vertical text NOT NULL,
  name text NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'half-yearly', 'annual')),
  cadence text NOT NULL,
  recipients jsonb NOT NULL DEFAULT '[]',
  sections jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed realistic baseline records
INSERT INTO cross_vertical_referrals (
  id, referral_code, source_vertical, receiving_vertical, prospect_name, prospect_contact,
  customer_consent_evidence, commercial_context, decision
) VALUES (
  'REF-001', 'REF-BANK-021', 'banking', 'wealth', 'Aditi Singhania', '+91 98765 40021',
  'Signed customer wealth advisory handoff consent on 28 Sep 2026',
  'High balance current account client seeking equity PMS portfolio management (> 5 Cr AUM).',
  'pending'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO product_rule_proposals (
  id, nm_employee_id, vertical, rule_name, current_version, proposed_version, reason,
  effective_date, affected_products, preview_impact, status
) VALUES (
  'PRP-001', 'EMP-009', 'wealth', 'V1 Conversion Milestone 48h SLA', '2.1', '3.0',
  'Mandatory risk profiling completion before contract documentation issue.',
  CURRENT_DATE + interval '30 days', '["V1 Wealth Portfolio", "V1 Savings Plus"]'::jsonb,
  'Affects ~140 active opportunities in Stage 3 and above.', 'submitted'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO national_escalations (
  id, nm_employee_id, vertical, category, target_executive, title, detail, decision_deadline, status
) VALUES (
  'NESC-001', 'EMP-009', 'wealth', 'revenue_assumption', 'CFO',
  'Standard Advisory Fee Schedule Adjustment for Ultra HNI (>10 Cr)',
  'South and West regions requesting formal 30 bps tier for accounts exceeding 10 Cr to meet competitive offerings.',
  now() + interval '5 days', 'open'
) ON CONFLICT (id) DO NOTHING;
