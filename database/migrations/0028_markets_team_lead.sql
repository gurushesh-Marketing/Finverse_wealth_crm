-- Migration 0028 — Markets & Securities Team Lead Fixtures & Hierarchy (Deck P037, P039)
-- Assigns Meera Nair (EMP-005) as Team Leader for TEAM-MARKETS-ALPHA in vertical 'markets'.
-- Ensures baseline unassigned lead and supervisory targets.

-- Close prior Wealth Gamma assignment if active, to maintain strict scope
UPDATE assignments
SET effective_to = CURRENT_DATE
WHERE employee_id = 'EMP-005' AND id = 'ASG-WEALTH-005' AND effective_to IS NULL;

-- Provision Markets Team Lead assignment for Meera Nair
INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES ('ASG-MKT-TL-001', 'EMP-005', 'TL', 'markets', 'TEAM-MARKETS-ALPHA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO UPDATE SET vertical = 'markets', team_id = 'TEAM-MARKETS-ALPHA', effective_to = NULL;

-- Seed supervisory team targets for Markets Alpha
INSERT INTO team_targets (id, team_id, period_label, metric, parent_value, status, version, closed, created_by)
VALUES ('TT-MKT-ALPHA-2026-10', 'TEAM-MARKETS-ALPHA', '2026-10', 'approved-wins', 50, 'published', 1, false, 'EMP-005')
ON CONFLICT (id) DO NOTHING;
