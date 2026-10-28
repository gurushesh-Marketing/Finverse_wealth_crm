# Master Backend Relational Database Schema Specification — Finverse CRM v2

**Document Status:** Canonical Relational Schema Specification  
**Version:** 2.1.0  
**Effective Date:** 2026-10-06  
**Database Engine:** PostgreSQL 16 Alpine  
**Migration Directory:** `database/migrations/`  
**Reference Action Deck:** `docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf` (Pages P003, P314–P317)  

---

## 1. Schema Architecture & Governance Principles

The Finverse CRM v2 persistence model is engineered directly in PostgreSQL using versioned SQL migrations (`database/migrations/`). It adheres to strict financial enterprise design invariants:
1. **Relational Integrity Over App Logic:** Foreign keys (`ON DELETE RESTRICT` by default, or cascading where explicitly designated), check constraints, not-null constraints, and unique compound indexes enforce business rules at the persistence layer.
2. **Strict Prohibition of Hard Deletions (`[Deck P005]`):** Transaction records, customer interaction timelines, financial ledgers, and audit events are permanent. Deletions use soft-deactivations or state transitions.
3. **Partitioned Multiversion Concurrency:** High-velocity tables (`leads` via `record_version`, `reviews` via `snapshot_version`) enforce optimistic concurrency locking.
4. **Distinction Between Implemented vs Planned Schema:** This document explicitly distinguishes between schemas currently active in SQL migrations `0001` through `0014` versus planned future schemas for horizontal roles (`DE`, `HR`, `SA`) and vertical expansions.
5. **No Invented Policies:** Commercial policies, accounting standards, vendor integrations, and incentive holdback percentages are not hardcoded as binding deck requirements; they are client decisions (`[Deck P320]`).
6. **Preservation of Historical Ownership & Performance:** Relational schemas enforce immutable attribution across personnel changes. When an employee transfers, is promoted, or departs, historical lead ownership events (`lead_ownership_events`), call recordings, converted deals (`outcome_requests`), and financial credits remain anchored to the historical employee ID; only open, in-flight tasks and active assignments transition to successors.

---

## 2. Actual Implemented Schema (Migrations 0001 to 0014)

### 2.1 Core Organizational & Frontline Foundation (`0001_init.sql`)

| Table Name | Description | Key Columns & Types | Primary / Foreign Keys & Constraints |
|---|---|---|---|
| `teams` | Organizational teams | `id text`, `vertical text`, `display_name text`, `parent_team_id text`, `region_id text` *(added in 0010)* | PK: `id`. FK: `parent_team_id -> teams(id)`, `region_id -> regions(id)`. |
| `employees` | System identity directory | `id text`, `email text`, `password_hash text`, `display_name text`, `status text` | PK: `id`. Unique: `email`. Status check: `active, suspended, offboarded`. |
| `assignments` | Effective-dated scope grants | `id text`, `employee_id text`, `role text`, `vertical text`, `team_id text`, `effective_from date`, `effective_to date` | PK: `id`. FK: `employee_id -> employees(id)`, `team_id -> teams(id)`. Role check: `SC, TL, MG, RM, NM, CEO, CFO, DE, HR, SA`. |
| `leads` | Master prospect entity | `id text`, `vertical text`, `display_name text`, `email text`, `phone text`, `preferred_language text`, `product text`, `source text`, `stage text`, `owner_employee_id text`, `team_id text`, `record_version int`, `created_at timestamptz`, `updated_at timestamptz` | PK: `id`. FK: `owner_employee_id -> employees(id)`, `team_id -> teams(id)`. Stage check: `new, not-contacted, contacted, follow-up, qualified, converted, lost`, expanded in `0023_banking_stages.sql` for Commercial Banking: `eligibility, documents, sanction, disbursal`. |
| `lead_tasks` | Operational callbacks & follow-ups | `id text`, `lead_id text`, `creator_employee_id text`, `due_at timestamptz`, `task_type text`, `title text`, `status text`, `outcome text`, `original_due_at timestamptz` *(0003)*, `deferral_count int` *(0003)*, `created_at timestamptz`, `updated_at timestamptz` | PK: `id`. FK: `lead_id -> leads(id)`, `creator_employee_id -> employees(id)`. Status check: `pending, completed, cancelled`. |
| `lead_events` | Immutable timeline audit fact ledger | `id text`, `lead_id text`, `action_type text`, `metadata jsonb`, `actor_role text` *(0002)*, `actor_team_id text` *(0002)*, `assignment_id text` *(0002)*, `created_at timestamptz` | PK: `id`. FK: `lead_id -> leads(id)`. Append-only. |
| `sessions` | Server-managed session store | `id text`, `employee_id text`, `expires_at timestamptz`, `created_at timestamptz` | PK: `id`. FK: `employee_id -> employees(id)`. |

### 2.2 Wealth Caller Extensions (`0002_wealth_caller.sql`, `0003_comms_tasks.sql`)

