-- Migration 0053 — Super Admin Full 4-Vertical Grants (SA-01..SA-11)
-- Fixes root cause: Super Admin (EMP-013) had assignments only for 'wealth' and 'banking',
-- omitting 'markets' and 'real_estate'. Grants active assignments across all 4 verticals
-- with associated frontline Alpha teams.

INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-SA-W', 'EMP-013', 'SA', 'wealth', 'TEAM-WEALTH-ALPHA', CURRENT_DATE, NULL),
  ('ASG-SA-B', 'EMP-013', 'SA', 'banking', 'TEAM-BANKING-ALPHA', CURRENT_DATE, NULL),
  ('ASG-SA-M', 'EMP-013', 'SA', 'markets', 'TEAM-MARKETS-ALPHA', CURRENT_DATE, NULL),
  ('ASG-SA-RE', 'EMP-013', 'SA', 'real_estate', 'TEAM-REALESTATE-ALPHA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO UPDATE SET
  employee_id = EXCLUDED.employee_id,
  role = EXCLUDED.role,
  vertical = EXCLUDED.vertical,
  team_id = EXCLUDED.team_id,
  effective_to = NULL;
