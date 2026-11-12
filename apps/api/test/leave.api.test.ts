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

const RUN = `LVT-${Date.now().toString(36)}`;

interface Session {
  cookie: string;
  body: any;
}

let asha: Session;  // SC Wealth Alpha (EMP-001)
let ravi: Session;  // SC Wealth Beta (EMP-002)
let tara: Session;  // TL Wealth Alpha/Beta (EMP-003)
let neel: Session;  // MG Wealth (EMP-007)
let rohan: Session; // TL Banking Alpha (EMP-016)
let rajiv: Session; // CEO (EMP-010)
let pooja: Session; // HR (EMP-014)

async function login(email: string, password = 'demo1234'): Promise<Session> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
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
  await db.query(`DELETE FROM leave_approval_actions WHERE notes LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM employee_leaves WHERE coverage_notes LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM employee_leave_requests WHERE reason LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM approver_configurations WHERE notes LIKE $1`, [`%${RUN}%`]);
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

  // Login sessions
  asha = await login('asha@finverse.demo');
  ravi = await login('ravi@finverse.demo');
  tara = await login('tara@finverse.demo');
  neel = await login('neel@finverse.demo');
  rohan = await login('rohan@finverse.demo');
  rajiv = await login('rajiv@finverse.demo');
  pooja = await login('pooja@finverse.demo');
});

