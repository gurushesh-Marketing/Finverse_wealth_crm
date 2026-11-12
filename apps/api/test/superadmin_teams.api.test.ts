process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { createApp } from '../src/app';
import { assertTestDatabaseGuard, env } from '../src/config';

let server: Server;
let BASE: string;
let db: Pool;

const RUN = `SATM-${Date.now().toString(36)}`;
const TEST_TEAM_ID = `TEAM-WEALTH-${RUN.toUpperCase()}`;

interface Session {
  cookie: string;
  body: any;
}

let alok: Session;  // SA (EMP-013)
let asha: Session;  // SC (EMP-001)
let pooja: Session; // HR (EMP-014)

async function login(email: string, password = 'demo1234'): Promise<Session> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
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
  } else {
    parsed = await res.text();
  }
  return { status: res.status, headers: res.headers, body: parsed };
}

async function cleanupTestData() {
  await db.query(`DELETE FROM assignments WHERE team_id = $1`, [TEST_TEAM_ID]);
  await db.query(`DELETE FROM teams WHERE id = $1`, [TEST_TEAM_ID]);
  await db.query(`DELETE FROM system_audit_logs WHERE details::text LIKE $1`, [`%${RUN}%`]);
  await db.query(`UPDATE assignments SET effective_to = NULL WHERE id = 'ASG-WEALTH-001'`);
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  db = new Pool({ connectionString: env.DATABASE_URL });
  await cleanupTestData();
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      BASE = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  alok = await login('alok@finverse.demo');
  asha = await login('asha@finverse.demo');
  pooja = await login('pooja@finverse.demo');
});

