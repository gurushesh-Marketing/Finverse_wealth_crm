import { pgTable, text, timestamp, foreignKey, check, integer, unique, date, jsonb, boolean, numeric } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { employees, teams } from './auth';
import { leads } from './leads';

export const reportingPeriods = pgTable("reporting_periods", {
	id: text().primaryKey().notNull(),
	periodLabel: text("period_label").notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	status: text().default('open').notNull(),
	certifiedByEmployeeId: text("certified_by_employee_id"),
	certifiedAt: timestamp("certified_at", { withTimezone: true, mode: 'string' }),
	certificationHash: text("certification_hash"),
	lockGovernedWrites: boolean("lock_governed_writes").default(false).notNull(),
	checklistState: jsonb("checklist_state").default({"ledger_balanced":false,"tax_provisioned":false,"exceptions_reviewed":false,"reconciliations_passed":false}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.certifiedByEmployeeId],
			foreignColumns: [employees.id],
			name: "reporting_periods_certified_by_employee_id_fkey"
		}),
	unique("reporting_periods_period_label_key").on(table.periodLabel),
	check("reporting_periods_status_check", sql`status = ANY (ARRAY['open'::text, 'closing_review'::text, 'certified_closed'::text, 'reopened'::text])`),
]);


export const periodReopenRequests = pgTable("period_reopen_requests", {
	id: text().primaryKey().notNull(),
	periodId: text("period_id").notNull(),
	requestedByEmployeeId: text("requested_by_employee_id").notNull(),
	reason: text().notNull(),
	impactAssessment: text("impact_assessment").notNull(),
	affectedAccounts: jsonb("affected_accounts").default([]).notNull(),
	status: text().default('pending').notNull(),
	authorizedByEmployeeId: text("authorized_by_employee_id"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	unlockExpiresAt: timestamp("unlock_expires_at", { withTimezone: true, mode: 'string' }),
	newCloseVersion: text("new_close_version"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.authorizedByEmployeeId],
			foreignColumns: [employees.id],
			name: "period_reopen_requests_authorized_by_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.periodId],
			foreignColumns: [reportingPeriods.id],
			name: "period_reopen_requests_period_id_fkey"
		}),
	foreignKey({
			columns: [table.requestedByEmployeeId],
			foreignColumns: [employees.id],
			name: "period_reopen_requests_requested_by_employee_id_fkey"
		}),
	check("period_reopen_requests_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'reclosed'::text])`),
]);


export const financeLedgerEntries = pgTable("finance_ledger_entries", {
	id: text().primaryKey().notNull(),
	entryCode: text("entry_code").notNull(),
	periodId: text("period_id").notNull(),
	entryType: text("entry_type").notNull(),
	vertical: text().notNull(),
	grossAmount: numeric("gross_amount", { precision: 14, scale:  2 }).notNull(),
	taxAmount: numeric("tax_amount", { precision: 14, scale:  2 }).default('0.00').notNull(),
	netAmount: numeric("net_amount", { precision: 14, scale:  2 }).notNull(),
	currency: text().default('INR').notNull(),
	policyCode: text("policy_code").notNull(),
	sourceReferenceType: text("source_reference_type").notNull(),
	sourceReferenceId: text("source_reference_id").notNull(),
	accountCode: text("account_code").notNull(),
	description: text().notNull(),
	isReversal: boolean("is_reversal").default(false).notNull(),
	reversalLinkedEntryId: text("reversal_linked_entry_id"),
	preparedByEmployeeId: text("prepared_by_employee_id").notNull(),
	approvedByEmployeeId: text("approved_by_employee_id"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	status: text().default('posted').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.approvedByEmployeeId],
			foreignColumns: [employees.id],
			name: "finance_ledger_entries_approved_by_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.periodId],
			foreignColumns: [reportingPeriods.id],
			name: "finance_ledger_entries_period_id_fkey"
		}),
	foreignKey({
			columns: [table.preparedByEmployeeId],
			foreignColumns: [employees.id],
			name: "finance_ledger_entries_prepared_by_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.reversalLinkedEntryId],
			foreignColumns: [table.id],
			name: "finance_ledger_entries_reversal_linked_entry_id_fkey"
		}),
	unique("finance_ledger_entries_entry_code_key").on(table.entryCode),
	check("finance_ledger_entries_entry_type_check", sql`entry_type = ANY (ARRAY['revenue_recognition'::text, 'cash_receipt'::text, 'receivable_accrual'::text, 'credit_note_reversal'::text, 'refund_payout'::text, 'tax_provision'::text])`),
	check("finance_ledger_entries_status_check", sql`status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'posted'::text, 'reversed'::text])`),
	check("finance_ledger_entries_vertical_check", sql`vertical = ANY (ARRAY['wealth'::text, 'banking'::text, 'shared'::text])`),
]);


