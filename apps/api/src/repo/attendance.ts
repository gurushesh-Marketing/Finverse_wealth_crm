import { Pool, type PoolClient } from 'pg';
import { env } from '../config';
import type {
  CheckInInput,
  CheckOutInput,
  ProgressLogInput,
  RegularizationRequestInput,
  RegularizationDecisionInput,
  SupervisorReviewInput,
  ResourceViewQuery,
  AttendanceRecord,
  AttendanceProgressLogRecord,
  AttendanceRegularizationRecord,
  CalendarHolidayRecord,
  DailyResourceBreakdownItem,
  ResourceViewPayload,
  ResourceSummaryMetrics,
} from '@finverse/contracts';
import { resolveSuperiorForEmployee } from './leave';

const pool = new Pool({ connectionString: env.DATABASE_URL });

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface ActorSession {
  employeeId: string;
  role: string;
  verticalGrants: string[];
  teamGrants?: string[];
  displayName?: string;
}

// ============================================================================
// 1. Employee Attendance: Check-In & Check-Out
// ============================================================================

export async function checkInEmployee(
  actor: ActorSession,
  input: CheckInInput
): Promise<AttendanceRecord> {
  const client = await pool.connect();
  try {
    const today = input.workDate || new Date().toISOString().slice(0, 10);

    // Check if record exists for this employee and date
    const existing = await client.query(
      `SELECT * FROM attendance_records WHERE employee_id = $1 AND work_date = $2`,
      [actor.employeeId, today]
    );

    if (existing.rows.length > 0) {
      const err: any = new Error(`Already checked in for work date ${today}.`);
      err.status = 409;
      err.code = 'ALREADY_CHECKED_IN';
      throw err;
    }

    const id = `ATT-${makeId()}`;
    const checkInAt = new Date().toISOString();
    // Default status: office starts as confirmed if completed, but pending_confirmation until check-out
    // WFH always starts as pending_confirmation until progress updates & supervisor sign-off
    const status = 'pending_confirmation';

    await client.query(
      `INSERT INTO attendance_records (
        id, employee_id, work_date, work_mode, check_in_at, status,
        is_offline_work, crm_activity_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [
        id,
        actor.employeeId,
        today,
        input.workMode,
        checkInAt,
        status,
        input.isOfflineWork ?? false,
        input.crmActivityCount ?? 0,
      ]
    );

    return getAttendanceRecordById(id, client);
  } finally {
    client.release();
  }
}

export async function checkOutEmployee(
  actor: ActorSession,
  input: CheckOutInput
): Promise<AttendanceRecord> {
  const client = await pool.connect();
  try {
    const today = input.workDate || new Date().toISOString().slice(0, 10);

    const res = await client.query(
      `SELECT * FROM attendance_records
       WHERE employee_id = $1 AND (work_date = $2 OR check_out_at IS NULL)
       ORDER BY (work_date = $2) DESC, created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [actor.employeeId, today]
    );

    if (res.rows.length === 0) {
      const err: any = new Error(`No active check-in record found for today (${today}).`);
      err.status = 404;
      err.code = 'CHECKIN_NOT_FOUND';
      throw err;
    }

    const rec = res.rows[0];
    if (rec.check_out_at) {
      const err: any = new Error(`Employee already checked out at ${rec.check_out_at}.`);
      err.status = 400;
      err.code = 'ALREADY_CHECKED_OUT';
      throw err;
    }

    const checkOutAt = new Date().toISOString();
    const checkInMs = new Date(rec.check_in_at).getTime();
    const checkOutMs = new Date(checkOutAt).getTime();
    const totalHours = Math.max(0.1, Number(((checkOutMs - checkInMs) / (1000 * 60 * 60)).toFixed(2)));

    // Status transition:
    // If office and totalHours >= 8 (or >= 4 for half day), marked confirmed
    // If WFH, requires supervisor review or progress summary confirmation
    let newStatus = rec.status;
    if (rec.work_mode === 'office' && totalHours >= 4) {
      newStatus = 'confirmed';
    } else if (rec.work_mode === 'wfh') {
      newStatus = 'pending_confirmation'; // WFH requires supervisor review/confirmation of work deliverables
    }

    await client.query(
      `UPDATE attendance_records SET
        check_out_at = $1,
        total_hours = $2,
        wfh_progress_summary = COALESCE($3, wfh_progress_summary),
        work_evidence_url = COALESCE($4, work_evidence_url),
        is_offline_work = COALESCE($5, is_offline_work),
        crm_activity_count = COALESCE($6, crm_activity_count),
        status = $7,
        record_version = record_version + 1,
        updated_at = NOW()
      WHERE id = $8`,
      [
        checkOutAt,
        totalHours,
        input.wfhProgressSummary || null,
        input.workEvidenceUrl || null,
        input.isOfflineWork !== undefined ? input.isOfflineWork : rec.is_offline_work,
        input.crmActivityCount !== undefined ? input.crmActivityCount : rec.crm_activity_count,
        newStatus,
        rec.id,
      ]
    );

    return getAttendanceRecordById(rec.id, client);
  } finally {
    client.release();
  }
}

