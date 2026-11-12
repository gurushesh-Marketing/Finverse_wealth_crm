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

const RUN = `CFOT-${Date.now().toString(36)}`;

interface Session {
  cookie: string;
  body: any;
}

let ananya: Session; // CFO (EMP-011)
let priya: Session;  // Finance Officer / Controller (EMP-012)
let rajiv: Session;  // CEO (EMP-010)
let vikram: Session; // NM (EMP-009)
let kavita: Session; // RM (EMP-008)
let neel: Session;   // MG (EMP-007)
let asha: Session;   // SC (EMP-001)

async function login(email: string): Promise<Session> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo1234' }),
  });
  const body = await res.json();
  const raw = res.headers.get('set-cookie') ?? '';
  return { cookie: raw.split(';')[0]!, body };
}

async function call(
  method: string,
  path: string,
  opts: { json?: unknown; cookie?: string; headers?: Record<string, string> } = {}
) {
  const headers: Record<string, string> = {};
  if (opts.headers) Object.assign(headers, opts.headers);
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
    const buf = await res.arrayBuffer();
    parsed = { isPdf: true, byteLength: buf.byteLength, buffer: Buffer.from(buf) };
  } else {
    parsed = await res.text();
  }
  return { status: res.status, headers: res.headers, body: parsed };
}

async function cleanupTestData() {
  await db.query(
    `DELETE FROM receipt_invoice_matches
     WHERE invoice_id IN (SELECT id FROM receivable_invoices WHERE client_name LIKE $1 OR invoice_number LIKE $1)
        OR receipt_id IN (SELECT id FROM bank_settled_receipts WHERE bank_reference LIKE $1)
        OR notes LIKE $1 OR id LIKE $1`,
    [`%${RUN}%`]
  );
  await db.query(`UPDATE finance_ledger_entries SET reversal_linked_entry_id = NULL WHERE description LIKE $1 OR entry_code LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM finance_ledger_entries WHERE description LIKE $1 OR entry_code LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM receivable_invoices WHERE invoice_number LIKE $1 OR client_name LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM bank_settled_receipts WHERE bank_reference LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM refund_requests WHERE external_payment_ref LIKE $1 OR reason LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM period_reopen_requests WHERE impact_assessment LIKE $1 OR reason LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM finance_pack_schedules WHERE title LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM finance_policies WHERE title LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM forecast_finance_reviews WHERE finance_assumptions LIKE $1`, [`%${RUN}%`]);
  await db.query(`DELETE FROM sales_finance_handoffs WHERE id NOT IN ('SFH-001', 'SFH-002')`);
  await db.query(`DELETE FROM incentive_disputes WHERE id NOT IN ('DISP-001')`);

  // Reset baseline mutable records
  await db.query(`UPDATE sales_finance_handoffs SET review_status = 'pending_verification', deficiency_notes = NULL, verified_by_employee_id = NULL, verified_at = NULL WHERE id = 'SFH-001'`);
  await db.query(`UPDATE incentive_calculations SET status = 'calculated', payout_handoff_reference = NULL, approved_by_employee_id = NULL, approved_at = NULL WHERE id = 'INC-001'`);
  await db.query(`UPDATE incentive_disputes SET status = 'open', resolution_amount = NULL, decision_notes = NULL, resolved_by_employee_id = NULL, resolved_at = NULL WHERE id = 'DISP-001'`);
}

async function restoreBaselinePeriods() {
  await db.query(`UPDATE reporting_periods SET status = 'open', lock_governed_writes = false WHERE id IN ('PER-2026-Q1', 'PER-2026-Q2')`);
}

before(async () => {
  assertTestDatabaseGuard(env.DATABASE_URL);
  db = new Pool({ connectionString: env.DATABASE_URL });
  await cleanupTestData();
  await db.query(`UPDATE reporting_periods SET status = 'certified_closed', lock_governed_writes = true WHERE id = 'PER-2026-Q1'`);
  await db.query(`UPDATE reporting_periods SET status = 'open', lock_governed_writes = false WHERE id = 'PER-2026-Q2'`);

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const port = (server.address() as any).port;
      BASE = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  ananya = await login('ananya@finverse.demo');
  priya = await login('priya@finverse.demo');
  rajiv = await login('rajiv@finverse.demo');
  vikram = await login('vikram@finverse.demo');
  kavita = await login('kavita@finverse.demo');
  neel = await login('neel@finverse.demo');
  asha = await login('asha@finverse.demo');
});

after(async () => {
  await cleanupTestData();
  await restoreBaselinePeriods();
  if (db) await db.end();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('Security Gate: Non-CFO roles receive 403 Forbidden on CFO endpoints', async () => {
  for (const session of [rajiv, vikram, kavita, neel, asha]) {
    const res = await call('GET', '/api/cfo/overview', { cookie: session.cookie });
    assert.equal(res.status, 403, 'Non-CFO roles must receive 403 Forbidden on CFO endpoints');
    assert.equal(res.body.error?.code, 'FORBIDDEN');
  }

  // CFO succeeds
  const cfoRes = await call('GET', '/api/cfo/overview', { cookie: ananya.cookie });
  assert.equal(cfoRes.status, 200, 'CFO must receive 200 OK on balances overview');
});

test('Scope: Returns enterprise executive multi-vertical scope for CFO', async () => {
  const res = await call('GET', '/api/cfo/scope', { cookie: ananya.cookie });
  assert.equal(res.status, 200);
  const scope = res.body.data || res.body.scope;
  assert.ok(scope, 'Scope object must be returned');
  assert.equal(scope.role, 'CFO');
  assert.equal(scope.cfo?.id, 'EMP-011');
  assert.ok(Array.isArray(scope.verticals));
  assert.equal(scope.verticals.length, 4, 'CFO executive scope must cover 4 verticals');
  assert.equal(scope.currency, 'INR');
});

test('CFO-01: Inspect Revenue, Cash and Outstanding Balances overview', async () => {
  const res = await call('GET', '/api/cfo/overview?period=FY26-Q2', { cookie: ananya.cookie });
  assert.equal(res.status, 200);
  const data = res.body.overview;
  assert.ok(data, 'Overview payload must exist');
  assert.equal(typeof data.recognisedRevenue, 'number');
  assert.equal(typeof data.cashReceipts, 'number');
  assert.equal(typeof data.outstandingReceivables, 'number');
  assert.equal(typeof data.unmatchedCash, 'number');
  assert.equal(typeof data.grossMarginPct, 'number');
  assert.ok(Array.isArray(data.recentLedgerEntries));
});

test('CFO-02: Sales-to-Finance Handoff verification and return-for-correction workflow', async () => {
  // 1. Fetch handoffs list
  const listRes = await call('GET', '/api/cfo/handoffs', { cookie: ananya.cookie });
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body.handoffs));
  assert.ok(listRes.body.handoffs.length > 0, 'Seed must provide pending handoff items');

  const handoff = listRes.body.handoffs.find((h: any) => h.id === 'SFH-001') || listRes.body.handoffs[0];
  const handoffId = handoff.id;

  // 2. Return for deficiencies
  const returnRes = await call('POST', `/api/cfo/handoffs/${handoffId}/verify`, {
    cookie: ananya.cookie,
    json: {
      decision: 'returned_deficiencies',
      deficiencyNotes: `Returned for updated GSTIN and mandate copy ${RUN}`,
    },
  });
  assert.equal(returnRes.status, 200);
  assert.equal(returnRes.body.handoff?.reviewStatus, 'returned_deficiencies');

  // 3. Post verification acceptance
  const verifyRes = await call('POST', `/api/cfo/handoffs/${handoffId}/verify`, {
    cookie: ananya.cookie,
    json: {
      decision: 'accepted_for_processing',
    },
  });
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.handoff?.reviewStatus, 'accepted_for_processing');
});

test('CFO-03: Post Revenue Recognition into open period; reject closed period posting', async () => {
  // 1. Attempt post into certified closed period FY26-Q1 -> must be rejected with 400
  const closedRes = await call('POST', '/api/cfo/ledger/recognition/prepare', {
    cookie: priya.cookie,
    json: {
      periodId: 'FY26-Q1',
      vertical: 'wealth',
      grossAmount: 150000,
      taxAmount: 27000,
      policyCode: 'REV-POL-2026',
      sourceReferenceType: 'deal',
      sourceReferenceId: `DEAL-CLOSED-${RUN}`,
      accountCode: 'REV-4001',
      description: `Test posting into closed period ${RUN}`,
    },
  });
  assert.equal(closedRes.status, 400, 'Posting into certified_closed period must return 400');

  // 2. Prepare into open period FY26-Q2 by Priya -> succeeds with pending_approval
  await db.query(
    `INSERT INTO sales_finance_handoffs (id, handoff_code, lead_id, vertical, sales_rep_employee_id, converted_amount, earning_milestone, review_status, created_at)
     VALUES ($1, $2, 'FV-1002', 'wealth', 'EMP-001', 615000.00, 'mandate_signed', 'accepted_for_processing', '2026-08-01')
     ON CONFLICT (id) DO NOTHING`,
    [`SFH-OPEN-${RUN}`, `SFH-CODE-OPEN-${RUN}`]
  );

  const openRes = await call('POST', '/api/cfo/ledger/recognition/prepare', {
    cookie: priya.cookie,
    json: {
      periodId: 'FY26-Q2',
      vertical: 'wealth',
      grossAmount: 750000,
      taxAmount: 135000,
      policyCode: 'REV-POL-2026',
      sourceReferenceType: 'deal',
      sourceReferenceId: `DEAL-OPEN-${RUN}`,
      accountCode: 'REV-4001',
      description: `Wealth advisory fee recognition ${RUN}`,
    },
  });
  assert.equal(openRes.status, 201);
  const entry = openRes.body.entry;
  assert.ok(entry?.id);
  assert.equal(entry.netAmount, 615000);
  assert.equal(entry.entryType, 'revenue_recognition');
  assert.equal(entry.status, 'pending_approval');
  assert.equal(entry.recordVersion, 1);
  assert.equal(entry.preparedByName, 'Priya Nair');

  // 3. Independent approval by Ananya (CFO) -> transitions to posted
  const apprRes = await call('POST', `/api/cfo/ledger/recognition/${entry.id}/approve`, {
    cookie: ananya.cookie,
  });
  assert.equal(apprRes.status, 200);
  const approvedEntry = apprRes.body.entry;
  assert.equal(approvedEntry.status, 'posted');
  assert.equal(approvedEntry.recordVersion, 2);
  assert.equal(approvedEntry.approvedByName, 'Ananya Roy');
});

