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
import { eq, and, or, inArray, notInArray, ilike, asc, desc, lt, gte, count, sql } from 'drizzle-orm';
import { db } from './db';
import { leads, leadTasks, leadEvents, employees, teams, reminders } from '../db/schema';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';
import { readScopeCondition, readScopeSql } from '../wealth/scope';

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
  created_at: Date | string;
  min_due: Date | string | null;
}

interface TaskRow {
  id: string;
  lead_id: string;
  action: string;
  purpose: string;
  due_at: Date | string;
  priority: string;
  status: string;
  created_at: Date | string;
}

interface EventRow {
  id: string;
  lead_id: string;
  kind: string;
  note: string;
  occurred_at: Date | string;
  actor_name: string;
}

export function maskPhone(phone: string): string {
  const last3 = phone.replace(/\D/g, '').slice(-3) || '000';
  return `+91 •••••${last3}`;
}

function toIso(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  return (val instanceof Date ? val : new Date(val)).toISOString();
}

function dueStatusFrom(dueAt: Date | string | null): DueStatus {
  if (!dueAt) return 'none';
  const dueDate = dueAt instanceof Date ? dueAt : new Date(dueAt);
  const now = Date.now();
  if (dueDate.getTime() < now) return 'overdue';
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  return dueDate.getTime() <= endOfDay.getTime() ? 'today' : 'upcoming';
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
    nextActionAt: toIso(row.min_due),
    dueStatus: dueStatusFrom(row.min_due),
  };
}

