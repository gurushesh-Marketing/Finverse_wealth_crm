import { pgTable, text, timestamp, index, foreignKey, check, integer, unique, date, jsonb, boolean, numeric } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { employees, regions } from './auth';

export const regionalTargets = pgTable("regional_targets", {
	id: text().primaryKey().notNull(),
	rmEmployeeId: text("rm_employee_id").notNull(),
	regionId: text("region_id").notNull(),
	periodLabel: text("period_label").notNull(),
	metric: text().default('approved-wins').notNull(),
	approvedNmTarget: numeric("approved_nm_target").notNull(),
	unallocatedRemainder: numeric("unallocated_remainder").default('0').notNull(),
	status: text().default('draft').notNull(),
	version: integer().default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.regionId],
			foreignColumns: [regions.id],
			name: "regional_targets_region_id_fkey"
		}),
	foreignKey({
			columns: [table.rmEmployeeId],
			foreignColumns: [employees.id],
			name: "regional_targets_rm_employee_id_fkey"
		}),
	unique("regional_targets_region_id_period_label_metric_version_key").on(table.regionId, table.periodLabel, table.metric, table.version),
	check("regional_targets_status_check", sql`status = ANY (ARRAY['draft'::text, 'published'::text])`),
]);


export const regionalForecasts = pgTable("regional_forecasts", {
	id: text().primaryKey().notNull(),
	rmEmployeeId: text("rm_employee_id").notNull(),
	regionId: text("region_id").notNull(),
	periodLabel: text("period_label").notNull(),
	bottomUpRevenue: numeric("bottom_up_revenue").notNull(),
	regionalAdjustment: numeric("regional_adjustment").default('0').notNull(),
	adjustedRevenue: numeric("adjusted_revenue").notNull(),
	currency: text().default('INR').notNull(),
	acceptedManagerForecastIds: jsonb("accepted_manager_forecast_ids").default([]).notNull(),
	topRegionalRisks: jsonb("top_regional_risks").default([]).notNull(),
	regionalAssumptions: text("regional_assumptions"),
	status: text().default('draft').notNull(),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }),
	version: integer().default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.regionId],
			foreignColumns: [regions.id],
			name: "regional_forecasts_region_id_fkey"
		}),
	foreignKey({
			columns: [table.rmEmployeeId],
			foreignColumns: [employees.id],
			name: "regional_forecasts_rm_employee_id_fkey"
		}),
	check("regional_forecasts_status_check", sql`status = ANY (ARRAY['draft'::text, 'submitted_to_nm'::text])`),
]);


export const regionalManagementActions = pgTable("regional_management_actions", {
	id: text().primaryKey().notNull(),
	rmEmployeeId: text("rm_employee_id").notNull(),
	sourceAction: text("source_action").notNull(),
	kind: text().notNull(),
	subjectManagerEmployeeId: text("subject_manager_employee_id").notNull(),
	ownerEmployeeId: text("owner_employee_id").notNull(),
	regionId: text("region_id"),
	metricKey: text("metric_key"),
	periodLabel: text("period_label"),
	title: text().notNull(),
	detail: text(),
	dueAt: timestamp("due_at", { withTimezone: true, mode: 'string' }).notNull(),
	status: text().default('open').notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_reg_actions_mgr").using("btree", table.subjectManagerEmployeeId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("idx_reg_actions_rm").using("btree", table.rmEmployeeId.asc().nullsLast().op("timestamptz_ops"), table.status.asc().nullsLast().op("timestamptz_ops"), table.dueAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.ownerEmployeeId],
			foreignColumns: [employees.id],
			name: "regional_management_actions_owner_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.regionId],
			foreignColumns: [regions.id],
			name: "regional_management_actions_region_id_fkey"
		}),
	foreignKey({
			columns: [table.rmEmployeeId],
			foreignColumns: [employees.id],
			name: "regional_management_actions_rm_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.subjectManagerEmployeeId],
			foreignColumns: [employees.id],
			name: "regional_management_actions_subject_manager_employee_id_fkey"
		}),
	check("regional_management_actions_kind_check", sql`kind = ANY (ARRAY['regional-intervention'::text, 'manager-coaching'::text, 'capacity-reallocation'::text, 'sla-recovery'::text])`),
	check("regional_management_actions_source_action_check", sql`source_action = ANY (ARRAY['RM-01'::text, 'RM-02'::text, 'RM-08'::text, 'RM-09'::text])`),
	check("regional_management_actions_status_check", sql`status = ANY (ARRAY['open'::text, 'done'::text, 'cancelled'::text])`),
]);


export const regionalStaffingPlans = pgTable("regional_staffing_plans", {
	id: text().primaryKey().notNull(),
	rmEmployeeId: text("rm_employee_id").notNull(),
	regionId: text("region_id").notNull(),
	periodLabel: text("period_label").notNull(),
	plannedHeadcount: integer("planned_headcount").default(0).notNull(),
	approvedHeadcount: integer("approved_headcount").default(0).notNull(),
	activeHeadcount: integer("active_headcount").default(0).notNull(),
	requisitions: jsonb().default([]).notNull(),
	businessJustification: text("business_justification").notNull(),
	status: text().default('draft').notNull(),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	version: integer().default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.regionId],
			foreignColumns: [regions.id],
			name: "regional_staffing_plans_region_id_fkey"
		}),
	foreignKey({
			columns: [table.rmEmployeeId],
			foreignColumns: [employees.id],
			name: "regional_staffing_plans_rm_employee_id_fkey"
		}),
	check("regional_staffing_plans_status_check", sql`status = ANY (ARRAY['draft'::text, 'approved_by_rm'::text, 'submitted_to_hr'::text, 'active'::text])`),
]);


