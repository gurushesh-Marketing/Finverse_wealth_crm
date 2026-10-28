process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { createApp } from '../src/app';
import { assertTestDatabaseGuard, env } from '../src/config';

let server: Server;
let base: string;
let db: Pool;

let deCookie = '';
let ashaCookie = '';
let raviCookie = '';

async function call(
  method: string,
  path: string,
  cookie: string,
  body?: unknown
): Promise<{ status: number; body: any; headers: Headers }> {
  const headers: Record<string, string> = {};
  if (cookie) headers['Cookie'] = cookie;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let responseBody: any = null;
  if (contentType.includes('application/json')) {
    try {
      responseBody = await res.json();
    } catch {
      /* ignore */
    }
  } else {
    responseBody = await res.text();
  }

  return { status: res.status, body: responseBody, headers: res.headers };
}

async function login(email: string): Promise<string> {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo1234' }),
  });
  assert.equal(res.status, 200, `Login failed for ${email}`);
  const cookie = res.headers.get('set-cookie')?.split(';')[0] ?? '';
  return cookie;
}

async function cleanupLeads(leadIds: string[]): Promise<void> {
  if (!leadIds || leadIds.length === 0) return;
  await db.query(`UPDATE prospect_import_rows SET canonical_lead_id = NULL WHERE canonical_lead_id = ANY($1::text[])`, [leadIds]);
  await db.query(`DELETE FROM reminders WHERE task_id IN (SELECT id FROM lead_tasks WHERE lead_id = ANY($1::text[]))`, [leadIds]);
  await db.query(`DELETE FROM lead_tasks WHERE lead_id = ANY($1::text[])`, [leadIds]);
  await db.query(`DELETE FROM lead_events WHERE lead_id = ANY($1::text[])`, [leadIds]);
  await db.query(`DELETE FROM lead_audit WHERE lead_id = ANY($1::text[])`, [leadIds]);
  await db.query(`DELETE FROM lead_ownership_events WHERE lead_id = ANY($1::text[])`, [leadIds]);
  await db.query(`DELETE FROM leads WHERE id = ANY($1::text[])`, [leadIds]);
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const port = (server.address() as any).port;
  base = `http://127.0.0.1:${port}`;
  db = new Pool({ connectionString: env.DATABASE_URL });

  deCookie = await login('deepa@finverse.demo'); // Data Entry operator (EMP-015)
  ashaCookie = await login('asha@finverse.demo'); // Wealth Sales Caller (EMP-001)
  raviCookie = await login('ravi@finverse.demo'); // Wealth Sales Caller (EMP-002)
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (db) await db.end();
});

