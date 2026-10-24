import { pgTable, text, timestamp, index, foreignKey, check, integer, unique, jsonb, boolean, numeric, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { employees, teams } from './auth';
import { leadTasks, leads } from './leads';
import { calls } from './comms';

export const allocationBatches = pgTable("allocation_batches", {
	id: text().primaryKey().notNull(),
	batchKey: text("batch_key").notNull(),
	actorEmployeeId: text("actor_employee_id").notNull(),
	actorTeamId: text("actor_team_id"),
	method: text().notNull(),
	totalCount: integer("total_count").notNull(),
	successCount: integer("success_count").default(0).notNull(),
	heldCount: integer("held_count").default(0).notNull(),
	failedCount: integer("failed_count").default(0).notNull(),
	results: jsonb().default([]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "allocation_batches_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.actorTeamId],
			foreignColumns: [teams.id],
			name: "allocation_batches_actor_team_id_fkey"
		}),
	unique("allocation_batches_batch_key_key").on(table.batchKey),
]);


export const targetAllocations = pgTable("target_allocations", {
	id: text().primaryKey().notNull(),
	targetId: text("target_id").notNull(),
	employeeId: text("employee_id").notNull(),
	allocatedValue: numeric("allocated_value").notNull(),
	prorateNote: text("prorate_note"),
	version: integer().default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "target_allocations_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.targetId],
			foreignColumns: [teamTargets.id],
			name: "target_allocations_target_id_fkey"
		}),
]);


export const teamTargets = pgTable("team_targets", {
	id: text().primaryKey().notNull(),
	teamId: text("team_id").notNull(),
	periodLabel: text("period_label").notNull(),
	metric: text().default('approved-wins').notNull(),
	parentValue: numeric("parent_value").notNull(),
	status: text().default('approved').notNull(),
	version: integer().default(1).notNull(),
	closed: boolean().default(false).notNull(),
	createdBy: text("created_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [employees.id],
			name: "team_targets_created_by_fkey"
		}),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "team_targets_team_id_fkey"
		}),
	unique("team_targets_team_id_period_label_metric_version_key").on(table.teamId, table.periodLabel, table.metric, table.version),
	check("team_targets_status_check", sql`status = ANY (ARRAY['approved'::text, 'published'::text])`),
]);


export const teamForecasts = pgTable("team_forecasts", {
	id: text().primaryKey().notNull(),
	teamId: text("team_id").notNull(),
	periodLabel: text("period_label").notNull(),
	category: text().notNull(),
	expectedRevenue: numeric("expected_revenue").notNull(),
	currency: text().default('INR').notNull(),
	opportunityIds: jsonb("opportunity_ids").default([]).notNull(),
	riskNotes: text("risk_notes"),
	assumptions: text(),
	status: text().default('submitted').notNull(),
	version: integer().default(1).notNull(),
	actorEmployeeId: text("actor_employee_id").notNull(),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	managerDecision: text("manager_decision"),
	managerFeedback: text("manager_feedback"),
	managerDecidedAt: timestamp("manager_decided_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("team_forecasts_version_unique").using("btree", table.teamId.asc().nullsLast().op("text_ops"), table.periodLabel.asc().nullsLast().op("text_ops"), table.category.asc().nullsLast().op("int4_ops"), table.version.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "team_forecasts_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "team_forecasts_team_id_fkey"
		}),
	check("team_forecasts_category_check", sql`category = ANY (ARRAY['commit'::text, 'best-case'::text, 'pipeline'::text])`),
	check("team_forecasts_manager_decision_check", sql`manager_decision = ANY (ARRAY['accepted'::text, 'returned'::text])`),
	check("team_forecasts_status_check", sql`status = ANY (ARRAY['submitted'::text, 'revised'::text])`),
]);