// ============================================================================
// 2. Role-Appropriate Progress Logs (WFH / Offline Deliverables)
// ============================================================================

export async function addProgressLog(
  actor: ActorSession,
  input: ProgressLogInput
): Promise<AttendanceProgressLogRecord> {
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().slice(0, 10);

    const recRes = await client.query(
      `SELECT id, work_mode FROM attendance_records
       WHERE employee_id = $1 AND (work_date = $2 OR check_out_at IS NULL)
       ORDER BY (work_date = $2) DESC, created_at DESC
       LIMIT 1`,
      [actor.employeeId, today]
    );

    if (recRes.rows.length === 0) {
      const err: any = new Error('You must check in for today before logging progress updates.');
      err.status = 400;
      err.code = 'CHECKIN_REQUIRED';
      throw err;
    }

    const attendanceRecordId = recRes.rows[0].id;
    const logId = `APL-${makeId()}`;

    await client.query(
      `INSERT INTO attendance_progress_logs (
        id, attendance_record_id, logged_at, deliverable_title,
        deliverable_progress_pct, notes, evidence_artifact_path, is_offline_deliverable
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7)`,
      [
        logId,
        attendanceRecordId,
        input.deliverableTitle,
        input.deliverableProgressPct,
        input.notes || null,
        input.evidenceArtifactPath || null,
        input.isOfflineDeliverable ?? true,
      ]
    );

    const out = await client.query(
      `SELECT * FROM attendance_progress_logs WHERE id = $1`,
      [logId]
    );
    const row = out.rows[0];

    return {
      id: row.id,
      attendanceRecordId: row.attendance_record_id,
      loggedAt: row.logged_at.toISOString(),
      deliverableTitle: row.deliverable_title,
      deliverableProgressPct: row.deliverable_progress_pct,
      notes: row.notes,
      evidenceArtifactPath: row.evidence_artifact_path,
      isOfflineDeliverable: row.is_offline_deliverable,
    };
  } finally {
    client.release();
  }
}

// ============================================================================
// 3. Supervisor Attendance Review & Auditable Correction Process
// ============================================================================

export async function requestAttendanceRegularization(
  actor: ActorSession,
  input: RegularizationRequestInput
): Promise<AttendanceRegularizationRecord> {
  const client = await pool.connect();
  try {
    // 1. Resolve direct superior
    const supRes = await resolveSuperiorForEmployee(actor.employeeId, client);
    if (supRes.status === 'blocked' || !supRes.approverId) {
      const err: any = new Error(
        `Regularization route blocked: ${supRes.reason || 'No configured supervisor found.'}`
      );
      err.status = 422;
      err.code = 'UNCONFIGURED_SUPERVISOR';
      throw err;
    }

    // 2. Locate existing attendance record if any
    const attRes = await client.query(
      `SELECT id FROM attendance_records WHERE employee_id = $1 AND work_date = $2`,
      [actor.employeeId, input.workDate]
    );
    const existingAttId = attRes.rows[0]?.id || null;

    const reqId = `ARR-${makeId()}`;

    await client.query(
      `INSERT INTO attendance_regularization_requests (
        id, attendance_record_id, employee_id, work_date, requested_work_mode,
        requested_check_in_at, requested_check_out_at, reason, progress_summary,
        status, supervisor_employee_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, NOW())`,
      [
        reqId,
        existingAttId,
        actor.employeeId,
        input.workDate,
        input.requestedWorkMode,
        input.requestedCheckInAt,
        input.requestedCheckOutAt,
        input.reason,
        input.progressSummary || null,
        supRes.approverId,
      ]
    );

    if (existingAttId) {
      await client.query(
        `UPDATE attendance_records SET status = 'regularization_requested', updated_at = NOW() WHERE id = $1`,
        [existingAttId]
      );
    }

    return getRegularizationById(reqId, client);
  } finally {
    client.release();
  }
}

