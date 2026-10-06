import type {
  CallRecord,
  CallStartInput,
  InboundMessageInput,
  ManualActivityInput,
  MessageRecord,
  WhatsAppSendInput,
  WrapUpInput,
} from '@finverse/contracts';
import { pool } from './db';
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
  const { rows } = await pool.query<{ channels: string[] }>(
    `SELECT channels FROM contact_suppressions WHERE lead_id = $1 AND active = true`,
    [leadId]
  );
  return rows.flatMap((r) => r.channels);
}

async function assertLeadInScope(scope: Scope, leadId: string): Promise<ScopedLead> {
  return requireLeadForRead(scope, leadId);
}

function toCall(row: any): CallRecord {
  return {
    id: row.id,
    leadId: row.lead_id,
    direction: row.direction,
    providerMode: row.provider_mode,
    status: row.status,
    evidenceStatus: row.evidence_status,
    startedAt: new Date(row.started_at).toISOString(),
    endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : null,
    durationSeconds: row.duration_seconds,
    needsWrapup: row.needs_wrapup,
    wrapupDisposition: row.wrapup_disposition,
    wrapupNote: row.wrapup_note,
  };
}

function toMessage(row: any): MessageRecord {
  return {
    id: row.id,
    leadId: row.lead_id,
    direction: row.direction,
    channel: row.channel,
    template: row.template,
    body: row.body,
    status: row.status,
    evidenceStatus: row.evidence_status,
    intent: row.intent,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function startCall(scope: Scope, leadId: string, input: CallStartInput): Promise<CallRecord> {
  const lead = await requireLeadForWrite(scope, leadId);
  const suppressed = await activeSuppressions(leadId);
  if (!channelEligibleForCall(suppressed)) {
    throw forbidden('Contact suppression active: voice calls are blocked for this prospect.');
  }
  const existing = await pool.query(
    `SELECT * FROM calls WHERE idempotency_key = $1 AND actor_employee_id = $2 AND lead_id = $3`,
    [input.idempotencyKey, scope.employeeId, leadId]
  );
  if (existing.rows[0]) return toCall(existing.rows[0]);
  const callId = id('CALL');
  try {
    const { rows } = await pool.query(
      `INSERT INTO calls (id, lead_id, actor_employee_id, direction, provider_mode, idempotency_key, status, evidence_status, needs_wrapup)
       VALUES ($1, $2, $3, 'outbound', $4, $5, 'connecting', 'simulated', false)
       RETURNING *`,
      [callId, leadId, scope.employeeId, input.mode, input.idempotencyKey]
    );
    return toCall(rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') {
      const again = await pool.query(
        `SELECT * FROM calls WHERE idempotency_key = $1 AND actor_employee_id = $2 AND lead_id = $3`,
        [input.idempotencyKey, scope.employeeId, leadId]
      );
      if (again.rows[0]) return toCall(again.rows[0]);
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
  const { rows } = await pool.query(`SELECT * FROM calls WHERE id = $1 AND actor_employee_id = $2`, [callId, scope.employeeId]);
  const call = rows[0];
  if (!call) throw notFound();
  const allowed = CALL_TRANSITIONS[call.status] ?? [];
  if (!allowed.includes(status)) {
    throw new HttpError(422, 'VALIDATION_FAILED', `Cannot move a ${call.status} call to ${status}.`, {});
  }
  const ended = ['ended', 'failed', 'no-answer'].includes(status);
  const { rows: updated } = await pool.query(
    `UPDATE calls SET status = $2,
       ended_at = CASE WHEN $3 THEN now() ELSE ended_at END,
       duration_seconds = CASE WHEN $3 AND $2 = 'ended' THEN GREATEST(0, floor(extract(epoch FROM (now() - started_at))))::int ELSE duration_seconds END,
       needs_wrapup = CASE WHEN $2 IN ('ended', 'no-answer') THEN true ELSE needs_wrapup END
     WHERE id = $1 RETURNING *`,
    [callId, status, ended]
  );
  return toCall(updated[0]);
}

export async function saveWrapup(scope: Scope, callId: string, input: WrapUpInput) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM calls WHERE id = $1 FOR UPDATE`, [callId]);
    const call = rows[0];
    if (!call) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    if (call.actor_employee_id !== scope.employeeId) {
      await client.query('ROLLBACK');
      throw forbidden('Only the caller who placed the call can save its wrap-up.');
    }
    if (call.wrapup_saved_at) {
      await client.query('ROLLBACK');
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'Wrap-up already saved for this call. Repeated saves count once.');
    }
    if (input.dueAt && !input.nextAction) {
      await client.query('ROLLBACK');
      throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
        fieldErrors: { nextAction: ['A follow-up needs a due time and owner.'] },
      });
    }
    if (input.dueAt) {
      const due = new Date(input.dueAt);
      if (Number.isNaN(due.getTime())) {
        await client.query('ROLLBACK');
        throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
          fieldErrors: { dueAt: ['Enter a valid date and time.'] },
        });
      }
    }
    const { rows: leadRows } = await client.query(`SELECT team_id FROM leads WHERE id = $1`, [call.lead_id]);
    const leadTeam = leadRows[0]?.team_id ?? null;
    const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, leadTeam);
    await client.query(
      `UPDATE calls SET wrapup_disposition = $2, wrapup_need_confirmed = $3, wrapup_note = $4,
         wrapup_next_action = $5, wrapup_due_at = $6, wrapup_saved_at = now(), needs_wrapup = false
       WHERE id = $1`,
      [callId, input.disposition, input.needConfirmed, input.note, input.nextAction ?? null, input.dueAt ? new Date(input.dueAt) : null]
    );
    await client.query(
      `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
       VALUES ($1, $2, $3, 'note', $4, $5, $6, $7)`,
      [
        id('EVT'),
        call.lead_id,
        scope.employeeId,
        `Call wrap-up (${callId}, ${SIMULATED_LABEL}): ${input.disposition} — ${input.note}`,
        actorRole,
        actorTeam,
        actorAssignment,
      ]
    );
    // Allowed stage event: connected call can move not-contacted -> contacted. No-answer never sets Contacted.
    const { rows: stageRows } = await client.query(`SELECT stage FROM leads WHERE id = $1`, [call.lead_id]);
    const stage = stageRows[0]?.stage;
    if (input.disposition === 'connected' && stage === 'not-contacted') {
      await client.query(`UPDATE leads SET stage = 'contacted', updated_at = now(), record_version = record_version + 1 WHERE id = $1`, [call.lead_id]);
      await client.query(
        `INSERT INTO stage_events (id, lead_id, actor_employee_id, from_stage, to_stage, reason, rule_version)
         VALUES ($1, $2, $3, 'not-contacted', 'connected', 'connected call wrap-up', 'wealth-v1')`,
        [id('STG'), call.lead_id, scope.employeeId]
      );
    }
    // Close the completed call task (earliest open voice-call task), create the next task atomically.
    await client.query(
      `UPDATE lead_tasks SET status = 'completed', completed_at = now()
       WHERE id = (
         SELECT id FROM lead_tasks WHERE lead_id = $1 AND action = 'voice-call' AND status = 'open'
         ORDER BY due_at ASC LIMIT 1
       )`,
      [call.lead_id]
    );
    if (input.nextAction && input.dueAt) {
      await client.query(
        `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
         VALUES ($1, $2, $3, 'other', $4, $5, 'normal', 'open')`,
        [id('TASK'), call.lead_id, scope.employeeId, input.nextAction, new Date(input.dueAt)]
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
  const { rows } = await pool.query(
    `INSERT INTO calls (id, lead_id, actor_employee_id, direction, provider_mode, status, evidence_status,
       started_at, ended_at, duration_seconds, wrapup_disposition, wrapup_note, wrapup_saved_at, needs_wrapup)
     VALUES ($1, $2, $3, 'outbound', $4, 'ended', 'manual', $5, $5, $6, 'connected', $7, now(), false)
     RETURNING *`,
    [callId, leadId, scope.employeeId, input.activityType, occurred, input.durationMinutes ?? 0, `${input.outcome} — ${input.reason} — ${input.note}`]
  );
  const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, lead.team_id);
  await pool.query(
    `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
     VALUES ($1, $2, $3, 'note', $4, $5, $6, $7)`,
    [
      id('EVT'),
      leadId,
      scope.employeeId,
      `Manual activity logged (MANUAL — self-reported, unverified): ${input.activityType} — ${input.outcome} — ${input.note}`,
      actorRole,
      actorTeam,
      actorAssignment,
    ]
  );
  return toCall(rows[0]);
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
  const { rows } = await pool.query(
    `INSERT INTO messages (id, lead_id, actor_employee_id, direction, channel, template, body, provider_ref, status, evidence_status)
     VALUES ($1, $2, $3, 'outbound', 'whatsapp', $4, $5, $6, 'queued', 'simulated') RETURNING *`,
    [msgId, leadId, scope.employeeId, input.template, input.bodyPreview, `sim-${msgId}`]
  );
  return toMessage(rows[0]);
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
  const { rows: current } = await pool.query(`SELECT * FROM messages WHERE id = $1 AND actor_employee_id = $2`, [messageId, scope.employeeId]);
  const message = current[0];
  if (!message) throw notFound();
  const allowed = MESSAGE_TRANSITIONS[message.status] ?? [];
  if (!allowed.includes(status)) {
    throw new HttpError(422, 'VALIDATION_FAILED', `Cannot move a ${message.status} message to ${status}.`, {});
  }
  const { rows } = await pool.query(
    `UPDATE messages SET status = $2 WHERE id = $1 AND actor_employee_id = $3 RETURNING *`,
    [messageId, status, scope.employeeId]
  );
  return toMessage(rows[0]);
}

export async function receiveInbound(scope: Scope, input: InboundMessageInput) {
  const receivedAt = new Date(input.receivedAt);
  const dedupe = await pool.query(`SELECT id FROM messages WHERE inbound_dedupe_key = $1`, [input.inboundKey]);
  if ((dedupe.rowCount ?? 0) > 0) throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'Inbound event already recorded.');
  if (!input.matchedLeadId) {
    const msgId = id('MSG');
    await pool.query(
      `INSERT INTO messages (id, actor_employee_id, direction, channel, body, intent, status, evidence_status, inbound_dedupe_key, supervisor_queue, created_at)
       VALUES ($1, $2, 'inbound', $3, $4, $5, 'unmatched', 'simulated', $6, true, $7)`,
      [msgId, scope.employeeId, input.channel === 'voice' ? 'whatsapp' : input.channel, input.body, input.intent, input.inboundKey, receivedAt]
    );
    return { status: 'unmatched', routedTo: 'supervisor-queue' };
  }
  const lead = await requireLeadForWrite(scope, input.matchedLeadId);
  const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, lead.team_id);
  const msgId = id('MSG');
  await pool.query(
    `INSERT INTO messages (id, lead_id, actor_employee_id, direction, channel, body, intent, status, evidence_status, inbound_dedupe_key, created_at)
     VALUES ($1, $2, $3, 'inbound', $4, $5, $6, 'received', 'simulated', $7, $8)`,
    [msgId, input.matchedLeadId, scope.employeeId, input.channel === 'voice' ? 'whatsapp' : input.channel, input.body, input.intent, input.inboundKey, receivedAt]
  );
  await pool.query(
    `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
     VALUES ($1, $2, $3, 'other', $4, $5, 'high', 'open')`,
    [id('TASK'), input.matchedLeadId, lead.owner_employee_id ?? scope.employeeId, `Inbound follow-up: ${input.intent}`, new Date(Date.now() + 86_400_000)]
  );
  void actorRole; void actorTeam; void actorAssignment;
  return { status: 'received', routedTo: lead.owner_employee_id };
}

export async function recordOptOut(scope: Scope, leadId: string, input: {
  request: string; source: string; receivedAt: string; channels: string[]; complaintNote?: string;
}) {
  const lead = await requireLeadForWrite(scope, leadId);
  const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, lead.team_id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO contact_suppressions (id, lead_id, created_by, channels, reason, source, active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [id('SUP'), leadId, scope.employeeId, input.channels, input.request, input.source]
    );
    await client.query(`UPDATE messages SET status = 'cancelled' WHERE lead_id = $1 AND status = 'queued'`, [leadId]);
    await client.query(
      `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
       VALUES ($1, $2, $3, 'note', $4, $5, $6, $7)`,
      [
        id('EVT'),
        leadId,
        scope.employeeId,
        `Opt-out recorded (${input.channels.join(', ')}) — suppression active immediately. Source: ${input.source}.`,
        actorRole,
        actorTeam,
        actorAssignment,
      ]
    );
    if (input.complaintNote) {
      await client.query(
        `INSERT INTO outcome_requests (id, lead_id, actor_employee_id, type, payload, status)
         VALUES ($1, $2, $3, 'blocker', $4, 'pending')`,
        [id('REQ'), leadId, scope.employeeId, JSON.stringify({ kind: 'complaint', note: input.complaintNote, receivedAt: input.receivedAt })]
      );
      await client.query(
        `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
         VALUES ($1, $2, $3, 'other', $4, $5, 'high', 'open')`,
        [id('TASK'), leadId, scope.employeeId, 'Complaint resolution follow-up', new Date(Date.now() + 86_400_000)]
      );
    }
    await client.query('COMMIT');
    return { ok: true, suppressed: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function listConversations(scope: Scope, leadId: string) {
  await assertLeadInScope(scope, leadId);
  const { rows: calls } = await pool.query(`SELECT * FROM calls WHERE lead_id = $1 ORDER BY started_at DESC`, [leadId]);
  const { rows: messages } = await pool.query(`SELECT * FROM messages WHERE lead_id = $1 ORDER BY created_at DESC`, [leadId]);
  return { calls: calls.map(toCall), messages: messages.map(toMessage) };
}
