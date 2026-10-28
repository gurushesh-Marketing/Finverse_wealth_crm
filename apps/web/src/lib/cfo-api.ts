import {
  CfoBalancesOverview,
  CfoHandoffItem,
  VerifySalesHandoffInput,
  LedgerEntry,
  PostRevenueRecognitionInput,
  PostCreditNoteInput,
  PrepareRevenueRecognitionInput,
  ApproveRevenueRecognitionInput,
  PrepareCreditNoteInput,
  ApproveCreditNoteInput,
  ReceivableInvoice,
  CreateInvoiceInput,
  AssignCollectionInput,
  AgeingBucketsSummary,
  BankSettledReceipt,
  ImportReceiptBatchInput,
  MatchReceiptToInvoiceInput,
  InvestigateUnmatchedInput,
  FinanceReconciliation,
  FreezeReconciliationInput,
  RefundRequest,
  CreateRefundRequestInput,
  DecideRefundInput,
  IncentiveCalculation,
  FreezeIncentivePayoutInput,
  IncentiveDispute,
  ResolveIncentiveDisputeInput,
  ReportingPeriod,
  CertifyPeriodCloseInput,
  PeriodReopenRequest,
  CreatePeriodReopenRequestInput,
  DecidePeriodReopenInput,
  VerticalBudgetLine,
  UpdateBudgetVarianceInput,
  ForecastFinanceReview,
  SubmitForecastConcurrenceInput,
  FinancePackPreview,
  FinancePackSchedule,
  CreateFinanceScheduleInput,
  FinancePolicy,
  ProposeFinancePolicyInput,
} from '@finverse/contracts';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let errMessage = 'Request failed';
    try {
      const body = await res.json();
      errMessage = body?.error?.message || errMessage;
    } catch {
      // fallback
    }
    throw new Error(errMessage);
  }

  return res.json();
}

