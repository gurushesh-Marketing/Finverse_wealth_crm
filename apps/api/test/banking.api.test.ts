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

const RUN_PREFIX = `FV-B${Date.now().toString().slice(-4)}`;

async function cleanupChain(prefix: string = RUN_PREFIX): Promise<void> {
  const targetLeadsSql = `(SELECT id FROM leads WHERE phone LIKE '+91 98765 99%' OR id LIKE '${prefix}%')`;
  await db.query(`DELETE FROM lead_events WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM reminders WHERE task_id IN (SELECT id FROM lead_tasks WHERE lead_id IN ${targetLeadsSql})`);
  await db.query(`DELETE FROM lead_tasks WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM documents WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM document_requests WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM outcome_requests WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM loss_records WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM proposals WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM qualifications WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM stage_events WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM evidence_access_log WHERE review_id IN (SELECT id FROM call_quality_reviews WHERE call_id IN (SELECT id FROM calls WHERE lead_id IN ${targetLeadsSql}))`);
  await db.query(`DELETE FROM call_quality_reviews WHERE call_id IN (SELECT id FROM calls WHERE lead_id IN ${targetLeadsSql})`);
  await db.query(`DELETE FROM activity_corrections WHERE call_id IN (SELECT id FROM calls WHERE lead_id IN ${targetLeadsSql})`);
  await db.query(`DELETE FROM meetings WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM calls WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM messages WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM contact_suppressions WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM lead_audit WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM lead_ownership_events WHERE lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM team_targets WHERE team_id LIKE 'TEAM-BANKING%' AND period_label IN ('Q3-2026', 'Q4-2026')`);
  await db.query(`DELETE FROM team_forecasts WHERE team_id LIKE 'TEAM-BANKING%'`);
  await db.query(`DELETE FROM lead_transfer_requests WHERE source_team_id LIKE 'TEAM-BANKING%' OR destination_team_id LIKE 'TEAM-BANKING%'`);
  await db.query(`DELETE FROM management_actions WHERE manager_employee_id = 'EMP-017'`);
  await db.query(`DELETE FROM manager_targets WHERE manager_employee_id = 'EMP-017'`);
  await db.query(`DELETE FROM manager_forecasts WHERE manager_employee_id = 'EMP-017'`);
  await db.query(`DELETE FROM capacity_plans WHERE manager_employee_id = 'EMP-017'`);
  await db.query(`DELETE FROM commercial_exceptions WHERE requested_by_employee_id IN ('EMP-004', 'EMP-016', 'EMP-017', 'EMP-018')`);
  await db.query(`DELETE FROM source_remediations WHERE manager_employee_id = 'EMP-017'`);
  await db.query(`DELETE FROM employee_lifecycle_requests WHERE employee_id IN ('EMP-004', 'EMP-016')`);
  await db.query(`DELETE FROM overdue_escalations WHERE lead_id IN ${targetLeadsSql} OR lead_id IN ('FV-2001', 'FV-2002', 'FV-2003', 'FV-2004')`);
  await db.query(`DELETE FROM reviews WHERE employee_id IN ('EMP-016', 'EMP-018')`);
  await db.query(`DELETE FROM regional_management_actions WHERE rm_employee_id = 'EMP-019'`);
  await db.query(`DELETE FROM territory_coverage_plans WHERE rm_employee_id = 'EMP-019'`);
  await db.query(`DELETE FROM regional_targets WHERE rm_employee_id = 'EMP-019' AND period_label NOT IN ('October', 'RT-BANK-OCT-2026')`);
  await db.query(`DELETE FROM cross_manager_transfers WHERE rm_employee_id = 'EMP-019'`);
  await db.query(`DELETE FROM regional_staffing_plans WHERE rm_employee_id = 'EMP-019'`);
  await db.query(`DELETE FROM regional_forecasts WHERE rm_employee_id = 'EMP-019'`);
  await db.query(`DELETE FROM regional_escalations WHERE rm_employee_id = 'EMP-019'`);
  await db.query(`DELETE FROM manager_reviews WHERE rm_employee_id = 'EMP-019'`);
  await db.query(`DELETE FROM regional_report_schedules WHERE rm_employee_id = 'EMP-019'`);
  await db.query(`DELETE FROM national_management_actions WHERE nm_employee_id = 'EMP-020'`);
  await db.query(`DELETE FROM national_targets WHERE nm_employee_id = 'EMP-020' AND period_label NOT IN ('October', 'NT-BANK-OCT-2026')`);
  await db.query(`UPDATE national_targets SET approved_ceo_target = 300, unallocated_remainder = 0 WHERE id = 'NT-BANK-OCT-2026'`);
  await db.query(`DELETE FROM product_rule_proposals WHERE nm_employee_id = 'EMP-020' AND id != 'PRP-BNK-001'`);
  await db.query(`DELETE FROM national_forecasts WHERE nm_employee_id = 'EMP-020'`);
  await db.query(`DELETE FROM cross_region_transfers WHERE nm_employee_id = 'EMP-020'`);
  await db.query(`DELETE FROM national_escalations WHERE nm_employee_id = 'EMP-020' AND id != 'NESC-BNK-001'`);
  await db.query(`DELETE FROM rm_reviews WHERE nm_employee_id = 'EMP-020'`);
  await db.query(`DELETE FROM national_report_schedules WHERE nm_employee_id = 'EMP-020'`);
  await db.query(`UPDATE leads SET intake_batch_id = NULL, intake_row_id = NULL WHERE phone LIKE '+91 98765 99%' OR id LIKE '${prefix}%' OR id LIKE 'FV-B%'`);
  await db.query(`UPDATE intake_rows SET published_lead_id = NULL WHERE published_lead_id IN ${targetLeadsSql} OR batch_id IN (SELECT id FROM intake_batches WHERE batch_name LIKE '${prefix}%' OR batch_name LIKE 'FV-B%')`);
  await db.query(`DELETE FROM intake_rows WHERE batch_id IN (SELECT id FROM intake_batches WHERE batch_name LIKE '${prefix}%' OR batch_name LIKE 'FV-B%')`);
  await db.query(`DELETE FROM intake_batches WHERE batch_name LIKE '${prefix}%' OR batch_name LIKE 'FV-B%'`);
  await db.query(`DELETE FROM enquiries WHERE phone LIKE '+91 98765 99%' OR published_lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM leads WHERE id IN ${targetLeadsSql}`);
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

async function loginAs(email: string): Promise<string> {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo1234' }),
  });
  assert.equal(res.status, 200, `Login failed for ${email}`);
  const cookie = res.headers.get('set-cookie');
  assert.ok(cookie, 'Missing session cookie');
  return cookie.split(';')[0]!;
}

