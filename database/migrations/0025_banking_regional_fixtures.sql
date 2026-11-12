-- Migration 0025 — Commercial Banking Regional Manager (RM-01..RM-10) fixtures
-- Provisions REGION-BANKING-WEST, Arjun Mehta (EMP-019, Regional Manager),
-- team region linkage, and baseline regional targets for Commercial Banking.

INSERT INTO regions (id, name, vertical)
VALUES ('REGION-BANKING-WEST', 'Commercial Banking West Zone', 'banking')
ON CONFLICT (id) DO NOTHING;

-- Link Banking teams to REGION-BANKING-WEST
UPDATE teams SET region_id = 'REGION-BANKING-WEST'
WHERE id IN ('TEAM-BANKING-ALPHA', 'TEAM-BANKING-BETA');

-- Seed Arjun Mehta (EMP-019, Banking Regional Manager)
-- Reuses active demo scrypt hash from existing demo employee
INSERT INTO employees (id, email, password_hash, display_name, status)
SELECT 'EMP-019', 'arjun@finverse.demo', password_hash, 'Arjun Mehta', 'active'
FROM employees WHERE email = 'kunal@finverse.demo' LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Assignments for Arjun Mehta (RM on Banking Alpha & Beta)
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-BANK-RM-A', 'EMP-019', 'RM', 'banking', 'TEAM-BANKING-ALPHA', CURRENT_DATE, NULL),
  ('ASG-BANK-RM-B', 'EMP-019', 'RM', 'banking', 'TEAM-BANKING-BETA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- Initial Regional Target for Commercial Banking West Zone
INSERT INTO regional_targets (id, rm_employee_id, region_id, period_label, metric, approved_nm_target, unallocated_remainder, status, version)
VALUES ('RT-BANK-OCT-2026', 'EMP-019', 'REGION-BANKING-WEST', 'October', 'approved-wins', 150, 0, 'published', 1)
ON CONFLICT (region_id, period_label, metric, version) DO NOTHING;
