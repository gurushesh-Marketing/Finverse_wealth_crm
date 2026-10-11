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

const RUN = `RMT-${Date.now().toString(36)}`;
const TEST_LEAD_ID = `FV-RMT-${Date.now().toString().slice(-4)}`;
const TEST_FOREIGN_LEAD_ID = `LEAD-FOREIGN-${Date.now().toString(36)}`;
const TEST_MGR_FCST_ID = `MFCST-${Date.now().toString(36)}`;
const TEST_CE_ID = `CE-${Date.now().toString(36)}`;

interface Session {
  cookie: string;
  body: any;
}

let kavita: Session;
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
  await db.query(`DELETE FROM cross_manager_transfers WHERE reason LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM territory_coverage_plans WHERE territory_name LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM regional_staffing_plans WHERE business_justification LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM regional_forecasts WHERE regional_assumptions LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM regional_escalations WHERE title LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM manager_reviews WHERE rm_employee_id = 'EMP-008' AND period_label = $1`, [`Q3-${RUN}`]);
  await db.query(`DELETE FROM commercial_exceptions WHERE id = $1`, [TEST_CE_ID]);
  await db.query(`DELETE FROM manager_forecasts WHERE id = $1`, [TEST_MGR_FCST_ID]);
  await db.query(`DELETE FROM report_schedules WHERE dedupe_key LIKE $1`, [`%${RUN.toLowerCase()}%`]);
  await db.query(`DELETE FROM lead_events WHERE lead_id = $1`, [TEST_LEAD_ID]);
  await db.query(`DELETE FROM leads WHERE id IN ($1, $2)`, [TEST_LEAD_ID, TEST_FOREIGN_LEAD_ID]);
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  db = new Pool({ connectionString: env.DATABASE_URL });

  // Create isolated seed fixtures for test
  await db.query(
    `INSERT INTO leads (id, vertical, team_id, stage, display_name, phone, preferred_language, product, source, created_at, updated_at)
     VALUES ($1, 'wealth', 'TEAM-WEALTH-ALPHA', 'contacted', 'Regional Test Lead', '+919876543210', 'English', 'V1 Wealth Portfolio', 'Direct Inbound', now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [TEST_LEAD_ID]
  );

  // Foreign banking lead outside Kavita's scope
  await db.query(
    `INSERT INTO leads (id, vertical, team_id, stage, display_name, phone, preferred_language, product, source, created_at, updated_at)
     VALUES ($1, 'banking', 'TEAM-BANKING-ALPHA', 'contacted', 'Banking Foreign Lead', '+919876543211', 'English', 'Corporate Term Loan', 'Branch Intake', now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [TEST_FOREIGN_LEAD_ID]
  );

  // Manager forecast for EMP-007
  await db.query(
    `INSERT INTO manager_forecasts (id, manager_employee_id, period_label, bottom_up_revenue, management_adjustment, adjusted_revenue, risk_notes, status, submitted_at, created_at)
     VALUES ($1, 'EMP-007', 'October', 8500000, 0, 8500000, 'Strong HNI pipeline conversion', 'submitted_to_rm', now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [TEST_MGR_FCST_ID]
  );

  // Commercial exception escalated to RM
  await db.query(
    `INSERT INTO commercial_exceptions (id, lead_id, requested_by_employee_id, exception_type, requested_terms, standard_terms, business_justification, delegated_limit_met, status)
     VALUES ($1, $2, 'EMP-001', 'fee-waiver', '15% advisory fee discount', 'Standard fee 1.5%', 'Strategic key client', false, 'escalated_to_rm')
     ON CONFLICT (id) DO NOTHING`,
    [TEST_CE_ID, TEST_LEAD_ID]
  );

  const app = createApp();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as any).port;
  BASE = `http://127.0.0.1:${port}/api`;

  kavita = await login('kavita@finverse.demo');
  neel = await login('neel@finverse.demo');
  asha = await login('asha@finverse.demo');
});

after(async () => {
  try {
    await cleanupTestData();
  } catch {
    /* ignore cleanup errors */
  }
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (db) await db.end();
});

