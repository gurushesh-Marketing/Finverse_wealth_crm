-- Migration 0030 — Markets & Securities Regional Manager (RM-01..RM-10) fixtures
-- Provisions REGION-MARKETS-WEST, Rajesh Bansal (EMP-024, Regional Manager),
-- team region linkage, and baseline regional targets for Markets & Securities.

INSERT INTO regions (id, name, vertical)
VALUES ('REGION-MARKETS-WEST', 'Markets & Securities West Zone', 'markets')
ON CONFLICT (id) DO NOTHING;

-- Link Markets teams to REGION-MARKETS-WEST
UPDATE teams SET region_id = 'REGION-MARKETS-WEST'
WHERE id IN ('TEAM-MARKETS-ALPHA', 'TEAM-MARKETS-BETA');

-- Seed Rajesh Bansal (EMP-024, Markets Regional Manager)
-- Reuses active demo scrypt hash from existing demo employee
INSERT INTO employees (id, email, password_hash, display_name, status)
SELECT 'EMP-024', 'rajesh.b@finverse.demo', password_hash, 'Rajesh Bansal', 'active'
FROM employees WHERE email = 'manish@finverse.demo' LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Assignments for Rajesh Bansal (RM on Markets Alpha & Beta)
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-MKT-RM-A', 'EMP-024', 'RM', 'markets', 'TEAM-MARKETS-ALPHA', CURRENT_DATE, NULL),
  ('ASG-MKT-RM-B', 'EMP-024', 'RM', 'markets', 'TEAM-MARKETS-BETA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO NOTHING;

-- Initial Regional Target for Markets & Securities West Zone
INSERT INTO regional_targets (id, rm_employee_id, region_id, period_label, metric, approved_nm_target, unallocated_remainder, status, version)
VALUES ('RT-MKT-OCT-2026', 'EMP-024', 'REGION-MARKETS-WEST', 'October', 'approved-wins', 200, 0, 'published', 1)
ON CONFLICT (region_id, period_label, metric, version) DO NOTHING;
