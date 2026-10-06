# Project status — CHECKPOINT (step 033)

Last updated: 2026-10-07. This checkpoint supersedes earlier status sections;
contradictions are reconciled against recorded evidence in BUILD_LOG steps
004–033 and COVERAGE_MATRIX.md. No credentials are stored in process docs —
synthetic demo accounts and local connection settings live in the gitignored
`.env` and `database/seed.ts` only.

## 1. Current milestone and roadmap status

- **WEALTH MANAGER CHECKPOINT CLOSED & MG-09 AUTHORIZATION DEFECT REMEDIATED**:
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
  - `CURRENT_REVISION_VERIFIED`: 13 actions (`MG-01` through `MG-13` with dedicated test suite `apps/api/test/manager.api.test.ts`, verified execution record, and browser visual proof).
  - `HISTORICAL_PASS_UNVERIFIED_IN_CURRENT_REVISION`: 46 actions (`SC-01..28` and `TL-01..18`, which have dedicated suites with historically reported passes).
  - `HISTORICAL_LIFECYCLE_PASS_UNVERIFIED_IN_CURRENT_REVISION`: 18 actions (the specific RM, NM, CEO, CFO actions exercised in lifecycle tests).
  - `IMPLEMENTED_UNVERIFIED_BY_TESTS`: 33 actions (remaining implemented actions in RM, NM, CEO, CFO).
  - `UNIMPLEMENTED_PLANNED`: 25 actions (`DE-01..07`, `HR-01..07`, `SA-01..11`).

## 3. Active processes, preview, workers

- **Preview: http://localhost:5173** (Vite dev server running).
- **Backend API: http://localhost:4000** (Express server running).
- **PostgreSQL Database**: Container `fvc2-postgres` running healthy on port 5433 with persistent volume `fvc2-pgdata`.
- **Exact Next Task**: Wealth Regional Manager (`RM-01`..`RM-10`) — audit actions against physical deck pages, verify/add test assertions, inspect browser views, and verify evidence. Feature development pauses here for handoff review.