test('Banking SC-01..28: Full Frontline Commercial Banking caller journey', async () => {
  // 1. Auth & Session resolution
  const devCookie = await loginAs('dev@finverse.demo');
  const meRes = await fetch(`${base}/api/auth/me`, { headers: { Cookie: devCookie } });
  assert.equal(meRes.status, 200);
  const { session } = (await meRes.json()) as any;
  assert.equal(session.employeeId, 'EMP-004');
  assert.equal(session.role, 'SC');
  assert.deepEqual(session.verticalGrants, ['banking']);
  assert.deepEqual(session.teamGrants, ['TEAM-BANKING-ALPHA']);

  // 2. Cross-vertical read isolation
  // Dev reads assigned banking leads
  const devLeadsRes = await fetch(`${base}/api/leads`, { headers: { Cookie: devCookie } });
  assert.equal(devLeadsRes.status, 200);
  const devLeads = (await devLeadsRes.json()) as any;
  assert.ok(devLeads.leads.some((l: any) => l.id === 'FV-2001' || l.id === 'FV-2002'));
  assert.ok(!devLeads.leads.some((l: any) => l.id === 'FV-1001'), 'Dev must not see Wealth leads');

  // Dev cannot open Wealth lead FV-1001
  const crossRes = await fetch(`${base}/api/leads/FV-1001`, { headers: { Cookie: devCookie } });
  assert.equal(crossRes.status, 404, 'Banking caller must receive 404 for Wealth lead');

  // Wealth caller Asha cannot open Banking lead FV-2001
  const ashaCookie = await loginAs('asha@finverse.demo');
  const ashaCrossRes = await fetch(`${base}/api/leads/FV-2001`, { headers: { Cookie: ashaCookie } });
  assert.equal(ashaCrossRes.status, 404, 'Wealth caller must receive 404 for Banking lead');

  // 3. Self-sourced Banking Enquiry creation (SC-05)
  // Rejects wealth product on banking scope
  const invalidProdRes = await fetch(`${base}/api/enquiries`, {
    method: 'POST',
    headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: 'Adani Logistics Hub',
      phone: '+91 98765 99001',
      email: 'finance@adani-logistics.test',
      product: 'V1 Wealth Portfolio', // Wealth product!
      source: 'Branch Intake',
      permissionEvidence: 'Signed commercial enquiry form dated 2026-10-15',
      need: 'Corporate Working Capital ₹25 Cr',
    }),
  });
  assert.equal(invalidProdRes.status, 422, 'Wealth product must be rejected on Banking caller scope');

  // Accepts authentic Banking product
  const createEnqRes = await fetch(`${base}/api/enquiries`, {
    method: 'POST',
    headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: 'Adani Logistics Hub',
      phone: '+91 98765 99001',
      email: 'finance@adani-logistics.test',
      product: 'Corporate Term Loan',
      source: 'Branch Intake',
      permissionEvidence: 'Signed commercial enquiry form dated 2026-10-15',
      need: 'Corporate Term Loan ₹15 Cr for warehouse expansion',
    }),
  });
  assert.equal(createEnqRes.status, 201);
  const enq = (await createEnqRes.json()) as any;
  assert.equal(enq.displayName, 'Adani Logistics Hub');
  assert.equal(enq.status, 'pending-validation');

  // Publish enquiry into lead routing queue
  const pubRes = await fetch(`${base}/api/enquiries/${enq.id}/publish`, {
    method: 'POST',
    headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
  });
  assert.equal(pubRes.status, 200);
  const pub = (await pubRes.json()) as any;
  assert.ok(pub.leadId.startsWith('FV-5'));

  // Verify created lead has vertical = 'banking' and team = 'TEAM-BANKING-ALPHA'
  const { rows: leadCheck } = await db.query(`SELECT vertical, team_id, stage, product FROM leads WHERE id = $1`, [pub.leadId]);
  assert.equal(leadCheck[0].vertical, 'banking');
  assert.equal(leadCheck[0].team_id, 'TEAM-BANKING-ALPHA');
  assert.equal(leadCheck[0].stage, 'new');
  assert.equal(leadCheck[0].product, 'Corporate Term Loan');

  // Assign lead to Dev for frontline processing
  const testLeadId = `${RUN_PREFIX}-01`;
  await db.query(
    `INSERT INTO leads (id, vertical, display_name, phone, email, preferred_language, product, source, stage, owner_employee_id, team_id)
     VALUES ($1, 'banking', 'Apex Infrastructure Ltd', '+91 98765 99002', 'cfo@apex-infra.test', 'English', 'Corporate Term Loan', 'Branch Intake', 'new', 'EMP-004', 'TEAM-BANKING-ALPHA')`,
    [testLeadId]
  );

  // 4. Commercial Banking Stage Transitions (Deck P005: New -> Eligibility -> Documents -> Sanction -> Disbursal)
  // Step A: New -> Eligibility
  const move1 = await fetch(`${base}/api/leads/${testLeadId}/stage`, {
    method: 'POST',
    headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ toStage: 'eligibility', reason: 'Preliminary credit eligibility criteria satisfied' }),
  });
  assert.equal(move1.status, 200);
  const move1Body = (await move1.json()) as any;
  assert.equal(move1Body.stage, 'eligibility');

  // Disallow invalid transition directly from eligibility -> sanction (skipping documents)
  const invalidMove = await fetch(`${base}/api/leads/${testLeadId}/stage`, {
    method: 'POST',
    headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ toStage: 'sanction', reason: 'Jump without financial documents' }),
  });
  assert.equal(invalidMove.status, 422, 'Cannot skip required documents stage');

  // Step B: Eligibility -> Documents
  const move2 = await fetch(`${base}/api/leads/${testLeadId}/stage`, {
    method: 'POST',
    headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ toStage: 'documents', reason: 'Audited balance sheets and GST filings requested' }),
  });
  assert.equal(move2.status, 200);

  // Step C: Documents -> Sanction
  const move3 = await fetch(`${base}/api/leads/${testLeadId}/stage`, {
    method: 'POST',
    headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ toStage: 'sanction', reason: 'Underwriting cleared; sanction letter drafted' }),
  });
  assert.equal(move3.status, 200);

  // Step D: Direct move to disbursal without TL conversion approval must be rejected
  const directDisbursal = await fetch(`${base}/api/leads/${testLeadId}/stage`, {
    method: 'POST',
    headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ toStage: 'disbursal', reason: 'Disbursing loan funds directly' }),
  });
  assert.equal(directDisbursal.status, 422, 'Disbursal requires TL conversion workflow');

  // 5. Qualification (SC-15)
  const qualRes = await fetch(`${base}/api/leads/${testLeadId}/qualification`, {
    method: 'POST',
    headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      need: 'Expansion term loan ₹20 Cr with 7-year tenor and collateral coverage 1.33x',
      product: 'Corporate Term Loan',
      expectedValue: 200000000,
      currency: 'INR',
      timeHorizon: '90 days',
      checklist: { collateralEvaluated: true, cibilChecked: true },
      nextStep: 'Draft sanction term sheet',
    }),
  });
  assert.equal(qualRes.status, 201);
  const qual = (await qualRes.json()) as any;
  assert.equal(qual.recommendedNextStep, 'Draft sanction term sheet');

  // Verify qualification recorded with banking-fit-v1 checklist
  const { rows: qualRows } = await db.query(`SELECT checklist_version, expected_value FROM qualifications WHERE lead_id = $1`, [testLeadId]);
  assert.equal(qualRows[0].checklist_version, 'banking-v1');
  assert.equal(Number(qualRows[0].expected_value), 200000000);

  // 6. Proposal / Sanction Term Sheet (SC-17)
  const propRes = await fetch(`${base}/api/leads/${testLeadId}/proposals`, {
    method: 'POST',
    headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product: 'Corporate Term Loan',
      templateVersion: 'sanction-v1',
      terms: 'Facility: Term Loan ₹20,00,00,000; Rate: 9.25% p.a.; Processing fee: 0.50%; Security: First pari passu charge on plant & machinery.',
      validUntil: '2026-11-30',
      recipient: 'CFO Apex Infrastructure Ltd',
    }),
  });
  assert.equal(propRes.status, 201);
  const prop = (await propRes.json()) as any;
  assert.equal(prop.status, 'draft');

  // 7. Conversion Submission (SC-20)
  const convRes = await fetch(`${base}/api/leads/${testLeadId}/conversion`, {
    method: 'POST',
    headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      winMilestone: 'Sanction letter executed & initial facility tranche disbursed',
      milestoneDate: '2026-10-15',
      value: 200000000,
      currency: 'INR',
      evidenceRef: 'https://vault.internal.finverse/sanctions/apex-2026-executed.pdf',
      proposedCredit: { 'EMP-004': 100 },
    }),
  });
  assert.equal(convRes.status, 201);
  const conv = (await convRes.json()) as any;
  assert.equal(conv.status, 'pending');

  // 8. Mark Lost with Banking Loss Reason (SC-21)
  const testLostLeadId = `${RUN_PREFIX}-02`;
  await db.query(
    `INSERT INTO leads (id, vertical, display_name, phone, email, preferred_language, product, source, stage, owner_employee_id, team_id)
     VALUES ($1, 'banking', 'Shree Cement Ancillaries', '+91 98765 99003', 'contact@shree-anc.test', 'English', 'Working Capital Facility', 'Branch Intake', 'eligibility', 'EMP-004', 'TEAM-BANKING-ALPHA')`,
    [testLostLeadId]
  );

  const lossRes = await fetch(`${base}/api/leads/${testLostLeadId}/loss`, {
    method: 'POST',
    headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reason: 'Credit rejected',
      explanation: 'DSCR below 1.1x and negative cash flow from operations over last two consecutive quarters',
      futureContact: 'Re-evaluate in Q3 2027 upon receipt of audited annual results',
    }),
  });
  assert.equal(lossRes.status, 200);

  const { rows: lostCheck } = await db.query(`SELECT stage FROM leads WHERE id = $1`, [testLostLeadId]);
  assert.equal(lostCheck[0].stage, 'lost');

  console.log('PASS Banking SC-01..28: Frontline Commercial Banking caller journey verified');
});

