import type {
  CallRecord,
  CallStartInput,
  InboundMessageInput,
  ManualActivityInput,
  MessageRecord,
  WhatsAppSendInput,
  WrapUpInput,
} from '@finverse/contracts';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from './db';
import {
  calls,
  messages,
  contactSuppressions,
  leads,
  leadTasks,
  leadEvents,
  stageEvents,
  outcomeRequests,
} from '../db/schema';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';
import { requireLeadForRead, requireLeadForWrite, attributionFor, type ScopedLead } from '../wealth/scope';
import {
  WHATSAPP_TEMPLATES,
  channelEligibleForCall,
  channelEligibleForWhatsapp,
  isBackdatedWithinWindow,
} from '../wealth/rules';

const SIMULATED_LABEL = 'SIMULATED — no provider integration';

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

async function activeSuppressions(leadId: string): Promise<string[]> {
  const rows = await db
    .select({ channels: contactSuppressions.channels })
    .from(contactSuppressions)
    .where(and(eq(contactSuppressions.leadId, leadId), eq(contactSuppressions.active, true)));
  return rows.flatMap((r) => (r.channels as string[]) ?? []);
}

async function assertLeadInScope(scope: Scope, leadId: string): Promise<ScopedLead> {
  return requireLeadForRead(scope, leadId);
}

function toCall(row: any): CallRecord {
  return {
    id: row.id,
    leadId: row.leadId ?? row.lead_id,
    direction: row.direction,
    providerMode: row.providerMode ?? row.provider_mode,
    status: row.status,
    evidenceStatus: row.evidenceStatus ?? row.evidence_status,
    startedAt: new Date(row.startedAt ?? row.started_at).toISOString(),
    endedAt: (row.endedAt ?? row.ended_at) ? new Date(row.endedAt ?? row.ended_at).toISOString() : null,
    durationSeconds: row.durationSeconds ?? row.duration_seconds,
    needsWrapup: row.needsWrapup ?? row.needs_wrapup,
    wrapupDisposition: row.wrapupDisposition ?? row.wrapup_disposition,
    wrapupNote: row.wrapupNote ?? row.wrapup_note,
  };
}

function toMessage(row: any): MessageRecord {
  return {
    id: row.id,
    leadId: row.leadId ?? row.lead_id,
    direction: row.direction,
    channel: row.channel,
    template: row.template,
    body: row.body,
    status: row.status,
    evidenceStatus: row.evidenceStatus ?? row.evidence_status,
    intent: row.intent,
    createdAt: new Date(row.createdAt ?? row.created_at).toISOString(),
  };
}

export async function startCall(scope: Scope, leadId: string, input: CallStartInput): Promise<CallRecord> {
  const lead = await requireLeadForWrite(scope, leadId);
  const suppressed = await activeSuppressions(leadId);
  if (!channelEligibleForCall(suppressed)) {
    throw forbidden('Contact suppression active: voice calls are blocked for this prospect.');
  }
  const [existing] = await db
    .select()
    .from(calls)
    .where(
      and(
        eq(calls.idempotencyKey, input.idempotencyKey),
        eq(calls.actorEmployeeId, scope.employeeId),
        eq(calls.leadId, leadId)
      )
    );
  if (existing) return toCall(existing);

  const callId = id('CALL');
  try {
    const [row] = await db
      .insert(calls)
      .values({
        id: callId,
        leadId,
        actorEmployeeId: scope.employeeId,
        direction: 'outbound',
        providerMode: input.mode,
        idempotencyKey: input.idempotencyKey,
        status: 'connecting',
        evidenceStatus: 'simulated',
        needsWrapup: false,
      })
      .returning();
    return toCall(row);
  } catch (err: any) {
    if (err?.code === '23505' || err?.cause?.code === '23505') {
      const [again] = await db
        .select()
        .from(calls)
        .where(
          and(
            eq(calls.idempotencyKey, input.idempotencyKey),
            eq(calls.actorEmployeeId, scope.employeeId),
            eq(calls.leadId, leadId)
          )
        );
      if (again) return toCall(again);
    }
    throw err;
  }
}

const CALL_TRANSITIONS: Record<string, string[]> = {
  connecting: ['ringing', 'failed'],
  ringing: ['connected', 'no-answer', 'failed'],
  connected: ['ended'],
};