test('1. Lead Inbox Ordering: Priority first, most recently assigned first, yesterday below today, stable ID tie-breaker', async () => {
  const stamp = Date.now().toString(36);
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

  // Clean existing leads for Asha in this test prefix to isolate ordering assertions
  const leadA_prioToday = `LEAD-ORD-${stamp}-1-PT`; // Priority, assigned 1 hour ago
  const leadB_prioYest = `LEAD-ORD-${stamp}-2-PY`; // Priority, assigned yesterday
  const leadC_normToday = `LEAD-ORD-${stamp}-3-NT`; // Normal, assigned 2 hours ago
  const leadD_normYest = `LEAD-ORD-${stamp}-4-NY`; // Normal, assigned yesterday
  const leadE_prioTie1 = `LEAD-ORD-${stamp}-5-T1`; // Priority, assigned now, ID tie-breaker 1
  const leadF_prioTie2 = `LEAD-ORD-${stamp}-6-T2`; // Priority, assigned now, ID tie-breaker 2

  const tieTime = new Date(now.getTime() + 10 * 1000); // 10s into future to ensure most recent

  await db.query(
    `INSERT INTO leads (
      id, vertical, display_name, email, phone, preferred_language, product, source, stage,
      owner_employee_id, team_id, is_priority, assigned_at, created_at, updated_at, record_version
    ) VALUES
      ($1, 'wealth', 'Lead A Priority Today', 'leadA@test.com', '9800000001', 'English', 'V1 Wealth', 'Direct', 'new', 'EMP-001', 'TEAM-WEALTH-ALPHA', TRUE, $7, $7, now(), 1),
      ($2, 'wealth', 'Lead B Priority Yesterday', 'leadB@test.com', '9800000002', 'English', 'V1 Wealth', 'Direct', 'new', 'EMP-001', 'TEAM-WEALTH-ALPHA', TRUE, $8, $8, now(), 1),
      ($3, 'wealth', 'Lead C Normal Today', 'leadC@test.com', '9800000003', 'English', 'V1 Wealth', 'Direct', 'new', 'EMP-001', 'TEAM-WEALTH-ALPHA', FALSE, $9, $9, now(), 1),
      ($4, 'wealth', 'Lead D Normal Yesterday', 'leadD@test.com', '9800000004', 'English', 'V1 Wealth', 'Direct', 'new', 'EMP-001', 'TEAM-WEALTH-ALPHA', FALSE, $8, $8, now(), 1),
      ($5, 'wealth', 'Lead E Priority Tie1', 'leadE@test.com', '9800000005', 'English', 'V1 Wealth', 'Direct', 'new', 'EMP-001', 'TEAM-WEALTH-ALPHA', TRUE, $10, $10, now(), 1),
      ($6, 'wealth', 'Lead F Priority Tie2', 'leadF@test.com', '9800000006', 'English', 'V1 Wealth', 'Direct', 'new', 'EMP-001', 'TEAM-WEALTH-ALPHA', TRUE, $10, $10, now(), 1)`,
    [
      leadA_prioToday,
      leadB_prioYest,
      leadC_normToday,
      leadD_normYest,
      leadE_prioTie1,
      leadF_prioTie2,
      oneHourAgo.toISOString(),
      yesterday.toISOString(),
      twoHoursAgo.toISOString(),
      tieTime.toISOString(),
    ]
  );

  const res = await call('GET', `/api/leads?search=${stamp}`, ashaCookie);
  assert.equal(res.status, 200);
  const leads = res.body.leads;
  assert.equal(leads.length, 6);

  // Expected order:
  // 1. leadE_prioTie1 (Priority, tieTime, ID ends with 5-T1)
  // 2. leadF_prioTie2 (Priority, tieTime, ID ends with 6-T2)
  // 3. leadA_prioToday (Priority, oneHourAgo)
  // 4. leadB_prioYest (Priority, yesterday)
  // 5. leadC_normToday (Normal, twoHoursAgo)
  // 6. leadD_normYest (Normal, yesterday)
  assert.equal(leads[0].id, leadE_prioTie1, 'Most recent Priority lead E (tie 1) must be first');
  assert.equal(leads[1].id, leadF_prioTie2, 'Priority lead F (tie 2) must be second due to ID tie-breaker');
  assert.equal(leads[2].id, leadA_prioToday, 'Today assigned Priority lead A must be third');
  assert.equal(leads[3].id, leadB_prioYest, "Yesterday assigned Priority lead B must be fourth (below today's Priority)");
  assert.equal(leads[4].id, leadC_normToday, "Today assigned Normal lead C must be fifth (below all Priority, above yesterday's normal)");
  assert.equal(leads[5].id, leadD_normYest, "Yesterday assigned Normal lead D must be last");

  // Verify fields on returned summary:
  assert.equal(leads[0].isPriority, true);
  assert.ok(leads[0].assignedAt);
  assert.equal(leads[4].isPriority, false);

  // Clean up
  await db.query(`DELETE FROM leads WHERE id LIKE $1`, [`LEAD-ORD-${stamp}%`]);
});