| Table Name | Description | Key Columns & Types | Primary / Foreign Keys & Constraints |
|---|---|---|---|
| `availability_changes` | Caller availability state history | `id text`, `employee_id text`, `status text`, `effective_from timestamptz`, `note text` | PK: `id`. FK: `employee_id -> employees(id)`. Status check: `available, busy, away`. |
| `saved_views` | Personal filter configurations | `id text`, `employee_id text`, `name text`, `filters jsonb`, `created_at timestamptz` | PK: `id`. FK: `employee_id -> employees(id)`. |
| `lead_audit` | Lead field alteration audit | `id text`, `lead_id text`, `actor_employee_id text`, `field_name text`, `old_value text`, `new_value text`, `reason text`, `created_at timestamptz` | PK: `id`. FK: `lead_id -> leads(id)`, `actor_employee_id -> employees(id)`. Append-only. |
| `enquiries` | Self-sourced & web prospect intake | `id text`, `display_name text`, `phone text`, `email text`, `product text`, `source text`, `permission_evidence text`, `need text`, `creator_employee_id text`, `status text`, `published_lead_id text`, `duplicate_of text`, `created_at timestamptz` | PK: `id`. FK: `creator_employee_id -> employees(id)`, `published_lead_id -> leads(id)`, `duplicate_of -> leads(id)`. Status check: `draft, published, duplicate_detected, archived`. |
| `calls` | Telephony call interaction fact | `id text`, `lead_id text`, `caller_employee_id text`, `direction text`, `disposition text`, `duration_seconds int`, `summary text`, `recording_url text`, `transcript_text text`, `created_at timestamptz` | PK: `id`. FK: `lead_id -> leads(id)`, `caller_employee_id -> employees(id)`. Direction check: `outbound, inbound`. Disposition check: `connected, no-answer, busy, wrong-number`. |
| `messages` | Omnichannel outbound/inbound comms | `id text`, `lead_id text` *(nullable in 0003)*, `sender_employee_id text`, `channel text`, `direction text`, `template_name text`, `content_text text`, `status text`, `supervisor_queue boolean` *(0003)*, `created_at timestamptz` | PK: `id`. FK: `lead_id -> leads(id)`, `sender_employee_id -> employees(id)`. Channel check: `whatsapp, sms, email`. Status check: `draft, queued, sent, delivered, read, failed`. |
| `reminders` | Task reminder dispatch events | `id text`, `task_id text`, `employee_id text`, `remind_at timestamptz`, `channel text`, `sent_at timestamptz` | PK: `id`. FK: `task_id -> lead_tasks(id)`, `employee_id -> employees(id)`. Channel check: `in-app, email, push`. |
| `qualifications` | Suitability & financial assessment | `id text`, `lead_id text`, `qualifier_employee_id text`, `need text`, `product text`, `expected_value numeric(14,2)`, `currency text`, `time_horizon text`, `checklist jsonb`, `next_step text`, `created_at timestamptz` | PK: `id`. FK: `lead_id -> leads(id)`, `qualifier_employee_id -> employees(id)`. |
| `stage_events` | Pipeline stage transition facts | `id text`, `lead_id text`, `from_stage text`, `to_stage text`, `reason text`, `actor_employee_id text`, `created_at timestamptz` | PK: `id`. FK: `lead_id -> leads(id)`, `actor_employee_id -> employees(id)`. Append-only. |
| `meetings` | Client calendar appointments | `id text`, `lead_id text`, `organizer_employee_id text`, `scheduled_at timestamptz`, `location text`, `agenda text`, `summary text`, `created_at timestamptz` | PK: `id`. FK: `lead_id -> leads(id)`, `organizer_employee_id -> employees(id)`. |
| `proposals` | Client investment/portfolio proposals | `id text`, `lead_id text`, `creator_employee_id text`, `product text`, `template_version text`, `terms text`, `valid_until date`, `status text`, `recipient text`, `created_at timestamptz` | PK: `id`. FK: `lead_id -> leads(id)`, `creator_employee_id -> employees(id)`. Status check: `draft, submitted, approved, sent, rejected`. |
| `outcome_requests` | Conversion & reopen approval queue | `id text`, `lead_id text`, `requester_employee_id text`, `type text`, `payload jsonb`, `status text`, `decider_employee_id text`, `decided_at timestamptz`, `reason text`, `decision_evidence jsonb` *(0007)*, `created_at timestamptz` | PK: `id`. FK: `lead_id -> leads(id)`, `requester_employee_id -> employees(id)`, `decider_employee_id -> employees(id)`. Type check: `conversion, reopen`. Status check: `pending, approved, returned, rejected`. |
| `loss_records` | Disqualification & loss rationale | `id text`, `lead_id text`, `actor_employee_id text`, `reason text`, `explanation text`, `recontact_eligible_at date`, `created_at timestamptz` | PK: `id`. FK: `lead_id -> leads(id)`, `actor_employee_id -> employees(id)`. |
| `contact_suppressions` | DND and communication opt-outs | `id text`, `lead_id text`, `channel text`, `suppression_type text`, `reason text`, `expires_at timestamptz`, `created_at timestamptz` | PK: `id`. FK: `lead_id -> leads(id)`. Suppression check: `dnd, opt-out, manual`. |
| `document_requests` | Requested documentation tracker | `id text`, `lead_id text`, `requester_employee_id text`, `doc_type text`, `notes text`, `status text`, `created_at timestamptz` | PK: `id`. FK: `lead_id -> leads(id)`, `requester_employee_id -> employees(id)`. Status check: `requested, received, rejected`. |
| `documents` | KYC & suitability evidence documents | `id text`, `lead_id text`, `uploader_employee_id text`, `doc_type text`, `file_name text`, `file_size_bytes int`, `mime_type text`, `storage_path text`, `verification_status text`, `verified_by text`, `verified_at timestamptz`, `rejection_reason text`, `version int`, `created_at timestamptz` | PK: `id`. FK: `lead_id -> leads(id)`, `uploader_employee_id -> employees(id)`, `verified_by -> employees(id)`. Verification check: `unverified, verified, rejected`. |
| `reviews` | Performance & coaching reviews | `id text`, `employee_id text`, `reviewer_employee_id text`, `period_label text`, `strengths text`, `improvements text`, `action_items jsonb`, `agenda text` *(0004)*, `snapshot_version int` *(0004)*, `scheduled_at timestamptz` *(0004)*, `private_notes text` *(0004)*, `disagreement text` *(0004)*, `created_at timestamptz` | PK: `id`. FK: `employee_id -> employees(id)`, `reviewer_employee_id -> employees(id)`. Optimistic concurrency via `snapshot_version`. |
| `report_exports` | Frontline PDF/CSV exports | `id text`, `employee_id text`, `report_type text`, `parameters jsonb`, `format text`, `download_url text`, `created_at timestamptz` | PK: `id`. FK: `employee_id -> employees(id)`. Format check: `pdf, csv`. |

### 2.3 Team Lead Governance (`0004_team_lead.sql` to `0007_tl_review_fixes.sql`)

| Table Name | Description | Key Columns & Types | Primary / Foreign Keys & Constraints |
|---|---|---|---|
| `lead_ownership_events` | Handoff & reallocation audit trail | `id text`, `lead_id text`, `from_employee_id text`, `to_employee_id text`, `reason text`, `actor_employee_id text`, `handoff_deadline date`, `created_at timestamptz` | PK: `id`. FK: `lead_id -> leads(id)`, `from_employee_id -> employees(id)`, `to_employee_id -> employees(id)`, `actor_employee_id -> employees(id)`. |
| `allocation_batches` | Batch allocation history | `id text`, `tl_employee_id text`, `team_id text`, `batch_size int`, `criteria jsonb`, `assigned_counts jsonb`, `created_at timestamptz` | PK: `id`. FK: `tl_employee_id -> employees(id)`, `team_id -> teams(id)`. |
| `overdue_escalations` | Task breach management | `id text`, `task_id text`, `tl_employee_id text`, `assigned_caller_id text`, `escalation_action text`, `notes text`, `created_at timestamptz` | PK: `id`. FK: `task_id -> lead_tasks(id)`, `tl_employee_id -> employees(id)`, `assigned_caller_id -> employees(id)`. Action check: `reassigned, deadline-extended, manager-escalated, resolved`. |
| `call_quality_reviews` | Call rubric scoring & compliance | `id text`, `call_id text`, `tl_employee_id text`, `rubric_scores jsonb`, `notes text`, `flagged_for_compliance boolean`, `created_at timestamptz` | PK: `id`. FK: `call_id -> calls(id)`, `tl_employee_id -> employees(id)`. |
| `evidence_access_log` | Sensitive recording/call access audit | `id text`, `review_id text`, `accessor_employee_id text`, `access_type text`, `reason text`, `created_at timestamptz` | PK: `id`. FK: `review_id -> call_quality_reviews(id)`, `accessor_employee_id -> employees(id)`. Append-only. |
| `team_targets` | Targets assigned to frontline teams | `id text`, `team_id text`, `period_label text`, `metric text`, `target_value numeric(14,2)`, `assigned_by text`, `created_at timestamptz` | PK: `id`. FK: `team_id -> teams(id)`, `assigned_by -> employees(id)`. |
| `target_allocations` | Associate target breakdown | `id text`, `team_target_id text`, `employee_id text`, `allocated_value numeric(14,2)`, `created_at timestamptz` | PK: `id`. FK: `team_target_id -> team_targets(id)`, `employee_id -> employees(id)`. |
| `team_forecasts` | Bottom-up team forecast submissions | `id text`, `team_id text`, `tl_employee_id text`, `period_label text`, `commit_revenue numeric(14,2)`, `best_case_revenue numeric(14,2)`, `pipeline_revenue numeric(14,2)`, `notes text`, `manager_decision text` *(0009)*, `manager_feedback text` *(0009)*, `manager_decided_at timestamptz` *(0009)*, `created_at timestamptz` | PK: `id`. FK: `team_id -> teams(id)`, `tl_employee_id -> employees(id)`. Manager decision check: `accepted, returned`. |
| `mentorships` | Peer coaching buddy pairings | `id text`, `mentor_employee_id text`, `mentee_employee_id text`, `team_id text`, `start_date date`, `end_date date`, `active boolean`, `created_at timestamptz` | PK: `id`. FK: `mentor_employee_id -> employees(id)`, `mentee_employee_id -> employees(id)`, `team_id -> teams(id)`. |
| `team_requests` | TL requests to Management & HR | `id text`, `requester_employee_id text`, `category text`, `title text`, `details text`, `status text`, `assigned_to text`, `resolution text`, `created_at timestamptz` | PK: `id`. FK: `requester_employee_id -> employees(id)`, `assigned_to -> employees(id)`. Category check: `capacity, transfer, exception, compliance`. Status check: `pending, approved, rejected`. |
| `team_report_exports` | Team Lead report export records | `id text`, `tl_employee_id text`, `team_id text`, `report_type text`, `period_label text`, `format text`, `download_url text`, `created_at timestamptz` | PK: `id`. FK: `tl_employee_id -> employees(id)`, `team_id -> teams(id)`. |
| `report_schedules` | Automated report generation engine | `id text`, `tl_employee_id text`, `team_id text`, `report_type text`, `cadence text`, `delivery_channel text`, `active boolean`, `created_at timestamptz` | PK: `id`. FK: `tl_employee_id -> employees(id)`, `team_id -> teams(id)`. Cadence check: `daily, weekly, monthly`. Delivery check: `email, in-app`. |
| `activity_corrections` | Frontline activity dispute log | `id text`, `tl_employee_id text`, `call_id text`, `field_name text`, `old_value text`, `requested_value text`, `reason text`, `status text`, `decided_by text`, `decision_evidence jsonb` *(0007)*, `created_at timestamptz` | PK: `id`. FK: `tl_employee_id -> employees(id)`, `call_id -> calls(id)`, `decided_by -> employees(id)`. Status check: `pending, approved, rejected`. |

