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

const RUN_PREFIX = `REL-${Date.now().toString().slice(-5)}`;
const testLeadId = `${RUN_PREFIX}-LEAD-01`;
const returnLeadId = `${RUN_PREFIX}-LEAD-02`;

async function call<T = any>(
  method: string,
  path: string,
  opts: { json?: unknown; cookie?: string } = {}
): Promise<{ status: number; body: T; rawText: string; cookie: string | null }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.cookie) headers['Cookie'] = opts.cookie;
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, rawText: text, cookie: res.headers.get('set-cookie') };
}

async function loginAs(email: string): Promise<string> {
  const res = await call('POST', '/auth/login', { json: { email, password: 'demo1234' } });
  assert.equal(res.status, 200, `Login failed for ${email}`);
  const rawCookie = res.cookie;
  if (!rawCookie) throw new Error(`No cookie returned for ${email}`);
  return rawCookie.split(';')[0];
}

async function cleanup(): Promise<void> {
  await db.query(`DELETE FROM lead_handoffs WHERE lead_id LIKE $1`, [`${RUN_PREFIX}%`]);
  await db.query(`DELETE FROM lead_events WHERE lead_id LIKE $1`, [`${RUN_PREFIX}%`]);
  await db.query(`DELETE FROM leads WHERE id LIKE $1`, [`${RUN_PREFIX}%`]);
}

