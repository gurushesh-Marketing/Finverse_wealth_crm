-- Migration 0034 — Commercial Banking Team Lead Fixtures & Hierarchy (Deck P037, P039)
-- Assigns / verifies Rohan Sen (EMP-016) as Team Leader for TEAM-BANKING-ALPHA in vertical 'banking'.
-- Ensures baseline supervisory team target for Banking Alpha.

-- Seed supervisory team targets for Banking Alpha
INSERT INTO team_targets (id, team_id, period_label, metric, parent_value, status, version, closed, created_by)
VALUES ('TT-BANK-ALPHA-2026-10', 'TEAM-BANKING-ALPHA', '2026-10', 'approved-wins', 40, 'published', 1, false, 'EMP-016')
ON CONFLICT (id) DO NOTHING;
