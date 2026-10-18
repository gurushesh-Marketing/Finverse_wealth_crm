-- Migration 0029 — Markets & Securities Manager (MG-01..MG-13) fixtures
-- Provisions TEAM-MARKETS-BETA, Manish Vyas (Manager), Tarun Sen (Team Lead Beta),
-- assignments and demo leads for Markets cross-team transfers and capacity analysis.

INSERT INTO teams (id, name, vertical)
VALUES ('TEAM-MARKETS-BETA', 'Markets Beta', 'markets')
ON CONFLICT (id) DO NOTHING;

-- Seed Manish Vyas (EMP-022, Markets Manager) and Tarun Sen (EMP-023, Markets TL Beta)
-- Reuses active demo scrypt hash from existing demo employee
INSERT INTO employees (id, email, password_hash, display_name, status)
SELECT 'EMP-022', 'manish@finverse.demo', password_hash, 'Manish Vyas', 'active'
FROM employees WHERE email = 'meera@finverse.demo' LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO employees (id, email, password_hash, display_name, status)
SELECT 'EMP-023', 'tarun@finverse.demo', password_hash, 'Tarun Sen', 'active'
FROM employees WHERE email = 'meera@finverse.demo' LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Assignments for Manish Vyas (MG on Markets Alpha & Beta)
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-MKT-MG-A', 'EMP-022', 'MG', 'markets', 'TEAM-MARKETS-ALPHA', CURRENT_DATE, NULL),
  ('ASG-MKT-MG-B', 'EMP-022', 'MG', 'markets', 'TEAM-MARKETS-BETA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- Assignment for Tarun Sen (TL on Markets Beta)
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-MKT-TL-002', 'EMP-023', 'TL', 'markets', 'TEAM-MARKETS-BETA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- Target seeds for Markets Beta team
INSERT INTO team_targets (id, team_id, period_label, metric, parent_value, status, version, closed, created_by)
VALUES
  ('TT-MKT-BETA-2026-10', 'TEAM-MARKETS-BETA', '2026-10', 'approved-wins', 40, 'published', 1, false, 'EMP-022')
ON CONFLICT (id) DO NOTHING;

-- Baseline demo leads in Markets Beta for cross-team transfer (MG-03) and capacity testing (MG-04)
INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id)
VALUES
  ('FV-3003', 'markets', 'Aditya Birla Direct Mutual Account', 'aditya@trading.demo', '+91 98765 88003', 'en', 'Direct Mutual Funds', 'Trading App Direct', 'kyc', NULL, 'TEAM-MARKETS-BETA'),
  ('FV-3004', 'markets', 'Kavita Chawla F&O Trading Portfolio', 'kavita@derivatives.demo', '+91 98765 88004', 'hi', 'F&O Derivatives', 'Sub-broker Network', 'risk-profile', NULL, 'TEAM-MARKETS-BETA')
ON CONFLICT (id) DO NOTHING;
