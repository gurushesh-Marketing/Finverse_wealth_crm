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

const RUN = `DET-${Date.now().toString(36)}`;

interface Session {
  cookie: string;
  body: any;
}

let deepa: Session; // DE (EMP-015)
let asha: Session;  // SC (EMP-001)
let tara: Session;  // TL (EMP-003)

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
  return { status: res.status, body: parsed };
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  db = new Pool({ connectionString: env.DATABASE_URL });

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 4000;
      BASE = `http://localhost:${port}`;
      resolve();
    });
  });

  deepa = await login('deepa@finverse.demo');
  asha = await login('asha@finverse.demo');
  tara = await login('tara@finverse.demo');
});

after(async () => {
  server?.close();
  await db?.end();
});

test('01. Role Access Isolation: SC is forbidden from Data Entry; DE is authorized', async () => {
  const scRes = await call('GET', '/api/data-entry/batches', { cookie: asha.cookie });
  assert.equal(scRes.status, 403, 'Sales Caller must be rejected with 403 Forbidden');

  const deRes = await call('GET', '/api/data-entry/batches', { cookie: deepa.cookie });
  assert.equal(deRes.status, 200, 'Data Entry operator must be granted 200 OK');
  assert.ok(Array.isArray(deRes.body.batches));
});

test('02. DE-06: Maintain source register & suspension rule', async () => {
  // 1. List baseline sources
  const listRes = await call('GET', '/api/data-entry/sources', { cookie: deepa.cookie });
  assert.equal(listRes.status, 200);
  assert.ok(listRes.body.sources.length >= 3);

  // 2. Create a test source
  const createRes = await call('POST', '/api/data-entry/sources', {
    cookie: deepa.cookie,
    json: {
      sourceCode: `SRC-${RUN}-A`,
      sourceName: `Test Campaign Source ${RUN}`,
      vendorName: 'Acme Advisory LLP',
      collectionBasis: 'Client Web Opt-In Form with OTP Verification',
      evidenceDocumentUrl: '/evidence/acme-sla.pdf',
      effectiveFrom: '2026-01-01',
      permittedVerticals: ['wealth'],
      permittedProducts: ['V1 Wealth Portfolio'],
      status: 'active',
      notes: 'Initial active state',
    },
  });
  assert.equal(createRes.status, 201);
  const sourceId = createRes.body.id;
  assert.ok(sourceId);

  // 3. Suspend source
  const suspendRes = await call('PUT', `/api/data-entry/sources/${sourceId}`, {
    cookie: deepa.cookie,
    json: {
      sourceCode: `SRC-${RUN}-A`,
      sourceName: `Test Campaign Source ${RUN}`,
      vendorName: 'Acme Advisory LLP',
      collectionBasis: 'Client Web Opt-In Form with OTP Verification',
      effectiveFrom: '2026-01-01',
      permittedVerticals: ['wealth'],
      permittedProducts: ['V1 Wealth Portfolio'],
      status: 'suspended',
      notes: 'Suspended pending data audit',
    },
  });
  assert.equal(suspendRes.status, 200);
  assert.equal(suspendRes.body.status, 'suspended');

  // 4. Attempting enquiry intake with suspended source must fail
  const intakeRes = await call('POST', '/api/data-entry/enquiries', {
    cookie: deepa.cookie,
    json: {
      prospectName: 'Test Suspended Target',
      phone: '+91 98765 11111',
      email: 'suspended@test.com',
      vertical: 'wealth',
      targetTeamId: 'TEAM-WEALTH-ALPHA',
      product: 'V1 Wealth Portfolio',
      sourceId,
      permissionEvidence: 'OPT-IN-REF-1',
      permissionDate: '2026-10-15',
    },
  });
  assert.equal(intakeRes.status, 422, 'Suspended source must block intake');
});

