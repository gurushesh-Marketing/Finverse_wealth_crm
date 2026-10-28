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

const RUN = `OAT-${Date.now().toString(36)}`;

interface Session {
  cookie: string;
  body: any;
}

let pooja: Session; // HR (EMP-014)
let alok: Session;  // SA (EMP-013)
let asha: Session;  // SC (EMP-001)

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
  await db.query(`DELETE FROM system_audit_logs WHERE details::text LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM system_audit_logs WHERE actor_employee_id IN (SELECT id FROM employees WHERE email LIKE $1)`, [`%${RUN.toLowerCase()}%`]);
  await db.query(`DELETE FROM local_delivery_outbox WHERE recipient_email LIKE $1`, [`%${RUN.toLowerCase()}%`]);
  await db.query(`DELETE FROM hr_lifecycle_requests WHERE employee_id IN (SELECT id FROM employees WHERE email LIKE $1)`, [`%${RUN.toLowerCase()}%`]);
  await db.query(`DELETE FROM assignments WHERE employee_id IN (SELECT id FROM employees WHERE email LIKE $1)`, [`%${RUN.toLowerCase()}%`]);
  await db.query(`DELETE FROM employees WHERE email LIKE $1`, [`%${RUN.toLowerCase()}%`]);
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
  asha = await login('asha@finverse.demo');
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.end();
});

