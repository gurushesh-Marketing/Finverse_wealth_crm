# Master Implementation & Resumption Plan — Finverse CRM v2

**Document Status:** Canonical Implementation Roadmap & Verification Protocol  
**Version:** 2.2.0  
**Effective Date:** 2026-10-06  
**Current Baseline:** Checkpoint Step 031 (Wealth Manager MG-01..MG-13 Complete & Verified; Production Delivery Roadmap Established)  
**Reference Action Deck:** `docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf` (Pages P318–P320)  
**Process Documents:** `docs/process/STATUS.md`, `docs/process/BUILD_LOG.md`, `docs/process/COVERAGE_MATRIX.md`  

---

## 1. Project Phase Architecture & Production Delivery Roadmap

Finverse CRM v2 follows a strict sequential production delivery order:
`Wealth Vertical (Caller → TL → Manager → RM → NM → CEO → CFO) → Superadmin → HR → Data Entry → Integrated Operational Verification → Deployment Handover → Later Vertical Releases`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   FINVERSE CRM v2 PRODUCTION DELIVERY ROADMAP               │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ 1. Wealth Vertical Completion │ Caller (SC) → TL → Manager (MG) → RM → NM   │
│ [IN PROGRESS: MG COMPLETE]    │ → CEO → CFO. Complete one role, test all    │
│                               │ actions, fix failures, inspect design.      │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 2. Superadmin Horizontal      │ SA-01..SA-11: Provisioning, scoped grants,  │
│ [PLANNED]                     │ hierarchy, transfers/promotions, recovery,  │
│                               │ jobs, incidents, expiring access.           │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 3. Human Resources Horizontal │ HR-01..HR-07: Account requests, effective-  │
│ [PLANNED]                     │ dated moves, exits, leave, availability,    │
│                               │ probation, people reports. Historical trail.│
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 4. Data Entry Horizontal      │ DE-01..DE-07: Intake/import, mapping,       │
│ [PLANNED]                     │ correction, duplicate review, publication   │
│                               │ (DE-05 → TL-02), provenance, zero duplicates│
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 5. First Production Release   │ Integrated daily workflow, negative tests,  │
│    Gate & Dhanan Handover     │ isolated data, operations runbook, demo     │
│ [PLANNED]                     │ disablement, backup & recovery plan.        │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ 6. Later Vertical Releases    │ Banking, Markets, Real Estate added to SAME │
│ [PLANNED POST-V1]             │ deployed CRM without database wipe/reset.   │
└───────────────────────────────┴─────────────────────────────────────────────┘
```

### 1.1 Detailed Role Status Scorecard

| Role Code | Role Title | Total Actions | Code Status | Test Verification Evidence | Documented Gaps / Pending Items |
|---|---|---|---|---|---|
| **SC** | Sales Caller | 28 | Complete | Dedicated Suite (`apps/api/test/wealth.api.test.ts`) | Production telephony & WhatsApp BSP live integration pending client vendor selection `[Deck P320]`. |
| **TL** | Team Lead | 18 | Complete | Dedicated Suite (`apps/api/test/tl.api.test.ts`) | Frontline review findings verified clean in test suite. |
| **MG** | Manager | 13 | Complete | **CURRENT REVISION VERIFIED (13/13)** (`apps/api/test/manager.api.test.ts`) | Visual and functional verification complete in browser (Neel Verma, `EMP-007`). Zero open bugs. |
| **RM** | Regional Manager | 10 | Complete | Partially Verified (3/10 actions in `vertical_lifecycle.api.test.ts`: RM-01, RM-04, RM-10) | RM-02, RM-03, RM-05..RM-09 unverified by dedicated test assertions; next role in delivery order. |
| **NM** | National Manager | 11 | Complete | Partially Verified (3/11 actions in `vertical_lifecycle.api.test.ts`: NM-01, NM-03, NM-11) | NM-02, NM-04..NM-10 unverified by dedicated test assertions; live cross-vertical referral routing simulated. |
| **CEO** | Chief Executive Officer | 11 | Complete | Partially Verified (4/11 actions in `vertical_lifecycle.api.test.ts`: CEO-01, CEO-02, CEO-04, CEO-10) | CEO-03, CEO-05..CEO-09, CEO-11 unverified by dedicated test assertions; comparative weighting requires client confirmation `[Deck P320]`. |
| **CFO** | Chief Financial Officer | 19 | Complete | Partially Verified (8/19 actions in `vertical_lifecycle.api.test.ts`: CFO-01, CFO-02, CFO-03, CFO-08, CFO-12, CFO-13, CFO-14, CFO-18) | Remaining 11 actions unverified by dedicated test assertions; bank MT940 / CAMT.053 parser pending client format specification. |
| **DE** | Data Entry | 7 | Planned (Unbuilt) | Unverified (0 tests) | Pending implementation in Milestone 4. Full routing chain: DE-05 → TL-02. |
| **HR** | Human Resources | 7 | Planned (Unbuilt) | Unverified (0 tests) | Pending implementation in Milestone 3. |
| **SA** | Super Administrator | 11 | Planned (Unbuilt) | Unverified (0 tests) | Pending implementation in Milestone 2. |

---

## 2. Multi-Level Testing & Acceptance Protocol

In compliance with Action Deck Page 318 (`Acceptance Scenarios`), every workflow must satisfy four levels of verification before production readiness:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Typecheck & Contract Linting (TypeScript / Zod 0 Errors) │
├─────────────────────────────────────────────────────────────┤
│ 2. Scoped API Integration Suites (Supertest / Fastify Mock) │
├─────────────────────────────────────────────────────────────┤
│ 3. Continuous Multi-Role Vertical Lifecycle Suite           │
├─────────────────────────────────────────────────────────────┤
│ 4. Playwright Browser E2E & Mobile Viewport Suites          │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 The Twelve Canonical Deck Acceptance Scenarios (`[Deck P318]`)

1. **Wrong-Role URL:** Attempting direct browser navigation or API call to `/cfo/*` as a Sales Caller (`SC`) yields immediate `403 FORBIDDEN` and redirects to `/wealth/my-day`. *(Verified in `vertical_lifecycle.api.test.ts`)*.
2. **Other-Caller Lead ID:** Requesting `GET /api/wealth/prospects/FV-OTHER` owned by another advisor in the same team returns `404 NOT_FOUND` or masked details; zero confidential customer data is exposed. *(Verified in `wealth.api.test.ts`)*.
3. **Other-Vertical Search:** Searching for a prospect across vertical boundaries returns zero results unless an accepted cross-vertical referral token exists. *(Partially verified; cross-vertical boundary enforced in lifecycle auth stage)*.
4. **Removed Team Grant:** When an assignment `valid_to` / `effective_to` timestamp is exceeded, active sessions fail subsequent operations with `403 FORBIDDEN`.
5. **Promotion in an Open Session:** A mid-session promotion from Caller to TL maintains Caller privileges until session refresh, preventing unauthorized mid-flight privilege escalation.
6. **Exit with Pending PDF:** An employee marked terminated in HR immediately revokes access; pending scheduled PDF exports are aborted and sanitized. *(Planned in Phase 5 HR/SA)*.
7. **Replacement Employee:** A newly provisioned advisor receives a distinct identity and zero inherited historical win rate or unearned credit.
8. **Repeated Webhook / Idempotency:** Submitting duplicate payment match or conversion approval payloads returns the initial idempotent commit without creating duplicate ledger records.
9. **Concurrent Assignment:** Two team leads attempting simultaneous allocation of the same unassigned lead results in one successful claim and one clean `409 Conflict`.
10. **Duplicate Intake Import:** Uploading a batch containing existing phone numbers flags matching rows as duplicates (`DE-04`) and halts auto-publication. *(Planned in Phase 5 DE)*.
11. **Refund After Fiscal Close:** Attempting a refund or credit note on a closed and certified period (`CFO-14`) requires formal CFO period unlocking (`CFO-15`).
12. **Midnight / Quarter Boundaries:** Schedulers running at 00:15 IST correctly partition records into the prior completed period without including post-midnight events.

---

## 3. Visual & Design Conformance Status

Visual acceptance requires verifying computed styles in the browser, not merely rendering code or referencing static source images:

### 3.1 Design Token Foundation (Verified in Code)
- [x] **Brand Color Conformance:** Primary Spruce `#113F3D` computed on primary headers and buttons; Deep Teal `#155451` on hover; Mint Accent `#6FA8A2` on active indicators (configured in `apps/web/src/index.css`).
- [x] **Single Solid Primary Button Rule:** Standardized across UI primitives. Exactly ONE solid `#113F3D` button per viewport.
- [x] **Authentic Logo Rendering:** `finverse-logo.png` rendered with native proportions (1:1.22); zero recoloring or distortion.
- [x] **Typography Configuration:** Headings configured as Manrope; body text as Inter; numbers and financial amounts rendered in JetBrains Mono.

### 3.2 Workspace Visual Inspection Status (Role-by-Role Reality)
- **Frontline Caller (`SC`):** Visually inspected on desktop and mobile viewports (Playwright `branding.spec.ts` & `journey.spec.ts`).
- **Team Lead (`TL`):** Visually inspected on desktop and mobile viewports (Playwright `branding.spec.ts`).
- **Manager (`MG`):** **Visually inspected and verified in live browser** (Neel Verma `EMP-007` via browser agent: `manager_reports_pack_1791296401065.png`, recording `manager_visual_proof_1791295525291.webp`).
- **Regional Manager (`RM`):** Component views implemented in `apps/web/src/pages/RegionalManagerPages.tsx`. Visual design inspection pending; next in delivery order.
- **National Manager (`NM`):** Component views implemented in `apps/web/src/pages/NationalManagerPages.tsx`. Visual design inspection pending.
- **Chief Executive Officer (`CEO`):** Component views implemented in `apps/web/src/pages/CeoPages.tsx`. Visual design inspection pending.
- **Chief Financial Officer (`CFO`):** Component views implemented in `apps/web/src/pages/CfoPages.tsx`. Visual design inspection pending.
- **Data Entry (`DE`), HR, Super Admin (`SA`):** Workspaces not yet rendered (unimplemented in Milestones 2, 3, 4).

---

## 4. Wealth Manager (MG-01..MG-13) Completion & Audit Evidence

All 13 Manager actions (`MG-01` to `MG-13`) are fully implemented and verified with genuine test and visual evidence on current revision:
- Dedicated API test suite: `apps/api/test/manager.api.test.ts` (13/13 actions pass).
- Visual and interaction proof: Recorded browser inspection session (`manager_visual_proof_1791295525291.webp`).

### 4.1 Verified Manager Action Checklist

| Item | Action Code | Verification Evidence & Checklist | Exact Implementation Component & Handler | Status |
|---|---|---|---|---|
| **MG-01** | `MG-01` | **TL Hierarchy & Interventions:** Period selector recalculates target pace, backlog ageing, and sample size warnings. "Assign Action" drawer writes to `management_actions` with 48h deadline. | `ManagerOverviewPage` in `ManagerPages.tsx`<br/>Handler: `handleCreateAction`<br/>Routes: `GET /api/manager/overview`, `POST /api/manager/actions` | **VERIFIED** |
| **MG-02** | `MG-02` | **TL Operating Scorecards:** TL roster selector filters strictly to supervised team leaders within manager scope. Operating metrics join `assignments`, `leads`, and `reviews`. | `ManagerLeadersPage` in `ManagerPages.tsx`<br/>Handler: `managerApi.tlScorecard(tlId)`<br/>Route: `GET /api/manager/scorecard/:tlId` | **VERIFIED** |
| **MG-03** | `MG-03` | **Cross-Team Lead Transfers:** Source and destination teams are both within Manager scope. Atomic reassignment of `leads.team_id` and recording of `lead_events`. | `ManagerCapacityPage` in `ManagerPages.tsx`<br/>Handlers: `handleCreateTransfer`, `handleDecideTransfer`<br/>Routes: `GET /api/manager/transfers`, `POST /api/manager/transfers` | **VERIFIED** |
| **MG-04** | `MG-04` | **Capacity Recovery Plan:** Capacity utilization calculation. Breach badge triggers when utilization exceeds threshold. Recovery plan status advances from `draft` to `approved`. | `ManagerCapacityPage` in `ManagerPages.tsx`<br/>Handler: `handleSavePlan`<br/>Routes: `GET /api/manager/capacity`, `POST /api/manager/capacity/plan` | **VERIFIED** |
| **MG-05** | `MG-05` | **Target Allocation Remainder:** Approved parent target card displays visible unallocated remainder. Non-silent distribution warning prevents incomplete publishing without acknowledgment. | `ManagerTargetsPage` in `ManagerPages.tsx`<br/>Handler: `handleSave`<br/>Routes: `GET /api/manager/targets`, `POST /api/manager/targets/allocate` | **VERIFIED** |
| **MG-06** | `MG-06` | **Forecast Challenge & Return:** Submitted TL forecasts display commit, best-case, and pipeline categories. Manager can Accept or Return with mandatory correction feedback notes. | `ManagerForecastsPage` in `ManagerPages.tsx`<br/>Handler: `handleDecide`<br/>Routes: `GET /api/manager/forecasts`, `POST /api/manager/forecasts/decide` | **VERIFIED** |
| **MG-07** | `MG-07` | **Forecast Rollup to RM:** Bottom-up sum aggregates accepted TL forecasts only. Management adjustment requires documented justification before freezing submission to RM. | `ManagerForecastsPage` in `ManagerPages.tsx`<br/>Handler: `handleSubmitRm`<br/>Route: `POST /api/manager/forecasts/submit` | **VERIFIED** |
| **MG-08** | `MG-08` | **SLA Breach Adjudication:** Repeated SLA breach resolution supports 4 pathways (Corrective action 48h, Capacity change, Coaching, Escalate to RM). | `ManagerExceptionsPage` in `ManagerPages.tsx`<br/>Handler: `handleResolveSla`<br/>Routes: `GET /api/manager/exceptions`, `POST /api/manager/sla-breaches/resolve` | **VERIFIED** |
| **MG-09** | `MG-09` | **Commercial Exceptions:** Delegated financial authority limit check. If requested discount/terms exceed Manager threshold, force escalation to RM. | `ManagerExceptionsPage` in `ManagerPages.tsx`<br/>Handler: `handleDecideException`<br/>Route: `POST /api/manager/commercial-exceptions/decide` | **VERIFIED** |
| **MG-10** | `MG-10` | **Source Quality Breakdown:** Cohort analysis separates invalid intake rows from failed contact attempts and commercial losses. Remediation types (`routing-change`, `pause-source`). | `ManagerLeadersPage` in `ManagerPages.tsx`<br/>Handler: `handleRemediate`<br/>Routes: `GET /api/manager/source-quality`, `POST /api/manager/source-quality/remediation` | **VERIFIED** |
| **MG-11** | `MG-11` | **Formal TL Review:** Review form persists structured commitments array (`dimension`, `goal`, `target_date`) and mutual acknowledgment flag in `reviews` table. | `ManagerReviewsPage` in `ManagerPages.tsx`<br/>Handler: `handleCreateReview`<br/>Routes: `GET /api/manager/reviews`, `POST /api/manager/reviews` | **VERIFIED** |
| **MG-12** | `MG-12` | **Lifecycle Requisitions:** Promotion and transfer requests capture proposed role, proposed team, effective date, and workload handoff plan before routing to HR. | `ManagerCapacityPage` in `ManagerPages.tsx`<br/>Handler: `handleCreateLifecycle`<br/>Route: `POST /api/manager/lifecycle` | **VERIFIED** |
| **MG-13** | `MG-13` | **Meeting Pack PDF & Schedules:** Binary PDF export generates readable PDF with executive summary and TL appendix. Recurring schedule builder registers Weekly Mon 09:00 IST schedule. | `ManagerReportsPage` in `ManagerPages.tsx`<br/>Handlers: `handleExportPdf`, `handleCreateSchedule`<br/>Routes: `POST /api/manager/meeting-pack/export`, `POST /api/manager/schedules` | **VERIFIED** |

---

## 5. Next Operational Delivery Step

Per the approved Production Delivery Roadmap (`Wealth Vertical: Caller → TL → Manager → RM → NM → CEO → CFO`):

1. **Exact Next Task:** Complete and verify **Regional Manager (`RM-01` to `RM-10`)**:
   - Inspect existing implementation in `apps/web/src/pages/RegionalManagerPages.tsx` and `apps/api/src/routes/regional-manager.ts`.
   - Implement dedicated test suite `apps/api/test/regional.api.test.ts` covering all 10 RM actions.
   - Fix any functional failures, verify territory polygon/capacity calculations, and inspect visual design in browser.
   - Update knowledge graph and process records with RM evidence before proceeding to National Manager (`NM`).
2. **Subsequent Wealth Steps:** National Manager (`NM-01..11`) → CEO (`CEO-01..11`) → CFO (`CFO-01..19`).
3. **Subsequent Releases:** Superadmin (`SA-01..11`) → HR (`HR-01..07`) → Data Entry (`DE-01..07`) → Release Gate Handover for Dhanan.

