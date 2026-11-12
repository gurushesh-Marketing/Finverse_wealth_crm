import { createHash } from 'node:crypto';
import type { Role, Vertical, WorkspaceSession } from '@finverse/contracts';
import { pool } from './db';

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
  REL: [
    'prospect.read',
    'prospect.update',
    'activity.read',
    'activity.create',
    'task.manage',
    'task.read',
    'followup.create',
    'report.read:personal',
    'report.read:team',
    'deal.read',
    'deal.update',
    'document.request',
    'document.read',
    'handoff.decide',
    'partner.coordinate',
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
  DE: [
    'intake.record:create',
    'intake.record:read',
  ],
  HR: [
    'hr.overview:read',
    'hr.employee:request',
    'hr.transfer:request',
    'hr.promotion:request',
    'hr.exit:coordinate',
    'hr.availability:manage',
    'hr.training_review:manage',
    'hr.report_pack:prepare',
    'hr.request:read',
  ],
  SA: [
    'superadmin.overview:read',
    'user.account:provision',
    'scope.grant:manage',
    'organisation.hierarchy:manage',
    'lifecycle.transition:activate',
    'offboarding.access:revoke',
    'user.recovery:reset',
    'business_config.publish:manage',
    'audit.investigate:manage',
    'job.recover:manage',
    'access.delegation:review',
  ],
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
  must_change_password?: boolean;
  username?: string | null;
}

const SELECT_COLUMNS = `
  SELECT e.id, e.email, e.display_name, e.status, e.password_hash,
         COALESCE(e.must_change_password, false) as must_change_password, e.username,
         a.id AS assignment_id, a.role, a.vertical, a.team_id,
         to_char(a.effective_from, 'YYYY-MM-DD') AS effective_from
  FROM employees e
  JOIN assignments a ON a.employee_id = e.id
`;
const WHERE_ACTIVE = `WHERE e.status = 'active' AND a.effective_from <= CURRENT_DATE AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)`;
const ORDER_ASSIGNMENTS = `ORDER BY a.effective_from DESC, a.id DESC`;
const SELECT_BY_EMAIL = `${SELECT_COLUMNS} ${WHERE_ACTIVE} AND (lower(e.email) = lower($1) OR lower(COALESCE(e.username, '')) = lower($1) OR lower(e.id) = lower($1)) ${ORDER_ASSIGNMENTS}`;
const SELECT_BY_ID = `${SELECT_COLUMNS} ${WHERE_ACTIVE} AND e.id = $1 ${ORDER_ASSIGNMENTS}`;


async function buildContext(rows: EmployeeRow[]): Promise<AuthContext> {
  const latest = rows[0]!;
  const role = latest.role as Role;
  const roleRows = rows.filter((r) => r.role === latest.role);
  // Grants are resolved consistently from the active role's assignments.
  // A different-role assignment must not silently expand the selected role's permissions or verticals.
  const verticals = [...new Set(roleRows.map((r) => r.vertical))] as Vertical[];
  const teams = [...new Set(roleRows.map((r) => r.team_id))];
  const effectiveFrom = roleRows.map((r) => r.effective_from).sort()[0]!;

  // 1. Hierarchy-driven scope expansion (SA-04)
  // Leaders inherit supervised units/verticals from active reporting hierarchy nodes
  try {
    const { rows: hierRows } = await pool.query<{ vertical: string; unit_name: string }>(
      `WITH RECURSIVE hier AS (
         SELECT id, unit_name, vertical, leader_employee_id, parent_node_id
         FROM reporting_hierarchy_nodes
         WHERE leader_employee_id = $1 AND status = 'active'
         UNION ALL
         SELECT c.id, c.unit_name, c.vertical, c.leader_employee_id, c.parent_node_id
         FROM reporting_hierarchy_nodes c
         JOIN hier p ON c.parent_node_id = p.id
         WHERE c.status = 'active'
       )
       SELECT DISTINCT vertical, unit_name FROM hier`,
      [latest.id]
    );
    for (const h of hierRows) {
      if (h.vertical && !verticals.includes(h.vertical as Vertical)) {
        verticals.push(h.vertical as Vertical);
      }
    }
  } catch {
    /* table may not exist in early tests */
  }

  // 2. Active Temporary Access Grants (SA-11)
  // Bounded grants expand role actions, teams, and verticals until expiry/revocation
  const tempActions: string[] = [];
  try {
    const { rows: tempGrants } = await pool.query<{
      id: string;
      target_role: string;
      target_vertical: string;
      target_team_id: string | null;
      expires_at: string;
    }>(
      `SELECT id, target_role, target_vertical, target_team_id, expires_at
       FROM temporary_access_grants
       WHERE employee_id = $1
         AND status IN ('active', 'renewed')
         AND expires_at > NOW()`,
      [latest.id]
    );
    for (const g of tempGrants) {
      if (g.target_vertical && !verticals.includes(g.target_vertical as Vertical)) {
        verticals.push(g.target_vertical as Vertical);
      }
      if (g.target_team_id && !teams.includes(g.target_team_id)) {
        teams.push(g.target_team_id);
      }
      const roleActs = ROLE_ACTIONS[g.target_role as Role] || [];
      tempActions.push(...roleActs);
    }
  } catch {
    /* table may not exist in early tests */
  }

  const combinedActions = [...new Set([...(ROLE_ACTIONS[role] ?? []), ...tempActions])];

  const permissionVersion =
    'pv-' +
    createHash('sha1')
      .update(roleRows.map((r) => r.assignment_id).sort().join(',') + ':' + teams.sort().join(','))
      .digest('hex')
      .slice(0, 8);

  const session: WorkspaceSession = {
    employeeId: latest.id,
    displayName: latest.display_name,
    role,
    activeAssignmentId: latest.assignment_id,
    verticalGrants: verticals,
    teamGrants: teams,
    allowedActions: combinedActions,
    effectiveFrom,
    permissionVersion,
    mustChangePassword: Boolean(latest.must_change_password),
    username: latest.username ?? undefined,
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
  const { rows } = await pool.query<EmployeeRow>(SELECT_BY_EMAIL, [email]);
  if (rows.length === 0) return null;
  return buildContext(rows);
}

export async function loadAuthContextByEmployeeId(employeeId: string): Promise<AuthContext | null> {
  const { rows } = await pool.query<EmployeeRow>(SELECT_BY_ID, [employeeId]);
  if (rows.length === 0) return null;
  return buildContext(rows);
}
