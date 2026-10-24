import { pgTable, text, timestamp, index, foreignKey, check, integer, unique, date, jsonb, boolean, numeric } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { employees } from './auth';
import { leads } from './leads';

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

