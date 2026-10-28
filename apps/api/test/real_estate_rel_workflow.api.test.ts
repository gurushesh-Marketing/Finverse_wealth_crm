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

const RUN_PREFIX = `REREL-${Date.now().toString().slice(-5)}`;
const testReLeadId = `${RUN_PREFIX}-LEAD-01`;
const returnReLeadId = `${RUN_PREFIX}-LEAD-02`;

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

test('Real Estate Relationship Manager (REL) Workflow & Developer / RERA Journey', async (t) => {
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

    // 1. Real Estate Frontline Caller Sameer Kulkarni (EMP-026, role SC, vertical real_estate)
    callerCookie = await loginAs('sameer@finverse.demo');

    // 2. Real Estate Relationship Manager Neha Gupta (EMP-027, role REL, vertical real_estate)
    relCookie = await loginAs('neha.g@finverse.demo');

    // 3. Real Estate Regional Manager Siddharth Malhotra (EMP-029, role RM, vertical real_estate)
    rmCookie = await loginAs('siddharth.m@finverse.demo');

    // 4. Create fresh Real Estate test leads
    await db.query(
      `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id, record_version)
       VALUES ($1, 'real_estate', 'Radhika Singhania (Luxury Villa)', 'radhika@villa.test', '+91 98222 33445', 'English', 'Luxury Residential Mandate', 'Private Banking HNI Referral', 'contacted', 'EMP-026', 'TEAM-REALESTATE-ALPHA', 1)`,
      [testReLeadId]
    );

    await db.query(
      `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id, record_version)
       VALUES ($1, 'real_estate', 'Karan Mehra', 'karan@investor.test', '+91 98111 22334', 'English', 'Commercial Office Space', 'Developer Direct Intake', 'contacted', 'EMP-026', 'TEAM-REALESTATE-ALPHA', 1)`,
      [returnReLeadId]
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

  await t.test('1. Real Estate Role & Vertical Isolation: Neha Gupta is REL, Siddharth Malhotra is RM', async () => {
    const meRel = await call('GET', '/auth/me', { cookie: relCookie });
    assert.equal(meRel.status, 200);
    assert.equal(meRel.body.session.role, 'REL');
    assert.equal(meRel.body.session.displayName, 'Neha Gupta');
    assert.ok(meRel.body.session.verticalGrants.includes('real_estate'));
    assert.equal(meRel.body.session.verticalGrants.includes('banking'), false);

    const meRm = await call('GET', '/auth/me', { cookie: rmCookie });
    assert.equal(meRm.status, 200);
    assert.equal(meRm.body.session.role, 'RM');
    assert.equal(meRm.body.session.displayName, 'Siddharth Malhotra');
    assert.ok(meRm.body.session.verticalGrants.includes('real_estate'));
  });

  await t.test('2. Frontline Caller Sameer Kulkarni qualifies Real Estate prospect with property budget ₹3.5 Cr & Luxury Villa', async () => {
    const qualifyPayload = {
      leadId: testReLeadId,
      realEstateRequirement: {
        budget: 35000000, // ₹3.5 Crores
        propertyType: 'Luxury Residential Villa / Apartment',
        preferredLocation: 'Worli / Bandra West',
        purchaseTimeline: 'Immediate (Within 30 Days)',
        purchasePurpose: 'End-Use / Self-Occupation',
        siteVisitPreference: 'Weekend Preferred',
        fundingSource: 'Self-Funded / Equity Liquidity',
        possessionPreference: 'Ready to Move In (OC Received)',
        developerPreference: 'Lodha Luxury / Godrej Properties',
      },
      qualificationEvidence: 'HNI buyer with immediate requirement for 4BHK sea-view villa; proof of funds verified via bank statement; RERA project registration verified.',
      requiredDocuments: [
        'PAN & Aadhaar Identity Verification',
        'Proof of Funds / Bank Statement',
        'Cheque for Token Booking Consideration',
        'RERA Acknowledgment & Developer Allotment Form',
      ],
      notes: 'Client requesting exclusive weekend private site visit with developer relationship partner.',
    };

    const res = await call('POST', '/rel/qualify-and-handoff', {
      cookie: callerCookie,
      json: qualifyPayload,
    });

    assert.equal(res.status, 201, `Failed to qualify: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.handoff);
    assert.equal(res.body.handoff.status, 'pending');
    assert.equal(res.body.handoff.relEmployeeId, 'EMP-027'); // Fair assignment routed to Neha Gupta
    assert.equal(res.body.handoff.relName, 'Neha Gupta');
    assert.equal(res.body.handoff.realEstateRequirement.budget, 35000000);
    assert.equal(res.body.handoff.realEstateRequirement.propertyType, 'Luxury Residential Villa / Apartment');
    assert.equal(res.body.handoff.realEstateRequirement.preferredLocation, 'Worli / Bandra West');
    assert.equal(res.body.handoff.realEstateRequirement.siteVisitPreference, 'Weekend Preferred');
    testHandoffId = res.body.handoff.id;

    // Verify DB state: lead stage advanced to 'requirement' & property_budget persisted
    const checkDb = await db.query(
      `SELECT stage, rel_owner_id, property_budget, requested_amount FROM leads WHERE id = $1`,
      [testReLeadId]
    );
    assert.equal(checkDb.rows[0].stage, 'requirement', 'Caller qualification must set stage to requirement');
    assert.equal(Number(checkDb.rows[0].property_budget), 35000000);
    assert.equal(Number(checkDb.rows[0].requested_amount), 35000000);
  });

  await t.test('3. Neha Gupta views Inbound Handoffs Queue containing Real Estate requirements', async () => {
    const res = await call('GET', '/rel/handoffs', { cookie: relCookie });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.handoffs));
    const h = res.body.handoffs.find((item: any) => item.id === testHandoffId);
    assert.ok(h, 'Created handoff not found in Neha Gupta handoff queue');
    assert.equal(h.status, 'pending');
    assert.equal(h.leadDisplayName, 'Radhika Singhania (Luxury Villa)');
    assert.ok(h.realEstateRequirement);
    assert.equal(h.realEstateRequirement.budget, 35000000);
    assert.equal(h.realEstateRequirement.propertyType, 'Luxury Residential Villa / Apartment');
    assert.equal(h.realEstateRequirement.siteVisitPreference, 'Weekend Preferred');
  });

  await t.test('4. Neha Gupta accepts handoff: stage advances from requirement to site-visit (never implies booking)', async () => {
    const res = await call('POST', `/rel/handoffs/${testHandoffId}/decision`, {
      cookie: relCookie,
      json: {
        decision: 'accept',
        nextStep: 'Schedule private site visit & verify RERA escrow with Lodha Luxury team',
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.handoff.status, 'accepted');
    assert.equal(res.body.handoff.nextStep, 'Schedule private site visit & verify RERA escrow with Lodha Luxury team');

    // DB Check: stage advanced to site-visit & rel_owner_id set to EMP-027. MUST NOT be 'booking'!
    const checkDb = await db.query(
      `SELECT stage, rel_owner_id, handoff_status FROM leads WHERE id = $1`,
      [testReLeadId]
    );
    assert.equal(checkDb.rows[0].stage, 'site-visit', 'Accepting handoff must advance stage to site-visit, not booking');
    assert.notEqual(checkDb.rows[0].stage, 'booking', 'Accepting handoff must not imply booking without recorded booking evidence');
    assert.equal(checkDb.rows[0].rel_owner_id, 'EMP-027');
    assert.equal(checkDb.rows[0].handoff_status, 'accepted');
  });

  await t.test('5. Neha Gupta logs developer coordination with Lodha Luxury Collections', async () => {
    const coordPayload = {
      institutionName: 'Lodha Luxury Collections',
      facilityOffered: 'Luxury Villa / Penthouse Allotment',
      sanctionAmount: 35000000,
      interestRate: '20:80 Construction Linked / Builder Escrow',
      status: 'submitted',
      notes: 'Inventory unit 42-B allocated; RERA project registration MahaRERA P51800001234 on file.',
    };

    const res = await call('POST', `/rel/handoffs/${testHandoffId}/institution-coordination`, {
      cookie: relCookie,
      json: coordPayload,
    });

    assert.equal(res.status, 201);
    assert.ok(Array.isArray(res.body.institutionOptions));
    const latest = res.body.institutionOptions[res.body.institutionOptions.length - 1];
    assert.equal(latest.institutionName, 'Lodha Luxury Collections');
    assert.equal(latest.facilityOffered, 'Luxury Villa / Penthouse Allotment');
    assert.equal(latest.sanctionAmount, 35000000);
  });

  await t.test('6. Honest RERA & Title Search Check: unevidenced check is pending, becomes verified only with recorded evidence & explicit provenance', async () => {
    // 6a. Freshly handed-off prospect without recorded evidence must be pending_verification (must FAIL if claimed verified)
    const freshRes = await call('GET', `/rel/prospects/${testReLeadId}`, { cookie: relCookie });
    assert.equal(freshRes.status, 200);
    assert.ok(freshRes.body.prospect);
    assert.equal(freshRes.body.prospect.stage, 'site-visit');

    // Bureau status must be strictly suppressed for Real Estate
    assert.equal(freshRes.body.bureauStatus, null);
    assert.equal(freshRes.body.creditBureauCheck, null);

    // Real Estate verification check - must be pending_verification without invented identifiers
    assert.ok(freshRes.body.realEstateCheck, 'realEstateCheck must be present for Real Estate prospect');
    assert.notEqual(freshRes.body.realEstateCheck.status, 'verified', 'Unevidenced check must NOT be marked verified');
    assert.equal(freshRes.body.realEstateCheck.status, 'pending_verification', 'Fresh check without evidence must be pending_verification');
    assert.equal(freshRes.body.realEstateCheck.evidenceReference, null);
    assert.equal(freshRes.body.realEstateCheck.source, 'none');
    assert.equal(freshRes.body.realEstateCheck.reraProjectNumber, null, 'Must NOT invent RERA registration identifier without recorded evidence');
    assert.equal(freshRes.body.realEstateCheck.titleSearchStatus, 'pending_legal_search', 'Title search must be pending without legal clearance evidence');
    assert.match(freshRes.body.realEstateCheck.notice, /pending/i);

    // 6b. Neha Gupta records human-reviewed evidence
    const verifyRes = await call('POST', `/rel/prospects/${testReLeadId}/verification`, {
      cookie: relCookie,
      json: {
        checkType: 'real_estate',
        status: 'verified',
        evidenceReference: 'MH-RERA-VERIF-2026-4412',
        source: 'human_review',
        reraApprovalStatus: 'verified',
        reraProjectNumber: 'MahaRERA P51800001234',
        titleSearchStatus: 'clear_unencumbered',
        notes: 'Verified 30-year search title free of encumbrance with legal counsel and developer MahaRERA certificate.',
      },
    });
    assert.equal(verifyRes.status, 200);

    // 6c. Check now returns verified with full provenance (evidenceRef, source, reviewer, timestamp)
    const verifiedRes = await call('GET', `/rel/prospects/${testReLeadId}`, { cookie: relCookie });
    assert.equal(verifiedRes.status, 200);
    assert.equal(verifiedRes.body.realEstateCheck.status, 'verified');
    assert.equal(verifiedRes.body.realEstateCheck.evidenceReference, 'MH-RERA-VERIF-2026-4412');
    assert.equal(verifiedRes.body.realEstateCheck.source, 'human_review');
    assert.equal(verifiedRes.body.realEstateCheck.reviewerOrProvider, 'Neha Gupta');
    assert.ok(verifiedRes.body.realEstateCheck.verifiedAt);
    assert.equal(verifiedRes.body.realEstateCheck.reraProjectNumber, 'MahaRERA P51800001234');
    assert.equal(verifiedRes.body.realEstateCheck.titleSearchStatus, 'clear_unencumbered');
    assert.match(verifiedRes.body.realEstateCheck.notice, /RERA/i);
  });

  await t.test('7. Return Handoff: Neha Gupta returns deficient lead to caller with mandatory reason', async () => {
    // Caller qualifies second lead
    const qRes = await call('POST', '/rel/qualify-and-handoff', {
      cookie: callerCookie,
      json: {
        leadId: returnReLeadId,
        realEstateRequirement: {
          budget: 15000000,
          propertyType: 'Commercial Office Space',
          preferredLocation: 'Navi Mumbai',
          purchaseTimeline: '3-6 Months (Planning & Evaluation)',
          purchasePurpose: 'Rental Yield & Investment',
          siteVisitPreference: 'Weekend Preferred',
          fundingSource: 'Bank Home Loan Required',
          possessionPreference: 'Under Construction (Within 12M)',
        },
        qualificationEvidence: 'Initial interest for commercial office unit.',
        requiredDocuments: ['PAN Card'],
      },
    });
    assert.equal(qRes.status, 201);
    returnHandoffId = qRes.body.handoff.id;

    // Neha Gupta returns to caller
    const returnReason = 'Client does not have approved commercial bank in-principle sanction and timeline is 6+ months.';
    const retRes = await call('POST', `/rel/handoffs/${returnHandoffId}/decision`, {
      cookie: relCookie,
      json: {
        decision: 'return',
        reason: returnReason,
      },
    });

    assert.equal(retRes.status, 200);
    assert.equal(retRes.body.handoff.status, 'returned');
    assert.equal(retRes.body.handoff.decisionReason, returnReason);

    // Verify DB state: lead stage reverted to contacted
    const checkDb = await db.query(
      `SELECT stage, rel_owner_id, handoff_status FROM leads WHERE id = $1`,
      [returnReLeadId]
    );
    assert.equal(checkDb.rows[0].stage, 'contacted');
    assert.equal(checkDb.rows[0].handoff_status, 'returned');

    // Frontline caller Sameer Kulkarni sees returned status & reason in queue
    const callerQueue = await call('GET', '/rel/handoffs', { cookie: callerCookie });
    assert.equal(callerQueue.status, 200);
    const returnedEntry = callerQueue.body.handoffs.find((h: any) => h.id === returnHandoffId);
    assert.ok(returnedEntry);
    assert.equal(returnedEntry.status, 'returned');
    assert.equal(returnedEntry.decisionReason, returnReason);
  });

  await t.test('8. Caller Privacy & Security: Confidential developer terms stripped from caller responses', async () => {
    const callerHandoffs = await call('GET', '/rel/handoffs', { cookie: callerCookie });
    assert.equal(callerHandoffs.status, 200);
    const acceptedEntry = callerHandoffs.body.handoffs.find((h: any) => h.id === testHandoffId);
    assert.ok(acceptedEntry);
    // Sales caller cannot see institution options / confidential developer partner terms
    assert.equal(acceptedEntry.institutionOptions, undefined);
  });
});
