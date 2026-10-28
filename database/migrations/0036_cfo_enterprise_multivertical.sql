-- 0036_cfo_enterprise_multivertical.sql
-- Forward migration to enable full 4-vertical enterprise CFO operations across Wealth, Banking, Markets, and Real Estate

-- 1. Expand vertical CHECK constraint on finance_ledger_entries
ALTER TABLE finance_ledger_entries DROP CONSTRAINT IF EXISTS finance_ledger_entries_vertical_check;
ALTER TABLE finance_ledger_entries ADD CONSTRAINT finance_ledger_entries_vertical_check
  CHECK (vertical IN ('wealth', 'banking', 'markets', 'real_estate', 'shared'));

-- 2. Expand vertical CHECK constraint on vertical_budget_lines
ALTER TABLE vertical_budget_lines DROP CONSTRAINT IF EXISTS vertical_budget_lines_vertical_check;
ALTER TABLE vertical_budget_lines ADD CONSTRAINT vertical_budget_lines_vertical_check
  CHECK (vertical IN ('wealth', 'banking', 'markets', 'real_estate', 'shared_corporate'));

-- 3. Seed certified baseline multi-vertical budget lines across Banking, Markets, and Real Estate
INSERT INTO vertical_budget_lines (id, budget_code, fiscal_year, vertical, cost_category, approved_budget, committed_costs, actual_costs, notes)
VALUES
  -- Banking
  ('BUD-BNK-001', 'BUD-2026-BNK-SAL', 'FY26', 'banking', 'Headcount / Salaries', 32000000.00, 29000000.00, 14500000.00, 'Commercial credit officers & loan managers'),
  ('BUD-BNK-002', 'BUD-2026-BNK-CAC', 'FY26', 'banking', 'Client Acquisition (CAC)', 12000000.00, 10500000.00, 5200000.00, 'Corporate business development outreach'),
  ('BUD-BNK-003', 'BUD-2026-BNK-TEC', 'FY26', 'banking', 'Technology & Feeds', 8000000.00, 7200000.00, 3900000.00, 'Core banking integration & loan origination APIs'),
  ('BUD-BNK-004', 'BUD-2026-BNK-CMP', 'FY26', 'banking', 'Compliance & Advisory', 4000000.00, 3500000.00, 1800000.00, 'RBI regulatory audits & credit risk assessment'),
  -- Markets
  ('BUD-MKT-001', 'BUD-2026-MKT-SAL', 'FY26', 'markets', 'Headcount / Salaries', 28000000.00, 25000000.00, 13000000.00, 'Trading desk associates & equity analysts'),
  ('BUD-MKT-002', 'BUD-2026-MKT-CAC', 'FY26', 'markets', 'Client Acquisition (CAC)', 15000000.00, 13500000.00, 7000000.00, 'Digital trading marketing & partner brokerages'),
  ('BUD-MKT-003', 'BUD-2026-MKT-TEC', 'FY26', 'markets', 'Technology & Feeds', 14000000.00, 13000000.00, 7500000.00, 'NSE/BSE real-time market data lines & OMS feeds'),
  ('BUD-MKT-004', 'BUD-2026-MKT-CMP', 'FY26', 'markets', 'Compliance & Advisory', 5000000.00, 4500000.00, 2200000.00, 'SEBI exchange compliance & peak margin audits'),
  -- Real Estate
  ('BUD-RE-001', 'BUD-2026-RE-SAL', 'FY26', 'real_estate', 'Headcount / Salaries', 24000000.00, 21500000.00, 11000000.00, 'Luxury mandate advisors & property surveyors'),
  ('BUD-RE-002', 'BUD-2026-RE-CAC', 'FY26', 'real_estate', 'Client Acquisition (CAC)', 10000000.00, 8800000.00, 4500000.00, 'HNW direct mailers & private property conclaves'),
  ('BUD-RE-003', 'BUD-2026-RE-TEC', 'FY26', 'real_estate', 'Technology & Feeds', 6000000.00, 5200000.00, 2800000.00, 'GIS mapping, spatial analysis & title registry'),
  ('BUD-RE-004', 'BUD-2026-RE-CMP', 'FY26', 'real_estate', 'Compliance & Advisory', 3500000.00, 3000000.00, 1500000.00, 'RERA legal verification & title escrow counsel')
ON CONFLICT (id) DO UPDATE SET
  approved_budget = EXCLUDED.approved_budget,
  committed_costs = EXCLUDED.committed_costs,
  actual_costs = EXCLUDED.actual_costs,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- 4. Seed baseline multi-vertical sales finance handoffs
INSERT INTO sales_finance_handoffs (id, handoff_code, lead_id, vertical, sales_rep_employee_id, converted_amount, earning_milestone, supporting_evidence_url, review_status, created_at)
VALUES
  ('SFH-003', 'SFH-2026-003', 'FV-3001', 'markets', 'EMP-021', 450000.00, 'kyc_cleared', 'https://vault.internal.finverse/mandates/demat-trading-agreement.pdf', 'pending_verification', '2026-05-18 10:00:00+00'),
  ('SFH-004', 'SFH-2026-004', 'FV-4001', 'real_estate', 'EMP-026', 1800000.00, 'mandate_signed', 'https://vault.internal.finverse/mandates/luxury-property-mandate.pdf', 'pending_verification', '2026-05-20 10:00:00+00')
ON CONFLICT (id) DO UPDATE SET
  converted_amount = EXCLUDED.converted_amount,
  review_status = EXCLUDED.review_status,
  updated_at = NOW();

-- 5. Seed baseline multi-vertical forecast finance reviews
INSERT INTO forecast_finance_reviews (id, period_label, vertical, sales_projected_revenue, finance_discount_rate_pct, risk_adjusted_revenue, cash_conversion_pace_days, finance_assumptions, concurrence_status, concurred_by_employee_id, concurred_at, created_at)
VALUES
  ('FFR-002', 'FY26-Q1', 'banking', 45000000.00, 8.00, 41400000.00, 40, 'Corporate term lending pipeline risk-adjusted concurrence', 'concurred', 'EMP-011', '2026-10-10 09:23:59+00', '2026-10-10 09:23:59+00'),
  ('FFR-003', 'FY26-Q1', 'markets', 25000000.00, 12.00, 22000000.00, 15, 'Demat onboarding and brokerage yield forecast concurrence', 'concurred', 'EMP-011', '2026-10-10 09:23:59+00', '2026-10-10 09:23:59+00'),
  ('FFR-004', 'FY26-Q1', 'real_estate', 20000000.00, 15.00, 17000000.00, 60, 'High-ticket luxury property advisory velocity concurrence', 'concurred', 'EMP-011', '2026-10-10 09:23:59+00', '2026-10-10 09:23:59+00')
ON CONFLICT (id) DO UPDATE SET
  sales_projected_revenue = EXCLUDED.sales_projected_revenue,
  finance_discount_rate_pct = EXCLUDED.finance_discount_rate_pct,
  risk_adjusted_revenue = EXCLUDED.risk_adjusted_revenue,
  concurrence_status = EXCLUDED.concurrence_status,
  finance_assumptions = EXCLUDED.finance_assumptions;
