-- Migration 0032 — Real Estate Advisory Hierarchy & Operational Fixtures (Deck P005, P036..P202)
-- Expands leads_stage_check to support Real Estate stages:
-- 'requirement', 'site-visit', 'booking', 'registration' alongside existing stages.
-- Provisions full operational hierarchy:
-- 1. SC: Sameer Kulkarni (EMP-026) in TEAM-REALESTATE-ALPHA
-- 2. TL: Neha Gupta (EMP-027) in TEAM-REALESTATE-ALPHA
-- 3. MG: Vikramaditya Singhania (EMP-028) governing TEAM-REALESTATE-ALPHA & BETA
-- 4. RM: Siddharth Malhotra (EMP-029) governing REGION-REALESTATE-WEST
-- 5. NM: Aditya Singhania (EMP-030) National Manager for Real Estate Advisory

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_stage_check;

ALTER TABLE leads ADD CONSTRAINT leads_stage_check CHECK (
  stage IN (
    -- Baseline & Wealth stages
    'new',
    'not-contacted',
    'contacted',
    'follow-up',
    'qualified',
    'converted',
    'lost',
    -- Commercial Banking stages (Deck P005)
    'eligibility',
    'documents',
    'sanction',
    'disbursal',
    -- Markets & Securities stages (Deck P005)
    'kyc',
    'risk-profile',
    'demat-opened',
    'active-funded',
    -- Real Estate Advisory stages (Deck P005)
    'requirement',
    'site-visit',
    'booking',
    'registration'
  )
);

-- Teams for Real Estate
INSERT INTO teams (id, name, vertical)
VALUES
  ('TEAM-REALESTATE-ALPHA', 'Real Estate Alpha (Luxury Residential)', 'real_estate'),
  ('TEAM-REALESTATE-BETA', 'Real Estate Beta (Commercial Mandates)', 'real_estate')
ON CONFLICT (id) DO NOTHING;

-- Regions
INSERT INTO regions (id, name, vertical)
VALUES
  ('REGION-REALESTATE-WEST', 'Real Estate Advisory West Zone', 'real_estate'),
  ('REGION-REALESTATE-NORTH', 'Real Estate Advisory North Zone', 'real_estate')
ON CONFLICT (id) DO NOTHING;

-- Link Teams to Region
UPDATE teams SET region_id = 'REGION-REALESTATE-WEST'
 WHERE id IN ('TEAM-REALESTATE-ALPHA', 'TEAM-REALESTATE-BETA');

