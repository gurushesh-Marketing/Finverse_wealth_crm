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

const RUN = `SA-HR-${Date.now().toString(36)}`;

interface Session {
  cookie: string;
  body: any;
}

let pooja: Session; // HR (EMP-014)
let alok: Session;  // SA (EMP-013)

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
  }
  return { status: res.status, headers: res.headers, body: parsed };
}

async function cleanupTestData() {
  try {
    await db.query(`DELETE FROM system_audit_logs WHERE details::text LIKE $1`, [`%${RUN}%`]);
    await db.query(`DELETE FROM system_audit_logs WHERE actor_employee_id IN (SELECT id FROM employees WHERE email LIKE $1 OR username LIKE $1)`, [`%${RUN.toLowerCase()}%`]);
    await db.query(`DELETE FROM local_delivery_outbox WHERE recipient_email LIKE $1`, [`%${RUN.toLowerCase()}%`]);
    await db.query(`DELETE FROM hr_lifecycle_requests WHERE employee_id IN (SELECT id FROM employees WHERE email LIKE $1 OR username LIKE $1)`, [`%${RUN.toLowerCase()}%`]);
    await db.query(`DELETE FROM assignments WHERE employee_id IN (SELECT id FROM employees WHERE email LIKE $1 OR username LIKE $1)`, [`%${RUN.toLowerCase()}%`]);
    await db.query(`DELETE FROM sessions WHERE employee_id IN (SELECT id FROM employees WHERE email LIKE $1 OR username LIKE $1)`, [`%${RUN.toLowerCase()}%`]);
    await db.query(`DELETE FROM employees WHERE email LIKE $1 OR username LIKE $1`, [`%${RUN.toLowerCase()}%`]);
  } catch (e) {
    console.error('cleanupTestData error:', e);
  }
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  db = new Pool({ connectionString: env.DATABASE_URL });
  await cleanupTestData();
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        BASE = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  pooja = await login('pooja@finverse.demo');
  alok = await login('alok@finverse.demo');
});

after(async () => {
  await cleanupTestData();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.end();
});

test('1. HR submits new employee: auto-generated immutable EMP-xxx, candidate cannot log in while pending', async () => {
  const email = `${RUN}-joiner@finverse.demo`.toLowerCase();
  const mobile = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;

  const res = await call('POST', '/api/hr/onboarding/submit', {
    cookie: pooja.cookie,
    json: {
      fullName: 'Rohan Varma',
      primaryMobile: mobile,
      whatsappNumber: mobile,
      email,
    },
  });

  assert.equal(res.status, 201, `Expected 201, got ${res.status}`);
  assert.ok(res.body.data.employeeId, 'Employee ID must be returned');
  assert.match(res.body.data.employeeId, /^EMP-\d{3,}$/, 'ID must be immutable EMP-xxx format');
  assert.equal(res.body.data.employee.status, 'pending_approval');
  const employeeId = res.body.data.employeeId;

  // Pending candidate cannot log in
  const loginRes = await call('POST', '/api/auth/login', {
    json: { email, password: 'InitialTempPassword123' },
  });
  assert.equal(loginRes.status, 401, 'Pending employee must not gain login access');
});

test('2. SA views HR requests section: pending request is listed with HR submitted details', async () => {
  const res = await call('GET', '/api/superadmin/hr/requests?status=pending', {
    cookie: alok.cookie,
  });

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data), 'Data must be an array of requests');
  const req = res.body.data.find((r: any) => r.employeeEmail && r.employeeEmail.includes(RUN.toLowerCase()));
  assert.ok(req, 'Pending request for this run must be visible to SA');
  assert.equal(req.requestType, 'new_account');
  assert.equal(req.status, 'submitted');
  assert.equal(req.employeeName, 'Rohan Varma');
  assert.match(req.employeeId, /^EMP-\d{3,}$/);
});

test('3. SA approval: rejects duplicate username with 422', async () => {
  const listRes = await call('GET', '/api/superadmin/hr/requests?status=pending', {
    cookie: alok.cookie,
  });
  const req = listRes.body.data.find((r: any) => r.employeeEmail && r.employeeEmail.includes(RUN.toLowerCase()));
  assert.ok(req);

  // Attempt to use 'asha' (which already exists for EMP-001)
  const dupRes = await call('POST', `/api/superadmin/hr/requests/${req.id}/approve-onboarding`, {
    cookie: alok.cookie,
    json: {
      role: 'SC',
      vertical: 'wealth',
      teamId: 'team-wealth-alpha',
      reportingManagerId: 'EMP-003',
      username: 'asha', // duplicate
      temporaryPassword: 'TempPassword123',
    },
  });

  assert.equal(dupRes.status, 422, 'Duplicate username must be rejected with 422');
  assert.ok(dupRes.body.error, 'Must return error body');
});

