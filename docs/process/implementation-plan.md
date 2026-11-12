# Master Delivery Standard & Canonical Workflow — Finverse CRM v2

**Document Authority:** Canonical Delivery Standard & Operational Lifecycle Protocol
**Scope:** All Verticals (Wealth, Banking, Markets/Trading, Real Estate), Horizontals (Data Entry, HR, Superadmin), and Executive Workspaces (CEO, CFO).
**Applicability:** Active Development, Deployment Preparation, and Post-Deployment Maintenance.
**Canonical Sources:**
- Action Deck: `docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf` (P001–P320)
- Requirements Graph: `graphify-requirements/graph.json`
- Code Relationships Graph: `graphify-out/graph.json`
- Brand Guidelines & Authentic Assets: `docs/design/design-system.md`
- Active Process Records: `docs/process/STATUS.md`, `docs/process/BUILD_LOG.md`, `docs/process/COVERAGE_MATRIX.md`

---

## 1. Single Authoritative Workflow

This document defines the single canonical workflow for all engineering, design, quality assurance, and operational maintenance across Finverse CRM v2. Parallel or competing standards are strictly prohibited. Every task, whether feature development, bug fix, or post-deployment correction, must adhere to this standard.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        CANONICAL TASK SEQUENCE (6-STEP LOOP)                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. RESUME CHECKPOINT        Read STATUS.md for active milestone, blockers, next task   │
│ 2. RETRIEVE KNOWLEDGE       Query graphify-requirements / inspect relevant deck pages  │
│ 3. INSPECT REQUIREMENTS     Verify source pages, brand tokens, and existing code       │
│ 4. SMALLEST CHANGE          Implement focused, type-safe change; reuse shared foundation│
│ 5. VERIFY BEHAVIOR          Run live PostgreSQL integration suites & browser checks    │
│ 6. UPDATE RECORDS & GRAPH   Update STATUS.md, BUILD_LOG.md, COVERAGE_MATRIX, refresh   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The Universal Task Sequence in Detail

Every task follows this exact sequence without exception:

### Step 1: Resume Checkpoint
- Open and read `docs/process/STATUS.md` at session start or task resumption.
- Identify the active milestone, existing blockers, and the exact next task.
- Never re-explore stabilized systems or repeat already completed milestones.

### Step 2: Retrieve Relevant Knowledge
- Query `graphify-requirements/graph.json` using the local Graphify executable:
  `& ".\.venv-graphify\Scripts\graphify.exe" query "<question>" --graph graphify-requirements/graph.json`
- Locate the specific requirement nodes, action IDs, and source deck references (`P001`..`P320`).
- If graph coverage is missing or stale, inspect authoritative local sources directly and update the graph. Missing graph coverage must never silently omit requirements.

### Step 3: Inspect Authoritative Requirements & Implementation
- Open the exact Action Deck PDF pages referenced by the task (`docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf`) or inspect extracted high-resolution images (`evidence/`).
- Inspect page layouts, zones, fields, defaults, tables, state indicators, and micro-interactions.
- Check brand guidelines in `docs/design/design-system.md` (authentic 1:1.22 logo, Spruce palette `#113F3D`, single primary button rule, typography: Manrope/Inter/JetBrains Mono).
- Inspect existing reusable components in `apps/web/src/components/`, API repositories in `apps/api/src/repo/`, and contracts in `packages/contracts/src/` before writing new code.

### Step 4: Make the Smallest Appropriate Change
- Write clean, type-safe TypeScript code with Zod validation contracts (`@finverse/contracts`).
- Follow SOLID design principles with pragmatic boundaries (no unnecessary boilerplate or speculative abstractions).
- Place vertical-specific differences in typed configuration or explicit domain modules (e.g. Banking pipeline stages: `New` → `Eligibility` → `Documents` → `Sanction` → `Disbursal`).
- Maintain OCC locking (`record_version`) and deny-by-default security checks on every read and mutation.

### Step 5: Verify Affected Behavior
- Execute automated integration test suites against live PostgreSQL 16 (never SQLite, never mocked DB).
- Verify typecheck: `pnpm -r typecheck` (0 errors).
- Verify lint: `pnpm -r lint --quiet` (0 errors).
- Verify build: `pnpm build` (clean production bundle).
- Capture and inspect live browser screens across Desktop (`1536x800`) and Mobile (`390x844`) viewports after data loads (never skeleton states).
- Remediate failures immediately; never skip failing assertions.

### Step 6: Update Checkpoint & Knowledge
- Update `docs/process/STATUS.md` with current state, remaining gaps, and exact next step.
- Append concise execution evidence (commands, pass counts, runtimes) to `docs/process/BUILD_LOG.md`.
- Update action status in `docs/process/COVERAGE_MATRIX.md`.
- Refresh knowledge graphs deterministically:
  * Requirements graph: `& ".\.venv-graphify\Scripts\python.exe" scripts/build_requirements_graph.py`
  * Code graph: `& ".\.venv-graphify\Scripts\graphify.exe" extract . --code-only`
- Verify retrieval of updated knowledge before completing the task.

---

## 3. Navigable Implementation Traceability Chain

Every role, view, and action must maintain complete, unbroken traceability across the repository:

