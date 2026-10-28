# Data Entry — Manual Prospect Record & Bulk Prospect Import Contract

Status: **project-owner decision, 2026-10-22**. This decision supersedes the earlier staged-only, no-automatic-assignment rule from 2026-10-18. The project owner explicitly revised the Data Entry workspace to provide a unified **Enter & verify** workspace supporting two operational modes:
1. **Single Manual Entry:** Operator inputs a single prospect, selects its vertical and priority, and submits it for immediate caller assignment. The confirmation reads back the canonical lead and names the assigned caller. Previously staged drafts can still be published from the saved-records table.
2. **Bulk Spreadsheet Import & Auto-Routing:** Operator uploads an Excel workbook (`.xlsx`, `.xls`), CSV file, or pastes rectangular spreadsheet rows copied from Excel/Google Sheets. Valid, non-duplicate prospects are promoted directly into canonical CRM prospects (`leads` table) in that vertical and automatically assigned to an active, eligible Sales Caller (`SC`).

> [!NOTE]
> This bulk import and auto-routing capability is an explicit project-owner operational decision. It is NOT part of the historical Action Deck PDF (Deck P264–P275), which outlined legacy batch staging and allocation mechanisms that remain inactive for the operator.

---

## 1. Unified Workspace Modes & Anatomy

The Data Entry workspace operates under the `/data-entry/intake` route, exposing two accessible tabs:
- **`Single Manual Entry` (`#tab-manual-entry`):** High-touch individual prospect registration with immediate database readback.
- **`Bulk Spreadsheet Import` (`#tab-bulk-import`):** High-volume spreadsheet intake with column auto-mapping, row-numbered preview, validation warnings, duplicate detection, chunked background processing, and downloadable reconciliation reports.

### Destination Vertical Scope
Data Entry operators are bound by their assigned vertical grants (e.g., Wealth, Banking). For every import:
- The operator must explicitly select exactly one destination vertical from their authorized grants.
- Cross-vertical imports are rejected server-side with `403 FORBIDDEN` (enforced on both job creation and chunk processing).

---

## 2. Ingested Fields & Canonical Mapping

| Canonical Field | Required / Optional | Processing & Validation Rule |
|---|---|---|
| **Prospect Name** (`name`) | Required | Non-empty trimmed text; minimum 2 characters. |
| **Primary Mobile** (`mobile`) | Required | Indian mobile format normalized to `+91 XXXXX XXXXX`. Mobile numbers are preserved as text to prevent spreadsheet numeric precision truncation. |
| **Email Address** (`email`) | Required | Standard RFC 5322 email format validation. |
| **WhatsApp Number** (`whatsapp`) | Optional | Normalized Indian mobile number; defaults to primary mobile if omitted. Stored in `leads.whatsapp_phone`. |
| **Location** (`location`) | Optional | City, state, or address string. Stored in `leads.location`. |
| **Vertical** (`vertical`) | Required | Chosen once per import session; validated against operator's active assignments. |

---

## 3. Bulk Processing Engine & Invariants

Large imports (e.g., 10,000+ synthetic rows) are chunked into bounded batches (default 500 rows per transaction) to prevent database timeouts and lock contention.

### Processing Steps Per Row:
1. **Normalization & Schema Validation:**
   - Evaluates mandatory fields (`name`, `mobile`, `email`).
   - If required fields are missing or malformed, the row is held as `invalid` with an explicit reason (e.g., `"Missing prospect name"`, `"Invalid Indian mobile number"`). Canonical data is never fabricated.
2. **Duplicate Detection:**
   - **In-File Duplicates:** Tracks phone numbers and emails already observed within the same import file. Duplicate rows are marked `duplicate` with reason `"Duplicate within file (phone: ...)"`.
   - **CRM Duplicates:** Checks existing CRM prospects in the `leads` table for identical normalized phone or email. Matching rows are marked `duplicate` with reason `"Duplicate in CRM (matches lead FV-XXXX)"`.
   - Existing records are never silently overwritten or duplicated.
3. **Canonical Prospect Creation:**
   - Generates canonical CRM prospect in `leads` table (`id` format `FV-XXXX`), setting `import_id`, `vertical`, `provenance = 'bulk_import'`, `stage = 'new'`, and initial 2-hour follow-up task in `lead_tasks`.
   - Records immutable audit trail in `lead_events` and initial ownership event in `lead_ownership_events`.