test('Security: Non-RM roles are forbidden from regional manager workspace', async () => {
  // Neel Verma (MG) -> 403
  const mgRes = await call('GET', '/regional/overview', { cookie: neel.cookie });
  assert.equal(mgRes.status, 403);
  assert.equal(mgRes.body?.error?.code, 'FORBIDDEN');

  // Asha Rao (SC) -> 403
  const scRes = await call('GET', '/regional/overview', { cookie: asha.cookie });
  assert.equal(scRes.status, 403);
  assert.equal(scRes.body?.error?.code, 'FORBIDDEN');

  // Kavita Rao (RM) -> 200
  const rmRes = await call('GET', '/regional/overview', { cookie: kavita.cookie });
  assert.equal(rmRes.status, 200);
});

test('Scope: Returns assigned region, teams, and managers for Regional Manager', async () => {
  const res = await call('GET', '/regional/scope', { cookie: kavita.cookie });
  assert.equal(res.status, 200);
  assert.ok(res.body.data.regionId);
  assert.ok(res.body.data.teams.length >= 1);
  assert.ok(res.body.data.managers.some((m: any) => m.id === 'EMP-007'));
});

test('RM-01: Regional Overview returns KPIs, manager breakdown, and creates action', async () => {
  const getRes = await call('GET', '/regional/overview?period=month-to-date', { cookie: kavita.cookie });
  assert.equal(getRes.status, 200);
  const data = getRes.body.data;
  assert.ok(data.region.name);
  assert.ok(typeof data.target.parentTarget === 'number');
  assert.ok(typeof data.target.achievedWins === 'number');
  assert.ok(Array.isArray(data.managers));
  assert.ok(Array.isArray(data.sourceMix));

  // Create regional management intervention action
  const actionRes = await call('POST', '/regional/actions', {
    cookie: kavita.cookie,
    json: {
      sourceAction: 'RM-01',
      kind: 'regional-intervention',
      subjectManagerEmployeeId: 'EMP-007',
      ownerEmployeeId: 'EMP-008',
      title: `Intervention on HNI Pace ${RUN}`,
      detail: 'Accelerate high net worth client onboarding',
      dueAt: new Date(Date.now() + 86400000 * 3).toISOString(),
    },
  });
  assert.equal(actionRes.status, 201);
  assert.ok(actionRes.body.data.id);

  // List regional actions
  const listRes = await call('GET', '/regional/actions?managerId=EMP-007', { cookie: kavita.cookie });
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.data.some((a: any) => a.title.includes(RUN)));
});

test('RM-02: Manager Scorecard retrieves in-scope scorecard and 404s for unknown manager', async () => {
  const res = await call('GET', '/regional/managers/EMP-007/scorecard?period=September', { cookie: kavita.cookie });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.manager.id, 'EMP-007');
  assert.ok(typeof res.body.data.performance.attainmentRate === 'number');
  assert.ok(Array.isArray(res.body.data.teamLeads));

  // Unknown manager
  const notFoundRes = await call('GET', '/regional/managers/EMP-NONEXISTENT/scorecard', { cookie: kavita.cookie });
  assert.equal(notFoundRes.status, 404);
});

test('RM-03: Territory Coverage retrieves coverage and saves new coverage plan', async () => {
  const getRes = await call('GET', '/regional/territories', { cookie: kavita.cookie });
  assert.equal(getRes.status, 200);
  assert.ok(Array.isArray(getRes.body.data.teamStats));
  assert.ok(Array.isArray(getRes.body.data.languageQueues));

  // Save territory plan
  const planRes = await call('POST', '/regional/territories', {
    cookie: kavita.cookie,
    json: {
      territoryName: `South Metro Expansion ${RUN}`,
      subRegion: 'Karnataka South Hub',
      productScope: 'Wealth Elite & Advisory',
      languageQueues: ['English', 'Kannada'],
      targetTeamIds: ['TEAM-WEALTH-ALPHA'],
      capacityGap: 5,
      routingProposal: 'Direct high-net-worth inbound routing to senior wealth advisors',
      activationDate: '2026-11-01',
      status: 'submitted_for_activation',
    },
  });
  assert.equal(planRes.status, 201);
  assert.equal(planRes.body.data.territory_name, `South Metro Expansion ${RUN}`);
});

