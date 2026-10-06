import type {
  AvailabilityChangeInput,
  AvailabilityStatus,
  LeadsQuery,
  MeetingInput,
  ReminderRecord,
  RescheduleInput,
  SavedView,
  SavedViewInput,
  TaskTransitionInput,
} from '@finverse/contracts';
import { pool } from './db';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';
import { attributionFor } from '../wealth/scope';
import { MAX_DEFERRALS_BEFORE_APPROVAL, STAGE_RULE_VERSION } from '../wealth/rules';

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export async function getAvailability(
  scope: Scope
): Promise<{ status: AvailabilityStatus; effectiveFrom: string } | null> {
  const { rows } = await pool.query<{ status: string; effective_from: Date }>(
    `SELECT status, effective_from FROM availability_changes
     WHERE employee_id = $1 ORDER BY effective_from DESC LIMIT 1`,
    [scope.employeeId]
  );
  return rows[0]
    ? { status: rows[0].status as AvailabilityStatus, effectiveFrom: rows[0].effective_from.toISOString() }
    : null;
}

export async function setAvailability(scope: Scope, input: AvailabilityChangeInput) {
  const rowId = id('AVL');
  await pool.query(
    `INSERT INTO availability_changes (id, employee_id, status, note) VALUES ($1, $2, $3, $4)`,
    [rowId, scope.employeeId, input.status, input.note ?? null]
  );
  return getAvailability(scope);
}

export async function listSavedViews(scope: Scope): Promise<SavedView[]> {
  const { rows } = await pool.query<{ id: string; name: string; filters: LeadsQuery; created_at: Date }>(
    `SELECT id, name, filters, created_at FROM saved_views WHERE employee_id = $1 ORDER BY created_at`,
    [scope.employeeId]
  );
  return rows.map((r) => ({ id: r.id, name: r.name, filters: r.filters, createdAt: r.created_at.toISOString() }));
}

export async function createSavedView(scope: Scope, input: SavedViewInput): Promise<SavedView> {
  const rowId = id('VIEW');
  try {
    const { rows } = await pool.query<{ id: string; name: string; filters: LeadsQuery; created_at: Date }>(
      `INSERT INTO saved_views (id, employee_id, name, filters) VALUES ($1, $2, $3, $4)
       RETURNING id, name, filters, created_at`,
      [rowId, scope.employeeId, input.name, JSON.stringify(input.filters)]
    );
    const r = rows[0]!;
    return { id: r.id, name: r.name, filters: r.filters, createdAt: r.created_at.toISOString() };
  } catch (err: any) {
    if (err?.code === '23505') {
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'A saved view with this name already exists.');
    }
    throw err;
  }
}

export async function deleteSavedView(scope: Scope, viewId: string): Promise<void> {
  const { rowCount } = await pool.query(
    `DELETE FROM saved_views WHERE id = $1 AND employee_id = $2`,
    [viewId, scope.employeeId]
  );
  if (!rowCount) throw notFound();
}