-- Seed Employees (Reusing password_hash from demo employee asha@finverse.demo)
INSERT INTO employees (id, email, password_hash, display_name, status)
SELECT 'EMP-026', 'sameer@finverse.demo', password_hash, 'Sameer Kulkarni', 'active'
FROM employees WHERE email = 'asha@finverse.demo' LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO employees (id, email, password_hash, display_name, status)
SELECT 'EMP-027', 'neha.g@finverse.demo', password_hash, 'Neha Gupta', 'active'
FROM employees WHERE email = 'asha@finverse.demo' LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO employees (id, email, password_hash, display_name, status)
SELECT 'EMP-028', 'vikramaditya@finverse.demo', password_hash, 'Vikramaditya Singhania', 'active'
FROM employees WHERE email = 'asha@finverse.demo' LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO employees (id, email, password_hash, display_name, status)
SELECT 'EMP-029', 'siddharth.m@finverse.demo', password_hash, 'Siddharth Malhotra', 'active'
FROM employees WHERE email = 'asha@finverse.demo' LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO employees (id, email, password_hash, display_name, status)
SELECT 'EMP-030', 'aditya@finverse.demo', password_hash, 'Aditya Singhania', 'active'
FROM employees WHERE email = 'asha@finverse.demo' LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO employees (id, email, password_hash, display_name, status)
SELECT 'EMP-031', 'kunal.r@finverse.demo', password_hash, 'Kunal Rao', 'active'
FROM employees WHERE email = 'asha@finverse.demo' LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO employees (id, email, password_hash, display_name, status)
SELECT 'EMP-032', 'pooja.r@finverse.demo', password_hash, 'Pooja Reddy', 'active'
FROM employees WHERE email = 'asha@finverse.demo' LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Assignments
-- 1. Sameer Kulkarni (SC on Real Estate Alpha)
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-RE-SC-001', 'EMP-026', 'SC', 'real_estate', 'TEAM-REALESTATE-ALPHA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. Kunal Rao (SC on Real Estate Beta)
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-RE-SC-002', 'EMP-031', 'SC', 'real_estate', 'TEAM-REALESTATE-BETA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- 3. Neha Gupta (TL on Real Estate Alpha)
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-RE-TL-001', 'EMP-027', 'TL', 'real_estate', 'TEAM-REALESTATE-ALPHA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- 4. Pooja Reddy (TL on Real Estate Beta)
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-RE-TL-002', 'EMP-032', 'TL', 'real_estate', 'TEAM-REALESTATE-BETA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- 5. Vikramaditya Singhania (MG on Real Estate Alpha & Beta)
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-RE-MG-001', 'EMP-028', 'MG', 'real_estate', 'TEAM-REALESTATE-ALPHA', CURRENT_DATE, NULL),
  ('ASG-RE-MG-002', 'EMP-028', 'MG', 'real_estate', 'TEAM-REALESTATE-BETA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- 6. Siddharth Malhotra (RM on Real Estate Alpha & Beta)
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-RE-RM-A', 'EMP-029', 'RM', 'real_estate', 'TEAM-REALESTATE-ALPHA', CURRENT_DATE, NULL),
  ('ASG-RE-RM-B', 'EMP-029', 'RM', 'real_estate', 'TEAM-REALESTATE-BETA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- 7. Aditya Singhania (NM on Real Estate Alpha & Beta)
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-RE-NM-A', 'EMP-030', 'NM', 'real_estate', 'TEAM-REALESTATE-ALPHA', CURRENT_DATE, NULL),
  ('ASG-RE-NM-B', 'EMP-030', 'NM', 'real_estate', 'TEAM-REALESTATE-BETA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- Initial Demo Leads for Real Estate
INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id)
VALUES
  ('FV-4001', 'real_estate', 'Ananya Deshmukh', 'ananya.d@luxuryestates.demo', '+91 98765 70001', 'en', 'Luxury Residential Mandate', 'HNI Referral', 'new', 'EMP-026', 'TEAM-REALESTATE-ALPHA'),
  ('FV-4002', 'real_estate', 'Rajesh Goenka', 'rajesh.g@capitalgroup.demo', '+91 98765 70002', 'en', 'Commercial Office Space', 'Direct Inbound', 'requirement', 'EMP-026', 'TEAM-REALESTATE-ALPHA'),
  ('FV-4003', 'real_estate', 'Sunita Menon', 'sunita.m@investments.demo', '+91 98765 70003', 'hi', 'Plotted Development & Villas', 'Developer Campaign', 'site-visit', NULL, 'TEAM-REALESTATE-ALPHA')
ON CONFLICT (id) DO NOTHING;

-- Initial task for Sameer Kulkarni on FV-4001
INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
VALUES
  ('TSK-RE-001', 'FV-4001', 'EMP-026', 'voice-call', 'Schedule site inspection for Worli Sea-Face penthouse mandate', now() + interval '2 hours', 'high', 'open')
ON CONFLICT (id) DO NOTHING;

-- Regional Target for REGION-REALESTATE-WEST
INSERT INTO regional_targets (
  id, rm_employee_id, region_id, period_label, metric, approved_nm_target,
  unallocated_remainder, status, version
) VALUES (
  'RT-RE-OCT-2026', 'EMP-029', 'REGION-REALESTATE-WEST', 'October', 'approved-wins',
  100, 0, 'published', 1
) ON CONFLICT (region_id, period_label, metric, version) DO NOTHING;

-- National Target for Real Estate
INSERT INTO national_targets (
  id, nm_employee_id, vertical, period_label, metric, approved_ceo_target,
  unallocated_remainder, regional_allocations, status, version
) VALUES (
  'NT-RE-OCT-2026', 'EMP-030', 'real_estate', 'October', 'approved-wins',
  200, 100,
  '[{"regionId": "REGION-REALESTATE-WEST", "regionName": "Real Estate Advisory West Zone", "targetWins": 100}]'::jsonb,
  'published', 1
) ON CONFLICT (vertical, period_label, metric, version) DO NOTHING;

-- Inbound Cross-Vertical Referral (from Wealth to Real Estate)
INSERT INTO cross_vertical_referrals (
  id, referral_code, source_vertical, receiving_vertical, prospect_name,
  prospect_contact, customer_consent_evidence, commercial_context, decision
) VALUES (
  'REF-RE-001', 'REF-WLTH-108', 'wealth', 'real_estate', 'Shalini Gupta',
  '+91 98220 77889', 'Signed wealth client real estate advisory consent letter',
  'Family office allocating INR 25 Cr into pre-leased Grade-A commercial office space in BKC.',
  'pending'
) ON CONFLICT (id) DO NOTHING;

-- Baseline Product Rule Proposal for Real Estate
INSERT INTO product_rule_proposals (
  id, nm_employee_id, vertical, rule_name, current_version, proposed_version,
  reason, effective_date, affected_products, preview_impact, status
) VALUES (
  'PRP-RE-001', 'EMP-030', 'real_estate', 'Escrow Downpayment & RERA Title Verification SLA',
  '1.0', '2.0',
  'Standardize 72h builder token receipt and RERA carpet area certification prior to sale agreement execution',
  CURRENT_DATE + interval '30 days', '["Luxury Residential Mandate", "Commercial Office Space"]'::jsonb,
  'Eliminates legal title delays and accelerates brokerage settlement cycle by 14 days', 'submitted'
) ON CONFLICT (id) DO NOTHING;

-- Baseline Strategic National Escalation for Real Estate
INSERT INTO national_escalations (
  id, nm_employee_id, vertical, category, target_executive, title, detail,
  decision_deadline, status
) VALUES (
  'NESC-RE-001', 'EMP-030', 'real_estate', 'governance_risk', 'CEO',
  'South Mumbai Heritage Conservation Zone Title Verification Bottleneck',
  'BMC heritage zoning clearance bottleneck on landmark commercial mandates exceeding INR 50 Cr; requires executive legal arbitration',
  now() + interval '5 days', 'open'
) ON CONFLICT (id) DO NOTHING;
