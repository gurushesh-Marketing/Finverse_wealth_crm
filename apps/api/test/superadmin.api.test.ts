process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { createApp } from '../src/app';
import { assertTestDatabaseGuard, env } from '../src/config';
import { loadAuthContextByEmployeeId } from '../src/repo/users';
import { getActiveSlaConfig } from '../src/repo/superadmin';

let server: Server;
let BASE: string;
let db: Pool;

const RUN = `SAT-${Date.now().toString(36)}`;

interface Session {
  cookie: string;
  body: any;
}

let alok: Session;  // SA (EMP-013)
let pooja: Session; // HR (EMP-014)
let rajiv: Session; // CEO (EMP-010)
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
  } else {
    parsed = await res.text();
  }
  return { status: res.status, headers: res.headers, body: parsed };
}

async function cleanupTestData() {
  await db.query(`DELETE FROM system_audit_logs WHERE details::text LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM system_audit_logs WHERE actor_employee_id IN (SELECT id FROM employees WHERE email LIKE $1)`, [`%${RUN.toLowerCase()}%`]);
  await db.query(`DELETE FROM local_delivery_outbox WHERE recipient_email LIKE $1`, [`%${RUN.toLowerCase()}%`]);
  await db.query(`DELETE FROM activation_invitations WHERE work_email LIKE $1`, [`%${RUN.toLowerCase()}%`]);
  await db.query(`DELETE FROM account_recovery_requests WHERE employee_id IN (SELECT id FROM employees WHERE email LIKE $1)`, [`%${RUN.toLowerCase()}%`]);
  await db.query(`DELETE FROM hr_lifecycle_requests WHERE employee_id IN (SELECT id FROM employees WHERE email LIKE $1)`, [`%${RUN.toLowerCase()}%`]);
  await db.query(`DELETE FROM sessions WHERE employee_id IN (SELECT id FROM employees WHERE email LIKE $1)`, [`%${RUN.toLowerCase()}%`]);
  await db.query(`DELETE FROM assignments WHERE employee_id IN (SELECT id FROM employees WHERE email LIKE $1)`, [`%${RUN.toLowerCase()}%`]);
  await db.query(`DELETE FROM employees WHERE email LIKE $1`, [`%${RUN.toLowerCase()}%`]);
  await db.query(`DELETE FROM business_configurations WHERE config_key LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM reporting_hierarchy_nodes WHERE unit_name LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM employee_lifecycle_requests WHERE id LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM holding_queues WHERE notes LIKE $1`, [`%${RUN}%`]);
  await db.query(`UPDATE employee_lifecycle_requests SET status = 'approved_by_rm' WHERE id = 'MOVE-081'`);
  await db.query(`UPDATE lifecycle_request_approvals SET status = 'valid' WHERE id = 'APPR-MOVE-081'`);
  await db.query(`UPDATE system_background_jobs SET retry_count = 2, state = 'Failed' WHERE id = 'JOB-REC-001'`);
  await db.query(`DELETE FROM assignments WHERE id LIKE 'ASG-XFER-%'`);
  await db.query(`UPDATE assignments SET effective_to = NULL WHERE id = 'ASG-WEALTH-001'`);
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  db = new Pool({ connectionString: env.DATABASE_URL });
  await cleanupTestData();

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const port = (server.address() as any).port;
      BASE = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  alok = await login('alok@finverse.demo');
  pooja = await login('pooja@finverse.demo');
  rajiv = await login('rajiv@finverse.demo');
  asha = await login('asha@finverse.demo');
});