test('2. Manual Data Entry: isPriority flag persists to intake_rows and returned staged record', async () => {
  const stamp = Date.now().toString(36);
  const mobile = `98${Date.now().toString().slice(-8)}`;
  const email = `manual-priority-${stamp}@example.test`;

  const createRes = await call('POST', '/api/data-entry/manual-records', deCookie, {
    vertical: 'wealth',
    prospectName: `Manual Priority Prospect ${stamp}`,
    mobileNumber: mobile,
    email: email,
    location: 'Mumbai',
    isPriority: true,
  });

  assert.equal(createRes.status, 201);
  const intakeId = createRes.body.id;
  assert.equal(createRes.body.isPriority, true);

  // Verify intake_rows persisted is_priority = true
  const intakeDbRes = await db.query(`SELECT is_priority FROM intake_rows WHERE id = $1`, [intakeId]);
  assert.equal(intakeDbRes.rows[0].is_priority, true, 'intake_rows must persist is_priority = true');

  // Verify listManualRecords returns isPriority
  const listRes = await call('GET', `/api/data-entry/manual-records?search=${stamp}`, deCookie);
  assert.equal(listRes.status, 200);
  const found = listRes.body.records.find((r: any) => r.id === intakeId);
  assert.ok(found, 'Created manual record must be returned in list');
  assert.equal(found.isPriority, true, 'Returned record must have isPriority = true');

  // Clean up
  await db.query(`DELETE FROM intake_rows WHERE id = $1`, [intakeId]);
});

test('3. Bulk Import: Per-row isPriority flag persists to prospect_import_rows, canonical leads, lead_events, and lead_audit', async () => {
  const stamp = Date.now().toString(36);
  const rows = [
    {
      name: `Bulk Priority Prospect ${stamp}`,
      mobile: `95${Date.now().toString().slice(-8)}`,
      email: `bulk-prio-${stamp}@example.test`,
      isPriority: true,
    },
    {
      name: `Bulk Normal Prospect ${stamp}`,
      mobile: `94${Date.now().toString().slice(-8)}`,
      email: `bulk-norm-${stamp}@example.test`,
      isPriority: false,
    },
  ];

  const jobRes = await call('POST', '/api/data-entry/bulk-import/jobs', deCookie, {
    vertical: 'wealth',
    fileName: `prio-test-${stamp}.csv`,
    sourceType: 'paste',
    rows,
  });
  assert.equal(jobRes.status, 201);
  const jobId = jobRes.body.id;

  const chunkRes = await call('POST', `/api/data-entry/bulk-import/jobs/${jobId}/process-chunk`, deCookie, {
    chunkSize: 10,
  });
  assert.equal(chunkRes.status, 200);
  assert.equal(chunkRes.body.assignedCount, 2);

  // Verify prospect_import_rows table
  const rowDbRes = await db.query(
    `SELECT row_index, is_priority, canonical_lead_id FROM prospect_import_rows WHERE job_id = $1 ORDER BY row_index ASC`,
    [jobId]
  );
  assert.equal(rowDbRes.rows.length, 2);
  assert.equal(rowDbRes.rows[0].is_priority, true, 'Row 1 in prospect_import_rows must have is_priority = true');
  assert.equal(rowDbRes.rows[1].is_priority, false, 'Row 2 in prospect_import_rows must have is_priority = false');

  // Verify canonical leads
  const prioLeadId = rowDbRes.rows[0].canonical_lead_id;
  const normLeadId = rowDbRes.rows[1].canonical_lead_id;

  const leadsRes = await db.query(`SELECT id, is_priority, assigned_at FROM leads WHERE id IN ($1, $2) ORDER BY id = $1 DESC`, [prioLeadId, normLeadId]);
  assert.equal(leadsRes.rows[0].is_priority, true, 'Canonical lead 1 must be is_priority = true');
  assert.ok(leadsRes.rows[0].assigned_at, 'Canonical lead 1 must have assigned_at set');
  assert.equal(leadsRes.rows[1].is_priority, false, 'Canonical lead 2 must be is_priority = false');

  // Verify lead_events and lead_audit for priority lead
  const evtDbRes = await db.query(
    `SELECT kind, note FROM lead_events WHERE lead_id = $1 AND kind = 'priority-marked'`,
    [prioLeadId]
  );
  assert.equal(evtDbRes.rows.length, 1, 'lead_events must record priority-marked event');

  const auditDbRes = await db.query(
    `SELECT field, before_value, after_value FROM lead_audit WHERE lead_id = $1 AND field = 'is_priority'`,
    [prioLeadId]
  );
  assert.equal(auditDbRes.rows.length, 1, 'lead_audit must record is_priority audit trail');
  assert.equal(auditDbRes.rows[0].after_value, 'true');

  // Clean up with foreign key dependency order
  await cleanupLeads([prioLeadId, normLeadId]);
  await db.query(`DELETE FROM prospect_import_rows WHERE job_id = $1`, [jobId]);
  await db.query(`DELETE FROM prospect_import_jobs WHERE id = $1`, [jobId]);
});