export const salesFinanceHandoffs = pgTable("sales_finance_handoffs", {
	id: text().primaryKey().notNull(),
	handoffCode: text("handoff_code").notNull(),
	leadId: text("lead_id").notNull(),
	vertical: text().default('wealth').notNull(),
	salesRepEmployeeId: text("sales_rep_employee_id"),
	convertedAmount: numeric("converted_amount", { precision: 14, scale:  2 }).notNull(),
	earningMilestone: text("earning_milestone").notNull(),
	supportingEvidenceUrl: text("supporting_evidence_url"),
	reviewStatus: text("review_status").default('pending_verification').notNull(),
	deficiencyNotes: text("deficiency_notes"),
	verifiedByEmployeeId: text("verified_by_employee_id"),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "sales_finance_handoffs_lead_id_fkey"
		}),
	foreignKey({
			columns: [table.salesRepEmployeeId],
			foreignColumns: [employees.id],
			name: "sales_finance_handoffs_sales_rep_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.verifiedByEmployeeId],
			foreignColumns: [employees.id],
			name: "sales_finance_handoffs_verified_by_employee_id_fkey"
		}),
	unique("sales_finance_handoffs_handoff_code_key").on(table.handoffCode),
	check("sales_finance_handoffs_review_status_check", sql`review_status = ANY (ARRAY['pending_verification'::text, 'accepted_for_processing'::text, 'returned_deficiencies'::text])`),
]);


export const receivableInvoices = pgTable("receivable_invoices", {
	id: text().primaryKey().notNull(),
	invoiceNumber: text("invoice_number").notNull(),
	periodId: text("period_id").notNull(),
	leadId: text("lead_id"),
	clientName: text("client_name").notNull(),
	clientPan: text("client_pan"),
	vertical: text().default('wealth').notNull(),
	totalAmount: numeric("total_amount", { precision: 14, scale:  2 }).notNull(),
	taxAmount: numeric("tax_amount", { precision: 14, scale:  2 }).default('0.00').notNull(),
	netReceivable: numeric("net_receivable", { precision: 14, scale:  2 }).notNull(),
	paidAmount: numeric("paid_amount", { precision: 14, scale:  2 }).default('0.00').notNull(),
	outstandingBalance: numeric("outstanding_balance", { precision: 14, scale:  2 }).notNull(),
	currency: text().default('INR').notNull(),
	issueDate: date("issue_date").notNull(),
	dueDate: date("due_date").notNull(),
	status: text().default('issued').notNull(),
	lineItems: jsonb("line_items").default([]).notNull(),
	assignedCollectionAgentId: text("assigned_collection_agent_id"),
	collectionStatus: text("collection_status").default('standard').notNull(),
	promiseToPayDate: date("promise_to_pay_date"),
	collectionNotes: text("collection_notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.assignedCollectionAgentId],
			foreignColumns: [employees.id],
			name: "receivable_invoices_assigned_collection_agent_id_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "receivable_invoices_lead_id_fkey"
		}),
	foreignKey({
			columns: [table.periodId],
			foreignColumns: [reportingPeriods.id],
			name: "receivable_invoices_period_id_fkey"
		}),
	unique("receivable_invoices_invoice_number_key").on(table.invoiceNumber),
	check("receivable_invoices_collection_status_check", sql`collection_status = ANY (ARRAY['standard'::text, 'promise_to_pay'::text, 'disputed'::text, 'escalated_legal'::text])`),
	check("receivable_invoices_status_check", sql`status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'issued'::text, 'partially_paid'::text, 'settled'::text, 'overdue'::text, 'written_off'::text])`),
]);


