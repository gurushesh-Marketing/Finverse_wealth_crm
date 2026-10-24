import { pgTable, text, timestamp, index, foreignKey, check, integer, unique, date, jsonb, boolean, numeric, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const schemaMigrations = pgTable("schema_migrations", {
	version: text().primaryKey().notNull(),
	appliedAt: timestamp("applied_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

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

export const teams = pgTable("teams", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	vertical: text().notNull(),
	regionId: text("region_id"),
}, (table) => [
	foreignKey({
			columns: [table.regionId],
			foreignColumns: [regions.id],
			name: "teams_region_id_fkey"
		}),
]);

export const employees = pgTable("employees", {
	id: text().primaryKey().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	displayName: text("display_name").notNull(),
	status: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("employees_email_key").on(table.email),
	check("employees_status_check", sql`status = ANY (ARRAY['active'::text, 'disabled'::text])`),
]);

export const assignments = pgTable("assignments", {
	id: text().primaryKey().notNull(),
	employeeId: text("employee_id").notNull(),
	role: text().notNull(),
	vertical: text().notNull(),
	teamId: text("team_id").notNull(),
	effectiveFrom: date("effective_from").notNull(),
	effectiveTo: date("effective_to"),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "assignments_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "assignments_team_id_fkey"
		}),
]);

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

export const sessions = pgTable("sessions", {
	tokenHash: text("token_hash").primaryKey().notNull(),
	employeeId: text("employee_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "sessions_employee_id_fkey"
		}),
]);

export const availabilityChanges = pgTable("availability_changes", {
	id: text().primaryKey().notNull(),
	employeeId: text("employee_id").notNull(),
	status: text().notNull(),
	effectiveFrom: timestamp("effective_from", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	note: text(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "availability_changes_employee_id_fkey"
		}),
	check("availability_changes_status_check", sql`status = ANY (ARRAY['available'::text, 'busy'::text, 'away'::text])`),
]);

export const savedViews = pgTable("saved_views", {
	id: text().primaryKey().notNull(),
	employeeId: text("employee_id").notNull(),
	name: text().notNull(),
	filters: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "saved_views_employee_id_fkey"
		}),
	unique("saved_views_employee_id_name_key").on(table.employeeId, table.name),
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

export const enquiries = pgTable("enquiries", {
	id: text().primaryKey().notNull(),
	createdBy: text("created_by").notNull(),
	displayName: text("display_name").notNull(),
	phone: text().notNull(),
	email: text(),
	product: text().notNull(),
	source: text().notNull(),
	permissionEvidence: text("permission_evidence").notNull(),
	need: text().notNull(),
	status: text().notNull(),
	duplicateOf: text("duplicate_of"),
	publishedLeadId: text("published_lead_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [employees.id],
			name: "enquiries_created_by_fkey"
		}),
	foreignKey({
			columns: [table.duplicateOf],
			foreignColumns: [leads.id],
			name: "enquiries_duplicate_of_fkey"
		}),
	foreignKey({
			columns: [table.publishedLeadId],
			foreignColumns: [leads.id],
			name: "enquiries_published_lead_id_fkey"
		}),
	check("enquiries_status_check", sql`status = ANY (ARRAY['pending-validation'::text, 'published'::text, 'duplicate'::text, 'invalid'::text])`),
]);

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

export const qualifications = pgTable("qualifications", {
	id: text().primaryKey().notNull(),
	leadId: text("lead_id").notNull(),
	actorEmployeeId: text("actor_employee_id").notNull(),
	need: text().notNull(),
	product: text().notNull(),
	expectedValue: numeric("expected_value"),
	currency: text(),
	timeHorizon: text("time_horizon"),
	checklist: jsonb().notNull(),
	checklistVersion: text("checklist_version").notNull(),
	nextStep: text("next_step").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "qualifications_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "qualifications_lead_id_fkey"
		}),
]);

export const stageEvents = pgTable("stage_events", {
	id: text().primaryKey().notNull(),
	leadId: text("lead_id").notNull(),
	actorEmployeeId: text("actor_employee_id").notNull(),
	fromStage: text("from_stage").notNull(),
	toStage: text("to_stage").notNull(),
	reason: text().notNull(),
	ruleVersion: text("rule_version").notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "stage_events_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "stage_events_lead_id_fkey"
		}),
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

export const proposals = pgTable("proposals", {
	id: text().primaryKey().notNull(),
	leadId: text("lead_id").notNull(),
	actorEmployeeId: text("actor_employee_id").notNull(),
	product: text().notNull(),
	templateVersion: text("template_version").notNull(),
	terms: text().notNull(),
	validUntil: date("valid_until").notNull(),
	status: text().notNull(),
	version: integer().default(1).notNull(),
	approverEmployeeId: text("approver_employee_id"),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "proposals_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.approverEmployeeId],
			foreignColumns: [employees.id],
			name: "proposals_approver_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "proposals_lead_id_fkey"
		}),
	check("proposals_status_check", sql`status = ANY (ARRAY['draft'::text, 'pending-approval'::text, 'approved'::text, 'sent'::text, 'withdrawn'::text])`),
]);

