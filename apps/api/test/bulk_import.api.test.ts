process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { createApp } from '../src/app';
import { assertTestDatabaseGuard, env } from '../src/config';
import { hashPassword } from '../src/lib/password';

let server: Server;
let base: string;
let db: Pool;

let deCookie = '';
let deLimitedCookie = '';
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

async function cleanupTestImports(): Promise<void> {
  await db.query(`UPDATE prospect_import_rows SET canonical_lead_id = NULL`);
  await db.query(`DELETE FROM reminders WHERE task_id IN (SELECT id FROM lead_tasks WHERE lead_id IN (SELECT id FROM leads WHERE import_id IS NOT NULL))`);
  await db.query(`DELETE FROM lead_tasks WHERE lead_id IN (SELECT id FROM leads WHERE import_id IS NOT NULL)`);
  await db.query(`DELETE FROM lead_events WHERE lead_id IN (SELECT id FROM leads WHERE import_id IS NOT NULL) OR note LIKE '%bulk import%'`);
  await db.query(`DELETE FROM lead_ownership_events WHERE lead_id IN (SELECT id FROM leads WHERE import_id IS NOT NULL) OR reason LIKE 'Bulk import%'`);
  await db.query(`DELETE FROM leads WHERE import_id IS NOT NULL`);
  await db.query(`DELETE FROM prospect_import_jobs`);
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  db = new Pool({ connectionString: env.DATABASE_URL });
  await cleanupTestImports();

  const demoHash = hashPassword('demo1234');
  await db.query(
    `INSERT INTO employees (id, email, password_hash, display_name, status)
     VALUES ('EMP-DE-LIMITED', 'de.limited@finverse.demo', $1, 'Limited DE Operator', 'active')
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
    [demoHash]
  );
  await db.query(
    `INSERT INTO assignments (id, employee_id, role, vertical, team_id, effective_from)
     VALUES ('ASG-DE-LIMITED-W', 'EMP-DE-LIMITED', 'DE', 'wealth', 'TEAM-WEALTH-ALPHA', CURRENT_DATE)
     ON CONFLICT (id) DO UPDATE SET vertical = 'wealth', team_id = 'TEAM-WEALTH-ALPHA'`
  );

  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  base = `http://localhost:${typeof address === 'object' && address ? address.port : 4000}`;

  deCookie = await login('deepa@finverse.demo');
  deLimitedCookie = await login('de.limited@finverse.demo');
  ashaCookie = await login('asha@finverse.demo');
  raviCookie = await login('ravi@finverse.demo');
});

after(async () => {
  await db.query(`DELETE FROM assignments WHERE id = 'ASG-DE-LIMITED-W'`).catch(() => undefined);
  await db.query(`DELETE FROM employees WHERE id = 'EMP-DE-LIMITED'`).catch(() => undefined);
  await cleanupTestImports();
  server?.closeAllConnections();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await db?.end();
});

test('1. Cross-vertical grant denial and caller isolation', async () => {
  // Limited DE operator with only 'wealth' grant attempting to create job in 'markets' must return 403
  const deniedRes = await call('POST', '/api/data-entry/bulk-import/jobs', deLimitedCookie, {
    vertical: 'markets',
    fileName: 'markets-test.xlsx',
    sourceType: 'paste',
    rows: [
      { name: 'Denied Prospect', mobile: '9900000001', email: 'denied@markets.test' }
    ]
  });
  assert.equal(deniedRes.status, 403, 'DE without vertical grant must be forbidden from creating import for ungranted vertical');
  assert.match(deniedRes.body.error.message, /outside/i);

  // Limited DE operator attempting to create job in 'real-estate' / 'real_estate' must also return 403
  const deniedReRes = await call('POST', '/api/data-entry/bulk-import/jobs', deLimitedCookie, {
    vertical: 'real-estate',
    fileName: 're-test.xlsx',
    sourceType: 'paste',
    rows: [
      { name: 'Denied RE Prospect', mobile: '9900000002', email: 'denied@re.test' }
    ]
  });
  assert.equal(deniedReRes.status, 403, 'DE without real-estate grant must be forbidden');

  // Deepa (EMP-015) has all four vertical grants in demo/test; creating job in 'markets' succeeds (201)
  const allowedMarketsRes = await call('POST', '/api/data-entry/bulk-import/jobs', deCookie, {
    vertical: 'markets',
    fileName: 'deepa-markets-allowed.xlsx',
    sourceType: 'paste',
    rows: [
      { name: 'Allowed Markets Prospect', mobile: '9900000003', email: 'allowed@markets.test' }
    ]
  });
  assert.equal(allowedMarketsRes.status, 201, 'Operator with markets grant must succeed');

  // Sales caller (Asha) attempting to access DE bulk import endpoint must return 403
  const callerRes = await call('POST', '/api/data-entry/bulk-import/jobs', ashaCookie, {
    vertical: 'wealth',
    fileName: 'caller-test.xlsx',
    sourceType: 'paste',
    rows: [
      { name: 'Caller Prospect', mobile: '9900000004', email: 'caller@wealth.test' }
    ]
  });
  assert.equal(callerRes.status, 403, 'Non-DE roles must be forbidden from data entry endpoints');
});

