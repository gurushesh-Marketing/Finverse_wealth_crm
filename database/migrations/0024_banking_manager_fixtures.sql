-- Migration 0024 — Commercial Banking Manager (MG-01..MG-13) fixtures
-- Provisions TEAM-BANKING-BETA, Kunal Shah (Manager), Priya Sen (Team Lead Beta),
-- assignments and demo leads for Banking cross-team transfers and capacity analysis.

INSERT INTO teams (id, name, vertical)
VALUES ('TEAM-BANKING-BETA', 'Banking Beta', 'banking')
ON CONFLICT (id) DO NOTHING;

-- Seed Kunal Shah (EMP-017, Banking Manager) and Priya Sen (EMP-018, Banking TL Beta)
-- Reuses active demo scrypt hash from existing demo employee
INSERT INTO employees (id, email, password_hash, display_name, status)
SELECT 'EMP-017', 'kunal@finverse.demo', password_hash, 'Kunal Shah', 'active'
FROM employees LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO employees (id, email, password_hash, display_name, status)
SELECT 'EMP-018', 'priyas@finverse.demo', password_hash, 'Priya Sen', 'active'
FROM employees LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Assignments for Kunal Shah (MG on Banking Alpha & Beta)
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-BANK-MG-A', 'EMP-017', 'MG', 'banking', 'TEAM-BANKING-ALPHA', CURRENT_DATE, NULL),
  ('ASG-BANK-MG-B', 'EMP-017', 'MG', 'banking', 'TEAM-BANKING-BETA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- Assignment for Priya Sen (TL on Banking Beta)
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-BANK-TL-002', 'EMP-018', 'TL', 'banking', 'TEAM-BANKING-BETA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- Baseline demo leads in Banking Beta for cross-team transfer (MG-03) and capacity testing (MG-04)
INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id)
VALUES
  ('FV-2003', 'banking', 'Finverse Commercial Logistics Ltd', 'finance@logistics.demo', '+91 98765 40020', 'en', 'Working Capital Facility', 'Branch Intake', 'eligibility', NULL, 'TEAM-BANKING-BETA'),
  ('FV-2004', 'banking', 'Zenith Infrastructure Pvt Ltd', 'treasury@zenith.demo', '+91 98765 40021', 'en', 'Corporate Term Loan', 'Branch Intake', 'documents', NULL, 'TEAM-BANKING-BETA')
ON CONFLICT (id) DO NOTHING;