export async function advanceCall(scope: Scope, callId: string, status: string): Promise<CallRecord> {
  const [call] = await db
    .select()
    .from(calls)
    .where(and(eq(calls.id, callId), eq(calls.actorEmployeeId, scope.employeeId)));
  if (!call) throw notFound();
  const allowed = CALL_TRANSITIONS[call.status] ?? [];
  if (!allowed.includes(status)) {
    throw new HttpError(422, 'VALIDATION_FAILED', `Cannot move a ${call.status} call to ${status}.`, {});
  }
  const ended = ['ended', 'failed', 'no-answer'].includes(status);
  const [updated] = await db
    .update(calls)
    .set({
      status,
      endedAt: ended ? sql`now()` : undefined,
      durationSeconds: ended && status === 'ended'
        ? sql`GREATEST(0, floor(extract(epoch FROM (now() - ${calls.startedAt}))))::int`
        : undefined,
      needsWrapup: ['ended', 'no-answer'].includes(status) ? true : undefined,
    })
    .where(eq(calls.id, callId))
    .returning();

  return toCall(updated);
}

export async function saveWrapup(scope: Scope, callId: string, input: WrapUpInput) {
  return await db.transaction(async (tx) => {
    const [call] = await tx.select().from(calls).where(eq(calls.id, callId)).for('update');
    if (!call) throw notFound();
    if (call.actorEmployeeId !== scope.employeeId) {
      throw forbidden('Only the caller who placed the call can save its wrap-up.');
    }
    if (call.wrapupSavedAt) {
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'Wrap-up already saved for this call. Repeated saves count once.');
    }
    if (input.dueAt && !input.nextAction) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
        fieldErrors: { nextAction: ['A follow-up needs a due time and owner.'] },
      });
    }
    if (input.dueAt) {
      const due = new Date(input.dueAt);
      if (Number.isNaN(due.getTime())) {
        throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
          fieldErrors: { dueAt: ['Enter a valid date and time.'] },
        });
      }
    }

    const [leadRow] = await tx.select({ teamId: leads.teamId }).from(leads).where(eq(leads.id, call.leadId));
    const leadTeam = leadRow?.teamId ?? null;
    const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, leadTeam);

    await tx
      .update(calls)
      .set({
        wrapupDisposition: input.disposition,
        wrapupNeedConfirmed: input.needConfirmed,
        wrapupNote: input.note,
        wrapupNextAction: input.nextAction ?? null,
        wrapupDueAt: input.dueAt ? new Date(input.dueAt).toISOString() : null,
        wrapupSavedAt: sql`now()`,
        needsWrapup: false,
      })
      .where(eq(calls.id, callId));

    await tx.insert(leadEvents).values({
      id: id('EVT'),
      leadId: call.leadId,
      actorEmployeeId: scope.employeeId,
      kind: 'note',
      note: `Call wrap-up (${callId}, ${SIMULATED_LABEL}): ${input.disposition} — ${input.note}`,
      actorRole,
      actorTeamId: actorTeam,
      assignmentId: actorAssignment,
    });

    const [leadStageRow] = await tx.select({ stage: leads.stage }).from(leads).where(eq(leads.id, call.leadId));
    const stage = leadStageRow?.stage;
    if (input.disposition === 'connected' && stage === 'not-contacted') {
      await tx
        .update(leads)
        .set({
          stage: 'contacted',
          updatedAt: sql`now()`,
          recordVersion: sql`${leads.recordVersion} + 1`,
        })
        .where(eq(leads.id, call.leadId));

      await tx.insert(stageEvents).values({
        id: id('STG'),
        leadId: call.leadId,
        actorEmployeeId: scope.employeeId,
        fromStage: 'not-contacted',
        toStage: 'connected',
        reason: 'connected call wrap-up',
        ruleVersion: 'wealth-v1',
      });
    }

    const [openVoiceTask] = await tx
      .select({ id: leadTasks.id })
      .from(leadTasks)
      .where(
        and(
          eq(leadTasks.leadId, call.leadId),
          eq(leadTasks.action, 'voice-call'),
          eq(leadTasks.status, 'open')
        )
      )
      .orderBy(leadTasks.dueAt)
      .limit(1);

    if (openVoiceTask) {
      await tx
        .update(leadTasks)
        .set({ status: 'completed', completedAt: sql`now()` })
        .where(eq(leadTasks.id, openVoiceTask.id));
    }

    if (input.nextAction && input.dueAt) {
      await tx.insert(leadTasks).values({
        id: id('TASK'),
        leadId: call.leadId,
        ownerEmployeeId: scope.employeeId,
        action: 'other',
        purpose: input.nextAction,
        dueAt: new Date(input.dueAt).toISOString(),
        priority: 'normal',
        status: 'open',
      });
    }

    return { ok: true };
  });
}