export const cfoApi = {
  // Scope
  async getScope(): Promise<{ scope: { role: string; verticals: string[]; activePeriods: any[]; currency: string } }> {
    return fetchJson('/api/cfo/scope');
  },

  // CFO-01: Balances Overview
  async getOverview(period?: string, vertical?: string): Promise<{ overview: CfoBalancesOverview }> {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    if (vertical) params.append('vertical', vertical);
    const q = params.toString() ? `?${params.toString()}` : '';
    return fetchJson(`/api/cfo/overview${q}`);
  },

  // CFO-02: Sales-to-Finance Handoffs
  async getHandoffs(status?: string): Promise<{ handoffs: CfoHandoffItem[] }> {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return fetchJson(`/api/cfo/handoffs${q}`);
  },

  async verifyHandoff(id: string, input: VerifySalesHandoffInput): Promise<{ handoff: CfoHandoffItem }> {
    return fetchJson(`/api/cfo/handoffs/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // CFO-03 & CFO-11: Ledger & Recognition
  async getLedger(periodId?: string, vertical?: string): Promise<{ entries: LedgerEntry[] }> {
    const params = new URLSearchParams();
    if (periodId) params.set('periodId', periodId);
    if (vertical) params.set('vertical', vertical);
    const q = params.toString() ? `?${params.toString()}` : '';
    return fetchJson(`/api/cfo/ledger${q}`);
  },

  async postRecognition(input: PostRevenueRecognitionInput): Promise<{ entry: LedgerEntry }> {
    return fetchJson('/api/cfo/ledger/recognition', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async postCreditNote(input: PostCreditNoteInput): Promise<{ entry: LedgerEntry }> {
    return fetchJson('/api/cfo/ledger/credit-note', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async prepareRecognition(input: PrepareRevenueRecognitionInput): Promise<{ entry: LedgerEntry }> {
    return fetchJson('/api/cfo/ledger/recognition/prepare', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async approveRecognition(id: string, input?: ApproveRevenueRecognitionInput): Promise<{ entry: LedgerEntry }> {
    return fetchJson(`/api/cfo/ledger/recognition/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(input || {}),
    });
  },

  async prepareCreditNote(input: PrepareCreditNoteInput): Promise<{ entry: LedgerEntry }> {
    return fetchJson('/api/cfo/ledger/credit-note/prepare', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async approveCreditNote(id: string, input?: ApproveCreditNoteInput): Promise<{ entry: LedgerEntry }> {
    return fetchJson(`/api/cfo/ledger/credit-note/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(input || {}),
    });
  },

  // CFO-04 & CFO-09: Receivable Invoices
  async getInvoices(periodId?: string, status?: string): Promise<{ invoices: ReceivableInvoice[] }> {
    const params = new URLSearchParams();
    if (periodId) params.set('periodId', periodId);
    if (status) params.set('status', status);
    const q = params.toString() ? `?${params.toString()}` : '';
    return fetchJson(`/api/cfo/invoices${q}`);
  },

  async createInvoice(input: CreateInvoiceInput): Promise<{ invoice: ReceivableInvoice }> {
    return fetchJson('/api/cfo/invoices', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async assignCollection(id: string, input: AssignCollectionInput): Promise<{ invoice: ReceivableInvoice }> {
    return fetchJson(`/api/cfo/invoices/${id}/collection`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getAgeingSummary(): Promise<{ summary: AgeingBucketsSummary }> {
    return fetchJson('/api/cfo/invoices/ageing');
  },

  // CFO-05, CFO-06, CFO-07: Bank Receipts & Payment Matching
  async getReceipts(status?: string): Promise<{ receipts: BankSettledReceipt[] }> {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return fetchJson(`/api/cfo/receipts${q}`);
  },

  async importReceiptBatch(input: ImportReceiptBatchInput): Promise<{ importedCount: number }> {
    return fetchJson('/api/cfo/receipts/batch-import', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async matchReceipt(input: MatchReceiptToInvoiceInput): Promise<{ match: { matchId: string; remainingReceiptUnmatched: number; remainingInvoiceBalance: number } }> {
    return fetchJson('/api/cfo/receipts/match', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async investigateReceipt(id: string, input: InvestigateUnmatchedInput): Promise<{ receipt: BankSettledReceipt }> {
    return fetchJson(`/api/cfo/receipts/${id}/investigate`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // CFO-08: Reconciliations
  async getReconciliations(): Promise<{ reconciliations: FinanceReconciliation[] }> {
    return fetchJson('/api/cfo/reconciliations');
  },

  async freezeReconciliation(input: FreezeReconciliationInput): Promise<{ reconciliation: FinanceReconciliation }> {
    return fetchJson('/api/cfo/reconciliations/freeze', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // CFO-10: Refunds
  async getRefunds(status?: string): Promise<{ refunds: RefundRequest[] }> {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return fetchJson(`/api/cfo/refunds${q}`);
  },

  async createRefund(input: CreateRefundRequestInput): Promise<{ refund: RefundRequest }> {
    return fetchJson('/api/cfo/refunds', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async decideRefund(id: string, input: DecideRefundInput): Promise<{ refund: RefundRequest }> {
    return fetchJson(`/api/cfo/refunds/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // CFO-12 & CFO-13: Incentives
  async getIncentives(): Promise<{ calculations: IncentiveCalculation[] }> {
    return fetchJson('/api/cfo/incentives');
  },

  async freezeIncentivePayout(id: string, input: FreezeIncentivePayoutInput): Promise<{ calculation: IncentiveCalculation }> {
    return fetchJson(`/api/cfo/incentives/${id}/freeze`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getIncentiveDisputes(): Promise<{ disputes: IncentiveDispute[] }> {
    return fetchJson('/api/cfo/incentives/disputes');
  },

  async resolveIncentiveDispute(id: string, input: ResolveIncentiveDisputeInput): Promise<{ dispute: IncentiveDispute }> {
    return fetchJson(`/api/cfo/incentives/disputes/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // CFO-14 & CFO-15: Periods
  async getPeriods(): Promise<{ periods: ReportingPeriod[] }> {
    return fetchJson('/api/cfo/periods');
  },

  async certifyPeriod(id: string, input: CertifyPeriodCloseInput): Promise<{ period: ReportingPeriod }> {
    return fetchJson(`/api/cfo/periods/${id}/certify`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getPeriodReopenRequests(): Promise<{ requests: PeriodReopenRequest[] }> {
    return fetchJson('/api/cfo/periods/reopen-requests');
  },

  async createPeriodReopenRequest(input: CreatePeriodReopenRequestInput): Promise<{ request: PeriodReopenRequest }> {
    return fetchJson('/api/cfo/periods/reopen-requests', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async decidePeriodReopenRequest(id: string, input: DecidePeriodReopenInput): Promise<{ request: PeriodReopenRequest }> {
    return fetchJson(`/api/cfo/periods/reopen-requests/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // CFO-16: Budgets
  async getBudgets(fiscalYear?: string): Promise<{ budgets: VerticalBudgetLine[] }> {
    const q = fiscalYear ? `?fiscalYear=${encodeURIComponent(fiscalYear)}` : '';
    return fetchJson(`/api/cfo/budgets${q}`);
  },

  async updateBudgetVariance(id: string, input: UpdateBudgetVarianceInput): Promise<{ budget: VerticalBudgetLine }> {
    return fetchJson(`/api/cfo/budgets/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // CFO-17: Forecast Finance Reviews
  async getForecastReviews(): Promise<{ reviews: ForecastFinanceReview[] }> {
    return fetchJson('/api/cfo/forecasts');
  },

  async submitForecastConcurrence(input: SubmitForecastConcurrenceInput): Promise<{ review: ForecastFinanceReview }> {
    return fetchJson('/api/cfo/forecasts/concur', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // CFO-18: Finance Pack Reports & Schedules
  async getReportPreview(period?: string): Promise<{ preview: FinancePackPreview }> {
    const q = period ? `?period=${encodeURIComponent(period)}` : '';
    return fetchJson(`/api/cfo/reports/preview${q}`);
  },

  async exportPdf(periodLabel: string): Promise<{ downloadUrl: string; filename: string }> {
    return fetchJson('/api/cfo/reports/export-pdf', {
      method: 'POST',
      body: JSON.stringify({ periodLabel }),
    });
  },

  async getSchedules(): Promise<{ schedules: FinancePackSchedule[] }> {
    return fetchJson('/api/cfo/reports/schedules');
  },

  async createSchedule(input: CreateFinanceScheduleInput): Promise<{ schedule: FinancePackSchedule }> {
    return fetchJson('/api/cfo/reports/schedules', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // CFO-19: Policies & Approval Limits
  async getPolicies(): Promise<{ policies: FinancePolicy[] }> {
    return fetchJson('/api/cfo/policies');
  },

  async proposePolicy(input: ProposeFinancePolicyInput): Promise<{ policy: FinancePolicy }> {
    return fetchJson('/api/cfo/policies', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
