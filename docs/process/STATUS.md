# Project status — CHECKPOINT (step 032)

Last updated: 2026-10-06. This checkpoint supersedes earlier status sections;
contradictions are reconciled against recorded evidence in BUILD_LOG steps
004–032 and COVERAGE_MATRIX.md. No credentials are stored in process docs —
synthetic demo accounts and local connection settings live in the gitignored
`.env` and `database/seed.ts` only.

## 1. Current milestone and roadmap status

- **WEALTH MANAGER CHECKPOINT CLOSED & PUBLISHED (MG-01…MG-13 Fully Verified)**:
  - **Discrete Test Runner Counts Corrected**: Refactored `apps/api/test/manager.api.test.ts` from a monolithic block into **14 discrete, top-level node:test cases** (1 role authorization gate + 13 action cases `MG-01` through `MG-13`).
  - **Actual Test Runner Execution Results**:
    - Command: `node --import tsx --test apps/api/test/manager.api.test.ts` against dedicated test database (`finverse_test`).
    - Runner Metrics: **14 tests, 14 pass, 0 fail, 0 skipped, duration 17,250ms**.
    - Exit code: `0`. Demo database (`finverse_crm`) and dev preview kept completely intact and preserved.
  - **Evidence Freshness Repaired with Cryptographic Composite Fingerprints**:
    - Discontinued hardcoded `PASS` generation. Built and executed `scripts/record_test_execution.py` to record real runtime results to `evidence/manager_test_execution_record.json`.
    - Captures command, exit code, timestamp, runner metrics, and recursive SHA-256 tree hashes across:
      * Application API source (`apps/api/src/`)
      * Application Web source (`apps/web/src/`)
      * Database Migrations (`database/migrations/`)
      * Shared Contracts (`packages/contracts/src/`)
      * Test Suite (`apps/api/test/manager.api.test.ts`)
    - `scripts/build_requirements_graph.py` and `scripts/verify_evidence_integrity.py` dynamically consume this record and mark evidence **STALE** if any application source or migration file diverges from the recorded hashes.
  - **Specific MG-09 Acceptance Gap Closed**:
    - Evaluated against Action Deck P151–P152 requirements: "Finance or policy exceptions go to the relevant owner; Manager title does not authorise them automatically."
    - Enforced server-side delegated authority validation in `apps/api/src/repo/manager.ts`:
      * Requests exceeding Manager delegated authority are strictly rejected with `403 FORBIDDEN` (`Unauthorized decision: Requested commercial exception exceeds Manager delegated authority limit [Deck P320 Category 3]`).
      * Terminal re-decisions are rejected with `400 BAD REQUEST`.
      * Permitted within-limit approvals and escalations to Regional Manager (`RM-08`) operate normally.
      * Unresolved authority thresholds labeled explicitly as illustrative configuration under client decision category 3 (`[Deck P320 Category 3]`).
    - UI in `apps/web/src/pages/ManagerPages.tsx` updated with illustrative delegated limit banner, breach warning badge, and disabled "Approve (Within Limit)" action when limits are breached.
  - **Visual Acceptance Across All 7 Manager Routes**:
    - Inspected and aligned all 7 routes against Action Deck P135–P160 and brand guidelines: Overview (`MG-01`), Leaders (`MG-02`, `MG-10`), Capacity (`MG-03`, `MG-04`, `MG-12`), Targets (`MG-05`), Forecasts (`MG-06`, `MG-07`), Exceptions (`MG-08`, `MG-09`), Reports (`MG-13`).
    - Verified single solid primary button hierarchy, `#113F3D` brand tokens, Manrope/Inter typography, form validation, error states, and responsive drawer ergonomics.
  - **Dhanan Operations & Developer Handoff Published**:
    - Section 9 established in `docs/process/PRODUCTION_HANDOVER.md` for Dhanan's feature-branch collaboration within the SAME CRM.
    - Verified clean `.env.example` with zero secrets and instructions for ports, test DB, and migrations.

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