### 2.4 Middle & Regional Management (`0008_manager.sql`, `0009_manager_workflows.sql`, `0010_regional_workflows.sql`)

| Table Name | Description | Key Columns & Types | Primary / Foreign Keys & Constraints |
|---|---|---|---|
| `management_actions` | Manager operational directives | `id text`, `manager_employee_id text`, `target_tl_employee_id text`, `source_action text`, `kind text`, `title text`, `due_at timestamptz`, `status text`, `created_at timestamptz` | PK: `id`. FK: `manager_employee_id -> employees(id)`, `target_tl_employee_id -> employees(id)`. Status check: `open, in-progress, completed, escalated`. |
| `manager_forecasts` | Consolidated forecast to RM | `id text`, `manager_employee_id text`, `period_label text`, `bottom_up_revenue numeric`, `management_adjustment numeric`, `status text`, `created_at timestamptz` | PK: `id`. FK: `manager_employee_id -> employees(id)`. |
| `manager_targets` | Regional targets allocated to TLs | `id text`, `manager_employee_id text`, `period_label text`, `approved_parent_target numeric`, `unallocated_remainder numeric`, `status text`, `created_at timestamptz` | PK: `id`. FK: `manager_employee_id -> employees(id)`. Non-silent remainder tracking. |
| `capacity_plans` | Backlog recovery modeling | `id text`, `manager_employee_id text`, `name text`, `period_label text`, `team_ids text[]`, `current_backlog int`, `available_callers int`, `planned_reallocations jsonb`, `required_additional_staff int`, `approved boolean`, `created_at timestamptz` | PK: `id`. FK: `manager_employee_id -> employees(id)`. |
| `lead_transfer_requests` | Cross-team lead moves | `id text`, `manager_employee_id text`, `source_team_id text`, `destination_team_id text`, `lead_ids text[]`, `reason text`, `status text`, `created_at timestamptz` | PK: `id`. FK: `manager_employee_id -> employees(id)`, `source_team_id -> teams(id)`, `destination_team_id -> teams(id)`. |
| `source_remediations` | Lead source quality remediation | `id text`, `manager_employee_id text`, `source_name text`, `action_type text`, `notes text`, `created_at timestamptz` | PK: `id`. FK: `manager_employee_id -> employees(id)`. |
| `employee_lifecycle_requests` | Promotion & transfer proposals | `id text`, `manager_employee_id text`, `employee_id text`, `request_type text`, `proposed_role text`, `proposed_team_id text`, `effective_date date`, `handoff_plan text`, `status text`, `created_at timestamptz` | PK: `id`. FK: `manager_employee_id -> employees(id)`, `employee_id -> employees(id)`, `proposed_team_id -> teams(id)`. |
| `commercial_exceptions` | Delegated commercial terms | `id text`, `manager_employee_id text`, `lead_id text`, `exception_type text`, `requested_amount numeric`, `reason text`, `status text`, `escalated_to_rm boolean`, `created_at timestamptz` | PK: `id`. FK: `manager_employee_id -> employees(id)`, `lead_id -> leads(id)`. |
| `regions` | Geographic territories | `id text`, `region_code text`, `display_name text`, `headquarters_city text`, `active boolean` | PK: `id`. Unique: `region_code`. |
| `regional_management_actions` | RM directives to Managers | `id text`, `rm_employee_id text`, `target_manager_employee_id text`, `source_action text`, `kind text`, `title text`, `due_at timestamptz`, `status text`, `created_at timestamptz` | PK: `id`. FK: `rm_employee_id -> employees(id)`, `target_manager_employee_id -> employees(id)`. |
| `territory_coverage_plans` | Regional coverage modeling | `id text`, `rm_employee_id text`, `region_id text`, `period_label text`, `coverage_summary jsonb`, `status text`, `created_at timestamptz` | PK: `id`. FK: `rm_employee_id -> employees(id)`, `region_id -> regions(id)`. |
| `regional_targets` | NM targets cascaded to Managers | `id text`, `rm_employee_id text`, `period_label text`, `approved_nm_target numeric`, `manager_allocations jsonb`, `unallocated_remainder numeric`, `status text`, `created_at timestamptz` | PK: `id`. FK: `rm_employee_id -> employees(id)`. Cascades to `manager_targets`. |
| `cross_manager_transfers` | Cross-branch lead transfers | `id text`, `rm_employee_id text`, `source_manager_id text`, `dest_manager_id text`, `lead_ids text[]`, `reason text`, `status text`, `created_at timestamptz` | PK: `id`. FK: `rm_employee_id -> employees(id)`, `source_manager_id -> employees(id)`, `dest_manager_id -> employees(id)`. |
| `regional_staffing_plans` | Regional branch staffing proposals | `id text`, `rm_employee_id text`, `region_id text`, `period_label text`, `headcount_adjustments jsonb`, `status text`, `created_at timestamptz` | PK: `id`. FK: `rm_employee_id -> employees(id)`, `region_id -> regions(id)`. |
| `regional_forecasts` | Consolidated regional forecast to NM | `id text`, `rm_employee_id text`, `period_label text`, `bottom_up_revenue numeric`, `regional_adjustment numeric`, `status text`, `created_at timestamptz` | PK: `id`. FK: `rm_employee_id -> employees(id)`. |
| `regional_escalations` | Regional risk & exception log | `id text`, `rm_employee_id text`, `title text`, `category text`, `severity text`, `status text`, `created_at timestamptz` | PK: `id`. FK: `rm_employee_id -> employees(id)`. |
| `manager_reviews` | RM performance reviews of Managers | `id text`, `rm_employee_id text`, `manager_employee_id text`, `period_label text`, `evaluation jsonb`, `created_at timestamptz` | PK: `id`. FK: `rm_employee_id -> employees(id)`, `manager_employee_id -> employees(id)`. |
| `regional_report_schedules` | Regional pack schedules | `id text`, `rm_employee_id text`, `title text`, `report_type text`, `cadence text`, `recipients jsonb`, `active boolean`, `created_at timestamptz` | PK: `id`. FK: `rm_employee_id -> employees(id)`. |

