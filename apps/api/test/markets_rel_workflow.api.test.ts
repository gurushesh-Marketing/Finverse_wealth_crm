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

const RUN_PREFIX = `MREL-${Date.now().toString().slice(-5)}`;
const testMarketsLeadId = `${RUN_PREFIX}-LEAD-01`;
const returnMarketsLeadId = `${RUN_PREFIX}-LEAD-02`;

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

test('Markets/Trading Relationship Manager (REL) Workflow & SEBI Suitability / Clearing Journey', async (t) => {
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

    // 1. Markets Frontline Caller Kabir Joshi (EMP-021, role SC, vertical markets)
    callerCookie = await loginAs('kabir@finverse.demo');

    // 2. Markets Relationship Manager Meera Nair (EMP-005, role REL, vertical markets)
    relCookie = await loginAs('meera@finverse.demo');

    // 3. Create fresh Markets test leads
    await db.query(
      `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id, record_version)
       VALUES ($1, 'markets', 'Arjun Singhal (Pro Traders)', 'arjun@protraders.test', '+91 98333 44556', 'English', 'F&O Derivatives & Intraday Trading', 'Trading Portal Intake', 'contacted', 'EMP-021', 'TEAM-MARKETS-ALPHA', 1)`,
      [testMarketsLeadId]
    );

    await db.query(
      `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id, record_version)
       VALUES ($1, 'markets', 'Siddharth Roy', 'siddharth@investor.test', '+91 98444 55667', 'English', 'Commodities & Currencies', 'Digital Intake', 'contacted', 'EMP-021', 'TEAM-MARKETS-ALPHA', 1)`,
      [returnMarketsLeadId]
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

  await t.test('1. Markets Role & Vertical Isolation: Meera Nair is REL in Markets scope', async () => {
    const me = await call('GET', '/auth/me', { cookie: relCookie });
    assert.equal(me.status, 200);
    assert.equal(me.body.session.role, 'REL');
    assert.equal(me.body.session.displayName, 'Meera Nair');
    assert.ok(me.body.session.verticalGrants.includes('markets'));
    assert.equal(me.body.session.verticalGrants.includes('banking'), false);
    assert.equal(me.body.session.verticalGrants.includes('wealth'), false);
  });

  await t.test('2. Frontline Caller Kabir Joshi qualifies Markets prospect with trading capital ₹25L & F&O derivatives segment', async () => {
    const qualifyPayload = {
      leadId: testMarketsLeadId,
      marketsRequirement: {
        tradingCapital: 2500000, // ₹25 Lakhs
        tradingSegment: 'F&O Derivatives (Futures & Options)',
        tradingExperience: 'Active / Professional (3+ Years)',
        riskTolerance: 'High / Speculative (Active F&O & Leverage)',
        depositoryPreference: 'CDSL (Central Depository Services India)',
        incomeProofAvailable: true,
        existingBroker: 'Zerodha Broking Ltd',
      },
      qualificationEvidence: 'Active trader with 4 years options trading history; 6-month bank statement verified; SEBI derivative risk disclosure declared.',
      requiredDocuments: [
        'PAN Card Copy',
        'Aadhaar XML Verification',
        '6-Month Bank Statement (Derivative Segment Activation)',
        'Cancelled Cheque (MICR/IFSC Verified)',
        'SEBI Mandatory Derivative Risk Disclosure',
      ],
      notes: 'Client seeking institutional direct market access (DMA) and professional clearing facility.',
    };

    const res = await call('POST', '/rel/qualify-and-handoff', {
      cookie: callerCookie,
      json: qualifyPayload,
    });

    assert.equal(res.status, 201, `Failed to qualify: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.handoff);
    assert.equal(res.body.handoff.status, 'pending');
    assert.equal(res.body.handoff.relEmployeeId, 'EMP-005'); // Fair assignment routed to Meera Nair
    assert.equal(res.body.handoff.relName, 'Meera Nair');
    assert.equal(res.body.handoff.marketsRequirement.tradingCapital, 2500000);
    assert.equal(res.body.handoff.marketsRequirement.tradingSegment, 'F&O Derivatives (Futures & Options)');
    assert.equal(res.body.handoff.marketsRequirement.incomeProofAvailable, true);
    testHandoffId = res.body.handoff.id;

    // Verify DB state: lead stage advanced to kyc & trading_capital persisted
    const checkDb = await db.query(
      `SELECT stage, rel_owner_id, trading_capital, requested_amount FROM leads WHERE id = $1`,
      [testMarketsLeadId]
    );
    assert.equal(checkDb.rows[0].stage, 'kyc');
    assert.equal(Number(checkDb.rows[0].trading_capital), 2500000);
    assert.equal(Number(checkDb.rows[0].requested_amount), 2500000);
  });

  await t.test('3. Relationship Manager Meera Nair sees inbound Markets handoff with capital and F&O segment', async () => {
    const res = await call('GET', '/rel/handoffs', { cookie: relCookie });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.handoffs));

    const matched = res.body.handoffs.find((h: any) => h.id === testHandoffId);
    assert.ok(matched, 'Handoff not found in RM queue');
    assert.equal(matched.status, 'pending');
    assert.equal(matched.callerName, 'Kabir Joshi');
    assert.equal(matched.marketsRequirement?.tradingCapital, 2500000);
    assert.equal(matched.marketsRequirement?.tradingSegment, 'F&O Derivatives (Futures & Options)');
    assert.equal(matched.marketsRequirement?.riskTolerance, 'High / Speculative (Active F&O & Leverage)');
    assert.ok(matched.requiredDocuments.includes('SEBI Mandatory Derivative Risk Disclosure'));
  });

  await t.test('4. Meera Nair accepts Markets handoff: lead advances to risk-profile stage & rel_owner_id set', async () => {
    const res = await call('POST', `/rel/handoffs/${testHandoffId}/decision`, {
      cookie: relCookie,
      json: {
        decision: 'accept',
        nextStep: 'SEBI CKYC verification, derivative income proof & clearing setup',
      },
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.handoff);
    assert.equal(res.body.handoff.status, 'accepted');

    // DB Verification: lead stage advanced to risk-profile
    const leadCheck = await db.query(
      `SELECT stage, rel_owner_id FROM leads WHERE id = $1`,
      [testMarketsLeadId]
    );
    assert.equal(leadCheck.rows[0].stage, 'risk-profile');
    assert.equal(leadCheck.rows[0].rel_owner_id, 'EMP-005');

    // Event audit trail logged
    const evtCheck = await db.query(
      `SELECT kind, note, actor_role FROM lead_events WHERE lead_id = $1 ORDER BY occurred_at DESC LIMIT 1`,
      [testMarketsLeadId]
    );
    assert.equal(evtCheck.rows[0].kind, 'handoff-accepted');
    assert.equal(evtCheck.rows[0].actor_role, 'REL');
  });

  await t.test('5. Meera Nair logs Clearing Member Coordination with NSE Clearing Limited (NCL)', async () => {
    const coordPayload = {
      institutionName: 'NSE Clearing Limited (NCL)',
      facilityOffered: 'F&O Clearing & Margin Facility',
      sanctionAmount: 2500000,
      interestRate: '0.02% per contract + SEBI turnover charges',
      status: 'submitted',
      notes: 'Direct clearing member participant setup with CDSL margin pledge',
    };

    const res = await call('POST', `/rel/handoffs/${testHandoffId}/institution-coordination`, {
      cookie: relCookie,
      json: coordPayload,
    });

    assert.equal(res.status, 201);
    assert.ok(Array.isArray(res.body.institutionOptions));
    const latest = res.body.institutionOptions[res.body.institutionOptions.length - 1];
    assert.equal(latest.institutionName, 'NSE Clearing Limited (NCL)');
    assert.equal(latest.facilityOffered, 'F&O Clearing & Margin Facility');
    assert.equal(latest.sanctionAmount, 2500000);
  });

  await t.test('6. Honest SEBI CKYC & Risk Disclosure: unevidenced check is pending, becomes verified only with recorded evidence & explicit provenance', async () => {
    // 6a. Freshly handed-off prospect without recorded evidence must be pending_verification (must FAIL if claimed verified)
    const freshRes = await call('GET', `/rel/prospects/${testMarketsLeadId}`, { cookie: relCookie });
    assert.equal(freshRes.status, 200);
    assert.equal(freshRes.body.prospect.id, testMarketsLeadId);
    assert.equal(freshRes.body.prospect.stage, 'risk-profile');

    assert.ok(freshRes.body.marketsKycCheck, 'SEBI Markets KYC check must be present for Markets');
    assert.notEqual(freshRes.body.marketsKycCheck.status, 'verified', 'Unevidenced check must NOT be marked verified');
    assert.equal(freshRes.body.marketsKycCheck.status, 'pending_verification', 'Fresh check without evidence must be pending_verification');
    assert.equal(freshRes.body.marketsKycCheck.evidenceReference, null);
    assert.equal(freshRes.body.marketsKycCheck.source, 'none');
    assert.equal(freshRes.body.marketsKycCheck.ckycVerified, false);
    assert.equal(freshRes.body.marketsKycCheck.sebiRiskDisclosureAcknowledged, false);
    assert.equal(freshRes.body.marketsKycCheck.isLiveProviderConnected, false);
    assert.match(freshRes.body.marketsKycCheck.notice, /pending/i);

    // Verify zero credit bureau check for Markets
    assert.equal(freshRes.body.bureauStatus, null);
    assert.equal(freshRes.body.creditBureauCheck, null);

    // 6b. Meera Nair records human-reviewed evidence
    const verifyRes = await call('POST', `/rel/prospects/${testMarketsLeadId}/verification`, {
      cookie: relCookie,
      json: {
        checkType: 'markets_kyc',
        status: 'verified',
        evidenceReference: 'SEBI-CKYC-DISCLOSURE-2026-99',
        source: 'human_review',
        ckycStatus: 'verified',
        incomeProofStatus: 'verified',
        sebiRiskDisclosureAcknowledged: true,
        notes: 'Client completed depository sync via CDSL, submitted 6-month bank statement income proof, and signed mandatory SEBI derivative risk disclosure.',
      },
    });
    assert.equal(verifyRes.status, 200);

    // 6c. Check now returns verified with full provenance (evidenceRef, source, reviewer, timestamp)
    const verifiedRes = await call('GET', `/rel/prospects/${testMarketsLeadId}`, { cookie: relCookie });
    assert.equal(verifiedRes.status, 200);
    assert.equal(verifiedRes.body.marketsKycCheck.status, 'verified');
    assert.equal(verifiedRes.body.marketsKycCheck.evidenceReference, 'SEBI-CKYC-DISCLOSURE-2026-99');
    assert.equal(verifiedRes.body.marketsKycCheck.source, 'human_review');
    assert.equal(verifiedRes.body.marketsKycCheck.reviewerOrProvider, 'Meera Nair');
    assert.ok(verifiedRes.body.marketsKycCheck.verifiedAt);
    assert.equal(verifiedRes.body.marketsKycCheck.ckycVerified, true);
    assert.equal(verifiedRes.body.marketsKycCheck.incomeProofStatus, 'verified');
    assert.equal(verifiedRes.body.marketsKycCheck.sebiRiskDisclosureAcknowledged, true);
    assert.match(verifiedRes.body.marketsKycCheck.notice, /9 out of 10/i);

    // Verify markets trading requirements present in detail
    assert.equal(verifiedRes.body.prospect.tradingCapital, 2500000);
    assert.equal(verifiedRes.body.prospect.tradingSegment, 'F&O Derivatives (Futures & Options)');
    assert.equal(verifiedRes.body.prospect.tradingExperience, 'Active / Professional (3+ Years)');
    assert.equal(verifiedRes.body.prospect.riskTolerance, 'High / Speculative (Active F&O & Leverage)');
  });

  await t.test('7. Return Flow: Meera Nair returns deficient Markets handoff; stage reverts to contacted with mandatory reason', async () => {
    // Frontline caller qualifies second lead without income proof
    const q2 = await call('POST', '/rel/qualify-and-handoff', {
      cookie: callerCookie,
      json: {
        leadId: returnMarketsLeadId,
        marketsRequirement: {
          tradingCapital: 500000, // ₹5 Lakhs
          tradingSegment: 'Commodities & Currencies',
          tradingExperience: 'Beginner (< 1 Year)',
          riskTolerance: 'Moderate (Equity Delivery + Index Hedging)',
          depositoryPreference: 'NSDL (National Securities Depository Limited)',
          incomeProofAvailable: false, // Deficient!
        },
        qualificationEvidence: 'Client requested commodities derivatives but has no income proof.',
        requiredDocuments: ['PAN Card Copy'],
      },
    });
    assert.equal(q2.status, 201, `Failed to qualify q2: ${JSON.stringify(q2.body)}`);
    returnHandoffId = q2.body.handoff.id;

    // Meera Nair returns handoff with specific reason
    const returnReason = 'Client lacks 6 months bank statement or ITR income proof required under SEBI regulations for derivative segment activation. Cannot activate F&O without mandatory income proof.';
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
    const leadCheck = await db.query(`SELECT stage, rel_owner_id FROM leads WHERE id = $1`, [returnMarketsLeadId]);
    assert.equal(leadCheck.rows[0].stage, 'contacted');

    // Frontline caller Kabir Joshi sees returned status & reason
    const callerQueue = await call('GET', '/rel/handoffs', { cookie: callerCookie });
    assert.equal(callerQueue.status, 200);
    const returnedEntry = callerQueue.body.handoffs.find((h: any) => h.id === returnHandoffId);
    assert.ok(returnedEntry);
    assert.equal(returnedEntry.status, 'returned');
    assert.equal(returnedEntry.decisionReason, returnReason);
  });

  await t.test('8. Caller Privacy & Security: Confidential Clearing member tariff terms stripped from caller responses', async () => {
    const callerHandoffs = await call('GET', '/rel/handoffs', { cookie: callerCookie });
    assert.equal(callerHandoffs.status, 200);
    const acceptedEntry = callerHandoffs.body.handoffs.find((h: any) => h.id === testHandoffId);
    assert.ok(acceptedEntry);
    // Sales caller cannot see institution options / confidential clearing member fee terms
    assert.equal(acceptedEntry.institutionOptions, undefined);
  });
});