test('CFO-04: Issue Receivable Invoice with line items; reject closed period creation', async () => {
  // 1. Attempt invoice creation into closed period -> 400
  const closedRes = await call('POST', '/api/cfo/invoices', {
    cookie: ananya.cookie,
    json: {
      periodId: 'FY26-Q1',
      clientName: 'Closed Customer',
      vertical: 'banking',
      issueDate: '2026-07-01',
      dueDate: '2026-07-15',
      lineItems: [{ description: 'Advisory Retainer', amount: 100000 }],
      taxAmount: 18000,
    },
  });
  assert.equal(closedRes.status, 400, 'Invoice creation in closed period must return 400');

  // 2. Issue valid invoice into open period FY26-Q2
  const openRes = await call('POST', '/api/cfo/invoices', {
    cookie: ananya.cookie,
    json: {
      periodId: 'FY26-Q2',
      clientName: `Tata Enterprise Services ${RUN}`,
      vertical: 'banking',
      issueDate: '2026-09-01',
      dueDate: '2026-10-31',
      lineItems: [
        { description: 'Quarterly Corporate Banking Facility Fee', amount: 500000 },
        { description: 'Escrow Account Administration', amount: 100000 },
      ],
      taxAmount: 108000,
    },
  });
  assert.equal(openRes.status, 201);
  const inv = openRes.body.invoice;
  assert.ok(inv?.id);
  assert.equal(inv.totalAmount, 708000);
  assert.equal(inv.taxAmount, 108000);
  assert.equal(inv.outstandingBalance, 708000);
  assert.equal(inv.status, 'issued');
});

test('CFO-05: Bank Receipts Batch Import and duplicate bank reference rejection', async () => {
  const bankRef1 = `UTR-HDFC-${RUN}-001`;
  const bankRef2 = `UTR-ICICI-${RUN}-002`;

  // 1. Import valid receipt batch
  const batchRes = await call('POST', '/api/cfo/receipts/batch-import', {
    cookie: ananya.cookie,
    json: {
      receipts: [
        {
          bankReference: bankRef1,
          bankName: 'HDFC Bank Corporate Clearing',
          settlementDate: '2026-09-20',
          amount: 250000,
          payerName: 'Reliance Capital Ltd',
        },
        {
          bankReference: bankRef2,
          bankName: 'ICICI Bank Treasury',
          settlementDate: '2026-09-21',
          amount: 180000,
          payerName: 'Kotak Realty Holdings',
        },
      ],
    },
  });
  assert.equal(batchRes.status, 201);
  assert.equal(batchRes.body.importedCount, 2);

  // 2. Attempt duplicate import with same bankReference -> must reject with 409
  const dupRes = await call('POST', '/api/cfo/receipts/batch-import', {
    cookie: ananya.cookie,
    json: {
      receipts: [
        {
          bankReference: bankRef1,
          bankName: 'HDFC Bank Corporate Clearing',
          settlementDate: '2026-09-20',
          amount: 250000,
          payerName: 'Duplicate Remitter',
        },
      ],
    },
  });
  assert.equal(dupRes.status, 409, 'Duplicate bank reference must be rejected with 409 Conflict');
});

test('CFO-06: Atomic Payment Matching to Invoice and over-allocation prevention', async () => {
  // Create an invoice
  const invRes = await call('POST', '/api/cfo/invoices', {
    cookie: ananya.cookie,
    json: {
      periodId: 'FY26-Q2',
      clientName: `Allocation Target Client ${RUN}`,
      vertical: 'wealth',
      issueDate: '2026-09-01',
      dueDate: '2026-10-31',
      lineItems: [{ description: 'Portfolio Execution Fee', amount: 200000 }],
      taxAmount: 36000,
    },
  });
  assert.equal(invRes.status, 201);
  const inv = invRes.body.invoice;
  const invoiceId = inv.id;
  const totalAmount = inv.totalAmount; // 236,000

  // Import a receipt for 300,000
  const bankRef = `UTR-MATCH-${RUN}-999`;
  await call('POST', '/api/cfo/receipts/batch-import', {
    cookie: ananya.cookie,
    json: {
      receipts: [
        {
          bankReference: bankRef,
          bankName: 'Axis Bank Treasury',
          settlementDate: '2026-09-22',
          amount: 300000,
          payerName: 'Allocation Target Client',
        },
      ],
    },
  });

  // Get receipt id
  const recList = await call('GET', '/api/cfo/receipts', { cookie: ananya.cookie });
  const receipt = recList.body.receipts.find((r: any) => r.bankReference === bankRef);
  assert.ok(receipt?.id);

  // 1. Attempt over-allocation: match amount greater than invoice outstanding balance -> 400
  const overRes = await call('POST', '/api/cfo/receipts/match', {
    cookie: ananya.cookie,
    json: {
      receiptId: receipt.id,
      invoiceId: invoiceId,
      allocatedAmount: totalAmount + 50000,
    },
  });
  assert.equal(overRes.status, 400, 'Allocating amount greater than invoice balance must fail with 400');

  // 2. Match exact invoice amount
  const matchRes = await call('POST', '/api/cfo/receipts/match', {
    cookie: ananya.cookie,
    json: {
      receiptId: receipt.id,
      invoiceId: invoiceId,
      allocatedAmount: totalAmount,
    },
  });
  assert.equal(matchRes.status, 200);
  assert.equal(matchRes.body.match?.remainingInvoiceBalance, 0);

  // 3. Verify invoice is now settled
  const invCheck = await call('GET', `/api/cfo/invoices?periodId=FY26-Q2`, { cookie: ananya.cookie });
  const updatedInv = invCheck.body.invoices.find((i: any) => i.id === invoiceId);
  assert.equal(updatedInv?.outstandingBalance, 0);
  assert.equal(updatedInv?.status, 'settled');
});

test('CFO-07: Investigate Unmatched Receipts and flag to suspense / operations', async () => {
  const bankRef = `UTR-SUSP-${RUN}-777`;
  await call('POST', '/api/cfo/receipts/batch-import', {
    cookie: ananya.cookie,
    json: {
      receipts: [
        {
          bankReference: bankRef,
          bankName: 'SBI Commercial Branch',
          settlementDate: '2026-09-23',
          amount: 95000,
          payerName: 'Unknown Corp Unidentified',
        },
      ],
    },
  });

  const recList = await call('GET', '/api/cfo/receipts', { cookie: ananya.cookie });
  const receipt = recList.body.receipts.find((r: any) => r.bankReference === bankRef);
  assert.ok(receipt?.id);

  const invRes = await call('POST', `/api/cfo/receipts/${receipt.id}/investigate`, {
    cookie: ananya.cookie,
    json: {
      status: 'suspense',
      suspenseReason: 'Remitter name does not match any KYC customer record in Finverse CRM',
      clarificationTeamId: 'TEAM-WEALTH-ALPHA',
    },
  });
  assert.equal(invRes.status, 200);
  assert.equal(invRes.body.receipt?.status, 'suspense');
  assert.equal(invRes.body.receipt?.suspenseReason, 'Remitter name does not match any KYC customer record in Finverse CRM');
});

test('CFO-08: Three-Way Reconciliation Bridge and freeze reconciliation snapshot', async () => {
  const bridgeRes = await call('GET', '/api/cfo/reconciliations', { cookie: ananya.cookie });
  assert.equal(bridgeRes.status, 200);
  assert.ok(Array.isArray(bridgeRes.body.reconciliations));
  const recon = bridgeRes.body.reconciliations[0];
  assert.ok(recon?.id);
  assert.equal(typeof recon.salesClosedWinsTotal, 'number');
  assert.equal(typeof recon.recognisedRevenueTotal, 'number');
  assert.equal(typeof recon.cashReceiptsTotal, 'number');
  assert.equal(typeof recon.unexplainedVariance, 'number');

  // Freeze reconciliation snapshot
  const freezeRes = await call('POST', '/api/cfo/reconciliations/freeze', {
    cookie: ananya.cookie,
    json: {
      periodId: recon.periodId || 'PER-2026-Q1',
      explanationNotes: `Three-way bridge variance within documented threshold ${RUN}`,
    },
  });
  assert.equal(freezeRes.status, 200);
  assert.equal(freezeRes.body.reconciliation?.reconciliationStatus, 'approved_frozen');
});

test('CFO-09: Accounts Receivable Ageing and Collection Work Assignment', async () => {
  // 1. Fetch 4 ageing buckets summary
  const ageingRes = await call('GET', '/api/cfo/invoices/ageing', { cookie: ananya.cookie });
  assert.equal(ageingRes.status, 200);
  const buckets = ageingRes.body.summary;
  assert.ok(buckets);
  assert.equal(typeof buckets.current, 'number');
  assert.equal(typeof buckets.days31To60, 'number');
  assert.equal(typeof buckets.days61To90, 'number');
  assert.equal(typeof buckets.over90Days, 'number');

  // 2. Create an invoice to assign collection
  const invRes = await call('POST', '/api/cfo/invoices', {
    cookie: ananya.cookie,
    json: {
      periodId: 'FY26-Q2',
      clientName: `Overdue Institutional Account ${RUN}`,
      vertical: 'banking',
      issueDate: '2026-06-01',
      dueDate: '2026-08-01',
      lineItems: [{ description: 'Equities Clearing Fee', amount: 300000 }],
      taxAmount: 54000,
    },
  });
  assert.equal(invRes.status, 201);
  const invoiceId = invRes.body.invoice.id;

  // 3. Assign collection work
  const assignRes = await call('POST', `/api/cfo/invoices/${invoiceId}/collection`, {
    cookie: ananya.cookie,
    json: {
      assignedEmployeeId: 'EMP-007',
      collectionStatus: 'disputed',
      collectionNotes: `Issue formal 2nd dunning notice via registered mail and follow up with finance controller ${RUN}`,
    },
  });
  assert.equal(assignRes.status, 200);
  assert.equal(assignRes.body.invoice?.assignedCollectionAgentId, 'EMP-007');
  assert.equal(assignRes.body.invoice?.collectionStatus, 'disputed');
});