### 2.5 National & Executive Management (`0011_national_workflows.sql`, `0012_ceo_workflows.sql`)

| Table Name | Description | Key Columns & Types | Primary / Foreign Keys & Constraints |
|---|---|---|---|
| `national_management_actions` | NM directives to RMs | `id text`, `nm_employee_id text`, `target_rm_employee_id text`, `source_action text`, `kind text`, `title text`, `due_at timestamptz`, `status text`, `created_at timestamptz` | PK: `id`. FK: `nm_employee_id -> employees(id)`, `target_rm_employee_id -> employees(id)`. |
| `national_targets` | CEO targets cascaded to Regions | `id text`, `nm_employee_id text`, `period_label text`, `approved_ceo_target numeric`, `regional_allocations jsonb`, `unallocated_remainder numeric`, `status text`, `created_at timestamptz` | PK: `id`. FK: `nm_employee_id -> employees(id)`. Cascades to `regional_targets`. |
| `product_rule_proposals` | Pipeline qualification rule proposals | `id text`, `nm_employee_id text`, `vertical text`, `rule_code text`, `proposed_change text`, `justification text`, `status text`, `created_at timestamptz` | PK: `id`. FK: `nm_employee_id -> employees(id)`. |
| `national_forecasts` | Vertical forecast submission to CEO | `id text`, `nm_employee_id text`, `period_label text`, `bottom_up_revenue numeric`, `national_adjustment numeric`, `status text`, `created_at timestamptz` | PK: `id`. FK: `nm_employee_id -> employees(id)`. |
| `cross_region_transfers` | Inter-region lead reallocations | `id text`, `nm_employee_id text`, `source_region_id text`, `dest_region_id text`, `lead_ids text[]`, `reason text`, `status text`, `created_at timestamptz` | PK: `id`. FK: `nm_employee_id -> employees(id)`, `source_region_id -> regions(id)`, `dest_region_id -> regions(id)`. |
| `cross_vertical_referrals` | Inter-vertical referral gateway | `id text`, `originating_vertical text`, `receiving_vertical text`, `lead_id text`, `referral_notes text`, `credit_split numeric(5,2)`, `status text`, `created_at timestamptz` | PK: `id`. FK: `lead_id -> leads(id)`. Opaque data transfer. Credit split percentage governed by client policy `[Deck P320]`. |
| `national_escalations` | National escalations register | `id text`, `nm_employee_id text`, `title text`, `category text`, `severity text`, `status text`, `created_at timestamptz` | PK: `id`. FK: `nm_employee_id -> employees(id)`. |
| `rm_reviews` | NM performance reviews of RMs | `id text`, `nm_employee_id text`, `rm_employee_id text`, `period_label text`, `evaluation jsonb`, `created_at timestamptz` | PK: `id`. FK: `nm_employee_id -> employees(id)`, `rm_employee_id -> employees(id)`. |
| `national_report_schedules` | National pack schedules | `id text`, `nm_employee_id text`, `title text`, `report_type text`, `cadence text`, `recipients jsonb`, `active boolean`, `created_at timestamptz` | PK: `id`. FK: `nm_employee_id -> employees(id)`. |
| `company_targets` | Enterprise annual & quarterly targets | `id text`, `fiscal_year text`, `period_label text`, `total_revenue_target numeric(14,2)`, `total_wins_target int`, `vertical_allocations jsonb`, `status text`, `board_ratified boolean`, `created_at timestamptz` | PK: `id`. Board ratification flag. |
| `company_forecasts` | Enterprise consolidated revenue model | `id text`, `fiscal_year text`, `period_label text`, `total_forecast_revenue numeric(14,2)`, `vertical_rollups jsonb`, `executive_adjustments numeric(14,2)`, `created_at timestamptz` | PK: `id`. Multi-vertical aggregation. |
| `growth_initiatives` | Strategic investments & expansion | `id text`, `initiative_code text`, `title text`, `vertical text`, `allocated_capital numeric(14,2)`, `status text`, `created_at timestamptz` | PK: `id`. Unique: `initiative_code`. |
| `cross_vertical_conflicts` | Cross-vertical priority conflicts | `id text`, `conflict_code text`, `primary_vertical text`, `conflicting_vertical text`, `description text`, `resolution_directive text`, `status text`, `created_at timestamptz` | PK: `id`. Unique: `conflict_code`. |
| `critical_operating_risks` | Enterprise risk & complaint register | `id text`, `risk_code text`, `title text`, `category text`, `severity text`, `mitigation_summary text`, `status text`, `created_at timestamptz` | PK: `id`. Unique: `risk_code`. |
| `nm_leadership_reviews` | CEO performance reviews of NMs | `id text`, `nm_employee_id text`, `period_label text`, `evaluation jsonb`, `created_at timestamptz` | PK: `id`. FK: `nm_employee_id -> employees(id)`. |
| `board_report_schedules` | Executive board report schedules | `id text`, `title text`, `cadence text`, `recipients jsonb`, `is_active boolean`, `created_at timestamptz` | PK: `id`. |
| `executive_commitments` | Board & regulator commitments | `id text`, `commitment_code text`, `stakeholder text`, `title text`, `target_date date`, `status text`, `created_at timestamptz` | PK: `id`. Unique: `commitment_code`. |

### 2.6 Financial Control & Statutory Truth (`0013_cfo_workflows.sql`)

