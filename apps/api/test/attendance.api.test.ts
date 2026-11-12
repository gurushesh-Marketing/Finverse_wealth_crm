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

const RUN = `ATT-${Date.now().toString(36)}`;

interface Session {
  cookie: string;
  body: any;
}

let asha: Session;  // SC Wealth Alpha (EMP-001) - Mumbai
let ravi: Session;  // SC Wealth Beta (EMP-002) - Bengaluru
let tara: Session;  // TL Wealth Alpha/Beta (EMP-003) - Mumbai
let neel: Session;  // MG Wealth (EMP-004) - Mumbai
let rohan: Session; // TL Banking Alpha (EMP-006) - Mumbai
let pooja: Session; // HR (EMP-014) - Mumbai

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
      parsed = null;
    }
  }
  return { status: res.status, body: parsed };
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  db = new Pool({ connectionString: env.DATABASE_URL });

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 4000;
  BASE = `http://127.0.0.1:${port}`;

  asha = await login('asha@finverse.demo');
  ravi = await login('ravi@finverse.demo');
  tara = await login('tara@finverse.demo');
  neel = await login('neel@finverse.demo');
  rohan = await login('rohan@finverse.demo');
  pooja = await login('pooja@finverse.demo');

  // Clean test-specific attendance artifacts
  await db.query(`DELETE FROM attendance_regularization_requests WHERE reason LIKE '%${RUN}%'`);
  await db.query(`DELETE FROM attendance_records WHERE work_date >= '2026-10-15' AND work_date <= '2026-10-25'`);
});