test('CFO-10: Refund Request Governance, DoA limit verification and disbursement', async () => {
  // 1. Create a refund request
  const reqRes = await call('POST', '/api/cfo/refunds', {
    cookie: ananya.cookie,
    json: {
      clientName: `Refund Eligible Client ${RUN}`,
      refundAmount: 450000,
      reason: `Client transferred double margin deposit by operational error ${RUN}`,
      bankBeneficiaryName: 'Refund Eligible Client',
      bankAccountNumber: '009801502441',
      bankIfsc: 'HDFC0000060',
    },
  });
  assert.equal(reqRes.status, 201);
  const refundId = reqRes.body.refund?.id;
  assert.ok(refundId);
  assert.equal(reqRes.body.refund?.status, 'pending_approval');

  // 2. Reject decision if amount exceeds CFO policy limit
  const hugeRes = await call('POST', '/api/cfo/refunds', {
    cookie: ananya.cookie,
    json: {
      clientName: `Huge Refund Client ${RUN}`,
      refundAmount: 15000000, // 1.5 Cr exceeds CFO limit
      reason: `Huge cancellation requiring Board/CEO approval ${RUN}`,
      bankBeneficiaryName: 'Huge Refund Client',
      bankAccountNumber: '009801502441',
      bankIfsc: 'HDFC0000060',
    },
  });
  assert.equal(hugeRes.status, 201);
  const hugeId = hugeRes.body.refund?.id;

  // Attempting CFO approval on out-of-limit refund must fail with 403
  const hugeApprove = await call('POST', `/api/cfo/refunds/${hugeId}/decide`, {
    cookie: ananya.cookie,
    json: {
      decision: 'approved',
    },
  });
  assert.equal(hugeApprove.status, 403, 'Refund amount exceeding CFO DoA limit must be rejected with 403');

  // 3. Approve the valid 450,000 refund
  const appRes = await call('POST', `/api/cfo/refunds/${refundId}/decide`, {
    cookie: ananya.cookie,
    json: {
      decision: 'approved',
    },
  });
  assert.equal(appRes.status, 200);
  assert.equal(appRes.body.refund?.status, 'approved');

  // 4. Mark disbursement executed with mandatory externalPaymentRef
  const disburseRes = await call('POST', `/api/cfo/refunds/${refundId}/decide`, {
    cookie: ananya.cookie,
    json: {
      decision: 'executed_paid',
      externalPaymentRef: `RTGS-DISBURSE-${RUN}`,
    },
  });
  assert.equal(disburseRes.status, 200);
  assert.equal(disburseRes.body.refund?.status, 'executed_paid');
  assert.equal(disburseRes.body.refund?.externalPaymentRef, `RTGS-DISBURSE-${RUN}`);
});

test('CFO-11: Credit Notes and Reversing Entries preserve audit history', async () => {
  // First prepare a revenue entry by Priya and approve by Ananya
  const origRes = await call('POST', '/api/cfo/ledger/recognition/prepare', {
    cookie: priya.cookie,
    json: {
      periodId: 'FY26-Q2',
      vertical: 'wealth',
      grossAmount: 200000,
      taxAmount: 0,
      policyCode: 'REV-POL-2026',
      sourceReferenceType: 'deal',
      sourceReferenceId: `DEAL-REVERSE-${RUN}`,
      accountCode: 'REV-4001',
      description: `Original revenue to be reversed ${RUN}`,
    },
  });
  assert.equal(origRes.status, 201);
  const origEntryId = origRes.body.entry.id;

  const origAppr = await call('POST', `/api/cfo/ledger/recognition/${origEntryId}/approve`, {
    cookie: ananya.cookie,
  });
  assert.equal(origAppr.status, 200);

  // Prepare linked credit note reversing entry by Priya
  const cnRes = await call('POST', '/api/cfo/ledger/credit-note/prepare', {
    cookie: priya.cookie,
    json: {
      originalEntryId: origEntryId,
      reversalReason: `Billing correction due to fee recalculation agreed in writing ${RUN}`,
      policyCode: 'REV-POL-2026',
      creditAmount: 200000,
    },
  });
  assert.equal(cnRes.status, 201);
  const cnEntryId = cnRes.body.entry.id;
  assert.equal(cnRes.body.entry.status, 'pending_approval');

  // Independent approval of credit note by Ananya
  const cnAppr = await call('POST', `/api/cfo/ledger/credit-note/${cnEntryId}/approve`, {
    cookie: ananya.cookie,
  });
  assert.equal(cnAppr.status, 200);
  const cnEntry = cnAppr.body.entry;
  assert.equal(cnEntry.entryType, 'credit_note_reversal');
  assert.equal(cnEntry.status, 'posted');
  assert.equal(cnEntry.netAmount, -200000, 'Credit note netAmount must be negative reversing value');
  assert.equal(cnEntry.reversalLinkedEntryId, origEntryId);

  // Verify original entry was untouched and preserved in audit trail
  const ledgerRes = await call('GET', '/api/cfo/ledger?periodId=FY26-Q2', { cookie: ananya.cookie });
  const originalFound = ledgerRes.body.entries.find((e: any) => e.id === origEntryId);
  assert.ok(originalFound);
  assert.equal(originalFound.netAmount, 200000);
});

test('CFO-12: Incentive Calculation Pool, 15% Clawback Reserve and Payroll Handoff Freeze', async () => {
  const incRes = await call('GET', '/api/cfo/incentives', { cookie: ananya.cookie });
  assert.equal(incRes.status, 200);
  assert.ok(Array.isArray(incRes.body.calculations));
  const calc = incRes.body.calculations[0];
  assert.ok(calc?.id);
  assert.equal(typeof calc.totalIncentivePool, 'number');
  assert.equal(typeof calc.clawbackReserve, 'number');
  assert.equal(typeof calc.payableIncentiveTotal, 'number');
  // Verify 15% clawback reserve calculation
  const expectedClawback = Math.round(calc.totalIncentivePool * 0.15 * 100) / 100;
  assert.ok(Math.abs(calc.clawbackReserve - expectedClawback) <= 1, 'Clawback reserve must adhere to 15% reserve policy');

  // Freeze incentive payout handoff to payroll
  const freezeRes = await call('POST', `/api/cfo/incentives/${calc.id}/freeze`, {
    cookie: ananya.cookie,
    json: {
      payoutHandoffReference: `PAYROLL-BATCH-${RUN}`,
    },
  });
  assert.equal(freezeRes.status, 200);
  assert.equal(freezeRes.body.calculation?.status, 'frozen_for_payout');
  assert.equal(freezeRes.body.calculation?.payoutHandoffReference, `PAYROLL-BATCH-${RUN}`);
});

test('CFO-13: Audited Dispute Resolution with adjustment amount', async () => {
  const dispRes = await call('GET', '/api/cfo/incentives/disputes', { cookie: ananya.cookie });
  assert.equal(dispRes.status, 200);
  assert.ok(Array.isArray(dispRes.body.disputes));
  const dispute = dispRes.body.disputes[0];
  assert.ok(dispute?.id);

  // Resolve dispute upholding with adjustment
  const resolveRes = await call('POST', `/api/cfo/incentives/disputes/${dispute.id}/resolve`, {
    cookie: ananya.cookie,
    json: {
      resolution: 'resolved_upheld',
      resolutionAmount: 25000,
      decisionNotes: `Upholding senior RM dispute following CRM credit split validation ${RUN}`,
    },
  });
  assert.equal(resolveRes.status, 200);
  assert.equal(resolveRes.body.dispute?.status, 'resolved_upheld');
  assert.equal(resolveRes.body.dispute?.resolutionAmount, 25000);
});

test('CFO-14: Period Close Certification enforces governance checklist', async () => {
  // 1. Attempt certification before reconciliations are frozen -> must return 400
  const incompleteRes = await call('POST', `/api/cfo/periods/FY26-Q2/certify`, {
    cookie: ananya.cookie,
    json: {
      certificationNotes: 'Attempting premature certification without complete reconciliations',
    },
  });
  assert.equal(incompleteRes.status, 400, 'Certification without required reconciliations must return 400');

  // Freeze reconciliations for active verticals in FY26-Q2
  await call('POST', '/api/cfo/reconciliations/freeze', {
    cookie: ananya.cookie,
    json: {
      periodId: 'FY26-Q2',
      vertical: 'wealth',
      explanationNotes: `Wealth Q2 frozen ${RUN}`,
    },
  });
  await call('POST', '/api/cfo/reconciliations/freeze', {
    cookie: ananya.cookie,
    json: {
      periodId: 'FY26-Q2',
      vertical: 'banking',
      explanationNotes: `Banking Q2 frozen ${RUN}`,
    },
  });

  // 2. Certify when all requirements are met -> transitions period to certified_closed
  const passRes = await call('POST', `/api/cfo/periods/FY26-Q2/certify`, {
    cookie: ananya.cookie,
    json: {
      certificationNotes: `All reconciliations and tax provisions certified by CFO ${RUN}`,
    },
  });
  assert.equal(passRes.status, 200);
  assert.equal(passRes.body.period?.status, 'certified_closed');
  assert.ok(passRes.body.period?.certifiedAt || passRes.body.period?.certified_at);
  assert.ok(passRes.body.period?.certificationHash || passRes.body.period?.certification_hash);
});

