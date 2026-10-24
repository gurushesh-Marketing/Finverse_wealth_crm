-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "schema_migrations" (
	"version" text PRIMARY KEY NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"owner_employee_id" text NOT NULL,
	"action" text NOT NULL,
	"purpose" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"priority" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"original_due_at" timestamp with time zone,
	"deferral_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "lead_tasks_status_check" CHECK (status = ANY (ARRAY['open'::text, 'completed'::text, 'cancelled'::text]))
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"vertical" text NOT NULL,
	"region_id" text
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_email_key" UNIQUE("email"),
	CONSTRAINT "employees_status_check" CHECK (status = ANY (ARRAY['active'::text, 'disabled'::text]))
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"role" text NOT NULL,
	"vertical" text NOT NULL,
	"team_id" text NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"vertical" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"phone" text NOT NULL,
	"preferred_language" text NOT NULL,
	"product" text NOT NULL,
	"source" text NOT NULL,
	"stage" text NOT NULL,
	"owner_employee_id" text,
	"team_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"record_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "leads_stage_check" CHECK (stage = ANY (ARRAY['new'::text, 'not-contacted'::text, 'contacted'::text, 'follow-up'::text, 'qualified'::text, 'converted'::text, 'lost'::text]))
);
--> statement-breakpoint
CREATE TABLE "lead_events" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"actor_employee_id" text NOT NULL,
	"kind" text NOT NULL,
	"note" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_role" text,
	"actor_team_id" text,
	"assignment_id" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"status" text NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	CONSTRAINT "availability_changes_status_check" CHECK (status = ANY (ARRAY['available'::text, 'busy'::text, 'away'::text]))
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_views_employee_id_name_key" UNIQUE("employee_id","name")
);
--> statement-breakpoint
CREATE TABLE "lead_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"actor_employee_id" text NOT NULL,
	"field" text NOT NULL,
	"before_value" text,
	"after_value" text,
	"reason" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text,
	"actor_employee_id" text,
	"direction" text NOT NULL,
	"channel" text NOT NULL,
	"template" text,
	"body" text NOT NULL,
	"provider_ref" text,
	"intent" text,
	"status" text NOT NULL,
	"evidence_status" text DEFAULT 'simulated' NOT NULL,
	"inbound_dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"supervisor_queue" boolean DEFAULT false NOT NULL,
	CONSTRAINT "messages_inbound_dedupe_key_key" UNIQUE("inbound_dedupe_key"),
	CONSTRAINT "messages_channel_check" CHECK (channel = ANY (ARRAY['whatsapp'::text, 'sms'::text, 'email'::text])),
	CONSTRAINT "messages_direction_check" CHECK (direction = ANY (ARRAY['outbound'::text, 'inbound'::text])),
	CONSTRAINT "messages_evidence_status_check" CHECK (evidence_status = ANY (ARRAY['simulated'::text, 'provider-verified'::text, 'manual'::text])),
	CONSTRAINT "messages_status_check" CHECK (status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'replied'::text, 'failed'::text, 'received'::text, 'unmatched'::text, 'cancelled'::text]))
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" text PRIMARY KEY NOT NULL,
	"created_by" text NOT NULL,
	"display_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"product" text NOT NULL,
	"source" text NOT NULL,
	"permission_evidence" text NOT NULL,
	"need" text NOT NULL,
	"status" text NOT NULL,
	"duplicate_of" text,
	"published_lead_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enquiries_status_check" CHECK (status = ANY (ARRAY['pending-validation'::text, 'published'::text, 'duplicate'::text, 'invalid'::text]))
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"actor_employee_id" text NOT NULL,
	"direction" text NOT NULL,
	"provider_mode" text NOT NULL,
	"idempotency_key" text,
	"status" text NOT NULL,
	"evidence_status" text DEFAULT 'simulated' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"wrapup_disposition" text,
	"wrapup_need_confirmed" boolean,
	"wrapup_note" text,
	"wrapup_next_action" text,
	"wrapup_due_at" timestamp with time zone,
	"wrapup_saved_at" timestamp with time zone,
	"needs_wrapup" boolean DEFAULT false NOT NULL,
	CONSTRAINT "calls_idempotency_key_key" UNIQUE("idempotency_key"),
	CONSTRAINT "calls_direction_check" CHECK (direction = ANY (ARRAY['outbound'::text, 'inbound'::text])),
	CONSTRAINT "calls_evidence_status_check" CHECK (evidence_status = ANY (ARRAY['simulated'::text, 'provider-verified'::text, 'manual'::text])),
	CONSTRAINT "calls_status_check" CHECK (status = ANY (ARRAY['connecting'::text, 'ringing'::text, 'connected'::text, 'ended'::text, 'failed'::text, 'no-answer'::text, 'missed'::text])),
	CONSTRAINT "calls_wrapup_disposition_check" CHECK (wrapup_disposition = ANY (ARRAY['connected'::text, 'no-answer'::text, 'busy'::text, 'wrong-number'::text, 'callback'::text]))
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"remind_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminders_status_check" CHECK (status = ANY (ARRAY['scheduled'::text, 'sent'::text, 'cancelled'::text]))
);
--> statement-breakpoint
CREATE TABLE "qualifications" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"actor_employee_id" text NOT NULL,
	"need" text NOT NULL,
	"product" text NOT NULL,
	"expected_value" numeric,
	"currency" text,
	"time_horizon" text,
	"checklist" jsonb NOT NULL,
	"checklist_version" text NOT NULL,
	"next_step" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"actor_employee_id" text NOT NULL,
	"from_stage" text NOT NULL,
	"to_stage" text NOT NULL,
	"reason" text NOT NULL,
	"rule_version" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"actor_employee_id" text NOT NULL,
	"meeting_type" text NOT NULL,
	"slot_at" timestamp with time zone NOT NULL,
	"location" text NOT NULL,
	"attendees" text NOT NULL,
	"agenda" text NOT NULL,
	"invite_status" text DEFAULT 'queued' NOT NULL,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meetings_invite_status_check" CHECK (invite_status = ANY (ARRAY['queued'::text, 'delivered'::text, 'failed'::text])),
	CONSTRAINT "meetings_outcome_check" CHECK (outcome = ANY (ARRAY['attended'::text, 'no-show'::text, 'cancelled'::text]))
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"actor_employee_id" text NOT NULL,
	"product" text NOT NULL,
	"template_version" text NOT NULL,
	"terms" text NOT NULL,
	"valid_until" date NOT NULL,
	"status" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"approver_employee_id" text,
	"decided_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'pending-approval'::text, 'approved'::text, 'sent'::text, 'withdrawn'::text]))
);
--> statement-breakpoint
CREATE TABLE "loss_records" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"actor_employee_id" text NOT NULL,
	"reason" text NOT NULL,
	"explanation" text NOT NULL,
	"competitor" text,
	"future_contact" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_suppressions" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"created_by" text NOT NULL,
	"channels" text[] NOT NULL,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcome_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"actor_employee_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text NOT NULL,
	"decided_by" text,
	"decision_reason" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decision_evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "outcome_requests_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'returned'::text, 'rejected'::text, 'completed'::text])),
	CONSTRAINT "outcome_requests_type_check" CHECK (type = ANY (ARRAY['conversion'::text, 'reopen'::text, 'handoff'::text, 'correction'::text, 'blocker'::text, 'loss'::text]))
);
--> statement-breakpoint
CREATE TABLE "document_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"actor_employee_id" text NOT NULL,
	"checklist" text NOT NULL,
	"requested_files" text[] NOT NULL,
	"upload_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"reminder_enabled" boolean DEFAULT true NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_requests_upload_token_key" UNIQUE("upload_token"),
	CONSTRAINT "document_requests_status_check" CHECK (status = ANY (ARRAY['open'::text, 'fulfilled'::text, 'expired'::text]))
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"request_id" text,
	"uploaded_by" text NOT NULL,
	"document_type" text NOT NULL,
	"filename" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"scan_status" text DEFAULT 'pending' NOT NULL,
	"validation_status" text DEFAULT 'pending' NOT NULL,
	"reject_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_scan_status_check" CHECK (scan_status = ANY (ARRAY['pending'::text, 'clean'::text, 'quarantined'::text])),
	CONSTRAINT "documents_validation_status_check" CHECK (validation_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text]))
);
--> statement-breakpoint
CREATE TABLE "report_exports" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"period" text NOT NULL,
	"snapshot_at" timestamp with time zone NOT NULL,
	"metric_version" text NOT NULL,
	"storage_path" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_ownership_events" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"from_owner_employee_id" text,
	"to_owner_employee_id" text,
	"actor_employee_id" text NOT NULL,
	"actor_role" text NOT NULL,
	"actor_team_id" text,
	"assignment_id" text,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"batch_key" text,
	"record_version" integer NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_ownership_events_kind_check" CHECK (kind = ANY (ARRAY['first-allocation'::text, 'transfer'::text, 'rebalance'::text, 'batch'::text]))
);
--> statement-breakpoint
CREATE TABLE "allocation_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_key" text NOT NULL,
	"actor_employee_id" text NOT NULL,
	"actor_team_id" text,
	"method" text NOT NULL,
	"total_count" integer NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"held_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allocation_batches_batch_key_key" UNIQUE("batch_key")
);
--> statement-breakpoint
CREATE TABLE "overdue_escalations" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"subject_employee_id" text NOT NULL,
	"actor_employee_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"recovery_task_id" text,
	"manager_notified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "overdue_escalations_action_check" CHECK (action = ANY (ARRAY['coach'::text, 'reassign'::text, 'escalate'::text]))
);
--> statement-breakpoint
CREATE TABLE "call_quality_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"call_id" text NOT NULL,
	"actor_employee_id" text NOT NULL,
	"subject_employee_id" text NOT NULL,
	"rubric_version" text NOT NULL,
	"scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"feedback" text NOT NULL,
	"evidence_ref" text,
	"assessed" boolean DEFAULT true NOT NULL,
	"coaching_task_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_access_log" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text,
	"actor_employee_id" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_forecasts" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"period_label" text NOT NULL,
	"category" text NOT NULL,
	"expected_revenue" numeric NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"opportunity_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risk_notes" text,
	"assumptions" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"actor_employee_id" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"manager_decision" text,
	"manager_feedback" text,
	"manager_decided_at" timestamp with time zone,
	CONSTRAINT "team_forecasts_category_check" CHECK (category = ANY (ARRAY['commit'::text, 'best-case'::text, 'pipeline'::text])),
	CONSTRAINT "team_forecasts_manager_decision_check" CHECK (manager_decision = ANY (ARRAY['accepted'::text, 'returned'::text])),
	CONSTRAINT "team_forecasts_status_check" CHECK (status = ANY (ARRAY['submitted'::text, 'revised'::text]))
);
--> statement-breakpoint
CREATE TABLE "team_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"period_label" text NOT NULL,
	"metric" text DEFAULT 'approved-wins' NOT NULL,
	"parent_value" numeric NOT NULL,
	"status" text DEFAULT 'approved' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"closed" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_targets_team_id_period_label_metric_version_key" UNIQUE("team_id","period_label","metric","version"),
	CONSTRAINT "team_targets_status_check" CHECK (status = ANY (ARRAY['approved'::text, 'published'::text]))
);
--> statement-breakpoint
CREATE TABLE "target_allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"target_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"allocated_value" numeric NOT NULL,
	"prorate_note" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"reviewer_employee_id" text NOT NULL,
	"period" text NOT NULL,
	"scorecard" jsonb NOT NULL,
	"self_reflection" text,
	"commitments" jsonb,
	"employee_response" text,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"agenda" text,
	"snapshot_version" integer DEFAULT 1 NOT NULL,
	"scheduled_at" timestamp with time zone,
	"private_notes" text,
	"disagreement" text
);
--> statement-breakpoint
CREATE TABLE "mentorships" (
	"id" text PRIMARY KEY NOT NULL,
	"intern_employee_id" text NOT NULL,
	"mentor_employee_id" text NOT NULL,
	"work_cap" integer NOT NULL,
	"allowed_products" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"review_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"granted_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mentorships_status_check" CHECK (status = ANY (ARRAY['active'::text, 'expired'::text]))
);
--> statement-breakpoint
CREATE TABLE "team_report_exports" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_employee_id" text NOT NULL,
	"team_ids" jsonb NOT NULL,
	"period" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"metric_version" text NOT NULL,
	"filename" text NOT NULL,
	"rel_path" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "management_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"manager_employee_id" text NOT NULL,
	"source_action" text NOT NULL,
	"kind" text NOT NULL,
	"subject_tl_employee_id" text NOT NULL,
	"owner_employee_id" text NOT NULL,
	"team_id" text,
	"metric_key" text,
	"period_label" text,
	"title" text NOT NULL,
	"detail" text,
	"due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "management_actions_kind_check" CHECK (kind = ANY (ARRAY['intervention'::text, 'coaching'::text, 'capacity'::text, 'follow-up'::text])),
	CONSTRAINT "management_actions_source_action_check" CHECK (source_action = ANY (ARRAY['MG-01'::text, 'MG-02'::text, 'MG-08'::text, 'MG-11'::text])),
	CONSTRAINT "management_actions_status_check" CHECK (status = ANY (ARRAY['open'::text, 'done'::text, 'cancelled'::text]))
);
--> statement-breakpoint
CREATE TABLE "report_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_employee_id" text NOT NULL,
	"name" text NOT NULL,
	"cadence" text NOT NULL,
	"period" text DEFAULT 'weekly' NOT NULL,
	"team_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"dedupe_key" text NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_export_id" text,
	"last_error" text,
	"next_run_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_schedules_dedupe_key_key" UNIQUE("dedupe_key"),
	CONSTRAINT "report_schedules_status_check" CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text]))
);
--> statement-breakpoint
CREATE TABLE "team_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text,
	"actor_employee_id" text NOT NULL,
	"category" text NOT NULL,
	"subject_employee_id" text,
	"lead_id" text,
	"severity" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decision_reason" text,
	"decided_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_requests_category_check" CHECK (category = ANY (ARRAY['staffing'::text, 'role-change'::text, 'capacity'::text, 'complaint'::text, 'commercial-exception'::text, 'merge-request'::text])),
	CONSTRAINT "team_requests_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'resolved'::text]))
);
--> statement-breakpoint
CREATE TABLE "activity_corrections" (
	"id" text PRIMARY KEY NOT NULL,
	"call_id" text NOT NULL,
	"actor_employee_id" text NOT NULL,
	"requested_field" text NOT NULL,
	"requested_value" text NOT NULL,
	"original_value" text,
	"evidence_ref" text,
	"explanation" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decision_reason" text,
	"decided_at" timestamp with time zone,
	"affected_report_versions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decision_evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "activity_corrections_field_check" CHECK (requested_field = ANY (ARRAY['wrapup_disposition'::text, 'status'::text, 'wrapup_note'::text])),
	CONSTRAINT "activity_corrections_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'returned'::text, 'rejected'::text]))
);
--> statement-breakpoint
CREATE TABLE "manager_forecasts" (
	"id" text PRIMARY KEY NOT NULL,
	"manager_employee_id" text NOT NULL,
	"period_label" text NOT NULL,
	"bottom_up_revenue" numeric NOT NULL,
	"management_adjustment" numeric DEFAULT '0' NOT NULL,
	"adjusted_revenue" numeric NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"accepted_forecast_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"override_reason" text,
	"risk_notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manager_forecasts_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'submitted_to_rm'::text]))
);
--> statement-breakpoint
CREATE TABLE "manager_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"manager_employee_id" text NOT NULL,
	"period_label" text NOT NULL,
	"metric" text DEFAULT 'approved-wins' NOT NULL,
	"approved_parent_target" numeric NOT NULL,
	"unallocated_remainder" numeric DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manager_targets_manager_employee_id_period_label_metric_ver_key" UNIQUE("manager_employee_id","period_label","metric","version"),
	CONSTRAINT "manager_targets_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text]))
);
--> statement-breakpoint
CREATE TABLE "capacity_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"manager_employee_id" text NOT NULL,
	"name" text NOT NULL,
	"period_label" text NOT NULL,
	"team_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_backlog" integer DEFAULT 0 NOT NULL,
	"available_callers" integer DEFAULT 0 NOT NULL,
	"planned_reallocations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required_additional_staff" integer DEFAULT 0 NOT NULL,
	"operational_deadline" timestamp with time zone,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capacity_plans_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'approved'::text]))
);
--> statement-breakpoint
CREATE TABLE "lead_transfer_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"manager_employee_id" text NOT NULL,
	"source_team_id" text NOT NULL,
	"destination_team_id" text NOT NULL,
	"lead_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolution_notes" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_transfer_requests_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'returned'::text]))
);
--> statement-breakpoint
CREATE TABLE "source_remediations" (
	"id" text PRIMARY KEY NOT NULL,
	"manager_employee_id" text NOT NULL,
	"source_name" text NOT NULL,
	"cohort_period" text NOT NULL,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"invalid_intake_count" integer DEFAULT 0 NOT NULL,
	"contact_failed_count" integer DEFAULT 0 NOT NULL,
	"commercial_loss_count" integer DEFAULT 0 NOT NULL,
	"remediation_type" text NOT NULL,
	"justification" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_remediations_remediation_type_check" CHECK (remediation_type = ANY (ARRAY['routing-change'::text, 'intake-correction'::text, 'quality-warning'::text, 'pause-source'::text])),
	CONSTRAINT "source_remediations_status_check" CHECK (status = ANY (ARRAY['submitted'::text, 'in-review'::text, 'resolved'::text]))
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"vertical" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_lifecycle_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"manager_employee_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"proposed_role" text NOT NULL,
	"proposed_team_id" text,
	"effective_date" date NOT NULL,
	"business_justification" text NOT NULL,
	"handoff_plan" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"hr_notified" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_lifecycle_requests_proposed_role_check" CHECK (proposed_role = ANY (ARRAY['SC'::text, 'TL'::text, 'MG'::text])),
	CONSTRAINT "employee_lifecycle_requests_status_check" CHECK (status = ANY (ARRAY['submitted'::text, 'approved_by_rm'::text, 'activated_by_admin'::text, 'rejected'::text]))
);
--> statement-breakpoint
CREATE TABLE "commercial_exceptions" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text,
	"lead_id" text,
	"requested_by_employee_id" text NOT NULL,
	"decided_by_manager_employee_id" text,
	"exception_type" text NOT NULL,
	"requested_terms" text NOT NULL,
	"standard_terms" text NOT NULL,
	"business_justification" text NOT NULL,
	"delegated_limit_met" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decision_notes" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commercial_exceptions_exception_type_check" CHECK (exception_type = ANY (ARRAY['fee-waiver'::text, 'rate-discount'::text, 'custom-terms'::text, 'turnaround-sla'::text])),
	CONSTRAINT "commercial_exceptions_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'escalated_to_rm'::text]))
);
--> statement-breakpoint
CREATE TABLE "regional_management_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"rm_employee_id" text NOT NULL,
	"source_action" text NOT NULL,
	"kind" text NOT NULL,
	"subject_manager_employee_id" text NOT NULL,
	"owner_employee_id" text NOT NULL,
	"region_id" text,
	"metric_key" text,
	"period_label" text,
	"title" text NOT NULL,
	"detail" text,
	"due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regional_management_actions_kind_check" CHECK (kind = ANY (ARRAY['regional-intervention'::text, 'manager-coaching'::text, 'capacity-reallocation'::text, 'sla-recovery'::text])),
	CONSTRAINT "regional_management_actions_source_action_check" CHECK (source_action = ANY (ARRAY['RM-01'::text, 'RM-02'::text, 'RM-08'::text, 'RM-09'::text])),
	CONSTRAINT "regional_management_actions_status_check" CHECK (status = ANY (ARRAY['open'::text, 'done'::text, 'cancelled'::text]))
);
--> statement-breakpoint
CREATE TABLE "territory_coverage_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"rm_employee_id" text NOT NULL,
	"region_id" text NOT NULL,
	"territory_name" text NOT NULL,
	"sub_region" text NOT NULL,
	"product_scope" text NOT NULL,
	"language_queues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_team_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capacity_gap" integer DEFAULT 0 NOT NULL,
	"routing_proposal" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"activation_date" date NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "territory_coverage_plans_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'submitted_for_activation'::text, 'activated'::text]))
);
--> statement-breakpoint
CREATE TABLE "regional_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"rm_employee_id" text NOT NULL,
	"region_id" text NOT NULL,
	"period_label" text NOT NULL,
	"metric" text DEFAULT 'approved-wins' NOT NULL,
	"approved_nm_target" numeric NOT NULL,
	"unallocated_remainder" numeric DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regional_targets_region_id_period_label_metric_version_key" UNIQUE("region_id","period_label","metric","version"),
	CONSTRAINT "regional_targets_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text]))
);
--> statement-breakpoint
CREATE TABLE "cross_manager_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"rm_employee_id" text NOT NULL,
	"source_manager_employee_id" text NOT NULL,
	"destination_manager_employee_id" text NOT NULL,
	"source_team_id" text NOT NULL,
	"destination_team_id" text NOT NULL,
	"lead_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reason" text NOT NULL,
	"forecast_impact_notes" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cross_manager_transfers_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))
);
--> statement-breakpoint
CREATE TABLE "regional_staffing_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"rm_employee_id" text NOT NULL,
	"region_id" text NOT NULL,
	"period_label" text NOT NULL,
	"planned_headcount" integer DEFAULT 0 NOT NULL,
	"approved_headcount" integer DEFAULT 0 NOT NULL,
	"active_headcount" integer DEFAULT 0 NOT NULL,
	"requisitions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"business_justification" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"decided_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regional_staffing_plans_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'approved_by_rm'::text, 'submitted_to_hr'::text, 'active'::text]))
);
--> statement-breakpoint
CREATE TABLE "regional_forecasts" (
	"id" text PRIMARY KEY NOT NULL,
	"rm_employee_id" text NOT NULL,
	"region_id" text NOT NULL,
	"period_label" text NOT NULL,
	"bottom_up_revenue" numeric NOT NULL,
	"regional_adjustment" numeric DEFAULT '0' NOT NULL,
	"adjusted_revenue" numeric NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"accepted_manager_forecast_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"top_regional_risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"regional_assumptions" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regional_forecasts_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'submitted_to_nm'::text]))
);
--> statement-breakpoint
CREATE TABLE "regional_escalations" (
	"id" text PRIMARY KEY NOT NULL,
	"rm_employee_id" text NOT NULL,
	"region_id" text,
	"source_type" text NOT NULL,
	"source_id" text,
	"title" text NOT NULL,
	"severity" text NOT NULL,
	"accountable_manager_employee_id" text,
	"detail" text NOT NULL,
	"recovery_decision" text,
	"deadline" timestamp with time zone,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regional_escalations_severity_check" CHECK (severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])),
	CONSTRAINT "regional_escalations_source_type_check" CHECK (source_type = ANY (ARRAY['commercial_exception'::text, 'source_quality'::text, 'sla_breach'::text, 'operational_risk'::text])),
	CONSTRAINT "regional_escalations_status_check" CHECK (status = ANY (ARRAY['open'::text, 'recovery_plan_assigned'::text, 'resolved'::text, 'escalated_to_nm'::text]))
);
--> statement-breakpoint
CREATE TABLE "manager_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"rm_employee_id" text NOT NULL,
	"manager_employee_id" text NOT NULL,
	"period_label" text NOT NULL,
	"performance_rating" text NOT NULL,
	"strengths" text NOT NULL,
	"blockers" text NOT NULL,
	"improvement_commitments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"support_actions" text,
	"private_rm_notes" text,
	"next_review_date" date NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manager_reviews_performance_rating_check" CHECK (performance_rating = ANY (ARRAY['exceeding'::text, 'achieving'::text, 'needs_improvement'::text, 'critical'::text]))
);
--> statement-breakpoint
CREATE TABLE "regional_report_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"rm_employee_id" text NOT NULL,
	"region_id" text NOT NULL,
	"name" text NOT NULL,
	"period_type" text NOT NULL,
	"cadence" text NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regional_report_schedules_period_type_check" CHECK (period_type = ANY (ARRAY['weekly'::text, 'monthly'::text, 'quarterly'::text])),
	CONSTRAINT "regional_report_schedules_status_check" CHECK (status = ANY (ARRAY['active'::text, 'paused'::text]))
);
--> statement-breakpoint
CREATE TABLE "national_management_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"nm_employee_id" text NOT NULL,
	"source_action" text NOT NULL,
	"kind" text NOT NULL,
	"subject_rm_employee_id" text NOT NULL,
	"owner_employee_id" text NOT NULL,
	"region_id" text,
	"metric_key" text,
	"period_label" text,
	"title" text NOT NULL,
	"detail" text,
	"due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "national_management_actions_kind_check" CHECK (kind = ANY (ARRAY['regional-directive'::text, 'rm-coaching'::text, 'resource-rebalancing'::text, 'policy-compliance'::text])),
	CONSTRAINT "national_management_actions_source_action_check" CHECK (source_action = ANY (ARRAY['NM-01'::text, 'NM-02'::text, 'NM-09'::text, 'NM-10'::text])),
	CONSTRAINT "national_management_actions_status_check" CHECK (status = ANY (ARRAY['open'::text, 'done'::text, 'cancelled'::text]))
);
--> statement-breakpoint
CREATE TABLE "national_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"nm_employee_id" text NOT NULL,
	"vertical" text NOT NULL,
	"period_label" text NOT NULL,
	"metric" text DEFAULT 'approved-wins' NOT NULL,
	"approved_ceo_target" numeric NOT NULL,
	"unallocated_remainder" numeric DEFAULT '0' NOT NULL,
	"regional_allocations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "national_targets_vertical_period_label_metric_version_key" UNIQUE("vertical","period_label","metric","version"),
	CONSTRAINT "national_targets_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text]))
);
--> statement-breakpoint
CREATE TABLE "product_rule_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"nm_employee_id" text NOT NULL,
	"vertical" text NOT NULL,
	"rule_name" text NOT NULL,
	"current_version" text NOT NULL,
	"proposed_version" text NOT NULL,
	"reason" text NOT NULL,
	"effective_date" date NOT NULL,
	"affected_products" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preview_impact" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_rule_proposals_status_check" CHECK (status = ANY (ARRAY['submitted'::text, 'approved_by_product'::text, 'activated'::text, 'rejected'::text]))
);
--> statement-breakpoint
CREATE TABLE "national_forecasts" (
	"id" text PRIMARY KEY NOT NULL,
	"nm_employee_id" text NOT NULL,
	"vertical" text NOT NULL,
	"period_label" text NOT NULL,
	"bottom_up_revenue" numeric NOT NULL,
	"national_adjustment" numeric DEFAULT '0' NOT NULL,
	"adjusted_revenue" numeric NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"accepted_regional_forecast_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"top_national_risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"national_assumptions" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "national_forecasts_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'submitted_to_executives'::text]))
);
--> statement-breakpoint
CREATE TABLE "cross_region_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"nm_employee_id" text NOT NULL,
	"source_region_id" text NOT NULL,
	"destination_region_id" text NOT NULL,
	"lead_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reason" text NOT NULL,
	"handoff_plan" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cross_region_transfers_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))
);
--> statement-breakpoint
CREATE TABLE "cross_vertical_referrals" (
	"id" text PRIMARY KEY NOT NULL,
	"referral_code" text NOT NULL,
	"source_vertical" text NOT NULL,
	"receiving_vertical" text NOT NULL,
	"prospect_name" text NOT NULL,
	"prospect_contact" text NOT NULL,
	"customer_consent_evidence" text NOT NULL,
	"commercial_context" text NOT NULL,
	"decision" text DEFAULT 'pending' NOT NULL,
	"receiving_lead_id" text,
	"decline_reason" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cross_vertical_referrals_referral_code_key" UNIQUE("referral_code"),
	CONSTRAINT "cross_vertical_referrals_decision_check" CHECK (decision = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text]))
);
--> statement-breakpoint
CREATE TABLE "national_escalations" (
	"id" text PRIMARY KEY NOT NULL,
	"nm_employee_id" text NOT NULL,
	"vertical" text NOT NULL,
	"category" text NOT NULL,
	"target_executive" text NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"evidence_summary" text,
	"decision_deadline" timestamp with time zone NOT NULL,
	"executive_decision" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "national_escalations_category_check" CHECK (category = ANY (ARRAY['revenue_assumption'::text, 'strategic_exception'::text, 'pricing_policy'::text, 'governance_risk'::text])),
	CONSTRAINT "national_escalations_status_check" CHECK (status = ANY (ARRAY['open'::text, 'under_executive_review'::text, 'resolved'::text])),
	CONSTRAINT "national_escalations_target_executive_check" CHECK (target_executive = ANY (ARRAY['CEO'::text, 'CFO'::text, 'BOTH'::text]))
);
--> statement-breakpoint
CREATE TABLE "rm_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"nm_employee_id" text NOT NULL,
	"rm_employee_id" text NOT NULL,
	"period_label" text NOT NULL,
	"performance_rating" text NOT NULL,
	"strengths" text NOT NULL,
	"blockers" text NOT NULL,
	"growth_commitments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"coverage_commitments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"support_needed" text,
	"private_nm_notes" text,
	"next_review_date" date NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rm_reviews_performance_rating_check" CHECK (performance_rating = ANY (ARRAY['exceeding'::text, 'achieving'::text, 'needs_improvement'::text, 'critical'::text]))
);
--> statement-breakpoint
CREATE TABLE "growth_initiatives" (
	"id" text PRIMARY KEY NOT NULL,
	"ceo_employee_id" text NOT NULL,
	"title" text NOT NULL,
	"vertical" text NOT NULL,
	"initiative_type" text NOT NULL,
	"capital_required" numeric NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"projected_roi_percent" numeric NOT NULL,
	"timeline_months" integer NOT NULL,
	"sponsor_executive" text NOT NULL,
	"justification" text NOT NULL,
	"implementation_tasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "growth_initiatives_initiative_type_check" CHECK (initiative_type = ANY (ARRAY['geographic_expansion'::text, 'digital_channel'::text, 'talent_surge'::text, 'product_launch'::text])),
	CONSTRAINT "growth_initiatives_status_check" CHECK (status = ANY (ARRAY['proposed'::text, 'approved_by_ceo'::text, 'funded'::text, 'rejected'::text]))
);
--> statement-breakpoint
CREATE TABLE "national_report_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"nm_employee_id" text NOT NULL,
	"vertical" text NOT NULL,
	"name" text NOT NULL,
	"period_type" text NOT NULL,
	"cadence" text NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "national_report_schedules_period_type_check" CHECK (period_type = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'half-yearly'::text, 'annual'::text])),
	CONSTRAINT "national_report_schedules_status_check" CHECK (status = ANY (ARRAY['active'::text, 'paused'::text]))
);
--> statement-breakpoint
CREATE TABLE "company_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"ceo_employee_id" text NOT NULL,
	"period_label" text NOT NULL,
	"fiscal_year" text DEFAULT 'FY2026-27' NOT NULL,
	"total_revenue_target" numeric NOT NULL,
	"total_wins_target" numeric NOT NULL,
	"vertical_allocations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unallocated_revenue_buffer" numeric DEFAULT '0' NOT NULL,
	"unallocated_wins_buffer" numeric DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_targets_fiscal_year_period_label_version_key" UNIQUE("period_label","fiscal_year","version"),
	CONSTRAINT "company_targets_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'approved_by_ceo'::text, 'board_ratified'::text]))
);
--> statement-breakpoint
CREATE TABLE "company_forecasts" (
	"id" text PRIMARY KEY NOT NULL,
	"ceo_employee_id" text NOT NULL,
	"period_label" text NOT NULL,
	"bottom_up_sum" numeric NOT NULL,
	"executive_macro_adjustment" numeric DEFAULT '0' NOT NULL,
	"signed_off_revenue" numeric NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"vertical_submissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"macro_assumptions" text NOT NULL,
	"board_risk_notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"signed_off_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_forecasts_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'signed_off_by_ceo'::text, 'presented_to_board'::text]))
);
--> statement-breakpoint
CREATE TABLE "cross_vertical_conflicts" (
	"id" text PRIMARY KEY NOT NULL,
	"ceo_employee_id" text NOT NULL,
	"source_vertical" text NOT NULL,
	"conflicting_vertical" text NOT NULL,
	"prospect_or_client_name" text NOT NULL,
	"conflict_nature" text NOT NULL,
	"summary" text NOT NULL,
	"source_argument" text NOT NULL,
	"counter_argument" text NOT NULL,
	"ceo_determination" text,
	"awarded_lead_id" text,
	"resolved_attribution" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cross_vertical_conflicts_conflict_nature_check" CHECK (conflict_nature = ANY (ARRAY['client_ownership'::text, 'revenue_attribution'::text, 'fee_splitting'::text, 'channel_cannibalization'::text])),
	CONSTRAINT "cross_vertical_conflicts_status_check" CHECK (status = ANY (ARRAY['open'::text, 'under_ceo_arbitration'::text, 'resolved'::text]))
);
--> statement-breakpoint
CREATE TABLE "period_reopen_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"period_id" text NOT NULL,
	"requested_by_employee_id" text NOT NULL,
	"reason" text NOT NULL,
	"impact_assessment" text NOT NULL,
	"affected_accounts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"authorized_by_employee_id" text,
	"approved_at" timestamp with time zone,
	"unlock_expires_at" timestamp with time zone,
	"new_close_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "period_reopen_requests_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'reclosed'::text]))
);
--> statement-breakpoint
CREATE TABLE "critical_operating_risks" (
	"id" text PRIMARY KEY NOT NULL,
	"ceo_employee_id" text NOT NULL,
	"vertical" text NOT NULL,
	"source_action" text DEFAULT 'CEO-08' NOT NULL,
	"risk_category" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"details" text NOT NULL,
	"exposure_amount" numeric,
	"mitigation_mandate" text,
	"accountable_executive" text NOT NULL,
	"decision_deadline" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "critical_operating_risks_risk_category_check" CHECK (risk_category = ANY (ARRAY['regulatory_breach'::text, 'client_litigation'::text, 'reputational_loss'::text, 'operational_failure'::text])),
	CONSTRAINT "critical_operating_risks_severity_check" CHECK (severity = ANY (ARRAY['high'::text, 'critical'::text, 'existential'::text])),
	CONSTRAINT "critical_operating_risks_status_check" CHECK (status = ANY (ARRAY['open'::text, 'mitigation_in_progress'::text, 'resolved'::text]))
);
--> statement-breakpoint
CREATE TABLE "nm_leadership_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"ceo_employee_id" text NOT NULL,
	"nm_employee_id" text NOT NULL,
	"vertical" text NOT NULL,
	"period_label" text NOT NULL,
	"overall_leadership_rating" text NOT NULL,
	"strategic_alignment" text NOT NULL,
	"operational_execution" text NOT NULL,
	"team_health_and_retention" text NOT NULL,
	"board_visibility_readiness" text NOT NULL,
	"strategic_commitments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"support_from_ceo" text,
	"next_review_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nm_leadership_reviews_overall_leadership_rating_check" CHECK (overall_leadership_rating = ANY (ARRAY['role_model'::text, 'strong_performer'::text, 'developing'::text, 'off_track'::text]))
);
--> statement-breakpoint
CREATE TABLE "board_report_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"ceo_employee_id" text NOT NULL,
	"title" text NOT NULL,
	"frequency" text NOT NULL,
	"delivery_cadence" text NOT NULL,
	"stakeholders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "board_report_schedules_frequency_check" CHECK (frequency = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'annual'::text])),
	CONSTRAINT "board_report_schedules_status_check" CHECK (status = ANY (ARRAY['active'::text, 'paused'::text]))
);
--> statement-breakpoint
CREATE TABLE "executive_commitments" (
	"id" text PRIMARY KEY NOT NULL,
	"ceo_employee_id" text NOT NULL,
	"source_action" text NOT NULL,
	"title" text NOT NULL,
	"accountable_leader" text NOT NULL,
	"vertical" text,
	"actionable_mandate" text NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"evidence_url" text,
	"fulfilled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "executive_commitments_source_action_check" CHECK (source_action = ANY (ARRAY['CEO-01'::text, 'CEO-02'::text, 'CEO-06'::text, 'CEO-07'::text, 'CEO-08'::text, 'CEO-11'::text])),
	CONSTRAINT "executive_commitments_status_check" CHECK (status = ANY (ARRAY['in_progress'::text, 'fulfilled'::text, 'escalated_to_board'::text]))
);
--> statement-breakpoint
CREATE TABLE "reporting_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"period_label" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"certified_by_employee_id" text,
	"certified_at" timestamp with time zone,
	"certification_hash" text,
	"lock_governed_writes" boolean DEFAULT false NOT NULL,
	"checklist_state" jsonb DEFAULT '{"ledger_balanced":false,"tax_provisioned":false,"exceptions_reviewed":false,"reconciliations_passed":false}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reporting_periods_period_label_key" UNIQUE("period_label"),
	CONSTRAINT "reporting_periods_status_check" CHECK (status = ANY (ARRAY['open'::text, 'closing_review'::text, 'certified_closed'::text, 'reopened'::text]))
);
--> statement-breakpoint
CREATE TABLE "finance_ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_code" text NOT NULL,
	"period_id" text NOT NULL,
	"entry_type" text NOT NULL,
	"vertical" text NOT NULL,
	"gross_amount" numeric(14, 2) NOT NULL,
	"tax_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"net_amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"policy_code" text NOT NULL,
	"source_reference_type" text NOT NULL,
	"source_reference_id" text NOT NULL,
	"account_code" text NOT NULL,
	"description" text NOT NULL,
	"is_reversal" boolean DEFAULT false NOT NULL,
	"reversal_linked_entry_id" text,
	"prepared_by_employee_id" text NOT NULL,
	"approved_by_employee_id" text,
	"approved_at" timestamp with time zone,
	"status" text DEFAULT 'posted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_ledger_entries_entry_code_key" UNIQUE("entry_code"),
	CONSTRAINT "finance_ledger_entries_entry_type_check" CHECK (entry_type = ANY (ARRAY['revenue_recognition'::text, 'cash_receipt'::text, 'receivable_accrual'::text, 'credit_note_reversal'::text, 'refund_payout'::text, 'tax_provision'::text])),
	CONSTRAINT "finance_ledger_entries_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'posted'::text, 'reversed'::text])),
	CONSTRAINT "finance_ledger_entries_vertical_check" CHECK (vertical = ANY (ARRAY['wealth'::text, 'banking'::text, 'shared'::text]))
);
--> statement-breakpoint
CREATE TABLE "sales_finance_handoffs" (
	"id" text PRIMARY KEY NOT NULL,
	"handoff_code" text NOT NULL,
	"lead_id" text NOT NULL,
	"vertical" text DEFAULT 'wealth' NOT NULL,
	"sales_rep_employee_id" text,
	"converted_amount" numeric(14, 2) NOT NULL,
	"earning_milestone" text NOT NULL,
	"supporting_evidence_url" text,
	"review_status" text DEFAULT 'pending_verification' NOT NULL,
	"deficiency_notes" text,
	"verified_by_employee_id" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_finance_handoffs_handoff_code_key" UNIQUE("handoff_code"),
	CONSTRAINT "sales_finance_handoffs_review_status_check" CHECK (review_status = ANY (ARRAY['pending_verification'::text, 'accepted_for_processing'::text, 'returned_deficiencies'::text]))
);
--> statement-breakpoint
CREATE TABLE "receivable_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"period_id" text NOT NULL,
	"lead_id" text,
	"client_name" text NOT NULL,
	"client_pan" text,
	"vertical" text DEFAULT 'wealth' NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"tax_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"net_receivable" numeric(14, 2) NOT NULL,
	"paid_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"outstanding_balance" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assigned_collection_agent_id" text,
	"collection_status" text DEFAULT 'standard' NOT NULL,
	"promise_to_pay_date" date,
	"collection_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receivable_invoices_invoice_number_key" UNIQUE("invoice_number"),
	CONSTRAINT "receivable_invoices_collection_status_check" CHECK (collection_status = ANY (ARRAY['standard'::text, 'promise_to_pay'::text, 'disputed'::text, 'escalated_legal'::text])),
	CONSTRAINT "receivable_invoices_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'issued'::text, 'partially_paid'::text, 'settled'::text, 'overdue'::text, 'written_off'::text]))
);
--> statement-breakpoint
CREATE TABLE "bank_settled_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"receipt_code" text NOT NULL,
	"bank_reference" text NOT NULL,
	"bank_name" text NOT NULL,
	"settlement_date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"payer_name" text NOT NULL,
	"payer_identifier" text,
	"status" text DEFAULT 'unmatched' NOT NULL,
	"matched_amount" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"unmatched_amount" numeric(14, 2) NOT NULL,
	"suspense_reason" text,
	"clarification_team_id" text,
	"clarification_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_settled_receipts_receipt_code_key" UNIQUE("receipt_code"),
	CONSTRAINT "bank_settled_receipts_bank_reference_key" UNIQUE("bank_reference"),
	CONSTRAINT "bank_settled_receipts_status_check" CHECK (status = ANY (ARRAY['unmatched'::text, 'partially_matched'::text, 'matched'::text, 'suspense'::text, 'quarantined'::text]))
);
--> statement-breakpoint
CREATE TABLE "receipt_invoice_matches" (
	"id" text PRIMARY KEY NOT NULL,
	"receipt_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"allocated_amount" numeric(14, 2) NOT NULL,
	"allocation_date" timestamp with time zone DEFAULT now() NOT NULL,
	"allocated_by_employee_id" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "finance_reconciliations" (
	"id" text PRIMARY KEY NOT NULL,
	"reconciliation_code" text NOT NULL,
	"period_id" text NOT NULL,
	"vertical" text DEFAULT 'wealth' NOT NULL,
	"sales_closed_wins_total" numeric(14, 2) NOT NULL,
	"recognised_revenue_total" numeric(14, 2) NOT NULL,
	"cash_receipts_total" numeric(14, 2) NOT NULL,
	"timing_difference" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"partial_settlement_difference" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"unbilled_pipeline_difference" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"unexplained_variance" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"reconciliation_status" text DEFAULT 'draft' NOT NULL,
	"frozen_by_employee_id" text,
	"frozen_at" timestamp with time zone,
	"explanation_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_reconciliations_reconciliation_code_key" UNIQUE("reconciliation_code"),
	CONSTRAINT "finance_reconciliations_reconciliation_status_check" CHECK (reconciliation_status = ANY (ARRAY['draft'::text, 'variance_investigation'::text, 'approved_frozen'::text]))
);
--> statement-breakpoint
CREATE TABLE "refund_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"refund_code" text NOT NULL,
	"lead_id" text,
	"client_name" text NOT NULL,
	"original_receipt_id" text,
	"refund_amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"reason" text NOT NULL,
	"bank_beneficiary_name" text NOT NULL,
	"bank_account_number" text NOT NULL,
	"bank_ifsc" text NOT NULL,
	"status" text DEFAULT 'pending_approval' NOT NULL,
	"authorized_by_employee_id" text,
	"external_payment_ref" text,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_requests_refund_code_key" UNIQUE("refund_code"),
	CONSTRAINT "refund_requests_status_check" CHECK (status = ANY (ARRAY['pending_approval'::text, 'approved'::text, 'rejected'::text, 'executed_paid'::text]))
);
--> statement-breakpoint
CREATE TABLE "incentive_calculations" (
	"id" text PRIMARY KEY NOT NULL,
	"calculation_code" text NOT NULL,
	"period_id" text NOT NULL,
	"scheme_name" text NOT NULL,
	"scheme_version" text DEFAULT '1.0' NOT NULL,
	"total_incentive_pool" numeric(14, 2) NOT NULL,
	"clawback_reserve" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"payable_incentive_total" numeric(14, 2) NOT NULL,
	"status" text DEFAULT 'calculated' NOT NULL,
	"payout_handoff_reference" text,
	"approved_by_employee_id" text,
	"approved_at" timestamp with time zone,
	"employee_allocations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incentive_calculations_calculation_code_key" UNIQUE("calculation_code"),
	CONSTRAINT "incentive_calculations_status_check" CHECK (status = ANY (ARRAY['calculated'::text, 'disputed'::text, 'frozen_for_payout'::text, 'paid'::text]))
);
--> statement-breakpoint
CREATE TABLE "incentive_disputes" (
	"id" text PRIMARY KEY NOT NULL,
	"dispute_code" text NOT NULL,
	"calculation_id" text NOT NULL,
	"employee_id" text NOT NULL,
	"disputed_amount" numeric(14, 2) NOT NULL,
	"employee_claim" text NOT NULL,
	"supporting_evidence" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution_amount" numeric(14, 2),
	"decision_notes" text,
	"resolved_by_employee_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incentive_disputes_dispute_code_key" UNIQUE("dispute_code"),
	CONSTRAINT "incentive_disputes_status_check" CHECK (status = ANY (ARRAY['open'::text, 'under_review'::text, 'resolved_upheld'::text, 'resolved_rejected'::text]))
);
--> statement-breakpoint
CREATE TABLE "vertical_budget_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"budget_code" text NOT NULL,
	"fiscal_year" text DEFAULT 'FY26' NOT NULL,
	"vertical" text NOT NULL,
	"cost_category" text NOT NULL,
	"approved_budget" numeric(14, 2) NOT NULL,
	"committed_costs" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"actual_costs" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"variance_amount" numeric(14, 2) GENERATED ALWAYS AS ((approved_budget - actual_costs)) STORED,
	"variance_pct" numeric(6, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vertical_budget_lines_budget_code_key" UNIQUE("budget_code"),
	CONSTRAINT "vertical_budget_lines_vertical_check" CHECK (vertical = ANY (ARRAY['wealth'::text, 'banking'::text, 'shared_corporate'::text]))
);
--> statement-breakpoint
CREATE TABLE "forecast_finance_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"period_label" text NOT NULL,
	"vertical" text DEFAULT 'wealth' NOT NULL,
	"sales_projected_revenue" numeric(14, 2) NOT NULL,
	"finance_discount_rate_pct" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"risk_adjusted_revenue" numeric(14, 2) NOT NULL,
	"cash_conversion_pace_days" integer DEFAULT 45 NOT NULL,
	"finance_assumptions" text NOT NULL,
	"concurrence_status" text DEFAULT 'concurred' NOT NULL,
	"concurred_by_employee_id" text,
	"concurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forecast_finance_reviews_concurrence_status_check" CHECK (concurrence_status = ANY (ARRAY['concurred'::text, 'concurred_with_reservations'::text, 'corrections_required'::text]))
);
--> statement-breakpoint
CREATE TABLE "finance_pack_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"cadence" text NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"include_full_ledger" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_pack_schedules_cadence_check" CHECK (cadence = ANY (ARRAY['monthly_close'::text, 'quarterly_board'::text, 'bi_weekly_cash'::text]))
);
--> statement-breakpoint
CREATE TABLE "finance_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"policy_code" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"effective_date" date NOT NULL,
	"rules_summary" text NOT NULL,
	"approval_limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"proposed_by_employee_id" text NOT NULL,
	"approved_by_employee_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_policies_policy_code_key" UNIQUE("policy_code"),
	CONSTRAINT "finance_policies_category_check" CHECK (category = ANY (ARRAY['delegation_of_authority'::text, 'revenue_recognition'::text, 'incentive_scheme'::text, 'credit_terms'::text])),
	CONSTRAINT "finance_policies_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'active'::text, 'superseded'::text]))
);
--> statement-breakpoint
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_owner_employee_id_fkey" FOREIGN KEY ("owner_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_employee_id_fkey" FOREIGN KEY ("owner_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_changes" ADD CONSTRAINT "availability_changes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_audit" ADD CONSTRAINT "lead_audit_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_audit" ADD CONSTRAINT "lead_audit_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_duplicate_of_fkey" FOREIGN KEY ("duplicate_of") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_published_lead_id_fkey" FOREIGN KEY ("published_lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."lead_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_events" ADD CONSTRAINT "stage_events_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_events" ADD CONSTRAINT "stage_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_approver_employee_id_fkey" FOREIGN KEY ("approver_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loss_records" ADD CONSTRAINT "loss_records_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loss_records" ADD CONSTRAINT "loss_records_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_suppressions" ADD CONSTRAINT "contact_suppressions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_suppressions" ADD CONSTRAINT "contact_suppressions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_requests" ADD CONSTRAINT "outcome_requests_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_requests" ADD CONSTRAINT "outcome_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_requests" ADD CONSTRAINT "outcome_requests_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."document_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_ownership_events" ADD CONSTRAINT "lead_ownership_events_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_ownership_events" ADD CONSTRAINT "lead_ownership_events_actor_team_id_fkey" FOREIGN KEY ("actor_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_ownership_events" ADD CONSTRAINT "lead_ownership_events_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_ownership_events" ADD CONSTRAINT "lead_ownership_events_from_owner_employee_id_fkey" FOREIGN KEY ("from_owner_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_ownership_events" ADD CONSTRAINT "lead_ownership_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_ownership_events" ADD CONSTRAINT "lead_ownership_events_to_owner_employee_id_fkey" FOREIGN KEY ("to_owner_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_batches" ADD CONSTRAINT "allocation_batches_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_batches" ADD CONSTRAINT "allocation_batches_actor_team_id_fkey" FOREIGN KEY ("actor_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overdue_escalations" ADD CONSTRAINT "overdue_escalations_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overdue_escalations" ADD CONSTRAINT "overdue_escalations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overdue_escalations" ADD CONSTRAINT "overdue_escalations_recovery_task_id_fkey" FOREIGN KEY ("recovery_task_id") REFERENCES "public"."lead_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overdue_escalations" ADD CONSTRAINT "overdue_escalations_subject_employee_id_fkey" FOREIGN KEY ("subject_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overdue_escalations" ADD CONSTRAINT "overdue_escalations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."lead_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_quality_reviews" ADD CONSTRAINT "call_quality_reviews_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_quality_reviews" ADD CONSTRAINT "call_quality_reviews_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_quality_reviews" ADD CONSTRAINT "call_quality_reviews_coaching_task_id_fkey" FOREIGN KEY ("coaching_task_id") REFERENCES "public"."lead_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_quality_reviews" ADD CONSTRAINT "call_quality_reviews_subject_employee_id_fkey" FOREIGN KEY ("subject_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_access_log" ADD CONSTRAINT "evidence_access_log_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_access_log" ADD CONSTRAINT "evidence_access_log_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."call_quality_reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_forecasts" ADD CONSTRAINT "team_forecasts_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_forecasts" ADD CONSTRAINT "team_forecasts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_targets" ADD CONSTRAINT "team_targets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_targets" ADD CONSTRAINT "team_targets_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_allocations" ADD CONSTRAINT "target_allocations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_allocations" ADD CONSTRAINT "target_allocations_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."team_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_employee_id_fkey" FOREIGN KEY ("reviewer_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_intern_employee_id_fkey" FOREIGN KEY ("intern_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_mentor_employee_id_fkey" FOREIGN KEY ("mentor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_report_exports" ADD CONSTRAINT "team_report_exports_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_actions" ADD CONSTRAINT "management_actions_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_actions" ADD CONSTRAINT "management_actions_owner_employee_id_fkey" FOREIGN KEY ("owner_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_actions" ADD CONSTRAINT "management_actions_subject_tl_employee_id_fkey" FOREIGN KEY ("subject_tl_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_actions" ADD CONSTRAINT "management_actions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_owner_employee_id_fkey" FOREIGN KEY ("owner_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_requests" ADD CONSTRAINT "team_requests_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_requests" ADD CONSTRAINT "team_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_requests" ADD CONSTRAINT "team_requests_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_requests" ADD CONSTRAINT "team_requests_subject_employee_id_fkey" FOREIGN KEY ("subject_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_requests" ADD CONSTRAINT "team_requests_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_corrections" ADD CONSTRAINT "activity_corrections_actor_employee_id_fkey" FOREIGN KEY ("actor_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_corrections" ADD CONSTRAINT "activity_corrections_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_corrections" ADD CONSTRAINT "activity_corrections_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_forecasts" ADD CONSTRAINT "manager_forecasts_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_targets" ADD CONSTRAINT "manager_targets_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_plans" ADD CONSTRAINT "capacity_plans_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_transfer_requests" ADD CONSTRAINT "lead_transfer_requests_destination_team_id_fkey" FOREIGN KEY ("destination_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_transfer_requests" ADD CONSTRAINT "lead_transfer_requests_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_transfer_requests" ADD CONSTRAINT "lead_transfer_requests_source_team_id_fkey" FOREIGN KEY ("source_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_remediations" ADD CONSTRAINT "source_remediations_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_lifecycle_requests" ADD CONSTRAINT "employee_lifecycle_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_lifecycle_requests" ADD CONSTRAINT "employee_lifecycle_requests_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_lifecycle_requests" ADD CONSTRAINT "employee_lifecycle_requests_proposed_team_id_fkey" FOREIGN KEY ("proposed_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_exceptions" ADD CONSTRAINT "commercial_exceptions_decided_by_manager_employee_id_fkey" FOREIGN KEY ("decided_by_manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_exceptions" ADD CONSTRAINT "commercial_exceptions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_exceptions" ADD CONSTRAINT "commercial_exceptions_requested_by_employee_id_fkey" FOREIGN KEY ("requested_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_management_actions" ADD CONSTRAINT "regional_management_actions_owner_employee_id_fkey" FOREIGN KEY ("owner_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_management_actions" ADD CONSTRAINT "regional_management_actions_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_management_actions" ADD CONSTRAINT "regional_management_actions_rm_employee_id_fkey" FOREIGN KEY ("rm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_management_actions" ADD CONSTRAINT "regional_management_actions_subject_manager_employee_id_fkey" FOREIGN KEY ("subject_manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_coverage_plans" ADD CONSTRAINT "territory_coverage_plans_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territory_coverage_plans" ADD CONSTRAINT "territory_coverage_plans_rm_employee_id_fkey" FOREIGN KEY ("rm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_targets" ADD CONSTRAINT "regional_targets_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_targets" ADD CONSTRAINT "regional_targets_rm_employee_id_fkey" FOREIGN KEY ("rm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_manager_transfers" ADD CONSTRAINT "cross_manager_transfers_destination_manager_employee_id_fkey" FOREIGN KEY ("destination_manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_manager_transfers" ADD CONSTRAINT "cross_manager_transfers_destination_team_id_fkey" FOREIGN KEY ("destination_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_manager_transfers" ADD CONSTRAINT "cross_manager_transfers_rm_employee_id_fkey" FOREIGN KEY ("rm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_manager_transfers" ADD CONSTRAINT "cross_manager_transfers_source_manager_employee_id_fkey" FOREIGN KEY ("source_manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_manager_transfers" ADD CONSTRAINT "cross_manager_transfers_source_team_id_fkey" FOREIGN KEY ("source_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_staffing_plans" ADD CONSTRAINT "regional_staffing_plans_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_staffing_plans" ADD CONSTRAINT "regional_staffing_plans_rm_employee_id_fkey" FOREIGN KEY ("rm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_forecasts" ADD CONSTRAINT "regional_forecasts_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_forecasts" ADD CONSTRAINT "regional_forecasts_rm_employee_id_fkey" FOREIGN KEY ("rm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_escalations" ADD CONSTRAINT "regional_escalations_accountable_manager_employee_id_fkey" FOREIGN KEY ("accountable_manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_escalations" ADD CONSTRAINT "regional_escalations_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_escalations" ADD CONSTRAINT "regional_escalations_rm_employee_id_fkey" FOREIGN KEY ("rm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_reviews" ADD CONSTRAINT "manager_reviews_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_reviews" ADD CONSTRAINT "manager_reviews_rm_employee_id_fkey" FOREIGN KEY ("rm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_report_schedules" ADD CONSTRAINT "regional_report_schedules_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_report_schedules" ADD CONSTRAINT "regional_report_schedules_rm_employee_id_fkey" FOREIGN KEY ("rm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "national_management_actions" ADD CONSTRAINT "national_management_actions_nm_employee_id_fkey" FOREIGN KEY ("nm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "national_management_actions" ADD CONSTRAINT "national_management_actions_owner_employee_id_fkey" FOREIGN KEY ("owner_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "national_management_actions" ADD CONSTRAINT "national_management_actions_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "national_management_actions" ADD CONSTRAINT "national_management_actions_subject_rm_employee_id_fkey" FOREIGN KEY ("subject_rm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "national_targets" ADD CONSTRAINT "national_targets_nm_employee_id_fkey" FOREIGN KEY ("nm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_rule_proposals" ADD CONSTRAINT "product_rule_proposals_nm_employee_id_fkey" FOREIGN KEY ("nm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "national_forecasts" ADD CONSTRAINT "national_forecasts_nm_employee_id_fkey" FOREIGN KEY ("nm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_region_transfers" ADD CONSTRAINT "cross_region_transfers_destination_region_id_fkey" FOREIGN KEY ("destination_region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_region_transfers" ADD CONSTRAINT "cross_region_transfers_nm_employee_id_fkey" FOREIGN KEY ("nm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_region_transfers" ADD CONSTRAINT "cross_region_transfers_source_region_id_fkey" FOREIGN KEY ("source_region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_vertical_referrals" ADD CONSTRAINT "cross_vertical_referrals_receiving_lead_id_fkey" FOREIGN KEY ("receiving_lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "national_escalations" ADD CONSTRAINT "national_escalations_nm_employee_id_fkey" FOREIGN KEY ("nm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rm_reviews" ADD CONSTRAINT "rm_reviews_nm_employee_id_fkey" FOREIGN KEY ("nm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rm_reviews" ADD CONSTRAINT "rm_reviews_rm_employee_id_fkey" FOREIGN KEY ("rm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_initiatives" ADD CONSTRAINT "growth_initiatives_ceo_employee_id_fkey" FOREIGN KEY ("ceo_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "national_report_schedules" ADD CONSTRAINT "national_report_schedules_nm_employee_id_fkey" FOREIGN KEY ("nm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_targets" ADD CONSTRAINT "company_targets_ceo_employee_id_fkey" FOREIGN KEY ("ceo_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_forecasts" ADD CONSTRAINT "company_forecasts_ceo_employee_id_fkey" FOREIGN KEY ("ceo_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_vertical_conflicts" ADD CONSTRAINT "cross_vertical_conflicts_awarded_lead_id_fkey" FOREIGN KEY ("awarded_lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_vertical_conflicts" ADD CONSTRAINT "cross_vertical_conflicts_ceo_employee_id_fkey" FOREIGN KEY ("ceo_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_reopen_requests" ADD CONSTRAINT "period_reopen_requests_authorized_by_employee_id_fkey" FOREIGN KEY ("authorized_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_reopen_requests" ADD CONSTRAINT "period_reopen_requests_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."reporting_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "period_reopen_requests" ADD CONSTRAINT "period_reopen_requests_requested_by_employee_id_fkey" FOREIGN KEY ("requested_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critical_operating_risks" ADD CONSTRAINT "critical_operating_risks_ceo_employee_id_fkey" FOREIGN KEY ("ceo_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nm_leadership_reviews" ADD CONSTRAINT "nm_leadership_reviews_ceo_employee_id_fkey" FOREIGN KEY ("ceo_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nm_leadership_reviews" ADD CONSTRAINT "nm_leadership_reviews_nm_employee_id_fkey" FOREIGN KEY ("nm_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_report_schedules" ADD CONSTRAINT "board_report_schedules_ceo_employee_id_fkey" FOREIGN KEY ("ceo_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executive_commitments" ADD CONSTRAINT "executive_commitments_ceo_employee_id_fkey" FOREIGN KEY ("ceo_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting_periods" ADD CONSTRAINT "reporting_periods_certified_by_employee_id_fkey" FOREIGN KEY ("certified_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_ledger_entries" ADD CONSTRAINT "finance_ledger_entries_approved_by_employee_id_fkey" FOREIGN KEY ("approved_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_ledger_entries" ADD CONSTRAINT "finance_ledger_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."reporting_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_ledger_entries" ADD CONSTRAINT "finance_ledger_entries_prepared_by_employee_id_fkey" FOREIGN KEY ("prepared_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_ledger_entries" ADD CONSTRAINT "finance_ledger_entries_reversal_linked_entry_id_fkey" FOREIGN KEY ("reversal_linked_entry_id") REFERENCES "public"."finance_ledger_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_finance_handoffs" ADD CONSTRAINT "sales_finance_handoffs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_finance_handoffs" ADD CONSTRAINT "sales_finance_handoffs_sales_rep_employee_id_fkey" FOREIGN KEY ("sales_rep_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_finance_handoffs" ADD CONSTRAINT "sales_finance_handoffs_verified_by_employee_id_fkey" FOREIGN KEY ("verified_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_invoices" ADD CONSTRAINT "receivable_invoices_assigned_collection_agent_id_fkey" FOREIGN KEY ("assigned_collection_agent_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_invoices" ADD CONSTRAINT "receivable_invoices_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_invoices" ADD CONSTRAINT "receivable_invoices_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."reporting_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_settled_receipts" ADD CONSTRAINT "bank_settled_receipts_clarification_team_id_fkey" FOREIGN KEY ("clarification_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_invoice_matches" ADD CONSTRAINT "receipt_invoice_matches_allocated_by_employee_id_fkey" FOREIGN KEY ("allocated_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_invoice_matches" ADD CONSTRAINT "receipt_invoice_matches_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."receivable_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_invoice_matches" ADD CONSTRAINT "receipt_invoice_matches_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."bank_settled_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_reconciliations" ADD CONSTRAINT "finance_reconciliations_frozen_by_employee_id_fkey" FOREIGN KEY ("frozen_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_reconciliations" ADD CONSTRAINT "finance_reconciliations_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."reporting_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_authorized_by_employee_id_fkey" FOREIGN KEY ("authorized_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_original_receipt_id_fkey" FOREIGN KEY ("original_receipt_id") REFERENCES "public"."bank_settled_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_calculations" ADD CONSTRAINT "incentive_calculations_approved_by_employee_id_fkey" FOREIGN KEY ("approved_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_calculations" ADD CONSTRAINT "incentive_calculations_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."reporting_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_disputes" ADD CONSTRAINT "incentive_disputes_calculation_id_fkey" FOREIGN KEY ("calculation_id") REFERENCES "public"."incentive_calculations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_disputes" ADD CONSTRAINT "incentive_disputes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_disputes" ADD CONSTRAINT "incentive_disputes_resolved_by_employee_id_fkey" FOREIGN KEY ("resolved_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_finance_reviews" ADD CONSTRAINT "forecast_finance_reviews_concurred_by_employee_id_fkey" FOREIGN KEY ("concurred_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_policies" ADD CONSTRAINT "finance_policies_approved_by_employee_id_fkey" FOREIGN KEY ("approved_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_policies" ADD CONSTRAINT "finance_policies_proposed_by_employee_id_fkey" FOREIGN KEY ("proposed_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lead_tasks_due" ON "lead_tasks" USING btree ("status" text_ops,"due_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lead_tasks_owner_status" ON "lead_tasks" USING btree ("owner_employee_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_leads_owner" ON "leads" USING btree ("owner_employee_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_leads_team" ON "leads" USING btree ("team_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_lead_events_lead" ON "lead_events" USING btree ("lead_id" text_ops,"occurred_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_messages_lead" ON "messages" USING btree ("lead_id" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_calls_lead" ON "calls" USING btree ("lead_id" text_ops,"started_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_reminders_status" ON "reminders" USING btree ("status" text_ops,"remind_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_meetings_slot" ON "meetings" USING btree ("slot_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_suppressions_lead" ON "contact_suppressions" USING btree ("lead_id" text_ops,"active" text_ops);--> statement-breakpoint
CREATE INDEX "idx_outcome_requests_status" ON "outcome_requests" USING btree ("status" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_documents_lead" ON "documents" USING btree ("lead_id" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_owner_events_lead" ON "lead_ownership_events" USING btree ("lead_id" text_ops,"changed_at" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "lead_ownership_batch_unique" ON "lead_ownership_events" USING btree ("lead_id" text_ops,"batch_key" text_ops) WHERE (batch_key IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "team_forecasts_version_unique" ON "team_forecasts" USING btree ("team_id" text_ops,"period_label" text_ops,"category" int4_ops,"version" text_ops);--> statement-breakpoint
CREATE INDEX "idx_mgmt_actions_manager" ON "management_actions" USING btree ("manager_employee_id" timestamptz_ops,"status" text_ops,"due_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_mgmt_actions_subject" ON "management_actions" USING btree ("subject_tl_employee_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_team_requests_status" ON "team_requests" USING btree ("status" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_activity_corrections_status" ON "activity_corrections" USING btree ("status" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_manager_forecasts_period" ON "manager_forecasts" USING btree ("manager_employee_id" text_ops,"period_label" text_ops);--> statement-breakpoint
CREATE INDEX "idx_transfers_status" ON "lead_transfer_requests" USING btree ("status" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_comm_exceptions_status" ON "commercial_exceptions" USING btree ("status" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_reg_actions_mgr" ON "regional_management_actions" USING btree ("subject_manager_employee_id" text_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_reg_actions_rm" ON "regional_management_actions" USING btree ("rm_employee_id" timestamptz_ops,"status" timestamptz_ops,"due_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_nat_actions_nm" ON "national_management_actions" USING btree ("nm_employee_id" timestamptz_ops,"status" text_ops,"due_at" text_ops);
*/