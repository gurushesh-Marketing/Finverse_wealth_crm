process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Pool } from 'pg';
import { createApp } from '../src/app';
import { assertTestDatabaseGuard, env } from '../src/config';
import { pool as apiPool } from '../src/repo/db';

let server: Server;
let base: string;
let db: Pool;

const RUN_PREFIX = `FV-M${Date.now().toString().slice(-4)}`;

async function cleanupChain(prefix: string = RUN_PREFIX): Promise<void> {
  const targetLeadsSql = `(SELECT id FROM leads WHERE ((phone LIKE '+91 98765 88%' AND id NOT IN ('FV-3001', 'FV-3002', 'FV-3003', 'FV-3004')) OR id LIKE '${prefix}%'))`;
  await db.query(`DELETE FROM management_actions WHERE title LIKE '%Markets%' OR title LIKE '%${prefix}%'`);
  await db.query(`DELETE FROM lead_transfer_requests WHERE reason LIKE '%Markets%' OR reason LIKE '%${prefix}%'`);
  await db.query(`DELETE FROM capacity_plans WHERE name LIKE '%Markets%' OR name LIKE '%${prefix}%'`);
  await db.query(`DELETE FROM manager_forecasts WHERE risk_notes LIKE '%Markets%' OR risk_notes LIKE '%volatility%' OR risk_notes LIKE '%${prefix}%'`);
  await db.query(`DELETE FROM team_forecasts WHERE id LIKE 'FCST-MKT-%' OR id LIKE '%${prefix}%'`);
  await db.query(`DELETE FROM commercial_exceptions WHERE id LIKE 'EXC-M%' OR id LIKE '%${prefix}%'`);
  await db.query(`DELETE FROM overdue_escalations WHERE id LIKE 'ESC-MKT-%' OR id LIKE '%${prefix}%'`);
  await db.query(`DELETE FROM source_remediations WHERE justification LIKE '%Aadhaar%' OR justification LIKE '%${prefix}%'`);
  await db.query(`DELETE FROM employee_lifecycle_requests WHERE employee_id = 'EMP-021'`);
  await db.query(`DELETE FROM reviews WHERE reviewer_employee_id = 'EMP-022'`);
  await db.query(`DELETE FROM regional_management_actions WHERE rm_employee_id = 'EMP-024'`);
  await db.query(`DELETE FROM territory_coverage_plans WHERE rm_employee_id = 'EMP-024'`);
  await db.query(`DELETE FROM regional_targets WHERE rm_employee_id = 'EMP-024' AND period_label NOT IN ('October', 'RT-MKT-OCT-2026')`);
  await db.query(`DELETE FROM cross_manager_transfers WHERE rm_employee_id = 'EMP-024'`);
  await db.query(`DELETE FROM regional_staffing_plans WHERE rm_employee_id = 'EMP-024'`);
  await db.query(`DELETE FROM regional_forecasts WHERE rm_employee_id = 'EMP-024'`);
  await db.query(`DELETE FROM regional_escalations WHERE rm_employee_id = 'EMP-024'`);
  await db.query(`DELETE FROM manager_reviews WHERE rm_employee_id = 'EMP-024'`);
  await db.query(`DELETE FROM regional_report_schedules WHERE rm_employee_id = 'EMP-024'`);
  await db.query(`DELETE FROM national_management_actions WHERE nm_employee_id = 'EMP-025'`);
  await db.query(`DELETE FROM national_targets WHERE nm_employee_id = 'EMP-025' AND period_label NOT IN ('October', 'NT-MKT-OCT-2026')`);
  await db.query(`DELETE FROM product_rule_proposals WHERE nm_employee_id = 'EMP-025' AND id != 'PRP-MKT-001'`);
  await db.query(`DELETE FROM national_forecasts WHERE nm_employee_id = 'EMP-025'`);
  await db.query(`DELETE FROM cross_region_transfers WHERE nm_employee_id = 'EMP-025'`);
  await db.query(`DELETE FROM national_escalations WHERE nm_employee_id = 'EMP-025' AND id != 'NESC-MKT-001'`);
  await db.query(`DELETE FROM rm_reviews WHERE nm_employee_id = 'EMP-025'`);
  await db.query(`DELETE FROM national_report_schedules WHERE nm_employee_id = 'EMP-025'`);
  await db.query(`DELETE FROM lead_events WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM lead_ownership_events WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM reminders WHERE task_id IN (SELECT id FROM lead_tasks WHERE lead_id IN ${targetLeadsSql})`);
  await db.query(`DELETE FROM lead_tasks WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM documents WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM document_requests WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM outcome_requests WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM loss_records WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM proposals WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM qualifications WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM stage_events WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM meetings WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM calls WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM messages WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM contact_suppressions WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM lead_audit WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM enquiries WHERE (phone LIKE '+91 98765 88%' AND phone NOT IN ('+91 98765 88001', '+91 98765 88002', '+91 98765 88003', '+91 98765 88004')) OR published_lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM leads WHERE id IN ${targetLeadsSql}`);
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  db = new Pool({ connectionString: env.DATABASE_URL });
  await cleanupChain();
  await db.query(`UPDATE leads SET stage = 'new', email = 'rohan.verma@trading.demo' WHERE id = 'FV-3001'`);
  await db.query(`UPDATE leads SET team_id = 'TEAM-MARKETS-BETA' WHERE id = 'FV-3003'`);
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  try {
    await cleanupChain();
  } catch {}
  if (server) {
    try {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    } catch {}
  }
  if (db) {
    try {
      await db.end();
    } catch {}
  }
  try {
    await apiPool.end();
  } catch {}
});

function cookieOf(res: Response): string {
  const raw = res.headers.get('set-cookie') || '';
  return raw.split(';')[0] || '';
}

async function loginAs(email: string, password = 'demo1234'): Promise<string> {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200);
  return cookieOf(res);
}