test('CFO-15: Period Reopening Request and 24-hour unlock governance', async () => {
  // 1a. Self-approval test: Request created by CFO herself
  const selfReqRes = await call('POST', '/api/cfo/periods/reopen-requests', {
    cookie: ananya.cookie,
    json: {
      periodId: 'FY26-Q1',
      reason: 'Self-requested period reopening to test governance constraint',
      impactAssessment: `Governance self-approval check test ${RUN}`,
      affectedAccounts: ['REV-4001'],
    },
  });
  assert.equal(selfReqRes.status, 201);
  const selfReopenId = selfReqRes.body.request?.id;

  // Attempt self-approval by CFO -> must fail with 403 Forbidden
  const selfDecideRes = await call('POST', `/api/cfo/periods/reopen-requests/${selfReopenId}/decide`, {
    cookie: ananya.cookie,
    json: {
      decision: 'approved',
      unlockHours: 24,
      newCloseVersion: `v1.1-self-${RUN}`,
    },
  });
  assert.equal(selfDecideRes.status, 403, 'Self-approval of reopening request must return 403 Forbidden [Deck P248]');

  // 1b. Submit reopen request on behalf of operations controller (EMP-001)
  const reqRes = await call('POST', '/api/cfo/periods/reopen-requests', {
    cookie: ananya.cookie,
    json: {
      periodId: 'FY26-Q1',
      requestedByEmployeeId: 'EMP-001',
      reason: 'Late foreign remittance clearing requiring statutory reconciliation adjustment',
      impactAssessment: `Statutory adjustment required for foreign exchange remittance ${RUN}`,
      affectedAccounts: ['REV-4001', 'CASH-1001'],
    },
  });
  assert.equal(reqRes.status, 201);
  const reopenId = reqRes.body.request?.id;
  assert.ok(reopenId);
  assert.equal(reqRes.body.request?.status, 'pending');

  // 2. Independent CFO approval succeeds with 24-hour unlock window
  const decideRes = await call('POST', `/api/cfo/periods/reopen-requests/${reopenId}/decide`, {
    cookie: ananya.cookie,
    json: {
      decision: 'approved',
      unlockHours: 24,
      newCloseVersion: `v1.1-corrected-${RUN}`,
    },
  });
  assert.equal(decideRes.status, 200);
  assert.equal(decideRes.body.request?.status, 'approved');
  assert.ok(decideRes.body.request?.unlockExpiresAt || decideRes.body.request?.unlock_expires_at);
});

test('CFO-16: Vertical Budget Allocation Performance and Variance Notes', async () => {
  const bRes = await call('GET', '/api/cfo/budgets?fiscalYear=FY26', { cookie: ananya.cookie });
  assert.equal(bRes.status, 200);
  assert.ok(Array.isArray(bRes.body.budgets));
  const line = bRes.body.budgets[0];
  assert.ok(line?.id);
  assert.equal(typeof line.approvedBudget, 'number');
  assert.equal(typeof line.actualCosts, 'number');
  assert.equal(typeof line.varianceAmount, 'number');

  // Update variance explanation notes
  const noteRes = await call('POST', `/api/cfo/budgets/${line.id}/notes`, {
    cookie: ananya.cookie,
    json: {
      notes: `Variance attributable to upfront software licensing and regulatory audit retainers ${RUN}`,
    },
  });
  assert.equal(noteRes.status, 200);
  assert.equal(noteRes.body.budget?.notes, `Variance attributable to upfront software licensing and regulatory audit retainers ${RUN}`);
});

test('CFO-17: Forecast Finance Review and CFO Concurrence submission', async () => {
  const fRes = await call('GET', '/api/cfo/forecasts', { cookie: ananya.cookie });
  assert.equal(fRes.status, 200);
  assert.ok(Array.isArray(fRes.body.reviews));
  const rev = fRes.body.reviews[0];
  assert.ok(rev?.periodLabel);

  // Submit CFO concurrence review
  const concRes = await call('POST', '/api/cfo/forecasts/concur', {
    cookie: ananya.cookie,
    json: {
      periodLabel: rev.periodLabel,
      vertical: 'wealth',
      salesProjectedRevenue: 85000000,
      financeDiscountRatePct: 8,
      cashConversionPaceDays: 45,
      financeAssumptions: `Applied 8% haircut for regulatory onboarding lag in Q3 pipeline ${RUN}`,
      concurrenceStatus: 'concurred_with_reservations',
    },
  });
  assert.equal(concRes.status, 201);
  assert.equal(concRes.body.review?.concurrenceStatus, 'concurred_with_reservations');
  assert.equal(concRes.body.review?.riskAdjustedRevenue, 85000000 * 0.92);
});

test('CFO-18: Certified Finance Pack Preview, PDF Generation and Delivery Schedules', async () => {
  // 1. Preview finance pack KPIs
  const prevRes = await call('GET', '/api/cfo/reports/preview?period=FY26-Q1', { cookie: ananya.cookie });
  assert.equal(prevRes.status, 200);
  const preview = prevRes.body.preview;
  assert.ok(preview?.executiveFinancialSummary);
  assert.ok(preview?.salesCashReconciliation);
  assert.ok(Array.isArray(preview?.budgetPerformance));
  assert.ok(preview?.complianceCertification?.certificationHash);

  // 2. Export PDF
  const expRes = await call('POST', '/api/cfo/reports/export-pdf', {
    cookie: ananya.cookie,
    json: { periodLabel: 'FY26-Q1' },
  });
  assert.equal(expRes.status, 200);
  assert.ok(expRes.body.filename);
  assert.ok(expRes.body.downloadUrl);

  // 3. Download generated PDF and verify binary magic header %PDF
  const dlRes = await call('GET', `/api/cfo/reports/download/${expRes.body.filename}`, { cookie: ananya.cookie });
  assert.equal(dlRes.status, 200);
  assert.ok(dlRes.body.isPdf, 'Response must be application/pdf');
  assert.ok(dlRes.body.byteLength > 1000, 'PDF buffer must exceed 1000 bytes');
  const magic = dlRes.body.buffer.subarray(0, 4).toString('ascii');
  assert.equal(magic, '%PDF', 'Must start with %PDF magic header');

  // 4. Also test direct streaming endpoint GET /api/cfo/reports/pdf
  const streamRes = await call('GET', '/api/cfo/reports/pdf?period=FY26-Q1', { cookie: ananya.cookie });
  assert.equal(streamRes.status, 200);
  assert.ok(streamRes.body.isPdf);
  assert.equal(streamRes.body.buffer.subarray(0, 4).toString('ascii'), '%PDF');

  // 5. Create finance pack distribution schedule
  const schedRes = await call('POST', '/api/cfo/reports/schedules', {
    cookie: ananya.cookie,
    json: {
      title: `Board & Audit Distribution Schedule ${RUN}`,
      cadence: 'monthly_close',
      recipients: ['audit@finverse.demo', 'cfo@finverse.demo'],
      includeFullLedger: true,
    },
  });
  assert.equal(schedRes.status, 201);
  assert.equal(schedRes.body.schedule?.cadence, 'monthly_close');
});

test('CFO-19: Delegation of Authority (DoA) Limit Matrix and Policy Update Proposal', async () => {
  // 1. Inspect existing policies
  const polRes = await call('GET', '/api/cfo/policies', { cookie: ananya.cookie });
  assert.equal(polRes.status, 200);
  assert.ok(Array.isArray(polRes.body.policies));
  assert.ok(polRes.body.policies.length > 0, 'Seed must provide baseline DoA policy');

  // 2. Propose policy update
  const propRes = await call('POST', '/api/cfo/policies', {
    cookie: ananya.cookie,
    json: {
      title: `FY27 Revised Delegation of Authority Matrix ${RUN}`,
      category: 'delegation_of_authority',
      version: '2.0',
      effectiveDate: '2026-11-01',
      rulesSummary: `Calibrated approval bands to align with growing institutional transaction volume ${RUN}`,
      approvalLimits: {
        SC: 0,
        TL: 50000,
        MG: 250000,
        RM: 1000000,
        NM: 2500000,
        CFO: 7500000,
        CEO: 25000000,
      },
    },
  });
  assert.equal(propRes.status, 201);
  assert.equal(propRes.body.policy?.status, 'active');
  assert.equal(propRes.body.policy?.approvalLimits?.CFO, 7500000);
});

test('CFO Hardening 1: Genuine zero totals remain zero without hardcoded fallbacks', async () => {
  // Query a brand new empty period PER-EMPTY-ZERO
  const emptyPeriodId = `PER-ZERO-${RUN}`;
  const emptyLabel = `FY29-Q1-${RUN}`;
  await db.query(
    `INSERT INTO reporting_periods (id, period_label, start_date, end_date, status, lock_governed_writes)
     VALUES ($1, $2, '2029-01-01', '2029-03-31', 'open', false) ON CONFLICT (id) DO NOTHING`,
    [emptyPeriodId, emptyLabel]
  );

  const res = await call('GET', `/api/cfo/overview?period=${emptyLabel}`, { cookie: ananya.cookie });
  assert.equal(res.status, 200);
  const ov = res.body.overview;
  assert.equal(ov.recognisedRevenue, 0, 'Zero recognised revenue must remain genuine 0');
  assert.equal(ov.cashReceipts, 0, 'Zero cash receipts must remain genuine 0');
  assert.equal(ov.outstandingReceivables, 0, 'Zero receivables must remain genuine 0');
  assert.equal(ov.unmatchedCash, 0, 'Zero unmatched cash must remain genuine 0');

  // Also verify vertical summary has genuine 0s
  for (const v of ov.verticalSummary) {
    assert.equal(v.recognisedRevenue, 0);
    assert.equal(v.outstandingReceivables, 0);
  }
});

