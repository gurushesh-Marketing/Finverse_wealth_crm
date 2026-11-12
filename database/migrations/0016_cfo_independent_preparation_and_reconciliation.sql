-- 0016_cfo_independent_preparation_and_reconciliation.sql
-- Forward migration for CFO independent preparation, OCC record versioning, policy honesty, and reconciliation integrity

-- 1. Add record_version to finance_ledger_entries for OCC locking
ALTER TABLE finance_ledger_entries
  ADD COLUMN IF NOT EXISTS record_version INTEGER NOT NULL DEFAULT 1;

-- 2. Add is_demo_policy flag to finance_policies and expand category check
ALTER TABLE finance_policies
  ADD COLUMN IF NOT EXISTS is_demo_policy BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE finance_policies DROP CONSTRAINT IF EXISTS finance_policies_category_check;
ALTER TABLE finance_policies ADD CONSTRAINT finance_policies_category_check
  CHECK (category IN ('delegation_of_authority', 'revenue_recognition', 'incentive_scheme', 'credit_terms', 'close_governance'));

-- 3. Update existing illustrative seeded policies with honest demo labels and remove mandatory claims
UPDATE finance_policies
SET
  is_demo_policy = true,
  rules_summary = 'Illustrative demo Delegation of Authority (DoA) policy [Deck P262 / Client Decision Deck P320 Category 3]. Production authority limits require client-approved configuration.'
WHERE id = 'POL-001';

UPDATE finance_policies
SET
  is_demo_policy = true,
  rules_summary = 'Illustrative demo Revenue Recognition Policy [Deck P230 / Client Decision Deck P320 Category 3]. Excludes pass-through taxes according to applicable product tax rules.'
WHERE id = 'POL-002';

UPDATE finance_policies
SET
  is_demo_policy = true,
  rules_summary = 'Illustrative demo incentive scheme with sample 15% clawback holdback [Illustrative demo assumption; Clawback percentage is an open client decision Deck P320 Category 3, not a deck mandate].',
  approval_limits = '{"clawback_reserve_bps": 1500, "clawback_reserve_pct": 15.0, "payout_cap": 5000000, "is_illustrative": true}'
WHERE id = 'POL-003';

-- 4. Seed active period close governance policy with explicit materiality threshold [Deck P240 / P252 / P320 Category 3]
INSERT INTO finance_policies (id, policy_code, title, category, version, effective_date, rules_summary, approval_limits, status, is_demo_policy, proposed_by_employee_id, approved_by_employee_id)
VALUES (
  'POL-004',
  'CLOSE-GOV-2026-V1',
  'Finance Reporting Period Close & Materiality Governance Policy',
  'close_governance',
  '1.0',
  '2026-04-01',
  'Defines mandatory pre-close reconciliation requirements and zero-tolerance materiality threshold for unexplained variance [Deck P240 / P252 / Client Decision Deck P320 Category 3].',
  '{"materiality_threshold": 0.00, "require_all_active_verticals": true, "max_reconciliation_age_hours": 24}',
  'active',
  false,
  'EMP-011',
  'EMP-011'
)
ON CONFLICT (id) DO UPDATE SET
  rules_summary = EXCLUDED.rules_summary,
  approval_limits = EXCLUDED.approval_limits,
  status = 'active',
  is_demo_policy = false,
  approved_by_employee_id = 'EMP-011';

-- 5. Scope baseline fixtures with deterministic dates matching their respective reporting periods
UPDATE sales_finance_handoffs SET created_at = '2026-05-15 10:00:00+00', converted_amount = 250000.00 WHERE id = 'SFH-001';
UPDATE sales_finance_handoffs SET created_at = '2026-10-20 10:00:00+00' WHERE id = 'SFH-002';
UPDATE finance_ledger_entries SET created_at = '2026-05-15 11:00:00+00' WHERE id IN ('ENT-001', 'ENT-002');
UPDATE receipt_invoice_matches SET allocation_date = '2026-05-15 12:00:00+00' WHERE id IN ('RIM-001', 'RIM-002');

-- 6. Seed second finance officer (Priya Nair, Finance Controller) for genuine two-user independent preparation & approval
INSERT INTO employees (id, email, password_hash, display_name, status)
VALUES (
  'EMP-012',
  'priya@finverse.demo',
  'scrypt$glPYJjNa1xF+i+Edlg+42A==$KmkCuU+df+PmDUrg9xAJp/JX7ej9PPPfyK9pxZwd+KY10L/uJ+4a8XiVFbC0eR0y7GxFG7NXracXaYrzIy49HQ==',
  'Priya Nair',
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  display_name = EXCLUDED.display_name,
  status = 'active';

INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from)
VALUES ('ASGN-012', 'EMP-012', 'CFO', 'wealth', 'TEAM-WEALTH-ALPHA', '2026-01-01')
ON CONFLICT (id) DO NOTHING;