export async function decideAttendanceRegularization(
  actor: ActorSession,
  requestId: string,
  input: RegularizationDecisionInput
): Promise<AttendanceRegularizationRecord> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query(
      `SELECT * FROM attendance_regularization_requests WHERE id = $1 FOR UPDATE`,
      [requestId]
    );

    if (res.rows.length === 0) {
      const err: any = new Error(`Regularization request ${requestId} not found.`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const req = res.rows[0];

    // Authorization: Supervisor or HR/SA
    const isSupervisor = req.supervisor_employee_id === actor.employeeId;
    const isGovernance = actor.role === 'HR' || actor.role === 'SA';
    if (!isSupervisor && !isGovernance) {
      const err: any = new Error(
        `Forbidden: You are not authorized to decide this regularization request.`
      );
      err.status = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }

    // Zero self-approval invariant
    if (req.employee_id === actor.employeeId) {
      const err: any = new Error(
        'SELF_APPROVAL_FORBIDDEN: You cannot approve or decide your own attendance regularization.'
      );
      err.status = 422;
      err.code = 'SELF_APPROVAL_FORBIDDEN';
      throw err;
    }

    if (req.status !== 'pending') {
      const err: any = new Error(`Request has already been decided (${req.status}).`);
      err.status = 400;
      err.code = 'ALREADY_DECIDED';
      throw err;
    }

    const decidedAt = new Date().toISOString();

    await client.query(
      `UPDATE attendance_regularization_requests SET
        status = $1,
        decision_notes = $2,
        decided_at = $3
      WHERE id = $4`,
      [input.decision, input.decisionNotes, decidedAt, requestId]
    );

    // If approved, upsert attendance record to 'confirmed'
    if (input.decision === 'approved') {
      const checkInMs = new Date(req.requested_check_in_at).getTime();
      const checkOutMs = new Date(req.requested_check_out_at).getTime();
      const totalHours = Math.max(0.5, Number(((checkOutMs - checkInMs) / (1000 * 60 * 60)).toFixed(2)));

      if (req.attendance_record_id) {
        await client.query(
          `UPDATE attendance_records SET
            work_mode = $1,
            check_in_at = $2,
            check_out_at = $3,
            total_hours = $4,
            wfh_progress_summary = COALESCE($5, wfh_progress_summary),
            status = 'confirmed',
            reviewed_by_employee_id = $6,
            reviewed_at = $7,
            review_notes = $8,
            record_version = record_version + 1,
            updated_at = NOW()
          WHERE id = $9`,
          [
            req.requested_work_mode,
            req.requested_check_in_at,
            req.requested_check_out_at,
            totalHours,
            req.progress_summary,
            actor.employeeId,
            decidedAt,
            `Regularization Approved: ${input.decisionNotes}`,
            req.attendance_record_id,
          ]
        );
      } else {
        const attId = `ATT-${makeId()}`;
        await client.query(
          `INSERT INTO attendance_records (
            id, employee_id, work_date, work_mode, check_in_at, check_out_at,
            total_hours, wfh_progress_summary, status, reviewed_by_employee_id,
            reviewed_at, review_notes, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed', $9, $10, $11, NOW(), NOW())
          ON CONFLICT (employee_id, work_date) DO UPDATE SET
            work_mode = EXCLUDED.work_mode,
            check_in_at = EXCLUDED.check_in_at,
            check_out_at = EXCLUDED.check_out_at,
            total_hours = EXCLUDED.total_hours,
            status = 'confirmed',
            reviewed_by_employee_id = EXCLUDED.reviewed_by_employee_id,
            reviewed_at = EXCLUDED.reviewed_at,
            review_notes = EXCLUDED.review_notes,
            updated_at = NOW()`,
          [
            attId,
            req.employee_id,
            req.work_date,
            req.requested_work_mode,
            req.requested_check_in_at,
            req.requested_check_out_at,
            totalHours,
            req.progress_summary,
            actor.employeeId,
            decidedAt,
            `Regularization Approved: ${input.decisionNotes}`,
          ]
        );
      }
    } else {
      // If rejected, mark linked record as rejected if it was pending
      if (req.attendance_record_id) {
        await client.query(
          `UPDATE attendance_records SET
            status = 'rejected',
            reviewed_by_employee_id = $1,
            reviewed_at = $2,
            review_notes = $3,
            updated_at = NOW()
          WHERE id = $4`,
          [actor.employeeId, decidedAt, `Regularization Rejected: ${input.decisionNotes}`, req.attendance_record_id]
        );
      }
    }

    await client.query('COMMIT');
    return getRegularizationById(requestId, client);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function reviewAttendanceRecord(
  actor: ActorSession,
  recordId: string,
  input: SupervisorReviewInput
): Promise<AttendanceRecord> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT a.*, e.display_name AS employee_name
       FROM attendance_records a
       JOIN employees e ON e.id = a.employee_id
       WHERE a.id = $1`,
      [recordId]
    );

    if (res.rows.length === 0) {
      const err: any = new Error(`Attendance record ${recordId} not found.`);
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    const rec = res.rows[0];

    // Zero self-approval invariant
    if (rec.employee_id === actor.employeeId) {
      const err: any = new Error(
        'SELF_APPROVAL_FORBIDDEN: You cannot review or confirm your own attendance record.'
      );
      err.status = 422;
      err.code = 'SELF_APPROVAL_FORBIDDEN';
      throw err;
    }

    const reviewedAt = new Date().toISOString();

    await client.query(
      `UPDATE attendance_records SET
        status = $1,
        reviewed_by_employee_id = $2,
        reviewed_at = $3,
        review_notes = $4,
        record_version = record_version + 1,
        updated_at = NOW()
      WHERE id = $5`,
      [input.decision, actor.employeeId, reviewedAt, input.reviewNotes || null, recordId]
    );

    return getAttendanceRecordById(recordId, client);
  } finally {
    client.release();
  }
}

// ============================================================================
// 4. Personal View & Supervisor Exceptions Queue
// ============================================================================

export async function getMyAttendance(
  actor: ActorSession,
  dateOrMonth?: string
): Promise<{
  todayRecord: AttendanceRecord | null;
  history: AttendanceRecord[];
  pendingRegularizations: AttendanceRegularizationRecord[];
}> {
  const client = await pool.connect();
  try {
    const today = new Date().toISOString().slice(0, 10);
    const targetMonth = dateOrMonth && dateOrMonth.length === 7 ? dateOrMonth : today.slice(0, 7);

    // Today's record
    const todayRes = await client.query(
      `SELECT id FROM attendance_records WHERE employee_id = $1 AND work_date = $2`,
      [actor.employeeId, today]
    );
    const todayRecord = todayRes.rows.length > 0 ? await getAttendanceRecordById(todayRes.rows[0].id, client) : null;

    // Monthly history
    const histRes = await client.query(
      `SELECT id FROM attendance_records
       WHERE employee_id = $1 AND TO_CHAR(work_date, 'YYYY-MM') = $2
       ORDER BY work_date DESC`,
      [actor.employeeId, targetMonth]
    );
    const history: AttendanceRecord[] = [];
    for (const r of histRes.rows) {
      history.push(await getAttendanceRecordById(r.id, client));
    }

    // Pending regularizations
    const regRes = await client.query(
      `SELECT id FROM attendance_regularization_requests
       WHERE employee_id = $1 AND status = 'pending'
       ORDER BY created_at DESC`,
      [actor.employeeId]
    );
    const pendingRegularizations: AttendanceRegularizationRecord[] = [];
    for (const r of regRes.rows) {
      pendingRegularizations.push(await getRegularizationById(r.id, client));
    }

    return { todayRecord, history, pendingRegularizations };
  } finally {
    client.release();
  }
}

export async function getSupervisorExceptions(
  actor: ActorSession
): Promise<{
  pendingRecords: AttendanceRecord[];
  pendingRegularizations: AttendanceRegularizationRecord[];
}> {
  const client = await pool.connect();
  try {
    const isHr = actor.role === 'HR' || actor.role === 'SA' || actor.role === 'CEO' || actor.role === 'CFO';

    let recordsSql = `
      SELECT a.id
      FROM attendance_records a
      JOIN employees e ON e.id = a.employee_id
      LEFT JOIN assignments asg ON asg.employee_id = a.employee_id
      WHERE a.status = 'pending_confirmation' AND a.employee_id != $1
    `;
    const params: any[] = [actor.employeeId];

    if (!isHr) {
      if (actor.role === 'TL' && actor.teamGrants && actor.teamGrants.length > 0) {
        recordsSql += ` AND asg.team_id = ANY($2)`;
        params.push(actor.teamGrants);
      } else if (actor.verticalGrants.length > 0) {
        recordsSql += ` AND asg.vertical = ANY($2)`;
        params.push(actor.verticalGrants);
      }
    }
    recordsSql += ` ORDER BY a.work_date DESC, a.created_at DESC LIMIT 50`;

    const recRes = await client.query(recordsSql, params);
    const pendingRecords: AttendanceRecord[] = [];
    for (const r of recRes.rows) {
      pendingRecords.push(await getAttendanceRecordById(r.id, client));
    }

    // Regularizations
    let regSql = `
      SELECT id FROM attendance_regularization_requests
      WHERE status = 'pending' AND employee_id != $1
    `;
    const regParams: any[] = [actor.employeeId];
    if (!isHr) {
      regSql += ` AND supervisor_employee_id = $1`;
    }
    regSql += ` ORDER BY created_at DESC LIMIT 50`;

    const regRes = await client.query(regSql, regParams);
    const pendingRegularizations: AttendanceRegularizationRecord[] = [];
    for (const r of regRes.rows) {
      pendingRegularizations.push(await getRegularizationById(r.id, client));
    }

    return { pendingRecords, pendingRegularizations };
  } finally {
    client.release();
  }
}

// ============================================================================
// 5. HR Organization-Wide & Manager-Scoped Resource View
// ============================================================================

export async function getResourceView(
  actor: ActorSession,
  query: ResourceViewQuery
): Promise<ResourceViewPayload> {
  const client = await pool.connect();
  try {
    const selectedDate = query.date || new Date().toISOString().slice(0, 10);
    const month = query.month || selectedDate.slice(0, 7);
    const selectedVertical = query.vertical || 'all';

    const isHrOrExec = actor.role === 'HR' || actor.role === 'SA' || actor.role === 'CEO' || actor.role === 'CFO';

    // 1. Fetch targeted employees based on vertical selector and actor span
    let empSql = `
      SELECT e.id, e.display_name, e.email, e.work_location_id,
             COALESCE(loc.name, 'Mumbai Main Campus') AS location_name,
             loc.weekly_off_days,
             COALESCE(asg.role, 'Employee') AS role,
             COALESCE(asg.vertical, 'shared') AS vertical,
             asg.team_id,
             COALESCE(t.name, asg.team_id, 'Enterprise') AS team_name
      FROM employees e
      LEFT JOIN work_locations loc ON loc.id = e.work_location_id
      LEFT JOIN assignments asg ON asg.employee_id = e.id
      LEFT JOIN teams t ON t.id = asg.team_id
      WHERE e.status = 'active'
    `;
    const empParams: any[] = [];
    let pIdx = 1;

    // Vertical filtering
    if (selectedVertical !== 'all') {
      empSql += ` AND asg.vertical = $${pIdx++}`;
      empParams.push(selectedVertical);
    }

    // Role filtering if specified
    if (query.role) {
      empSql += ` AND asg.role = $${pIdx++}`;
      empParams.push(query.role);
    }

    // Manager / Supervisory span scoping if actor is NOT HR/Exec
    if (!isHrOrExec) {
      empSql += ` AND asg.role NOT IN ('CEO', 'CFO', 'HR', 'SA')`;

      if (actor.role === 'TL') {
        empSql += ` AND asg.role = 'SC'`;
        if (actor.teamGrants && actor.teamGrants.length > 0) {
          empSql += ` AND asg.team_id = ANY($${pIdx++})`;
          empParams.push(actor.teamGrants);
        }
      } else if (actor.role === 'MG') {
        empSql += ` AND asg.role IN ('SC', 'TL')`;
        if (actor.verticalGrants.length > 0) {
          empSql += ` AND asg.vertical = ANY($${pIdx++})`;
          empParams.push(actor.verticalGrants);
        }
      } else if (actor.role === 'RM') {
        empSql += ` AND asg.role IN ('SC', 'TL', 'MG')`;
        if (actor.verticalGrants.length > 0) {
          empSql += ` AND asg.vertical = ANY($${pIdx++})`;
          empParams.push(actor.verticalGrants);
        }
      } else if (actor.role === 'NM') {
        empSql += ` AND asg.role IN ('SC', 'TL', 'MG', 'RM')`;
        if (actor.verticalGrants.length > 0) {
          empSql += ` AND asg.vertical = ANY($${pIdx++})`;
          empParams.push(actor.verticalGrants);
        }
      } else if (actor.verticalGrants.length > 0) {
        empSql += ` AND asg.vertical = ANY($${pIdx++})`;
        empParams.push(actor.verticalGrants);
      }
    }

    empSql += ` ORDER BY asg.vertical, asg.role, e.display_name`;

    const empRes = await client.query(empSql, empParams);
    const employees = empRes.rows;

    // 2. Fetch all holidays for this month across locations
    const holRes = await client.query(
      `SELECT h.*, TO_CHAR(h.holiday_date, 'YYYY-MM-DD') AS holiday_date_str,
              c.work_location_id, loc.name AS location_name
       FROM calendar_holidays h
       JOIN holiday_calendars c ON c.id = h.calendar_id
       JOIN work_locations loc ON loc.id = c.work_location_id
       WHERE TO_CHAR(h.holiday_date, 'YYYY-MM') = $1
       ORDER BY h.holiday_date`,
      [month]
    );
    const holidaysForMonth: CalendarHolidayRecord[] = holRes.rows.map((h) => ({
      id: h.id,
      calendarId: h.calendar_id,
      workLocationId: h.work_location_id,
      locationName: h.location_name,
      holidayDate: h.holiday_date_str,
      holidayName: h.holiday_name,
      holidayType: h.holiday_type,
      description: h.description,
    }));

    // 3. Fetch attendance records for selectedDate
    const attRes = await client.query(
      `SELECT * FROM attendance_records WHERE work_date = $1`,
      [selectedDate]
    );
    const attendanceMap = new Map<string, any>();
    for (const r of attRes.rows) {
      attendanceMap.set(r.employee_id, r);
    }

    // 4. Fetch approved leaves covering selectedDate (from Slice 1)
    const leaveRes = await client.query(
      `SELECT r.*, TO_CHAR(r.start_date, 'YYYY-MM-DD') AS start_date_str,
              TO_CHAR(r.end_date, 'YYYY-MM-DD') AS end_date_str,
              e.display_name AS superior_name
       FROM employee_leave_requests r
       LEFT JOIN employees e ON e.id = r.decided_by_employee_id
       WHERE r.status = 'approved' AND $1 BETWEEN r.start_date AND r.end_date`,
      [selectedDate]
    );
    const leaveMap = new Map<string, any>();
    for (const l of leaveRes.rows) {
      leaveMap.set(l.employee_id, l);
    }

    // 5. Build daily breakdown and metrics
    const dayOfWeek = new Date(selectedDate).getDay(); // 0 = Sun, 6 = Sat
    const isPastDate = new Date(selectedDate) <= new Date(new Date().toISOString().slice(0, 10));

    let confirmedPresent = 0;
    let wfhCount = 0;
    let approvedLeaveCount = 0;
    let holidayCount = 0;
    let weeklyOffCount = 0;
    let pendingConfirmationCount = 0;
    let recordedAbsenceCount = 0;
    let scheduledWorkingDays = 0;

    const breakdown: DailyResourceBreakdownItem[] = [];

    for (const emp of employees) {
      const att = attendanceMap.get(emp.id);
      const leave = leaveMap.get(emp.id);

      // Check if holiday applies to this employee's configured location
      const holiday = holidaysForMonth.find(
        (h) => h.workLocationId === (emp.work_location_id || 'LOC-MUM') && h.holidayDate === selectedDate
      );

      // Check weekly off
      const weeklyOffDays = emp.weekly_off_days || [0, 6];
      const isWeeklyOff = weeklyOffDays.includes(dayOfWeek);

      let classification: any = 'recorded_absence';
      const workMode = att?.work_mode || null;
      const checkInAt = att ? att.check_in_at.toISOString() : null;
      const checkOutAt = att?.check_out_at ? att.check_out_at.toISOString() : null;
      const totalHours = att ? Number(att.total_hours) : null;
      const isOfflineWork = att ? Boolean(att.is_offline_work) : false;
      const crmActivityCount = att ? Number(att.crm_activity_count) : 0;
      const status = att ? att.status : null;
      let leaveDetails = null;
      let holidayDetails = null;

      if (att) {
        if (att.status === 'confirmed') {
          if (att.work_mode === 'wfh') {
            classification = 'wfh';
            wfhCount++;
          } else {
            classification = 'confirmed_present';
            confirmedPresent++;
          }
        } else if (att.status === 'pending_confirmation' || att.status === 'regularization_requested') {
          classification = 'pending_confirmation';
          pendingConfirmationCount++;
        } else if (att.status === 'rejected') {
          classification = 'recorded_absence';
          recordedAbsenceCount++;
        }
      } else if (leave) {
        classification = 'approved_leave';
        approvedLeaveCount++;
        leaveDetails = {
          requestId: leave.id,
          leaveType: leave.leave_type,
          startDate: leave.start_date_str,
          endDate: leave.end_date_str,
          status: leave.status,
          approvingSuperiorName: leave.superior_name,
        };
      } else if (holiday) {
        classification = 'holiday';
        holidayCount++;
        holidayDetails = {
          holidayName: holiday.holidayName,
          holidayType: holiday.holidayType,
        };
      } else if (isWeeklyOff) {
        classification = 'weekly_off';
        weeklyOffCount++;
      } else {
        if (isPastDate) {
          classification = 'recorded_absence';
          recordedAbsenceCount++;
        } else {
          classification = 'pending_confirmation';
          pendingConfirmationCount++;
        }
      }

      if (!holiday && !isWeeklyOff) {
        scheduledWorkingDays++;
      }

      breakdown.push({
        employeeId: emp.id,
        employeeName: emp.display_name,
        employeeEmail: emp.email,
        employeeRole: emp.role,
        vertical: emp.vertical,
        teamId: emp.team_id,
        teamName: emp.team_name,
        workLocationName: emp.location_name,
        date: selectedDate,
        classification,
        workMode,
        checkInAt,
        checkOutAt,
        totalHours,
        isOfflineWork,
        crmActivityCount,
        attendanceRecordId: att?.id || null,
        status,
        leaveDetails,
        holidayDetails,
        notes: att?.review_notes || null,
      });
    }

    const metrics: ResourceSummaryMetrics = {
      totalEmployees: employees.length,
      confirmedPresent,
      wfhCount,
      approvedLeaveCount,
      holidayCount,
      weeklyOffCount,
      pendingConfirmationCount,
      recordedAbsenceCount,
      scheduledWorkingDays,
    };

    return {
      selectedVertical,
      selectedDate,
      metrics,
      breakdown,
      holidaysForMonth,
    };
  } finally {
    client.release();
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

async function getAttendanceRecordById(id: string, client: PoolClient): Promise<AttendanceRecord> {
  const res = await client.query(
    `SELECT a.*, TO_CHAR(a.work_date, 'YYYY-MM-DD') AS work_date_str,
            e.display_name AS employee_name, asg.role AS employee_role,
            COALESCE(asg.vertical, 'shared') AS vertical, asg.team_id,
            t.name AS team_name, loc.name AS work_location_name,
            sup.display_name AS reviewed_by_name
     FROM attendance_records a
     JOIN employees e ON e.id = a.employee_id
     LEFT JOIN work_locations loc ON loc.id = e.work_location_id
     LEFT JOIN assignments asg ON asg.employee_id = a.employee_id
     LEFT JOIN teams t ON t.id = asg.team_id
     LEFT JOIN employees sup ON sup.id = a.reviewed_by_employee_id
     WHERE a.id = $1`,
    [id]
  );

  if (res.rows.length === 0) {
    throw new Error(`Attendance record ${id} not found.`);
  }

  const row = res.rows[0];

  const logsRes = await client.query(
    `SELECT * FROM attendance_progress_logs WHERE attendance_record_id = $1 ORDER BY logged_at ASC`,
    [id]
  );

  const progressLogs: AttendanceProgressLogRecord[] = logsRes.rows.map((l) => ({
    id: l.id,
    attendanceRecordId: l.attendance_record_id,
    loggedAt: l.logged_at.toISOString(),
    deliverableTitle: l.deliverable_title,
    deliverableProgressPct: l.deliverable_progress_pct,
    notes: l.notes,
    evidenceArtifactPath: l.evidence_artifact_path,
    isOfflineDeliverable: l.is_offline_deliverable,
  }));

  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeRole: row.employee_role,
    vertical: row.vertical,
    teamId: row.team_id,
    teamName: row.team_name,
    workLocationName: row.work_location_name,
    workDate: row.work_date_str,
    workMode: row.work_mode,
    checkInAt: row.check_in_at.toISOString(),
    checkOutAt: row.check_out_at ? row.check_out_at.toISOString() : null,
    totalHours: row.total_hours !== null ? Number(row.total_hours) : null,
    wfhProgressSummary: row.wfh_progress_summary,
    workEvidenceUrl: row.work_evidence_url,
    status: row.status,
    isOfflineWork: row.is_offline_work,
    crmActivityCount: row.crm_activity_count,
    reviewedByEmployeeId: row.reviewed_by_employee_id,
    reviewedByName: row.reviewed_by_name,
    reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
    reviewNotes: row.review_notes,
    progressLogs,
    createdAt: row.created_at.toISOString(),
  };
}

async function getRegularizationById(id: string, client: PoolClient): Promise<AttendanceRegularizationRecord> {
  const res = await client.query(
    `SELECT r.*, TO_CHAR(r.work_date, 'YYYY-MM-DD') AS work_date_str,
            e.display_name AS employee_name, asg.role AS employee_role,
            COALESCE(asg.vertical, 'shared') AS vertical,
            sup.display_name AS supervisor_name
     FROM attendance_regularization_requests r
     JOIN employees e ON e.id = r.employee_id
     LEFT JOIN assignments asg ON asg.employee_id = r.employee_id
     LEFT JOIN employees sup ON sup.id = r.supervisor_employee_id
     WHERE r.id = $1`,
    [id]
  );

  if (res.rows.length === 0) {
    throw new Error(`Regularization request ${id} not found.`);
  }

  const row = res.rows[0];

  return {
    id: row.id,
    attendanceRecordId: row.attendance_record_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeRole: row.employee_role,
    vertical: row.vertical,
    workDate: row.work_date_str,
    requestedWorkMode: row.requested_work_mode,
    requestedCheckInAt: row.requested_check_in_at.toISOString(),
    requestedCheckOutAt: row.requested_check_out_at.toISOString(),
    reason: row.reason,
    progressSummary: row.progress_summary,
    status: row.status,
    supervisorEmployeeId: row.supervisor_employee_id,
    supervisorName: row.supervisor_name,
    decisionNotes: row.decision_notes,
    decidedAt: row.decided_at ? row.decided_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}