test('4. Persisted concurrency-safe round-robin cursor: Alternating assignments, WFH eligibility, and cursor persistence', async () => {
  const stamp = Date.now().toString(36);

  // Ensure all active wealth callers are available
  await db.query(
    `INSERT INTO availability_changes (id, employee_id, status, effective_from)
     SELECT 'AV-RR-' || a.employee_id || '-' || $1, a.employee_id, 'available', now()
       FROM assignments a
      WHERE a.vertical = 'wealth' AND a.role = 'SC'`,
    [stamp]
  );

  // Explicitly confirm Asha (EMP-001) is WFH
  const today = new Date().toISOString().split('T')[0];
  await db.query(
    `INSERT INTO attendance_records (id, employee_id, work_date, work_mode, check_in_at, status)
     VALUES ($1, 'EMP-001', $2, 'wfh', now(), 'confirmed')
     ON CONFLICT (employee_id, work_date) DO UPDATE SET work_mode = 'wfh'`,
    [`ATT-WFH-${stamp}`, today]
  );

  // Query eligible callers in order
  const { rows: eligible } = await db.query(
    `SELECT e.id FROM assignments a
       JOIN employees e ON e.id = a.employee_id
       JOIN teams t ON t.id = a.team_id
      WHERE a.vertical = 'wealth' AND t.vertical = 'wealth' AND a.role = 'SC' AND e.status = 'active'
      ORDER BY e.id ASC`
  );
  assert.ok(eligible.length >= 2, 'Must have at least 2 callers in wealth');
  const callerIds = eligible.map((r: any) => r.id);

  // Initialize round_robin_cursors to known state: first caller
  const initialCaller = callerIds[0];
  await db.query(
    `INSERT INTO round_robin_cursors (vertical, team_id, last_assigned_employee_id, updated_at)
     VALUES ('wealth', 'TEAM-WEALTH-ALPHA', $1, now())
     ON CONFLICT (vertical, team_id) DO UPDATE SET last_assigned_employee_id = EXCLUDED.last_assigned_employee_id, updated_at = now()`,
    [initialCaller]
  );

  // Generate unique non-colliding phones and emails
  const count = callerIds.length + 1;
  const rows = Array.from({ length: count }, (_, i) => ({
    name: `Round Robin Prospect ${stamp} ${i}`,
    mobile: `96${String(Math.floor(10000000 + Math.random() * 89999999))}`,
    email: `rr-${stamp}-${i}@unique-test.test`,
  }));

  const jobRes = await call('POST', '/api/data-entry/bulk-import/jobs', deCookie, {
    vertical: 'wealth',
    fileName: `rr-${stamp}.csv`,
    sourceType: 'paste',
    rows,
  });
  assert.equal(jobRes.status, 201);
  const jobId = jobRes.body.id;

  const chunkRes = await call('POST', `/api/data-entry/bulk-import/jobs/${jobId}/process-chunk`, deCookie, {
    chunkSize: 10,
  });
  assert.equal(chunkRes.status, 200);
  assert.equal(chunkRes.body.assignedCount, count, `Expected all ${count} prospects to be assigned`);

  // Fetch row assignments
  const { rows: assignedRows } = await db.query(
    `SELECT row_index, assigned_employee_id, canonical_lead_id FROM prospect_import_rows WHERE job_id = $1 ORDER BY row_index ASC`,
    [jobId]
  );
  assert.equal(assignedRows.length, count);

  // Since initial was callerIds[0], the next must be callerIds[1], callerIds[2], ..., wrapping to callerIds[0]
  for (let i = 0; i < count; i++) {
    const expectedCallerId = callerIds[(1 + i) % callerIds.length];
    assert.equal(
      assignedRows[i].assigned_employee_id,
      expectedCallerId,
      `Row ${i + 1} must be assigned to ${expectedCallerId} (index ${(1 + i) % callerIds.length})`
    );
  }

  // Verify Asha (WFH) received assignment
  const ashaAssigned = assignedRows.some((r: any) => r.assigned_employee_id === 'EMP-001');
  assert.ok(ashaAssigned, 'Asha (EMP-001) working from home must be eligible and receive assignments');

  // Verify persisted cursor state in database
  const cursorDbRes = await db.query(
    `SELECT last_assigned_employee_id FROM round_robin_cursors WHERE vertical = 'wealth' AND team_id = 'TEAM-WEALTH-ALPHA'`
  );
  const finalExpected = callerIds[(1 + count - 1) % callerIds.length];
  assert.equal(cursorDbRes.rows[0].last_assigned_employee_id, finalExpected, `Cursor must persist ${finalExpected} as last assigned caller`);

  // Clean up
  const leadIds = assignedRows.map((r: any) => r.canonical_lead_id).filter(Boolean);
  await cleanupLeads(leadIds);
  await db.query(`DELETE FROM prospect_import_rows WHERE job_id = $1`, [jobId]);
  await db.query(`DELETE FROM prospect_import_jobs WHERE id = $1`, [jobId]);
});

