import { pgTable, text, timestamp, foreignKey, check, unique, date } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const schemaMigrations = pgTable("schema_migrations", {
	version: text().primaryKey().notNull(),
	appliedAt: timestamp("applied_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});


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


export const regions = pgTable("regions", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	vertical: text().notNull(),
});


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