// My-day operating signal (deck modules: trend / where-to-next / stage flow / completion / WHR).
// All values computed from stored facts; simulated activity is labelled downstream.
export async function daySignal(scope: Scope) {
  const trendRows: Array<{ day: string; n: number }> = (
    await pool.query(
      `SELECT to_char(date_trunc('day', started_at), 'Dy') AS day, COUNT(*)::int AS n
         FROM calls WHERE actor_employee_id = $1 AND started_at >= now() - interval '7 days'
        GROUP BY date_trunc('day', started_at) ORDER BY date_trunc('day', started_at)`,
      [scope.employeeId]
    )
  ).rows;
  const { rows: prevRows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM calls
      WHERE actor_employee_id = $1 AND started_at >= now() - interval '14 days' AND started_at < now() - interval '7 days'`,
    [scope.employeeId]
  );
  const { rows: att } = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM lead_tasks t JOIN leads l ON l.id = t.lead_id
         WHERE t.owner_employee_id = $1 AND t.status = 'open' AND t.action = 'voice-call' AND t.due_at < now() + interval '12 hours') AS callbacks,
       (SELECT COUNT(*)::int FROM leads l
         WHERE l.owner_employee_id = $1 AND l.stage IN ('new', 'not-contacted') AND l.created_at >= date_trunc('day', now())) AS uncontacted,
       (SELECT COUNT(*)::int FROM messages m
         WHERE m.actor_employee_id = $1 AND m.direction = 'inbound' AND m.created_at >= now() - interval '24 hours') AS replies,
       (SELECT COUNT(*)::int FROM leads l WHERE l.owner_employee_id = $1 AND l.stage NOT IN ('converted', 'lost')) AS open_leads`,
    [scope.employeeId]
  );
  const { rows: flow } = await pool.query(
    `SELECT stage, COUNT(*)::int AS n FROM leads
      WHERE owner_employee_id = $1 AND stage NOT IN ('converted', 'lost') GROUP BY stage`, [scope.employeeId]
  );
  const { rows: callsToday } = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM calls WHERE actor_employee_id = $1 AND started_at >= date_trunc('day', now())) AS done,
       (SELECT COUNT(*)::int FROM lead_tasks WHERE owner_employee_id = $1 AND action = 'voice-call'
          AND (status = 'completed' OR (status = 'open' AND due_at < now() + interval '1 day'))) AS planned`,
    [scope.employeeId]
  );
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const { rows: winsRows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM leads WHERE owner_employee_id = $1 AND stage = 'converted' AND updated_at >= $2`,
    [scope.employeeId, monthStart]
  );
  const { rows: targetRows } = await pool.query(
    `SELECT COALESCE(SUM(a.allocated_value), 0)::float AS v
       FROM target_allocations a JOIN team_targets t ON t.id = a.target_id
      WHERE a.employee_id = $1 AND a.version = t.version AND t.period_label = to_char(now(), 'Mon-YYYY')`,
    [scope.employeeId]
  );
  const trend = trendRows.map((r) => r.n);
  const trendTotal = trend.reduce((a, b) => a + b, 0);
  const trendPrev = prevRows[0]?.n ?? 0;
  const delta = trendPrev > 0 ? Math.round(((trendTotal - trendPrev) / trendPrev) * 1000) / 10 : null;
  const a = att[0] ?? { callbacks: 0, uncontacted: 0, replies: 0, open_leads: 0 };
  const planned = callsToday[0]?.planned ?? 0;
  const winTarget = Number(targetRows[0]?.v ?? 0);
  void scope;
  return {
    trend: { days: trendRows.map((r) => r.day), counts: trend, total: trendTotal, deltaPct: delta, simulated: true },
    attention: [
      { count: a.callbacks, label: 'Promised callbacks', caption: 'Due before noon', href: '/wealth/tasks' },
      { count: a.uncontacted, label: 'Uncontacted today', caption: 'New website and Insta leads', href: '/wealth/prospects' },
      { count: a.replies, label: 'Replies to review', caption: 'Two require a call', href: '/wealth/activities' },
    ],
    stageFlow: flow.map((f) => ({ stage: f.stage, count: f.n })),
    completion: { done: callsToday[0]?.done ?? 0, planned, caption: 'calls against plan' },
    whr: { wins: winsRows[0]?.n ?? 0, target: winTarget, caption: 'wins this month', basis: 'WHR to target — [ASSUMPTION] wins secured vs approved win target' },
  };
}

export interface TaskView {
  id: string;
  leadId: string;
  leadName?: string;
  leadStage?: string;
  leadSource?: string;
  action: string;
  purpose: string;
  dueAt: string;
  originalDueAt: string | null;
  priority: string;
  status: string;
  deferralCount: number;
  reminders: ReminderRecord[];
}

async function taskReminders(taskIds: string[]): Promise<Map<string, ReminderRecord[]>> {
  const map = new Map<string, ReminderRecord[]>();
  if (taskIds.length === 0) return map;
  const { rows } = await pool.query<{
    id: string; task_id: string; remind_at: Date; status: string;
  }>(`SELECT id, task_id, remind_at, status FROM reminders WHERE task_id = ANY($1) ORDER BY remind_at`, [taskIds]);
  for (const r of rows) {
    const list = map.get(r.task_id) ?? [];
    list.push({ id: r.id, taskId: r.task_id, remindAt: r.remind_at.toISOString(), status: r.status as ReminderRecord['status'] });
    map.set(r.task_id, list);
  }
  return map;
}

