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

const RUN = `PAY-${Date.now().toString(36)}`;

interface Session {
  cookie: string;
  body: any;
}

let pooja: Session; // HR (EMP-014) - Authorized
let ananya: Session; // CFO (EMP-011) - Authorized
let asha: Session;  // SC Wealth (EMP-001) - Unauthorized
let tara: Session;  // TL Wealth (EMP-003) - Unauthorized
let dev: Session;   // Caller Banking (EMP-004) - Joined 10 Jan 2026

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

  // Ensure Dev Kapoor (EMP-004) has joining date 2026-01-10
  await db.query(`UPDATE employees SET joining_date = '2026-01-10' WHERE id = 'EMP-004'`);

  // Clean up any test runs for EMP-001
  await db.query(`DELETE FROM compensation_change_logs WHERE employee_id = 'EMP-001' AND reason LIKE 'PAY-%'`);
  await db.query(`DELETE FROM employee_compensation_plans WHERE employee_id = 'EMP-001' AND effective_from >= '2026-02-01'`);

  // Ensure compensation plans exist
  await db.query(`
    INSERT INTO employee_compensation_plans (
      id, employee_id, effective_from, currency, monthly_ctc, basic_pay, hra, special_allowance,
      statutory_pf_employee, statutory_pf_employer, professional_tax, tds_estimate, created_by_employee_id
    ) VALUES 
      ('PLAN-TEST-EMP-004', 'EMP-004', '2026-01-10', 'INR', 75000, 37500, 18750, 18750, 1800, 1800, 200, 2000, 'EMP-014'),
      ('PLAN-TEST-EMP-001', 'EMP-001', '2026-01-01', 'INR', 80000, 40000, 20000, 20000, 1800, 1800, 200, 2500, 'EMP-014')
    ON CONFLICT (id) DO UPDATE SET effective_to = NULL;
  `);

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      BASE = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  pooja = await login('pooja@finverse.demo');
  ananya = await login('ananya@finverse.demo');
  asha = await login('asha@finverse.demo');
  tara = await login('tara@finverse.demo');
  dev = await login('dev@finverse.demo');
});

after(async () => {
  await db?.end();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

// ============================================================================
// 1. Authorization & Strict Compensation Privacy
// ============================================================================

test('Check 1: Frontline sales caller (SC) cannot view compensation plans (403 FORBIDDEN)', async () => {
  const res = await call('GET', '/api/payroll/compensation/plans', { cookie: asha.cookie });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('Check 2: Frontline Team Lead (TL) cannot view compensation plans or preview (403 FORBIDDEN)', async () => {
  const res1 = await call('GET', '/api/payroll/compensation/plans', { cookie: tara.cookie });
  assert.equal(res1.status, 403);
  assert.equal(res1.body.error.code, 'FORBIDDEN');

  const res2 = await call('POST', '/api/payroll/preview', {
    cookie: tara.cookie,
    json: { cycle_code: '2026-01-STD' },
  });
  assert.equal(res2.status, 403);
  assert.equal(res2.body.error.code, 'FORBIDDEN');
});

test('Check 3: Authorized HR specialist (EMP-014) can query compensation plans (200 OK)', async () => {
  const res = await call('GET', '/api/payroll/compensation/plans', { cookie: pooja.cookie });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.plans));
  assert.ok(res.body.plans.length > 0);
});

test('Check 4: Authorized CFO (EMP-011) can query compensation plans (200 OK)', async () => {
  const res = await call('GET', '/api/payroll/compensation/plans', { cookie: ananya.cookie });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.plans));
});

// ============================================================================
// 2. Effective-Dated Salary Records & Change Audit Log
// ============================================================================