function toTask(row: TaskRow): LeadTask {
  return {
    id: row.id,
    leadId: row.lead_id,
    action: row.action as LeadTask['action'],
    purpose: row.purpose,
    dueAt: toIso(row.due_at) ?? new Date().toISOString(),
    priority: row.priority as LeadTask['priority'],
    status: row.status as LeadTask['status'],
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

function toEvent(row: EventRow): TimelineEvent {
  return {
    id: row.id,
    kind: row.kind as TimelineEvent['kind'],
    actorName: row.actor_name,
    note: row.note,
    occurredAt: toIso(row.occurred_at) ?? new Date().toISOString(),
  };
}

export async function listLeads(scope: Scope, query: LeadsQuery): Promise<LeadSummary[]> {
  const minDueSubquery = sql<Date | null>`(SELECT min(t2.due_at) FROM lead_tasks t2 WHERE t2.lead_id = ${leads.id} AND t2.status = 'open')`;

  const conditions = [readScopeCondition(scope)];

  if (query.search) {
    conditions.push(
      or(
        ilike(leads.id, `%${query.search}%`),
        ilike(leads.displayName, `%${query.search}%`)
      )!
    );
  }
  if (query.stage) {
    conditions.push(eq(leads.stage, query.stage));
  }
  if (query.source) {
    conditions.push(eq(leads.source, query.source));
  }
  if (query.product) {
    conditions.push(eq(leads.product, query.product));
  }
  if (query.due) {
    if (query.due === 'overdue') conditions.push(sql`${minDueSubquery} < now()`);
    if (query.due === 'today') {
      conditions.push(
        sql`${minDueSubquery} >= now() AND ${minDueSubquery} < (date_trunc('day', now()) + interval '1 day')`
      );
    }
    if (query.due === 'upcoming') {
      conditions.push(sql`${minDueSubquery} >= (date_trunc('day', now()) + interval '1 day')`);
    }
  }

  const rows = await db
    .select({
      id: leads.id,
      vertical: leads.vertical,
      display_name: leads.displayName,
      email: leads.email,
      phone: leads.phone,
      preferred_language: leads.preferredLanguage,
      product: leads.product,
      source: leads.source,
      stage: leads.stage,
      owner_employee_id: leads.ownerEmployeeId,
      owner_name: employees.displayName,
      team_name: teams.name,
      record_version: leads.recordVersion,
      created_at: sql<Date>`${leads.createdAt}::timestamptz`,
      min_due: sql<Date | null>`${minDueSubquery}::timestamptz`,
    })
    .from(leads)
    .leftJoin(employees, eq(employees.id, leads.ownerEmployeeId))
    .leftJoin(teams, eq(teams.id, leads.teamId))
    .where(and(...conditions))
    .orderBy(sql`${minDueSubquery} ASC NULLS LAST`, asc(leads.id))
    .limit(200);

  return (rows as unknown as LeadRow[]).map(toSummary);
}

export async function getLead(scope: Scope, leadId: string): Promise<LeadDetail> {
  const minDueSubquery = sql<Date | null>`(SELECT min(t2.due_at) FROM lead_tasks t2 WHERE t2.lead_id = ${leads.id} AND t2.status = 'open')`;

  const [row] = await db
    .select({
      id: leads.id,
      vertical: leads.vertical,
      display_name: leads.displayName,
      email: leads.email,
      phone: leads.phone,
      preferred_language: leads.preferredLanguage,
      product: leads.product,
      source: leads.source,
      stage: leads.stage,
      owner_employee_id: leads.ownerEmployeeId,
      owner_name: employees.displayName,
      team_name: teams.name,
      record_version: leads.recordVersion,
      created_at: sql<Date>`${leads.createdAt}::timestamptz`,
      min_due: sql<Date | null>`${minDueSubquery}::timestamptz`,
    })
    .from(leads)
    .leftJoin(employees, eq(employees.id, leads.ownerEmployeeId))
    .leftJoin(teams, eq(teams.id, leads.teamId))
    .where(and(eq(leads.id, leadId), readScopeCondition(scope)));

  if (!row) throw notFound();

  const taskRows = await db
    .select({
      id: leadTasks.id,
      lead_id: leadTasks.leadId,
      action: leadTasks.action,
      purpose: leadTasks.purpose,
      due_at: sql<Date>`${leadTasks.dueAt}::timestamptz`,
      priority: leadTasks.priority,
      status: leadTasks.status,
      created_at: sql<Date>`${leadTasks.createdAt}::timestamptz`,
    })
    .from(leadTasks)
    .where(eq(leadTasks.leadId, leadId))
    .orderBy(asc(leadTasks.dueAt), asc(leadTasks.id));

  const eventRows = await db
    .select({
      id: leadEvents.id,
      lead_id: leadEvents.leadId,
      kind: leadEvents.kind,
      note: leadEvents.note,
      occurred_at: sql<Date>`${leadEvents.occurredAt}::timestamptz`,
      actor_name: sql<string>`COALESCE(${employees.displayName}, 'System')`,
    })
    .from(leadEvents)
    .leftJoin(employees, eq(employees.id, leadEvents.actorEmployeeId))
    .where(eq(leadEvents.leadId, leadId))
    .orderBy(desc(leadEvents.occurredAt), desc(leadEvents.id))
    .limit(100);

  const isOwner = row.owner_employee_id === scope.employeeId;
  return {
    id: row.id,
    displayName: row.display_name,
    phone: isOwner ? row.phone : maskPhone(row.phone),
    email: isOwner ? row.email : null,
    preferredLanguage: row.preferred_language,
    product: row.product,
    source: row.source,
    stage: row.stage as LeadDetail['stage'],
    ownerName: row.owner_name ?? 'Unassigned',
    teamName: row.team_name ?? '—',
    nextActionAt: toIso(row.min_due),
    dueStatus: dueStatusFrom(row.min_due),
    recordVersion: row.record_version,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    tasks: (taskRows as unknown as TaskRow[]).map(toTask),
    timeline: (eventRows as unknown as EventRow[]).map(toEvent),
  };
}

export async function myDay(scope: Scope): Promise<MyDayResponse> {
  const scopeCond = readScopeCondition(scope);

  const [activeLeadsRes] = await db
    .select({ n: count() })
    .from(leads)
    .where(
      and(
        eq(leads.ownerEmployeeId, scope.employeeId),
        inArray(leads.vertical, scope.verticals),
        notInArray(leads.stage, ['converted', 'lost'])
      )
    );

  const [overdueRes] = await db
    .select({ n: count() })
    .from(leadTasks)
    .innerJoin(leads, eq(leads.id, leadTasks.leadId))
    .where(
      and(
        eq(leadTasks.ownerEmployeeId, scope.employeeId),
        eq(leadTasks.status, 'open'),
        scopeCond,
        lt(leadTasks.dueAt, sql`now()`)
      )
    );

  const [dueTodayRes] = await db
    .select({ n: count() })
    .from(leadTasks)
    .innerJoin(leads, eq(leads.id, leadTasks.leadId))
    .where(
      and(
        eq(leadTasks.ownerEmployeeId, scope.employeeId),
        eq(leadTasks.status, 'open'),
        scopeCond,
        gte(leadTasks.dueAt, sql`now()`),
        lt(leadTasks.dueAt, sql`date_trunc('day', now()) + interval '1 day'`)
      )
    );

  const [upcomingRes] = await db
    .select({ n: count() })
    .from(leadTasks)
    .innerJoin(leads, eq(leads.id, leadTasks.leadId))
    .where(
      and(
        eq(leadTasks.ownerEmployeeId, scope.employeeId),
        eq(leadTasks.status, 'open'),
        scopeCond,
        gte(leadTasks.dueAt, sql`date_trunc('day', now()) + interval '1 day'`)
      )
    );

  const taskRows = await db
    .select({
      id: leadTasks.id,
      lead_id: leadTasks.leadId,
      action: leadTasks.action,
      purpose: leadTasks.purpose,
      due_at: sql<Date>`${leadTasks.dueAt}::timestamptz`,
      priority: leadTasks.priority,
      status: leadTasks.status,
      created_at: sql<Date>`${leadTasks.createdAt}::timestamptz`,
    })
    .from(leadTasks)
    .innerJoin(leads, eq(leads.id, leadTasks.leadId))
    .where(
      and(
        eq(leadTasks.ownerEmployeeId, scope.employeeId),
        eq(leadTasks.status, 'open'),
        scopeCond
      )
    )
    .orderBy(asc(leadTasks.dueAt))
    .limit(10);

  return {
    asOf: new Date().toISOString(),
    counts: {
      overdue: Number(overdueRes?.n ?? 0),
      dueToday: Number(dueTodayRes?.n ?? 0),
      upcoming: Number(upcomingRes?.n ?? 0),
      activeLeads: Number(activeLeadsRes?.n ?? 0),
    },
    nextTasks: (taskRows as unknown as TaskRow[]).map(toTask),
    availability: null,
  };
}

export async function createFollowUp(
  scope: Scope,
  leadId: string,
  input: FollowUpInput
): Promise<{ task: LeadTask; timeline: TimelineEvent }> {
  return await db.transaction(async (tx) => {
    // Lock lead for update
    const [lead] = await tx
      .select({
        id: leads.id,
        owner_employee_id: leads.ownerEmployeeId,
        stage: leads.stage,
      })
      .from(leads)
      .where(and(eq(leads.id, leadId), readScopeCondition(scope)))
      .for('update');

    if (!lead) throw notFound();
    if (scope.role !== 'SC') {
      throw forbidden('Only sales callers can schedule follow-ups for prospects.');
    }
    if (lead.owner_employee_id !== scope.employeeId) {
      throw forbidden('Only the current owner can schedule follow-ups for this lead.');
    }

    const [dup] = await tx
      .select({ id: leadTasks.id })
      .from(leadTasks)
      .where(
        and(
          eq(leadTasks.leadId, leadId),
          eq(leadTasks.action, input.action),
          eq(leadTasks.purpose, input.purpose),
          eq(leadTasks.status, 'open')
        )
      )
      .limit(1);

    if (dup) {
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

    const [taskRow] = await tx
      .insert(leadTasks)
      .values({
        id: taskId,
        leadId,
        ownerEmployeeId: scope.employeeId,
        action: input.action,
        purpose: input.purpose,
        dueAt: dueDate.toISOString(),
        priority: input.priority,
        status: 'open',
      })
      .returning();

    if (input.reminderMinutes) {
      await tx.insert(reminders).values({
        id: `REM-${suffix}`,
        taskId,
        remindAt: new Date(dueDate.getTime() - input.reminderMinutes * 60_000).toISOString(),
        status: 'scheduled',
      });
    }

    const [eventRow] = await tx
      .insert(leadEvents)
      .values({
        id: eventId,
        leadId,
        actorEmployeeId: scope.employeeId,
        kind: 'follow-up-scheduled',
        note,
      })
      .returning();

    await tx
      .update(leads)
      .set({
        updatedAt: sql`now()`,
        recordVersion: sql`${leads.recordVersion} + 1`,
        stage: sql`CASE WHEN ${leads.stage} IN ('converted', 'lost') THEN ${leads.stage} ELSE 'follow-up' END`,
      })
      .where(eq(leads.id, leadId));

    const task = toTask({
      id: taskRow.id,
      lead_id: taskRow.leadId,
      action: taskRow.action,
      purpose: taskRow.purpose,
      due_at: new Date(taskRow.dueAt),
      priority: taskRow.priority,
      status: taskRow.status,
      created_at: new Date(taskRow.createdAt),
    });

    const timeline = toEvent({
      id: eventRow.id,
      lead_id: eventRow.leadId,
      kind: eventRow.kind,
      note: eventRow.note,
      occurred_at: new Date(eventRow.occurredAt),
      actor_name: scope.displayName,
    });

    return { task, timeline };
  });
}
