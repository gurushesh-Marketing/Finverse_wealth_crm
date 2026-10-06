-- 0013_cfo_workflows.sql
-- Schema and baseline records for Chief Financial Officer (CFO-01..CFO-19)

-- Ensure CFO demo employee exists
INSERT INTO employees (id, email, password_hash, display_name, status)
VALUES (
  'EMP-011',
  'ananya@finverse.demo',
  -- SHA-256 of 'demo1234'
  '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
  'Ananya Roy',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- CFO global executive assignment
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES 
  ('ASG-EXEC-CFO-W', 'EMP-011', 'CFO', 'wealth', 'TEAM-WEALTH-ALPHA', CURRENT_DATE, NULL),
  ('ASG-EXEC-CFO-B', 'EMP-011', 'CFO', 'banking', 'TEAM-BANKING-ALPHA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- 1. Finance Reporting Periods (CFO-14, CFO-15)
CREATE TABLE IF NOT EXISTS reporting_periods (
  id TEXT PRIMARY KEY,
  period_label TEXT NOT NULL UNIQUE, -- e.g. 'FY26-Q1', 'FY26-Q2', 'FY26-M04'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closing_review', 'certified_closed', 'reopened')),
  certified_by_employee_id TEXT REFERENCES employees(id),
  certified_at TIMESTAMPTZ,
  certification_hash TEXT,
  lock_governed_writes BOOLEAN NOT NULL DEFAULT false,
  checklist_state JSONB NOT NULL DEFAULT '{"reconciliations_passed": false, "exceptions_reviewed": false, "ledger_balanced": false, "tax_provisioned": false}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Period Reopening Requests (CFO-15)
CREATE TABLE IF NOT EXISTS period_reopen_requests (
  id TEXT PRIMARY KEY,
  period_id TEXT NOT NULL REFERENCES reporting_periods(id),
  requested_by_employee_id TEXT NOT NULL REFERENCES employees(id),
  reason TEXT NOT NULL,
  impact_assessment TEXT NOT NULL,
  affected_accounts JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reclosed')),
  authorized_by_employee_id TEXT REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  unlock_expires_at TIMESTAMPTZ,
  new_close_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Finance Ledger Entries (CFO-01, CFO-03, CFO-11)
CREATE TABLE IF NOT EXISTS finance_ledger_entries (
  id TEXT PRIMARY KEY,
  entry_code TEXT NOT NULL UNIQUE, -- e.g. 'ENT-2026-001'
  period_id TEXT NOT NULL REFERENCES reporting_periods(id),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('revenue_recognition', 'cash_receipt', 'receivable_accrual', 'credit_note_reversal', 'refund_payout', 'tax_provision')),
  vertical TEXT NOT NULL CHECK (vertical IN ('wealth', 'banking', 'shared')),
  gross_amount NUMERIC(14,2) NOT NULL,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  net_amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  policy_code TEXT NOT NULL, -- e.g. 'REV-POL-2026-V1'
  source_reference_type TEXT NOT NULL, -- 'lead_conversion', 'invoice', 'bank_receipt', 'dispute'
  source_reference_id TEXT NOT NULL,
  account_code TEXT NOT NULL, -- e.g. '4001-WEALTH-PMS', '1200-AR-WEALTH'
  description TEXT NOT NULL,
  is_reversal BOOLEAN NOT NULL DEFAULT false,
  reversal_linked_entry_id TEXT REFERENCES finance_ledger_entries(id),
  prepared_by_employee_id TEXT NOT NULL REFERENCES employees(id),
  approved_by_employee_id TEXT REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('draft', 'pending_approval', 'posted', 'reversed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Sales to Finance Handoffs (CFO-02)
CREATE TABLE IF NOT EXISTS sales_finance_handoffs (
  id TEXT PRIMARY KEY,
  handoff_code TEXT NOT NULL UNIQUE, -- e.g. 'SFH-1042'
  lead_id TEXT NOT NULL REFERENCES leads(id),
  vertical TEXT NOT NULL DEFAULT 'wealth',
  sales_rep_employee_id TEXT REFERENCES employees(id),
  converted_amount NUMERIC(14,2) NOT NULL,
  earning_milestone TEXT NOT NULL, -- 'mandate_signed', 'initial_deposit', 'kyc_cleared'
  supporting_evidence_url TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (review_status IN ('pending_verification', 'accepted_for_processing', 'returned_deficiencies')),
  deficiency_notes TEXT,
  verified_by_employee_id TEXT REFERENCES employees(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Receivable Invoices & Items (CFO-04, CFO-09)
CREATE TABLE IF NOT EXISTS receivable_invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE, -- e.g. 'INV-2026-0042'
  period_id TEXT NOT NULL REFERENCES reporting_periods(id),
  lead_id TEXT REFERENCES leads(id),
  client_name TEXT NOT NULL,
  client_pan TEXT,
  vertical TEXT NOT NULL DEFAULT 'wealth',
  total_amount NUMERIC(14,2) NOT NULL,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  net_receivable NUMERIC(14,2) NOT NULL,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  outstanding_balance NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'pending_approval', 'issued', 'partially_paid', 'settled', 'overdue', 'written_off')),
  line_items JSONB NOT NULL DEFAULT '[]', -- [{description, product, rate_bps, base_aum, amount}]
  assigned_collection_agent_id TEXT REFERENCES employees(id),
  collection_status TEXT NOT NULL DEFAULT 'standard' CHECK (collection_status IN ('standard', 'promise_to_pay', 'disputed', 'escalated_legal')),
  promise_to_pay_date DATE,
  collection_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Bank Settled Receipts (CFO-05, CFO-07)
CREATE TABLE IF NOT EXISTS bank_settled_receipts (
  id TEXT PRIMARY KEY,
  receipt_code TEXT NOT NULL UNIQUE, -- e.g. 'RCT-2026-9921'
  bank_reference TEXT NOT NULL UNIQUE, -- UTR or Bank transaction number
  bank_name TEXT NOT NULL,
  settlement_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  payer_name TEXT NOT NULL,
  payer_identifier TEXT, -- PAN, Account No, virtual UPI ID
  status TEXT NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'partially_matched', 'matched', 'suspense', 'quarantined')),
  matched_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  unmatched_amount NUMERIC(14,2) NOT NULL,
  suspense_reason TEXT,
  clarification_team_id TEXT REFERENCES teams(id),
  clarification_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Receipt Invoice Matches (CFO-06)
CREATE TABLE IF NOT EXISTS receipt_invoice_matches (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL REFERENCES bank_settled_receipts(id),
  invoice_id TEXT NOT NULL REFERENCES receivable_invoices(id),
  allocated_amount NUMERIC(14,2) NOT NULL,
  allocation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  allocated_by_employee_id TEXT NOT NULL REFERENCES employees(id),
  notes TEXT
);

-- 7. Finance Reconciliations (CFO-08)
CREATE TABLE IF NOT EXISTS finance_reconciliations (
  id TEXT PRIMARY KEY,
  reconciliation_code TEXT NOT NULL UNIQUE, -- e.g. 'REC-2026-Q1'
  period_id TEXT NOT NULL REFERENCES reporting_periods(id),
  vertical TEXT NOT NULL DEFAULT 'wealth',
  sales_closed_wins_total NUMERIC(14,2) NOT NULL,
  recognised_revenue_total NUMERIC(14,2) NOT NULL,
  cash_receipts_total NUMERIC(14,2) NOT NULL,
  timing_difference NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  partial_settlement_difference NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  unbilled_pipeline_difference NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  unexplained_variance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  reconciliation_status TEXT NOT NULL DEFAULT 'draft' CHECK (reconciliation_status IN ('draft', 'variance_investigation', 'approved_frozen')),
  frozen_by_employee_id TEXT REFERENCES employees(id),
  frozen_at TIMESTAMPTZ,
  explanation_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Refund Requests (CFO-10)
CREATE TABLE IF NOT EXISTS refund_requests (
  id TEXT PRIMARY KEY,
  refund_code TEXT NOT NULL UNIQUE, -- e.g. 'REF-2026-001'
  lead_id TEXT REFERENCES leads(id),
  client_name TEXT NOT NULL,
  original_receipt_id TEXT REFERENCES bank_settled_receipts(id),
  refund_amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  reason TEXT NOT NULL,
  bank_beneficiary_name TEXT NOT NULL,
  bank_account_number TEXT NOT NULL,
  bank_ifsc TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected', 'executed_paid')),
  authorized_by_employee_id TEXT REFERENCES employees(id),
  external_payment_ref TEXT,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Incentive Calculations & Disputes (CFO-12, CFO-13)
CREATE TABLE IF NOT EXISTS incentive_calculations (
  id TEXT PRIMARY KEY,
  calculation_code TEXT NOT NULL UNIQUE, -- e.g. 'INC-2026-Q1'
  period_id TEXT NOT NULL REFERENCES reporting_periods(id),
  scheme_name TEXT NOT NULL, -- 'Wealth Advisory Incentive Scheme FY26-V1'
  scheme_version TEXT NOT NULL DEFAULT '1.0',
  total_incentive_pool NUMERIC(14,2) NOT NULL,
  clawback_reserve NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  payable_incentive_total NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'calculated' CHECK (status IN ('calculated', 'disputed', 'frozen_for_payout', 'paid')),
  payout_handoff_reference TEXT,
  approved_by_employee_id TEXT REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  employee_allocations JSONB NOT NULL DEFAULT '[]', -- [{employee_id, employee_name, role, gross_incentive, clawback, net_payable}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incentive_disputes (
  id TEXT PRIMARY KEY,
  dispute_code TEXT NOT NULL UNIQUE, -- e.g. 'DISP-2026-01'
  calculation_id TEXT NOT NULL REFERENCES incentive_calculations(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  disputed_amount NUMERIC(14,2) NOT NULL,
  employee_claim TEXT NOT NULL,
  supporting_evidence TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved_upheld', 'resolved_rejected')),
  resolution_amount NUMERIC(14,2),
  decision_notes TEXT,
  resolved_by_employee_id TEXT REFERENCES employees(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Vertical Budget Lines (CFO-16)
CREATE TABLE IF NOT EXISTS vertical_budget_lines (
  id TEXT PRIMARY KEY,
  budget_code TEXT NOT NULL UNIQUE, -- e.g. 'BUD-2026-WEALTH-HR'
  fiscal_year TEXT NOT NULL DEFAULT 'FY26',
  vertical TEXT NOT NULL CHECK (vertical IN ('wealth', 'banking', 'shared_corporate')),
  cost_category TEXT NOT NULL, -- 'Headcount / Salaries', 'Technology & Feeds', 'Client Acquisition (CAC)', 'Office & Infrastructure', 'Compliance & Advisory'
  approved_budget NUMERIC(14,2) NOT NULL,
  committed_costs NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  actual_costs NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  variance_amount NUMERIC(14,2) GENERATED ALWAYS AS (approved_budget - actual_costs) STORED,
  variance_pct NUMERIC(6,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Forecast Finance Reviews (CFO-17)
CREATE TABLE IF NOT EXISTS forecast_finance_reviews (
  id TEXT PRIMARY KEY,
  period_label TEXT NOT NULL,
  vertical TEXT NOT NULL DEFAULT 'wealth',
  sales_projected_revenue NUMERIC(14,2) NOT NULL,
  finance_discount_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  risk_adjusted_revenue NUMERIC(14,2) NOT NULL,
  cash_conversion_pace_days INT NOT NULL DEFAULT 45,
  finance_assumptions TEXT NOT NULL,
  concurrence_status TEXT NOT NULL DEFAULT 'concurred' CHECK (concurrence_status IN ('concurred', 'concurred_with_reservations', 'corrections_required')),
  concurred_by_employee_id TEXT REFERENCES employees(id),
  concurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Finance Report Schedules (CFO-18)
CREATE TABLE IF NOT EXISTS finance_pack_schedules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('monthly_close', 'quarterly_board', 'bi_weekly_cash')),
  recipients JSONB NOT NULL DEFAULT '[]',
  include_full_ledger BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Finance Approval Policies (CFO-19)
CREATE TABLE IF NOT EXISTS finance_policies (
  id TEXT PRIMARY KEY,
  policy_code TEXT NOT NULL UNIQUE, -- e.g. 'DOA-2026-V1'
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('delegation_of_authority', 'revenue_recognition', 'incentive_scheme', 'credit_terms')),
  version TEXT NOT NULL DEFAULT '1.0',
  effective_date DATE NOT NULL,
  rules_summary TEXT NOT NULL,
  approval_limits JSONB NOT NULL DEFAULT '{}', -- { 'TL': 50000, 'MG': 200000, 'RM': 1000000, 'NM': 5000000, 'CFO': 50000000 }
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'pending_approval', 'active', 'superseded')),
  proposed_by_employee_id TEXT NOT NULL REFERENCES employees(id),
  approved_by_employee_id TEXT REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- SEED INITIAL BASELINE RECORDS FOR CFO WORKFLOWS
-- =========================================================================

-- Reporting Periods
INSERT INTO reporting_periods (id, period_label, start_date, end_date, status, checklist_state)
VALUES
  ('PER-2026-Q1', 'FY26-Q1', '2026-04-01', '2026-06-30', 'open', '{"reconciliations_passed": true, "exceptions_reviewed": true, "ledger_balanced": true, "tax_provisioned": true}'),
  ('PER-2026-Q2', 'FY26-Q2', '2026-07-01', '2026-09-30', 'open', '{"reconciliations_passed": false, "exceptions_reviewed": false, "ledger_balanced": false, "tax_provisioned": false}')
ON CONFLICT (id) DO NOTHING;

-- Policies
INSERT INTO finance_policies (id, policy_code, title, category, version, effective_date, rules_summary, approval_limits, status, proposed_by_employee_id)
VALUES
  ('POL-001', 'DOA-2026-V1', 'Delegation of Financial Authority (DoA)', 'delegation_of_authority', '1.0', '2026-04-01', 'Defines commercial concession and fee discount approval limits across management tiers.', '{"TL": 25000, "MG": 100000, "RM": 500000, "NM": 2500000, "CFO": 25000000}', 'active', 'EMP-011'),
  ('POL-002', 'REV-2026-V1', 'SEBI Wealth Advisory Revenue Recognition Policy', 'revenue_recognition', '1.0', '2026-04-01', 'Revenue recognised upon execution confirmation and irrevocable client mandate.', '{}', 'active', 'EMP-011')
ON CONFLICT (id) DO NOTHING;

-- Invoices
INSERT INTO receivable_invoices (id, invoice_number, period_id, client_name, client_pan, vertical, total_amount, tax_amount, net_receivable, paid_amount, outstanding_balance, issue_date, due_date, status, line_items)
VALUES
  ('INV-001', 'INV-2026-0001', 'PER-2026-Q1', 'Rajesh Singhania', 'ABCPS1234F', 'wealth', 295000.00, 45000.00, 250000.00, 295000.00, 0.00, '2026-05-10', '2026-06-10', 'settled', '[{"description": "PMS Discretionary Advisory Fee Q1", "rate_bps": 200, "amount": 250000}]'),
  ('INV-002', 'INV-2026-0002', 'PER-2026-Q1', 'Mehta Family Trust', 'MEHTA9988K', 'wealth', 590000.00, 90000.00, 500000.00, 300000.00, 290000.00, '2026-05-20', '2026-06-20', 'partially_paid', '[{"description": "Multi-Asset Mandate Setup Fee", "rate_bps": 150, "amount": 500000}]'),
  ('INV-003', 'INV-2026-0003', 'PER-2026-Q2', 'Apex Technologies Holdings', 'APEXT5544L', 'wealth', 1180000.00, 180000.00, 1000000.00, 0.00, 1180000.00, '2026-07-05', '2026-08-05', 'issued', '[{"description": "Institutional Treasury Advisory Q2", "rate_bps": 100, "amount": 1000000}]')
ON CONFLICT (id) DO NOTHING;

-- Bank Settled Receipts
INSERT INTO bank_settled_receipts (id, receipt_code, bank_reference, bank_name, settlement_date, amount, payer_name, payer_identifier, status, matched_amount, unmatched_amount)
VALUES
  ('RCT-001', 'RCT-2026-0001', 'UTR-HDFC-9921827361', 'HDFC Bank', '2026-05-12', 295000.00, 'Rajesh Singhania', 'ABCPS1234F', 'matched', 295000.00, 0.00),
  ('RCT-002', 'RCT-2026-0002', 'UTR-ICIC-8827162534', 'ICICI Bank', '2026-06-02', 300000.00, 'Mehta Family Trust', 'MEHTA9988K', 'partially_matched', 300000.00, 0.00),
  ('RCT-003', 'RCT-2026-0003', 'UTR-AXIS-7716253442', 'Axis Bank', '2026-07-15', 450000.00, 'Kiran Deep Enterprises', 'UNKNOWN-PAN', 'unmatched', 0.00, 450000.00)
ON CONFLICT (id) DO NOTHING;

-- Matches
INSERT INTO receipt_invoice_matches (id, receipt_id, invoice_id, allocated_amount, allocated_by_employee_id, notes)
VALUES
  ('RIM-001', 'RCT-001', 'INV-001', 295000.00, 'EMP-011', 'Full settlement of PMS advisory invoice'),
  ('RIM-002', 'RCT-002', 'INV-002', 300000.00, 'EMP-011', 'Partial payment on Multi-Asset Mandate')
ON CONFLICT (id) DO NOTHING;

-- Finance Ledger
INSERT INTO finance_ledger_entries (id, entry_code, period_id, entry_type, vertical, gross_amount, tax_amount, net_amount, policy_code, source_reference_type, source_reference_id, account_code, description, prepared_by_employee_id, approved_by_employee_id, approved_at, status)
VALUES
  ('ENT-001', 'ENT-2026-0001', 'PER-2026-Q1', 'revenue_recognition', 'wealth', 295000.00, 45000.00, 250000.00, 'REV-2026-V1', 'invoice', 'INV-001', '4001-WEALTH-PMS', 'Recognised PMS Discretionary Advisory Fee Q1', 'EMP-011', 'EMP-011', NOW(), 'posted'),
  ('ENT-002', 'ENT-2026-0002', 'PER-2026-Q1', 'cash_receipt', 'wealth', 295000.00, 0.00, 295000.00, 'REV-2026-V1', 'bank_receipt', 'RCT-001', '1010-CASH-HDFC', 'Settled collection for Singhania mandate', 'EMP-011', 'EMP-011', NOW(), 'posted')
ON CONFLICT (id) DO NOTHING;

-- Budget Lines
INSERT INTO vertical_budget_lines (id, budget_code, fiscal_year, vertical, cost_category, approved_budget, committed_costs, actual_costs, variance_pct, notes)
VALUES
  ('BUD-001', 'BUD-2026-WLTH-SAL', 'FY26', 'wealth', 'Headcount / Salaries', 48000000.00, 44000000.00, 22000000.00, 54.17, 'Frontline caller and manager team costs'),
  ('BUD-002', 'BUD-2026-WLTH-MKT', 'FY26', 'wealth', 'Client Acquisition (CAC)', 18000000.00, 16500000.00, 9500000.00, 47.22, 'Digital lead gen and partner referral fees'),
  ('BUD-003', 'BUD-2026-WLTH-TEC', 'FY26', 'wealth', 'Technology & Feeds', 12000000.00, 11000000.00, 5800000.00, 51.67, 'Bloomberg terminals and exchange feeds'),
  ('BUD-004', 'BUD-2026-WLTH-CMP', 'FY26', 'wealth', 'Compliance & Advisory', 6000000.00, 5200000.00, 2600000.00, 56.67, 'SEBI audit and legal counsel retainers')
ON CONFLICT (id) DO NOTHING;

-- Incentive Calculation
INSERT INTO incentive_calculations (id, calculation_code, period_id, scheme_name, scheme_version, total_incentive_pool, clawback_reserve, payable_incentive_total, status, employee_allocations)
VALUES
  ('INC-001', 'INC-2026-Q1', 'PER-2026-Q1', 'Wealth Advisory Incentive Scheme FY26-V1', '1.0', 3200000.00, 480000.00, 2720000.00, 'calculated', '[
    {"employee_id": "EMP-001", "employee_name": "Aarav Sharma", "role": "SC", "gross_incentive": 180000, "clawback": 27000, "net_payable": 153000},
    {"employee_id": "EMP-002", "employee_name": "Priya Nair", "role": "SC", "gross_incentive": 220000, "clawback": 33000, "net_payable": 187000},
    {"employee_id": "EMP-005", "employee_name": "Rohan Verma", "role": "TL", "gross_incentive": 350000, "clawback": 52500, "net_payable": 297500}
  ]')
ON CONFLICT (id) DO NOTHING;