| Table Name | Description | Key Columns & Types | Primary / Foreign Keys & Constraints |
|---|---|---|---|
| `reporting_periods` | Fiscal accounting periods | `id text`, `period_label text`, `start_date date`, `end_date date`, `status text`, `certified_by_employee_id text`, `certified_at timestamptz`, `certification_hash text`, `lock_governed_writes boolean`, `checklist_state jsonb`, `created_at timestamptz`, `updated_at timestamptz` | PK: `id`. Unique: `period_label`. Status check: `open, closing_review, certified_closed, reopened`. SHA-256 certification hash. |
| `period_reopen_requests` | Period reopening requests | `id text`, `period_id text`, `requested_by_employee_id text`, `reason text`, `impact_assessment text`, `affected_accounts jsonb`, `status text`, `authorized_by_employee_id text`, `approved_at timestamptz`, `unlock_expires_at timestamptz`, `new_close_version text`, `created_at timestamptz`, `updated_at timestamptz` | PK: `id`. FK: `period_id -> reporting_periods(id)`, `requested_by_employee_id -> employees(id)`, `authorized_by_employee_id -> employees(id)`. Status check: `pending, approved, rejected, reclosed`. |
| `finance_ledger_entries` | Statutory general ledger journal entries | `id text`, `entry_code text`, `period_id text`, `entry_type text`, `vertical text`, `gross_amount numeric(14,2)`, `tax_amount numeric(14,2)`, `net_amount numeric(14,2)`, `currency text`, `policy_code text`, `source_reference_type text`, `source_reference_id text`, `account_code text`, `description text`, `is_reversal boolean`, `reversal_linked_entry_id text`, `prepared_by_employee_id text`, `approved_by_employee_id text`, `approved_at timestamptz`, `status text`, `created_at timestamptz` | PK: `id`. Unique: `entry_code`. FK: `period_id -> reporting_periods(id)`, `reversal_linked_entry_id -> finance_ledger_entries(id)`, `prepared_by_employee_id -> employees(id)`, `approved_by_employee_id -> employees(id)`. Entry type check: `revenue_recognition, cash_receipt, receivable_accrual, credit_note_reversal, refund_payout, tax_provision`. Status check: `draft, pending_approval, posted, reversed`. |
| `sales_finance_handoffs` | Verified conversions from frontline | `id text`, `handoff_code text`, `lead_id text`, `vertical text`, `sales_rep_employee_id text`, `converted_amount numeric(14,2)`, `earning_milestone text`, `supporting_evidence_url text`, `review_status text`, `deficiency_notes text`, `verified_by_employee_id text`, `verified_at timestamptz`, `created_at timestamptz`, `updated_at timestamptz` | PK: `id`. Unique: `handoff_code`. FK: `lead_id -> leads(id)`, `sales_rep_employee_id -> employees(id)`, `verified_by_employee_id -> employees(id)`. Status check: `pending_verification, accepted_for_processing, returned_deficiencies`. |
| `receivable_invoices` | Formal tax invoices | `id text`, `invoice_number text`, `period_id text`, `lead_id text`, `client_name text`, `client_pan text`, `vertical text`, `total_amount numeric(14,2)`, `tax_amount numeric(14,2)`, `net_receivable numeric(14,2)`, `paid_amount numeric(14,2)`, `outstanding_balance numeric(14,2)`, `currency text`, `issue_date date`, `due_date date`, `status text`, `line_items jsonb`, `assigned_collection_agent_id text`, `collection_status text`, `promise_to_pay_date date`, `collection_notes text`, `created_at timestamptz`, `updated_at timestamptz` | PK: `id`. Unique: `invoice_number`. FK: `period_id -> reporting_periods(id)`, `lead_id -> leads(id)`, `assigned_collection_agent_id -> employees(id)`. Status check: `draft, pending_approval, issued, partially_paid, settled, overdue, written_off`. Collection status check: `standard, promise_to_pay, disputed, escalated_legal`. |
| `bank_settled_receipts` | Bank settlement statement entries | `id text`, `receipt_code text`, `bank_reference text`, `bank_name text`, `settlement_date date`, `amount numeric(14,2)`, `currency text`, `payer_name text`, `payer_identifier text`, `status text`, `matched_amount numeric(14,2)`, `unmatched_amount numeric(14,2)`, `suspense_reason text`, `clarification_team_id text`, `clarification_notes text`, `created_at timestamptz`, `updated_at timestamptz` | PK: `id`. Unique: `receipt_code`, `bank_reference`. FK: `clarification_team_id -> teams(id)`. Status check: `unmatched, partially_matched, matched, suspense, quarantined`. |
| `receipt_invoice_matches` | Three-way receipt to invoice match | `id text`, `receipt_id text`, `invoice_id text`, `allocated_amount numeric(14,2)`, `allocation_date timestamptz`, `allocated_by_employee_id text`, `notes text` | PK: `id`. FK: `receipt_id -> bank_settled_receipts(id)`, `invoice_id -> receivable_invoices(id)`, `allocated_by_employee_id -> employees(id)`. |
| `finance_reconciliations` | Period three-way reconciliation freeze | `id text`, `reconciliation_code text`, `period_id text`, `vertical text`, `sales_closed_wins_total numeric(14,2)`, `recognised_revenue_total numeric(14,2)`, `cash_receipts_total numeric(14,2)`, `timing_difference numeric(14,2)`, `partial_settlement_difference numeric(14,2)`, `unbilled_pipeline_difference numeric(14,2)`, `unexplained_variance numeric(14,2)`, `reconciliation_status text`, `frozen_by_employee_id text`, `frozen_at timestamptz`, `explanation_notes text`, `created_at timestamptz`, `updated_at timestamptz` | PK: `id`. Unique: `reconciliation_code`. FK: `period_id -> reporting_periods(id)`, `frozen_by_employee_id -> employees(id)`. Status check: `draft, variance_investigation, approved_frozen`. Reconciles CRM Sales vs Recognised Revenue vs Cash Receipts. |
| `refund_requests` | Client refund requests | `id text`, `refund_code text`, `lead_id text`, `client_name text`, `original_receipt_id text`, `refund_amount numeric(14,2)`, `currency text`, `reason text`, `bank_beneficiary_name text`, `bank_account_number text`, `bank_ifsc text`, `status text`, `authorized_by_employee_id text`, `external_payment_ref text`, `executed_at timestamptz`, `created_at timestamptz`, `updated_at timestamptz` | PK: `id`. Unique: `refund_code`. FK: `lead_id -> leads(id)`, `original_receipt_id -> bank_settled_receipts(id)`, `authorized_by_employee_id -> employees(id)`. Status check: `pending_approval, approved, rejected, executed_paid`. |
| `incentive_calculations` | Frontline commission calculation pools | `id text`, `calculation_code text`, `period_id text`, `scheme_name text`, `scheme_version text`, `total_incentive_pool numeric(14,2)`, `clawback_reserve numeric(14,2)`, `payable_incentive_total numeric(14,2)`, `status text`, `payout_handoff_reference text`, `approved_by_employee_id text`, `approved_at timestamptz`, `employee_allocations jsonb`, `created_at timestamptz`, `updated_at timestamptz` | PK: `id`. Unique: `calculation_code`. FK: `period_id -> reporting_periods(id)`, `approved_by_employee_id -> employees(id)`. Status check: `calculated, disputed, frozen_for_payout, paid`. *(Clawback holdback percentage is an open client decision [Deck P320], not a deck requirement.)* |
| `incentive_disputes` | Frontline commission disputes | `id text`, `dispute_code text`, `calculation_id text`, `employee_id text`, `disputed_amount numeric(14,2)`, `employee_claim text`, `supporting_evidence text`, `status text`, `resolution_amount numeric(14,2)`, `decision_notes text`, `resolved_by_employee_id text`, `resolved_at timestamptz`, `created_at timestamptz`, `updated_at timestamptz` | PK: `id`. Unique: `dispute_code`. FK: `calculation_id -> incentive_calculations(id)`, `employee_id -> employees(id)`, `resolved_by_employee_id -> employees(id)`. Status check: `open, under_review, resolved_upheld, resolved_rejected`. |
| `vertical_budget_lines` | Vertical operating budget tracking | `id text`, `budget_code text`, `fiscal_year text`, `vertical text`, `cost_category text`, `approved_budget numeric(14,2)`, `committed_costs numeric(14,2)`, `actual_costs numeric(14,2)`, `variance_amount numeric(14,2)` *(generated)*, `variance_pct numeric(6,2)`, `notes text`, `created_at timestamptz`, `updated_at timestamptz` | PK: `id`. Unique: `budget_code`. Vertical check: `wealth, banking, shared_corporate`. Variance generated: `approved_budget - actual_costs`. |
| `forecast_finance_reviews` | Finance forecast risk-adjustments | `id text`, `period_label text`, `vertical text`, `sales_projected_revenue numeric(14,2)`, `finance_discount_rate_pct numeric(5,2)`, `risk_adjusted_revenue numeric(14,2)`, `cash_conversion_pace_days int`, `finance_assumptions text`, `concurrence_status text`, `concurred_by_employee_id text`, `concurred_at timestamptz`, `created_at timestamptz` | PK: `id`. FK: `concurred_by_employee_id -> employees(id)`. Concurrence check: `concurred, concurred_with_reservations, corrections_required`. |
| `finance_pack_schedules` | Finance management pack schedules | `id text`, `title text`, `cadence text`, `recipients jsonb`, `include_full_ledger boolean`, `is_active boolean`, `last_delivered_at timestamptz`, `created_at timestamptz` | PK: `id`. Cadence check: `monthly_close, quarterly_board, bi_weekly_cash`. |
| `finance_policies` | Financial delegation of authority | `id text`, `policy_code text`, `title text`, `category text`, `version text`, `effective_date date`, `rules_summary text`, `approval_limits jsonb`, `status text`, `proposed_by_employee_id text`, `approved_by_employee_id text`, `created_at timestamptz`, `updated_at timestamptz` | PK: `id`. Unique: `policy_code`. FK: `proposed_by_employee_id -> employees(id)`, `approved_by_employee_id -> employees(id)`. Category check: `delegation_of_authority, revenue_recognition, incentive_scheme, credit_terms`. Status check: `draft, pending_approval, active, superseded`. |