export const teamRequests = pgTable("team_requests", {
	id: text().primaryKey().notNull(),
	teamId: text("team_id"),
	actorEmployeeId: text("actor_employee_id").notNull(),
	category: text().notNull(),
	subjectEmployeeId: text("subject_employee_id"),
	leadId: text("lead_id"),
	severity: text(),
	payload: jsonb().default({}).notNull(),
	status: text().default('pending').notNull(),
	decidedBy: text("decided_by"),
	decisionReason: text("decision_reason"),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	dueAt: timestamp("due_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_team_requests_status").using("btree", table.status.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "team_requests_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.decidedBy],
			foreignColumns: [employees.id],
			name: "team_requests_decided_by_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "team_requests_lead_id_fkey"
		}),
	foreignKey({
			columns: [table.subjectEmployeeId],
			foreignColumns: [employees.id],
			name: "team_requests_subject_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "team_requests_team_id_fkey"
		}),
	check("team_requests_category_check", sql`category = ANY (ARRAY['staffing'::text, 'role-change'::text, 'capacity'::text, 'complaint'::text, 'commercial-exception'::text, 'merge-request'::text])`),
	check("team_requests_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'resolved'::text])`),
]);


export const teamReportExports = pgTable("team_report_exports", {
	id: text().primaryKey().notNull(),
	actorEmployeeId: text("actor_employee_id").notNull(),
	teamIds: jsonb("team_ids").notNull(),
	period: text().notNull(),
	periodStart: timestamp("period_start", { withTimezone: true, mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { withTimezone: true, mode: 'string' }).notNull(),
	metricVersion: text("metric_version").notNull(),
	filename: text().notNull(),
	relPath: text("rel_path").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "team_report_exports_actor_employee_id_fkey"
		}),
]);


export const activityCorrections = pgTable("activity_corrections", {
	id: text().primaryKey().notNull(),
	callId: text("call_id").notNull(),
	actorEmployeeId: text("actor_employee_id").notNull(),
	requestedField: text("requested_field").notNull(),
	requestedValue: text("requested_value").notNull(),
	originalValue: text("original_value"),
	evidenceRef: text("evidence_ref"),
	explanation: text().notNull(),
	status: text().default('pending').notNull(),
	decidedBy: text("decided_by"),
	decisionReason: text("decision_reason"),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	affectedReportVersions: jsonb("affected_report_versions").default([]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	decisionEvidence: jsonb("decision_evidence").default({}).notNull(),
}, (table) => [
	index("idx_activity_corrections_status").using("btree", table.status.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "activity_corrections_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.callId],
			foreignColumns: [calls.id],
			name: "activity_corrections_call_id_fkey"
		}),
	foreignKey({
			columns: [table.decidedBy],
			foreignColumns: [employees.id],
			name: "activity_corrections_decided_by_fkey"
		}),
	check("activity_corrections_field_check", sql`requested_field = ANY (ARRAY['wrapup_disposition'::text, 'status'::text, 'wrapup_note'::text])`),
	check("activity_corrections_status_check", sql`status = ANY (ARRAY['pending'::text, 'accepted'::text, 'returned'::text, 'rejected'::text])`),
]);


export const overdueEscalations = pgTable("overdue_escalations", {
	id: text().primaryKey().notNull(),
	taskId: text("task_id").notNull(),
	leadId: text("lead_id").notNull(),
	subjectEmployeeId: text("subject_employee_id").notNull(),
	actorEmployeeId: text("actor_employee_id").notNull(),
	action: text().notNull(),
	reason: text().notNull(),
	severity: text().default('medium').notNull(),
	recoveryTaskId: text("recovery_task_id"),
	managerNotified: boolean("manager_notified").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "overdue_escalations_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "overdue_escalations_lead_id_fkey"
		}),
	foreignKey({
			columns: [table.recoveryTaskId],
			foreignColumns: [leadTasks.id],
			name: "overdue_escalations_recovery_task_id_fkey"
		}),
	foreignKey({
			columns: [table.subjectEmployeeId],
			foreignColumns: [employees.id],
			name: "overdue_escalations_subject_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [leadTasks.id],
			name: "overdue_escalations_task_id_fkey"
		}),
	check("overdue_escalations_action_check", sql`action = ANY (ARRAY['coach'::text, 'reassign'::text, 'escalate'::text])`),
]);

