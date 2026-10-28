-- Migration 0042: Add active Data Entry grants for Markets and Real Estate for demo operator Deepa Patel (EMP-015)
-- Ensures existing local database receives those grants without resetting or reseeding customer/prospect records.

INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
VALUES
  ('ASG-DE-M', 'EMP-015', 'DE', 'markets', 'TEAM-MARKETS-ALPHA', CURRENT_DATE, NULL),
  ('ASG-DE-RE', 'EMP-015', 'DE', 'real_estate', 'TEAM-REALESTATE-ALPHA', CURRENT_DATE, NULL)
ON CONFLICT (id) DO UPDATE SET
  vertical = EXCLUDED.vertical,
  team_id = EXCLUDED.team_id,
  effective_from = EXCLUDED.effective_from,
  effective_to = NULL;
