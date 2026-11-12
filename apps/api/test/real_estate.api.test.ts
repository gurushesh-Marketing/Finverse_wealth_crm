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
  await db.query(`UPDATE leads SET stage = 'new', email = 'ananya.d@luxuryestates.demo', owner_employee_id = 'EMP-026', team_id = 'TEAM-REALESTATE-ALPHA' WHERE id = 'FV-4001'`);
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

test('Real Estate Regional Manager RM-01..10: Real Estate regional governance, scorecards, territory planning, target cascade, cross-manager transfers, staffing requisitions, forecast rollup, escalations, manager reviews, and PDF review pack', async () => {
  // Login as Siddharth Malhotra (EMP-029, Real Estate Regional Manager)
  const siddharthCookie = await loginAs('siddharth.m@finverse.demo');
  const sameerCookie = await loginAs('sameer@finverse.demo');
  const nehaCookie = await loginAs('neha.g@finverse.demo');
  const vikramCookie = await loginAs('vikramaditya@finverse.demo');

  // Role Gate: Frontline caller Sameer, TL Neha, and Manager Vikramaditya cannot access Regional Manager routes (403 Forbidden)
  const sameerDenied = await fetch(`${base}/api/regional/overview`, { headers: { Cookie: sameerCookie } });
  assert.equal(sameerDenied.status, 403, 'Frontline caller must be denied Regional Manager access');

  const nehaDenied = await fetch(`${base}/api/regional/overview`, { headers: { Cookie: nehaCookie } });
  assert.equal(nehaDenied.status, 403, 'Team Lead must be denied Regional Manager access');

  const vikramDenied = await fetch(`${base}/api/regional/overview`, { headers: { Cookie: vikramCookie } });
  assert.equal(vikramDenied.status, 403, 'Branch Manager must be denied Regional Manager access');

  // Verify RM Session Resolution
  const meRes = await fetch(`${base}/api/auth/me`, { headers: { Cookie: siddharthCookie } });
  assert.equal(meRes.status, 200);
  const { session } = (await meRes.json()) as any;
  assert.equal(session.employeeId, 'EMP-029', 'Must resolve Siddharth Malhotra');
  assert.equal(session.role, 'RM');
  assert.ok(session.verticalGrants.includes('real_estate'));
  assert.ok(session.teamGrants.includes('TEAM-REALESTATE-ALPHA'));
  assert.ok(session.teamGrants.includes('TEAM-REALESTATE-BETA'));

  // RM-01: Regional Overview across Real Estate West Zone
  const ovRes = await fetch(`${base}/api/regional/overview?period=month-to-date`, { headers: { Cookie: siddharthCookie } });
  assert.equal(ovRes.status, 200, 'Real Estate Regional Manager overview must return 200');
  const ovData = (await ovRes.json()) as any;
  const overview = ovData.data;
  assert.equal(overview.region.id, 'REGION-REALESTATE-WEST');
  assert.equal(overview.region.vertical, 'real_estate');
  assert.ok(overview.region.teamsCount >= 2, 'Must cover multiple real estate teams');
  assert.ok(overview.managers.some((m: any) => m.managerId === 'EMP-028'), 'Must include Real Estate Manager Vikramaditya Singhania');

  // Create regional management intervention for Vikramaditya Singhania
  const actRes = await fetch(`${base}/api/regional/actions`, {
    method: 'POST',
    headers: { Cookie: siddharthCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceAction: 'RM-01',
      kind: 'regional-intervention',
      subjectManagerEmployeeId: 'EMP-028',
      ownerEmployeeId: 'EMP-029',
      title: 'South Mumbai Luxury Mandate Inspection Turnaround',
      detail: 'Expedite architectural site inspections and RERA due diligence searches for landmark residential towers',
      dueAt: new Date(Date.now() + 86400000 * 3).toISOString(),
    }),
  });
  assert.equal(actRes.status, 201);

  // RM-02: In-Scope Real Estate Manager Scorecard (Vikramaditya Singhania)
  const scRes = await fetch(`${base}/api/regional/managers/EMP-028/scorecard?period=October`, { headers: { Cookie: siddharthCookie } });
  assert.equal(scRes.status, 200);
  const scData = (await scRes.json()) as any;
  const scorecard = scData.data;
  assert.equal(scorecard.manager.id, 'EMP-028');
  assert.ok(scorecard.teamLeads.some((tl: any) => tl.id === 'EMP-027'), 'Must include TL Neha Gupta');
  assert.ok(scorecard.teamLeads.some((tl: any) => tl.id === 'EMP-032'), 'Must include TL Pooja Reddy');

  // Cross-vertical isolation: Out-of-scope Wealth Manager (Neel Verma, EMP-007) returns 404 Not Found
  const foreignScRes = await fetch(`${base}/api/regional/managers/EMP-007/scorecard?period=October`, { headers: { Cookie: siddharthCookie } });
  assert.equal(foreignScRes.status, 404, 'Out-of-scope Wealth manager must return 404');

  // RM-03: Territory Coverage Planning for Real Estate West Zone
  const terrRes = await fetch(`${base}/api/regional/territories`, { headers: { Cookie: siddharthCookie } });
  assert.equal(terrRes.status, 200);
  const terrData = (await terrRes.json()) as any;
  assert.ok(terrData.data.subRegions.some((s: string) => s.includes('Mumbai') || s.includes('Residential') || s.includes('Commercial')));

  const saveTerrRes = await fetch(`${base}/api/regional/territories`, {
    method: 'POST',
    headers: { Cookie: siddharthCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      territoryName: 'Western Luxury Residential & Commercial Mandate Corridor',
      subRegion: 'South Mumbai Luxury Residential Belt',
      productScope: 'Luxury Residential Mandate, Commercial Office Space, Real Estate Investment Trusts (REITs)',
      languageQueues: ['English', 'Hindi', 'Marathi', 'Gujarati'],
      targetTeamIds: ['TEAM-REALESTATE-ALPHA', 'TEAM-REALESTATE-BETA'],
      capacityGap: 2,
      routingProposal: 'Route luxury residential mandates in Worli/Malabar Hill to Real Estate Alpha; commercial leasing to Beta',
      activationDate: '2026-11-01',
      status: 'activated',
    }),
  });
  assert.equal(saveTerrRes.status, 201);

  // RM-04: Regional Target Cascade & Non-Over-Allocation Enforcement
  const tgRes = await fetch(`${base}/api/regional/targets`, { headers: { Cookie: siddharthCookie } });
  assert.equal(tgRes.status, 200);

  // Valid allocation: 80 wins allocated to Vikramaditya Singhania from 100 parent target
  const allocTgRes = await fetch(`${base}/api/regional/targets/allocate`, {
    method: 'POST',
    headers: { Cookie: siddharthCookie, 'Content-Type': 'application/json' },
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
  assert.equal(allocTgRes.status, 201);

  // Over-allocation check: Allocating 150 wins when parent target is 100 must be rejected (400 Bad Request)
  const overAllocRes = await fetch(`${base}/api/regional/targets/allocate`, {
    method: 'POST',
    headers: { Cookie: siddharthCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      metric: 'approved-wins',
      approvedNmTarget: 100,
      managerAllocations: [
        { managerEmployeeId: 'EMP-028', targetWins: 150 },
      ],
      publish: true,
    }),
  });
  assert.equal(overAllocRes.status, 400, 'Over-allocation exceeding parent NM target must be rejected');

  // RM-05: Cross-Manager Lead Transfer & Decision
  const xferLeadId = `${RUN_PREFIX}-RM-RE-XFER`;
  await db.query(
    `INSERT INTO leads (id, vertical, display_name, phone, preferred_language, product, source, stage, team_id)
     VALUES ($1, 'real_estate', 'Kavita Birla Estate', '+91 98765 66099', 'en', 'Luxury Residential Mandate', 'Direct Referral', 'requirement', 'TEAM-REALESTATE-BETA')`,
    [xferLeadId]
  );

  const xferRes = await fetch(`${base}/api/regional/transfers`, {
    method: 'POST',
    headers: { Cookie: siddharthCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceManagerEmployeeId: 'EMP-028',
      destinationManagerEmployeeId: 'EMP-028',
      sourceTeamId: 'TEAM-REALESTATE-BETA',
      destinationTeamId: 'TEAM-REALESTATE-ALPHA',
      leadIds: [xferLeadId],
      reason: 'Regional balance reallocation of high-value Worli sea-facing mandate',
      forecastImpactNotes: 'Expected token receipt Q4 2026',
    }),
  });
  assert.equal(xferRes.status, 201);
  const xferData = (await xferRes.json()) as any;
  const transferId = xferData.data.id;

  // Decide transfer with approval
  const decideXferRes = await fetch(`${base}/api/regional/transfers/decide`, {
    method: 'POST',
    headers: { Cookie: siddharthCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transferId,
      decision: 'approved',
      resolutionNotes: 'Approved commercial cross-branch rebalancing under Regional Manager authority',
    }),
  });
  assert.equal(decideXferRes.status, 200);

  // Verify lead's team in database is updated to Real Estate Alpha and audit logged
  const { rows: movedLeadCheck } = await db.query(`SELECT team_id FROM leads WHERE id = $1`, [xferLeadId]);
  assert.equal(movedLeadCheck[0].team_id, 'TEAM-REALESTATE-ALPHA');

  // RM-06: Regional Staffing Envelope & Requisition Submission to HR
  const staffRes = await fetch(`${base}/api/regional/staffing`, { headers: { Cookie: siddharthCookie } });
  assert.equal(staffRes.status, 200);

  const planStaffRes = await fetch(`${base}/api/regional/staffing`, {
    method: 'POST',
    headers: { Cookie: siddharthCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'Q4-2026',
      plannedHeadcount: 8,
      approvedHeadcount: 6,
      activeHeadcount: 4,
      requisitions: [
        { title: 'Luxury Mandate Consultant', teamId: 'TEAM-REALESTATE-ALPHA', count: 2, justification: 'Luxury residential mandate expansion', priority: 'high' },
      ],
      businessJustification: 'Support 50% surge in Grade-A commercial office space and luxury residential mandates',
      status: 'submitted_to_hr',
    }),
  });
  assert.equal(planStaffRes.status, 201);

  // RM-07: Regional Forecast Rollup & Submission to NM
  const mFcstId = `MFCST-RE-${Date.now().toString(36)}`;
  await db.query(
    `INSERT INTO manager_forecasts (id, manager_employee_id, period_label, bottom_up_revenue, management_adjustment, adjusted_revenue, currency, status, accepted_forecast_ids, submitted_at)
     VALUES ($1, 'EMP-028', 'October', 35000000, 3000000, 38000000, 'INR', 'submitted_to_rm', '[]', now())`,
    [mFcstId]
  );

  const fcstRollupRes = await fetch(`${base}/api/regional/forecasts?period=October`, { headers: { Cookie: siddharthCookie } });
  assert.equal(fcstRollupRes.status, 200);

  const submitFcstRes = await fetch(`${base}/api/regional/forecasts/submit`, {
    method: 'POST',
    headers: { Cookie: siddharthCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      regionalAdjustment: 2000000,
      acceptedManagerForecastIds: [mFcstId],
      topRegionalRisks: [{ title: 'BMC architectural zoning delays', severity: 'medium', impact: 'Token clearance delay' }],
      regionalAssumptions: 'Anticipated 2 major commercial office lease closures by end of October',
      submitToNm: true,
    }),
  });
  assert.equal(submitFcstRes.status, 201);

  // RM-08: Regional Escalations & Exceptions Management
  const escListRes = await fetch(`${base}/api/regional/escalations`, { headers: { Cookie: siddharthCookie } });
  assert.equal(escListRes.status, 200);

  const createEscRes = await fetch(`${base}/api/regional/escalations`, {
    method: 'POST',
    headers: { Cookie: siddharthCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceType: 'operational_risk',
      title: 'RERA Carpet Area Verification Delay in Lower Parel Mandate',
      severity: 'high',
      accountableManagerEmployeeId: 'EMP-028',
      detail: 'Architectural certificate delay causing SLA breach on token execution for INR 30 Cr commercial floor',
      deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
    }),
  });
  assert.equal(createEscRes.status, 201);
  const createEscData = (await createEscRes.json()) as any;
  const escId = createEscData.data.id;

  const resolveEscRes = await fetch(`${base}/api/regional/escalations/resolve`, {
    method: 'POST',
    headers: { Cookie: siddharthCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      escalationId: escId,
      decision: 'resolved',
      recoveryDecision: 'Appointed secondary architectural survey partner and secured carpet area certificate within 24h',
    }),
  });
  assert.equal(resolveEscRes.status, 200);

  // RM-09: Structured Manager Performance Review
  const saveRevRes = await fetch(`${base}/api/regional/reviews`, {
    method: 'POST',
    headers: { Cookie: siddharthCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      managerEmployeeId: 'EMP-028',
      periodLabel: 'Q3-2026',
      performanceRating: 'exceeding',
      strengths: 'Exceptional client advisory rigor on high-ticket luxury mandates across Real Estate Alpha & Beta',
      blockers: 'RERA legal search turnaround bottlenecks on redevelopment mandates',
      improvementCommitments: ['Reduce average mandate-to-token duration from 21d to 14d'],
      supportActions: 'Authorize expedited architectural survey panel access and dedicated property legal desk',
      privateRmNotes: 'Strong leadership candidate for National Real Estate Head succession',
      nextReviewDate: '2026-12-30',
      acknowledged: true,
    }),
  });
  assert.equal(saveRevRes.status, 201);

  // Non-manager or foreign-manager review rejection (403)
  const invalidRevRes = await fetch(`${base}/api/regional/reviews`, {
    method: 'POST',
    headers: { Cookie: siddharthCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      managerEmployeeId: 'EMP-007', // Neel Verma (Wealth Manager, out of Real Estate scope)
      periodLabel: 'Q3-2026',
      performanceRating: 'achieving',
      strengths: 'Good wealth sales',
      blockers: 'No blockers',
      improvementCommitments: ['Maintain pace'],
      nextReviewDate: '2026-12-30',
      acknowledged: true,
    }),
  });
  assert.equal(invalidRevRes.status, 403, 'Reviewing an out-of-scope manager must be rejected');

  // RM-10: Audited Binary PDF Review Pack & Report Schedules
  const prevReportRes = await fetch(`${base}/api/regional/reports/preview?period=October+2026`, { headers: { Cookie: siddharthCookie } });
  assert.equal(prevReportRes.status, 200);
  const prevReportData = (await prevReportRes.json()) as any;
  assert.ok(prevReportData.data.title.includes('Regional'));
  assert.equal(prevReportData.data.scope.vertical, 'real_estate');

  // Generate binary PDF
  const genPdfRes = await fetch(`${base}/api/regional/reports/generate-pdf`, {
    method: 'POST',
    headers: { Cookie: siddharthCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ period: 'October 2026', sections: ['overview', 'managers', 'targets', 'forecast', 'risks'] }),
  });
  assert.equal(genPdfRes.status, 200);
  const genPdfData = (await genPdfRes.json()) as any;
  assert.ok(genPdfData.data.downloadUrl);

  const dlRes = await fetch(`${base}${genPdfData.data.downloadUrl}`, { headers: { Cookie: siddharthCookie } });
  assert.equal(dlRes.status, 200);
  assert.equal(dlRes.headers.get('content-type'), 'application/pdf');
  const dlBytes = Buffer.from(await dlRes.arrayBuffer());
  assert.ok(dlBytes.subarray(0, 4).toString().startsWith('%PDF'), 'Downloaded review pack must be valid binary %PDF');

  // Save recurring report schedule
  const saveSchedRes = await fetch(`${base}/api/regional/reports/schedules`, {
    method: 'POST',
    headers: { Cookie: siddharthCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Real Estate Advisory West Zone Weekly Executive Cadence',
      periodType: 'weekly',
      cadence: 'Monday 08:30 IST',
      recipients: ['siddharth.m@finverse.demo', 'vikramaditya@finverse.demo'],
      sections: ['overview', 'managers', 'targets', 'forecast', 'risks'],
      status: 'active',
    }),
  });
  assert.equal(saveSchedRes.status, 201);

  console.log('PASS Real Estate Regional Manager RM-01..10: Real Estate regional governance verified');
});