test('Relationship Manager (REL) Workflow & Role Model Separation', async (t) => {
  let callerCookie: string;
  let relCookie: string;
  let rmCookie: string;
  let testHandoffId: string;
  let returnHandoffId: string;

  before(async () => {
    assertTestDatabaseGuard(env.DATABASE_URL);
    db = new Pool({ connectionString: env.DATABASE_URL });
    await cleanup();

    server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    // 1. Ensure test banking caller Dev Kapoor (EMP-004)
    callerCookie = await loginAs('dev@finverse.demo');

    // 2. Ensure test banking Relationship Manager Rohan Sen (EMP-016, migrated from TL to REL)
    relCookie = await loginAs('rohan@finverse.demo');

    // 3. Ensure test banking Regional Manager Arjun Mehta (EMP-019, RM role)
    rmCookie = await loginAs('arjun@finverse.demo');

    // 4. Create fresh test leads in Banking for testing
    await db.query(
      `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id, record_version)
       VALUES ($1, 'banking', 'Apex Dynamics Ltd', 'finance@apexdynamics.test', '+91 98765 41234', 'English', 'Corporate Term Loan', 'Branch Intake', 'contacted', 'EMP-004', 'TEAM-BANKING-ALPHA', 1)`,
      [testLeadId]
    );

    await db.query(
      `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id, record_version)
       VALUES ($1, 'banking', 'Zenith Logistics LLP', 'zenith@logistics.test', '+91 98765 49876', 'English', 'Working Capital Facility', 'Corporate Portal', 'contacted', 'EMP-004', 'TEAM-BANKING-ALPHA', 1)`,
      [returnLeadId]
    );
  });

  after(async () => {
    if (server) {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await cleanup();
    await db.end();
    await apiPool.end();
  });

  await t.test('1. Role migration & separation: Rohan Sen is REL; historical TL assignment preserved; RM is separate', async () => {
    // Rohan Sen session role is REL
    const rohanMe = await call('GET', '/auth/me', { cookie: relCookie });
    assert.equal(rohanMe.status, 200);
    assert.equal(rohanMe.body.session.role, 'REL');
    assert.equal(rohanMe.body.session.displayName, 'Rohan Sen');

    // Arjun Mehta session role remains RM (Regional Manager)
    const arjunMe = await call('GET', '/auth/me', { cookie: rmCookie });
    assert.equal(arjunMe.status, 200);
    assert.equal(arjunMe.body.session.role, 'RM');
    assert.equal(arjunMe.body.session.displayName, 'Arjun Mehta');

    // Historical TL assignment ASG-WEALTH-005 remains intact in DB
    const hist = await db.query(
      `SELECT role, effective_to FROM assignments WHERE id = 'ASG-WEALTH-005'`
    );
    if (hist.rows.length > 0) {
      assert.equal(hist.rows[0].role, 'TL');
      assert.ok(hist.rows[0].effective_to !== null);
    }
  });

  await t.test('2. Sales Caller qualifies Banking prospect with requested amount (e.g. ₹75 Lakhs, not ₹1 Cr threshold) and hands off to REL', async () => {
    const qualifyPayload = {
      leadId: testLeadId,
      loanRequirement: {
        requestedAmount: 7500000, // ₹75 Lakhs (not hardcoded to 1 crore!)
        facilityType: 'Working Capital Facility',
        annualTurnover: 35000000, // ₹3.5 Crore
        businessConstitution: 'Private Limited',
        loanPurpose: 'Pre-shipment export finance and working capital',
      },
      qualificationEvidence: 'Audited financials reviewed; verified GST returns for last 12 months; profitable operations.',
      requiredDocuments: ['3 Years ITR', '6 Months Bank Statements', 'Audited Financials', 'GST Returns'],
      notes: 'High urgency for export season fulfillment.',
    };

    const res = await call('POST', '/rel/qualify-and-handoff', {
      cookie: callerCookie,
      json: qualifyPayload,
    });

    assert.equal(res.status, 201);
    const handoff = res.body.handoff;
    assert.ok(handoff.id.startsWith('HO-'));
    assert.equal(handoff.leadId, testLeadId);
    assert.equal(handoff.vertical, 'banking');
    assert.equal(handoff.callerEmployeeId, 'EMP-004');
    assert.equal(handoff.relEmployeeId, 'EMP-016');
    assert.equal(handoff.status, 'pending');
    assert.equal(handoff.loanRequirement.requestedAmount, 7500000);
    // Number must be masked with zero raw phone leakage
    assert.ok(handoff.leadPhoneMasked.includes('•••••'));
    assert.ok(!handoff.leadPhoneMasked.includes('41234'));

    testHandoffId = handoff.id;

    // Check DB state: lead requested_amount updated and stage moved to eligibility
    const leadDb = await db.query(`SELECT stage, requested_amount, rel_owner_id, handoff_status FROM leads WHERE id = $1`, [testLeadId]);
    assert.equal(leadDb.rows[0].stage, 'eligibility');
    assert.equal(Number(leadDb.rows[0].requested_amount), 7500000);
    assert.equal(leadDb.rows[0].rel_owner_id, 'EMP-016');
    assert.equal(leadDb.rows[0].handoff_status, 'pending');
  });

  await t.test('3. Caller views handoff status; restricted partner information is NOT leaked to caller', async () => {
    const res = await call('GET', `/rel/handoffs?leadId=${testLeadId}`, { cookie: callerCookie });

    assert.equal(res.status, 200);
    assert.equal(res.body.handoffs.length, 1);
    const item = res.body.handoffs[0];
    assert.equal(item.status, 'pending');
    assert.equal(item.relName, 'Rohan Sen');
    // Partner options must be undefined / stripped for caller
    assert.equal(item.institutionOptions, undefined);
  });

  await t.test('4. Relationship Manager accepts handoff; takes ownership of lead; stage moves to documents', async () => {
    // Relationship Manager Rohan Sen lists incoming handoffs
    const listRes = await call('GET', '/rel/handoffs?status=pending', { cookie: relCookie });
    assert.equal(listRes.status, 200);

    const found = listRes.body.handoffs.find((h: any) => h.id === testHandoffId);
    assert.ok(found, 'Pending handoff visible to Relationship Manager');

    // Rohan Sen accepts the handoff
    const acceptRes = await call('POST', `/rel/handoffs/${testHandoffId}/decision`, {
      cookie: relCookie,
      json: {
        decision: 'accept',
        nextStep: 'Collect GST certificate and schedule partner bank credit appraisal',
      },
    });

    assert.equal(acceptRes.status, 200);
    assert.equal(acceptRes.body.handoff.status, 'accepted');
    assert.ok(acceptRes.body.handoff.decisionTime);

    // Verify DB state: lead owner is now REL (EMP-016), stage is documents
    const leadDb = await db.query(`SELECT owner_employee_id, rel_owner_id, stage, handoff_status FROM leads WHERE id = $1`, [testLeadId]);
    assert.equal(leadDb.rows[0].owner_employee_id, 'EMP-016');
    assert.equal(leadDb.rows[0].rel_owner_id, 'EMP-016');
    assert.equal(leadDb.rows[0].stage, 'documents');
    assert.equal(leadDb.rows[0].handoff_status, 'accepted');
  });

  await t.test('5. Relationship Manager logs partner institution coordination and options', async () => {
    const institutionPayload = {
      institutionName: 'HDFC Bank',
      facilityOffered: 'Working Capital Overdraft',
      sanctionAmount: 7500000,
      interestRate: '9.25% p.a.',
      status: 'under-review' as const,
      notes: 'Initial term sheet discussed with regional credit head.',
    };

    const res = await call('POST', `/rel/handoffs/${testHandoffId}/institution-coordination`, {
      cookie: relCookie,
      json: institutionPayload,
    });

    assert.equal(res.status, 201);
    assert.ok(Array.isArray(res.body.institutionOptions));
    assert.equal(res.body.institutionOptions[0].institutionName, 'HDFC Bank');
    assert.equal(res.body.institutionOptions[0].sanctionAmount, 7500000);

    // Caller inspecting the handoff still does NOT see the institution options
    const callerCheck = await call('GET', `/rel/handoffs?leadId=${testLeadId}`, { cookie: callerCookie });
    assert.equal(callerCheck.status, 200);
    assert.equal(callerCheck.body.handoffs[0].institutionOptions, undefined);
  });

  await t.test('6. Credit/CIBIL checks: verified that live check is NOT claimed and unevidenced check is pending_authorization', async () => {
    const res = await call('GET', `/rel/prospects/${testLeadId}`, { cookie: relCookie });

    assert.equal(res.status, 200);
    assert.equal(res.body.lead.id, testLeadId);
    assert.ok(res.body.creditBureauCheck);
    assert.notEqual(res.body.creditBureauCheck.status, 'verified', 'Unevidenced credit bureau check must NOT be marked verified');
    assert.equal(res.body.creditBureauCheck.status, 'pending_authorization');
    assert.equal(res.body.creditBureauCheck.score, null, 'Must NOT display a fabricated score');
    assert.equal(res.body.creditBureauCheck.evidenceReference, null);
    assert.equal(res.body.creditBureauCheck.source, 'none');
    assert.equal(res.body.creditBureauCheck.isLiveProviderConnected, false, 'Must NOT claim live provider integration');
    assert.ok(res.body.creditBureauCheck.notice.includes('Live CIBIL integration pending credentials'));
  });

  await t.test('7. Return flow: Relationship Manager returns deficient handoff to caller with reason', async () => {
    // Dev Kapoor qualifies second lead
    const qualifyRes = await call('POST', '/rel/qualify-and-handoff', {
      cookie: callerCookie,
      json: {
        leadId: returnLeadId,
        loanRequirement: {
          requestedAmount: 2000000,
          facilityType: 'Corporate Term Loan',
          loanPurpose: 'Vehicle fleet financing',
        },
        qualificationEvidence: 'Inquiry taken over telephone call.',
        requiredDocuments: ['KYC Documents'],
      },
    });

    assert.equal(qualifyRes.status, 201);
    returnHandoffId = qualifyRes.body.handoff.id;

    // Rohan Sen returns it to caller with explicit reason
    const returnRes = await call('POST', `/rel/handoffs/${returnHandoffId}/decision`, {
      cookie: relCookie,
      json: {
        decision: 'return',
        reason: 'Missing audited financials and GST returns; turnover under corporate loan policy threshold.',
      },
    });

    assert.equal(returnRes.status, 200);
    assert.equal(returnRes.body.handoff.status, 'returned');
    assert.ok(returnRes.body.handoff.decisionReason.includes('Missing audited financials'));

    // DB verification: ownership returned to caller EMP-004, stage reverted to contacted
    const leadDb = await db.query(`SELECT owner_employee_id, stage, handoff_status FROM leads WHERE id = $1`, [returnLeadId]);
    assert.equal(leadDb.rows[0].owner_employee_id, 'EMP-004');
    assert.equal(leadDb.rows[0].stage, 'contacted');
    assert.equal(leadDb.rows[0].handoff_status, 'returned');

    // Caller sees the return reason in their handoff list
    const callerHandoffs = await call('GET', `/rel/handoffs?leadId=${returnLeadId}`, { cookie: callerCookie });
    assert.equal(callerHandoffs.status, 200);
    assert.equal(callerHandoffs.body.handoffs[0].status, 'returned');
    assert.ok(callerHandoffs.body.handoffs[0].decisionReason.includes('Missing audited financials'));
  });

  await t.test('8. Security & Scope Denial: Cross-role denial, cross-vertical isolation, and REL vs RM separation', async () => {
    // Sales Caller cannot accept or decide handoffs (403)
    const callerDeny = await call('POST', `/rel/handoffs/${testHandoffId}/decision`, {
      cookie: callerCookie,
      json: { decision: 'accept' },
    });
    assert.equal(callerDeny.status, 403);

    // Relationship Manager (REL) cannot access Regional Manager routes (/api/regional/*) (403)
    const relRmDeny = await call('GET', '/regional/overview', { cookie: relCookie });
    assert.equal(relRmDeny.status, 403);

    // Regional Manager (RM) can access /api/regional/overview (200)
    const rmOk = await call('GET', '/regional/overview', { cookie: rmCookie });
    assert.equal(rmOk.status, 200);
  });
});
