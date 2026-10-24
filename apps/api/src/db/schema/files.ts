import { pgTable, text, timestamp, index, foreignKey, check, integer, unique, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { leads } from './leads';
import { employees } from './auth';

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