test('RM-04: Regional Targets cascades allocation to manager targets and rejects over-allocation', async () => {
  const getRes = await call('GET', '/regional/targets', { cookie: kavita.cookie });
  assert.equal(getRes.status, 200);
  assert.ok(getRes.body.data.activeTarget);

  // Over-allocation test (exceeds approvedNmTarget)
  const overAllocRes = await call('POST', '/regional/targets/allocate', {
    cookie: kavita.cookie,
    json: {
      approvedNmTarget: 100,
      periodLabel: `October-${RUN}`,
      managerAllocations: [{ managerEmployeeId: 'EMP-007', targetWins: 150 }],
      publish: true,
    },
  });
  assert.equal(overAllocRes.status, 400);

  // Valid allocation
  const validAllocRes = await call('POST', '/regional/targets/allocate', {
    cookie: kavita.cookie,
    json: {
      approvedNmTarget: 200,
      periodLabel: `October-${RUN}`,
      managerAllocations: [{ managerEmployeeId: 'EMP-007', targetWins: 120 }],
      publish: true,
    },
  });
  assert.equal(validAllocRes.status, 201);
  assert.equal(Number(validAllocRes.body.data.unallocated_remainder), 80);
});

test('RM-05: Cross-Manager Transfers enforces scope, atomic execution, and guards already-decided', async () => {
  // Reject transfer for foreign lead outside team scope
  const foreignRes = await call('POST', '/regional/transfers', {
    cookie: kavita.cookie,
    json: {
      sourceManagerEmployeeId: 'EMP-007',
      destinationManagerEmployeeId: 'EMP-007',
      sourceTeamId: 'TEAM-BANKING-ALPHA',
      destinationTeamId: 'TEAM-WEALTH-ALPHA',
      leadIds: [TEST_FOREIGN_LEAD_ID],
      reason: `Transfer foreign banking lead ${RUN}`,
    },
  });
  assert.equal(foreignRes.status, 403);

  // Create valid cross-manager transfer request
  const createRes = await call('POST', '/regional/transfers', {
    cookie: kavita.cookie,
    json: {
      sourceManagerEmployeeId: 'EMP-007',
      destinationManagerEmployeeId: 'EMP-007',
      sourceTeamId: 'TEAM-WEALTH-ALPHA',
      destinationTeamId: 'TEAM-WEALTH-BETA',
      leadIds: [TEST_LEAD_ID],
      reason: `Cross-territory rebalancing ${RUN}`,
      forecastImpactNotes: 'Expected +15% conversion in Beta territory',
    },
  });
  assert.equal(createRes.status, 201);
  const transferId = createRes.body.data.id;
  assert.ok(transferId);

  // List transfers
  const listRes = await call('GET', '/regional/transfers', { cookie: kavita.cookie });
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.data.some((t: any) => t.id === transferId));

  // Approve transfer atomically
  const decideRes = await call('POST', '/regional/transfers/decide', {
    cookie: kavita.cookie,
    json: {
      transferId,
      decision: 'approved',
      resolutionNotes: `Approved rebalancing ${RUN}`,
    },
  });
  assert.equal(decideRes.status, 200);
  assert.equal(decideRes.body.data.status, 'approved');

  // Verify lead was moved to TEAM-WEALTH-BETA
  const { rows: leadRows } = await db.query('SELECT team_id FROM leads WHERE id = $1', [TEST_LEAD_ID]);
  assert.equal(leadRows[0].team_id, 'TEAM-WEALTH-BETA');

  // Guard: repeated decision on already-decided transfer returns 400 ALREADY_DECIDED
  const repeatRes = await call('POST', '/regional/transfers/decide', {
    cookie: kavita.cookie,
    json: {
      transferId,
      decision: 'rejected',
      resolutionNotes: 'Attempted duplicate decision',
    },
  });
  assert.equal(repeatRes.status, 400);
  assert.equal(repeatRes.body.error.code, 'VALIDATION_FAILED');
  assert.equal(repeatRes.body.error.details.fieldErrors.status[0], 'ALREADY_DECIDED');
});