test('CFO Hardening 2: Changed underlying records change totals and reconciliation dynamically', async () => {
  const hardeningPeriod = `PER-DYN-${RUN}`;
  const hardeningLabel = `FY28-Q1-${RUN}`;
  await db.query(
    `INSERT INTO reporting_periods (id, period_label, start_date, end_date, status, lock_governed_writes)
     VALUES ($1, $2, '2028-04-01', '2028-06-30', 'open', false) ON CONFLICT (id) DO NOTHING`,
    [hardeningPeriod, hardeningLabel]
  );

  const ovBefore = (await call('GET', `/api/cfo/overview?period=${hardeningLabel}&vertical=wealth`, { cookie: ananya.cookie })).body.overview;
  const initialRevenue = ovBefore.recognisedRevenue;

  // Insert a new revenue recognition entry of net 125,000 prepared by Priya
  const prepRes = await call('POST', '/api/cfo/ledger/recognition/prepare', {
    cookie: priya.cookie,
    json: {
      periodId: hardeningLabel,
      vertical: 'wealth',
      grossAmount: 150000,
      taxAmount: 25000,
      policyCode: 'REV-POL-2026',
      sourceReferenceType: 'invoice',
      sourceReferenceId: `INV-DYNAMIC-${RUN}`,
      accountCode: 'REV-4001',
      description: `Dynamic record update test ${RUN}`,
    },
  });
  assert.equal(prepRes.status, 201);
  const prepEntry = prepRes.body.entry;

  // Unapproved pending entry does NOT affect posted overview
  const ovMid = (await call('GET', `/api/cfo/overview?period=${hardeningLabel}&vertical=wealth`, { cookie: ananya.cookie })).body.overview;
  assert.equal(ovMid.recognisedRevenue, initialRevenue, 'Unapproved pending entry must not affect recognised revenue');

  // Independent approval by Ananya
  const apprRes = await call('POST', `/api/cfo/ledger/recognition/${prepEntry.id}/approve`, {
    cookie: ananya.cookie,
  });
  assert.equal(apprRes.status, 200);

  // Overview must immediately reflect increased recognised revenue
  const ovAfter = (await call('GET', `/api/cfo/overview?period=${hardeningLabel}&vertical=wealth`, { cookie: ananya.cookie })).body.overview;
  assert.equal(ovAfter.recognisedRevenue, initialRevenue + 125000, 'Totals must dynamically change when underlying records change');
});

test('CFO Hardening 3: Period and vertical selection strictly scopes calculations', async () => {
  const wealthOv = (await call('GET', '/api/cfo/overview?period=FY26-Q1&vertical=wealth', { cookie: ananya.cookie })).body.overview;
  const bankingOv = (await call('GET', '/api/cfo/overview?period=FY26-Q1&vertical=banking', { cookie: ananya.cookie })).body.overview;

  // Wealth has seeded entries in Q1 (ENT-001, etc.), Banking has 0 ledger entries in Q1
  assert.ok(wealthOv.recognisedRevenue > 0, 'Wealth revenue in Q1 should reflect wealth ledger entries');
  assert.equal(bankingOv.recognisedRevenue, 0, 'Banking revenue in Q1 should be 0 because no banking ledger entries exist');
  assert.notEqual(wealthOv.recognisedRevenue, bankingOv.recognisedRevenue);
});

test('CFO Hardening 4: Independent preparation and approval lifecycle, self-approval prevention, and OCC versioning', async () => {
  const hardeningPeriod = `PER-AUTH-${RUN}`;
  const hardeningLabel = `FY28-Q2-${RUN}`;
  await db.query(
    `INSERT INTO reporting_periods (id, period_label, start_date, end_date, status, lock_governed_writes)
     VALUES ($1, $2, '2028-07-01', '2028-09-30', 'open', false) ON CONFLICT (id) DO NOTHING`,
    [hardeningPeriod, hardeningLabel]
  );

  // 4a. Client-forged preparer attribution is ignored; authenticated preparer (Priya, EMP-012) is persisted
  const forgedPrep = await call('POST', '/api/cfo/ledger/recognition/prepare', {
    cookie: priya.cookie,
    json: {
      periodId: hardeningLabel,
      vertical: 'wealth',
      grossAmount: 100000,
      taxAmount: 18000,
      policyCode: 'REV-POL-2026',
      sourceReferenceType: 'deal',
      sourceReferenceId: `FORGED-REV-${RUN}`,
      accountCode: 'REV-4001',
      description: `Forged preparer test ${RUN}`,
      preparedByEmployeeId: 'EMP-011', // Client attempts to forge preparer as Ananya
    },
  });
  assert.equal(forgedPrep.status, 201);
  const forgedEntry = forgedPrep.body.entry;
  assert.equal(forgedEntry.status, 'pending_approval');
  assert.equal(forgedEntry.recordVersion, 1);

  // Authoritative database check: preparer is Priya (EMP-012), NOT client-supplied EMP-011
  const dbEntry = await db.query(`SELECT prepared_by_employee_id FROM finance_ledger_entries WHERE id = $1`, [forgedEntry.id]);
  assert.equal(dbEntry.rows[0].prepared_by_employee_id, 'EMP-012', 'Database must persist authenticated preparer identity');

  // 4b. Self-approval is strictly forbidden: Priya attempts to approve her own prepared entry -> 403
  const selfAppr = await call('POST', `/api/cfo/ledger/recognition/${forgedEntry.id}/approve`, {
    cookie: priya.cookie,
  });
  assert.equal(selfAppr.status, 403, 'Self-approval must return 403 Forbidden [Deck P230]');

  // 4c. Approval without submitted record -> 404
  const noRecordAppr = await call('POST', `/api/cfo/ledger/recognition/LEDG-NON-EXISTENT-${RUN}/approve`, {
    cookie: ananya.cookie,
  });
  assert.equal(noRecordAppr.status, 404, 'Approval without submitted record must return 404 [Deck P230]');

  // 4d. Changed / stale inputs: OCC version mismatch -> 409 Conflict
  const staleAppr = await call('POST', `/api/cfo/ledger/recognition/${forgedEntry.id}/approve`, {
    cookie: ananya.cookie,
    json: { expectedRecordVersion: 99 },
  });
  assert.equal(staleAppr.status, 409, 'OCC version conflict must return 409 Conflict [Deck P230]');

  // 4e. Independent approval by Ananya (CFO) succeeds with expectedRecordVersion = 1
  const validAppr = await call('POST', `/api/cfo/ledger/recognition/${forgedEntry.id}/approve`, {
    cookie: ananya.cookie,
    json: { expectedRecordVersion: 1 },
  });
  assert.equal(validAppr.status, 200);
  assert.equal(validAppr.body.entry.status, 'posted');
  assert.equal(validAppr.body.entry.recordVersion, 2);

  // 4f. Duplicate approval is rejected -> 400
  const dupAppr = await call('POST', `/api/cfo/ledger/recognition/${forgedEntry.id}/approve`, {
    cookie: ananya.cookie,
  });
  assert.equal(dupAppr.status, 400, 'Duplicate approval on already posted entry must return 400 [Deck P230]');

  // 4g. Credit Note Two-User Journey & Self-Approval Prevention [Deck P246]
  const cnPrep = await call('POST', '/api/cfo/ledger/credit-note/prepare', {
    cookie: priya.cookie,
    json: {
      originalEntryId: forgedEntry.id,
      reversalReason: `Billing adjustment two-user test ${RUN}`,
      policyCode: 'REV-POL-2026',
      creditAmount: 50000,
    },
  });
  assert.equal(cnPrep.status, 201);
  const cnEntryId = cnPrep.body.entry.id;
  assert.equal(cnPrep.body.entry.status, 'pending_approval');

  // Priya self-approval of credit note -> 403 Forbidden
  const cnSelf = await call('POST', `/api/cfo/ledger/credit-note/${cnEntryId}/approve`, {
    cookie: priya.cookie,
  });
  assert.equal(cnSelf.status, 403, 'Credit note self-approval must return 403 Forbidden [Deck P246]');

  // Ananya independent approval of credit note succeeds
  const cnAppr = await call('POST', `/api/cfo/ledger/credit-note/${cnEntryId}/approve`, {
    cookie: ananya.cookie,
    json: { expectedRecordVersion: 1 },
  });
  assert.equal(cnAppr.status, 200);
  assert.equal(cnAppr.body.entry.status, 'posted');
  assert.equal(cnAppr.body.entry.recordVersion, 2);

  // Duplicate credit note approval -> 400
  const cnDup = await call('POST', `/api/cfo/ledger/credit-note/${cnEntryId}/approve`, {
    cookie: ananya.cookie,
  });
  assert.equal(cnDup.status, 400, 'Duplicate credit note approval must return 400');

  // 4h. Sales Handoff: Sales rep cannot verify own handoff
  await db.query(
    `INSERT INTO sales_finance_handoffs (id, handoff_code, lead_id, vertical, sales_rep_employee_id, converted_amount, earning_milestone, review_status)
     VALUES ($1, $2, 'FV-1001', 'wealth', 'EMP-011', 100000.00, 'mandate_signed', 'pending_verification')`,
    [`SFH-SELF-${RUN}`, `SFH-CODE-${RUN}`]
  );
  const selfHandoff = await call('POST', `/api/cfo/handoffs/SFH-SELF-${RUN}/verify`, {
    cookie: ananya.cookie,
    json: { decision: 'accepted_for_processing' },
  });
  assert.equal(selfHandoff.status, 403, 'Sales rep cannot self-verify handoff [Deck P228]');

  // 4i. Incentive Dispute: Employee cannot self-resolve dispute
  await db.query(
    `INSERT INTO incentive_disputes (id, dispute_code, calculation_id, employee_id, disputed_amount, employee_claim, status)
     VALUES ($1, $2, 'INC-001', 'EMP-011', 15000.00, 'Self dispute test', 'open')`,
    [`DISP-SELF-${RUN}`, `DISP-CODE-${RUN}`]
  );
  const selfDisp = await call('POST', `/api/cfo/incentives/disputes/DISP-SELF-${RUN}/resolve`, {
    cookie: ananya.cookie,
    json: { resolution: 'resolved_upheld', resolutionAmount: 15000, decisionNotes: 'Self resolution' },
  });
  assert.equal(selfDisp.status, 403, 'Employee cannot self-resolve incentive dispute [Deck P248]');
});

