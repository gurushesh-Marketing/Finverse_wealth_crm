process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { createApp } from '../src/app';
import { assertTestDatabaseGuard, env } from '../src/config';
import { allocateCallerForVertical } from '../src/repo/data-entry';

let server: Server;
let base: string;
let db: Pool;

let deCookie = '';
let ashaCookie = ''; // Wealth SC (EMP-001)
let raviCookie = ''; // Wealth SC (EMP-002)
let devCookie = ''; // Banking SC (EMP-004)
let kabirCookie = ''; // Markets SC (EMP-021)
let sameerCookie = ''; // Real Estate SC (EMP-026)

async function call(
  method: string,
  path: string,
  cookie: string,
  body?: unknown
): Promise<{ status: number; body: any; headers: Headers }> {
  const headers: Record<string, string> = {};
  if (cookie) headers['Cookie'] = cookie;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let responseBody: any = null;
  if (contentType.includes('application/json')) {
    try {
      responseBody = await res.json();
    } catch {
      /* ignore */
    }
  } else {
    responseBody = await res.text();
  }

  return { status: res.status, body: responseBody, headers: res.headers };
}

async function login(email: string): Promise<string> {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo1234' }),
  });
  assert.equal(res.status, 200, `Login failed for ${email}`);
  const cookie = res.headers.get('set-cookie')?.split(';')[0] ?? '';
  return cookie;
}

async function cleanupLeads(leadIds: string[]): Promise<void> {
  if (!leadIds || leadIds.length === 0) return;
  await db.query(`UPDATE prospect_import_rows SET canonical_lead_id = NULL WHERE canonical_lead_id = ANY($1::text[])`, [leadIds]);
  await db.query(`UPDATE intake_rows SET published_lead_id = NULL WHERE published_lead_id = ANY($1::text[])`, [leadIds]);
  await db.query(`DELETE FROM reminders WHERE task_id IN (SELECT id FROM lead_tasks WHERE lead_id = ANY($1::text[]))`, [leadIds]);
  await db.query(`DELETE FROM lead_tasks WHERE lead_id = ANY($1::text[])`, [leadIds]);
  await db.query(`DELETE FROM lead_events WHERE lead_id = ANY($1::text[])`, [leadIds]);
  await db.query(`DELETE FROM lead_audit WHERE lead_id = ANY($1::text[])`, [leadIds]);
  await db.query(`DELETE FROM lead_ownership_events WHERE lead_id = ANY($1::text[])`, [leadIds]);
  await db.query(`DELETE FROM leads WHERE id = ANY($1::text[])`, [leadIds]);
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const port = (server.address() as any).port;
  base = `http://127.0.0.1:${port}`;
  db = new Pool({ connectionString: env.DATABASE_URL });

  deCookie = await login('deepa@finverse.demo'); // DE operator (EMP-015)
  ashaCookie = await login('asha@finverse.demo'); // Wealth SC (EMP-001)
  raviCookie = await login('ravi@finverse.demo'); // Wealth SC (EMP-002)
  devCookie = await login('dev@finverse.demo'); // Banking SC (EMP-004)
  kabirCookie = await login('kabir@finverse.demo'); // Markets SC (EMP-021)
  sameerCookie = await login('sameer@finverse.demo'); // Real Estate SC (EMP-026)
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (db) await db.end();
});