4. **Deterministic Fair Auto-Routing:**
   - Queries active employees with role `SC` assigned to the target vertical.
   - **Eligibility Constraints:**
     - Must have an effective-dated `SC` assignment in the selected vertical and team, and an active employee record.
     - Must not have availability set to `'away'`.
     - Must not have approved leave covering today in `employee_leave_requests`.
     - Work-from-home (`work_mode = 'wfh'`) callers are fully eligible and included.
   - **Fairness Distribution Algorithm:**
     - A persisted `(vertical, team_id)` cursor rotates callers in stable employee-ID order. Vertical-wide imports use a separate `__ALL_TEAMS__` cursor; a team-targeted intake uses that team's cursor.
     - The cursor row is inserted before `SELECT FOR UPDATE`, serializing concurrent first-time imports as well as later chunks. Each valid row advances the cursor once; 23 leads across 10 eligible callers split 3/3/3/2/2/2/2/2/2/2.
     - The chosen caller's team is written on the lead. No caller from another vertical or an expired/future assignment can receive it. Duplicate and invalid rows do not consume a turn.
5. **No-Eligible-Caller Exception:**
   - If all callers in the vertical are away, on approved leave, or no callers exist, the row is held as `unassigned_exception` with reason `"No eligible sales callers currently available in vertical"`.
   - Held rows stay in the selected team's supervised exception queue for the Relationship Manager (`REL`). The system never invents an owner or falsely counts a prospect as assigned.
6. **Retry-Safe Idempotency:**
   - Imports accept an optional `idempotencyKey`. Retrying a completed or partially-completed chunk never re-creates prospects or alters already successful assignments.

---

## 4. Reconciliation Balance Equation

Every bulk import enforces the strict mathematical balance invariant:
$$\text{Total Ingested Rows} = \text{Assigned Prospects} + \text{Duplicates Held} + \text{Invalid Rows} + \text{Unassigned Exceptions}$$

The UI renders:
- Live chunk progress bar (`processedRows / totalRows`).
- Reconciliation KPI matrix cards (Assigned, Duplicates, Invalid, Unassigned Exceptions).
- Breakdown metrics by Destination Team and Assigned Sales Caller.
- Downloadable detailed reconciliation report (CSV) detailing row-by-row status, assigned caller, lead ID, and failure reasons.

---

## 5. Security & Access Boundaries

- **Role Gate:** Only `DE` (Data Entry) and `SA` (Super Admin) can initiate or process bulk import jobs.
- **Vertical Scope Enforcement:** Operators can only import into verticals matching their active assignment grants (`req.auth.scope.verticals`).
- **Isolation:** Assigned Sales Callers can only view their own assigned prospects in `/wealth/prospects` (or vertical equivalent). Team Leads can inspect all team-assigned and unassigned exception prospects.
- **Persistence Integrity:** Implemented via additive migration `0041_bulk_prospect_import.sql` (`prospect_import_jobs`, `prospect_import_rows`, and `leads.import_id`). No existing production data is dropped or wiped.

## Caller role, team, or employment changes

An immediate Super Admin scope change, approved transfer/promotion activation, or offboarding redistributes the former Sales Caller's open leads to currently eligible callers on each lead's **existing team** in the same transaction. Open outreach tasks move with the lead. Every change creates a `lead_ownership_events` transfer record and an `assignment-changed` timeline note naming the previous and new caller. The receiving caller's inbox shows a Reassigned badge and the previous/current caller names. Historical converted/lost leads and accepted Relationship Manager handoffs retain their owners.

Future-dated changes are picked up when the assignment date becomes effective by the API's periodic routing reconciliation (at startup and every 60 seconds). A disabled, non-login routing actor (`0050_automatic_caller_routing_actor.sql`) owns those audit events. If no eligible caller remains on that team, the lead is placed in a supervised holding queue, its old open outreach tasks are cancelled, and it is never sent to another team or vertical. The same reconciliation automatically assigns those held leads when an eligible caller joins the original team, restores an open outreach task, and retains the previous-to-new caller audit trail.
