import { pgTable, text, timestamp, index, foreignKey, check, integer, unique, jsonb, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { employees } from './auth';
import { leadTasks, leads } from './leads';

export const calls = pgTable("calls", {
	id: text().primaryKey().notNull(),
	leadId: text("lead_id").notNull(),
	actorEmployeeId: text("actor_employee_id").notNull(),
	direction: text().notNull(),
	providerMode: text("provider_mode").notNull(),
	idempotencyKey: text("idempotency_key"),
	status: text().notNull(),
	evidenceStatus: text("evidence_status").default('simulated').notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
	durationSeconds: integer("duration_seconds"),
	wrapupDisposition: text("wrapup_disposition"),
	wrapupNeedConfirmed: boolean("wrapup_need_confirmed"),
	wrapupNote: text("wrapup_note"),
	wrapupNextAction: text("wrapup_next_action"),
	wrapupDueAt: timestamp("wrapup_due_at", { withTimezone: true, mode: 'string' }),
	wrapupSavedAt: timestamp("wrapup_saved_at", { withTimezone: true, mode: 'string' }),
	needsWrapup: boolean("needs_wrapup").default(false).notNull(),
}, (table) => [
	index("idx_calls_lead").using("btree", table.leadId.asc().nullsLast().op("text_ops"), table.startedAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "calls_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "calls_lead_id_fkey"
		}),
	unique("calls_idempotency_key_key").on(table.idempotencyKey),
	check("calls_direction_check", sql`direction = ANY (ARRAY['outbound'::text, 'inbound'::text])`),
	check("calls_evidence_status_check", sql`evidence_status = ANY (ARRAY['simulated'::text, 'provider-verified'::text, 'manual'::text])`),
	check("calls_status_check", sql`status = ANY (ARRAY['connecting'::text, 'ringing'::text, 'connected'::text, 'ended'::text, 'failed'::text, 'no-answer'::text, 'missed'::text])`),
	check("calls_wrapup_disposition_check", sql`wrapup_disposition = ANY (ARRAY['connected'::text, 'no-answer'::text, 'busy'::text, 'wrong-number'::text, 'callback'::text])`),
]);


export const meetings = pgTable("meetings", {
	id: text().primaryKey().notNull(),
	leadId: text("lead_id").notNull(),
	actorEmployeeId: text("actor_employee_id").notNull(),
	meetingType: text("meeting_type").notNull(),
	slotAt: timestamp("slot_at", { withTimezone: true, mode: 'string' }).notNull(),
	location: text().notNull(),
	attendees: text().notNull(),
	agenda: text().notNull(),
	inviteStatus: text("invite_status").default('queued').notNull(),
	outcome: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_meetings_slot").using("btree", table.slotAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "meetings_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "meetings_lead_id_fkey"
		}),
	check("meetings_invite_status_check", sql`invite_status = ANY (ARRAY['queued'::text, 'delivered'::text, 'failed'::text])`),
	check("meetings_outcome_check", sql`outcome = ANY (ARRAY['attended'::text, 'no-show'::text, 'cancelled'::text])`),
]);


export const messages = pgTable("messages", {
	id: text().primaryKey().notNull(),
	leadId: text("lead_id"),
	actorEmployeeId: text("actor_employee_id"),
	direction: text().notNull(),
	channel: text().notNull(),
	template: text(),
	body: text().notNull(),
	providerRef: text("provider_ref"),
	intent: text(),
	status: text().notNull(),
	evidenceStatus: text("evidence_status").default('simulated').notNull(),
	inboundDedupeKey: text("inbound_dedupe_key"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	supervisorQueue: boolean("supervisor_queue").default(false).notNull(),
}, (table) => [
	index("idx_messages_lead").using("btree", table.leadId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "messages_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "messages_lead_id_fkey"
		}),
	unique("messages_inbound_dedupe_key_key").on(table.inboundDedupeKey),
	check("messages_channel_check", sql`channel = ANY (ARRAY['whatsapp'::text, 'sms'::text, 'email'::text])`),
	check("messages_direction_check", sql`direction = ANY (ARRAY['outbound'::text, 'inbound'::text])`),
	check("messages_evidence_status_check", sql`evidence_status = ANY (ARRAY['simulated'::text, 'provider-verified'::text, 'manual'::text])`),
	check("messages_status_check", sql`status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'replied'::text, 'failed'::text, 'received'::text, 'unmatched'::text, 'cancelled'::text])`),
]);


export const contactSuppressions = pgTable("contact_suppressions", {
	id: text().primaryKey().notNull(),
	leadId: text("lead_id").notNull(),
	createdBy: text("created_by").notNull(),
	channels: text().array().notNull(),
	reason: text().notNull(),
	source: text().notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_suppressions_lead").using("btree", table.leadId.asc().nullsLast().op("text_ops"), table.active.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [employees.id],
			name: "contact_suppressions_created_by_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "contact_suppressions_lead_id_fkey"
		}),
]);


export const reminders = pgTable("reminders", {
	id: text().primaryKey().notNull(),
	taskId: text("task_id").notNull(),
	remindAt: timestamp("remind_at", { withTimezone: true, mode: 'string' }).notNull(),
	status: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_reminders_status").using("btree", table.status.asc().nullsLast().op("text_ops"), table.remindAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [leadTasks.id],
			name: "reminders_task_id_fkey"
		}),
	check("reminders_status_check", sql`status = ANY (ARRAY['scheduled'::text, 'sent'::text, 'cancelled'::text])`),
]);


export const callQualityReviews = pgTable("call_quality_reviews", {
	id: text().primaryKey().notNull(),
	callId: text("call_id").notNull(),
	actorEmployeeId: text("actor_employee_id").notNull(),
	subjectEmployeeId: text("subject_employee_id").notNull(),
	rubricVersion: text("rubric_version").notNull(),
	scores: jsonb().default({}).notNull(),
	feedback: text().notNull(),
	evidenceRef: text("evidence_ref"),
	assessed: boolean().default(true).notNull(),
	coachingTaskId: text("coaching_task_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "call_quality_reviews_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.callId],
			foreignColumns: [calls.id],
			name: "call_quality_reviews_call_id_fkey"
		}),
	foreignKey({
			columns: [table.coachingTaskId],
			foreignColumns: [leadTasks.id],
			name: "call_quality_reviews_coaching_task_id_fkey"
		}),
	foreignKey({
			columns: [table.subjectEmployeeId],
			foreignColumns: [employees.id],
			name: "call_quality_reviews_subject_employee_id_fkey"
		}),
]);


export const evidenceAccessLog = pgTable("evidence_access_log", {
	id: text().primaryKey().notNull(),
	reviewId: text("review_id"),
	actorEmployeeId: text("actor_employee_id").notNull(),
	action: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "evidence_access_log_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.reviewId],
			foreignColumns: [callQualityReviews.id],
			name: "evidence_access_log_review_id_fkey"
		}),
]);