test('RM-06: Regional Staffing returns capacity breakdown and updates staffing plan', async () => {
  const getRes = await call('GET', '/regional/staffing', { cookie: kavita.cookie });
  assert.equal(getRes.status, 200);
  assert.ok(typeof getRes.body.data.totalCallers === 'number');
  assert.ok(Array.isArray(getRes.body.data.teams));

  // Save staffing plan
  const planRes = await call('POST', '/regional/staffing', {
    cookie: kavita.cookie,
    json: {
      periodLabel: 'Q4 2026',
      plannedHeadcount: 24,
      approvedHeadcount: 20,
      activeHeadcount: 18,
      requisitions: [
        {
          title: 'Senior Portfolio Advisor',
          teamId: 'TEAM-WEALTH-ALPHA',
          count: 2,
          justification: 'High lead intake coverage',
          priority: 'high',
        },
      ],
      businessJustification: `Staffing ramp for Q4 wealth targets ${RUN}`,
      status: 'approved_by_rm',
    },
  });
  assert.equal(planRes.status, 201);
  assert.equal(planRes.body.data.planned_headcount, 24);
});

test('RM-07: Regional Forecast aggregates bottom-up revenue and submits to NM', async () => {
  const getRes = await call('GET', '/regional/forecasts?period=October', { cookie: kavita.cookie });
  assert.equal(getRes.status, 200);
  assert.ok(typeof getRes.body.data.bottomUpSum === 'number');
  assert.ok(Array.isArray(getRes.body.data.managerSubmissions));

  // Submit regional forecast
  const submitRes = await call('POST', '/regional/forecasts/submit', {
    cookie: kavita.cookie,
    json: {
      periodLabel: 'October',
      acceptedManagerForecastIds: [TEST_MGR_FCST_ID],
      regionalAdjustment: 500000,
      topRegionalRisks: [
        { title: 'Diwali market volatility', severity: 'medium', impact: 'Moderate delay in final conversions' },
      ],
      regionalAssumptions: `Conservative +5L adjustment based on mature pipeline ${RUN}`,
      submitToNm: true,
    },
  });
  assert.equal(submitRes.status, 201);
  assert.equal(submitRes.body.data.status, 'submitted_to_nm');
  assert.equal(Number(submitRes.body.data.adjusted_revenue), 8500000 + 500000);
});

test('RM-08: Regional Escalations lists items, creates escalation, and resolves commercial exception', async () => {
  const listRes = await call('GET', '/regional/escalations', { cookie: kavita.cookie });
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.data.some((e: any) => e.id === TEST_CE_ID));

  // Create regional escalation
  const createRes = await call('POST', '/regional/escalations', {
    cookie: kavita.cookie,
    json: {
      sourceType: 'operational_risk',
      title: `Escalation on KYC Cycle Time ${RUN}`,
      severity: 'high',
      accountableManagerEmployeeId: 'EMP-007',
      detail: 'KYC turnaround exceeding 72h SLA across Beta team',
      deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
    },
  });
  assert.equal(createRes.status, 201);
  const escalationId = createRes.body.data.id;

  // Resolve escalation with recovery plan
  const resolveRes = await call('POST', '/regional/escalations/resolve', {
    cookie: kavita.cookie,
    json: {
      escalationId,
      decision: 'resolved',
      recoveryDecision: `Dedicated verification specialist assigned ${RUN}`,
    },
  });
  assert.equal(resolveRes.status, 200);
  assert.equal(resolveRes.body.data.status, 'resolved');

  // Resolve commercial exception (CE-*) with RM decision
  const resolveCeRes = await call('POST', '/regional/escalations/resolve', {
    cookie: kavita.cookie,
    json: {
      escalationId: TEST_CE_ID,
      decision: 'resolved',
      recoveryDecision: 'Approved with condition of 2-year lock-in advisory commitment',
    },
  });
  assert.equal(resolveCeRes.status, 200);
});