test('1. Manual Entry: Staged draft saves without creating leads; publishing promotes to canonical lead with priority', async () => {
  const stamp = Date.now().toString(36);
  const mobile = `98${Date.now().toString().slice(-8)}`;
  const email = `staged-draft-${stamp}@example.test`;

  // Step 1: Save manual prospect as staged draft
  const saveRes = await call('POST', '/api/data-entry/manual-records', deCookie, {
    vertical: 'wealth',
    prospectName: `Staged Prospect ${stamp}`,
    mobileNumber: mobile,
    email: email,
    location: 'Bangalore',
    isPriority: true,
  });
  assert.equal(saveRes.status, 201);
  const intakeId = saveRes.body.id;
  assert.equal(saveRes.body.status, 'staged', 'Saved record must be staged draft');
  assert.equal(saveRes.body.isPriority, true);

  // Invariant: Staged record must NOT create canonical leads
  const checkLeads = await db.query(`SELECT id FROM leads WHERE email = $1`, [email]);
  assert.equal(checkLeads.rows.length, 0, 'Zero canonical leads must exist while staged');

  // Step 2: Publish manual prospect to Sales Caller
  const pubRes = await call('POST', `/api/data-entry/manual-records/${intakeId}/publish`, deCookie, {});
  assert.equal(pubRes.status, 200);
  assert.equal(pubRes.body.status, 'published');
  assert.ok(pubRes.body.publishedLeadId, 'Must return canonical lead ID');
  assert.ok(pubRes.body.assignedCallerId, 'Must assign caller');
  assert.equal(pubRes.body.isPriority, true, 'Priority must survive publication');

  const leadId = pubRes.body.publishedLeadId;

  // Step 3: Verify canonical lead in database
  const leadRes = await db.query(
    `SELECT id, vertical, display_name, email, owner_employee_id, is_priority, assigned_at FROM leads WHERE id = $1`,
    [leadId]
  );
  assert.equal(leadRes.rows.length, 1);
  const lead = leadRes.rows[0];
  assert.equal(lead.vertical, 'wealth');
  assert.equal(lead.is_priority, true, 'Canonical lead must have is_priority = true');
  assert.ok(lead.assigned_at, 'Lead must have assigned_at timestamp');
  assert.equal(lead.owner_employee_id, pubRes.body.assignedCallerId);

  // Step 4: Verify caller sees priority lead in /api/leads
  const ownerEmail = await db.query(`SELECT email FROM employees WHERE id = $1`, [lead.owner_employee_id]);
  const callerCookie = await login(ownerEmail.rows[0].email);
  const callerLeads = await call('GET', `/api/leads?search=${stamp}`, callerCookie);
  assert.equal(callerLeads.status, 200);
  const foundLead = callerLeads.body.leads.find((l: any) => l.id === leadId);
  assert.ok(foundLead, 'Assigned caller must see lead in inbox');
  assert.equal(foundLead.isPriority, true, 'Caller inbox must reflect priority flag');

  // Step 5: Verify idempotency — re-publishing doesn't create duplicate
  const rePub = await call('POST', `/api/data-entry/manual-records/${intakeId}/publish`, deCookie, {});
  assert.equal(rePub.status, 200);
  assert.equal(rePub.body.publishedLeadId, leadId, 'Must return same canonical lead ID');

  const allLeadsForEmail = await db.query(`SELECT id FROM leads WHERE email = $1`, [email]);
  assert.equal(allLeadsForEmail.rows.length, 1, 'Idempotent publication must not create duplicate leads');

  // Clean up
  await cleanupLeads([leadId]);
  await db.query(`DELETE FROM intake_rows WHERE id = $1`, [intakeId]);
});