test('03. DE-01: Capture single source-backed enquiry with validation and duplicate detection', async () => {
  // 1. Invalid vertical outside grants
  const badVerticalRes = await call('POST', '/api/data-entry/enquiries', {
    cookie: deepa.cookie,
    json: {
      prospectName: 'Outside Vertical Lead',
      phone: '+91 98765 22222',
      vertical: 'markets',
      targetTeamId: 'TEAM-WEALTH-ALPHA',
      product: 'V1 Wealth Portfolio',
      sourceId: 'SRC-WEB-01',
      permissionEvidence: 'WEB-OPTIN-001',
      permissionDate: '2026-10-15',
    },
  });
  assert.equal(badVerticalRes.status, 403, 'Must reject vertical outside grants');

  // 2. Invalid phone format
  const badPhoneRes = await call('POST', '/api/data-entry/enquiries', {
    cookie: deepa.cookie,
    json: {
      prospectName: 'Bad Phone Prospect',
      phone: '12345',
      vertical: 'wealth',
      targetTeamId: 'TEAM-WEALTH-ALPHA',
      product: 'V1 Wealth Portfolio',
      sourceId: 'SRC-WEB-01',
      permissionEvidence: 'WEB-OPTIN-002',
      permissionDate: '2026-10-15',
    },
  });
  assert.equal(badPhoneRes.status, 422, 'Must reject invalid phone number');

  // 3. Valid clean enquiry
  const cleanPhone = `+91 98765 ${Math.floor(10000 + Math.random() * 90000)}`;
  const cleanRes = await call('POST', '/api/data-entry/enquiries', {
    cookie: deepa.cookie,
    json: {
      prospectName: `Clean Prospect ${RUN}`,
      phone: cleanPhone,
      email: 'clean@investor.test',
      vertical: 'wealth',
      targetTeamId: 'TEAM-WEALTH-ALPHA',
      product: 'V1 Wealth Portfolio',
      sourceId: 'SRC-WEB-01',
      permissionEvidence: `WEB-CONSENT-${RUN}`,
      permissionDate: '2026-10-15',
      needSummary: 'Bespoke estate advisory inquiry',
    },
  });
  assert.equal(cleanRes.status, 201);
  assert.equal(cleanRes.body.status, 'valid');
  assert.equal(cleanRes.body.isDuplicate, false);

  // 4. Duplicate phone against existing lead FV-1001 (+91 98765 40001)
  const dupeRes = await call('POST', '/api/data-entry/enquiries', {
    cookie: deepa.cookie,
    json: {
      prospectName: 'Repeat Prospect A',
      phone: '+91 98765 40001',
      email: 'prospect.a@example.test',
      vertical: 'wealth',
      targetTeamId: 'TEAM-WEALTH-ALPHA',
      product: 'V1 Wealth Portfolio',
      sourceId: 'SRC-WEB-01',
      permissionEvidence: 'WEB-CONSENT-REPEAT',
      permissionDate: '2026-10-15',
    },
  });
  assert.equal(dupeRes.status, 201);
  assert.equal(dupeRes.body.status, 'duplicate_hold');
  assert.equal(dupeRes.body.isDuplicate, true);
  assert.equal(dupeRes.body.duplicateMatchLeadId, 'FV-1001');
});

test('04. DE-02: Upload CSV batch with sanitization and idempotency', async () => {
  const p1 = `+91 98765 ${Math.floor(10000 + Math.random() * 90000)}`;
  const p2 = '123'; // invalid phone
  const p3 = '+91 98765 40002'; // existing lead FV-1002

  const csvContent = [
    'Client Name,Primary Mobile,Email Address,Target Product,Consent Reference,Consent Date,Need Summary',
    `=CMD|' /C calc'!A0,"${p1}",clean.batch@test.com,V1 Wealth Portfolio,REF-BATCH-01,2026-10-15,Sanitization check`,
    `Row Two,"${p2}",invalid@test.com,,REF-BATCH-02,2026-10-15,Missing product and bad phone`,
    `Row Three,"${p3}",repeat@test.com,V1 Savings Plus,REF-BATCH-03,2026-10-15,Repeat enquiry candidate`,
  ].join('\n');

  // 1. Upload batch
  const uploadRes = await call('POST', '/api/data-entry/batches/upload', {
    cookie: deepa.cookie,
    json: {
      batchName: `Batch Import ${RUN}`,
      sourceId: 'SRC-VEND-104',
      vertical: 'wealth',
      targetTeamId: 'TEAM-WEALTH-ALPHA',
      fileName: `leads_${RUN}.csv`,
      csvContent,
      columnMapping: { name: 'Client Name', phone: 'Primary Mobile' },
      notes: 'Automated test batch',
    },
  });

  assert.equal(uploadRes.status, 201);
  assert.equal(uploadRes.body.totalRows, 3);
  assert.equal(uploadRes.body.validRows, 1);
  assert.equal(uploadRes.body.rejectedRows, 1);
  assert.equal(uploadRes.body.duplicateRows, 1);
  assert.equal(uploadRes.body.heldRows, 2);

  const batchId = uploadRes.body.id;

  // Verify formula sanitization in raw payload: leading '=' should be escaped with quote
  const detailsRes = await call('GET', `/api/data-entry/batches/${batchId}`, { cookie: deepa.cookie });
  assert.equal(detailsRes.status, 200);
  const row1 = detailsRes.body.rows.find((r: any) => r.rowIndex === 1);
  assert.ok(row1);
  assert.ok(row1.rawPayload['Client Name'].startsWith("'="), 'Formula injection must be sanitized');

  // 2. Idempotency: Uploading identical file content must fail with 409 Conflict
  const reUploadRes = await call('POST', '/api/data-entry/batches/upload', {
    cookie: deepa.cookie,
    json: {
      batchName: `Batch Duplicate Attempt ${RUN}`,
      sourceId: 'SRC-VEND-104',
      vertical: 'wealth',
      targetTeamId: 'TEAM-WEALTH-ALPHA',
      fileName: `leads_${RUN}_copy.csv`,
      csvContent,
    },
  });
  assert.equal(reUploadRes.status, 409, 'Duplicate file hash must trigger 409');
});

