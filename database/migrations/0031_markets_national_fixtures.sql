-- Migration 0031 — Markets & Securities National Manager (NM-01..NM-11) fixtures
-- Provisions REGION-MARKETS-NORTH, Sanjay Singhania (EMP-025, National Manager),
-- national target baseline, cross-vertical referral intake, product rule proposal,
-- and executive escalation for Markets & Securities.

-- Additional Markets region for multi-region governance & work transfers
INSERT INTO regions (id, name, vertical)
VALUES ('REGION-MARKETS-NORTH', 'Markets & Securities North Zone', 'markets')
ON CONFLICT (id) DO NOTHING;

-- Seed Sanjay Singhania (EMP-025, Markets National Manager)
-- Reuses active demo scrypt hash from existing demo employee
INSERT INTO employees (id, email, password_hash, display_name, status)
SELECT 'EMP-025', 'sanjay@finverse.demo', password_hash, 'Sanjay Singhania', 'active'
FROM employees WHERE email = 'rajesh.b@finverse.demo' LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- NM assignments across Markets teams
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-MKT-NM-A', 'EMP-025', 'NM', 'markets', 'TEAM-MARKETS-ALPHA', CURRENT_DATE, NULL),
  ('ASG-MKT-NM-B', 'EMP-025', 'NM', 'markets', 'TEAM-MARKETS-BETA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- Baseline National Target for Markets & Securities
INSERT INTO national_targets (
  id, nm_employee_id, vertical, period_label, metric, approved_ceo_target,
  unallocated_remainder, regional_allocations, status, version
) VALUES (
  'NT-MKT-OCT-2026', 'EMP-025', 'markets', 'October', 'approved-wins', 400,
  200, '[{"regionId": "REGION-MARKETS-WEST", "regionName": "Markets & Securities West Zone", "targetWins": 200}]'::jsonb,
  'published', 1
) ON CONFLICT (vertical, period_label, metric, version) DO NOTHING;

-- Baseline Inbound Cross-Vertical Referral (from Wealth to Markets)
INSERT INTO cross_vertical_referrals (
  id, referral_code, source_vertical, receiving_vertical, prospect_name,
  prospect_contact, customer_consent_evidence, commercial_context, decision
) VALUES (
  'REF-MKT-001', 'REF-WLTH-099', 'wealth', 'markets', 'Aditya Singhania',
  '+91 98220 33445', 'Signed wealth client cross-referral consent form',
  'HNI equity client establishing quantitative derivatives desk; requires high-frequency API access and margin facility.',
  'pending'
) ON CONFLICT (id) DO NOTHING;

-- Baseline Product Rule Proposal for Markets
INSERT INTO product_rule_proposals (
  id, nm_employee_id, vertical, rule_name, current_version, proposed_version,
  reason, effective_date, affected_products, preview_impact, status
) VALUES (
  'PRP-MKT-001', 'EMP-025', 'markets', 'Instant SEBI CKYC Verification & Demat Account Activation SLA',
  '1.0', '2.0',
  'Automate multi-depository KRA failover reducing Demat activation SLA from 48h to 2h',
  CURRENT_DATE + interval '30 days', '["Equity Delivery & Intraday", "F&O Derivatives"]'::jsonb,
  'Affects approx 120 pending trading account onboardings in pipeline', 'submitted'
) ON CONFLICT (id) DO NOTHING;

-- Baseline Strategic National Escalation for Markets
INSERT INTO national_escalations (
  id, nm_employee_id, vertical, category, target_executive, title, detail,
  decision_deadline, status
) VALUES (
  'NESC-MKT-001', 'EMP-025', 'markets', 'pricing_policy', 'CFO',
  'Intraday Margin Leverage & Peak Margin Policy Adjustment',
  'Markets West Zone requesting treasury credit line backing to offer competitive intraday margin facility',
  now() + interval '5 days', 'open'
) ON CONFLICT (id) DO NOTHING;
