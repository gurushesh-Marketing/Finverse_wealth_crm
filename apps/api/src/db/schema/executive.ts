import { pgTable, text, timestamp, foreignKey, check, integer, unique, date, jsonb, numeric } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { employees } from './auth';
import { leads } from './leads';

export const companyTargets = pgTable("company_targets", {
	id: text().primaryKey().notNull(),
	ceoEmployeeId: text("ceo_employee_id").notNull(),
	periodLabel: text("period_label").notNull(),
	fiscalYear: text("fiscal_year").default('FY2026-27').notNull(),
	totalRevenueTarget: numeric("total_revenue_target").notNull(),
	totalWinsTarget: numeric("total_wins_target").notNull(),
	verticalAllocations: jsonb("vertical_allocations").default([]).notNull(),
	unallocatedRevenueBuffer: numeric("unallocated_revenue_buffer").default('0').notNull(),
	unallocatedWinsBuffer: numeric("unallocated_wins_buffer").default('0').notNull(),
	status: text().default('draft').notNull(),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	version: integer().default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ceoEmployeeId],
			foreignColumns: [employees.id],
			name: "company_targets_ceo_employee_id_fkey"
		}),
	unique("company_targets_fiscal_year_period_label_version_key").on(table.periodLabel, table.fiscalYear, table.version),
	check("company_targets_status_check", sql`status = ANY (ARRAY['draft'::text, 'approved_by_ceo'::text, 'board_ratified'::text])`),
]);


export const companyForecasts = pgTable("company_forecasts", {
	id: text().primaryKey().notNull(),
	ceoEmployeeId: text("ceo_employee_id").notNull(),
	periodLabel: text("period_label").notNull(),
	bottomUpSum: numeric("bottom_up_sum").notNull(),
	executiveMacroAdjustment: numeric("executive_macro_adjustment").default('0').notNull(),
	signedOffRevenue: numeric("signed_off_revenue").notNull(),
	currency: text().default('INR').notNull(),
	verticalSubmissions: jsonb("vertical_submissions").default([]).notNull(),
	macroAssumptions: text("macro_assumptions").notNull(),
	boardRiskNotes: text("board_risk_notes"),
	status: text().default('draft').notNull(),
	signedOffAt: timestamp("signed_off_at", { withTimezone: true, mode: 'string' }),
	version: integer().default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ceoEmployeeId],
			foreignColumns: [employees.id],
			name: "company_forecasts_ceo_employee_id_fkey"
		}),
	check("company_forecasts_status_check", sql`status = ANY (ARRAY['draft'::text, 'signed_off_by_ceo'::text, 'presented_to_board'::text])`),
]);


export const growthInitiatives = pgTable("growth_initiatives", {
	id: text().primaryKey().notNull(),
	ceoEmployeeId: text("ceo_employee_id").notNull(),
	title: text().notNull(),
	vertical: text().notNull(),
	initiativeType: text("initiative_type").notNull(),
	capitalRequired: numeric("capital_required").notNull(),
	currency: text().default('INR').notNull(),
	projectedRoiPercent: numeric("projected_roi_percent").notNull(),
	timelineMonths: integer("timeline_months").notNull(),
	sponsorExecutive: text("sponsor_executive").notNull(),
	justification: text().notNull(),
	implementationTasks: jsonb("implementation_tasks").default([]).notNull(),
	status: text().default('proposed').notNull(),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ceoEmployeeId],
			foreignColumns: [employees.id],
			name: "growth_initiatives_ceo_employee_id_fkey"
		}),
	check("growth_initiatives_initiative_type_check", sql`initiative_type = ANY (ARRAY['geographic_expansion'::text, 'digital_channel'::text, 'talent_surge'::text, 'product_launch'::text])`),
	check("growth_initiatives_status_check", sql`status = ANY (ARRAY['proposed'::text, 'approved_by_ceo'::text, 'funded'::text, 'rejected'::text])`),
]);


