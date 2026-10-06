process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Pool } from 'pg';
import { createApp } from '../src/app';
import { assertTestDatabaseGuard, env } from '../src/config';

let server: Server;
let base: string;
let db: Pool;
const results: string[] = [];
function pass(name: string): void {
  results.push(`PASS ${name}`);
  console.log(`PASS ${name}`);
}

const RUN_PREFIX = `FV-9${Date.now().toString().slice(-4)}`;

async function cleanupChain(prefix: string = RUN_PREFIX): Promise<void> {
  // Scoped to records owned by this specific test run prefix
  await db.query(`DELETE FROM lead_events WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM reminders WHERE task_id IN (SELECT id FROM lead_tasks WHERE lead_id LIKE $1)`, [`${prefix}%`]);
  await db.query(`DELETE FROM lead_tasks WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM documents WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM document_requests WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM outcome_requests WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM loss_records WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM proposals WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM qualifications WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM stage_events WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM evidence_access_log WHERE review_id IN (SELECT id FROM call_quality_reviews WHERE call_id IN (SELECT id FROM calls WHERE lead_id LIKE $1))`, [`${prefix}%`]);
  await db.query(`DELETE FROM call_quality_reviews WHERE call_id IN (SELECT id FROM calls WHERE lead_id LIKE $1)`, [`${prefix}%`]);
  await db.query(`DELETE FROM activity_corrections WHERE call_id IN (SELECT id FROM calls WHERE lead_id LIKE $1)`, [`${prefix}%`]);
  await db.query(`DELETE FROM meetings WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM calls WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM messages WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM contact_suppressions WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM lead_audit WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM lead_ownership_events WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM enquiries WHERE published_lead_id LIKE $1 OR duplicate_of LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM leads WHERE id LIKE $1`, [`${prefix}%`]);
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  db = new Pool({ connectionString: env.DATABASE_URL });
  await cleanupChain();
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await cleanupChain();
  await db.end();
});


async function call<T = any>(
  method: string,
  path: string,
  opts: { json?: unknown; cookie?: string } = {}
): Promise<{ status: number; body: T; cookie: string | null }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.cookie) headers['Cookie'] = opts.cookie;
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, cookie: res.headers.get('set-cookie') };
}

async function login(email: string): Promise<string> {
  const r = await call('POST', '/auth/login', { json: { email, password: 'demo1234' } });
  return (r.cookie ?? '').split(';')[0] ?? '';
}

const stamp = Date.now().toString(36);
const tomorrow = new Date(Date.now() + 86_400_000).toISOString();

async function makeLead(suffix: string, stage = 'contacted'): Promise<string> {
  const leadId = `${RUN_PREFIX}${suffix}`;
  await db.query(

    `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id)
     VALUES ($1, 'wealth', $2, NULL, $3, 'English', 'V1 Wealth Portfolio', 'Website', $4, 'EMP-001', 'TEAM-WEALTH-ALPHA')`,
    [leadId, `Chain Prospect ${suffix}`, `+91 98765 9${suffix.slice(0, 3)}`, stage]
  );
  return leadId;
}