test('5. Vertical isolation & Unassigned Exception queue: No cross-vertical assignments and exception queue preserves priority', async () => {
  const stamp = Date.now().toString(36);

  // Put all wealth callers on 'away'
  await db.query(
    `INSERT INTO availability_changes (id, employee_id, status, effective_from)
     SELECT 'Z-AWAY-' || a.employee_id || '-' || $1, a.employee_id, 'away', now()
       FROM assignments a
      WHERE a.vertical = 'wealth' AND a.role = 'SC'`,
    [stamp]
  );

  try {
    const jobRes = await call('POST', '/api/data-entry/bulk-import/jobs', deCookie, {
      vertical: 'wealth',
      fileName: `iso-${stamp}.csv`,
      sourceType: 'paste',
      rows: [
        {
          name: `Unassigned Priority Prospect ${stamp}`,
          mobile: `92${String(Math.floor(10000000 + Math.random() * 89999999))}`,
          email: `unassigned-prio-${stamp}@unique-test.test`,
          isPriority: true,
        },
      ],
    });
    assert.equal(jobRes.status, 201);
    const jobId = jobRes.body.id;

    const chunkRes = await call('POST', `/api/data-entry/bulk-import/jobs/${jobId}/process-chunk`, deCookie, {
      chunkSize: 10,
    });
    assert.equal(chunkRes.status, 200);
    assert.equal(chunkRes.body.unassignedExceptionCount, 1);
    assert.equal(chunkRes.body.assignedCount, 0);

    const { rows: exRows } = await db.query(
      `SELECT r.status, r.assigned_employee_id, r.canonical_lead_id, l.vertical, l.is_priority
         FROM prospect_import_rows r
         JOIN leads l ON l.id = r.canonical_lead_id
        WHERE r.job_id = $1`,
      [jobId]
    );
    assert.equal(exRows.length, 1);
    assert.equal(exRows[0].status, 'unassigned_exception');
    assert.equal(exRows[0].assigned_employee_id, null, 'Must NOT assign across verticals');
    assert.equal(exRows[0].vertical, 'wealth', 'Lead vertical must remain strictly wealth');
    assert.equal(exRows[0].is_priority, true, 'Priority flag must be preserved in unassigned exception');

    // Clean up
    if (exRows[0]?.canonical_lead_id) {
      await cleanupLeads([exRows[0].canonical_lead_id]);
    }
    await db.query(`DELETE FROM prospect_import_rows WHERE job_id = $1`, [jobId]);
    await db.query(`DELETE FROM prospect_import_jobs WHERE id = $1`, [jobId]);
  } finally {
    // Restore callers
    await db.query(`DELETE FROM availability_changes WHERE id LIKE $1`, [`Z-AWAY-%-${stamp}`]);
  }
});