---

## 3. Planned Schema (Future Modules & Vertical Extensions)

The following relational schemas represent planned database extensions to be applied via subsequent migrations (`Phase 5`):

### 3.1 Planned Data Entry Intake Schemas (`intake_*`)
```sql
-- Planned Migration: 0014_data_entry_intake.sql
CREATE TABLE intake_batches (
    id text PRIMARY KEY,
    batch_name text NOT NULL,
    source_name text NOT NULL,
    vertical text NOT NULL CHECK (vertical IN ('wealth', 'banking', 'markets', 'real-estate')),
    uploaded_by_employee_id text NOT NULL REFERENCES employees(id),
    total_rows int NOT NULL DEFAULT 0,
    valid_rows int NOT NULL DEFAULT 0,
    rejected_rows int NOT NULL DEFAULT 0,
    status text NOT NULL CHECK (status IN ('uploading', 'validating', 'ready', 'published', 'archived')),
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE intake_rows (
    id text PRIMARY KEY,
    batch_id text NOT NULL REFERENCES intake_batches(id) ON DELETE CASCADE,
    raw_payload jsonb NOT NULL,
    parsed_name text,
    parsed_phone text,
    parsed_email text,
    validation_errors jsonb DEFAULT '[]'::jsonb,
    is_duplicate boolean NOT NULL DEFAULT false,
    duplicate_match_lead_id text REFERENCES leads(id),
    status text NOT NULL CHECK (status IN ('staging', 'valid', 'rejected', 'published')),
    created_at timestamptz NOT NULL DEFAULT NOW()
);
```

### 3.2 Implemented HR Core & Planned HRMS Schemas (`hr_*`, `lifecycle_*`, `payroll_*`)

#### Implemented HR Baseline Tables (`0020_hr_workflows.sql`, `0021_lifecycle_approval_verification.sql`)
```sql
-- Migration 0020_hr_workflows.sql & 0021_lifecycle_approval_verification.sql
CREATE TABLE hr_lifecycle_requests (
    id text PRIMARY KEY,
    employee_id text NOT NULL REFERENCES employees(id),
    request_type text NOT NULL CHECK (request_type IN ('new_joiner', 'team_transfer', 'promotion', 'exit')),
    target_role text,
    target_vertical text CHECK (target_vertical IN ('wealth', 'banking', 'markets', 'real-estate')),
    target_team_id text,
    requested_effective_date date NOT NULL,
    justification text NOT NULL,
    current_status text NOT NULL CHECK (current_status IN ('pending', 'approved', 'rejected', 'cancelled')),
    created_by_employee_id text NOT NULL REFERENCES employees(id),
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE lifecycle_request_approvals (
    id text PRIMARY KEY,
    request_id text NOT NULL REFERENCES hr_lifecycle_requests(id) ON DELETE CASCADE,
    approver_employee_id text NOT NULL REFERENCES employees(id),
    decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
    decision_notes text,
    decided_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_lifecycle_approval UNIQUE (request_id, approver_employee_id)
);

CREATE TABLE employee_leaves (
    id text PRIMARY KEY,
    employee_id text NOT NULL REFERENCES employees(id),
    leave_type text NOT NULL CHECK (leave_type IN ('annual', 'sick', 'emergency', 'unpaid')),
    start_date date NOT NULL,
    end_date date NOT NULL,
    allocation_dampening_pct int NOT NULL DEFAULT 100 CHECK (allocation_dampening_pct BETWEEN 0 AND 100),
    approved_by_employee_id text REFERENCES employees(id),
    notes text,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE employee_training_milestones (
    id text PRIMARY KEY,
    employee_id text NOT NULL REFERENCES employees(id),
    module_code text NOT NULL,
    module_name text NOT NULL,
    status text NOT NULL CHECK (status IN ('enrolled', 'in_progress', 'completed', 'failed')),
    score numeric(5,2),
    completed_at timestamptz,
    verified_by_employee_id text REFERENCES employees(id),
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE people_operations_reports (
    id text PRIMARY KEY,
    report_type text NOT NULL CHECK (report_type IN ('headcount_summary', 'attrition_analysis', 'training_compliance', 'leave_utilisation')),
    period_start date NOT NULL,
    period_end date NOT NULL,
    vertical_scope text CHECK (vertical_scope IN ('wealth', 'banking', 'markets', 'real-estate', 'all')),
    metrics jsonb NOT NULL,
    generated_by_employee_id text NOT NULL REFERENCES employees(id),
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE people_report_schedules (
    id text PRIMARY KEY,
    report_type text NOT NULL,
    cadence text NOT NULL CHECK (cadence IN ('weekly', 'monthly', 'quarterly')),
    recipients jsonb NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    last_run_at timestamptz
);
```

