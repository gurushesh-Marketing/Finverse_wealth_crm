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

const RUN = `CEOT-${Date.now().toString(36)}`;

interface Session {
  cookie: string;
  body: any;
}

let rajiv: Session;  // CEO (EMP-010)
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
  await db.query(`DELETE FROM company_targets WHERE period_label LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM company_forecasts WHERE period_label LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM growth_initiatives WHERE title LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM cross_vertical_conflicts WHERE summary LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM critical_operating_risks WHERE title LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM nm_leadership_reviews WHERE period_label LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM board_report_schedules WHERE title LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM executive_commitments WHERE title LIKE $1`, [`%${RUN}%`]);
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  db = new Pool({ connectionString: env.DATABASE_URL });

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const port = (server.address() as any).port;
      BASE = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  rajiv = await login('rajiv@finverse.demo');
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

test('Security: Non-CEO roles are strictly forbidden from CEO executive workspace', async () => {
  for (const session of [vikram, kavita, neel, asha]) {
    const res = await call('GET', '/api/ceo/operating-picture', { cookie: session.cookie });
    assert.equal(res.status, 403, 'Non-CEO roles must receive 403 Forbidden on CEO endpoints');
    assert.equal(res.body.error?.code, 'FORBIDDEN');
  }

  // CEO succeeds
  const ceoRes = await call('GET', '/api/ceo/operating-picture', { cookie: rajiv.cookie });
  assert.equal(ceoRes.status, 200, 'CEO must receive 200 OK on operating picture');
});

test('Scope: Returns enterprise executive multi-vertical scope for CEO', async () => {
  const res = await call('GET', '/api/ceo/scope', { cookie: rajiv.cookie });
  assert.equal(res.status, 200);
  assert.equal(res.body.data?.ceo?.role, 'CEO');
  assert.equal(res.body.data?.ceo?.id, 'EMP-010');
  assert.ok(Array.isArray(res.body.data?.verticals));
  assert.equal(res.body.data?.verticals.length, 4, 'Must cover 4 verticals: Wealth, Banking, Markets, Real Estate');
});

test('CEO-01: Company Operating Picture returns reconciled totals, watermarks, and creates commitment', async () => {
  const res = await call('GET', '/api/ceo/operating-picture?period=month-to-date&focusVertical=all', {
    cookie: rajiv.cookie,
  });
  assert.equal(res.status, 200);
  const data = res.body.data;
  assert.ok(data.watermark, 'Watermark with data freshness and finance close status must exist');
  assert.equal(typeof data.watermark.financeCloseStatus, 'string');
  assert.ok(data.kpis, 'KPIs object must exist');
  assert.equal(typeof data.kpis.totalRevenueTarget, 'number');
  assert.equal(typeof data.kpis.totalDeliveredRevenue, 'number');
  assert.equal(typeof data.kpis.unallocatedRevenueBuffer, 'number');
  assert.ok(Array.isArray(data.verticalContributions));
  assert.equal(data.verticalContributions.length, 4);

  // Record an executive commitment from CEO-01
  const commitRes = await call('POST', '/api/ceo/commitments', {
    cookie: rajiv.cookie,
    json: {
      sourceAction: 'CEO-01',
      title: `Operating Picture Strategic Follow-up ${RUN}`,
      accountableLeader: 'Vikram Malhotra',
      vertical: 'wealth',
      actionableMandate: 'Align regional capacity envelope with West Division pipeline surge.',
      dueDate: '2026-11-15',
    },
  });
  assert.equal(commitRes.status, 201);
  assert.equal(commitRes.body.data?.status, 'in_progress');
});

test('CEO-02: Vertical Comparison returns fair comparative metrics across 4 verticals with basis', async () => {
  const res = await call('GET', '/api/ceo/verticals/comparison?period=month-to-date', {
    cookie: rajiv.cookie,
  });
  assert.equal(res.status, 200);
  const comps = res.body.data?.comparisons;
  assert.ok(Array.isArray(comps));
  assert.equal(comps.length, 4, 'Must compare all 4 verticals fairly');

  const wealth = comps.find((c: any) => c.vertical === 'wealth');
  assert.ok(wealth);
  assert.equal(typeof wealth.grossMarginPercent, 'number');
  assert.equal(typeof wealth.blendedCacInr, 'number');
  assert.equal(typeof wealth.fteCount, 'number');
  assert.equal(typeof wealth.riskRating, 'string');
});