test('2. Duplicate detection (in-file & existing CRM leads) and idempotency retry', async () => {
  const stamp = Date.now().toString(36);
  const existingEmail = `exist-${stamp}@example.test`;
  const existingMobile = `91${Date.now().toString().slice(-8)}`;

  // Seed an existing CRM lead with required fields
  const existingLeadId = `LEAD-PRE-${stamp}`;
  await db.query(
    `INSERT INTO leads (id, vertical, display_name, email, phone, stage, preferred_language, product, source, owner_employee_id, team_id)
     VALUES ($1, 'wealth', $2, $3, $4, 'contacted', 'English', 'Wealth Portfolio', 'Direct', 'EMP-001', 'TEAM-WEALTH-ALPHA')`,
    [existingLeadId, `Existing Prospect ${stamp}`, existingEmail, existingMobile]
  );

  const importRows = [
    // Row 0: Valid unique prospect
    { name: `Valid Prospect A ${stamp}`, mobile: `92${Date.now().toString().slice(-8)}`, email: `val-a-${stamp}@example.test`, location: 'Mumbai' },
    // Row 1: Duplicate within file of Row 0 (same mobile)
    { name: `Duplicate In File ${stamp}`, mobile: `92${Date.now().toString().slice(-8)}`, email: `val-dup-${stamp}@example.test`, location: 'Pune' },
    // Row 2: Duplicate of existing CRM lead (same email)
    { name: `Duplicate Existing CRM ${stamp}`, mobile: `93${Date.now().toString().slice(-8)}`, email: existingEmail, location: 'Delhi' },
    // Row 3: Invalid row (missing name)
    { name: '  ', mobile: `94${Date.now().toString().slice(-8)}`, email: `invalid-${stamp}@example.test` },
    // Row 4: Another valid unique prospect
    { name: `Valid Prospect B ${stamp}`, mobile: `95${Date.now().toString().slice(-8)}`, email: `val-b-${stamp}@example.test` },
  ];

  const createJobRes = await call('POST', '/api/data-entry/bulk-import/jobs', deCookie, {
    vertical: 'wealth',
    fileName: 'test-dups.xlsx',
    sourceType: 'xlsx',
    rows: importRows,
  });
  assert.equal(createJobRes.status, 201);
  const jobId = createJobRes.body.id;
  assert.equal(createJobRes.body.totalRows, 5);

  // Process chunk (chunkSize = 10 to process all 5 rows in one chunk)
  const chunkRes = await call('POST', `/api/data-entry/bulk-import/jobs/${jobId}/process-chunk`, deCookie, {
    chunkSize: 10,
  });
  assert.equal(chunkRes.status, 200);
  assert.equal(chunkRes.body.status, 'completed');

  // Verify Reconciliation Equation: total = assigned + dup + invalid + exception
  const { totalRows, assignedCount, duplicateCount, invalidCount, unassignedExceptionCount } = chunkRes.body;
  assert.equal(totalRows, 5);
  assert.equal(assignedCount, 2, 'Should assign exactly 2 valid unique rows');
  assert.equal(duplicateCount, 2, 'Should flag 1 in-file dup + 1 existing lead dup');
  assert.equal(invalidCount, 1, 'Should flag 1 invalid row');
  assert.equal(unassignedExceptionCount, 0);
  assert.equal(totalRows, assignedCount + duplicateCount + invalidCount + unassignedExceptionCount);

  // Check row-level details
  const rowsRes = await call('GET', `/api/data-entry/bulk-import/jobs/${jobId}/rows`, deCookie);
  assert.equal(rowsRes.status, 200);
  const rows = rowsRes.body.rows;
  assert.equal(rows.length, 5);

  assert.equal(rows[0].status, 'assigned');
  assert.ok(rows[0].canonicalLeadId);
  assert.ok(rows[0].assignedEmployeeId);

  assert.equal(rows[1].status, 'duplicate');
  assert.match(rows[1].rejectionReason, /Duplicate/i);

  assert.equal(rows[2].status, 'duplicate');
  assert.match(rows[2].rejectionReason, /Existing prospect/i);

  assert.equal(rows[3].status, 'invalid');
  assert.match(rows[3].rejectionReason, /Prospect name/i);

  assert.equal(rows[4].status, 'assigned');
  assert.ok(rows[4].canonicalLeadId);

  // Idempotency check: process again, should return already completed without duplicating
  const retryRes = await call('POST', `/api/data-entry/bulk-import/jobs/${jobId}/process-chunk`, deCookie, {
    chunkSize: 10,
  });
  assert.equal(retryRes.status, 200);
  assert.equal(retryRes.body.assignedCount, 2);
  assert.equal(retryRes.body.duplicateCount, 2);

  // Clean up seeded lead and referencing rows
  await db.query(`UPDATE prospect_import_rows SET canonical_lead_id = NULL WHERE canonical_lead_id = $1`, [existingLeadId]);
  await db.query(`DELETE FROM leads WHERE id = $1`, [existingLeadId]);
});