export const lossRecords = pgTable("loss_records", {
	id: text().primaryKey().notNull(),
	leadId: text("lead_id").notNull(),
	actorEmployeeId: text("actor_employee_id").notNull(),
	reason: text().notNull(),
	explanation: text().notNull(),
	competitor: text(),
	futureContact: text("future_contact"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "loss_records_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "loss_records_lead_id_fkey"
		}),
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

export const outcomeRequests = pgTable("outcome_requests", {
	id: text().primaryKey().notNull(),
	leadId: text("lead_id").notNull(),
	actorEmployeeId: text("actor_employee_id").notNull(),
	type: text().notNull(),
	payload: jsonb().notNull(),
	status: text().notNull(),
	decidedBy: text("decided_by"),
	decisionReason: text("decision_reason"),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	decisionEvidence: jsonb("decision_evidence").default({}).notNull(),
}, (table) => [
	index("idx_outcome_requests_status").using("btree", table.status.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "outcome_requests_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.decidedBy],
			foreignColumns: [employees.id],
			name: "outcome_requests_decided_by_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "outcome_requests_lead_id_fkey"
		}),
	check("outcome_requests_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'returned'::text, 'rejected'::text, 'completed'::text])`),
	check("outcome_requests_type_check", sql`type = ANY (ARRAY['conversion'::text, 'reopen'::text, 'handoff'::text, 'correction'::text, 'blocker'::text, 'loss'::text])`),
]);

export const documentRequests = pgTable("document_requests", {
	id: text().primaryKey().notNull(),
	leadId: text("lead_id").notNull(),
	actorEmployeeId: text("actor_employee_id").notNull(),
	checklist: text().notNull(),
	requestedFiles: text("requested_files").array().notNull(),
	uploadToken: text("upload_token").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	dueAt: timestamp("due_at", { withTimezone: true, mode: 'string' }).notNull(),
	reminderEnabled: boolean("reminder_enabled").default(true).notNull(),
	status: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.actorEmployeeId],
			foreignColumns: [employees.id],
			name: "document_requests_actor_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "document_requests_lead_id_fkey"
		}),
	unique("document_requests_upload_token_key").on(table.uploadToken),
	check("document_requests_status_check", sql`status = ANY (ARRAY['open'::text, 'fulfilled'::text, 'expired'::text])`),
]);

export const documents = pgTable("documents", {
	id: text().primaryKey().notNull(),
	leadId: text("lead_id").notNull(),
	requestId: text("request_id"),
	uploadedBy: text("uploaded_by").notNull(),
	documentType: text("document_type").notNull(),
	filename: text().notNull(),
	storagePath: text("storage_path").notNull(),
	mimeType: text("mime_type").notNull(),
	sizeBytes: integer("size_bytes").notNull(),
	version: integer().default(1).notNull(),
	scanStatus: text("scan_status").default('pending').notNull(),
	validationStatus: text("validation_status").default('pending').notNull(),
	rejectReason: text("reject_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_documents_lead").using("btree", table.leadId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "documents_lead_id_fkey"
		}),
	foreignKey({
			columns: [table.requestId],
			foreignColumns: [documentRequests.id],
			name: "documents_request_id_fkey"
		}),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [employees.id],
			name: "documents_uploaded_by_fkey"
		}),
	check("documents_scan_status_check", sql`scan_status = ANY (ARRAY['pending'::text, 'clean'::text, 'quarantined'::text])`),
	check("documents_validation_status_check", sql`validation_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])`),
]);

export const reportExports = pgTable("report_exports", {
	id: text().primaryKey().notNull(),
	employeeId: text("employee_id").notNull(),
	period: text().notNull(),
	snapshotAt: timestamp("snapshot_at", { withTimezone: true, mode: 'string' }).notNull(),
	metricVersion: text("metric_version").notNull(),
	storagePath: text("storage_path").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "report_exports_employee_id_fkey"
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

export const reviews = pgTable("reviews", {
	id: text().primaryKey().notNull(),
	employeeId: text("employee_id").notNull(),
	reviewerEmployeeId: text("reviewer_employee_id").notNull(),
	period: text().notNull(),
	scorecard: jsonb().notNull(),
	selfReflection: text("self_reflection"),
	commitments: jsonb(),
	employeeResponse: text("employee_response"),
	acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	agenda: text(),
	snapshotVersion: integer("snapshot_version").default(1).notNull(),
	scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: 'string' }),
	privateNotes: text("private_notes"),
	disagreement: text(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [employees.id],
			name: "reviews_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.reviewerEmployeeId],
			foreignColumns: [employees.id],
			name: "reviews_reviewer_employee_id_fkey"
		}),
]);

export const mentorships = pgTable("mentorships", {
	id: text().primaryKey().notNull(),
	internEmployeeId: text("intern_employee_id").notNull(),
	mentorEmployeeId: text("mentor_employee_id").notNull(),
	workCap: integer("work_cap").notNull(),
	allowedProducts: jsonb("allowed_products").default([]).notNull(),
	reviewDate: date("review_date"),
	status: text().default('active').notNull(),
	grantedBy: text("granted_by").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.grantedBy],
			foreignColumns: [employees.id],
			name: "mentorships_granted_by_fkey"
		}),
	foreignKey({
			columns: [table.internEmployeeId],
			foreignColumns: [employees.id],
			name: "mentorships_intern_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.mentorEmployeeId],
			foreignColumns: [employees.id],
			name: "mentorships_mentor_employee_id_fkey"
		}),
	check("mentorships_status_check", sql`status = ANY (ARRAY['active'::text, 'expired'::text])`),
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