test('Banking TL-01..18: Commercial Banking Team Lead workspace and supervisory workflow', async () => {
  // 1. Authenticate Rohan Sen (Banking Team Lead, EMP-016, TEAM-BANKING-ALPHA)
  const rohanCookie = await loginAs('rohan@finverse.demo');
  const meRes = await fetch(`${base}/api/auth/me`, { headers: { Cookie: rohanCookie } });
  assert.equal(meRes.status, 200);
  const { session } = (await meRes.json()) as any;
  assert.equal(session.employeeId, 'EMP-016');
  assert.equal(session.role, 'TL');
  assert.deepEqual(session.verticalGrants, ['banking']);
  assert.deepEqual(session.teamGrants, ['TEAM-BANKING-ALPHA']);

  // 2. Caller denied TL endpoints (deny-by-default boundary guard)
  const devCookie = await loginAs('dev@finverse.demo');
  const callerDenied = await fetch(`${base}/api/tl/overview`, { headers: { Cookie: devCookie } });
  assert.equal(callerDenied.status, 403, 'Frontline caller must be denied TL overview');

  // 3. TL-01 Team overview, KPI metrics & members drill
  const ovRes = await fetch(`${base}/api/tl/overview`, { headers: { Cookie: rohanCookie } });
  assert.equal(ovRes.status, 200);
  const ov = (await ovRes.json()) as any;
  assert.ok(Array.isArray(ov.members));
  assert.ok(ov.members.some((m: any) => m.employeeId === 'EMP-004'), 'Dev Kapoor must appear in Banking team members');
  assert.ok(Array.isArray(ov.kpis));

  const drillRes = await fetch(`${base}/api/tl/overview/drill?metric=open-leads`, { headers: { Cookie: rohanCookie } });
  assert.equal(drillRes.status, 200);
  const drill = (await drillRes.json()) as any;
  assert.ok(Array.isArray(drill.opportunities));

  // 4. TL-02 / TL-03 Allocation queue and single allocation
  const unassignedLeadId = `${RUN_PREFIX}-UNASS-01`;
  await db.query(
    `INSERT INTO leads (id, vertical, display_name, phone, email, preferred_language, product, source, stage, owner_employee_id, team_id)
     VALUES ($1, 'banking', 'Godrej Agro Term Facility', '+91 98765 99010', 'finance@godrej-agro.test', 'English', 'Corporate Term Loan', 'Branch Intake', 'new', NULL, 'TEAM-BANKING-ALPHA')`,
    [unassignedLeadId]
  );

  const allocQueueRes = await fetch(`${base}/api/tl/allocation/queue`, { headers: { Cookie: rohanCookie } });
  assert.equal(allocQueueRes.status, 200);
  const queue = (await allocQueueRes.json()) as any;
  assert.ok(queue.leads.some((l: any) => l.id === unassignedLeadId), 'Unassigned banking lead must appear in allocation queue');

  const recipRes = await fetch(`${base}/api/tl/allocation/recipients`, { headers: { Cookie: rohanCookie } });
  assert.equal(recipRes.status, 200);
  const recips = (await recipRes.json()) as any;
  assert.ok(recips.recipients.some((r: any) => r.employeeId === 'EMP-004'));

  // Allocate unassigned lead to Dev Kapoor
  const allocRes = await fetch(`${base}/api/tl/allocation`, {
    method: 'POST',
    headers: { Cookie: rohanCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leadId: unassignedLeadId,
      toEmployeeId: 'EMP-004',
      reason: 'Assigned to commercial relationship officer for facility screening',
      recordVersion: 1,
    }),
  });
  assert.equal(allocRes.status, 201);

  const { rows: allocCheck } = await db.query(`SELECT owner_employee_id FROM leads WHERE id = $1`, [unassignedLeadId]);
  assert.equal(allocCheck[0].owner_employee_id, 'EMP-004');

  // 5. TL-04 Workload and Capacity
  const workloadRes = await fetch(`${base}/api/tl/workload`, { headers: { Cookie: rohanCookie } });
  assert.equal(workloadRes.status, 200);
  const workload = (await workloadRes.json()) as any;
  assert.ok(workload.members.some((m: any) => m.employeeId === 'EMP-004'));

  // 6. TL-07 Conversion Decision: Sanction -> Disbursal approval
  const testLeadId = `${RUN_PREFIX}-01`;
  const { rows: pendConvRows } = await db.query(
    `SELECT id FROM outcome_requests WHERE lead_id = $1 AND type = 'conversion' AND status = 'pending'`,
    [testLeadId]
  );
  assert.ok(pendConvRows.length > 0, 'Conversion request must be pending');
  const convRequestId = pendConvRows[0].id;

  const decisionsRes = await fetch(`${base}/api/tl/decisions`, { headers: { Cookie: rohanCookie } });
  assert.equal(decisionsRes.status, 200);
  const decisions = (await decisionsRes.json()) as any;
  assert.ok(decisions.conversions.some((c: any) => c.id === convRequestId));

  // Rohan approves the conversion request
  const approveRes = await fetch(`${base}/api/requests/${convRequestId}/decision`, {
    method: 'POST',
    headers: { Cookie: rohanCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision: 'approve',
      reason: 'Sanction letter executed by client and approved by corporate credit underwriting. Initial facility tranche cleared for disbursal.',
      evidence: { facilitySanctionId: 'SANCT-2026-APEX-01', disbursalAuthorized: true },
    }),
  });
  assert.equal(approveRes.status, 200);

  // Verify lead advanced to 'disbursal' won stage (Deck P005)
  const { rows: wonCheck } = await db.query(`SELECT stage FROM leads WHERE id = $1`, [testLeadId]);
  assert.equal(wonCheck[0].stage, 'disbursal');

  const { rows: stgEventCheck } = await db.query(
    `SELECT to_stage, actor_employee_id FROM stage_events WHERE lead_id = $1 ORDER BY occurred_at DESC LIMIT 1`,
    [testLeadId]
  );
  assert.equal(stgEventCheck[0].to_stage, 'disbursal');
  assert.equal(stgEventCheck[0].actor_employee_id, 'EMP-016');

  // 7. TL-08 Reopen Decision: Lost -> Eligibility approval
  const testLostLeadId = `${RUN_PREFIX}-02`;
  const reopenReqRes = await fetch(`${base}/api/leads/${testLostLeadId}/reopen`, {
    method: 'POST',
    headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reason: 'Client secured fresh equity co-investment of ₹15 Cr from parent group, bringing debt-equity ratio within underwriting policy',
      evidenceRef: 'https://vault.internal.finverse/credit/equity-confirmation-shree.pdf',
      requestedNextStage: 'eligibility',
      nextAction: 'Re-screen financial model with fresh equity injection',
    }),
  });
  assert.equal(reopenReqRes.status, 201);
  const reopenReq = (await reopenReqRes.json()) as any;

  // Rohan approves the reopen request
  const reopenId = reopenReq.requestId || reopenReq.id;
  const approveReopenRes = await fetch(`${base}/api/requests/${reopenId}/decision`, {
    method: 'POST',
    headers: { Cookie: rohanCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision: 'approve',
      reason: 'Verified equity injection satisfies minimum credit solvency criterion.',
    }),
  });
  assert.equal(approveReopenRes.status, 200);

  const { rows: reopenCheck } = await db.query(`SELECT stage FROM leads WHERE id = $1`, [testLostLeadId]);
  assert.equal(reopenCheck[0].stage, 'eligibility', 'Reopened Banking lead must advance to eligibility');

  // 8. TL-10 Targets & TL-11 Forecasts
  const targetRes = await fetch(`${base}/api/tl/targets`, {
    method: 'POST',
    headers: { Cookie: rohanCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId: 'TEAM-BANKING-ALPHA',
      periodLabel: 'Q3-2026',
      metric: 'disbursal_volume',
      parentValue: 500000000,
    }),
  });
  assert.equal(targetRes.status, 201);

  const forecastRes = await fetch(`${base}/api/tl/forecasts`, {
    method: 'POST',
    headers: { Cookie: rohanCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId: 'TEAM-BANKING-ALPHA',
      periodLabel: 'Q3-2026',
      category: 'commit',
      expectedRevenue: 400000000,
      currency: 'INR',
      opportunityIds: [testLeadId],
      riskNotes: 'Strong Q3 commercial pipeline with corporate term loans in sanction stage',
      assumptions: 'All facility conditions precedent fulfilled by borrowers',
    }),
  });
  assert.equal(forecastRes.status, 201);

  // 9. TL-16 Streaming Team Review Pack PDF Export
  const teamPackRes = await fetch(`${base}/api/tl/team-packs`, {
    method: 'POST',
    headers: { Cookie: rohanCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamIds: ['TEAM-BANKING-ALPHA'],
      period: 'month',
    }),
  });
  assert.equal(teamPackRes.status, 201);
  const teamPack = (await teamPackRes.json()) as any;

  const downloadRes = await fetch(`${base}/api/tl/team-packs/${teamPack.id}/download`, {
    headers: { Cookie: rohanCookie },
  });
  assert.equal(downloadRes.status, 200);
  assert.equal(downloadRes.headers.get('content-type'), 'application/pdf');
  const pdfBytes = Buffer.from(await downloadRes.arrayBuffer());
  assert.ok(pdfBytes.length > 500);
  assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF', 'Team Pack must be a valid binary PDF');

  // 10. Cross-Vertical Isolation: Rohan cannot read or mutate Wealth entities
  const wealthLeadDenied = await fetch(`${base}/api/leads/FV-1001`, { headers: { Cookie: rohanCookie } });
  assert.equal(wealthLeadDenied.status, 404, 'Banking TL must receive 404 on Wealth lead');

  console.log('PASS Banking TL-01..18: Commercial Banking Team Lead workspace and supervisory workflow verified');
});

test('Banking Intake -> TL Allocation -> Caller Commercial Disbursal: Verified End-to-End lifecycle', async () => {
  // Step 1: Data Entry captures/publishes Banking Intake Batch
  const deepaCookie = await loginAs('deepa@finverse.demo');
  const candidatePhone = `+91 98765 99${Math.floor(100 + Math.random() * 899)}`;
  const candidateName = `Apex Infrastructure Corp ${RUN_PREFIX}`;

  const csv = [
    'Client Name,Primary Mobile,Email Address,Target Product,Consent Reference,Consent Date,Need Summary',
    `"${candidateName}","${candidatePhone}",cfo@apexinfra.test,V1 Current Account,CONSENT-BNK-${RUN_PREFIX},2026-10-15,Commercial Current Account and working capital escrow`,
  ].join('\n');

  const uploadRes = await fetch(`${base}/api/data-entry/batches/upload`, {
    method: 'POST',
    headers: { Cookie: deepaCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      batchName: `${RUN_PREFIX}-BNK-BATCH`,
      sourceId: 'SRC-WEB-01',
      vertical: 'banking',
      targetTeamId: 'TEAM-BANKING-ALPHA',
      fileName: `banking_${RUN_PREFIX}.csv`,
      csvContent: csv,
    }),
  });
  assert.equal(uploadRes.status, 201);
  const uploadData = (await uploadRes.json()) as any;
  assert.equal(uploadData.validRows, 1);
  const batchId = uploadData.id;

  // Publish batch
  const pubRes = await fetch(`${base}/api/data-entry/batches/${batchId}/publish`, {
    method: 'POST',
    headers: { Cookie: deepaCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(pubRes.status, 200);
  const pubData = (await pubRes.json()) as any;
  assert.equal(pubData.publishedCount, 1);
  const publishedLeadId = pubData.canonicalLeadIds[0];
  assert.ok(publishedLeadId, 'Published lead ID must exist');

  // Verify created lead is unassigned and in TEAM-BANKING-ALPHA
  const { rows: leadCheck } = await db.query(`SELECT owner_employee_id, vertical, team_id, stage FROM leads WHERE id = $1`, [publishedLeadId]);
  assert.equal(leadCheck[0].owner_employee_id, null, 'Published intake lead must be unassigned');
  assert.equal(leadCheck[0].vertical, 'banking');
  assert.equal(leadCheck[0].team_id, 'TEAM-BANKING-ALPHA');
  assert.equal(leadCheck[0].stage, 'new');

  // Step 2: Banking Team Lead (Rohan Sen) inspects queue and allocates
  const rohanCookie = await loginAs('rohan@finverse.demo');
  const queueRes = await fetch(`${base}/api/tl/allocation/queue`, { headers: { Cookie: rohanCookie } });
  assert.equal(queueRes.status, 200);
  const queueData = (await queueRes.json()) as any;
  const queuedLead = queueData.leads.find((l: any) => l.id === publishedLeadId);
  assert.ok(queuedLead, 'Intake published lead must appear in Banking TL allocation queue');

  // Check eligible Banking recipients
  const recipRes = await fetch(`${base}/api/tl/allocation/recipients`, { headers: { Cookie: rohanCookie } });
  assert.equal(recipRes.status, 200);
  const recipData = (await recipRes.json()) as any;
  assert.ok(recipData.recipients.some((r: any) => r.employeeId === 'EMP-004'), 'Dev Kapoor must be an eligible recipient');

  // Allocate lead to Dev Kapoor
  const allocRes = await fetch(`${base}/api/tl/allocation`, {
    method: 'POST',
    headers: { Cookie: rohanCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leadId: publishedLeadId,
      toEmployeeId: 'EMP-004',
      reason: 'Assigned to commercial relationship manager for credit and onboarding',
      recordVersion: queuedLead.recordVersion,
    }),
  });
  assert.equal(allocRes.status, 201);

  // Cross-check DB assignment and audit event
  const { rows: postAllocCheck } = await db.query(`SELECT owner_employee_id FROM leads WHERE id = $1`, [publishedLeadId]);
  assert.equal(postAllocCheck[0].owner_employee_id, 'EMP-004');
  const { rows: ownEventCheck } = await db.query(
    `SELECT to_owner_employee_id, actor_role FROM lead_ownership_events WHERE lead_id = $1 ORDER BY changed_at DESC LIMIT 1`,
    [publishedLeadId]
  );
  assert.equal(ownEventCheck[0].to_owner_employee_id, 'EMP-004');
  assert.equal(ownEventCheck[0].actor_role, 'TL');

  // Step 3: Banking Caller (Dev Kapoor) works the assigned lead
  const devCookie = await loginAs('dev@finverse.demo');
  const devLeadsRes = await fetch(`${base}/api/leads`, { headers: { Cookie: devCookie } });
  assert.equal(devLeadsRes.status, 200);
  const devLeads = (await devLeadsRes.json()) as any;
  assert.ok(devLeads.leads.some((l: any) => l.id === publishedLeadId), 'Allocated lead must appear in Dev Kapoor lead inbox');

  // Save qualification fit checklist
  const qualRes = await fetch(`${base}/api/leads/${publishedLeadId}/qualification`, {
    method: 'POST',
    headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      need: 'Corporate client qualifies for tier-1 commercial facilities and current account',
      product: 'V1 Current Account',
      expectedValue: 50000000,
      currency: 'INR',
      timeHorizon: '90 days',
      checklist: { registeredEntity: true, auditedFinancialsAvailable: true },
      nextStep: 'Collect onboarding documents',
    }),
  });
  assert.equal(qualRes.status, 201);

  // Sequential stage moves: new -> eligibility -> documents -> sanction
  for (const to of ['eligibility', 'documents', 'sanction']) {
    const moveRes = await fetch(`${base}/api/leads/${publishedLeadId}/stage`, {
      method: 'POST',
      headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ toStage: to, reason: `Commercial progression to ${to}` }),
    });
    assert.equal(moveRes.status, 200);
  }

  // Caller submits conversion request
  const convRes = await fetch(`${base}/api/leads/${publishedLeadId}/conversion`, {
    method: 'POST',
    headers: { Cookie: devCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      winMilestone: 'Executed Current Account Mandate & Initial Liquidity Cleared',
      milestoneDate: '2026-10-16',
      value: 50000000,
      currency: 'INR',
      evidenceRef: 'https://vault.internal.finverse/contracts/apex-mandate-executed.pdf',
      proposedCredit: { 'EMP-004': 100 },
    }),
  });
  assert.equal(convRes.status, 201);
  const convData = (await convRes.json()) as any;
  const convId = convData.requestId || convData.id;

  // Step 4: Banking Team Lead decides conversion to terminal won 'disbursal'
  const decRes = await fetch(`${base}/api/tl/decisions`, { headers: { Cookie: rohanCookie } });
  assert.equal(decRes.status, 200);
  const decData = (await decRes.json()) as any;
  assert.ok(decData.conversions.some((c: any) => c.id === convId), 'Pending conversion must be visible in TL decisions');

  const approveRes = await fetch(`${base}/api/requests/${convId}/decision`, {
    method: 'POST',
    headers: { Cookie: rohanCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision: 'approve',
      reason: 'Mandate and corporate resolution verified. Facility cleared for disbursal.',
      evidence: { mandateRef: 'MAND-2026-APEX-01' },
    }),
  });
  assert.equal(approveRes.status, 200);

  // Verify terminal won commercial stage
  const { rows: finalLeadCheck } = await db.query(`SELECT stage FROM leads WHERE id = $1`, [publishedLeadId]);
  assert.equal(finalLeadCheck[0].stage, 'disbursal', 'Approved banking lead must transition to disbursal');

  // Step 5: Cross-Vertical Isolation: Wealth Team Lead Tara Iyer cannot see Banking lead
  const taraCookie = await loginAs('tara@finverse.demo');
  const taraCrossRes = await fetch(`${base}/api/leads/${publishedLeadId}`, { headers: { Cookie: taraCookie } });
  assert.equal(taraCrossRes.status, 404, 'Wealth TL must receive 404 for Banking lead');

  console.log('PASS Banking Intake -> TL Allocation -> Caller Commercial Disbursal: Verified End-to-End lifecycle');
});