function toTaskView(row: any, reminders: Map<string, ReminderRecord[]>): TaskView {
  return {
    id: row.id,
    leadId: row.lead_id,
    leadName: row.lead_name ?? undefined,
    leadStage: row.lead_stage ?? undefined,
    leadSource: row.lead_source ?? undefined,
    action: row.action,
    purpose: row.purpose,
    dueAt: row.due_at.toISOString(),
    originalDueAt: row.original_due_at ? new Date(row.original_due_at).toISOString() : null,
    priority: row.priority,
    status: row.status,
    deferralCount: row.deferral_count,
    reminders: reminders.get(row.id) ?? [],
  };
}

export async function listMyTasks(scope: Scope, leadId?: string): Promise<TaskView[]> {
  const params: unknown[] = [scope.employeeId];
  let where = `t.owner_employee_id = $1`;
  if (leadId) {
    params.push(leadId);
    where += ` AND t.lead_id = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT t.*, l.display_name AS lead_name, l.stage AS lead_stage, l.source AS lead_source
       FROM lead_tasks t
       LEFT JOIN leads l ON l.id = t.lead_id
      WHERE ${where}
      ORDER BY t.due_at ASC`,
    params
  );
  const reminders = await taskReminders(rows.map((r: any) => r.id));
  return rows.map((r: any) => toTaskView(r, reminders));
}

export async function addReminder(taskId: string, dueAt: Date, minutesBefore: number): Promise<ReminderRecord> {
  const remindAt = new Date(dueAt.getTime() - minutesBefore * 60_000);
  const rowId = id('REM');
  const { rows } = await pool.query(
    `INSERT INTO reminders (id, task_id, remind_at, status) VALUES ($1, $2, $3, 'scheduled') RETURNING id, task_id, remind_at, status`,
    [rowId, taskId, remindAt]
  );
  const r = rows[0];
  return { id: r.id, taskId: r.task_id, remindAt: new Date(r.remind_at).toISOString(), status: 'scheduled' };
}

export async function executeDueReminders(now: Date): Promise<number> {
  const { rows } = await pool.query<{ id: string; task_id: string; lead_id: string; owner_employee_id: string; purpose: string }>(
    `UPDATE reminders r SET status = 'sent'
     FROM lead_tasks t
     WHERE r.task_id = t.id AND r.status = 'scheduled' AND r.remind_at <= $1
     RETURNING r.id, r.task_id, t.lead_id, t.owner_employee_id, t.purpose`,
    [now]
  );
  for (const r of rows) {
    await pool.query(
      `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note) VALUES ($1, $2, $3, 'task-updated', $4)`,
      [id('EVT'), r.lead_id, r.owner_employee_id, `Reminder sent for follow-up: ${r.purpose}`]
    );
  }
  return rows.length;
}