test('3. Deterministic routing fairness across callers (least active first & WFH eligible)', async () => {
  const stamp = Date.now().toString(36);

  // Equalize active open leads between Asha and Ravi for this test so their workloads start equal
  const aCountRes = await db.query(`SELECT count(id)::int FROM leads WHERE owner_employee_id = 'EMP-001' AND vertical = 'wealth' AND stage NOT IN ('converted', 'lost')`);
  const rCountRes = await db.query(`SELECT count(id)::int FROM leads WHERE owner_employee_id = 'EMP-002' AND vertical = 'wealth' AND stage NOT IN ('converted', 'lost')`);
  const diff = Number(aCountRes.rows[0].count) - Number(rCountRes.rows[0].count);
  if (diff > 0) {
    await db.query(`UPDATE leads SET stage = 'converted' WHERE id IN (SELECT id FROM leads WHERE owner_employee_id = 'EMP-001' AND vertical = 'wealth' AND stage NOT IN ('converted', 'lost') LIMIT $1)`, [diff]);
  } else if (diff < 0) {
    await db.query(`UPDATE leads SET stage = 'converted' WHERE id IN (SELECT id FROM leads WHERE owner_employee_id = 'EMP-002' AND vertical = 'wealth' AND stage NOT IN ('converted', 'lost') LIMIT $1)`, [-diff]);
  }

  // Set Asha and Ravi as available
  await db.query(
    `INSERT INTO availability_changes (id, employee_id, status, effective_from)
     VALUES ($1, 'EMP-001', 'available', now()), ($2, 'EMP-002', 'available', now())`,
    [`AV-A-${stamp}`, `AV-R-${stamp}`]
  );

  // Ensure Asha has WFH attendance record to verify WFH does NOT disqualify
  const today = new Date().toISOString().split('T')[0];
  await db.query(
    `INSERT INTO attendance_records (id, employee_id, work_date, work_mode, check_in_at, status)
     VALUES ($1, 'EMP-001', $2, 'wfh', now(), 'confirmed')
     ON CONFLICT (employee_id, work_date) DO UPDATE SET work_mode = 'wfh'`,
    [`ATT-TEST-WFH-${stamp}`, today]
  );

  // Create 6 rows for wealth import
  const sixRows = Array.from({ length: 6 }, (_, i) => ({
    name: `Fairness Prospect ${stamp} ${i}`,
    mobile: `96${String(i).padStart(8, '0')}`,
    email: `fair-${stamp}-${i}@example.test`,
  }));

  const createJobRes = await call('POST', '/api/data-entry/bulk-import/jobs', deCookie, {
    vertical: 'wealth',
    fileName: 'fairness.csv',
    sourceType: 'paste',
    rows: sixRows,
  });
  assert.equal(createJobRes.status, 201);
  const jobId = createJobRes.body.id;

  const chunkRes = await call('POST', `/api/data-entry/bulk-import/jobs/${jobId}/process-chunk`, deCookie, {
    chunkSize: 10,
  });
  assert.equal(chunkRes.status, 200);
  assert.equal(chunkRes.body.assignedCount, 6);

  // Check assignments: both callers should receive leads fairly
  const rowsRes = await call('GET', `/api/data-entry/bulk-import/jobs/${jobId}/rows`, deCookie);
  const assigned = rowsRes.body.rows.filter((r: any) => r.status === 'assigned');
  assert.equal(assigned.length, 6);

  const ashaCount = assigned.filter((r: any) => r.assignedEmployeeId === 'EMP-001').length;
  const raviCount = assigned.filter((r: any) => r.assignedEmployeeId === 'EMP-002').length;

  assert.ok(ashaCount > 0, 'Asha (WFH) must be assigned leads');
  assert.ok(raviCount > 0, 'Ravi must be assigned leads');
  assert.ok(Math.abs(ashaCount - raviCount) <= 2, `Distribution must be balanced, got Asha=${ashaCount}, Ravi=${raviCount}`);
});