test('Banking Manager MG-01..13: Commercial Banking supervisory oversight, cross-team transfer, capacity, targets, forecasts, DoA limits, and review pack', async () => {
  // Login as Kunal Shah (EMP-017, Commercial Banking Manager)
  const kunalCookie = await loginAs('kunal@finverse.demo');
  const devCookie = await loginAs('dev@finverse.demo');
  const rohanCookie = await loginAs('rohan@finverse.demo');

  // Verify Role Gate: Frontline caller Dev and TL Rohan cannot access Manager routes (403 Forbidden)
  const devDenied = await fetch(`${base}/api/manager/overview`, { headers: { Cookie: devCookie } });
  assert.equal(devDenied.status, 403, 'Frontline caller must be denied Manager access');

  const rohanDenied = await fetch(`${base}/api/manager/overview`, { headers: { Cookie: rohanCookie } });
  assert.equal(rohanDenied.status, 403, 'Team Lead must be denied Manager access');

  // MG-01: Overview & Rollup Metrics across Banking Teams
  const ovRes = await fetch(`${base}/api/manager/overview?period=month-to-date`, { headers: { Cookie: kunalCookie } });
  assert.equal(ovRes.status, 200, 'Banking Manager overview must return 200');
  const ovData = (await ovRes.json()) as any;
  assert.equal(ovData.manager.id, 'EMP-017', 'Must resolve Kunal Shah');
  assert.ok(ovData.teams.some((t: any) => t.id === 'TEAM-BANKING-ALPHA'), 'Must include Banking Alpha');
  assert.ok(ovData.teams.some((t: any) => t.id === 'TEAM-BANKING-BETA'), 'Must include Banking Beta');
  assert.ok(ovData.tlBreakdown.some((t: any) => t.tlEmployeeId === 'EMP-016'), 'Must include TL Rohan Sen');
  assert.ok(ovData.tlBreakdown.some((t: any) => t.tlEmployeeId === 'EMP-018'), 'Must include TL Priya Sen');
  assert.ok(ovData.kpis.some((k: any) => k.key === 'wins-target'), 'KPI must include wins-target');
  assert.ok(ovData.kpis.some((k: any) => k.key === 'open-pipeline'), 'KPI must include active backlog');

  // MG-02: TL Operating Scorecard & Management Action Intervention
  const scRes = await fetch(`${base}/api/manager/scorecard/EMP-016?period=October`, { headers: { Cookie: kunalCookie } });
  assert.equal(scRes.status, 200);
  const scData = (await scRes.json()) as any;
  assert.equal(scData.tl.id, 'EMP-016');

  const actRes = await fetch(`${base}/api/manager/actions`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subjectTlEmployeeId: 'EMP-016',
      ownerEmployeeId: 'EMP-017',
      sourceAction: 'MG-02',
      kind: 'coaching',
      title: 'Commercial Credit Risk Assessment Coaching',
      detail: 'Review corporate credit memo guidelines and sanction criteria',
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      metricKey: 'wins-target',
      periodLabel: 'October',
      teamId: 'TEAM-BANKING-ALPHA',
    }),
  });
  assert.equal(actRes.status, 201);

  // MG-03: Cross-Team Lead Transfer (Banking Beta -> Banking Alpha)
  const trRes = await fetch(`${base}/api/manager/transfers`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceTeamId: 'TEAM-BANKING-BETA',
      destinationTeamId: 'TEAM-BANKING-ALPHA',
      leadIds: ['FV-2003'],
      reason: 'Corporate account consolidated under Banking Alpha branch coverage',
    }),
  });
  assert.equal(trRes.status, 201);
  const trData = (await trRes.json()) as any;

  const decideTrRes = await fetch(`${base}/api/manager/transfers/decide`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transferId: trData.id,
      decision: 'approved',
      resolutionNotes: 'Approved commercial branch reallocation',
    }),
  });
  assert.equal(decideTrRes.status, 200);

  const { rows: trLeadCheck } = await db.query(`SELECT team_id FROM leads WHERE id = 'FV-2003'`);
  assert.equal(trLeadCheck[0].team_id, 'TEAM-BANKING-ALPHA', 'Lead must be reallocated to Banking Alpha');

  // MG-04: Capacity Recovery Planning
  const capRes = await fetch(`${base}/api/manager/capacity`, { headers: { Cookie: kunalCookie } });
  assert.equal(capRes.status, 200);
  const capData = (await capRes.json()) as any;
  assert.ok(capData.teams.length >= 2, 'Capacity analysis must cover multiple banking teams');

  const planRes = await fetch(`${base}/api/manager/capacity/plan`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Commercial Banking Q4 Capacity Recovery Plan',
      periodLabel: 'Q4-2026',
      teamIds: ['TEAM-BANKING-ALPHA', 'TEAM-BANKING-BETA'],
      currentBacklog: 2,
      availableCallers: 2,
      requiredAdditionalStaff: 2,
      operationalDeadline: new Date(Date.now() + 86400000 * 14).toISOString(),
      notes: 'Expand corporate loan processing and underwriting capacity',
      approved: true,
    }),
  });
  assert.equal(planRes.status, 201);

  // MG-05: Target Cascade & Allocation to TLs
  const tgRes = await fetch(`${base}/api/manager/targets/allocate`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'Q4-2026',
      metric: 'approved-wins',
      approvedParentTarget: 50,
      tlAllocations: [
        { teamId: 'TEAM-BANKING-ALPHA', tlEmployeeId: 'EMP-016', allocatedValue: 25 },
        { teamId: 'TEAM-BANKING-BETA', tlEmployeeId: 'EMP-018', allocatedValue: 20 },
      ],
      publish: true,
    }),
  });
  assert.equal(tgRes.status, 200);

  // Over-allocation must be rejected (422)
  const overTgRes = await fetch(`${base}/api/manager/targets/allocate`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'Q4-2026',
      metric: 'approved-wins',
      approvedParentTarget: 50,
      tlAllocations: [
        { teamId: 'TEAM-BANKING-ALPHA', tlEmployeeId: 'EMP-016', allocatedValue: 35 },
        { teamId: 'TEAM-BANKING-BETA', tlEmployeeId: 'EMP-018', allocatedValue: 25 },
      ],
      publish: true,
    }),
  });
  assert.equal(overTgRes.status, 422, 'Over-allocation must fail validation');

  // MG-06: TL Forecast Review & Challenge/Acceptance
  const fcstId = `FCST-BK-${Date.now().toString(36)}`;
  await db.query(
    `INSERT INTO team_forecasts (id, team_id, period_label, category, expected_revenue, currency, actor_employee_id, status, submitted_at)
     VALUES ($1, 'TEAM-BANKING-ALPHA', 'October', 'commit', 15000000, 'INR', 'EMP-016', 'submitted', now())`,
    [fcstId]
  );

  const decideFcstRes = await fetch(`${base}/api/manager/forecasts/decide`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      forecastId: fcstId,
      decision: 'accepted',
      feedback: 'Commercial loan pipeline forecast reviewed and accepted.',
    }),
  });
  assert.equal(decideFcstRes.status, 200);

  // MG-07: Manager Forecast Submission to RM
  const mgFcstRes = await fetch(`${base}/api/manager/forecasts/submit`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      bottomUpRevenue: 15000000,
      managementAdjustment: 2000000,
      adjustedRevenue: 17000000,
      currency: 'INR',
      acceptedForecastIds: [fcstId],
      overrideReason: 'Conservative adjustment for syndicated debt closings',
      riskNotes: 'Sanction turnaround dependency on audited financials',
    }),
  });
  assert.equal(mgFcstRes.status, 201);

  // MG-08: Resolve Repeated SLA Failure
  const taskId = `TSK-BK-${Date.now().toString(36)}`;
  await db.query(
    `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status, created_at)
     VALUES ($1, 'FV-2003', 'EMP-004', 'voice-call', 'Corporate credit memo consultation', now() - interval '2 days', 'high', 'open', now())
     ON CONFLICT (id) DO NOTHING`,
    [taskId]
  );

  const escId = `ESC-BK-${Date.now().toString(36)}`;
  await db.query(
    `INSERT INTO overdue_escalations (id, task_id, lead_id, subject_employee_id, actor_employee_id, action, reason, severity, manager_notified, created_at)
     VALUES ($1, $2, 'FV-2003', 'EMP-004', 'EMP-016', 'escalate', 'Repeated SLA delay on corporate credit memo', 'high', true, now())`,
    [escId, taskId]
  );

  const resSlaRes = await fetch(`${base}/api/manager/sla-breaches/resolve`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      escalationId: escId,
      actionType: 'corrective-action',
      resolutionPlan: 'Assigned dedicated credit analyst to follow up directly',
      deadlineHours: 48,
    }),
  });
  assert.equal(resSlaRes.status, 200);

  // MG-09: Delegated Commercial Exception & DoA Enforcement
  // 1. Custom contract terms require legal/executive authority (403 Forbidden [Deck P152])
  const exc1Id = `EXC-CT-${Date.now().toString(36)}`;
  await db.query(
    `INSERT INTO commercial_exceptions (id, lead_id, requested_by_employee_id, exception_type, requested_terms, standard_terms, business_justification, delegated_limit_met, status)
     VALUES ($1, 'FV-2003', 'EMP-004', 'custom-terms', 'Custom 10-year facility tenure', 'Standard 5-year facility tenure', 'Special infrastructure concession', true, 'pending')`,
    [exc1Id]
  );
  const exc1Res = await fetch(`${base}/api/manager/commercial-exceptions/decide`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exceptionId: exc1Id,
      decision: 'approved',
      decisionNotes: 'Attempted branch approval of custom contract terms',
    }),
  });
  assert.equal(exc1Res.status, 403, 'Branch Manager cannot approve custom terms [Deck P152]');

  // 2. Exception exceeding delegated limit cannot be approved by Manager (403 Forbidden [Deck P152, Deck P320 Cat 3])
  const exc2Id = `EXC-BREACH-${Date.now().toString(36)}`;
  await db.query(
    `INSERT INTO commercial_exceptions (id, lead_id, requested_by_employee_id, exception_type, requested_terms, standard_terms, business_justification, delegated_limit_met, status)
     VALUES ($1, 'FV-2003', 'EMP-004', 'fee-waiver', '100% processing fee waiver (INR 500,000)', 'Standard fee INR 500,000', 'Enterprise concession over limit', false, 'pending')`,
    [exc2Id]
  );
  const exc2Res = await fetch(`${base}/api/manager/commercial-exceptions/decide`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
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
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exceptionId: exc2Id,
      decision: 'escalated_to_rm',
      decisionNotes: 'Escalated to Regional Manager per DoA matrix',
    }),
  });
  assert.equal(escExcRes.status, 200, 'Escalation to RM must succeed');

  // 3. Exception within delegated limit approved within active DoA policy
  const exc3Id = `EXC-OK-${Date.now().toString(36)}`;
  await db.query(
    `INSERT INTO commercial_exceptions (id, lead_id, requested_by_employee_id, exception_type, requested_terms, standard_terms, business_justification, delegated_limit_met, status)
     VALUES ($1, 'FV-2003', 'EMP-004', 'fee-waiver', '10% processing fee discount (INR 25,000)', 'Standard fee INR 25,000', 'Discretionary concession within branch limit', true, 'pending')`,
    [exc3Id]
  );
  const exc3Res = await fetch(`${base}/api/manager/commercial-exceptions/decide`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exceptionId: exc3Id,
      decision: 'approved',
      decisionNotes: 'Discretionary processing fee concession within authorized DoA limit',
    }),
  });
  assert.equal(exc3Res.status, 200, 'Within-limit exception must be approved');

  // Atomic state lock: Repeated decision on finalized exception must be rejected (400)
  const repeatExcRes = await fetch(`${base}/api/manager/commercial-exceptions/decide`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
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
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceName: 'Branch Intake',
      cohortPeriod: 'Q3-2026',
      sampleSize: 20,
      invalidIntakeCount: 3,
      contactFailedCount: 2,
      commercialLossCount: 1,
      remediationType: 'intake-correction',
      justification: 'Require digital GSTIN verification on corporate enquiry intake',
    }),
  });
  assert.equal(remRes.status, 201);

  // MG-11: Structured TL Performance Review
  const revRes = await fetch(`${base}/api/manager/reviews`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subjectTlEmployeeId: 'EMP-016',
      periodLabel: 'Q3-2026',
      strengths: 'Excellent leadership in commercial credit pipeline progression',
      blockers: 'Disbursal turnaround delayed by legal and valuation searches',
      commitments: [{ dimension: 'Pipeline Velocity', goal: 'Maintain 95% SLA adherence on proposals', targetDate: '2026-11-30' }],
    }),
  });
  assert.equal(revRes.status, 201);

  // MG-12: Employee Lifecycle Request (Promotion Request)
  const lcRes = await fetch(`${base}/api/manager/lifecycle`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employeeId: 'EMP-004',
      proposedRole: 'TL',
      effectiveDate: '2026-12-01',
      businessJustification: 'Consistent high performer in corporate loan origination; ready for team leadership',
      handoffPlan: 'Account reallocations to incoming commercial callers over 2 weeks',
    }),
  });
  assert.equal(lcRes.status, 201);

  // MG-13: Manager Review Pack Binary Streaming PDF
  const exportRes = await fetch(`${base}/api/manager/meeting-pack/export`, {
    method: 'POST',
    headers: { Cookie: kunalCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ period: 'month-to-date' }),
  });
  assert.equal(exportRes.status, 201);
  const exportData = (await exportRes.json()) as any;
  assert.ok(exportData.id);

  const packRes = await fetch(`${base}/api/manager/meeting-pack/download/${exportData.id}`, {
    headers: { Cookie: kunalCookie },
  });
  assert.equal(packRes.status, 200);
  assert.equal(packRes.headers.get('content-type'), 'application/pdf');
  const pdfBytes = Buffer.from(await packRes.arrayBuffer());
  assert.ok(pdfBytes.subarray(0, 4).toString().startsWith('%PDF'), 'Streamed meeting pack must be valid binary %PDF');

  console.log('PASS Banking Manager MG-01..13: Commercial Banking supervisory oversight, cross-team transfer, capacity, targets, forecasts, DoA limits, and review pack');
});

