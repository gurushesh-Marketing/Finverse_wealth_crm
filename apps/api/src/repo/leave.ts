import { Pool, PoolClient } from 'pg';
import { env } from '../config';
import type {
  SubmitLeaveRequestInput,
  DecideLeaveRequestInput,
  ConfigureApproverInput,
  LeaveFilterQuery,
  LeaveRequestRecord,
  LeaveApprovalActionRecord,
  ApproverConfigRecord,
  WorkspaceSession,
} from '@finverse/contracts';

const pool = new Pool({ connectionString: env.DATABASE_URL });

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

export interface SuperiorResolution {
  status: 'ok' | 'blocked';
  approverId?: string;
  approverTitle?: string;
  reason?: string;
}

export async function resolveSuperiorForEmployee(
  employeeId: string,
  clientOrPool: PoolClient | Pool = pool
): Promise<SuperiorResolution> {
  // 1. Direct employee-specific override in approver_configurations
  const empConfigRes = await clientOrPool.query(
    `SELECT * FROM approver_configurations WHERE employee_id = $1 LIMIT 1`,
    [employeeId]
  );
  if (empConfigRes.rows.length > 0) {
    const cfg = empConfigRes.rows[0];
    if (!cfg.is_configured || !cfg.approver_employee_id) {
      return {
        status: 'blocked',
        reason: 'Approver configuration for this employee is explicitly marked unconfigured.',
      };
    }
    if (cfg.approver_employee_id === employeeId) {
      return {
        status: 'blocked',
        reason: 'SELF_APPROVAL_FORBIDDEN: Employee cannot be configured as their own approver.',
      };
    }
    return {
      status: 'ok',
      approverId: cfg.approver_employee_id,
      approverTitle: cfg.approver_title,
    };
  }

  // 2. Fetch employee's active role & team assignment
  const asgRes = await clientOrPool.query(
    `SELECT a.role, a.vertical, a.team_id
     FROM assignments a
     WHERE a.employee_id = $1 AND (a.effective_to IS NULL OR a.effective_to >= CURRENT_DATE)
     ORDER BY a.effective_from DESC LIMIT 1`,
    [employeeId]
  );

  if (asgRes.rows.length === 0) {
    return {
      status: 'blocked',
      reason: 'No active role assignment found for employee.',
    };
  }

  const { role, vertical, team_id: teamId } = asgRes.rows[0];

  // 3. Governance and Executive Roles: must be configured via approver_configurations
  if (['CEO', 'CFO', 'HR', 'SA', 'DE'].includes(role)) {
    const roleConfigRes = await clientOrPool.query(
      `SELECT * FROM approver_configurations
       WHERE role = $1 AND (vertical = $2 OR vertical IS NULL)
       ORDER BY vertical NULLS LAST LIMIT 1`,
      [role, vertical]
    );

    if (roleConfigRes.rows.length === 0 || !roleConfigRes.rows[0].is_configured || !roleConfigRes.rows[0].approver_employee_id) {
      return {
        status: 'blocked',
        reason: `No configured superior for role ${role}. Approver route is blocked until configured.`,
      };
    }

    const cfg = roleConfigRes.rows[0];
    if (cfg.approver_employee_id === employeeId) {
      return {
        status: 'blocked',
        reason: 'SELF_APPROVAL_FORBIDDEN: Self-approval is strictly forbidden.',
      };
    }

    return {
      status: 'ok',
      approverId: cfg.approver_employee_id,
      approverTitle: cfg.approver_title,
    };
  }

  // 4. Line-of-Command Routing for Sales & Field Hierarchy
  // SC -> REL (Relationship Manager)
  if (role === 'SC') {
    const relRes = await clientOrPool.query(
      `SELECT a.employee_id, e.display_name
       FROM assignments a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.team_id = $1 AND a.role IN ('REL', 'TL')
         AND (a.effective_to IS NULL OR a.effective_to >= CURRENT_DATE)
         AND a.employee_id != $2
       ORDER BY CASE WHEN a.role = 'REL' THEN 0 ELSE 1 END
       LIMIT 1`,
      [teamId, employeeId]
    );
    if (relRes.rows.length > 0) {
      return {
        status: 'ok',
        approverId: relRes.rows[0].employee_id,
        approverTitle: 'Relationship Manager',
      };
    }
    // Fallback: Manager for the team / vertical
    const mgRes = await clientOrPool.query(
      `SELECT a.employee_id, e.display_name
       FROM assignments a
       JOIN employees e ON a.employee_id = e.id
       WHERE (a.team_id = $1 OR a.vertical = $2) AND a.role = 'MG'
         AND (a.effective_to IS NULL OR a.effective_to >= CURRENT_DATE)
         AND a.employee_id != $3
       LIMIT 1`,
      [teamId, vertical, employeeId]
    );
    if (mgRes.rows.length > 0) {
      return {
        status: 'ok',
        approverId: mgRes.rows[0].employee_id,
        approverTitle: 'Manager',
      };
    }
  }

  // REL (and historical TL) -> Manager (MG)
  if (role === 'REL' || role === 'TL') {
    const mgRes = await clientOrPool.query(
      `SELECT a.employee_id, e.display_name
       FROM assignments a
       JOIN employees e ON a.employee_id = e.id
       WHERE (a.team_id = $1 OR a.vertical = $2) AND a.role = 'MG'
         AND (a.effective_to IS NULL OR a.effective_to >= CURRENT_DATE)
         AND a.employee_id != $3
       LIMIT 1`,
      [teamId, vertical, employeeId]
    );
    if (mgRes.rows.length > 0) {
      return {
        status: 'ok',
        approverId: mgRes.rows[0].employee_id,
        approverTitle: 'Manager',
      };
    }
  }

  // MG -> Regional Manager (RM)
  if (role === 'MG') {
    const rmRes = await clientOrPool.query(
      `SELECT a.employee_id, e.display_name
       FROM assignments a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.vertical = $1 AND a.role = 'RM'
         AND (a.effective_to IS NULL OR a.effective_to >= CURRENT_DATE)
         AND a.employee_id != $2
       LIMIT 1`,
      [vertical, employeeId]
    );
    if (rmRes.rows.length > 0) {
      return {
        status: 'ok',
        approverId: rmRes.rows[0].employee_id,
        approverTitle: 'Regional Manager',
      };
    }
  }

  // RM -> National Manager (NM)
  if (role === 'RM') {
    const nmRes = await clientOrPool.query(
      `SELECT a.employee_id, e.display_name
       FROM assignments a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.vertical = $1 AND a.role = 'NM'
         AND (a.effective_to IS NULL OR a.effective_to >= CURRENT_DATE)
         AND a.employee_id != $2
       LIMIT 1`,
      [vertical, employeeId]
    );
    if (nmRes.rows.length > 0) {
      return {
        status: 'ok',
        approverId: nmRes.rows[0].employee_id,
        approverTitle: 'National Manager',
      };
    }
  }

  // NM -> Chief Executive Officer (CEO)
  if (role === 'NM') {
    const ceoRes = await clientOrPool.query(
      `SELECT a.employee_id, e.display_name
       FROM assignments a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.role = 'CEO'
         AND (a.effective_to IS NULL OR a.effective_to >= CURRENT_DATE)
         AND a.employee_id != $1
       LIMIT 1`,
      [employeeId]
    );
    if (ceoRes.rows.length > 0) {
      return {
        status: 'ok',
        approverId: ceoRes.rows[0].employee_id,
        approverTitle: 'Chief Executive Officer',
      };
    }
  }

  return {
    status: 'blocked',
    reason: `No active superior found in organizational line-of-command for role ${role}.`,
  };
}

