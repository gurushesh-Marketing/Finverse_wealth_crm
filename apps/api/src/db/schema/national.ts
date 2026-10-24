import { pgTable, text, timestamp, index, foreignKey, check, integer, unique, date, jsonb, boolean, numeric } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { employees, regions, teams } from './auth';

export const nationalTargets = pgTable("national_targets", {
	id: text().primaryKey().notNull(),
	nmEmployeeId: text("nm_employee_id").notNull(),
	vertical: text().notNull(),
	periodLabel: text("period_label").notNull(),
	metric: text().default('approved-wins').notNull(),
	approvedCeoTarget: numeric("approved_ceo_target").notNull(),
	unallocatedRemainder: numeric("unallocated_remainder").default('0').notNull(),
	regionalAllocations: jsonb("regional_allocations").default([]).notNull(),
	status: text().default('draft').notNull(),
	version: integer().default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.nmEmployeeId],
			foreignColumns: [employees.id],
			name: "national_targets_nm_employee_id_fkey"
		}),
	unique("national_targets_vertical_period_label_metric_version_key").on(table.vertical, table.periodLabel, table.metric, table.version),
	check("national_targets_status_check", sql`status = ANY (ARRAY['draft'::text, 'published'::text])`),
]);


export const nationalForecasts = pgTable("national_forecasts", {
	id: text().primaryKey().notNull(),
	nmEmployeeId: text("nm_employee_id").notNull(),
	vertical: text().notNull(),
	periodLabel: text("period_label").notNull(),
	bottomUpRevenue: numeric("bottom_up_revenue").notNull(),
	nationalAdjustment: numeric("national_adjustment").default('0').notNull(),
	adjustedRevenue: numeric("adjusted_revenue").notNull(),
	currency: text().default('INR').notNull(),
	acceptedRegionalForecastIds: jsonb("accepted_regional_forecast_ids").default([]).notNull(),
	topNationalRisks: jsonb("top_national_risks").default([]).notNull(),
	nationalAssumptions: text("national_assumptions"),
	status: text().default('draft').notNull(),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }),
	version: integer().default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.nmEmployeeId],
			foreignColumns: [employees.id],
			name: "national_forecasts_nm_employee_id_fkey"
		}),
	check("national_forecasts_status_check", sql`status = ANY (ARRAY['draft'::text, 'submitted_to_executives'::text])`),
]);


export const nationalManagementActions = pgTable("national_management_actions", {
	id: text().primaryKey().notNull(),
	nmEmployeeId: text("nm_employee_id").notNull(),
	sourceAction: text("source_action").notNull(),
	kind: text().notNull(),
	subjectRmEmployeeId: text("subject_rm_employee_id").notNull(),
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
	index("idx_nat_actions_nm").using("btree", table.nmEmployeeId.asc().nullsLast().op("timestamptz_ops"), table.status.asc().nullsLast().op("text_ops"), table.dueAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.nmEmployeeId],
			foreignColumns: [employees.id],
			name: "national_management_actions_nm_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.ownerEmployeeId],
			foreignColumns: [employees.id],
			name: "national_management_actions_owner_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.regionId],
			foreignColumns: [regions.id],
			name: "national_management_actions_region_id_fkey"
		}),
	foreignKey({
			columns: [table.subjectRmEmployeeId],
			foreignColumns: [employees.id],
			name: "national_management_actions_subject_rm_employee_id_fkey"
		}),
	check("national_management_actions_kind_check", sql`kind = ANY (ARRAY['regional-directive'::text, 'rm-coaching'::text, 'resource-rebalancing'::text, 'policy-compliance'::text])`),
	check("national_management_actions_source_action_check", sql`source_action = ANY (ARRAY['NM-01'::text, 'NM-02'::text, 'NM-09'::text, 'NM-10'::text])`),
	check("national_management_actions_status_check", sql`status = ANY (ARRAY['open'::text, 'done'::text, 'cancelled'::text])`),
]);


export const nationalEscalations = pgTable("national_escalations", {
	id: text().primaryKey().notNull(),
	nmEmployeeId: text("nm_employee_id").notNull(),
	vertical: text().notNull(),
	category: text().notNull(),
	targetExecutive: text("target_executive").notNull(),
	title: text().notNull(),
	detail: text().notNull(),
	evidenceSummary: text("evidence_summary"),
	decisionDeadline: timestamp("decision_deadline", { withTimezone: true, mode: 'string' }).notNull(),
	executiveDecision: text("executive_decision"),
	status: text().default('open').notNull(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.nmEmployeeId],
			foreignColumns: [employees.id],
			name: "national_escalations_nm_employee_id_fkey"
		}),
	check("national_escalations_category_check", sql`category = ANY (ARRAY['revenue_assumption'::text, 'strategic_exception'::text, 'pricing_policy'::text, 'governance_risk'::text])`),
	check("national_escalations_status_check", sql`status = ANY (ARRAY['open'::text, 'under_executive_review'::text, 'resolved'::text])`),
	check("national_escalations_target_executive_check", sql`target_executive = ANY (ARRAY['CEO'::text, 'CFO'::text, 'BOTH'::text])`),
]);


