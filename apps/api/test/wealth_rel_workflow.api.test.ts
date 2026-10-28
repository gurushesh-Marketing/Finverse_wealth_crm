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

const RUN_PREFIX = `WREL-${Date.now().toString().slice(-5)}`;
const testWealthLeadId = `${RUN_PREFIX}-LEAD-01`;
const returnWealthLeadId = `${RUN_PREFIX}-LEAD-02`;

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

test('Wealth Relationship Manager (REL) Workflow & SEBI Investor Suitability Journey', async (t) => {
  let callerCookie: string;
  let relCookie: string;
  let testHandoffId: string;
  let returnHandoffId: string;

  before(async () => {
    assertTestDatabaseGuard(env.DATABASE_URL);
    db = new Pool({ connectionString: env.DATABASE_URL });
    await cleanup();

    server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    // 1. Wealth Frontline Caller Asha Rao (EMP-001, role SC, vertical wealth)
    callerCookie = await loginAs('asha@finverse.demo');

    // 2. Wealth Relationship Manager Tara Iyer (EMP-003, role REL, vertical wealth)
    relCookie = await loginAs('tara@finverse.demo');

    // 3. Create fresh Wealth test leads
    await db.query(
      `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id, record_version)
       VALUES ($1, 'wealth', 'Vikramaditya Singhania', 'vikram@singhaniaholdings.test', '+91 98111 22334', 'English', 'Portfolio Management Services (PMS)', 'HNI Referral', 'contacted', 'EMP-001', 'TEAM-WEALTH-ALPHA', 1)`,
      [testWealthLeadId]
    );

    await db.query(
      `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id, record_version)
       VALUES ($1, 'wealth', 'Meera Nambiar', 'meera@nambiarcapital.test', '+91 98222 33445', 'English', 'Discretionary Portfolio Advisory', 'Private Banking Inbound', 'contacted', 'EMP-001', 'TEAM-WEALTH-ALPHA', 1)`,
      [returnWealthLeadId]
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

  await t.test('1. Wealth Role & Vertical Isolation: Tara Iyer is REL in Wealth scope', async () => {
    const me = await call('GET', '/auth/me', { cookie: relCookie });
    assert.equal(me.status, 200);
    assert.equal(me.body.session.role, 'REL');
    assert.equal(me.body.session.displayName, 'Tara Iyer');
    assert.ok(me.body.session.verticalGrants.includes('wealth'));
    assert.equal(me.body.session.verticalGrants.includes('banking'), false);
  });

  await t.test('2. Frontline Caller Asha Rao qualifies Wealth prospect with investible surplus ₹75L & PMS mandate', async () => {
    const qualifyPayload = {
      leadId: testWealthLeadId,
      wealthRequirement: {
        investibleSurplus: 7500000, // ₹75 Lakhs
        mandateType: 'Portfolio Management Services (PMS)',
        riskProfile: 'Growth',
        investmentHorizon: '3-5 Years',
        existingPortfolioSize: 5000000,
        currentBrokerOrAmc: 'Direct Mutual Funds / Zerodha',
        targetReturnExpectation: '14-16% CAGR',
      },
      qualificationEvidence: 'HNI profile verified; investible surplus confirmed via bank holdings statement; risk profiling complete.',
      requiredDocuments: [
        'PAN Card Copy',
        'Aadhaar Card Copy',
        'Client Master List (CML)',
        'Bank Proof',
        'Investor Suitability & Risk Declaration',
      ],
      notes: 'Client looking for active equity alpha generation via SEBI registered PMS.',
    };

    const res = await call('POST', '/rel/qualify-and-handoff', {
      cookie: callerCookie,
      json: qualifyPayload,
    });

    assert.equal(res.status, 201, `Failed to qualify: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.handoff);
    assert.equal(res.body.handoff.status, 'pending');
    assert.equal(res.body.handoff.relEmployeeId, 'EMP-003'); // Fair assignment routed to Tara Iyer
    assert.equal(res.body.handoff.relName, 'Tara Iyer');
    assert.equal(res.body.handoff.wealthRequirement.investibleSurplus, 7500000);
    assert.equal(res.body.handoff.wealthRequirement.mandateType, 'Portfolio Management Services (PMS)');
    testHandoffId = res.body.handoff.id;

    // Verify DB state: lead stage advanced to discovery & investible_surplus persisted
    const checkDb = await db.query(
      `SELECT stage, rel_owner_id, investible_surplus, requested_amount FROM leads WHERE id = $1`,
      [testWealthLeadId]
    );
    assert.equal(checkDb.rows[0].stage, 'discovery');
    assert.equal(Number(checkDb.rows[0].investible_surplus), 7500000);
  });

  await t.test('3. Relationship Manager Tara Iyer sees inbound Wealth handoff with surplus and mandate criteria', async () => {
    const res = await call('GET', '/rel/handoffs', { cookie: relCookie });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.handoffs));

    const matched = res.body.handoffs.find((h: any) => h.id === testHandoffId);
    assert.ok(matched, 'Handoff not found in RM queue');
    assert.equal(matched.status, 'pending');
    assert.equal(matched.callerName, 'Asha Rao');
    assert.equal(matched.wealthRequirement?.investibleSurplus, 7500000);
    assert.equal(matched.wealthRequirement?.mandateType, 'Portfolio Management Services (PMS)');
    assert.equal(matched.wealthRequirement?.riskProfile, 'Growth');
    assert.ok(matched.requiredDocuments.includes('Investor Suitability & Risk Declaration'));
  });

  await t.test('4. Tara Iyer accepts Wealth handoff: lead advances to suitability stage & rel_owner_id set', async () => {
    const res = await call('POST', `/rel/handoffs/${testHandoffId}/decision`, {
      cookie: relCookie,
      json: {
        decision: 'accept',
        nextStep: 'Conduct SEBI suitability assessment & draft AMC allocation proposal',
      },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.handoff);
    assert.equal(res.body.handoff.status, 'accepted');

    // DB Verification
    const leadCheck = await db.query(
      `SELECT stage, rel_owner_id FROM leads WHERE id = $1`,
      [testWealthLeadId]
    );
    assert.equal(leadCheck.rows[0].stage, 'suitability');
    assert.equal(leadCheck.rows[0].rel_owner_id, 'EMP-003');

    // Event audit trail logged
    const evtCheck = await db.query(
      `SELECT kind, note, actor_role FROM lead_events WHERE lead_id = $1 ORDER BY occurred_at DESC LIMIT 1`,
      [testWealthLeadId]
    );
    assert.equal(evtCheck.rows[0].kind, 'handoff-accepted');
    assert.equal(evtCheck.rows[0].actor_role, 'REL');
  });

  await t.test('5. Tara Iyer logs AMC Partner Coordination with Kotak Alternate Assets for PMS / AIF', async () => {
    const coordPayload = {
      institutionName: 'Kotak Alternate Assets',
      facilityOffered: 'Long-Short Equity AIF Cat III',
      sanctionAmount: 7500000,
      interestRate: '1.75% Fixed AMC + 15% carry above 10% hurdle',
      status: 'submitted',
      notes: 'Mandate draft submitted for investor KYC, CKYC sync and depository onboarding',
    };

    const res = await call('POST', `/rel/handoffs/${testHandoffId}/institution-coordination`, {
      cookie: relCookie,
      json: coordPayload,
    });

    assert.equal(res.status, 201);
    assert.ok(Array.isArray(res.body.institutionOptions));
    const latest = res.body.institutionOptions[res.body.institutionOptions.length - 1];
    assert.equal(latest.institutionName, 'Kotak Alternate Assets');
    assert.equal(latest.facilityOffered, 'Long-Short Equity AIF Cat III');
    assert.equal(latest.sanctionAmount, 7500000);
  });

  await t.test('6. Honest SEBI Suitability Check: unevidenced check is pending, becomes verified only with recorded evidence & explicit provenance', async () => {
    // 6a. Freshly handed-off prospect without recorded evidence must be pending_verification (must FAIL if claimed verified)
    const freshRes = await call('GET', `/rel/prospects/${testWealthLeadId}`, { cookie: relCookie });
    assert.equal(freshRes.status, 200);
    assert.equal(freshRes.body.prospect.id, testWealthLeadId);
    assert.equal(freshRes.body.prospect.stage, 'suitability');

    assert.ok(freshRes.body.suitabilityCheck, 'SEBI suitability check must be present for Wealth');
    assert.notEqual(freshRes.body.suitabilityCheck.status, 'verified', 'Unevidenced check must NOT be marked verified');
    assert.equal(freshRes.body.suitabilityCheck.status, 'pending_verification', 'Fresh check without evidence must be pending_verification');
    assert.equal(freshRes.body.suitabilityCheck.evidenceReference, null);
    assert.equal(freshRes.body.suitabilityCheck.source, 'none');
    assert.equal(freshRes.body.suitabilityCheck.kraVerified, false);
    assert.equal(freshRes.body.suitabilityCheck.isLiveProviderConnected, false);
    assert.match(freshRes.body.suitabilityCheck.notice, /pending/i);

    // Verify zero credit bureau check for Wealth
    assert.equal(freshRes.body.bureauStatus, null);
    assert.equal(freshRes.body.creditBureauCheck, null);

    // 6b. Tara Iyer records human-reviewed evidence
    const verifyRes = await call('POST', `/rel/prospects/${testWealthLeadId}/verification`, {
      cookie: relCookie,
      json: {
        checkType: 'suitability',
        status: 'verified',
        evidenceReference: 'SEBI-SUIT-MANDATE-2026-09',
        source: 'human_review',
        kraVerified: true,
        ckycStatus: 'verified',
        notes: 'Verified 3-year ITR, client depository holding sync via CDSL, and executed SEBI suitability matrix.',
      },
    });
    assert.equal(verifyRes.status, 200);

    // 6c. Check now returns verified with full provenance (evidenceRef, source, reviewer, timestamp)
    const verifiedRes = await call('GET', `/rel/prospects/${testWealthLeadId}`, { cookie: relCookie });
    assert.equal(verifiedRes.status, 200);
    assert.equal(verifiedRes.body.suitabilityCheck.status, 'verified');
    assert.equal(verifiedRes.body.suitabilityCheck.evidenceReference, 'SEBI-SUIT-MANDATE-2026-09');
    assert.equal(verifiedRes.body.suitabilityCheck.source, 'human_review');
    assert.equal(verifiedRes.body.suitabilityCheck.reviewerOrProvider, 'Tara Iyer');
    assert.ok(verifiedRes.body.suitabilityCheck.verifiedAt);
    assert.equal(verifiedRes.body.suitabilityCheck.kraVerified, true);
    assert.equal(verifiedRes.body.suitabilityCheck.ckycStatus, 'verified');
    assert.match(verifiedRes.body.suitabilityCheck.notice, /depository/i);

    // Verify wealth mandate requirements present in detail
    assert.equal(verifiedRes.body.prospect.investibleSurplus, 7500000);
    assert.equal(verifiedRes.body.prospect.mandateType, 'Portfolio Management Services (PMS)');
    assert.equal(verifiedRes.body.prospect.riskProfile, 'Growth');
  });

  await t.test('7. Return Flow: Tara Iyer returns deficient Wealth handoff; stage reverts to contacted with mandatory reason', async () => {
    // Frontline caller qualifies second lead
    const q2 = await call('POST', '/rel/qualify-and-handoff', {
      cookie: callerCookie,
      json: {
        leadId: returnWealthLeadId,
        wealthRequirement: {
          investibleSurplus: 3500000, // ₹35 Lakhs (below statutory ₹50L PMS threshold)
          mandateType: 'Portfolio Management Services (PMS)',
          riskProfile: 'Conservative',
          investmentHorizon: '1-3 Years',
        },
        qualificationEvidence: 'Client requested PMS but surplus is below ₹50L statutory threshold.',
        requiredDocuments: ['PAN Card Copy'],
      },
    });
    assert.equal(q2.status, 201, `Failed to qualify q2: ${JSON.stringify(q2.body)}`);
    returnHandoffId = q2.body.handoff.id;

    // Tara Iyer rejects/returns handoff with specific reason
    const returnReason = 'Investible surplus is ₹35 Lakhs, which is below the SEBI statutory threshold of ₹50 Lakhs for PMS mandates. Recommend mutual fund advisory instead.';
    const res = await call('POST', `/rel/handoffs/${returnHandoffId}/decision`, {
      cookie: relCookie,
      json: {
        decision: 'return',
        reason: returnReason,
      },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.handoff);
    assert.equal(res.body.handoff.status, 'returned');
    assert.equal(res.body.handoff.decisionReason, returnReason);

    // Verify lead stage reverted to contacted
    const leadCheck = await db.query(`SELECT stage, rel_owner_id FROM leads WHERE id = $1`, [returnWealthLeadId]);
    assert.equal(leadCheck.rows[0].stage, 'contacted');

    // Frontline caller Asha Rao sees returned status & reason
    const callerQueue = await call('GET', '/rel/handoffs', { cookie: callerCookie });
    assert.equal(callerQueue.status, 200);
    const returnedEntry = callerQueue.body.handoffs.find((h: any) => h.id === returnHandoffId);
    assert.ok(returnedEntry);
    assert.equal(returnedEntry.status, 'returned');
    assert.equal(returnedEntry.decisionReason, returnReason);
  });

  await t.test('8. Caller Privacy & Security: Confidential AMC fee structures stripped from caller responses', async () => {
    const callerHandoffs = await call('GET', '/rel/handoffs', { cookie: callerCookie });
    assert.equal(callerHandoffs.status, 200);
    const acceptedEntry = callerHandoffs.body.handoffs.find((h: any) => h.id === testHandoffId);
    assert.ok(acceptedEntry);
    // Sales caller cannot see institution options / confidential AMC fee terms
    assert.equal(acceptedEntry.institutionOptions, undefined);
  });
});
