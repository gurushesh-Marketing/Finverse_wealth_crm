import { Router, type Response, type NextFunction } from 'express';
import { requireSession, type AuthedRequest } from '../middleware/session';
import {
  VerifySalesHandoffInputSchema,
  PostRevenueRecognitionInputSchema,
  PostCreditNoteInputSchema,
  CreateInvoiceInputSchema,
  AssignCollectionInputSchema,
  ImportReceiptBatchInputSchema,
  MatchReceiptToInvoiceInputSchema,
  InvestigateUnmatchedInputSchema,
  FreezeReconciliationInputSchema,
  CreateRefundRequestInputSchema,
  DecideRefundInputSchema,
  FreezeIncentivePayoutInputSchema,
  ResolveIncentiveDisputeInputSchema,
  CertifyPeriodCloseInputSchema,
  CreatePeriodReopenRequestInputSchema,
  DecidePeriodReopenInputSchema,
  UpdateBudgetVarianceInputSchema,
  SubmitForecastConcurrenceInputSchema,
  CreateFinanceScheduleInputSchema,
  ProposeFinancePolicyInputSchema,
} from '@finverse/contracts';
import {
  getCfoBalancesOverview,
  getSalesHandoffs,
  verifySalesHandoff,
  getLedgerEntries,
  postRevenueRecognition,
  postCreditNote,
  getReceivableInvoices,
  createReceivableInvoice,
  assignCollectionWork,
  getAgeingBucketsSummary,
  getBankReceipts,
  importReceiptBatch,
  matchReceiptToInvoice,
  investigateUnmatchedReceipt,
  getFinanceReconciliations,
  freezeReconciliation,
  getRefundRequests,
  createRefundRequest,
  decideRefundRequest,
  getIncentiveCalculations,
  freezeIncentivePayout,
  getIncentiveDisputes,
  resolveIncentiveDispute,
  getReportingPeriods,
  certifyPeriodClose,
  getPeriodReopenRequests,
  createPeriodReopenRequest,
  decidePeriodReopenRequest,
  getVerticalBudgetLines,
  updateBudgetVarianceNotes,
  getForecastFinanceReviews,
  submitForecastConcurrence,
  getFinancePackPreview,
  generateFinancePackPdf,
  getFinancePackSchedules,
  createFinancePackSchedule,
  getFinancePolicies,
  proposeFinancePolicy,
} from '../repo/cfo';
import fs from 'fs';
import path from 'path';