after(async () => {
  try {
    await cleanupTestData();
  } catch (err) {
    console.error('cleanup error:', err);
  }
  if (db) await db.end().catch(() => {});
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('LR-01: SC submit leave request routes to configured superior TL (Tara Iyer)', async () => {
  const res = await call('POST', '/api/leave/requests', {
    cookie: asha.cookie,
    json: {
      leaveType: 'casual',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      reason: `Family event attendance ${RUN}`,
      handoverNotes: 'Covered by Ravi Menon for incoming leads',
    },
  });

  assert.equal(res.status, 201, `Expected 201 Created, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.equal(res.body.data.status, 'submitted');
  assert.equal(res.body.data.approverId, 'EMP-003', 'Must route to Relationship Manager Tara Iyer');
  assert.ok(['Relationship Manager', 'Team Lead'].includes(res.body.data.approverTitle));
  assert.equal(res.body.data.totalDays, 3);
});

test('LR-02: Date validation rejects startDate > endDate with 422', async () => {
  const res = await call('POST', '/api/leave/requests', {
    cookie: asha.cookie,
    json: {
      leaveType: 'sick',
      startDate: '2026-11-15',
      endDate: '2026-11-10',
      reason: `Medical checkup ${RUN}`,
    },
  });

  assert.equal(res.status, 422, 'Expected 422 for invalid date range');
  assert.ok(res.body.error?.message?.includes('INVALID_DATE_INTERVAL'));
});

test('LR-03: Requester can view own submitted requests and audit trail', async () => {
  const res = await call('GET', '/api/leave/my-requests', { cookie: asha.cookie });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  const myReq = res.body.data.find((r: any) => r.reason.includes(RUN));
  assert.ok(myReq, 'Must find submitted request in my-requests');
  assert.equal(myReq.status, 'submitted');
  assert.equal(myReq.currentApproverId, 'EMP-003');
  assert.ok(myReq.actions?.length >= 1, 'Must contain initial submit audit action');
});

test('LR-04: Superior TL can view pending leave in approvals queue', async () => {
  const res = await call('GET', '/api/leave/approvals', { cookie: tara.cookie });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  const pending = res.body.data.find((r: any) => r.reason.includes(RUN));
  assert.ok(pending, 'Tara must see Asha leave request in her approvals queue');
  assert.equal(pending.employeeId, 'EMP-001');
});

test('LR-05: Supervisory span isolation: Foreign TL (Rohan Sen) cannot approve Wealth SC leave', async () => {
  const myReqs = await call('GET', '/api/leave/my-requests', { cookie: asha.cookie });
  const myReq = myReqs.body.data.find((r: any) => r.reason.includes(RUN));

  const res = await call('POST', `/api/leave/requests/${myReq.id}/approve`, {
    cookie: rohan.cookie, // Banking TL
    json: { notes: `Unauthorized cross-vertical approval ${RUN}` },
  });

  assert.equal(res.status, 403, 'Foreign TL outside supervisory span must be denied with 403');
  assert.ok(res.body.error?.message?.includes('outside your authorized supervisory span'));
});

test('LR-06: Superior TL approves leave request with timestamp and syncs to employee_leaves', async () => {
  const myReqs = await call('GET', '/api/leave/my-requests', { cookie: asha.cookie });
  const myReq = myReqs.body.data.find((r: any) => r.reason.includes(RUN));

  const res = await call('POST', `/api/leave/requests/${myReq.id}/approve`, {
    cookie: tara.cookie,
    json: { notes: `Approved. Workload reassigned to Ravi Menon. ${RUN}` },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'approved');
  assert.ok(res.body.data.decidedAt, 'Must record decidedAt timestamp');

  // Verify synchronization into employee_leaves table for availability dampening
  const dbLeaves = await db.query(
    `SELECT * FROM employee_leaves WHERE employee_id = 'EMP-001' AND coverage_notes LIKE $1`,
    [`%${RUN}%`]
  );
  assert.equal(dbLeaves.rows.length, 1, 'Must create active employee_leaves record');
  assert.equal(dbLeaves.rows[0].status, 'active');
  assert.equal(dbLeaves.rows[0].allocation_status, 'unavailable');
  assert.ok(['REL', 'TL'].includes(dbLeaves.rows[0].coverage_owner_role));
});

test('LR-07: Self-approval is strictly forbidden (TL Tara cannot approve own leave)', async () => {
  // Tara submits leave (should route to Manager Neel Verma EMP-007)
  const submitRes = await call('POST', '/api/leave/requests', {
    cookie: tara.cookie,
    json: {
      leaveType: 'annual',
      startDate: '2026-11-20',
      endDate: '2026-11-22',
      reason: `Annual vacation ${RUN}`,
    },
  });
  assert.equal(submitRes.status, 201);
  assert.equal(submitRes.body.data.approverId, 'EMP-007', 'TL leave must route to Manager Neel Verma');
  const taraReqId = submitRes.body.data.requestId;

  // Tara tries to approve her own request
  const selfApprove = await call('POST', `/api/leave/requests/${taraReqId}/approve`, {
    cookie: tara.cookie,
    json: { notes: `Self approval attempt ${RUN}` },
  });

  assert.equal(selfApprove.status, 422, 'Self-approval must be rejected with 422');
  assert.equal(selfApprove.body.error?.code, 'SELF_APPROVAL_FORBIDDEN');
});

test('LR-08: Manager rejects TL leave request with notes; rejected leave is NOT in employee_leaves', async () => {
  const taraReqs = await call('GET', '/api/leave/my-requests', { cookie: tara.cookie });
  const taraReq = taraReqs.body.data.find((r: any) => r.reason.includes(RUN) && r.status === 'submitted');

  const rejectRes = await call('POST', `/api/leave/requests/${taraReq.id}/reject`, {
    cookie: neel.cookie, // Manager Neel Verma
    json: { notes: `Q4 target push critical week. Please reschedule. ${RUN}` },
  });

  assert.equal(rejectRes.status, 200);
  assert.equal(rejectRes.body.data.status, 'rejected');

  // Verify that rejected leave is NOT inserted into employee_leaves
  const dbLeaves = await db.query(
    `SELECT * FROM employee_leaves WHERE employee_id = 'EMP-003' AND coverage_notes LIKE $1`,
    [`%${RUN}%`]
  );
  assert.equal(dbLeaves.rows.length, 0, 'Rejected leave must never be recorded as approved absence');
});

test('LR-09: Requester can withdraw pending leave; withdrawn request cannot be decided', async () => {
  // Ravi submits leave
  const submitRes = await call('POST', '/api/leave/requests', {
    cookie: ravi.cookie,
    json: {
      leaveType: 'sick',
      startDate: '2026-11-05',
      endDate: '2026-11-06',
      reason: `Feeling unwell ${RUN}`,
    },
  });
  assert.equal(submitRes.status, 201);
  const reqId = submitRes.body.data.requestId;

  // Ravi withdraws his pending request
  const withdrawRes = await call('POST', `/api/leave/requests/${reqId}/withdraw`, {
    cookie: ravi.cookie,
    json: { notes: `Recovered, withdrawing request ${RUN}` },
  });
  assert.equal(withdrawRes.status, 200);
  assert.equal(withdrawRes.body.data.status, 'withdrawn');

  // Tara attempts to approve withdrawn request -> 422 ALREADY_DECIDED
  const approveRes = await call('POST', `/api/leave/requests/${reqId}/approve`, {
    cookie: tara.cookie,
    json: { notes: `Late approval ${RUN}` },
  });
  assert.equal(approveRes.status, 422, 'Cannot approve withdrawn request');
  assert.ok(approveRes.body.error?.message?.includes('ALREADY_DECIDED'));
});

test('LR-10: Unconfigured superior blocks submission until explicitly configured', async () => {
  // CEO Rajiv Mehta (EMP-010) has unconfigured Board superior in default seed
  const ceoSubmit = await call('POST', '/api/leave/requests', {
    cookie: rajiv.cookie,
    json: {
      leaveType: 'annual',
      startDate: '2026-12-24',
      endDate: '2026-12-31',
      reason: `Year-end executive leave ${RUN}`,
    },
  });

  assert.equal(ceoSubmit.status, 422, 'Unconfigured CEO route must be blocked with 422');
  assert.equal(ceoSubmit.body.error?.code, 'UNCONFIGURED_APPROVER');

  // HR Specialist Pooja configures an explicit approver for CEO (EMP-014 or Board chair)
  const cfgRes = await call('POST', '/api/leave/approver-configs', {
    cookie: pooja.cookie,
    json: {
      role: 'CEO',
      approverEmployeeId: 'EMP-014', // HR Lead as delegated sign-off
      approverTitle: 'Board Delegate / HR Governance',
      isConfigured: true,
      notes: `Configured for CEO leave ${RUN}`,
    },
  });
  assert.equal(cfgRes.status, 201, 'HR can configure approver');

  // Now CEO submission succeeds
  const ceoSubmit2 = await call('POST', '/api/leave/requests', {
    cookie: rajiv.cookie,
    json: {
      leaveType: 'annual',
      startDate: '2026-12-24',
      endDate: '2026-12-31',
      reason: `Year-end executive leave unblocked ${RUN}`,
    },
  });
  assert.equal(ceoSubmit2.status, 201, 'CEO submit must succeed once approver is configured');
  assert.equal(ceoSubmit2.body.data.approverId, 'EMP-014');
});

test('LR-11: HR organization-wide visibility with multi-facet filters', async () => {
  // Non-HR role (Asha SC) cannot access organization-wide leave list -> 403
  const forbidden = await call('GET', '/api/leave/organization-requests', { cookie: asha.cookie });
  assert.equal(forbidden.status, 403, 'Non-HR role must receive 403');

  // HR role (Pooja) can access organization-wide list
  const allReqs = await call('GET', '/api/leave/organization-requests', { cookie: pooja.cookie });
  assert.equal(allReqs.status, 200);
  assert.ok(Array.isArray(allReqs.body.data));

  // Filter by status = 'approved'
  const approvedReqs = await call('GET', '/api/leave/organization-requests?status=approved', { cookie: pooja.cookie });
  assert.equal(approvedReqs.status, 200);
  assert.ok(approvedReqs.body.data.every((r: any) => r.status === 'approved'));

  // Filter by vertical = 'wealth'
  const wealthReqs = await call('GET', '/api/leave/organization-requests?vertical=wealth', { cookie: pooja.cookie });
  assert.equal(wealthReqs.status, 200);
  assert.ok(wealthReqs.body.data.every((r: any) => r.vertical === 'wealth'));

  // Filter by employeeId = 'EMP-001'
  const ashaReqs = await call('GET', '/api/leave/organization-requests?employeeId=EMP-001', { cookie: pooja.cookie });
  assert.equal(ashaReqs.status, 200);
  assert.ok(ashaReqs.body.data.every((r: any) => r.employeeId === 'EMP-001'));
});
