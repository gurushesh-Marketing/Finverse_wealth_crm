import type {
  DueStatus,
  FollowUpInput,
  LeadDetail,
  LeadSummary,
  LeadTask,
  LeadsQuery,
  MyDayResponse,
  TimelineEvent,
} from '@finverse/contracts';
import { pool } from './db';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';

interface LeadRow {
  id: string;
  vertical: string;
  display_name: string;
  email: string | null;
  phone: string;
  preferred_language: string;
  product: string;
  source: string;
  stage: string;
  owner_employee_id: string | null;
  owner_name: string | null;
  team_name: string | null;
  record_version: number;
  created_at: Date;
  min_due: Date | null;
  is_priority: boolean;
  assigned_at: Date | null;
  reassigned_from_name: string | null;
}

interface TaskRow {
  id: string;
  lead_id: string;
  action: string;
  purpose: string;
  due_at: Date;
  priority: string;
  status: string;
  created_at: Date;
}

interface EventRow {
  id: string;
  lead_id: string;
  kind: string;
  note: string;
  occurred_at: Date;
  actor_name: string;
}

export function maskPhone(phone: string): string {
  const last3 = phone.replace(/\D/g, '').slice(-3) || '000';
  return `+91 •••••${last3}`;
}

function dueStatusFrom(dueAt: Date | null): DueStatus {
  if (!dueAt) return 'none';
  const now = Date.now();
  if (dueAt.getTime() < now) return 'overdue';
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  return dueAt.getTime() <= endOfDay.getTime() ? 'today' : 'upcoming';
}

function scopeSql(scope: Scope, params: unknown[], alias = 'l'): string {
  params.push(scope.verticals);
  const verticalIdx = params.length;
  let ownerSql = 'FALSE';
  if (scope.role === 'SC') {
    params.push(scope.employeeId);
    ownerSql = `${alias}.owner_employee_id = $${params.length}`;
  } else if (scope.role === 'REL' || scope.role === 'TL') {
    params.push(scope.employeeId);
    const meIdx = params.length;
    params.push(scope.teams);
    ownerSql = `(${alias}.owner_employee_id = $${meIdx} OR ${alias}.rel_owner_id = $${meIdx} OR ${alias}.team_id = ANY($${params.length}))`;
  }
  return `${alias}.vertical = ANY($${verticalIdx}) AND ${ownerSql}`;
}

function toSummary(row: LeadRow): LeadSummary {
  return {
    id: row.id,
    displayName: row.display_name,
    product: row.product,
    source: row.source,
    stage: row.stage as LeadSummary['stage'],
    ownerName: row.owner_name ?? 'Unassigned',
    teamName: row.team_name ?? '—',
    nextActionAt: row.min_due ? row.min_due.toISOString() : null,
    dueStatus: dueStatusFrom(row.min_due),
    isPriority: Boolean(row.is_priority),
    assignedAt: row.assigned_at ? row.assigned_at.toISOString() : null,
    reassignedFromName: row.reassigned_from_name ?? null,
  };
}

function toTask(row: TaskRow): LeadTask {
  return {
    id: row.id,
    leadId: row.lead_id,
    action: row.action as LeadTask['action'],
    purpose: row.purpose,
    dueAt: row.due_at.toISOString(),
    priority: row.priority as LeadTask['priority'],
    status: row.status as LeadTask['status'],
    createdAt: row.created_at.toISOString(),
  };
}

function toEvent(row: EventRow): TimelineEvent {
  return {
    id: row.id,
    kind: row.kind as TimelineEvent['kind'],
    actorName: row.actor_name,
    note: row.note,
    occurredAt: row.occurred_at.toISOString(),
  };
}

const LEAD_SELECT = `
  SELECT l.*, e.display_name AS owner_name, t.name AS team_name,
    (SELECT CASE WHEN oe.reason LIKE 'Automatic same-team caller reassignment:%'
                        AND oe.to_owner_employee_id = l.owner_employee_id
                 THEN former.display_name ELSE NULL END
       FROM lead_ownership_events oe
       LEFT JOIN employees former ON former.id = oe.from_owner_employee_id
      WHERE oe.lead_id = l.id
      ORDER BY oe.changed_at DESC, oe.id DESC LIMIT 1) AS reassigned_from_name,
    (SELECT min(t2.due_at) FROM lead_tasks t2 WHERE t2.lead_id = l.id AND t2.status = 'open') AS min_due
  FROM leads l
  LEFT JOIN employees e ON e.id = l.owner_employee_id
  LEFT JOIN teams t ON t.id = l.team_id
`;