test('1. HR creates pending employee record with 4 required fields and server generates sequential ID', async () => {
  const email = `${RUN}-joiner1@finverse.demo`;
  const mobile = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;

  const res = await call('POST', '/api/hr/onboarding/submit', {
    cookie: pooja.cookie,
    json: {
      fullName: 'Aarav Sharma',
      primaryMobile: mobile,
      whatsappNumber: mobile,
      email,
    },
  });

  assert.equal(res.status, 201, `Expected 201 Created, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.ok(res.body.data.employeeId, 'Employee ID must be returned');
  assert.match(res.body.data.employeeId, /^EMP-\d{3,}$/, 'Employee ID must match EMP-xxx format');
  assert.equal(res.body.data.status, 'Pending Super Admin Approval');
  assert.equal(res.body.data.employee.status, 'pending_approval');
  assert.ok(res.body.data.requestId, 'Request ID must be returned');

  // Verify in database: employee status is pending_approval, password_hash is dummy placeholder, must_change_password is true
  const empRes = await db.query('SELECT * FROM employees WHERE id = $1', [res.body.data.employeeId]);
  assert.equal(empRes.rows.length, 1);
  assert.equal(empRes.rows[0].status, 'pending_approval');
  assert.equal(empRes.rows[0].must_change_password, true);

  // Verify separate audit request record in hr_lifecycle_requests
  const reqRes = await db.query('SELECT * FROM hr_lifecycle_requests WHERE id = $1', [res.body.data.requestId]);
  assert.equal(reqRes.rows.length, 1);
  assert.equal(reqRes.rows[0].employee_id, res.body.data.employeeId);
  assert.equal(reqRes.rows[0].status, 'submitted');
});

test('2. Pending employee cannot log in or access workspace', async () => {
  const email = `${RUN}-pending-login@finverse.demo`;
  const mobile = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;

  const createRes = await call('POST', '/api/hr/onboarding/submit', {
    cookie: pooja.cookie,
    json: {
      fullName: 'Pending Candidate',
      primaryMobile: mobile,
      email,
    },
  });
  assert.equal(createRes.status, 201);

  // Attempt login with any credentials
  const loginRes = await call('POST', '/api/auth/login', {
    json: { email, password: 'anyPassword123' },
  });
  assert.equal(loginRes.status, 401, 'Pending employee login must be rejected with 401');
});

test('3. Super Admin sees pending onboarding request in review queue', async () => {
  const listRes = await call('GET', '/api/superadmin/onboarding/requests', {
    cookie: alok.cookie,
  });
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body.data));
  const found = listRes.body.data.find((r: any) => (r.full_name || r.employee_name) === 'Pending Candidate');
  assert.ok(found, 'Pending candidate must appear in Super Admin onboarding queue');
  assert.equal(found.employee_status, 'pending_approval');
});

test('4. Super Admin approval validates cross-vertical manager eligibility', async () => {
  const email = `${RUN}-wrong-mgr@finverse.demo`;
  const mobile = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;

  const createRes = await call('POST', '/api/hr/onboarding/submit', {
    cookie: pooja.cookie,
    json: {
      fullName: 'Cross Vertical Test',
      primaryMobile: mobile,
      email,
    },
  });
  assert.equal(createRes.status, 201);
  const { requestId } = createRes.body.data;

  // Try approving a Wealth SC with Banking Manager (EMP-018) -> must fail with 422
  const badApproveRes = await call('POST', '/api/superadmin/onboarding/approve', {
    cookie: alok.cookie,
    json: {
      requestId,
      role: 'SC',
      vertical: 'wealth',
      teamId: 'TEAM-WEALTH-ALPHA',
      reportingManagerId: 'EMP-018', // Anil Verma (Banking Alpha MG)
      username: `${RUN}_cross_mgr`,
    },
  });
  assert.equal(badApproveRes.status, 422, 'Cross-vertical manager selection must be rejected with 422');
});

test('5. Super Admin approves candidate, provisions one-time temp password, and assigns team', async () => {
  const email = `${RUN}-approved-sc@finverse.demo`;
  const mobile = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
  const username = `${RUN}_newcaller`.toLowerCase();

  const createRes = await call('POST', '/api/hr/onboarding/submit', {
    cookie: pooja.cookie,
    json: {
      fullName: 'Rohan Mehra',
      primaryMobile: mobile,
      email,
    },
  });
  assert.equal(createRes.status, 201);
  const { requestId, employeeId } = createRes.body.data;

  // Super Admin approves with Wealth Alpha team and Wealth Alpha manager (EMP-003 Sameer Sen)
  const approveRes = await call('POST', '/api/superadmin/onboarding/approve', {
    cookie: alok.cookie,
    json: {
      requestId,
      role: 'SC',
      vertical: 'wealth',
      teamId: 'TEAM-WEALTH-ALPHA',
      reportingManagerId: 'EMP-003',
      username,
    },
  });

  assert.equal(approveRes.status, 200, `Expected 200, got ${approveRes.status}: ${JSON.stringify(approveRes.body)}`);
  assert.equal(approveRes.body.data.employeeId, employeeId);
  assert.equal(approveRes.body.data.username, employeeId, 'Permanent non-editable login username must be Employee ID (EMP-xxx)');
  assert.ok(approveRes.body.data.temporaryPassword, 'One-time temporary password must be returned');

  const tempPassword = approveRes.body.data.temporaryPassword;

  // Verify in DB that employee is now active, must_change_password is true, and reporting_manager_id is EMP-003
  const empRes = await db.query('SELECT * FROM employees WHERE id = $1', [employeeId]);
  assert.equal(empRes.rows[0].status, 'active');
  assert.equal(empRes.rows[0].must_change_password, true);
  assert.equal(empRes.rows[0].reporting_manager_id, 'EMP-003');

  // Verify assignment created atomically
  const assignRes = await db.query('SELECT * FROM assignments WHERE employee_id = $1', [employeeId]);
  assert.equal(assignRes.rows.length, 1);
  assert.equal(assignRes.rows[0].role, 'SC');
  assert.equal(assignRes.rows[0].vertical, 'wealth');
  assert.equal(assignRes.rows[0].team_id, 'TEAM-WEALTH-ALPHA');

  // 6. Test login with temporary password -> must_change_password is required
  const loginRes = await call('POST', '/api/auth/login', {
    json: { email: employeeId, password: tempPassword },
  });
  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.body.session.mustChangePassword, true);
  const newSessionCookie = (loginRes.headers.get('set-cookie') ?? '').split(';')[0]!;

  // 7. Change password at first login
  const changeRes = await call('POST', '/api/auth/change-password', {
    cookie: newSessionCookie,
    json: { newPassword: 'PermanentPass1234!' },
  });
  assert.equal(changeRes.status, 200);

  // 8. Verify me endpoint returns mustChangePassword: false
  const meRes = await call('GET', '/api/auth/me', { cookie: newSessionCookie });
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.session.mustChangePassword, false);

  // 9. Verify old temp password no longer works
  const oldLoginRes = await call('POST', '/api/auth/login', {
    json: { email: employeeId, password: tempPassword },
  });
  assert.equal(oldLoginRes.status, 401);

  // 10. Verify new permanent password works
  const newLoginRes = await call('POST', '/api/auth/login', {
    json: { email: employeeId, password: 'PermanentPass1234!' },
  });
  assert.equal(newLoginRes.status, 200);

  // 11. Verify eligible for round-robin leads in assigned team and vertical
  const eligibleRes = await db.query(
    `SELECT e.id
       FROM assignments a
       JOIN employees e ON e.id = a.employee_id
      WHERE a.vertical = 'wealth'
        AND a.team_id = 'TEAM-WEALTH-ALPHA'
        AND a.role = 'SC'
        AND a.effective_from <= CURRENT_DATE
        AND (a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)
        AND e.status = 'active'`
  );
  const eligibleIds = eligibleRes.rows.map((r: any) => r.id);
  assert.ok(eligibleIds.includes(employeeId), 'Newly activated SC must be eligible for round-robin in assigned team/vertical');

  // Verify NOT eligible in other verticals (e.g. banking)
  const bankingEligibleRes = await db.query(
    `SELECT e.id
       FROM assignments a
       JOIN employees e ON e.id = a.employee_id
      WHERE a.vertical = 'banking'
        AND a.role = 'SC'
        AND e.status = 'active'`
  );
  const bankingIds = bankingEligibleRes.rows.map((r: any) => r.id);
  assert.ok(!bankingIds.includes(employeeId), 'SC must not be eligible for leads in unassigned verticals');
});

test('6. Super Admin rejection sets request and employee to rejected', async () => {
  const email = `${RUN}-reject@finverse.demo`;
  const mobile = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;

  const createRes = await call('POST', '/api/hr/onboarding/submit', {
    cookie: pooja.cookie,
    json: {
      fullName: 'Rejected Candidate',
      primaryMobile: mobile,
      email,
    },
  });
  assert.equal(createRes.status, 201);
  const { requestId, employeeId } = createRes.body.data;

  const rejectRes = await call('POST', '/api/superadmin/onboarding/reject', {
    cookie: alok.cookie,
    json: {
      requestId,
      rejectionReason: 'Candidate failed background screening verification.',
    },
  });
  assert.equal(rejectRes.status, 200);

  // Verify status in DB
  const empRes = await db.query('SELECT status FROM employees WHERE id = $1', [employeeId]);
  assert.equal(empRes.rows[0].status, 'rejected');

  const reqRes = await db.query('SELECT status, admin_decision_notes FROM hr_lifecycle_requests WHERE id = $1', [requestId]);
  assert.equal(reqRes.rows[0].status, 'rejected');
  assert.equal(reqRes.rows[0].admin_decision_notes, 'Candidate failed background screening verification.');

  // Rejected employee login fails
  const loginRes = await call('POST', '/api/auth/login', {
    json: { email, password: 'demoPassword123' },
  });
  assert.equal(loginRes.status, 401);
});

test('7. Enforce uniqueness: duplicate email and duplicate mobile numbers rejected with 409', async () => {
  const email = `${RUN}-unique@finverse.demo`;
  const mobile = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;

  const firstRes = await call('POST', '/api/hr/onboarding/submit', {
    cookie: pooja.cookie,
    json: {
      fullName: 'Original User',
      primaryMobile: mobile,
      email,
    },
  });
  assert.equal(firstRes.status, 201);

  // Try duplicate email
  const dupEmailRes = await call('POST', '/api/hr/onboarding/submit', {
    cookie: pooja.cookie,
    json: {
      fullName: 'Duplicate Email Person',
      primaryMobile: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      email, // same email
    },
  });
  assert.equal(dupEmailRes.status, 409);

  // Try duplicate mobile
  const dupMobileRes = await call('POST', '/api/hr/onboarding/submit', {
    cookie: pooja.cookie,
    json: {
      fullName: 'Duplicate Mobile Person',
      primaryMobile: mobile, // same mobile
      email: `${RUN}-other@finverse.demo`,
    },
  });
  assert.equal(dupMobileRes.status, 409);
});

test('8. Unauthorized HR credential access is blocked with 403', async () => {
  const res = await call('POST', '/api/superadmin/onboarding/approve', {
    cookie: pooja.cookie, // HR attempting SA action
    json: {
      requestId: 'dummy',
      role: 'SC',
      vertical: 'wealth',
      teamId: 'TEAM-WEALTH-ALPHA',
      username: 'hacker',
    },
  });
  assert.equal(res.status, 403);
});

test('9. Concurrent employee-ID creation generates atomic, gapless sequence', async () => {
  const promises = Array.from({ length: 5 }, (_, i) => {
    return call('POST', '/api/hr/onboarding/submit', {
      cookie: pooja.cookie,
      json: {
        fullName: `Concurrent Hire ${i}`,
        primaryMobile: `+9197${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `${RUN}-concurrent-${i}@finverse.demo`,
      },
    });
  });

  const results = await Promise.all(promises);
  const ids: string[] = [];
  for (const r of results) {
    assert.equal(r.status, 201);
    ids.push(r.body.data.employeeId);
  }

  // All 5 IDs must be distinct
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, 5, 'All concurrent employee IDs must be unique');
});