test('RM-09: Manager Reviews enforces manager scope and saves performance review', async () => {
  // Attempting to review non-manager employee (Asha Rao, SC) returns 403
  const forbiddenRes = await call('POST', '/regional/reviews', {
    cookie: kavita.cookie,
    json: {
      managerEmployeeId: 'EMP-001',
      periodLabel: `Q3-${RUN}`,
      performanceRating: 'achieving',
      strengths: 'Strong caller performance',
      blockers: 'None noted',
      improvementCommitments: ['Maintain daily dial rate'],
      nextReviewDate: '2026-11-15',
    },
  });
  assert.equal(forbiddenRes.status, 403);

  // Valid review for Neel Verma (MG)
  const validRes = await call('POST', '/regional/reviews', {
    cookie: kavita.cookie,
    json: {
      managerEmployeeId: 'EMP-007',
      periodLabel: `Q3-${RUN}`,
      performanceRating: 'exceeding',
      strengths: 'Exceptional team leadership and quota attainment in Alpha team',
      blockers: 'Capacity bottleneck in South Karnataka',
      improvementCommitments: ['Ramp 2 junior advisors', 'Reduce intake aging to under 24h'],
      supportActions: 'Allocate 2 additional headcounts from Q4 pool',
      nextReviewDate: '2026-11-30',
      acknowledged: false,
    },
  });
  assert.equal(validRes.status, 201);
  assert.equal(validRes.body.data.manager_employee_id, 'EMP-007');

  // List reviews
  const listRes = await call('GET', '/regional/reviews?managerId=EMP-007', { cookie: kavita.cookie });
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.data.some((r: any) => r.period_label === `Q3-${RUN}`));
});

test('RM-10: Reports & Schedules generates PDF, downloads binary stream, and manages schedule', async () => {
  // Preview
  const previewRes = await call('GET', '/regional/reports/preview?period=October%202026', { cookie: kavita.cookie });
  assert.equal(previewRes.status, 200);
  assert.ok(previewRes.body.data.scope.name);

  // Generate PDF pack
  const pdfGenRes = await call('POST', '/regional/reports/generate-pdf', {
    cookie: kavita.cookie,
    json: {
      period: 'October 2026',
      sections: ['Scorecards', 'Forecast Rollup', 'Escalations'],
      title: 'October 2026 Regional Executive Review Pack',
    },
  });
  assert.equal(pdfGenRes.status, 200);
  const downloadUrl = pdfGenRes.body.data.downloadUrl;
  assert.ok(downloadUrl);

  // Download PDF
  const downloadRes = await call('GET', downloadUrl.replace('/api', ''), { cookie: kavita.cookie });
  assert.equal(downloadRes.status, 200);
  assert.ok(downloadRes.body.isPdf);
  assert.ok(downloadRes.body.byteLength > 100);
  // Verify PDF magic header %PDF
  const pdfHeader = downloadRes.body.buffer.subarray(0, 4).toString('utf-8');
  assert.equal(pdfHeader, '%PDF');

  // Save report schedule
  const scheduleRes = await call('POST', '/regional/reports/schedules', {
    cookie: kavita.cookie,
    json: {
      name: `Weekly Regional Governance Pack ${RUN}`,
      periodType: 'weekly',
      cadence: 'Monday 08:00 IST',
      recipients: ['kavita@finverse.demo', 'nm.wealth@finverse.demo'],
      sections: ['Executive KPI Summary', 'Manager Scorecards', 'Territory Capacity'],
      status: 'active',
    },
  });
  assert.equal(scheduleRes.status, 201);
  assert.equal(scheduleRes.body.data.name, `Weekly Regional Governance Pack ${RUN}`);

  // List schedules
  const listSchedRes = await call('GET', '/regional/reports/schedules', { cookie: kavita.cookie });
  assert.equal(listSchedRes.status, 200);
  assert.ok(listSchedRes.body.data.some((s: any) => s.name.includes(RUN)));
});