export async function listLeads(scope: Scope, query: LeadsQuery): Promise<LeadSummary[]> {
  const params: unknown[] = [];
  const where: string[] = [scopeSql(scope, params)];
  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`(l.id ILIKE $${params.length} OR l.display_name ILIKE $${params.length})`);
  }
  if (query.stage) {
    params.push(query.stage);
    where.push(`l.stage = $${params.length}`);
  }
  if (query.source) {
    params.push(query.source);
    where.push(`l.source = $${params.length}`);
  }
  if (query.product) {
    params.push(query.product);
    where.push(`l.product = $${params.length}`);
  }
  if (query.due) {
    const dueExpr = `(SELECT min(t2.due_at) FROM lead_tasks t2 WHERE t2.lead_id = l.id AND t2.status = 'open')`;
    if (query.due === 'overdue') where.push(`${dueExpr} < now()`);
    if (query.due === 'today')
      where.push(
        `${dueExpr} >= now() AND ${dueExpr} < (date_trunc('day', now()) + interval '1 day')`
      );
    if (query.due === 'upcoming')
      where.push(`${dueExpr} >= (date_trunc('day', now()) + interval '1 day')`);
  }
  const { rows } = await pool.query<LeadRow>(
    `${LEAD_SELECT} WHERE ${where.join(' AND ')}
     ORDER BY l.is_priority DESC, l.assigned_at DESC NULLS LAST, (SELECT min(t2.due_at) FROM lead_tasks t2 WHERE t2.lead_id = l.id AND t2.status = 'open') ASC NULLS LAST, l.id ASC
     LIMIT 200`,
    params
  );
  return rows.map(toSummary);
}

export async function getLead(scope: Scope, leadId: string): Promise<LeadDetail> {
  const params: unknown[] = [leadId];
  const scopeWhere = scopeSql(scope, params);
  const { rows } = await pool.query<LeadRow>(
    `${LEAD_SELECT} WHERE l.id = $1 AND ${scopeWhere}`,
    params
  );
  const row = rows[0];
  if (!row) throw notFound();

  const { rows: taskRows } = await pool.query<TaskRow>(
    `SELECT * FROM lead_tasks WHERE lead_id = $1 ORDER BY due_at ASC, id ASC`,
    [leadId]
  );
  const { rows: eventRows } = await pool.query<EventRow>(
    `SELECT ev.*, e.display_name AS actor_name
     FROM lead_events ev LEFT JOIN employees e ON e.id = ev.actor_employee_id
     WHERE ev.lead_id = $1 ORDER BY ev.occurred_at DESC, ev.id DESC LIMIT 100`,
    [leadId]
  );

  const isOwner = row.owner_employee_id === scope.employeeId;
  const isCaller = scope.role === 'SC';
  return {
    id: row.id,
    displayName: row.display_name,
    phone: isCaller ? maskPhone(row.phone) : (isOwner ? row.phone : maskPhone(row.phone)),
    email: isOwner ? row.email : null,
    preferredLanguage: row.preferred_language,
    product: row.product,
    source: row.source,
    stage: row.stage as LeadDetail['stage'],
    ownerName: row.owner_name ?? 'Unassigned',
    teamName: row.team_name ?? '—',
    nextActionAt: row.min_due ? row.min_due.toISOString() : null,
    dueStatus: dueStatusFrom(row.min_due),
    recordVersion: row.record_version,
    vertical: row.vertical,
    createdAt: row.created_at.toISOString(),
    isPriority: Boolean(row.is_priority),
    assignedAt: row.assigned_at ? row.assigned_at.toISOString() : null,
    tasks: taskRows.map(toTask),
    timeline: eventRows.map(toEvent),
  };
}