test('CEO-03: NM Contribution Review returns scorecard and delivery record for Vikram Malhotra', async () => {
  const res = await call('GET', '/api/ceo/nms/EMP-009/contribution?period=October 2026', {
    cookie: rajiv.cookie,
  });
  assert.equal(res.status, 200);
  const data = res.body.data;
  assert.equal(data.nationalManager?.id, 'EMP-009');
  assert.equal(data.nationalManager?.display_name, 'Vikram Malhotra');
  assert.equal(typeof data.approvedVerticalTarget, 'number');
  assert.ok(data.governanceRecord);
  assert.equal(typeof data.governanceRecord.directivesIssued, 'number');
  assert.equal(typeof data.governanceRecord.directivesFulfilled, 'number');

  // Unknown employee 404
  const notFoundRes = await call('GET', '/api/ceo/nms/EMP-UNKNOWN/contribution', {
    cookie: rajiv.cookie,
  });
  assert.equal(notFoundRes.status, 404);
});

test('CEO-04: Company Target Approval rejects over-allocation and cascades to NM', async () => {
  // 1. Attempt over-allocation (allocations sum to > totalRevenueTarget) -> rejected with 400
  const overAllocRes = await call('POST', '/api/ceo/targets/approve', {
    cookie: rajiv.cookie,
    json: {
      periodLabel: `October-${RUN}`,
      fiscalYear: 'FY2026-27',
      totalRevenueTarget: 100000000, // 10 Cr
      totalWinsTarget: 500,
      verticalAllocations: [
        { vertical: 'wealth', revenueTarget: 80000000, winsTarget: 400, nmEmployeeId: 'EMP-009' },
        { vertical: 'banking', revenueTarget: 40000000, winsTarget: 200, nmEmployeeId: 'EMP-004' },
      ], // Sum = 120,000,000 > 100,000,000
      boardRatify: false,
    },
  });
  assert.equal(overAllocRes.status, 400, 'Over-allocation must be strictly prohibited with 400');
  assert.equal(overAllocRes.body.error?.code, 'VALIDATION_FAILED');

  // 2. Valid allocation with unallocated buffer -> succeeds and cascades to national_targets
  const validRes = await call('POST', '/api/ceo/targets/approve', {
    cookie: rajiv.cookie,
    json: {
      periodLabel: `October-${RUN}`,
      fiscalYear: 'FY2026-27',
      totalRevenueTarget: 120000000, // 12 Cr
      totalWinsTarget: 800,
      verticalAllocations: [
        { vertical: 'wealth', revenueTarget: 60000000, winsTarget: 400, nmEmployeeId: 'EMP-009' },
        { vertical: 'banking', revenueTarget: 40000000, winsTarget: 250, nmEmployeeId: 'EMP-004' },
      ], // Sum = 10 Cr, Buffer = 2 Cr; Wins sum = 650, Buffer = 150
      boardRatify: true,
    },
  });
  assert.equal(validRes.status, 200);
  assert.equal(validRes.body.data?.status, 'board_ratified');
  assert.equal(Number(validRes.body.data?.unallocated_revenue_buffer), 20000000);
  assert.equal(Number(validRes.body.data?.unallocated_wins_buffer), 150);

  // Verify cascade into national_targets for Wealth
  const { rows: natRows } = await db.query(
    `SELECT * FROM national_targets WHERE vertical = 'wealth' AND period_label = $1`,
    [`October-${RUN}`]
  );
  assert.equal(natRows.length, 1, 'Target must cascade to national_targets for Wealth');
  assert.equal(Number(natRows[0].approved_ceo_target), 400);
});

test('CEO-05: Consolidated Company Forecast rolls up bottom-up submissions and freezes with macro adjustment', async () => {
  const rollupRes = await call('GET', `/api/ceo/forecast/rollup?period=October`, {
    cookie: rajiv.cookie,
  });
  assert.equal(rollupRes.status, 200);
  assert.equal(typeof rollupRes.body.data?.bottomUpSum, 'number');
  assert.ok(Array.isArray(rollupRes.body.data?.verticalSubmissions));

  // Sign off forecast
  const signOffRes = await call('POST', '/api/ceo/forecast/sign-off', {
    cookie: rajiv.cookie,
    json: {
      periodLabel: `October-${RUN}`,
      bottomUpSum: 78500000,
      executiveMacroAdjustment: -3500000,
      currency: 'INR',
      verticalSubmissions: [
        { vertical: 'Wealth Management', reportedRevenue: 42500000, status: 'submitted_to_executives' },
        { vertical: 'Corporate Banking', reportedRevenue: 36000000, status: 'submitted' },
      ],
      macroAssumptions: `Macro adjustment test assumption ${RUN}`,
      boardRiskNotes: 'Potential SEBI advisory disclosure turnaround latency.',
      signOff: true,
    },
  });
  assert.equal(signOffRes.status, 200);
  assert.equal(signOffRes.body.data?.status, 'signed_off_by_ceo');
  assert.equal(Number(signOffRes.body.data?.signed_off_revenue), 75000000);
});