export const crossVerticalConflicts = pgTable("cross_vertical_conflicts", {
	id: text().primaryKey().notNull(),
	ceoEmployeeId: text("ceo_employee_id").notNull(),
	sourceVertical: text("source_vertical").notNull(),
	conflictingVertical: text("conflicting_vertical").notNull(),
	prospectOrClientName: text("prospect_or_client_name").notNull(),
	conflictNature: text("conflict_nature").notNull(),
	summary: text().notNull(),
	sourceArgument: text("source_argument").notNull(),
	counterArgument: text("counter_argument").notNull(),
	ceoDetermination: text("ceo_determination"),
	awardedLeadId: text("awarded_lead_id"),
	resolvedAttribution: text("resolved_attribution"),
	status: text().default('open').notNull(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.awardedLeadId],
			foreignColumns: [leads.id],
			name: "cross_vertical_conflicts_awarded_lead_id_fkey"
		}),
	foreignKey({
			columns: [table.ceoEmployeeId],
			foreignColumns: [employees.id],
			name: "cross_vertical_conflicts_ceo_employee_id_fkey"
		}),
	check("cross_vertical_conflicts_conflict_nature_check", sql`conflict_nature = ANY (ARRAY['client_ownership'::text, 'revenue_attribution'::text, 'fee_splitting'::text, 'channel_cannibalization'::text])`),
	check("cross_vertical_conflicts_status_check", sql`status = ANY (ARRAY['open'::text, 'under_ceo_arbitration'::text, 'resolved'::text])`),
]);


export const criticalOperatingRisks = pgTable("critical_operating_risks", {
	id: text().primaryKey().notNull(),
	ceoEmployeeId: text("ceo_employee_id").notNull(),
	vertical: text().notNull(),
	sourceAction: text("source_action").default('CEO-08').notNull(),
	riskCategory: text("risk_category").notNull(),
	severity: text().notNull(),
	title: text().notNull(),
	details: text().notNull(),
	exposureAmount: numeric("exposure_amount"),
	mitigationMandate: text("mitigation_mandate"),
	accountableExecutive: text("accountable_executive").notNull(),
	decisionDeadline: timestamp("decision_deadline", { withTimezone: true, mode: 'string' }).notNull(),
	status: text().default('open').notNull(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ceoEmployeeId],
			foreignColumns: [employees.id],
			name: "critical_operating_risks_ceo_employee_id_fkey"
		}),
	check("critical_operating_risks_risk_category_check", sql`risk_category = ANY (ARRAY['regulatory_breach'::text, 'client_litigation'::text, 'reputational_loss'::text, 'operational_failure'::text])`),
	check("critical_operating_risks_severity_check", sql`severity = ANY (ARRAY['high'::text, 'critical'::text, 'existential'::text])`),
	check("critical_operating_risks_status_check", sql`status = ANY (ARRAY['open'::text, 'mitigation_in_progress'::text, 'resolved'::text])`),
]);


export const boardReportSchedules = pgTable("board_report_schedules", {
	id: text().primaryKey().notNull(),
	ceoEmployeeId: text("ceo_employee_id").notNull(),
	title: text().notNull(),
	frequency: text().notNull(),
	deliveryCadence: text("delivery_cadence").notNull(),
	stakeholders: jsonb().default([]).notNull(),
	sections: jsonb().default([]).notNull(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ceoEmployeeId],
			foreignColumns: [employees.id],
			name: "board_report_schedules_ceo_employee_id_fkey"
		}),
	check("board_report_schedules_frequency_check", sql`frequency = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'annual'::text])`),
	check("board_report_schedules_status_check", sql`status = ANY (ARRAY['active'::text, 'paused'::text])`),
]);


export const executiveCommitments = pgTable("executive_commitments", {
	id: text().primaryKey().notNull(),
	ceoEmployeeId: text("ceo_employee_id").notNull(),
	sourceAction: text("source_action").notNull(),
	title: text().notNull(),
	accountableLeader: text("accountable_leader").notNull(),
	vertical: text(),
	actionableMandate: text("actionable_mandate").notNull(),
	dueDate: date("due_date").notNull(),
	status: text().default('in_progress').notNull(),
	evidenceUrl: text("evidence_url"),
	fulfilledAt: timestamp("fulfilled_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ceoEmployeeId],
			foreignColumns: [employees.id],
			name: "executive_commitments_ceo_employee_id_fkey"
		}),
	check("executive_commitments_source_action_check", sql`source_action = ANY (ARRAY['CEO-01'::text, 'CEO-02'::text, 'CEO-06'::text, 'CEO-07'::text, 'CEO-08'::text, 'CEO-11'::text])`),
	check("executive_commitments_status_check", sql`status = ANY (ARRAY['in_progress'::text, 'fulfilled'::text, 'escalated_to_board'::text])`),
]);