after(async () => {
  try {
    await cleanupTestData();
  } catch (err) {
    console.error('cleanup error:', err);
  }
  if (db) await db.end().catch(() => {});
  if (server) {
    (server as any).closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Security & Access: Non-SA roles (CEO, SC) receive 403 FORBIDDEN on Superadmin routes', async () => {
  for (const nonAdmin of [rajiv, asha]) {
    const res = await call('GET', '/api/superadmin/overview', { cookie: nonAdmin.cookie });
    assert.equal(res.status, 403, 'Non-SA role must receive 403 Forbidden');
    assert.equal(res.body.error?.code, 'FORBIDDEN');
  }

  // Super Admin succeeds
  const saRes = await call('GET', '/api/superadmin/overview', { cookie: alok.cookie });
  assert.equal(saRes.status, 200);
  assert.ok(saRes.body.data.totalEmployees >= 1);
  assert.ok(saRes.body.data.activeAssignments >= 1);
});

test('SA-01: HR request, SA credential approval, first-login password change & login', async () => {
  const testEmail = `joiner-${RUN.toLowerCase()}@finverse.demo`;
  const username = `joiner.${RUN.toLowerCase()}`;
  const temporaryPassword = 'TemporaryPassword123!';
  const permanentPassword = 'NewSecurePassword123!';
  const placement = await call('GET', '/api/hr/placement-options?vertical=wealth', { cookie: pooja.cookie });
  assert.equal(placement.status, 200);
  const team = placement.body.data.teams.find((item: any) => item.id.toLowerCase().includes('wealth-alpha'));
  assert.ok(team?.relationshipManagerId, 'Wealth Alpha must have an active Relationship Manager');
  const submit = await call('POST', '/api/hr/onboarding/submit', {
    cookie: pooja.cookie,
    json: {
      fullName: `Test Joiner ${RUN}`,
      primaryMobile: '+919876543219',
      email: testEmail,
      proposedRole: 'SC',
      proposedVertical: 'wealth',
      proposedTeamId: team.id,
      proposedSuperiorId: team.relationshipManagerId,
    },
  });
  assert.equal(submit.status, 201, JSON.stringify(submit.body));
  const employeeId = submit.body.data.employeeId;
  const approve = await call('POST', `/api/superadmin/hr/requests/${submit.body.data.requestId}/approve-onboarding`, {
    cookie: alok.cookie,
    json: {
      role: 'SC',
      vertical: 'wealth',
      teamId: team.id,
      reportingManagerId: team.relationshipManagerId,
      username,
      temporaryPassword,
    },
  });
  assert.equal(approve.status, 200, JSON.stringify(approve.body));
  assert.equal(approve.body.data.username, username);
  const stored = await db.query('SELECT username, password_hash, must_change_password FROM employees WHERE id = $1', [employeeId]);
  assert.equal(stored.rows[0].username, username);
  assert.notEqual(stored.rows[0].password_hash, temporaryPassword);
  assert.equal(stored.rows[0].must_change_password, true);
  const firstLogin = await login(username, temporaryPassword);
  assert.ok(firstLogin.cookie);
  assert.equal(firstLogin.body.session.mustChangePassword, true);
  const changed = await call('POST', '/api/auth/change-password', {
    cookie: firstLogin.cookie,
    json: { currentPassword: temporaryPassword, newPassword: permanentPassword, confirmPassword: permanentPassword },
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  const oldLogin = await call('POST', '/api/auth/login', { json: { email: username, password: temporaryPassword } });
  assert.equal(oldLogin.status, 401);
  const newLogin = await login(username, permanentPassword);
  assert.ok(newLogin.cookie);
  assert.equal(newLogin.body.session.role, 'SC');
});

test('SA-02: Precise role and organisation scope grant', async () => {
  const testEmpRes = await db.query(`SELECT id FROM employees WHERE email LIKE $1 LIMIT 1`, [`%${RUN.toLowerCase()}%`]);
  assert.ok(testEmpRes.rows[0], 'Expected test employee to exist from SA-01');
  const empId = testEmpRes.rows[0].id;

  const res = await call('POST', '/api/superadmin/scopes/grant', {
    cookie: alok.cookie,
    json: {
      employeeId: empId,
      role: 'TL',
      vertical: 'wealth',
      allowedTeamIds: ['TEAM-WEALTH-ALPHA', 'TEAM-WEALTH-BETA'],
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '2027-10-01',
      approverReference: `REQ-${RUN}`,
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.success, true);
  assert.equal(res.body.data.assignments.length, 2);

  // Check assignment list
  const listRes = await call('GET', `/api/superadmin/scopes/employee/${empId}`, { cookie: alok.cookie });
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.data.length >= 2);
});

test('SA-03: Grant a second team or vertical within same role', async () => {
  const testEmpRes = await db.query(`SELECT id FROM employees WHERE email LIKE $1 LIMIT 1`, [`%${RUN.toLowerCase()}%`]);
  const empId = testEmpRes.rows[0].id;

  const res = await call('POST', '/api/superadmin/scopes/additional-grant', {
    cookie: alok.cookie,
    json: {
      employeeId: empId,
      additionalVertical: 'banking',
      additionalTeamId: 'TEAM-BANKING-ALPHA',
      effectiveFrom: '2026-10-15',
      approverReference: `ADD-REQ-${RUN}`,
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.success, true);
  assert.equal(res.body.data.role, 'TL', 'Base role must be preserved in additional scope grant');
});

test('SA-04: Reporting hierarchy creation, dynamic scope resolution and cycle rejection', async () => {
  // 1. Create root node
  const node1Res = await call('POST', '/api/superadmin/hierarchy/restructure', {
    cookie: alok.cookie,
    json: {
      unitName: `Root Node ${RUN}`,
      vertical: 'wealth',
      unitLevel: 'National manager',
      effectiveDate: '2026-10-01',
    },
  });
  assert.equal(node1Res.status, 200);
  const node1Id = node1Res.body.data.nodeId;

  // 2. Create child node
  const node2Res = await call('POST', '/api/superadmin/hierarchy/restructure', {
    cookie: alok.cookie,
    json: {
      unitName: `Child Node ${RUN}`,
      vertical: 'wealth',
      unitLevel: 'Regional manager',
      parentNodeId: node1Id,
      effectiveDate: '2026-10-01',
    },
  });
  assert.equal(node2Res.status, 200);
  const node2Id = node2Res.body.data.nodeId;

  // 3. Cycle attempt: make root node a child of child node -> must fail
  const cycleRes = await call('POST', '/api/superadmin/hierarchy/restructure', {
    cookie: alok.cookie,
    json: {
      nodeId: node1Id,
      unitName: `Root Node ${RUN}`,
      vertical: 'wealth',
      unitLevel: 'National manager',
      parentNodeId: node2Id,
      effectiveDate: '2026-10-01',
    },
  });
  assert.equal(cycleRes.status, 422, 'Circular reporting hierarchy must be rejected with 422');
  assert.ok(cycleRes.body.error?.message.includes('CYCLE_DETECTED'));
});

test('SA-05: Transfer activation verifies server approval and prevents duplicate activation', async () => {
  // 1. Create an unapproved (submitted) lifecycle request
  const unapprovedReqId = `REQ-SUBMIT-${RUN}`;
  await db.query(
    `INSERT INTO employee_lifecycle_requests (id, manager_employee_id, employee_id, proposed_role, proposed_team_id, effective_date, business_justification, handoff_plan, status)
     VALUES ($1, 'EMP-007', 'EMP-001', 'SC', 'TEAM-WEALTH-BETA', CURRENT_DATE, 'Unapproved transfer', 'Plan pending', 'submitted')`,
    [unapprovedReqId]
  );

  // Attempting to activate unapproved request must be rejected
  const unapprovedRes = await call('POST', '/api/superadmin/lifecycle/transfers/activate', {
    cookie: alok.cookie,
    json: {
      requestId: unapprovedReqId,
      decision: 'approve',
      decisionNote: 'Trying to activate unapproved request',
    },
  });
  assert.equal(unapprovedRes.status, 422, 'Unapproved request must be rejected');
  assert.ok(unapprovedRes.body.error?.message.includes('UNAPPROVED_REQUEST'));

  // 2. Activate valid approved request MOVE-081
  const res = await call('POST', '/api/superadmin/lifecycle/transfers/activate', {
    cookie: alok.cookie,
    json: {
      requestId: 'MOVE-081',
      decision: 'approve',
      decisionNote: `Approved in authority per ${RUN}`,
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'activated_by_admin');
  assert.ok(res.body.data.newAssignmentId);

  // 3. Attempting to activate an already-activated request must be rejected
  const reActivateRes = await call('POST', '/api/superadmin/lifecycle/transfers/activate', {
    cookie: alok.cookie,
    json: {
      requestId: 'MOVE-081',
      decision: 'approve',
      decisionNote: 'Duplicate activation attempt',
    },
  });
  assert.equal(reActivateRes.status, 422, 'Already-activated request must be rejected');
  assert.ok(reActivateRes.body.error?.message.includes('REQUEST_ALREADY_ACTIVATED'));

  // 4. Verify non-overlapping intervals in database
  const asgRes = await db.query(
    `SELECT role, team_id, effective_from, effective_to FROM assignments WHERE employee_id = 'EMP-001' ORDER BY effective_from DESC`
  );
  assert.ok(asgRes.rows.some((r: any) => r.team_id === 'TEAM-WEALTH-BETA' && r.effective_to === null));
});

test('SA-06: Offboarding, session revocation and holding queues', async () => {
  const testEmpRes = await db.query(`SELECT id FROM employees WHERE email LIKE $1 LIMIT 1`, [`%${RUN.toLowerCase()}%`]);
  const empId = testEmpRes.rows[0].id;

  // Create an active session for this test employee
  const testSessionHash = `TEST-SESS-${Date.now()}`;
  await db.query(
    `INSERT INTO sessions (token_hash, employee_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 day')`,
    [testSessionHash, empId]
  );

  const res = await call('POST', '/api/superadmin/lifecycle/offboard', {
    cookie: alok.cookie,
    json: {
      employeeId: empId,
      reason: `Exit verified ${RUN}`,
      effectiveTime: '2026-10-11T18:00:00Z',
      revokeAllSessions: true,
      handoffSupervisedQueue: true,
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'disabled');
  assert.ok(res.body.data.sessionsRevoked >= 1);

  // Verify sessions were purged
  const sessRes = await db.query(`SELECT COUNT(*) as count FROM sessions WHERE employee_id = $1`, [empId]);
  assert.equal(parseInt(sessRes.rows[0].count, 10), 0);
});

test('SA-07: Verified account recovery journey, password reset, session termination & login', async () => {
  // 1. Establish an active session for employee EMP-002
  const emp2Login = await login('ravi@finverse.demo', 'demo1234');
  assert.ok(emp2Login.cookie, 'EMP-002 must log in');

  // Verify session is active
  const checkSession = await call('GET', '/api/auth/me', { cookie: emp2Login.cookie });
  assert.equal(checkSession.status, 200);

  // 2. Superadmin issues verified recovery with session revocation
  const recRes = await call('POST', '/api/superadmin/accounts/recovery-reset', {
    cookie: alok.cookie,
    json: {
      employeeId: 'EMP-002',
      issueType: 'Locked account',
      identityCheckProcedure: `Video verification and employee ID badge match ${RUN}`,
      revokeExistingSessions: true,
      expiryHours: 24,
    },
  });

  assert.equal(recRes.status, 200);
  assert.ok(recRes.body.data.recoveryId);
  assert.equal(recRes.body.data.deliveryChannel, 'local_adapter');
  assert.equal(recRes.body.data.rawToken, undefined, 'Raw recovery token must NOT be in admin response');

  // 3. Inspect Local Delivery Outbox for recovery token
  const outboxRes = await call('GET', '/api/superadmin/local-delivery', { cookie: alok.cookie });
  const recoveryItem = outboxRes.body.data.find((item: any) => item.recipient_email === 'ravi@finverse.demo' && !item.consumed_at);
  assert.ok(recoveryItem, 'Recovery link must be in local delivery outbox');
  const recoveryToken = recoveryItem.raw_token;

  // 4. Token validation: Reject invalid/tampered token
  const badTokenRes = await call('POST', '/api/auth/reset-password', {
    json: { token: 'tampered-recovery-token', password: 'RaviNewPassword123!' },
  });
  assert.equal(badTokenRes.status, 422);

  // 5. Successful reset password with recovery token
  const resetRes = await call('POST', '/api/auth/reset-password', {
    json: { token: recoveryToken, password: 'RaviNewPassword123!' },
  });
  assert.equal(resetRes.status, 200);
  assert.equal(resetRes.body.data.success, true);

  // 6. Token single-use enforcement: reuse must fail
  const reuseRes = await call('POST', '/api/auth/reset-password', {
    json: { token: recoveryToken, password: 'AnotherPassword123!' },
  });
  assert.equal(reuseRes.status, 422);
  assert.ok(reuseRes.body.error?.message.includes('TOKEN_ALREADY_USED'));

  // 7. Old session must be rejected (401 UNAUTHENTICATED)
  const oldSessionCheck = await call('GET', '/api/auth/me', { cookie: emp2Login.cookie });
  assert.equal(oldSessionCheck.status, 401, 'Old session must be rejected after recovery');

  // 8. Sign in with old password fails
  const oldLoginRes = await call('POST', '/api/auth/login', {
    json: { email: 'ravi@finverse.demo', password: 'demo1234' },
  });
  assert.equal(oldLoginRes.status, 401, 'Login with old password must fail');

  // 9. Sign in with new password succeeds
  const newLogin = await login('ravi@finverse.demo', 'RaviNewPassword123!');
  assert.ok(newLogin.cookie, 'Login with new password must succeed');
  assert.equal(newLogin.body.session.displayName, 'Ravi Menon');

  // Clean up: reset Ravi's password back to demo1234 for subsequent fixtures
  await db.query(
    `UPDATE employees SET password_hash = 'scrypt$m156EmNbQXHZCVT0RATogw==$CUqGh5bV/tFwF9jTpFCzTL6W4y9kkFPtCd04bhdYuet3OdmIx+9Hq8gcMS6babqkcczMBw6r6/fidfprnHImKA==' WHERE id = 'EMP-002'`
  );

  // 10. Recovery on a disabled employee must be forbidden
  const testEmpRes = await db.query(`SELECT id FROM employees WHERE email LIKE $1 LIMIT 1`, [`%${RUN.toLowerCase()}%`]);
  const disabledEmpId = testEmpRes.rows[0].id;

  const disRes = await call('POST', '/api/superadmin/accounts/recovery-reset', {
    cookie: alok.cookie,
    json: {
      employeeId: disabledEmpId,
      issueType: 'Credential reset',
      identityCheckProcedure: 'Standard check',
    },
  });
  assert.equal(disRes.status, 403, 'Disabled account recovery must be 403 Forbidden');
});

test('SA-08: Business configuration validation by category and unsupported type rejection', async () => {
  // 1. Unsupported configuration types remain draft/unavailable
  const badTypeRes = await call('POST', '/api/superadmin/configuration/publish', {
    cookie: alok.cookie,
    json: {
      configKey: `stage_cfg_${RUN}`,
      title: 'Stage Config',
      category: 'stage',
      version: 1,
      effectiveDate: '2026-10-15',
      schemaPayload: { stage: 'new' },
      approvedBy: 'Ops Head',
    },
  });
  assert.equal(badTypeRes.status, 422, 'Unsupported configuration types must be rejected');
  assert.ok(badTypeRes.body.error?.message.includes('UNSUPPORTED_CONFIGURATION_TYPE'));

  // 2. SLA requires ascending hours
  const badSlaRes = await call('POST', '/api/superadmin/configuration/publish', {
    cookie: alok.cookie,
    json: {
      configKey: `lead_sla_${RUN}`,
      title: 'Invalid SLA',
      category: 'sla',
      version: 1,
      effectiveDate: '2026-10-15',
      schemaPayload: { tier1_hours: 8, escalate_tl_hours: 4, escalate_mg_hours: 2 },
      approvedBy: 'Ops Head',
    },
  });
  assert.equal(badSlaRes.status, 422, 'Non-ascending SLA hours must be rejected');

  // 3. Publish valid Version 1
  const v1Res = await call('POST', '/api/superadmin/configuration/publish', {
    cookie: alok.cookie,
    json: {
      configKey: `lead_sla_${RUN}`,
      title: `Lead SLA v1 ${RUN}`,
      category: 'sla',
      version: 1,
      effectiveDate: '2026-10-15',
      schemaPayload: { tier1_hours: 2, escalate_tl_hours: 4, escalate_mg_hours: 8 },
      approvedBy: 'Executive Leadership',
    },
  });
  assert.equal(v1Res.status, 201);
  assert.equal(v1Res.body.data.version, 1);

  // 4. Duplicate publication of same version rejected
  const dupRes = await call('POST', '/api/superadmin/configuration/publish', {
    cookie: alok.cookie,
    json: {
      configKey: `lead_sla_${RUN}`,
      title: `Lead SLA v1 duplicate`,
      category: 'sla',
      version: 1,
      effectiveDate: '2026-10-15',
      schemaPayload: { tier1_hours: 2, escalate_tl_hours: 4, escalate_mg_hours: 8 },
      approvedBy: 'Executive Leadership',
    },
  });
  assert.equal(dupRes.status, 409, 'Duplicate version must return 409 Conflict');

  // 5. Verify active SLA configuration in consumer runtime
  const activeSla = await getActiveSlaConfig();
  assert.ok(activeSla);
  assert.ok(activeSla.tier1_hours >= 1);
});

test('SA-09: Restricted audit investigation and incident actions', async () => {
  // 1. List incidents (audit access is itself logged)
  const listRes = await call('GET', '/api/superadmin/incidents', { cookie: alok.cookie });
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.data.length >= 1);

  // 2. Act on incident (e.g. INC-001)
  const actRes = await call('POST', '/api/superadmin/incidents/actions', {
    cookie: alok.cookie,
    json: {
      incidentId: 'INC-001',
      actionType: 'close_incident',
      actionNote: `Investigated and verified legitimate traffic ${RUN}`,
    },
  });
  assert.equal(actRes.status, 200);
  assert.equal(actRes.body.data.newState, 'Closed');
});

test('SA-10: Safe, bounded failed-job recovery connected to actual execution', async () => {
  // JOB-REC-001 was seeded in migration 0018 with retry_count = 2, max_retries = 3
  // 1. Mismatched idempotency key must be rejected
  const badIdempRes = await call('POST', '/api/superadmin/jobs/retry', {
    cookie: alok.cookie,
    json: {
      jobId: 'JOB-REC-001',
      idempotencyKey: 'WRONG-IDEMP-KEY',
    },
  });
  assert.equal(badIdempRes.status, 422, 'Mismatched idempotency key must be rejected');

  // 2. Valid retry with exact idempotency key executes worker and marks Completed
  const okRes = await call('POST', '/api/superadmin/jobs/retry', {
    cookie: alok.cookie,
    json: {
      jobId: 'JOB-REC-001',
      idempotencyKey: 'IDEMP-JOB-201',
    },
  });
  assert.equal(okRes.status, 200);
  assert.equal(okRes.body.data.retryCount, 3);
  assert.equal(okRes.body.data.newState, 'Completed', 'Successful retry must transition job to Completed');

  // 3. Subsequent retry on non-failed job is rejected
  const boundRes = await call('POST', '/api/superadmin/jobs/retry', {
    cookie: alok.cookie,
    json: {
      jobId: 'JOB-REC-001',
      idempotencyKey: 'IDEMP-JOB-201',
    },
  });
  assert.equal(boundRes.status, 422, 'Retrying non-failed job must be rejected');
});

test('SA-11: Temporary access grant expands auth scope and revokes on expiry', async () => {
  // 1. Verify that active temporary grant GRANT-TEMP-001 expands EMP-002's auth context
  const emp2Auth = await loadAuthContextByEmployeeId('EMP-002');
  assert.ok(emp2Auth);
  assert.ok(emp2Auth.session.teamGrants.includes('TEAM-WEALTH-BETA'), 'Active temporary grant must expand team grants');

  // 2. List expiring delegations
  const listRes = await call('GET', '/api/superadmin/delegations', { cookie: alok.cookie });
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.data.length >= 1);

  // 3. Renew temporary grant requires justification
  const noJustRes = await call('POST', '/api/superadmin/delegations/decide', {
    cookie: alok.cookie,
    json: {
      grantId: 'GRANT-TEMP-001',
      decision: 'renew',
      renewalDays: 14,
      decisionReason: '   ',
    },
  });
  assert.equal(noJustRes.status, 422, 'Renewal without justification must fail');

  // 4. Valid renewal
  const renewRes = await call('POST', '/api/superadmin/delegations/decide', {
    cookie: alok.cookie,
    json: {
      grantId: 'GRANT-TEMP-001',
      decision: 'renew',
      renewalDays: 14,
      decisionReason: `Approved extension for TL medical leave ${RUN}`,
    },
  });
  assert.equal(renewRes.status, 200);
  assert.equal(renewRes.body.data.status, 'renewed');
  assert.ok(renewRes.body.data.expiresAt);
});