export function createCfoRouter(): Router {
  const router = Router();

  // Authentication and role gate
  router.use(requireSession);
  router.use((req: AuthedRequest, res: Response, next: NextFunction) => {
    if (req.auth?.session.role !== 'CFO') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Chief Financial Officer role required.' } });
      return;
    }
    next();
  });

  // CFO-01: Balances Overview
  router.get('/overview', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const periodLabel = req.query.period as string | undefined;
      const overview = await getCfoBalancesOverview(periodLabel);
      res.json({ overview });
    } catch (err) {
      next(err);
    }
  });

  // CFO-02: Sales Handoffs
  router.get('/handoffs', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as string | undefined;
      const handoffs = await getSalesHandoffs(status);
      res.json({ handoffs });
    } catch (err) {
      next(err);
    }
  });

  router.post('/handoffs/:id/verify', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = VerifySalesHandoffInputSchema.parse(req.body);
      const handoff = await verifySalesHandoff(req.params.id, input, req.auth!.employeeId);
      res.json({ handoff });
    } catch (err) {
      next(err);
    }
  });

  // CFO-03 & CFO-11: Ledger & Recognition
  router.get('/ledger', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const periodId = req.query.periodId as string | undefined;
      const vertical = req.query.vertical as string | undefined;
      const entries = await getLedgerEntries(periodId, vertical);
      res.json({ entries });
    } catch (err) {
      next(err);
    }
  });

  router.post('/ledger/recognition', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = PostRevenueRecognitionInputSchema.parse(req.body);
      const entry = await postRevenueRecognition(input, req.auth!.employeeId);
      res.status(201).json({ entry });
    } catch (err) {
      next(err);
    }
  });

  router.post('/ledger/credit-note', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = PostCreditNoteInputSchema.parse(req.body);
      const entry = await postCreditNote(input, req.auth!.employeeId);
      res.status(201).json({ entry });
    } catch (err) {
      next(err);
    }
  });

  // CFO-04 & CFO-09: Receivable Invoices
  router.get('/invoices', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const periodId = req.query.periodId as string | undefined;
      const status = req.query.status as string | undefined;
      const invoices = await getReceivableInvoices(periodId, status);
      res.json({ invoices });
    } catch (err) {
      next(err);
    }
  });

  router.post('/invoices', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = CreateInvoiceInputSchema.parse(req.body);
      const invoice = await createReceivableInvoice(input, req.auth!.employeeId);
      res.status(201).json({ invoice });
    } catch (err) {
      next(err);
    }
  });

  router.post('/invoices/:id/collection', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = AssignCollectionInputSchema.parse(req.body);
      const invoice = await assignCollectionWork(req.params.id, input, req.auth!.employeeId);
      res.json({ invoice });
    } catch (err) {
      next(err);
    }
  });

  router.get('/invoices/ageing', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const summary = await getAgeingBucketsSummary();
      res.json({ summary });
    } catch (err) {
      next(err);
    }
  });

  // CFO-05, CFO-06, CFO-07: Bank Receipts & Payment Matching
  router.get('/receipts', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as string | undefined;
      const receipts = await getBankReceipts(status);
      res.json({ receipts });
    } catch (err) {
      next(err);
    }
  });

  router.post('/receipts/batch-import', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = ImportReceiptBatchInputSchema.parse(req.body);
      const result = await importReceiptBatch(input, req.auth!.employeeId);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/receipts/match', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = MatchReceiptToInvoiceInputSchema.parse(req.body);
      const match = await matchReceiptToInvoice(input, req.auth!.employeeId);
      res.json({ match });
    } catch (err) {
      next(err);
    }
  });

  router.post('/receipts/:id/investigate', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = InvestigateUnmatchedInputSchema.parse(req.body);
      const receipt = await investigateUnmatchedReceipt(req.params.id, input, req.auth!.employeeId);
      res.json({ receipt });
    } catch (err) {
      next(err);
    }
  });

  // CFO-08: Reconciliations
  router.get('/reconciliations', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const reconciliations = await getFinanceReconciliations();
      res.json({ reconciliations });
    } catch (err) {
      next(err);
    }
  });

  router.post('/reconciliations/freeze', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = FreezeReconciliationInputSchema.parse(req.body);
      const reconciliation = await freezeReconciliation(input, req.auth!.employeeId);
      res.json({ reconciliation });
    } catch (err) {
      next(err);
    }
  });

  // CFO-10: Refunds
  router.get('/refunds', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const status = req.query.status as string | undefined;
      const refunds = await getRefundRequests(status);
      res.json({ refunds });
    } catch (err) {
      next(err);
    }
  });

  router.post('/refunds', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = CreateRefundRequestInputSchema.parse(req.body);
      const refund = await createRefundRequest(input, req.auth!.employeeId);
      res.status(201).json({ refund });
    } catch (err) {
      next(err);
    }
  });

  router.post('/refunds/:id/decide', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = DecideRefundInputSchema.parse(req.body);
      const refund = await decideRefundRequest(req.params.id, input, req.auth!.employeeId);
      res.json({ refund });
    } catch (err) {
      next(err);
    }
  });

  // CFO-12 & CFO-13: Incentives
  router.get('/incentives', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const calculations = await getIncentiveCalculations();
      res.json({ calculations });
    } catch (err) {
      next(err);
    }
  });

  router.post('/incentives/:id/freeze', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = FreezeIncentivePayoutInputSchema.parse(req.body);
      const calculation = await freezeIncentivePayout(req.params.id, input, req.auth!.employeeId);
      res.json({ calculation });
    } catch (err) {
      next(err);
    }
  });

  router.get('/incentives/disputes', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const disputes = await getIncentiveDisputes();
      res.json({ disputes });
    } catch (err) {
      next(err);
    }
  });

  router.post('/incentives/disputes/:id/resolve', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = ResolveIncentiveDisputeInputSchema.parse(req.body);
      const dispute = await resolveIncentiveDispute(req.params.id, input, req.auth!.employeeId);
      res.json({ dispute });
    } catch (err) {
      next(err);
    }
  });

  // CFO-14 & CFO-15: Periods
  router.get('/periods', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const periods = await getReportingPeriods();
      res.json({ periods });
    } catch (err) {
      next(err);
    }
  });

  router.post('/periods/:id/certify', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = CertifyPeriodCloseInputSchema.parse(req.body);
      const period = await certifyPeriodClose(req.params.id, input, req.auth!.employeeId);
      res.json({ period });
    } catch (err) {
      next(err);
    }
  });

  router.get('/periods/reopen-requests', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const requests = await getPeriodReopenRequests();
      res.json({ requests });
    } catch (err) {
      next(err);
    }
  });

  router.post('/periods/reopen-requests', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = CreatePeriodReopenRequestInputSchema.parse(req.body);
      const request = await createPeriodReopenRequest(input, req.auth!.employeeId);
      res.status(201).json({ request });
    } catch (err) {
      next(err);
    }
  });

  router.post('/periods/reopen-requests/:id/decide', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = DecidePeriodReopenInputSchema.parse(req.body);
      const request = await decidePeriodReopenRequest(req.params.id, input, req.auth!.employeeId);
      res.json({ request });
    } catch (err) {
      next(err);
    }
  });

  // CFO-16: Budgets
  router.get('/budgets', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const fy = req.query.fiscalYear as string | undefined;
      const budgets = await getVerticalBudgetLines(fy);
      res.json({ budgets });
    } catch (err) {
      next(err);
    }
  });

  router.post('/budgets/:id/notes', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = UpdateBudgetVarianceInputSchema.parse(req.body);
      const budget = await updateBudgetVarianceNotes(req.params.id, input);
      res.json({ budget });
    } catch (err) {
      next(err);
    }
  });

  // CFO-17: Forecast Finance Reviews
  router.get('/forecasts', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const reviews = await getForecastFinanceReviews();
      res.json({ reviews });
    } catch (err) {
      next(err);
    }
  });

  router.post('/forecasts/concur', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = SubmitForecastConcurrenceInputSchema.parse(req.body);
      const review = await submitForecastConcurrence(input, req.auth!.employeeId);
      res.status(201).json({ review });
    } catch (err) {
      next(err);
    }
  });

  // CFO-18: Finance Pack Reports & Schedules
  router.get('/reports/preview', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const periodLabel = (req.query.period as string) || 'FY26-Q1';
      const preview = await getFinancePackPreview(periodLabel);
      res.json({ preview });
    } catch (err) {
      next(err);
    }
  });

  router.post('/reports/export-pdf', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const periodLabel = (req.body.periodLabel as string) || 'FY26-Q1';
      const result = await generateFinancePackPdf(periodLabel, req.auth!.displayName);
      res.json({
        downloadUrl: `/api/cfo/reports/download/${result.filename}`,
        filename: result.filename,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/reports/download/:filename', async (req: AuthedRequest, res: Response) => {
    const filepath = path.resolve(process.cwd(), 'data', 'cfo_exports', path.basename(req.params.filename));
    if (!fs.existsSync(filepath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    res.download(filepath);
  });

  router.get('/reports/schedules', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const schedules = await getFinancePackSchedules();
      res.json({ schedules });
    } catch (err) {
      next(err);
    }
  });

  router.post('/reports/schedules', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = CreateFinanceScheduleInputSchema.parse(req.body);
      const schedule = await createFinancePackSchedule(input);
      res.status(201).json({ schedule });
    } catch (err) {
      next(err);
    }
  });

  // CFO-19: Policies & Approval Limits
  router.get('/policies', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const policies = await getFinancePolicies();
      res.json({ policies });
    } catch (err) {
      next(err);
    }
  });

  router.post('/policies', async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const input = ProposeFinancePolicyInputSchema.parse(req.body);
      const policy = await proposeFinancePolicy(input, req.auth!.employeeId);
      res.status(201).json({ policy });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