test('CEO-06: Growth Initiatives allows proposing and approving strategic capital investments', async () => {
  const createRes = await call('POST', '/api/ceo/growth-initiatives', {
    cookie: rajiv.cookie,
    json: {
      title: `Bangalore Tech Corridor Wealth Advisory Hub ${RUN}`,
      vertical: 'wealth',
      initiativeType: 'geographic_expansion',
      capitalRequired: 18000000,
      currency: 'INR',
      projectedRoiPercent: 35.5,
      timelineMonths: 9,
      sponsorExecutive: 'Vikram Malhotra',
      justification: 'Capture tier-1 venture founder exits in Bangalore Whitefield & Indiranagar.',
      implementationTasks: ['Lease commercial premises', 'Hire 4 Principal Advisory Associates', 'Regulatory branch registration'],
    },
  });
  assert.equal(createRes.status, 201);
  const initiativeId = createRes.body.data?.id;
  assert.ok(initiativeId);
  assert.equal(createRes.body.data?.status, 'proposed');

  // CEO approves initiative
  const approveRes = await call('POST', `/api/ceo/growth-initiatives/${initiativeId}/approve`, {
    cookie: rajiv.cookie,
    json: {
      approved: true,
      executiveRemarks: 'Approved with strategic budget allocation for Q4.',
    },
  });
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.data?.status, 'approved_by_ceo');
});

test('CEO-07: Cross-Vertical Priority Conflicts arbitrates dispute with binding attribution', async () => {
  // Create an open conflict in the DB for arbitration test
  const conflictId = `CVC-${RUN}`;
  await db.query(
    `INSERT INTO cross_vertical_conflicts (
       id, ceo_employee_id, source_vertical, conflicting_vertical, prospect_or_client_name,
       conflict_nature, summary, source_argument, counter_argument, status
     ) VALUES ($1, 'EMP-010', 'banking', 'wealth', 'Tata Group Family Office',
       'revenue_attribution', $2, 'Corporate Banking opened treasury custody.', 'Wealth structured custom family PMS strategy.', 'open')`,
    [conflictId, `Dual coverage conflict test ${RUN}`]
  );

  // CEO arbitrates
  const arbRes = await call('POST', `/api/ceo/conflicts/${conflictId}/arbitrate`, {
    cookie: rajiv.cookie,
    json: {
      ceoDetermination: 'Dual coverage awarded with 60/40 fee attribution split.',
      awardedVertical: 'shared',
      resolvedAttribution: '60% Wealth Management / 40% Corporate Banking',
    },
  });
  assert.equal(arbRes.status, 200);
  assert.equal(arbRes.body.data?.status, 'resolved');
  assert.equal(arbRes.body.data?.resolved_attribution, '60% Wealth Management / 40% Corporate Banking');
});

test('CEO-08: Critical Complaints & Operating Risks manages enterprise risk registry and resolution', async () => {
  const createRes = await call('POST', '/api/ceo/operating-risks', {
    cookie: rajiv.cookie,
    json: {
      vertical: 'wealth',
      riskCategory: 'client_litigation',
      severity: 'critical',
      title: `Arbitration Claim Risk ${RUN}`,
      details: 'Disputed portfolio rebalance execution timing during market volatility.',
      exposureAmount: 4500000,
      accountableExecutive: 'Kavita Rao & Legal Counsel',
      decisionDeadline: '2026-11-01T12:00:00Z',
      mitigationMandate: 'Offer mediation settlement within legal authority threshold.',
    },
  });
  assert.equal(createRes.status, 201);
  const riskId = createRes.body.data?.id;
  assert.ok(riskId);
  assert.equal(createRes.body.data?.status, 'open');

  // CEO resolves risk
  const resolveRes = await call('POST', `/api/ceo/operating-risks/${riskId}/resolve`, {
    cookie: rajiv.cookie,
    json: {
      mitigationOutcome: 'Mediation agreement executed with customer concurrence. Claim settled at zero penalty.',
    },
  });
  assert.equal(resolveRes.status, 200);
  assert.equal(resolveRes.body.data?.status, 'resolved');
});

