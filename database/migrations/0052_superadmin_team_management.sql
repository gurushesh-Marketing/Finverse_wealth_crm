-- Migration: 0052_superadmin_team_management.sql
-- Super Admin Dynamic Team Management, Relationship Manager Assignment & Status Governance

-- 1. Extend teams table with supervising Relationship Manager, status, and audit timestamps
ALTER TABLE teams ADD COLUMN IF NOT EXISTS relationship_manager_id TEXT REFERENCES employees(id);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'));
ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE teams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Indexes for fast vertical and status filtering
CREATE INDEX IF NOT EXISTS idx_teams_vertical_status ON teams(vertical, status);
CREATE INDEX IF NOT EXISTS idx_teams_rel_mgr ON teams(relationship_manager_id) WHERE relationship_manager_id IS NOT NULL;

-- 3. Backfill existing baseline teams with their designated Relationship Managers
UPDATE teams SET relationship_manager_id = 'EMP-003', updated_at = NOW() WHERE id IN ('TEAM-WEALTH-ALPHA', 'TEAM-WEALTH-BETA', 'TEAM-WEALTH-GAMMA') AND relationship_manager_id IS NULL;
UPDATE teams SET relationship_manager_id = 'EMP-016', updated_at = NOW() WHERE id = 'TEAM-BANKING-ALPHA' AND relationship_manager_id IS NULL;
UPDATE teams SET relationship_manager_id = 'EMP-018', updated_at = NOW() WHERE id = 'TEAM-BANKING-BETA' AND relationship_manager_id IS NULL;
UPDATE teams SET relationship_manager_id = 'EMP-005', updated_at = NOW() WHERE id = 'TEAM-MARKETS-ALPHA' AND relationship_manager_id IS NULL;
UPDATE teams SET relationship_manager_id = 'EMP-023', updated_at = NOW() WHERE id = 'TEAM-MARKETS-BETA' AND relationship_manager_id IS NULL;
UPDATE teams SET relationship_manager_id = 'EMP-027', updated_at = NOW() WHERE id = 'TEAM-REALESTATE-ALPHA' AND relationship_manager_id IS NULL;
UPDATE teams SET relationship_manager_id = 'EMP-032', updated_at = NOW() WHERE id = 'TEAM-REALESTATE-BETA' AND relationship_manager_id IS NULL;
