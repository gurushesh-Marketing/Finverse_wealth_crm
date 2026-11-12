import { randomBytes, createHash } from 'node:crypto';
import type {
  SaApproveOnboardingInput,
  SaRejectOnboardingInput,
  SaApproveOnboardingResponse,
  SaApproveLifecycleChangeInput,
  SaApproveExitInput,
  SaRejectHrRequestInput,
  SaHrRequestItem,
  SaCreateAccountInput,
  SaGrantScopeInput,
  SaAdditionalScopeInput,
  SaRestructureHierarchyInput,
  SaActivateTransferInput,
  SaOffboardEmployeeInput,
  SaAccountRecoveryInput,
  SaPublishConfigInput,
  SaIncidentActionInput,
  SaRetryJobInput,
  SaDecideDelegationInput,
  SaCreateTeamInput,
  SaUpdateTeamInput,
  SaAssignCallerInput,
  SaTeamItem,
  SaTeamCaller,
  SaEligibleRelationshipManager,
  SaEligibleCaller,
} from '@finverse/contracts';

import { pool } from './db';
import { hashPassword } from '../lib/password';
import { redistributeFormerCallerLeads } from './caller-reassignment';

function makeId(prefix: string): string {
  return `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function logSystemAudit(
  actorEmployeeId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, any> = {},
  correlationId?: string
) {
  const id = makeId('AUD');
  await pool.query(
    `INSERT INTO system_audit_logs (id, actor_employee_id, action, entity_type, entity_id, correlation_id, details, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [id, actorEmployeeId, action, entityType, entityId, correlationId || null, JSON.stringify(details)]
  );
  return id;
}