test('3b. SA cannot activate a Sales Caller under a Manager outside the team REL', async () => {
  const listRes = await call('GET', '/api/superadmin/hr/requests?status=pending', { cookie: alok.cookie });
  const req = listRes.body.data.find((r: any) => r.employeeEmail && r.employeeEmail.includes(RUN.toLowerCase()));
  assert.ok(req);
  const result = await call('POST', `/api/superadmin/hr/requests/${req.id}/approve-onboarding`, {
    cookie: alok.cookie,
    json: {
      role: 'SC', vertical: 'wealth', teamId: 'team-wealth-alpha',
      reportingManagerId: 'EMP-007', username: `wrong.${RUN.toLowerCase()}`,
      temporaryPassword: 'TempPassword123!',
    },
  });
  assert.equal(result.status, 422);
  assert.match(result.body.error.message, /Relationship Manager/);
});

test('4. SA approves new employee with manual unique username and temporary password: hash stored securely', async () => {
  const listRes = await call('GET', '/api/superadmin/hr/requests?status=pending', {
    cookie: alok.cookie,
  });
  const req = listRes.body.data.find((r: any) => r.employeeEmail && r.employeeEmail.includes(RUN.toLowerCase()));
  assert.ok(req);

  const customUsername = `rohan.${RUN.toLowerCase()}`;
  const tempPassword = 'TempPassword123!';

  const approveRes = await call('POST', `/api/superadmin/hr/requests/${req.id}/approve-onboarding`, {
    cookie: alok.cookie,
    json: {
      role: 'SC',
      vertical: 'wealth',
      teamId: 'team-wealth-alpha',
      reportingManagerId: 'EMP-003',
      username: customUsername,
      temporaryPassword: tempPassword,
    },
  });

  assert.equal(approveRes.status, 200, `Approval failed: ${JSON.stringify(approveRes.body)}`);
  assert.equal(approveRes.body.data.username, customUsername);
  assert.equal(approveRes.body.data.mustChangePassword, true);

  // Verify DB state: password_hash is bcrypt hash, NOT plaintext
  const empDb = await db.query('SELECT username, password_hash, must_change_password, status FROM employees WHERE id = $1', [req.employeeId]);
  assert.equal(empDb.rows.length, 1);
  assert.equal(empDb.rows[0].username, customUsername);
  assert.equal(empDb.rows[0].status, 'active');
  assert.equal(empDb.rows[0].must_change_password, true);
  assert.notEqual(empDb.rows[0].password_hash, tempPassword, 'Password must never be stored in plaintext');
  assert.match(empDb.rows[0].password_hash, /^scrypt\$/, 'Password hash must be a valid scrypt secure hash');

  // Verify request moved to approved in SA view
  const approvedRes = await call('GET', '/api/superadmin/hr/requests?status=approved', {
    cookie: alok.cookie,
  });
  const approvedReq = approvedRes.body.data.find((r: any) => r.id === req.id);
  assert.ok(approvedReq, 'Request must appear in approved requests list');
  assert.equal(approvedReq.status, 'activated_by_admin');

  // Verify HR sees updated status
  const hrReqsRes = await call('GET', '/api/hr/requests', {
    cookie: pooja.cookie,
  });
  const hrReq = hrReqsRes.body.data.find((r: any) => r.id === req.id);
  assert.ok(hrReq, 'HR must see request');
  assert.equal(hrReq.status, 'activated_by_admin');
});

test('5. Employee logs in with SA-created username and temporary password -> must_change_password triggered', async () => {
  const customUsername = `rohan.${RUN.toLowerCase()}`;
  const tempPassword = 'TempPassword123!';
  const newPassword = 'NewSecretPassword456!';

  // Login using manual username
  const loginRes = await call('POST', '/api/auth/login', {
    json: { email: customUsername, password: tempPassword },
  });

  assert.equal(loginRes.status, 200, `Login failed: ${JSON.stringify(loginRes.body)}`);
  assert.equal(loginRes.body.session?.mustChangePassword, true, 'First login must enforce password change');
  const sessionCookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0];
  assert.ok(sessionCookie, 'Session cookie must be returned');

  // Attempting to change password
  const changeRes = await call('POST', '/api/auth/change-password', {
    cookie: sessionCookie,
    json: {
      currentPassword: tempPassword,
      newPassword,
      confirmPassword: newPassword,
    },
  });

  assert.equal(changeRes.status, 200, `Change password failed: ${JSON.stringify(changeRes.body)}`);

  // Verify must_change_password is now false in DB
  const empDb = await db.query('SELECT must_change_password FROM employees WHERE username = $1', [customUsername]);
  assert.equal(empDb.rows[0].must_change_password, false);

  // Old temporary password now FAILS
  const oldLoginRes = await call('POST', '/api/auth/login', {
    json: { email: customUsername, password: tempPassword },
  });
  assert.equal(oldLoginRes.status, 401, 'Old temporary password must fail after password change');

  // New password SUCCEEDS
  const newLoginRes = await call('POST', '/api/auth/login', {
    json: { email: customUsername, password: newPassword },
  });
  assert.equal(newLoginRes.status, 200, 'New permanent password must succeed');
  assert.equal(newLoginRes.body.session?.mustChangePassword, false);
});