export async function myDay(scope: Scope): Promise<MyDayResponse> {
  const params: unknown[] = [scope.employeeId];
  const scopeWhere = scopeSql(scope, params, 'l');
  const { rows: countRows } = await pool.query<{
    active_leads: string;
    overdue: string;
    due_today: string;
    upcoming: string;
  }>(
    `SELECT
      (SELECT count(*) FROM leads l WHERE l.owner_employee_id = $1 AND ${scopeWhere} AND l.stage NOT IN ('converted', 'lost', 'disbursal', 'active-funded')) AS active_leads,
      (SELECT count(*) FROM lead_tasks t JOIN leads l ON l.id = t.lead_id
        WHERE t.owner_employee_id = $1 AND t.status = 'open' AND ${scopeWhere} AND t.due_at < now()) AS overdue,
      (SELECT count(*) FROM lead_tasks t JOIN leads l ON l.id = t.lead_id
        WHERE t.owner_employee_id = $1 AND t.status = 'open' AND ${scopeWhere}
          AND t.due_at >= now() AND t.due_at < (date_trunc('day', now()) + interval '1 day')) AS due_today,
      (SELECT count(*) FROM lead_tasks t JOIN leads l ON l.id = t.lead_id
        WHERE t.owner_employee_id = $1 AND t.status = 'open' AND ${scopeWhere}
          AND t.due_at >= (date_trunc('day', now()) + interval '1 day')) AS upcoming`,
    params
  );
  const { rows: taskRows } = await pool.query<TaskRow>(
    `SELECT t.* FROM lead_tasks t JOIN leads l ON l.id = t.lead_id
     WHERE t.owner_employee_id = $1 AND t.status = 'open' AND ${scopeWhere}
     ORDER BY t.due_at ASC LIMIT 10`,
    params
  );
  const c = countRows[0]!;
  return {
    asOf: new Date().toISOString(),
    counts: {
      overdue: Number(c.overdue),
      dueToday: Number(c.due_today),
      upcoming: Number(c.upcoming),
      activeLeads: Number(c.active_leads),
    },
    nextTasks: taskRows.map(toTask),
    availability: null,
  };
}

export async function createFollowUp(
  scope: Scope,
  leadId: string,
  input: FollowUpInput
): Promise<{ task: LeadTask; timeline: TimelineEvent }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const params: unknown[] = [leadId];
    const scopeWhere = scopeSql(scope, params);
    const { rows } = await client.query<{
      id: string;
      owner_employee_id: string | null;
      stage: string;
    }>(
      `SELECT id, owner_employee_id, stage FROM leads l WHERE l.id = $1 AND ${scopeWhere} FOR UPDATE`,
      params
    );
    const lead = rows[0];
    if (!lead) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    if (scope.role !== 'SC') {
      await client.query('ROLLBACK');
      throw forbidden('Only sales callers can schedule follow-ups for prospects.');
    }
    if (lead.owner_employee_id !== scope.employeeId) {
      await client.query('ROLLBACK');
      throw forbidden('Only the current owner can schedule follow-ups for this lead.');
    }

    const dup = await client.query(
      `SELECT id FROM lead_tasks WHERE lead_id = $1 AND action = $2 AND purpose = $3 AND status = 'open'`,
      [leadId, input.action, input.purpose]
    );
    if ((dup.rowCount ?? 0) > 0) {
      await client.query('ROLLBACK');
      throw new HttpError(
        409,
        'DUPLICATE_OPEN_TASK',
        'An open follow-up with this action and purpose already exists. Update or cancel the existing task before creating another.'
      );
    }

    const suffix = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    const taskId = `TASK-${suffix}`;
    const eventId = `EVT-${suffix}`;
    const dueDate = new Date(input.dueAt);
    const note = `Follow-up: ${input.action} — ${input.purpose} (due ${dueDate.toUTCString()})`;

    const { rows: taskRows } = await client.query<TaskRow>(
      `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open') RETURNING *`,
      [taskId, leadId, scope.employeeId, input.action, input.purpose, dueDate, input.priority]
    );
    if (input.reminderMinutes) {
      await client.query(
        `INSERT INTO reminders (id, task_id, remind_at, status) VALUES ($1, $2, $3, 'scheduled')`,
        [`REM-${suffix}`, taskId, new Date(dueDate.getTime() - input.reminderMinutes * 60_000)]
      );
    }
    const { rows: eventRows } = await client.query<EventRow>(
      `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note)
       VALUES ($1, $2, $3, 'follow-up-scheduled', $4)
       RETURNING id, lead_id, kind, note, occurred_at`,
      [eventId, leadId, scope.employeeId, note]
    );
    await client.query(
      `UPDATE leads
       SET updated_at = now(), record_version = record_version + 1,
           stage = CASE WHEN stage IN ('converted', 'lost') THEN stage ELSE 'follow-up' END
       WHERE id = $1`,
      [leadId]
    );
    await client.query('COMMIT');

    const task = toTask(taskRows[0]!);
    const timeline = toEvent({ ...eventRows[0]!, actor_name: scope.displayName });
    return { task, timeline };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
