process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { createApp } from '../src/app';
import { assertTestDatabaseGuard, env } from '../src/config';

let server: Server;
let BASE: string;
let db: Pool;

const RUN = `MGT-${Date.now().toString(36)}`;
const TEST_LEAD_ID = `FV-MGT-${Date.now().toString().slice(-4)}`;
const TEST_FORECAST_ID = `FCST-TEST-${Date.now().toString(36)}`;
const TEST_TASK_ID = `TSK-TEST-${Date.now().toString(36)}`;
const TEST_ESCALATION_ID = `ESC-TEST-${Date.now().toString(36)}`;
const TEST_EXCEPTION_ID = `EXC-TEST-${Date.now().toString(36)}`;
const TEST_EXCEPTION_BREACH_ID = `EXC-BREACH-${Date.now().toString(36)}`;

interface Session {
  cookie: string;
  body: any;
}

let neel: Session;
let asha: Session;

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

async function call(
  method: string,
  path: string,
  opts: { json?: unknown; cookie?: string } = {}
) {
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
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      parsed = await res.json();
    } catch {
      /* ignore */
    }
  } else if (contentType.includes('application/pdf')) {
    const buf = await res.arrayBuffer();
    parsed = { isPdf: true, byteLength: buf.byteLength, buffer: Buffer.from(buf) };
  } else {
    parsed = await res.text();
  }
  return { status: res.status, headers: res.headers, body: parsed };
}

async function cleanupTestData() {
  await db.query(`DELETE FROM management_actions WHERE title LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM lead_transfer_requests WHERE reason LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM capacity_plans WHERE name LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM manager_forecasts WHERE risk_notes LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM source_remediations WHERE justification LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM employee_lifecycle_requests WHERE business_justification LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM commercial_exceptions WHERE id IN ($1, $2)`, [TEST_EXCEPTION_ID, TEST_EXCEPTION_BREACH_ID]);
  await db.query(`DELETE FROM overdue_escalations WHERE id = $1`, [TEST_ESCALATION_ID]);
  await db.query(`DELETE FROM lead_tasks WHERE id = $1`, [TEST_TASK_ID]);
  await db.query(`DELETE FROM team_forecasts WHERE id = $1`, [TEST_FORECAST_ID]);
  await db.query(`DELETE FROM reviews WHERE reviewer_employee_id = 'EMP-007' AND period = $1`, [`Rev-${RUN}`]);
  await db.query(`DELETE FROM report_schedules WHERE dedupe_key LIKE $1`, [`%${RUN.toLowerCase()}%`]);
  await db.query(`DELETE FROM lead_ownership_events WHERE lead_id = $1`, [TEST_LEAD_ID]);
  await db.query(`DELETE FROM leads WHERE id = $1`, [TEST_LEAD_ID]);
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  db = new Pool({ connectionString: env.DATABASE_URL });

  // Create isolated seed fixtures for test
  await db.query(`
    INSERT INTO leads (id, vertical, team_id, stage, display_name, phone, preferred_language, product, source, created_at, updated_at)
    VALUES ($1, 'wealth', 'TEAM-WEALTH-ALPHA', 'contacted', 'Manager Test Lead', '+919876500099', 'English', 'V1 Wealth Portfolio', 'Campaign C12', now(), now())
    ON CONFLICT (id) DO NOTHING
  `, [TEST_LEAD_ID]);

  await db.query(`
    INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status, created_at)
    VALUES ($1, $2, 'EMP-001', 'call', 'Initial prospect consultation', now() - interval '2 days', 'high', 'open', now())
    ON CONFLICT (id) DO NOTHING
  `, [TEST_TASK_ID, TEST_LEAD_ID]);

  await db.query(`
    INSERT INTO team_forecasts (id, team_id, period_label, category, expected_revenue, currency, actor_employee_id, status, submitted_at)
    VALUES ($1, 'TEAM-WEALTH-ALPHA', 'October', 'commit', 4500000, 'INR', 'EMP-003', 'submitted', now())
    ON CONFLICT (id) DO NOTHING
  `, [TEST_FORECAST_ID]);

  await db.query(`
    INSERT INTO overdue_escalations (id, task_id, lead_id, subject_employee_id, actor_employee_id, action, reason, severity, manager_notified, created_at)
    VALUES ($1, $2, $3, 'EMP-001', 'EMP-003', 'escalate', 'Callback overdue beyond 48h SLA', 'high', true, now())
    ON CONFLICT (id) DO NOTHING
  `, [TEST_ESCALATION_ID, TEST_TASK_ID, TEST_LEAD_ID]);

  // Standard exception within delegated limit (10% discount)
  await db.query(`
    INSERT INTO commercial_exceptions (id, lead_id, requested_by_employee_id, exception_type, requested_terms, standard_terms, business_justification, delegated_limit_met, status)
    VALUES ($1, $2, 'EMP-001', 'fee-waiver', '10% onboarding fee waiver', 'Standard fee INR 50,000', 'High AUM prospect ($1M+ portfolio)', true, 'pending')
    ON CONFLICT (id) DO NOTHING
  `, [TEST_EXCEPTION_ID, TEST_LEAD_ID]);

  // Exception exceeding Manager authority limit (75% discount) [Deck P151–P152, Deck P320 Cat 3]
  await db.query(`
    INSERT INTO commercial_exceptions (id, lead_id, requested_by_employee_id, exception_type, requested_terms, standard_terms, business_justification, delegated_limit_met, status)
    VALUES ($1, $2, 'EMP-001', 'rate-discount', '75% advisory fee discount', 'Standard advisory fee 1.5% AUM', 'Strategic anchor client family office', false, 'pending')
    ON CONFLICT (id) DO NOTHING
  `, [TEST_EXCEPTION_BREACH_ID, TEST_LEAD_ID]);

  const app = createApp();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as any).port;
  BASE = `http://127.0.0.1:${port}/api`;

  neel = await login('neel@finverse.demo');
  asha = await login('asha@finverse.demo');

  assert.equal(neel.body.session.role, 'MG', 'Neel is Wealth Manager');
  assert.equal(asha.body.session.role, 'SC', 'Asha is Sales Caller');
});

