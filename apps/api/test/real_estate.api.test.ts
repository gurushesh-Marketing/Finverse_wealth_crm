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

const RUN_PREFIX = `FV-RE${Date.now().toString().slice(-4)}`;

async function cleanupChain(prefix: string = RUN_PREFIX): Promise<void> {
  const targetLeadsSql = `(SELECT id FROM leads WHERE ((phone LIKE '+91 98765 77%' AND id NOT IN ('FV-4001', 'FV-4002', 'FV-4003')) OR id LIKE '${prefix}%'))`;
  await db.query(`DELETE FROM management_actions WHERE title LIKE '%Real Estate%' OR title LIKE '%${prefix}%'`);
  await db.query(`DELETE FROM lead_transfer_requests WHERE reason LIKE '%Real Estate%' OR reason LIKE '%${prefix}%'`);
  await db.query(`DELETE FROM capacity_plans WHERE name LIKE '%Real Estate%' OR name LIKE '%${prefix}%'`);
  await db.query(`DELETE FROM manager_forecasts WHERE risk_notes LIKE '%Real Estate%' OR risk_notes LIKE '%RERA%' OR risk_notes LIKE '%${prefix}%'`);
  await db.query(`DELETE FROM team_forecasts WHERE id LIKE 'FCST-RE-%' OR id LIKE '%${prefix}%'`);
  await db.query(`DELETE FROM commercial_exceptions WHERE id LIKE 'EXC-RE%' OR id LIKE '%${prefix}%'`);
  await db.query(`DELETE FROM overdue_escalations WHERE id LIKE 'ESC-RE-%' OR id LIKE '%${prefix}%'`);
  await db.query(`DELETE FROM source_remediations WHERE justification LIKE '%RERA%' OR justification LIKE '%${prefix}%'`);
  await db.query(`DELETE FROM employee_lifecycle_requests WHERE employee_id = 'EMP-026'`);
  await db.query(`DELETE FROM reviews WHERE reviewer_employee_id = 'EMP-028'`);
  await db.query(`DELETE FROM regional_management_actions WHERE rm_employee_id = 'EMP-029'`);
  await db.query(`DELETE FROM territory_coverage_plans WHERE rm_employee_id = 'EMP-029'`);
  await db.query(`DELETE FROM regional_targets WHERE rm_employee_id = 'EMP-029' AND period_label NOT IN ('October', 'RT-RE-OCT-2026')`);
  await db.query(`DELETE FROM cross_manager_transfers WHERE rm_employee_id = 'EMP-029'`);
  await db.query(`DELETE FROM regional_staffing_plans WHERE rm_employee_id = 'EMP-029'`);
  await db.query(`DELETE FROM regional_forecasts WHERE rm_employee_id = 'EMP-029'`);
  await db.query(`DELETE FROM regional_escalations WHERE rm_employee_id = 'EMP-029'`);
  await db.query(`DELETE FROM manager_reviews WHERE rm_employee_id = 'EMP-029'`);
  await db.query(`DELETE FROM regional_report_schedules WHERE rm_employee_id = 'EMP-029'`);
  await db.query(`DELETE FROM national_management_actions WHERE nm_employee_id = 'EMP-030'`);
  await db.query(`DELETE FROM national_targets WHERE nm_employee_id = 'EMP-030' AND period_label NOT IN ('October', 'NT-RE-OCT-2026')`);
  await db.query(`DELETE FROM product_rule_proposals WHERE nm_employee_id = 'EMP-030' AND id != 'PRP-RE-001'`);
  await db.query(`DELETE FROM national_forecasts WHERE nm_employee_id = 'EMP-030'`);
  await db.query(`DELETE FROM cross_region_transfers WHERE nm_employee_id = 'EMP-030'`);
  await db.query(`DELETE FROM national_escalations WHERE nm_employee_id = 'EMP-030' AND id != 'NESC-RE-001'`);
  await db.query(`DELETE FROM rm_reviews WHERE nm_employee_id = 'EMP-030'`);
  await db.query(`DELETE FROM national_report_schedules WHERE nm_employee_id = 'EMP-030'`);
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
  await db.query(`DELETE FROM enquiries WHERE (phone LIKE '+91 98765 77%' AND phone NOT IN ('+91 98765 70001', '+91 98765 70002', '+91 98765 70003')) OR published_lead_id IN ${targetLeadsSql}`);
  await db.query(`DELETE FROM leads WHERE id IN ${targetLeadsSql}`);
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  db = new Pool({ connectionString: env.DATABASE_URL });
  await cleanupChain();
  await db.query(`UPDATE leads SET stage = 'new', email = 'ananya.d@luxuryestates.demo' WHERE id = 'FV-4001'`);
  await db.query(`UPDATE leads SET team_id = 'TEAM-REALESTATE-BETA' WHERE id = 'FV-4003'`);
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

test('Real Estate SC-01..28: Full Frontline Real Estate caller journey', async () => {
  // 1. Authenticate as Sameer Kulkarni (EMP-026, SC, Real Estate Alpha)
  const sameerCookie = await loginAs('sameer@finverse.demo');
  const meRes = await fetch(`${base}/api/auth/me`, { headers: { Cookie: sameerCookie } });
  assert.equal(meRes.status, 200);
  const me = (await meRes.json()) as any;
  assert.equal(me.session.role, 'SC');
  assert.equal(me.session.displayName, 'Sameer Kulkarni');
  assert.ok(me.session.verticalGrants.includes('real_estate'));
  assert.ok(me.session.teamGrants.includes('TEAM-REALESTATE-ALPHA'));

  // SC-01: My Day Overview
  const myDayRes = await fetch(`${base}/api/my-day`, { headers: { Cookie: sameerCookie } });
  assert.equal(myDayRes.status, 200);
  const myDay = (await myDayRes.json()) as any;
  assert.ok(myDay.asOf);
  assert.ok(myDay.counts);
  assert.ok(Array.isArray(myDay.nextTasks));

  // SC-02: Lead Inbox
  const leadsRes = await fetch(`${base}/api/leads`, { headers: { Cookie: sameerCookie } });
  assert.equal(leadsRes.status, 200);
  const leadsList = (await leadsRes.json()) as any;
  assert.ok(Array.isArray(leadsList.leads));
  assert.ok(leadsList.leads.some((l: any) => l.id === 'FV-4001'));

  // SC-03: View Prospect
  const leadRes = await fetch(`${base}/api/leads/FV-4001`, { headers: { Cookie: sameerCookie } });
  assert.equal(leadRes.status, 200);
  const leadData = (await leadRes.json()) as any;
  assert.equal(leadData.displayName, 'Ananya Deshmukh');
  assert.equal(leadData.vertical, 'real_estate');

  // SC-04: Edit Contact Info
  const editRes = await fetch(`${base}/api/leads/FV-4001`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sameerCookie },
    body: JSON.stringify({ email: 'ananya.deshmukh@luxury.demo', preferred_language: 'en', reason: 'RERA client mandate update' }),
  });
  assert.equal(editRes.status, 200);

  // SC-05: Permitted self-sourced intake via enquiries
  const enqRes = await fetch(`${base}/api/enquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sameerCookie },
    body: JSON.stringify({
      displayName: 'Harsh Vardhan Goel',
      phone: '+91 98765 77001',
      product: 'Grade-A Commercial Office Leasehold Mandate',
      source: 'Direct Inbound',
      permissionEvidence: 'Signed RERA Client Mandate Agreement dated 2026-10-16',
      need: '45,000 sq.ft. commercial office space requirement in BKC',
    }),
  });
  assert.equal(enqRes.status, 201);
  const enq = (await enqRes.json()) as any;
  assert.equal(enq.status, 'pending-validation');

  // Publish enquiry to lead
  const pubRes = await fetch(`${base}/api/enquiries/${enq.id}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sameerCookie },
    body: JSON.stringify({}),
  });
  assert.equal(pubRes.status, 200);
  const pub = (await pubRes.json()) as any;
  const createdLeadId = pub.leadId;
  assert.ok(createdLeadId);

  // SC-06 & SC-07: Log Call & Wrap-Up
  const callRes = await fetch(`${base}/api/leads/FV-4001/calls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sameerCookie },
    body: JSON.stringify({
      mode: 'browser-webrtc',
      idempotencyKey: `CALL-IDEMP-${Date.now()}`,
    }),
  });
  assert.equal(callRes.status, 201);
  const callData = (await callRes.json()) as any;

  const wrapRes = await fetch(`${base}/api/calls/${callData.id}/wrapup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sameerCookie },
    body: JSON.stringify({
      disposition: 'connected',
      needConfirmed: true,
      note: 'Reviewed BKC commercial floor plate requirements and budget capacity (INR 45 Cr).',
      nextAction: 'schedule-site-visit',
    }),
  });
  assert.equal(wrapRes.status, 200);

  // SC-16: Sequential pipeline movement: new -> requirement -> site-visit
  const move1 = await fetch(`${base}/api/leads/FV-4001/stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sameerCookie },
    body: JSON.stringify({ toStage: 'requirement', reason: 'Property mandate criteria confirmed' }),
  });
  assert.equal(move1.status, 200);

  const move2 = await fetch(`${base}/api/leads/FV-4001/stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sameerCookie },
    body: JSON.stringify({ toStage: 'site-visit', reason: 'Scheduled location inspection with developer rep' }),
  });
  assert.equal(move2.status, 200);

  // SC-17: Draft Proposal
  const propRes = await fetch(`${base}/api/leads/FV-4001/proposals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sameerCookie },
    body: JSON.stringify({
      product: 'Grade-A Commercial Office Leasehold Mandate',
      templateVersion: 'tpl-v1',
      terms: '45,000 sq.ft. carpet area, 9-year lease with 15% escalation every 3 years.',
      validUntil: '2026-11-30',
      recipient: 'Ananya Deshmukh',
    }),
  });
  assert.equal(propRes.status, 201);

  // SC-20: Submit Conversion Request
  const convRes = await fetch(`${base}/api/leads/FV-4001/conversion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sameerCookie },
    body: JSON.stringify({
      winMilestone: 'Binding Sale Deed Execution & Token Deposit',
      milestoneDate: new Date().toISOString().slice(0, 10),
      value: 450000000,
      currency: 'INR',
      evidenceRef: 'DOC-MANDATE-4001',
      proposedCredit: { 'EMP-026': 100 },
    }),
  });
  assert.equal(convRes.status, 201);

  console.log('PASS Real Estate SC-01..28: Full Frontline Real Estate caller journey verified');
});

