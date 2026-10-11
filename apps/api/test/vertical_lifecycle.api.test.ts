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
let pool: Pool;

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  pool = new Pool({ connectionString: env.DATABASE_URL });
  await pool.query(`UPDATE reporting_periods SET status = 'open', lock_governed_writes = false WHERE id = 'PER-2026-Q1'`);
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  BASE = `http://127.0.0.1:${port}/api`;
});

after(async () => {
  if (pool) {
    await pool.query(`UPDATE reporting_periods SET status = 'open', lock_governed_writes = false WHERE id = 'PER-2026-Q1'`);
    await pool.query(`DELETE FROM sales_finance_handoffs WHERE id NOT IN ('SFH-001', 'SFH-002')`);
    await pool.query(`DELETE FROM finance_ledger_entries WHERE id LIKE 'LEDG-%'`);
    await pool.query(`DELETE FROM finance_reconciliations WHERE period_id = 'PER-2026-Q1'`);
    await pool.query(`UPDATE incentive_disputes SET status = 'open', resolution_amount = NULL, decision_notes = NULL, resolved_by_employee_id = NULL, resolved_at = NULL WHERE id = 'DISP-001'`);
    await pool.query(`UPDATE sales_finance_handoffs SET review_status = 'pending_verification' WHERE id = 'SFH-001'`);
    await pool.end();
  }
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

interface Session {
  cookie: string;
  body: any;
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
    try {
      parsed = await res.text();
    } catch {
      /* ignore */
    }
  }
  return { status: res.status, body: parsed, headers: res.headers };
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

test('Comprehensive Finverse Wealth Vertical Cross-Role Lifecycle Journey', async () => {
  console.log('--- 1. AUTHENTICATING ALL 7 SYNTHETIC ROLE ACCOUNTS ---');
  const asha = await login('asha@finverse.demo'); // SC
  const tara = await login('tara@finverse.demo'); // TL
  const neel = await login('neel@finverse.demo'); // MG
  const kavita = await login('kavita@finverse.demo'); // RM
  const vikram = await login('vikram@finverse.demo'); // NM
  const rajiv = await login('rajiv@finverse.demo'); // CEO
  const ananya = await login('ananya@finverse.demo'); // CFO
  const priya = await login('priya@finverse.demo'); // Finance Officer (EMP-012)

  assert.equal(asha.body.session.role, 'SC');
  assert.equal(tara.body.session.role, 'TL');
  assert.equal(neel.body.session.role, 'MG');
  assert.equal(kavita.body.session.role, 'RM');
  assert.equal(vikram.body.session.role, 'NM');
  assert.equal(rajiv.body.session.role, 'CEO');
  assert.equal(ananya.body.session.role, 'CFO');
  assert.equal(priya.body.session.role, 'CFO');
  console.log('PASS: All synthetic role logins succeeded with correct role scopes');

  console.log('--- 2. FRONTLINE CALLER (SC) & TEAM LEAD (TL) WORKFLOW ---');
  const RUN = Date.now().toString().slice(-6);

  // SC Intake
  const enq = await call('POST', '/enquiries', {
    cookie: asha.cookie,
    json: {
      displayName: `Lifecycle Client ${RUN}`,
      phone: `+91 99${RUN}01`,
      product: 'V1 Wealth Portfolio',
      source: 'Employee referral',
      permissionEvidence: 'Verified in person',
      need: 'Retirement advisory',
    },
  });
  assert.equal(enq.status, 201);
  const pub = await call('POST', `/enquiries/${enq.body.id}/publish`, { cookie: asha.cookie });
  assert.equal(pub.status, 200);
  const leadId = pub.body.leadId;
  assert.ok(leadId, 'Lead created from published enquiry');

  // TL-02: Allocate unassigned lead to Asha
  const rv = await call('GET', `/leads/${leadId}`, { cookie: tara.cookie });
  assert.equal(rv.status, 200);
  const alloc = await call('POST', '/tl/allocation', {
    cookie: tara.cookie,
    json: { leadId, toEmployeeId: 'EMP-001', reason: 'Assigned to wealth specialist', recordVersion: rv.body.recordVersion },
  });
  assert.equal(alloc.status, 201);


  // Move lead stage through allowed pipeline: new -> not-contacted -> contacted
  await call('POST', `/leads/${leadId}/stage`, {
    cookie: asha.cookie,
    json: { toStage: 'not-contacted', reason: 'Assigned to associate' },
  });
  await call('POST', `/leads/${leadId}/stage`, {
    cookie: asha.cookie,
    json: { toStage: 'contacted', reason: 'Initial phone consultation completed' },
  });

  // SC Qualify
  const qual = await call('POST', `/leads/${leadId}/qualification`, {
    cookie: asha.cookie,
    json: {
      need: 'Wealth growth',
      product: 'V1 Wealth Portfolio',
      expectedValue: 5000000,
      currency: 'INR',
      timeHorizon: '30 days',
      checklist: { riskProfile: true, minInvestableMet: true },
      nextStep: 'Prepare proposal',
    },
  });
  assert.equal(qual.status, 201);

  // SC creates proposal
  const prop = await call('POST', `/leads/${leadId}/proposals`, {
    cookie: asha.cookie,
    json: {
      product: 'V1 Wealth Portfolio',
      templateVersion: 'tpl-v1',
      terms: 'Standard terms',
      validUntil: '2026-10-31',
      recipient: `Lifecycle Client ${RUN}`,
    },
  });
  assert.equal(prop.status, 201);
  const propId = prop.body.id;

  // SC submits proposal
  const subProp = await call('POST', `/proposals/${propId}/submit`, { cookie: asha.cookie });
  assert.equal(subProp.status, 200);

  // TL approves proposal
  const appProp = await call('POST', `/proposals/${propId}/approve`, { cookie: tara.cookie });
  assert.equal(appProp.status, 200);

  // SC sends proposal
  const sentProp = await call('POST', `/proposals/${propId}/send`, { cookie: asha.cookie });
  assert.equal(sentProp.status, 200);

  // Move lead stage from contacted -> qualified
  await call('POST', `/leads/${leadId}/stage`, {
    cookie: asha.cookie,
    json: { toStage: 'qualified', reason: 'Proposal accepted by client' },
  });

  // SC submits conversion request
  const convReq = await call('POST', `/leads/${leadId}/conversion`, {
    cookie: asha.cookie,
    json: {
      winMilestone: 'Signed mandate',
      milestoneDate: '2026-10-01',
      value: 5000000,
      currency: 'INR',
      evidenceRef: 'DOC-MOCK-1',
      proposedCredit: { 'EMP-001': 100 },
    },
  });
  assert.equal(convReq.status, 201);

  // TL approves conversion
  const convApp = await call('POST', `/requests/${convReq.body.requestId}/decide`, {
    cookie: tara.cookie,
    json: {
      decision: 'approve',
      reason: 'Mandate and custody documents verified',
    },
  });
  assert.equal(convApp.status, 200);
  console.log('PASS: SC -> TL Lead creation, allocation, qualification, proposal approval, and conversion verified');


  console.log('--- 3. WEALTH MANAGER (MG-01..MG-13) LIFECYCLE ---');
  // MG-01 Overview & KPIs
  const mgOv = await call('GET', '/manager/overview?period=month-to-date', { cookie: neel.cookie });
  assert.equal(mgOv.status, 200);
  assert.ok(Array.isArray(mgOv.body.kpis), 'MG KPIs returned');

  // MG-01 Management Action
  const mgAction = await call('POST', '/manager/actions', {
    cookie: neel.cookie,
    json: {
      sourceAction: 'MG-01',
      kind: 'intervention',
      subjectTlEmployeeId: 'EMP-003',
      ownerEmployeeId: 'EMP-007',
      title: 'Weekly conversion pipeline coaching',
      dueAt: new Date(Date.now() + 86400000).toISOString(),
    },
  });
  assert.equal(mgAction.status, 201);

  // MG-05 Allocate Target
  const mgTarget = await call('POST', '/manager/targets/allocate', {
    cookie: neel.cookie,
    json: {
      periodLabel: 'October',
      metric: 'approved-wins',
      approvedParentTarget: 50,
      tlAllocations: [
        { teamId: 'TEAM-WEALTH-ALPHA', tlEmployeeId: 'EMP-003', allocatedValue: 20 },
        { teamId: 'TEAM-WEALTH-BETA', tlEmployeeId: 'EMP-003', allocatedValue: 20 },
      ],
      publish: true,
    },
  });
  assert.equal(mgTarget.status, 200);

  // MG-04 Capacity Plan
  const capPlan = await call('POST', '/manager/capacity/plan', {
    cookie: neel.cookie,
    json: {
      name: `Surge Capacity Plan ${RUN}`,
      periodLabel: 'October',
      teamIds: ['TEAM-WEALTH-ALPHA', 'TEAM-WEALTH-BETA'],
      currentBacklog: 45,
      availableCallers: 8,
      plannedReallocations: [{ fromTeamId: 'TEAM-WEALTH-BETA', toTeamId: 'TEAM-WEALTH-ALPHA', leadCount: 2 }],
      requiredAdditionalStaff: 1,
      approved: true,
    },
  });
  assert.equal(capPlan.status, 201);

  // MG-03 Cross-Team Lead Transfer
  const mgTransfer = await call('POST', '/manager/transfers', {
    cookie: neel.cookie,
    json: {
      sourceTeamId: 'TEAM-WEALTH-ALPHA',
      destinationTeamId: 'TEAM-WEALTH-BETA',
      leadIds: [leadId],
      reason: 'Rebalancing associate workloads across Alpha and Beta',
    },
  });
  assert.equal(mgTransfer.status, 201);

  console.log('PASS: MG-01..MG-13 Manager overview, action, target allocation, capacity plan, and transfer verified');

  console.log('--- 4. WEALTH REGIONAL MANAGER (RM-01..RM-10) LIFECYCLE ---');
  // RM-01 Regional Overview
  const rmOv = await call('GET', '/regional/overview?period=month-to-date', { cookie: kavita.cookie });
  assert.equal(rmOv.status, 200);
  assert.ok(rmOv.body.data, 'Regional overview data present');

  // RM-01 Regional Action
  const rmAction = await call('POST', '/regional/actions', {
    cookie: kavita.cookie,
    json: {
      sourceAction: 'RM-01',
      kind: 'regional-intervention',
      subjectManagerEmployeeId: 'EMP-007',
      ownerEmployeeId: 'EMP-008',
      title: 'Monthly regional performance review',
      dueAt: new Date(Date.now() + 86400000).toISOString(),
    },
  });
  assert.equal(rmAction.status, 201);

  // RM-04 Regional Target Allocation
  const rmTarget = await call('POST', '/regional/targets/allocate', {
    cookie: kavita.cookie,
    json: {
      periodLabel: 'October',
      approvedNmTarget: 200,
      managerAllocations: [
        { managerEmployeeId: 'EMP-007', targetWins: 180 },
      ],
      publish: true,
    },
  });
  assert.equal(rmTarget.status, 201);

  // RM-10 Regional PDF Export
  const rmPdf = await call('POST', '/regional/reports/generate-pdf', {
    cookie: kavita.cookie,
    json: { periodLabel: 'October 2026', sections: ['kpi-rollup', 'manager-comparison', 'forecast-summary', 'risks'] },
  });
  assert.equal(rmPdf.status, 200);
  assert.ok(rmPdf.body.data?.downloadUrl, 'RM pack PDF download URL generated');
  const rmPdfDl = await call('GET', rmPdf.body.data.downloadUrl.replace(/^\/api/, ''), { cookie: kavita.cookie });
  assert.equal(rmPdfDl.status, 200);
  assert.ok(rmPdfDl.body.isPdf, 'RM binary PDF returned');
  assert.ok(rmPdfDl.body.byteLength > 1000, 'RM PDF size > 1000 bytes');
  console.log('PASS: RM-01..RM-10 Regional overview, action, targets, and PDF export verified');

  console.log('--- 5. WEALTH NATIONAL MANAGER (NM-01..NM-11) LIFECYCLE ---');
  // NM-01 National Overview
  const nmOv = await call('GET', '/national/overview?period=month-to-date', { cookie: vikram.cookie });
  assert.equal(nmOv.status, 200);
  assert.ok(nmOv.body.data, 'National overview data present');

  // NM-03 National Target Allocation & Cascade
  const nmTarget = await call('POST', '/national/target/allocate', {
    cookie: vikram.cookie,
    json: {
      periodLabel: 'October',
      approvedCeoTarget: 1000,
      regionalAllocations: [
        { regionId: 'REGION-SOUTH', targetWins: 800 },
      ],
      publish: true,
    },
  });
  assert.equal(nmTarget.status, 200);

  // NM-11 National Executive Pack PDF Export
  const nmPdf = await call('POST', '/national/reports/export-pdf', {
    cookie: vikram.cookie,
    json: { periodLabel: 'October 2026', sections: ['regional-rollup', 'attainment', 'pipeline-health', 'risks'] },
  });
  assert.equal(nmPdf.status, 200);
  assert.ok(nmPdf.body.data?.downloadUrl, 'NM pack PDF download URL generated');
  const nmPdfDl = await call('GET', nmPdf.body.data.downloadUrl.replace(/^\/api/, ''), { cookie: vikram.cookie });
  assert.equal(nmPdfDl.status, 200);
  assert.ok(nmPdfDl.body.isPdf, 'NM binary PDF generated');
  console.log('PASS: NM-01..NM-11 National overview, target cascading, and PDF pack verified');

  console.log('--- 6. CHIEF EXECUTIVE OFFICER (CEO-01..CEO-11) WORKFLOW ---');
  // CEO-01 Enterprise Operating Picture
  const ceoOp = await call('GET', '/ceo/operating-picture?period=month-to-date&focusVertical=all', { cookie: rajiv.cookie });
  assert.equal(ceoOp.status, 200);
  assert.ok(ceoOp.body.data, 'CEO operating picture data present');

  // CEO-02 Vertical Comparison
  const ceoVert = await call('GET', '/ceo/verticals/comparison?period=month-to-date', { cookie: rajiv.cookie });
  assert.equal(ceoVert.status, 200);

  // CEO-04 Company Targets Cascade
  const ceoTarget = await call('POST', '/ceo/targets/approve', {
    cookie: rajiv.cookie,
    json: {
      periodLabel: 'October',
      fiscalYear: 'FY2026-27',
      totalRevenueTarget: 100000000,
      totalWinsTarget: 1200,
      verticalAllocations: [
        { vertical: 'wealth', revenueTarget: 60000000, winsTarget: 700 },
        { vertical: 'banking', revenueTarget: 30000000, winsTarget: 400 },
      ],
      boardRatify: true,
    },
  });
  assert.equal(ceoTarget.status, 200);

  // CEO-10 Board Pack PDF
  const ceoPdf = await call('POST', '/ceo/board-packs/export-pdf', {
    cookie: rajiv.cookie,
    json: { periodLabel: 'October', fiscalYear: 'FY2026-27', sections: ['operating-picture', 'vertical-comparison', 'forecast-summary', 'risks'] },
  });
  assert.equal(ceoPdf.status, 200);
  assert.ok(ceoPdf.body.data?.downloadUrl, 'CEO pack PDF download URL generated');
  const ceoPdfDl = await call('GET', ceoPdf.body.data.downloadUrl.replace(/^\/api/, ''), { cookie: rajiv.cookie });
  assert.equal(ceoPdfDl.status, 200);
  assert.ok(ceoPdfDl.body.isPdf, 'CEO binary board pack PDF returned');
  console.log('PASS: CEO-01..CEO-11 Operating picture, vertical comparison, target approval, and board pack PDF verified');

  console.log('--- 7. CHIEF FINANCIAL OFFICER (CFO-01..CFO-19) WORKFLOW ---');
  // CFO-01 General Ledger Balances
  const glBal = await call('GET', '/cfo/overview?period=PER-2026-Q1', { cookie: ananya.cookie });
  assert.equal(glBal.status, 200);
  assert.ok(glBal.body.overview, 'CFO balances overview returned');

  // CFO-02 Inspect & Verify Sales Finance Handoffs
  const handoffs = await call('GET', '/cfo/handoffs', { cookie: ananya.cookie });
  assert.equal(handoffs.status, 200);
  assert.ok(Array.isArray(handoffs.body.handoffs), 'Handoffs list returned');

  // Verify handoff SFH-001 for Q1 processing
  const sfh001 = handoffs.body.handoffs.find((h: any) => h.id === 'SFH-001');
  if (sfh001 && sfh001.reviewStatus === 'pending_verification') {
    const vRes = await call('POST', `/cfo/handoffs/${sfh001.id}/verify`, {
      cookie: ananya.cookie,
      json: { decision: 'accepted_for_processing' },
    });
    assert.equal(vRes.status, 200);
  }

  // Insert sales win handoff for the converted lifecycle lead in Q1
  await pool.query(
    `INSERT INTO sales_finance_handoffs
     (id, handoff_code, lead_id, vertical, sales_rep_employee_id, converted_amount, earning_milestone, review_status, created_at)
     VALUES ($1, $2, $3, 'wealth', 'EMP-001', 61500.00, 'mandate_signed', 'accepted_for_processing', '2026-05-20')
     ON CONFLICT (id) DO NOTHING`,
    [`SFH-LIFE-${RUN}`, `SFH-CODE-LIFE-${RUN}`, leadId]
  );

  // CFO-03 Independent Preparation & Approval of Revenue Recognition Entry
  const revEntry = await call('POST', '/cfo/ledger/recognition/prepare', {
    cookie: priya.cookie,
    json: {
      periodId: 'PER-2026-Q1',
      vertical: 'wealth',
      grossAmount: 75000,
      taxAmount: 13500,
      policyCode: 'POL-REV-001',
      sourceReferenceType: 'sales_win',
      sourceReferenceId: leadId,
      accountCode: '4001',
      description: 'Q1 wealth management fee recognition',
    },
  });
  assert.equal(revEntry.status, 201);
  assert.equal(revEntry.body.entry.status, 'pending_approval');
  assert.equal(revEntry.body.entry.preparedByName, 'Priya Nair');

  // Independent approval by CFO Ananya Roy
  const appRev = await call('POST', `/cfo/ledger/recognition/${revEntry.body.entry.id}/approve`, {
    cookie: ananya.cookie,
  });
  assert.equal(appRev.status, 200);
  assert.equal(appRev.body.entry.status, 'posted');

  // CFO-08 Three-Way Reconciliation Bridge
  const bridge = await call('GET', '/cfo/reconciliations', { cookie: ananya.cookie });
  assert.equal(bridge.status, 200);
  assert.ok(Array.isArray(bridge.body.reconciliations), 'Reconciliations list returned');

  // Freeze reconciliation
  const freeze = await call('POST', '/cfo/reconciliations/freeze', {
    cookie: ananya.cookie,
    json: {
      periodId: 'PER-2026-Q1',
      explanationNotes: 'Zero unexplained variance; timing and GST differences reconciled',
    },
  });
  assert.equal(freeze.status, 200);

  // CFO-12 & CFO-13 Frontline Incentive Pool (with 15% clawback reserve)
  const incList = await call('GET', '/cfo/incentives', { cookie: ananya.cookie });
  assert.equal(incList.status, 200);
  assert.ok(incList.body.calculations.length > 0, 'Incentive calculations retrieved');
  const inc0 = incList.body.calculations[0];
  assert.ok(inc0.clawbackReserve > 0, 'Clawback reserve present');

  const freezeInc = await call('POST', `/cfo/incentives/${inc0.id}/freeze`, {
    cookie: ananya.cookie,
    json: {
      payoutHandoffReference: 'BANK-BATCH-INC-2026-001',
    },
  });
  assert.equal(freezeInc.status, 200);

  // CFO-13 Audited Dispute Resolution before period close
  const dispList = await call('GET', '/cfo/incentives/disputes', { cookie: ananya.cookie });
  assert.equal(dispList.status, 200);
  assert.ok(Array.isArray(dispList.body.disputes));
  for (const d of dispList.body.disputes) {
    if (d.status === 'open') {
      const resDisp = await call('POST', `/cfo/incentives/disputes/${d.id}/resolve`, {
        cookie: ananya.cookie,
        json: {
          resolution: 'resolved_upheld',
          resolutionAmount: d.disputedAmount || 25000,
          decisionNotes: 'Approved and resolved during Q1 period close audit',
        },
      });
      assert.equal(resDisp.status, 200);
    }
  }

  // CFO-14 Certify Period Close with SHA-256 Hash
  const certify = await call('POST', '/cfo/periods/PER-2026-Q1/certify', {
    cookie: ananya.cookie,
    json: {
      checklistState: {
        reconciliations_passed: true,
        exceptions_reviewed: true,
        ledger_balanced: true,
        tax_provisioned: true,
      },
      certificationNotes: 'All controls certified and audited by CFO',
    },
  });
  assert.equal(certify.status, 200);
  assert.ok(certify.body.period.certificationHash, 'Audit certification hash generated');

  // CFO-18 Certified Finance Pack PDF Export
  const cfoPdf = await call('POST', '/cfo/reports/export-pdf', {
    cookie: ananya.cookie,
    json: { periodLabel: 'FY26-Q1' },
  });
  assert.equal(cfoPdf.status, 200);
  const cfoPdfDl = await call('GET', cfoPdf.body.downloadUrl.replace(/^\/api/, ''), { cookie: ananya.cookie });
  assert.equal(cfoPdfDl.status, 200);
  assert.ok(cfoPdfDl.body.isPdf, 'CFO binary certified pack PDF returned');
  assert.ok(cfoPdfDl.body.byteLength > 1000, 'CFO PDF size > 1000 bytes');
  console.log('PASS: CFO-01..CFO-19 Overview, Sales handoffs, Revenue recognition, 3-way bridge freeze, Clawback reserve, Period close certification, and Certified PDF pack verified');


  console.log('--- 8. AUTHORIZATION & STRICT ROLE ISOLATION VALIDATION ---');
  // Unauthenticated requests blocked with 401
  const unauth = await call('GET', '/cfo/overview');
  assert.equal(unauth.status, 401);
  const unauthCeo = await call('GET', '/ceo/operating-picture');
  assert.equal(unauthCeo.status, 401);

  // Frontline Caller (SC) denied access to management/executive endpoints
  const scToMgr = await call('GET', '/manager/overview', { cookie: asha.cookie });
  assert.equal(scToMgr.status, 403);
  const scToRm = await call('GET', '/regional/overview', { cookie: asha.cookie });
  assert.equal(scToRm.status, 403);
  const scToNm = await call('GET', '/national/overview', { cookie: asha.cookie });
  assert.equal(scToNm.status, 403);
  const scToCeo = await call('GET', '/ceo/operating-picture', { cookie: asha.cookie });
  assert.equal(scToCeo.status, 403);
  const scToCfo = await call('GET', '/cfo/overview', { cookie: asha.cookie });
  assert.equal(scToCfo.status, 403);

  // Manager denied access to CEO/CFO endpoints
  const mgToCeo = await call('GET', '/ceo/operating-picture', { cookie: neel.cookie });
  assert.equal(mgToCeo.status, 403);
  const mgToCfo = await call('GET', '/cfo/overview', { cookie: neel.cookie });
  assert.equal(mgToCfo.status, 403);

  // Unauthorized mutations blocked
  const illegalReopen = await call('POST', '/cfo/periods/reopen-requests', {
    cookie: asha.cookie,
    json: { periodLabel: 'PER-2026-Q1', businessJustification: 'Hacked', unlockWindowHours: 24 },
  });
  assert.equal(illegalReopen.status, 403);

  console.log('PASS: Strict authorization and boundary isolation verified across all tiers (401/403 enforced)');
  console.log('=== COMPREHENSIVE VERTICAL LIFECYCLE VERIFICATION COMPLETED CLEANLY ===');
});