export const nmLeadershipReviews = pgTable("nm_leadership_reviews", {
	id: text().primaryKey().notNull(),
	ceoEmployeeId: text("ceo_employee_id").notNull(),
	nmEmployeeId: text("nm_employee_id").notNull(),
	vertical: text().notNull(),
	periodLabel: text("period_label").notNull(),
	overallLeadershipRating: text("overall_leadership_rating").notNull(),
	strategicAlignment: text("strategic_alignment").notNull(),
	operationalExecution: text("operational_execution").notNull(),
	teamHealthAndRetention: text("team_health_and_retention").notNull(),
	boardVisibilityReadiness: text("board_visibility_readiness").notNull(),
	strategicCommitments: jsonb("strategic_commitments").default([]).notNull(),
	supportFromCeo: text("support_from_ceo"),
	nextReviewDate: date("next_review_date").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ceoEmployeeId],
			foreignColumns: [employees.id],
			name: "nm_leadership_reviews_ceo_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.nmEmployeeId],
			foreignColumns: [employees.id],
			name: "nm_leadership_reviews_nm_employee_id_fkey"
		}),
	check("nm_leadership_reviews_overall_leadership_rating_check", sql`overall_leadership_rating = ANY (ARRAY['role_model'::text, 'strong_performer'::text, 'developing'::text, 'off_track'::text])`),
]);


export const nationalReportSchedules = pgTable("national_report_schedules", {
	id: text().primaryKey().notNull(),
	nmEmployeeId: text("nm_employee_id").notNull(),
	vertical: text().notNull(),
	name: text().notNull(),
	periodType: text("period_type").notNull(),
	cadence: text().notNull(),
	recipients: jsonb().default([]).notNull(),
	sections: jsonb().default([]).notNull(),
	status: text().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.nmEmployeeId],
			foreignColumns: [employees.id],
			name: "national_report_schedules_nm_employee_id_fkey"
		}),
	check("national_report_schedules_period_type_check", sql`period_type = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'half-yearly'::text, 'annual'::text])`),
	check("national_report_schedules_status_check", sql`status = ANY (ARRAY['active'::text, 'paused'::text])`),
]);


export const productRuleProposals = pgTable("product_rule_proposals", {
	id: text().primaryKey().notNull(),
	nmEmployeeId: text("nm_employee_id").notNull(),
	vertical: text().notNull(),
	ruleName: text("rule_name").notNull(),
	currentVersion: text("current_version").notNull(),
	proposedVersion: text("proposed_version").notNull(),
	reason: text().notNull(),
	effectiveDate: date("effective_date").notNull(),
	affectedProducts: jsonb("affected_products").default([]).notNull(),
	previewImpact: text("preview_impact"),
	status: text().default('submitted').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.nmEmployeeId],
			foreignColumns: [employees.id],
			name: "product_rule_proposals_nm_employee_id_fkey"
		}),
	check("product_rule_proposals_status_check", sql`status = ANY (ARRAY['submitted'::text, 'approved_by_product'::text, 'activated'::text, 'rejected'::text])`),
]);


export const employeeLifecycleRequests = pgTable("employee_lifecycle_requests", {
	id: text().primaryKey().notNull(),
	managerEmployeeId: text("manager_employee_id").notNull(),
	employeeId: text("employee_id").notNull(),
	proposedRole: text("proposed_role").notNull(),
	proposedTeamId: text("proposed_team_id"),
	effectiveDate: date("effective_date").notNull(),
	businessJustification: text("business_justification").notNull(),
	handoffPlan: text("handoff_plan").notNull(),
	status: text().default('submitted').notNull(),
	hrNotified: boolean("hr_notified").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "employee_lifecycle_requests_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.managerEmployeeId],
			foreignColumns: [employees.id],
			name: "employee_lifecycle_requests_manager_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.proposedTeamId],
			foreignColumns: [teams.id],
			name: "employee_lifecycle_requests_proposed_team_id_fkey"
		}),
	check("employee_lifecycle_requests_proposed_role_check", sql`proposed_role = ANY (ARRAY['SC'::text, 'TL'::text, 'MG'::text])`),
	check("employee_lifecycle_requests_status_check", sql`status = ANY (ARRAY['submitted'::text, 'approved_by_rm'::text, 'activated_by_admin'::text, 'rejected'::text])`),
]);

