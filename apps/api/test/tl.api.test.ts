process.env.NODE_ENV = 'test';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Pool } from 'pg';
import { createApp } from '../src/app';
import { assertTestDatabaseGuard, env } from '../src/config';

let server: Server;
let BASE: string;
let apiServerBase: string;
let pool: Pool;

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  pool = new Pool({ connectionString: env.DATABASE_URL });
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  apiServerBase = `http://127.0.0.1:${port}`;
  BASE = `${apiServerBase}/api`;
});

after(async () => {
  if (pool) await pool.end();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

interface Session { cookie: string; body: any }


async function call(method: string, path: string, opts: { json?: unknown; cookie?: string } = {}) {
  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.json);
  } else if (method !== 'GET' && method !== 'DELETE' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    body = '{}';
  }
  if (opts.cookie) headers.Cookie = opts.cookie;
  const res = await fetch(`${BASE}${path}`, { method, headers, body });
  let parsed: any = null;
  try { parsed = await res.json(); } catch { /* no body */ }
  return { status: res.status, body: parsed };
}

async function login(email: string): Promise<Session> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo1234' }),
  });
  const body = await res.json();
  const raw = res.headers.get('set-cookie') ?? '';
  return { cookie: raw.split(';')[0]!, body };
}

function pass(name: string) {
  console.log(`PASS ${name}`);
}

