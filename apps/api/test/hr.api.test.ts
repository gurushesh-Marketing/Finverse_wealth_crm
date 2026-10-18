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

const RUN = `HRT-${Date.now().toString(36)}`;

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
  } else if (contentType.includes('application/pdf')) {
    const arrayBuffer = await res.arrayBuffer();
    parsed = Buffer.from(arrayBuffer);
  } else {
    parsed = await res.text();
  }
  return { status: res.status, headers: res.headers, body: parsed };
}

async function cleanupTestData() {
  await db.query(`DELETE FROM lifecycle_request_approvals WHERE verification_notes LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM people_report_schedules WHERE id LIKE 'SCHED-HR-%' AND created_at > now() - interval '2 hours'`);
  await db.query(`DELETE FROM people_operations_reports WHERE id LIKE 'HR-REP-%' AND created_at > now() - interval '2 hours'`);
  await db.query(`DELETE FROM employee_leaves WHERE coverage_notes LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM hr_lifecycle_requests WHERE approvals_summary LIKE $1 OR handoff_plan LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM employee_lifecycle_requests WHERE business_justification LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM assignments WHERE employee_id IN (SELECT id FROM employees WHERE email LIKE $1)`, [`%${RUN.toLowerCase()}%`]);
  await db.query(`DELETE FROM assignments WHERE id LIKE 'ASG-XFER-%'`);
  await db.query(`UPDATE assignments SET effective_to = NULL WHERE id = 'ASG-WEALTH-001'`);
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
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      BASE = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  // Login sessions
  pooja = await login('pooja@finverse.demo');
  alok = await login('alok@finverse.demo');
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
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('HR-00: RBAC security and role gating for HR workspace endpoints', async () => {
  // 1. Unauthenticated request -> 401
  const unauth = await call('GET', '/api/hr/overview');
  assert.equal(unauth.status, 401, 'Unauthenticated user must be rejected with 401');

  // 2. Non-HR role (SC asha) -> 403
  const forbiddenSc = await call('GET', '/api/hr/overview', { cookie: asha.cookie });
  assert.equal(forbiddenSc.status, 403, 'SC role must be forbidden from HR endpoints');

  // 3. Non-HR role (SA alok) -> 403
  const forbiddenSa = await call('GET', '/api/hr/overview', { cookie: alok.cookie });
  assert.equal(forbiddenSa.status, 403, 'SA role must be forbidden from HR endpoints');

  // 4. Authorized HR role (pooja) -> 200
  const authorized = await call('GET', '/api/hr/overview', { cookie: pooja.cookie });
  assert.equal(authorized.status, 200, 'HR role must be authorized');
  assert.ok(authorized.body.data.activeHeadcount !== undefined, 'Overview activeHeadcount must be returned');
});

test('HR-01: Request a new employee account (Joiners) & duplicate prevention', async () => {
  const joinerEmail = `newjoiner.${RUN.toLowerCase()}@finverse.demo`;

  // 1. Valid Joiner Request
  const createRes = await call('POST', '/api/hr/accounts/request', {
    cookie: pooja.cookie,
    json: {
      employeeName: `Test Joiner ${RUN}`,
      workEmail: joinerEmail,
      employmentType: 'permanent',
      proposedRole: 'SC',
      vertical: 'wealth',
      teamId: 'TEAM-WEALTH-ALPHA',
      supervisorEmployeeId: 'EMP-003',
      startDate: '2026-11-01',
      requiredTraining: 'Finverse Wealth Onboarding & Conduct Rules',
      approvalsSummary: `Approved by Business Head ${RUN}`,
      notes: `Hiring cohort expansion ${RUN}`,
    },
  });
  assert.equal(createRes.status, 201, 'Joiner request should create with 201');
  assert.ok(createRes.body.data.requestId, 'RequestId must be returned');
  assert.equal(createRes.body.data.status, 'submitted');

  // 2. Duplicate Account Submission -> 409 Conflict
  const dupRes = await call('POST', '/api/hr/accounts/request', {
    cookie: pooja.cookie,
    json: {
      employeeName: `Test Joiner ${RUN}`,
      workEmail: joinerEmail,
      employmentType: 'permanent',
      proposedRole: 'SC',
      vertical: 'wealth',
      teamId: 'TEAM-WEALTH-ALPHA',
      supervisorEmployeeId: 'EMP-003',
      startDate: '2026-11-01',
      requiredTraining: 'Finverse Wealth Onboarding',
      approvalsSummary: `Approved by Business Head ${RUN}`,
      notes: `Duplicate submission attempt ${RUN}`,
    },
  });
  assert.equal(dupRes.status, 409, 'Duplicate joiner email request must return 409 Conflict');

  // 3. Verify request appears in HR request tracker
  const hrRequestsList = await call('GET', '/api/hr/requests', { cookie: pooja.cookie });
  assert.equal(hrRequestsList.status, 200);
  const foundJoiner = hrRequestsList.body.data.find((r: any) => r.id === createRes.body.data.requestId);
  assert.ok(foundJoiner, 'Joiner request must appear in HR requests list');
});

test('HR-02: Request team transfer, verify approval gap closure, parameter invalidation and SA activation', async () => {
  // 1. Invalid employee -> 404 Not Found
  const invalidEmp = await call('POST', '/api/hr/transfers/request', {
    cookie: pooja.cookie,
    json: {
      employeeId: 'EMP-999-DOES-NOT-EXIST',
      newVertical: 'banking',
      newTeamId: 'TEAM-BANKING-ALPHA',
      effectiveDate: '2026-11-15',
      effectiveTime: '09:00 IST',
      namedHandoffOwners: 'Handed to EMP-002',
      businessJustification: `Invalid employee test ${RUN}`,
      approvalsSummary: `Regional Head approval ${RUN}`,
    },
  });
  assert.equal(invalidEmp.status, 404, 'Non-existent employee transfer must return 404');

  // Check 1: Text alone cannot approve a request
  const transferRes = await call('POST', '/api/hr/transfers/request', {
    cookie: pooja.cookie,
    json: {
      employeeId: 'EMP-001',
      newVertical: 'wealth',
      newTeamId: 'TEAM-WEALTH-BETA',
      effectiveDate: '2026-11-15',
      effectiveTime: '09:00 IST',
      namedHandoffOwners: 'Portfolios transferred to EMP-002',
      businessJustification: `Branch balancing transfer ${RUN}`,
      approvalsSummary: `Approved by Vikram Seth (TL) & Kavita Rao (RM) ${RUN}`,
    },
  });
  assert.equal(transferRes.status, 201, 'Valid transfer request must create with 201');
  const reqId = transferRes.body.data.requestId;
  assert.ok(reqId);
  assert.equal(transferRes.body.data.status, 'submitted', 'Check 1: Free text approvalsSummary alone must leave status in submitted state');

  // Check 2: An unapproved request cannot be activated by Superadmin
  const saTransfers = await call('GET', '/api/superadmin/lifecycle/transfers', { cookie: alok.cookie });
  assert.equal(saTransfers.status, 200);
  const foundInSa = saTransfers.body.data.find((t: any) => t.id === reqId);
  assert.ok(foundInSa, 'Transfer must appear in Superadmin queue');
  assert.equal(foundInSa.status, 'submitted', 'Superadmin queue must show submitted status');

  const unapprovedExec = await call('POST', '/api/superadmin/lifecycle/transfers/activate', {
    cookie: alok.cookie,
    json: {
      requestId: reqId,
      decision: 'approve',
      decisionNote: `Premature activation attempt ${RUN}`,
    },
  });
  assert.equal(unapprovedExec.status, 422, 'Check 2: Unapproved request cannot be activated');
  assert.ok(unapprovedExec.body.error?.message.includes('UNAPPROVED_REQUEST'));

  // Check 3: Authorized approval permits activation at the valid boundary
  const approveRes = await call('POST', `/api/hr/requests/${reqId}/approve`, {
    cookie: pooja.cookie,
    json: {
      approvalType: 'authorized_leader',
      approverEmployeeId: 'EMP-008', // Kavita Rao, RM
      verificationNotes: `Verified written authorization signed by Regional Manager Kavita Rao ${RUN}`,
    },
  });
  assert.equal(approveRes.status, 200, 'Attaching genuine approval must succeed');
  assert.equal(approveRes.body.data.status, 'approved', 'Status must transition to approved');

  // Check 4: Editing approved details requires renewed approval (invalidation on mutation)
  const editRes = await call('PATCH', `/api/hr/requests/${reqId}`, {
    cookie: pooja.cookie,
    json: {
      newTeamId: 'TEAM-WEALTH-ALPHA', // Mutating destination team
      effectiveDate: '2026-11-20',
    },
  });
  assert.equal(editRes.status, 200, 'Patching request details must succeed');
  assert.equal(editRes.body.data.status, 'submitted', 'Mutating request details must revert status to submitted');
  assert.equal(editRes.body.data.approvalInvalidated, true, 'Prior approval must be invalidated');
  assert.equal(editRes.body.data.requestVersion, 2, 'Request version must increment to 2');

  // Activation blocked again because previous approval was invalidated!
  const blockedExec = await call('POST', '/api/superadmin/lifecycle/transfers/activate', {
    cookie: alok.cookie,
    json: {
      requestId: reqId,
      decision: 'approve',
      decisionNote: `Attempt activation after detail mutation ${RUN}`,
    },
  });
  assert.equal(blockedExec.status, 422, 'Mutated request without renewed approval must be blocked');
  assert.ok(blockedExec.body.error?.message.includes('UNAPPROVED_REQUEST'));

  // Renew approval for the modified request (version 2)
  const renewApprRes = await call('POST', `/api/hr/requests/${reqId}/approve`, {
    cookie: pooja.cookie,
    json: {
      approvalType: 'authorized_leader',
      approverEmployeeId: 'EMP-008',
      verificationNotes: `Renewed approval for revised placement to Wealth Alpha ${RUN}`,
    },
  });
  assert.equal(renewApprRes.status, 200);
  assert.equal(renewApprRes.body.data.status, 'approved');

  // Now Superadmin activation succeeds at the valid boundary
  const execRes = await call('POST', '/api/superadmin/lifecycle/transfers/activate', {
    cookie: alok.cookie,
    json: {
      requestId: reqId,
      decision: 'approve',
      decisionNote: `Approved and activated by SA ${RUN}`,
    },
  });
  assert.equal(execRes.status, 200, 'Check 3: Authorized approval permits activation at valid boundary');
  assert.equal(execRes.body.data.status, 'activated_by_admin');

  // Check 5: HR's tracker reflects the resulting Superadmin action
  const hrRequests = await call('GET', '/api/hr/requests', { cookie: pooja.cookie });
  assert.equal(hrRequests.status, 200);
  const executedReq = hrRequests.body.data.find((r: any) => r.id === reqId);
  assert.ok(executedReq);
  assert.equal(executedReq.status, 'activated_by_admin', 'Check 5: HR tracker must reflect activated_by_admin');
});

test('HR-03: Request promotion with and without verified approval', async () => {
  // 1. Text alone -> status submitted
  const promoRes1 = await call('POST', '/api/hr/promotions/request', {
    cookie: pooja.cookie,
    json: {
      employeeId: 'EMP-001',
      newRole: 'TL',
      newVertical: 'wealth',
      newTeamId: 'TEAM-WEALTH-ALPHA',
      effectiveDate: '2026-12-01',
      effectiveTime: '09:00 IST',
      reportingScope: 'Sub-team Wealth Alpha 1',
      oldWorkloadTreatment: 'Reassign 50% accounts to junior SC',
      businessJustification: `Annual performance promotion ${RUN}`,
      approvalsSummary: `Approved by National Head & HR Director ${RUN}`,
    },
  });
  assert.equal(promoRes1.status, 201, 'Promotion request must create with 201');
  assert.ok(promoRes1.body.data.requestId);
  assert.equal(promoRes1.body.data.status, 'submitted', 'Text alone leaves status submitted');

  // 2. Promotion with verified external authorization document -> status approved
  const promoRes2 = await call('POST', '/api/hr/promotions/request', {
    cookie: pooja.cookie,
    json: {
      employeeId: 'EMP-002',
      newRole: 'TL',
      newVertical: 'wealth',
      newTeamId: 'TEAM-WEALTH-BETA',
      effectiveDate: '2026-12-01',
      effectiveTime: '09:00 IST',
      reportingScope: 'Wealth Beta advisory group',
      oldWorkloadTreatment: 'Client accounts reallocated',
      businessJustification: `Promotion with board signoff ${RUN}`,
      approvalsSummary: `Executive board promotion resolution ${RUN}`,
      verifiedApproval: {
        approvalType: 'verified_external_document',
        externalReference: `DOC-BOARD-PROM-2026-${RUN}`,
        verificationNotes: `Executive board appointment resolution archived by HR ${RUN}`,
      },
    },
  });
  assert.equal(promoRes2.status, 201);
  assert.equal(promoRes2.body.data.status, 'approved', 'Linked verified approval sets status to approved');
  assert.ok(promoRes2.body.data.approvalId);
});

test('HR-04: Coordinate employee exit and handover', async () => {
  const exitRes = await call('POST', '/api/hr/exits/coordinate', {
    cookie: pooja.cookie,
    json: {
      employeeId: 'EMP-001',
      exitDate: '2026-12-31',
      exitTime: '18:00 IST',
      approvalsSummary: `Acknowledged by Team Lead & HR Ops ${RUN}`,
      openWorkHandoff: 'Documented client books and trading authorizations handed over',
      replacementPlan: 'Handover to EMP-002 (Senior Consultant)',
      accessRevocationSchedule: 'scheduled_end_of_day',
    },
  });
  assert.equal(exitRes.status, 201, 'Exit request must create with 201');
  assert.ok(exitRes.body.data.requestId);
  assert.equal(exitRes.body.data.status, 'submitted');
});

test('HR-05: Record leave and allocation availability', async () => {
  // 1. Invalid date range (end_date < start_date) -> 422
  const invalidLeave = await call('POST', '/api/hr/leaves', {
    cookie: pooja.cookie,
    json: {
      employeeId: 'EMP-001',
      absenceType: 'annual_leave',
      startDate: '2026-11-20',
      endDate: '2026-11-10', // Before start
      coverageOwnerRole: 'Senior Consultant',
      coverageEmployeeId: 'EMP-002',
      allocationStatus: 'unavailable',
      notes: `Invalid leave date test ${RUN}`,
      leadsReassignmentConfirmed: false,
    },
  });
  assert.equal(invalidLeave.status, 422, 'Invalid date range must return 422');

  // 2. Valid Leave creation
  const validLeave = await call('POST', '/api/hr/leaves', {
    cookie: pooja.cookie,
    json: {
      employeeId: 'EMP-001',
      absenceType: 'annual_leave',
      startDate: '2026-11-10',
      endDate: '2026-11-20',
      coverageOwnerRole: 'Senior Consultant',
      coverageEmployeeId: 'EMP-002',
      allocationStatus: 'unavailable',
      notes: `Annual leave coverage test ${RUN}`,
      leadsReassignmentConfirmed: true,
    },
  });
  assert.equal(validLeave.status, 201, 'Valid leave record must return 201');
  assert.ok(validLeave.body.data.leaveId);

  // 3. Retrieve leaves list
  const leavesList = await call('GET', '/api/hr/leaves', { cookie: pooja.cookie });
  assert.equal(leavesList.status, 200);
  const foundLeave = leavesList.body.data.find((l: any) => l.id === validLeave.body.data.leaveId);
  assert.ok(foundLeave, 'Created leave must be present in leaves list');
  assert.equal(foundLeave.allocation_status, 'unavailable');
});

test('HR-06: Track probation, training and review completion', async () => {
  // 1. Retrieve milestones
  const milestonesRes = await call('GET', '/api/hr/milestones', { cookie: pooja.cookie });
  assert.equal(milestonesRes.status, 200);
  assert.ok(Array.isArray(milestonesRes.body.data));
  assert.ok(milestonesRes.body.data.length > 0, 'Baseline fixtures must provide milestones');

  const targetMilestone = milestonesRes.body.data[0];

  // 2. Update milestone
  const updateRes = await call('POST', '/api/hr/milestones/update', {
    cookie: pooja.cookie,
    json: {
      milestoneId: targetMilestone.id,
      status: 'completed',
      decisionAction: 'confirm_permanent',
      evidenceSummary: `Certifications verified by HR Ops ${RUN}`,
      supervisorNotes: 'Exceeds expectations in client relationship management',
    },
  });
  assert.equal(updateRes.status, 200, 'Milestone update must return 200');
  assert.equal(updateRes.body.data.status, 'completed');

  // 3. Verify employee role is NOT modified by training milestone update (Invariant: training does not grant permissions)
  const empCheck = await db.query(`SELECT role FROM assignments WHERE employee_id = $1`, [targetMilestone.employee_id]);
  assert.ok(empCheck.rows.length > 0);
  assert.notEqual(empCheck.rows[0].role, 'SA', 'Training milestone must never elevate permissions');
});

test('HR-07: Prepare people operations pack, schedule and stream PDF', async () => {
  // 1. Generate Report Pack
  const reportRes = await call('POST', '/api/hr/reports/generate', {
    cookie: pooja.cookie,
    json: {
      periodLabel: '2026-Q4',
      workforceScope: 'wealth',
      sections: ['joiners', 'movers', 'leavers', 'reviews', 'availability'],
      sensitiveFieldsRestricted: true,
      notes: `Automated test run ${RUN}`,
    },
  });
  assert.equal(reportRes.status, 201, 'Report generation must return 201');
  const reportData = reportRes.body.data;
  assert.ok(reportData.reportId);
  assert.ok(reportData.filename);

  // 2. Stream Binary PDF Download
  const downloadRes = await call('GET', `/api/hr/reports/download/${reportData.filename}`, { cookie: pooja.cookie });
  assert.equal(downloadRes.status, 200, 'PDF download should return 200');
  assert.equal(downloadRes.headers.get('content-type'), 'application/pdf');
  const pdfBuffer = downloadRes.body as Buffer;
  assert.ok(pdfBuffer.length > 500, 'PDF buffer must contain binary content');
  assert.equal(pdfBuffer.subarray(0, 4).toString(), '%PDF', 'Binary must begin with %PDF header');

  // 3. Create Report Schedule
  const schedRes = await call('POST', '/api/hr/reports/schedules', {
    cookie: pooja.cookie,
    json: {
      frequency: 'weekly',
      workforceScope: 'wealth',
      recipientEmails: ['pooja@finverse.demo', 'kavita@finverse.demo'],
      sections: ['joiners', 'movers', 'leavers'],
    },
  });
  assert.equal(schedRes.status, 201, 'Schedule creation must return 201');
  assert.ok(schedRes.body.data.scheduleId);

  // 4. Retrieve Schedules List
  const listSched = await call('GET', '/api/hr/reports/schedules', { cookie: pooja.cookie });
  assert.equal(listSched.status, 200);
  assert.ok(listSched.body.data.some((s: any) => s.id === schedRes.body.data.scheduleId));
});