$$\text{Action Deck Page} \longrightarrow \text{Action ID} \longrightarrow \text{Web Route / Component} \longrightarrow \text{Contract / API Route} \longrightarrow \text{Repository / DB Table} \longrightarrow \text{Automated Tests \& Evidence}$$

### Exact Repository Mapping

| Traceability Element | Canonical Location / Format | Example |
|---|---|---|
| **Source Requirement** | `docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf` (P001–P320) | Deck P037 / P099 (TL-01) |
| **Action Definition** | `action_catalogue_v2.json`, `graphify-requirements/graph.json` | `TL-01 Team Overview` |
| **Frontend Route** | `apps/web/src/App.tsx`, `apps/web/src/pages/` | `/management/team` (`TlPages.tsx`) |
| **API Route & Validation** | `apps/api/src/routes/`, `packages/contracts/src/` | `GET /api/tl/overview` (`tl.ts`) |
| **Repository & Data Access** | `apps/api/src/repo/`, `database/migrations/` | `apps/api/src/repo/tl.ts`, `database/migrations/0001_init.sql` |
| **Database Tables** | PostgreSQL 16 (`finverse_crm`, `finverse_test`) | `teams`, `employees`, `assignments`, `leads`, `lead_tasks` |
| **Test Verification** | `apps/api/test/`, `apps/web/e2e/` | `apps/api/test/banking.api.test.ts`, `e2e/branding.spec.ts` |
| **Process Records** | `docs/process/` | `STATUS.md`, `BUILD_LOG.md`, `COVERAGE_MATRIX.md` |

---

## 4. Post-Deployment Corrections Protocol

For any bug report, regression, or corrective maintenance in production or staging environments, follow this disciplined 6-step protocol:

1. **Identify Revision & Reproduce Symptom:**
   - Identify the exact deployed commit SHA or migration revision.
   - Reproduce the failing symptom in an isolated test environment with live PostgreSQL.
2. **Retrieve Affected Requirements & Dependencies:**
   - Query Graphify and inspect authoritative Deck pages governing the feature.
   - Trace callers, API consumers, database constraints, and shared components.
3. **Assess Multi-Vertical & Shared Impact:**
   - Determine whether the change affects shared components (`WorkspaceShell`, `api.ts`, `session.ts`, common UI primitives) or other verticals (Wealth, Banking, Markets, Real Estate).
   - Ensure backward compatibility and preserve existing business records.
4. **Make Smallest Justified Correction:**
   - Implement the minimal correct fix (Ponytail principle: YAGNI, standard library, native platform before dependencies).
   - Use compatible forward migrations (`database/migrations/XXXX_*.sql`); never alter historical migrations or drop production tables.
   - Explicitly document rollback and recovery procedures when schema mutations occur.
5. **Verify Failed Behavior & Regressions:**
   - Run the dedicated regression suite to prove the bug is resolved.
   - Run all affected workspace test suites to guarantee zero regression across shared services.
   - Verify monorepo typecheck and lint (0 errors).
6. **Update Records & Refresh Knowledge:**
   - Update `STATUS.md`, `BUILD_LOG.md`, and `COVERAGE_MATRIX.md`.
   - Refresh both knowledge graphs and verify updated symbols.

---

## 5. Efficient Continuity & Memory Protocol

To maintain high velocity and prevent context degradation:
- **Task-Relevant Loading:** Load only the canonical document sections, skills, and deck pages required for the immediate task. Never load all documents or the entire graph into a single prompt.
- **Evidence Reuse:** Reuse verified evidence for unchanged code. Do not rerun unchanged test suites unless shared core infrastructure was mutated.
- **Batch Knowledge Refreshes:** Refresh knowledge graphs after meaningful completed batches or role milestones, not after individual file edits.
- **Compaction Resilience:** At session end or before context compaction, save the current checkpoint in `STATUS.md` with: active role/action, files changed, checks executed, unresolved gaps, and exact next implementation step.
- **Honest Memory Retrieval:** If a rule cannot be loaded or a graph query fails, report the limitation explicitly and consult local canonical files. Never simulate or fake memory retrieval.

---

## 6. Multi-Level Testing & Acceptance Protocol

