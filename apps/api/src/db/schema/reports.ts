import { pgTable, text, timestamp, foreignKey, check, integer, unique, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { employees } from './auth';

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