test('CEO-09: NM Leadership Reviews submits performance review with commitments', async () => {
  const reviewRes = await call('POST', '/api/ceo/nm-reviews', {
    cookie: rajiv.cookie,
    json: {
      nmEmployeeId: 'EMP-009',
      vertical: 'wealth',
      periodLabel: `Q3-FY27-${RUN}`,
      overallLeadershipRating: 'strong_performer',
      strategicAlignment: 'Excellent alignment with firm-wide HNI margin targets.',
      operationalExecution: 'Strong regional quota delivery; minor delay on South staffing.',
      teamHealthAndRetention: '95% retention rate across regional managers and team leads.',
      boardVisibilityReadiness: 'Fully prepared for Q3 Board pack presentation.',
      strategicCommitments: [
        'Close Bangalore hub premises by month-end',
        'Address West division SLA breach remediation',
      ],
      supportFromCeo: 'CEO will sponsor expedited HR requisition sign-off.',
      nextReviewDate: '2026-12-15',
    },
  });
  assert.equal(reviewRes.status, 201);
  assert.equal(reviewRes.body.data?.overall_leadership_rating, 'strong_performer');

  // List reviews for NM
  const listRes = await call('GET', '/api/ceo/nm-reviews?nmEmployeeId=EMP-009', {
    cookie: rajiv.cookie,
  });
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body.data));
  assert.ok(listRes.body.data.some((r: any) => r.period_label === `Q3-FY27-${RUN}`));
});

test('CEO-10: Board & Executive Pack generates binary PDF, verifies headers, and manages schedules', async () => {
  // 1. Preview
  const prevRes = await call('GET', '/api/ceo/board-packs/preview?period=October 2026', {
    cookie: rajiv.cookie,
  });
  assert.equal(prevRes.status, 200);
  assert.ok(prevRes.body.data?.picture);
  assert.ok(Array.isArray(prevRes.body.data?.comparisons));

  // 2. Generate PDF
  const pdfGenRes = await call('POST', '/api/ceo/board-packs/export-pdf', {
    cookie: rajiv.cookie,
    json: {
      periodLabel: `October 2026 - ${RUN}`,
      sections: ['company-performance', 'vertical-comparison', 'growth-initiatives', 'operating-risks'],
    },
  });
  assert.equal(pdfGenRes.status, 200);
  const downloadUrl = pdfGenRes.body.data?.downloadUrl;
  assert.ok(downloadUrl, 'Must return downloadUrl');

  // 3. Download binary PDF & verify %PDF header
  const dlRes = await call('GET', downloadUrl, { cookie: rajiv.cookie });
  assert.equal(dlRes.status, 200);
  assert.ok(dlRes.body.isPdf, 'Response must be application/pdf');
  assert.ok(dlRes.body.byteLength > 1000, 'PDF buffer must be non-trivial (>1000 bytes)');
  const magic = dlRes.body.buffer.subarray(0, 4).toString('ascii');
  assert.equal(magic, '%PDF', 'Must start with %PDF magic header');

  // 4. Save report schedule
  const schedRes = await call('POST', '/api/ceo/board-packs/schedules', {
    cookie: rajiv.cookie,
    json: {
      title: `Quarterly Board Pack Distribution ${RUN}`,
      frequency: 'quarterly',
      deliveryCadence: 'Every 15th of quarter close month',
      stakeholders: ['audit@finverse.demo', 'chairman@finverse.demo', 'cfo@finverse.demo'],
      sections: ['Enterprise Financials', 'Division Attainment', 'Operating Risks'],
      status: 'active',
    },
  });
  assert.equal(schedRes.status, 200);
  assert.equal(schedRes.body.data?.frequency, 'quarterly');
});

test('CEO-11: Executive Commitments tracks directive follow-through and outcome fulfillment', async () => {
  // Create commitment
  const createRes = await call('POST', '/api/ceo/commitments', {
    cookie: rajiv.cookie,
    json: {
      sourceAction: 'CEO-11',
      title: `Board Mandate Execution ${RUN}`,
      accountableLeader: 'Vikram Malhotra',
      vertical: 'wealth',
      actionableMandate: 'Deliver verified quarterly audit compliance disclosures.',
      dueDate: '2026-11-30',
    },
  });
  assert.equal(createRes.status, 201);
  const commitId = createRes.body.data?.id;
  assert.ok(commitId);
  assert.equal(createRes.body.data?.status, 'in_progress');

  // Fulfill commitment with evidence
  const fulfillRes = await call('POST', `/api/ceo/commitments/${commitId}/fulfill`, {
    cookie: rajiv.cookie,
    json: {
      fulfillmentNotes: 'Compliance disclosures delivered and verified by board audit secretary.',
      evidenceUrl: 'https://vault.internal.finverse/audit/q3-compliance-signoff.pdf',
    },
  });
  assert.equal(fulfillRes.status, 200);
  assert.equal(fulfillRes.body.data?.status, 'fulfilled');
  assert.equal(fulfillRes.body.data?.evidence_url, 'https://vault.internal.finverse/audit/q3-compliance-signoff.pdf');
});