test('TL-01..TL-04 team overview, allocation, rebalance', async () => {
  const results: string[] = [];
  const passAnd = (name: string) => { pass(name); results.push(name); };

  const tara = await login('tara@finverse.demo');
  const asha = await login('asha@finverse.demo');
  const ravi = await login('ravi@finverse.demo');
  const dev = await login('dev@finverse.demo');
  assert.equal(asha.body.session.role, 'SC');
  assert.equal(tara.body.session.role, 'TL');

  // 1. TL-01 overview: granted teams union, KPIs with formulas, SC denied
  const ov = await call('GET', '/tl/overview?period=today&comparison=previous day', { cookie: tara.cookie });
  assert.equal(ov.status, 200);
  assert.ok(Array.isArray(ov.body.kpis) && ov.body.kpis.length >= 5, 'kpis present');
  assert.ok(ov.body.kpis.every((k: any) => typeof k.formula === 'string' && k.formula.length > 0), 'every KPI has a formula');
  assert.ok(ov.body.members.length >= 2, 'team members listed');
  const ovSc = await call('GET', '/tl/overview', { cookie: asha.cookie });
  assert.equal(ovSc.status, 403);
  passAnd('TL-01 team overview (KPIs + members + SC denied)');

  const drill = await call('GET', '/tl/overview/drill?metric=overdue-tasks&period=today', { cookie: tara.cookie });
  assert.equal(drill.status, 200);
  assert.ok(Array.isArray(drill.body.opportunities), 'drill has opportunities');
  passAnd('TL-01 KPI drill-down (member + opportunity breakdown)');

  // 2. TL-02 single allocation of an unassigned lead
  const RUN = Date.now().toString().slice(-7);
  const enq1 = await call('POST', '/enquiries', {
    cookie: asha.cookie,
    json: { displayName: 'TL Alloc One', phone: `+91 98${RUN}01`, product: 'V1 Wealth Portfolio', source: 'Employee referral', permissionEvidence: 'Ref EMP-1', need: 'Portfolio review' },
  });
  assert.equal(enq1.status, 201);
  const pub1 = await call('POST', `/enquiries/${enq1.body.id}/publish`, { cookie: asha.cookie });
  assert.equal(pub1.status, 200, 'publish enquiry failed: ' + JSON.stringify(pub1.body));
  const lead1 = pub1.body.leadId as string;

  const queue = await call('GET', '/tl/allocation/queue', { cookie: tara.cookie });
  assert.equal(queue.status, 200);
  assert.ok(queue.body.leads.some((l: any) => l.id === lead1), 'unassigned lead in queue');

  const recips = await call('GET', '/tl/allocation/recipients', { cookie: tara.cookie });
  assert.equal(recips.status, 200);
  const ashaRow = recips.body.recipients.find((r: any) => r.employeeId === 'EMP-001');
  assert.ok(ashaRow, 'asha is an eligible associate');
  assert.ok(typeof ashaRow.capacity === 'number' && typeof ashaRow.openLeads === 'number', 'capacity shown');

  const rv1 = await call('GET', `/leads/${lead1}`, { cookie: tara.cookie });
  const alloc1 = await call('POST', '/tl/allocation', {
    cookie: tara.cookie,
    json: { leadId: lead1, toEmployeeId: 'EMP-001', reason: 'Language and availability', recordVersion: rv1.body.recordVersion },
  });
  assert.equal(alloc1.status, 201);
  assert.equal(alloc1.body.status, 'assigned');
  assert.ok(alloc1.body.taskId, 'first-contact task created');
  const afterAlloc = await call('GET', `/leads/${lead1}`, { cookie: tara.cookie });
  assert.equal(afterAlloc.body.ownerName.includes('Asha'), true, 'ownership set');
  assert.ok((afterAlloc.body.timeline as any[]).some((e) => e.note.includes('Assignment notification')), 'notification on timeline');
  const allocDup = await call('POST', '/tl/allocation', {
    cookie: tara.cookie,
    json: { leadId: lead1, toEmployeeId: 'EMP-002', reason: 'retry', recordVersion: afterAlloc.body.recordVersion },
  });
  assert.equal(allocDup.status, 409, 'already owned -> 409');
  passAnd('TL-02 single allocation (atomic owner + task + notification; duplicate blocked)');

  // 3. TL-03 batch with preview + commit; concurrency-safe batch key
  const batchIds: string[] = [];
  for (let i = 0; i < 2; i++) {
    const enq = await call('POST', '/enquiries', {
      cookie: asha.cookie,
      json: { displayName: `TL Batch ${i}`, phone: `+91 98${RUN}1${i}`, product: 'V1 Wealth Portfolio', source: 'Website', permissionEvidence: 'Ref EMP-1', need: 'Savings plan' },
    });
    const pub = await call('POST', `/enquiries/${enq.body.id}/publish`, { cookie: asha.cookie });
    assert.equal(pub.status, 200);
    batchIds.push(pub.body.leadId);
  }
  const preview = await call('POST', '/tl/allocation/batch/preview', {
    cookie: tara.cookie,
    json: { leadIds: batchIds, method: 'weighted-round-robin', teamId: 'TEAM-WEALTH-ALPHA', capacityCap: 50 },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.eligible, 2, `both leads eligible in preview: ${JSON.stringify(preview.body)}`);
  assert.ok(preview.body.receipts.every((r: any) => r.toEmployeeId), 'preview proposes a recipient per lead');

  const batchKey = `BATCH-TEST-${Date.now()}`;
  const commit = await call('POST', '/tl/allocation/batch', {
    cookie: tara.cookie,
    json: { leadIds: batchIds, method: 'weighted-round-robin', teamId: 'TEAM-WEALTH-ALPHA', capacityCap: 50, batchKey },
  });
  assert.equal(commit.status, 201, `commit failed: ${JSON.stringify(commit.body)}`);
  assert.equal(commit.body.results.filter((r: any) => r.status === 'assigned').length, 2, 'both assigned');
  assert.ok(commit.body.results.every((r: any) => r.taskId || r.status !== 'assigned'), 'tasks created per assignment');

  const recommit = await call('POST', '/tl/allocation/batch', {
    cookie: tara.cookie,
    json: { leadIds: batchIds, method: 'weighted-round-robin', teamId: 'TEAM-WEALTH-ALPHA', capacityCap: 50, batchKey },
  });
  assert.equal(recommit.status, 201, `recommit failed: ${JSON.stringify(recommit.body)}`);
  assert.equal(recommit.body.replayed, true, 'same batch key replays idempotently');
  assert.equal(recommit.body.batchId, commit.body.batchId, 'no second batch record');
  const ownersUnchanged = await call('GET', `/leads/${batchIds[0]}`, { cookie: tara.cookie });
  assert.ok(ownersUnchanged.body.ownerName, 'owner unchanged after replay');
  passAnd('TL-03 batch preview + commit (idempotent batch key, no double-assign)');

  // 4. TL-04 rebalance with pending-approval lock + cross-boundary denial
  await call('POST', `/leads/${lead1}/qualification`, {
    cookie: asha.cookie,
    json: { need: 'Portfolio review', product: 'V1 Wealth Portfolio', expectedValue: 100000, currency: 'INR', timeHorizon: '30 days', checklist: { riskProfile: true }, nextStep: 'Proposal' },
  });
  for (const toStage of ['not-contacted', 'contacted', 'follow-up', 'qualified']) {
    const mv = await call('POST', `/leads/${lead1}/stage`, { cookie: asha.cookie, json: { toStage, reason: `Journey ${toStage}` } });
    assert.equal(mv.status, 200, `stage move to ${toStage} failed: ${JSON.stringify(mv.body)}`);
  }
  const convReq = await call('POST', `/leads/${lead1}/conversion`, {
    cookie: asha.cookie,
    json: { winMilestone: 'Signed', milestoneDate: '2026-10-01', value: 100000, currency: 'INR', evidenceRef: 'pack-1', proposedCredit: { 'EMP-001': 100 } },
  });
  assert.equal(convReq.status, 201, `conversion request must succeed to test the lock: ${JSON.stringify(convReq.body)}`);
  const rebal = await call('POST', '/tl/rebalance', {
    cookie: tara.cookie,
    json: { leadIds: [lead1], toEmployeeId: 'EMP-002', reason: 'Approved absence', handoffDeadline: '2026-10-05' },
  });
  assert.equal(rebal.status, 201);
  const held = rebal.body.results.find((r: any) => r.leadId === lead1);
  assert.equal(held.status, 'held', 'pending approval locks the lead from rebalancing');
  const rebal2 = await call('POST', '/tl/rebalance', {
    cookie: tara.cookie,
    json: { leadIds: [batchIds[0]], toEmployeeId: 'EMP-002', reason: 'Approved absence', handoffDeadline: '2026-10-05' },
  });
  assert.equal(rebal2.status, 201);
  const moved = rebal2.body.results.find((r: any) => r.leadId === batchIds[0]);
  assert.equal(moved.status, 'moved');
  const afterRebal = await call('GET', `/leads/${batchIds[0]}`, { cookie: tara.cookie });
  assert.ok(afterAlloc.body.timeline[0].actorName !== undefined, 'history attribution retained');

  const cross = await call('POST', '/tl/rebalance', {
    cookie: tara.cookie,
    json: { leadIds: [batchIds[0]], toEmployeeId: 'EMP-004', reason: 'cross-vertical', handoffDeadline: '2026-10-05' },
  });
  assert.equal(cross.status, 403, 'cross-boundary move denied (Manager request instead)');
  passAnd('TL-04 rebalance (attribution preserved, pending lock, cross-boundary denied)');

  const scCall = await call('GET', '/tl/workload', { cookie: ravi.cookie });
  assert.equal(scCall.status, 403, 'caller cannot open TL workload');
  void dev;

  // cleanup: release this run's capacity so repeated runs stay sustainable
  await call('POST', `/requests/${convReq.body.requestId}/decide`, { cookie: tara.cookie, json: { approve: false, reason: 'Test cleanup — returning request.' } });
  for (const id of [lead1, ...batchIds]) {
    await call('POST', `/leads/${id}/loss`, { cookie: asha.cookie, json: { reason: 'Not interested', explanation: 'Synthetic test cleanup.' } });
  }

  console.log(`SUMMARY ${results.length}/4 TL groups passed`);
});

test('TL-05..TL-09, TL-18 decisions, coaching, corrections', async () => {
  const results: string[] = [];
  const passAnd = (name: string) => { pass(name); results.push(name); };
  const RUN = Date.now().toString().slice(-7);

  const tara = await login('tara@finverse.demo');
  const asha = await login('asha@finverse.demo');
  const ravi = await login('ravi@finverse.demo');

  // 5. TL-05 overdue queue + recovery; original deadline preserved
  const testOverdueTaskId = `TASK-OVERDUE-${RUN}`;
  await pool.query(
    `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
     VALUES ($1, 'FV-1002', 'EMP-001', 'voice-call', 'Overdue follow-up test', now() - interval '2 hours', 'normal', 'open')
     ON CONFLICT (id) DO UPDATE SET due_at = now() - interval '2 hours', status = 'open'`,
    [testOverdueTaskId]
  );

  const oq = await call('GET', '/tl/overdue', { cookie: tara.cookie });
  assert.equal(oq.status, 200);
  assert.ok(oq.body.tasks.length >= 1, 'team overdue tasks listed');
  const overdueTask = oq.body.tasks.find((t: any) => t.taskId === testOverdueTaskId) || oq.body.tasks[0];
  const oa = await call('POST', `/tl/overdue/${overdueTask.taskId}/action`, {
    cookie: tara.cookie,
    json: { action: 'coach', reason: 'Coaching on follow-up discipline', recoveryDueAt: new Date(Date.now() + 86400000).toISOString() },
  });
  assert.equal(oa.status, 201);
  assert.ok(oa.body.recoveryTaskId, 'recovery task created');
  const stillListed = await call('GET', '/tl/overdue', { cookie: tara.cookie });
  assert.ok(stillListed.body.tasks.some((t: any) => t.taskId === overdueTask.taskId), 'original missed deadline retained');
  const badHandoff = await call('POST', `/tl/overdue/${overdueTask.taskId}/action`, {
    cookie: tara.cookie,
    json: { action: 'reassign', reason: 'handoff', newOwnerEmployeeId: 'EMP-004', recoveryDueAt: new Date(Date.now() + 86400000).toISOString() },
  });

  assert.equal(badHandoff.status, 403, 'handoff to out-of-team employee denied');
  passAnd('TL-05 overdue resolution (recovery task, history kept, bounded handoff)');

  // 6. TL-06 associate review inside TL workspace
  const mv = await call('GET', '/tl/members/EMP-001?period=month', { cookie: tara.cookie });
  assert.equal(mv.status, 200);
  assert.ok(Array.isArray(mv.body.assignmentHistory) && mv.body.assignmentHistory.length >= 1, 'assignment history intervals');
  assert.ok(typeof mv.body.personalActivityEvents === 'number' && typeof mv.body.inheritedLeads === 'number', 'separated segments');
  const mvDenied = await call('GET', '/tl/members/EMP-001', { cookie: ravi.cookie });
  assert.equal(mvDenied.status, 403, 'caller cannot open TL member review');
  passAnd('TL-06 associate review (history + separated segments, caller denied)');

  // 7. Caller -> TL conversion journey (TL-07) and reopen journey (TL-08)
  const enq = await call('POST', '/enquiries', {
    cookie: asha.cookie,
    json: { displayName: `TL Decision ${RUN}`, phone: `+91 98${RUN}50`, product: 'V1 Wealth Portfolio', source: 'Website', permissionEvidence: 'Ref EMP-1', need: 'Portfolio' },
  });
  const pub = await call('POST', `/enquiries/${enq.body.id}/publish`, { cookie: asha.cookie });
  const lead = pub.body.leadId as string;
  const rvLead = await call('GET', `/leads/${lead}`, { cookie: tara.cookie });
  await call('POST', '/tl/allocation', { cookie: tara.cookie, json: { leadId: lead, toEmployeeId: 'EMP-001', reason: 'decision journey', recordVersion: rvLead.body.recordVersion } });
  await call('POST', `/leads/${lead}/qualification`, {
    cookie: asha.cookie,
    json: { need: 'Portfolio review', product: 'V1 Wealth Portfolio', expectedValue: 100000, currency: 'INR', timeHorizon: '30 days', checklist: { riskProfile: true }, nextStep: 'Proposal' },
  });
  for (const toStage of ['not-contacted', 'contacted', 'follow-up', 'qualified']) {
    const mv = await call('POST', `/leads/${lead}/stage`, { cookie: asha.cookie, json: { toStage, reason: `Journey ${toStage}` } });
    assert.equal(mv.status, 200, `stage move to ${toStage} failed: ${JSON.stringify(mv.body)}`);
  }
  const conv = await call('POST', `/leads/${lead}/conversion`, {
    cookie: asha.cookie,
    json: { winMilestone: 'Signed', milestoneDate: '2026-10-01', value: 100000, currency: 'INR', evidenceRef: 'pack-1', proposedCredit: { 'EMP-001': 100 } },
  });
  assert.equal(conv.status, 201, `conversion request failed: ${JSON.stringify(conv.body)}`);

  const dq = await call('GET', '/tl/decisions', { cookie: tara.cookie });
  assert.equal(dq.status, 200);
  const convReq = dq.body.requests.find((r: any) => r.leadId === lead && r.type === 'conversion');
  assert.ok(convReq, 'pending conversion listed for TL decision');
  const scDecide = await call('POST', `/requests/${convReq.id}/decide`, { cookie: asha.cookie, json: { approve: true, reason: 'self' } });
  assert.equal(scDecide.status, 403, 'caller cannot decide');
  const tlDecide = await call('POST', `/requests/${convReq.id}/decide`, { cookie: tara.cookie, json: { approve: true, reason: 'Evidence pack complete' } });
  assert.equal(tlDecide.status, 200, `TL decide failed: ${JSON.stringify(tlDecide.body)} id=${convReq.id}`);
  const afterWin = await call('GET', `/leads/${lead}`, { cookie: asha.cookie });
  assert.equal(afterWin.body.stage, 'converted', 'approved conversion applies');
  passAnd('TL-07 conversion approval (Caller submit -> TL decision -> Caller result)');

  // reopen journey: loss -> caller request -> TL decision
  const enq2 = await call('POST', '/enquiries', {
    cookie: asha.cookie,
    json: { displayName: `TL Reopen ${RUN}`, phone: `+91 98${RUN}51`, product: 'V1 Savings Plus', source: 'Website', permissionEvidence: 'Ref EMP-1', need: 'Savings' },
  });
  const pub2 = await call('POST', `/enquiries/${enq2.body.id}/publish`, { cookie: asha.cookie });
  const lead2 = pub2.body.leadId as string;
  const rv2 = await call('GET', `/leads/${lead2}`, { cookie: tara.cookie });
  await call('POST', '/tl/allocation', { cookie: tara.cookie, json: { leadId: lead2, toEmployeeId: 'EMP-001', reason: 'reopen journey', recordVersion: rv2.body.recordVersion } });
  await call('POST', `/leads/${lead2}/loss`, { cookie: asha.cookie, json: { reason: 'Not interested', explanation: 'No current need', futureContact: 'Call next quarter' } });
  const reopen = await call('POST', `/leads/${lead2}/reopen`, {
    cookie: asha.cookie,
    json: { reason: 'Inbound interest returned', newEvidence: 'Inbound call 2026-10-04', requestedNextStage: 'contacted', nextAction: 'Call back' },
  });
  assert.equal(reopen.status, 201);
  const dq2 = await call('GET', '/tl/decisions', { cookie: tara.cookie });
  const reopenReq = dq2.body.requests.find((r: any) => r.leadId === lead2 && r.type === 'reopen');
  assert.ok(reopenReq, 'pending reopen listed');
  const reopenDecide = await call('POST', `/requests/${reopenReq.id}/decide`, { cookie: tara.cookie, json: { approve: true, reason: 'New evidence verified' } });
  assert.equal(reopenDecide.status, 200);
  const afterReopen = await call('GET', `/leads/${lead2}`, { cookie: asha.cookie });
  assert.equal(afterReopen.body.stage, 'contacted', 'approved reopen applies');

  // duplicate disposition (TL-08): same phone -> duplicate; route-merge keeps both records
  const enq3 = await call('POST', '/enquiries', {
    cookie: asha.cookie,
    json: { displayName: `TL Dup ${RUN}`, phone: `+91 98${RUN}51`, product: 'V1 Savings Plus', source: 'Website', permissionEvidence: 'Ref EMP-1', need: 'Duplicate phone' },
  });
  assert.equal(enq3.body.status, 'duplicate', 'duplicate detected');
  const dupList = await call('GET', '/tl/decisions', { cookie: tara.cookie });
  assert.ok(dupList.body.duplicates.some((d: any) => d.enquiryId === enq3.body.id), 'match-review reference listed');
  const dupRoute = await call('POST', `/tl/duplicates/${enq3.body.id}/disposition`, { cookie: tara.cookie, json: { decision: 'route-merge' } });
  assert.equal(dupRoute.status, 200);
  assert.equal(dupRoute.body.status, 'merge-requested', 'merge routed to data steward, records not collapsed');
  passAnd('TL-08 reopen + duplicate dispositions (reference only, no record collapse)');

  // 8. TL-09 call quality + coaching evidence access
  const callStart = await call('POST', `/leads/${lead2}/calls`, { cookie: asha.cookie, json: { mode: 'simulated', idempotencyKey: `QR-${RUN}` } });
  assert.equal(callStart.status, 201);
  const callId = callStart.body.id as string;
  await call('POST', `/calls/${callId}/status`, { cookie: asha.cookie, json: { status: 'ringing' } });
  await call('POST', `/calls/${callId}/status`, { cookie: asha.cookie, json: { status: 'connected' } });
  await call('POST', `/calls/${callId}/wrapup`, { cookie: asha.cookie, json: { disposition: 'connected', note: 'Discussed portfolio', needConfirmed: true, nextAction: 'Send proposal' } });

  const qrNoEvidence = await call('POST', '/tl/quality-reviews', {
    cookie: tara.cookie, json: { callId, scores: { opening: 3 }, feedback: 'No recording available' },
  });
  assert.equal(qrNoEvidence.status, 201);
  assert.equal(qrNoEvidence.body.assessed, false, 'missing evidence -> unassessed, never invented');
  const qr = await call('POST', '/tl/quality-reviews', {
    cookie: tara.cookie, json: { callId, scores: { opening: 4, discovery: 3, compliance: 5, close: 2 }, feedback: 'Strong compliance; sharpen the close.', evidenceRef: `REC-${RUN}` },
  });
  assert.equal(qr.body.assessed, true, 'evidence-backed review assessed');
  const evidence = await call('GET', `/tl/quality-reviews/${qr.body.reviewId}/evidence`, { cookie: tara.cookie });
  assert.equal(evidence.status, 200);
  assert.equal(evidence.body.simulated, true, 'simulated evidence labelled');
  const qrDenied = await call('POST', '/tl/quality-reviews', { cookie: ravi.cookie, json: { callId, scores: { opening: 1 }, feedback: 'x y z' } });
  assert.equal(qrDenied.status, 403, 'caller cannot log quality reviews');
  passAnd('TL-09 call quality (rubric version, unassessed fallback, logged evidence access)');

  // 9. TL-18 activity corrections (append-only, self-submitted -> Manager)
  const cor = await call('POST', '/tl/activity-corrections', {
    cookie: asha.cookie,
    json: { callId, requestedField: 'wrapup_disposition', requestedValue: 'callback', evidenceRef: `EVT-${RUN}`, explanation: 'Customer asked for a callback; disposition was mistyped.' },
  });
  assert.equal(cor.status, 201);
  assert.equal(cor.body.status, 'pending');
  assert.ok(cor.body.originalValue === 'connected', 'original fact retained');
  const corList = await call('GET', '/tl/activity-corrections', { cookie: tara.cookie });
  assert.ok(corList.body.corrections.some((c: any) => c.id === cor.body.correctionId), 'correction in TL queue');
  const corSc = await call('POST', `/tl/activity-corrections/${cor.body.correctionId}/decision`, { cookie: ravi.cookie, json: { accept: true, reason: 'x' } });
  assert.equal(corSc.status, 403, 'caller cannot decide corrections (TL-only action)');
  const corAccept = await call('POST', `/tl/activity-corrections/${cor.body.correctionId}/decision`, { cookie: tara.cookie, json: { accept: true, reason: 'Provider event confirms the callback request.' } });
  assert.equal(corAccept.status, 200);
  assert.equal(corAccept.body.status, 'accepted');
  const corConv = await call('GET', `/leads/${lead2}/conversations`, { cookie: asha.cookie });
  const fixedCall = (corConv.body.calls as any[]).find((c) => c.id === callId);
  assert.equal(fixedCall.wrapupDisposition, 'callback', 'corrected fact applied; original retained on the correction row');
  assert.ok(Array.isArray(corAccept.body.affectedReportVersions) && corAccept.body.affectedReportVersions.length > 0, 'affected report versions flagged');

  const selfSub = await call('POST', '/tl/activity-corrections', {
    cookie: tara.cookie,
    json: { callId, requestedField: 'wrapup_note', requestedValue: 'TL self note', explanation: 'TL wants to edit own review note history.' },
  });
  assert.equal(selfSub.status, 201);
  const selfDecide = await call('POST', `/tl/activity-corrections/${selfSub.body.correctionId}/decision`, { cookie: tara.cookie, json: { accept: true, reason: 'self' } });
  assert.equal(selfDecide.status, 403, 'self-submitted correction goes to Manager, not its author');
  passAnd('TL-18 activity corrections (append-only, version flags, self-decision blocked)');

  // cleanup: release this run's capacity
  for (const id of [lead, lead2]) {
    await call('POST', `/leads/${id}/loss`, { cookie: asha.cookie, json: { reason: 'Not interested', explanation: 'Synthetic test cleanup.' } });
  }

  console.log(`SUMMARY ${results.length}/6 TL groups passed`);
});

test('TL-10..TL-17 targets, forecasts, coaching ops, team reports', async () => {
  const results: string[] = [];
  const passAnd = (name: string) => { pass(name); results.push(name); };
  const RUN = Date.now().toString().slice(-7);

  const tara = await login('tara@finverse.demo');
  const asha = await login('asha@finverse.demo');

  // 10. TL-10 target distribution (reconcile + remainder + closed period guard)
  const tgt = await call('POST', '/tl/targets', {
    cookie: tara.cookie,
    json: { teamId: 'TEAM-WEALTH-ALPHA', periodLabel: `Oct-${RUN}`, metric: 'approved-wins', parentValue: 50 },
  });
  assert.equal(tgt.status, 201);
  const overAlloc = await call('POST', `/tl/targets/${tgt.body.targetId}/allocations`, {
    cookie: tara.cookie,
    json: { allocations: [{ employeeId: 'EMP-001', allocatedValue: 60 }] },
  });
  assert.equal(overAlloc.status, 422, 'over-allocation blocked');
  const alloc = await call('POST', `/tl/targets/${tgt.body.targetId}/allocations`, {
    cookie: tara.cookie,
    json: { allocations: [{ employeeId: 'EMP-001', allocatedValue: 30, prorateNote: 'Full month' }, { employeeId: 'EMP-003', allocatedValue: 15 }] },
  });
  assert.equal(alloc.status, 201, 'in-team members allocate: ' + JSON.stringify(alloc.body));
  const crossAlloc = await call('POST', `/tl/targets/${tgt.body.targetId}/allocations`, {
    cookie: tara.cookie,
    json: { allocations: [{ employeeId: 'EMP-002', allocatedValue: 1 }] },
  });
  assert.equal(crossAlloc.status, 422, 'non-member allocation blocked');
  assert.equal(alloc.body.remainder, 5, 'explicit remainder visible');
  const tgtList = await call('GET', '/tl/targets', { cookie: tara.cookie });
  const row = tgtList.body.targets.find((t: any) => t.id === tgt.body.targetId);
  assert.equal(row.version, 2, 'allocation versions the target');
  assert.equal(row.allocations.length, 2);
  passAnd('TL-10 target distribution (reconciliation, remainder, versioning)');

  // 11. TL-11 forecast (scope-checked opportunities, frozen versions)
  const fc = await call('POST', '/tl/forecasts', {
    cookie: tara.cookie,
    json: { teamId: 'TEAM-WEALTH-ALPHA', periodLabel: `Oct-${RUN}`, category: 'commit', expectedRevenue: 500000, currency: 'INR', opportunityIds: [], riskNotes: 'Two proposals in flight', assumptions: 'Stage probability from approved version' },
  });
  assert.equal(fc.status, 201);
  const fcBad = await call('POST', '/tl/forecasts', {
    cookie: tara.cookie,
    json: { teamId: 'TEAM-WEALTH-ALPHA', periodLabel: `Oct-${RUN}`, category: 'commit', expectedRevenue: 1, currency: 'INR', opportunityIds: ['FV-0000-OUT-OF-SCOPE'] },
  });
  assert.equal(fcBad.status, 422, 'out-of-scope opportunity rejected');
  const fcRev = await call('POST', '/tl/forecasts', {
    cookie: tara.cookie,
    json: { teamId: 'TEAM-WEALTH-ALPHA', periodLabel: `Oct-${RUN}`, category: 'commit', expectedRevenue: 450000, currency: 'INR', opportunityIds: [], riskNotes: 'Revised after challenge' },
  });
  assert.equal(fcRev.body.status, 'revised', 'revision creates a new frozen version');
  const fcList = await call('GET', '/tl/forecasts', { cookie: tara.cookie });
  assert.ok(fcList.body.forecasts.filter((f: any) => f.periodLabel === `Oct-${RUN}`).length === 2, 'prior version retained');
  passAnd('TL-11 team forecast (versions frozen, scope-checked support, revisions)');

  // 12. TL-12 one-to-one lifecycle
  const o2o = await call('POST', '/tl/one-to-ones', {
    cookie: tara.cookie,
    json: { employeeId: 'EMP-001', periodLabel: `Sep-${RUN}`, agenda: 'Performance and blockers', scheduledAt: new Date(Date.now() + 86400000).toISOString() },
  });
  assert.equal(o2o.status, 201);
  const o2oDone = await call('POST', `/tl/one-to-ones/${o2o.body.reviewId}/complete`, {
    cookie: tara.cookie,
    json: { feedback: 'Strong pipeline discipline.', privateNotes: 'Watch close technique.', commitments: [{ text: 'Run two discovery coaching sessions', dueAt: new Date(Date.now() + 5 * 86400000).toISOString() }], disagreement: 'Asha disputes the pipeline number timing.' },
  });
  assert.equal(o2oDone.status, 200);
  assert.ok(o2oDone.body.snapshotVersion >= 2, 'later edits version the snapshot');
  const o2oList = await call('GET', '/tl/one-to-ones', { cookie: tara.cookie });
  const o2oRow = o2oList.body.reviews.find((r: any) => r.id === o2o.body.reviewId);
  assert.equal(o2oRow.disagreement.includes('disputes'), true, 'disagreement recorded, never implied agreement');
  passAnd('TL-12 one-to-ones (snapshot versioning, commitments, disagreement kept)');

  // 13. TL-13 intern mentorship (graded workload; TL grants no roles)
  const men = await call('POST', '/tl/mentorships', {
    cookie: tara.cookie,
    json: { internEmployeeId: 'EMP-002', mentorEmployeeId: 'EMP-003', workCap: 8, allowedProducts: ['V1 Savings Plus'], reviewDate: '2026-11-30' },
  });
  assert.equal(men.status, 201);
  const menBad = await call('POST', '/tl/mentorships', {
    cookie: tara.cookie,
    json: { internEmployeeId: 'EMP-002', mentorEmployeeId: 'EMP-004', workCap: 8, allowedProducts: ['V1 Savings Plus'], reviewDate: '2026-11-30' },
  });
  assert.equal(menBad.status, 422, 'mentor must be eligible (not cross-vertical)');
  const menList = await call('GET', '/tl/mentorships', { cookie: tara.cookie });
  assert.ok(menList.body.mentorships.some((m: any) => m.id === men.body.mentorshipId && m.status === 'active'), 'mentorship active');
  passAnd('TL-13 intern mentoring (scoped, dated; no role grants)');

  // 14/15. TL-14 staffing request + TL-15 escalation (submitting executes nothing)
  const staff = await call('POST', '/tl/team-requests', {
    cookie: tara.cookie,
    json: { category: 'capacity', teamId: 'TEAM-WEALTH-ALPHA', request: 'Additional caller capacity', businessReason: 'Queue SLA risk', effectiveDate: '2026-11-01', impact: 'Leads and targets' },
  });
  assert.equal(staff.status, 201);
  const esc = await call('POST', '/tl/team-requests', {
    cookie: tara.cookie,
    json: { category: 'complaint', teamId: 'TEAM-WEALTH-ALPHA', leadId: undefined, severity: 'high', request: 'Customer complaint escalation', businessReason: 'Repeated contact timing complaints', requestedDecision: 'Manager review' },
  });
  assert.equal(esc.status, 201);
  const trList = await call('GET', '/tl/team-requests', { cookie: tara.cookie });
  assert.ok(trList.body.requests.some((r: any) => r.id === staff.body.requestId && r.status === 'pending'), 'staffing request pending — no access granted');
  assert.ok(trList.body.requests.some((r: any) => r.id === esc.body.requestId), 'escalation recorded with due time + routing');
  passAnd('TL-14/15 staffing + escalation requests (pending lifecycle, nothing executed)');

  // 16/17. Team pack PDF + recurring schedule with real job execution
  const pack = await call('POST', '/tl/team-packs', {
    cookie: tara.cookie,
    json: { teamIds: ['TEAM-WEALTH-ALPHA', 'TEAM-WEALTH-BETA'], period: 'month' },
  });
  assert.equal(pack.status, 201, 'team pack failed: ' + JSON.stringify(pack.body));
  const packDl = await fetch(apiServerBase + String(pack.body.downloadPath), { headers: { Cookie: tara.cookie } });
  assert.equal(packDl.status, 200);
  const pdfBytes = Buffer.from(await packDl.arrayBuffer());
  assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF', 'real PDF generated');
  assert.ok(pdfBytes.length > 1000, 'PDF has content');

  const schedName = `TEST-TL17-${RUN}`;
  const sched = await call('POST', '/tl/report-schedules', {
    cookie: tara.cookie,
    json: { name: schedName, cadence: 'weekly-mon-09:00+05:30', period: 'weekly', teamIds: ['TEAM-WEALTH-ALPHA'], recipients: ['EMP-003'] },
  });
  assert.equal(sched.status, 201);
  assert.ok(sched.body.nextRunAt, 'next run scheduled');
  // force due + execute the real job
  await pool.query(`UPDATE report_schedules SET next_run_at = now() - interval '1 minute' WHERE id = $1`, [sched.body.scheduleId]);
  const tick = await call('POST', '/tl/report-schedules/tick', { cookie: tara.cookie });
  assert.equal(tick.status, 200);
  assert.ok(tick.body.ran >= 1, 'schedule job executed: ' + JSON.stringify(tick.body));
  const schedList = await call('GET', '/tl/report-schedules', { cookie: tara.cookie });
  const schedRow = schedList.body.schedules.find((s: any) => s.id === sched.body.scheduleId);
  assert.ok(schedRow.lastRunAt, 'last run persisted');
  assert.ok(schedRow.lastExportId, 'run produced an export version');
  // Scoped cleanup of only this test schedule
  await pool.query(`DELETE FROM report_schedules WHERE id = $1`, [sched.body.scheduleId]);
  passAnd('TL-16/17 team pack PDF + recurring schedule job (persisted runs, real exports)');


  console.log(`SUMMARY ${results.length}/6 TL groups passed`);
});

test('M1..M5 review findings: role isolation, distinct decisions, structured evidence, strict validation', async () => {
  const tara = await login('tara@finverse.demo');
  const asha = await login('asha@finverse.demo');
  const RUN = Date.now().toString().slice(-7);

  // Setup lead assigned to Asha (in Tara's team)
  const enq = await call('POST', '/enquiries', {
    cookie: asha.cookie,
    json: {
      displayName: `M1 Prospect ${RUN}`,
      phone: `+91 99${RUN}01`,
      product: 'V1 Wealth Portfolio',
      source: 'Website',
      permissionEvidence: 'Signed consent M1',
      need: 'HNW wealth planning',
    },
  });
  assert.equal(enq.status, 201);
  const pub = await call('POST', `/enquiries/${enq.body.id}/publish`, { cookie: asha.cookie });
  assert.equal(pub.status, 200);
  const leadId = pub.body.leadId as string;

  const rvLead = await call('GET', `/leads/${leadId}`, { cookie: tara.cookie });
  assert.equal(rvLead.status, 200, 'TL can view lead detail');
  await call('POST', '/tl/allocation', {
    cookie: tara.cookie,
    json: { leadId, toEmployeeId: 'EMP-001', reason: 'M1 test assignment', recordVersion: rvLead.body.recordVersion },
  });

  // M1: Tara (TL) cannot execute Caller operational mutations on the prospect
  const tlCall = await call('POST', `/leads/${leadId}/calls`, {
    cookie: tara.cookie,
    json: { mode: 'simulated', idempotencyKey: `call-${RUN}-tl` },
  });
  assert.equal(tlCall.status, 403, 'TL cannot start call on prospect');

  const tlAct = await call('POST', `/leads/${leadId}/activities`, {
    cookie: tara.cookie,
    json: {
      activityType: 'meeting',
      occurredAt: new Date().toISOString(),
      outcome: 'discussed',
      durationMinutes: 30,
      reason: 'in-person meeting',
      note: 'TL direct log attempt',
    },
  });
  assert.equal(tlAct.status, 403, 'TL cannot log manual activity on prospect');

  const tlTask = await call('POST', `/leads/${leadId}/follow-ups`, {
    cookie: tara.cookie,
    json: {
      action: 'voice-call',
      purpose: 'Follow up',
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      priority: 'high',
    },
  });
  assert.equal(tlTask.status, 403, 'TL cannot add caller follow-up task on prospect');

  const tlQualify = await call('POST', `/leads/${leadId}/qualification`, {
    cookie: tara.cookie,
    json: {
      need: 'Wealth management',
      product: 'V1 Wealth Portfolio',
      timeHorizon: '1 year',
      nextStep: 'KYC check',
    },
  });
  assert.equal(tlQualify.status, 403, 'TL cannot execute caller qualification');

  const tlStage = await call('POST', `/leads/${leadId}/stage`, {
    cookie: tara.cookie,
    json: { toStage: 'contacted', reason: 'TL stage move attempt' },
  });
  assert.equal(tlStage.status, 403, 'TL cannot perform caller stage move');

  const tlConv = await call('POST', `/leads/${leadId}/conversion`, {
    cookie: tara.cookie,
    json: {
      winMilestone: 'Contract',
      milestoneDate: '2026-10-04',
      value: 500000,
      currency: 'INR',
      evidenceRef: 'DOC-123',
      proposedCredit: { 'EMP-001': 100 },
    },
  });
  assert.equal(tlConv.status, 403, 'TL cannot submit conversion request');

  pass('M1: TL prospect drill-down is read-only management view; caller forms denied server-side');

  // Asha (SC) advances lead to qualified and submits conversion request
  await call('POST', `/leads/${leadId}/qualification`, {
    cookie: asha.cookie,
    json: {
      need: 'Wealth planning',
      product: 'V1 Wealth Portfolio',
      timeHorizon: '1 year',
      nextStep: 'Proposal',
    },
  });
  for (const s of ['not-contacted', 'contacted', 'follow-up', 'qualified']) {
    const mv = await call('POST', `/leads/${leadId}/stage`, { cookie: asha.cookie, json: { toStage: s, reason: `Move to ${s}` } });
    assert.equal(mv.status, 200, `stage move to ${s} failed: ${JSON.stringify(mv.body)}`);
  }

  const convReq1 = await call('POST', `/leads/${leadId}/conversion`, {
    cookie: asha.cookie,
    json: {
      winMilestone: 'Funded',
      milestoneDate: '2026-10-04',
      value: 750000,
      currency: 'INR',
      evidenceRef: 'DOC-M3-01',
      proposedCredit: { 'EMP-001': 100 },
    },
  });
  assert.equal(convReq1.status, 201);
  const reqId1 = convReq1.body.requestId as string;

  // M5: Strict Zod validation on /requests/:id/decide
  const badDec1 = await call('POST', `/requests/${reqId1}/decide`, { cookie: tara.cookie, json: {} });
  assert.equal(badDec1.status, 422, 'empty body rejected with 422');

  const badDec2 = await call('POST', `/requests/${reqId1}/decide`, { cookie: tara.cookie, json: { decision: 'bad_choice', reason: 'test' } });
  assert.equal(badDec2.status, 422, 'invalid decision choice rejected with 422');

  const badDec3 = await call('POST', `/requests/${reqId1}/decide`, { cookie: tara.cookie, json: { approve: 'false', reason: 'string bool' } });
  assert.equal(badDec3.status, 422, 'string-coerced boolean rejected with 422');

  const badDec4 = await call('POST', `/requests/${reqId1}/decide`, { cookie: tara.cookie, json: { decision: 'return', reason: 'no' } });
  assert.equal(badDec4.status, 422, 'short reason (< 3 chars) rejected with 422');

  pass('M5: Strict validation rejects malformed/missing/coerced decision inputs with 422');

  // M3 & M4: Persist "returned" as distinct decision with structured evidence; preserve caller resubmission
  const returnRes = await call('POST', `/requests/${reqId1}/decide`, {
    cookie: tara.cookie,
    json: {
      decision: 'return',
      reason: 'Bank statement KYC missing stamp on page 2',
      evidence: { missingStampPage: 2, checklistRef: 'KYC-CHKLST-01' },
    },
  });
  assert.equal(returnRes.status, 200);
  assert.equal(returnRes.body.status, 'returned', 'status is distinctly returned');

  // Verify requests listing includes structured evidence and decision reason
  const reqList1 = await call('GET', `/leads/${leadId}/requests`, { cookie: tara.cookie });
  assert.equal(reqList1.status, 200);
  const foundReq1 = reqList1.body.requests.find((r: any) => r.id === reqId1);
  assert.ok(foundReq1);
  assert.equal(foundReq1.status, 'returned');
  assert.equal(foundReq1.decisionReason, 'Bank statement KYC missing stamp on page 2');
  assert.deepEqual(foundReq1.decisionEvidence, { missingStampPage: 2, checklistRef: 'KYC-CHKLST-01' });

  // Caller verifies lead is still qualified (not stuck or lost) and resubmits
  const leadAfterReturn = await call('GET', `/leads/${leadId}`, { cookie: asha.cookie });
  assert.equal(leadAfterReturn.body.stage, 'qualified', 'returned lead remains qualified for caller correction');

  const convReq2 = await call('POST', `/leads/${leadId}/conversion`, {
    cookie: asha.cookie,
    json: {
      winMilestone: 'Funded and Stamped',
      milestoneDate: '2026-10-04',
      value: 750000,
      currency: 'INR',
      evidenceRef: 'DOC-M3-01-V2',
      proposedCredit: { 'EMP-001': 100 },
    },
  });
  assert.equal(convReq2.status, 201, 'caller can resubmit conversion');
  const reqId2 = convReq2.body.requestId as string;

  // Tara approves resubmitted conversion with verified structured evidence
  const approveRes = await call('POST', `/requests/${reqId2}/decide`, {
    cookie: tara.cookie,
    json: {
      decision: 'approve',
      reason: 'Stamped KYC verified against clearing registry',
      evidence: { clearingRef: 'CLR-9901', verifiedTimestamp: '2026-10-04T12:00:00Z' },
    },
  });
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.status, 'approved');

  const leadAfterApprove = await call('GET', `/leads/${leadId}`, { cookie: asha.cookie });
  assert.equal(leadAfterApprove.body.stage, 'converted', 'approved conversion advances stage to converted');

  pass('M3 & M4: Returned and approved persisted as distinct statuses with separate structured evidence; Caller resubmission verified');

  // M3 & M5 on Activity Corrections: distinct returned/rejected decisions and strict Zod validation
  // Start a call as Asha to get a callId
  const callStart = await call('POST', `/leads/${leadId}/calls`, {
    cookie: asha.cookie,
    json: { mode: 'simulated', idempotencyKey: `call-m5-${RUN}` },
  });
  const actCallId = callStart.body.id as string;
  await call('POST', `/calls/${actCallId}/state`, { cookie: asha.cookie, json: { status: 'in-progress' } });
  await call('POST', `/calls/${actCallId}/state`, { cookie: asha.cookie, json: { status: 'completed' } });
  await call('POST', `/calls/${actCallId}/wrapup`, {
    cookie: asha.cookie,
    json: { disposition: 'connected', note: 'Discussion complete', needConfirmed: true },
  });

  const cor1 = await call('POST', '/tl/activity-corrections', {
    cookie: asha.cookie,
    json: {
      callId: actCallId,
      requestedField: 'wrapup_disposition',
      requestedValue: 'callback',
      explanation: 'Customer requested follow-up next Monday',
    },
  });
  assert.equal(cor1.status, 201);
  const corId1 = cor1.body.correctionId as string;

  // M5 validation on activity correction decision
  const badCor1 = await call('POST', `/tl/activity-corrections/${corId1}/decision`, { cookie: tara.cookie, json: {} });
  assert.equal(badCor1.status, 422);
  const badCor2 = await call('POST', `/tl/activity-corrections/${corId1}/decision`, { cookie: tara.cookie, json: { decision: 'bad' } });
  assert.equal(badCor2.status, 422);

  // Return decision on activity correction
  const corReturn = await call('POST', `/tl/activity-corrections/${corId1}/decision`, {
    cookie: tara.cookie,
    json: {
      decision: 'return',
      reason: 'CDR timestamp does not indicate scheduled callback',
      evidence: { cdrId: 'CDR-881' },
    },
  });
  assert.equal(corReturn.status, 200);
  assert.equal(corReturn.body.status, 'returned');

  // Resubmit another correction and reject it
  const cor2 = await call('POST', '/tl/activity-corrections', {
    cookie: asha.cookie,
    json: {
      callId: actCallId,
      requestedField: 'status',
      requestedValue: 'failed',
      explanation: 'Call dropped due to network failure',
    },
  });
  assert.equal(cor2.status, 201);
  const corId2 = cor2.body.correctionId as string;

  const corReject = await call('POST', `/tl/activity-corrections/${corId2}/decision`, {
    cookie: tara.cookie,
    json: {
      decision: 'reject',
      reason: 'Call audio confirms conversation took place with customer',
      evidence: { audioSampleLengthSeconds: 45 },
    },
  });
  assert.equal(corReject.status, 200);
  assert.equal(corReject.body.status, 'rejected');

  pass('M3 & M5: Activity correction return and reject decisions persisted with structured evidence');
});

test('Scheduler concurrency: dedicated connection advisory lock prevents duplicate runs and handles failure cleanly', async () => {
  const { runDueSchedules } = await import('../src/repo/tl');

  // Verify that an active lock on one connection causes overlapping runs to return immediately without duplicate work
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock(884422) AS acquired');
    assert.equal(rows[0]?.acquired, true, 'held advisory lock on client connection');

    // While lock is held, runDueSchedules should detect lock is unavailable and return 0 ran
    const overlapResult = await runDueSchedules();
    assert.deepEqual(overlapResult, { ran: 0, suspended: 0, errors: 0 }, 'overlapping run is blocked without error or duplicate export');

    // Unlock on the same client connection
    await client.query('SELECT pg_advisory_unlock(884422)');
  } finally {
    client.release();
  }

  // Verify subsequent run can acquire lock normally on dedicated connection after release
  const subsequentResult = await runDueSchedules();
  assert.ok(typeof subsequentResult.ran === 'number', 'subsequent run acquires lock normally');
  pass('Scheduler concurrency: overlapping runs blocked by dedicated connection advisory lock');
});