test('2. Four Verticals: Manual intake publishes & routes to respective vertical caller with strict isolation', async () => {
  const verticals: Array<{
    vertical: 'wealth' | 'banking' | 'markets' | 'real_estate';
    callerCookie: string;
    expectedCallerId: string;
    foreignCallerCookie: string;
  }> = [
    { vertical: 'wealth', callerCookie: ashaCookie, expectedCallerId: 'EMP-001', foreignCallerCookie: devCookie },
    { vertical: 'banking', callerCookie: devCookie, expectedCallerId: 'EMP-004', foreignCallerCookie: ashaCookie },
    { vertical: 'markets', callerCookie: kabirCookie, expectedCallerId: 'EMP-021', foreignCallerCookie: ashaCookie },
    { vertical: 'real_estate', callerCookie: sameerCookie, expectedCallerId: 'EMP-026', foreignCallerCookie: ashaCookie },
  ];

  const createdLeadIds: string[] = [];
  const createdIntakeIds: string[] = [];

  for (const v of verticals) {
    const stamp = `${v.vertical}-${Date.now().toString(36)}`;
    const mobile = `91${Date.now().toString().slice(-8)}`;
    const email = `v-intake-${stamp}@example.test`;

    // Save manual prospect
    const saveRes = await call('POST', '/api/data-entry/manual-records', deCookie, {
      vertical: v.vertical,
      prospectName: `Prospect ${stamp}`,
      mobileNumber: mobile,
      email: email,
      isPriority: true,
    });
    assert.equal(saveRes.status, 201);
    createdIntakeIds.push(saveRes.body.id);

    // Publish prospect
    const pubRes = await call('POST', `/api/data-entry/manual-records/${saveRes.body.id}/publish`, deCookie, {});
    assert.equal(pubRes.status, 200);
    const leadId = pubRes.body.publishedLeadId;
    createdLeadIds.push(leadId);

    // Verify assigned caller belongs to vertical
    const { rows } = await db.query(
      `SELECT l.vertical, l.owner_employee_id, a.vertical as caller_vertical, a.role
         FROM leads l
         JOIN assignments a ON a.employee_id = l.owner_employee_id
        WHERE l.id = $1`,
      [leadId]
    );
    assert.equal(rows[0].vertical, v.vertical);
    assert.equal(rows[0].caller_vertical, v.vertical, `Assigned caller must be from vertical ${v.vertical}`);
    assert.equal(rows[0].role, 'SC', 'Assigned caller must be Sales Caller');

    // Verify assigned caller can view the lead
    const callerEmail = (
      await db.query(`SELECT email FROM employees WHERE id = $1`, [rows[0].owner_employee_id])
    ).rows[0].email;
    const ownerCookie = await login(callerEmail);

    const callerInbox = await call('GET', `/api/leads?search=${stamp}`, ownerCookie);
    assert.equal(callerInbox.status, 200);
    const inQueue = callerInbox.body.leads.some((l: any) => l.id === leadId);
    assert.ok(inQueue, `Caller ${rows[0].owner_employee_id} (${callerEmail}) must see lead ${leadId} in inbox`);

    // Verify foreign caller CANNOT see the lead (strict cross-vertical isolation)
    const foreignInbox = await call('GET', `/api/leads?search=${stamp}`, v.foreignCallerCookie);
    assert.equal(foreignInbox.status, 200);
    const foreignFound = foreignInbox.body.leads.some((l: any) => l.id === leadId);
    assert.equal(foreignFound, false, `Foreign caller must NOT see cross-vertical lead ${leadId}`);
  }

  // Clean up
  await cleanupLeads(createdLeadIds);
  await db.query(`DELETE FROM intake_rows WHERE id = ANY($1::text[])`, [createdIntakeIds]);
});