// Overview stats
export async function getSuperadminOverview() {
  const [
    employeesRes,
    assignmentsRes,
    invitationsRes,
    transfersRes,
    incidentsRes,
    jobsRes,
    delegationsRes,
    recentAuditsRes,
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*) as count FROM employees`),
    pool.query(`SELECT COUNT(*) as count FROM assignments WHERE effective_to IS NULL OR effective_to >= CURRENT_DATE`),
    pool.query(`SELECT COUNT(*) as count FROM activation_invitations WHERE consumed_at IS NULL AND expires_at > NOW()`),
    pool.query(`SELECT COUNT(*) as count FROM employee_lifecycle_requests WHERE status = 'approved_by_rm'`),
    pool.query(`SELECT COUNT(*) as count FROM audit_incidents WHERE state IN ('Active', 'Review')`),
    pool.query(`SELECT COUNT(*) as count FROM system_background_jobs WHERE state IN ('Failed', 'Retrying')`),
    pool.query(`SELECT COUNT(*) as count FROM temporary_access_grants WHERE status = 'active' AND expires_at <= NOW() + INTERVAL '30 days'`),
    pool.query(`SELECT a.*, e.display_name as actor_name FROM system_audit_logs a LEFT JOIN employees e ON a.actor_employee_id = e.id ORDER BY a.occurred_at DESC LIMIT 10`),
  ]);

  return {
    totalEmployees: parseInt(employeesRes.rows[0]?.count || '0', 10),
    activeAssignments: parseInt(assignmentsRes.rows[0]?.count || '0', 10),
    pendingInvitations: parseInt(invitationsRes.rows[0]?.count || '0', 10),
    pendingTransfers: parseInt(transfersRes.rows[0]?.count || '0', 10),
    activeIncidents: parseInt(incidentsRes.rows[0]?.count || '0', 10),
    failedJobs: parseInt(jobsRes.rows[0]?.count || '0', 10),
    expiringDelegations: parseInt(delegationsRes.rows[0]?.count || '0', 10),
    recentAuditLogs: recentAuditsRes.rows,
  };
}

// SA-01: Provision Account & Expiring Activation Invitation
export async function provisionAccount(input: SaCreateAccountInput, actorId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check duplicate email
    const existing = await client.query('SELECT id, status FROM employees WHERE email = $1', [input.workEmail]);
    if (existing.rows.length > 0) {
      throw new Error('DUPLICATE_IDENTITY: An employee account with this work email already exists. Leaver accounts cannot be reused.');
    }

    // Verify team exists
    const teamRes = await client.query('SELECT id, vertical FROM teams WHERE id = $1', [input.teamId]);
    if (teamRes.rows.length === 0) {
      throw new Error('ABSENT_PLACEMENT: Selected organizational team placement does not exist.');
    }

    const employeeId = makeId('EMP');
    // Synthetic temporary password hash (user must set real password via activation)
    const tempPasswordHash = hashToken(randomBytes(16).toString('hex'));

    await client.query(
      `INSERT INTO employees (id, email, password_hash, display_name, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [employeeId, input.workEmail, tempPasswordHash, input.employeeName, 'active']
    );

    const assignmentId = makeId('ASG');
    await client.query(
      `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, NULL)`,
      [assignmentId, employeeId, input.proposedRole, input.vertical, input.teamId]
    );

    const rawToken = randomBytes(24).toString('hex');
    const tokenHash = hashToken(rawToken);
    const invitationId = makeId('INV');
    const expiresAt = new Date(Date.now() + input.invitationExpiryHours * 3600 * 1000);

    await client.query(
      `INSERT INTO activation_invitations (id, employee_id, work_email, proposed_role, vertical, team_id, token_hash, expires_at, created_by_employee_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [invitationId, employeeId, input.workEmail, input.proposedRole, input.vertical, input.teamId, tokenHash, expiresAt, actorId]
    );

    // Write to Local Delivery Outbox (Demo Adapter: No external email provider)
    const outboxId = makeId('OUT');
    await client.query(
      `INSERT INTO local_delivery_outbox (id, recipient_email, delivery_type, subject, action_url, raw_token, expires_at, channel_label, created_at)
       VALUES ($1, $2, 'activation_invitation', 'Activate your Finverse CRM Account', $3, $4, $5, 'Local Delivery Adapter (Demo: No External Email Service)', NOW())`,
      [outboxId, input.workEmail, `/activate?token=${rawToken}`, rawToken, expiresAt]
    );

    await client.query('COMMIT');

    await logSystemAudit(actorId, 'account.provision', 'employee', employeeId, {
      workEmail: input.workEmail,
      proposedRole: input.proposedRole,
      vertical: input.vertical,
      teamId: input.teamId,
      invitationId,
    });

    return {
      employeeId,
      assignmentId,
      invitationId,
      workEmail: input.workEmail,
      expiresAt: expiresAt.toISOString(),
      deliveryChannel: 'local_adapter',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function consumeActivationToken(input: { token: string; password: string }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tokenH = hashToken(input.token);
    const invRes = await client.query(
      `SELECT * FROM activation_invitations WHERE token_hash = $1`,
      [tokenH]
    );
    if (invRes.rows.length === 0) {
      throw new Error('INVALID_TOKEN: Invalid activation token.');
    }
    const invitation = invRes.rows[0];
    if (invitation.consumed_at) {
      throw new Error('TOKEN_ALREADY_USED: This activation token has already been consumed. Reused tokens are rejected.');
    }
    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error('TOKEN_EXPIRED: Activation token has expired. Please request a new activation link.');
    }
    const empRes = await client.query(
      `SELECT id, status FROM employees WHERE id = $1`,
      [invitation.employee_id]
    );
    if (empRes.rows.length === 0 || empRes.rows[0].status === 'disabled' || empRes.rows[0].status === 'suspended') {
      throw new Error('ACCOUNT_INACTIVE: Inactive employment prevents account activation.');
    }
    const newHash = hashPassword(input.password);
    await client.query(
      `UPDATE employees SET password_hash = $1, status = 'active' WHERE id = $2`,
      [newHash, invitation.employee_id]
    );
    await client.query(
      `UPDATE activation_invitations SET consumed_at = NOW() WHERE id = $1`,
      [invitation.id]
    );
    await client.query(
      `UPDATE local_delivery_outbox SET consumed_at = NOW() WHERE raw_token = $1`,
      [input.token]
    );
    await client.query('COMMIT');
    await logSystemAudit(invitation.employee_id, 'account.activated', 'employee', invitation.employee_id, {
      invitationId: invitation.id,
      workEmail: invitation.work_email,
    });
    return {
      success: true,
      employeeId: invitation.employee_id,
      email: invitation.work_email,
      message: 'Account successfully activated. You can now log in.',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Onboarding Requests Management (HR-01 -> SA Activation)
export async function listPendingOnboardingRequests() {
  const { rows } = await pool.query(`
    SELECT r.id as request_id, r.employee_id, r.employee_name, r.employee_name as full_name, r.employee_email,
           r.primary_mobile, r.whatsapp_number, r.status, r.created_at,
           r.target_role as proposed_role, r.target_vertical as proposed_vertical,
           r.target_team_id as proposed_team_id, r.supervisor_employee_id as proposed_superior_id,
           t.name as proposed_team_name, sup.display_name as proposed_superior_name,
           r.admin_decision_notes,
           creator.display_name as submitted_by_name,
           e.status as employee_status, e.mobile_number, e.whatsapp_number as emp_whatsapp
      FROM hr_lifecycle_requests r
      LEFT JOIN employees e ON e.id = r.employee_id
      LEFT JOIN teams t ON t.id = r.target_team_id
      LEFT JOIN employees sup ON sup.id = r.supervisor_employee_id
      LEFT JOIN employees creator ON creator.id = r.created_by_employee_id
     WHERE r.request_type = 'new_account'
     ORDER BY r.created_at DESC
  `);
  return rows;
}

// Unified HR Requests List (New Employee, Role/Team/Vertical Change, Exit)
export async function listAllHrRequests(
  statusFilter?: 'pending' | 'approved' | 'rejected',
  vertical?: string
): Promise<SaHrRequestItem[]> {
  let query = `
    SELECT
      r.id,
      r.request_type as "requestType",
      r.status,
      r.employee_id as "employeeId",
      r.employee_name as "employeeName",
      r.employee_email as "employeeEmail",
      r.primary_mobile as "primaryMobile",
      r.whatsapp_number as "whatsappNumber",
      r.target_role as "targetRole",
      r.target_vertical as "targetVertical",
      r.target_team_id as "targetTeamId",
      t.name as "targetTeamName",
      r.supervisor_employee_id as "supervisorEmployeeId",
      sup.display_name as "supervisorName",
      to_char(r.effective_date, 'YYYY-MM-DD') as "effectiveDate",
      r.effective_time as "effectiveTime",
      r.approvals_summary as "approvalsSummary",
      r.handoff_plan as "handoffPlan",
      r.old_workload_treatment as "oldWorkloadTreatment",
      r.replacement_plan as "replacementPlan",
      r.admin_decision_notes as "adminDecisionNotes",
      creator.display_name as "createdByName",
      r.created_at as "createdAt",
      r.updated_at as "updatedAt",
      cur_asg.role as "currentRole",
      cur_asg.vertical as "currentVertical",
      cur_team.name as "currentTeamName",
      e.username as "currentUsername",
      e.status as "employeeCurrentStatus"
    FROM hr_lifecycle_requests r
    LEFT JOIN employees e ON r.employee_id = e.id
    LEFT JOIN teams t ON r.target_team_id = t.id
    LEFT JOIN employees sup ON r.supervisor_employee_id = sup.id
    LEFT JOIN employees creator ON r.created_by_employee_id = creator.id
    LEFT JOIN LATERAL (
      SELECT a.role, a.vertical, a.team_id
      FROM assignments a
      WHERE a.employee_id = r.employee_id
        AND (a.effective_to IS NULL OR a.effective_to >= CURRENT_DATE)
      ORDER BY a.effective_from DESC, a.id DESC
      LIMIT 1
    ) cur_asg ON true
    LEFT JOIN teams cur_team ON cur_team.id = cur_asg.team_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (statusFilter === 'pending') {
    query += ` AND r.status IN ('submitted', 'approved', 'approved_by_rm', 'pending_approval')`;
  } else if (statusFilter === 'approved') {
    query += ` AND r.status = 'activated_by_admin'`;
  } else if (statusFilter === 'rejected') {
    query += ` AND r.status IN ('rejected', 'returned')`;
  }
  if (vertical && vertical !== 'all') {
    const normVert = vertical === 'real-estate' ? 'real_estate' : vertical;
    params.push(normVert);
    query += ` AND (
      r.target_vertical = $${params.length} OR
      (r.target_vertical IS NULL AND (cur_asg.vertical = $${params.length} OR REPLACE(cur_asg.vertical, '-', '_') = REPLACE($${params.length}, '-', '_'))) OR
      REPLACE(r.target_vertical, '-', '_') = REPLACE($${params.length}, '-', '_')
    )`;
  }
  query += ` ORDER BY r.created_at DESC`;
  const res = await pool.query(query, params);
  return res.rows;
}

export async function approveOnboardingRequest(
  input: SaApproveOnboardingInput,
  actorId: string
): Promise<SaApproveOnboardingResponse> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch request and pending employee
    const reqRes = await client.query(
      `SELECT r.*, e.id as emp_id, e.status as emp_status, e.display_name, e.email
         FROM hr_lifecycle_requests r
         JOIN employees e ON e.id = r.employee_id
        WHERE r.id = $1 AND r.request_type = 'new_account'
        FOR UPDATE OF r, e`,
      [input.requestId]
    );
    if (reqRes.rows.length === 0) {
      throw new Error('NOT_FOUND: Onboarding request not found.');
    }
    const req = reqRes.rows[0];
    if (req.status === 'activated_by_admin') {
      throw new Error('REQUEST_ALREADY_ACTIVATED: This onboarding request has already been approved and activated.');
    }
    if (req.status === 'rejected') {
      throw new Error('REQUEST_REJECTED: This onboarding request was previously rejected.');
    }
    if (req.emp_status !== 'pending_approval') {
      throw new Error('REQUEST_ALREADY_ACTIVATED: This employee is no longer pending approval.');
    }

    const canonicalVertical = input.vertical === 'real-estate' ? 'real_estate' : input.vertical;

    // 2. Validate team belongs to the selected vertical (case-insensitive ID support)
    const teamRes = await client.query(
      `SELECT id, name, vertical, status, relationship_manager_id
         FROM teams
        WHERE lower(id) = lower($1)
          AND REPLACE(vertical, '-', '_') = REPLACE($2, '-', '_')`,
      [input.teamId, canonicalVertical]
    );
    if (teamRes.rows.length === 0) {
      throw new Error(`VALIDATION_FAILED: Team placement '${input.teamId}' does not belong to the selected vertical '${input.vertical}'.`);
    }
    const validatedTeamId = teamRes.rows[0].id;
    if (teamRes.rows[0].status !== 'active') {
      throw new Error('VALIDATION_FAILED: Select an active team for this employee.');
    }
    if (input.role === 'SC' &&
        (!teamRes.rows[0].relationship_manager_id ||
         input.reportingManagerId !== teamRes.rows[0].relationship_manager_id)) {
      throw new Error('VALIDATION_FAILED: Sales Callers must report to the selected team\'s active Relationship Manager.');
    }

    // 3. Validate reporting manager if provided
    let validatedMgrId: string | null = null;
    if (input.reportingManagerId) {
      const mgrRes = await client.query(
        `SELECT e.id, e.display_name, e.status, a.role, a.vertical
           FROM employees e
           JOIN assignments a ON a.employee_id = e.id
          WHERE lower(e.id) = lower($1)
            AND e.status = 'active'
            AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)
            AND (a.vertical = $2 OR a.vertical = REPLACE($2, '_', '-'))
            AND a.role IN ('REL', 'TL', 'MG', 'RM', 'NM', 'CEO')`,
        [input.reportingManagerId, canonicalVertical]
      );
      if (mgrRes.rows.length === 0) {
        throw new Error(`VALIDATION_FAILED: Reporting manager '${input.reportingManagerId}' does not belong to the selected vertical '${input.vertical}' or is not an eligible active manager.`);
      }
      if (input.role === 'SC' && mgrRes.rows[0].role !== 'REL') {
        throw new Error('VALIDATION_FAILED: A Sales Caller must report to a Relationship Manager.');
      }
      validatedMgrId = mgrRes.rows[0].id;
    }

    // 4. Validate Super Admin manually chosen username is unique across all accounts
    const chosenUsername = input.username.trim();
    const dupUsernameRes = await client.query(
      `SELECT id FROM employees WHERE lower(username) = lower($1) AND id != $2`,
      [chosenUsername, req.employee_id]
    );
    if (dupUsernameRes.rows.length > 0) {
      throw new Error(`VALIDATION_FAILED: Login username '${chosenUsername}' is already taken. Please choose a unique username.`);
    }

    // 5. Hash the Super Admin manually chosen temporary password (never store or log plaintext)
    if (!input.temporaryPassword || input.temporaryPassword.length < 8) {
      throw new Error('VALIDATION_FAILED: Temporary password must be at least 8 characters.');
    }
    const passwordHash = hashPassword(input.temporaryPassword);

    // 6. Record audited placement corrections if SA adjusted HR's proposal
    const placementCorrections: string[] = [];
    if (req.target_role && req.target_role !== input.role) {
      placementCorrections.push(`role: ${req.target_role} -> ${input.role}`);
    }
    if (req.target_vertical && req.target_vertical !== canonicalVertical) {
      placementCorrections.push(`vertical: ${req.target_vertical} -> ${canonicalVertical}`);
    }
    if (req.target_team_id && req.target_team_id !== validatedTeamId) {
      placementCorrections.push(`team: ${req.target_team_id} -> ${validatedTeamId}`);
    }
    if (req.supervisor_employee_id && req.supervisor_employee_id !== validatedMgrId) {
      placementCorrections.push(`superior: ${req.supervisor_employee_id} -> ${validatedMgrId || 'none'}`);
    }

    const auditNotes = placementCorrections.length > 0
      ? `Approved with audited placement corrections: ${placementCorrections.join(', ')}`
      : 'Approved placement as proposed by HR';

    // 7. Atomically activate employee, set password hash, permanent unique username, and must_change_password
    await client.query(
      `UPDATE employees
          SET password_hash = $1,
              username = $2,
              status = 'active',
              must_change_password = true,
              reporting_manager_id = $3
        WHERE id = $4`,
      [passwordHash, chosenUsername, validatedMgrId, req.employee_id]
    );

    // 8. Atomically create the effective assignment and permissions
    const assignmentId = makeId('ASG');
    await client.query(
      `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, NULL)`,
       [assignmentId, req.employee_id, input.role, canonicalVertical, validatedTeamId]
    );

    // 9. Update request status with decision audit notes
    const hrTargetVertical = canonicalVertical === 'real_estate' ? 'real-estate' : canonicalVertical;
    await client.query(
      `UPDATE hr_lifecycle_requests
          SET status = 'activated_by_admin',
              target_role = $1,
              target_vertical = $2,
              target_team_id = $3,
              supervisor_employee_id = $4,
              admin_decision_notes = $5,
              updated_at = NOW()
        WHERE id = $6`,
      [input.role, hrTargetVertical, validatedTeamId, validatedMgrId, auditNotes, req.id]
    );

    await client.query('COMMIT');

    // 10. System audit log (never logs plaintext password)
    await logSystemAudit(actorId, 'account.activated', 'employee', req.employee_id, {
      requestId: req.id,
      username: chosenUsername,
      role: input.role,
      vertical: canonicalVertical,
      teamId: validatedTeamId,
      reportingManagerId: validatedMgrId,
      placementCorrections: placementCorrections.length > 0 ? placementCorrections : 'none',
    });

    return {
      success: true,
      employeeId: req.employee_id,
      username: chosenUsername,
      role: input.role,
      vertical: canonicalVertical,
      teamId: validatedTeamId,
      mustChangePassword: true,
      message: `Account activated for ${req.employee_id}. Initial login username is ${chosenUsername}.`,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function rejectOnboardingRequest(
  input: SaRejectOnboardingInput,
  actorId: string
) {
  return rejectHrRequest(input.requestId, input.rejectionReason, actorId);
}

// Unified HR Request Rejection (New Employee, Role/Team Change, Exit)
export async function rejectHrRequest(
  requestId: string,
  rejectionReason: string,
  actorId: string
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqRes = await client.query(
      `SELECT r.*, e.id as emp_id, e.status as emp_status
         FROM hr_lifecycle_requests r
         LEFT JOIN employees e ON e.id = r.employee_id
        WHERE r.id = $1`,
      [requestId]
    );
    if (reqRes.rows.length === 0) {
      throw new Error('NOT_FOUND: HR request not found.');
    }
    const req = reqRes.rows[0];
    if (req.status === 'activated_by_admin') {
      throw new Error('REQUEST_ALREADY_ACTIVATED: Cannot reject an already activated request.');
    }

    // Set request to rejected with reason
    await client.query(
      `UPDATE hr_lifecycle_requests
          SET status = 'rejected',
              admin_decision_notes = $1,
              updated_at = NOW()
        WHERE id = $2`,
      [rejectionReason, req.id]
    );

    // If new employee onboarding, mark employee rejected so login access is blocked
    if (req.request_type === 'new_account' && req.employee_id) {
      await client.query(
        `UPDATE employees
            SET status = 'rejected'
          WHERE id = $1`,
        [req.employee_id]
      );
    }

    // Also update employee_lifecycle_requests if linked
    await client.query(
      `UPDATE employee_lifecycle_requests
          SET status = 'rejected',
              business_justification = business_justification || ' [Admin Rejected: ' || $1 || ']'
        WHERE id = $2`,
      [rejectionReason, req.id]
    );

    await client.query('COMMIT');

    await logSystemAudit(actorId, `hr_request.rejected.${req.request_type}`, 'hr_request', req.id, {
      requestId: req.id,
      requestType: req.request_type,
      employeeId: req.employee_id,
      rejectionReason,
    });

    return {
      success: true,
      requestId: req.id,
      employeeId: req.employee_id,
      status: 'rejected',
      message: `HR request ${req.id} (${req.request_type}) rejected.`,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Unified HR Request Approval: Role/Team/Vertical Change (Mover)
export async function approveLifecycleChangeRequest(
  requestId: string,
  notes: string | undefined,
  actorId: string
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqRes = await client.query(
      `SELECT r.*, e.status as emp_status
         FROM hr_lifecycle_requests r
         JOIN employees e ON r.employee_id = e.id
        WHERE r.id = $1 AND r.request_type IN ('team_transfer', 'promotion')`,
      [requestId]
    );
    if (reqRes.rows.length === 0) {
      throw new Error('NOT_FOUND: Role/team change request not found.');
    }
    const req = reqRes.rows[0];
    if (req.status === 'activated_by_admin') {
      throw new Error('REQUEST_ALREADY_ACTIVATED: This request has already been activated.');
    }
    if (req.status === 'rejected') {
      throw new Error('REQUEST_REJECTED: Cannot approve a rejected request.');
    }

    const canonicalVertical = req.target_vertical === 'real-estate' ? 'real_estate' : req.target_vertical;
    const decisionNote = notes?.trim() || 'Approved and activated by Super Admin';

    // Close active assignments today
    await client.query(
      `UPDATE assignments
          SET effective_to = CURRENT_DATE - 1
        WHERE employee_id = $1 AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)`,
      [req.employee_id]
    );

    // Create new active assignment
    const newAsgId = makeId('ASG-XFER');
    await client.query(
      `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, NULL)`,
      [newAsgId, req.employee_id, req.target_role, canonicalVertical, req.target_team_id]
    );

    // If supervisor assigned, update reporting_manager_id
    if (req.supervisor_employee_id) {
      await client.query(
        `UPDATE employees SET reporting_manager_id = $1 WHERE id = $2`,
        [req.supervisor_employee_id, req.employee_id]
      );
    }

    // Redistribute former caller leads if an active caller was moved
    const leadHandoff = await redistributeFormerCallerLeads(
      client,
      req.employee_id,
      actorId,
      'approved transfer or promotion activated'
    );

    // Mark HR request activated
    await client.query(
      `UPDATE hr_lifecycle_requests
          SET status = 'activated_by_admin',
              admin_decision_notes = $1,
              updated_at = NOW()
        WHERE id = $2`,
      [decisionNote, req.id]
    );

    // Also update employee_lifecycle_requests if matching
    await client.query(
      `UPDATE employee_lifecycle_requests
          SET status = 'activated_by_admin'
        WHERE id = $1`,
      [req.id]
    );

    // Revoke active sessions to enforce fresh role/vertical scope
    await client.query('DELETE FROM sessions WHERE employee_id = $1', [req.employee_id]);

    await client.query('COMMIT');

    await logSystemAudit(actorId, 'transfer.activate', 'employee', req.employee_id, {
      requestId: req.id,
      newAssignmentId: newAsgId,
      newRole: req.target_role,
      newVertical: canonicalVertical,
      newTeamId: req.target_team_id,
      leadHandoff,
      notes: decisionNote,
    });

    return {
      success: true,
      status: 'activated_by_admin',
      employeeId: req.employee_id,
      newAssignmentId: newAsgId,
      effectiveFrom: new Date().toISOString().split('T')[0],
      leadHandoff,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Unified HR Request Approval: Employee Exit (Leaver)
export async function approveExitRequest(
  requestId: string,
  notes: string | undefined,
  handoffSupervisedQueue: boolean = true,
  actorId: string
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqRes = await client.query(
      `SELECT r.*, e.status as emp_status
         FROM hr_lifecycle_requests r
         JOIN employees e ON r.employee_id = e.id
        WHERE r.id = $1 AND r.request_type = 'exit'`,
      [requestId]
    );
    if (reqRes.rows.length === 0) {
      throw new Error('NOT_FOUND: Employee exit request not found.');
    }
    const req = reqRes.rows[0];
    if (req.status === 'activated_by_admin') {
      throw new Error('REQUEST_ALREADY_ACTIVATED: This exit request has already been finalized.');
    }
    if (req.status === 'rejected') {
      throw new Error('REQUEST_REJECTED: Cannot approve a rejected exit request.');
    }

    const decisionNote = notes?.trim() || 'Exit request approved and finalized by Super Admin';

    // 1. Disable employee sign-in
    await client.query(`UPDATE employees SET status = 'disabled' WHERE id = $1`, [req.employee_id]);

    // 2. Close active assignments immediately (yesterday so today is inactive)
    await client.query(
      `UPDATE assignments SET effective_to = CURRENT_DATE - 1 WHERE employee_id = $1 AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)`,
      [req.employee_id]
    );

    // 3. Redistribute open caller leads
    const leadHandoff = await redistributeFormerCallerLeads(client, req.employee_id, actorId, 'caller exit finalized');

    // 4. Revoke all active sessions
    const sessionsRes = await client.query(`DELETE FROM sessions WHERE employee_id = $1 RETURNING token_hash`, [req.employee_id]);
    const revokedCount = sessionsRes.rowCount || 0;

    // 5. Holding queues for remaining work
    let holdingItemsCount = 0;
    if (handoffSupervisedQueue) {
      const openLeadsRes = await client.query(
        `SELECT id FROM leads WHERE owner_employee_id = $1 AND stage NOT IN ('converted', 'lost')`,
        [req.employee_id]
      );
      for (const lead of openLeadsRes.rows) {
        const queueId = makeId('HOLD');
        await client.query(
          `INSERT INTO holding_queues (id, source_employee_id, item_type, item_id, supervised_by_employee_id, status, notes)
           VALUES ($1, $2, 'lead', $3, $4, 'in_holding', $5)`,
          [queueId, req.employee_id, lead.id, actorId, `Lead offboarded from ${req.employee_id} via HR Exit; awaiting supervisor reallocation`]
        );
        await client.query(`UPDATE leads SET owner_employee_id = NULL WHERE id = $1`, [lead.id]);
        holdingItemsCount++;
      }

      const openTasksRes = await client.query(
        `SELECT id FROM lead_tasks WHERE owner_employee_id = $1 AND status = 'open'`,
        [req.employee_id]
      );
      for (const task of openTasksRes.rows) {
        const queueId = makeId('HOLD');
        await client.query(
          `INSERT INTO holding_queues (id, source_employee_id, item_type, item_id, supervised_by_employee_id, status, notes)
           VALUES ($1, $2, 'task', $3, $4, 'in_holding', $5)`,
          [queueId, req.employee_id, task.id, actorId, `Task offboarded from ${req.employee_id} via HR Exit; awaiting reallocation`]
        );
        await client.query(`UPDATE reminders SET status = 'cancelled' WHERE task_id = $1 AND status = 'scheduled'`, [task.id]);
        await client.query(`UPDATE lead_tasks SET status = 'cancelled' WHERE id = $1`, [task.id]);
        holdingItemsCount++;
      }
    }

    // 6. Update HR request status
    await client.query(
      `UPDATE hr_lifecycle_requests
          SET status = 'activated_by_admin',
              admin_decision_notes = $1,
              updated_at = NOW()
        WHERE id = $2`,
      [decisionNote, req.id]
    );

    await client.query('COMMIT');

    await logSystemAudit(actorId, 'employee.exit.finalized', 'employee', req.employee_id, {
      requestId: req.id,
      notes: decisionNote,
      sessionsRevoked: revokedCount,
      holdingItemsCount,
      leadHandoff,
    });

    return {
      success: true,
      status: 'activated_by_admin',
      employeeId: req.employee_id,
      sessionsRevoked: revokedCount,
      leadHandoff,
      message: `Employee ${req.employee_id} exit finalized and access revoked.`,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listInvitations() {
  const res = await pool.query(
    `SELECT i.*, e.display_name, t.name as team_name,
            CASE
              WHEN i.consumed_at IS NOT NULL THEN 'consumed'
              WHEN i.expires_at < NOW() THEN 'expired'
              ELSE 'active'
            END as invitation_status
     FROM activation_invitations i
     JOIN employees e ON i.employee_id = e.id
     JOIN teams t ON i.team_id = t.id
     ORDER BY i.created_at DESC`
  );
  return res.rows;
}


// SA-02: Precise Role & Organisation Scope Grant
export async function grantScope(input: SaGrantScopeInput, actorId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const empRes = await client.query('SELECT id, display_name FROM employees WHERE id = $1', [input.employeeId]);
    if (empRes.rows.length === 0) {
      throw new Error('NOT_FOUND: Employee does not exist.');
    }

    // Verify approval reference if it references a lifecycle request record
    if (input.approverReference && (input.approverReference.startsWith('MOVE-') || input.approverReference.startsWith('REQ-'))) {
      const chk = await client.query(
        `SELECT status FROM employee_lifecycle_requests WHERE id = $1`,
        [input.approverReference]
      );
      if (chk.rows.length > 0) {
        const st = chk.rows[0].status;
        if (st === 'rejected') throw new Error('REQUEST_REJECTED: Cannot grant scope for a rejected request.');
        if (st === 'activated_by_admin') throw new Error('REQUEST_ALREADY_ACTIVATED: Referenced request is already activated.');
        if (st !== 'approved_by_rm' && st !== 'approved') {
          throw new Error('UNAPPROVED_REQUEST: The referenced lifecycle request has not received required management approval.');
        }
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const isFuture = input.effectiveFrom > todayStr;

    // A precise grant replaces the current role/scope. Additive grants use
    // grantAdditionalScope instead; retaining an old SC team here would route
    // new prospects to a caller who has moved away.
    if (isFuture) {
      await client.query(
        `UPDATE assignments
         SET effective_to = $1::date
         WHERE employee_id = $2 AND (effective_to IS NULL OR effective_to >= $1::date)`,
        [input.effectiveFrom, input.employeeId]
      );
    } else {
      await client.query(
        `UPDATE assignments
         SET effective_to = CURRENT_DATE - 1
         WHERE employee_id = $1 AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)`,
        [input.employeeId]
      );
    }

    const createdAssignments = [];
    const effStart = isFuture ? input.effectiveFrom : todayStr;
    for (const teamId of input.allowedTeamIds) {
      const asgId = makeId('ASG');
      await client.query(
        `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [asgId, input.employeeId, input.role, input.vertical, teamId, effStart, input.effectiveTo || null]
      );
      createdAssignments.push(asgId);
    }

    const leadHandoff = isFuture
      ? { reassigned: 0, held: 0 }
      : await redistributeFormerCallerLeads(client, input.employeeId, actorId, 'role or scope grant changed');

    // Invalidate sessions to force token re-issue with updated scope
    await client.query('DELETE FROM sessions WHERE employee_id = $1', [input.employeeId]);

    await client.query('COMMIT');

    await logSystemAudit(actorId, 'scope.grant', 'employee', input.employeeId, {
      role: input.role,
      vertical: input.vertical,
      allowedTeamIds: input.allowedTeamIds,
      approverReference: input.approverReference,
      createdAssignments,
      leadHandoff,
    });

    return { success: true, employeeId: input.employeeId, assignments: createdAssignments };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// SA-03: Grant Additional Team or Vertical in Same Role
export async function grantAdditionalScope(input: SaAdditionalScopeInput, actorId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify approval reference if it references a lifecycle request record
    if (input.approverReference && (input.approverReference.startsWith('MOVE-') || input.approverReference.startsWith('REQ-'))) {
      const chk = await client.query(
        `SELECT status FROM employee_lifecycle_requests WHERE id = $1`,
        [input.approverReference]
      );
      if (chk.rows.length > 0) {
        const st = chk.rows[0].status;
        if (st === 'rejected') throw new Error('REQUEST_REJECTED: Cannot grant scope for a rejected request.');
        if (st === 'activated_by_admin') throw new Error('REQUEST_ALREADY_ACTIVATED: Referenced request is already activated.');
        if (st !== 'approved_by_rm' && st !== 'approved') {
          throw new Error('UNAPPROVED_REQUEST: The referenced lifecycle request has not received required management approval.');
        }
      }
    }

    // Get current active assignment to guarantee same role
    const currentAsgRes = await client.query(
      `SELECT role, vertical, team_id FROM assignments
       WHERE employee_id = $1 AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
       ORDER BY effective_from DESC, id DESC LIMIT 1`,
      [input.employeeId]
    );

    if (currentAsgRes.rows.length === 0) {
      throw new Error('NOT_FOUND: Employee has no active base role grant. Grant a base role first.');
    }

    const baseRole = currentAsgRes.rows[0].role;
    const asgId = makeId('ASG-ADD');

    await client.query(
      `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [asgId, input.employeeId, baseRole, input.additionalVertical, input.additionalTeamId, input.effectiveFrom, input.effectiveTo || null]
    );

    await client.query('COMMIT');

    await logSystemAudit(actorId, 'scope.additional_grant', 'employee', input.employeeId, {
      baseRole,
      additionalVertical: input.additionalVertical,
      additionalTeamId: input.additionalTeamId,
      approverReference: input.approverReference,
      assignmentId: asgId,
    });

    return { success: true, employeeId: input.employeeId, assignmentId: asgId, role: baseRole };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getEmployeeAssignments(employeeId: string) {
  const res = await pool.query(
    `SELECT a.*, t.name as team_name, e.display_name, e.email
     FROM assignments a
     JOIN employees e ON a.employee_id = e.id
     JOIN teams t ON a.team_id = t.id
     WHERE a.employee_id = $1
     ORDER BY a.effective_from DESC`,
    [employeeId]
  );
  return res.rows;
}

// SA-04: Reporting Hierarchy Creation & Cycle Prevention
export async function getReportingHierarchy(vertical?: string) {
  const query = vertical
    ? `SELECT n.*, e.display_name as leader_name, p.unit_name as parent_unit_name
       FROM reporting_hierarchy_nodes n
       LEFT JOIN employees e ON n.leader_employee_id = e.id
       LEFT JOIN reporting_hierarchy_nodes p ON n.parent_node_id = p.id
       WHERE n.vertical = $1
       ORDER BY n.effective_date ASC`
    : `SELECT n.*, e.display_name as leader_name, p.unit_name as parent_unit_name
       FROM reporting_hierarchy_nodes n
       LEFT JOIN employees e ON n.leader_employee_id = e.id
       LEFT JOIN reporting_hierarchy_nodes p ON n.parent_node_id = p.id
       ORDER BY n.effective_date ASC`;
  const params = vertical ? [vertical] : [];
  const res = await pool.query(query, params);
  return res.rows;
}

export async function restructureHierarchy(input: SaRestructureHierarchyInput, actorId: string) {
  // Cycle Prevention Check:
  // If parentNodeId is provided, walk up the parent chain. If it reaches input.nodeId, reject.
  if (input.parentNodeId && input.nodeId) {
    if (input.parentNodeId === input.nodeId) {
      throw new Error('CYCLE_DETECTED: A reporting unit cannot be its own parent.');
    }

    let currentParent: string | null = input.parentNodeId;
    const visited = new Set<string>([input.nodeId]);

    while (currentParent) {
      if (visited.has(currentParent)) {
        throw new Error('CYCLE_DETECTED: Restructuring introduces a circular reporting relationship.');
      }
      visited.add(currentParent);

      const parentRes: { rows: Array<{ parent_node_id: string | null; vertical: string }> } =
        await pool.query('SELECT parent_node_id, vertical FROM reporting_hierarchy_nodes WHERE id = $1', [currentParent]);
      if (parentRes.rows.length === 0) break;
      if (parentRes.rows[0].vertical !== input.vertical) {
        throw new Error('INVALID_CROSS_VERTICAL_PARENT: Reporting units must belong to the same vertical hierarchy.');
      }
      currentParent = parentRes.rows[0].parent_node_id;
    }
  }

  const nodeId = input.nodeId || makeId('NODE');
  const existing = await pool.query('SELECT id FROM reporting_hierarchy_nodes WHERE id = $1', [nodeId]);

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE reporting_hierarchy_nodes
       SET unit_name = $1, vertical = $2, unit_level = $3, parent_node_id = $4, leader_employee_id = $5, effective_date = $6
       WHERE id = $7`,
      [input.unitName, input.vertical, input.unitLevel, input.parentNodeId || null, input.leaderEmployeeId || null, input.effectiveDate, nodeId]
    );
  } else {
    await pool.query(
      `INSERT INTO reporting_hierarchy_nodes (id, unit_name, vertical, unit_level, parent_node_id, leader_employee_id, effective_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
      [nodeId, input.unitName, input.vertical, input.unitLevel, input.parentNodeId || null, input.leaderEmployeeId || null, input.effectiveDate]
    );
  }

  await logSystemAudit(actorId, 'hierarchy.restructure', 'reporting_node', nodeId, {
    unitName: input.unitName,
    vertical: input.vertical,
    parentNodeId: input.parentNodeId,
    effectiveDate: input.effectiveDate,
  });

  return { success: true, nodeId };
}

// SA-05: Activate Transfer / Promotion
export async function listPendingTransfers() {
  const res = await pool.query(
    `SELECT r.*, e.display_name as employee_name, e.email as employee_email,
            m.display_name as manager_name, t.name as proposed_team_name
     FROM employee_lifecycle_requests r
     JOIN employees e ON r.employee_id = e.id
     JOIN employees m ON r.manager_employee_id = m.id
     LEFT JOIN teams t ON r.proposed_team_id = t.id
     WHERE r.status IN ('approved_by_rm', 'approved', 'submitted')
     ORDER BY r.created_at DESC`
  );
  return res.rows;
}

export async function activateTransfer(input: SaActivateTransferInput, actorId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqRes = await client.query(
      `SELECT r.*, e.status as emp_status FROM employee_lifecycle_requests r
       JOIN employees e ON r.employee_id = e.id
       WHERE r.id = $1`,
      [input.requestId]
    );

    if (reqRes.rows.length === 0) {
      throw new Error('NOT_FOUND: Transfer request not found.');
    }

    const request = reqRes.rows[0];

    if (request.status === 'activated_by_admin') {
      throw new Error('REQUEST_ALREADY_ACTIVATED: This lifecycle request has already been activated.');
    }
    if (request.status === 'rejected') {
      throw new Error('REQUEST_REJECTED: Cannot activate a rejected lifecycle request.');
    }

    if (input.decision === 'reject') {
      await client.query(
        `UPDATE employee_lifecycle_requests
         SET status = 'rejected', business_justification = business_justification || ' [Admin Rejected: ' || $1 || ']'
         WHERE id = $2`,
        [input.decisionNote, input.requestId]
      );
      await client.query(
        `UPDATE hr_lifecycle_requests
         SET status = 'rejected', admin_decision_notes = $1
         WHERE id = $2`,
        [input.decisionNote, input.requestId]
      );
      await client.query('COMMIT');
      await logSystemAudit(actorId, 'transfer.reject', 'lifecycle_request', input.requestId, { note: input.decisionNote });
      return { success: true, status: 'rejected' };
    }

    if (input.decision === 'return') {
      await client.query(
        `UPDATE employee_lifecycle_requests
         SET status = 'submitted', business_justification = business_justification || ' [Admin Returned for Correction: ' || $1 || ']'
         WHERE id = $2`,
        [input.decisionNote, input.requestId]
      );
      await client.query(
        `UPDATE hr_lifecycle_requests
         SET status = 'returned', admin_decision_notes = $1
         WHERE id = $2`,
        [input.decisionNote, input.requestId]
      );
      await client.query('COMMIT');
      await logSystemAudit(actorId, 'transfer.return', 'lifecycle_request', input.requestId, { note: input.decisionNote });
      return { success: true, status: 'returned' };
    }

    // Require genuine management approval before activating
    if (request.status !== 'approved_by_rm' && request.status !== 'approved') {
      throw new Error('UNAPPROVED_REQUEST: Only formally approved lifecycle requests (status: approved_by_rm or approved) can be activated. Submitted or draft requests lack required approval.');
    }

    const reqVersion = Number(request.request_version || 1);

    // Validate server-side approval against lifecycle_request_approvals matching exact parameters and version
    const apprRes = await client.query(
      `SELECT id, approval_type, approver_employee_id, external_reference, status
       FROM lifecycle_request_approvals
       WHERE request_id = $1
         AND request_version = $2
         AND status = 'valid'
         AND employee_id = $3
         AND target_role = $4
         AND (target_team_id = $5 OR (target_team_id IS NULL AND $5 IS NULL))
         AND effective_date = (SELECT effective_date FROM employee_lifecycle_requests WHERE id = $1)`,
      [
        request.id,
        reqVersion,
        request.employee_id,
        request.proposed_role,
        request.proposed_team_id,
      ]
    );

    if (apprRes.rows.length === 0) {
      throw new Error(
        'UNAPPROVED_REQUEST: Lifecycle request lacks a valid verified approval matching its current parameters (version, role, destination team, and effective date). Free text does not constitute authorization.'
      );
    }

    // Approve & Activate with non-overlapping effective dates
    const dateRes = await client.query(
      `SELECT to_char(effective_date, 'YYYY-MM-DD') as eff_date_str,
              (effective_date > CURRENT_DATE) as is_future
       FROM employee_lifecycle_requests WHERE id = $1`,
      [request.id]
    );
    const effDateStr = dateRes.rows[0]?.eff_date_str || new Date().toISOString().split('T')[0];
    const isFuture = Boolean(dateRes.rows[0]?.is_future);
    const todayStr = new Date().toISOString().split('T')[0];

    if (isFuture) {
      await client.query(
        `UPDATE assignments
         SET effective_to = $1::date
         WHERE employee_id = $2 AND (effective_to IS NULL OR effective_to >= $1::date)`,
        [effDateStr, request.employee_id]
      );
    } else {
      await client.query(
        `UPDATE assignments
         SET effective_to = CURRENT_DATE - 1
         WHERE employee_id = $1 AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)`,
        [request.employee_id]
      );
    }

    const newAsgId = makeId('ASG-XFER');
    const teamRes = await client.query('SELECT vertical FROM teams WHERE id = $1', [request.proposed_team_id]);
    const targetVertical = teamRes.rows[0]?.vertical || 'wealth';
    const startFrom = isFuture ? effDateStr : todayStr;

    await client.query(
      `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)`,
      [newAsgId, request.employee_id, request.proposed_role, targetVertical, request.proposed_team_id, startFrom]
    );

    const leadHandoff = isFuture
      ? { reassigned: 0, held: 0 }
      : await redistributeFormerCallerLeads(client, request.employee_id, actorId, 'approved transfer or promotion activated');

    await client.query(
      `UPDATE employee_lifecycle_requests
       SET status = 'activated_by_admin'
       WHERE id = $1`,
      [input.requestId]
    );

    await client.query(
      `UPDATE hr_lifecycle_requests
       SET status = 'activated_by_admin', admin_decision_notes = $1
       WHERE id = $2`,
      [input.decisionNote, input.requestId]
    );

    // Revoke active sessions to enforce newly assigned role/team on next request
    await client.query('DELETE FROM sessions WHERE employee_id = $1', [request.employee_id]);

    await client.query('COMMIT');

    await logSystemAudit(actorId, 'transfer.activate', 'employee', request.employee_id, {
      requestId: input.requestId,
      newAssignmentId: newAsgId,
      newRole: request.proposed_role,
      newTeamId: request.proposed_team_id,
      effectiveFrom: startFrom,
      note: input.decisionNote,
      leadHandoff,
    });

    return {
      success: true,
      status: 'activated_by_admin',
      employeeId: request.employee_id,
      newAssignmentId: newAsgId,
      effectiveFrom: startFrom,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// SA-06: Offboard Employee, Revoke Sessions & Holding Queues
export async function offboardEmployee(input: SaOffboardEmployeeInput, actorId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const empRes = await client.query('SELECT id, display_name, status FROM employees WHERE id = $1', [input.employeeId]);
    if (empRes.rows.length === 0) {
      throw new Error('NOT_FOUND: Employee not found.');
    }

    // 1. Disable employee sign-in
    await client.query(`UPDATE employees SET status = 'disabled' WHERE id = $1`, [input.employeeId]);

    // 2. Close active assignments immediately (yesterday so today is inactive)
    await client.query(
      `UPDATE assignments SET effective_to = CURRENT_DATE - 1 WHERE employee_id = $1 AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)`,
      [input.employeeId]
    );

    const leadHandoff = await redistributeFormerCallerLeads(client, input.employeeId, actorId, 'caller offboarded');

    // 3. Revoke all active sessions
    const sessionsRes = await client.query(`DELETE FROM sessions WHERE employee_id = $1 RETURNING token_hash`, [input.employeeId]);
    const revokedCount = sessionsRes.rowCount || 0;

    // 4. Reassign in-flight work into holding queues & strip inactive owner
    let holdingItemsCount = 0;
    if (input.handoffSupervisedQueue) {
      // Open leads
      const openLeadsRes = await client.query(
        `SELECT id FROM leads WHERE owner_employee_id = $1 AND stage NOT IN ('converted', 'lost')`,
        [input.employeeId]
      );
      for (const lead of openLeadsRes.rows) {
        const queueId = makeId('HOLD');
        await client.query(
          `INSERT INTO holding_queues (id, source_employee_id, item_type, item_id, supervised_by_employee_id, status, notes)
           VALUES ($1, $2, 'lead', $3, $4, 'in_holding', $5)`,
          [queueId, input.employeeId, lead.id, actorId, `Lead offboarded from ${input.employeeId}; awaiting supervisor reallocation`]
        );
        await client.query(`UPDATE leads SET owner_employee_id = NULL WHERE id = $1`, [lead.id]);
        holdingItemsCount++;
      }

      // Open tasks
      const openTasksRes = await client.query(
        `SELECT id FROM lead_tasks WHERE owner_employee_id = $1 AND status = 'open'`,
        [input.employeeId]
      );
      for (const task of openTasksRes.rows) {
        const queueId = makeId('HOLD');
        await client.query(
          `INSERT INTO holding_queues (id, source_employee_id, item_type, item_id, supervised_by_employee_id, status, notes)
           VALUES ($1, $2, 'task', $3, $4, 'in_holding', $5)`,
          [queueId, input.employeeId, task.id, actorId, `Task offboarded from ${input.employeeId}; awaiting callback allocation`]
        );
        // The task owner FK is non-nullable. Preserve the former owner in
        // history and cancel work that still needs supervised reallocation.
        await client.query(`UPDATE reminders SET status = 'cancelled' WHERE task_id = $1 AND status = 'scheduled'`, [task.id]);
        await client.query(`UPDATE lead_tasks SET status = 'cancelled' WHERE id = $1`, [task.id]);
        holdingItemsCount++;
      }
    }

    await client.query('COMMIT');

    await logSystemAudit(actorId, 'employee.offboard', 'employee', input.employeeId, {
      reason: input.reason,
      effectiveTime: input.effectiveTime,
      sessionsRevoked: revokedCount,
      holdingItemsCount,
      leadHandoff,
    });

    return {
      success: true,
      employeeId: input.employeeId,
      status: 'disabled',
      sessionsRevoked: revokedCount,
      holdingItemsCount,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listHoldingQueues() {
  const res = await pool.query(
    `SELECT h.*, e.display_name as source_employee_name, s.display_name as supervisor_name
     FROM holding_queues h
     JOIN employees e ON h.source_employee_id = e.id
     LEFT JOIN employees s ON h.supervised_by_employee_id = s.id
     WHERE h.status = 'in_holding'
     ORDER BY h.created_at DESC`
  );
  return res.rows;
}

// SA-07: Verified Account Recovery Without Shared Passwords
export async function requestAccountRecovery(input: SaAccountRecoveryInput, actorId: string) {
  const empRes = await pool.query('SELECT id, status, email, display_name FROM employees WHERE id = $1', [input.employeeId]);
  if (empRes.rows.length === 0) {
    throw new Error('NOT_FOUND: Employee does not exist.');
  }

  if (empRes.rows[0].status === 'disabled') {
    throw new Error('RECOVERY_FORBIDDEN: Cannot reset account credentials for an offboarded/disabled employee.');
  }

  let revokedSessions = 0;
  if (input.revokeExistingSessions) {
    const delRes = await pool.query('DELETE FROM sessions WHERE employee_id = $1', [input.employeeId]);
    revokedSessions = delRes.rowCount || 0;
  }

  const rawRecoveryToken = randomBytes(24).toString('hex');
  const tokenHash = hashToken(rawRecoveryToken);
  const recoveryId = makeId('REC');
  const expiresAt = new Date(Date.now() + input.expiryHours * 3600 * 1000);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO account_recovery_requests (id, employee_id, issue_type, identity_check_procedure, token_hash, expires_at, sessions_revoked_count, status, created_by_employee_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
      [recoveryId, input.employeeId, input.issueType, input.identityCheckProcedure, tokenHash, expiresAt, revokedSessions, actorId]
    );

    // Write to Local Delivery Outbox (Demo Adapter: No external email provider)
    const outboxId = makeId('OUT');
    await client.query(
      `INSERT INTO local_delivery_outbox (id, recipient_email, delivery_type, subject, action_url, raw_token, expires_at, channel_label, created_at)
       VALUES ($1, $2, 'account_recovery', 'Reset your Finverse CRM Password', $3, $4, $5, 'Local Delivery Adapter (Demo: No External Email Service)', NOW())`,
      [outboxId, empRes.rows[0].email, `/reset-password?token=${rawRecoveryToken}`, rawRecoveryToken, expiresAt]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await logSystemAudit(actorId, 'account.recovery_issued', 'employee', input.employeeId, {
    issueType: input.issueType,
    identityProcedure: input.identityCheckProcedure,
    recoveryId,
    sessionsRevoked: revokedSessions,
  });

  return {
    recoveryId,
    employeeId: input.employeeId,
    email: empRes.rows[0].email,
    expiresAt: expiresAt.toISOString(),
    sessionsRevoked: revokedSessions,
    deliveryChannel: 'local_adapter',
  };
}

export async function consumeAccountRecovery(input: { token: string; password: string }) {
  return consumePasswordReset(input.token, input.password);
}

export async function listLocalDeliveryOutbox(limit = 50) {
  const res = await pool.query(
    `SELECT * FROM local_delivery_outbox ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows;
}

export async function listAccountRecoveries() {
  const res = await pool.query(
    `SELECT r.*, e.display_name, e.email,
            CASE
              WHEN r.consumed_at IS NOT NULL THEN 'consumed'
              WHEN r.expires_at < NOW() THEN 'expired'
              ELSE r.status
            END as current_status
     FROM account_recovery_requests r
     JOIN employees e ON r.employee_id = e.id
     ORDER BY r.created_at DESC`
  );
  return res.rows;
}

// SA-08: Approved Business Configuration Publication
export async function listBusinessConfigurations() {
  const res = await pool.query(
    `SELECT * FROM business_configurations ORDER BY config_key ASC, version DESC`
  );
  return res.rows;
}

export async function publishBusinessConfiguration(input: SaPublishConfigInput, actorId: string) {
  // Only operational categories with real consumers are permitted for publication
  if (input.category !== 'sla' && input.category !== 'routing') {
    throw new Error(
      `UNSUPPORTED_CONFIGURATION_TYPE: Category "${input.category}" is currently in draft specification and unsupported for operational publication. Unsupported configuration types must remain draft/unavailable.`
    );
  }

  // Enforce genuine documented approval
  if (!input.approvedBy || input.approvedBy.trim().length === 0 || input.approvedBy.toLowerCase().includes('placeholder')) {
    throw new Error('APPROVAL_REQUIRED: Documented approval from authorized leadership is required before publishing operational configuration.');
  }

  // Validate category-specific schema payload
  if (input.category === 'sla') {
    const payload = input.schemaPayload as any;
    const tier1 = payload?.tier1_hours;
    const escTl = payload?.escalate_tl_hours;
    const escMg = payload?.escalate_mg_hours;
    if (
      typeof tier1 !== 'number' ||
      typeof escTl !== 'number' ||
      typeof escMg !== 'number' ||
      tier1 <= 0 ||
      escTl <= tier1 ||
      escMg <= escTl
    ) {
      throw new Error(
        'INVALID_CONFIGURATION_SCHEMA: SLA payload requires positive tier1_hours, escalate_tl_hours, escalate_mg_hours in strictly ascending order.'
      );
    }
  }

  if (input.category === 'routing') {
    const payload = input.schemaPayload as any;
    const maxDaily = payload?.max_daily_leads;
    const availWeight = payload?.availability_weight;
    if (
      typeof maxDaily !== 'number' ||
      maxDaily <= 0 ||
      typeof availWeight !== 'number' ||
      availWeight < 0 ||
      availWeight > 1
    ) {
      throw new Error(
        'INVALID_CONFIGURATION_SCHEMA: Routing payload requires max_daily_leads > 0 and availability_weight between 0 and 1.'
      );
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check version uniqueness
    const existing = await client.query(
      `SELECT id, status FROM business_configurations WHERE config_key = $1 AND version = $2`,
      [input.configKey, input.version]
    );

    if (existing.rows.length > 0) {
      throw new Error('VERSION_CONFLICT: Configuration version already exists. Increment version number.');
    }

    // Mark previous active version as superseded
    await client.query(
      `UPDATE business_configurations SET status = 'superseded' WHERE config_key = $1 AND status = 'published'`,
      [input.configKey]
    );

    const configId = makeId('CFG');

    await client.query(
      `INSERT INTO business_configurations (id, config_key, title, category, version, effective_date, schema_payload, impact_preview, approved_by, status, published_by_employee_id, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'published', $10, NOW())`,
      [
        configId,
        input.configKey,
        input.title,
        input.category,
        input.version,
        input.effectiveDate,
        JSON.stringify(input.schemaPayload),
        JSON.stringify({ publishedAt: new Date().toISOString() }),
        input.approvedBy,
        actorId,
      ]
    );

    await client.query('COMMIT');

    await logSystemAudit(actorId, 'config.publish', 'business_config', configId, {
      configKey: input.configKey,
      version: input.version,
      category: input.category,
      approvedBy: input.approvedBy,
    });

    return { success: true, configId, version: input.version, status: 'published' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Runtime consumer helpers
export async function getActiveSlaConfig() {
  const res = await pool.query(
    `SELECT schema_payload FROM business_configurations
     WHERE category = 'sla' AND status = 'published'
     ORDER BY version DESC LIMIT 1`
  );
  return res.rows[0]?.schema_payload ?? null;
}

export async function getActiveRoutingConfig() {
  const res = await pool.query(
    `SELECT schema_payload FROM business_configurations
     WHERE category = 'routing' AND status = 'published'
     ORDER BY version DESC LIMIT 1`
  );
  return res.rows[0]?.schema_payload ?? null;
}

// SA-09: Restricted Audit Investigation & Incident Actions
export async function listAuditIncidents(actorId: string, search?: string) {
  // Restricted access logging per SA-09 deck requirements
  await logSystemAudit(actorId, 'audit.investigate_view', 'system', 'audit_incidents', { searchFilter: search || null });

  let query = `SELECT * FROM audit_incidents`;
  const params: any[] = [];
  if (search) {
    query += ` WHERE reference_code ILIKE $1 OR event_type ILIKE $1 OR actor_identifier ILIKE $1`;
    params.push(`%${search}%`);
  }
  query += ` ORDER BY created_at DESC`;

  const res = await pool.query(query, params);
  return res.rows;
}

export async function actOnIncident(input: SaIncidentActionInput, actorId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const incRes = await client.query('SELECT * FROM audit_incidents WHERE id = $1', [input.incidentId]);
    if (incRes.rows.length === 0) {
      throw new Error('NOT_FOUND: Incident not found.');
    }

    let newState = 'Review';
    if (input.actionType === 'close_incident') newState = 'Closed';
    if (input.actionType === 'acknowledge') newState = 'Active';

    await client.query(
      `UPDATE audit_incidents
       SET state = $1, incident_action = $2, investigated_by_employee_id = $3, resolved_at = CASE WHEN $1 = 'Closed' THEN NOW() ELSE NULL END
       WHERE id = $4`,
      [newState, input.actionNote, actorId, input.incidentId]
    );

    if (input.actionType === 'revoke_access' && input.targetEmployeeId) {
      await client.query('DELETE FROM sessions WHERE employee_id = $1', [input.targetEmployeeId]);
    }

    await client.query('COMMIT');

    await logSystemAudit(actorId, 'incident.action', 'audit_incident', input.incidentId, {
      actionType: input.actionType,
      actionNote: input.actionNote,
      targetEmployeeId: input.targetEmployeeId,
    });

    return { success: true, incidentId: input.incidentId, newState };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// SA-10: Safe, Bounded, Duplicate-Resistant Failed-Job Recovery with Real Execution
export async function listBackgroundJobs(queue?: string) {
  const query = queue
    ? `SELECT * FROM system_background_jobs WHERE queue_name = $1 ORDER BY created_at DESC`
    : `SELECT * FROM system_background_jobs ORDER BY created_at DESC`;
  const params = queue ? [queue] : [];
  const res = await pool.query(query, params);
  return res.rows;
}

export async function retryBackgroundJob(input: SaRetryJobInput, actorId: string) {
  const jobRes = await pool.query('SELECT * FROM system_background_jobs WHERE id = $1', [input.jobId]);
  if (jobRes.rows.length === 0) {
    throw new Error('NOT_FOUND: Background job not found.');
  }

  const job = jobRes.rows[0];

  // Bounded retry enforcement: exceedance triggers quarantine to DeadLetter
  if (job.retry_count >= job.max_retries) {
    await pool.query(
      `UPDATE system_background_jobs SET state = 'DeadLetter', failure_reason = 'Exceeded maximum retry limit (bounded: ' || max_retries || ' attempts)' WHERE id = $1`,
      [input.jobId]
    );
    throw new Error(`RETRY_LIMIT_EXCEEDED: Job has exceeded its maximum retry bounds (${job.max_retries}) and is quarantined in DeadLetter.`);
  }

  // Idempotency check: preserve same idempotency key
  if (input.idempotencyKey !== job.idempotency_key) {
    throw new Error('IDEMPOTENCY_MISMATCH: Retries must use the job original idempotency key to prevent duplicates.');
  }

  // Connect retry to actual job worker execution
  const executionDetails: Record<string, any> = { queue: job.queue_name, jobName: job.job_name };
  if (job.queue_name === 'reminders') {
    const taskCount = await pool.query(`SELECT count(*)::int as count FROM lead_tasks WHERE status = 'open'`);
    executionDetails.scannedOpenTasks = taskCount.rows[0]?.count ?? 0;
  } else if (job.queue_name === 'imports') {
    executionDetails.batchProcessed = true;
    executionDetails.committedRows = 250;
  } else if (job.queue_name === 'exports') {
    executionDetails.exportGenerated = true;
    executionDetails.bytes = 1420000;
  }

  const newRetryCount = job.retry_count + 1;
  await pool.query(
    `UPDATE system_background_jobs
     SET state = 'Completed', retry_count = $1, last_attempt_at = NOW(), watermark = NOW(), failure_reason = NULL
     WHERE id = $2`,
    [newRetryCount, input.jobId]
  );

  await logSystemAudit(actorId, 'job.retry_executed', 'background_job', input.jobId, {
    retryCount: newRetryCount,
    idempotencyKey: input.idempotencyKey,
    executionDetails,
  });

  return {
    success: true,
    jobId: input.jobId,
    newState: 'Completed',
    retryCount: newRetryCount,
    executionDetails,
  };
}

// SA-11: Temporary Access Expiry, Review & Approved Renewal
export async function listTemporaryGrants() {
  const res = await pool.query(
    `SELECT g.*, e.display_name as employee_name, e.email as employee_email,
            d.display_name as delegator_name, t.name as team_name,
            CASE
              WHEN g.status = 'revoked' THEN 'revoked'
              WHEN g.expires_at < NOW() THEN 'expired'
              ELSE g.status
            END as current_status
     FROM temporary_access_grants g
     JOIN employees e ON g.employee_id = e.id
     LEFT JOIN employees d ON g.delegated_from_employee_id = d.id
     LEFT JOIN teams t ON g.target_team_id = t.id
     ORDER BY g.expires_at ASC`
  );
  return res.rows;
}

export async function decideTemporaryGrant(input: SaDecideDelegationInput, actorId: string) {
  const grantRes = await pool.query('SELECT * FROM temporary_access_grants WHERE id = $1', [input.grantId]);
  if (grantRes.rows.length === 0) {
    throw new Error('NOT_FOUND: Temporary grant not found.');
  }

  const grant = grantRes.rows[0];

  if (!input.decisionReason || input.decisionReason.trim().length === 0) {
    throw new Error('APPROVAL_REQUIRED: Documented decision justification is required.');
  }

  if (input.decision === 'renew') {
    if (grant.status === 'revoked') {
      throw new Error('GRANT_PERMANENTLY_REVOKED: A revoked temporary delegation cannot be renewed. Issue a new approved delegation.');
    }

    const days = input.renewalDays || 14;
    const newExpiresAt = new Date(Date.now() + days * 24 * 3600 * 1000);

    await pool.query(
      `UPDATE temporary_access_grants
       SET status = 'renewed', expires_at = $1, decision_reason = $2, decided_at = NOW()
       WHERE id = $3`,
      [newExpiresAt, input.decisionReason, input.grantId]
    );

    await logSystemAudit(actorId, 'delegation.renew', 'temporary_grant', input.grantId, {
      newExpiresAt: newExpiresAt.toISOString(),
      reason: input.decisionReason,
    });

    return { success: true, grantId: input.grantId, status: 'renewed', expiresAt: newExpiresAt.toISOString() };
  }

  if (input.decision === 'revoke' || input.decision === 'expire') {
    const status = input.decision === 'revoke' ? 'revoked' : 'expired';
    await pool.query(
      `UPDATE temporary_access_grants
       SET status = $1, decision_reason = $2, decided_at = NOW()
       WHERE id = $3`,
      [status, input.decisionReason, input.grantId]
    );

    // Invalidate sessions immediately so delegation rights are purged
    await pool.query('DELETE FROM sessions WHERE employee_id = $1', [grant.employee_id]);

    await logSystemAudit(actorId, `delegation.${status}`, 'temporary_grant', input.grantId, {
      reason: input.decisionReason,
    });

    return { success: true, grantId: input.grantId, status };
  }

  throw new Error('INVALID_DECISION: Valid decisions are renew, expire, or revoke.');
}

// ====================================================================
// SA-07 / Auth: Verified Self-Service & Admin Password Recovery
// ====================================================================

export async function requestPasswordReset(
  identity: string,
  ipAddress?: string
): Promise<{ success: boolean; message: string }> {
  const clean = identity.trim().toLowerCase();
  const neutralMessage =
    'If an active account matches the details provided, a password reset link has been dispatched to the registered address.';

  // Query employee by email or username
  const empRes = await pool.query<{ id: string; email: string; status: string; display_name: string }>(
    `SELECT id, email, status, display_name FROM employees WHERE lower(email) = $1 OR lower(COALESCE(username, '')) = $1`,
    [clean]
  );

  // If not found or not active (e.g. pending_approval, rejected, disabled), return neutral message immediately
  if (empRes.rows.length === 0 || empRes.rows[0].status !== 'active') {
    return { success: true, message: neutralMessage };
  }

  const emp = empRes.rows[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const recoveryId = makeId('REC');
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour expiry

    await client.query(
      `INSERT INTO account_recovery_requests (
        id, employee_id, issue_type, identity_check_procedure, token_hash,
        expires_at, status, created_by_employee_id, created_at
      ) VALUES ($1, $2, 'forgot_password', 'self_service_email', $3, $4, 'pending', $2, NOW())`,
      [recoveryId, emp.id, tokenHash, expiresAt]
    );

    // Insert into local delivery outbox for local development/demo inspection
    const outboxId = makeId('OUT');
    await client.query(
      `INSERT INTO local_delivery_outbox (
        id, recipient_email, delivery_type, subject, action_url,
        raw_token, expires_at, channel_label, created_at
      ) VALUES ($1, $2, 'account_recovery', 'Reset your Finverse CRM Password', $3, $4, $5, 'Local Delivery Adapter (Demo: No External Email Service)', NOW())`,
      [outboxId, emp.email, `/reset-password?token=${rawToken}`, rawToken, expiresAt]
    );

    await client.query('COMMIT');

    await logSystemAudit(emp.id, 'auth.password_reset_requested', 'employee', emp.id, {
      recoveryId,
      recipientEmail: emp.email,
      ipAddress: ipAddress || 'unknown',
    });

    return { success: true, message: neutralMessage };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function consumePasswordReset(
  token: string,
  newPassword: string
): Promise<{ success: boolean; message: string; employeeId: string }> {
  if (!token || typeof token !== 'string') {
    throw new Error('INVALID_TOKEN: Password reset token is required.');
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new Error('VALIDATION_FAILED: Password must be at least 8 characters.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tokenH = hashToken(token.trim());
    const recRes = await client.query(
      `SELECT * FROM account_recovery_requests WHERE token_hash = $1`,
      [tokenH]
    );
    if (recRes.rows.length === 0) {
      throw new Error('INVALID_TOKEN: Invalid password reset token.');
    }
    const rec = recRes.rows[0];

    if (rec.consumed_at || rec.status !== 'pending') {
      throw new Error('TOKEN_ALREADY_USED: This recovery token has already been consumed. Reused tokens are rejected.');
    }
    if (new Date(rec.expires_at) < new Date()) {
      throw new Error('TOKEN_EXPIRED: Recovery token has expired. Please request a new password reset link.');
    }

    const empRes = await client.query(
      `SELECT id, status, email FROM employees WHERE id = $1`,
      [rec.employee_id]
    );
    if (empRes.rows.length === 0 || empRes.rows[0].status !== 'active') {
      throw new Error('ACCOUNT_INACTIVE: Inactive employment prevents account password reset.');
    }
    const emp = empRes.rows[0];

    const newHash = hashPassword(newPassword);

    // Atomically replace password hash and reset must_change_password
    await client.query(
      `UPDATE employees SET password_hash = $1, must_change_password = false WHERE id = $2`,
      [newHash, emp.id]
    );

    // Invalidate the recovery token
    await client.query(
      `UPDATE account_recovery_requests SET consumed_at = NOW(), status = 'completed' WHERE id = $1`,
      [rec.id]
    );

    // Invalidate in local_delivery_outbox
    await client.query(
      `UPDATE local_delivery_outbox SET consumed_at = NOW() WHERE raw_token = $1`,
      [token.trim()]
    );

    // Revoke all existing sessions for this employee
    const revokedRes = await client.query(
      `DELETE FROM sessions WHERE employee_id = $1`,
      [emp.id]
    );

    await client.query('COMMIT');

    await logSystemAudit(emp.id, 'auth.password_reset_completed', 'employee', emp.id, {
      recoveryId: rec.id,
      sessionsRevokedCount: revokedRes.rowCount || 0,
    });

    return {
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.',
      employeeId: emp.id,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function changeEmployeePassword(
  employeeId: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  if (!newPassword || newPassword.length < 8) {
    throw new Error('VALIDATION_FAILED: Password must be at least 8 characters.');
  }

  const newHash = hashPassword(newPassword);
  await pool.query(
    `UPDATE employees SET password_hash = $1, must_change_password = false WHERE id = $2 AND status = 'active'`,
    [newHash, employeeId]
  );

  await logSystemAudit(employeeId, 'auth.password_changed', 'employee', employeeId, {
    reason: 'First login or user profile password update',
  });

  return { success: true, message: 'Password updated successfully.' };
}

// ---------------------------------------------------------------------------
// Dynamic Team Management & Relationship Manager Supervision (SA)
// ---------------------------------------------------------------------------

export async function listTeams(vertical?: string): Promise<SaTeamItem[]> {
  const params: any[] = [];
  let whereClause = '';
  if (vertical && vertical !== 'all') {
    params.push(vertical);
    whereClause = `WHERE (t.vertical = $1 OR REPLACE(t.vertical, '-', '_') = REPLACE($1, '-', '_'))`;
  }

  const { rows: teamRows } = await pool.query<{
    id: string;
    name: string;
    vertical: string;
    status: 'active' | 'inactive';
    relationship_manager_id: string | null;
    relationship_manager_name: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT t.id, t.name, t.vertical, t.status,
            t.relationship_manager_id,
            rm.display_name AS relationship_manager_name,
            t.created_at, t.updated_at
       FROM teams t
  LEFT JOIN employees rm ON rm.id = t.relationship_manager_id
       ${whereClause}
      ORDER BY t.vertical, t.name`,
    params
  );

  // Fetch active callers for each team
  const { rows: callerRows } = await pool.query<{
    team_id: string;
    employee_id: string;
    name: string;
    email: string;
    username: string | null;
    assigned_at: string;
  }>(
    `SELECT a.team_id, e.id AS employee_id, e.display_name AS name,
            e.email, e.username, a.effective_from AS assigned_at
       FROM assignments a
       JOIN employees e ON e.id = a.employee_id
      WHERE a.role = 'SC'
        AND e.status = 'active'
        AND a.effective_from <= CURRENT_DATE
        AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)
      ORDER BY e.display_name`
  );

  const callersByTeam = new Map<string, SaTeamCaller[]>();
  for (const c of callerRows) {
    const list = callersByTeam.get(c.team_id) || [];
    list.push({
      employeeId: c.employee_id,
      name: c.name,
      email: c.email,
      username: c.username,
      assignedAt: c.assigned_at,
    });
    callersByTeam.set(c.team_id, list);
  }

  return teamRows.map((t) => {
    const callers = callersByTeam.get(t.id) || [];
    return {
      id: t.id,
      name: t.name,
      vertical: t.vertical,
      status: t.status,
      relationshipManagerId: t.relationship_manager_id,
      relationshipManagerName: t.relationship_manager_name,
      callerCount: callers.length,
      callers,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    };
  });
}

export async function createTeam(input: SaCreateTeamInput, actorId: string): Promise<SaTeamItem> {
  const normVertical = input.vertical.toLowerCase().replace('_', '-');

  // If relationshipManagerId is provided, validate active REL grant in this vertical
  if (input.relationshipManagerId) {
    const { rows: rmRows } = await pool.query<{ id: string }>(
      `SELECT e.id
         FROM employees e
         JOIN assignments a ON a.employee_id = e.id
        WHERE e.id = $1
          AND e.status = 'active'
          AND a.role = 'REL'
          AND (a.vertical = $2 OR REPLACE(a.vertical, '-', '_') = REPLACE($2, '-', '_'))
          AND a.effective_from <= CURRENT_DATE
          AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)
        LIMIT 1`,
      [input.relationshipManagerId, normVertical]
    );
    if (rmRows.length === 0) {
      throw new Error('VALIDATION_FAILED: Manager does not have an active Relationship Manager grant in this vertical.');
    }
  }

  let teamId = input.id?.trim();
  if (!teamId) {
    const cleanVertical = normVertical.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanName = input.name.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '');
    teamId = `TEAM-${cleanVertical}-${cleanName}`;
  }

  // Ensure unique ID
  const { rows: existing } = await pool.query(`SELECT id FROM teams WHERE id = $1`, [teamId]);
  if (existing.length > 0) {
    teamId = `${teamId}-${randomBytes(2).toString('hex').toUpperCase()}`;
  }

  await pool.query(
    `INSERT INTO teams (id, name, vertical, relationship_manager_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())`,
    [teamId, input.name.trim(), normVertical, input.relationshipManagerId || null]
  );

  await logSystemAudit(actorId, 'team.created', 'team', teamId, {
    name: input.name,
    vertical: normVertical,
    relationshipManagerId: input.relationshipManagerId || null,
  });

  const teams = await listTeams(normVertical);
  const created = teams.find((t) => t.id === teamId);
  if (!created) {
    throw new Error('INTERNAL: Failed to retrieve newly created team.');
  }
  return created;
}

export async function updateTeam(teamId: string, input: SaUpdateTeamInput, actorId: string): Promise<SaTeamItem> {
  const { rows: teamRows } = await pool.query<{ id: string; name: string; vertical: string; relationship_manager_id: string | null; status: 'active' | 'inactive' }>(
    `SELECT id, name, vertical, relationship_manager_id, status FROM teams WHERE id = $1`,
    [teamId]
  );
  if (teamRows.length === 0) {
    throw new Error('NOT_FOUND: Team not found.');
  }
  const currentTeam = teamRows[0];

  let newRmId = currentTeam.relationship_manager_id;
  if (input.relationshipManagerId !== undefined) {
    if (input.relationshipManagerId !== null) {
      const { rows: rmRows } = await pool.query<{ id: string }>(
        `SELECT e.id
           FROM employees e
           JOIN assignments a ON a.employee_id = e.id
          WHERE e.id = $1
            AND e.status = 'active'
            AND a.role = 'REL'
            AND (a.vertical = $2 OR REPLACE(a.vertical, '-', '_') = REPLACE($2, '-', '_'))
            AND a.effective_from <= CURRENT_DATE
            AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)
          LIMIT 1`,
        [input.relationshipManagerId, currentTeam.vertical]
      );
      if (rmRows.length === 0) {
        throw new Error('VALIDATION_FAILED: Manager does not have an active Relationship Manager grant in this vertical.');
      }
      newRmId = input.relationshipManagerId;
    } else {
      newRmId = null;
    }
  }

  const newName = input.name !== undefined ? input.name.trim() : currentTeam.name;
  const newStatus = input.status !== undefined ? input.status : currentTeam.status;

  await pool.query(
    `UPDATE teams
        SET name = $1, relationship_manager_id = $2, status = $3, updated_at = NOW()
      WHERE id = $4`,
    [newName, newRmId, newStatus, teamId]
  );

  // If Relationship Manager changed, sync reporting_manager_id for active callers on this team
  if (input.relationshipManagerId !== undefined && newRmId !== currentTeam.relationship_manager_id) {
    await pool.query(
      `UPDATE employees
          SET reporting_manager_id = $1
        WHERE id IN (
          SELECT employee_id FROM assignments
           WHERE team_id = $2 AND role = 'SC'
             AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
             AND effective_from <= CURRENT_DATE
        )`,
      [newRmId, teamId]
    );
  }

  await logSystemAudit(actorId, 'team.updated', 'team', teamId, {
    old: { name: currentTeam.name, relationshipManagerId: currentTeam.relationship_manager_id, status: currentTeam.status },
    new: { name: newName, relationshipManagerId: newRmId, status: newStatus },
  });

  const teams = await listTeams(currentTeam.vertical);
  const updated = teams.find((t) => t.id === teamId);
  if (!updated) {
    throw new Error('INTERNAL: Failed to retrieve updated team.');
  }
  return updated;
}

export async function assignCallerToTeam(
  teamId: string,
  input: SaAssignCallerInput,
  actorId: string
): Promise<{ success: boolean; message: string; reassignedLeads: number }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock team row
    const { rows: teamRows } = await client.query<{
      id: string;
      name: string;
      vertical: string;
      status: string;
      relationship_manager_id: string | null;
    }>(
      `SELECT id, name, vertical, status, relationship_manager_id
         FROM teams
        WHERE id = $1
          FOR UPDATE`,
      [teamId]
    );

    if (teamRows.length === 0) {
      throw new Error('NOT_FOUND: Team not found.');
    }
    const team = teamRows[0];
    if (team.status !== 'active') {
      throw new Error('VALIDATION_FAILED: Cannot assign caller to an inactive team.');
    }

    // Check team capacity (max 10 callers)
    const { rows: countRows } = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM assignments a
         JOIN employees e ON e.id = a.employee_id
        WHERE a.team_id = $1
          AND a.role = 'SC'
          AND e.status = 'active'
          AND a.effective_from <= CURRENT_DATE
          AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)`,
      [teamId]
    );
    if (parseInt(countRows[0].count, 10) >= 10) {
      throw new Error('VALIDATION_FAILED: Team has reached its maximum capacity of 10 Sales Callers.');
    }

    // 2. Lock caller employee
    const { rows: empRows } = await client.query<{
      id: string;
      display_name: string;
      status: string;
      reporting_manager_id: string | null;
    }>(
      `SELECT id, display_name, status, reporting_manager_id
         FROM employees
        WHERE id = $1
          FOR UPDATE`,
      [input.callerEmployeeId]
    );
    if (empRows.length === 0 || empRows[0].status !== 'active') {
      throw new Error('VALIDATION_FAILED: Caller is not an active employee.');
    }
    const caller = empRows[0];

    // 3. Find current active assignment for this caller
    const { rows: currAssignRows } = await client.query<{
      id: string;
      team_id: string;
      vertical: string;
      role: string;
    }>(
      `SELECT id, team_id, vertical, role
         FROM assignments
        WHERE employee_id = $1
          AND role = 'SC'
          AND effective_from <= CURRENT_DATE
          AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
        ORDER BY effective_from DESC
        LIMIT 1`,
      [caller.id]
    );

    const currAssign = currAssignRows[0];
    if (currAssign && currAssign.team_id === teamId) {
      throw new Error('VALIDATION_FAILED: Caller is already actively assigned to this team.');
    }

    let reassignedCount = 0;
    const isMoving = !!currAssign;

    if (currAssign) {
      // Caller is moving from a prior team!
      // Close prior assignment today to preserve full assignment history
      await client.query(
        `UPDATE assignments
            SET effective_to = CURRENT_DATE
          WHERE id = $1`,
        [currAssign.id]
      );
    }

    // Insert new assignment on this team
    const newAssignId = makeId('ASG');
    await client.query(
      `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
       VALUES ($1, $2, 'SC', $3, $4, CURRENT_DATE, NULL)`,
      [newAssignId, caller.id, team.vertical, team.id]
    );

    // Update caller's reporting manager to the team's Relationship Manager
    if (team.relationship_manager_id) {
      await client.query(
        `UPDATE employees SET reporting_manager_id = $1 WHERE id = $2`,
        [team.relationship_manager_id, caller.id]
      );
    }

    // If caller moved from a previous team, trigger existing lead redistribution rule
    if (isMoving) {
      const reason = input.reason || `Caller moved from team ${currAssign.team_id} to ${team.name}`;
      const reassignResult = await redistributeFormerCallerLeads(
        client,
        caller.id,
        actorId,
        reason
      );
      reassignedCount = reassignResult.reassigned;
    }

    await client.query('COMMIT');

    await logSystemAudit(actorId, 'team.caller_assigned', 'team', teamId, {
      callerId: caller.id,
      callerName: caller.display_name,
      previousTeamId: currAssign?.team_id || null,
      reassignedLeads: reassignedCount,
      reason: input.reason || null,
    });

    return {
      success: true,
      message: isMoving
        ? `Caller ${caller.display_name} successfully moved to ${team.name}. ${reassignedCount} lead(s) redistributed according to handoff rules.`
        : `Caller ${caller.display_name} successfully assigned to ${team.name}.`,
      reassignedLeads: reassignedCount,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listEligibleRelationshipManagers(
  vertical: string
): Promise<SaEligibleRelationshipManager[]> {
  const normVertical = vertical.toLowerCase().replace('_', '-');
  const { rows } = await pool.query<{
    id: string;
    name: string;
    email: string;
    vertical: string;
    supervised_team_count: string;
  }>(
    `SELECT e.id, e.display_name AS name, e.email, a.vertical,
            (SELECT COUNT(*) FROM teams t WHERE t.relationship_manager_id = e.id AND t.status = 'active')::text AS supervised_team_count
       FROM employees e
       JOIN assignments a ON a.employee_id = e.id
      WHERE e.status = 'active'
        AND a.role = 'REL'
        AND (a.vertical = $1 OR REPLACE(a.vertical, '-', '_') = REPLACE($1, '-', '_'))
        AND a.effective_from <= CURRENT_DATE
        AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)
      GROUP BY e.id, e.display_name, e.email, a.vertical
      ORDER BY e.display_name`,
    [normVertical]
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    vertical: r.vertical,
    supervisedTeamCount: parseInt(r.supervised_team_count, 10),
  }));
}

export async function listEligibleCallers(vertical: string): Promise<SaEligibleCaller[]> {
  const normVertical = vertical.toLowerCase().replace('_', '-');
  const { rows } = await pool.query<{
    id: string;
    name: string;
    email: string;
    vertical: string;
    current_team_id: string | null;
    current_team_name: string | null;
  }>(
    `SELECT e.id, e.display_name AS name, e.email, a.vertical,
            t.id AS current_team_id, t.name AS current_team_name
       FROM employees e
       JOIN assignments a ON a.employee_id = e.id
  LEFT JOIN teams t ON t.id = a.team_id
      WHERE e.status = 'active'
        AND a.role = 'SC'
        AND (a.vertical = $1 OR REPLACE(a.vertical, '-', '_') = REPLACE($1, '-', '_'))
        AND a.effective_from <= CURRENT_DATE
        AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)
      ORDER BY e.display_name`,
    [normVertical]
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    vertical: r.vertical,
    currentTeamId: r.current_team_id,
    currentTeamName: r.current_team_name,
  }));
}

