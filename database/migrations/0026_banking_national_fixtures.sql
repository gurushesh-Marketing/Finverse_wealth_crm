-- Migration 0026 — Commercial Banking National Manager (NM-01..NM-11) fixtures
-- Provisions REGION-BANKING-NORTH, Suresh Nair (EMP-020, National Manager),
-- national target baseline, cross-vertical referral intake, product rule proposal,
-- and executive escalation for Commercial Banking.

-- Additional Banking region for multi-region governance & work transfers
INSERT INTO regions (id, name, vertical)
VALUES ('REGION-BANKING-NORTH', 'Commercial Banking North Zone', 'banking')
ON CONFLICT (id) DO NOTHING;

-- Seed Suresh Nair (EMP-020, Banking National Manager)
-- Reuses active demo scrypt hash from existing demo employee
INSERT INTO employees (id, email, password_hash, display_name, status)
SELECT 'EMP-020', 'suresh@finverse.demo', password_hash, 'Suresh Nair', 'active'
FROM employees WHERE email = 'arjun@finverse.demo' LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- NM assignments across Banking teams
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-BANK-NM-A', 'EMP-020', 'NM', 'banking', 'TEAM-BANKING-ALPHA', CURRENT_DATE, NULL),
  ('ASG-BANK-NM-B', 'EMP-020', 'NM', 'banking', 'TEAM-BANKING-BETA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- Baseline National Target for Commercial Banking
INSERT INTO national_targets (
  id, nm_employee_id, vertical, period_label, metric, approved_ceo_target,
  unallocated_remainder, regional_allocations, status, version
) VALUES (
  'NT-BANK-OCT-2026', 'EMP-020', 'banking', 'October', 'approved-wins', 300,
  150, '[{"regionId": "REGION-BANKING-WEST", "regionName": "Commercial Banking West Zone", "targetWins": 150}]'::jsonb,
  'published', 1
) ON CONFLICT (vertical, period_label, metric, version) DO NOTHING;

-- Baseline Inbound Cross-Vertical Referral (from Wealth to Banking)
INSERT INTO cross_vertical_referrals (
  id, referral_code, source_vertical, receiving_vertical, prospect_name,
  prospect_contact, customer_consent_evidence, commercial_context, decision
) VALUES (
  'REF-BNK-001', 'REF-WLTH-088', 'wealth', 'banking', 'Harsh Vardhan',
  '+91 98220 11223', 'Signed wealth client cross-referral consent form',
  'Ultra-HNI equity client expanding manufacturing operations; requires 15 Cr working capital credit facility and corporate treasury desk.',
  'pending'
) ON CONFLICT (id) DO NOTHING;

-- Baseline Product Rule Proposal for Banking
INSERT INTO product_rule_proposals (
  id, nm_employee_id, vertical, rule_name, current_version, proposed_version,
  reason, effective_date, affected_products, preview_impact, status
) VALUES (
  'PRP-BNK-001', 'EMP-020', 'banking', 'Commercial Working Capital Fast-Track Credit Appraisal',
  '1.0', '2.0',
  'Fast-track turnaround SLA from 72h to 24h for collateralized credit facilities under 5 Cr',
  CURRENT_DATE + interval '30 days', '["V1 Commercial Term Loan", "V1 Current Account"]'::jsonb,
  'Affects approx 45 commercial loan applications in pipeline', 'submitted'
) ON CONFLICT (id) DO NOTHING;

-- Baseline Strategic National Escalation for Banking
INSERT INTO national_escalations (
  id, nm_employee_id, vertical, category, target_executive, title, detail,
  decision_deadline, status
) VALUES (
  'NESC-BNK-001', 'EMP-020', 'banking', 'pricing_policy', 'CFO',
  'Working Capital Prime Lending Spread Floor Adjustment',
  'Commercial West zone requesting 25 bps concession for BBB+ rated engineering exporters',
  now() + interval '5 days', 'open'
) ON CONFLICT (id) DO NOTHING;
