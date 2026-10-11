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

const RUN = `NMT-${Date.now().toString(36)}`;
const TEST_LEAD_ID = `FV-NMT-${Date.now().toString().slice(-4)}`;
const TEST_FOREIGN_LEAD_ID = `LEAD-FOREIGN-NM-${Date.now().toString(36)}`;
const TEST_REFERRAL_ID = `REF-NM-${Date.now().toString(36)}`;

interface Session {
  cookie: string;
  body: any;
}

let vikram: Session; // NM (EMP-009)
let kavita: Session; // RM (EMP-008)
let neel: Session;   // MG (EMP-007)
let asha: Session;   // SC (EMP-001)

async function login(email: string): Promise<Session> {
  const res = await fetch(`${BASE}/api/auth/login`, {
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
  await db.query(`DELETE FROM national_management_actions WHERE title LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM national_targets WHERE period_label LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM product_rule_proposals WHERE rule_name LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM national_forecasts WHERE period_label LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM cross_region_transfers WHERE reason LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM cross_vertical_referrals WHERE id = $1`, [TEST_REFERRAL_ID]);
  await db.query(`DELETE FROM national_escalations WHERE title LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM rm_reviews WHERE strengths LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM national_report_schedules WHERE name LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM lead_events WHERE note LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM leads WHERE id IN ($1, $2)`, [TEST_LEAD_ID, TEST_FOREIGN_LEAD_ID]);
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  db = new Pool({ connectionString: env.DATABASE_URL });

  // Create isolated seed lead for cross-region transfer test
  await db.query(
    `INSERT INTO leads (id, vertical, team_id, stage, display_name, phone, preferred_language, product, source, created_at, updated_at)
     VALUES ($1, 'wealth', 'TEAM-WEALTH-ALPHA', 'contacted', 'National Test Lead', '+919876543211', 'English', 'V1 Wealth Portfolio', 'Direct Inbound', now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [TEST_LEAD_ID]
  );

  // Seed cross-vertical referral from banking to wealth
  await db.query(
    `INSERT INTO cross_vertical_referrals (
       id, referral_code, source_vertical, receiving_vertical, prospect_name,
       prospect_contact, customer_consent_evidence, commercial_context, decision
     ) VALUES ($1, $2, 'banking', 'wealth', 'Aarav Singhania', '+919988776655',
               'Signed Wealth Intake Form v1', 'High-net-worth commercial banking client seeking PMS',
               'pending')
     ON CONFLICT (id) DO NOTHING`,
    [TEST_REFERRAL_ID, `REF-${RUN}`]
  );

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const port = (server.address() as any).port;
      BASE = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  vikram = await login('vikram@finverse.demo');
  kavita = await login('kavita@finverse.demo');
  neel = await login('neel@finverse.demo');
  asha = await login('asha@finverse.demo');
});

after(async () => {
  await cleanupTestData();
  if (db) await db.end();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

// ─── Tests ───

test('Security: Non-NM roles are strictly forbidden from national manager workspace', async () => {
  const ashaRes = await call('GET', '/api/national/overview', { cookie: asha.cookie });
  assert.equal(ashaRes.status, 403, 'Caller must be rejected with 403');
  assert.equal(ashaRes.body?.error?.code, 'FORBIDDEN');

  const neelRes = await call('GET', '/api/national/overview', { cookie: neel.cookie });
  assert.equal(neelRes.status, 403, 'Manager must be rejected with 403');

  const kavitaRes = await call('GET', '/api/national/overview', { cookie: kavita.cookie });
  assert.equal(kavitaRes.status, 403, 'Regional Manager must be rejected with 403');
});

test('Scope: Returns assigned vertical, regions, and headcounts for National Manager', async () => {
  const res = await call('GET', '/api/national/scope', { cookie: vikram.cookie });
  assert.equal(res.status, 200);
  assert.equal(res.body?.data?.vertical, 'wealth');
  assert.ok(Array.isArray(res.body?.data?.regions), 'regions must be an array');
  assert.ok(Array.isArray(res.body?.data?.regionalManagers), 'regionalManagers must be an array');
  assert.ok(res.body?.data?.headcounts?.rms !== undefined, 'headcounts must include rms');
});

test('NM-01: National Overview returns KPIs, regional breakdown, and creates action', async () => {
  const res = await call('GET', '/api/national/overview?period=month-to-date', { cookie: vikram.cookie });
  assert.equal(res.status, 200);
  assert.ok(res.body?.data?.kpis, 'kpis must exist');
  assert.ok(typeof res.body?.data?.kpis?.approvedCeoTarget === 'number');
  assert.ok(Array.isArray(res.body?.data?.regionalPerformance));
  assert.ok(Array.isArray(res.body?.data?.recentDirectives));

  // Create national directive action
  const createRes = await call('POST', '/api/national/actions', {
    cookie: vikram.cookie,
    json: {
      sourceAction: 'NM-01',
      kind: 'regional-directive',
      subjectRmEmployeeId: 'EMP-008',
      ownerEmployeeId: 'EMP-009',
      title: `Directive ${RUN}`,
      detail: 'Ensure 100% SLA compliance on Tier-1 PMS conversions.',
      dueAt: new Date(Date.now() + 86400000).toISOString(),
    },
  });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body?.data?.status, 'open');
  const actionId = createRes.body?.data?.id;
  assert.ok(actionId);

  // Complete action
  const completeRes = await call('POST', `/api/national/actions/${actionId}/complete`, { cookie: vikram.cookie });
  assert.equal(completeRes.status, 200);
  assert.equal(completeRes.body?.data?.status, 'done');
});

test('NM-02: Regional Comparison compares regions and provides RM scorecards', async () => {
  const res = await call('GET', '/api/national/comparisons?period=September', { cookie: vikram.cookie });
  assert.equal(res.status, 200);
  assert.equal(res.body?.data?.period, 'September');
  assert.ok(Array.isArray(res.body?.data?.regions));
  assert.ok(res.body?.data?.regions.length >= 2, 'South and West regions must be present');
  const south = res.body?.data?.regions.find((r: any) => r.regionId === 'REGION-SOUTH');
  assert.ok(south);
  assert.ok(south.targetWins > 0);
  assert.ok(south.regionalManager !== null);
});

test('NM-03: National Target Allocation rejects over-allocation and publishes cascaded targets', async () => {
  // Over-allocation check
  const overRes = await call('POST', '/api/national/target/allocate', {
    cookie: vikram.cookie,
    json: {
      periodLabel: `Period-${RUN}`,
      approvedCeoTarget: 500,
      regionalAllocations: [
        { regionId: 'REGION-SOUTH', targetWins: 350 },
        { regionId: 'REGION-WEST', targetWins: 250 }, // Total = 600 > 500
      ],
      publish: false,
    },
  });
  assert.equal(overRes.status, 400, 'Over-allocation must be rejected with 400 Bad Request');

  // Valid target allocation with publish = true
  const validRes = await call('POST', '/api/national/target/allocate', {
    cookie: vikram.cookie,
    json: {
      periodLabel: `Period-${RUN}`,
      approvedCeoTarget: 500,
      regionalAllocations: [
        { regionId: 'REGION-SOUTH', targetWins: 250 },
        { regionId: 'REGION-WEST', targetWins: 150 }, // Remainder = 100
      ],
      publish: true,
    },
  });
  assert.equal(validRes.status, 200);
  assert.equal(validRes.body?.data?.status, 'published');
  assert.equal(Number(validRes.body?.data?.unallocated_remainder), 100);

  // Verify regional_targets was populated
  const { rows: rtRows } = await db.query(
    `SELECT * FROM regional_targets WHERE region_id = 'REGION-SOUTH' AND period_label = $1`,
    [`Period-${RUN}`]
  );
  assert.ok(rtRows.length > 0, 'Regional target must be created atomically for South Region');
  assert.equal(Number(rtRows[0].approved_nm_target), 250);
});

test('NM-04: National Economics & Unit Capacity returns CAC, velocity, and capacity gap', async () => {
  const res = await call('GET', '/api/national/economics?period=month-to-date', { cookie: vikram.cookie });
  assert.equal(res.status, 200);
  assert.ok(res.body?.data?.economics);
  assert.ok(res.body?.data?.economics.aumRunRateInr > 0);
  assert.ok(res.body?.data?.economics.estimatedBlendedCacInr > 0);
  assert.ok(Array.isArray(res.body?.data?.economics.channelEconomics));
  assert.ok(Array.isArray(res.body?.data?.economics.productEconomics));
  assert.ok(typeof res.body?.data?.economics.unitCapacityGapFte === 'number');
});

test('NM-05: Product & Pipeline Rule Proposals lists and records rule modifications', async () => {
  const createRes = await call('POST', '/api/national/product-rules', {
    cookie: vikram.cookie,
    json: {
      ruleName: `Tier-1 Intake SLA ${RUN}`,
      currentVersion: 'v1.2',
      proposedVersion: 'v1.3',
      reason: 'Shorten SLA from 48h to 24h to accelerate turnaround.',
      effectiveDate: '2026-11-01',
      affectedProducts: ['V1 Wealth Portfolio'],
      previewImpact: 'Projected 15% increase in conversion velocity.',
    },
  });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body?.data?.status, 'submitted');

  const listRes = await call('GET', '/api/national/product-rules', { cookie: vikram.cookie });
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body?.data));
  const found = listRes.body?.data?.find((p: any) => p.rule_name === `Tier-1 Intake SLA ${RUN}`);
  assert.ok(found);
});

test('NM-06: National Forecast consolidates regional forecasts and submits with adjustments', async () => {
  const rollupRes = await call('GET', '/api/national/forecast/rollup?period=October', { cookie: vikram.cookie });
  assert.equal(rollupRes.status, 200);
  assert.ok(rollupRes.body?.data?.bottomUpSum > 0);

  const submitRes = await call('POST', '/api/national/forecast/submit', {
    cookie: vikram.cookie,
    json: {
      periodLabel: `Q4-${RUN}`,
      bottomUpRevenue: 50000000,
      nationalAdjustment: -2000000,
      currency: 'INR',
      acceptedRegionalForecastIds: [],
      topNationalRisks: ['Market volatility in Q4', 'Delayed PMS approvals'],
      nationalAssumptions: 'Prudent adjustments applied for holiday liquidity.',
      submitToExecutives: true,
    },
  });
  assert.equal(submitRes.status, 200);
  assert.equal(submitRes.body?.data?.status, 'submitted_to_executives');
  assert.equal(Number(submitRes.body?.data?.adjusted_revenue), 48000000);
});

test('NM-07: Cross-Region Transfers handles request, approval, lead reassignment, and audit logging', async () => {
  const createRes = await call('POST', '/api/national/transfers', {
    cookie: vikram.cookie,
    json: {
      sourceRegionId: 'REGION-SOUTH',
      destinationRegionId: 'REGION-WEST',
      leadIds: [TEST_LEAD_ID],
      reason: `Capacity rebalancing ${RUN}`,
      handoffPlan: 'Immediate transfer to West intake queue with 24h SLA.',
    },
  });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body?.data?.status, 'pending');
  const transferId = createRes.body?.data?.id;
  assert.ok(transferId);

  // Approve transfer
  const decideRes = await call('POST', `/api/national/transfers/${transferId}/decide`, {
    cookie: vikram.cookie,
    json: {
      decision: 'approved',
      resolutionNotes: `Approved by National Manager for rebalancing ${RUN}`,
    },
  });
  assert.equal(decideRes.status, 200);
  assert.equal(decideRes.body?.data?.decision, 'approved');

  // Verify lead event audit trail was logged
  const { rows: eventRows } = await db.query(
    `SELECT * FROM lead_events WHERE lead_id = $1 AND kind = 'transfer'`,
    [TEST_LEAD_ID]
  );
  assert.ok(eventRows.length > 0, 'Audit event for transfer must be recorded in lead_events');
});

test('NM-08: Cross-Vertical Inbound Referrals lists, accepts, and declines referrals into Wealth', async () => {
  const listRes = await call('GET', '/api/national/referrals', { cookie: vikram.cookie });
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body?.data));
  const foundRef = listRes.body?.data?.find((r: any) => r.id === TEST_REFERRAL_ID);
  assert.ok(foundRef, 'Pre-seeded inbound referral must be in list');

  // Accept referral
  const acceptRes = await call('POST', `/api/national/referrals/${TEST_REFERRAL_ID}/decide`, {
    cookie: vikram.cookie,
    json: {
      decision: 'accepted',
      targetTeamId: 'TEAM-WEALTH-ALPHA',
      targetOwnerEmployeeId: 'EMP-001',
    },
  });
  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.body?.data?.decision, 'accepted');
  const receivingLeadId = acceptRes.body?.data?.receivingLeadId;
  assert.ok(receivingLeadId, 'Receiving lead ID must be returned');

  // Verify receiving lead was created in wealth vertical with initial task
  const { rows: leadRows } = await db.query(`SELECT * FROM leads WHERE id = $1`, [receivingLeadId]);
  assert.equal(leadRows.length, 1);
  assert.equal(leadRows[0].vertical, 'wealth');
  assert.equal(leadRows[0].display_name, 'Aarav Singhania');

  const { rows: taskRows } = await db.query(`SELECT * FROM lead_tasks WHERE lead_id = $1`, [receivingLeadId]);
  assert.ok(taskRows.length > 0, 'High-priority intake task must be generated for accepted referral');

  // Clean up created lead
  await db.query(`UPDATE cross_vertical_referrals SET receiving_lead_id = NULL WHERE id = $1`, [TEST_REFERRAL_ID]);
  await db.query(`DELETE FROM lead_tasks WHERE lead_id = $1`, [receivingLeadId]);
  await db.query(`DELETE FROM lead_events WHERE lead_id = $1`, [receivingLeadId]);
  await db.query(`DELETE FROM leads WHERE id = $1`, [receivingLeadId]);
});

test('NM-09: National Strategic Escalations routes dual-executive issue and records resolution', async () => {
  const createRes = await call('POST', '/api/national/escalations', {
    cookie: vikram.cookie,
    json: {
      category: 'strategic_exception',
      targetExecutive: 'BOTH',
      title: `Pricing Threshold Strategic Exception ${RUN}`,
      detail: 'Requesting authorization for special AUM advisory fee tier for ultra HNW cohort.',
      decisionDeadline: new Date(Date.now() + 86400000).toISOString(),
    },
  });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body?.data?.status, 'open');
  const escalationId = createRes.body?.data?.id;
  assert.ok(escalationId);

  // Resolve escalation
  const resolveRes = await call('POST', `/api/national/escalations/${escalationId}/resolve`, {
    cookie: vikram.cookie,
    json: {
      executiveDecision: `Approved exception subject to 50bps floor rate ${RUN}`,
    },
  });
  assert.equal(resolveRes.status, 200);
  assert.equal(resolveRes.body?.data?.status, 'resolved');
});

test('NM-10: Regional Manager Reviews records and retrieves periodic evaluation', async () => {
  const saveRes = await call('POST', '/api/national/reviews', {
    cookie: vikram.cookie,
    json: {
      rmEmployeeId: 'EMP-008',
      periodLabel: `Q3-${RUN}`,
      performanceRating: 'achieving',
      strengths: `Strong team guidance and SLA governance across South ${RUN}`,
      blockers: 'West region capacity ramping up slower than projected.',
      growthCommitments: ['Accelerate West hiring', 'Maintain 80%+ conversion SLA'],
      coverageCommitments: ['South and West divisions'],
      nextReviewDate: '2026-12-15',
    },
  });
  assert.equal(saveRes.status, 201);
  assert.equal(saveRes.body?.data?.performance_rating, 'achieving');

  const listRes = await call('GET', '/api/national/reviews?rmEmployeeId=EMP-008', { cookie: vikram.cookie });
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body?.data));
  const found = listRes.body?.data?.find((r: any) => r.period_label === `Q3-${RUN}`);
  assert.ok(found);
});

test('NM-11: National Executive Reports & Schedules generates PDF, streams binary, and creates schedule', async () => {
  // Preview
  const prevRes = await call('GET', '/api/national/reports/preview?period=October+2026', { cookie: vikram.cookie });
  assert.equal(prevRes.status, 200);
  assert.equal(prevRes.body?.data?.period, 'October 2026');
  assert.ok(prevRes.body?.data?.kpis);

  // Export PDF
  const expRes = await call('POST', '/api/national/reports/export-pdf', {
    cookie: vikram.cookie,
    json: {
      periodLabel: `October 2026 ${RUN}`,
      sections: ['regional-rollup', 'attainment', 'pipeline-health', 'risks'],
    },
  });
  assert.equal(expRes.status, 200);
  const downloadUrl = expRes.body?.data?.downloadUrl;
  assert.ok(downloadUrl);

  // Download PDF stream
  const dlRes = await call('GET', downloadUrl, { cookie: vikram.cookie });
  assert.equal(dlRes.status, 200);
  assert.ok(dlRes.body?.isPdf);
  assert.ok(dlRes.body?.byteLength > 1000, 'Binary PDF must be non-empty');

  // Save Report Schedule
  const schedRes = await call('POST', '/api/national/reports/schedules', {
    cookie: vikram.cookie,
    json: {
      name: `Monthly CEO Governance Pack ${RUN}`,
      periodType: 'monthly',
      cadence: '1st business day, 08:00 IST',
      recipients: ['ceo@finverse.demo', 'cfo@finverse.demo'],
      sections: ['attainment', 'regional-scorecards', 'economics'],
      status: 'active',
    },
  });
  assert.equal(schedRes.status, 200);
  assert.equal(schedRes.body?.data?.status, 'active');

  // List Schedules
  const listSchedRes = await call('GET', '/api/national/reports/schedules', { cookie: vikram.cookie });
  assert.equal(listSchedRes.status, 200);
  assert.ok(Array.isArray(listSchedRes.body?.data));
  const foundSched = listSchedRes.body?.data?.find((s: any) => s.name === `Monthly CEO Governance Pack ${RUN}`);
  assert.ok(foundSched);
});
