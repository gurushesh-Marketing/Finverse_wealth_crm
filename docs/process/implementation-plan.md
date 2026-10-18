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
| **HR** | Human Resources | 7 | Complete | `hr.api.test.ts` (8/8) | Horizontal workspace complete. |
| **DE** | Data Entry | 7 | Complete | `data-entry.api.test.ts` (8/8) | Horizontal workspace complete. |