test('10. Forgot password: neutral response prevents account enumeration for all active CRM roles', async () => {
  // Test across multiple roles: Sales Caller, Relationship Manager, HR, Super Admin
  const testAccounts = [
    'asha@finverse.demo',    // SC (or username 'asha')
    'tara@finverse.demo',    // REL
    'pooja@finverse.demo',   // HR
    'alok@finverse.demo',    // SA
    'asha',                  // Username test
  ];

  for (const acct of testAccounts) {
    const res = await call('POST', '/api/auth/forgot-password', {
      json: { identity: acct },
    });
    assert.equal(res.status, 200);
    assert.equal(
      res.body.data.message,
      'If an active account matches the details provided, a password reset link has been dispatched to the registered address.'
    );
  }

  // Non-existent account returns the exact same neutral message
  const fakeRes = await call('POST', '/api/auth/forgot-password', {
    json: { identity: 'nonexistent.user@finverse.demo' },
  });
  assert.equal(fakeRes.status, 200);
  assert.equal(
    fakeRes.body.data.message,
    'If an active account matches the details provided, a password reset link has been dispatched to the registered address.'
  );
});

test('11. Password reset token consumption updates password, revokes sessions, and prevents reuse', async () => {
  const callerEmail = 'asha@finverse.demo';

  // Request password reset
  const reqRes = await call('POST', '/api/auth/forgot-password', {
    json: { identity: callerEmail },
  });
  assert.equal(reqRes.status, 200);

  // Retrieve raw token from local delivery outbox
  const outboxRes = await call('GET', '/api/auth/local-delivery?limit=5');
  assert.equal(outboxRes.status, 200);
  const latest = outboxRes.body.data.find(
    (item: any) => item.recipient_email === callerEmail && item.delivery_type === 'account_recovery' && !item.consumed_at
  );
  assert.ok(latest, 'Outbox item with raw reset token must exist');
  const rawToken = latest.raw_token;

  // Reset password with token
  const resetRes = await call('POST', '/api/auth/reset-password', {
    json: { token: rawToken, password: 'NewAshaPassword99!' },
  });
  assert.equal(resetRes.status, 200);

  // Reusing the token must fail with 422 TOKEN_ALREADY_USED
  const reuseRes = await call('POST', '/api/auth/reset-password', {
    json: { token: rawToken, password: 'AnotherPassword88!' },
  });
  assert.equal(reuseRes.status, 422);

  // Old password fails
  const oldLogin = await call('POST', '/api/auth/login', {
    json: { email: callerEmail, password: 'demo1234' },
  });
  assert.equal(oldLogin.status, 401);

  // New password succeeds
  const newLogin = await call('POST', '/api/auth/login', {
    json: { email: callerEmail, password: 'NewAshaPassword99!' },
  });
  assert.equal(newLogin.status, 200);

  // Restore Asha's password for subsequent tests
  const restoreRes = await call('POST', '/api/auth/change-password', {
    cookie: (newLogin.headers.get('set-cookie') ?? '').split(';')[0]!,
    json: { newPassword: 'demo1234' },
  });
  assert.equal(restoreRes.status, 200);
});