export const territoryCoveragePlans = pgTable("territory_coverage_plans", {
	id: text().primaryKey().notNull(),
	rmEmployeeId: text("rm_employee_id").notNull(),
	regionId: text("region_id").notNull(),
	territoryName: text("territory_name").notNull(),
	subRegion: text("sub_region").notNull(),
	productScope: text("product_scope").notNull(),
	languageQueues: jsonb("language_queues").default([]).notNull(),
	targetTeamIds: jsonb("target_team_ids").default([]).notNull(),
	capacityGap: integer("capacity_gap").default(0).notNull(),
	routingProposal: text("routing_proposal").notNull(),
	status: text().default('draft').notNull(),
	activationDate: date("activation_date").notNull(),
	version: integer().default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.regionId],
			foreignColumns: [regions.id],
			name: "territory_coverage_plans_region_id_fkey"
		}),
	foreignKey({
			columns: [table.rmEmployeeId],
			foreignColumns: [employees.id],
			name: "territory_coverage_plans_rm_employee_id_fkey"
		}),
	check("territory_coverage_plans_status_check", sql`status = ANY (ARRAY['draft'::text, 'submitted_for_activation'::text, 'activated'::text])`),
]);


export const crossRegionTransfers = pgTable("cross_region_transfers", {
	id: text().primaryKey().notNull(),
	nmEmployeeId: text("nm_employee_id").notNull(),
	sourceRegionId: text("source_region_id").notNull(),
	destinationRegionId: text("destination_region_id").notNull(),
	leadIds: jsonb("lead_ids").default([]).notNull(),
	reason: text().notNull(),
	handoffPlan: text("handoff_plan"),
	status: text().default('pending').notNull(),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.destinationRegionId],
			foreignColumns: [regions.id],
			name: "cross_region_transfers_destination_region_id_fkey"
		}),
	foreignKey({
			columns: [table.nmEmployeeId],
			foreignColumns: [employees.id],
			name: "cross_region_transfers_nm_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceRegionId],
			foreignColumns: [regions.id],
			name: "cross_region_transfers_source_region_id_fkey"
		}),
	check("cross_region_transfers_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])`),
]);


export const regionalEscalations = pgTable("regional_escalations", {
	id: text().primaryKey().notNull(),
	rmEmployeeId: text("rm_employee_id").notNull(),
	regionId: text("region_id"),
	sourceType: text("source_type").notNull(),
	sourceId: text("source_id"),
	title: text().notNull(),
	severity: text().notNull(),
	accountableManagerEmployeeId: text("accountable_manager_employee_id"),
	detail: text().notNull(),
	recoveryDecision: text("recovery_decision"),
	deadline: timestamp({ withTimezone: true, mode: 'string' }),
	status: text().default('open').notNull(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.accountableManagerEmployeeId],
			foreignColumns: [employees.id],
			name: "regional_escalations_accountable_manager_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.regionId],
			foreignColumns: [regions.id],
			name: "regional_escalations_region_id_fkey"
		}),
	foreignKey({
			columns: [table.rmEmployeeId],
			foreignColumns: [employees.id],
			name: "regional_escalations_rm_employee_id_fkey"
		}),
	check("regional_escalations_severity_check", sql`severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])`),
	check("regional_escalations_source_type_check", sql`source_type = ANY (ARRAY['commercial_exception'::text, 'source_quality'::text, 'sla_breach'::text, 'operational_risk'::text])`),
	check("regional_escalations_status_check", sql`status = ANY (ARRAY['open'::text, 'recovery_plan_assigned'::text, 'resolved'::text, 'escalated_to_nm'::text])`),
]);


export const rmReviews = pgTable("rm_reviews", {
	id: text().primaryKey().notNull(),
	nmEmployeeId: text("nm_employee_id").notNull(),
	rmEmployeeId: text("rm_employee_id").notNull(),
	periodLabel: text("period_label").notNull(),
	performanceRating: text("performance_rating").notNull(),
	strengths: text().notNull(),
	blockers: text().notNull(),
	growthCommitments: jsonb("growth_commitments").default([]).notNull(),
	coverageCommitments: jsonb("coverage_commitments").default([]).notNull(),
	supportNeeded: text("support_needed"),
	privateNmNotes: text("private_nm_notes"),
	nextReviewDate: date("next_review_date").notNull(),
	acknowledged: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.nmEmployeeId],
			foreignColumns: [employees.id],
			name: "rm_reviews_nm_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.rmEmployeeId],
			foreignColumns: [employees.id],
			name: "rm_reviews_rm_employee_id_fkey"
		}),
	check("rm_reviews_performance_rating_check", sql`performance_rating = ANY (ARRAY['exceeding'::text, 'achieving'::text, 'needs_improvement'::text, 'critical'::text])`),
]);


export const regionalReportSchedules = pgTable("regional_report_schedules", {
	id: text().primaryKey().notNull(),
	rmEmployeeId: text("rm_employee_id").notNull(),
	regionId: text("region_id").notNull(),
	name: text().notNull(),
	periodType: text("period_type").notNull(),
	cadence: text().notNull(),
	recipients: jsonb().default([]).notNull(),
	sections: jsonb().default([]).notNull(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.regionId],
			foreignColumns: [regions.id],
			name: "regional_report_schedules_region_id_fkey"
		}),
	foreignKey({
			columns: [table.rmEmployeeId],
			foreignColumns: [employees.id],
			name: "regional_report_schedules_rm_employee_id_fkey"
		}),
	check("regional_report_schedules_period_type_check", sql`period_type = ANY (ARRAY['weekly'::text, 'monthly'::text, 'quarterly'::text])`),
	check("regional_report_schedules_status_check", sql`status = ANY (ARRAY['active'::text, 'paused'::text])`),
]);