test('Markets SC-01..28: Full Frontline Markets caller journey', async () => {
  // 1. SC-01: Login as Kabir Joshi (Markets Caller)
  const kabirCookie = await loginAs('kabir@finverse.demo');
  const meRes = await fetch(`${base}/api/auth/me`, { headers: { cookie: kabirCookie } });
  assert.equal(meRes.status, 200);
  const me = (await meRes.json()) as any;
  assert.equal(me.session.role, 'SC');
  assert.equal(me.session.displayName, 'Kabir Joshi');
  assert.ok(me.session.verticalGrants.includes('markets'), 'Must include markets vertical');
  assert.ok(me.session.teamGrants.includes('TEAM-MARKETS-ALPHA'), 'Must include markets team');

  // 2. SC-01: My Day fresh data and commitments
  const dayRes = await fetch(`${base}/api/my-day`, { headers: { cookie: kabirCookie } });
  assert.equal(dayRes.status, 200);
  const day = (await dayRes.json()) as any;
  assert.ok(day.asOf, 'asOf timestamp must exist');
  assert.ok(day.counts, 'Counts object must exist');
  assert.ok(Array.isArray(day.nextTasks), 'nextTasks array must exist');

  // 3. SC-02: Lead Inbox - search and filter scoped to Markets
  const listRes = await fetch(`${base}/api/leads`, { headers: { cookie: kabirCookie } });
  assert.equal(listRes.status, 200);
  const list = (await listRes.json()) as any;
  assert.ok(Array.isArray(list.leads));
  assert.ok(list.leads.length >= 2, 'Should see demo leads in Markets Alpha');
  const mktIds = list.leads.map((l: any) => l.id);
  assert.ok(mktIds.includes('FV-3001'));
  assert.ok(mktIds.includes('FV-3002'));

  // Filter by stage = kyc
  const filterKycRes = await fetch(`${base}/api/leads?stage=kyc`, { headers: { cookie: kabirCookie } });
  assert.equal(filterKycRes.status, 200);
  const kycList = (await filterKycRes.json()) as any;
  assert.ok(kycList.leads.every((l: any) => l.stage === 'kyc'));

  // 4. SC-03: Inspect prospect FV-3001
  const prospectRes = await fetch(`${base}/api/leads/FV-3001`, { headers: { cookie: kabirCookie } });
  assert.equal(prospectRes.status, 200);
  const prospect = (await prospectRes.json()) as any;
  assert.equal(prospect.id, 'FV-3001');
  assert.equal(prospect.vertical, 'markets');
  assert.equal(prospect.product, 'Equity Delivery & Intraday');

  // 5. SC-04: Edit contact info on FV-3001
  const newEmail = `rohan.${Date.now()}@trading.demo`;
  const patchRes = await fetch(`${base}/api/leads/FV-3001`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: kabirCookie },
    body: JSON.stringify({ email: newEmail, reason: 'SEBI KYC email verification' }),
  });
  assert.equal(patchRes.status, 200);

  // 6. SC-05: Create permitted self-sourced enquiry
  const enqRes = await fetch(`${base}/api/enquiries`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: kabirCookie },
    body: JSON.stringify({
      displayName: 'Aditya Birla Trading Account',
      phone: '+91 98765 88001',
      product: 'Equity Delivery & Intraday',
      source: 'Trading App Direct',
      permissionEvidence: 'Signed CKYC Form dated 2026-10-16',
      need: 'Active F&O and equity trading setup',
    }),
  });
  assert.equal(enqRes.status, 201);
  const enq = (await enqRes.json()) as any;
  assert.equal(enq.status, 'pending-validation');

  // Reject non-markets product for markets caller
  const badProdRes = await fetch(`${base}/api/enquiries`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: kabirCookie },
    body: JSON.stringify({
      displayName: 'Invalid Product Lead',
      phone: '+91 98765 88002',
      product: 'Corporate Term Loan',
      source: 'Trading App Direct',
      permissionEvidence: 'Signed paper',
      need: 'Loan',
    }),
  });
  assert.equal(badProdRes.status, 422);

  // Dedicated test lead for pipeline stage moves and conversion
  const pipeLeadId = `${RUN_PREFIX}-PIPE`;
  await db.query(
    `INSERT INTO leads (id, vertical, display_name, phone, email, preferred_language, product, source, stage, owner_employee_id, team_id)
     VALUES ($1, 'markets', 'Rajesh Kothari Trader', '+91 98765 88050', 'rajesh.k@trader.demo', 'en', 'Equity Delivery & Intraday', 'Trading App Direct', 'new', 'EMP-021', 'TEAM-MARKETS-ALPHA')`,
    [pipeLeadId]
  );

  // 7. SC-15: Save qualification / risk profile
  const qualRes = await fetch(`${base}/api/leads/${pipeLeadId}/qualification`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: kabirCookie },
    body: JSON.stringify({
      need: 'Equity Delivery & Intraday trading',
      product: 'Equity Delivery & Intraday',
      expectedValue: 500000,
      currency: 'INR',
      timeHorizon: '1-3 years',
      checklist: { sebi_kyc: true, risk_profile_signed: true, pan_linked: true },
      nextStep: 'Initiate Demat account opening',
    }),
  });
  assert.equal(qualRes.status, 201);

  // 8. SC-16: Sequential pipeline stage transitions
  // Move pipe lead from 'new' -> 'kyc'
  const move1 = await fetch(`${base}/api/leads/${pipeLeadId}/stage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: kabirCookie },
    body: JSON.stringify({ toStage: 'kyc', reason: 'Aadhaar e-KYC completed successfully' }),
  });
  assert.equal(move1.status, 200);

  // Move pipe lead from 'kyc' -> 'risk-profile'
  const move2 = await fetch(`${base}/api/leads/${pipeLeadId}/stage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: kabirCookie },
    body: JSON.stringify({ toStage: 'risk-profile', reason: 'SEBI suitability risk assessment executed' }),
  });
  assert.equal(move2.status, 200);

  // Move pipe lead from 'risk-profile' -> 'demat-opened'
  const move3 = await fetch(`${base}/api/leads/${pipeLeadId}/stage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: kabirCookie },
    body: JSON.stringify({ toStage: 'demat-opened', reason: 'Depository participant generated Demat 12081600' }),
  });
  assert.equal(move3.status, 200);

  // Block illegal shortcut to active-funded directly via moveStage
  const badMove = await fetch(`${base}/api/leads/${pipeLeadId}/stage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: kabirCookie },
    body: JSON.stringify({ toStage: 'active-funded', reason: 'Attempting shortcut without TL conversion review' }),
  });
  assert.equal(badMove.status, 422);

  // 9. SC-20: Submit conversion for approval (first trade funded)
  const convRes = await fetch(`${base}/api/leads/${pipeLeadId}/conversion`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: kabirCookie },
    body: JSON.stringify({
      winMilestone: 'first-funded-trade',
      milestoneDate: '2026-10-16',
      value: 250000,
      currency: 'INR',
      evidenceRef: 'Depository Participant client master report & margin receipt',
      proposedCredit: { 'EMP-021': 100 },
    }),
  });
  assert.equal(convRes.status, 201);
  const conv = (await convRes.json()) as any;
  assert.equal(conv.status, 'pending');

  // 10. SC-21: Mark lost with Markets-specific reason
  // Create a scratch lead for loss testing
  const leadRes = await db.query(
    `INSERT INTO leads (id, vertical, display_name, phone, preferred_language, product, source, stage, owner_employee_id, team_id)
     VALUES ('${RUN_PREFIX}-LOST', 'markets', 'Lost Prospect Demo', '+91 98765 88099', 'en', 'F&O Derivatives', 'Trading App Direct', 'kyc', 'EMP-021', 'TEAM-MARKETS-ALPHA')
     RETURNING id`
  );
  const lostLeadId = leadRes.rows[0].id;

  const lossRes = await fetch(`${base}/api/leads/${lostLeadId}/loss`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: kabirCookie },
    body: JSON.stringify({
      reason: 'SEBI KYC rejection',
      explanation: 'PAN name mismatch with Income Tax database records',
      competitor: 'Zerodha',
    }),
  });
  assert.equal(lossRes.status, 200);

  // 11. Cross-Vertical Isolation Security Gate:
  // Markets caller cannot access Wealth lead (FV-1001) or Banking lead (FV-2001)
  const foreignWealth = await fetch(`${base}/api/leads/FV-1001`, { headers: { cookie: kabirCookie } });
  assert.equal(foreignWealth.status, 404, 'Must return 404 for out-of-vertical Wealth lead');

  const foreignBanking = await fetch(`${base}/api/leads/FV-2001`, { headers: { cookie: kabirCookie } });
  assert.equal(foreignBanking.status, 404, 'Must return 404 for out-of-vertical Banking lead');

  // Wealth caller cannot access Markets lead (FV-3001)
  const ashaCookie = await loginAs('asha@finverse.demo');
  const leakCheck = await fetch(`${base}/api/leads/FV-3001`, { headers: { cookie: ashaCookie } });
  assert.equal(leakCheck.status, 404, 'Wealth caller must be denied reading Markets lead');

  // Banking caller cannot access Markets lead (FV-3001)
  const devCookie = await loginAs('dev@finverse.demo');
  const bankLeakCheck = await fetch(`${base}/api/leads/FV-3001`, { headers: { cookie: devCookie } });
  assert.equal(bankLeakCheck.status, 404, 'Banking caller must be denied reading Markets lead');

  console.log('PASS Markets SC-01..28: Full Frontline Markets caller journey verified');
});

