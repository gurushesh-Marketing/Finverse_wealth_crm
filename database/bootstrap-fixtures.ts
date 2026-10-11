import type { Pool, PoolClient } from 'pg';

export interface BootstrapTeam {
  id: string;
  name: string;
  vertical: string;
}

/**
 * Foundational reference fixtures required by relational foreign-key integrity.
 * These are distinct from demo business data (leads, events, tasks).
 */
export const BOOTSTRAP_TEAMS: BootstrapTeam[] = [
  { id: 'TEAM-WEALTH-ALPHA', name: 'Wealth Alpha', vertical: 'wealth' },
  { id: 'TEAM-WEALTH-BETA', name: 'Wealth Beta', vertical: 'wealth' },
  { id: 'TEAM-BANKING-ALPHA', name: 'Banking Alpha', vertical: 'banking' },
  { id: 'TEAM-WEALTH-GAMMA', name: 'Wealth Gamma', vertical: 'wealth' },
];

/**
 * Ensures system baseline reference fixtures exist in the database without
 * altering applied migration history, resetting databases, or overwriting
 * existing business data.
 */
export async function ensureBootstrapFixtures(client: Pool | PoolClient): Promise<void> {
  const { rows } = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'teams'
     ) as exists`
  );
  if (!rows[0]?.exists) return;

  for (const team of BOOTSTRAP_TEAMS) {
    await client.query(
      `INSERT INTO teams (id, name, vertical)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [team.id, team.name, team.vertical]
    );
  }
}