test('6. SA rejection flow: candidate status set to rejected and login is blocked', async () => {
  const email = `${RUN}-rejectee@finverse.demo`.toLowerCase();
  const mobile = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;

  const submitRes = await call('POST', '/api/hr/onboarding/submit', {
    cookie: pooja.cookie,
    json: {
      fullName: 'Rejected Candidate',
      primaryMobile: mobile,
      email,
    },
  });
  assert.equal(submitRes.status, 201);
  const reqId = submitRes.body.data.requestId;
  const empId = submitRes.body.data.employeeId;

  // SA rejects request with reason
  const rejectRes = await call('POST', `/api/superadmin/hr/requests/${reqId}/reject`, {
    cookie: alok.cookie,
    json: {
      rejectionReason: 'Role quota exceeded for current cycle',
    },
  });

  assert.equal(rejectRes.status, 200);
  assert.equal(rejectRes.body.data.status, 'rejected');

  // Verify in rejected tab
  const rejectedRes = await call('GET', '/api/superadmin/hr/requests?status=rejected', {
    cookie: alok.cookie,
  });
  const found = rejectedRes.body.data.find((r: any) => r.id === reqId);
  assert.ok(found, 'Request must be present in rejected view');
  assert.equal(found.adminDecisionNotes, 'Role quota exceeded for current cycle');

  // Employee status is rejected in DB and cannot log in
  const empDb = await db.query('SELECT status FROM employees WHERE id = $1', [empId]);
  assert.equal(empDb.rows[0].status, 'rejected');

  const loginRes = await call('POST', '/api/auth/login', {
    json: { email, password: 'TempPassword123!' },
  });
  assert.equal(loginRes.status, 401, 'Rejected employee must not gain login access');
});

test('7. Employee exit request flow: SA approves exit, deactivates account and terminates access', async () => {
  // Create an active employee to exit
  const email = `${RUN}-exitee@finverse.demo`.toLowerCase();
  const mobile = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
  const submitRes = await call('POST', '/api/hr/onboarding/submit', {
    cookie: pooja.cookie,
    json: {
      fullName: 'Vikram Exit',
      primaryMobile: mobile,
      email,
    },
  });
  const reqId = submitRes.body.data.requestId;
  const empId = submitRes.body.data.employeeId;
  const username = `vikram.${RUN.toLowerCase()}`;
  const tempPass = 'VikramTemp123!';

  const approveRes = await call('POST', `/api/superadmin/hr/requests/${reqId}/approve-onboarding`, {
    cookie: alok.cookie,
    json: {
      role: 'SC',
      vertical: 'wealth',
      teamId: 'team-wealth-alpha',
      reportingManagerId: 'EMP-003',
      username,
      temporaryPassword: tempPass,
    },
  });
  assert.equal(approveRes.status, 200, `Approval failed: ${JSON.stringify(approveRes.body)}`);

  // Verify Vikram can log in
  const preExitLogin = await call('POST', '/api/auth/login', {
    json: { email: username, password: tempPass },
  });
  assert.equal(preExitLogin.status, 200, 'Employee should be active before exit');

  // HR coordinates exit request
  const exitReqRes = await call('POST', '/api/hr/exits/coordinate', {
    cookie: pooja.cookie,
    json: {
      employeeId: empId,
      exitDate: new Date().toISOString().slice(0, 10),
      exitTime: '18:00 IST',
      openWorkHandoff: 'Open work handoff plan and checklist completed',
      accessRevocationSchedule: 'immediate',
      replacementPlan: 'New recruitment scheduled next week',
      approvalsSummary: 'Authorized exit approval evidence submitted',
      notes: 'Handover completed',
    },
  });
  assert.equal(exitReqRes.status, 201, `Exit request creation failed: ${JSON.stringify(exitReqRes.body)}`);
  const exitRequestId = exitReqRes.body.data.requestId;

  // SA approves exit request
  const approveExitRes = await call('POST', `/api/superadmin/hr/requests/${exitRequestId}/approve-exit`, {
    cookie: alok.cookie,
    json: {
      decisionNotes: 'Approved employee exit and account termination',
      handoffSupervisedQueue: true,
    },
  });
  assert.equal(approveExitRes.status, 200, `Exit approval failed: ${JSON.stringify(approveExitRes.body)}`);

  // Employee status is now disabled in DB
  const empDb = await db.query('SELECT status FROM employees WHERE id = $1', [empId]);
  assert.equal(empDb.rows[0].status, 'disabled');

  // Exited employee cannot log in
  const postExitLogin = await call('POST', '/api/auth/login', {
    json: { email: username, password: tempPass },
  });
  assert.equal(postExitLogin.status, 401, 'Exited employee must not gain login access');
});

test('8. retired direct provisioning cannot bypass the HR request and SA approval queue', async () => {
  const result = await call('POST', '/api/superadmin/accounts/provision', {
    cookie: alok.cookie,
    json: { employeeName: 'Bypass Attempt', workEmail: 'bypass@example.invalid' },
  });
  assert.equal(result.status, 410);
  assert.equal(result.body.error.code, 'RETIRED_WORKFLOW');
});
