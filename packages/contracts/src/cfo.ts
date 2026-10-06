import { z } from 'zod';

// =========================================================================
// CFO-01: Inspect Revenue, Cash and Outstanding Balances
// =========================================================================
export const CfoBalancesOverviewSchema = z.object({
  periodLabel: z.string(),
  recognisedRevenue: z.number(),
  cashReceipts: z.number(),
  outstandingReceivables: z.number(),
  unmatchedCash: z.number(),
  grossMarginPct: z.number(),
  recentLedgerEntries: z.array(z.object({
    id: z.string(),
    entryCode: z.string(),
    entryType: z.string(),
    vertical: z.string(),
    netAmount: z.number(),
    accountCode: z.string(),
    description: z.string(),
    status: z.string(),
    createdAt: z.string(),
  })),
  verticalSummary: z.array(z.object({
    vertical: z.string(),
    recognisedRevenue: z.number(),
    outstandingReceivables: z.number(),
    marginPct: z.number(),
  })),
});
export type CfoBalancesOverview = z.infer<typeof CfoBalancesOverviewSchema>;

// =========================================================================
// CFO-02: Verify Sales-to-Finance Handoff
// =========================================================================
export const CfoHandoffItemSchema = z.object({
  id: z.string(),
  handoffCode: z.string(),
  leadId: z.string(),
  clientName: z.string(),
  vertical: z.string(),
  salesRepName: z.string(),
  convertedAmount: z.number(),
  earningMilestone: z.string(),
  supportingEvidenceUrl: z.string().nullable().optional(),
  reviewStatus: z.enum(['pending_verification', 'accepted_for_processing', 'returned_deficiencies']),
  deficiencyNotes: z.string().nullable().optional(),
  verifiedByName: z.string().nullable().optional(),
  verifiedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type CfoHandoffItem = z.infer<typeof CfoHandoffItemSchema>;

export const VerifySalesHandoffInputSchema = z.object({
  decision: z.enum(['accepted_for_processing', 'returned_deficiencies']),
  deficiencyNotes: z.string().optional(),
});
export type VerifySalesHandoffInput = z.infer<typeof VerifySalesHandoffInputSchema>;

// =========================================================================
// CFO-03 & CFO-11: Revenue Recognition & Credit Note Reversals
// =========================================================================
export const LedgerEntrySchema = z.object({
  id: z.string(),
  entryCode: z.string(),
  periodId: z.string(),
  entryType: z.enum(['revenue_recognition', 'cash_receipt', 'receivable_accrual', 'credit_note_reversal', 'refund_payout', 'tax_provision']),
  vertical: z.enum(['wealth', 'banking', 'shared']),
  grossAmount: z.number(),
  taxAmount: z.number(),
  netAmount: z.number(),
  currency: z.string().default('INR'),
  policyCode: z.string(),
  sourceReferenceType: z.string(),
  sourceReferenceId: z.string(),
  accountCode: z.string(),
  description: z.string(),
  isReversal: z.boolean().default(false),
  reversalLinkedEntryId: z.string().nullable().optional(),
  preparedByEmployeeId: z.string(),
  preparedByName: z.string().optional(),
  approvedByEmployeeId: z.string().nullable().optional(),
  approvedByName: z.string().nullable().optional(),
  approvedAt: z.string().nullable().optional(),
  status: z.enum(['draft', 'pending_approval', 'posted', 'reversed']),
  createdAt: z.string(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export const PostRevenueRecognitionInputSchema = z.object({
  periodId: z.string(),
  vertical: z.enum(['wealth', 'banking', 'shared']).default('wealth'),
  grossAmount: z.number().positive(),
  taxAmount: z.number().nonnegative().default(0),
  policyCode: z.string().min(1),
  sourceReferenceType: z.string().min(1),
  sourceReferenceId: z.string().min(1),
  accountCode: z.string().min(1),
  description: z.string().min(3),
});
export type PostRevenueRecognitionInput = z.infer<typeof PostRevenueRecognitionInputSchema>;

export const PostCreditNoteInputSchema = z.object({
  originalEntryId: z.string(),
  reversalReason: z.string().min(5),
  policyCode: z.string().min(1),
  creditAmount: z.number().positive(),
});
export type PostCreditNoteInput = z.infer<typeof PostCreditNoteInputSchema>;

// =========================================================================
// CFO-04 & CFO-09: Receivable Invoices & Ageing / Collections
// =========================================================================
export const InvoiceLineItemSchema = z.object({
  description: z.string(),
  product: z.string().optional(),
  rateBps: z.number().optional(),
  baseAum: z.number().optional(),
  amount: z.number(),
});
export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;

export const ReceivableInvoiceSchema = z.object({
  id: z.string(),
  invoiceNumber: z.string(),
  periodId: z.string(),
  leadId: z.string().nullable().optional(),
  clientName: z.string(),
  clientPan: z.string().nullable().optional(),
  vertical: z.string(),
  totalAmount: z.number(),
  taxAmount: z.number(),
  netReceivable: z.number(),
  paidAmount: z.number(),
  outstandingBalance: z.number(),
  currency: z.string().default('INR'),
  issueDate: z.string(),
  dueDate: z.string(),
  status: z.enum(['draft', 'pending_approval', 'issued', 'partially_paid', 'settled', 'overdue', 'written_off']),
  lineItems: z.array(InvoiceLineItemSchema),
  assignedCollectionAgentId: z.string().nullable().optional(),
  assignedCollectionAgentName: z.string().nullable().optional(),
  collectionStatus: z.enum(['standard', 'promise_to_pay', 'disputed', 'escalated_legal']),
  promiseToPayDate: z.string().nullable().optional(),
  collectionNotes: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type ReceivableInvoice = z.infer<typeof ReceivableInvoiceSchema>;

export const CreateInvoiceInputSchema = z.object({
  periodId: z.string(),
  leadId: z.string().optional(),
  clientName: z.string().min(2),
  clientPan: z.string().optional(),
  vertical: z.enum(['wealth', 'banking']).default('wealth'),
  issueDate: z.string(),
  dueDate: z.string(),
  lineItems: z.array(InvoiceLineItemSchema).min(1),
  taxAmount: z.number().nonnegative().default(0),
});
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInputSchema>;

export const AssignCollectionInputSchema = z.object({
  assignedEmployeeId: z.string(),
  collectionStatus: z.enum(['standard', 'promise_to_pay', 'disputed', 'escalated_legal']).default('standard'),
  promiseToPayDate: z.string().optional(),
  collectionNotes: z.string().optional(),
});
export type AssignCollectionInput = z.infer<typeof AssignCollectionInputSchema>;

export const AgeingBucketsSummarySchema = z.object({
  current: z.number(), // 0-30 days
  days31To60: z.number(),
  days61To90: z.number(),
  over90Days: z.number(),
  totalOutstanding: z.number(),
});
export type AgeingBucketsSummary = z.infer<typeof AgeingBucketsSummarySchema>;

// =========================================================================
// CFO-05, CFO-06, CFO-07: Bank Receipts & Payment Matching
// =========================================================================
export const BankSettledReceiptSchema = z.object({
  id: z.string(),
  receiptCode: z.string(),
  bankReference: z.string(),
  bankName: z.string(),
  settlementDate: z.string(),
  amount: z.number(),
  currency: z.string().default('INR'),
  payerName: z.string(),
  payerIdentifier: z.string().nullable().optional(),
  status: z.enum(['unmatched', 'partially_matched', 'matched', 'suspense', 'quarantined']),
  matchedAmount: z.number(),
  unmatchedAmount: z.number(),
  suspenseReason: z.string().nullable().optional(),
  clarificationTeamId: z.string().nullable().optional(),
  clarificationNotes: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type BankSettledReceipt = z.infer<typeof BankSettledReceiptSchema>;

export const ImportReceiptBatchInputSchema = z.object({
  receipts: z.array(z.object({
    bankReference: z.string().min(3),
    bankName: z.string().min(2),
    settlementDate: z.string(),
    amount: z.number().positive(),
    payerName: z.string().min(2),
    payerIdentifier: z.string().optional(),
  })).min(1),
});
export type ImportReceiptBatchInput = z.infer<typeof ImportReceiptBatchInputSchema>;

export const MatchReceiptToInvoiceInputSchema = z.object({
  receiptId: z.string(),
  invoiceId: z.string(),
  allocatedAmount: z.number().positive(),
  notes: z.string().optional(),
});
export type MatchReceiptToInvoiceInput = z.infer<typeof MatchReceiptToInvoiceInputSchema>;

export const InvestigateUnmatchedInputSchema = z.object({
  status: z.enum(['suspense', 'quarantined', 'unmatched']),
  suspenseReason: z.string().min(3),
  clarificationTeamId: z.string().optional(),
  clarificationNotes: z.string().optional(),
});
export type InvestigateUnmatchedInput = z.infer<typeof InvestigateUnmatchedInputSchema>;

// =========================================================================
// CFO-08: Finance Reconciliations
// =========================================================================
export const FinanceReconciliationSchema = z.object({
  id: z.string(),
  reconciliationCode: z.string(),
  periodId: z.string(),
  periodLabel: z.string().optional(),
  vertical: z.string(),
  salesClosedWinsTotal: z.number(),
  recognisedRevenueTotal: z.number(),
  cashReceiptsTotal: z.number(),
  timingDifference: z.number(),
  partialSettlementDifference: z.number(),
  unbilledPipelineDifference: z.number(),
  unexplainedVariance: z.number(),
  reconciliationStatus: z.enum(['draft', 'variance_investigation', 'approved_frozen']),
  frozenByName: z.string().nullable().optional(),
  frozenAt: z.string().nullable().optional(),
  explanationNotes: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type FinanceReconciliation = z.infer<typeof FinanceReconciliationSchema>;

export const FreezeReconciliationInputSchema = z.object({
  periodId: z.string(),
  explanationNotes: z.string().min(5),
});
export type FreezeReconciliationInput = z.infer<typeof FreezeReconciliationInputSchema>;

// =========================================================================
// CFO-10: Refund Requests
// =========================================================================
export const RefundRequestSchema = z.object({
  id: z.string(),
  refundCode: z.string(),
  leadId: z.string().nullable().optional(),
  clientName: z.string(),
  originalReceiptId: z.string().nullable().optional(),
  refundAmount: z.number(),
  currency: z.string().default('INR'),
  reason: z.string(),
  bankBeneficiaryName: z.string(),
  bankAccountNumber: z.string(),
  bankIfsc: z.string(),
  status: z.enum(['pending_approval', 'approved', 'rejected', 'executed_paid']),
  authorizedByName: z.string().nullable().optional(),
  externalPaymentRef: z.string().nullable().optional(),
  executedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type RefundRequest = z.infer<typeof RefundRequestSchema>;

export const CreateRefundRequestInputSchema = z.object({
  clientName: z.string().min(2),
  leadId: z.string().optional(),
  originalReceiptId: z.string().optional(),
  refundAmount: z.number().positive(),
  reason: z.string().min(5),
  bankBeneficiaryName: z.string().min(2),
  bankAccountNumber: z.string().min(6),
  bankIfsc: z.string().min(4),
});
export type CreateRefundRequestInput = z.infer<typeof CreateRefundRequestInputSchema>;

export const DecideRefundInputSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'executed_paid']),
  externalPaymentRef: z.string().optional(),
});
export type DecideRefundInput = z.infer<typeof DecideRefundInputSchema>;

// =========================================================================
// CFO-12 & CFO-13: Incentive Calculations & Disputes
// =========================================================================
export const EmployeeIncentiveAllocationSchema = z.object({
  employeeId: z.string(),
  employeeName: z.string(),
  role: z.string(),
  grossIncentive: z.number(),
  clawback: z.number(),
  netPayable: z.number(),
});
export type EmployeeIncentiveAllocation = z.infer<typeof EmployeeIncentiveAllocationSchema>;

export const IncentiveCalculationSchema = z.object({
  id: z.string(),
  calculationCode: z.string(),
  periodId: z.string(),
  schemeName: z.string(),
  schemeVersion: z.string(),
  totalIncentivePool: z.number(),
  clawbackReserve: z.number(),
  payableIncentiveTotal: z.number(),
  status: z.enum(['calculated', 'disputed', 'frozen_for_payout', 'paid']),
  payoutHandoffReference: z.string().nullable().optional(),
  approvedByName: z.string().nullable().optional(),
  approvedAt: z.string().nullable().optional(),
  employeeAllocations: z.array(EmployeeIncentiveAllocationSchema),
  createdAt: z.string(),
});
export type IncentiveCalculation = z.infer<typeof IncentiveCalculationSchema>;

export const FreezeIncentivePayoutInputSchema = z.object({
  payoutHandoffReference: z.string().min(3),
});
export type FreezeIncentivePayoutInput = z.infer<typeof FreezeIncentivePayoutInputSchema>;

export const IncentiveDisputeSchema = z.object({
  id: z.string(),
  disputeCode: z.string(),
  calculationId: z.string(),
  employeeId: z.string(),
  employeeName: z.string().optional(),
  disputedAmount: z.number(),
  employeeClaim: z.string(),
  supportingEvidence: z.string().nullable().optional(),
  status: z.enum(['open', 'under_review', 'resolved_upheld', 'resolved_rejected']),
  resolutionAmount: z.number().nullable().optional(),
  decisionNotes: z.string().nullable().optional(),
  resolvedByName: z.string().nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type IncentiveDispute = z.infer<typeof IncentiveDisputeSchema>;

export const ResolveIncentiveDisputeInputSchema = z.object({
  resolution: z.enum(['resolved_upheld', 'resolved_rejected']),
  resolutionAmount: z.number().nonnegative().optional(),
  decisionNotes: z.string().min(5),
});
export type ResolveIncentiveDisputeInput = z.infer<typeof ResolveIncentiveDisputeInputSchema>;

// =========================================================================
// CFO-14 & CFO-15: Reporting Periods & Reopening Requests
// =========================================================================
export const ReportingPeriodSchema = z.object({
  id: z.string(),
  periodLabel: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(['open', 'closing_review', 'certified_closed', 'reopened']),
  certifiedByName: z.string().nullable().optional(),
  certifiedAt: z.string().nullable().optional(),
  certificationHash: z.string().nullable().optional(),
  lockGovernedWrites: z.boolean(),
  checklistState: z.record(z.string(), z.boolean()),
  createdAt: z.string(),
});
export type ReportingPeriod = z.infer<typeof ReportingPeriodSchema>;

export const CertifyPeriodCloseInputSchema = z.object({
  checklistState: z.record(z.string(), z.boolean()),
  certificationNotes: z.string().optional(),
});
export type CertifyPeriodCloseInput = z.infer<typeof CertifyPeriodCloseInputSchema>;

export const PeriodReopenRequestSchema = z.object({
  id: z.string(),
  periodId: z.string(),
  periodLabel: z.string().optional(),
  requestedByName: z.string().optional(),
  reason: z.string(),
  impactAssessment: z.string(),
  affectedAccounts: z.array(z.string()),
  status: z.enum(['pending', 'approved', 'rejected', 'reclosed']),
  authorizedByName: z.string().nullable().optional(),
  approvedAt: z.string().nullable().optional(),
  unlockExpiresAt: z.string().nullable().optional(),
  newCloseVersion: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type PeriodReopenRequest = z.infer<typeof PeriodReopenRequestSchema>;

export const CreatePeriodReopenRequestInputSchema = z.object({
  periodId: z.string(),
  reason: z.string().min(5),
  impactAssessment: z.string().min(10),
  affectedAccounts: z.array(z.string()).default([]),
});
export type CreatePeriodReopenRequestInput = z.infer<typeof CreatePeriodReopenRequestInputSchema>;

export const DecidePeriodReopenInputSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  unlockHours: z.number().int().positive().default(24),
  newCloseVersion: z.string().optional(),
});
export type DecidePeriodReopenInput = z.infer<typeof DecidePeriodReopenInputSchema>;

// =========================================================================
// CFO-16: Vertical Budget Lines & Cost Performance
// =========================================================================
export const VerticalBudgetLineSchema = z.object({
  id: z.string(),
  budgetCode: z.string(),
  fiscalYear: z.string(),
  vertical: z.enum(['wealth', 'banking', 'shared_corporate']),
  costCategory: z.string(),
  approvedBudget: z.number(),
  committedCosts: z.number(),
  actualCosts: z.number(),
  varianceAmount: z.number(),
  variancePct: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type VerticalBudgetLine = z.infer<typeof VerticalBudgetLineSchema>;

export const UpdateBudgetVarianceInputSchema = z.object({
  notes: z.string().min(3),
});
export type UpdateBudgetVarianceInput = z.infer<typeof UpdateBudgetVarianceInputSchema>;

// =========================================================================
// CFO-17: Forecast Finance Reviews
// =========================================================================
export const ForecastFinanceReviewSchema = z.object({
  id: z.string(),
  periodLabel: z.string(),
  vertical: z.string(),
  salesProjectedRevenue: z.number(),
  financeDiscountRatePct: z.number(),
  riskAdjustedRevenue: z.number(),
  cashConversionPaceDays: z.number(),
  financeAssumptions: z.string(),
  concurrenceStatus: z.enum(['concurred', 'concurred_with_reservations', 'corrections_required']),
  concurredByName: z.string().nullable().optional(),
  concurredAt: z.string(),
  createdAt: z.string(),
});
export type ForecastFinanceReview = z.infer<typeof ForecastFinanceReviewSchema>;

export const SubmitForecastConcurrenceInputSchema = z.object({
  periodLabel: z.string(),
  vertical: z.enum(['wealth', 'banking']).default('wealth'),
  salesProjectedRevenue: z.number().positive(),
  financeDiscountRatePct: z.number().min(0).max(100).default(10),
  cashConversionPaceDays: z.number().int().positive().default(45),
  financeAssumptions: z.string().min(5),
  concurrenceStatus: z.enum(['concurred', 'concurred_with_reservations', 'corrections_required']),
});
export type SubmitForecastConcurrenceInput = z.infer<typeof SubmitForecastConcurrenceInputSchema>;

// =========================================================================
// CFO-18: Certified Finance Pack & Schedules
// =========================================================================
export const FinancePackPreviewSchema = z.object({
  periodLabel: z.string(),
  closeVersion: z.string(),
  executiveFinancialSummary: z.object({
    recognisedRevenue: z.number(),
    cashReceipts: z.number(),
    receivables: z.number(),
    unmatchedCash: z.number(),
  }),
  salesCashReconciliation: z.object({
    salesClosedWins: z.number(),
    recognisedRevenue: z.number(),
    timingDifferences: z.number(),
    variance: z.number(),
  }),
  budgetPerformance: z.array(z.object({
    category: z.string(),
    budget: z.number(),
    actual: z.number(),
    variancePct: z.number(),
  })),
  complianceCertification: z.object({
    status: z.string(),
    certifiedBy: z.string(),
    certifiedAt: z.string(),
    certificationHash: z.string(),
  }),
});
export type FinancePackPreview = z.infer<typeof FinancePackPreviewSchema>;

export const FinancePackScheduleSchema = z.object({
  id: z.string(),
  title: z.string(),
  cadence: z.enum(['monthly_close', 'quarterly_board', 'bi_weekly_cash']),
  recipients: z.array(z.string()),
  includeFullLedger: z.boolean(),
  isActive: z.boolean(),
  lastDeliveredAt: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type FinancePackSchedule = z.infer<typeof FinancePackScheduleSchema>;

export const CreateFinanceScheduleInputSchema = z.object({
  title: z.string().min(3),
  cadence: z.enum(['monthly_close', 'quarterly_board', 'bi_weekly_cash']),
  recipients: z.array(z.string().email()).min(1),
  includeFullLedger: z.boolean().default(false),
});
export type CreateFinanceScheduleInput = z.infer<typeof CreateFinanceScheduleInputSchema>;

// =========================================================================
// CFO-19: Finance Policies & Approval Limits (DoA)
// =========================================================================
export const FinancePolicySchema = z.object({
  id: z.string(),
  policyCode: z.string(),
  title: z.string(),
  category: z.enum(['delegation_of_authority', 'revenue_recognition', 'incentive_scheme', 'credit_terms']),
  version: z.string(),
  effectiveDate: z.string(),
  rulesSummary: z.string(),
  approvalLimits: z.record(z.string(), z.number()),
  status: z.enum(['draft', 'pending_approval', 'active', 'superseded']),
  proposedByName: z.string().optional(),
  approvedByName: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type FinancePolicy = z.infer<typeof FinancePolicySchema>;

export const ProposeFinancePolicyInputSchema = z.object({
  title: z.string().min(3),
  category: z.enum(['delegation_of_authority', 'revenue_recognition', 'incentive_scheme', 'credit_terms']),
  version: z.string().default('1.0'),
  effectiveDate: z.string(),
  rulesSummary: z.string().min(10),
  approvalLimits: z.record(z.string(), z.number()).default({}),
});
export type ProposeFinancePolicyInput = z.infer<typeof ProposeFinancePolicyInputSchema>;