test('Banking Regional Manager RM-01..10: Commercial Banking regional governance, manager scorecards, territory planning, target cascade, cross-manager transfers, staffing requisitions, forecast rollup, escalations, manager reviews, and PDF review pack', async () => {
  // Login as Arjun Mehta (EMP-019, Commercial Banking Regional Manager)
  const arjunCookie = await loginAs('arjun@finverse.demo');
  const kunalCookie = await loginAs('kunal@finverse.demo');
  const rohanCookie = await loginAs('rohan@finverse.demo');
  const devCookie = await loginAs('dev@finverse.demo');

  // Verify Role Gate: Frontline caller Dev, TL Rohan, and Manager Kunal cannot access Regional Manager routes (403 Forbidden)
  const devDenied = await fetch(`${base}/api/regional/overview`, { headers: { Cookie: devCookie } });
  assert.equal(devDenied.status, 403, 'Frontline caller must be denied Regional Manager access');

  const rohanDenied = await fetch(`${base}/api/regional/overview`, { headers: { Cookie: rohanCookie } });
  assert.equal(rohanDenied.status, 403, 'Team Lead must be denied Regional Manager access');

  const kunalDenied = await fetch(`${base}/api/regional/overview`, { headers: { Cookie: kunalCookie } });
  assert.equal(kunalDenied.status, 403, 'Branch Manager must be denied Regional Manager access');

  // Verify RM Session Resolution
  const meRes = await fetch(`${base}/api/auth/me`, { headers: { Cookie: arjunCookie } });
  assert.equal(meRes.status, 200);
  const { session } = (await meRes.json()) as any;
  assert.equal(session.employeeId, 'EMP-019', 'Must resolve Arjun Mehta');
  assert.equal(session.role, 'RM');
  assert.deepEqual(session.verticalGrants, ['banking']);
  assert.ok(session.teamGrants.includes('TEAM-BANKING-ALPHA'));
  assert.ok(session.teamGrants.includes('TEAM-BANKING-BETA'));

  // RM-01: Regional Overview across Banking West Zone
  const ovRes = await fetch(`${base}/api/regional/overview?period=month-to-date`, { headers: { Cookie: arjunCookie } });
  assert.equal(ovRes.status, 200, 'Banking Regional Manager overview must return 200');
  const ovData = (await ovRes.json()) as any;
  const overview = ovData.data;
  assert.equal(overview.region.id, 'REGION-BANKING-WEST');
  assert.equal(overview.region.vertical, 'banking');
  assert.ok(overview.region.teamsCount >= 2, 'Must cover multiple banking teams');
  assert.ok(overview.managers.some((m: any) => m.managerId === 'EMP-017'), 'Must include Banking Manager Kunal Shah');
  assert.ok(overview.target.parentTarget >= 150, 'Parent NM target must be set');

  // Create regional management intervention for Kunal Shah
  const actRes = await fetch(`${base}/api/regional/actions`, {
    method: 'POST',
    headers: { Cookie: arjunCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceAction: 'RM-01',
      kind: 'regional-intervention',
      subjectManagerEmployeeId: 'EMP-017',
      ownerEmployeeId: 'EMP-019',
      title: 'Commercial Credit Memo Turnaround Acceleration',
      detail: 'Expedite valuation searches and committee approvals for corporate debt facilities over INR 10 Cr',
      dueAt: new Date(Date.now() + 86400000 * 3).toISOString(),
    }),
  });
  assert.equal(actRes.status, 201);

  // RM-02: In-Scope Banking Manager Scorecard (Kunal Shah)
  const scRes = await fetch(`${base}/api/regional/managers/EMP-017/scorecard?period=October`, { headers: { Cookie: arjunCookie } });
  assert.equal(scRes.status, 200);
  const scData = (await scRes.json()) as any;
  const scorecard = scData.data;
  assert.equal(scorecard.manager.id, 'EMP-017');
  assert.ok(scorecard.teamLeads.some((tl: any) => tl.id === 'EMP-016'), 'Must include TL Rohan Sen');
  assert.ok(scorecard.teamLeads.some((tl: any) => tl.id === 'EMP-018'), 'Must include TL Priya Sen');

  // Cross-vertical isolation: Out-of-scope Wealth Manager (Neel Verma, EMP-007) returns 404 Not Found
  const foreignScRes = await fetch(`${base}/api/regional/managers/EMP-007/scorecard?period=October`, { headers: { Cookie: arjunCookie } });
  assert.equal(foreignScRes.status, 404, 'Out-of-scope Wealth manager must return 404');

  // RM-03: Territory Coverage Planning for Commercial Banking Branches
  const terrRes = await fetch(`${base}/api/regional/territories`, { headers: { Cookie: arjunCookie } });
  assert.equal(terrRes.status, 200);
  const terrData = (await terrRes.json()) as any;
  assert.ok(terrData.data.subRegions.some((s: string) => s.includes('Mumbai') || s.includes('Commercial') || s.includes('Industrial')));

  const saveTerrRes = await fetch(`${base}/api/regional/territories`, {
    method: 'POST',
    headers: { Cookie: arjunCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      territoryName: 'Western Industrial Commercial Corridor',
      subRegion: 'Mumbai Commercial Hub',
      productScope: 'Corporate Term Loan, Working Capital Facility, Trade Finance & Escrow',
      languageQueues: ['English', 'Hindi', 'Gujarati', 'Marathi'],
      targetTeamIds: ['TEAM-BANKING-ALPHA', 'TEAM-BANKING-BETA'],
      capacityGap: 3,
      routingProposal: 'Route syndication and escrow inquiries to Banking Alpha; working capital facilities to Beta',
      activationDate: '2026-11-01',
      status: 'activated',
    }),
  });
  assert.equal(saveTerrRes.status, 201);

  // RM-04: Regional Target Cascade & Non-Over-Allocation Enforcement
  const tgRes = await fetch(`${base}/api/regional/targets`, { headers: { Cookie: arjunCookie } });
  assert.equal(tgRes.status, 200);
  const tgData = (await tgRes.json()) as any;
  assert.ok(tgData.data.activeTarget.approvedNmTarget >= 150);

  // Valid allocation: 100 wins allocated to Kunal Shah from 150 parent target
  const allocTgRes = await fetch(`${base}/api/regional/targets/allocate`, {
    method: 'POST',
    headers: { Cookie: arjunCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      metric: 'approved-wins',
      approvedNmTarget: 150,
      managerAllocations: [
        { managerEmployeeId: 'EMP-017', targetWins: 100 },
      ],
      publish: true,
    }),
  });
  assert.equal(allocTgRes.status, 201);

  // Over-allocation check: Allocating 200 wins when parent target is 150 must be rejected (400 Bad Request)
  const overAllocRes = await fetch(`${base}/api/regional/targets/allocate`, {
    method: 'POST',
    headers: { Cookie: arjunCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      metric: 'approved-wins',
      approvedNmTarget: 150,
      managerAllocations: [
        { managerEmployeeId: 'EMP-017', targetWins: 200 },
      ],
      publish: true,
    }),
  });
  assert.equal(overAllocRes.status, 400, 'Over-allocation exceeding parent NM target must be rejected');

  // RM-05: Cross-Manager Commercial Lead Transfer & Decision
  const xferLeadId = `${RUN_PREFIX}-RM-XFER`;
  await db.query(
    `INSERT INTO leads (id, vertical, display_name, phone, preferred_language, product, source, stage, team_id)
     VALUES ($1, 'banking', 'Zenith Infrastructure Pvt Ltd', '+91 98765 99088', 'en', 'Corporate Term Loan', 'Branch Intake', 'documents', 'TEAM-BANKING-BETA')`,
    [xferLeadId]
  );

  const xferRes = await fetch(`${base}/api/regional/transfers`, {
    method: 'POST',
    headers: { Cookie: arjunCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceManagerEmployeeId: 'EMP-017',
      destinationManagerEmployeeId: 'EMP-017',
      sourceTeamId: 'TEAM-BANKING-BETA',
      destinationTeamId: 'TEAM-BANKING-ALPHA',
      leadIds: [xferLeadId],
      reason: 'Regional balance reallocation of infrastructure credit facility to corporate branch',
      forecastImpactNotes: 'Expected disbursal Q4 2026',
    }),
  });
  assert.equal(xferRes.status, 201);
  const xferData = (await xferRes.json()) as any;
  const transferId = xferData.data.id;

  // Decide transfer with approval
  const decideXferRes = await fetch(`${base}/api/regional/transfers/decide`, {
    method: 'POST',
    headers: { Cookie: arjunCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transferId,
      decision: 'approved',
      resolutionNotes: 'Approved commercial cross-branch rebalancing under Regional Manager authority',
    }),
  });
  assert.equal(decideXferRes.status, 200);

  // Verify lead's team in database is updated to Banking Alpha and lead_events audit logged
  const { rows: movedLeadCheck } = await db.query(`SELECT team_id FROM leads WHERE id = $1`, [xferLeadId]);
  assert.equal(movedLeadCheck[0].team_id, 'TEAM-BANKING-ALPHA');

  // Unauthorized team transfer: source team outside regional scope (Wealth Alpha) must be rejected (403)
  const unauthXferRes = await fetch(`${base}/api/regional/transfers`, {
    method: 'POST',
    headers: { Cookie: arjunCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceManagerEmployeeId: 'EMP-007',
      destinationManagerEmployeeId: 'EMP-017',
      sourceTeamId: 'TEAM-WEALTH-ALPHA',
      destinationTeamId: 'TEAM-BANKING-ALPHA',
      leadIds: ['FV-1001'],
      reason: 'Illegal cross-vertical unauthorized transfer attempt',
    }),
  });
  assert.equal(unauthXferRes.status, 403, 'Foreign team transfer must be rejected');

  // RM-06: Regional Staffing Envelope & Requisition Submission to HR
  const staffRes = await fetch(`${base}/api/regional/staffing`, { headers: { Cookie: arjunCookie } });
  assert.equal(staffRes.status, 200);

  const planStaffRes = await fetch(`${base}/api/regional/staffing`, {
    method: 'POST',
    headers: { Cookie: arjunCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'Q4-2026',
      plannedHeadcount: 10,
      approvedHeadcount: 8,
      activeHeadcount: 6,
      requisitions: [
        { title: 'Commercial Relationship Manager', teamId: 'TEAM-BANKING-ALPHA', count: 2, justification: 'Commercial loan desk expansion', priority: 'high' },
      ],
      businessJustification: 'Support 40% growth in corporate term loan origination across Mumbai industrial corridor',
      status: 'submitted_to_hr',
    }),
  });
  assert.equal(planStaffRes.status, 201);

  // RM-07: Regional Forecast Rollup & Submission to NM
  const mFcstId = `MFCST-BK-${Date.now().toString(36)}`;
  await db.query(
    `INSERT INTO manager_forecasts (id, manager_employee_id, period_label, bottom_up_revenue, management_adjustment, adjusted_revenue, currency, status, accepted_forecast_ids, submitted_at)
     VALUES ($1, 'EMP-017', 'October', 20000000, 2000000, 22000000, 'INR', 'submitted_to_rm', '[]', now())`,
    [mFcstId]
  );

  const fcstRollupRes = await fetch(`${base}/api/regional/forecasts?period=October`, { headers: { Cookie: arjunCookie } });
  assert.equal(fcstRollupRes.status, 200);

  const submitFcstRes = await fetch(`${base}/api/regional/forecasts/submit`, {
    method: 'POST',
    headers: { Cookie: arjunCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      regionalAdjustment: 5000000,
      acceptedManagerForecastIds: [mFcstId],
      topRegionalRisks: [{ title: 'Audited balance sheet delays', severity: 'medium', impact: 'Turnaround delay' }],
      regionalAssumptions: 'Anticipated 2 major syndicated debt facility sanctions by end of October',
      submitToNm: true,
    }),
  });
  assert.equal(submitFcstRes.status, 201);

  // RM-08: Regional Escalations & Exceptions Management
  const escListRes = await fetch(`${base}/api/regional/escalations`, { headers: { Cookie: arjunCookie } });
  assert.equal(escListRes.status, 200);

  const createEscRes = await fetch(`${base}/api/regional/escalations`, {
    method: 'POST',
    headers: { Cookie: arjunCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceType: 'operational_risk',
      title: 'Collateral Valuation Search Delay in West Hub',
      severity: 'high',
      accountableManagerEmployeeId: 'EMP-017',
      detail: 'External panel valuer backlogs causing SLA breaches on 3 commercial term loan applications',
      deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert.equal(createEscRes.status, 201);
  const createEscData = (await createEscRes.json()) as any;
  const escId = createEscData.data.id;

  const resolveEscRes = await fetch(`${base}/api/regional/escalations/resolve`, {
    method: 'POST',
    headers: { Cookie: arjunCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      escalationId: escId,
      decision: 'resolved',
      recoveryDecision: 'Appointed secondary valuation panel and cleared backlogged reports within 24h',
    }),
  });
  assert.equal(resolveEscRes.status, 200);

  // RM-09: Structured Manager Performance Review
  const saveRevRes = await fetch(`${base}/api/regional/reviews`, {
    method: 'POST',
    headers: { Cookie: arjunCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      managerEmployeeId: 'EMP-017',
      periodLabel: 'Q3-2026',
      performanceRating: 'exceeding',
      strengths: 'Outstanding loan pipeline origination and risk assessment rigor across Banking Alpha & Beta',
      blockers: 'Valuation and legal search turnaround bottlenecks on high-ticket loans',
      improvementCommitments: ['Reduce average proposal-to-sanction duration from 14d to 9d'],
      supportActions: 'Authorize expedited valuation search panel access and corporate legal desk support',
      privateRmNotes: 'Strong leadership candidate for National Commercial Credit head',
      nextReviewDate: '2026-12-30',
      acknowledged: true,
    }),
  });
  assert.equal(saveRevRes.status, 201);

  // Non-manager or foreign-manager review rejection (403)
  const invalidRevRes = await fetch(`${base}/api/regional/reviews`, {
    method: 'POST',
    headers: { Cookie: arjunCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      managerEmployeeId: 'EMP-007', // Neel Verma (Wealth Manager, out of Banking scope)
      periodLabel: 'Q3-2026',
      performanceRating: 'achieving',
      strengths: 'Good wealth sales',
      blockers: 'No blockers identified',
      improvementCommitments: ['Maintain pace'],
      nextReviewDate: '2026-12-30',
      acknowledged: true,
    }),
  });
  assert.equal(invalidRevRes.status, 403, 'Reviewing an out-of-scope manager must be rejected');

  // RM-10: Audited Binary PDF Review Pack & Report Schedules
  const prevReportRes = await fetch(`${base}/api/regional/reports/preview?period=October+2026`, { headers: { Cookie: arjunCookie } });
  assert.equal(prevReportRes.status, 200);
  const prevReportData = (await prevReportRes.json()) as any;
  assert.ok(prevReportData.data.title.includes('Regional'));
  assert.equal(prevReportData.data.scope.vertical, 'banking');

  // Generate binary PDF
  const genPdfRes = await fetch(`${base}/api/regional/reports/generate-pdf`, {
    method: 'POST',
    headers: { Cookie: arjunCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ period: 'October 2026', sections: ['overview', 'managers', 'targets', 'forecast', 'risks'] }),
  });
  assert.equal(genPdfRes.status, 200);
  const genPdfData = (await genPdfRes.json()) as any;
  assert.ok(genPdfData.data.downloadUrl);

  // Download stream & binary %PDF validation
  const dlRes = await fetch(`${base}${genPdfData.data.downloadUrl}`, { headers: { Cookie: arjunCookie } });
  assert.equal(dlRes.status, 200);
  assert.equal(dlRes.headers.get('content-type'), 'application/pdf');
  const dlBytes = Buffer.from(await dlRes.arrayBuffer());
  assert.ok(dlBytes.subarray(0, 4).toString().startsWith('%PDF'), 'Downloaded review pack must be valid binary %PDF');

  // Save recurring report schedule
  const saveSchedRes = await fetch(`${base}/api/regional/reports/schedules`, {
    method: 'POST',
    headers: { Cookie: arjunCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Commercial Banking West Zone Weekly Executive Cadence',
      periodType: 'weekly',
      cadence: 'Monday 08:30 IST',
      recipients: ['arjun@finverse.demo', 'kunal@finverse.demo'],
      sections: ['overview', 'managers', 'targets', 'forecast', 'risks'],
      status: 'active',
    }),
  });
  assert.equal(saveSchedRes.status, 201);

  console.log('PASS Banking Regional Manager RM-01..10: Commercial Banking regional governance, manager scorecards, territory planning, target cascade, cross-manager transfers, staffing requisitions, forecast rollup, escalations, manager reviews, and PDF review pack verified');
});