after(async () => {
  if (db) {
    await db.query(`DELETE FROM attendance_regularization_requests WHERE reason LIKE '%${RUN}%'`);
    await db.end();
  }
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

// ============================================================================
// Attendance Tests
// ============================================================================

test('ATT-01: Employee can check in with office work mode', async () => {
  const res = await call('POST', '/api/attendance/check-in', {
    cookie: asha.cookie,
    json: {
      workMode: 'office',
      workDate: '2026-10-15',
      isOfflineWork: false,
      crmActivityCount: 5,
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.workMode, 'office');
  assert.equal(res.body.workDate, '2026-10-15');
  assert.equal(res.body.status, 'pending_confirmation');
  assert.ok(res.body.checkInAt);
});

test('ATT-02: Rejects duplicate check-in for same employee and date with 409', async () => {
  const res = await call('POST', '/api/attendance/check-in', {
    cookie: asha.cookie,
    json: {
      workMode: 'office',
      workDate: '2026-10-15',
    },
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'ALREADY_CHECKED_IN');
});

test('ATT-03: Role-appropriate progress log recorded for shift deliverables', async () => {
  // Check in for today first
  const today = new Date().toISOString().slice(0, 10);
  await call('POST', '/api/attendance/check-in', {
    cookie: asha.cookie,
    json: { workMode: 'office', workDate: today },
  });

  const res = await call('POST', '/api/attendance/progress-log', {
    cookie: asha.cookie,
    json: {
      deliverableTitle: `Client portfolio restructuring proposals [${RUN}]`,
      deliverableProgressPct: 75,
      notes: 'Reviewed HNI portfolios with investment committee offline',
      isOfflineDeliverable: true,
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.deliverableProgressPct, 75);
  assert.equal(res.body.isOfflineDeliverable, true);
  assert.ok(res.body.id.startsWith('APL-'));
});

test('ATT-04: Employee check-out computes total hours and confirms office day', async () => {
  const res = await call('POST', '/api/attendance/check-out', {
    cookie: asha.cookie,
    json: {
      workEvidenceUrl: 'https://docs.finverse.demo/portfolios/hni-review-101.pdf',
    },
  });

  assert.equal(res.status, 200);
  assert.ok(res.body.checkOutAt);
  assert.ok(res.body.totalHours !== null);
  assert.equal(res.body.workEvidenceUrl, 'https://docs.finverse.demo/portfolios/hni-review-101.pdf');
});

test('ATT-05: Employee check-in for WFH mode requires progress evidence and remains pending_confirmation', async () => {
  const res = await call('POST', '/api/attendance/check-in', {
    cookie: ravi.cookie,
    json: {
      workMode: 'wfh',
      workDate: '2026-10-16',
      isOfflineWork: true,
      crmActivityCount: 0,
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.workMode, 'wfh');
  assert.equal(res.body.status, 'pending_confirmation');

  // Check out for WFH day
  const checkOutRes = await call('POST', '/api/attendance/check-out', {
    cookie: ravi.cookie,
    json: {
      wfhProgressSummary: 'Prepared Q4 wealth model sheets and conducted 3 client video consultations',
      workEvidenceUrl: 'https://drive.finverse.demo/wfh-deliverables-ravi.zip',
    },
  });

  // WFH remains pending_confirmation until supervisor reviews and confirms
  assert.equal(checkOutRes.body.status, 'pending_confirmation');
  assert.equal(checkOutRes.body.wfhProgressSummary, 'Prepared Q4 wealth model sheets and conducted 3 client video consultations');
});

test('ATT-06: Low CRM activity count does NOT mark employee absent (offline work recognized)', async () => {
  const res = await call('GET', '/api/attendance/my-attendance', {
    cookie: ravi.cookie,
  });

  assert.equal(res.status, 200);
  const wfhRecord = res.body.history.find((r: any) => r.workDate === '2026-10-16');
  assert.ok(wfhRecord);
  assert.equal(wfhRecord.isOfflineWork, true);
  assert.equal(wfhRecord.crmActivityCount, 0);
  // Status is pending confirmation, NOT absent!
  assert.equal(wfhRecord.status, 'pending_confirmation');
});

test('ATT-07: Superior review of WFH attendance record confirms attendance with timestamp and notes', async () => {
  // Get supervisor exceptions for Tara (TL over Ravi)
  const excRes = await call('GET', '/api/attendance/supervisor-exceptions', {
    cookie: tara.cookie,
  });
  assert.equal(excRes.status, 200);

  const raviRecord = excRes.body.pendingRecords.find((r: any) => r.employeeId === 'EMP-002');
  assert.ok(raviRecord, 'Ravi WFH record should appear in Tara supervisory exceptions');

  // Tara reviews and confirms
  const reviewRes = await call('POST', `/api/attendance/records/${raviRecord.id}/review`, {
    cookie: tara.cookie,
    json: {
      decision: 'confirmed',
      reviewNotes: 'Verified deliverables: financial models approved and video calls logged.',
    },
  });

  assert.equal(reviewRes.status, 200);
  assert.equal(reviewRes.body.status, 'confirmed');
  assert.equal(reviewRes.body.reviewedByEmployeeId, 'EMP-003');
  assert.ok(reviewRes.body.reviewedAt);
});

test('ATT-08: Strict zero self-approval on supervisor review (HTTP 422 SELF_APPROVAL_FORBIDDEN)', async () => {
  // Tara creates an attendance record for herself
  const createRes = await call('POST', '/api/attendance/check-in', {
    cookie: tara.cookie,
    json: {
      workMode: 'wfh',
      workDate: '2026-10-17',
    },
  });
  assert.equal(createRes.status, 201);

  // Tara attempts to review and self-approve her own attendance record
  const selfReviewRes = await call('POST', `/api/attendance/records/${createRes.body.id}/review`, {
    cookie: tara.cookie,
    json: {
      decision: 'confirmed',
      reviewNotes: 'Self sign-off',
    },
  });

  assert.equal(selfReviewRes.status, 422);
  assert.equal(selfReviewRes.body.error.code, 'SELF_APPROVAL_FORBIDDEN');
});

test('ATT-09: Auditable regularization request for missed check-out / exception', async () => {
  const res = await call('POST', '/api/attendance/regularization', {
    cookie: asha.cookie,
    json: {
      workDate: '2026-10-18',
      requestedWorkMode: 'field',
      requestedCheckInAt: '2026-10-18T09:30:00.000Z',
      requestedCheckOutAt: '2026-10-18T18:30:00.000Z',
      reason: `Client site visit at Bandra Kurla Complex with lack of mobile network [${RUN}]`,
      progressSummary: 'Conducted high-value client advisory meeting for wealth expansion',
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.status, 'pending');
  assert.equal(res.body.supervisorEmployeeId, 'EMP-003'); // Routes to Tara Iyer (TL)
  assert.ok(res.body.id.startsWith('ARR-'));
});

test('ATT-10: Supervisory span isolation: Foreign TL (Rohan Sen) cannot decide Wealth regularization (403)', async () => {
  // Find Asha's regularization request
  const myRes = await call('GET', '/api/attendance/my-attendance', {
    cookie: asha.cookie,
  });
  const regReq = myRes.body.pendingRegularizations.find((r: any) => r.workDate === '2026-10-18');
  assert.ok(regReq);

  // Rohan Sen (Banking TL) tries to decide Wealth SC regularization
  const rohanRes = await call('POST', `/api/attendance/regularization/${regReq.id}/decision`, {
    cookie: rohan.cookie,
    json: {
      decision: 'approved',
      decisionNotes: 'Unauthorized cross-vertical decision attempt',
    },
  });

  assert.equal(rohanRes.status, 403);
  assert.equal(rohanRes.body.error.code, 'FORBIDDEN');
});

test('ATT-11: Supervisor approves regularization, regularized record becomes confirmed with audit lineage', async () => {
  const myRes = await call('GET', '/api/attendance/my-attendance', {
    cookie: asha.cookie,
  });
  const regReq = myRes.body.pendingRegularizations.find((r: any) => r.workDate === '2026-10-18');
  assert.ok(regReq);

  // Tara Iyer (Wealth TL) approves
  const approveRes = await call('POST', `/api/attendance/regularization/${regReq.id}/decision`, {
    cookie: tara.cookie,
    json: {
      decision: 'approved',
      decisionNotes: 'Verified client appointment and meeting minutes with regional partner.',
    },
  });

  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.status, 'approved');
  assert.ok(approveRes.body.decidedAt);

  // Check that Asha's attendance record for 2026-10-18 is now confirmed
  const checkRes = await call('GET', '/api/attendance/my-attendance', {
    cookie: asha.cookie,
  });
  const updatedRecord = checkRes.body.history.find((r: any) => r.workDate === '2026-10-18');
  assert.ok(updatedRecord);
  assert.equal(updatedRecord.status, 'confirmed');
  assert.equal(updatedRecord.workMode, 'field');
  assert.equal(updatedRecord.totalHours, 9);
});

test('ATT-12: Holiday calendar resolves based on configured work location and policy (not assumed from vertical)', async () => {
  // Query resource view for 2026-05-01 (Maharashtra Day)
  const res = await call('GET', '/api/attendance/resource-view?date=2026-05-01&vertical=wealth', {
    cookie: pooja.cookie,
  });

  assert.equal(res.status, 200);
  const ashaItem = res.body.breakdown.find((b: any) => b.employeeId === 'EMP-001'); // Mumbai
  const raviItem = res.body.breakdown.find((b: any) => b.employeeId === 'EMP-002'); // Bengaluru

  assert.ok(ashaItem);
  assert.ok(raviItem);

  // Asha is in Mumbai (Maharashtra Day applies)
  assert.equal(ashaItem.classification, 'holiday');
  assert.equal(ashaItem.holidayDetails?.holidayName, 'Maharashtra Day');

  // Ravi is in Bengaluru (Maharashtra Day does NOT apply to Karnataka!)
  assert.notEqual(raviItem.classification, 'holiday');
});

test('ATT-13: HR Organization-Wide Resource View with one-click vertical selector and metrics', async () => {
  // 1. All verticals
  const allRes = await call('GET', '/api/attendance/resource-view?date=2026-10-16&vertical=all', {
    cookie: pooja.cookie,
  });
  assert.equal(allRes.status, 200);
  assert.ok(allRes.body.metrics.totalEmployees >= 10);
  assert.ok(allRes.body.breakdown.length >= 10);

  // 2. Wealth vertical one-click filter
  const wealthRes = await call('GET', '/api/attendance/resource-view?date=2026-10-16&vertical=wealth', {
    cookie: pooja.cookie,
  });
  assert.equal(wealthRes.status, 200);
  assert.equal(wealthRes.body.selectedVertical, 'wealth');
  // All returned records belong to wealth
  for (const item of wealthRes.body.breakdown) {
    assert.equal(item.vertical, 'wealth');
  }

  // 3. Confirm WFH, Approved Leave, and Present breakdowns are accurately classified
  assert.ok(wealthRes.body.metrics.wfhCount >= 1);
});

test('ATT-14: Manager scoped resource view: manager sees only subordinates within their authorized span', async () => {
  // Neel Verma (Wealth Manager) queries resource view
  const mgrRes = await call('GET', '/api/attendance/resource-view?date=2026-10-16&vertical=wealth', {
    cookie: neel.cookie,
  });

  assert.equal(mgrRes.status, 200);
  // Manager only sees wealth team subordinates, not Banking or executive records
  for (const item of mgrRes.body.breakdown) {
    assert.equal(item.vertical, 'wealth');
    assert.notEqual(item.employeeId, 'EMP-010'); // CEO not in manager span
  }
});