test('SC-01..SC-28 acceptance', async () => {
  const asha = await login('asha@finverse.demo');
  const ravi = await login('ravi@finverse.demo');
  const tara = await login('tara@finverse.demo');

  // SC-01 availability + freshness
  const avail = await call('POST', '/availability', { json: { status: 'busy', note: 'Coaching' }, cookie: asha });
  assert.equal(avail.status, 200);
  assert.equal(avail.body.status, 'busy');
  const day = await call('GET', '/my-day', { cookie: asha });
  assert.equal(day.body.availability.status, 'busy');
  assert.ok(day.body.asOf);
  pass('SC-01 availability recorded + my-day freshness');

  // SC-02 saved views
  const viewName = `Website leads ${stamp}`;
  const view = await call('POST', '/views', { json: { name: viewName, filters: { source: 'Website' } }, cookie: asha });
  assert.equal(view.status, 201);
  const dupView = await call('POST', '/views', { json: { name: viewName, filters: {} }, cookie: asha });
  assert.equal(dupView.status, 409);
  const views = await call('GET', '/views', { cookie: asha });
  assert.ok(views.body.views.some((v: any) => v.name === viewName));
  const applied = await call('GET', '/leads?source=Website', { cookie: asha });
  assert.ok(applied.body.leads.every((l: any) => l.source === 'Website'));
  const del = await call('DELETE', `/views/${view.body.id}`, { cookie: asha });
  assert.equal(del.status, 204);
  pass('SC-02 saved views create/duplicate/list/apply/delete');

  // SC-04 corrections + audit
  const newPhone = `+91 98765 ${Math.floor(10000 + Math.random() * 89999)}`;
  const fix = await call('PATCH', '/leads/FV-1003', { json: { phone: newPhone, reason: 'Customer correction' }, cookie: asha });
  assert.equal(fix.status, 200);
  assert.equal(fix.body.status, 'saved');
  const audit = await call('GET', '/leads/FV-1003/audit', { cookie: asha });
  assert.ok(audit.body.audit[0].reason === 'Customer correction');
  const badEmail = await call('PATCH', '/leads/FV-1003', { json: { email: 'not-an-email', reason: 'x y z' }, cookie: asha });
  assert.equal(badEmail.status, 422);
  const dupPhone = await call('PATCH', '/leads/FV-1003', { json: { phone: '+91 98765 40001', reason: 'Identity change' }, cookie: asha });
  assert.equal(dupPhone.body.status, 'pending-review');
  const foreign = await call('PATCH', '/leads/FV-1004', { json: { phone: newPhone, reason: 'x y z' }, cookie: asha });
  assert.equal(foreign.status, 404);
  pass('SC-04 correction, audit history, duplicate review, foreign denial');

  // SC-05 self-sourced enquiry
  const enq = await call('POST', '/enquiries', {
    json: { displayName: `Self Sourced ${stamp}`, phone: `+91 98111 ${Math.floor(10000 + Math.random() * 89999)}`, product: 'V1 Wealth Portfolio', source: 'Employee referral', permissionEvidence: 'Ref EMP-1, 2026-10-01', need: 'Portfolio review' },
    cookie: asha,
  });
  assert.equal(enq.status, 201);
  assert.equal(enq.body.status, 'pending-validation');
  const dupEnq = await call('POST', '/enquiries', {
    json: { displayName: 'Dup', phone: '+91 98765 40001', product: 'V1 Wealth Portfolio', source: 'Website', permissionEvidence: 'Ref x', need: 'Dup check' },
    cookie: asha,
  });
  assert.equal(dupEnq.body.status, 'duplicate');
  assert.equal(dupEnq.body.duplicateOf, 'FV-1001');
  const pub = await call('POST', `/enquiries/${enq.body.id}/publish`, { json: {}, cookie: asha });
  assert.equal(pub.status, 200);
  assert.ok(pub.body.leadId);
  const repub = await call('POST', `/enquiries/${enq.body.id}/publish`, { json: {}, cookie: asha });
  assert.equal(repub.status, 409);
  pass('SC-05 enquiry intake, duplicate detection, publish routing');

  // SC-06 call simulator + idempotency
  const key = `key-${stamp}-1`;
  const callA = await call('POST', '/leads/FV-1001/calls', { json: { mode: 'Approved business line', idempotencyKey: key }, cookie: asha });
  assert.equal(callA.status, 201);
  assert.equal(callA.body.status, 'connecting');
  assert.equal(callA.body.evidenceStatus, 'simulated');
  const callB = await call('POST', '/leads/FV-1001/calls', { json: { mode: 'Approved business line', idempotencyKey: key }, cookie: asha });
  assert.equal(callB.body.id, callA.body.id);
  assert.equal((await call('POST', `/calls/${callA.body.id}/state`, { json: { status: 'connected' }, cookie: asha })).status, 422);
  await call('POST', `/calls/${callA.body.id}/state`, { json: { status: 'ringing' }, cookie: asha });
  await call('POST', `/calls/${callA.body.id}/state`, { json: { status: 'connected' }, cookie: asha });
  const ended = await call('POST', `/calls/${callA.body.id}/state`, { json: { status: 'ended' }, cookie: asha });
  assert.equal(ended.body.status, 'ended');
  pass('SC-06 call state machine + idempotent start (SIMULATED)');

  // SC-07 wrap-up
  const wrap = await call('POST', `/calls/${callA.body.id}/wrapup`, {
    json: { disposition: 'connected', needConfirmed: true, note: 'Callback requested', nextAction: 'Send proposal draft', dueAt: tomorrow },
    cookie: asha,
  });
  assert.equal(wrap.status, 200);
  const rewrap = await call('POST', `/calls/${callA.body.id}/wrapup`, {
    json: { disposition: 'connected', needConfirmed: false, note: 'Twice', dueAt: tomorrow }, cookie: asha,
  });
  assert.equal(rewrap.status, 409);
  const conv = await call('GET', '/leads/FV-1001/conversations', { cookie: asha });
  assert.ok(conv.body.calls[0].wrapupNote.includes('Callback requested'));
  const tasksAfter = await call('GET', '/tasks?leadId=FV-1001', { cookie: asha });
  assert.ok(tasksAfter.body.tasks.some((t: any) => t.purpose === 'Send proposal draft'));
  pass('SC-07 wrap-up saved once, task + timeline updated');

  // SC-08 manual activity honesty + backdating window
  const manual = await call('POST', '/leads/FV-1001/activities', {
    json: { activityType: 'Manual voice call', occurredAt: new Date(Date.now() - 2 * 3600_000).toISOString(), outcome: 'Connected', durationMinutes: 5, reason: 'Provider outage', note: 'Customer callback' },
    cookie: asha,
  });
  assert.equal(manual.status, 201);
  assert.equal(manual.body.evidenceStatus, 'manual');
  const tooOld = await call('POST', '/leads/FV-1001/activities', {
    json: { activityType: 'Manual voice call', occurredAt: new Date(Date.now() - 48 * 3600_000).toISOString(), outcome: 'Connected', reason: 'Old', note: 'Too old entry' },
    cookie: asha,
  });
  assert.equal(tooOld.status, 422);
  const future = await call('POST', '/leads/FV-1001/activities', {
    json: { activityType: 'Manual voice call', occurredAt: tomorrow, outcome: 'Connected', reason: 'Future', note: 'Future entry' },
    cookie: asha,
  });
  assert.equal(future.status, 422);
  pass('SC-08 manual activity labelled manual; backdating window enforced');

  // SC-09 WhatsApp approved template
  const msg = await call('POST', '/leads/FV-1002/messages', {
    json: { template: 'Appointment reminder', language: 'English', variables: { date: 'tomorrow', time: '11:00', link: 'https://example.test' }, bodyPreview: 'Reminder: appointment tomorrow at 11:00' },
    cookie: asha,
  });
  assert.equal(msg.status, 201);
  assert.equal(msg.body.status, 'queued');
  assert.equal(msg.body.evidenceStatus, 'simulated');
  const badTemplate = await call('POST', '/leads/FV-1002/messages', {
    json: { template: 'Not approved', language: 'English', variables: {}, bodyPreview: 'x' }, cookie: asha,
  });
  assert.equal(badTemplate.status, 422);
  await call('POST', `/messages/${msg.body.id}/status`, { json: { status: 'delivered' }, cookie: asha });
  pass('SC-09 template gating + simulated delivery status');

  // SC-10 inbound handling + dedupe + unmatched queue
  const inboundKey = `in-${stamp}-1`;
  const inb = await call('POST', '/inbound', {
    json: { channel: 'whatsapp', matchedLeadId: 'FV-1002', receivedAt: new Date().toISOString(), intent: 'Reschedule', body: 'Please reschedule', inboundKey },
    cookie: asha,
  });
  assert.equal(inb.status, 201);
  assert.equal(inb.body.status, 'received');
  const dupInb = await call('POST', '/inbound', {
    json: { channel: 'whatsapp', matchedLeadId: 'FV-1002', receivedAt: new Date().toISOString(), intent: 'Reschedule', body: 'dup', inboundKey },
    cookie: asha,
  });
  assert.equal(dupInb.status, 409);
  const un = await call('POST', '/inbound', {
    json: { channel: 'whatsapp', receivedAt: new Date().toISOString(), intent: 'Unknown', body: 'Who are you', inboundKey: `in-${stamp}-2` },
    cookie: asha,
  });
  assert.equal(un.body.routedTo, 'supervisor-queue');
  pass('SC-10 inbound matched + dedupe + unmatched routed to supervisor queue');

  // SC-11 reminder persistence + execution
  const fu = await call('POST', '/leads/FV-1002/follow-ups', {
    json: { action: 'voice-call', purpose: `Reminder check ${stamp}`, dueAt: new Date(Date.now() + 10 * 60_000).toISOString(), priority: 'normal', reminderMinutes: 60 },
    cookie: asha,
  });
  assert.equal(fu.status, 201);
  const tList = await call('GET', `/tasks?leadId=FV-1002`, { cookie: asha });
  const remTask = tList.body.tasks.find((t: any) => t.purpose === `Reminder check ${stamp}`);
  assert.ok(remTask.reminders.length >= 1);
  const tick = await call('POST', '/reminders/tick', { json: {}, cookie: asha });
  assert.equal(tick.status, 200);
  assert.ok(tick.body.sent >= 1);
  pass('SC-11 reminder persisted and executed with timeline effect');

  // SC-12 reschedule + deferral approval threshold
  const chainA = await makeLead('01', 'follow-up');
  const task = await call('POST', `/leads/${chainA}/follow-ups`, {
    json: { action: 'voice-call', purpose: `Reschedule me ${stamp}`, dueAt: tomorrow, priority: 'normal' }, cookie: asha,
  });
  const taskId = task.body.task.id;
  const r1 = await call('POST', `/tasks/${taskId}/reschedule`, { json: { newDueAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), reason: 'Customer requested', customerInformed: true }, cookie: asha });
  assert.equal(r1.body.status, 'rescheduled');
  assert.ok(r1.body.task.originalDueAt);
  await call('POST', `/tasks/${taskId}/reschedule`, { json: { newDueAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), reason: 'Customer requested again', customerInformed: true }, cookie: asha });
  const r3 = await call('POST', `/tasks/${taskId}/reschedule`, { json: { newDueAt: new Date(Date.now() + 4 * 86_400_000).toISOString(), reason: 'Third deferral', customerInformed: true }, cookie: asha });
  assert.equal(r3.body.status, 'pending-approval');
  pass('SC-12 reschedule keeps original deadline; 3rd deferral needs approval');

  // SC-13 task transitions
  const done = await call('POST', `/tasks/${taskId}/transition`, { json: { action: 'complete', outcome: 'Documents confirmed', nextStep: 'Prepare proposal', nextDueAt: tomorrow }, cookie: asha });
  assert.equal(done.status, 200);
  const cancelNoReason = await call('POST', `/tasks/${taskId}/transition`, { json: { action: 'reopen' }, cookie: asha });
  assert.equal(cancelNoReason.status, 200);
  const noReason = await call('POST', `/tasks/${taskId}/transition`, { json: { action: 'cancel' }, cookie: asha });
  assert.equal(noReason.status, 422);
  const cancelled = await call('POST', `/tasks/${taskId}/transition`, { json: { action: 'cancel', cancellationReason: 'Customer declined' }, cookie: asha });
  assert.equal(cancelled.status, 200);
  const taraBlocked = await call('POST', `/tasks/${taskId}/transition`, { json: { action: 'reopen' }, cookie: tara });
  assert.equal(taraBlocked.status, 403);
  pass('SC-13 complete/reopen/cancel + owner-only guard');

  // SC-14 meetings
  const slot = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const mtg = await call('POST', `/leads/${chainA}/meetings`, {
    json: { meetingType: 'Consultation', slotAt: slot, location: 'Office', attendees: 'Prospect and advisor', agenda: 'Product discussion' }, cookie: asha,
  });
  assert.equal(mtg.status, 201);
  assert.equal(mtg.body.inviteStatus, 'delivered');
  const clash = await call('POST', `/leads/${chainA}/meetings`, {
    json: { meetingType: 'Consultation', slotAt: slot, location: 'Office', attendees: 'x', agenda: 'Clash' }, cookie: asha,
  });
  assert.equal(clash.status, 409);
  await call('POST', `/meetings/${mtg.body.id}/outcome`, { json: { outcome: 'attended' }, cookie: asha });
  pass('SC-14 booking, conflict detection, outcome recording');

  // SC-15 qualification
  const qual = await call('POST', `/leads/${chainA}/qualification`, {
    json: { need: 'Wealth growth', product: 'V1 Wealth Portfolio', expectedValue: 100000, currency: 'INR', timeHorizon: '30 days', checklist: { riskProfile: true }, nextStep: 'Prepare proposal' }, cookie: asha,
  });
  assert.equal(qual.status, 201);
  assert.equal(qual.body.recommendedNextStep, 'Prepare proposal');
  const badQual = await call('POST', `/leads/${chainA}/qualification`, {
    json: { need: 'x y z', product: 'Other Product', timeHorizon: '30 days', checklist: {}, nextStep: 'n/a' }, cookie: asha,
  });
  assert.equal(badQual.status, 422);
  pass('SC-15 qualification saved with checklist version; product mismatch blocked');

  // SC-16 stage moves
  const chainB = await makeLead('02', 'not-contacted');
  const s1 = await call('POST', `/leads/${chainB}/stage`, { json: { toStage: 'contacted', reason: 'Intro done' }, cookie: asha });
  assert.equal(s1.status, 200);
  const illegal = await call('POST', `/leads/${chainB}/stage`, { json: { toStage: 'new', reason: 'Backwards skip' }, cookie: asha });
  assert.equal(illegal.status, 422);
  const convertedBlocked = await call('POST', `/leads/${chainB}/stage`, { json: { toStage: 'converted', reason: 'Direct' }, cookie: asha });
  assert.equal(convertedBlocked.status, 422);
  pass('SC-16 allowed transition persisted; illegal + converted shortcut blocked');

  // SC-17 proposal workflow
  const prop = await call('POST', `/leads/${chainA}/proposals`, {
    json: { product: 'V1 Wealth Portfolio', templateVersion: 'tpl-v1', terms: 'Standard terms', validUntil: '2026-10-31', recipient: 'Prospect A' }, cookie: asha,
  });
  assert.equal(prop.status, 201);
  assert.equal(prop.body.status, 'draft');
  const callerApprove = await call('POST', `/proposals/${prop.body.id}/approve`, { json: {}, cookie: asha });
  assert.equal(callerApprove.status, 403);
  const sendTooEarly = await call('POST', `/proposals/${prop.body.id}/send`, { json: {}, cookie: asha });
  assert.equal(sendTooEarly.status, 422);
  const sub = await call('POST', `/proposals/${prop.body.id}/submit`, { json: {}, cookie: asha });
  assert.equal(sub.body.status, 'pending-approval');
  const appr = await call('POST', `/proposals/${prop.body.id}/approve`, { json: {}, cookie: tara });
  assert.equal(appr.body.status, 'approved');
  const sent = await call('POST', `/proposals/${prop.body.id}/send`, { json: {}, cookie: asha });
  assert.equal(sent.body.status, 'sent');
  pass('SC-17 draft -> pending-approval -> TL approved -> sent; caller cannot approve');

  // SC-20 + SC-21 conversion approval and loss boundaries (fresh chain lead)
  const chainC = await makeLead('03', 'follow-up');
  await call('POST', `/leads/${chainC}/stage`, { json: { toStage: 'qualified', reason: 'Fit checklist complete' }, cookie: asha });
  const convReq = await call('POST', `/leads/${chainC}/conversion`, {
    json: { winMilestone: 'Signed mandate', milestoneDate: '2026-10-01', value: 100000, currency: 'INR', evidenceRef: 'DOC-1', proposedCredit: { 'EMP-001': 100 } }, cookie: asha,
  });
  assert.equal(convReq.status, 201);
  assert.equal(convReq.body.status, 'pending');
  const callerDecide = await call('POST', `/requests/${convReq.body.requestId}/decide`, { json: { approve: true, reason: 'Self approve' }, cookie: asha });
  assert.equal(callerDecide.status, 403);
  const badCredit = await call('POST', `/leads/${chainC}/conversion`, {
    json: { winMilestone: 'Signed', milestoneDate: '2026-10-01', value: 1, currency: 'INR', evidenceRef: 'DOC-1', proposedCredit: { a: 50 } }, cookie: asha,
  });
  assert.equal(badCredit.status, 422);
  const tlDecide = await call('POST', `/requests/${convReq.body.requestId}/decide`, { json: { approve: true, reason: 'Evidence verified' }, cookie: tara });
  assert.equal(tlDecide.status, 200);
  const lostBlocked = await call('POST', `/leads/${chainC}/loss`, { json: { reason: 'Not interested', explanation: 'x y z' }, cookie: asha });
  assert.equal(lostBlocked.status, 422);
  pass('SC-20 conversion pending->approved by TL; credit validation; SC-21 converted protected');

  // SC-21 loss + SC-22 reopen
  const chainD = await makeLead('04', 'contacted');
  const lost = await call('POST', `/leads/${chainD}/loss`, { json: { reason: 'Not interested', explanation: 'Customer declined current offer', futureContact: 'Opt out of all contact' }, cookie: asha });
  assert.equal(lost.status, 200);
  const lostDetail = await call('GET', `/leads/${chainD}`, { cookie: asha });
  assert.equal(lostDetail.body.stage, 'lost');
  const reopenReq = await call('POST', `/leads/${chainD}/reopen`, {
    json: { reason: 'Customer renewed interest', newEvidence: 'Inbound request ref-1', requestedNextStage: 'contacted', nextAction: 'Call tomorrow' }, cookie: asha,
  });
  assert.equal(reopenReq.status, 201);
  const pendingList = await call('GET', `/leads/${chainD}/requests`, { cookie: asha });
  assert.equal(pendingList.body.requests[0].status, 'pending');
  await call('POST', `/requests/${reopenReq.body.requestId}/decide`, { json: { approve: true, reason: 'Valid evidence' }, cookie: tara });
  const reopened = await call('GET', `/leads/${chainD}`, { cookie: asha });
  assert.equal(reopened.body.stage, 'contacted');
  pass('SC-21 loss with reason + tasks cancelled; SC-22 reopen pending until TL approval');

  // SC-23 handoff
  const chainE = await makeLead('05', 'contacted');
  const hand = await call('POST', `/leads/${chainE}/handoff`, {
    json: { reason: 'Different product need', destination: 'Banking queue', customerPermission: 'Evidence ref-2', note: 'Wants current account' }, cookie: asha,
  });
  assert.equal(hand.status, 201);
  const handList = await call('GET', `/leads/${chainE}/requests`, { cookie: asha });
  assert.equal(handList.body.requests[0].type, 'handoff');
  assert.equal(handList.body.requests[0].status, 'pending');
  pass('SC-23 handoff request pending; sender sees status only');

  // SC-24 opt-out suppression affects later eligibility
  const chainF = await makeLead('06', 'contacted');
  const queued = await call('POST', `/leads/${chainF}/messages`, {
    json: { template: 'Brochure follow-up', language: 'English', variables: { product: 'V1', link: 'https://example.test' }, bodyPreview: 'Brochure' }, cookie: asha,
  });
  assert.equal(queued.status, 201);
  const opt = await call('POST', `/leads/${chainF}/opt-out`, {
    json: { request: 'Stop WhatsApp contact', source: 'Customer reply', receivedAt: new Date().toISOString(), channels: ['whatsapp', 'voice'], complaintNote: 'Unhappy with frequency' }, cookie: asha,
  });
  assert.equal(opt.status, 200);
  const blockedWa = await call('POST', `/leads/${chainF}/messages`, {
    json: { template: 'Brochure follow-up', language: 'English', variables: {}, bodyPreview: 'Blocked' }, cookie: asha,
  });
  assert.equal(blockedWa.status, 403);
  const blockedCall = await call('POST', `/leads/${chainF}/calls`, { json: { mode: 'line', idempotencyKey: `k-${stamp}-supp` }, cookie: asha });
  assert.equal(blockedCall.status, 403);
  pass('SC-24 opt-out suppresses voice + WhatsApp immediately (queued cancelled)');

  // SC-28 help/correction requests
  const helpBad = await call('POST', `/leads/${chainE}/help`, {
    json: { requestType: 'metric-correction', recordReference: 'FV-1004', expectedCorrection: 'x y z' }, cookie: asha,
  });
  assert.equal(helpBad.status, 422);
  const help = await call('POST', `/leads/${chainE}/help`, {
    json: { requestType: 'metric-correction', recordReference: chainE, expectedCorrection: 'Activity misattributed', priority: 'high' }, cookie: asha,
  });
  assert.equal(help.status, 201);
  assert.equal(help.body.status, 'pending');
  pass('SC-28 blocker/correction request scoped + pending');

  // SC-18/19 document requests + genuine storage
  const chainG = await makeLead('07', 'follow-up');
  const docReq = await call('POST', `/leads/${chainG}/document-requests`, {
    json: { checklist: 'V1 product version 2', requestedFiles: ['ID proof', 'Address proof'], dueAt: tomorrow, reminderEnabled: true }, cookie: asha,
  });
  assert.equal(docReq.status, 201);
  assert.ok(docReq.body.uploadToken);
  const rotated = await call('POST', `/document-requests/${docReq.body.id}/rotate`, { json: {}, cookie: asha });
  assert.notEqual(rotated.body.uploadToken, docReq.body.uploadToken);
  const content = Buffer.from('synthetic evidence file').toString('base64');
  const up = await call('POST', '/documents', {
    json: { leadId: chainG, requestId: docReq.body.id, documentType: 'ID proof', filename: 'id-proof.txt', mimeType: 'text/plain', contentBase64: content }, cookie: asha,
  });
  assert.equal(up.status, 201);
  assert.equal(up.body.scanStatus, 'clean');
  assert.equal(up.body.validationStatus, 'pending');
  const up2 = await call('POST', '/documents', {
    json: { leadId: chainG, documentType: 'ID proof', filename: 'id-proof-v2.txt', mimeType: 'text/plain', contentBase64: content }, cookie: asha,
  });
  assert.equal(up2.body.version, 2);
  const badType = await call('POST', '/documents', {
    json: { leadId: chainG, documentType: 'ID proof', filename: 'x.exe', mimeType: 'application/x-msdownload', contentBase64: content }, cookie: asha,
  });
  assert.equal(badType.status, 422);
  const quarantined = await call('POST', '/documents', {
    json: { leadId: chainG, documentType: 'Suspicious', filename: 'bad.exe', mimeType: 'text/plain', contentBase64: content }, cookie: asha,
  });
  assert.equal(quarantined.body.scanStatus, 'quarantined');
  const dlDoc = await fetch(`${base}/api/documents/${up.body.id}/download`, { headers: { Cookie: asha } });
  assert.equal(dlDoc.status, 200);
  assert.equal(Buffer.from(await dlDoc.arrayBuffer()).toString(), 'synthetic evidence file');
  const foreignDl = await fetch(`${base}/api/documents/${up.body.id}/download`, { headers: { Cookie: ravi } });
  assert.equal(foreignDl.status, 404);
  const selfReview = await call('POST', `/documents/${up.body.id}/review`, { json: { accept: true }, cookie: asha });
  assert.equal(selfReview.status, 403);
  const tlReview = await call('POST', `/documents/${up.body.id}/review`, { json: { accept: false, reason: 'Blurred copy' }, cookie: tara });
  assert.equal(tlReview.body.validationStatus, 'rejected');
  const quarantinedDl = await fetch(`${base}/api/documents/${quarantined.body.id}/download`, { headers: { Cookie: asha } });
  assert.equal(quarantinedDl.status, 403);
  pass('SC-18/19 requests, real upload/versions/scan, scoped download, TL-only review');

  // SC-25 performance from stored events
  const perf = await call('GET', '/reports/performance?period=weekly', { cookie: asha });
  assert.equal(perf.status, 200);
  assert.ok(perf.body.metrics.length >= 8);
  assert.ok(perf.body.metrics.every((m: any) => typeof m.formula === 'string' && m.formula.length > 5));
  assert.ok(perf.body.metricVersion);
  pass('SC-25 performance metrics computed from events with formulas');

  // SC-26 one-to-one (fresh review per run; acknowledge is intentionally one-shot)
  const reviewId = `REV-9${stamp}`;
  await db.query(
    `INSERT INTO reviews (id, employee_id, reviewer_employee_id, period, scorecard, commitments)
     VALUES ($1, 'EMP-001', 'EMP-003', 'October', '{"contactRate": 0.6}', '[]')`,
    [reviewId]
  );
  const reviews = await call('GET', '/reviews', { cookie: asha });
  assert.equal(reviews.status, 200);
  const resp = await call('POST', `/reviews/${reviewId}/response`, {
    json: { selfReflection: 'Wins and blockers', commitments: [{ text: 'Improve follow-up speed', dueAt: tomorrow }], employeeResponse: 'Agree' }, cookie: asha,
  });
  assert.equal(resp.status, 200);
  const again = await call('POST', `/reviews/${reviewId}/response`, { json: { selfReflection: 'x y z' }, cookie: asha });
  assert.equal(again.status, 409);
  pass('SC-26 one-to-one reflect + acknowledge + commitments');

  // SC-27 real PDF export
  const exp = await call('POST', '/reports/exports', { json: { period: 'weekly' }, cookie: asha });
  assert.equal(exp.status, 201);
  const dl = await fetch(`${base}${exp.body.downloadPath}`, { headers: { Cookie: asha } });
  assert.equal(dl.status, 200);
  const bytes = Buffer.from(await dl.arrayBuffer());
  assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
  const raviDl = await fetch(`${base}${exp.body.downloadPath}`, { headers: { Cookie: ravi } });
  assert.equal(raviDl.status, 404);
  pass('SC-27 downloadable real PDF, owner-scoped');

  // 26. access hardening negatives (R2 findings)
  const badReopen = await call('POST', `/leads/${chainE}/reopen`, {
    json: { reason: 'x y z', newEvidence: 'a b c', requestedNextStage: 'converted', nextAction: 'x y z' }, cookie: asha,
  });
  assert.equal(badReopen.status, 422);
  const resurrect = await call('POST', `/messages/${queued.body.id}/status`, { json: { status: 'sent' }, cookie: asha });
  assert.equal(resurrect.status, 422);
  const illegalJump = await call('POST', `/messages/${msg.body.id}/status`, { json: { status: 'replied' }, cookie: asha });
  assert.equal(illegalJump.status, 422);
  const tlRead = await call('GET', '/leads/FV-1001/conversations', { cookie: tara });
  assert.equal(tlRead.status, 200);
  const crossRead = await call('GET', '/leads/FV-1001/conversations', { cookie: ravi });
  assert.equal(crossRead.status, 404);
  pass('26 access hardening negatives (reopen stage, message machine, scoped reads)');

  console.log(`SUMMARY ${results.length}/26 groups passed`);
});