test('Markets TL-01..18: Markets Team Lead workspace and supervisory workflow', async () => {
  // 1. Authenticate Meera Nair (Markets Team Lead, EMP-005, TEAM-MARKETS-ALPHA)
  const meeraCookie = await loginAs('meera@finverse.demo');
  const meRes = await fetch(`${base}/api/auth/me`, { headers: { Cookie: meeraCookie } });
  assert.equal(meRes.status, 200);
  const { session } = (await meRes.json()) as any;
  assert.equal(session.employeeId, 'EMP-005');
  assert.equal(session.role, 'TL');
  assert.ok(session.verticalGrants.includes('markets'), 'Must include markets vertical');
  assert.ok(session.teamGrants.includes('TEAM-MARKETS-ALPHA'), 'Must include markets team');

  // 2. Caller denied TL endpoints (deny-by-default boundary guard)
  const kabirCookie = await loginAs('kabir@finverse.demo');
  const callerDenied = await fetch(`${base}/api/tl/overview`, { headers: { Cookie: kabirCookie } });
  assert.equal(callerDenied.status, 403, 'Frontline caller must be denied TL overview');

  // 3. TL-01 Team overview, KPI metrics & members drill
  const ovRes = await fetch(`${base}/api/tl/overview`, { headers: { Cookie: meeraCookie } });
  assert.equal(ovRes.status, 200);
  const ov = (await ovRes.json()) as any;
  assert.ok(Array.isArray(ov.members));
  assert.ok(ov.members.some((m: any) => m.employeeId === 'EMP-021'), 'Kabir Joshi must appear in Markets team members');
  assert.ok(Array.isArray(ov.kpis));

  const drillRes = await fetch(`${base}/api/tl/overview/drill?metric=open-leads`, { headers: { Cookie: meeraCookie } });
  assert.equal(drillRes.status, 200);
  const drill = (await drillRes.json()) as any;
  assert.ok(Array.isArray(drill.opportunities));

  // 4. TL-02 / TL-03 Allocation queue and single allocation
  const unassignedLeadId = `${RUN_PREFIX}-TL-UNASS`;
  await db.query(
    `INSERT INTO leads (id, vertical, display_name, phone, email, preferred_language, product, source, stage, owner_employee_id, team_id)
     VALUES ($1, 'markets', 'Reliance Securities Client', '+91 98765 88060', 'client@reliance-sec.test', 'en', 'Equity Delivery & Intraday', 'Trading App Direct', 'new', NULL, 'TEAM-MARKETS-ALPHA')`,
    [unassignedLeadId]
  );

  const allocQueueRes = await fetch(`${base}/api/tl/allocation/queue`, { headers: { Cookie: meeraCookie } });
  assert.equal(allocQueueRes.status, 200);
  const queue = (await allocQueueRes.json()) as any;
  assert.ok(queue.leads.some((l: any) => l.id === unassignedLeadId), 'Unassigned markets lead must appear in allocation queue');

  const recipRes = await fetch(`${base}/api/tl/allocation/recipients`, { headers: { Cookie: meeraCookie } });
  assert.equal(recipRes.status, 200);
  const recips = (await recipRes.json()) as any;
  assert.ok(recips.recipients.some((r: any) => r.employeeId === 'EMP-021'));

  // Allocate unassigned lead to Kabir Joshi
  const allocRes = await fetch(`${base}/api/tl/allocation`, {
    method: 'POST',
    headers: { Cookie: meeraCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leadId: unassignedLeadId,
      toEmployeeId: 'EMP-021',
      reason: 'Assigned to equities trading specialist for Demat account onboarding',
      recordVersion: 1,
    }),
  });
  assert.equal(allocRes.status, 201);

  const { rows: allocCheck } = await db.query(`SELECT owner_employee_id FROM leads WHERE id = $1`, [unassignedLeadId]);
  assert.equal(allocCheck[0].owner_employee_id, 'EMP-021');

  // 5. TL-04 Workload and Capacity
  const workloadRes = await fetch(`${base}/api/tl/workload`, { headers: { Cookie: meeraCookie } });
  assert.equal(workloadRes.status, 200);
  const workload = (await workloadRes.json()) as any;
  assert.ok(workload.members.some((m: any) => m.employeeId === 'EMP-021'));

  // 6. TL-07 Conversion Decision: Demat Opened -> Active Funded approval (Deck P005)
  const pipeLeadId = `${RUN_PREFIX}-PIPE`;
  const { rows: pendConvRows } = await db.query(
    `SELECT id FROM outcome_requests WHERE lead_id = $1 AND type = 'conversion' AND status = 'pending'`,
    [pipeLeadId]
  );
  assert.ok(pendConvRows.length > 0, 'Conversion request must be pending');
  const convRequestId = pendConvRows[0].id;

  const decisionsRes = await fetch(`${base}/api/tl/decisions`, { headers: { Cookie: meeraCookie } });
  assert.equal(decisionsRes.status, 200);
  const decisions = (await decisionsRes.json()) as any;
  assert.ok(decisions.conversions.some((c: any) => c.id === convRequestId));

  // Meera approves the conversion request
  const approveRes = await fetch(`${base}/api/requests/${convRequestId}/decision`, {
    method: 'POST',
    headers: { Cookie: meeraCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision: 'approve',
      reason: 'Depository participant Demat generation confirmed and initial margin trade executed on NSE.',
      evidence: { depositoryParticipant: 'CDSL', dematAccountNumber: '1208160012345678', firstTradeCleared: true },
    }),
  });
  assert.equal(approveRes.status, 200);

  // Verify lead advanced to 'active-funded' terminal won stage (Deck P005)
  const { rows: wonCheck } = await db.query(`SELECT stage FROM leads WHERE id = $1`, [pipeLeadId]);
  assert.equal(wonCheck[0].stage, 'active-funded');

  const { rows: stgEventCheck } = await db.query(
    `SELECT to_stage, actor_employee_id FROM stage_events WHERE lead_id = $1 ORDER BY occurred_at DESC LIMIT 1`,
    [pipeLeadId]
  );
  assert.equal(stgEventCheck[0].to_stage, 'active-funded');
  assert.equal(stgEventCheck[0].actor_employee_id, 'EMP-005');

  // 7. TL-08 Reopen Decision: Lost -> KYC approval
  const lostLeadId = `${RUN_PREFIX}-LOST`;
  const reopenReqRes = await fetch(`${base}/api/leads/${lostLeadId}/reopen`, {
    method: 'POST',
    headers: { Cookie: kabirCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reason: 'Customer updated PAN records with Income Tax Department; CKYC fetch now successfully resolved',
      evidenceRef: 'https://vault.internal.finverse/kyc/pan-verified-rohan.pdf',
      requestedNextStage: 'kyc',
      nextAction: 'Re-trigger CKYC verification and link Demat',
    }),
  });
  assert.equal(reopenReqRes.status, 201);
  const reopenReq = (await reopenReqRes.json()) as any;
  assert.equal(reopenReq.status, 'pending');

  const reopenApproveRes = await fetch(`${base}/api/requests/${reopenReq.requestId}/decision`, {
    method: 'POST',
    headers: { Cookie: meeraCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision: 'approve',
      reason: 'Verified updated CKYC record against SEBI database. Approved to resume KYC.',
      evidence: { verifiedPanStatus: 'MATCHED' },
    }),
  });
  assert.equal(reopenApproveRes.status, 200);

  const { rows: reopenCheck } = await db.query(`SELECT stage FROM leads WHERE id = $1`, [lostLeadId]);
  assert.equal(reopenCheck[0].stage, 'kyc');

  // 8. Cross-Vertical Isolation Security Gate:
  // Banking TL Rohan Sen cannot access Markets allocation queue or allocate Markets lead
  const rohanCookie = await loginAs('rohan@finverse.demo');
  const foreignAlloc = await fetch(`${base}/api/tl/allocation`, {
    method: 'POST',
    headers: { Cookie: rohanCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leadId: unassignedLeadId,
      toEmployeeId: 'EMP-004',
      reason: 'Attempting illegal cross-vertical allocation',
      recordVersion: 2,
    }),
  });
  assert.equal(foreignAlloc.status, 404, 'Banking TL must receive 404 for Markets lead');

  // Markets TL Meera cannot access Banking lead FV-2001
  const foreignLeadRead = await fetch(`${base}/api/leads/FV-2001`, { headers: { Cookie: meeraCookie } });
  assert.equal(foreignLeadRead.status, 404, 'Markets TL must be denied reading Banking lead');

  console.log('PASS Markets TL-01..18: Markets Team Lead workspace and supervisory workflow verified');
});