export const bankSettledReceipts = pgTable("bank_settled_receipts", {
	id: text().primaryKey().notNull(),
	receiptCode: text("receipt_code").notNull(),
	bankReference: text("bank_reference").notNull(),
	bankName: text("bank_name").notNull(),
	settlementDate: date("settlement_date").notNull(),
	amount: numeric({ precision: 14, scale:  2 }).notNull(),
	currency: text().default('INR').notNull(),
	payerName: text("payer_name").notNull(),
	payerIdentifier: text("payer_identifier"),
	status: text().default('unmatched').notNull(),
	matchedAmount: numeric("matched_amount", { precision: 14, scale:  2 }).default('0.00').notNull(),
	unmatchedAmount: numeric("unmatched_amount", { precision: 14, scale:  2 }).notNull(),
	suspenseReason: text("suspense_reason"),
	clarificationTeamId: text("clarification_team_id"),
	clarificationNotes: text("clarification_notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.clarificationTeamId],
			foreignColumns: [teams.id],
			name: "bank_settled_receipts_clarification_team_id_fkey"
		}),
	unique("bank_settled_receipts_receipt_code_key").on(table.receiptCode),
	unique("bank_settled_receipts_bank_reference_key").on(table.bankReference),
	check("bank_settled_receipts_status_check", sql`status = ANY (ARRAY['unmatched'::text, 'partially_matched'::text, 'matched'::text, 'suspense'::text, 'quarantined'::text])`),
]);


export const receiptInvoiceMatches = pgTable("receipt_invoice_matches", {
	id: text().primaryKey().notNull(),
	receiptId: text("receipt_id").notNull(),
	invoiceId: text("invoice_id").notNull(),
	allocatedAmount: numeric("allocated_amount", { precision: 14, scale:  2 }).notNull(),
	allocationDate: timestamp("allocation_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	allocatedByEmployeeId: text("allocated_by_employee_id").notNull(),
	notes: text(),
}, (table) => [
	foreignKey({
			columns: [table.allocatedByEmployeeId],
			foreignColumns: [employees.id],
			name: "receipt_invoice_matches_allocated_by_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [receivableInvoices.id],
			name: "receipt_invoice_matches_invoice_id_fkey"
		}),
	foreignKey({
			columns: [table.receiptId],
			foreignColumns: [bankSettledReceipts.id],
			name: "receipt_invoice_matches_receipt_id_fkey"
		}),
]);


export const financeReconciliations = pgTable("finance_reconciliations", {
	id: text().primaryKey().notNull(),
	reconciliationCode: text("reconciliation_code").notNull(),
	periodId: text("period_id").notNull(),
	vertical: text().default('wealth').notNull(),
	salesClosedWinsTotal: numeric("sales_closed_wins_total", { precision: 14, scale:  2 }).notNull(),
	recognisedRevenueTotal: numeric("recognised_revenue_total", { precision: 14, scale:  2 }).notNull(),
	cashReceiptsTotal: numeric("cash_receipts_total", { precision: 14, scale:  2 }).notNull(),
	timingDifference: numeric("timing_difference", { precision: 14, scale:  2 }).default('0.00').notNull(),
	partialSettlementDifference: numeric("partial_settlement_difference", { precision: 14, scale:  2 }).default('0.00').notNull(),
	unbilledPipelineDifference: numeric("unbilled_pipeline_difference", { precision: 14, scale:  2 }).default('0.00').notNull(),
	unexplainedVariance: numeric("unexplained_variance", { precision: 14, scale:  2 }).default('0.00').notNull(),
	reconciliationStatus: text("reconciliation_status").default('draft').notNull(),
	frozenByEmployeeId: text("frozen_by_employee_id"),
	frozenAt: timestamp("frozen_at", { withTimezone: true, mode: 'string' }),
	explanationNotes: text("explanation_notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.frozenByEmployeeId],
			foreignColumns: [employees.id],
			name: "finance_reconciliations_frozen_by_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.periodId],
			foreignColumns: [reportingPeriods.id],
			name: "finance_reconciliations_period_id_fkey"
		}),
	unique("finance_reconciliations_reconciliation_code_key").on(table.reconciliationCode),
	check("finance_reconciliations_reconciliation_status_check", sql`reconciliation_status = ANY (ARRAY['draft'::text, 'variance_investigation'::text, 'approved_frozen'::text])`),
]);


