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

const RUN_PREFIX = `CALL-${Date.now().toString().slice(-5)}`;
const RAW_PHONE = '+91 98450 12345';
const RAW_PHONE_CLEAN = '9845012345';

async function cleanupChain(prefix: string = RUN_PREFIX): Promise<void> {
  await db.query(`DELETE FROM lead_events WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM calls WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM contact_suppressions WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM lead_audit WHERE lead_id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM leads WHERE id LIKE $1`, [`${prefix}%`]);
  await db.query(`DELETE FROM sessions WHERE employee_id = 'EMP-UNCONFIGURED'`);
  await db.query(`DELETE FROM availability_changes WHERE employee_id = 'EMP-UNCONFIGURED'`);
  await db.query(`DELETE FROM caller_calling_identities WHERE employee_id = 'EMP-UNCONFIGURED'`);
  await db.query(`DELETE FROM assignments WHERE employee_id = 'EMP-UNCONFIGURED'`);
  await db.query(`DELETE FROM employees WHERE id = 'EMP-UNCONFIGURED'`);
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  db = new Pool({ connectionString: env.DATABASE_URL });
  await cleanupChain();
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await cleanupChain();
  await db.end();
  await apiPool.end();
});

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

async function login(email: string): Promise<string> {
  const r = await call('POST', '/auth/login', { json: { email, password: 'demo1234' } });
  return (r.cookie ?? '').split(';')[0] ?? '';
}

test('Secure Calling: Strict prospect phone masking & zero raw number leakage to Sales Caller', async () => {
  const asha = await login('asha@finverse.demo');
  const leadId = `${RUN_PREFIX}-LEAD1`;

  // Create test lead owned by Asha Rao (EMP-001)
  await db.query(
    `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id)
     VALUES ($1, 'wealth', 'High Net Worth Client', 'hnw@client.test', $2, 'English', 'Wealth Management', 'Inbound', 'contacted', 'EMP-001', 'TEAM-WEALTH-ALPHA')`,
    [leadId, RAW_PHONE]
  );

  // 1. Fetch lead details as the assigned sales caller
  const res = await call<any>('GET', `/leads/${leadId}`, { cookie: asha });
  assert.equal(res.status, 200);

  // Phone property must be masked (e.g. +91 •••••345)
  assert.ok(res.body.phone.includes('•'), `Expected phone to be masked but received: ${res.body.phone}`);
  assert.equal(res.body.phone.endsWith('345'), true, `Expected last 3 digits to match: ${res.body.phone}`);

  // CRITICAL SECURITY ASSERTION: Inspect raw serialized JSON payload
  // The raw phone number must NOT exist anywhere in the HTTP response text
  assert.equal(res.rawText.includes(RAW_PHONE), false, 'Raw formatted phone leaked in response!');
  assert.equal(res.rawText.includes(RAW_PHONE_CLEAN), false, 'Raw digits phone leaked in response!');
});

test('Secure Calling: Audit history masks phone modifications for Sales Callers', async () => {
  const asha = await login('asha@finverse.demo');
  const leadId = `${RUN_PREFIX}-LEAD-AUDIT`;
  const OLD_PHONE = '+91 99999 88888';
  const NEW_PHONE = '+91 99999 77777';

  await db.query(
    `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id)
     VALUES ($1, 'wealth', 'Audit Test Lead', 'audit@test.com', $2, 'English', 'Wealth Management', 'Referral', 'contacted', 'EMP-001', 'TEAM-WEALTH-ALPHA')`,
    [leadId, NEW_PHONE]
  );

  await db.query(
    `INSERT INTO lead_audit (id, lead_id, actor_employee_id, field, before_value, after_value, reason, occurred_at)
     VALUES ($1, $2, 'EMP-001', 'phone', $3, $4, 'Customer requested update', now())`,
    [`AUD-${leadId}`, leadId, OLD_PHONE, NEW_PHONE]
  );

  const res = await call<any>('GET', `/leads/${leadId}/audit`, { cookie: asha });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.audit));
  const phoneEntry = res.body.audit.find((a: any) => a.field === 'phone');
  assert.ok(phoneEntry, 'Expected phone audit entry');

  // Both before and after must be masked for caller
  assert.ok(phoneEntry.beforeValue.includes('•'), `Before value unmasked: ${phoneEntry.beforeValue}`);
  assert.ok(phoneEntry.afterValue.includes('•'), `After value unmasked: ${phoneEntry.afterValue}`);
  assert.equal(res.rawText.includes(OLD_PHONE), false, 'Old phone leaked in audit response!');
  assert.equal(res.rawText.includes(NEW_PHONE), false, 'New phone leaked in audit response!');
});