test('Markets Manager MG-01..13: Markets & Securities Manager supervisory oversight and governance', async () => {
  // 1. Authenticate Manish Vyas (Markets Manager, EMP-022)
  const manishCookie = await loginAs('manish@finverse.demo');
  const meRes = await fetch(`${base}/api/auth/me`, { headers: { Cookie: manishCookie } });
  assert.equal(meRes.status, 200);
  const me = (await meRes.json()) as any;
  assert.equal(me.session.role, 'MG', 'Role must resolve to MG');
  assert.ok(me.session.verticalGrants.includes('markets'), 'Must include markets vertical');
  assert.ok(me.session.teamGrants.includes('TEAM-MARKETS-ALPHA'), 'Must include Markets Alpha');
  assert.ok(me.session.teamGrants.includes('TEAM-MARKETS-BETA'), 'Must include Markets Beta');

  // MG-01: Manager Overview
  const ovRes = await fetch(`${base}/api/manager/overview?period=month-to-date`, { headers: { Cookie: manishCookie } });
  assert.equal(ovRes.status, 200);
  const ovData = (await ovRes.json()) as any;
  assert.equal(ovData.manager.id, 'EMP-022', 'Must resolve Manish Vyas');
  assert.ok(ovData.teams.some((t: any) => t.id === 'TEAM-MARKETS-ALPHA'), 'Must include Markets Alpha');
  assert.ok(ovData.teams.some((t: any) => t.id === 'TEAM-MARKETS-BETA'), 'Must include Markets Beta');
  assert.ok(ovData.tlBreakdown.some((t: any) => t.tlEmployeeId === 'EMP-005'), 'Must include TL Meera Nair');
  assert.ok(ovData.tlBreakdown.some((t: any) => t.tlEmployeeId === 'EMP-023'), 'Must include TL Tarun Sen');
  assert.ok(ovData.kpis.some((k: any) => k.key === 'wins-target'), 'KPI must include wins-target');
  assert.ok(ovData.kpis.some((k: any) => k.key === 'open-pipeline'), 'KPI must include active backlog');

  // MG-02: TL Operating Scorecard & Management Action Intervention
  const scRes = await fetch(`${base}/api/manager/scorecard/EMP-005?period=October`, { headers: { Cookie: manishCookie } });
  assert.equal(scRes.status, 200);
  const scData = (await scRes.json()) as any;
  assert.equal(scData.tl.id, 'EMP-005');

  const actRes = await fetch(`${base}/api/manager/actions`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subjectTlEmployeeId: 'EMP-005',
      ownerEmployeeId: 'EMP-022',
      sourceAction: 'MG-02',
      kind: 'coaching',
      title: 'SEBI KYC Compliance & Demat Activation Turnaround Coaching',
      detail: 'Review CKYC drop-off reasons and accelerate margin deposit funding',
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      metricKey: 'wins-target',
      periodLabel: 'October',
      teamId: 'TEAM-MARKETS-ALPHA',
    }),
  });
  assert.equal(actRes.status, 201);

  // MG-03: Cross-Team Lead Transfer (Markets Beta -> Markets Alpha)
  const trRes = await fetch(`${base}/api/manager/transfers`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceTeamId: 'TEAM-MARKETS-BETA',
      destinationTeamId: 'TEAM-MARKETS-ALPHA',
      leadIds: ['FV-3003'],
      reason: 'Algorithmic trading client assigned to Markets Alpha specialized derivatives desk',
    }),
  });
  assert.equal(trRes.status, 201);
  const trData = (await trRes.json()) as any;

  const decideTrRes = await fetch(`${base}/api/manager/transfers/decide`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transferId: trData.id,
      decision: 'approved',
      resolutionNotes: 'Approved desk transfer for specialized algorithmic portfolio onboarding',
    }),
  });
  assert.equal(decideTrRes.status, 200);

  const { rows: trLeadCheck } = await db.query(`SELECT team_id FROM leads WHERE id = 'FV-3003'`);
  assert.equal(trLeadCheck[0].team_id, 'TEAM-MARKETS-ALPHA', 'Lead must be reallocated to Markets Alpha');

  // MG-04: Capacity Recovery Planning
  const capRes = await fetch(`${base}/api/manager/capacity`, { headers: { Cookie: manishCookie } });
  assert.equal(capRes.status, 200);
  const capData = (await capRes.json()) as any;
  assert.ok(capData.teams.length >= 2, 'Capacity analysis must cover multiple markets teams');

  const planRes = await fetch(`${base}/api/manager/capacity/plan`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Markets Trading Q4 Volatility Surge Capacity Plan',
      periodLabel: 'Q4-2026',
      teamIds: ['TEAM-MARKETS-ALPHA', 'TEAM-MARKETS-BETA'],
      currentBacklog: 2,
      availableCallers: 2,
      requiredAdditionalStaff: 1,
      operationalDeadline: new Date(Date.now() + 86400000 * 14).toISOString(),
      notes: 'Expand F&O derivatives margin clearance and risk management desk',
      approved: true,
    }),
  });
  assert.equal(planRes.status, 201);

  // MG-05: Target Cascade & Allocation to TLs
  const tgRes = await fetch(`${base}/api/manager/targets/allocate`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'Q4-2026',
      metric: 'approved-wins',
      approvedParentTarget: 60,
      tlAllocations: [
        { teamId: 'TEAM-MARKETS-ALPHA', tlEmployeeId: 'EMP-005', allocatedValue: 30 },
        { teamId: 'TEAM-MARKETS-BETA', tlEmployeeId: 'EMP-023', allocatedValue: 25 },
      ],
      publish: true,
    }),
  });
  assert.equal(tgRes.status, 200);

  // Over-allocation must be rejected (422)
  const overTgRes = await fetch(`${base}/api/manager/targets/allocate`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'Q4-2026',
      metric: 'approved-wins',
      approvedParentTarget: 60,
      tlAllocations: [
        { teamId: 'TEAM-MARKETS-ALPHA', tlEmployeeId: 'EMP-005', allocatedValue: 40 },
        { teamId: 'TEAM-MARKETS-BETA', tlEmployeeId: 'EMP-023', allocatedValue: 30 },
      ],
      publish: true,
    }),
  });
  assert.equal(overTgRes.status, 422, 'Over-allocation must fail validation');

  // MG-06: TL Forecast Review & Challenge/Acceptance
  const fcstId = `FCST-MKT-${Date.now().toString(36)}`;
  await db.query(
    `INSERT INTO team_forecasts (id, team_id, period_label, category, expected_revenue, currency, actor_employee_id, status, submitted_at)
     VALUES ($1, 'TEAM-MARKETS-ALPHA', 'October', 'commit', 8500000, 'INR', 'EMP-005', 'submitted', now())`,
    [fcstId]
  );

  const decideFcstRes = await fetch(`${base}/api/manager/forecasts/decide`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      forecastId: fcstId,
      decision: 'accepted',
      feedback: 'Derivatives trading volume forecast reviewed and accepted.',
    }),
  });
  assert.equal(decideFcstRes.status, 200);

  // MG-07: Manager Forecast Submission to RM
  const mgFcstRes = await fetch(`${base}/api/manager/forecasts/submit`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      bottomUpRevenue: 8500000,
      managementAdjustment: 1000000,
      adjustedRevenue: 9500000,
      currency: 'INR',
      acceptedForecastIds: [fcstId],
      overrideReason: 'Higher option premium turnover anticipated during earnings season',
      riskNotes: 'SEBI intraday peak margin compliance and market volatility impact',
    }),
  });
  assert.equal(mgFcstRes.status, 201);

  // MG-08: Resolve Repeated SLA Breach
  const taskId = `TSK-MKT-${Date.now().toString(36)}`;
  await db.query(
    `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status, created_at)
     VALUES ($1, 'FV-3003', 'EMP-021', 'voice-call', 'High-priority Demat KYC resolution', now() - interval '2 days', 'high', 'open', now())
     ON CONFLICT (id) DO NOTHING`,
    [taskId]
  );

  const escId = `ESC-MKT-${Date.now().toString(36)}`;
  await db.query(
    `INSERT INTO overdue_escalations (id, task_id, lead_id, subject_employee_id, actor_employee_id, action, reason, severity, manager_notified, created_at)
     VALUES ($1, $2, 'FV-3003', 'EMP-021', 'EMP-005', 'escalate', 'Repeated SLA delay on Demat document clearance', 'high', true, now())`,
    [escId, taskId]
  );

  const resSlaRes = await fetch(`${base}/api/manager/sla-breaches/resolve`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      escalationId: escId,
      actionType: 'corrective-action',
      resolutionPlan: 'Assign dedicated compliance analyst for instant digital KYC approval',
      deadlineHours: 24,
    }),
  });
  assert.equal(resSlaRes.status, 200);

  // MG-09: Delegated Commercial Exception & DoA Enforcement
  // 1. Custom terms require legal/executive authority (403 Forbidden [Deck P152])
  const exc1Id = `EXC-MKT-CT-${Date.now().toString(36)}`;
  await db.query(
    `INSERT INTO commercial_exceptions (id, lead_id, requested_by_employee_id, exception_type, requested_terms, standard_terms, business_justification, delegated_limit_met, status)
     VALUES ($1, 'FV-3003', 'EMP-021', 'custom-terms', 'Zero brokerage custom institutional contract', 'Standard 10 bps equity fee', 'Institutional HNI concession', true, 'pending')`,
    [exc1Id]
  );
  const exc1Res = await fetch(`${base}/api/manager/commercial-exceptions/decide`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exceptionId: exc1Id,
      decision: 'approved',
      decisionNotes: 'Attempted branch approval of zero brokerage custom terms',
    }),
  });
  assert.equal(exc1Res.status, 403, 'Branch Manager cannot approve custom terms [Deck P152]');

  // 2. Exception exceeding delegated limit cannot be approved by Manager (403 Forbidden [Deck P152, Deck P320 Cat 3])
  const exc2Id = `EXC-MKT-BR-${Date.now().toString(36)}`;
  await db.query(
    `INSERT INTO commercial_exceptions (id, lead_id, requested_by_employee_id, exception_type, requested_terms, standard_terms, business_justification, delegated_limit_met, status)
     VALUES ($1, 'FV-3003', 'EMP-021', 'fee-waiver', '100% margin facility fee waiver (INR 250,000)', 'Standard fee INR 250,000', 'Trader concession over limit', false, 'pending')`,
    [exc2Id]
  );
  const exc2Res = await fetch(`${base}/api/manager/commercial-exceptions/decide`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exceptionId: exc2Id,
      decision: 'approved',
      decisionNotes: 'Attempted approval exceeding delegated limit',
    }),
  });
  assert.equal(exc2Res.status, 403, 'Manager cannot approve exception exceeding delegated limit [Deck P320]');

  // Permitted decision for over-limit exception: Escalate to Regional Manager
  const escExcRes = await fetch(`${base}/api/manager/commercial-exceptions/decide`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exceptionId: exc2Id,
      decision: 'escalated_to_rm',
      decisionNotes: 'Escalated to Regional Manager per DoA matrix',
    }),
  });
  assert.equal(escExcRes.status, 200, 'Escalation to RM must succeed');

  // 3. Exception within delegated limit approved within active DoA policy
  const exc3Id = `EXC-MKT-OK-${Date.now().toString(36)}`;
  await db.query(
    `INSERT INTO commercial_exceptions (id, lead_id, requested_by_employee_id, exception_type, requested_terms, standard_terms, business_justification, delegated_limit_met, status)
     VALUES ($1, 'FV-3003', 'EMP-021', 'fee-waiver', '15% Demat opening fee discount (INR 1,500)', 'Standard fee INR 1,500', 'Discretionary concession within branch limit', true, 'pending')`,
    [exc3Id]
  );
  const exc3Res = await fetch(`${base}/api/manager/commercial-exceptions/decide`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exceptionId: exc3Id,
      decision: 'approved',
      decisionNotes: 'Discretionary fee concession within authorized DoA limit',
    }),
  });
  assert.equal(exc3Res.status, 200, 'Within-limit exception must be approved');

  // Atomic state lock: Repeated decision on finalized exception must be rejected (400)
  const repeatExcRes = await fetch(`${base}/api/manager/commercial-exceptions/decide`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exceptionId: exc3Id,
      decision: 'approved',
      decisionNotes: 'Duplicate decision attempt',
    }),
  });
  assert.equal(repeatExcRes.status, 400, 'Finalized exception cannot be re-decided');

  // MG-10: Source Remediation Request
  const remRes = await fetch(`${base}/api/manager/source-quality/remediation`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceName: 'Trading App Direct',
      cohortPeriod: 'Q3-2026',
      sampleSize: 30,
      invalidIntakeCount: 5,
      contactFailedCount: 3,
      commercialLossCount: 2,
      remediationType: 'intake-correction',
      justification: 'Automate Aadhaar OTP verification to prevent KYC verification drop-offs',
    }),
  });
  assert.equal(remRes.status, 201);

  // MG-11: Structured TL Performance Review
  const revRes = await fetch(`${base}/api/manager/reviews`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subjectTlEmployeeId: 'EMP-005',
      periodLabel: 'Q3-2026',
      strengths: 'Outstanding management of derivatives desk and risk profiling SLA adherence',
      blockers: 'Sub-broker lead follow-up turnaround needs tighter monitoring',
      commitments: [{ dimension: 'Account Activation', goal: 'Achieve 85% Demat activation rate within 48h', targetDate: '2026-11-30' }],
    }),
  });
  assert.equal(revRes.status, 201);

  // MG-12: Employee Lifecycle Request (Promotion Request)
  const lcRes = await fetch(`${base}/api/manager/lifecycle`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employeeId: 'EMP-021',
      proposedRole: 'TL',
      effectiveDate: '2026-12-01',
      businessJustification: 'Top performer in equity onboarding; ready to lead Markets Gamma desk',
      handoffPlan: 'Workload and Demat accounts to be transitioned to newly onboarded callers over 10 days',
    }),
  });
  assert.equal(lcRes.status, 201);

  // MG-13: Audited Meeting Pack Binary PDF Generation
  const packRes = await fetch(`${base}/api/manager/meeting-pack/export`, {
    method: 'POST',
    headers: { Cookie: manishCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ period: 'month-to-date' }),
  });
  assert.equal(packRes.status, 201);
  const packData = (await packRes.json()) as any;
  assert.ok(packData.id);

  const downloadRes = await fetch(`${base}/api/manager/meeting-pack/download/${packData.id}`, {
    headers: { Cookie: manishCookie },
  });
  assert.equal(downloadRes.status, 200);
  assert.equal(downloadRes.headers.get('content-type'), 'application/pdf');
  const pdfBytes = Buffer.from(await downloadRes.arrayBuffer());
  assert.ok(pdfBytes.length > 500);
  assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF', 'Must generate valid binary %PDF pack');

  // Cross-Vertical Isolation Security Gate:
  // Banking Manager Kunal Shah cannot access Markets Manager overview or mutate Markets teams
  const kunalCookie = await loginAs('kunal@finverse.demo');
  const foreignTrRes = await fetch(`${base}/api/manager/transfers`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceTeamId: 'TEAM-MARKETS-BETA',
      destinationTeamId: 'TEAM-BANKING-ALPHA',
      leadIds: ['FV-3004'],
      reason: 'Attempting cross-vertical lead theft',
    }),
  });
  assert.equal(foreignTrRes.status, 403, 'Banking Manager must be denied transferring Markets leads');

  // Markets Manager Manish cannot read Banking lead FV-2001
  const foreignLeadRead = await fetch(`${base}/api/leads/FV-2001`, { headers: { Cookie: manishCookie } });
  assert.equal(foreignLeadRead.status, 404, 'Markets Manager must receive 404 reading Banking lead');

  console.log('PASS Markets Manager MG-01..13: Markets & Securities Manager supervisory oversight verified');
});

