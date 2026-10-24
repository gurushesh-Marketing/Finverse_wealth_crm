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
import { eq, and, or, inArray, gte, lt, desc, asc, sql } from 'drizzle-orm';
import { db } from './db';
import {
  availabilityChanges,
  savedViews,
  calls,
  leadTasks,
  leads,
  messages,
  targetAllocations,
  teamTargets,
  reminders,
  leadEvents,
  outcomeRequests,
  meetings,
} from '../db/schema';
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
  const [row] = await db
    .select({
      status: availabilityChanges.status,
      effective_from: availabilityChanges.effectiveFrom,
    })
    .from(availabilityChanges)
    .where(eq(availabilityChanges.employeeId, scope.employeeId))
    .orderBy(desc(availabilityChanges.effectiveFrom))
    .limit(1);

  return row
    ? {
        status: row.status as AvailabilityStatus,
        effectiveFrom: new Date(row.effective_from).toISOString(),
      }
    : null;
}

export async function setAvailability(scope: Scope, input: AvailabilityChangeInput) {
  const rowId = id('AVL');
  await db.insert(availabilityChanges).values({
    id: rowId,
    employeeId: scope.employeeId,
    status: input.status,
    note: input.note ?? null,
  });
  return getAvailability(scope);
}

export async function listSavedViews(scope: Scope): Promise<SavedView[]> {
  const rows = await db
    .select({
      id: savedViews.id,
      name: savedViews.name,
      filters: savedViews.filters,
      created_at: savedViews.createdAt,
    })
    .from(savedViews)
    .where(eq(savedViews.employeeId, scope.employeeId))
    .orderBy(asc(savedViews.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    filters: r.filters as LeadsQuery,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function createSavedView(scope: Scope, input: SavedViewInput): Promise<SavedView> {
  const rowId = id('VIEW');
  try {
    const [r] = await db
      .insert(savedViews)
      .values({
        id: rowId,
        employeeId: scope.employeeId,
        name: input.name,
        filters: input.filters as any,
      })
      .returning();

    return {
      id: r.id,
      name: r.name,
      filters: r.filters as LeadsQuery,
      createdAt: new Date(r.createdAt).toISOString(),
    };
  } catch (err: any) {
    if (err?.code === '23505' || err?.cause?.code === '23505') {
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'A saved view with this name already exists.');
    }
    throw err;
  }
}

export async function deleteSavedView(scope: Scope, viewId: string): Promise<void> {
  const deleted = await db
    .delete(savedViews)
    .where(and(eq(savedViews.id, viewId), eq(savedViews.employeeId, scope.employeeId)))
    .returning({ id: savedViews.id });

  if (deleted.length === 0) throw notFound();
}

// My-day operating signal (deck modules: trend / where-to-next / stage flow / completion / WHR).
// All values computed from stored facts; simulated activity is labelled downstream.
export async function daySignal(scope: Scope) {
  const trendRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${calls.startedAt}), 'Dy')`,
      n: sql<number>`COUNT(*)::int`,
    })
    .from(calls)
    .where(
      and(
        eq(calls.actorEmployeeId, scope.employeeId),
        gte(calls.startedAt, sql`now() - interval '7 days'`)
      )
    )
    .groupBy(sql`date_trunc('day', ${calls.startedAt})`)
    .orderBy(sql`date_trunc('day', ${calls.startedAt})`);

  const [prevRow] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(calls)
    .where(
      and(
        eq(calls.actorEmployeeId, scope.employeeId),
        gte(calls.startedAt, sql`now() - interval '14 days'`),
        lt(calls.startedAt, sql`now() - interval '7 days'`)
      )
    );

  const [attRow] = await db
    .select({
      callbacks: sql<number>`(
        SELECT COUNT(*)::int FROM lead_tasks t JOIN leads l ON l.id = t.lead_id
        WHERE t.owner_employee_id = ${scope.employeeId} AND t.status = 'open' AND t.action = 'voice-call' AND t.due_at < now() + interval '12 hours'
      )`,
      uncontacted: sql<number>`(
        SELECT COUNT(*)::int FROM leads l
        WHERE l.owner_employee_id = ${scope.employeeId} AND l.stage IN ('new', 'not-contacted') AND l.created_at >= date_trunc('day', now())
      )`,
      replies: sql<number>`(
        SELECT COUNT(*)::int FROM messages m
        WHERE m.actor_employee_id = ${scope.employeeId} AND m.direction = 'inbound' AND m.created_at >= now() - interval '24 hours'
      )`,
      open_leads: sql<number>`(
        SELECT COUNT(*)::int FROM leads l WHERE l.owner_employee_id = ${scope.employeeId} AND l.stage NOT IN ('converted', 'lost')
      )`,
    })
    .from(sql`(SELECT 1) as dummy`);

  const flow = await db
    .select({
      stage: leads.stage,
      n: sql<number>`COUNT(*)::int`,
    })
    .from(leads)
    .where(
      and(
        eq(leads.ownerEmployeeId, scope.employeeId),
        sql`${leads.stage} NOT IN ('converted', 'lost')`
      )
    )
    .groupBy(leads.stage);

  const [callsTodayRow] = await db
    .select({
      done: sql<number>`(
        SELECT COUNT(*)::int FROM calls WHERE actor_employee_id = ${scope.employeeId} AND started_at >= date_trunc('day', now())
      )`,
      planned: sql<number>`(
        SELECT COUNT(*)::int FROM lead_tasks WHERE owner_employee_id = ${scope.employeeId} AND action = 'voice-call'
          AND (status = 'completed' OR (status = 'open' AND due_at < now() + interval '1 day'))
      )`,
    })
    .from(sql`(SELECT 1) as dummy`);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [winsRow] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(leads)
    .where(
      and(
        eq(leads.ownerEmployeeId, scope.employeeId),
        eq(leads.stage, 'converted'),
        gte(leads.updatedAt, monthStart.toISOString())
      )
    );

  const [targetRow] = await db
    .select({
      v: sql<number>`COALESCE(SUM(${targetAllocations.allocatedValue}), 0)::float`,
    })
    .from(targetAllocations)
    .innerJoin(teamTargets, eq(teamTargets.id, targetAllocations.targetId))
    .where(
      and(
        eq(targetAllocations.employeeId, scope.employeeId),
        eq(targetAllocations.version, teamTargets.version),
        eq(teamTargets.periodLabel, sql`to_char(now(), 'Mon-YYYY')`)
      )
    );

  const trend = trendRows.map((r) => r.n);
  const trendTotal = trend.reduce((a, b) => a + b, 0);
  const trendPrev = prevRow?.n ?? 0;
  const delta = trendPrev > 0 ? Math.round(((trendTotal - trendPrev) / trendPrev) * 1000) / 10 : null;
  const a = attRow ?? { callbacks: 0, uncontacted: 0, replies: 0, open_leads: 0 };
  const planned = callsTodayRow?.planned ?? 0;
  const winTarget = Number(targetRow?.v ?? 0);
  void scope;

  return {
    trend: { days: trendRows.map((r) => r.day), counts: trend, total: trendTotal, deltaPct: delta, simulated: true },
    attention: [
      { count: a.callbacks, label: 'Promised callbacks', caption: 'Due before noon', href: '/wealth/tasks' },
      { count: a.uncontacted, label: 'Uncontacted today', caption: 'New website and Insta leads', href: '/wealth/prospects' },
      { count: a.replies, label: 'Replies to review', caption: 'Two require a call', href: '/wealth/activities' },
    ],
    stageFlow: flow.map((f) => ({ stage: f.stage, count: f.n })),
    completion: { done: callsTodayRow?.done ?? 0, planned, caption: 'calls against plan' },
    whr: { wins: winsRow?.n ?? 0, target: winTarget, caption: 'wins this month', basis: 'WHR to target — [ASSUMPTION] wins secured vs approved win target' },
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

  const rows = await db
    .select({
      id: reminders.id,
      task_id: reminders.taskId,
      remind_at: reminders.remindAt,
      status: reminders.status,
    })
    .from(reminders)
    .where(inArray(reminders.taskId, taskIds))
    .orderBy(asc(reminders.remindAt));

  for (const r of rows) {
    const list = map.get(r.task_id) ?? [];
    list.push({
      id: r.id,
      taskId: r.task_id,
      remindAt: new Date(r.remind_at).toISOString(),
      status: r.status as ReminderRecord['status'],
    });
    map.set(r.task_id, list);
  }
  return map;
}

function toTaskView(row: any, reminders: Map<string, ReminderRecord[]>): TaskView {
  return {
    id: row.id,
    leadId: row.leadId ?? row.lead_id,
    leadName: row.leadName ?? row.lead_name ?? undefined,
    leadStage: row.leadStage ?? row.lead_stage ?? undefined,
    leadSource: row.leadSource ?? row.lead_source ?? undefined,
    action: row.action,
    purpose: row.purpose,
    dueAt: new Date(row.dueAt ?? row.due_at).toISOString(),
    originalDueAt: (row.originalDueAt ?? row.original_due_at)
      ? new Date(row.originalDueAt ?? row.original_due_at).toISOString()
      : null,
    priority: row.priority,
    status: row.status,
    deferralCount: row.deferralCount ?? row.deferral_count,
    reminders: reminders.get(row.id) ?? [],
  };
}

export async function listMyTasks(scope: Scope, leadId?: string): Promise<TaskView[]> {
  const conditions = [eq(leadTasks.ownerEmployeeId, scope.employeeId)];
  if (leadId) {
    conditions.push(eq(leadTasks.leadId, leadId));
  }

  const rows = await db
    .select({
      id: leadTasks.id,
      lead_id: leadTasks.leadId,
      action: leadTasks.action,
      purpose: leadTasks.purpose,
      due_at: leadTasks.dueAt,
      original_due_at: leadTasks.originalDueAt,
      priority: leadTasks.priority,
      status: leadTasks.status,
      deferral_count: leadTasks.deferralCount,
      lead_name: leads.displayName,
      lead_stage: leads.stage,
      lead_source: leads.source,
    })
    .from(leadTasks)
    .leftJoin(leads, eq(leads.id, leadTasks.leadId))
    .where(and(...conditions))
    .orderBy(asc(leadTasks.dueAt));

  const remindersMap = await taskReminders(rows.map((r) => r.id));
  return rows.map((r) => toTaskView(r, remindersMap));
}

export async function addReminder(taskId: string, dueAt: Date, minutesBefore: number): Promise<ReminderRecord> {
  const remindAt = new Date(dueAt.getTime() - minutesBefore * 60_000);
  const rowId = id('REM');
  const [r] = await db
    .insert(reminders)
    .values({
      id: rowId,
      taskId,
      remindAt: remindAt.toISOString(),
      status: 'scheduled',
    })
    .returning();

  return { id: r.id, taskId: r.taskId, remindAt: new Date(r.remindAt).toISOString(), status: 'scheduled' };
}

export async function executeDueReminders(now: Date): Promise<number> {
  const rows = await db
    .select({
      id: reminders.id,
      taskId: reminders.taskId,
      leadId: leadTasks.leadId,
      ownerEmployeeId: leadTasks.ownerEmployeeId,
      purpose: leadTasks.purpose,
    })
    .from(reminders)
    .innerJoin(leadTasks, eq(leadTasks.id, reminders.taskId))
    .where(
      and(
        eq(reminders.status, 'scheduled'),
        sql`${reminders.remindAt} <= ${now.toISOString()}`
      )
    );

  if (rows.length === 0) return 0;

  await db.transaction(async (tx) => {
    for (const r of rows) {
      await tx
        .update(reminders)
        .set({ status: 'sent' })
        .where(eq(reminders.id, r.id));

      await tx.insert(leadEvents).values({
        id: id('EVT'),
        leadId: r.leadId,
        actorEmployeeId: r.ownerEmployeeId,
        kind: 'task-updated',
        note: `Reminder sent for follow-up: ${r.purpose}`,
      });
    }
  });

  return rows.length;
}

export async function rescheduleTask(scope: Scope, taskId: string, input: RescheduleInput) {
  return await db.transaction(async (tx) => {
    const [task] = await tx
      .select()
      .from(leadTasks)
      .where(and(eq(leadTasks.id, taskId), eq(leadTasks.ownerEmployeeId, scope.employeeId)))
      .for('update');

    if (!task) throw notFound();

    const newDue = new Date(input.newDueAt);
    if (Number.isNaN(newDue.getTime()) || newDue.getTime() <= Date.now()) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
        fieldErrors: { newDueAt: ['New due time must be in the future.'] },
      });
    }

    const deferrals = task.deferralCount + 1;
    const originalDue = task.originalDueAt ?? task.dueAt;
    if (deferrals > MAX_DEFERRALS_BEFORE_APPROVAL) {
      const reqId = id('REQ');
      await tx
        .update(leadTasks)
        .set({ deferralCount: deferrals })
        .where(eq(leadTasks.id, taskId));

      await tx.insert(outcomeRequests).values({
        id: reqId,
        leadId: task.leadId,
        actorEmployeeId: scope.employeeId,
        type: 'correction',
        payload: {
          kind: 'reschedule-approval',
          taskId,
          requestedDueAt: newDue.toISOString(),
          reason: input.reason,
          deferralCount: deferrals,
        },
        status: 'pending',
      });

      return {
        status: 'pending-approval' as const,
        requestId: reqId,
        task: toTaskView({ ...task, deferralCount: deferrals }, new Map()),
      };
    }

    await tx
      .update(leadTasks)
      .set({
        originalDueAt: sql`COALESCE(${leadTasks.originalDueAt}, ${leadTasks.dueAt})`,
        dueAt: newDue.toISOString(),
        deferralCount: deferrals,
      })
      .where(eq(leadTasks.id, taskId));

    await tx
      .update(reminders)
      .set({ status: 'cancelled' })
      .where(and(eq(reminders.taskId, taskId), eq(reminders.status, 'scheduled')));

    await tx.insert(leadEvents).values({
      id: id('EVT'),
      leadId: task.leadId,
      actorEmployeeId: scope.employeeId,
      kind: 'task-updated',
      note: `Task rescheduled: original due ${new Date(originalDue).toUTCString()} -> ${newDue.toUTCString()} (${input.reason}; customer informed: ${input.customerInformed ? 'yes' : 'no'})`,
      actorRole: scope.role,
      actorTeamId: scope.teams[0] ?? null,
      assignmentId: scope.assignmentId ?? null,
    });

    const [fresh] = await tx.select().from(leadTasks).where(eq(leadTasks.id, taskId));
    return { status: 'rescheduled' as const, requestId: null, task: toTaskView(fresh, new Map()) };
  });
}

export async function transitionTask(scope: Scope, taskId: string, input: TaskTransitionInput) {
  return await db.transaction(async (tx) => {
    const [task] = await tx
      .select({
        id: leadTasks.id,
        leadId: leadTasks.leadId,
        ownerEmployeeId: leadTasks.ownerEmployeeId,
        purpose: leadTasks.purpose,
        status: leadTasks.status,
        leadTeam: leads.teamId,
      })
      .from(leadTasks)
      .innerJoin(leads, eq(leads.id, leadTasks.leadId))
      .where(
        and(
          eq(leadTasks.id, taskId),
          or(
            eq(leads.ownerEmployeeId, scope.employeeId),
            inArray(leads.teamId, scope.teams)
          )
        )
      );

    if (!task) throw notFound();
    if (task.ownerEmployeeId !== scope.employeeId) {
      throw forbidden('This task moved to another owner and cannot be completed from your screen.');
    }
    const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, task.leadTeam);
    let note = '';
    if (input.action === 'complete') {
      if (task.status !== 'open') {
        throw new HttpError(409, 'DUPLICATE_OPEN_TASK', `Task is already ${task.status}.`);
      }
      if (!input.outcome) {
        throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
          fieldErrors: { outcome: ['Completion must have a truthful outcome.'] },
        });
      }
      await tx
        .update(leadTasks)
        .set({ status: 'completed', completedAt: sql`now()` })
        .where(eq(leadTasks.id, taskId));
      await tx
        .update(reminders)
        .set({ status: 'cancelled' })
        .where(and(eq(reminders.taskId, taskId), eq(reminders.status, 'scheduled')));
      note = `Task completed: ${task.purpose} — ${input.outcome}${input.evidence ? ` (evidence: ${input.evidence})` : ''}`;
    } else if (input.action === 'cancel') {
      if (!input.cancellationReason) {
        throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
          fieldErrors: { cancellationReason: ['Cancellation needs an allowed reason.'] },
        });
      }
      await tx
        .update(leadTasks)
        .set({ status: 'cancelled', completedAt: sql`now()` })
        .where(eq(leadTasks.id, taskId));
      await tx
        .update(reminders)
        .set({ status: 'cancelled' })
        .where(and(eq(reminders.taskId, taskId), eq(reminders.status, 'scheduled')));
      note = `Task cancelled: ${task.purpose} (${input.cancellationReason})`;
    } else {
      if (task.status !== 'completed' && task.status !== 'cancelled') {
        throw new HttpError(422, 'VALIDATION_FAILED', 'Only finished tasks can be reopened.', {});
      }
      await tx
        .update(leadTasks)
        .set({ status: 'open', completedAt: null })
        .where(eq(leadTasks.id, taskId));
      note = `Task reopened (logged correction): ${task.purpose}`;
    }

    await tx.insert(leadEvents).values({
      id: id('EVT'),
      leadId: task.leadId,
      actorEmployeeId: scope.employeeId,
      kind: 'task-updated',
      note,
      actorRole,
      actorTeamId: actorTeam,
      assignmentId: actorAssignment,
    });

    if (input.action === 'complete' && input.nextStep && input.nextDueAt) {
      const nextDue = new Date(input.nextDueAt);
      await tx.insert(leadTasks).values({
        id: id('TASK'),
        leadId: task.leadId,
        ownerEmployeeId: scope.employeeId,
        action: 'other',
        purpose: input.nextStep,
        dueAt: nextDue.toISOString(),
        priority: 'normal',
        status: 'open',
      });
    }

    return { ok: true };
  });
}

export async function bookMeeting(scope: Scope, leadId: string, input: MeetingInput) {
  const slot = new Date(input.slotAt);
  if (Number.isNaN(slot.getTime()) || slot.getTime() <= Date.now()) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { slotAt: ['Choose a future slot.'] },
    });
  }

  return await db.transaction(async (tx) => {
    if (scope.role !== 'SC') {
      throw forbidden('Only sales callers can book meetings on prospects.');
    }

    const [lead] = await tx
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(
          eq(leads.id, leadId),
          inArray(leads.vertical, scope.verticals),
          eq(leads.ownerEmployeeId, scope.employeeId)
        )
      )
      .for('update');

    if (!lead) throw notFound();

    const [conflict] = await tx
      .select({ id: meetings.id })
      .from(meetings)
      .where(
        and(
          eq(meetings.actorEmployeeId, scope.employeeId),
          eq(meetings.slotAt, slot.toISOString()),
          sql`${meetings.outcome} IS NULL`
        )
      )
      .limit(1);

    if (conflict) {
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'That slot is already booked. Choose an alternative slot.');
    }

    const meetingId = id('MTG');
    await tx.insert(meetings).values({
      id: meetingId,
      leadId,
      actorEmployeeId: scope.employeeId,
      meetingType: input.meetingType,
      slotAt: slot.toISOString(),
      location: input.location,
      attendees: input.attendees,
      agenda: input.agenda,
      inviteStatus: 'queued',
    });

    await tx.insert(leadTasks).values({
      id: id('TASK'),
      leadId,
      ownerEmployeeId: scope.employeeId,
      action: 'meeting',
      purpose: `${input.meetingType}: ${input.agenda}`,
      dueAt: slot.toISOString(),
      priority: 'normal',
      status: 'open',
    });

    await tx.insert(leadEvents).values({
      id: id('EVT'),
      leadId,
      actorEmployeeId: scope.employeeId,
      kind: 'note',
      note: `Meeting booked (${input.meetingType}) for ${slot.toUTCString()} at ${input.location}. Invite status: simulated — no provider integration.`,
      actorRole: scope.role,
      actorTeamId: scope.teams[0] ?? null,
      assignmentId: scope.assignmentId ?? null,
    });

    await tx
      .update(meetings)
      .set({ inviteStatus: 'delivered' })
      .where(eq(meetings.id, meetingId));

    const [m] = await tx.select().from(meetings).where(eq(meetings.id, meetingId));
    return {
      id: m.id,
      leadId: m.leadId,
      meetingType: m.meetingType,
      slotAt: new Date(m.slotAt).toISOString(),
      location: m.location,
      attendees: m.attendees,
      agenda: m.agenda,
      inviteStatus: m.inviteStatus,
      outcome: m.outcome,
    };
  });
}

export async function setMeetingOutcome(
  scope: Scope,
  meetingId: string,
  outcome: 'attended' | 'no-show' | 'cancelled'
) {
  const [row] = await db
    .update(meetings)
    .set({ outcome })
    .where(and(eq(meetings.id, meetingId), eq(meetings.actorEmployeeId, scope.employeeId)))
    .returning({ leadId: meetings.leadId });

  if (!row) throw notFound();

  await db.insert(leadEvents).values({
    id: id('EVT'),
    leadId: row.leadId,
    actorEmployeeId: scope.employeeId,
    kind: 'note',
    note: `Meeting outcome recorded: ${outcome}`,
    actorRole: scope.role,
    actorTeamId: scope.teams[0] ?? null,
    assignmentId: scope.assignmentId ?? null,
  });

  return { ok: true };
}

export { STAGE_RULE_VERSION };