export const refundRequests = pgTable("refund_requests", {
	id: text().primaryKey().notNull(),
	refundCode: text("refund_code").notNull(),
	leadId: text("lead_id"),
	clientName: text("client_name").notNull(),
	originalReceiptId: text("original_receipt_id"),
	refundAmount: numeric("refund_amount", { precision: 14, scale:  2 }).notNull(),
	currency: text().default('INR').notNull(),
	reason: text().notNull(),
	bankBeneficiaryName: text("bank_beneficiary_name").notNull(),
	bankAccountNumber: text("bank_account_number").notNull(),
	bankIfsc: text("bank_ifsc").notNull(),
	status: text().default('pending_approval').notNull(),
	authorizedByEmployeeId: text("authorized_by_employee_id"),
	externalPaymentRef: text("external_payment_ref"),
	executedAt: timestamp("executed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.authorizedByEmployeeId],
			foreignColumns: [employees.id],
			name: "refund_requests_authorized_by_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "refund_requests_lead_id_fkey"
		}),
	foreignKey({
			columns: [table.originalReceiptId],
			foreignColumns: [bankSettledReceipts.id],
			name: "refund_requests_original_receipt_id_fkey"
		}),
	unique("refund_requests_refund_code_key").on(table.refundCode),
	check("refund_requests_status_check", sql`status = ANY (ARRAY['pending_approval'::text, 'approved'::text, 'rejected'::text, 'executed_paid'::text])`),
]);


export const incentiveCalculations = pgTable("incentive_calculations", {
	id: text().primaryKey().notNull(),
	calculationCode: text("calculation_code").notNull(),
	periodId: text("period_id").notNull(),
	schemeName: text("scheme_name").notNull(),
	schemeVersion: text("scheme_version").default('1.0').notNull(),
	totalIncentivePool: numeric("total_incentive_pool", { precision: 14, scale:  2 }).notNull(),
	clawbackReserve: numeric("clawback_reserve", { precision: 14, scale:  2 }).default('0.00').notNull(),
	payableIncentiveTotal: numeric("payable_incentive_total", { precision: 14, scale:  2 }).notNull(),
	status: text().default('calculated').notNull(),
	payoutHandoffReference: text("payout_handoff_reference"),
	approvedByEmployeeId: text("approved_by_employee_id"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	employeeAllocations: jsonb("employee_allocations").default([]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.approvedByEmployeeId],
			foreignColumns: [employees.id],
			name: "incentive_calculations_approved_by_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.periodId],
			foreignColumns: [reportingPeriods.id],
			name: "incentive_calculations_period_id_fkey"
		}),
	unique("incentive_calculations_calculation_code_key").on(table.calculationCode),
	check("incentive_calculations_status_check", sql`status = ANY (ARRAY['calculated'::text, 'disputed'::text, 'frozen_for_payout'::text, 'paid'::text])`),
]);


export const incentiveDisputes = pgTable("incentive_disputes", {
	id: text().primaryKey().notNull(),
	disputeCode: text("dispute_code").notNull(),
	calculationId: text("calculation_id").notNull(),
	employeeId: text("employee_id").notNull(),
	disputedAmount: numeric("disputed_amount", { precision: 14, scale:  2 }).notNull(),
	employeeClaim: text("employee_claim").notNull(),
	supportingEvidence: text("supporting_evidence"),
	status: text().default('open').notNull(),
	resolutionAmount: numeric("resolution_amount", { precision: 14, scale:  2 }),
	decisionNotes: text("decision_notes"),
	resolvedByEmployeeId: text("resolved_by_employee_id"),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.calculationId],
			foreignColumns: [incentiveCalculations.id],
			name: "incentive_disputes_calculation_id_fkey"
		}),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "incentive_disputes_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.resolvedByEmployeeId],
			foreignColumns: [employees.id],
			name: "incentive_disputes_resolved_by_employee_id_fkey"
		}),
	unique("incentive_disputes_dispute_code_key").on(table.disputeCode),
	check("incentive_disputes_status_check", sql`status = ANY (ARRAY['open'::text, 'under_review'::text, 'resolved_upheld'::text, 'resolved_rejected'::text])`),
]);