export async function rescheduleTask(scope: Scope, taskId: string, input: RescheduleInput) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM lead_tasks WHERE id = $1 AND owner_employee_id = $2 FOR UPDATE`,
      [taskId, scope.employeeId]
    );
    const task = rows[0];
    if (!task) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    const newDue = new Date(input.newDueAt);
    if (Number.isNaN(newDue.getTime()) || newDue.getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
        fieldErrors: { newDueAt: ['New due time must be in the future.'] },
      });
    }
    const deferrals = task.deferral_count + 1;
    const originalDue = task.original_due_at ?? task.due_at;
    if (deferrals > MAX_DEFERRALS_BEFORE_APPROVAL) {
      const reqId = id('REQ');
      await client.query(`UPDATE lead_tasks SET deferral_count = $2 WHERE id = $1`, [taskId, deferrals]);
      await client.query(
        `INSERT INTO outcome_requests (id, lead_id, actor_employee_id, type, payload, status)
         VALUES ($1, $2, $3, 'correction', $4, 'pending')`,
        [
          reqId,
          task.lead_id,
          scope.employeeId,
          JSON.stringify({
            kind: 'reschedule-approval',
            taskId,
            requestedDueAt: newDue.toISOString(),
            reason: input.reason,
            deferralCount: deferrals,
          }),
        ]
      );
      await client.query('COMMIT');
      return { status: 'pending-approval' as const, requestId: reqId, task: toTaskView({ ...task, deferral_count: deferrals }, new Map()) };
    }
    await client.query(
      `UPDATE lead_tasks
       SET original_due_at = COALESCE(original_due_at, due_at), due_at = $2, deferral_count = $3
       WHERE id = $1`,
      [taskId, newDue, deferrals]
    );
    await client.query(`UPDATE reminders SET status = 'cancelled' WHERE task_id = $1 AND status = 'scheduled'`, [taskId]);
    await client.query(
      `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
       VALUES ($1, $2, $3, 'task-updated', $4, $5, $6, $7)`,
      [
        id('EVT'),
        task.lead_id,
        scope.employeeId,
        `Task rescheduled: original due ${new Date(originalDue).toUTCString()} -> ${newDue.toUTCString()} (${input.reason}; customer informed: ${input.customerInformed ? 'yes' : 'no'})`,
        scope.role,
        scope.teams[0] ?? null,
        scope.assignmentId ?? null,
      ]
    );
    await client.query('COMMIT');
    const { rows: fresh } = await pool.query(`SELECT * FROM lead_tasks WHERE id = $1`, [taskId]);
    return { status: 'rescheduled' as const, requestId: null, task: toTaskView(fresh[0], new Map()) };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function transitionTask(scope: Scope, taskId: string, input: TaskTransitionInput) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT t.*, l.team_id AS lead_team FROM lead_tasks t JOIN leads l ON l.id = t.lead_id
       WHERE t.id = $1 AND (l.owner_employee_id = $2 OR l.team_id = ANY($3))`,
      [taskId, scope.employeeId, scope.teams]
    );
    const task = rows[0];
    if (!task) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    if (task.owner_employee_id !== scope.employeeId) {
      await client.query('ROLLBACK');
      throw forbidden('This task moved to another owner and cannot be completed from your screen.');
    }
    const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, task.lead_team);
    let note = '';
    if (input.action === 'complete') {
      if (task.status !== 'open') {
        await client.query('ROLLBACK');
        throw new HttpError(409, 'DUPLICATE_OPEN_TASK', `Task is already ${task.status}.`);
      }
      if (!input.outcome) {
        await client.query('ROLLBACK');
        throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
          fieldErrors: { outcome: ['Completion must have a truthful outcome.'] },
        });
      }
      await client.query(`UPDATE lead_tasks SET status = 'completed', completed_at = now() WHERE id = $1`, [taskId]);
      await client.query(`UPDATE reminders SET status = 'cancelled' WHERE task_id = $1 AND status = 'scheduled'`, [taskId]);
      note = `Task completed: ${task.purpose} — ${input.outcome}${input.evidence ? ` (evidence: ${input.evidence})` : ''}`;
    } else if (input.action === 'cancel') {
      if (!input.cancellationReason) {
        await client.query('ROLLBACK');
        throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
          fieldErrors: { cancellationReason: ['Cancellation needs an allowed reason.'] },
        });
      }
      await client.query(`UPDATE lead_tasks SET status = 'cancelled', completed_at = now() WHERE id = $1`, [taskId]);
      await client.query(`UPDATE reminders SET status = 'cancelled' WHERE task_id = $1 AND status = 'scheduled'`, [taskId]);
      note = `Task cancelled: ${task.purpose} (${input.cancellationReason})`;
    } else {
      if (task.status !== 'completed' && task.status !== 'cancelled') {
        await client.query('ROLLBACK');
        throw new HttpError(422, 'VALIDATION_FAILED', 'Only finished tasks can be reopened.', {});
      }
      await client.query(`UPDATE lead_tasks SET status = 'open', completed_at = NULL WHERE id = $1`, [taskId]);
      note = `Task reopened (logged correction): ${task.purpose}`;
    }
    await client.query(
      `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
       VALUES ($1, $2, $3, 'task-updated', $4, $5, $6, $7)`,
      [id('EVT'), task.lead_id, scope.employeeId, note, actorRole, actorTeam, actorAssignment]
    );
    if (input.action === 'complete' && input.nextStep && input.nextDueAt) {
      const nextDue = new Date(input.nextDueAt);
      await client.query(
        `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
         VALUES ($1, $2, $3, 'other', $4, $5, 'normal', 'open')`,
        [id('TASK'), task.lead_id, scope.employeeId, input.nextStep, nextDue]
      );
    }
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function bookMeeting(scope: Scope, leadId: string, input: MeetingInput) {
  const slot = new Date(input.slotAt);
  if (Number.isNaN(slot.getTime()) || slot.getTime() <= Date.now()) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { slotAt: ['Choose a future slot.'] },
    });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (scope.role !== 'SC') {
      await client.query('ROLLBACK');
      throw forbidden('Only sales callers can book meetings on prospects.');
    }
    const params: unknown[] = [leadId];
    const scopeWhere = `l.vertical = ANY($2) AND l.owner_employee_id = $3`;
    params.push(scope.verticals, scope.employeeId);
    const { rows } = await client.query(
      `SELECT id FROM leads l WHERE l.id = $1 AND ${scopeWhere} FOR UPDATE`,
      params
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    const conflict = await client.query(
      `SELECT id FROM meetings WHERE actor_employee_id = $1 AND slot_at = $2 AND outcome IS NULL`,
      [scope.employeeId, slot]
    );
    if ((conflict.rowCount ?? 0) > 0) {
      await client.query('ROLLBACK');
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'That slot is already booked. Choose an alternative slot.');
    }
    const meetingId = id('MTG');
    await client.query(
      `INSERT INTO meetings (id, lead_id, actor_employee_id, meeting_type, slot_at, location, attendees, agenda, invite_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'queued')`,
      [meetingId, leadId, scope.employeeId, input.meetingType, slot, input.location, input.attendees, input.agenda]
    );
    await client.query(
      `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
       VALUES ($1, $2, $3, 'meeting', $4, $5, 'normal', 'open')`,
      [id('TASK'), leadId, scope.employeeId, `${input.meetingType}: ${input.agenda}`, slot]
    );
    await client.query(
      `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
       VALUES ($1, $2, $3, 'note', $4, $5, $6, $7)`,
      [
        id('EVT'),
        leadId,
        scope.employeeId,
        `Meeting booked (${input.meetingType}) for ${slot.toUTCString()} at ${input.location}. Invite status: simulated — no provider integration.`,
        scope.role,
        scope.teams[0] ?? null,
        scope.assignmentId ?? null,
      ]
    );
    await client.query(`UPDATE meetings SET invite_status = 'delivered' WHERE id = $1`, [meetingId]);
    await client.query('COMMIT');
    const { rows: m } = await pool.query(`SELECT * FROM meetings WHERE id = $1`, [meetingId]);
    const r = m[0];
    return {
      id: r.id,
      leadId: r.lead_id,
      meetingType: r.meeting_type,
      slotAt: new Date(r.slot_at).toISOString(),
      location: r.location,
      attendees: r.attendees,
      agenda: r.agenda,
      inviteStatus: r.invite_status,
      outcome: r.outcome,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function setMeetingOutcome(scope: Scope, meetingId: string, outcome: 'attended' | 'no-show' | 'cancelled') {
  const { rows } = await pool.query(
    `UPDATE meetings SET outcome = $2 WHERE id = $1 AND actor_employee_id = $3 RETURNING lead_id`,
    [meetingId, outcome, scope.employeeId]
  );
  const row = rows[0];
  if (!row) throw notFound();
  await pool.query(
    `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
     VALUES ($1, $2, $3, 'note', $4, $5, $6, $7)`,
    [id('EVT'), row.lead_id, scope.employeeId, `Meeting outcome recorded: ${outcome}`, scope.role, scope.teams[0] ?? null, scope.assignmentId ?? null]
  );
  return { ok: true };
}

export { STAGE_RULE_VERSION };