test('Check 5: HR creates a revised effective-dated compensation plan with mandatory audit reason', async () => {
  const payload = {
    employee_id: 'EMP-001',
    effective_from: '2026-02-01',
    monthly_ctc: 95000,
    basic_pay: 47500,
    hra: 23750,
    special_allowance: 23750,
    statutory_pf_employee: 1800,
    statutory_pf_employer: 1800,
    professional_tax: 200,
    tds_estimate: 3500,
    reason: `${RUN}: Annual performance increment and grade revision`,
  };

  const res = await call('POST', '/api/payroll/compensation/plans', {
    cookie: pooja.cookie,
    json: payload,
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.plan.monthly_ctc, 95000);
  assert.equal(res.body.plan.effective_from, '2026-02-01');

  // Verify change audit log entry
  const auditRes = await call('GET', '/api/payroll/compensation/audit-history?employee_id=EMP-001', {
    cookie: pooja.cookie,
  });
  assert.equal(auditRes.status, 200);
  assert.ok(auditRes.body.history.length > 0);
  const latestLog = auditRes.body.history[0];
  assert.equal(latestLog.employee_id, 'EMP-001');
  assert.equal(latestLog.action, 'revised');
  assert.ok(latestLog.reason.includes('Annual performance increment'));
});

// ============================================================================
// 3. Mid-Cycle Joiner (10 January) Calculation & Pro-Rata Formula
// ============================================================================

test('Check 6: Mid-Cycle Joiner (10 Jan) initial period calculates exactly 18 inclusive calendar days', async () => {
  // Query special initial cycle 2026-01-INITIAL (10–27 Jan 2026)
  const res = await call('POST', '/api/payroll/preview', {
    cookie: pooja.cookie,
    json: {
      cycle_code: '2026-01-INITIAL',
      divisor_policy: '30_day_fixed',
      employee_id: 'EMP-004',
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.cycle.cycle_code, '2026-01-INITIAL');
  assert.equal(res.body.cycle.total_calendar_days, 18);
  assert.equal(res.body.items.length, 1);

  const item = res.body.items[0];
  assert.equal(item.employee_id, 'EMP-004');
  assert.equal(item.joining_date, '2026-01-10');
  assert.equal(item.active_employment_days_in_cycle, 18);
  assert.equal(item.covered_payable_days, 18);

  // Pro-rata factor under 30-day fixed: 18 / 30 = 0.60
  assert.equal(item.divisor_used, 30);
  assert.equal(item.pro_rata_factor, 0.6);

  // Monthly CTC = 75,000; Basic = 37,500; Earned Basic = 37,500 * 0.6 = 22,500
  assert.equal(item.basic_pay_rate, 37500);
  assert.equal(item.earned_basic, 22500);
  assert.equal(item.earned_hra, 11250);
  assert.equal(item.earned_special_allowance, 11250);
  assert.equal(item.gross_payable, 45000); // 22500 + 11250 + 11250

  // Deductions: PF (1800) + PT (200) + TDS (2000 * 0.6 = 1200) = 3200
  assert.equal(item.statutory_deductions.total_deductions, 3200);
  assert.equal(item.net_payable_preview, 41800); // 45000 - 3200

  // Check policy warnings include mid-cycle notice [Deck P320 Category 4]
  const hasJoinerNotice = item.policy_warnings.some((w: string) =>
    w.includes('18 inclusive calendar days') && w.includes('cannot be held until 28 February')
  );
  assert.ok(hasJoinerNotice, 'Must include mid-cycle joiner warning notice');
});

test('Check 7: Mid-Cycle Joiner in Standard Jan Cycle (28 Dec – 27 Jan) is capped to active 18 days', async () => {
  const res = await call('POST', '/api/payroll/preview', {
    cookie: pooja.cookie,
    json: {
      cycle_code: '2026-01-STD',
      divisor_policy: '30_day_fixed',
      employee_id: 'EMP-004',
    },
  });

  assert.equal(res.status, 200);
  const item = res.body.items[0];
  assert.equal(item.is_mid_cycle_joiner, true);
  assert.equal(item.active_employment_days_in_cycle, 18);
  assert.equal(item.pro_rata_factor, 0.6);
  assert.equal(item.gross_payable, 45000);
});

test('Check 8: Divisor Policy switching updates calculation factors transparently', async () => {
  // Calendar days divisor (18 / 31 = 0.580645)
  const resCal = await call('POST', '/api/payroll/preview', {
    cookie: pooja.cookie,
    json: {
      cycle_code: '2026-01-STD',
      divisor_policy: 'calendar_days',
      employee_id: 'EMP-004',
    },
  });

  assert.equal(resCal.status, 200);
  const itemCal = resCal.body.items[0];
  assert.equal(itemCal.selected_divisor_policy, 'calendar_days');
  assert.equal(itemCal.divisor_used, 31);
  assert.ok(itemCal.pro_rata_factor < 0.6); // 18 / 31 ~ 0.5806
  assert.ok(itemCal.gross_payable < 45000);
});

// ============================================================================
// 4. Offline Work & Zero Automatic Deduction Invariant
// ============================================================================

test('Check 9: Zero CRM updates or WFH does NOT produce automatic salary deduction', async () => {
  const res = await call('POST', '/api/payroll/preview', {
    cookie: pooja.cookie,
    json: {
      cycle_code: '2026-01-INITIAL',
      employee_id: 'EMP-004',
    },
  });

  assert.equal(res.status, 200);
  const item = res.body.items[0];
  assert.equal(item.unexcused_lop_days, 0);
  const hasOfflineProtectionNote = item.calculation_notes.some((n: string) =>
    n.includes('offline work protected under policy')
  );
  assert.ok(hasOfflineProtectionNote, 'Calculation notes must document offline work protection');
});

// ============================================================================
// 5. Policy Gate Enforcement [Deck P320]
// ============================================================================

test('Check 10: Attempt to finalize payroll without executive policy confirmation returns 422 UNRESOLVED_POLICY_GATES', async () => {
  const res = await call('POST', '/api/payroll/finalize', {
    cookie: pooja.cookie,
    json: {
      cycle_code: '2026-01-INITIAL',
    },
  });

  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'UNRESOLVED_POLICY_GATES');
  assert.ok(res.body.error.details.required_policy_categories.length >= 3);
});