Every role and vertical must satisfy four levels of verification before release:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Typecheck & Linting (TypeScript / Zod 0 Errors)          │
├─────────────────────────────────────────────────────────────┤
│ 2. Scoped API Integration Suites (Live PostgreSQL 16)       │
├─────────────────────────────────────────────────────────────┤
│ 3. Continuous Multi-Role Vertical Lifecycle Suite           │
├─────────────────────────────────────────────────────────────┤
│ 4. Playwright Browser E2E & Mobile Viewport Suites          │
└─────────────────────────────────────────────────────────────┘
```

### The Twelve Canonical Deck Acceptance Scenarios (`[Deck P318]`)

1. **Wrong-Role URL:** Attempting direct browser navigation or API call to `/cfo/*` as a Sales Caller (`SC`) yields immediate `403 FORBIDDEN` and redirects.
2. **Other-Caller Lead ID:** Requesting `GET /api/leads/FV-OTHER` owned by another advisor returns `404 NOT_FOUND` or masked details; zero confidential customer data is exposed.
3. **Other-Vertical Search:** Searching for a prospect across vertical boundaries returns zero results unless an accepted cross-vertical referral token exists.
4. **Removed Team Grant:** When an assignment `valid_to` timestamp is exceeded, active sessions fail subsequent operations with `403 FORBIDDEN`.
5. **Promotion in an Open Session:** A mid-session promotion from Caller to TL maintains Caller privileges until session refresh, preventing unauthorized mid-flight privilege escalation.
6. **Exit with Pending PDF:** An employee marked terminated in HR immediately revokes access; pending scheduled PDF exports are aborted and sanitized.
7. **Replacement Employee:** A newly provisioned advisor receives a distinct identity and zero inherited historical win rate or unearned credit.
8. **Repeated Webhook / Idempotency:** Submitting duplicate payment match or conversion approval payloads returns the initial idempotent commit without duplicate ledger records.
9. **Concurrent Assignment:** Two team leads attempting simultaneous allocation of the same unassigned lead results in one successful claim and one clean `409 Conflict`.
10. **Duplicate Intake Import:** Uploading a batch containing existing phone numbers flags matching rows as duplicates (`DE-04`) and halts auto-publication.
11. **Refund After Fiscal Close:** Attempting a refund or credit note on a closed and certified period (`CFO-14`) requires formal CFO period unlocking (`CFO-15`).
12. **Midnight / Quarter Boundaries:** Schedulers running at 00:15 IST correctly partition records into the prior completed period without including post-midnight events.

---

## 7. Operational Roles Delivery & Verification Status

Finverse CRM v2 follows strict sequential delivery:
`Wealth Vertical → Horizontals (Superadmin, HR, Data Entry) → Commercial Banking → Markets / Trading → Real Estate`.

### Current Role Completion Scorecard

| Role Code | Role Title | Total Actions | Status | Test Verification Evidence | Documented Gaps / Active Tasks |
|---|---|---|---|---|---|
| **SC** | Sales Caller | 28 | Complete | `wealth.api.test.ts` (26/26), `banking.api.test.ts` (Suite 1) | Reconciling Banking dashboard details against Deck P036. |
| **TL** | Team Lead | 18 | Complete | `tl.api.test.ts` (18/18), `banking.api.test.ts` (Suites 2 & 3) | Reconciling Banking dashboard details against Deck P037. |
| **MG** | Manager | 13 | Complete | `manager.api.test.ts` (14/14), `banking.api.test.ts` (Suite 4) | Reconciling Banking dashboard details against Deck P135. |
| **RM** | Regional Manager | 10 | Complete | `regional.api.test.ts` (12/12), `banking.api.test.ts` (Suite 5) | Reconciling Banking dashboard details against Deck P161. |
| **NM** | National Manager | 11 | Complete | `national.api.test.ts` (13/13), `banking.api.test.ts` (Suite 6) | Reconciling Banking dashboard details against Deck P181. |
| **CEO** | Chief Executive Officer | 11 | Complete | `ceo.api.test.ts` (13/13) | Multi-vertical comparison active. |
| **CFO** | Chief Financial Officer | 19 | Complete | `cfo.api.test.ts` (34/34 + 13 hardening checks) | Multi-vertical revenue recognition active. |
| **SA** | Super Administrator | 11 | Complete | `superadmin.api.test.ts` (12/12) | Horizontal workspace complete. |
| **HR** | Human Resources | 7 | Complete (Action Deck core verified) | `hr.api.test.ts` (8/8) | Extended HRMS architecture specified (Slices 1–4 planned). |
| **DE** | Data Entry | 7 | Complete | `data-entry.api.test.ts` (8/8) | Single enter & verify workspace active. |

---

## 8. Human Resources & Extended HRMS Architecture, Traceability & Implementation Plan

### 8.1 Plan Scope & Architecture Principles

This section governs the canonical delivery of Human Resources (HR) and extended Human Resource Management System (HRMS) capabilities in Finverse CRM v2. It establishes a strict boundary between:
1. **The Core Action Deck Requirements (`HR-01`..`HR-07`)**: The statutory minimum defined in Action Deck pages P277–P290.
2. **The Owner-Added Operational Extensions**: Universal leave requests and multi-tier superior approvals, paid work-from-home (WFH) with check-in/out and work-progress evidence, vertical-scoped daily/monthly workforce rosters, holiday calendars/working days, and effective-dated salary records with 28th–27th payroll calculation previews.
3. **The Wider Enterprise HRMS Classification**: A structured taxonomy classifying potential HRMS capabilities as *Implemented*, *Partial*, *Absent*, or *Deferred* to prevent scope creep or building unrequested ATS/benefits systems.

---

### 8.2 Part A: What the Action Deck Explicitly Requires (`HR-01`..`HR-07`, P277–P290)

The Finverse Action Deck defines seven canonical HR actions that operate horizontally across all four verticals (Wealth Management, Commercial Banking, Markets & Trading, Real Estate Advisory):

| Action ID | Action Title | Deck Reference | Canonical Action Deck Contract Requirements |
|---|---|---|---|
| **HR-01** | Request a new employee account | Deck P277 (Screen), P278 (Contract) | **User Action:** Create lifecycle request with approved placement; attach role, supervisor, employment dates, required training; submit for approvals and Super Admin provisioning.<br>**Validation:** HR cannot issue the role grant directly. Duplicate employee identity must be resolved through an audited process.<br>**System Commit:** Create employment episode and provisioning request; notify required approvers.<br>**Reporting:** Track readiness, pending approvals, and start-date risk.<br>**Exception Handling:** Incomplete placement leaves access pending; never defaults to a company-wide dashboard. |
| **HR-02** | Request an effective-dated team transfer | Deck P279 (Screen), P280 (Contract) | **User Action:** Capture approved destination and reporting path; review lead, task, target, and review ownership impact; submit dated move for Super Admin activation.<br>**Validation:** Permanent employee identity remains unchanged. Current access ends at change boundary; past facts are preserved.<br>**System Commit:** Record lifecycle approval and handoff checklist with accountable owners.<br>**Reporting:** HR reports planned vs completed moves and unresolved handoff items.<br>**Exception Handling:** A pending transfer does not expose the destination interface or move leads early. |
| **HR-03** | Request a promotion with retained career history | Deck P281 (Screen), P282 (Contract) | **User Action:** Record promotion approvals and new scope; specify treatment of old leads and ongoing reviews; submit and verify activation through lifecycle status.<br>**Validation:** Old role permissions end by default. Career reports remain available as read-only history within new interface.<br>**System Commit:** Create new assignment interval; preserve prior role snapshots and performance identity.<br>**Reporting:** Promotion does not transfer past personal sales into new team performance.<br>**Exception Handling:** Dual duties require explicit dated grants; never inferred from promotion. |
| **HR-04** | Coordinate an employee exit | Deck P283 (Screen), P284 (Contract) | **User Action:** Record authorised exit and exact effective time; assign handoff owners for leads, tasks, reports, approvals; confirm Admin revocation and close exit checklist.<br>**Validation:** Replacement must receive a new employee/account identity. Record retention follows approved policy.<br>**System Commit:** Schedule account disable and job/schedule ownership review. Preserve immutable history.<br>**Reporting:** Exit checklist tracks operational completion without copying leaver's personal performance to another person.<br>**Exception Handling:** Urgent suspension routes immediately to Admin; business work goes to an accountable holding queue if no recipient exists. |
| **HR-05** | Record leave and allocation availability | Deck P285 (Screen), P286 (Contract) | **User Action:** Record approved leave or availability dates; notify supervisor of open work requiring coverage; confirm effective availability used by routing.<br>**Validation:** HR visibility excludes unnecessary medical/private details from sales supervisors. Leave approval is a named policy.<br>**System Commit:** Publish minimal availability flags and create coverage reminders.<br>**Reporting:** Capacity reports use available eligible staff; performance prorating follows signed target policy.<br>**Exception Handling:** Leave does not automatically transfer every lead. Supervisor must confirm required handoff. |
| **HR-06** | Track probation, training and review completion | Deck P287 (Screen), P288 (Contract) | **User Action:** Inspect upcoming milestones and overdue training/reviews; assign reminders and request supervisor evidence; record completion or route extension/role decision for approval.<br>**Validation:** Completion of training alone does not grant broader access. HR sees approved summaries, not unrestricted customer recordings.<br>**System Commit:** Store milestone evidence, reviewer, and lifecycle follow-up request.<br>**Reporting:** Track completion rates using eligible employee cohorts and explicit exclusions.<br>**Exception Handling:** Expired intern grants trigger access review, not automatic permanent-role conversion. |
| **HR-07** | Prepare a people operations pack | Deck P289 (Screen), P290 (Contract) | **User Action:** Select workforce scope and approved report sections; preview minimised employee information and pending actions; generate protected PDF for authorised management.<br>**Validation:** HR report access does not grant raw sales/customer or finance data.<br>**System Commit:** Create report snapshot with scope, recipient, and download audit.<br>**Reporting:** Separate employee lifecycle completion from sales performance and staffing forecasts.<br>**Exception Handling:** Sensitive detail is redacted unless recipient has specific field-level grant. |

---

### 8.3 Part B: What Is Already Implemented & Actually Verified

The existing codebase contains a fully verified, functioning baseline for the Action Deck core (`HR-01`..`HR-07`), backed by live PostgreSQL 16 migrations and automated test suites:

1. **PostgreSQL Migrations & Schema**:
   - `0020_hr_workflows.sql`: Tables `hr_lifecycle_requests` (joiner, transfer, promotion, exit), `employee_leaves` (administrative absence tracking), `employee_training_milestones` (probation and KYC/conduct modules), `people_operations_reports` (report snapshots), and `people_report_schedules` (recurring PDF pack distribution).
   - `0021_lifecycle_approval_verification.sql`: Table `lifecycle_request_approvals` enforcing multi-version verified approvals (`authorized_leader` or `verified_external_document`), request versioning (`request_version`), approval invalidation upon detail mutation (`approvalInvalidated: true`), and blocking premature Super Admin activation with `422 UNAPPROVED_REQUEST`.
2. **API Routes & Repositories (`apps/api/src/routes/hr.ts`, `apps/api/src/repo/hr.ts`)**:
   - Role guard: Enforces HTTP 403 for non-HR callers (Asha SC, Alok SA).
   - Endpoints: `POST /api/hr/accounts/request` (duplicate email check returning 409), `POST /api/hr/transfers/request`, `POST /api/hr/promotions/request`, `POST /api/hr/requests/:id/approve`, `PATCH /api/hr/requests/:id`, `POST /api/hr/exits/coordinate`, `GET/POST /api/hr/leaves`, `GET/POST /api/hr/milestones`, `POST /api/hr/reports/generate`, `GET /api/hr/reports/download/:file` (streams authentic `%PDF` binary).
3. **Frontend UI (`apps/web/src/pages/HrPages.tsx`)**:
   - Complete desktop and mobile screens matching Deck P277–P290: `HrOverviewPage` (`/hr/overview`), `HrJoinersPage` (`/hr/joiners`), `HrMoversPage` (`/hr/movers`), `HrLeaversPage` (`/hr/leavers`), `HrAvailabilityPage` (`/hr/availability`), `HrTrainingPage` (`/hr/training`), `HrReportsPage` (`/hr/reports`), `HrRequestsPage` (`/hr/requests`).
4. **Executed Automated Evidence**:
   - `apps/api/test/hr.api.test.ts`: **8/8 tests passed (100% green)** against live PostgreSQL 16.
   - Dynamic execution record: `evidence/hr_test_execution_record.json`.

---

### 8.4 Part C: Owner-Added Requirements

The project owner has expanded the operational requirements beyond the Action Deck baseline. These requirements are specified as follows:

1. **Universal Leave Requests & Multi-Tier Superior Approval**:
   - Every employee across every role (`SC`, `TL`, `MG`, `RM`, `NM`, `DE`, `HR`, `SA`, `CFO`, `CEO`) and vertical must be able to submit formal leave requests.
   - Leave requests must route automatically to the employee's direct superior in the organizational hierarchy.
   - Zero self-approval invariant: No employee can approve their own leave request under any circumstance.
   - Approved leaves must automatically update `employee_leaves` and publish allocation dampening (`allocation_status: unavailable`).
2. **Paid Work-From-Home (WFH) with Check-In/Out & Progress Evidence**:
   - **Invariant:** CRM login alone is strictly **not** attendance. An active session or periodic page click does not count as attendance.
   - Paid WFH requires:
     * Daily check-in timestamp (`check_in_at`) with self-declaration.
     * Daily check-out timestamp (`check_out_at`) with calculated total working hours.
     * **Mandatory work-progress evidence:** Structured submission detailing tangible work completed (e.g., number of client calls placed, deals moved, KYC documents inspected, or progress narrative $\ge 30$ chars).
     * Missing check-outs or unevidenced WFH sessions trigger an `attendance_exception` requiring supervisor review and resolution before being payable.
3. **Vertical-Scoped Daily and Monthly Workforce Visibility for HR**:
   - HR workspace must provide real-time and aggregate workforce views filterable by vertical (`wealth`, `banking`, `markets`, `real_estate`, `all`).
   - Daily View: Live workforce status roster (Office Present, Approved WFH, Approved Leave, Attendance Exception / Absent).
   - Monthly View: Aggregated monthly attendance rate, total worked days, leave rate, and headcount trend per vertical.
4. **Holiday Calendars, Working Days, Approved Leave, Attendance Exceptions & Manager Reports**:
   - Master holiday calendar configuration by calendar year and geographical region.
   - Formulaic working-days determination (Calendar Days minus Scheduled Weekly Offs minus Gazetted Holidays).
   - Automated attendance exception detection engine (unexcused absence, missing check-out, unverified WFH).
   - Manager Resource Allocation Report: Real-time team capacity dashboard highlighting staffing deficits against incoming prospect queues.
5. **Effective-Dated Salary Records & Payroll Calculation Previews (28th–27th Cycle)**:
   - Structured salary records with `effective_from` and `effective_to` intervals.
   - Automated payroll calculation preview engine executing on non-overlapping 28th–27th monthly cycles.
   - Pro-rata earnings, paid leave inclusion, and unpaid leave (LWP) deduction calculations.

---

### 8.5 Part D: Wider HRMS Module / Action List Classification

To prevent scope explosion and maintain delivery boundaries, the wider HRMS capabilities are classified into a four-tier disposition:

| HRMS Functional Area | Action / Feature Description | Status Classification | Current Codebase State | Plan Disposition |
|---|---|---|---|---|
| **Identity & Account Lifecycle** | Account request, hiring authority approval, Super Admin provisioning (`HR-01`) | **Implemented** | `hr_lifecycle_requests`, `HrJoinersPage`, `hr.api.test.ts` | Complete (Action Deck core). |
| **Team Transfers** | Effective-dated team transfer, parameter mutation approval invalidation (`HR-02`) | **Implemented** | `hr_lifecycle_requests`, `lifecycle_request_approvals`, `HrMoversPage`, migration `0021` | Complete (Action Deck core). |
| **Promotions & Career History** | Effective-dated promotion, role scope change, immutable prior performance preservation (`HR-03`) | **Implemented** | `hr_lifecycle_requests`, `HrMoversPage`, `hr.api.test.ts` | Complete (Action Deck core). |
| **Offboarding & Exits** | Scheduled account revocation, replacement identity, open work handoff (`HR-04`) | **Implemented** | `hr_lifecycle_requests`, `HrLeaversPage`, `hr.api.test.ts` | Complete (Action Deck core). |
| **Training & Probation Tracking** | Compliance modules, probation milestone reviews without permission elevation (`HR-06`) | **Implemented** | `employee_training_milestones`, `HrTrainingPage`, `hr.api.test.ts` | Complete (Action Deck core). |
| **People Operations Reporting** | PDF operations pack generation (`%PDF`), distribution schedules (`HR-07`) | **Implemented** | `people_operations_reports`, `people_report_schedules`, `HrReportsPage` | Complete (Action Deck core). |
| **Basic Administrative Leave Logging** | Admin logging of leave intervals dampening caller lead allocation (`HR-05`) | **Implemented** | `employee_leaves`, `HrAvailabilityPage`, `hr.api.test.ts` | Complete (Action Deck baseline). |
| **Universal Leave Self-Service & Approvals** | Multi-tier superior leave request & approval flow (SC $\to$ TL $\to$ MG $\to$ RM $\to$ NM $\to$ CEO) across all 4 verticals | **Absent** | Only administrative HR logging exists in `employee_leaves`; no employee self-service or multi-level approval hierarchy. | **Planned: Slice 1**. |
| **Paid Work-From-Home (WFH) & Evidence** | WFH check-in/out, duration tracking, mandatory work-progress evidence (calls/notes) | **Absent** | No WFH table or attendance engine. Only login session exists. | **Planned: Slice 2**. |
| **Attendance Exceptions & Tracking** | Missing check-out, tardiness, unverified WFH exception flagging, supervisor resolution | **Absent** | No attendance fact table or exception engine. | **Planned: Slice 2**. |
| **Holiday Calendars & Working Days** | Multi-region gazetted holiday master, weekend schedules, cycle working days calculation | **Absent** | No holiday table or working day calculation service. | **Planned: Slice 3**. |
| **Workforce Visibility Rosters** | Real-time daily roster (Office/WFH/Leave/Absent) and monthly vertical attendance reports for HR | **Partial** | Static headcount cards exist on `/hr/overview`; dynamic vertical daily/monthly roster absent. | **Planned: Slice 3**. |
| **Manager Resource Allocation Views** | Frontline team capacity view against lead queues, coverage gap alerts | **Absent** | Not present in Manager/TL pages. | **Planned: Slice 3**. |
| **Effective-Dated Salary Structures** | Base, HRA, allowances, effective intervals (`effective_from` / `effective_to`), increments | **Absent** | No employee salary schema exists. | **Planned: Slice 4**. |
| **Payroll Previews (28th–27th Cycle)** | Non-overlapping pay cycle calculation, partial joiner pro-rata, LWP deduction, pay slip preview | **Absent** | No payroll engine or pay period table exists. | **Planned: Slice 4**. |
| **Recruitment & Applicant Tracking (ATS)** | Job postings, candidate resume parsing, interview rounds, offer letter generation | **Deferred** | Outside CRM v2 scope; joiners enter at account request stage (`HR-01`). | Explicitly deferred to external ATS / Phase 3. |
| **Employee Benefits & Insurance** | Group medical insurance enrolment, flexi-benefits, claim reimbursement | **Deferred** | Financial transactions handled by corporate finance / external brokers. | Explicitly deferred. |
| **Travel & Expense Claims** | Travel authorizations, boarding passes, per diem calculation, expense receipts | **Deferred** | Handled via CFO invoice/payment workflows or external ERP tools. | Explicitly deferred. |
| **Disciplinary & Grievance Governance** | Internal complaints committee, disciplinary inquiries, formal show-cause notices | **Deferred** | Outside CRM operational core. | Explicitly deferred. |

---

### 8.6 Part E: Approval Route Hierarchy & Explicit Approver Mapping

The multi-tier approval route enforces strict upward escalation and zero self-approval:

```
[Sales Caller (SC)]
       │
       ▼ (Approval Level 1)
[Team Lead (TL)]
       │
       ▼ (Approval Level 2)
[Branch/Area Manager (MG)]
       │
       ▼ (Approval Level 3)
[Regional Manager (RM)]
       │
       ▼ (Approval Level 4)
[National Manager (NM)]
       │
       ▼ (Approval Level 5)
[Chief Executive Officer (CEO)]
```

#### Explicit Approver Configuration Matrix for Governance & Executive Roles
For roles without a standard vertical manager in the frontline hierarchy, approvers must be explicitly configured. Self-approval is strictly prohibited:

| Submitting Employee Role | Primary Configured Approver | Fallback / Escalation Approver | Self-Approval Enforcement |
|---|---|---|---|
| **Sales Caller (SC)** | Assigned `TL` of caller's team | Branch Manager (`MG`) | Blocked (`422 SELF_APPROVAL_FORBIDDEN`) |
| **Team Lead (TL)** | Assigned `MG` of team's branch | Regional Manager (`RM`) | Blocked (`422 SELF_APPROVAL_FORBIDDEN`) |
| **Manager (MG)** | Assigned `RM` of manager's region | National Manager (`NM`) | Blocked (`422 SELF_APPROVAL_FORBIDDEN`) |
| **Regional Manager (RM)**| Assigned `NM` of region's vertical | Chief Executive Officer (`CEO`) | Blocked (`422 SELF_APPROVAL_FORBIDDEN`) |
| **National Manager (NM)**| Chief Executive Officer (`CEO`) | Designated Board Committee | Blocked (`422 SELF_APPROVAL_FORBIDDEN`) |
| **Data Entry (DE)** | Operations Lead / Intake Head | Head of Central Operations | Blocked (`422 SELF_APPROVAL_FORBIDDEN`) |
| **Human Resources (HR)** | Chief Executive Officer (`CEO`) | Chief Financial Officer (`CFO`) | Blocked (`422 SELF_APPROVAL_FORBIDDEN`) |
| **Super Admin (SA)** | Chief Executive Officer (`CEO`) | Chief Financial Officer (`CFO`) | Blocked (`422 SELF_APPROVAL_FORBIDDEN`) |
| **Chief Financial Officer (CFO)**| Chief Executive Officer (`CEO`) | Board Audit Committee Chair | Blocked (`422 SELF_APPROVAL_FORBIDDEN`) |
| **Chief Executive Officer (CEO)**| Board of Directors / Compensation Chair | Lead Independent Director | Blocked (`422 SELF_APPROVAL_FORBIDDEN`) |

---

### 8.7 Part F: Payroll Cycle Specification & Legal/Policy Decisions (`[Deck P320]`)

1. **Non-Overlapping 28th–27th Monthly Pay Period**:
   - Each standard payroll cycle runs from the **28th of Month $M-1$ through the 27th of Month $M$** (inclusive).
   - Examples:
     * Standard Cycle: 28 January to 27 February.
     * Standard Cycle: 28 February to 27 March.
   - **Mid-Cycle Joiner Rule**:
     * An employee joining on **10 January** has an initial pay cycle spanning **10 January to 27 January** (exactly **18 inclusive calendar dates**).
     * **Strict Invariant:** Earned wages for 10–27 January **cannot be held** until the 28 February cycle.
2. **Mandatory Legal & Policy Decisions Requiring Confirmation Before Payroll Finalization (`[Deck P320]` Decisions)**:
   - *Decision 1: First-Payment Deadline for Mid-Cycle Joiners:*
     * Statutory labor and employment compliance mandates clear disbursement timelines for earned wages. Does an employee joining on 10 January receive payment for their 18 days on the immediate standard January payout date (e.g. 31 January / 1 February), or does a minimum cutoff threshold (e.g., 5 business days before cycle end) apply?
     * **Governance Policy:** A written notice to the employee cannot substitute for executive policy confirmation. This rule must be confirmed by client executive authority prior to payroll freeze.
   - *Decision 2: Payable-Day Pro-Rata Divisor Formula:*
     * When computing pro-rata earnings for an incomplete cycle (18 calendar dates), which divisor governs:
       1. **Actual Calendar Days in Month Divisor:** $\text{Gross} \times \frac{18}{31}$
       2. **Fixed 30-Day Financial Divisor:** $\text{Gross} \times \frac{18}{30}$
       3. **Actual Working Days Divisor:** $\text{Gross} \times \frac{\text{Eligible Working Days in 10--27 Jan}}{\text{Total Working Days in Cycle}}$
     * **Governance Policy:** Requires explicit confirmation by Finverse executive leadership and alignment with Indian statutory payroll accounting standards (`[Deck P320]`).

---

### 8.8 Part G: Action-to-Source-to-Code Traceability Matrix

| Action / Capability ID | Deck Page / Source | Scope | API Endpoints | Database Tables | UI Component / Page | Test Verification Suite |
|---|---|---|---|---|---|---|
| **HR-01** | Deck P277–P278 | Joiners | `POST /api/hr/accounts/request` | `hr_lifecycle_requests`, `employees`, `assignments` | `HrJoinersPage.tsx` (`/hr/joiners`) | `hr.api.test.ts` (Check 1) |
| **HR-02** | Deck P279–P280 | Movers (Transfer) | `POST /api/hr/transfers/request`<br>`POST /api/hr/requests/:id/approve`<br>`PATCH /api/hr/requests/:id` | `hr_lifecycle_requests`, `lifecycle_request_approvals` | `HrMoversPage.tsx` (`/hr/movers`) | `hr.api.test.ts` (Check 2) |
| **HR-03** | Deck P281–P282 | Movers (Promotion) | `POST /api/hr/promotions/request` | `hr_lifecycle_requests`, `lifecycle_request_approvals` | `HrMoversPage.tsx` (`/hr/movers`) | `hr.api.test.ts` (Check 3) |
| **HR-04** | Deck P283–P284 | Leavers | `POST /api/hr/exits/coordinate` | `hr_lifecycle_requests`, `employees` | `HrLeaversPage.tsx` (`/hr/leavers`) | `hr.api.test.ts` (Check 4) |
| **HR-05** | Deck P285–P286 | Availability | `GET/POST /api/hr/leaves` | `employee_leaves` | `HrAvailabilityPage.tsx` (`/hr/availability`) | `hr.api.test.ts` (Check 5) |
| **HR-06** | Deck P287–P288 | Training & Reviews | `GET /api/hr/milestones`<br>`POST /api/hr/milestones/update` | `employee_training_milestones` | `HrTrainingPage.tsx` (`/hr/training`) | `hr.api.test.ts` (Check 6) |
| **HR-07** | Deck P289–P290 | People Reports | `POST /api/hr/reports/generate`<br>`GET /api/hr/reports/download/:file` | `people_operations_reports`, `people_report_schedules` | `HrReportsPage.tsx` (`/hr/reports`) | `hr.api.test.ts` (Check 7) |
| **HR-EXT-01** (Slice 1) | Owner Requirement | Universal Leave | `POST /api/leaves/request`<br>`GET /api/leaves/pending-approval`<br>`POST /api/leaves/:id/decide` | `employee_leave_requests`, `leave_balances`, `employee_leaves` | `LeaveRequestDialog.tsx`, `SuperiorApprovalQueue.tsx` | Planned: `hr-leave-approval.api.test.ts` |
| **HR-EXT-02** (Slice 2) | Owner Requirement | WFH & Attendance | `POST /api/attendance/check-in`<br>`POST /api/attendance/check-out`<br>`GET /api/attendance/exceptions` | `attendance_records` | `AttendanceWidget.tsx`, `AttendanceExceptionsDrawer.tsx` | Planned: `hr-attendance-wfh.api.test.ts` |
| **HR-EXT-03** (Slice 3) | Owner Requirement | Rosters & Calendars | `GET /api/hr/workforce-roster`<br>`GET /api/hr/holidays`<br>`GET /api/manager/resource-report` | `holiday_calendars`, `working_days_configurations` | `HrWorkforceRosterPage.tsx`, `ManagerResourceReport.tsx` | Planned: `hr-workforce-roster.api.test.ts` |
| **HR-EXT-04** (Slice 4) | Owner Requirement | Salary & Payroll | `GET/POST /api/hr/salaries`<br>`POST /api/hr/payroll/calculate-preview` | `employee_salary_structures`, `payroll_periods`, `payroll_calculation_line_items` | `HrSalaryStructuresPage.tsx`, `HrPayrollPreviewPage.tsx` | Planned: `hr-payroll-preview.api.test.ts` |

---

### 8.9 Part H: Ordered Implementation Slices & Exact Acceptance Criteria

Feature implementation of the extended HRMS must proceed strictly slice-by-slice:

#### Slice 1: Multi-Tier Leave Request & Superior Approval Engine
- **Objective:** Enable universal leave submission and upward hierarchical approval across all roles and verticals.
- **Database Schema Changes:** Add table `employee_leave_requests` and `leave_balances`.
- **Contracts & API:** Zod schemas for leave submission and decision; API routes `/api/leaves/request`, `/api/leaves/pending-approval`, `/api/leaves/:id/decide`.
- **Exact Acceptance Criteria:**
  1. An employee of any role (`SC`, `TL`, `MG`, `RM`, `NM`, etc.) can submit a leave request with valid start/end dates.
  2. The request routes to the employee's direct hierarchical supervisor.
  3. Attempted self-approval returns `422 SELF_APPROVAL_FORBIDDEN`.
  4. Final supervisor approval automatically inserts an active record into `employee_leaves` and sets `allocation_status: unavailable`.

#### Slice 2: Attendance, Paid Work-From-Home (WFH) & Progress Evidence
- **Objective:** Implement genuine daily attendance and WFH tracking where CRM login alone is not attendance.
- **Database Schema Changes:** Add table `attendance_records` with check-in, check-out, mode, progress evidence, and exception tracking.
- **Contracts & API:** `/api/attendance/check-in`, `/api/attendance/check-out`, `/api/attendance/exceptions`.
- **Exact Acceptance Criteria:**
  1. CRM login does not create an attendance record.
  2. WFH check-out requires progress evidence $\ge 30$ characters; failure to supply blocks check-out.
  3. A day with check-in but no check-out by 23:59 IST automatically flags as an attendance exception (`missing_checkout`).
  4. Supervisor can review and resolve exceptions as payable or unexcused absence (LWP).

#### Slice 3: Holiday Calendars, Working Days & Workforce Visibility Rosters
- **Objective:** Establish holiday calendars, working days computation, and real-time vertical-scoped workforce visibility.
- **Database Schema Changes:** Add `holiday_calendars` and `working_days_configurations`.
- **Contracts & API:** `/api/hr/workforce-roster`, `/api/hr/holidays`, `/api/manager/resource-report`.
- **Exact Acceptance Criteria:**
  1. HR roster displays real-time counts of Office Present, Approved WFH, On Leave, and Absent per vertical.
  2. Working days calculation correctly excludes weekly offs and gazetted holidays.
  3. Manager resource report flags teams with greater than 25% unavailable capacity against active lead backlogs.

#### Slice 4: Effective-Dated Salary Records & Non-Overlapping Payroll Previews (28th–27th)
- **Objective:** Provide structured salary history and automated preview calculations for non-overlapping 28th–27th pay periods.
- **Database Schema Changes:** Add `employee_salary_structures`, `payroll_periods`, `payroll_calculation_line_items`.
- **Contracts & API:** `/api/hr/salaries`, `/api/hr/payroll/calculate-preview`.
- **Exact Acceptance Criteria:**
  1. Salary records support effective intervals; salary changes do not mutate historical payroll lines.
  2. Payroll periods enforce 28th of $M-1$ to 27th of $M$.
  3. A joiner on 10 January generates an initial payroll calculation for exactly 18 inclusive calendar days (10–27 January).
  4. Preview calculates gross earnings, LWP deductions, statutory withholdings, and net payable.
  5. The UI explicitly displays the required confirmation notice regarding first-payment deadline and payable-day formula before final certification.

