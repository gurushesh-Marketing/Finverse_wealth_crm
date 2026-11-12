-- 0015_cfo_hardening.sql
-- Forward migration for CFO reconciliation versioning, source watermarks, and active policies

ALTER TABLE finance_reconciliations
  ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT 'v1.0',
  ADD COLUMN IF NOT EXISTS source_watermark JSONB NOT NULL DEFAULT '{}';

-- Active incentive scheme policy (CFO-12 / Deck P248 / Deck P320 Category 2)
INSERT INTO finance_policies (id, policy_code, title, category, version, effective_date, rules_summary, approval_limits, status, proposed_by_employee_id)
VALUES (
  'POL-003',
  'INC-SCHEME-2026-V1',
  'Wealth & Banking Advisory Incentive Scheme FY26',
  'incentive_scheme',
  '1.0',
  '2026-04-01',
  'Defines advisory commission tiers, milestone qualification gates, and mandatory 15% clawback reserve [Deck P248 / Deck P320 Category 2].',
  '{"clawback_reserve_bps": 1500, "clawback_reserve_pct": 15.0, "payout_cap": 5000000}',
  'active',
  'EMP-011'
)
ON CONFLICT (id) DO NOTHING;
