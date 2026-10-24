import { eq, and, or, inArray, sql } from 'drizzle-orm';
import { db } from '../repo/db';
import { leads } from '../db/schema';
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

export function readScopeCondition(scope: Scope) {
  let ownerCond = sql`FALSE`;
  if (scope.role === 'SC') {
    ownerCond = eq(leads.ownerEmployeeId, scope.employeeId);
  } else if (scope.role === 'TL') {
    ownerCond = or(
      eq(leads.ownerEmployeeId, scope.employeeId),
      inArray(leads.teamId, scope.teams)
    )!;
  }
  return and(inArray(leads.vertical, scope.verticals), ownerCond);
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
  const [row] = await db
    .select({
      id: leads.id,
      owner_employee_id: leads.ownerEmployeeId,
      team_id: leads.teamId,
      vertical: leads.vertical,
      stage: leads.stage,
      display_name: leads.displayName,
      phone: leads.phone,
      email: leads.email,
      preferred_language: leads.preferredLanguage,
      record_version: leads.recordVersion,
    })
    .from(leads)
    .where(and(eq(leads.id, leadId), readScopeCondition(scope)));

  if (!row) throw notFound();
  return row as ScopedLead;
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