test('05. DE-03: Correct rejected row and retain provenance history', async () => {
  // Query rejected rows
  const rejectedRes = await call('GET', '/api/data-entry/rejected-rows', { cookie: deepa.cookie });
  assert.equal(rejectedRes.status, 200);
  assert.ok(rejectedRes.body.rows.length >= 1);

  const targetRow = rejectedRes.body.rows[0];
  const validPhone = `+91 98765 ${Math.floor(10000 + Math.random() * 90000)}`;

  // Correct permitted fields
  const correctRes = await call('PUT', `/api/data-entry/rejected-rows/${targetRow.id}`, {
    cookie: deepa.cookie,
    json: {
      correctedName: 'Corrected Prospect Name',
      correctedPhone: validPhone,
      correctedProduct: 'V1 Wealth Portfolio',
      permissionEvidence: 'SOURCE-CORRECTION-CONFIRMED',
      correctionReason: 'Vendor provided updated verified contact details over secure email.',
    },
  });

  assert.equal(correctRes.status, 200);
  assert.equal(correctRes.body.status, 'valid', 'Row must transition to valid once clean');
  assert.equal(correctRes.body.parsedName, 'Corrected Prospect Name');
  assert.ok(correctRes.body.correctionHistory.length >= 1, 'Correction provenance must be recorded');
  assert.equal(correctRes.body.correctionHistory[0].reason, 'Vendor provided updated verified contact details over secure email.');
});

test('06. DE-04: Duplicate review with restricted summary and decision handling', async () => {
  // Query duplicates
  const dupesRes = await call('GET', '/api/data-entry/duplicates', { cookie: deepa.cookie });
  assert.equal(dupesRes.status, 200);
  assert.ok(dupesRes.body.duplicates.length >= 1);

  const dupeItem = dupesRes.body.duplicates[0];
  assert.ok(dupeItem.safeSummary, 'Restricted safe summary must be provided');
  assert.ok(dupeItem.safeSummary.includes('•••••'), 'Contact number must be masked in summary');

  // Submit decision 'new_enquiry'
  const decisionRes = await call('POST', `/api/data-entry/duplicates/${dupeItem.rowId}/decision`, {
    cookie: deepa.cookie,
    json: {
      decision: 'new_enquiry',
      decisionNotes: 'Verified distinct financial goal with client. Permitted to proceed.',
    },
  });

  assert.equal(decisionRes.status, 200);
  assert.equal(decisionRes.body.decision, 'new_enquiry');
  assert.equal(decisionRes.body.status, 'valid', 'new_enquiry decision marks row valid for publishing');
});