export const reportSchedules = pgTable("report_schedules", {
	id: text().primaryKey().notNull(),
	ownerEmployeeId: text("owner_employee_id").notNull(),
	name: text().notNull(),
	cadence: text().notNull(),
	period: text().default('weekly').notNull(),
	teamIds: jsonb("team_ids").default([]).notNull(),
	recipients: jsonb().default([]).notNull(),
	status: text().default('active').notNull(),
	dedupeKey: text("dedupe_key").notNull(),
	lastRunAt: timestamp("last_run_at", { withTimezone: true, mode: 'string' }),
	lastExportId: text("last_export_id"),
	lastError: text("last_error"),
	nextRunAt: timestamp("next_run_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ownerEmployeeId],
			foreignColumns: [employees.id],
			name: "report_schedules_owner_employee_id_fkey"
		}),
	unique("report_schedules_dedupe_key_key").on(table.dedupeKey),
	check("report_schedules_status_check", sql`status = ANY (ARRAY['active'::text, 'suspended'::text])`),
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

export const sourceRemediations = pgTable("source_remediations", {
	id: text().primaryKey().notNull(),
	managerEmployeeId: text("manager_employee_id").notNull(),
	sourceName: text("source_name").notNull(),
	cohortPeriod: text("cohort_period").notNull(),
	sampleSize: integer("sample_size").default(0).notNull(),
	invalidIntakeCount: integer("invalid_intake_count").default(0).notNull(),
	contactFailedCount: integer("contact_failed_count").default(0).notNull(),
	commercialLossCount: integer("commercial_loss_count").default(0).notNull(),
	remediationType: text("remediation_type").notNull(),
	justification: text().notNull(),
	status: text().default('submitted').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.managerEmployeeId],
			foreignColumns: [employees.id],
			name: "source_remediations_manager_employee_id_fkey"
		}),
	check("source_remediations_remediation_type_check", sql`remediation_type = ANY (ARRAY['routing-change'::text, 'intake-correction'::text, 'quality-warning'::text, 'pause-source'::text])`),
	check("source_remediations_status_check", sql`status = ANY (ARRAY['submitted'::text, 'in-review'::text, 'resolved'::text])`),
]);

export const regions = pgTable("regions", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	vertical: text().notNull(),
});

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

export const commercialExceptions = pgTable("commercial_exceptions", {
	id: text().primaryKey().notNull(),
	proposalId: text("proposal_id"),
	leadId: text("lead_id"),
	requestedByEmployeeId: text("requested_by_employee_id").notNull(),
	decidedByManagerEmployeeId: text("decided_by_manager_employee_id"),
	exceptionType: text("exception_type").notNull(),
	requestedTerms: text("requested_terms").notNull(),
	standardTerms: text("standard_terms").notNull(),
	businessJustification: text("business_justification").notNull(),
	delegatedLimitMet: boolean("delegated_limit_met").default(true).notNull(),
	status: text().default('pending').notNull(),
	decisionNotes: text("decision_notes"),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_comm_exceptions_status").using("btree", table.status.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.decidedByManagerEmployeeId],
			foreignColumns: [employees.id],
			name: "commercial_exceptions_decided_by_manager_employee_id_fkey"
		}),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "commercial_exceptions_lead_id_fkey"
		}),
	foreignKey({
			columns: [table.requestedByEmployeeId],
			foreignColumns: [employees.id],
			name: "commercial_exceptions_requested_by_employee_id_fkey"
		}),
	check("commercial_exceptions_exception_type_check", sql`exception_type = ANY (ARRAY['fee-waiver'::text, 'rate-discount'::text, 'custom-terms'::text, 'turnaround-sla'::text])`),
	check("commercial_exceptions_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'escalated_to_rm'::text])`),
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

export const crossVerticalReferrals = pgTable("cross_vertical_referrals", {
	id: text().primaryKey().notNull(),
	referralCode: text("referral_code").notNull(),
	sourceVertical: text("source_vertical").notNull(),
	receivingVertical: text("receiving_vertical").notNull(),
	prospectName: text("prospect_name").notNull(),
	prospectContact: text("prospect_contact").notNull(),
	customerConsentEvidence: text("customer_consent_evidence").notNull(),
	commercialContext: text("commercial_context").notNull(),
	decision: text().default('pending').notNull(),
	receivingLeadId: text("receiving_lead_id"),
	declineReason: text("decline_reason"),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.receivingLeadId],
			foreignColumns: [leads.id],
			name: "cross_vertical_referrals_receiving_lead_id_fkey"
		}),
	unique("cross_vertical_referrals_referral_code_key").on(table.referralCode),
	check("cross_vertical_referrals_decision_check", sql`decision = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])`),
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