#### Planned HRMS Extension Schemas (Owner-Added Slices 1–4)
```sql
-- Planned Slice 1: Multi-Tier Leave Request & Superior Approval Engine
CREATE TABLE employee_leave_requests (
    id text PRIMARY KEY,
    employee_id text NOT NULL REFERENCES employees(id),
    leave_type text NOT NULL CHECK (leave_type IN ('casual', 'sick', 'earned', 'unpaid', 'bereavement', 'paternity', 'maternity')),
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_days numeric(4,1) NOT NULL CHECK (total_days > 0),
    reason text NOT NULL,
    handover_notes text,
    status text NOT NULL CHECK (status IN ('submitted', 'approved', 'rejected', 'cancelled')) DEFAULT 'submitted',
    current_tier_approver_id text REFERENCES employees(id),
    approved_by_employee_id text REFERENCES employees(id),
    rejection_reason text,
    record_version int NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE leave_approval_actions (
    id text PRIMARY KEY,
    leave_request_id text NOT NULL REFERENCES employee_leave_requests(id) ON DELETE CASCADE,
    approver_employee_id text NOT NULL REFERENCES employees(id),
    approver_role text NOT NULL,
    action text NOT NULL CHECK (action IN ('approved', 'rejected', 'escalated')),
    comments text,
    acted_at timestamptz NOT NULL DEFAULT NOW()
);

-- Planned Slice 2: Paid WFH & Attendance Evidence Engine
CREATE TABLE attendance_records (
    id text PRIMARY KEY,
    employee_id text NOT NULL REFERENCES employees(id),
    work_date date NOT NULL,
    attendance_mode text NOT NULL CHECK (attendance_mode IN ('office', 'wfh', 'on_duty', 'half_day')),
    check_in_at timestamptz NOT NULL,
    check_out_at timestamptz,
    total_hours numeric(4,2),
    wfh_progress_summary text,
    work_evidence_url text,
    status text NOT NULL CHECK (status IN ('pending_review', 'verified', 'rejected')) DEFAULT 'pending_review',
    verified_by_employee_id text REFERENCES employees(id),
    rejection_reason text,
    record_version int NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_employee_work_date UNIQUE (employee_id, work_date)
);

CREATE TABLE attendance_progress_logs (
    id text PRIMARY KEY,
    attendance_record_id text NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
    logged_at timestamptz NOT NULL DEFAULT NOW(),
    deliverable_title text NOT NULL,
    deliverable_progress_pct int NOT NULL CHECK (deliverable_progress_pct BETWEEN 0 AND 100),
    evidence_artifact_path text,
    crm_activity_count int NOT NULL DEFAULT 0
);

-- Planned Slice 3: Holiday Calendars & Working Days Engine
CREATE TABLE holiday_calendars (
    id text PRIMARY KEY,
    calendar_code text NOT NULL UNIQUE,
    calendar_name text NOT NULL,
    calendar_year int NOT NULL,
    vertical_scope text CHECK (vertical_scope IN ('wealth', 'banking', 'markets', 'real-estate', 'all')) DEFAULT 'all',
    region_code text NOT NULL DEFAULT 'IN-MUM',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE statutory_holidays (
    id text PRIMARY KEY,
    calendar_id text NOT NULL REFERENCES holiday_calendars(id) ON DELETE CASCADE,
    holiday_date date NOT NULL,
    holiday_name text NOT NULL,
    holiday_type text NOT NULL CHECK (holiday_type IN ('mandatory', 'optional', 'restricted')),
    CONSTRAINT uq_calendar_holiday_date UNIQUE (calendar_id, holiday_date)
);

-- Planned Slice 4: Effective-Dated Compensation & Payroll Preview Engine
CREATE TABLE employee_salary_structures (
    id text PRIMARY KEY,
    employee_id text NOT NULL REFERENCES employees(id),
    effective_from date NOT NULL,
    effective_to date,
    currency text NOT NULL DEFAULT 'INR',
    monthly_ctc numeric(12,2) NOT NULL CHECK (monthly_ctc > 0),
    basic_pay numeric(12,2) NOT NULL CHECK (basic_pay > 0),
    hra numeric(12,2) NOT NULL DEFAULT 0,
    special_allowance numeric(12,2) NOT NULL DEFAULT 0,
    statutory_pf_employee numeric(12,2) NOT NULL DEFAULT 0,
    statutory_pf_employer numeric(12,2) NOT NULL DEFAULT 0,
    professional_tax numeric(12,2) NOT NULL DEFAULT 0,
    created_by_employee_id text NOT NULL REFERENCES employees(id),
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE payroll_periods (
    id text PRIMARY KEY,
    cycle_month text NOT NULL, -- Format: 'YYYY-MM'
    period_start_date date NOT NULL, -- e.g. 2026-01-28
    period_end_date date NOT NULL, -- e.g. 2026-02-27
    total_calendar_days int NOT NULL,
    standard_working_days int NOT NULL,
    status text NOT NULL CHECK (status IN ('draft', 'preview', 'locked', 'certified')) DEFAULT 'draft',
    certified_by_employee_id text REFERENCES employees(id),
    certified_at timestamptz,
    CONSTRAINT uq_payroll_cycle UNIQUE (cycle_month)
);

CREATE TABLE payroll_item_previews (
    id text PRIMARY KEY,
    payroll_period_id text NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
    employee_id text NOT NULL REFERENCES employees(id),
    effective_working_days numeric(4,1) NOT NULL,
    attended_days numeric(4,1) NOT NULL,
    approved_leave_days numeric(4,1) NOT NULL,
    lop_days numeric(4,1) NOT NULL DEFAULT 0,
    gross_payable numeric(12,2) NOT NULL,
    total_deductions numeric(12,2) NOT NULL,
    net_payable numeric(12,2) NOT NULL,
    pro_rata_factor numeric(6,5) NOT NULL,
    calculation_breakdown jsonb NOT NULL,
    CONSTRAINT uq_period_employee UNIQUE (payroll_period_id, employee_id)
);
```

### 3.3 Planned Super Admin Configuration & Governance Schemas (`sys_*`)
```sql
-- Planned Migration: 0016_super_admin_governance.sql
CREATE TABLE system_rules (
    id text PRIMARY KEY,
    rule_key text NOT NULL UNIQUE,
    version int NOT NULL DEFAULT 1,
    vertical text CHECK (vertical IN ('wealth', 'banking', 'markets', 'real-estate', 'all')),
    rule_parameters jsonb NOT NULL,
    published_by_employee_id text NOT NULL REFERENCES employees(id),
    published_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_incidents (
    id text PRIMARY KEY,
    incident_type text NOT NULL CHECK (incident_type IN ('unauthorized_access', 'concurrency_breach', 'data_export_spike')),
    severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    details jsonb NOT NULL,
    investigated_by_employee_id text REFERENCES employees(id),
    resolution_notes text,
    resolved_at timestamptz
);
```

---

## 4. Master Table Reference & Invariant Matrix