test('Banking National Manager NM-01..11: Commercial Banking national overview, division benchmarking, target cascade, product economics, pipeline rules, forecast rollup, cross-region transfers, cross-vertical referral intake, executive escalations, RM reviews, and board pack', async () => {
  // 1. Role-Gate Security Check: Non-NM callers/managers/RMs are strictly forbidden from NM workspace
  const devCookie = await loginAs('dev@finverse.demo');     // SC
  const kunalCookie = await loginAs('kunal@finverse.demo'); // MG
  const arjunCookie = await loginAs('arjun@finverse.demo'); // RM

  const scDenied = await fetch(`${base}/api/national/overview`, { headers: { Cookie: devCookie } });
  assert.equal(scDenied.status, 403, 'Frontline SC must receive 403 on national endpoints');

  const mgDenied = await fetch(`${base}/api/national/overview`, { headers: { Cookie: kunalCookie } });
  assert.equal(mgDenied.status, 403, 'Manager must receive 403 on national endpoints');

  const rmDenied = await fetch(`${base}/api/national/overview`, { headers: { Cookie: arjunCookie } });
  assert.equal(rmDenied.status, 403, 'Regional Manager must receive 403 on national endpoints');

  // Authenticate as Banking National Manager Suresh Nair (EMP-020)
  const sureshCookie = await loginAs('suresh@finverse.demo');
  assert.ok(sureshCookie, 'Suresh Nair must log in successfully with valid session');

  // 2. Scope inspection: Returns banking vertical scope, regions, teams, and headcounts
  const scopeRes = await fetch(`${base}/api/national/scope`, { headers: { Cookie: sureshCookie } });
  assert.equal(scopeRes.status, 200);
  const scopeData = (await scopeRes.json()) as any;
  assert.equal(scopeData.data.vertical, 'banking');
  assert.ok(scopeData.data.regions.some((r: any) => r.id === 'REGION-BANKING-WEST'));
  assert.ok(scopeData.data.regions.some((r: any) => r.id === 'REGION-BANKING-NORTH'));
  assert.ok(scopeData.data.headcounts.rms >= 1);
  assert.ok(scopeData.data.headcounts.totalFte >= 1);

  // NM-01: National Overview & Directive Issuance
  const overviewRes = await fetch(`${base}/api/national/overview?period=month-to-date`, { headers: { Cookie: sureshCookie } });
  assert.equal(overviewRes.status, 200);
  const overviewData = (await overviewRes.json()) as any;
  assert.equal(overviewData.data.scope.vertical, 'banking');
  assert.ok(typeof overviewData.data.kpis.approvedCeoTarget === 'number');
  assert.ok(Array.isArray(overviewData.data.regionalPerformance));

  // Create national directive to RM (Arjun Mehta)
  const actionRes = await fetch(`${base}/api/national/actions`, {
    method: 'POST',
    headers: { Cookie: sureshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceAction: 'NM-01',
      kind: 'regional-directive',
      subjectRmEmployeeId: 'EMP-019',
      ownerEmployeeId: 'EMP-020',
      regionId: 'REGION-BANKING-WEST',
      metricKey: 'disbursal-volume',
      periodLabel: 'October',
      title: 'Accelerate Working Capital Credit Committee Clearances',
      detail: 'Expedite credit appraisal and sanction documentation for BBB+ commercial exporter cluster in Gujarat industrial zone.',
      dueAt: new Date(Date.now() + 86400000 * 3).toISOString(),
    }),
  });
  assert.equal(actionRes.status, 201);
  const actionData = (await actionRes.json()) as any;
  const actionId = actionData.data.id;
  assert.ok(actionId);

  // List actions
  const listActionsRes = await fetch(`${base}/api/national/actions?status=open`, { headers: { Cookie: sureshCookie } });
  assert.equal(listActionsRes.status, 200);
  const listActionsData = (await listActionsRes.json()) as any;
  assert.ok(listActionsData.data.some((a: any) => a.id === actionId));

  // Complete action
  const completeActRes = await fetch(`${base}/api/national/actions/${actionId}/complete`, {
    method: 'POST',
    headers: { Cookie: sureshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(completeActRes.status, 200);

  // NM-02: Regional Scorecards & Benchmark Comparisons
  const compRes = await fetch(`${base}/api/national/comparisons?period=September`, { headers: { Cookie: sureshCookie } });
  assert.equal(compRes.status, 200);
  const compData = (await compRes.json()) as any;
  assert.ok(compData.data.regions.length >= 2, 'Must compare at least West and North banking zones');
  const westComp = compData.data.regions.find((r: any) => r.regionId === 'REGION-BANKING-WEST');
  assert.ok(westComp);
  assert.equal(westComp.regionalManager?.id, 'EMP-019');

  // NM-03: National Plan & Target Cascade
  const targetRes = await fetch(`${base}/api/national/target?period=October`, { headers: { Cookie: sureshCookie } });
  assert.equal(targetRes.status, 200);
  const targetData = (await targetRes.json()) as any;
  assert.equal(targetData.data.approvedCeoTarget, 300);

  // Over-allocation guard (400 validation failed)
  const overAllocRes = await fetch(`${base}/api/national/target/allocate`, {
    method: 'POST',
    headers: { Cookie: sureshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      approvedCeoTarget: 300,
      regionalAllocations: [
        { regionId: 'REGION-BANKING-WEST', targetWins: 220, rmEmployeeId: 'EMP-019' },
        { regionId: 'REGION-BANKING-NORTH', targetWins: 120, rmEmployeeId: 'EMP-019' },
      ],
      publish: true,
    }),
  });
  assert.equal(overAllocRes.status, 400, 'Over-allocating beyond approved CEO target (340 > 300) must be rejected');

  // Valid cascade to regions
  const validAllocRes = await fetch(`${base}/api/national/target/allocate`, {
    method: 'POST',
    headers: { Cookie: sureshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      approvedCeoTarget: 300,
      regionalAllocations: [
        { regionId: 'REGION-BANKING-WEST', targetWins: 180, rmEmployeeId: 'EMP-019' },
        { regionId: 'REGION-BANKING-NORTH', targetWins: 120, rmEmployeeId: 'EMP-019' },
      ],
      publish: true,
    }),
  });
  assert.equal(validAllocRes.status, 200);

  // Cross-check cascaded regional target in DB
  const { rows: rtRows } = await db.query(
    `SELECT approved_nm_target, status FROM regional_targets WHERE region_id = 'REGION-BANKING-WEST' AND period_label = 'October'`
  );
  assert.equal(Number(rtRows[0].approved_nm_target), 180);
  assert.equal(rtRows[0].status, 'published');

  // NM-04: National Economics & Unit Capacity Analysis
  const econRes = await fetch(`${base}/api/national/economics?period=month-to-date`, { headers: { Cookie: sureshCookie } });
  assert.equal(econRes.status, 200);
  const econData = (await econRes.json()) as any;
  assert.ok(econData.data.economics.productEconomics.some((p: any) => p.product.includes('Term Loan') || p.product.includes('Current Account')));
  assert.ok(econData.data.economics.channelEconomics.some((c: any) => c.channel.includes('Corporate') || c.channel.includes('Branch')));
  assert.ok(econData.data.economics.unitCapacityGapFte >= 0);

  // NM-05: Product & Pipeline Rule Proposals
  const rulesListRes = await fetch(`${base}/api/national/product-rules`, { headers: { Cookie: sureshCookie } });
  assert.equal(rulesListRes.status, 200);
  const rulesListData = (await rulesListRes.json()) as any;
  assert.ok(rulesListData.data.some((r: any) => r.id === 'PRP-BNK-001'));

  const createRuleRes = await fetch(`${base}/api/national/product-rules`, {
    method: 'POST',
    headers: { Cookie: sureshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ruleName: 'Commercial Loan Security Valuation Re-Check SLA',
      currentVersion: '1.0',
      proposedVersion: '1.5',
      reason: 'Mandate digital legal and title search verification before issuing formal credit sanction letter',
      effectiveDate: '2026-11-15',
      affectedProducts: ['V1 Commercial Term Loan'],
      previewImpact: 'Safeguards 60 Cr in Q4 sanction pipeline while maintaining 48h turnaround',
    }),
  });
  assert.equal(createRuleRes.status, 201);

  // NM-06: National Forecast Consolidation & Executive Submission
  const fcstRollupRes = await fetch(`${base}/api/national/forecast/rollup?period=October`, { headers: { Cookie: sureshCookie } });
  assert.equal(fcstRollupRes.status, 200);
  const fcstRollupData = (await fcstRollupRes.json()) as any;
  assert.ok(fcstRollupData.data.bottomUpSum > 0);

  const submitNatFcstRes = await fetch(`${base}/api/national/forecast/submit`, {
    method: 'POST',
    headers: { Cookie: sureshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      bottomUpRevenue: fcstRollupData.data.bottomUpSum,
      nationalAdjustment: 3000000,
      currency: 'INR',
      acceptedRegionalForecastIds: fcstRollupData.data.regionalForecasts.map((rf: any) => rf.id),
      topNationalRisks: [
        'Working capital documentation turnaround buffer',
        'North zone corporate onboarding capacity ramp',
      ],
      nationalAssumptions: 'Strong commercial demand across West corridor following port expansion and infrastructure projects',
      submitToExecutives: true,
    }),
  });
  assert.equal(submitNatFcstRes.status, 200);
  const submitNatFcstData = (await submitNatFcstRes.json()) as any;
  assert.equal(submitNatFcstData.data.status, 'submitted_to_executives');

  // NM-07: Cross-Region Work Transfers
  // Create an isolated commercial banking lead in West zone
  const xferLeadId = `FV-BK-XFER-${Date.now().toString().slice(-4)}`;
  await db.query(
    `INSERT INTO leads (id, vertical, team_id, stage, display_name, phone, preferred_language, product, source, created_at, updated_at)
     VALUES ($1, 'banking', 'TEAM-BANKING-ALPHA', 'qualified', 'Zenith Logistics Hub', '+919876543299', 'en', 'V1 Commercial Term Loan', 'Branch Network', now(), now())`,
    [xferLeadId]
  );

  const initXferRes = await fetch(`${base}/api/national/transfers`, {
    method: 'POST',
    headers: { Cookie: sureshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceRegionId: 'REGION-BANKING-WEST',
      destinationRegionId: 'REGION-BANKING-NORTH',
      leadIds: [xferLeadId],
      reason: 'Client corporate operations headquarters shifted from Mumbai to Delhi NCR corridor',
      handoffPlan: 'Transfer relationship coverage to North Commercial Relationship Team',
    }),
  });
  assert.equal(initXferRes.status, 201);
  const initXferData = (await initXferRes.json()) as any;
  const xferId = initXferData.data.id;
  assert.ok(xferId);

  // Approve transfer
  const decideXferRes = await fetch(`${base}/api/national/transfers/${xferId}/decide`, {
    method: 'POST',
    headers: { Cookie: sureshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision: 'approved',
      resolutionNotes: 'Approved relocation transfer to North Commercial desk',
    }),
  });
  assert.equal(decideXferRes.status, 200);

  // Verify lead event recorded
  const { rows: evtRows } = await db.query(`SELECT * FROM lead_events WHERE lead_id = $1 AND kind = 'transfer'`, [xferLeadId]);
  assert.ok(evtRows.length > 0, 'Transfer event must be recorded for transferred lead');

  // NM-08: Cross-Vertical Inbound Referrals
  const refListRes = await fetch(`${base}/api/national/referrals`, { headers: { Cookie: sureshCookie } });
  assert.equal(refListRes.status, 200);
  const refListData = (await refListRes.json()) as any;
  assert.ok(refListData.data.some((r: any) => r.id === 'REF-BNK-001'), 'Baseline Wealth-to-Banking referral REF-BNK-001 must appear');

  // Accept referral into Commercial Banking
  const acceptRefRes = await fetch(`${base}/api/national/referrals/REF-BNK-001/decide`, {
    method: 'POST',
    headers: { Cookie: sureshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision: 'accepted',
      targetTeamId: 'TEAM-BANKING-ALPHA',
      targetOwnerEmployeeId: 'EMP-004',
    }),
  });
  assert.equal(acceptRefRes.status, 200);
  const acceptRefData = (await acceptRefRes.json()) as any;
  assert.equal(acceptRefData.data.decision, 'accepted');
  const receivedLeadId = acceptRefData.data.receivingLeadId;
  assert.ok(receivedLeadId);

  // Verify created lead is in banking vertical assigned to Dev Kapoor
  const { rows: recLeadRows } = await db.query(`SELECT * FROM leads WHERE id = $1`, [receivedLeadId]);
  assert.equal(recLeadRows[0].vertical, 'banking');
  assert.equal(recLeadRows[0].team_id, 'TEAM-BANKING-ALPHA');
  assert.equal(recLeadRows[0].owner_employee_id, 'EMP-004');
  assert.equal(recLeadRows[0].display_name, 'Harsh Vardhan');

  // Clean up referral created entities
  await db.query(`UPDATE cross_vertical_referrals SET receiving_lead_id = NULL WHERE id = 'REF-BNK-001'`);
  await db.query(`DELETE FROM lead_tasks WHERE lead_id = $1`, [receivedLeadId]);
  await db.query(`DELETE FROM lead_events WHERE lead_id = $1`, [receivedLeadId]);
  await db.query(`DELETE FROM leads WHERE id = $1`, [receivedLeadId]);

  // Clean up transfer lead
  await db.query(`DELETE FROM lead_events WHERE lead_id = $1`, [xferLeadId]);
  await db.query(`DELETE FROM leads WHERE id = $1`, [xferLeadId]);

  // NM-09: National Strategic Escalations
  const escListRes = await fetch(`${base}/api/national/escalations`, { headers: { Cookie: sureshCookie } });
  assert.equal(escListRes.status, 200);
  const escListData = (await escListRes.json()) as any;
  assert.ok(escListData.data.some((e: any) => e.id === 'NESC-BNK-001'));

  const createEscRes = await fetch(`${base}/api/national/escalations`, {
    method: 'POST',
    headers: { Cookie: sureshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'strategic_exception',
      targetExecutive: 'BOTH',
      title: 'Consortium Prime Lending Spread Exception for Solar Park EPC',
      detail: 'Joint syndicate financing with SBI and HDFC for 250MW solar farm requires 15 bps spread floor accommodation.',
      evidenceSummary: 'Audited AAA rating from CRISIL and sovereign counterparty power purchase agreement.',
      decisionDeadline: new Date(Date.now() + 86400000 * 4).toISOString(),
    }),
  });
  assert.equal(createEscRes.status, 201);
  const createEscData = (await createEscRes.json()) as any;
  const escId = createEscData.data.id;

  const resolveEscRes = await fetch(`${base}/api/national/escalations/${escId}/resolve`, {
    method: 'POST',
    headers: { Cookie: sureshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executiveDecision: 'Approved jointly by CEO & CFO subject to 100% receivables escrow mechanism.',
    }),
  });
  assert.equal(resolveEscRes.status, 200);

  // NM-10: Regional Manager Reviews
  const saveRmRevRes = await fetch(`${base}/api/national/reviews`, {
    method: 'POST',
    headers: { Cookie: sureshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rmEmployeeId: 'EMP-019',
      periodLabel: 'Q3-2026',
      performanceRating: 'exceeding',
      strengths: 'Outstanding commercial loan pipeline origination and risk governance across West zone',
      blockers: 'Valuation panel backlogs in Gujarat region',
      growthCommitments: ['Scale North Zone corporate team', 'Deliver 180 commercial loan sanctions in Q4'],
      coverageCommitments: ['Commercial West and North zones'],
      supportNeeded: 'Corporate legal and specialized appraisal desk reinforcement',
      privateNmNotes: 'High potential leader recommended for executive credit committee membership',
      nextReviewDate: '2026-12-31',
    }),
  });
  assert.equal(saveRmRevRes.status, 201);

  const getRmRevRes = await fetch(`${base}/api/national/reviews?rmEmployeeId=EMP-019`, { headers: { Cookie: sureshCookie } });
  assert.equal(getRmRevRes.status, 200);
  const getRmRevData = (await getRmRevRes.json()) as any;
  assert.ok(getRmRevData.data.some((r: any) => r.period_label === 'Q3-2026'));

  // NM-11: National Executive Reports & Schedules
  const prevReportRes = await fetch(`${base}/api/national/reports/preview?period=October+2026`, { headers: { Cookie: sureshCookie } });
  assert.equal(prevReportRes.status, 200);
  const prevReportData = (await prevReportRes.json()) as any;
  assert.equal(prevReportData.data.scope.vertical, 'banking');

  // Export PDF pack
  const expPdfRes = await fetch(`${base}/api/national/reports/export-pdf`, {
    method: 'POST',
    headers: { Cookie: sureshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October 2026',
      sections: ['regional-rollup', 'attainment', 'pipeline-health', 'risks'],
    }),
  });
  assert.equal(expPdfRes.status, 200);
  const expPdfData = (await expPdfRes.json()) as any;
  assert.ok(expPdfData.data.downloadUrl);

  // Download PDF binary stream & verify header
  const dlRes = await fetch(`${base}${expPdfData.data.downloadUrl}`, { headers: { Cookie: sureshCookie } });
  assert.equal(dlRes.status, 200);
  assert.equal(dlRes.headers.get('content-type'), 'application/pdf');
  const pdfBytes = Buffer.from(await dlRes.arrayBuffer());
  assert.ok(pdfBytes.length > 1000);
  assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF', 'Board pack must be a valid binary PDF');

  // Save report schedule
  const saveSchedRes = await fetch(`${base}/api/national/reports/schedules`, {
    method: 'POST',
    headers: { Cookie: sureshCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Commercial Banking National Strategy & Performance Cadence',
      periodType: 'monthly',
      cadence: '1st business day, 08:30 IST',
      recipients: ['suresh@finverse.demo', 'arjun@finverse.demo', 'ceo@finverse.demo', 'cfo@finverse.demo'],
      sections: ['attainment', 'regional-scorecards', 'economics'],
      status: 'active',
    }),
  });
  assert.equal(saveSchedRes.status, 200);

  const listSchedRes = await fetch(`${base}/api/national/reports/schedules`, { headers: { Cookie: sureshCookie } });
  assert.equal(listSchedRes.status, 200);
  const listSchedData = (await listSchedRes.json()) as any;
  assert.ok(listSchedData.data.some((s: any) => s.name === 'Commercial Banking National Strategy & Performance Cadence'));

  // 14. Cross-Vertical Isolation: Suresh cannot access Wealth lead records
  const wealthLeadDenied = await fetch(`${base}/api/leads/FV-1001`, { headers: { Cookie: sureshCookie } });
  assert.equal(wealthLeadDenied.status, 404, 'Banking NM must receive 404 on Wealth lead');

  console.log('PASS Banking National Manager NM-01..11: Commercial Banking national overview, division benchmarking, target cascade, product economics, pipeline rules, forecast rollup, cross-region transfers, cross-vertical referral intake, executive escalations, RM reviews, and board pack verified');
});