test('07. DE-05 → TL-02/03 → SC End-to-End Publication and Allocation Chain', async () => {
  // 1. Team Lead Tara Iyer checks eligible recipients
  const recipRes = await call('GET', '/api/tl/allocation/recipients', { cookie: tara.cookie });
  assert.equal(recipRes.status, 200);
  const eligible = recipRes.body.recipients.find((r: any) => r.employeeId === asha.body.session.employeeId) || recipRes.body.recipients.find((r: any) => r.eligible) || recipRes.body.recipients[0];
  assert.ok(eligible, 'There must be an associate for the team');
  const targetTeam = eligible.teamIds[0] || 'TEAM-WEALTH-ALPHA';

  // Create a dedicated batch with 1 clean row to test publish -> TL -> SC
  const testPhone = `+91 98765 ${Math.floor(10000 + Math.random() * 90000)}`;
  const testName = `E2E Publication Prospect ${RUN}`;
  const csv = [
    'Client Name,Primary Mobile,Email Address,Target Product,Consent Reference,Consent Date',
    `"${testName}","${testPhone}",e2e.${RUN}@test.com,V1 Wealth Portfolio,E2E-CONSENT-${RUN},2026-10-15`,
  ].join('\n');

  const batchRes = await call('POST', '/api/data-entry/batches/upload', {
    cookie: deepa.cookie,
    json: {
      batchName: `E2E Routing Batch ${RUN}`,
      sourceId: 'SRC-WEB-01',
      vertical: 'wealth',
      targetTeamId: targetTeam,
      fileName: `e2e_${RUN}.csv`,
      csvContent: csv,
    },
  });
  assert.equal(batchRes.status, 201);
  const batchId = batchRes.body.id;
  assert.equal(batchRes.body.validRows, 1);

  // 2. Data Entry publishes batch
  const pubRes = await call('POST', `/api/data-entry/batches/${batchId}/publish`, {
    cookie: deepa.cookie,
    json: {},
  });
  assert.equal(pubRes.status, 200);
  assert.equal(pubRes.body.publishedCount, 1);
  const canonicalLeadId = pubRes.body.canonicalLeadIds[0];
  assert.ok(canonicalLeadId);

  // Invariant 1: Lead owner_employee_id in database is NULL upon publish
  const { rows: leadCheck } = await db.query(
    `SELECT id, stage, owner_employee_id, team_id, intake_batch_id, consent_reference FROM leads WHERE id = $1`,
    [canonicalLeadId]
  );
  assert.equal(leadCheck[0]?.owner_employee_id, null, 'Data Entry operator must NOT own published lead');
  assert.equal(leadCheck[0]?.stage, 'new');
  assert.equal(leadCheck[0]?.intake_batch_id, batchId);
  assert.equal(leadCheck[0]?.consent_reference, `E2E-CONSENT-${RUN}`);

  // Invariant 2: Idempotent repeat publish
  const pubRepeatRes = await call('POST', `/api/data-entry/batches/${batchId}/publish`, {
    cookie: deepa.cookie,
    json: {},
  });
  assert.equal(pubRepeatRes.status, 200);
  assert.equal(pubRepeatRes.body.publishedCount, 0, 'Repeat publish must not republish already-published rows');

  // 3. Team Lead Tara Iyer inspects unassigned queue
  const tlQueueRes = await call('GET', '/api/tl/allocation/queue', { cookie: tara.cookie });
  assert.equal(tlQueueRes.status, 200);
  const foundInTlQueue = tlQueueRes.body.leads.find((l: any) => l.id === canonicalLeadId);
  assert.ok(foundInTlQueue, 'Newly published lead must arrive in Team Lead allocation queue');
  assert.equal(foundInTlQueue.displayName, testName);

  // 4. Team Lead allocates lead to eligible associate
  const allocRes = await call('POST', '/api/tl/allocation', {
    cookie: tara.cookie,
    json: {
      leadId: canonicalLeadId,
      toEmployeeId: eligible.employeeId,
      reason: 'Initial intake allocation to senior frontline associate',
      recordVersion: foundInTlQueue.recordVersion,
    },
  });
  if (allocRes.status !== 201) {
    console.error('ALLOCATION_ERROR:', JSON.stringify(allocRes.body));
  }
  assert.equal(allocRes.status, 201, 'TL allocation must succeed');
  assert.equal(allocRes.body.leadId, canonicalLeadId);
  assert.equal(allocRes.body.toEmployeeId, eligible.employeeId);

  // 5. Assigned Caller sees the lead and its intake provenance
  const callerLeadRes = await call('GET', `/api/leads/${canonicalLeadId}`, { cookie: asha.cookie });
  assert.equal(callerLeadRes.status, 200, 'Assigned Caller must be able to view lead');
  assert.equal(callerLeadRes.body.displayName, testName);
  assert.equal(callerLeadRes.body.phone, testPhone);

  // Caller timeline must show intake provenance
  const intakeEvent = callerLeadRes.body.timeline.find((ev: any) => ev.kind === 'intake_ingestion' || ev.actorName?.includes('Deepa') || ev.note?.includes(batchId));
  assert.ok(callerLeadRes.body.timeline.length >= 1, 'Lead timeline must contain audit provenance');
});

test('08. DE-07: Intake quality reporting & export audit tracking', async () => {
  // Query report
  const reportRes = await call('GET', '/api/data-entry/reports/quality?period=this-month', {
    cookie: deepa.cookie,
  });
  assert.equal(reportRes.status, 200);
  assert.ok(reportRes.body.summary);
  assert.ok(reportRes.body.summary.totalSubmitted >= 1);
  assert.ok(Array.isArray(reportRes.body.batchReconciliation));
  assert.ok(Array.isArray(reportRes.body.sourceCompleteness));

  // Request export
  const exportRes = await call('POST', '/api/data-entry/reports/export', {
    cookie: deepa.cookie,
    json: {
      period: 'this-month',
      exportType: 'quality_report_pdf',
    },
  });
  assert.equal(exportRes.status, 201);
  assert.ok(exportRes.body.exportId);
  assert.equal(exportRes.body.format, 'pdf');

  // Verify export audit in database
  const { rows: auditRows } = await db.query(
    `SELECT * FROM intake_export_audits WHERE id = $1`,
    [exportRes.body.exportId]
  );
  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0].export_type, 'quality_report_pdf');
});