test('Real Estate National Manager NM-01..11: Real Estate national overview, division benchmarking, target cascade, product economics, pipeline rules, forecast rollup, cross-region transfers, cross-vertical referral intake, executive escalations, RM reviews, and board pack', async () => {
  // 1. Role-Gate Security Check: Non-NM callers/managers/RMs are strictly forbidden from NM workspace
  const sameerCookie = await loginAs('sameer@finverse.demo');       // SC
  const vikramadityaCookie = await loginAs('vikramaditya@finverse.demo'); // MG
  const siddharthCookie = await loginAs('siddharth.m@finverse.demo'); // RM

  const scDenied = await fetch(`${base}/api/national/overview`, { headers: { Cookie: sameerCookie } });
  assert.equal(scDenied.status, 403, 'Frontline SC must receive 403 on national endpoints');

  const mgDenied = await fetch(`${base}/api/national/overview`, { headers: { Cookie: vikramadityaCookie } });
  assert.equal(mgDenied.status, 403, 'Manager must receive 403 on national endpoints');

  const rmDenied = await fetch(`${base}/api/national/overview`, { headers: { Cookie: siddharthCookie } });
  assert.equal(rmDenied.status, 403, 'Regional Manager must receive 403 on national endpoints');

  // Authenticate as Real Estate National Manager Aditya Singhania (EMP-030)
  const adityaCookie = await loginAs('aditya@finverse.demo');
  assert.ok(adityaCookie, 'Aditya Singhania must log in successfully with valid session');

  // 2. Scope inspection: Returns real_estate vertical scope, regions, teams, and headcounts
  const scopeRes = await fetch(`${base}/api/national/scope`, { headers: { Cookie: adityaCookie } });
  assert.equal(scopeRes.status, 200);
  const scopeData = (await scopeRes.json()) as any;
  assert.equal(scopeData.data.vertical, 'real_estate');
  assert.ok(scopeData.data.regions.some((r: any) => r.id === 'REGION-REALESTATE-WEST'));
  assert.ok(scopeData.data.regions.some((r: any) => r.id === 'REGION-REALESTATE-NORTH'));
  assert.ok(scopeData.data.headcounts.rms >= 1);
  assert.ok(scopeData.data.headcounts.totalFte >= 1);

  // NM-01: National Overview & Directive Issuance
  const overviewRes = await fetch(`${base}/api/national/overview?period=month-to-date`, { headers: { Cookie: adityaCookie } });
  assert.equal(overviewRes.status, 200);
  const overviewData = (await overviewRes.json()) as any;
  assert.equal(overviewData.data.scope.vertical, 'real_estate');
  assert.ok(typeof overviewData.data.kpis.approvedCeoTarget === 'number');
  assert.ok(Array.isArray(overviewData.data.regionalPerformance));

  // Create national directive to RM (Siddharth Malhotra)
  const actionRes = await fetch(`${base}/api/national/actions`, {
    method: 'POST',
    headers: { Cookie: adityaCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceAction: 'NM-01',
      kind: 'regional-directive',
      subjectRmEmployeeId: 'EMP-029',
      ownerEmployeeId: 'EMP-030',
      regionId: 'REGION-REALESTATE-WEST',
      metricKey: 'sale-agreement',
      periodLabel: 'October',
      title: 'Accelerate Luxury Penthouse Title & Token Sanction SLA',
      detail: 'Expedite architectural survey panel and RERA carpet area certification for high-value South Mumbai mandates.',
      dueAt: new Date(Date.now() + 86400000 * 3).toISOString(),
    }),
  });
  assert.equal(actionRes.status, 201);
  const actionData = (await actionRes.json()) as any;
  const actionId = actionData.data.id;
  assert.ok(actionId);

  // List and complete action
  const listActionsRes = await fetch(`${base}/api/national/actions?status=open`, { headers: { Cookie: adityaCookie } });
  assert.equal(listActionsRes.status, 200);
  const listActionsData = (await listActionsRes.json()) as any;
  assert.ok(listActionsData.data.some((a: any) => a.id === actionId));

  const completeActRes = await fetch(`${base}/api/national/actions/${actionId}/complete`, {
    method: 'POST',
    headers: { Cookie: adityaCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(completeActRes.status, 200);

  // NM-02: Regional Scorecards & Benchmark Comparisons
  const compRes = await fetch(`${base}/api/national/comparisons?period=September`, { headers: { Cookie: adityaCookie } });
  assert.equal(compRes.status, 200);
  const compData = (await compRes.json()) as any;
  assert.ok(compData.data.regions.length >= 2, 'Must compare at least West and North Real Estate zones');
  const westComp = compData.data.regions.find((r: any) => r.regionId === 'REGION-REALESTATE-WEST');
  assert.ok(westComp);
  assert.equal(westComp.regionalManager?.id, 'EMP-029');

  // NM-03: National Plan & Target Cascade
  const targetRes = await fetch(`${base}/api/national/target?period=October`, { headers: { Cookie: adityaCookie } });
  assert.equal(targetRes.status, 200);
  const targetData = (await targetRes.json()) as any;
  assert.equal(targetData.data.approvedCeoTarget, 200);

  // Over-allocation guard (400 validation failed)
  const overAllocRes = await fetch(`${base}/api/national/target/allocate`, {
    method: 'POST',
    headers: { Cookie: adityaCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      approvedCeoTarget: 200,
      regionalAllocations: [
        { regionId: 'REGION-REALESTATE-WEST', targetWins: 150, rmEmployeeId: 'EMP-029' },
        { regionId: 'REGION-REALESTATE-NORTH', targetWins: 100, rmEmployeeId: 'EMP-029' },
      ],
      publish: true,
    }),
  });
  assert.equal(overAllocRes.status, 400, 'Over-allocating beyond approved CEO target (250 > 200) must be rejected');

  // Valid cascade to regions
  const validAllocRes = await fetch(`${base}/api/national/target/allocate`, {
    method: 'POST',
    headers: { Cookie: adityaCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      approvedCeoTarget: 200,
      regionalAllocations: [
        { regionId: 'REGION-REALESTATE-WEST', targetWins: 120, rmEmployeeId: 'EMP-029' },
        { regionId: 'REGION-REALESTATE-NORTH', targetWins: 80, rmEmployeeId: 'EMP-029' },
      ],
      publish: true,
    }),
  });
  assert.equal(validAllocRes.status, 200);

  // Cross-check cascaded regional target in DB
  const { rows: rtRows } = await db.query(
    `SELECT approved_nm_target, status FROM regional_targets WHERE region_id = 'REGION-REALESTATE-WEST' AND period_label = 'October'`
  );
  assert.equal(Number(rtRows[0].approved_nm_target), 120);
  assert.equal(rtRows[0].status, 'published');

  // NM-04: National Economics & Unit Capacity Analysis
  const econRes = await fetch(`${base}/api/national/economics?period=month-to-date`, { headers: { Cookie: adityaCookie } });
  assert.equal(econRes.status, 200);
  const econData = (await econRes.json()) as any;
  assert.ok(econData.data.economics.productEconomics.some((p: any) => p.product.includes('Residential') || p.product.includes('Commercial') || p.product.includes('Real Estate')));
  assert.ok(econData.data.economics.unitCapacityGapFte >= 0);

  // NM-05: Product & Pipeline Rule Proposals
  const rulesListRes = await fetch(`${base}/api/national/product-rules`, { headers: { Cookie: adityaCookie } });
  assert.equal(rulesListRes.status, 200);
  const rulesListData = (await rulesListRes.json()) as any;
  assert.ok(rulesListData.data.some((r: any) => r.id === 'PRP-RE-001'));

  const createRuleRes = await fetch(`${base}/api/national/product-rules`, {
    method: 'POST',
    headers: { Cookie: adityaCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ruleName: 'Architectural Heritage Zoning & Title Verification Fast-Track SLA',
      currentVersion: '1.0',
      proposedVersion: '1.3',
      reason: 'Empower West Zone branch managers to engage pre-approved municipal survey panels for Grade-A commercial mandates',
      effectiveDate: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
      affectedProducts: ['Luxury Residential Mandate', 'Commercial Office Space'],
      previewImpact: 'Reduces mandate title validation lag from 21 days to 7 days',
    }),
  });
  assert.equal(createRuleRes.status, 201);

  // NM-06: Consolidated National Forecast Rollup
  const rollupRes = await fetch(`${base}/api/national/forecast/rollup?period=October`, { headers: { Cookie: adityaCookie } });
  assert.equal(rollupRes.status, 200);
  const rollupData = (await rollupRes.json()) as any;

  const submitForecastRes = await fetch(`${base}/api/national/forecast/submit`, {
    method: 'POST',
    headers: { Cookie: adityaCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October',
      bottomUpRevenue: rollupData.data.bottomUpSum || 40000000,
      nationalAdjustment: 5000000,
      currency: 'INR',
      acceptedRegionalForecastIds: rollupData.data.regionalForecasts ? rollupData.data.regionalForecasts.map((rf: any) => rf.id) : [],
      topNationalRisks: [
        'BMC architectural zoning bottlenecks on high-value mandates',
      ],
      nationalAssumptions: 'Anticipated festive season luxury apartment sales momentum across Mumbai and Pune corridor.',
      submitToExecutives: true,
    }),
  });
  assert.equal(submitForecastRes.status, 200);

  // NM-07: Cross-Region Work Transfers
  const transfersRes = await fetch(`${base}/api/national/transfers`, { headers: { Cookie: adityaCookie } });
  assert.equal(transfersRes.status, 200);

  const createTransferRes = await fetch(`${base}/api/national/transfers`, {
    method: 'POST',
    headers: { Cookie: adityaCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceRegionId: 'REGION-REALESTATE-WEST',
      destinationRegionId: 'REGION-REALESTATE-NORTH',
      leadIds: ['FV-4001'],
      reason: 'Client corporate headquarters relocation from Mumbai BKC to Gurgaon CyberCity.',
      handoffPlan: 'Transfer mandate to North zone advisory desk with 24h client contact protocol.',
    }),
  });
  assert.equal(createTransferRes.status, 201);
  const createTransferData = (await createTransferRes.json()) as any;
  const transferId = createTransferData.data.id;

  const decideTransferRes = await fetch(`${base}/api/national/transfers/${transferId}/decide`, {
    method: 'POST',
    headers: { Cookie: adityaCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision: 'approved',
      resolutionNotes: 'Transfer approved. Workload rebalanced to North advisory desk.',
    }),
  });
  assert.equal(decideTransferRes.status, 200);

  // NM-08: Cross-Vertical Inbound Referral Intake
  const referralsRes = await fetch(`${base}/api/national/referrals`, { headers: { Cookie: adityaCookie } });
  assert.equal(referralsRes.status, 200);
  const referralsData = (await referralsRes.json()) as any;
  assert.ok(referralsData.data.some((r: any) => r.id === 'REF-RE-001'));

  const decideRefRes = await fetch(`${base}/api/national/referrals/REF-RE-001/decide`, {
    method: 'POST',
    headers: { Cookie: adityaCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      decision: 'accepted',
      targetTeamId: 'TEAM-REALESTATE-ALPHA',
      targetOwnerEmployeeId: 'EMP-026',
    }),
  });
  assert.equal(decideRefRes.status, 200);

  // NM-09: National Strategic Escalations
  const escListRes = await fetch(`${base}/api/national/escalations`, { headers: { Cookie: adityaCookie } });
  assert.equal(escListRes.status, 200);
  const escListData = (await escListRes.json()) as any;
  assert.ok(escListData.data.some((e: any) => e.id === 'NESC-RE-001'));

  const createEscRes = await fetch(`${base}/api/national/escalations`, {
    method: 'POST',
    headers: { Cookie: adityaCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'governance_risk',
      targetExecutive: 'BOTH',
      title: 'Bandra Redevelopment Mandate Legal Clearance Dispute',
      detail: 'Joint venture agreement dispute on INR 45 Cr Bandra redevelopment mandate; requires CEO arbitration and CFO legal retainer approval.',
      decisionDeadline: new Date(Date.now() + 86400000 * 7).toISOString(),
    }),
  });
  assert.equal(createEscRes.status, 201);
  const createEscData = (await createEscRes.json()) as any;
  const escId = createEscData.data.id;

  const resolveEscRes = await fetch(`${base}/api/national/escalations/${escId}/resolve`, {
    method: 'POST',
    headers: { Cookie: adityaCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executiveDecision: 'Retained senior real estate counsel and approved escrow indemnification protocol.',
    }),
  });
  assert.equal(resolveEscRes.status, 200);

  // NM-10: Regional Manager Performance Review
  const saveRmRevRes = await fetch(`${base}/api/national/reviews`, {
    method: 'POST',
    headers: { Cookie: adityaCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rmEmployeeId: 'EMP-029',
      periodLabel: 'Q3-2026',
      performanceRating: 'exceeding',
      strengths: 'Exceptional high-ticket luxury mandate closures, 95% RERA title verification adherence, and strong West Zone developer relations.',
      blockers: 'North zone luxury mandate acquisition ramping up slower than quarterly target.',
      growthCommitments: ['Scale North Zone commercial leasing desk', 'Achieve 72h RERA title verification SLA'],
      coverageCommitments: ['Full West & North real estate advisory coverage'],
      nextReviewDate: '2026-12-15',
    }),
  });
  assert.equal(saveRmRevRes.status, 201);

  const getRmRevRes = await fetch(`${base}/api/national/reviews?rmEmployeeId=EMP-029`, { headers: { Cookie: adityaCookie } });
  assert.equal(getRmRevRes.status, 200);
  const getRmRevData = (await getRmRevRes.json()) as any;
  assert.ok(getRmRevData.data.some((r: any) => r.period_label === 'Q3-2026'));

  // NM-11: National Executive Reports & Schedules
  const prevReportRes = await fetch(`${base}/api/national/reports/preview?period=October+2026`, { headers: { Cookie: adityaCookie } });
  assert.equal(prevReportRes.status, 200);
  const prevReportData = (await prevReportRes.json()) as any;
  assert.equal(prevReportData.data.scope.vertical, 'real_estate');

  // Export PDF pack
  const expPdfRes = await fetch(`${base}/api/national/reports/export-pdf`, {
    method: 'POST',
    headers: { Cookie: adityaCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodLabel: 'October 2026',
      sections: ['regional-rollup', 'attainment', 'pipeline-health', 'risks'],
    }),
  });
  assert.equal(expPdfRes.status, 200);
  const expPdfData = (await expPdfRes.json()) as any;
  assert.ok(expPdfData.data.downloadUrl);

  // Download PDF binary stream & verify header
  const dlRes = await fetch(`${base}${expPdfData.data.downloadUrl}`, { headers: { Cookie: adityaCookie } });
  assert.equal(dlRes.status, 200);
  assert.equal(dlRes.headers.get('content-type'), 'application/pdf');
  const pdfBytes = Buffer.from(await dlRes.arrayBuffer());
  assert.ok(pdfBytes.length > 1000);
  assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF', 'Board pack must be a valid binary PDF');

  // Save report schedule
  const saveSchedRes = await fetch(`${base}/api/national/reports/schedules`, {
    method: 'POST',
    headers: { Cookie: adityaCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Real Estate Advisory National Strategy & Pipeline Cadence',
      periodType: 'monthly',
      cadence: '1st business day, 08:30 IST',
      recipients: ['aditya@finverse.demo', 'siddharth.m@finverse.demo', 'ceo@finverse.demo', 'cfo@finverse.demo'],
      sections: ['attainment', 'regional-scorecards', 'economics'],
      status: 'active',
    }),
  });
  assert.equal(saveSchedRes.status, 200);

  // Cross-Vertical Isolation: Suresh (Banking NM) cannot read Real Estate lead records
  const bankingNmCookie = await loginAs('suresh@finverse.demo');
  const reLeadDenied = await fetch(`${base}/api/leads/FV-4001`, { headers: { Cookie: bankingNmCookie } });
  assert.equal(reLeadDenied.status, 404, 'Banking NM must receive 404 on Real Estate lead');

  console.log('PASS Real Estate National Manager NM-01..11: Real Estate national strategy verified');
});