test('CFO Hardening 5: Exact monetary calculations cover fractional paise values without floating-point errors', async () => {
  const hardeningPeriod = `PER-FRAC-${RUN}`;
  const hardeningLabel = `FY28-Q3-${RUN}`;
  await db.query(
    `INSERT INTO reporting_periods (id, period_label, start_date, end_date, status, lock_governed_writes)
     VALUES ($1, $2, '2028-10-01', '2028-12-31', 'open', false) ON CONFLICT (id) DO NOTHING`,
    [hardeningPeriod, hardeningLabel]
  );

  // Test fractional amounts: gross 1000.75, tax 180.14 -> net 820.61
  const fracPrep = await call('POST', '/api/cfo/ledger/recognition/prepare', {
    cookie: priya.cookie,
    json: {
      periodId: hardeningLabel,
      vertical: 'wealth',
      grossAmount: 1000.75,
      taxAmount: 180.14,
      policyCode: 'REV-POL-2026',
      sourceReferenceType: 'deal',
      sourceReferenceId: `FRAC-REV-${RUN}`,
      accountCode: 'REV-4001',
      description: `Fractional precision money test ${RUN}`,
    },
  });
  assert.equal(fracPrep.status, 201);
  assert.equal(fracPrep.body.entry.netAmount, 820.61, '1000.75 - 180.14 must be exactly 820.61 with integer paise precision');

  const fracAppr = await call('POST', `/api/cfo/ledger/recognition/${fracPrep.body.entry.id}/approve`, {
    cookie: ananya.cookie,
  });
  assert.equal(fracAppr.status, 200);

  // Verify in PostgreSQL numeric(14,2) column that exact 820.61 is persisted
  const rowRes = await db.query(`SELECT net_amount::text AS net FROM finance_ledger_entries WHERE id = $1`, [fracPrep.body.entry.id]);
  assert.equal(rowRes.rows[0].net, '820.61');
});

test('CFO Hardening 6: Positive and negative residuals and missing required policy strictly block certification', async () => {
  // Setup period for certification failure tests
  const testPeriodId = `PER-CERT-FAIL-${RUN}`;
  await db.query(
    `INSERT INTO reporting_periods (id, period_label, start_date, end_date, status)
     VALUES ($1, $2, '2025-04-01', '2025-06-30', 'open') ON CONFLICT (id) DO NOTHING`,
    [testPeriodId, `FY25-Q1-FAIL-${RUN}`]
  );

  // 6a. Positive unexplained residual: Sales closed handoff (50,000) with 0 recognized revenue produces +50,000 variance
  await db.query(
    `INSERT INTO sales_finance_handoffs (id, handoff_code, lead_id, vertical, sales_rep_employee_id, converted_amount, earning_milestone, review_status, created_at)
     VALUES ($1, $2, 'FV-1001', 'wealth', 'EMP-001', 50000.00, 'mandate_signed', 'accepted_for_processing', '2025-05-05')`,
    [`SFH-DEF-${RUN}`, `SFH-DEF-CODE-${RUN}`]
  );

  // Freeze reconciliation for this period
  const freezePos = await call('POST', '/api/cfo/reconciliations/freeze', {
    cookie: ananya.cookie,
    json: {
      periodId: testPeriodId,
      explanationNotes: 'Freeze with positive unexplained residual',
    },
  });
  assert.equal(freezePos.status, 200);
  assert.equal(freezePos.body.reconciliation.unexplainedVariance, 50000, 'Positive residual must equal 50000');

  // Attempt period certification -> must fail with 400 due to positive unexplained variance
  const certPosRes = await call('POST', `/api/cfo/periods/${testPeriodId}/certify`, {
    cookie: ananya.cookie,
    json: {
      checklistState: {
        reconciliations_passed: true,
        exceptions_reviewed: true,
        ledger_balanced: true,
        tax_provisioned: true,
      },
      certificationNotes: 'Attempt certify with positive variance',
    },
  });
  assert.equal(certPosRes.status, 400);
  assert.ok(certPosRes.body.error?.message?.includes('unexplained variance'), 'Positive unexplained variance blocks certification');

  // 6b. Negative unexplained residual: Period with recognized revenue but 0 sales handoffs produces negative variance
  const negPeriodId = `PER-CERT-NEG-${RUN}`;
  await db.query(
    `INSERT INTO reporting_periods (id, period_label, start_date, end_date, status)
     VALUES ($1, $2, '2025-01-01', '2025-03-31', 'open') ON CONFLICT (id) DO NOTHING`,
    [negPeriodId, `FY25-Q4-NEG-${RUN}`]
  );

  // Insert posted ledger entry with no sales handoffs
  await db.query(
    `INSERT INTO finance_ledger_entries (id, entry_code, period_id, entry_type, vertical, gross_amount, tax_amount, net_amount, policy_code, source_reference_type, source_reference_id, account_code, description, prepared_by_employee_id, approved_by_employee_id, approved_at, status, record_version, created_at)
     VALUES ($1, $2, $3, 'revenue_recognition', 'wealth', 40000.00, 0.00, 40000.00, 'REV-POL-2026', 'deal', 'DEAL-NEG-1', 'REV-4001', 'Negative residual revenue', 'EMP-001', 'EMP-011', NOW(), 'posted', 2, '2025-02-15')`,
    [`LEDG-NEG-${RUN}`, `ENT-NEG-${RUN}`, negPeriodId]
  );

  const freezeNeg = await call('POST', '/api/cfo/reconciliations/freeze', {
    cookie: ananya.cookie,
    json: {
      periodId: negPeriodId,
      explanationNotes: 'Freeze with negative unexplained residual',
    },
  });
  assert.equal(freezeNeg.status, 200);
  assert.equal(freezeNeg.body.reconciliation.unexplainedVariance, -40000, 'Sales 0 - Revenue 40000 must produce -40000');

  // Attempt period certification -> must fail with 400 because absolute variance |-40000| > 0
  const certNegRes = await call('POST', `/api/cfo/periods/${negPeriodId}/certify`, {
    cookie: ananya.cookie,
    json: {
      certificationNotes: 'Attempt certify with negative variance',
    },
  });
  assert.equal(certNegRes.status, 400);
  assert.ok(certNegRes.body.error?.message?.includes('unexplained variance'), 'Negative unexplained variance blocks certification');

  // 6c. Untrusted client checklist booleans: client passes all true booleans but server checks reject
  const untrustedRes = await call('POST', `/api/cfo/periods/${negPeriodId}/certify`, {
    cookie: ananya.cookie,
    json: {
      checklistState: {
        reconciliations_passed: true,
        exceptions_reviewed: true,
        ledger_balanced: true,
        tax_provisioned: true,
      },
      certificationNotes: 'Attempt client checklist bypass',
    },
  });
  assert.equal(untrustedRes.status, 400, 'Client checklist booleans must not override server check failures');

  // 6d. Missing required policy: deactivate DoA policy temporarily
  // Reconcile negPeriodId to 0 by adding sales handoff
  await db.query(
    `INSERT INTO sales_finance_handoffs (id, handoff_code, lead_id, vertical, sales_rep_employee_id, converted_amount, earning_milestone, review_status, created_at)
     VALUES ($1, $2, 'FV-1001', 'wealth', 'EMP-001', 40000.00, 'mandate_signed', 'accepted_for_processing', '2025-02-15')`,
    [`SFH-BAL-${RUN}`, `SFH-BAL-CODE-${RUN}`]
  );
  await call('POST', '/api/cfo/reconciliations/freeze', {
    cookie: ananya.cookie,
    json: { periodId: negPeriodId, explanationNotes: 'Balanced freeze' },
  });

  await db.query(`UPDATE finance_policies SET status = 'draft' WHERE category = 'delegation_of_authority'`);
  try {
    const certPolicyRes = await call('POST', `/api/cfo/periods/${negPeriodId}/certify`, {
      cookie: ananya.cookie,
      json: {
        certificationNotes: 'Attempt certify without DoA policy',
      },
    });
    assert.equal(certPolicyRes.status, 400);
    assert.ok(certPolicyRes.body.error?.message?.includes('missing required active finance governance policies'), 'Missing DoA policy must block certification');
  } finally {
    await db.query(`UPDATE finance_policies SET status = 'active' WHERE category = 'delegation_of_authority'`);
  }
});