test('manual Real Estate priority entry can publish atomically and reach its assigned caller', async () => {
  const stamp = Date.now().toString(36);
  const email = `re-direct-${stamp}@example.test`;
  const saved = await call('POST', '/api/data-entry/manual-records', deCookie, {
    vertical: 'real_estate',
    prospectName: `Real Estate Direct ${stamp}`,
    mobileNumber: `98${Date.now().toString().slice(-8)}`,
    email,
    isPriority: true,
    publishImmediately: true,
  });
  assert.equal(saved.status, 201, 'Direct publish must create an assigned lead in one request');
  assert.equal(saved.body.status, 'published');
  assert.ok(saved.body.publishedLeadId);
  assert.ok(saved.body.assignedCallerId);

  const leadId = saved.body.publishedLeadId as string;
  const intakeId = saved.body.id as string;
  try {
    const { rows } = await db.query(
      `SELECT l.vertical, l.is_priority, l.owner_employee_id, l.intake_row_id,
              r.status AS intake_status
         FROM leads l JOIN intake_rows r ON r.id = l.intake_row_id
        WHERE l.id = $1`,
      [leadId]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].vertical, 'real_estate');
    assert.equal(rows[0].is_priority, true);
    assert.equal(rows[0].intake_status, 'published');
    assert.equal(rows[0].intake_row_id, intakeId);
    assert.equal(rows[0].owner_employee_id, saved.body.assignedCallerId);

    const owner = await db.query(`SELECT email FROM employees WHERE id = $1`, [rows[0].owner_employee_id]);
    const ownerCookie = await login(owner.rows[0].email);
    const inbox = await call('GET', `/api/leads?search=${stamp}`, ownerCookie);
    assert.equal(inbox.status, 200);
    assert.ok(inbox.body.leads.some((lead: any) => lead.id === leadId && lead.isPriority));
  } finally {
    await cleanupLeads([leadId]);
    await db.query(`DELETE FROM intake_rows WHERE id = $1`, [intakeId]);
  }
});