test('4. No-eligible-caller exception handling (unassigned queue for Team Lead)', async () => {
  const stamp = Date.now().toString(36);

  // Temporarily set all wealth callers to 'away'
  await db.query(
    `INSERT INTO availability_changes (id, employee_id, status, effective_from)
     SELECT 'Z-AWAY-' || a.employee_id || '-' || $1, a.employee_id, 'away', now()
       FROM assignments a
      WHERE a.vertical = 'wealth' AND a.role = 'SC'`,
    [stamp]
  );

  try {
    const rows = [
      {
        name: `Exception Prospect 1 ${stamp}`,
        mobile: `971${Date.now().toString().slice(-7)}`,
        email: `except1-${stamp}@example.test`,
      },
      {
        name: `Exception Prospect 2 ${stamp}`,
        mobile: `972${Date.now().toString().slice(-7)}`,
        email: `except2-${stamp}@example.test`,
      },
    ];

    const createJobRes = await call('POST', '/api/data-entry/bulk-import/jobs', deCookie, {
      vertical: 'wealth',
      fileName: 'exceptions.csv',
      sourceType: 'paste',
      rows,
    });
    assert.equal(createJobRes.status, 201);
    const jobId = createJobRes.body.id;

    const chunkRes = await call('POST', `/api/data-entry/bulk-import/jobs/${jobId}/process-chunk`, deCookie, {
      chunkSize: 10,
    });
    assert.equal(chunkRes.status, 200);
    assert.equal(chunkRes.body.unassignedExceptionCount, 2, 'Rows must be held in unassigned exceptions');
    assert.equal(chunkRes.body.assignedCount, 0);

    const rowsRes = await call('GET', `/api/data-entry/bulk-import/jobs/${jobId}/rows`, deCookie);
    for (const r of rowsRes.body.rows) {
      assert.equal(r.status, 'unassigned_exception');
      assert.match(r.rejectionReason, /callers in vertical|manual allocation/i);
      assert.equal(r.assignedEmployeeId, null, 'Must NOT fabricate or invent a caller');
      assert.ok(r.assignedTeamId, 'Must associate with authorized vertical Team Lead/team');
      assert.ok(r.canonicalLeadId, 'Canonical prospect must be created in unassigned state');
    }
  } finally {
    // Restore availability to 'available'
    await db.query(
      `INSERT INTO availability_changes (id, employee_id, status, effective_from)
       SELECT 'ZZ-AVAIL-' || a.employee_id || '-' || $1, a.employee_id, 'available', now()
         FROM assignments a
        WHERE a.vertical = 'wealth' AND a.role = 'SC'`,
      [stamp]
    );
  }
});

