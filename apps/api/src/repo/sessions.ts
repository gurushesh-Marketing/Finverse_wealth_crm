import { pool } from './db';
import { hashToken } from '../lib/session';

export async function createSessionRow(token: string, employeeId: string, ttlSeconds: number): Promise<void> {
  await pool.query(
    `INSERT INTO sessions (token_hash, employee_id, created_at, expires_at, last_seen_at)
     VALUES ($1, $2, now(), now() + make_interval(secs => $3), now())`,
    [hashToken(token), employeeId, ttlSeconds]
  );
}

export async function findSessionEmployeeId(token: string): Promise<string | null> {
  const { rows } = await pool.query<{ employee_id: string }>(
    `DELETE FROM sessions WHERE token_hash = $1 AND expires_at <= now() RETURNING employee_id`,
    [hashToken(token)]
  );
  if (rows.length > 0) return null;
  const { rows: found } = await pool.query<{ employee_id: string }>(
    `UPDATE sessions SET last_seen_at = now()
     WHERE token_hash = $1 AND expires_at > now()
     RETURNING employee_id`,
    [hashToken(token)]
  );
  return found[0]?.employee_id ?? null;
}

export async function deleteSessionRow(token: string): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}
