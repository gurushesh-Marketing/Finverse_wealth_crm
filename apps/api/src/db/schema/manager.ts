import { pgTable, text, timestamp, index, foreignKey, check, integer, unique, date, jsonb, boolean, numeric } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { employees, teams } from './auth';

export const managerTargets = pgTable("manager_targets", {
	id: text().primaryKey().notNull(),
	managerEmployeeId: text("manager_employee_id").notNull(),
	periodLabel: text("period_label").notNull(),
	metric: text().default('approved-wins').notNull(),
	approvedParentTarget: numeric("approved_parent_target").notNull(),
	unallocatedRemainder: numeric("unallocated_remainder").default('0').notNull(),
	status: text().default('draft').notNull(),
	version: integer().default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.managerEmployeeId],
			foreignColumns: [employees.id],
			name: "manager_targets_manager_employee_id_fkey"
		}),
	unique("manager_targets_manager_employee_id_period_label_metric_ver_key").on(table.managerEmployeeId, table.periodLabel, table.metric, table.version),
	check("manager_targets_status_check", sql`status = ANY (ARRAY['draft'::text, 'published'::text])`),
]);


export const managerForecasts = pgTable("manager_forecasts", {
	id: text().primaryKey().notNull(),
	managerEmployeeId: text("manager_employee_id").notNull(),
	periodLabel: text("period_label").notNull(),
	bottomUpRevenue: numeric("bottom_up_revenue").notNull(),
	managementAdjustment: numeric("management_adjustment").default('0').notNull(),
	adjustedRevenue: numeric("adjusted_revenue").notNull(),
	currency: text().default('INR').notNull(),
	acceptedForecastIds: jsonb("accepted_forecast_ids").default([]).notNull(),
	overrideReason: text("override_reason"),
	riskNotes: text("risk_notes"),
	status: text().default('draft').notNull(),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }),
	version: integer().default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_manager_forecasts_period").using("btree", table.managerEmployeeId.asc().nullsLast().op("text_ops"), table.periodLabel.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.managerEmployeeId],
			foreignColumns: [employees.id],
			name: "manager_forecasts_manager_employee_id_fkey"
		}),
	check("manager_forecasts_status_check", sql`status = ANY (ARRAY['draft'::text, 'submitted_to_rm'::text])`),
]);


export const managerReviews = pgTable("manager_reviews", {
	id: text().primaryKey().notNull(),
	rmEmployeeId: text("rm_employee_id").notNull(),
	managerEmployeeId: text("manager_employee_id").notNull(),
	periodLabel: text("period_label").notNull(),
	performanceRating: text("performance_rating").notNull(),
	strengths: text().notNull(),
	blockers: text().notNull(),
	improvementCommitments: jsonb("improvement_commitments").default([]).notNull(),
	supportActions: text("support_actions"),
	privateRmNotes: text("private_rm_notes"),
	nextReviewDate: date("next_review_date").notNull(),
	acknowledged: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.managerEmployeeId],
			foreignColumns: [employees.id],
			name: "manager_reviews_manager_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.rmEmployeeId],
			foreignColumns: [employees.id],
			name: "manager_reviews_rm_employee_id_fkey"
		}),
	check("manager_reviews_performance_rating_check", sql`performance_rating = ANY (ARRAY['exceeding'::text, 'achieving'::text, 'needs_improvement'::text, 'critical'::text])`),
]);


export const managementActions = pgTable("management_actions", {
	id: text().primaryKey().notNull(),
	managerEmployeeId: text("manager_employee_id").notNull(),
	sourceAction: text("source_action").notNull(),
	kind: text().notNull(),
	subjectTlEmployeeId: text("subject_tl_employee_id").notNull(),
	ownerEmployeeId: text("owner_employee_id").notNull(),
	teamId: text("team_id"),
	metricKey: text("metric_key"),
	periodLabel: text("period_label"),
	title: text().notNull(),
	detail: text(),
	dueAt: timestamp("due_at", { withTimezone: true, mode: 'string' }).notNull(),
	status: text().default('open').notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_mgmt_actions_manager").using("btree", table.managerEmployeeId.asc().nullsLast().op("timestamptz_ops"), table.status.asc().nullsLast().op("text_ops"), table.dueAt.asc().nullsLast().op("text_ops")),
	index("idx_mgmt_actions_subject").using("btree", table.subjectTlEmployeeId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.managerEmployeeId],
			foreignColumns: [employees.id],
			name: "management_actions_manager_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.ownerEmployeeId],
			foreignColumns: [employees.id],
			name: "management_actions_owner_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.subjectTlEmployeeId],
			foreignColumns: [employees.id],
			name: "management_actions_subject_tl_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "management_actions_team_id_fkey"
		}),
	check("management_actions_kind_check", sql`kind = ANY (ARRAY['intervention'::text, 'coaching'::text, 'capacity'::text, 'follow-up'::text])`),
	check("management_actions_source_action_check", sql`source_action = ANY (ARRAY['MG-01'::text, 'MG-02'::text, 'MG-08'::text, 'MG-11'::text])`),
	check("management_actions_status_check", sql`status = ANY (ARRAY['open'::text, 'done'::text, 'cancelled'::text])`),
]);