test('5. 10,000-row synthetic multi-chunk import with reconciliation and queue verification', async () => {
  const startTime = Date.now();
  const stamp = Date.now().toString(36);
  const totalCount = 10000;

  console.log(`[10k Test] Generating ${totalCount} synthetic rows...`);
  const syntheticRows: any[] = [];

  // 9900 valid unique rows
  // 50 duplicate within file rows
  // 50 invalid rows (missing name)
  for (let i = 0; i < 9900; i++) {
    const phoneSuffix = String(i).padStart(9, '0');
    syntheticRows.push({
      rowIndex: i + 1,
      name: `Synth Prospect ${stamp} ${i}`,
      mobile: `9${phoneSuffix.slice(0, 9)}`,
      email: `synth-${stamp}-${i}@corporate.test`,
      location: i % 2 === 0 ? 'Mumbai' : 'Bengaluru',
    });
  }

  // Add 50 duplicates of earlier rows (rows 9901..9950)
  for (let i = 0; i < 50; i++) {
    syntheticRows.push({
      rowIndex: 9901 + i,
      name: `In-File Dup ${stamp} ${i}`,
      mobile: syntheticRows[i].mobile, // identical mobile
      email: `dup-synth-${stamp}-${i}@corporate.test`,
    });
  }

  // Add 50 invalid rows (missing required prospectName)
  for (let i = 0; i < 50; i++) {
    const phoneSuffix = String(9900 + i).padStart(9, '0');
    syntheticRows.push({
      rowIndex: 9951 + i,
      name: '   ', // invalid
      mobile: `8${phoneSuffix.slice(0, 9)}`,
      email: `invalid-name-${stamp}-${i}@corporate.test`,
    });
  }

  assert.equal(syntheticRows.length, totalCount, 'Should have exactly 10,000 rows');

  console.log(`[10k Test] Submitting 10,000 rows to POST /api/data-entry/bulk-import/jobs...`);
  const jobCreateStart = Date.now();
  const createJobRes = await call('POST', '/api/data-entry/bulk-import/jobs', deCookie, {
    vertical: 'wealth',
    fileName: `corporate_10k_batch_${stamp}.csv`,
    sourceType: 'csv',
    rows: syntheticRows,
  });
  assert.equal(createJobRes.status, 201);
  const jobId = createJobRes.body.id;
  console.log(`[10k Test] Job created in ${Date.now() - jobCreateStart}ms with ID: ${jobId}`);

  // Process chunks in bounded batches of 1,000 rows
  const chunkSize = 1000;
  let isDone = false;
  let chunkIndex = 0;
  let lastStatus: any = null;

  console.log(`[10k Test] Processing chunks of ${chunkSize}...`);
  while (!isDone) {
    chunkIndex++;
    const t0 = Date.now();
    const chunkRes = await call('POST', `/api/data-entry/bulk-import/jobs/${jobId}/process-chunk`, deCookie, {
      chunkSize,
    });
    assert.equal(chunkRes.status, 200, `Chunk ${chunkIndex} failed`);
    lastStatus = chunkRes.body;
    console.log(
      `[10k Test] Chunk ${chunkIndex} done in ${Date.now() - t0}ms. Progress: ${lastStatus.processedRows}/${lastStatus.totalRows} (assigned: ${lastStatus.assignedCount}, dup: ${lastStatus.duplicateCount}, inv: ${lastStatus.invalidCount}, unassigned: ${lastStatus.unassignedExceptionCount})`
    );

    if (lastStatus.status === 'completed' || lastStatus.processedRows >= lastStatus.totalRows) {
      isDone = true;
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(`[10k Test] 10,000-row processing completed in ${(durationMs / 1000).toFixed(2)}s`);

  // Final Reconciliation Invariant Verification:
  // total rows = assigned prospects + duplicates + invalid rows + unassigned exceptions
  assert.equal(lastStatus.totalRows, totalCount);
  assert.equal(
    lastStatus.totalRows,
    lastStatus.assignedCount + lastStatus.duplicateCount + lastStatus.invalidCount + lastStatus.unassignedExceptionCount,
    'Reconciliation equation must hold exactly: total = assigned + dup + invalid + unassigned'
  );
  assert.equal(lastStatus.duplicateCount, 50, 'Must catch exactly 50 in-file duplicate rows');
  assert.equal(lastStatus.invalidCount, 50, 'Must catch exactly 50 invalid rows');
  assert.equal(lastStatus.assignedCount + lastStatus.unassignedExceptionCount, 9900);

  // Check Downloadable reconciliation report endpoint
  const reportRes = await call('GET', `/api/data-entry/bulk-import/jobs/${jobId}/report`, deCookie);
  assert.equal(reportRes.status, 200);
  assert.match(reportRes.headers.get('content-type') || '', /text\/csv/);
  assert.ok(typeof reportRes.body === 'string');
  assert.ok(reportRes.body.includes('Row Number,Prospect Name,Priority,Mobile Number,Email,WhatsApp,Location,Status,Assigned Caller,Assigned Team,Canonical Lead ID'));

  // Verify readable in Sales Caller's normal queue
  const ashaLeads = await call('GET', '/api/leads', ashaCookie);
  assert.equal(ashaLeads.status, 200);
  assert.ok(ashaLeads.body.leads.length > 0, 'Asha must see assigned prospects in her queue');
  const sampleAssigned = ashaLeads.body.leads.find((l: any) => l.displayName?.includes(`Synth Prospect ${stamp}`));
  assert.ok(sampleAssigned, 'Assigned prospect from this bulk import must appear in caller queue');
});

test('6. Four-vertical import execution: Wealth, Banking, Markets, Real Estate with caller queue verification', async () => {
  const verticals = ['wealth', 'banking', 'markets', 'real-estate'];

  for (const vertical of verticals) {
    const stamp = `${vertical.slice(0, 3)}-${Date.now().toString(36)}`;
    const prospectName = `Synth ${vertical} Lead ${stamp}`;
    const prospectEmail = `${vertical}.${stamp}@demo.test`;
    const prospectMobile = `97${Date.now().toString().slice(-8)}`;

    // 1. Data Entry creates bulk import job
    const createRes = await call('POST', '/api/data-entry/bulk-import/jobs', deCookie, {
      vertical,
      fileName: `${vertical}-import.xlsx`,
      sourceType: 'paste',
      rows: [
        {
          name: prospectName,
          mobile: prospectMobile,
          email: prospectEmail,
          whatsapp: prospectMobile,
          location: 'Bengaluru',
        },
      ],
    });
    assert.equal(createRes.status, 201, `Job creation failed for vertical ${vertical}`);
    const jobId = createRes.body.id;

    // 2. Process chunk
    const chunkRes = await call('POST', `/api/data-entry/bulk-import/jobs/${jobId}/process-chunk`, deCookie, {
      chunkSize: 10,
    });
    assert.equal(chunkRes.status, 200, `Process chunk failed for vertical ${vertical}`);
    assert.equal(chunkRes.body.status, 'completed');
    assert.equal(chunkRes.body.assignedCount, 1, `Expected 1 assigned prospect for ${vertical}`);
    assert.equal(chunkRes.body.duplicateCount, 0);
    assert.equal(chunkRes.body.invalidCount, 0);
    assert.equal(chunkRes.body.unassignedExceptionCount, 0);

    // 3. Verify canonical database record
    const expectedCanonicalVertical = vertical === 'real-estate' ? 'real_estate' : vertical;
    const { rows: leadRows } = await db.query(
      `SELECT id, vertical, display_name, email, phone, owner_employee_id, team_id, stage
       FROM leads WHERE import_id = $1`,
      [jobId]
    );
    assert.equal(leadRows.length, 1);
    const lead = leadRows[0];
    assert.equal(lead.vertical, expectedCanonicalVertical, `Lead vertical must be canonical ${expectedCanonicalVertical}`);
    assert.equal(lead.display_name, prospectName);
    assert.equal(lead.email, prospectEmail);
    assert.ok(lead.owner_employee_id, `Lead in ${vertical} must have an assigned sales caller`);

    // Verify caller belongs to an eligible assignment for that vertical
    const { rows: asgRows } = await db.query(
      `SELECT a.role, a.vertical FROM assignments a
       WHERE a.employee_id = $1 AND (a.vertical = $2 OR a.vertical = REPLACE($2, '_', '-'))`,
      [lead.owner_employee_id, expectedCanonicalVertical]
    );
    assert.ok(asgRows.length > 0, `Assigned caller ${lead.owner_employee_id} must have grant for ${expectedCanonicalVertical}`);

    // 4. Log in as assigned caller and verify queue visibility
    const { rows: empRows } = await db.query(
      `SELECT email FROM employees WHERE id = $1`,
      [lead.owner_employee_id]
    );
    const assignedCallerEmail = empRows[0]?.email;
    assert.ok(assignedCallerEmail, `Email for assigned caller ${lead.owner_employee_id} must exist`);

    const callerCookie = await login(assignedCallerEmail);
    const callerQueueRes = await call('GET', `/api/leads?search=${encodeURIComponent(prospectName)}`, callerCookie);
    assert.equal(callerQueueRes.status, 200, `Caller ${assignedCallerEmail} failed to query leads`);
    assert.ok(
      callerQueueRes.body.leads.some((l: any) => l.displayName === prospectName),
      `Prospect ${prospectName} must appear in caller ${assignedCallerEmail} queue`
    );
  }
});

test('7. Strict selected-vertical routing: Wealth import with only non-Wealth callers available', async () => {
  const stamp = Date.now().toString(36);
  // Mark all Wealth SC callers as 'away' so no Wealth callers are eligible
  const wealthCallers = ['EMP-001', 'EMP-002', 'EMP-006'];
  for (const empId of wealthCallers) {
    await db.query(
      `INSERT INTO availability_changes (id, employee_id, status, effective_from, note)
       VALUES ($1, $2, 'away', now(), 'Temporary test away status')`,
      [`AV-${empId}-${stamp}`, empId]
    );
  }

  try {
    const prospectName = `No-Caller Wealth ${stamp}`;
    const prospectEmail = `nc-wealth-${stamp}@test.demo`;
    const prospectMobile = `91${Date.now().toString().slice(-8)}`;

    const createRes = await call('POST', '/api/data-entry/bulk-import/jobs', deCookie, {
      vertical: 'wealth',
      fileName: 'wealth-no-callers.xlsx',
      sourceType: 'paste',
      rows: [{ name: prospectName, mobile: prospectMobile, email: prospectEmail, location: 'Mumbai' }],
    });
    assert.equal(createRes.status, 201);
    const jobId = createRes.body.id;

    const chunkRes = await call('POST', `/api/data-entry/bulk-import/jobs/${jobId}/process-chunk`, deCookie, {
      chunkSize: 10,
    });
    assert.equal(chunkRes.status, 200);
    assert.equal(chunkRes.body.status, 'completed');
    assert.equal(chunkRes.body.assignedCount, 0, 'Must NOT assign to non-wealth callers');
    assert.equal(chunkRes.body.unassignedExceptionCount, 1, 'Must hold as unassigned exception');

    // Verify row status and lead in DB
    const { rows: leadRows } = await db.query(
      `SELECT id, vertical, display_name, owner_employee_id, team_id FROM leads WHERE import_id = $1`,
      [jobId]
    );
    assert.equal(leadRows.length, 1);
    const lead = leadRows[0];
    assert.equal(lead.vertical, 'wealth', 'Lead vertical must be strictly wealth');
    assert.equal(lead.owner_employee_id, null, 'Must have NO owner (never cross-assigned)');
    assert.equal(lead.team_id, 'TEAM-WEALTH-ALPHA', 'Team must be a wealth team');

    const { rows: importRows } = await db.query(
      `SELECT status, assigned_employee_id, assigned_team_id, rejection_reason FROM prospect_import_rows WHERE job_id = $1`,
      [jobId]
    );
    assert.equal(importRows[0].status, 'unassigned_exception');
    assert.equal(importRows[0].assigned_employee_id, null);
    assert.match(importRows[0].rejection_reason, /unavailable or at capacity/i);
  } finally {
    // Reset availability
    for (const empId of wealthCallers) {
      await db.query(
        `INSERT INTO availability_changes (id, employee_id, status, effective_from, note)
         VALUES ($1, $2, 'available', now(), 'Restored test availability')`,
        [`AV-RST-${empId}-${stamp}`, empId]
      );
    }
  }
});

test('8. Strict selected-vertical routing: Selected vertical with no eligible team', async () => {
  const stamp = Date.now().toString(36);
  // Temporarily rename teams for markets to simulate a vertical with no configured teams
  await db.query(`UPDATE teams SET vertical = 'markets_temp_hide' WHERE vertical = 'markets'`);

  try {
    const prospectName = `No-Team Markets ${stamp}`;
    const prospectEmail = `nt-markets-${stamp}@test.demo`;
    const prospectMobile = `92${Date.now().toString().slice(-8)}`;

    const createRes = await call('POST', '/api/data-entry/bulk-import/jobs', deCookie, {
      vertical: 'markets',
      fileName: 'markets-no-team.xlsx',
      sourceType: 'paste',
      rows: [{ name: prospectName, mobile: prospectMobile, email: prospectEmail, location: 'Mumbai' }],
    });
    assert.equal(createRes.status, 201);
    const jobId = createRes.body.id;

    const chunkRes = await call('POST', `/api/data-entry/bulk-import/jobs/${jobId}/process-chunk`, deCookie, {
      chunkSize: 10,
    });
    assert.equal(chunkRes.status, 200);
    assert.equal(chunkRes.body.status, 'completed');
    assert.equal(chunkRes.body.assignedCount, 0, 'Must NOT be reported as assigned');
    assert.equal(chunkRes.body.unassignedExceptionCount, 1, 'Must be held as unassigned exception');

    // Verify row status and lead in DB
    const { rows: leadRows } = await db.query(
      `SELECT id, vertical, display_name, owner_employee_id, team_id FROM leads WHERE import_id = $1`,
      [jobId]
    );
    assert.equal(leadRows.length, 1);
    const lead = leadRows[0];
    assert.equal(lead.vertical, 'markets', 'Lead vertical must be strictly markets');
    assert.equal(lead.owner_employee_id, null, 'Owner must be null');
    assert.equal(lead.team_id, null, 'Must NOT fallback to TEAM-WEALTH-ALPHA; must be NULL');

    const { rows: importRows } = await db.query(
      `SELECT status, assigned_employee_id, assigned_team_id, rejection_reason FROM prospect_import_rows WHERE job_id = $1`,
      [jobId]
    );
    assert.equal(importRows[0].status, 'unassigned_exception');
    assert.equal(importRows[0].assigned_employee_id, null);
    assert.equal(importRows[0].assigned_team_id, null, 'Assigned team must be null, no cross-vertical fallback');
    assert.match(importRows[0].rejection_reason, /No active team configured for vertical/i);
  } finally {
    await db.query(`UPDATE teams SET vertical = 'markets' WHERE vertical = 'markets_temp_hide'`);
  }
});

test('9. Retry idempotency: Retries cannot change a previously successful assignment', async () => {
  const stamp = Date.now().toString(36);
  const prospectName = `Idempotent Lead ${stamp}`;
  const prospectEmail = `idemp-${stamp}@demo.test`;
  const prospectMobile = `93${Date.now().toString().slice(-8)}`;

  const createRes = await call('POST', '/api/data-entry/bulk-import/jobs', deCookie, {
    vertical: 'wealth',
    fileName: 'idempotent-test.xlsx',
    sourceType: 'paste',
    rows: [{ name: prospectName, mobile: prospectMobile, email: prospectEmail, location: 'Pune' }],
  });
  assert.equal(createRes.status, 201);
  const jobId = createRes.body.id;

  // Process chunk first time
  const chunkRes1 = await call('POST', `/api/data-entry/bulk-import/jobs/${jobId}/process-chunk`, deCookie, {
    chunkSize: 10,
  });
  assert.equal(chunkRes1.status, 200);
  assert.equal(chunkRes1.body.assignedCount, 1);

  const { rows: initialLead } = await db.query(
    `SELECT id, owner_employee_id, team_id, record_version FROM leads WHERE import_id = $1`,
    [jobId]
  );
  assert.equal(initialLead.length, 1);
  const originalOwner = initialLead[0].owner_employee_id;
  const originalTeam = initialLead[0].team_id;

  // Process chunk a second time (retry)
  const chunkRes2 = await call('POST', `/api/data-entry/bulk-import/jobs/${jobId}/process-chunk`, deCookie, {
    chunkSize: 10,
  });
  assert.equal(chunkRes2.status, 200);
  assert.equal(chunkRes2.body.status, 'completed');
  assert.equal(chunkRes2.body.assignedCount, 1);

  // Verify lead ownership and team are unchanged
  const { rows: retriedLead } = await db.query(
    `SELECT id, owner_employee_id, team_id, record_version FROM leads WHERE import_id = $1`,
    [jobId]
  );
  assert.equal(retriedLead[0].owner_employee_id, originalOwner, 'Retry cannot mutate assigned caller');
  assert.equal(retriedLead[0].team_id, originalTeam, 'Retry cannot mutate assigned team');
  assert.equal(retriedLead[0].record_version, initialLead[0].record_version, 'Record version must be untouched');
});