export async function submitLeaveRequest(
  input: SubmitLeaveRequestInput,
  actor: WorkspaceSession
): Promise<{ success: boolean; requestId: string; status: string; approverId: string; approverTitle: string; totalDays: number }> {
  if (input.startDate > input.endDate) {
    throw new Error('INVALID_DATE_INTERVAL: Leave start date cannot be after end date.');
  }

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const superior = await resolveSuperiorForEmployee(actor.employeeId, client);
    if (superior.status !== 'ok' || !superior.approverId) {
      throw new Error(`UNCONFIGURED_APPROVER: ${superior.reason || 'Approver route is blocked until explicitly configured.'}`);
    }

    if (superior.approverId === actor.employeeId) {
      throw new Error('SELF_APPROVAL_FORBIDDEN: You cannot approve your own leave request.');
    }

    const reqId = makeId('LRQ');

    await client.query(
      `INSERT INTO employee_leave_requests (
        id, employee_id, leave_type, start_date, end_date, total_days,
        reason, handover_notes, status, current_approver_id, record_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'submitted', $9, 1)`,
      [
        reqId,
        actor.employeeId,
        input.leaveType,
        input.startDate,
        input.endDate,
        totalDays,
        input.reason,
        input.handoverNotes || null,
        superior.approverId,
      ]
    );

    const actionId = makeId('LAA');
    await client.query(
      `INSERT INTO leave_approval_actions (
        id, leave_request_id, actor_employee_id, actor_role, action, notes
      ) VALUES ($1, $2, $3, $4, 'submitted', $5)`,
      [
        actionId,
        reqId,
        actor.employeeId,
        actor.role,
        `Submitted leave request for ${totalDays} day(s) routed to ${superior.approverTitle}.`,
      ]
    );

    await client.query('COMMIT');

    return {
      success: true,
      requestId: reqId,
      status: 'submitted',
      approverId: superior.approverId,
      approverTitle: superior.approverTitle || 'Superior Approver',
      totalDays,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function decideLeaveRequest(
  requestId: string,
  input: DecideLeaveRequestInput,
  actor: WorkspaceSession
): Promise<{ success: boolean; requestId: string; status: string; decidedAt: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqRes = await client.query(
      `SELECT r.*, e.display_name as employee_name
       FROM employee_leave_requests r
       JOIN employees e ON r.employee_id = e.id
       WHERE r.id = $1 FOR UPDATE`,
      [requestId]
    );

    if (reqRes.rows.length === 0) {
      throw new Error('NOT_FOUND: Leave request does not exist.');
    }

    const request = reqRes.rows[0];

    if (request.status !== 'submitted') {
      throw new Error(`ALREADY_DECIDED: Request is already finalized (status: ${request.status}).`);
    }

    if (request.employee_id === actor.employeeId) {
      throw new Error('SELF_APPROVAL_FORBIDDEN: You cannot approve or deny your own leave request.');
    }

    // Authorization check: Is actor the configured approver or has supervisory span?
    const isDirectApprover = request.current_approver_id === actor.employeeId;

    if (!isDirectApprover) {
      // Check supervisory span
      const requesterAsgRes = await client.query(
        `SELECT a.role, a.vertical, a.team_id
         FROM assignments a
         WHERE a.employee_id = $1 AND (a.effective_to IS NULL OR a.effective_to >= CURRENT_DATE)
         LIMIT 1`,
        [request.employee_id]
      );
      const requesterAsg = requesterAsgRes.rows[0];

      let isSupervisoryAuthorized = false;
      if (requesterAsg) {
        if (actor.role === 'CEO') {
          isSupervisoryAuthorized = true;
        } else if (actor.role === 'NM' && actor.verticalGrants.includes(requesterAsg.vertical)) {
          isSupervisoryAuthorized = true;
        } else if (actor.role === 'RM' && actor.verticalGrants.includes(requesterAsg.vertical)) {
          isSupervisoryAuthorized = true;
        } else if (actor.role === 'MG' && (actor.verticalGrants.includes(requesterAsg.vertical) || actor.teamGrants.includes(requesterAsg.team_id))) {
          isSupervisoryAuthorized = true;
        } else if ((actor.role === 'REL' || actor.role === 'TL') && actor.teamGrants.includes(requesterAsg.team_id)) {
          isSupervisoryAuthorized = true;
        }
      }

      if (!isSupervisoryAuthorized) {
        throw new Error('FORBIDDEN: This leave request is outside your authorized supervisory span.');
      }
    }

    const now = new Date();

    await client.query(
      `UPDATE employee_leave_requests
       SET status = $1,
           decided_by_employee_id = $2,
           decision_notes = $3,
           decided_at = $4,
           record_version = record_version + 1,
           updated_at = $4
       WHERE id = $5`,
      [input.decision, actor.employeeId, input.notes, now, requestId]
    );

    const actionId = makeId('LAA');
    await client.query(
      `INSERT INTO leave_approval_actions (
        id, leave_request_id, actor_employee_id, actor_role, action, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        actionId,
        requestId,
        actor.employeeId,
        actor.role,
        input.decision,
        input.notes,
      ]
    );

    // If approved, synchronize to employee_leaves so lead allocation and availability are updated
    if (input.decision === 'approved') {
      const absenceTypeMap: Record<string, string> = {
        casual: 'personal_leave',
        sick: 'sick_leave',
        annual: 'annual_leave',
        earned: 'annual_leave',
        unpaid: 'unpaid',
        bereavement: 'bereavement',
        paternity: 'approved_leave',
        maternity: 'approved_leave',
      };
      const absenceType = absenceTypeMap[request.leave_type] || 'approved_leave';
      const levId = makeId('LEV');

      await client.query(
        `INSERT INTO employee_leaves (
          id, employee_id, absence_type, policy_reference, start_date, end_date,
          coverage_owner_role, coverage_notes, allocation_status,
          leads_reassignment_confirmed, status, recorded_by_employee_id
        ) VALUES ($1, $2, $3, 'POL-LEAVE-2026', $4, $5, $6, $7, 'unavailable', false, 'active', $8)`,
        [
          levId,
          request.employee_id,
          absenceType,
          request.start_date,
          request.end_date,
          actor.role,
          `Approved request ${requestId}: ${input.notes}`,
          actor.employeeId,
        ]
      );
    }

    await client.query('COMMIT');

    return {
      success: true,
      requestId,
      status: input.decision,
      decidedAt: now.toISOString(),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function withdrawLeaveRequest(
  requestId: string,
  notes: string | undefined,
  actor: WorkspaceSession
): Promise<{ success: boolean; requestId: string; status: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqRes = await client.query(
      `SELECT * FROM employee_leave_requests WHERE id = $1 FOR UPDATE`,
      [requestId]
    );

    if (reqRes.rows.length === 0) {
      throw new Error('NOT_FOUND: Leave request does not exist.');
    }

    const request = reqRes.rows[0];

    if (request.employee_id !== actor.employeeId) {
      throw new Error('FORBIDDEN: You can only withdraw your own leave requests.');
    }

    if (request.status !== 'submitted') {
      throw new Error('UNPROCESSABLE_ENTITY: Only pending (submitted) requests can be withdrawn.');
    }

    const now = new Date();

    await client.query(
      `UPDATE employee_leave_requests
       SET status = 'withdrawn',
           decision_notes = COALESCE($1, 'Withdrawn by requester'),
           record_version = record_version + 1,
           updated_at = $2
       WHERE id = $3`,
      [notes || null, now, requestId]
    );

    const actionId = makeId('LAA');
    await client.query(
      `INSERT INTO leave_approval_actions (
        id, leave_request_id, actor_employee_id, actor_role, action, notes
      ) VALUES ($1, $2, $3, $4, 'withdrawn', $5)`,
      [
        actionId,
        requestId,
        actor.employeeId,
        actor.role,
        notes || 'Requester voluntarily withdrew the leave request before decision.',
      ]
    );

    await client.query('COMMIT');

    return {
      success: true,
      requestId,
      status: 'withdrawn',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getMyLeaveRequests(actorId: string): Promise<LeaveRequestRecord[]> {
  const res = await pool.query(
    `SELECT
       r.*,
       e.display_name as employee_name,
       e.email as employee_email,
       appr.display_name as current_approver_name,
       dec_emp.display_name as decided_by_name
     FROM employee_leave_requests r
     JOIN employees e ON r.employee_id = e.id
     LEFT JOIN employees appr ON r.current_approver_id = appr.id
     LEFT JOIN employees dec_emp ON r.decided_by_employee_id = dec_emp.id
     WHERE r.employee_id = $1
     ORDER BY r.created_at DESC`,
    [actorId]
  );

  const requests: LeaveRequestRecord[] = [];
  for (const row of res.rows) {
    const actionsRes = await pool.query(
      `SELECT a.*, e.display_name as actor_name
       FROM leave_approval_actions a
       JOIN employees e ON a.actor_employee_id = e.id
       WHERE a.leave_request_id = $1
       ORDER BY a.created_at ASC`,
      [row.id]
    );

    requests.push({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      employeeEmail: row.employee_email,
      leaveType: row.leave_type,
      startDate: row.start_date instanceof Date ? row.start_date.toISOString().split('T')[0] : String(row.start_date),
      endDate: row.end_date instanceof Date ? row.end_date.toISOString().split('T')[0] : String(row.end_date),
      totalDays: Number(row.total_days),
      reason: row.reason,
      handoverNotes: row.handover_notes,
      status: row.status,
      currentApproverId: row.current_approver_id,
      currentApproverName: row.current_approver_name,
      decidedByEmployeeId: row.decided_by_employee_id,
      decidedByName: row.decided_by_name,
      decisionNotes: row.decision_notes,
      decidedAt: row.decided_at ? new Date(row.decided_at).toISOString() : null,
      recordVersion: row.record_version,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      actions: actionsRes.rows.map((act) => ({
        id: act.id,
        leaveRequestId: act.leave_request_id,
        actorEmployeeId: act.actor_employee_id,
        actorName: act.actor_name,
        actorRole: act.actor_role,
        action: act.action,
        notes: act.notes,
        createdAt: new Date(act.created_at).toISOString(),
      })),
    });
  }

  return requests;
}

export async function getApprovalsQueue(actor: WorkspaceSession): Promise<LeaveRequestRecord[]> {
  // Return requests where current_approver_id = actor.employeeId OR actor is supervisory superior
  // Exclude requester's own requests (zero self-approval)
  const res = await pool.query(
    `SELECT
       r.*,
       e.display_name as employee_name,
       e.email as employee_email,
       asg.role as employee_role,
       asg.vertical as vertical,
       asg.team_id as team_id,
       t.name as team_name,
       appr.display_name as current_approver_name,
       cfg.approver_title as current_approver_title
     FROM employee_leave_requests r
     JOIN employees e ON r.employee_id = e.id
     LEFT JOIN assignments asg ON asg.employee_id = r.employee_id AND (asg.effective_to IS NULL OR asg.effective_to >= CURRENT_DATE)
     LEFT JOIN teams t ON asg.team_id = t.id
     LEFT JOIN employees appr ON r.current_approver_id = appr.id
     LEFT JOIN approver_configurations cfg ON cfg.role = asg.role
     WHERE r.status = 'submitted'
       AND r.employee_id != $1
       AND (
         r.current_approver_id = $1
         OR ($2 = 'CEO')
         OR ($2 = 'NM' AND asg.vertical = ANY($3::text[]))
         OR ($2 = 'RM' AND asg.vertical = ANY($3::text[]))
         OR ($2 = 'MG' AND (asg.vertical = ANY($3::text[]) OR asg.team_id = ANY($4::text[])))
         OR (($2 = 'REL' OR $2 = 'TL') AND asg.team_id = ANY($4::text[]))
       )
     ORDER BY r.created_at ASC`,
    [actor.employeeId, actor.role, actor.verticalGrants, actor.teamGrants]
  );

  return res.rows.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeEmail: row.employee_email,
    employeeRole: row.employee_role,
    vertical: row.vertical,
    teamId: row.team_id,
    teamName: row.team_name,
    leaveType: row.leave_type,
    startDate: row.start_date instanceof Date ? row.start_date.toISOString().split('T')[0] : String(row.start_date),
    endDate: row.end_date instanceof Date ? row.end_date.toISOString().split('T')[0] : String(row.end_date),
    totalDays: Number(row.total_days),
    reason: row.reason,
    handoverNotes: row.handover_notes,
    status: row.status,
    currentApproverId: row.current_approver_id,
    currentApproverName: row.current_approver_name,
    currentApproverTitle: row.current_approver_title,
    recordVersion: row.record_version,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

export async function getOrganizationLeaveRequests(
  filters: LeaveFilterQuery
): Promise<LeaveRequestRecord[]> {
  let query = `
    SELECT
      r.*,
      e.display_name as employee_name,
      e.email as employee_email,
      asg.role as employee_role,
      asg.vertical as vertical,
      asg.team_id as team_id,
      t.name as team_name,
      appr.display_name as current_approver_name,
      dec_emp.display_name as decided_by_name
    FROM employee_leave_requests r
    JOIN employees e ON r.employee_id = e.id
    LEFT JOIN assignments asg ON asg.employee_id = r.employee_id AND (asg.effective_to IS NULL OR asg.effective_to >= CURRENT_DATE)
    LEFT JOIN teams t ON asg.team_id = t.id
    LEFT JOIN employees appr ON r.current_approver_id = appr.id
    LEFT JOIN employees dec_emp ON r.decided_by_employee_id = dec_emp.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (filters.vertical && filters.vertical !== 'all') {
    params.push(filters.vertical);
    query += ` AND asg.vertical = $${params.length}`;
  }
  if (filters.role && filters.role !== 'all') {
    params.push(filters.role);
    query += ` AND asg.role = $${params.length}`;
  }
  if (filters.teamId && filters.teamId !== 'all') {
    params.push(filters.teamId);
    query += ` AND asg.team_id = $${params.length}`;
  }
  if (filters.employeeId) {
    params.push(filters.employeeId);
    query += ` AND r.employee_id = $${params.length}`;
  }
  if (filters.status && filters.status !== 'all') {
    params.push(filters.status);
    query += ` AND r.status = $${params.length}`;
  }
  if (filters.startDate) {
    params.push(filters.startDate);
    query += ` AND r.start_date >= $${params.length}`;
  }
  if (filters.endDate) {
    params.push(filters.endDate);
    query += ` AND r.end_date <= $${params.length}`;
  }

  query += ` ORDER BY r.created_at DESC`;

  const res = await pool.query(query, params);

  const results: LeaveRequestRecord[] = [];
  for (const row of res.rows) {
    const actionsRes = await pool.query(
      `SELECT a.*, e.display_name as actor_name
       FROM leave_approval_actions a
       JOIN employees e ON a.actor_employee_id = e.id
       WHERE a.leave_request_id = $1
       ORDER BY a.created_at ASC`,
      [row.id]
    );

    results.push({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      employeeEmail: row.employee_email,
      employeeRole: row.employee_role,
      vertical: row.vertical,
      teamId: row.team_id,
      teamName: row.team_name,
      leaveType: row.leave_type,
      startDate: row.start_date instanceof Date ? row.start_date.toISOString().split('T')[0] : String(row.start_date),
      endDate: row.end_date instanceof Date ? row.end_date.toISOString().split('T')[0] : String(row.end_date),
      totalDays: Number(row.total_days),
      reason: row.reason,
      handoverNotes: row.handover_notes,
      status: row.status,
      currentApproverId: row.current_approver_id,
      currentApproverName: row.current_approver_name,
      decidedByEmployeeId: row.decided_by_employee_id,
      decidedByName: row.decided_by_name,
      decisionNotes: row.decision_notes,
      decidedAt: row.decided_at ? new Date(row.decided_at).toISOString() : null,
      recordVersion: row.record_version,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      actions: actionsRes.rows.map((act) => ({
        id: act.id,
        leaveRequestId: act.leave_request_id,
        actorEmployeeId: act.actor_employee_id,
        actorName: act.actor_name,
        actorRole: act.actor_role,
        action: act.action,
        notes: act.notes,
        createdAt: new Date(act.created_at).toISOString(),
      })),
    });
  }

  return results;
}

export async function listApproverConfigurations(): Promise<ApproverConfigRecord[]> {
  const res = await pool.query(
    `SELECT
       cfg.*,
       e.display_name as employee_name,
       appr.display_name as approver_name
     FROM approver_configurations cfg
     LEFT JOIN employees e ON cfg.employee_id = e.id
     LEFT JOIN employees appr ON cfg.approver_employee_id = appr.id
     ORDER BY cfg.role NULLS LAST, cfg.employee_id NULLS LAST`
  );

  return res.rows.map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    role: row.role,
    vertical: row.vertical,
    approverEmployeeId: row.approver_employee_id,
    approverName: row.approver_name,
    approverTitle: row.approver_title,
    isConfigured: row.is_configured,
    notes: row.notes,
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

export async function upsertApproverConfiguration(
  input: ConfigureApproverInput,
  actorId: string
): Promise<{ success: boolean; configId: string }> {
  if (input.employeeId && input.approverEmployeeId && input.employeeId === input.approverEmployeeId) {
    throw new Error('SELF_APPROVAL_FORBIDDEN: Employee cannot be configured as their own approver.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let configId = makeId('CFG-APP');
    const isConfigured = input.isConfigured !== false && !!input.approverEmployeeId;

    if (input.employeeId) {
      const existing = await client.query(
        `SELECT id FROM approver_configurations WHERE employee_id = $1`,
        [input.employeeId]
      );
      if (existing.rows.length > 0) {
        configId = existing.rows[0].id;
        await client.query(
          `UPDATE approver_configurations
           SET approver_employee_id = $1, approver_title = $2, is_configured = $3,
               notes = $4, updated_by_employee_id = $5, updated_at = now()
           WHERE id = $6`,
          [input.approverEmployeeId || null, input.approverTitle, isConfigured, input.notes || null, actorId, configId]
        );
      } else {
        await client.query(
          `INSERT INTO approver_configurations (
            id, employee_id, role, vertical, approver_employee_id, approver_title,
            is_configured, notes, updated_by_employee_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            configId,
            input.employeeId,
            input.role || null,
            input.vertical || null,
            input.approverEmployeeId || null,
            input.approverTitle,
            isConfigured,
            input.notes || null,
            actorId,
          ]
        );
      }
    } else if (input.role) {
      const existing = await client.query(
        `SELECT id FROM approver_configurations WHERE role = $1 AND vertical IS NOT DISTINCT FROM $2`,
        [input.role, input.vertical || null]
      );
      if (existing.rows.length > 0) {
        configId = existing.rows[0].id;
        await client.query(
          `UPDATE approver_configurations
           SET approver_employee_id = $1, approver_title = $2, is_configured = $3,
               notes = $4, updated_by_employee_id = $5, updated_at = now()
           WHERE id = $6`,
          [input.approverEmployeeId || null, input.approverTitle, isConfigured, input.notes || null, actorId, configId]
        );
      } else {
        await client.query(
          `INSERT INTO approver_configurations (
            id, employee_id, role, vertical, approver_employee_id, approver_title,
            is_configured, notes, updated_by_employee_id
          ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8)`,
          [
            configId,
            input.role,
            input.vertical || null,
            input.approverEmployeeId || null,
            input.approverTitle,
            isConfigured,
            input.notes || null,
            actorId,
          ]
        );
      }
    }

    await client.query('COMMIT');
    return { success: true, configId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
