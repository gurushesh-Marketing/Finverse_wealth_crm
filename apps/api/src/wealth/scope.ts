import { pool } from '../repo/db';
import type { Scope } from '../repo/users';
import { forbidden, notFound } from '../lib/errors';

// Single source of truth for wealth-surface scope, mirroring the R1-approved core:
// SC -> owner only; TL -> own leads OR granted teams; every other role -> no lead access.
export function readScopeSql(scope: Scope, params: unknown[], alias = 'l'): string {
  params.push(scope.verticals);
  const verticalIdx = params.length;
  let ownerSql = 'FALSE';
  if (scope.role === 'SC') {
    params.push(scope.employeeId);
    ownerSql = `${alias}.owner_employee_id = $${params.length}`;
  } else if (scope.role === 'TL') {
    params.push(scope.employeeId);
    const meIdx = params.length;
    params.push(scope.teams);
    ownerSql = `(${alias}.owner_employee_id = $${meIdx} OR ${alias}.team_id = ANY($${params.length}))`;
  }
  return `${alias}.vertical = ANY($${verticalIdx}) AND ${ownerSql}`;
}

export interface ScopedLead {
  id: string;
  owner_employee_id: string | null;
  team_id: string | null;
  vertical: string;
  stage: string;
  display_name: string;
  phone: string;
  email: string | null;
  preferred_language: string;
  record_version: number;
}

export async function requireLeadForRead(scope: Scope, leadId: string): Promise<ScopedLead> {
  const params: unknown[] = [leadId];
  const where = readScopeSql(scope, params);
  const { rows } = await pool.query<ScopedLead>(`SELECT l.* FROM leads l WHERE l.id = $1 AND ${where}`, params);
  if (!rows[0]) throw notFound();
  return rows[0];
}

export async function requireLeadForWrite(scope: Scope, leadId: string): Promise<ScopedLead> {
  const lead = await requireLeadForRead(scope, leadId);
  if (scope.role !== 'SC') {
    throw forbidden('Only sales callers can perform caller actions on prospects.');
  }
  if (lead.owner_employee_id !== scope.employeeId) {
    throw forbidden('Only the current owner can change this record.');
  }
  return lead;
}

// Event-time attribution snapshots: team comes from the acted-on lead's team,
// assignment matches that team where the employee has one.
export function attributionFor(scope: Scope, teamId: string | null): [string, string | null, string | null] {
  return [scope.role, teamId ?? scope.teams[0] ?? null, scope.assignmentId];
}