test('Markets Regional Manager RM-01..10: Markets & Securities regional governance, scorecards, territory planning, target cascade, cross-manager transfers, staffing requisitions, forecast rollup, escalations, manager reviews, and PDF review pack', async () => {
  // Login as Rajesh Bansal (EMP-024, Markets & Securities Regional Manager)
  const rajeshCookie = await loginAs('rajesh.b@finverse.demo');
  const manishCookie = await loginAs('manish@finverse.demo');
  const meeraCookie = await loginAs('meera@finverse.demo');
  const kabirCookie = await loginAs('kabir@finverse.demo');

  // Verify Role Gate: Frontline caller Kabir, TL Meera, and Manager Manish cannot access Regional Manager routes (403 Forbidden)
  const kabirDenied = await fetch(`${base}/api/regional/overview`, { headers: { Cookie: kabirCookie } });
  assert.equal(kabirDenied.status, 403, 'Frontline caller must be denied Regional Manager access');

  const meeraDenied = await fetch(`${base}/api/regional/overview`, { headers: { Cookie: meeraCookie } });
  assert.equal(meeraDenied.status, 403, 'Team Lead must be denied Regional Manager access');

  const manishDenied = await fetch(`${base}/api/regional/overview`, { headers: { Cookie: manishCookie } });
  assert.equal(manishDenied.status, 403, 'Branch Manager must be denied Regional Manager access');

  // Verify RM Session Resolution
  const meRes = await fetch(`${base}/api/auth/me`, { headers: { Cookie: rajeshCookie } });
  assert.equal(meRes.status, 200);
  const { session } = (await meRes.json()) as any;
  assert.equal(session.employeeId, 'EMP-024', 'Must resolve Rajesh Bansal');
  assert.equal(session.role, 'RM');
  assert.deepEqual(session.verticalGrants, ['markets']);
  assert.ok(session.teamGrants.includes('TEAM-MARKETS-ALPHA'));
  assert.ok(session.teamGrants.includes('TEAM-MARKETS-BETA'));

  // RM-01: Regional Overview across Markets West Zone
  const ovRes = await fetch(`${base}/api/regional/overview?period=month-to-date`, { headers: { Cookie: rajeshCookie } });
  assert.equal(ovRes.status, 200, 'Markets Regional Manager overview must return 200');
  const ovData = (await ovRes.json()) as any;
  const overview = ovData.data;
  assert.equal(overview.region.id, 'REGION-MARKETS-WEST');
  assert.equal(overview.region.vertical, 'markets');
  assert.ok(overview.region.teamsCount >= 2, 'Must cover multiple markets teams');
  assert.ok(overview.managers.some((m: any) => m.managerId === 'EMP-022'), 'Must include Markets Manager Manish Vyas');
  assert.ok(overview.target.parentTarget >= 200, 'Parent NM target must be set');

  // Create regional management intervention for Manish Vyas
  const actRes = await fetch(`${base}/api/regional/actions`, {
    method: 'POST',
    headers: { Cookie: rajeshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceAction: 'RM-01',
      kind: 'regional-intervention',
      subjectManagerEmployeeId: 'EMP-022',
      ownerEmployeeId: 'EMP-024',
      title: 'Accelerate Demat KYC and Derivatives Risk Profiling SLA',
      detail: 'Expedite CKYC validation and margin allocation turnaround for active traders in West zone',
      dueAt: new Date(Date.now() + 86400000 * 3).toISOString(),
    }),
  });
  assert.equal(actRes.status, 201);

  // RM-02: In-Scope Markets Manager Scorecard (Manish Vyas)
  const scRes = await fetch(`${base}/api/regional/managers/EMP-022/scorecard?period=October`, { headers: { Cookie: rajeshCookie } });
  assert.equal(scRes.status, 200);
  const scData = (await scRes.json()) as any;
  const scorecard = scData.data;
  assert.equal(scorecard.manager.id, 'EMP-022');
  assert.ok(scorecard.teamLeads.some((tl: any) => tl.id === 'EMP-005'), 'Must include TL Meera Nair');
  assert.ok(scorecard.teamLeads.some((tl: any) => tl.id === 'EMP-023'), 'Must include TL Tarun Sen');

  // Cross-vertical isolation: Out-of-scope Wealth Manager (EMP-007) returns 404 Not Found
  const foreignScRes = await fetch(`${base}/api/regional/managers/EMP-007/scorecard?period=October`, { headers: { Cookie: rajeshCookie } });
  assert.equal(foreignScRes.status, 404, 'Out-of-scope Wealth manager must return 404');

  // RM-03: Territory Coverage Planning for Markets West Zone
  const terrRes = await fetch(`${base}/api/regional/territories`, { headers: { Cookie: rajeshCookie } });
  assert.equal(terrRes.status, 200);

  const saveTerrRes = await fetch(`${base}/api/regional/territories`, {
    method: 'POST',
    headers: { Cookie: rajeshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      territoryName: 'Western Financial Markets & Derivatives Corridor',
      subRegion: 'Mumbai BKC Trading Hub',
      productScope: 'Equity Delivery & Intraday, F&O Derivatives, Direct Mutual Funds',
      languageQueues: ['English', 'Hindi', 'Gujarati'],
      targetTeamIds: ['TEAM-MARKETS-ALPHA', 'TEAM-MARKETS-BETA'],
      capacityGap: 2,
      routingProposal: 'Route algorithmic and HNI derivatives inquiries to Markets Alpha; retail delivery to Beta',
      activationDate: '2026-11-01',
      status: 'activated',
    }),
  });
  assert.equal(saveTerrRes.status, 201);

  // RM-04: Regional Target Cascade & Non-Over-Allocation Enforcement
  const tgRes = await fetch(`${base}/api/regional/targets`, { headers: { Cookie: rajeshCookie } });
  assert.equal(tgRes.status, 200);
  const tgData = (await tgRes.json()) as any;
  assert.ok(tgData.data.activeTarget.approvedNmTarget >= 200);

  // Valid allocation: 120 wins allocated to Manish Vyas from 200 parent target
  const allocTgRes = await fetch(`${base}/api/regional/targets/allocate`, {
    method: 'POST',
    headers: { Cookie: rajeshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      metric: 'approved-wins',
      approvedNmTarget: 200,
      managerAllocations: [
        { managerEmployeeId: 'EMP-022', targetWins: 120 },
      ],
      publish: true,
    }),
  });
  assert.equal(allocTgRes.status, 201);

  // Over-allocation check: Allocating 300 wins when parent target is 200 must be rejected (400 Bad Request)
  const overAllocRes = await fetch(`${base}/api/regional/targets/allocate`, {
    method: 'POST',
    headers: { Cookie: rajeshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      metric: 'approved-wins',
      approvedNmTarget: 200,
      managerAllocations: [
        { managerEmployeeId: 'EMP-022', targetWins: 300 },
      ],
      publish: true,
    }),
  });
  assert.equal(overAllocRes.status, 400, 'Over-allocation exceeding parent NM target must be rejected');

  // RM-05: Cross-Manager Commercial Lead Transfer & Decision
  const xferLeadId = `${RUN_PREFIX}-MKT-RM-XFER`;
  await db.query(
    `INSERT INTO leads (id, vertical, display_name, phone, preferred_language, product, source, stage, team_id)
     VALUES ($1, 'markets', 'Zenith Capital Trading Desk', '+91 98765 88077', 'en', 'F&O Derivatives', 'Sub-broker Network', 'risk-profile', 'TEAM-MARKETS-BETA')`,
    [xferLeadId]
  );

  const xferRes = await fetch(`${base}/api/regional/transfers`, {
    method: 'POST',
    headers: { Cookie: rajeshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceManagerEmployeeId: 'EMP-022',
      destinationManagerEmployeeId: 'EMP-022',
      sourceTeamId: 'TEAM-MARKETS-BETA',
      destinationTeamId: 'TEAM-MARKETS-ALPHA',
      leadIds: [xferLeadId],
      reason: 'Regional rebalancing of institutional derivatives trading account',
      forecastImpactNotes: 'Expected active funding Q4 2026',
    }),
  });
  assert.equal(xferRes.status, 201);
  const xferData = (await xferRes.json()) as any;
  const transferId = xferData.data.id;

  // Decide transfer with approval
  const decideXferRes = await fetch(`${base}/api/regional/transfers/decide`, {
    method: 'POST',
    headers: { Cookie: rajeshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transferId,
      decision: 'approved',
      resolutionNotes: 'Approved institutional trading desk rebalancing under Regional Manager authority',
    }),
  });
  assert.equal(decideXferRes.status, 200);

  // Verify lead's team in database is updated to Markets Alpha
  const { rows: movedLeadCheck } = await db.query(`SELECT team_id FROM leads WHERE id = $1`, [xferLeadId]);
  assert.equal(movedLeadCheck[0].team_id, 'TEAM-MARKETS-ALPHA');

  // Unauthorized team transfer: source team outside regional scope (Wealth Alpha) must be rejected (403)
  const unauthXferRes = await fetch(`${base}/api/regional/transfers`, {
    method: 'POST',
    headers: { Cookie: rajeshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceManagerEmployeeId: 'EMP-007',
      destinationManagerEmployeeId: 'EMP-022',
      sourceTeamId: 'TEAM-WEALTH-ALPHA',
      destinationTeamId: 'TEAM-MARKETS-ALPHA',
      leadIds: ['FV-1001'],
      reason: 'Illegal cross-vertical unauthorized transfer attempt',
    }),
  });
  assert.equal(unauthXferRes.status, 403, 'Foreign team transfer must be rejected');

  // RM-06: Regional Staffing Envelope & Requisition Submission to HR
  const staffRes = await fetch(`${base}/api/regional/staffing`, { headers: { Cookie: rajeshCookie } });
  assert.equal(staffRes.status, 200);

  const planStaffRes = await fetch(`${base}/api/regional/staffing`, {
    method: 'POST',
    headers: { Cookie: rajeshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'Q4-2026',
      plannedHeadcount: 8,
      approvedHeadcount: 6,
      activeHeadcount: 4,
      requisitions: [
        { title: 'Derivatives Specialist Caller', teamId: 'TEAM-MARKETS-ALPHA', count: 2, justification: 'Algorithmic options desk volume increase', priority: 'high' },
      ],
      businessJustification: 'Support 50% surge in F&O derivatives trading volume during market volatility',
      status: 'submitted_to_hr',
    }),
  });
  assert.equal(planStaffRes.status, 201);

  // RM-07: Regional Forecast Rollup & Submission to NM
  const mFcstId = `MFCST-MKT-${Date.now().toString(36)}`;
  await db.query(
    `INSERT INTO manager_forecasts (id, manager_employee_id, period_label, bottom_up_revenue, management_adjustment, adjusted_revenue, currency, status, accepted_forecast_ids, submitted_at)
     VALUES ($1, 'EMP-022', 'October', 12000000, 1500000, 13500000, 'INR', 'submitted_to_rm', '[]', now())`,
    [mFcstId]
  );

  const fcstRollupRes = await fetch(`${base}/api/regional/forecasts?period=October`, { headers: { Cookie: rajeshCookie } });
  assert.equal(fcstRollupRes.status, 200);

  const submitFcstRes = await fetch(`${base}/api/regional/forecasts/submit`, {
    method: 'POST',
    headers: { Cookie: rajeshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      regionalAdjustment: 2000000,
      acceptedManagerForecastIds: [mFcstId],
      topRegionalRisks: [{ title: 'SEBI peak margin requirement impact', severity: 'medium', impact: 'Turnover volatility' }],
      regionalAssumptions: 'Higher intraday derivative volume expected with multiple index weekly expiries',
      submitToNm: true,
    }),
  });
  assert.equal(submitFcstRes.status, 201);

  // RM-08: Regional Escalations & Exceptions Management
  const escListRes = await fetch(`${base}/api/regional/escalations`, { headers: { Cookie: rajeshCookie } });
  assert.equal(escListRes.status, 200);

  const createEscRes = await fetch(`${base}/api/regional/escalations`, {
    method: 'POST',
    headers: { Cookie: rajeshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceType: 'operational_risk',
      title: 'CKYC Depository Gateway Intermittent Latency',
      severity: 'high',
      accountableManagerEmployeeId: 'EMP-022',
      detail: 'Intermittent CVL-KRA gateway timeouts delaying account opening confirmations',
      deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert.equal(createEscRes.status, 201);
  const createEscData = (await createEscRes.json()) as any;
  const escId = createEscData.data.id;

  const resolveEscRes = await fetch(`${base}/api/regional/escalations/resolve`, {
    method: 'POST',
    headers: { Cookie: rajeshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      escalationId: escId,
      decision: 'resolved',
      recoveryDecision: 'Activated redundant NDML-KRA backup pipeline; resolved latency',
    }),
  });
  assert.equal(resolveEscRes.status, 200);

  // RM-09: Structured Manager Performance Review
  const saveRevRes = await fetch(`${base}/api/regional/reviews`, {
    method: 'POST',
    headers: { Cookie: rajeshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      managerEmployeeId: 'EMP-022',
      periodLabel: 'Q3-2026',
      performanceRating: 'exceeding',
      strengths: 'Rigorous risk monitoring and fast turnaround on Demat onboarding across Markets Alpha & Beta',
      blockers: 'Sub-broker network conversion rate requires structured incentive review',
      improvementCommitments: ['Increase F&O client retention rate to 88%'],
      supportActions: 'Authorize automated KRA failover and additional compliance analyst support',
      privateRmNotes: 'High potential manager with deep securities regulatory expertise',
      nextReviewDate: '2026-12-30',
      acknowledged: true,
    }),
  });
  assert.equal(saveRevRes.status, 201);

  // Non-manager or foreign-manager review rejection (403)
  const invalidRevRes = await fetch(`${base}/api/regional/reviews`, {
    method: 'POST',
    headers: { Cookie: rajeshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      managerEmployeeId: 'EMP-007', // Neel Verma (Wealth Manager, out of Markets scope)
      periodLabel: 'Q3-2026',
      performanceRating: 'achieving',
      strengths: 'Good sales',
      blockers: 'No blockers',
      improvementCommitments: ['Maintain pace'],
      nextReviewDate: '2026-12-30',
      acknowledged: true,
    }),
  });
  assert.equal(invalidRevRes.status, 403, 'Reviewing an out-of-scope manager must be rejected');

  // RM-10: Audited Binary PDF Review Pack & Report Schedules
  const prevReportRes = await fetch(`${base}/api/regional/reports/preview?period=October+2026`, { headers: { Cookie: rajeshCookie } });
  assert.equal(prevReportRes.status, 200);
  const prevReportData = (await prevReportRes.json()) as any;
  assert.ok(prevReportData.data.title.includes('Regional'));
  assert.equal(prevReportData.data.scope.vertical, 'markets');

  // Generate binary PDF
  const genPdfRes = await fetch(`${base}/api/regional/reports/generate-pdf`, {
    method: 'POST',
    headers: { Cookie: rajeshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ period: 'October 2026', sections: ['overview', 'managers', 'targets', 'forecast', 'risks'] }),
  });
  assert.equal(genPdfRes.status, 200);
  const genPdfData = (await genPdfRes.json()) as any;
  assert.ok(genPdfData.data.downloadUrl);

  const downloadPdfRes = await fetch(`${base}${genPdfData.data.downloadUrl}`, { headers: { Cookie: rajeshCookie } });
  assert.equal(downloadPdfRes.status, 200);
  assert.equal(downloadPdfRes.headers.get('content-type'), 'application/pdf');
  const pdfBytes = Buffer.from(await downloadPdfRes.arrayBuffer());
  assert.ok(pdfBytes.length > 500);
  assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF', 'Must generate valid binary %PDF pack');

  // Save report schedule
  const scheduleRes = await fetch(`${base}/api/regional/reports/schedules`, {
    method: 'POST',
    headers: { Cookie: rajeshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Monthly Markets Regional Review Schedule',
      periodType: 'monthly',
      cadence: 'First business day of each month at 08:30 IST',
      recipients: ['sanjay@finverse.demo'],
      sections: ['overview', 'managers', 'targets', 'forecast'],
      status: 'active',
    }),
  });
  assert.equal(scheduleRes.status, 201);

  // Cross-Vertical Isolation Security Gate:
  // Banking Regional Manager Arjun Mehta cannot access Markets Regional Overview
  const arjunCookie = await loginAs('arjun@finverse.demo');
  const foreignRmRes = await fetch(`${base}/api/regional/managers/EMP-022/scorecard?period=October`, { headers: { Cookie: arjunCookie } });
  assert.equal(foreignRmRes.status, 404, 'Banking RM cannot read Markets Manager scorecard');

  console.log('PASS Markets Regional Manager RM-01..10: Markets & Securities regional governance verified');
});

