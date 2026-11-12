process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Server } from 'node:http';
import { createApp } from '../src/app';

let server: Server;
let BASE: string;

interface Session {
  cookie: string;
  body: any;
}

async function login(email: string, password = 'demo1234'): Promise<Session> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as any;
  assert.equal(res.status, 200, `Login failed for ${email}: ${JSON.stringify(body)}`);
  const raw = res.headers.get('set-cookie') ?? '';
  return { cookie: raw.split(';')[0]!, body };
}

async function call(
  method: string,
  path: string,
  opts: { json?: unknown; cookie?: string } = {}
) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers['Cookie'] = opts.cookie;
  if (opts.json !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
  });
  const body = (await res.json().catch(() => null)) as any;
  return { status: res.status, body };
}

describe('Super Admin Vertical Selection & Isolation Test Suite', () => {
  before(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        BASE = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('1. SA login (/api/auth/me) returns all four canonical verticals in verticalGrants', async () => {
    const sa = await login('alok@finverse.demo');
    const res = await call('GET', '/api/auth/me', { cookie: sa.cookie });
    assert.equal(res.status, 200);

    const session = res.body.session || res.body.data?.session;
    assert.ok(session, `Expected session object: ${JSON.stringify(res.body)}`);
    assert.equal(session.role, 'SA');

    const grants: string[] = session.verticalGrants;
    assert.ok(grants.includes('wealth'), `Missing wealth in grants: ${JSON.stringify(grants)}`);
    assert.ok(grants.includes('banking'), `Missing banking in grants: ${JSON.stringify(grants)}`);
    assert.ok(grants.includes('markets'), `Missing markets in grants: ${JSON.stringify(grants)}`);
    assert.ok(
      grants.includes('real_estate') || grants.includes('real-estate'),
      `Missing real_estate in grants: ${JSON.stringify(grants)}`
    );
  });

  it('2. GET /api/superadmin/teams partitioned strictly by vertical with zero cross-vertical leakage', async () => {
    const sa = await login('alok@finverse.demo');

    // Wealth
    const resW = await call('GET', '/api/superadmin/teams?vertical=wealth', { cookie: sa.cookie });
    assert.equal(resW.status, 200);
    const teamsW = resW.body.data;
    assert.ok(teamsW.length > 0, 'Expected Wealth teams');
    for (const t of teamsW) {
      assert.equal(t.vertical, 'wealth');
    }

    // Banking
    const resB = await call('GET', '/api/superadmin/teams?vertical=banking', { cookie: sa.cookie });
    assert.equal(resB.status, 200);
    const teamsB = resB.body.data;
    assert.ok(teamsB.length > 0, 'Expected Banking teams');
    for (const t of teamsB) {
      assert.equal(t.vertical, 'banking');
    }

    // Markets
    const resM = await call('GET', '/api/superadmin/teams?vertical=markets', { cookie: sa.cookie });
    assert.equal(resM.status, 200);
    const teamsM = resM.body.data;
    assert.ok(teamsM.length > 0, 'Expected Markets teams');
    for (const t of teamsM) {
      assert.equal(t.vertical, 'markets');
    }

    // Real Estate
    const resRE = await call('GET', '/api/superadmin/teams?vertical=real_estate', { cookie: sa.cookie });
    assert.equal(resRE.status, 200);
    const teamsRE = resRE.body.data;
    assert.ok(teamsRE.length > 0, 'Expected Real Estate teams');
    for (const t of teamsRE) {
      assert.ok(t.vertical === 'real_estate' || t.vertical === 'real-estate');
    }
  });

  it('3. GET /api/superadmin/hr/requests partitioned strictly by vertical with zero cross-vertical leakage', async () => {
    const sa = await login('alok@finverse.demo');

    for (const v of ['wealth', 'banking', 'markets', 'real_estate']) {
      const res = await call('GET', `/api/superadmin/hr/requests?vertical=${v}`, { cookie: sa.cookie });
      assert.equal(res.status, 200);
      const requests = res.body.data;
      for (const r of requests) {
        const itemVert = r.target_vertical
          ? (r.target_vertical === 'real-estate' ? 'real_estate' : r.target_vertical)
          : (r.current_vertical === 'real-estate' ? 'real_estate' : r.current_vertical);
        if (itemVert) {
          assert.equal(itemVert, v, `Expected item vertical ${itemVert} to match queried vertical ${v}`);
        }
      }
    }
  });

  it('4. Relationship Managers and Callers eligible lists are strictly scoped to the queried vertical', async () => {
    const sa = await login('alok@finverse.demo');

    // Wealth RM
    const rmsW = await call('GET', '/api/superadmin/teams/eligible-managers?vertical=wealth', { cookie: sa.cookie });
    assert.equal(rmsW.status, 200);
    assert.ok(rmsW.body.data.every((r: any) => r.vertical === 'wealth'));

    // Banking RM
    const rmsB = await call('GET', '/api/superadmin/teams/eligible-managers?vertical=banking', { cookie: sa.cookie });
    assert.equal(rmsB.status, 200);
    assert.ok(rmsB.body.data.every((r: any) => r.vertical === 'banking'));

    // Markets RM
    const rmsM = await call('GET', '/api/superadmin/teams/eligible-managers?vertical=markets', { cookie: sa.cookie });
    assert.equal(rmsM.status, 200);
    assert.ok(rmsM.body.data.every((r: any) => r.vertical === 'markets'));

    // Real Estate RM
    const rmsRE = await call('GET', '/api/superadmin/teams/eligible-managers?vertical=real-estate', { cookie: sa.cookie });
    assert.equal(rmsRE.status, 200);
    assert.ok(rmsRE.body.data.every((r: any) => r.vertical === 'real_estate' || r.vertical === 'real-estate'));
  });
});