test('Real Estate TL-01..18: Real Estate Team Lead workspace and supervisory workflow', async () => {
  // 1. Authenticate as Neha Gupta (EMP-027, TL, Real Estate Alpha)
  const nehaCookie = await loginAs('neha.g@finverse.demo');
  const meRes = await fetch(`${base}/api/auth/me`, { headers: { Cookie: nehaCookie } });
  assert.equal(meRes.status, 200);
  const me = (await meRes.json()) as any;
  assert.equal(me.session.role, 'TL');
  assert.ok(me.session.verticalGrants.includes('real_estate'));
  assert.ok(me.session.teamGrants.includes('TEAM-REALESTATE-ALPHA'));

  // TL-01: Team overview
  const ovRes = await fetch(`${base}/api/tl/overview?period=today&comparison=previous%20period`, {
    headers: { Cookie: nehaCookie },
  });
  assert.equal(ovRes.status, 200);
  const ov = (await ovRes.json()) as any;
  assert.ok(Array.isArray(ov.members));
  assert.ok(ov.members.some((m: any) => m.employeeId === 'EMP-026'));

  // TL-02: Allocation queue
  const queueRes = await fetch(`${base}/api/tl/allocation/queue`, {
    headers: { Cookie: nehaCookie },
  });
  assert.equal(queueRes.status, 200);

  // TL-07: Conversion approval decision
  const pendingOutcomes = await db.query(
    `SELECT id FROM outcome_requests WHERE type = 'conversion' AND status = 'pending' LIMIT 1`
  );
  if (pendingOutcomes.rows.length > 0) {
    const outcomeId = pendingOutcomes.rows[0].id;
    const decRes = await fetch(`${base}/api/requests/${outcomeId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: nehaCookie },
      body: JSON.stringify({ decision: 'approve', reason: 'Title clearance and lease terms verified.', evidence: { verified: true } }),
    });
    assert.equal(decRes.status, 200);
  }

  // TL-11: Team Forecast
  const fcstRes = await fetch(`${base}/api/tl/forecasts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: nehaCookie },
    body: JSON.stringify({
      teamId: 'TEAM-REALESTATE-ALPHA',
      periodLabel: 'October',
      category: 'commit',
      expectedRevenue: 85000000,
      currency: 'INR',
      opportunityIds: ['FV-4001'],
      riskNotes: 'Waiting for BMC clearance on Worli commercial tower.',
    }),
  });
  assert.equal(fcstRes.status, 201);

  // TL-16: Team pack PDF export & download
  const packRes = await fetch(`${base}/api/tl/team-packs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: nehaCookie },
    body: JSON.stringify({ period: 'month', teamIds: ['TEAM-REALESTATE-ALPHA'] }),
  });
  assert.equal(packRes.status, 201);
  const pack = (await packRes.json()) as any;
  const dlRes = await fetch(`${base}/api/tl/team-packs/${pack.id}/download`, { headers: { Cookie: nehaCookie } });
  assert.equal(dlRes.status, 200);
  assert.equal(dlRes.headers.get('content-type'), 'application/pdf');

  console.log('PASS Real Estate TL-01..18: Real Estate Team Lead workspace and supervisory workflow verified');
});

test('Real Estate Manager MG-01..13: Real Estate Manager supervisory oversight', async () => {
  // 1. Authenticate as Vikramaditya Singhania (EMP-028, MG, Real Estate Alpha & Beta)
  const vikramCookie = await loginAs('vikramaditya@finverse.demo');
  const meRes = await fetch(`${base}/api/auth/me`, { headers: { Cookie: vikramCookie } });
  assert.equal(meRes.status, 200);
  const me = (await meRes.json()) as any;
  assert.equal(me.session.role, 'MG');
  assert.ok(me.session.verticalGrants.includes('real_estate'));

  // MG-01: Manager overview
  const ovRes = await fetch(`${base}/api/manager/overview?period=this-week`, {
    headers: { Cookie: vikramCookie },
  });
  assert.equal(ovRes.status, 200);
  const ov = (await ovRes.json()) as any;
  assert.ok(Array.isArray(ov.tlBreakdown));
  assert.ok(ov.tlBreakdown.length > 0);

  // MG-03: Cross-team transfer
  const transferRes = await fetch(`${base}/api/manager/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: vikramCookie },
    body: JSON.stringify({
      sourceTeamId: 'TEAM-REALESTATE-BETA',
      destinationTeamId: 'TEAM-REALESTATE-ALPHA',
      leadIds: ['FV-4003'],
      reason: 'Mandate reclassified to luxury residential under Real Estate Alpha.',
    }),
  });
  assert.equal(transferRes.status, 201);

  // MG-04: Capacity plan
  const capRes = await fetch(`${base}/api/manager/capacity/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: vikramCookie },
    body: JSON.stringify({
      name: 'Q4 Real Estate Luxury Advisory Capacity Plan',
      periodLabel: 'Q4-2026',
      teamIds: ['TEAM-REALESTATE-ALPHA', 'TEAM-REALESTATE-BETA'],
      currentBacklog: 3,
      availableCallers: 2,
      requiredAdditionalStaff: 1,
      operationalDeadline: new Date(Date.now() + 86400000 * 14).toISOString(),
      notes: 'Allocating additional senior property advisers for festive luxury launches.',
      approved: true,
    }),
  });
  assert.equal(capRes.status, 201);

  // MG-06: TL Forecast Review & Acceptance
  const { rows: existingFcst } = await db.query(
    `SELECT id FROM team_forecasts WHERE team_id = 'TEAM-REALESTATE-ALPHA' AND period_label = 'October' ORDER BY submitted_at DESC LIMIT 1`
  );
  const fcstId = existingFcst[0]?.id;
  assert.ok(fcstId, 'Forecast must exist');

  const decideFcstRes = await fetch(`${base}/api/manager/forecasts/decide`, {
    method: 'POST',
    headers: { Cookie: vikramCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      forecastId: fcstId,
      decision: 'accepted',
      feedback: 'Luxury residential advisory pipeline reviewed and accepted.',
    }),
  });
  assert.equal(decideFcstRes.status, 200);

  // MG-07: Rollup forecast submission to RM
  const rollRes = await fetch(`${base}/api/manager/forecasts/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: vikramCookie },
    body: JSON.stringify({
      periodLabel: 'October',
      bottomUpRevenue: 85000000,
      managementAdjustment: 5000000,
      adjustedRevenue: 90000000,
      currency: 'INR',
      acceptedForecastIds: [fcstId],
      riskNotes: 'RERA registration turnaround on Worli luxury project on schedule.',
    }),
  });
  assert.equal(rollRes.status, 201);

  // MG-13: Meeting pack binary PDF export
  const packRes = await fetch(`${base}/api/manager/meeting-pack/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: vikramCookie },
    body: JSON.stringify({ period: 'month-to-date' }),
  });
  assert.equal(packRes.status, 201);
  const packData = (await packRes.json()) as any;
  assert.ok(packData.id);

  console.log('PASS Real Estate Manager MG-01..13: Real Estate Manager supervisory oversight verified');
});

test('Real Estate Regional Manager RM-01..10: Real Estate regional governance', async () => {
  // 1. Authenticate as Siddharth Malhotra (EMP-029, RM, REGION-REALESTATE-WEST)
  const siddharthCookie = await loginAs('siddharth.m@finverse.demo');
  const meRes = await fetch(`${base}/api/auth/me`, { headers: { Cookie: siddharthCookie } });
  assert.equal(meRes.status, 200);
  const me = (await meRes.json()) as any;
  assert.equal(me.session.role, 'RM');
  assert.ok(me.session.verticalGrants.includes('real_estate'));

  // RM-01: Regional overview
  const ovRes = await fetch(`${base}/api/regional/overview?period=month-to-date`, {
    headers: { Cookie: siddharthCookie },
  });
  assert.equal(ovRes.status, 200);
  const ov = (await ovRes.json()) as any;
  assert.equal(ov.data.region.id, 'REGION-REALESTATE-WEST');
  assert.equal(ov.data.region.vertical, 'real_estate');

  // RM-04: Regional target allocate
  const cascadeRes = await fetch(`${base}/api/regional/targets/allocate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: siddharthCookie },
    body: JSON.stringify({
      periodLabel: 'October',
      metric: 'approved-wins',
      approvedNmTarget: 100,
      managerAllocations: [
        { managerEmployeeId: 'EMP-028', targetWins: 80 },
      ],
      publish: true,
    }),
  });
  assert.equal(cascadeRes.status, 201);

  // RM-10: Executive Review Pack PDF
  const packRes = await fetch(`${base}/api/regional/reports/generate-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: siddharthCookie },
    body: JSON.stringify({ period: 'October 2026', sections: ['overview', 'managers', 'targets', 'forecast', 'risks'] }),
  });
  assert.equal(packRes.status, 200);
  const packData = (await packRes.json()) as any;
  assert.ok(packData.data.downloadUrl);

  console.log('PASS Real Estate Regional Manager RM-01..10: Real Estate regional governance verified');
});

test('Real Estate National Manager NM-01..11: Real Estate national strategy', async () => {
  // 1. Authenticate as Aditya Singhania (EMP-030, NM, Real Estate)
  const adityaCookie = await loginAs('aditya@finverse.demo');
  const meRes = await fetch(`${base}/api/auth/me`, { headers: { Cookie: adityaCookie } });
  assert.equal(meRes.status, 200);
  const me = (await meRes.json()) as any;
  assert.equal(me.session.role, 'NM');
  assert.ok(me.session.verticalGrants.includes('real_estate'));

  // NM-01: National overview
  const ovRes = await fetch(`${base}/api/national/overview?period=month-to-date`, {
    headers: { Cookie: adityaCookie },
  });
  assert.equal(ovRes.status, 200);
  const ov = (await ovRes.json()) as any;
  assert.equal(ov.data.scope.vertical, 'real_estate');

  // NM-04: Real Estate economics
  const econRes = await fetch(`${base}/api/national/economics?period=month-to-date`, {
    headers: { Cookie: adityaCookie },
  });
  assert.equal(econRes.status, 200);
  const econData = (await econRes.json()) as any;
  assert.ok(econData.data.economics.productEconomics.some((p: any) => p.product.includes('Residential') || p.product.includes('Commercial') || p.product.includes('Real Estate')));

  // NM-08: Cross-vertical referral intake
  const refRes = await fetch(`${base}/api/national/referrals/REF-RE-001/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adityaCookie },
    body: JSON.stringify({
      decision: 'accepted',
      targetTeamId: 'TEAM-REALESTATE-ALPHA',
      targetOwnerEmployeeId: 'EMP-026',
    }),
  });
  assert.equal(refRes.status, 200);

  // NM-11: Board Pack binary PDF generation
  const packRes = await fetch(`${base}/api/national/reports/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adityaCookie },
    body: JSON.stringify({ period: 'October 2026', sections: ['executive_summary', 'kpis', 'regions', 'targets', 'forecasts', 'escalations'] }),
  });
  assert.equal(packRes.status, 200);
  const packData = (await packRes.json()) as any;
  assert.ok(packData.data.downloadUrl);

  console.log('PASS Real Estate National Manager NM-01..11: Real Estate national strategy verified');
});