test('CFO Hardening 7: Reconciliation scoping by period boundaries and concurrent freeze protection', async () => {
  const scopePeriodId = `PER-SCOPE-${RUN}`;
  const scopeLabel = `FY29-Q2-${RUN}`;
  await db.query(
    `INSERT INTO reporting_periods (id, period_label, start_date, end_date, status)
     VALUES ($1, $2, '2029-04-01', '2029-06-30', 'open') ON CONFLICT (id) DO NOTHING`,
    [scopePeriodId, scopeLabel]
  );

  // Insert sales handoff outside period boundaries (e.g. 2029-07-15 is Q3)
  await db.query(
    `INSERT INTO sales_finance_handoffs (id, handoff_code, lead_id, vertical, sales_rep_employee_id, converted_amount, earning_milestone, review_status, created_at)
     VALUES ($1, $2, 'FV-1001', 'wealth', 'EMP-001', 99000.00, 'mandate_signed', 'accepted_for_processing', '2029-07-15')`,
    [`SFH-OUTSIDE-${RUN}`, `SFH-OUT-CODE-${RUN}`]
  );

  // Freeze reconciliation for Q2: outside record must be excluded (salesClosedWinsTotal remains 0)
  const freezeScoped = await call('POST', '/api/cfo/reconciliations/freeze', {
    cookie: ananya.cookie,
    json: {
      periodId: scopePeriodId,
      explanationNotes: 'Cross-period boundary scoping verification',
    },
  });
  assert.equal(freezeScoped.status, 200);
  assert.equal(freezeScoped.body.reconciliation.salesClosedWinsTotal, 0, 'Records outside documented period boundaries must be excluded');

  // Concurrent freeze protection: call freeze concurrently using Promise.all
  // The transaction lock (SELECT FOR UPDATE on reporting_periods) guarantees monotonic version allocation without race condition
  const [f1, f2] = await Promise.all([
    call('POST', '/api/cfo/reconciliations/freeze', {
      cookie: ananya.cookie,
      json: { periodId: scopePeriodId, explanationNotes: 'Concurrent freeze 1' },
    }),
    call('POST', '/api/cfo/reconciliations/freeze', {
      cookie: ananya.cookie,
      json: { periodId: scopePeriodId, explanationNotes: 'Concurrent freeze 2' },
    }),
  ]);
  assert.equal(f1.status, 200);
  assert.equal(f2.status, 200);
  const v1 = f1.body.reconciliation.version;
  const v2 = f2.body.reconciliation.version;
  assert.notEqual(v1, v2, 'Concurrent freezes must receive distinct, monotonic versions');
});

test('CFO Hardening 8: Close certification scope completeness across active verticals and staleness rejection', async () => {
  const compPeriodId = `PER-COMP-${RUN}`;
  const compLabel = `FY29-Q4-${RUN}`;
  await db.query(
    `INSERT INTO reporting_periods (id, period_label, start_date, end_date, status)
     VALUES ($1, $2, '2029-10-01', '2029-12-31', 'open') ON CONFLICT (id) DO NOTHING`,
    [compPeriodId, compLabel]
  );

  // 8a. Reject period certification when no reconciliations exist at all
  const noReconCert = await call('POST', `/api/cfo/periods/${compPeriodId}/certify`, {
    cookie: ananya.cookie,
    json: { certificationNotes: 'Premature certification with zero reconciliations' },
  });
  assert.equal(noReconCert.status, 400);
  assert.ok(noReconCert.body.error?.message?.includes('no completed frozen reconciliations'), 'Missing reconciliation must return 400');

  // Insert activity in BOTH wealth and banking
  await db.query(
    `INSERT INTO finance_ledger_entries (id, entry_code, period_id, entry_type, vertical, gross_amount, tax_amount, net_amount, policy_code, source_reference_type, source_reference_id, account_code, description, prepared_by_employee_id, approved_by_employee_id, approved_at, status, record_version, created_at)
     VALUES
       ($1, $2, $5, 'revenue_recognition', 'wealth', 50000, 0, 50000, 'REV-POL-2026', 'deal', 'D1', 'REV-4001', 'Wealth rev', 'EMP-001', 'EMP-011', NOW(), 'posted', 2, '2029-10-15'),
       ($3, $4, $5, 'revenue_recognition', 'banking', 70000, 0, 70000, 'REV-POL-2026', 'deal', 'D2', 'REV-4001', 'Banking rev', 'EMP-001', 'EMP-011', NOW(), 'posted', 2, '2029-10-16')`,
    [`LEDG-W-${RUN}`, `ENT-W-${RUN}`, `LEDG-B-${RUN}`, `ENT-B-${RUN}`, compPeriodId]
  );

  // Freeze ONLY wealth reconciliation
  await call('POST', '/api/cfo/reconciliations/freeze', {
    cookie: ananya.cookie,
    json: { periodId: compPeriodId, vertical: 'wealth', explanationNotes: 'Only wealth reconciled' },
  });

  // 8b. Reject certification due to incomplete vertical scope (banking is missing)
  const incompleteScopeCert = await call('POST', `/api/cfo/periods/${compPeriodId}/certify`, {
    cookie: ananya.cookie,
    json: { certificationNotes: 'Certify with incomplete vertical scope' },
  });
  assert.equal(incompleteScopeCert.status, 400);
  assert.ok(incompleteScopeCert.body.error?.message?.includes("missing frozen reconciliation for active vertical 'banking'"), 'Incomplete scope must return 400');

  // Freeze banking reconciliation as well
  await call('POST', '/api/cfo/reconciliations/freeze', {
    cookie: ananya.cookie,
    json: { periodId: compPeriodId, vertical: 'banking', explanationNotes: 'Banking now reconciled' },
  });

  // 8c. Staleness test: Post a new ledger entry AFTER the freeze
  await new Promise((r) => setTimeout(r, 50)); // Ensure distinct millisecond timestamp
  await db.query(
    `INSERT INTO finance_ledger_entries (id, entry_code, period_id, entry_type, vertical, gross_amount, tax_amount, net_amount, policy_code, source_reference_type, source_reference_id, account_code, description, prepared_by_employee_id, approved_by_employee_id, approved_at, status, record_version, created_at)
     VALUES ($1, $2, $3, 'revenue_recognition', 'wealth', 10000, 0, 10000, 'REV-POL-2026', 'deal', 'D3', 'REV-4001', 'Late wealth rev', 'EMP-001', 'EMP-011', NOW(), 'posted', 2, NOW())`,
    [`LEDG-LATE-${RUN}`, `ENT-LATE-${RUN}`, compPeriodId]
  );

  // Certify period -> must reject with 400 due to stale reconciliation
  const staleCert = await call('POST', `/api/cfo/periods/${compPeriodId}/certify`, {
    cookie: ananya.cookie,
    json: { certificationNotes: 'Certify with stale reconciliation' },
  });
  assert.equal(staleCert.status, 400);
  assert.ok(staleCert.body.error?.message?.includes('reconciliation is stale'), 'Stale reconciliation must return 400');
});

test('CFO Hardening 9: Policy honesty and governance configuration integrity [Deck P320 Category 3]', async () => {
  const policiesRes = await db.query(
    `SELECT id, policy_code, category, title, rules_summary, is_demo_policy, status
     FROM finance_policies
     WHERE id IN ('POL-001', 'POL-002', 'POL-003', 'POL-004')
     ORDER BY id`
  );
  assert.equal(policiesRes.rows.length, 4, 'Must have all 4 governed policies configured');

  const pol1 = policiesRes.rows.find((p) => p.id === 'POL-001')!;
  const pol2 = policiesRes.rows.find((p) => p.id === 'POL-002')!;
  const pol3 = policiesRes.rows.find((p) => p.id === 'POL-003')!;
  const pol4 = policiesRes.rows.find((p) => p.id === 'POL-004')!;

  // Demo policy honesty: must be explicitly marked as demo policies
  assert.equal(pol1.is_demo_policy, true, 'POL-001 must be flagged as demo policy');
  assert.equal(pol2.is_demo_policy, true, 'POL-002 must be flagged as demo policy');
  assert.equal(pol3.is_demo_policy, true, 'POL-003 must be flagged as demo policy');
  assert.equal(pol4.is_demo_policy, true, 'POL-004 must be flagged as demo policy pending Finverse client approval [Deck P320 Category 3]');

  // Summary honesty: must explicitly reference [Deck P320 Category 3] and clarify that 15% / 18% are illustrative demo assumptions
  assert.ok(pol2.rules_summary.includes('P320') || pol2.rules_summary.includes('illustrative'), 'Clawback policy summary must honestly declare illustrative status');
  assert.ok(pol3.rules_summary.includes('P320') || pol3.rules_summary.includes('illustrative'), 'Tax provision policy summary must honestly declare illustrative status');
  assert.ok(pol4.rules_summary.includes('P320') || pol4.rules_summary.includes('illustrative'), 'Close governance policy summary must honestly declare illustrative status');

  // POL-004 close governance policy status and config
  assert.equal(pol4.category, 'close_governance');
  assert.equal(pol4.status, 'draft');
});

test('CFO Hardening 10: Production gating blocks close certification when close governance policy is unapproved/demo', async () => {
  const prodPeriodId = `PER-PRODGATE-${RUN}`;
  await db.query(
    `INSERT INTO reporting_periods (id, period_label, start_date, end_date, status)
     VALUES ($1, $2, '2030-01-01', '2030-03-31', 'open') ON CONFLICT (id) DO NOTHING`,
    [prodPeriodId, `FY30-Q1-${RUN}`]
  );

  // Add sample activity & freeze
  await db.query(
    `INSERT INTO finance_ledger_entries (id, entry_code, period_id, entry_type, vertical, gross_amount, tax_amount, net_amount, policy_code, source_reference_type, source_reference_id, account_code, description, prepared_by_employee_id, approved_by_employee_id, approved_at, status, record_version, created_at)
     VALUES ($1, $2, $3, 'revenue_recognition', 'wealth', 100000, 18000, 100000, 'REV-2026-V1', 'invoice', 'INV-1', '4001', 'Desc', 'EMP-012', 'EMP-011', NOW(), 'posted', 1, '2030-01-15')`,
    [`LEDG-PROD-${RUN}`, `ENT-PROD-${RUN}`, prodPeriodId]
  );

  await call('POST', '/api/cfo/reconciliations/freeze', {
    cookie: ananya.cookie,
    json: { periodId: prodPeriodId, vertical: 'wealth', explanationNotes: 'Wealth freeze' },
  });

  // Attempt to certify with x-governance-mode: production header
  const prodCertRes = await call('POST', `/api/cfo/periods/${prodPeriodId}/certify`, {
    cookie: ananya.cookie,
    headers: { 'x-governance-mode': 'production' },
    json: { certificationNotes: 'Production close attempt' },
  });
  assert.equal(prodCertRes.status, 400);
  assert.ok(
    prodCertRes.body.error?.message?.includes('client-approved') ||
    prodCertRes.body.error?.message?.includes('production'),
    'Production mode must reject certification when only demo/unapproved policies exist'
  );
});

