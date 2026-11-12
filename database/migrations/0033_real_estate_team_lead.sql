-- Migration 0033 — Real Estate Advisory Team Lead Fixtures & Hierarchy (Deck P037, P039)
-- Assigns / verifies Neha Gupta (EMP-027) as Team Leader for TEAM-REALESTATE-ALPHA in vertical 'real_estate'.
-- Ensures baseline supervisory team target for Real Estate Alpha.

-- Seed supervisory team targets for Real Estate Alpha
INSERT INTO team_targets (id, team_id, period_label, metric, parent_value, status, version, closed, created_by)
VALUES ('TT-RE-ALPHA-2026-10', 'TEAM-REALESTATE-ALPHA', '2026-10', 'approved-wins', 40, 'published', 1, false, 'EMP-027')
ON CONFLICT (id) DO NOTHING;