| Table Name | Active Migration | Owning Role / Module | Core Schema Invariants |
|---|---|---|---|
| `employees` | `0001_init.sql` | SA / Identity | Active employment flag; unique email; status check. |
| `assignments` | `0001_init.sql` | SA / Scopes | Effective interval: `effective_from <= CURRENT_DATE <= effective_to`. |
| `leads` | `0001_init.sql` | SC, TL / Pipeline | Partitioned by `vertical`; stage state machine; OCC `record_version`. |
| `lead_tasks` | `0001_init.sql`, `0003` | SC, TL / Tasks | Preserves `original_due_at`; tracks `deferral_count`. |
| `lead_events` | `0001_init.sql`, `0002` | Platform / Audit | Append-only; zero deletions; tracks actor role, team, assignment. |
| `calls` | `0002_wealth_caller.sql` | SC / Interaction | Permanent call record; duration and disposition check. |
| `messages` | `0002`, `0003` | SC / Omnichannel | Tracks channel, direction, status, and supervisor queue. |
| `proposals` | `0002_wealth_caller.sql` | SC, TL / Proposals | Formal proposal status machine (`draft` -> `submitted` -> `approved` -> `sent`). |
| `outcome_requests` | `0002`, `0007` | TL / Approvals | Conversion & reopen decisions; structured `decision_evidence jsonb`. |
| `team_targets` | `0004_team_lead.sql` | TL / Targets | Team target allocation; feeds bottom-up forecast. |
| `management_actions` | `0008_manager.sql` | MG / Interventions | Manager operational directives with deadlines. |
| `manager_targets` | `0009_manager_workflows.sql` | MG / Targets | Non-silent remainder check; cascades to `team_targets`. |
| `capacity_plans` | `0009_manager_workflows.sql` | MG / Planning | Backlog capacity recovery modeling and team reallocations. |
| `regional_targets` | `0010_regional_workflows.sql` | RM / Targets | NM allocation bridge; cascades to `manager_targets`. |
| `national_targets` | `0011_national_workflows.sql` | NM / Targets | CEO target breakdown; cascades to `regional_targets`. |
| `cross_vertical_referrals` | `0011_national_workflows.sql` | NM / Referrals | Opaque inter-vertical bridge; client policy credit split `[Deck P320]`. |
| `company_targets` | `0012_ceo_workflows.sql` | CEO / Targets | Board-approved annual goals; multi-vertical allocation splits. |
| `company_forecasts` | `0012_ceo_workflows.sql` | CEO / Forecasts | Enterprise consolidated revenue model across verticals. |
| `reporting_periods` | `0013_cfo_workflows.sql` | CFO / Periods | Fiscal period lifecycle; certified close stamped with SHA-256 hash. |
| `sales_finance_handoffs` | `0013_cfo_workflows.sql` | CFO / Revenue | Bridge from TL conversion approval to statutory finance verification. |
| `finance_ledger_entries` | `0013_cfo_workflows.sql` | CFO / Ledger | Permanent general ledger entries (revenue recognition, receipts, reversals). |
| `finance_reconciliations` | `0013_cfo_workflows.sql` | CFO / Controls | Period 3-way reconciliation freeze (CRM Sales == Recognised Revenue == Cash Receipts). |
| `intake_sources` | `0022_data_entry_workflows.sql` | DE / Sources | Registered intake sources; permitted verticals/products; legal consent basis; suspension status. |
| `intake_batches` | `0022_data_entry_workflows.sql` | DE / Ingestion | Staged batch intake lifecycle; SHA-256 idempotency; atomic publish to leads. |
| `intake_rows` | `0022_data_entry_workflows.sql` | DE / Validation | Line-by-line validation, lineage preservation (`raw_payload`), correction history, duplicate holding. |
| `intake_export_audits` | `0022_data_entry_workflows.sql` | DE / Audit | Audited intake quality CSV worklist exports with user, period, and filter logging. |
| `hr_lifecycle_requests` | `0020_hr_workflows.sql` | HR / Lifecycle | Personnel changes (joiner, transfer, promotion, exit) with role/vertical scoping. |
| `lifecycle_request_approvals`| `0021_lifecycle_approval_verification.sql` | HR / Approvals | Formal sign-off on lifecycle requests with unique constraint per approver. |
| `employee_leaves` | `0020_hr_workflows.sql` | HR / Availability | Leave intervals dampening algorithmic lead allocation (0-100%). |
| `employee_training_milestones`| `0020_hr_workflows.sql` | HR / Training | Compliance modules & induction pass/fail records with score. |
| `people_operations_reports` | `0020_hr_workflows.sql` | HR / Analytics | Structured headcount, attrition, compliance, and utilization report packs. |
| `people_report_schedules` | `0020_hr_workflows.sql` | HR / Schedules | Automated report delivery cadences (weekly, monthly, quarterly). |
| `employee_leave_requests` | *Planned Slice 1* | HRMS / Leave Engine | Upward multi-tier employee leave applications with OCC versioning. |
| `leave_approval_actions` | *Planned Slice 1* | HRMS / Approvals | Step-by-step audit trail of approvals, rejections, and escalations. |
| `attendance_records` | *Planned Slice 2* | HRMS / Attendance | Check-in/out records with work mode (office/wfh) and mandatory progress summary. |
| `attendance_progress_logs` | *Planned Slice 2* | HRMS / Evidence | Deliverable completion metrics and CRM activity proof attached to attendance. |
| `holiday_calendars` | *Planned Slice 3* | HRMS / Holidays | Multi-vertical and regional holiday master calendar definitions. |
| `statutory_holidays` | *Planned Slice 3* | HRMS / Holidays | Specific gazetted and restricted holiday dates within active calendars. |
| `employee_salary_structures` | *Planned Slice 4* | HRMS / Compensation | Effective-dated salary components (Basic, HRA, PF, PT, Special Allowance). |
| `payroll_periods` | *Planned Slice 4* | HRMS / Payroll | Non-overlapping 28th-to-27th payroll periods with lock/certify lifecycle. |
| `payroll_item_previews` | *Planned Slice 4* | HRMS / Payroll | Employee pro-rata calculations, attended days, leave days, and net pay preview. |
| `system_rules` | `0019_superadmin_workflows.sql` | SA / Config | Versioned business parameters; audited rule releases. |
| `prospect_import_jobs` | `0041_bulk_prospect_import.sql` | DE, SA / Bulk Ingestion | High-volume spreadsheet import lifecycle (.xlsx, .csv, paste); tracks total, assigned, duplicate, invalid, and unassigned exception counts. |
| `prospect_import_rows` | `0041_bulk_prospect_import.sql`, `0043` | DE, SA / Row Validation | Line-by-line normalization, raw payload, row-level status (`assigned`, `duplicate`, `invalid`, `unassigned_exception`), failure reasons, assigned caller attribution, and `is_priority` flag. |
| *Multi-Vertical DE Grants* | `0042_data_entry_multivertical_grants.sql` | DE / Scope Grants | Adds active `markets` and `real_estate` assignment grants for demo Data Entry operator (`EMP-015`), enabling end-to-end multi-vertical file upload and spreadsheet paste testing. |
| `round_robin_cursors` | `0043_priority_leads_and_round_robin.sql` | DE, Auto-Routing | Persisted concurrency-safe round-robin cursor by `(vertical, team_id)`; `__ALL_TEAMS__` separates vertical-wide routing from team-targeted routing. Row created before `FOR UPDATE` to serialize first-time concurrent imports. |
| `employees` (*Routing Actor*) | `0050_automatic_caller_routing_actor.sql` | Routing Audit | Disabled, non-login system identity used as the actor for date-effective lead redistribution and its immutable ownership/timeline events. |
| `leads` (*Priority & Assignment Updates*) | `0043_priority_leads_and_round_robin.sql` | SC, Lead Inbox | Adds `is_priority BOOLEAN NOT NULL DEFAULT FALSE` and `assigned_at TIMESTAMPTZ DEFAULT now()`. Indexed with `idx_leads_priority_assigned`. |
| `intake_rows` (*Priority Update*) | `0043_priority_leads_and_round_robin.sql` | DE / Staging | Adds `is_priority BOOLEAN NOT NULL DEFAULT FALSE` for manual intake staging. |
| `caller_calling_identities` | `0044_secure_calling_and_bonvoice_preparation.sql` | Voice, Security | Restricted server-side approved outbound identities/DIDs per sales caller (`employee_id PRIMARY KEY`). |
| `calls` (*Provider & Masking Updates*) | `0044_secure_calling_and_bonvoice_preparation.sql` | SC, Telephony | Adds `provider_call_reference`, `caller_identity`, `destination_masked`, and `failure_reason`. Indexed on `provider_call_reference`. |
| `lead_handoffs` | `0045_relationship_manager_workflow.sql` | SC, REL, MG / Commercial Banking | Caller qualification finding, requested loan requirement, required documents, qualification evidence, RM handoff acceptance/return decision with mandatory reason, and bank partner institution proposals. |
| `leads` (*REL Workflow Updates*) | `0045_relationship_manager_workflow.sql` | SC, REL, MG | Adds `requested_amount numeric`, `rel_owner_id text REFERENCES employees(id)`, and `handoff_status text CHECK (pending, accepted, returned)`. Migrated active TL assignments to REL. |



