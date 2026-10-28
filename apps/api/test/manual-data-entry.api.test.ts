process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { createApp } from '../src/app';
import { assertTestDatabaseGuard, env } from '../src/config';
import { hashPassword } from '../src/lib/password';

let server: Server;
let base: string;
let db: Pool;
let deCookie = '';
let scCookie = '';
let deLimitedCookie = '';

async function call(method: string, path: string, cookie: string, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() as any };
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  db = new Pool({ connectionString: env.DATABASE_URL });
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  base = `http://localhost:${typeof address === 'object' && address ? address.port : 4000}`;

  const demoHash = hashPassword('demo1234');
  await db.query(
    `INSERT INTO employees (id, email, password_hash, display_name, status)
     VALUES ('EMP-DE-LIMITED', 'de.limited@finverse.demo', $1, 'Limited DE', 'active')
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
    [demoHash]
  );
  await db.query(
    `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from)
     VALUES ('ASG-DE-LIMITED-W', 'EMP-DE-LIMITED', 'DE', 'wealth', 'TEAM-WEALTH-ALPHA', CURRENT_DATE)
     ON CONFLICT (id) DO UPDATE SET vertical = 'wealth', team_id = 'TEAM-WEALTH-ALPHA'`
  );

  for (const [email, store] of [
    ['deepa@finverse.demo', 'de'],
    ['asha@finverse.demo', 'sc'],
    ['de.limited@finverse.demo', 'limited'],
  ] as const) {
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'demo1234' }),
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
    if (store === 'de') deCookie = cookie;
    else if (store === 'sc') scCookie = cookie;
    else deLimitedCookie = cookie;
  }
});

after(async () => {
  await db.query(`DELETE FROM assignments WHERE id = 'ASG-DE-LIMITED-W'`).catch(() => undefined);
  await db.query(`DELETE FROM employees WHERE id = 'EMP-DE-LIMITED'`).catch(() => undefined);
  server?.closeAllConnections();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await db?.end();
});

test('Data Entry saves a manual record and independently reads the persisted row', async () => {
  const stamp = Date.now().toString();
  const input = {
    prospectName: `Manual Test ${stamp}`,
    mobileNumber: `9${stamp.slice(-9)}`,
    email: `manual-${stamp}@example.test`,
    whatsappNumber: '', location: '', vertical: 'banking',
  };
  const saved = await call('POST', '/api/data-entry/manual-records', deCookie, input);
  assert.equal(saved.status, 201);
  assert.equal(saved.body.status, 'staged');
  assert.equal(saved.body.vertical, 'banking');
  const read = await call('GET', `/api/data-entry/manual-records/${encodeURIComponent(saved.body.id)}`, deCookie);
  assert.equal(read.status, 200);
  assert.equal(read.body.email, input.email);
  const listed = await call('GET', '/api/data-entry/manual-records', deCookie);
  assert.equal(listed.status, 200);
  assert.ok(listed.body.records.some((record: any) => record.id === saved.body.id));
  const { rows } = await db.query(
    `SELECT entered_by_employee_id, vertical, parsed_email, status FROM intake_rows WHERE id = $1`,
    [saved.body.id]
  );
  assert.deepEqual(rows[0], {
    entered_by_employee_id: 'EMP-015', vertical: 'banking', parsed_email: input.email, status: 'staged',
  });
  const lead = await db.query(`SELECT id FROM leads WHERE intake_row_id = $1`, [saved.body.id]);
  assert.equal(lead.rowCount, 0, 'manual save must not publish or assign a lead');
});

test('Data Entry rejects missing required fields, an ungranted vertical, and legacy actions', async () => {
  const baseInput = { prospectName: 'Denied Test', mobileNumber: '9876543210', email: 'denied@example.test', vertical: 'wealth' };
  assert.equal((await call('POST', '/api/data-entry/manual-records', deCookie, { ...baseInput, email: '' })).status, 422);
  assert.equal((await call('POST', '/api/data-entry/manual-records', deLimitedCookie, { ...baseInput, vertical: 'markets' })).status, 403);
  assert.equal((await call('POST', '/api/data-entry/manual-records', deCookie, { ...baseInput, vertical: 'markets' })).status, 201);
  assert.equal((await call('GET', '/api/data-entry/manual-records', scCookie)).status, 403);
  assert.equal((await call('GET', '/api/data-entry/batches', deCookie)).status, 403);
  assert.equal((await call('POST', '/api/data-entry/batches/upload', deCookie, {})).status, 403);
  assert.equal((await call('POST', '/api/data-entry/sources', deCookie, {})).status, 403);
});