after(async () => {
  try {
    await cleanupTestData();
  } finally {
    await db.end();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Super Admin Team Management Security: Non-SA is blocked with 403', async () => {
  // Asha is a Sales Caller (SC)
  const createRes = await call('POST', '/api/superadmin/teams', {
    cookie: asha.cookie,
    json: {
      name: `Forbidden Team ${RUN}`,
      vertical: 'wealth',
      relationshipManagerId: 'EMP-003',
    },
  });
  assert.equal(createRes.status, 403);
  assert.equal(createRes.body.error.code, 'FORBIDDEN');

  const patchRes = await call('PATCH', '/api/superadmin/teams/TEAM-WEALTH-ALPHA', {
    cookie: asha.cookie,
    json: { name: 'Renamed Hack' },
  });
  assert.equal(patchRes.status, 403);
});

test('Super Admin Team Management: Vertical Grant Validation prevents invalid RM assignment', async () => {
  // EMP-016 is a Banking Relationship Manager, not Wealth!
  const invalidRes = await call('POST', '/api/superadmin/teams', {
    cookie: alok.cookie,
    json: {
      id: TEST_TEAM_ID,
      name: `Invalid RM Team ${RUN}`,
      vertical: 'wealth',
      relationshipManagerId: 'EMP-016',
    },
  });
  assert.equal(invalidRes.status, 422);
  assert.equal(invalidRes.body.error.code, 'VALIDATION_FAILED');
  assert.match(invalidRes.body.error.message, /Relationship Manager grant in this vertical/);
});

test('Super Admin Team Management: SA creates new team with eligible RM (supervising multiple teams)', async () => {
  // EMP-003 (Tara Iyer) is active Wealth RM who already supervises Alpha and Beta
  const res = await call('POST', '/api/superadmin/teams', {
    cookie: alok.cookie,
    json: {
      id: TEST_TEAM_ID,
      name: `Wealth Expansion ${RUN}`,
      vertical: 'wealth',
      relationshipManagerId: 'EMP-003',
    },
  });
  assert.equal(res.status, 201);
  const team = res.body.data;
  assert.equal(team.id, TEST_TEAM_ID);
  assert.equal(team.name, `Wealth Expansion ${RUN}`);
  assert.equal(team.vertical, 'wealth');
  assert.equal(team.relationshipManagerId, 'EMP-003');
  assert.equal(team.relationshipManagerName, 'Tara Iyer');
  assert.equal(team.status, 'active');
  // Starts with 0 callers while staffing is in progress
  assert.equal(team.callerCount, 0);
  assert.deepEqual(team.callers, []);
});

test('HR and SA placement selectors read the newly created operational team', async () => {
  for (const [role, cookie, path] of [
    ['HR', pooja.cookie, '/api/hr/placement-options?vertical=wealth'],
    ['SA', alok.cookie, '/api/superadmin/placement-options?vertical=wealth'],
  ] as const) {
    const response = await call('GET', path, { cookie });
    assert.equal(response.status, 200, `${role} options failed`);
    const team = response.body.data.teams.find((item: any) => item.id === TEST_TEAM_ID);
    assert.equal(team?.relationshipManagerId, 'EMP-003');
    assert.ok(response.body.data.superiors.some((item: any) => item.id === 'EMP-003' && item.role === 'REL'));
    const superiorIds = response.body.data.superiors.map((item: any) => item.id);
    assert.equal(new Set(superiorIds).size, superiorIds.length, `${role} superior options must not contain duplicate employees`);
  }
  const forbidden = await call('GET', '/api/hr/placement-options?vertical=wealth', { cookie: asha.cookie });
  assert.equal(forbidden.status, 403);
});

test('HR cannot propose a Sales Caller into a team with the wrong superior', async () => {
  const result = await call('POST', '/api/hr/onboarding/submit', {
    cookie: pooja.cookie,
    json: {
      fullName: `Placement Probe ${RUN}`,
      primaryMobile: '+919870001234',
      email: `placement.${RUN.toLowerCase()}@example.invalid`,
      proposedRole: 'SC',
      proposedVertical: 'wealth',
      proposedTeamId: TEST_TEAM_ID,
      proposedSuperiorId: 'EMP-007',
    },
  });
  assert.equal(result.status, 422);
  assert.match(result.body.error.message, /Relationship Manager/);
});

test('Super Admin Team Management: List teams and filter by vertical', async () => {
  const listRes = await call('GET', '/api/superadmin/teams?vertical=wealth', {
    cookie: alok.cookie,
  });
  assert.equal(listRes.status, 200);
  const wealthTeams = listRes.body.data;
  assert.ok(Array.isArray(wealthTeams));
  const found = wealthTeams.find((t: any) => t.id === TEST_TEAM_ID);
  assert.ok(found);
  assert.equal(found.name, `Wealth Expansion ${RUN}`);
  assert.equal(found.callerCount, 0);
});

test('Super Admin Team Management: List eligible Relationship Managers and Callers', async () => {
  const mgrRes = await call('GET', '/api/superadmin/teams/eligible-managers?vertical=wealth', {
    cookie: alok.cookie,
  });
  assert.equal(mgrRes.status, 200);
  const managers = mgrRes.body.data;
  assert.ok(managers.some((m: any) => m.id === 'EMP-003' && m.name === 'Tara Iyer'));

  const callersRes = await call('GET', '/api/superadmin/teams/eligible-callers?vertical=wealth', {
    cookie: alok.cookie,
  });
  assert.equal(callersRes.status, 200);
  const callers = callersRes.body.data;
  assert.ok(callers.some((c: any) => c.id === 'EMP-001' && c.name === 'Asha Rao'));
});

test('Super Admin Team Management: SA renames team and updates status', async () => {
  const updateRes = await call('PATCH', `/api/superadmin/teams/${TEST_TEAM_ID}`, {
    cookie: alok.cookie,
    json: {
      name: `Wealth Expansion Renamed ${RUN}`,
      status: 'active',
    },
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.data.name, `Wealth Expansion Renamed ${RUN}`);
});

test('Super Admin Team Management: SA assigns caller to team, preserving assignment history', async () => {
  // Move EMP-001 (Asha Rao) from Wealth Alpha to this new team
  const assignRes = await call('POST', `/api/superadmin/teams/${TEST_TEAM_ID}/callers`, {
    cookie: alok.cookie,
    json: {
      callerEmployeeId: 'EMP-001',
      reason: `Staffing test team ${RUN}`,
    },
  });
  assert.equal(assignRes.status, 200);
  assert.ok(assignRes.body.data.success);

  // Verify team list now reflects 1 caller
  const listRes = await call('GET', '/api/superadmin/teams?vertical=wealth', {
    cookie: alok.cookie,
  });
  const updatedTeam = listRes.body.data.find((t: any) => t.id === TEST_TEAM_ID);
  assert.equal(updatedTeam.callerCount, 1);
  assert.equal(updatedTeam.callers[0].employeeId, 'EMP-001');

  // Verify reporting manager of Asha was set to team RM (EMP-003)
  const { rows: empRows } = await db.query(`SELECT reporting_manager_id FROM employees WHERE id = 'EMP-001'`);
  assert.equal(empRows[0].reporting_manager_id, 'EMP-003');

  // Verify assignment history: old assignment closed with effective_to, new assignment active
  const { rows: histRows } = await db.query(
    `SELECT id, team_id, effective_from, effective_to FROM assignments WHERE employee_id = 'EMP-001' ORDER BY effective_from DESC`
  );
  assert.ok(histRows.length >= 2, 'Should preserve prior assignment history');
  assert.equal(histRows[0].team_id, TEST_TEAM_ID);
  assert.equal(histRows[0].effective_to, null);
  assert.notEqual(histRows[1].effective_to, null, 'Prior assignment must have effective_to closed');
});