test('round-robin excludes a caller whose Real Estate assignment has ended', async () => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const first = await allocateCallerForVertical(client, 'real_estate');
    const second = await allocateCallerForVertical(client, 'real_estate');
    assert.deepEqual(
      new Set([first.callerId, second.callerId]),
      new Set(['EMP-026', 'EMP-031']),
      'Consecutive Real Estate leads must rotate between the two active callers'
    );

    const ended = await client.query(
      `UPDATE assignments SET effective_to = CURRENT_DATE - 1
       WHERE id = 'ASG-RE-SC-002' AND role = 'SC' AND vertical = 'real_estate'
       RETURNING employee_id`
    );
    assert.equal(ended.rowCount, 1, 'Real Estate Beta caller fixture must exist');

    const beta = await allocateCallerForVertical(client, 'real_estate', 'TEAM-REALESTATE-BETA');
    assert.equal(beta.callerId, null, 'An ended assignment must never receive a new lead');
    assert.equal(beta.teamId, 'TEAM-REALESTATE-BETA');

    const vertical = await allocateCallerForVertical(client, 'real_estate');
    assert.equal(vertical.callerId, 'EMP-026', 'Vertical-wide routing must select the remaining active caller');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('3. Legacy Batch Flow: CSV upload and batch publish assigns active callers and preserves priority', async () => {
  const stamp = Date.now().toString(36);
  const csvContent = [
    'Client Name,Primary Mobile,Email Address,Target Product,Consent Reference,Priority',
    `Legacy Prio ${stamp},97${Date.now().toString().slice(-8)},leg-prio-${stamp}@example.test,V1 Wealth Portfolio,APEX-REF-1,true`,
    `Legacy Norm ${stamp},96${Date.now().toString().slice(-8)},leg-norm-${stamp}@example.test,V1 Wealth Portfolio,APEX-REF-2,false`,
  ].join('\n');

  // 1. Upload batch
  const uploadRes = await call('POST', '/api/data-entry/batches/upload', deCookie, {
    batchName: `Legacy Batch ${stamp}`,
    sourceId: 'SRC-VEND-104',
    vertical: 'wealth',
    targetTeamId: 'TEAM-WEALTH-ALPHA',
    fileName: `legacy-${stamp}.csv`,
    csvContent: csvContent,
  });
  assert.equal(uploadRes.status, 201);
  const batchId = uploadRes.body.id;

  // 2. Publish batch
  const pubRes = await call('POST', `/api/data-entry/batches/${batchId}/publish`, deCookie, {});
  assert.equal(pubRes.status, 200);
  assert.equal(pubRes.body.publishedCount, 2);
  assert.ok(pubRes.body.assignedCallers?.length === 2);

  // Verify created leads have non-null owner_employee_id and correct priority
  const { rows: batchLeads } = await db.query(
    `SELECT l.id, l.display_name, l.owner_employee_id, l.is_priority, l.assigned_at
       FROM leads l
      WHERE l.email LIKE $1
      ORDER BY l.is_priority DESC`,
    [`%${stamp}%`]
  );
  assert.equal(batchLeads.length, 2);

  const prioLead = batchLeads[0];
  const normLead = batchLeads[1];

  assert.equal(prioLead.is_priority, true, 'Priority row must have is_priority = true');
  assert.ok(prioLead.owner_employee_id, 'Priority lead must have assigned owner_employee_id');
  assert.ok(prioLead.assigned_at, 'Priority lead must have assigned_at');

  assert.equal(normLead.is_priority, false, 'Normal row must have is_priority = false');
  assert.ok(normLead.owner_employee_id, 'Normal lead must have assigned owner_employee_id');

  // Verify leads appear in caller's queue
  const ashaInbox = await call('GET', `/api/leads?search=${stamp}`, ashaCookie);
  assert.equal(ashaInbox.status, 200);
  const foundInAsha = ashaInbox.body.leads.find((l: any) => l.id === prioLead.id || l.id === normLead.id);
  assert.ok(foundInAsha, 'Published batch leads must appear in caller inbox');

  // Clean up
  const leadIds = batchLeads.map((l: any) => l.id);
  await cleanupLeads(leadIds);
  await db.query(`DELETE FROM intake_rows WHERE batch_id = $1`, [batchId]);
  await db.query(`DELETE FROM intake_batches WHERE id = $1`, [batchId]);
});

test('4. No-Eligible-Caller Routing Exception: Lead held in unassigned queue with reason, never lost or cross-assigned', async () => {
  const stamp = Date.now().toString(36);

  // Put all Markets callers on 'away'
  await db.query(
    `INSERT INTO availability_changes (id, employee_id, status, effective_from)
     SELECT 'Z-AWAY-MKT-' || a.employee_id || '-' || $1, a.employee_id, 'away', now()
       FROM assignments a
      WHERE a.vertical = 'markets' AND a.role = 'SC'`,
    [stamp]
  );

  try {
    const saveRes = await call('POST', '/api/data-entry/manual-records', deCookie, {
      vertical: 'markets',
      prospectName: `Exception Prospect ${stamp}`,
      mobileNumber: `93${Date.now().toString().slice(-8)}`,
      email: `ex-${stamp}@example.test`,
      isPriority: true,
    });
    assert.equal(saveRes.status, 201);
    const intakeId = saveRes.body.id;

    // Publish when no callers are eligible
    const pubRes = await call('POST', `/api/data-entry/manual-records/${intakeId}/publish`, deCookie, {});
    assert.equal(pubRes.status, 200);
    assert.equal(pubRes.body.status, 'unassigned_exception');
    assert.ok(pubRes.body.routingExceptionReason, 'Must state reason for routing exception');
    assert.equal(pubRes.body.assignedCallerId, null, 'Must NOT assign to callers from another vertical');

    const leadId = pubRes.body.publishedLeadId;
    assert.ok(leadId, 'Canonical lead must still be created (never lost)');

    // Verify canonical lead is in unassigned queue
    const { rows } = await db.query(
      `SELECT vertical, owner_employee_id, is_priority, stage FROM leads WHERE id = $1`,
      [leadId]
    );
    assert.equal(rows[0].vertical, 'markets', 'Vertical must remain strictly markets');
    assert.equal(rows[0].owner_employee_id, null, 'Owner must be null');
    assert.equal(rows[0].is_priority, true, 'Priority must be preserved');

    // Clean up
    await cleanupLeads([leadId]);
    await db.query(`DELETE FROM intake_rows WHERE id = $1`, [intakeId]);
  } finally {
    await db.query(`DELETE FROM availability_changes WHERE id LIKE $1`, [`Z-AWAY-MKT-%-${stamp}`]);
  }
});