test('CFO Hardening 11: Reconciliation freshness: older Wealth freeze + newer Banking freeze, then mutate Wealth data (updates to existing records)', async () => {
  const freshPeriodId = `PER-FRESH-${RUN}`;
  await db.query(
    `INSERT INTO reporting_periods (id, period_label, start_date, end_date, status)
     VALUES ($1, $2, '2030-04-01', '2030-06-30', 'open') ON CONFLICT (id) DO NOTHING`,
    [freshPeriodId, `FY30-Q2-${RUN}`]
  );

  const wealthLedgerId = `LEDG-FW-${RUN}`;
  await db.query(
    `INSERT INTO finance_ledger_entries (id, entry_code, period_id, entry_type, vertical, gross_amount, tax_amount, net_amount, policy_code, source_reference_type, source_reference_id, account_code, description, prepared_by_employee_id, approved_by_employee_id, approved_at, status, record_version, created_at)
     VALUES
       ($1, $2, $5, 'revenue_recognition', 'wealth', 50000, 9000, 50000, 'REV-2026-V1', 'invoice', 'INV-FW', '4001', 'Wealth base', 'EMP-012', 'EMP-011', NOW(), 'posted', 1, '2030-04-10'),
       ($3, $4, $5, 'revenue_recognition', 'banking', 60000, 10800, 60000, 'REV-2026-V1', 'invoice', 'INV-FB', '4101', 'Banking base', 'EMP-012', 'EMP-011', NOW(), 'posted', 1, '2030-04-12')`,
    [wealthLedgerId, `ENT-FW-${RUN}`, `LEDG-FB-${RUN}`, `ENT-FB-${RUN}`, freshPeriodId]
  );

  // 1. Freeze wealth first (older freeze)
  const wFreeze = await call('POST', '/api/cfo/reconciliations/freeze', {
    cookie: ananya.cookie,
    json: { periodId: freshPeriodId, vertical: 'wealth', explanationNotes: 'Wealth freeze older' },
  });
  assert.equal(wFreeze.status, 200);

  await new Promise((r) => setTimeout(r, 60));

  // 2. Freeze banking second (newer freeze)
  const bFreeze = await call('POST', '/api/cfo/reconciliations/freeze', {
    cookie: ananya.cookie,
    json: { periodId: freshPeriodId, vertical: 'banking', explanationNotes: 'Banking freeze newer' },
  });
  assert.equal(bFreeze.status, 200);

  await new Promise((r) => setTimeout(r, 60));

  // 3. Mutate EXISTING Wealth entry (update amount & record_version)
  await db.query(
    `UPDATE finance_ledger_entries
     SET gross_amount = 75000, net_amount = 75000, record_version = record_version + 1, updated_at = NOW()
     WHERE id = $1`,
    [wealthLedgerId]
  );

  // 4. Certify period close -> must detect that Wealth snapshot is stale!
  const certRes = await call('POST', `/api/cfo/periods/${freshPeriodId}/certify`, {
    cookie: ananya.cookie,
    json: { certificationNotes: 'Close after Wealth mutation' },
  });
  assert.equal(certRes.status, 400);
  assert.ok(
    certRes.body.error?.message?.includes("reconciliation is stale for vertical 'wealth'"),
    'Must reject certification with stale Wealth reconciliation after mutation to existing record'
  );
});

test('CFO Hardening 12: Evidence-based tax provisioning check: period with revenue but missing tax evidence is rejected', async () => {
  const taxPeriodId = `PER-NOTAX-${RUN}`;
  await db.query(
    `INSERT INTO reporting_periods (id, period_label, start_date, end_date, status)
     VALUES ($1, $2, '2030-07-01', '2030-09-30', 'open') ON CONFLICT (id) DO NOTHING`,
    [taxPeriodId, `FY30-Q3-${RUN}`]
  );

  // Insert revenue entry with tax_amount = 0 (no tax provisioned)
  await db.query(
    `INSERT INTO finance_ledger_entries (id, entry_code, period_id, entry_type, vertical, gross_amount, tax_amount, net_amount, policy_code, source_reference_type, source_reference_id, account_code, description, prepared_by_employee_id, approved_by_employee_id, approved_at, status, record_version, created_at)
     VALUES ($1, $2, $3, 'revenue_recognition', 'wealth', 80000, 0, 80000, 'REV-2026-V1', 'invoice', 'INV-NT', '4001', 'No tax entry', 'EMP-012', 'EMP-011', NOW(), 'posted', 1, '2030-07-15')`,
    [`LEDG-NT-${RUN}`, `ENT-NT-${RUN}`, taxPeriodId]
  );

  await call('POST', '/api/cfo/reconciliations/freeze', {
    cookie: ananya.cookie,
    json: { periodId: taxPeriodId, vertical: 'wealth', explanationNotes: 'Freeze without tax' },
  });

  const certRes = await call('POST', `/api/cfo/periods/${taxPeriodId}/certify`, {
    cookie: ananya.cookie,
    json: {
      certificationNotes: 'Attempt close without tax provisioning',
      preCloseChecklist: {
        reconciliationsPassed: true,
        exceptionsReviewed: true,
        ledgerBalanced: true,
        taxProvisioned: false, // honest submission reflecting missing tax
      },
    },
  });
  assert.equal(certRes.status, 400);
  assert.ok(
    certRes.body.error?.message?.includes('checklist') || certRes.body.error?.message?.includes('tax'),
    'Missing tax provisioning evidence must reject certification'
  );
});

test('CFO Hardening 13: Preparation, dual-control independent approval, self-approval prevention (403), conflict handling (409)', async () => {
  const dualPeriodId = `PER-DUAL-${RUN}`;
  await db.query(
    `INSERT INTO reporting_periods (id, period_label, start_date, end_date, status)
     VALUES ($1, $2, '2030-10-01', '2030-12-31', 'open') ON CONFLICT (id) DO NOTHING`,
    [dualPeriodId, `FY30-Q4-${RUN}`]
  );

  // 1. Priya (preparer) prepares revenue recognition
  const prepRes = await call('POST', '/api/cfo/ledger/recognition/prepare', {
    cookie: priya.cookie,
    json: {
      periodId: dualPeriodId,
      vertical: 'wealth',
      grossAmount: 120000,
      taxAmount: 21600,
      policyCode: 'REV-2026-V1',
      sourceReferenceType: 'invoice',
      sourceReferenceId: `INV-DUAL-${RUN}`,
      accountCode: '4001-WEALTH-PMS',
      description: 'Prepared by Priya for dual control test',
    },
  });
  assert.equal(prepRes.status, 201);
  const entry = prepRes.body.entry;
  assert.equal(entry.status, 'pending_approval');
  assert.equal(entry.preparedByEmployeeId, 'EMP-012');
  assert.equal(entry.recordVersion, 1);

  // 2. Priya attempts to self-approve -> must return 403 Forbidden [Deck P230]
  const selfApproveRes = await call('POST', `/api/cfo/ledger/recognition/${entry.id}/approve`, {
    cookie: priya.cookie,
    json: { expectedRecordVersion: 1 },
  });
  assert.equal(selfApproveRes.status, 403);
  assert.ok(
    selfApproveRes.body.error?.message?.includes('Self-approval') ||
    selfApproveRes.body.error?.message?.includes('P230'),
    'Self-approval must return 403 forbidden'
  );

  // 3. Independent reviewer (Ananya) passes stale expected version -> returns 409 Conflict
  const staleApproveRes = await call('POST', `/api/cfo/ledger/recognition/${entry.id}/approve`, {
    cookie: ananya.cookie,
    json: { expectedRecordVersion: 999 },
  });
  assert.equal(staleApproveRes.status, 409);
  assert.ok(
    staleApproveRes.body.error?.message?.includes('version') ||
    staleApproveRes.body.error?.message?.includes('conflict'),
    'Stale expected version must return 409 conflict'
  );

  // 4. Ananya approves with correct version 1 -> succeeds with 200
  const approveRes = await call('POST', `/api/cfo/ledger/recognition/${entry.id}/approve`, {
    cookie: ananya.cookie,
    json: { expectedRecordVersion: 1 },
  });
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.entry.status, 'posted');
  assert.equal(approveRes.body.entry.approvedByEmployeeId, 'EMP-011');
  assert.equal(approveRes.body.entry.recordVersion, 2);

  // 5. Dual control credit note preparation and independent approval
  const prepCnRes = await call('POST', '/api/cfo/ledger/credit-note/prepare', {
    cookie: priya.cookie,
    json: {
      originalEntryId: entry.id,
      creditAmount: 30000,
      policyCode: 'REV-2026-V1',
      reversalReason: 'Concession renegotiated approved under DoA',
    },
  });
  assert.equal(prepCnRes.status, 201);
  const cnEntry = prepCnRes.body.entry;
  assert.equal(cnEntry.status, 'pending_approval');
  assert.equal(cnEntry.preparedByEmployeeId, 'EMP-012');

  // Priya self-approval on credit note -> 403
  const selfApproveCn = await call('POST', `/api/cfo/ledger/credit-note/${cnEntry.id}/approve`, {
    cookie: priya.cookie,
    json: { expectedRecordVersion: 1 },
  });
  assert.equal(selfApproveCn.status, 403);

  // Ananya approves credit note -> 200
  const approveCn = await call('POST', `/api/cfo/ledger/credit-note/${cnEntry.id}/approve`, {
    cookie: ananya.cookie,
    json: { expectedRecordVersion: 1 },
  });
  assert.equal(approveCn.status, 200);
  assert.equal(approveCn.body.entry.status, 'posted');
  assert.equal(approveCn.body.entry.approvedByEmployeeId, 'EMP-011');
});