export const verticalBudgetLines = pgTable("vertical_budget_lines", {
	id: text().primaryKey().notNull(),
	budgetCode: text("budget_code").notNull(),
	fiscalYear: text("fiscal_year").default('FY26').notNull(),
	vertical: text().notNull(),
	costCategory: text("cost_category").notNull(),
	approvedBudget: numeric("approved_budget", { precision: 14, scale:  2 }).notNull(),
	committedCosts: numeric("committed_costs", { precision: 14, scale:  2 }).default('0.00').notNull(),
	actualCosts: numeric("actual_costs", { precision: 14, scale:  2 }).default('0.00').notNull(),
	varianceAmount: numeric("variance_amount", { precision: 14, scale:  2 }).generatedAlwaysAs(sql`(approved_budget - actual_costs)`),
	variancePct: numeric("variance_pct", { precision: 6, scale:  2 }),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("vertical_budget_lines_budget_code_key").on(table.budgetCode),
	check("vertical_budget_lines_vertical_check", sql`vertical = ANY (ARRAY['wealth'::text, 'banking'::text, 'shared_corporate'::text])`),
]);


export const forecastFinanceReviews = pgTable("forecast_finance_reviews", {
	id: text().primaryKey().notNull(),
	periodLabel: text("period_label").notNull(),
	vertical: text().default('wealth').notNull(),
	salesProjectedRevenue: numeric("sales_projected_revenue", { precision: 14, scale:  2 }).notNull(),
	financeDiscountRatePct: numeric("finance_discount_rate_pct", { precision: 5, scale:  2 }).default('10.00').notNull(),
	riskAdjustedRevenue: numeric("risk_adjusted_revenue", { precision: 14, scale:  2 }).notNull(),
	cashConversionPaceDays: integer("cash_conversion_pace_days").default(45).notNull(),
	financeAssumptions: text("finance_assumptions").notNull(),
	concurrenceStatus: text("concurrence_status").default('concurred').notNull(),
	concurredByEmployeeId: text("concurred_by_employee_id"),
	concurredAt: timestamp("concurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.concurredByEmployeeId],
			foreignColumns: [employees.id],
			name: "forecast_finance_reviews_concurred_by_employee_id_fkey"
		}),
	check("forecast_finance_reviews_concurrence_status_check", sql`concurrence_status = ANY (ARRAY['concurred'::text, 'concurred_with_reservations'::text, 'corrections_required'::text])`),
]);


export const financePackSchedules = pgTable("finance_pack_schedules", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	cadence: text().notNull(),
	recipients: jsonb().default([]).notNull(),
	includeFullLedger: boolean("include_full_ledger").default(false).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	lastDeliveredAt: timestamp("last_delivered_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("finance_pack_schedules_cadence_check", sql`cadence = ANY (ARRAY['monthly_close'::text, 'quarterly_board'::text, 'bi_weekly_cash'::text])`),
]);


export const financePolicies = pgTable("finance_policies", {
	id: text().primaryKey().notNull(),
	policyCode: text("policy_code").notNull(),
	title: text().notNull(),
	category: text().notNull(),
	version: text().default('1.0').notNull(),
	effectiveDate: date("effective_date").notNull(),
	rulesSummary: text("rules_summary").notNull(),
	approvalLimits: jsonb("approval_limits").default({}).notNull(),
	status: text().default('active').notNull(),
	proposedByEmployeeId: text("proposed_by_employee_id").notNull(),
	approvedByEmployeeId: text("approved_by_employee_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.approvedByEmployeeId],
			foreignColumns: [employees.id],
			name: "finance_policies_approved_by_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.proposedByEmployeeId],
			foreignColumns: [employees.id],
			name: "finance_policies_proposed_by_employee_id_fkey"
		}),
	unique("finance_policies_policy_code_key").on(table.policyCode),
	check("finance_policies_category_check", sql`category = ANY (ARRAY['delegation_of_authority'::text, 'revenue_recognition'::text, 'incentive_scheme'::text, 'credit_terms'::text])`),
	check("finance_policies_status_check", sql`status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'active'::text, 'superseded'::text])`),
]);

