# Project status — CHECKPOINT (step 041 - Collaboration Handover)

Last updated: 2026-10-11. This checkpoint supersedes earlier status sections;
contradictions are reconciled against recorded evidence in BUILD_LOG steps
004–041 and COVERAGE_MATRIX.md. No credentials are stored in process docs —
synthetic demo accounts and local connection settings live in the gitignored
`.env` and `database/seed.ts` only.

## Collaboration Handover Checkpoint
- **Handover Document**: Prepared [`docs/process/DHANAN_HANDOVER.md`](file:///c:/Users/gurus/Music/finverse%20wealth/CRM/finverse-crm-v2/docs/process/DHANAN_HANDOVER.md) for collaboration with Dhanan.
- **Revised Execution Strategy**:
  * Prioritize completing UI/UX and working functionality role by role.
  * During development, perform typecheck/build and focused checks of changed workflows, permissions, and persistence.
  * Defer the comprehensive role-by-vertical regression cycle until all role feature development is complete.
  * Existing defects and gaps remain documented; never relabel them as passed.
  * Production readiness and completed CFO acceptance are NOT claimed.

## 1. Current milestone and roadmap status

- **CHIEF FINANCIAL OFFICER WORKSPACE (CFO-01..CFO-19) CHECKPOINT (Step 040-041)**:
  - **Completed Corrections & Hardening**:
    * **1. Independent Preparation & Dual-Control Approval**: Enforced strict segregation of duties between preparer (`EMP-012` Priya Nair) and approver (`EMP-011` Ananya Roy). Connected dual-control preparation and approval endpoints to `CfoRecognitionPage` with dynamic period selection, pending approvals queue, explicit self-approval prevention badge (`Self-Approval Forbidden [Deck P230]`), and optimistic concurrency conflict handling (409).
    * **2. Reconciliation Freshness & Mutation Validation**: Implemented per-vertical watermark validation against `source_watermark` stats (counts, sums, version sums, and timestamps). Rejects stale snapshots when underlying records are modified, reversed, approved, or created post-freeze.
    * **3. Policy Provenance & Production Gating (`0017` Migration)**: Corrected `POL-004` to draft / unconfirmed `is_demo_policy = true` awaiting client confirmation `[Deck P320 Category 3]`. Server enforces that production close certification is blocked if governance policy is demo or unapproved.
    * **4. Evidence-Based Tax Provisioning**: Period close requires actual tax evidence (`tax_amount > 0` or statutory tax provision entries).
  - **Focused Verification Status**:
    * Dedicated CFO API test suite (`apps/api/test/cfo.api.test.ts`): **34/34 passed** (100% green, 0 failed, 0 skipped), covering all 19 deck actions (`CFO-01`..`CFO-19`) and all 13 hardening suites (Hardening 1..13).
    * Monorepo typecheck (`pnpm -r typecheck`): **0 errors** across `@finverse/contracts`, `@finverse/api`, `@finverse/web`.
    * Monorepo production build (`pnpm build`): **0 errors** across all workspace packages.
  - **Remaining CFO Gaps**:
    * Two-user browser journey (Priya prepare $\to$ logout $\to$ Ananya approve) to be executed and recorded in browser.
    * `vertical_lifecycle.api.test.ts` process teardown socket/pool drain fix.
    * Full monorepo cross-role regression cycle deferred to after role feature completion per the revised strategy.


- **CHIEF EXECUTIVE OFFICER WORKSPACE (CEO-01..CEO-11) COMPLETED, TESTED & ACCEPTED (Step 037)**:
  - **Authentic Deck UI & Design Alignment (Deck P203–P224)**:
    - Mastered screens P203–P224 inspected (`docs/reference/screens/P203.jpg`..`P223.jpg`).
    - Implemented authentic Deck layout: Breadcrumbs (`CEO-01 / OPERATING OVERVIEW`..`CEO-11 / COMMITMENTS TRACKER`), Status pulse indicators (`● Ready for review`, `Updated 09:42 IST`), Work Area context cards with 4 metadata pills, Deck Right Rail (`HOW THIS WORKS`, `WHEN A CHECK FAILS`, `PERMISSION & EVIDENCE` with literal deck text), and Deck Bottom Bar (`🛡 Current role and scope checked on submit` + single solid `#113F3D` primary action button).
    - Authentic Twin Cards implemented for:
      * **CEO-07 (Priority Conflicts)**: `PROSPECT & DISPUTE CONTEXT` vs `ARBITRATION RULING & ATTRIBUTION`
      * **CEO-09 (NM Leadership Reviews)**: `NM OPERATIONAL EVIDENCE` vs `LEADERSHIP EVALUATION & COMMITMENTS`
    - Preserved agreed Executive Architecture: Separate executive workspace (`/ceo/*`), multi-vertical overview & focus (Wealth, Banking, Markets, Real Estate) without switching into subordinate employees' role interfaces; truthful labelling of illustrative policies (`[Deck P320 Category 3]`) and integrations.
    - Full responsive support: desktop (1536x800) and mobile (390x844) viewports verified across all 11 routes.
  - **Render-Loop Prevention & Request Stability**:
    - Stabilized `useLoad` with monotonic sequence tracking (`reqIdRef`), unmount protection (`isMountedRef`), and non-destructive background error handling.
    - All 11 subpages wrapped in stable `useCallback` hooks anchored to true external dependencies (`period`, `focusVertical`, etc.).
    - Verified by dedicated Playwright E2E suite `apps/web/e2e/ceo-render-loop.spec.ts`: **6/6 passed** on desktop and mobile:
      * Idle state produces 0 repeated network requests (2.5s+ idle).
      * Drawer toggling and typing produce 0 requests.
      * Filter changes and explicit Refresh buttons trigger exactly 1 request.
      * Simulated 500 error surfaces inline alert without blanking existing data.
      * All 11 CEO routes mount cleanly without render loops or console errors.
  - **Backend Security Hardening & Scope Enforcement (`apps/api/test/ceo.api.test.ts`)**:
    - Dedicated test suite executed against dedicated test database `finverse_test`: **13/13 passed** in 12.7s.
    - **Security Gate**: Non-CEO roles (SC, TL, MG, RM, NM) strictly rejected with 403 Forbidden.
    - **Scope Resolution**: Correctly resolves enterprise executive multi-vertical scope across Wealth, Banking, Markets, Real Estate.
    - **CEO-01**: Consolidated company operating picture, target attainment, enterprise pipeline AUM, risk badges, and executive commitment creation.
    - **CEO-02**: Cross-vertical side-by-side performance benchmarks (Wealth vs Banking vs Markets vs Real Estate) with basis notes.
    - **CEO-03**: National Manager accountability scorecard (`EMP-009` Vikram Malhotra).
    - **CEO-04**: Enterprise target allocation cascading to `national_targets`; over-allocation strictly rejected with 400 Bad Request; unallocated buffer preserved.
    - **CEO-05**: Consolidated enterprise forecast rollup, executive macro adjustments, board commentary, and freeze.
    - **CEO-06**: Strategic growth initiatives register and approval of strategic capital investments.
    - **CEO-07**: Cross-vertical priority conflict arbitration with binding attribution split and directive notes.
    - **CEO-08**: Critical complaints & enterprise operating risk registry and mitigation mandates.
    - **CEO-09**: National Manager structured leadership reviews with rating and commitments.
    - **CEO-10**: Board governance pack binary PDF generation (`pdfkit`), `%PDF` binary header validation, streaming download, and recurring report schedules.
    - **CEO-11**: Executive directives & commitments tracker with status updates and outcome fulfillment notes.
  - **Visual Screenshot Evidence (`evidence/screenshots/`)**:
    - 22 loaded screenshots captured across Desktop (1536x800) and Mobile (390x844) for all 11 actions (`CEO-01`..`CEO-11`), specifically validating `CEO-01`, `CEO-02`, `CEO-04`, `CEO-07`, `CEO-09`, `CEO-10`.
  - **Cryptographic Execution Record & Evidence Integrity**:
    - Execution record saved at `evidence/ceo_test_execution_record.json` with fresh composite fingerprints matching live source files.
    - Regression records refreshed through actual execution: `manager_test_execution_record.json` (14/14 pass), `regional_test_execution_record.json` (12/12 pass), `national_test_execution_record.json` (13/13 pass).
    - Requirements graph (`graphify-requirements/graph.json`) rebuilt with `scripts/build_requirements_graph.py` (1941 nodes, 3904 edges, 144 communities) with all 4 records FRESH and VERIFIED.
    - `scripts/verify_evidence_integrity.py` executed: **0 violations across all 135 actions**.
    - Codebase graph (`graphify-out/graph.json`) refreshed with Graphify code extraction (1844 nodes, 4094 edges, 70 communities).
  - **Automated Verification Suites Passing**:
    - Dedicated CEO API test suite: **13/13 passed**.
    - Full API test suite (`pnpm --filter @finverse/api test`): **48/48 runner tests passed** (125 assertion groups across journey, wealth, tl, manager, regional, national, ceo, vertical_lifecycle; 0 fail, 0 skipped).
    - Monorepo typecheck (`pnpm -r typecheck`): **0 errors** across contracts, api, web.
    - Monorepo build (`pnpm build`): **0 errors** across all packages.

- **WEALTH NATIONAL MANAGER WORKSPACE (NM-01..NM-11) COMPLETED, TESTED & ACCEPTED (Step 036)**:
  - **Authentic Deck UI & Design Alignment (Deck P181–P202)**:
    - Mastered screens P181–P202 extracted (`docs/reference/screens/P181.jpg`..`P201.jpg`).
    - Implemented authentic Deck layout: Breadcrumbs (`NM-01 / VERTICAL OVERVIEW`..`NM-11 / REPORTS & HELP`), Status pulse indicators (`● Ready for review`, `Updated 09:42 IST`), Work Area context cards with 4 metadata pills, Deck Right Rail (`HOW THIS WORKS`, `WHEN A CHECK FAILS`, `PERMISSION & EVIDENCE` with literal deck text), and Deck Bottom Bar (`🛡 Current role and scope checked on submit` + single solid `#113F3D` primary action button).
    - Authentic Twin Cards implemented for:
      * **NM-07 (Transfers)**: `SUBMITTED EVIDENCE` vs `YOUR AUTHORITY`
      * **NM-08 (Referrals)**: `INBOUND REFERRAL PAYLOAD` vs `RECEIVING AUTHORITY & QUEUE`
      * **NM-10 (Reviews)**: `PERFORMANCE EVIDENCE & HISTORY` vs `MEETING RECORD & COMMITMENTS`
    - Full responsive support: tabs wrap cleanly, twin cards stack gracefully on mobile (390px), tables allow horizontal scroll with fixed headers.
  - **Render-Loop Prevention & Request Stability**:
    - Stabilized `useLoad` with monotonic sequence tracking (`reqIdRef`), unmount safety (`isMountedRef`), and non-destructive background error handling.
    - All 11 subpages wrapped in stable `useCallback` hooks anchored to true external dependencies (`period`, `selectedRmId`, etc.).
    - Verified by dedicated Playwright E2E suite `apps/web/e2e/national-render-loop.spec.ts`: **4/4 passed** on desktop and mobile:
      * Idle state produces 0 repeated network requests (2.5s+ idle).
      * Drawer toggling and typing produce 0 requests.
      * Filter changes and explicit Refresh buttons trigger exactly 1 request.
      * Simulated 500 error surfaces inline alert without blanking existing data.
      * All 11 national routes mount cleanly without render loops or console errors.
  - **Backend Security Hardening & Scope Enforcement (`apps/api/test/national.api.test.ts`)**:
    - Dedicated test suite executed against dedicated test database `finverse_test`: **13/13 passed** in 12.3s.
    - **Security Gate**: Non-NM roles (SC, TL, MG, RM) strictly rejected with 403 Forbidden.
    - **Scope Resolution**: Correctly resolves Wealth vertical, South and West divisions, in-scope RMs (`EMP-008`), and active headcounts.
    - **NM-01**: Overview KPIs, division breakdown, create/complete directive actions.
    - **NM-02**: Division comparison benchmarks & RM scorecard (`EMP-008`).
    - **NM-03**: Target allocation cascading to `regional_targets`; over-allocation rejected with 400.
    - **NM-04**: Product and source economics (AUM velocity, CAC, fee bps, capacity gap).
    - **NM-05**: Product & pipeline rule proposals with versioning and validation.
    - **NM-06**: National forecast consolidation & submission to CEO/CFO with macro adjustment.
    - **NM-07**: Cross-region transfers, atomic lead updates, and audit event logging.
    - **NM-08**: Cross-vertical referral acceptance into Wealth intake + task creation, and declined branch.
    - **NM-09**: Dual executive escalations (CEO/CFO/BOTH) and resolution recording.
    - **NM-10**: RM performance review submission with rating and commitments.
    - **NM-11**: Executive report preview, binary PDF pack generation (`pdfkit`), download stream, and report schedules.
  - **Visual Screenshot Evidence (`evidence/screenshots/`)**:
    - 22 loaded screenshots captured across Desktop (1536x800) and Mobile (390x844) for all 11 actions (`NM-01`..`NM-11`), specifically validating `NM-02`, `NM-04`, `NM-05`, `NM-06`, `NM-09`.
  - **Cryptographic Execution Record & Evidence Integrity**:
    - Execution record saved at `evidence/national_test_execution_record.json` with fresh composite fingerprints matching live source files.
    - Requirements graph (`graphify-requirements/graph.json`) rebuilt with `scripts/build_requirements_graph.py` (1929 nodes, 3866 edges, 148 communities).
    - `scripts/verify_evidence_integrity.py` executed: **0 violations across all 135 actions**.
    - Codebase graph (`graphify-out/graph.json`) refreshed with Graphify code extraction (1822 nodes, 4042 edges, 74 communities).
  - **Automated Verification Suites Passing**:
    - Dedicated National Manager API test suite: **13/13 passed**.
    - Full API test suite (`pnpm --filter @finverse/api test`): **47/47 runner tests passed** (112 assertion groups across journey, wealth, tl, manager, regional, national, vertical_lifecycle; 0 fail, 0 skipped).
    - Monorepo typecheck (`pnpm -r typecheck`): **0 errors** across contracts, api, web.
    - Monorepo lint (`pnpm -r lint`): **0 errors, 610 non-blocking warnings** (web: 414, api: 196).
    - Monorepo build (`pnpm build`): **0 errors** across all packages.

- **WEALTH REGIONAL MANAGER WORKSPACE (RM-01..RM-10) COMPLETED, TESTED & ACCEPTED (Step 035)**:
  - **Authentic Deck UI & Design Alignment (Deck P161–P180)**:
    - Extracted authentic Action Deck pages P161–P180 and master screens (`docs/reference/screens/P161.jpg`..`P179.jpg`).
    - Implemented authentic Deck layout: Breadcrumbs (`RM-01 / REGION OVERVIEW`..`RM-10`), Status pulse indicators (`● Ready for review`, `Updated 09:42 IST`), Work Area context banners, Deck twin cards (e.g. `WORK TO ASSIGN` vs `AVAILABLE OWNERS`, `REPORT DEFINITION` vs `SELECTED SCOPE`, `PERFORMANCE EVIDENCE` vs `MEETING RECORD`), and Deck bottom bar (`🛡 Current role and scope checked on submit` + single solid `#113F3D` primary button).
    - Mapped missing `/regional/reviews` module route to dedicated `RegionalReviewsPage` (`apps/web/src/App.tsx`, `apps/web/src/lib/modules.ts`).
  - **Render-Loop Prevention & Request Stability**:
    - Stabilized `useLoad` with monotonic request sequence tracking (`reqIdRef`), unmount protection (`isMountedRef`), and non-destructive background error handling.
    - All 8 Regional subpages wrapped in stable `useCallback` hooks anchored to true external dependencies (`period`, `selectedManagerId`, etc.).
    - Verified by dedicated Playwright E2E suite `apps/web/e2e/regional-render-loop.spec.ts`: idle state produces zero repeated fetches (2.5s+ idle), drawer opening and typing produces zero fetches, filter selection and explicit Refresh buttons trigger exactly 1 request, simulated 500 network failure renders inline alert without blanking existing data, and all 8 regional routes render cleanly on both Desktop and Mobile Chromium (6/6 passed in 16.8s).
  - **Backend Security Hardening & Scope Enforcement (`apps/api/src/repo/regional-manager.ts`)**:
    - **RM-01**: Role-gated overview with regional target attainment, manager rankings, and management intervention actions.
    - **RM-02**: In-scope Manager scorecards (`EMP-007` Neel Verma); out-of-scope managers return 404.
    - **RM-03**: Territory coverage plans with sub-regions, language queues, and activation dates.
    - **RM-04**: Parent regional target allocation to managers with strict non-over-allocation validation (rejects over-allocation with 400).
    - **RM-05**: Cross-manager lead transfers: enforced organizational branch scope (`sourceTeamId` and `destinationTeamId` in scope), lead ownership validation (leads must belong to `sourceTeamId`), atomic `FOR UPDATE` lock, and `ALREADY_DECIDED` guard on duplicate decisions.
    - **RM-06**: Regional staffing envelope with headcount planning and hiring requisitions submitted to HR.
    - **RM-07**: Regional forecast rollup: aggregates accepted manager submissions with regional macro adjustment and freeze to NM.
    - **RM-08**: Regional escalations: handles operational risks and escalated commercial exceptions (`CE-*`) with 404 verification and recovery directives.
    - **RM-09**: Manager performance reviews: enforced manager scope (reviewee must be active MG within assigned regional teams; non-MG rejected with 403).
    - **RM-10**: Audited binary PDF pack generation (`pdfkit`) with `%PDF` header validation and recurring report schedules.
  - **Automated Verification Suites Passing & Reconciled Runner Output**:
    - Dedicated Regional Manager API test suite (`apps/api/test/regional.api.test.ts`): **12/12 passed** in 12.5s against `finverse_test`.
    - Dedicated Manager API test suite (`apps/api/test/manager.api.test.ts`): **14/14 passed** in 13.5s against `finverse_test`.
    - Full API test suite (`pnpm --filter @finverse/api test`): **34/34 runner tests passed** (74 assertion groups across journey, wealth, tl, manager, regional, vertical_lifecycle; 0 fail, 0 skipped).
    - Dedicated Regional E2E suite (`apps/web/e2e/regional-render-loop.spec.ts`): **6/6 passed** (desktop + mobile) in 24.8s.
    - Full Web E2E test suite (`pnpm --filter @finverse/web test:e2e`): **52/52 passed** across desktop and mobile.
    - Monorepo typecheck (`pnpm -r typecheck`): **0 errors** across contracts, api, and web.
    - Monorepo lint (`pnpm -r lint`): **0 errors, 417 warnings** (web: 417 warnings, api: 188 warnings; all non-blocking TypeScript any/unused warnings accurately reported without claiming warning-free checks).
    - Monorepo production build (`pnpm build`): **0 errors**.
    - Visual evidence captured for RM-06 Staffing and RM-08 Escalations in `evidence/screenshots/` (desktop and mobile viewports inspected against Deck P171 and P175, responsive tab wrapping and truthful Regional Manager role scoping confirmed).
    - Migration review: Migrations 0010 and 0012 reverted to pristine state from `93a41bb` (preserving immutable history); baseline reference fixtures isolated in `database/bootstrap-fixtures.ts`; forward migration `0014_ensure_bootstrap_fixtures.sql` provides clean-install and existing-database upgrade paths, both verified using isolated databases without resetting or reseeding business data.
    - Cryptographic execution records persisted at `evidence/manager_test_execution_record.json` and `evidence/regional_test_execution_record.json` with fresh composite fingerprints matching live files.
    - Eliminated inline function recreation in `useLoad`: all subpage loaders (`ManagerOverviewPage`, `ManagerLeadersPage`, `ManagerCapacityPage`, `ManagerTargetsPage`, `ManagerForecastsPage`, `ManagerExceptionsPage`, `ManagerReviewsPage`, `ManagerReportsPage`) now use stable `useCallback` hooks anchored to true external dependencies (`period`, `comparison`, `selectedTlId`, etc.).
    - Implemented monotonic sequence tracking (`reqIdRef`) and unmount safety (`isMountedRef`) in `useLoad` to discard stale/superseded responses and prevent memory leaks.
    - Preserved existing data during background refresh (`initialLoading && !data` skeleton condition); background refresh errors surface inline without blanking data or resetting user form state.
    - Zero `eslint-disable` rules added; StrictMode and React hook dependency rules strictly obeyed.
  - **E2E Browser Regression Suite Added & Passed (`apps/web/e2e/manager-render-loop.spec.ts`)**:
    - Verified idle stability (0 repeated fetches while idle for 2.5s+).
    - Verified drawer toggling and input typing trigger zero network requests.
    - Verified filter changes and explicit Refresh buttons trigger exactly 1 request.
    - Verified failed refresh displays error banner while keeping existing table/card data visible.
    - Verified on both Desktop Chromium and Mobile Chromium (4/4 passed).
  - **Full Monorepo Checks Passing**:
    - Web E2E branding and journey suites: 26/26 passed.
    - API manager test suite: 14/14 passed.
    - Monorepo typecheck, lint, and build: 0 errors.
    - Evidence integrity verified and Graphify knowledge graphs updated.
- **WEALTH MANAGER CHECKPOINT CLOSED & MG-09 AUTHORIZATION DEFECT REMEDIATED (Step 033)**:
  - **Server-Side Authority Derivation (MG-09 Remediated)**:
    - Fixed vulnerability where client-supplied `delegatedLimitMet` was trusted. `packages/contracts/src/manager.ts` updated to make `delegatedLimitMet` optional and deprecated. The server never consults client input to grant authority.
    - Server independently derives approval authority via `resolveCommercialApprovalAuthority`: verifies authenticated Manager role, active Delegation of Authority (DoA) policy (`DOA-2026-V1` in `finance_policies`), exception type eligibility (rejects `custom-terms` which require RM/Legal per Deck P152), and database record pre-qualification (`delegated_limit_met`).
    - Enforced deck rule: **Unset authority means approval denied**. If DoA policy or limit is missing/unset, approval is denied (403 Forbidden). Illustrative policies remain explicitly labeled `[Deck P320 Category 3: Approvals and limits]`.
  - **Scope Enforcement Before Reading or Deciding (MG-09 Remediated)**:
    - Enforced scope on `listCommercialExceptions`, `getCommercialException`, and `decideCommercialException`: joining `leads` and requester `assignments` to verify `team_id` is within `scope.teams` and vertical matches `scope.verticals`.
    - Cross-team / cross-vertical exceptions cannot be read or changed (403 Forbidden).
  - **Atomic State Transition (MG-09 Remediated)**:
    - Wrapped `decideCommercialException` in a database transaction with `FOR UPDATE OF c` row-level lock.
    - Transition is strictly conditional on `status = 'pending'`. Concurrent/repeated requests cannot overwrite finalized records; race conditions serialize safely with exactly one winning decision and the other rejected with 400 Bad Request.
  - **Targeted Test Execution Verified**:
    - `apps/api/test/manager.api.test.ts` updated with targeted tests proving:
      * Sending `delegatedLimitMet: true` cannot override insufficient authority (403 Forbidden).
      * Omitting `delegatedLimitMet` cannot grant authority (403 Forbidden).
      * Foreign team's exception cannot be read or changed (403 Forbidden).
      * Valid configured approval and permitted escalation to RM both succeed (200 OK).
      * Repeated and concurrent decisions cannot overwrite finalized state (atomic 400 Bad Request rejection).
    - Runner Metrics: **14 tests, 14 pass, 0 fail, 0 skipped, duration 12,676ms** against isolated test database `finverse_test`.
  - **Evidence Freshness & Knowledge Graphs Refreshed**:
    - Execution record regenerated at `evidence/manager_test_execution_record.json` with fresh composite fingerprints.
    - Requirements graph rebuilt and verified (135 actions, 0 ungrounded claims).
    - Code graph incrementally refreshed with Graphify (1753 nodes, 3895 edges).
  - **Dhanan Operations & Developer Handoff Maintained**:
    - Section 9 in `docs/process/PRODUCTION_HANDOVER.md` intact for feature branch collaboration within the same CRM. Clean `.env.example` verified.

## 2. Checks actually executed vs remaining verification reality

**Truthful Verification Evidence Taxonomy (Audited across 135 Actions):**
- **Breakdown**:
  - `CURRENT_REVISION_VERIFIED`: 64 actions (`MG-01..13`, `RM-01..10`, `NM-01..11`, `CEO-01..11`, and `CFO-01..19` with dedicated API test suites `manager.api.test.ts`, `regional.api.test.ts`, `national.api.test.ts`, `ceo.api.test.ts`, `cfo.api.test.ts`, verified execution records, request-stability E2E suites, and browser visual proof).
  - `HISTORICAL_PASS_UNVERIFIED_IN_CURRENT_REVISION`: 46 actions (`SC-01..28` and `TL-01..18`, which have dedicated suites with historically reported passes).
  - `UNIMPLEMENTED_PLANNED`: 25 actions (`DE-01..07`, `HR-01..07`, `SA-01..11`).

## 3. Active processes, preview, workers

- **Preview: http://localhost:5173** (Vite dev server running).
- **Backend API: http://localhost:4000** (Express server running).
- **PostgreSQL Database**: Running on port 5433 with persistent storage and connection forwarding (`scripts/pg-proxy.js`).
- **Exact Next Task**: Super Admin (`SA-01..SA-11`) & Foundation Workspaces (`DE-01..DE-07`, `HR-01..HR-07`). CFO workspace is complete, tested, and accepted.
