-- 0014_ensure_bootstrap_fixtures.sql
-- Forward migration ensuring baseline reference teams exist idempotently across existing and clean databases.

INSERT INTO teams (id, name, vertical)
VALUES
  ('TEAM-WEALTH-ALPHA', 'Wealth Alpha', 'wealth'),
  ('TEAM-WEALTH-BETA', 'Wealth Beta', 'wealth'),
  ('TEAM-BANKING-ALPHA', 'Banking Alpha', 'banking'),
  ('TEAM-WEALTH-GAMMA', 'Wealth Gamma', 'wealth')
ON CONFLICT (id) DO NOTHING;
