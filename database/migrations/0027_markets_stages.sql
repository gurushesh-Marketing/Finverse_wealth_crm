-- Migration 0027 — Markets & Securities Vertical Stages & Frontline Fixtures (Deck P005, P038)
-- Expands leads_stage_check to support Markets & Securities stages:
-- 'kyc', 'risk-profile', 'demat-opened', 'active-funded' alongside existing stages.
-- Provisions TEAM-MARKETS-ALPHA, Kabir Joshi (SC, EMP-021), assignments, and initial demo leads.

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
    'active-funded'
  )
);

-- Team Markets Alpha
INSERT INTO teams (id, name, vertical)
VALUES ('TEAM-MARKETS-ALPHA', 'Markets Alpha', 'markets')
ON CONFLICT (id) DO NOTHING;

-- Seed Kabir Joshi (EMP-021, Markets Sales Caller)
-- Reuses active demo scrypt hash from existing demo employee
INSERT INTO employees (id, email, password_hash, display_name, status)
SELECT 'EMP-021', 'kabir@finverse.demo', password_hash, 'Kabir Joshi', 'active'
FROM employees WHERE email = 'asha@finverse.demo' LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Assignment for Kabir Joshi (SC on Markets Alpha)
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-MKT-SC-001', 'EMP-021', 'SC', 'markets', 'TEAM-MARKETS-ALPHA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- Initial Demo Leads for Markets Alpha
INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id)
VALUES
  ('FV-3001', 'markets', 'Rohan Verma', 'rohan.verma@trading.demo', '+91 98765 60001', 'en', 'Equity Delivery & Intraday', 'Trading App Direct', 'new', 'EMP-021', 'TEAM-MARKETS-ALPHA'),
  ('FV-3002', 'markets', 'Priya Kulkarni', 'priya.k@finverse.demo', '+91 98765 60002', 'en', 'F&O Derivatives', 'Trading App Direct', 'kyc', 'EMP-021', 'TEAM-MARKETS-ALPHA'),
  ('FV-3003', 'markets', 'Aakash Singhal', 'aakash.s@investor.demo', '+91 98765 60003', 'hi', 'Direct Mutual Funds', 'Website', 'new', NULL, 'TEAM-MARKETS-ALPHA')
ON CONFLICT (id) DO NOTHING;

-- Initial task for Kabir Joshi on FV-3001
INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
VALUES
  ('TSK-MKT-001', 'FV-3001', 'EMP-021', 'voice-call', 'Verify Aadhaar OTP & complete SEBI KYC verification', now() + interval '2 hours', 'high', 'open')
ON CONFLICT (id) DO NOTHING;