after(async () => {
  await cleanupTestData();
  if (db) await db.end();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

// ─── Test Case 1: Role Access Gate ───
test('MG Role Access Gate: Non-manager roles strictly rejected with 403 on manager endpoints', async () => {
  const ovAsha = await call('GET', '/manager/overview', { cookie: asha.cookie });
  assert.equal(ovAsha.status, 403, 'Asha (SC) denied access to manager overview');

  const tfAsha = await call('GET', '/manager/transfers', { cookie: asha.cookie });
  assert.equal(tfAsha.status, 403, 'Asha (SC) denied access to manager transfers');
});

// ─── Test Case 2: MG-01 Overview & Interventions ───
test('MG-01: Manager Overview & TL Performance Interventions (Deck P135–P136)', async () => {
  const ovRes = await call('GET', '/manager/overview?period=month-to-date&comparison=previous-period', { cookie: neel.cookie });
  assert.equal(ovRes.status, 200, 'MG-01 overview returns 200');
  assert.ok(Array.isArray(ovRes.body.kpis), 'KPI array returned');
  assert.ok(ovRes.body.kpis.length >= 4, 'At least 4 rollup KPIs returned');
  assert.ok(ovRes.body.kpis.every((k: any) => typeof k.formula === 'string' && k.formula.length > 0), 'Every KPI has formula');
  assert.ok(Array.isArray(ovRes.body.tlBreakdown), 'TL breakdown array returned');
  assert.ok(ovRes.body.tlBreakdown.length > 0, 'Assigned TLs listed');
  const sampleTl = ovRes.body.tlBreakdown[0];
  assert.ok(typeof sampleTl.targetPace === 'string', 'Target pace present');
  assert.ok(typeof sampleTl.sampleSize === 'number', 'Sample size present');

  // Create Management Intervention Action
  const actRes = await call('POST', '/manager/actions', {
    cookie: neel.cookie,
    json: {
      sourceAction: 'MG-01',
      kind: 'intervention',
      subjectTlEmployeeId: 'EMP-003',
      ownerEmployeeId: 'EMP-007',
      title: `Intervention for TL Tara ${RUN}`,
      detail: 'Clear overdue aged leads in Wealth Alpha',
      dueAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    },
  });
  assert.equal(actRes.status, 201, 'MG-01 action created with 201');
  assert.equal(actRes.body.status, 'open');

  const listActRes = await call('GET', '/manager/actions?tlId=EMP-003', { cookie: neel.cookie });
  assert.equal(listActRes.status, 200);
  assert.ok(listActRes.body.some((a: any) => a.title.includes(RUN)), 'Created action visible in list');
});

// ─── Test Case 3: MG-02 TL Operating Scorecard ───
test('MG-02: TL Operating Scorecard & Supervised Associates (Deck P137–P138)', async () => {
  const scRes = await call('GET', '/manager/scorecard/EMP-003?period=September', { cookie: neel.cookie });
  assert.equal(scRes.status, 200, 'MG-02 scorecard returns 200');
  assert.equal(scRes.body.tl.id, 'EMP-003');
  assert.ok(Array.isArray(scRes.body.associates), 'Associates list present');
  assert.ok(typeof scRes.body.scorecard.taskAdherence === 'number', 'Task adherence metric present');
  assert.ok(typeof scRes.body.scorecard.conversionRate === 'number', 'Conversion rate metric present');
  assert.ok(Array.isArray(scRes.body.managementActions), 'Management actions present in scorecard');

  const scNotFound = await call('GET', '/manager/scorecard/NON-EXISTENT', { cookie: neel.cookie });
  assert.equal(scNotFound.status, 404, 'Unknown TL returns 404');
});

// ─── Test Case 4: MG-03 Cross-Team Lead Transfer ───
test('MG-03: Cross-Team Lead Transfer Approval & Ownership Event (Deck P139–P140)', async () => {
  const trfRes = await call('POST', '/manager/transfers', {
    cookie: neel.cookie,
    json: {
      sourceTeamId: 'TEAM-WEALTH-ALPHA',
      destinationTeamId: 'TEAM-WEALTH-BETA',
      leadIds: [TEST_LEAD_ID],
      reason: `Skill match transfer ${RUN}`,
    },
  });
  assert.equal(trfRes.status, 201, 'MG-03 transfer request created');
  const transferId = trfRes.body.id;

  // Cross-scope failure check: Out-of-scope team rejected
  const badTrf = await call('POST', '/manager/transfers', {
    cookie: neel.cookie,
    json: {
      sourceTeamId: 'TEAM-WEALTH-ALPHA',
      destinationTeamId: 'TEAM-BANKING-CORP',
      leadIds: [TEST_LEAD_ID],
      reason: 'Invalid cross-vertical destination',
    },
  });
  assert.equal(badTrf.status, 403, 'Cross-vertical transfer without RM approval rejected');

  // List transfers
  const listTrf = await call('GET', '/manager/transfers', { cookie: neel.cookie });
  assert.equal(listTrf.status, 200);
  assert.ok(listTrf.body.some((t: any) => t.id === transferId));

  // Approve Transfer & Verify Ownership Event
  const decRes = await call('POST', '/manager/transfers/decide', {
    cookie: neel.cookie,
    json: {
      transferId: transferId,
      decision: 'approved',
      resolutionNotes: 'Approved based on senior caller specialization in Beta',
    },
  });
  assert.equal(decRes.status, 200, 'MG-03 decide transfer returns 200');
  assert.equal(decRes.body.status, 'approved');

  // Verify DB state
  const { rows: [leadRow] } = await db.query(`SELECT team_id FROM leads WHERE id = $1`, [TEST_LEAD_ID]);
  assert.equal(leadRow.team_id, 'TEAM-WEALTH-BETA', 'Lead moved to destination team');

  const { rows: [evtRow] } = await db.query(
    `SELECT * FROM lead_ownership_events WHERE lead_id = $1 AND kind = 'transfer' ORDER BY changed_at DESC LIMIT 1`,
    [TEST_LEAD_ID]
  );
  assert.ok(evtRow, 'lead_ownership_event written');
  assert.equal(evtRow.actor_role, 'MG', 'Actor recorded as MG');
});

// ─── Test Case 5: MG-04 Capacity Recovery Plan ───
test('MG-04: Capacity Recovery Plan Formulation & Utilization (Deck P141–P142)', async () => {
  const capRes = await call('GET', '/manager/capacity', { cookie: neel.cookie });
  assert.equal(capRes.status, 200, 'MG-04 capacity overview returns 200');
  assert.ok(typeof capRes.body.totalBacklog === 'number', 'Total backlog present');
  assert.ok(typeof capRes.body.totalAvailableCallers === 'number', 'Total available callers present');
  assert.equal(capRes.body.capacityCap, 20, 'Capacity cap is 20 per caller');
  assert.ok(Array.isArray(capRes.body.teams), 'Teams array returned');

  const planRes = await call('POST', '/manager/capacity/plan', {
    cookie: neel.cookie,
    json: {
      name: `Q4 Capacity Plan ${RUN}`,
      periodLabel: 'October',
      teamIds: ['TEAM-WEALTH-ALPHA', 'TEAM-WEALTH-BETA'],
      currentBacklog: capRes.body.totalBacklog,
      availableCallers: capRes.body.totalAvailableCallers,
      requiredAdditionalStaff: 2,
      plannedReallocations: [{ fromTeamId: 'TEAM-WEALTH-BETA', toTeamId: 'TEAM-WEALTH-ALPHA', leadCount: 5 }],
      notes: 'Capacity shift to absorb IPO campaign surge',
      approved: true,
    },
  });
  assert.equal(planRes.status, 201, 'MG-04 plan created with 201');
  assert.equal(planRes.body.status, 'approved');
});

// ─── Test Case 6: MG-05 Target Allocation ───
test('MG-05: Target Allocation with Visible Remainder (Deck P143–P144)', async () => {
  const tgtRes = await call('GET', '/manager/targets?period=October', { cookie: neel.cookie });
  assert.equal(tgtRes.status, 200, 'MG-05 targets overview returns 200');
  assert.ok(tgtRes.body.target, 'Target object present');
  const parentVal = Number(tgtRes.body.target.approved_parent_target ?? tgtRes.body.target.approvedParentTarget);
  assert.ok(!isNaN(parentVal) && parentVal >= 0, 'Approved parent target present');
  assert.ok(Array.isArray(tgtRes.body.tls), 'TLS array present');

  // Allocate targets
  const allocRes = await call('POST', '/manager/targets/allocate', {
    cookie: neel.cookie,
    json: {
      periodLabel: 'October',
      metric: 'approved-wins',
      approvedParentTarget: 100,
      tlAllocations: [
        { teamId: 'TEAM-WEALTH-ALPHA', tlEmployeeId: 'EMP-003', allocatedValue: 40 },
        { teamId: 'TEAM-WEALTH-BETA', tlEmployeeId: 'EMP-004', allocatedValue: 35 },
      ],
      publish: true,
    },
  });
  assert.equal(allocRes.status, 200, 'MG-05 allocate returns 200');
  assert.equal(Number(allocRes.body.unallocated_remainder), 25, 'Visible unallocated remainder is 25');
  assert.equal(allocRes.body.status, 'published');
});

// ─── Test Case 7: MG-06 TL Forecast Review & Challenge ───
test('MG-06: TL Forecast Review, Challenge & Acceptance (Deck P145–P146)', async () => {
  const fcList = await call('GET', '/manager/forecasts?period=October', { cookie: neel.cookie });
  assert.equal(fcList.status, 200, 'MG-06 list forecasts returns 200');
  assert.ok(Array.isArray(fcList.body), 'Forecasts array returned');
  assert.ok(fcList.body.some((f: any) => f.id === TEST_FORECAST_ID), 'Test forecast visible');

  // Accept Forecast
  const accFcst = await call('POST', '/manager/forecasts/decide', {
    cookie: neel.cookie,
    json: {
      forecastId: TEST_FORECAST_ID,
      decision: 'accepted',
      feedback: 'Approved commit pipeline for October.',
    },
  });
  assert.equal(accFcst.status, 200, 'MG-06 forecast acceptance returns 200');
  assert.equal(accFcst.body.manager_decision, 'accepted');

  // Return Forecast with Correction Feedback
  const retFcst = await call('POST', '/manager/forecasts/decide', {
    cookie: neel.cookie,
    json: {
      forecastId: TEST_FORECAST_ID,
      decision: 'returned',
      feedback: 'Please revise best-case scenario downwards by INR 500,000.',
    },
  });
  assert.equal(retFcst.status, 200, 'MG-06 forecast return returns 200');
  assert.equal(retFcst.body.manager_decision, 'returned');

  // Re-accept so it participates in rollup
  await call('POST', '/manager/forecasts/decide', {
    cookie: neel.cookie,
    json: {
      forecastId: TEST_FORECAST_ID,
      decision: 'accepted',
      feedback: 'Re-accepted for monthly rollup.',
    },
  });
});

// ─── Test Case 8: MG-07 Consolidated Forecast Submission ───
test('MG-07: Manager Consolidated Forecast Submission to RM (Deck P147–P148)', async () => {
  const rollupRes = await call('GET', '/manager/forecasts/rollup?period=October', { cookie: neel.cookie });
  assert.equal(rollupRes.status, 200, 'MG-07 rollup returns 200');
  assert.ok(rollupRes.body.acceptedCount >= 1, 'At least 1 accepted forecast');
  assert.ok(rollupRes.body.bottomUpRevenue >= 4500000, 'Bottom-up revenue sums accepted forecast');

  const subFcst = await call('POST', '/manager/forecasts/submit', {
    cookie: neel.cookie,
    json: {
      periodLabel: 'October',
      bottomUpRevenue: rollupRes.body.bottomUpRevenue,
      managementAdjustment: -200000,
      adjustedRevenue: rollupRes.body.bottomUpRevenue - 200000,
      currency: 'INR',
      acceptedForecastIds: [TEST_FORECAST_ID],
      overrideReason: 'Conservative adjustment for Diwali festival week backlog',
      riskNotes: `Capacity shortfall in Wealth Alpha ${RUN}`,
    },
  });
  assert.equal(subFcst.status, 201, 'MG-07 submit forecast to RM returns 201');
  assert.equal(subFcst.body.status, 'submitted_to_rm');
});

// ─── Test Case 9: MG-08 Repeated SLA Failure Resolution ───
test('MG-08: Repeated SLA Breach Resolution & Action Logging (Deck P149–P150)', async () => {
  const slaList = await call('GET', '/manager/sla-breaches', { cookie: neel.cookie });
  assert.equal(slaList.status, 200, 'MG-08 SLA breaches list returns 200');
  assert.ok(slaList.body.some((e: any) => e.id === TEST_ESCALATION_ID));

  const slaRes = await call('POST', '/manager/sla-breaches/resolve', {
    cookie: neel.cookie,
    json: {
      escalationId: TEST_ESCALATION_ID,
      actionType: 'corrective-action',
      resolutionPlan: `Accountable recovery plan created by Manager ${RUN}`,
      deadlineHours: 48,
    },
  });
  assert.equal(slaRes.status, 200, 'MG-08 SLA resolution returns 200');
  assert.equal(slaRes.body.success, true);
  assert.ok(slaRes.body.recoveryActionId, 'Recovery management action created');
});

// ─── Test Case 10: MG-09 Commercial Exceptions & Authority Limits ───
test('MG-09: Delegated Commercial Exception Approval, RM Escalation & Authority Limits (Deck P151–P152, Deck P320 Cat 3)', async () => {
  const excList = await call('GET', '/manager/commercial-exceptions', { cookie: neel.cookie });
  assert.equal(excList.status, 200, 'MG-09 list exceptions returns 200');
  assert.ok(excList.body.some((e: any) => e.id === TEST_EXCEPTION_ID), 'Within-limit exception listed');
  assert.ok(excList.body.some((e: any) => e.id === TEST_EXCEPTION_BREACH_ID), 'Exceeding-limit exception listed');

  // NEGATIVE TEST 1: Manager approval BLOCKED server-side when requested terms exceed delegated limit
  const unauthorizedApproval = await call('POST', '/manager/commercial-exceptions/decide', {
    cookie: neel.cookie,
    json: {
      exceptionId: TEST_EXCEPTION_BREACH_ID,
      decision: 'approved',
      decisionNotes: 'Manager attempted unauthorized approval above authority limit',
      delegatedLimitMet: false,
    },
  });
  assert.equal(unauthorizedApproval.status, 403, 'Server strictly rejects approval exceeding Manager delegated limit with 403 FORBIDDEN');

  // PERMITTED ESCALATION: Manager escalates breach exception to Regional Manager
  const permittedEscalation = await call('POST', '/manager/commercial-exceptions/decide', {
    cookie: neel.cookie,
    json: {
      exceptionId: TEST_EXCEPTION_BREACH_ID,
      decision: 'escalated_to_rm',
      decisionNotes: 'Discount 75% exceeds Wealth Manager authority threshold. Escalated to RM per policy.',
      delegatedLimitMet: false,
    },
  });
  assert.equal(permittedEscalation.status, 200, 'Escalation to RM returns 200');
  assert.equal(permittedEscalation.body.status, 'escalated_to_rm');
  assert.equal(permittedEscalation.body.delegated_limit_met, false);

  // PERMITTED APPROVAL: Manager approves within-limit exception
  const permittedApproval = await call('POST', '/manager/commercial-exceptions/decide', {
    cookie: neel.cookie,
    json: {
      exceptionId: TEST_EXCEPTION_ID,
      decision: 'approved',
      decisionNotes: '10% onboarding fee waiver is within Manager delegated limit of 25%.',
      delegatedLimitMet: true,
    },
  });
  assert.equal(permittedApproval.status, 200, 'Permitted approval returns 200');
  assert.equal(permittedApproval.body.status, 'approved');
  assert.equal(permittedApproval.body.delegated_limit_met, true);

  // NEGATIVE TEST 2: Cannot re-decide an already finalized exception (returns 400 VALIDATION_FAILED)
  const redecideAttempt = await call('POST', '/manager/commercial-exceptions/decide', {
    cookie: neel.cookie,
    json: {
      exceptionId: TEST_EXCEPTION_ID,
      decision: 'rejected',
      decisionNotes: 'Attempting to reject an already approved exception',
      delegatedLimitMet: true,
    },
  });
  assert.equal(redecideAttempt.status, 400, 'Cannot re-decide finalized exception');
});

// ─── Test Case 11: MG-10 Source Quality Remediation ───
test('MG-10: Source Quality Remediation & Funnel Breakdown (Deck P153–P154)', async () => {
  const sqRes = await call('GET', '/manager/source-quality?period=September', { cookie: neel.cookie });
  assert.equal(sqRes.status, 200, 'MG-10 source quality returns 200');
  assert.ok(Array.isArray(sqRes.body.sources), 'Sources array returned');

  const remRes = await call('POST', '/manager/source-quality/remediation', {
    cookie: neel.cookie,
    json: {
      sourceName: 'Campaign C12',
      cohortPeriod: 'September',
      sampleSize: 100,
      invalidIntakeCount: 12,
      contactFailedCount: 30,
      commercialLossCount: 20,
      remediationType: 'routing-change',
      justification: `High invalid contact rate on campaign leads ${RUN}`,
    },
  });
  assert.equal(remRes.status, 201, 'MG-10 remediation request created with 201');
  assert.equal(remRes.body.status, 'submitted');
});

// ─── Test Case 12: MG-11 TL Performance Review ───
test('MG-11: TL Performance Review Submission & Commitments (Deck P155–P156)', async () => {
  const revRes = await call('POST', '/manager/reviews', {
    cookie: neel.cookie,
    json: {
      subjectTlEmployeeId: 'EMP-003',
      periodLabel: `Rev-${RUN}`,
      strengths: 'Excellent caller enablement and rigorous SLA monitoring in Alpha.',
      blockers: 'Backlog in evening callback slots during high-volume intake days.',
      commitments: [
        { dimension: 'SLA Adherence', goal: 'Maintain >95% first contact SLA', targetDate: '2026-10-31' },
      ],
      supportNeeded: 'Provide 1 additional junior caller during 18:00-20:00 shifts.',
    },
  });
  assert.equal(revRes.status, 201, 'MG-11 review created with 201');
  assert.equal(revRes.body.reviewer_employee_id, 'EMP-007');

  const revList = await call('GET', '/manager/reviews?tlId=EMP-003', { cookie: neel.cookie });
  assert.equal(revList.status, 200);
  assert.ok(revList.body.some((r: any) => r.id === revRes.body.id));
});

// ─── Test Case 13: MG-12 Employee Lifecycle Request ───
test('MG-12: Employee Lifecycle Transfer/Promotion Request (Deck P157–P158)', async () => {
  const lcRes = await call('POST', '/manager/lifecycle', {
    cookie: neel.cookie,
    json: {
      employeeId: 'EMP-001', // Asha
      proposedRole: 'TL',
      proposedTeamId: 'TEAM-WEALTH-ALPHA',
      effectiveDate: '2026-11-01',
      businessJustification: `Consistent top conversion performer in Alpha; ready for TL leadership ${RUN}`,
      handoffPlan: 'Reassign 18 active prospect accounts to caller Vivek before effective date',
    },
  });
  assert.equal(lcRes.status, 201, 'MG-12 lifecycle request created with 201');
  assert.equal(lcRes.body.status, 'submitted');

  const lcList = await call('GET', '/manager/lifecycle', { cookie: neel.cookie });
  assert.equal(lcList.status, 200);
  assert.ok(lcList.body.some((l: any) => l.id === lcRes.body.id));
});

// ─── Test Case 14: MG-13 Audited Meeting Pack PDF & Schedules ───
test('MG-13: Audited Meeting Pack Binary PDF Generation & Schedule (Deck P159–P160)', async () => {
  const prevRes = await call('GET', '/manager/meeting-pack/preview?period=month-to-date', { cookie: neel.cookie });
  assert.equal(prevRes.status, 200, 'MG-13 preview returns 200');
  assert.ok(prevRes.body.period, 'Period in preview');
  assert.ok(Array.isArray(prevRes.body.kpis), 'KPI array in preview');
  assert.ok(Array.isArray(prevRes.body.tlAppendix), 'TL appendix in preview');

  // Export PDF
  const expRes = await call('POST', '/manager/meeting-pack/export', {
    cookie: neel.cookie,
    json: {
      period: 'month-to-date',
      format: 'pdf',
    },
  });
  assert.equal(expRes.status, 201, 'MG-13 export returns 201');
  assert.ok(expRes.body.id, 'Export ID generated');
  assert.ok(expRes.body.filename, 'Export filename generated');

  // Download PDF
  const dlRes = await call('GET', `/manager/meeting-pack/download/${expRes.body.id}`, { cookie: neel.cookie });
  assert.equal(dlRes.status, 200, 'PDF download returns 200');
  assert.equal(dlRes.headers.get('content-type'), 'application/pdf');
  assert.ok(dlRes.body.isPdf, 'Response is binary PDF');
  assert.ok(dlRes.body.byteLength > 1000, `PDF size is valid (${dlRes.body.byteLength} bytes)`);

  // Recurring Schedule
  const schedRes = await call('POST', '/manager/schedules', {
    cookie: neel.cookie,
    json: {
      name: `Weekly Review Pack ${RUN}`,
      cadence: 'weekly',
      period: 'this-week',
      recipients: ['neel@finverse.demo'],
    },
  });
  assert.equal(schedRes.status, 201, 'MG-13 schedule created with 201');
  assert.equal(schedRes.body.cadence, 'weekly');
});