export async function logManualActivity(scope: Scope, leadId: string, input: ManualActivityInput) {
  const lead = await requireLeadForWrite(scope, leadId);
  if (/call|voice/i.test(input.activityType)) {
    const suppressed = await activeSuppressions(leadId);
    if (!channelEligibleForCall(suppressed)) {
      throw forbidden('Contact suppression active: manual voice activities are blocked for this prospect.');
    }
  }
  const occurred = new Date(input.occurredAt);
  if (Number.isNaN(occurred.getTime())) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { occurredAt: ['Enter a valid event time.'] },
    });
  }
  if (occurred.getTime() > Date.now()) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { occurredAt: ['A manual activity cannot be in the future.'] },
    });
  }
  if (!isBackdatedWithinWindow(occurred)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { occurredAt: ['Backdating is allowed within a 24h window only. [ASSUMPTION]'] },
    });
  }
  const callId = id('ACT');
  const [row] = await db
    .insert(calls)
    .values({
      id: callId,
      leadId,
      actorEmployeeId: scope.employeeId,
      direction: 'outbound',
      providerMode: input.activityType,
      status: 'ended',
      evidenceStatus: 'manual',
      startedAt: occurred.toISOString(),
      endedAt: occurred.toISOString(),
      durationSeconds: input.durationMinutes ?? 0,
      wrapupDisposition: 'connected',
      wrapupNote: `${input.outcome} — ${input.reason} — ${input.note}`,
      wrapupSavedAt: sql`now()`,
      needsWrapup: false,
    })
    .returning();

  const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, lead.team_id);
  await db.insert(leadEvents).values({
    id: id('EVT'),
    leadId,
    actorEmployeeId: scope.employeeId,
    kind: 'note',
    note: `Manual activity logged (MANUAL — self-reported, unverified): ${input.activityType} — ${input.outcome} — ${input.note}`,
    actorRole,
    actorTeamId: actorTeam,
    assignmentId: actorAssignment,
  });

  return toCall(row);
}

export async function sendWhatsApp(scope: Scope, leadId: string, input: WhatsAppSendInput) {
  await requireLeadForWrite(scope, leadId);
  const suppressed = await activeSuppressions(leadId);
  if (!channelEligibleForWhatsapp(suppressed)) {
    throw forbidden('Contact suppression active: WhatsApp is blocked for this prospect.');
  }
  const variables = WHATSAPP_TEMPLATES[input.template];
  if (!variables) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { template: ['Template unavailable. Send is disabled.'] },
    });
  }
  const msgId = id('MSG');
  const [row] = await db
    .insert(messages)
    .values({
      id: msgId,
      leadId,
      actorEmployeeId: scope.employeeId,
      direction: 'outbound',
      channel: 'whatsapp',
      template: input.template,
      body: input.bodyPreview,
      providerRef: `sim-${msgId}`,
      status: 'queued',
      evidenceStatus: 'simulated',
    })
    .returning();

  return toMessage(row);
}

const MESSAGE_TRANSITIONS: Record<string, string[]> = {
  queued: ['sent', 'cancelled', 'failed'],
  sent: ['delivered', 'failed'],
  delivered: ['read', 'failed'],
  read: ['replied'],
  replied: [],
  failed: [],
  cancelled: [],
  received: [],
  unmatched: [],
};

export async function advanceMessageStatus(scope: Scope, messageId: string, status: string) {
  const [message] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.actorEmployeeId, scope.employeeId)));
  if (!message) throw notFound();
  const allowed = MESSAGE_TRANSITIONS[message.status] ?? [];
  if (!allowed.includes(status)) {
    throw new HttpError(422, 'VALIDATION_FAILED', `Cannot move a ${message.status} message to ${status}.`, {});
  }
  const [row] = await db
    .update(messages)
    .set({ status })
    .where(and(eq(messages.id, messageId), eq(messages.actorEmployeeId, scope.employeeId)))
    .returning();
  return toMessage(row);
}

