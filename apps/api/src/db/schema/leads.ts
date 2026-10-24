import { pgTable, text, timestamp, index, foreignKey, check, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { assignments, employees, teams } from './auth';

export const leads = pgTable("leads", {
	id: text().primaryKey().notNull(),
	vertical: text().notNull(),
	displayName: text("display_name").notNull(),
	email: text(),
	phone: text().notNull(),
	preferredLanguage: text("preferred_language").notNull(),
	product: text().notNull(),
	source: text().notNull(),
	stage: text().notNull(),
	ownerEmployeeId: text("owner_employee_id"),
	teamId: text("team_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	recordVersion: integer("record_version").default(1).notNull(),
}, (table) => [
	index("idx_leads_owner").using("btree", table.ownerEmployeeId.asc().nullsLast().op("text_ops")),
	index("idx_leads_team").using("btree", table.teamId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.ownerEmployeeId],
			foreignColumns: [employees.id],
			name: "leads_owner_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "leads_team_id_fkey"
		}),
	check("leads_stage_check", sql`stage = ANY (ARRAY['new'::text, 'not-contacted'::text, 'contacted'::text, 'follow-up'::text, 'qualified'::text, 'converted'::text, 'lost'::text])`),
]);


export const leadTasks = pgTable("lead_tasks", {
	id: text().primaryKey().notNull(),
	leadId: text("lead_id").notNull(),
	ownerEmployeeId: text("owner_employee_id").notNull(),
	action: text().notNull(),
	purpose: text().notNull(),
	dueAt: timestamp("due_at", { withTimezone: true, mode: 'string' }).notNull(),
	priority: text().notNull(),
	status: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	originalDueAt: timestamp("original_due_at", { withTimezone: true, mode: 'string' }),
	deferralCount: integer("deferral_count").default(0).notNull(),
}, (table) => [
	index("idx_lead_tasks_due").using("btree", table.status.asc().nullsLast().op("text_ops"), table.dueAt.asc().nullsLast().op("text_ops")),
	index("idx_lead_tasks_owner_status").using("btree", table.ownerEmployeeId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "lead_tasks_lead_id_fkey"
		}),
	foreignKey({
			columns: [table.ownerEmployeeId],
			foreignColumns: [employees.id],
			name: "lead_tasks_owner_employee_id_fkey"
		}),
	check("lead_tasks_status_check", sql`status = ANY (ARRAY['open'::text, 'completed'::text, 'cancelled'::text])`),
]);


export const leadEvents = pgTable("lead_events", {
	id: text().primaryKey().notNull(),
	leadId: text("lead_id").notNull(),
	actorEmployeeId: text("actor_employee_id").notNull(),
	kind: text().notNull(),
	note: text().notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	actorRole: text("actor_role"),
	actorTeamId: text("actor_team_id"),
	assignmentId: text("assignment_id"),
}, (table) => [
	index("idx_lead_events_lead").using("btree", table.leadId.asc().nullsLast().op("text_ops"), table.occurredAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "lead_events_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "lead_events_lead_id_fkey"
		}),
]);


export const leadOwnershipEvents = pgTable("lead_ownership_events", {
	id: text().primaryKey().notNull(),
	leadId: text("lead_id").notNull(),
	fromOwnerEmployeeId: text("from_owner_employee_id"),
	toOwnerEmployeeId: text("to_owner_employee_id"),
	actorEmployeeId: text("actor_employee_id").notNull(),
	actorRole: text("actor_role").notNull(),
	actorTeamId: text("actor_team_id"),
	assignmentId: text("assignment_id"),
	kind: text().notNull(),
	reason: text().notNull(),
	batchKey: text("batch_key"),
	recordVersion: integer("record_version").notNull(),
	changedAt: timestamp("changed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_owner_events_lead").using("btree", table.leadId.asc().nullsLast().op("text_ops"), table.changedAt.desc().nullsFirst().op("text_ops")),
	uniqueIndex("lead_ownership_batch_unique").using("btree", table.leadId.asc().nullsLast().op("text_ops"), table.batchKey.asc().nullsLast().op("text_ops")).where(sql`(batch_key IS NOT NULL)`),
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "lead_ownership_events_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.actorTeamId],
			foreignColumns: [teams.id],
			name: "lead_ownership_events_actor_team_id_fkey"
		}),
	foreignKey({
			columns: [table.assignmentId],
			foreignColumns: [assignments.id],
			name: "lead_ownership_events_assignment_id_fkey"
		}),
	foreignKey({
			columns: [table.fromOwnerEmployeeId],
			foreignColumns: [employees.id],
			name: "lead_ownership_events_from_owner_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "lead_ownership_events_lead_id_fkey"
		}),
	foreignKey({
			columns: [table.toOwnerEmployeeId],
			foreignColumns: [employees.id],
			name: "lead_ownership_events_to_owner_employee_id_fkey"
		}),
	check("lead_ownership_events_kind_check", sql`kind = ANY (ARRAY['first-allocation'::text, 'transfer'::text, 'rebalance'::text, 'batch'::text])`),
]);


export const leadAudit = pgTable("lead_audit", {
	id: text().primaryKey().notNull(),
	leadId: text("lead_id").notNull(),
	actorEmployeeId: text("actor_employee_id").notNull(),
	field: text().notNull(),
	beforeValue: text("before_value"),
	afterValue: text("after_value"),
	reason: text().notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "lead_audit_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "lead_audit_lead_id_fkey"
		}),
]);