test('Markets National Manager NM-01..11: Markets & Securities national overview, division benchmarking, target cascade, product economics, pipeline rules, forecast rollup, cross-region transfers, cross-vertical referral intake, executive escalations, RM reviews, and board pack', async () => {
  // 1. Role-Gate Security Check: Non-NM callers/managers/RMs are strictly forbidden from NM workspace
  const kabirCookie = await loginAs('kabir@finverse.demo');     // SC
  const manishCookie = await loginAs('manish@finverse.demo');   // MG
  const rajeshCookie = await loginAs('rajesh.b@finverse.demo'); // RM

  const scDenied = await fetch(`${base}/api/national/overview`, { headers: { Cookie: kabirCookie } });
  assert.equal(scDenied.status, 403, 'Frontline SC must receive 403 on national endpoints');

  const mgDenied = await fetch(`${base}/api/national/overview`, { headers: { Cookie: manishCookie } });
  assert.equal(mgDenied.status, 403, 'Manager must receive 403 on national endpoints');

  const rmDenied = await fetch(`${base}/api/national/overview`, { headers: { Cookie: rajeshCookie } });
  assert.equal(rmDenied.status, 403, 'Regional Manager must receive 403 on national endpoints');

  // Authenticate as Markets National Manager Sanjay Singhania (EMP-025)
  const sanjayCookie = await loginAs('sanjay@finverse.demo');
  assert.ok(sanjayCookie, 'Sanjay Singhania must log in successfully with valid session');

  // 2. Scope inspection: Returns markets vertical scope, regions, teams, and headcounts
  const scopeRes = await fetch(`${base}/api/national/scope`, { headers: { Cookie: sanjayCookie } });
  assert.equal(scopeRes.status, 200);
  const scopeData = (await scopeRes.json()) as any;
  assert.equal(scopeData.data.vertical, 'markets');
  assert.ok(scopeData.data.regions.some((r: any) => r.id === 'REGION-MARKETS-WEST'));
  assert.ok(scopeData.data.regions.some((r: any) => r.id === 'REGION-MARKETS-NORTH'));
  assert.ok(scopeData.data.headcounts.rms >= 1);
  assert.ok(scopeData.data.headcounts.totalFte >= 1);

  // NM-01: National Overview & Directive Issuance
  const overviewRes = await fetch(`${base}/api/national/overview?period=month-to-date`, { headers: { Cookie: sanjayCookie } });
  assert.equal(overviewRes.status, 200);
  const overviewData = (await overviewRes.json()) as any;
  assert.equal(overviewData.data.scope.vertical, 'markets');
  assert.ok(typeof overviewData.data.kpis.approvedCeoTarget === 'number');
  assert.ok(Array.isArray(overviewData.data.regionalPerformance));

  // Create national directive to RM (Rajesh Bansal)
  const actionRes = await fetch(`${base}/api/national/actions`, {
    method: 'POST',
    headers: { Cookie: sanjayCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceAction: 'NM-01',
      kind: 'regional-directive',
      subjectRmEmployeeId: 'EMP-024',
      ownerEmployeeId: 'EMP-025',
      regionId: 'REGION-MARKETS-WEST',
      metricKey: 'active-funded',
      periodLabel: 'October',
      title: 'Accelerate High-Value F&O Demat Account Activation',
      detail: 'Expedite CKYC validation and margin clearance for quantitative algorithmic trading applicants in West zone.',
      dueAt: new Date(Date.now() + 86400000 * 3).toISOString(),
    }),
  });
  assert.equal(actionRes.status, 201);
  const actionData = (await actionRes.json()) as any;
  const actionId = actionData.data.id;
  assert.ok(actionId);

  // List actions
  const listActionsRes = await fetch(`${base}/api/national/actions?status=open`, { headers: { Cookie: sanjayCookie } });
  assert.equal(listActionsRes.status, 200);
  const listActionsData = (await listActionsRes.json()) as any;
  assert.ok(listActionsData.data.some((a: any) => a.id === actionId));

  // Complete action
  const completeActRes = await fetch(`${base}/api/national/actions/${actionId}/complete`, {
    method: 'POST',
    headers: { Cookie: sanjayCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(completeActRes.status, 200);

  // NM-02: Regional Scorecards & Benchmark Comparisons
  const compRes = await fetch(`${base}/api/national/comparisons?period=September`, { headers: { Cookie: sanjayCookie } });
  assert.equal(compRes.status, 200);
  const compData = (await compRes.json()) as any;
  assert.ok(compData.data.regions.length >= 2, 'Must compare at least West and North markets zones');
  const westComp = compData.data.regions.find((r: any) => r.regionId === 'REGION-MARKETS-WEST');
  assert.ok(westComp);
  assert.equal(westComp.regionalManager?.id, 'EMP-024');

  // NM-03: National Plan & Target Cascade
  const targetRes = await fetch(`${base}/api/national/target?period=October`, { headers: { Cookie: sanjayCookie } });
  assert.equal(targetRes.status, 200);
  const targetData = (await targetRes.json()) as any;
  assert.equal(targetData.data.approvedCeoTarget, 400);

  // Over-allocation guard (400 validation failed)
  const overAllocRes = await fetch(`${base}/api/national/target/allocate`, {
    method: 'POST',
    headers: { Cookie: sanjayCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      approvedCeoTarget: 400,
      regionalAllocations: [
        { regionId: 'REGION-MARKETS-WEST', targetWins: 300, rmEmployeeId: 'EMP-024' },
        { regionId: 'REGION-MARKETS-NORTH', targetWins: 200, rmEmployeeId: 'EMP-024' },
      ],
      publish: true,
    }),
  });
  assert.equal(overAllocRes.status, 400, 'Over-allocating beyond approved CEO target (500 > 400) must be rejected');

  // Valid cascade to regions
  const validAllocRes = await fetch(`${base}/api/national/target/allocate`, {
    method: 'POST',
    headers: { Cookie: sanjayCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      approvedCeoTarget: 400,
      regionalAllocations: [
        { regionId: 'REGION-MARKETS-WEST', targetWins: 250, rmEmployeeId: 'EMP-024' },
        { regionId: 'REGION-MARKETS-NORTH', targetWins: 150, rmEmployeeId: 'EMP-024' },
      ],
      publish: true,
    }),
  });
  assert.equal(validAllocRes.status, 200);

  // Cross-check cascaded regional target in DB
  const { rows: rtRows } = await db.query(
    `SELECT approved_nm_target, status FROM regional_targets WHERE region_id = 'REGION-MARKETS-WEST' AND period_label = 'October'`
  );
  assert.equal(Number(rtRows[0].approved_nm_target), 250);
  assert.equal(rtRows[0].status, 'published');

  // NM-04: National Economics & Unit Capacity Analysis
  const econRes = await fetch(`${base}/api/national/economics?period=month-to-date`, { headers: { Cookie: sanjayCookie } });
  assert.equal(econRes.status, 200);
  const econData = (await econRes.json()) as any;
  assert.ok(econData.data.economics.productEconomics.some((p: any) => p.product.includes('Equity') || p.product.includes('Derivatives') || p.product.includes('Mutual')));
  assert.ok(econData.data.economics.unitCapacityGapFte >= 0);

  // NM-05: Product & Pipeline Rule Proposals
  const rulesListRes = await fetch(`${base}/api/national/product-rules`, { headers: { Cookie: sanjayCookie } });
  assert.equal(rulesListRes.status, 200);
  const rulesListData = (await rulesListRes.json()) as any;
  assert.ok(rulesListData.data.some((r: any) => r.id === 'PRP-MKT-001'));

  const createRuleRes = await fetch(`${base}/api/national/product-rules`, {
    method: 'POST',
    headers: { Cookie: sanjayCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ruleName: 'SEBI Algorithmic Co-location Sub-Account Allocation SLA',
      currentVersion: '1.0',
      proposedVersion: '1.2',
      reason: 'Automate broker-side co-location API token provisioning within 4 hours of Demat funding',
      effectiveDate: '2026-11-20',
      affectedProducts: ['Equity Delivery & Intraday', 'F&O Derivatives'],
      previewImpact: 'Safeguards institutional onboarding pipeline during high-volatility market sessions',
    }),
  });
  assert.equal(createRuleRes.status, 201);

  // NM-06: National Forecast Consolidation & Executive Submission
  const fcstRollupRes = await fetch(`${base}/api/national/forecast/rollup?period=October`, { headers: { Cookie: sanjayCookie } });
  assert.equal(fcstRollupRes.status, 200);
  const fcstRollupData = (await fcstRollupRes.json()) as any;
  assert.ok(fcstRollupData.data.bottomUpSum > 0);

  const submitNatFcstRes = await fetch(`${base}/api/national/forecast/submit`, {
    method: 'POST',
    headers: { Cookie: sanjayCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      bottomUpRevenue: fcstRollupData.data.bottomUpSum,
      nationalAdjustment: 2000000,
      currency: 'INR',
      acceptedRegionalForecastIds: fcstRollupData.data.regionalForecasts.map((rf: any) => rf.id),
      topNationalRisks: [
        'SEBI peak intraday margin compliance buffers',
        'North zone derivatives onboarding capacity scaling',
      ],
      nationalAssumptions: 'Anticipated surge in options turnover around quarterly index expiries and earnings season',
      submitToExecutives: true,
    }),
  });
  assert.equal(submitNatFcstRes.status, 200);
  const submitNatFcstData = (await submitNatFcstRes.json()) as any;
  assert.equal(submitNatFcstData.data.status, 'submitted_to_executives');

  // NM-07: Cross-Region Work Transfers
  const xferLeadId = `FV-MKT-XFER-${Date.now().toString().slice(-4)}`;
  await db.query(
    `INSERT INTO leads (id, vertical, team_id, stage, display_name, phone, preferred_language, product, source, created_at, updated_at)
     VALUES ($1, 'markets', 'TEAM-MARKETS-ALPHA', 'risk-profile', 'Adani Power Trading Account', '+919876543277', 'en', 'F&O Derivatives', 'Sub-broker Network', now(), now())`,
    [xferLeadId]
  );

  const initXferRes = await fetch(`${base}/api/national/transfers`, {
    method: 'POST',
    headers: { Cookie: sanjayCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceRegionId: 'REGION-MARKETS-WEST',
      destinationRegionId: 'REGION-MARKETS-NORTH',
      leadIds: [xferLeadId],
      reason: 'Institutional trading desk relocated from Mumbai to Delhi NCR hub',
      handoffPlan: 'Transfer coverage to North institutional derivatives desk',
    }),
  });
  assert.equal(initXferRes.status, 201);
  const initXferData = (await initXferRes.json()) as any;
  const xferId = initXferData.data.id;
  assert.ok(xferId);

  // Approve transfer
  const decideXferRes = await fetch(`${base}/api/national/transfers/${xferId}/decide`, {
    method: 'POST',
    headers: { Cookie: sanjayCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision: 'approved',
      resolutionNotes: 'Approved cross-region desk transfer to North institutional trading team',
    }),
  });
  assert.equal(decideXferRes.status, 200);

  // Verify lead event recorded
  const { rows: evtRows } = await db.query(`SELECT * FROM lead_events WHERE lead_id = $1 AND kind = 'transfer'`, [xferLeadId]);
  assert.ok(evtRows.length > 0, 'Transfer event must be recorded for transferred lead');

  // NM-08: Cross-Vertical Inbound Referrals
  const refListRes = await fetch(`${base}/api/national/referrals`, { headers: { Cookie: sanjayCookie } });
  assert.equal(refListRes.status, 200);
  const refListData = (await refListRes.json()) as any;
  assert.ok(refListData.data.some((r: any) => r.id === 'REF-MKT-001'), 'Baseline Wealth-to-Markets referral REF-MKT-001 must appear');

  // Accept referral into Markets
  const acceptRefRes = await fetch(`${base}/api/national/referrals/REF-MKT-001/decide`, {
    method: 'POST',
    headers: { Cookie: sanjayCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision: 'accepted',
      targetTeamId: 'TEAM-MARKETS-ALPHA',
      targetOwnerEmployeeId: 'EMP-021',
    }),
  });
  assert.equal(acceptRefRes.status, 200);
  const acceptRefData = (await acceptRefRes.json()) as any;
  assert.equal(acceptRefData.data.decision, 'accepted');
  const receivedLeadId = acceptRefData.data.receivingLeadId;
  assert.ok(receivedLeadId);

  // Verify created lead is in markets vertical assigned to Kabir Joshi
  const { rows: recLeadRows } = await db.query(`SELECT * FROM leads WHERE id = $1`, [receivedLeadId]);
  assert.equal(recLeadRows[0].vertical, 'markets');
  assert.equal(recLeadRows[0].team_id, 'TEAM-MARKETS-ALPHA');
  assert.equal(recLeadRows[0].owner_employee_id, 'EMP-021');
  assert.equal(recLeadRows[0].display_name, 'Aditya Singhania');

  // Clean up referral created entities
  await db.query(`UPDATE cross_vertical_referrals SET receiving_lead_id = NULL WHERE id = 'REF-MKT-001'`);
  await db.query(`DELETE FROM lead_tasks WHERE lead_id = $1`, [receivedLeadId]);
  await db.query(`DELETE FROM lead_events WHERE lead_id = $1`, [receivedLeadId]);
  await db.query(`DELETE FROM leads WHERE id = $1`, [receivedLeadId]);

  // Clean up transfer lead
  await db.query(`DELETE FROM lead_events WHERE lead_id = $1`, [xferLeadId]);
  await db.query(`DELETE FROM leads WHERE id = $1`, [xferLeadId]);

  // NM-09: National Strategic Escalations
  const escListRes = await fetch(`${base}/api/national/escalations`, { headers: { Cookie: sanjayCookie } });
  assert.equal(escListRes.status, 200);
  const escListData = (await escListRes.json()) as any;
  assert.ok(escListData.data.some((e: any) => e.id === 'NESC-MKT-001'));

  const createEscRes = await fetch(`${base}/api/national/escalations`, {
    method: 'POST',
    headers: { Cookie: sanjayCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'strategic_exception',
      targetExecutive: 'BOTH',
      title: 'SEBI Intraday Peak Margin Credit Line Backing',
      detail: 'Requesting INR 25 Cr central treasury credit backing to support active quantitative traders under peak margin norms.',
      evidenceSummary: 'Audited low-latency risk telemetry and 100% intraday risk containment record.',
      decisionDeadline: new Date(Date.now() + 86400000 * 4).toISOString(),
    }),
  });
  assert.equal(createEscRes.status, 201);
  const createEscData = (await createEscRes.json()) as any;
  const escId = createEscData.data.id;

  const resolveEscRes = await fetch(`${base}/api/national/escalations/${escId}/resolve`, {
    method: 'POST',
    headers: { Cookie: sanjayCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executiveDecision: 'Approved jointly by CEO & CFO with automated RMS real-time circuit breakers.',
    }),
  });
  assert.equal(resolveEscRes.status, 200);

  // NM-10: Regional Manager Reviews
  const saveRmRevRes = await fetch(`${base}/api/national/reviews`, {
    method: 'POST',
    headers: { Cookie: sanjayCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rmEmployeeId: 'EMP-024',
      periodLabel: 'Q3-2026',
      performanceRating: 'exceeding',
      strengths: 'Outstanding derivatives turnover growth and strict SEBI compliance across West Zone',
      blockers: 'KRA depository gateway outages during early trading hours',
      growthCommitments: ['Scale North Zone trading desks', 'Deliver 250 active funded Demats in Q4'],
      coverageCommitments: ['Markets West and North zones'],
      supportNeeded: 'Automated NDML/CVL multi-depository gateway failover',
      privateNmNotes: 'Top-tier executive candidate with extensive financial markets regulatory command',
      nextReviewDate: '2026-12-31',
    }),
  });
  assert.equal(saveRmRevRes.status, 201);

  const getRmRevRes = await fetch(`${base}/api/national/reviews?rmEmployeeId=EMP-024`, { headers: { Cookie: sanjayCookie } });
  assert.equal(getRmRevRes.status, 200);
  const getRmRevData = (await getRmRevRes.json()) as any;
  assert.ok(getRmRevData.data.some((r: any) => r.period_label === 'Q3-2026'));

  // NM-11: National Executive Reports & Schedules
  const prevReportRes = await fetch(`${base}/api/national/reports/preview?period=October+2026`, { headers: { Cookie: sanjayCookie } });
  assert.equal(prevReportRes.status, 200);
  const prevReportData = (await prevReportRes.json()) as any;
  assert.equal(prevReportData.data.scope.vertical, 'markets');

  // Export PDF pack
  const expPdfRes = await fetch(`${base}/api/national/reports/export-pdf`, {
    method: 'POST',
    headers: { Cookie: sanjayCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October 2026',
      sections: ['regional-rollup', 'attainment', 'pipeline-health', 'risks'],
    }),
  });
  assert.equal(expPdfRes.status, 200);
  const expPdfData = (await expPdfRes.json()) as any;
  assert.ok(expPdfData.data.downloadUrl);

  // Download PDF binary stream & verify header
  const dlRes = await fetch(`${base}${expPdfData.data.downloadUrl}`, { headers: { Cookie: sanjayCookie } });
  assert.equal(dlRes.status, 200);
  assert.equal(dlRes.headers.get('content-type'), 'application/pdf');
  const pdfBytes = Buffer.from(await dlRes.arrayBuffer());
  assert.ok(pdfBytes.length > 1000);
  assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF', 'Board pack must be a valid binary PDF');

  // Save report schedule
  const saveSchedRes = await fetch(`${base}/api/national/reports/schedules`, {
    method: 'POST',
    headers: { Cookie: sanjayCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Markets & Securities National Strategy & Trading Cadence',
      periodType: 'monthly',
      cadence: '1st business day, 08:30 IST',
      recipients: ['sanjay@finverse.demo', 'rajesh.b@finverse.demo', 'ceo@finverse.demo', 'cfo@finverse.demo'],
      sections: ['attainment', 'regional-scorecards', 'economics'],
      status: 'active',
    }),
  });
  assert.equal(saveSchedRes.status, 200);

  // Cross-Vertical Isolation: Suresh (Banking NM) cannot read Markets lead records
  const bankingNmCookie = await loginAs('suresh@finverse.demo');
  const marketsLeadDenied = await fetch(`${base}/api/leads/FV-3001`, { headers: { Cookie: bankingNmCookie } });
  assert.equal(marketsLeadDenied.status, 404, 'Banking NM must receive 404 on Markets lead');

  console.log('PASS Markets National Manager NM-01..11: Markets & Securities national strategy verified');
});
