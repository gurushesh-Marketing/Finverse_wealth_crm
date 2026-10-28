process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import { assertTestDatabaseGuard, env } from '../src/config';

let server: Server;
let base: string;

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});


after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

interface ApiResult<T> {
  status: number;
  body: T;
  cookie: string | null;
}

async function call<T>(
  method: string,
  path: string,
  opts: { json?: unknown; cookie?: string; contentType?: string } = {}
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (opts.json !== undefined) headers['Content-Type'] = opts.contentType ?? 'application/json';
  if (opts.contentType) headers['Content-Type'] = opts.contentType;
  if (opts.cookie) headers['Cookie'] = opts.cookie;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.contentType ? 'plain text body' : undefined,
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, body, cookie: setCookie };
}

function cookieFrom(setCookie: string | null): string {
  return (setCookie ?? '').split(';')[0] ?? '';
}

const results: string[] = [];
function pass(name: string): void {
  results.push(`PASS ${name}`);
  console.log(`PASS ${name}`);
}

const stamp = Date.now().toString(36);

test('journey api contract', async () => {
  // 1. login asha
  const login = await call<any>('POST', '/api/auth/login', {
    json: { email: 'asha@finverse.demo', password: 'demo1234' },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.session.role, 'SC');
  assert.deepEqual(login.body.session.verticalGrants, ['wealth']);
  const ashaCookie = cookieFrom(login.cookie);
  pass('1 login asha OK (SC, wealth)');

  // 2. failed logins + rate limit (use a throwaway email so demo accounts stay usable)
  const bad = await call<any>('POST', '/api/auth/login', {
    json: { email: 'asha@finverse.demo', password: 'wrong-password' },
  });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error.code, 'INVALID_CREDENTIALS');
  const unknown = await call<any>('POST', '/api/auth/login', {
    json: { email: 'nobody@finverse.demo', password: 'x' },
  });
  assert.equal(unknown.status, 401);
  let limited = false;
  for (let i = 0; i < 11; i += 1) {
    const r = await call<any>('POST', '/api/auth/login', {
      json: { email: 'ratelimit-probe@finverse.demo', password: 'x' },
    });
    if (r.status === 429) limited = true;
  }
  assert.equal(limited, true);
  pass('2 failed login 401 + rate limit 429');

  // 3. me + logout
  const me = await call<any>('GET', '/api/auth/me', { cookie: ashaCookie });
  assert.equal(me.status, 200);
  const raviLogin = await call<any>('POST', '/api/auth/login', {
    json: { email: 'ravi@finverse.demo', password: 'demo1234' },
  });
  const raviCookie = cookieFrom(raviLogin.cookie);
  const devLogin = await call<any>('POST', '/api/auth/login', {
    json: { email: 'dev@finverse.demo', password: 'demo1234' },
  });
  const devCookie = cookieFrom(devLogin.cookie);
  const taraLogin = await call<any>('POST', '/api/auth/login', {
    json: { email: 'tara@finverse.demo', password: 'demo1234' },
  });
  const taraCookie = cookieFrom(taraLogin.cookie);
  assert.equal(taraLogin.body.session.role, 'REL');
  const logout = await call('POST', '/api/auth/logout', { json: {}, cookie: ashaCookie });
  assert.equal(logout.status, 204);
  const meAfter = await call<any>('GET', '/api/auth/me', { cookie: ashaCookie });
  assert.equal(meAfter.status, 401);
  const relogin = await call<any>('POST', '/api/auth/login', {
    json: { email: 'asha@finverse.demo', password: 'demo1234' },
  });
  const ashaCookie2 = cookieFrom(relogin.cookie);
  pass('3 me OK, logout 204, me 401 after logout');

  // 4. my-day scoped
  const myDay = await call<any>('GET', '/api/my-day', { cookie: ashaCookie2 });
  assert.equal(myDay.status, 200);
  assert.ok(myDay.body.counts.activeLeads >= 3);
  assert.ok(myDay.body.counts.overdue >= 1);
  pass('4 my-day counts present (overdue >= 1)');

  // 5. lead lists scoped per caller (containment + exclusion: chain tests may add owned FV-9xx rows)
  const ashaLeads = await call<any>('GET', '/api/leads', { cookie: ashaCookie2 });
  const ashaIds: string[] = ashaLeads.body.leads.map((l: any) => l.id);
  for (const id of ['FV-1001', 'FV-1002', 'FV-1003']) {
    assert.ok(ashaIds.includes(id), `asha scope must include ${id}`);
  }
  assert.ok(!ashaIds.includes('FV-1004') && !ashaIds.includes('FV-2001'), 'asha scope must exclude other owners and verticals');
  const raviLeads = await call<any>('GET', '/api/leads', { cookie: raviCookie });
  const raviIds: string[] = raviLeads.body.leads.map((l: any) => l.id);
  for (const id of ['FV-1004', 'FV-1005']) {
    assert.ok(raviIds.includes(id), `ravi scope must include ${id}`);
  }
  assert.ok(!raviIds.includes('FV-1001'), 'ravi scope must exclude other owners');
  pass('5 lead lists isolated per caller');

  // 6. cross-caller and cross-vertical read denial
  const crossCaller = await call<any>('GET', '/api/leads/FV-1004', { cookie: ashaCookie2 });
  assert.equal(crossCaller.status, 404);
  const crossVertical = await call<any>('GET', '/api/leads/FV-1001', { cookie: devCookie });
  assert.equal(crossVertical.status, 404);
  pass('6 cross-caller + cross-vertical read denied (404)');

  // 7. mutation denial: out-of-scope writes are 404 (no existence leak)
  const mutDenied = await call<any>('POST', '/api/leads/FV-1004/follow-ups', {
    cookie: ashaCookie2,
    json: { action: 'voice-call', purpose: 'Should not save', dueAt: new Date(Date.now() + 86400000).toISOString() },
  });
  assert.equal(mutDenied.status, 404);
  const mutDenied2 = await call<any>('POST', '/api/leads/FV-2001/follow-ups', {
    cookie: ashaCookie2,
    json: { action: 'voice-call', purpose: 'Should not save', dueAt: new Date(Date.now() + 86400000).toISOString() },
  });
  assert.equal(mutDenied2.status, 404);
  pass('7 cross-caller + cross-vertical mutation denied (404, no leak)');

  // 8. valid follow-up save updates task + timeline
  const purpose = `QA follow-up ${stamp}`;
  const dueAt = new Date(Date.now() + 86400000).toISOString();
  const saved = await call<any>('POST', '/api/leads/FV-1003/follow-ups', {
    cookie: ashaCookie2,
    json: { action: 'voice-call', purpose, dueAt, priority: 'high', reminderMinutes: 15 },
  });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.task.status, 'open');
  const detail = await call<any>('GET', '/api/leads/FV-1003', { cookie: ashaCookie2 });
  assert.equal(detail.status, 200);
  assert.ok(detail.body.tasks.some((t: any) => t.purpose === purpose));
  assert.ok(detail.body.timeline.some((e: any) => e.kind === 'follow-up-scheduled' && e.note.includes(purpose)));
  assert.equal(detail.body.stage, 'follow-up');
  pass('8 valid save -> task + timeline + stage');

  // 9. invalid saves
  const past = await call<any>('POST', '/api/leads/FV-1003/follow-ups', {
    cookie: ashaCookie2,
    json: { action: 'voice-call', purpose: 'Past due', dueAt: new Date(Date.now() - 3600000).toISOString() },
  });
  assert.equal(past.status, 422);
  assert.ok(past.body.error.details.fieldErrors.dueAt);
  const emptyPurpose = await call<any>('POST', '/api/leads/FV-1003/follow-ups', {
    cookie: ashaCookie2,
    json: { action: 'voice-call', purpose: '', dueAt },
  });
  assert.equal(emptyPurpose.status, 422);
  assert.ok(emptyPurpose.body.error.details.fieldErrors.purpose);
  pass('9 invalid saves -> 422 with fieldErrors');

  // 10. duplicate
  const dup = await call<any>('POST', '/api/leads/FV-1003/follow-ups', {
    cookie: ashaCookie2,
    json: { action: 'voice-call', purpose, dueAt, priority: 'high' },
  });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, 'DUPLICATE_OPEN_TASK');
  pass('10 duplicate -> 409 DUPLICATE_OPEN_TASK');

  // 11. phone masking
  const ownerView = await call<any>('GET', '/api/leads/FV-1001', { cookie: ashaCookie2 });
  assert.ok(!ownerView.body.phone.includes('•'));
  const taraView = await call<any>('GET', '/api/leads/FV-1001', { cookie: taraCookie });
  assert.equal(taraView.status, 200);
  assert.ok(taraView.body.phone.includes('•'));
  assert.equal(taraView.body.email, null);
  pass('11 owner sees full contact, TL sees masked');

  // 12. mutation content-type guard
  const wrongType = await call<any>('POST', '/api/leads/FV-1003/follow-ups', {
    cookie: ashaCookie2,
    contentType: 'text/plain',
    json: 'plain text body',
  });
  assert.equal(wrongType.status, 415);
  pass('12 non-JSON mutation -> 415');

  // 13. TL team scope read + owner-only mutation guard (403 path)
  const taraList = await call<any>('GET', '/api/leads', { cookie: taraCookie });
  const taraIds: string[] = taraList.body.leads.map((l: any) => l.id);
  for (const id of ['FV-1001', 'FV-1002', 'FV-1003', 'FV-1004', 'FV-1005']) {
    assert.ok(taraIds.includes(id), `TL scope must include ${id}`);
  }
  assert.ok(!taraIds.includes('FV-2001') && !taraIds.includes('FV-2002'), 'TL scope must exclude banking leads');
  const tlMut = await call<any>('POST', '/api/leads/FV-1001/follow-ups', {
    cookie: taraCookie,
    json: { action: 'voice-call', purpose: 'TL is not the owner', dueAt: new Date(Date.now() + 86400000).toISOString() },
  });
  assert.equal(tlMut.status, 403);
  pass('13 TL team scope + owner-only mutation (403)');

  // 14. unauthenticated access
  const noAuth = await call<any>('GET', '/api/leads', {});
  assert.equal(noAuth.status, 401);
  pass('14 unauthenticated -> 401');

  // 15. session cookie flags
  assert.ok((relogin.cookie ?? '').includes('HttpOnly'));
  assert.ok((relogin.cookie ?? '').toLowerCase().includes('samesite=strict'));
  pass('15 session cookie flags (HttpOnly, SameSite=Strict)');

  // 16. Effective assignment grants: mixed-role and multi-team regression
  const { loadAuthContextByEmployeeId } = await import('../src/repo/users');
  const { pool } = await import('../src/repo/db');

  // Verify legitimate multi-team access for Tara (TL with 2 teams in wealth)
  const taraCtx = await loadAuthContextByEmployeeId('EMP-003');
  assert.ok(taraCtx, 'tara auth context loaded');
  assert.equal(taraCtx.scope.role, 'TL');
  assert.deepEqual(taraCtx.scope.verticals, ['wealth']);
  assert.ok(taraCtx.scope.teams.includes('TEAM-WEALTH-ALPHA') && taraCtx.scope.teams.includes('TEAM-WEALTH-BETA'), 'Tara retains multi-team access');

  // Insert mixed-role, mixed-vertical assignment for a test user
  const TEST_EMP = 'EMP-TEST-MIXED';
  await pool.query(`INSERT INTO employees (id, email, password_hash, display_name, status)
    VALUES ($1, $2, 'hash', 'Mixed Role User', 'active') ON CONFLICT (id) DO NOTHING`, [TEST_EMP, 'mixed@finverse.test']);
  await pool.query(`DELETE FROM assignments WHERE employee_id = $1`, [TEST_EMP]);
  // Assignment 1: Active SC role in Wealth Alpha (effective today)
  await pool.query(`INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from)
    VALUES ('ASG-MIX-1', $1, 'SC', 'wealth', 'TEAM-WEALTH-ALPHA', CURRENT_DATE)`, [TEST_EMP]);
  // Assignment 2: Older or second assignment with TL role in Banking Alpha
  await pool.query(`INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from)
    VALUES ('ASG-MIX-2', $1, 'TL', 'banking', 'TEAM-BANKING-ALPHA', CURRENT_DATE - interval '1 day')`, [TEST_EMP]);

  const mixedCtx = await loadAuthContextByEmployeeId(TEST_EMP);
  assert.ok(mixedCtx, 'mixed user context loaded');
  assert.equal(mixedCtx.scope.role, 'SC', 'latest role is SC');
  assert.deepEqual(mixedCtx.scope.verticals, ['wealth'], 'verticals strictly scoped to active role; must NOT leak banking');
  assert.deepEqual(mixedCtx.scope.teams, ['TEAM-WEALTH-ALPHA'], 'teams strictly scoped to active role; must NOT leak banking team');

  // Clean up test assignments
  await pool.query(`DELETE FROM assignments WHERE employee_id = $1`, [TEST_EMP]);
  await pool.query(`DELETE FROM employees WHERE id = $1`, [TEST_EMP]);
  pass('16 mixed-role grants strictly isolated; legitimate multi-team preserved');

  console.log(`SUMMARY ${results.length}/16 groups passed`);
});