test('Secure Calling: "Call now" initiates synthetic call with only lead ID and zero number leakage', async () => {
  const asha = await login('asha@finverse.demo');
  const leadId = `${RUN_PREFIX}-LEAD-CALL`;
  const idempKey = `KEY-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  await db.query(
    `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id)
     VALUES ($1, 'wealth', 'Dialling Test Client', 'dial@client.test', $2, 'English', 'Wealth Advisory', 'Direct', 'contacted', 'EMP-001', 'TEAM-WEALTH-ALPHA')`,
    [leadId, RAW_PHONE]
  );

  // Caller initiates call sending only leadId (no phone number in request body)
  const res = await call<any>('POST', '/calls/initiate', {
    json: { leadId, idempotencyKey: idempKey },
    cookie: asha,
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.leadId, leadId);
  assert.equal(res.body.status, 'connecting');
  assert.equal(res.body.evidenceStatus, 'simulated');
  assert.equal(res.body.providerMode, 'synthetic-test-provider');
  assert.ok(res.body.providerCallReference?.startsWith('SYN-CALL-'), `Expected synthetic ref: ${res.body.providerCallReference}`);
  assert.ok(res.body.destinationMasked?.includes('•'), `Expected masked destination: ${res.body.destinationMasked}`);

  // Raw phone must NOT leak into the call initiation response
  assert.equal(res.rawText.includes(RAW_PHONE), false, 'Raw phone leaked in call initiation response!');
  assert.equal(res.rawText.includes(RAW_PHONE_CLEAN), false, 'Raw phone digits leaked in call initiation response!');

  // Verify call record in database
  const callRow = (await db.query(`SELECT * FROM calls WHERE id = $1`, [res.body.id])).rows[0];
  assert.ok(callRow);
  assert.equal(callRow.actor_employee_id, 'EMP-001');
  assert.equal(callRow.caller_identity, '+918040000001');
  assert.equal(callRow.provider_mode, 'synthetic-test-provider');
  assert.ok(callRow.provider_call_reference?.startsWith('SYN-CALL-'));

  // Verify immutable event logged in lead_events
  const eventRow = (await db.query(`SELECT * FROM lead_events WHERE lead_id = $1 AND kind = 'call'`, [leadId])).rows[0];
  assert.ok(eventRow, 'Expected call event in lead_events');
  assert.ok(eventRow.note.includes('synthetic-test-provider'));
  assert.equal(eventRow.note.includes(RAW_PHONE), false, 'Raw phone leaked in lead_events note!');
});

test('Secure Calling: Ownership guard blocks another caller from initiating call', async () => {
  const ravi = await login('ravi@finverse.demo'); // EMP-002 (different caller)
  const leadId = `${RUN_PREFIX}-LEAD-OWNER-GUARD`;

  // Create lead owned by Asha Rao (EMP-001)
  await db.query(
    `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id)
     VALUES ($1, 'wealth', 'Asha Protected Client', 'asha.prot@test.com', $2, 'English', 'Wealth Advisory', 'Direct', 'contacted', 'EMP-001', 'TEAM-WEALTH-ALPHA')`,
    [leadId, RAW_PHONE]
  );

  // Ravi attempts to call Asha's lead
  const res = await call<any>('POST', '/calls/initiate', {
    json: { leadId },
    cookie: ravi,
  });

  // Deny-by-default security: returns 403 Forbidden or 404 Not Found (out of caller scope)
  assert.ok([403, 404].includes(res.status), `Expected 403 or 404 but got ${res.status}`);
});

test('Secure Calling: Consent & contact suppression guard blocks call attempt', async () => {
  const asha = await login('asha@finverse.demo');
  const leadId = `${RUN_PREFIX}-LEAD-SUPPRESSED`;

  await db.query(
    `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id)
     VALUES ($1, 'wealth', 'Do Not Call Prospect', 'dnc@test.com', $2, 'English', 'Wealth Advisory', 'Website', 'contacted', 'EMP-001', 'TEAM-WEALTH-ALPHA')`,
    [leadId, RAW_PHONE]
  );

  // Suppress voice channel for this lead
  await db.query(
    `INSERT INTO contact_suppressions (id, lead_id, created_by, channels, reason, source, active, created_at)
     VALUES ($1, $2, 'EMP-001', ARRAY['voice'], 'Client requested do-not-call registry', 'customer-request', true, now())`,
    [`SUP-${leadId}`, leadId]
  );

  const res = await call<any>('POST', '/calls/initiate', {
    json: { leadId },
    cookie: asha,
  });

  assert.equal(res.status, 403);
  const errMsg = res.body.error?.message || res.body.message || '';
  assert.ok(errMsg.toLowerCase().includes('suppression'), `Expected suppression message but got: ${errMsg}`);
});

test('Secure Calling: Unconfigured caller identity blocks call with 422 error', async () => {
  // Get password hash from existing valid employee
  const hashRow = (await db.query(`SELECT password_hash FROM employees WHERE id = 'EMP-001'`)).rows[0];

  // Create an employee with role SC but NO entry in caller_calling_identities
  await db.query(
    `INSERT INTO employees (id, email, password_hash, display_name, status, created_at)
     VALUES ('EMP-UNCONFIGURED', 'unconfigured.caller@finverse.demo', $1, 'Unconfigured Caller', 'active', now())`,
    [hashRow.password_hash]
  );
  await db.query(
    `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from, effective_to)
     VALUES ('ASG-UNCONFIG', 'EMP-UNCONFIGURED', 'SC', 'wealth', 'TEAM-WEALTH-ALPHA', '2026-01-01', '2026-12-31')`
  );

  const unconfiguredCookie = await login('unconfigured.caller@finverse.demo');
  const leadId = `${RUN_PREFIX}-LEAD-UNCONFIG`;

  await db.query(
    `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id)
     VALUES ($1, 'wealth', 'Unconfigured Dial Prospect', 'unconf@test.com', $2, 'English', 'Wealth Advisory', 'Website', 'contacted', 'EMP-UNCONFIGURED', 'TEAM-WEALTH-ALPHA')`,
    [leadId, RAW_PHONE]
  );

  const res = await call<any>('POST', '/calls/initiate', {
    json: { leadId },
    cookie: unconfiguredCookie,
  });

  assert.equal(res.status, 422);
  const errorCode = res.body.error?.code || res.body.error;
  assert.equal(errorCode, 'CALLER_IDENTITY_NOT_CONFIGURED');
});