export async function receiveInbound(scope: Scope, input: InboundMessageInput) {
  const receivedAt = new Date(input.receivedAt);
  const [dedupe] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.inboundDedupeKey, input.inboundKey))
    .limit(1);
  if (dedupe) throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'Inbound event already recorded.');

  if (!input.matchedLeadId) {
    const msgId = id('MSG');
    await db.insert(messages).values({
      id: msgId,
      actorEmployeeId: scope.employeeId,
      direction: 'inbound',
      channel: input.channel === 'voice' ? 'whatsapp' : input.channel,
      body: input.body,
      intent: input.intent,
      status: 'unmatched',
      evidenceStatus: 'simulated',
      inboundDedupeKey: input.inboundKey,
      supervisorQueue: true,
      createdAt: receivedAt.toISOString(),
    });
    return { status: 'unmatched', routedTo: 'supervisor-queue' };
  }

  const lead = await requireLeadForWrite(scope, input.matchedLeadId);
  const msgId = id('MSG');
  await db.insert(messages).values({
    id: msgId,
    leadId: input.matchedLeadId,
    actorEmployeeId: scope.employeeId,
    direction: 'inbound',
    channel: input.channel === 'voice' ? 'whatsapp' : input.channel,
    body: input.body,
    intent: input.intent,
    status: 'received',
    evidenceStatus: 'simulated',
    inboundDedupeKey: input.inboundKey,
    createdAt: receivedAt.toISOString(),
  });

  await db.insert(leadTasks).values({
    id: id('TASK'),
    leadId: input.matchedLeadId,
    ownerEmployeeId: lead.owner_employee_id ?? scope.employeeId,
    action: 'other',
    purpose: `Inbound follow-up: ${input.intent}`,
    dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    priority: 'high',
    status: 'open',
  });

  return { status: 'received', routedTo: lead.owner_employee_id };
}

export async function recordOptOut(
  scope: Scope,
  leadId: string,
  input: {
    request: string;
    source: string;
    receivedAt: string;
    channels: string[];
    complaintNote?: string;
  }
) {
  const lead = await requireLeadForWrite(scope, leadId);
  const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, lead.team_id);

  return await db.transaction(async (tx) => {
    await tx.insert(contactSuppressions).values({
      id: id('SUP'),
      leadId,
      createdBy: scope.employeeId,
      channels: input.channels,
      reason: input.request,
      source: input.source,
      active: true,
    });

    await tx
      .update(messages)
      .set({ status: 'cancelled' })
      .where(and(eq(messages.leadId, leadId), eq(messages.status, 'queued')));

    await tx.insert(leadEvents).values({
      id: id('EVT'),
      leadId,
      actorEmployeeId: scope.employeeId,
      kind: 'note',
      note: `Opt-out recorded (${input.channels.join(', ')}) — suppression active immediately. Source: ${input.source}.`,
      actorRole,
      actorTeamId: actorTeam,
      assignmentId: actorAssignment,
    });

    if (input.complaintNote) {
      await tx.insert(outcomeRequests).values({
        id: id('REQ'),
        leadId,
        actorEmployeeId: scope.employeeId,
        type: 'blocker',
        payload: { kind: 'complaint', note: input.complaintNote, receivedAt: input.receivedAt },
        status: 'pending',
      });

      await tx.insert(leadTasks).values({
        id: id('TASK'),
        leadId,
        ownerEmployeeId: scope.employeeId,
        action: 'other',
        purpose: 'Complaint resolution follow-up',
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        priority: 'high',
        status: 'open',
      });
    }

    return { ok: true, suppressed: true };
  });
}

export async function listConversations(scope: Scope, leadId: string) {
  await assertLeadInScope(scope, leadId);
  const callRows = await db
    .select()
    .from(calls)
    .where(eq(calls.leadId, leadId))
    .orderBy(desc(calls.startedAt));

  const messageRows = await db
    .select()
    .from(messages)
    .where(eq(messages.leadId, leadId))
    .orderBy(desc(messages.createdAt));

  return { calls: callRows.map(toCall), messages: messageRows.map(toMessage) };
}
