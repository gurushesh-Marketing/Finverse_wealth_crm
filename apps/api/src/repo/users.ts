import { createHash } from 'node:crypto';
import type { Role, Vertical, WorkspaceSession } from '@finverse/contracts';

export interface Scope {
  employeeId: string;
  displayName: string;
  role: Role;
  assignmentId: string;
  verticals: string[];
  teams: string[];
}

export interface AuthContext {
  employeeId: string;
  displayName: string;
  passwordHash: string;
  session: WorkspaceSession;
  scope: Scope;
}

const ROLE_ACTIONS: Record<Role, string[]> = {
  SC: [
    'prospect.read',
    'prospect.update',
    'activity.read',
    'activity.create',
    'task.manage',
    'task.read',
    'followup.create',
    'report.read:personal',
    'deal.read',
    'deal.update',
    'document.request',
    'document.read',
    'review.acknowledge',
  ],
  TL: [
    'prospect.read',
    'prospect.update',
    'activity.read',
    'activity.create',
    'task.manage',
    'task.read',
    'task.assign',
    'followup.create',
    'report.read:personal',
    'report.read:team',
    'lead.read:team',
    'deal.read',
    'deal.update',
    'document.request',
    'document.read',
    'review.acknowledge',
  ],
  MG: [
    'report.read:manager',
    'management.action:manage',
    'lead.transfer:manage',
    'capacity.plan:manage',
    'target.allocate:manage',
    'forecast.review:manage',
    'forecast.submit:manage',
    'exception.resolve:manage',
    'source.remediation:manage',
    'review.manage:tl',
    'lifecycle.request:manage',
    'report.export:manager',
  ],
  RM: [
    'report.read:regional',
    'regional.action:manage',
    'territory.coverage:manage',
    'target.allocate:regional',
    'transfer.approve:regional',
    'staffing.plan:manage',
    'forecast.submit:regional',
    'escalation.resolve:regional',
    'review.manage:manager',
    'report.export:regional',
  ],
  NM: [
    'report.read:national',
    'national.action:manage',
    'target.allocate:national',
    'economics.read:national',
    'product.rule:propose',
    'forecast.submit:national',
    'transfer.manage:cross_region',
    'referral.manage:cross_vertical',
    'escalation.create:national',
    'review.manage:rm',
    'report.export:national',
  ],
  CEO: [
    'report.read:executive',
    'nm.review:executive',
    'target.approve:company',
    'forecast.signoff:company',
    'growth.initiative:manage',
    'conflict.arbitrate:cross_vertical',
    'operating.risk:manage',
    'board.pack:manage',
    'commitment.manage:executive',
  ],
  CFO: [
    'finance.overview:read',
    'sales_handoff.verify:manage',
    'revenue.recognition:manage',
    'invoice.manage:receivable',
    'receipt.match:manage',
    'reconciliation.manage:finance',
    'collection.manage:ar',
    'refund.approve:manage',
    'incentive.review:manage',
    'period.close:manage',
    'budget.review:manage',
    'forecast.concur:manage',
    'finance.pack:export',
    'policy.propose:finance',
  ],
  DE: [],
  HR: [],
  SA: [],
};

interface AssignmentRow {
  assignment_id: string;
  role: string;
  vertical: string;
  team_id: string;
  effective_from: string;
}

interface EmployeeRow extends AssignmentRow {
  id: string;
  email: string;
  display_name: string;
  status: string;
  password_hash: string;
}

import { eq, and, lte, or, isNull, gt, desc, sql } from 'drizzle-orm';
import { db } from './db';
import { employees, assignments } from '../db/schema';

function selectAuthQuery() {
  return db
    .select({
      id: employees.id,
      email: employees.email,
      display_name: employees.displayName,
      status: employees.status,
      password_hash: employees.passwordHash,
      assignment_id: assignments.id,
      role: assignments.role,
      vertical: assignments.vertical,
      team_id: assignments.teamId,
      effective_from: sql<string>`to_char(${assignments.effectiveFrom}, 'YYYY-MM-DD')`,
    })
    .from(employees)
    .innerJoin(assignments, eq(assignments.employeeId, employees.id));
}

function buildContext(rows: EmployeeRow[]): AuthContext {
  const latest = rows[0]!;
  const role = latest.role as Role;
  const roleRows = rows.filter((r) => r.role === latest.role);
  // Grants are resolved consistently from the active role's assignments.
  // A different-role assignment must not silently expand the selected role's permissions or verticals.
  const verticals = [...new Set(roleRows.map((r) => r.vertical))] as Vertical[];
  const teams = [...new Set(roleRows.map((r) => r.team_id))];
  const effectiveFrom = roleRows.map((r) => r.effective_from).sort()[0]!;
  const permissionVersion =
    'pv-' +
    createHash('sha1')
      .update(roleRows.map((r) => r.assignment_id).sort().join(','))
      .digest('hex')
      .slice(0, 8);

  const session: WorkspaceSession = {
    employeeId: latest.id,
    displayName: latest.display_name,
    role,
    activeAssignmentId: latest.assignment_id,
    verticalGrants: verticals,
    teamGrants: teams,
    allowedActions: ROLE_ACTIONS[role] ?? [],
    effectiveFrom,
    permissionVersion,
  };
  return {
    employeeId: latest.id,
    displayName: latest.display_name,
    passwordHash: latest.password_hash,
    session,
    scope: {
      employeeId: latest.id,
      displayName: latest.display_name,
      role,
      assignmentId: latest.assignment_id,
      verticals,
      teams,
    },
  };
}

export async function loadAuthContextByEmail(email: string): Promise<AuthContext | null> {
  const rows = await selectAuthQuery()
    .where(
      and(
        eq(employees.status, 'active'),
        lte(assignments.effectiveFrom, sql`CURRENT_DATE`),
        or(isNull(assignments.effectiveTo), gt(assignments.effectiveTo, sql`CURRENT_DATE`)),
        sql`lower(${employees.email}) = lower(${email})`
      )
    )
    .orderBy(desc(assignments.effectiveFrom), desc(assignments.id));

  if (rows.length === 0) return null;
  return buildContext(rows as EmployeeRow[]);
}

export async function loadAuthContextByEmployeeId(employeeId: string): Promise<AuthContext | null> {
  const rows = await selectAuthQuery()
    .where(
      and(
        eq(employees.status, 'active'),
        lte(assignments.effectiveFrom, sql`CURRENT_DATE`),
        or(isNull(assignments.effectiveTo), gt(assignments.effectiveTo, sql`CURRENT_DATE`)),
        eq(employees.id, employeeId)
      )
    )
    .orderBy(desc(assignments.effectiveFrom), desc(assignments.id));

  if (rows.length === 0) return null;
  return buildContext(rows as EmployeeRow[]);
}
