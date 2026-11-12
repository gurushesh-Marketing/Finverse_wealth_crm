import { pool } from '../repo/db';

export interface CallerCallingIdentityRecord {
  employeeId: string;
  callingIdentity: string;
  providerAgentId: string | null;
  isActive: boolean;
  updatedAt: string;
}

/**
 * Resolves the approved outbound calling identity for a sales caller.
 * Strictly restricted to server-side telephony modules.
 * Returns null if the caller does not have an approved calling identity configured.
 */
export async function getApprovedCallingIdentity(employeeId: string): Promise<string | null> {
  const { rows } = await pool.query<{ calling_identity: string }>(
    `SELECT calling_identity FROM caller_calling_identities
     WHERE employee_id = $1 AND is_active = TRUE`,
    [employeeId]
  );
  return rows[0]?.calling_identity ?? null;
}

/**
 * Internal helper to inspect caller calling identity details (for admin/audit).
 */
export async function getCallerIdentityRecord(employeeId: string): Promise<CallerCallingIdentityRecord | null> {
  const { rows } = await pool.query<{
    employee_id: string;
    calling_identity: string;
    provider_agent_id: string | null;
    is_active: boolean;
    updated_at: Date;
  }>(
    `SELECT employee_id, calling_identity, provider_agent_id, is_active, updated_at
     FROM caller_calling_identities
     WHERE employee_id = $1`,
    [employeeId]
  );
  if (!rows[0]) return null;
  return {
    employeeId: rows[0].employee_id,
    callingIdentity: rows[0].calling_identity,
    providerAgentId: rows[0].provider_agent_id,
    isActive: rows[0].is_active,
    updatedAt: rows[0].updated_at.toISOString(),
  };
}