export const crossManagerTransfers = pgTable("cross_manager_transfers", {
	id: text().primaryKey().notNull(),
	rmEmployeeId: text("rm_employee_id").notNull(),
	sourceManagerEmployeeId: text("source_manager_employee_id").notNull(),
	destinationManagerEmployeeId: text("destination_manager_employee_id").notNull(),
	sourceTeamId: text("source_team_id").notNull(),
	destinationTeamId: text("destination_team_id").notNull(),
	leadIds: jsonb("lead_ids").default([]).notNull(),
	reason: text().notNull(),
	forecastImpactNotes: text("forecast_impact_notes"),
	status: text().default('pending').notNull(),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.destinationManagerEmployeeId],
			foreignColumns: [employees.id],
			name: "cross_manager_transfers_destination_manager_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.destinationTeamId],
			foreignColumns: [teams.id],
			name: "cross_manager_transfers_destination_team_id_fkey"
		}),
	foreignKey({
			columns: [table.rmEmployeeId],
			foreignColumns: [employees.id],
			name: "cross_manager_transfers_rm_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceManagerEmployeeId],
			foreignColumns: [employees.id],
			name: "cross_manager_transfers_source_manager_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceTeamId],
			foreignColumns: [teams.id],
			name: "cross_manager_transfers_source_team_id_fkey"
		}),
	check("cross_manager_transfers_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])`),
]);


export const capacityPlans = pgTable("capacity_plans", {
	id: text().primaryKey().notNull(),
	managerEmployeeId: text("manager_employee_id").notNull(),
	name: text().notNull(),
	periodLabel: text("period_label").notNull(),
	teamIds: jsonb("team_ids").default([]).notNull(),
	currentBacklog: integer("current_backlog").default(0).notNull(),
	availableCallers: integer("available_callers").default(0).notNull(),
	plannedReallocations: jsonb("planned_reallocations").default([]).notNull(),
	requiredAdditionalStaff: integer("required_additional_staff").default(0).notNull(),
	operationalDeadline: timestamp("operational_deadline", { withTimezone: true, mode: 'string' }),
	notes: text(),
	status: text().default('draft').notNull(),
	version: integer().default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.managerEmployeeId],
			foreignColumns: [employees.id],
			name: "capacity_plans_manager_employee_id_fkey"
		}),
	check("capacity_plans_status_check", sql`status = ANY (ARRAY['draft'::text, 'approved'::text])`),
]);


export const leadTransferRequests = pgTable("lead_transfer_requests", {
	id: text().primaryKey().notNull(),
	managerEmployeeId: text("manager_employee_id").notNull(),
	sourceTeamId: text("source_team_id").notNull(),
	destinationTeamId: text("destination_team_id").notNull(),
	leadIds: jsonb("lead_ids").default([]).notNull(),
	reason: text().notNull(),
	status: text().default('pending').notNull(),
	resolutionNotes: text("resolution_notes"),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_transfers_status").using("btree", table.status.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.destinationTeamId],
			foreignColumns: [teams.id],
			name: "lead_transfer_requests_destination_team_id_fkey"
		}),
	foreignKey({
			columns: [table.managerEmployeeId],
			foreignColumns: [employees.id],
			name: "lead_transfer_requests_manager_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.sourceTeamId],
			foreignColumns: [teams.id],
			name: "lead_transfer_requests_source_team_id_fkey"
		}),
	check("lead_transfer_requests_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'returned'::text])`),
]);

