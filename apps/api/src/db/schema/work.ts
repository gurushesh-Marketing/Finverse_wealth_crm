import { pgTable, text, timestamp, foreignKey, check, integer, unique, date, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { employees } from './auth';

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

