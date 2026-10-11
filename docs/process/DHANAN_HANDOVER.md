# Finverse CRM v2 — Engineering Handover to Dhanan

**Date:** 2026-10-11
**Repository:** `https://github.com/gurushesh-Marketing/Finverse_wealth_crm.git`
**Branch:** `rebuild/react-vite-postgres`
**Checkpoint Context:** UI/UX and working functionality checkpoint for collaboration.

---

## 1. Project Overview & Actual Stack

Finverse CRM v2 is a single multi-vertical application serving Wealth, Banking, Markets/Trading, and Real Estate under a unified login and domain. The server resolves each employee's role, vertical, and permissions to open the authorized workspace. Authorization is enforced on every read and mutation.

### Technology Stack
- **Monorepo Structure:** `pnpm` workspace containing:
  - `apps/web`: React 18, Vite, Tailwind CSS v4, Lucide React, custom Finverse Design System tokens.
  - `apps/api`: Express, TypeScript, Zod validation, `pg` (PostgreSQL client pool), `pdfkit` (binary streaming PDF packs).
  - `packages/contracts`: Shared `@finverse/contracts` package containing Zod schemas and inferred TypeScript types.
  - `database/migrations`: Numbered SQL migrations (`0001` through `0017`).
- **Database:** PostgreSQL 16 Alpine on port `5433` (development: `finverse_crm`, test: `finverse_test`).
- **Knowledge Graphs:** Python Graphify runtime (`.venv-graphify/`) maintaining:
  - Requirements & Action Deck Graph: `graphify-requirements/graph.json`
  - Codebase Symbol Graph: `graphify-out/graph.json`

---

## 2. Implemented Roles & Current Status

| Workspace / Role | Deck Pages | Implementation Status | Test & Verification Status |
|---|---|---|---|
| **Frontline Caller (SC)** | P044–P099 (`SC-01`..`SC-28`) | Complete UI & Backend | `test/wealth.api.test.ts` (26/26 passed) |
| **Team Lead (TL)** | P100–P134 (`TL-01`..`TL-18`) | Complete UI & Backend | `test/tl.api.test.ts` (5/5 suites passed) |
| **Wealth Manager (MG)** | P135–P160 (`MG-01`..`MG-13`) | Complete UI & Backend | `test/manager.api.test.ts` (14/14 passed) |
| **Regional Manager (RM)** | P161–P180 (`RM-01`..`RM-10`) | Complete UI & Backend | `test/regional.api.test.ts` (12/12 passed) |
| **National Manager (NM)** | P181–P202 (`NM-01`..`NM-11`) | Complete UI & Backend | `test/national.api.test.ts` (13/13 passed) |
| **Chief Executive Officer (CEO)** | P203–P224 (`CEO-01`..`CEO-11`) | Complete UI & Backend | `test/ceo.api.test.ts` (13/13 passed) |
| **Chief Financial Officer (CFO)** | P225–P262 (`CFO-01`..`CFO-19`) | UI Dual Control connected, Backend hardened | `test/cfo.api.test.ts` (34/34 passed) |
| **Super Admin (SA)** | P263–P312 | Planned / Not Started | Pending role-by-role execution |

---

## 3. CFO Acceptance Gaps & Test Status

### Completed Corrections in this Milestone:
1. **Frontend Preparation & Independent Approval Integration:**
   - `CfoRecognitionPage` in `apps/web/src/pages/CfoPages.tsx` connected to dual-control preparation (`/ledger/recognition/prepare`, `/ledger/credit-note/prepare`) and independent approval (`/ledger/recognition/:id/approve`, `/ledger/credit-note/:id/approve`).
   - Dynamic period loading (removed hardcoded `'PER-2026-Q1'`).
   - Pending Approvals Queue displays entry code, type, period, preparer identity, evidence, amounts, policy code, and record version.
   - Self-approval prevention is enforced in UI: preparers receive a disabled `Self-Approval Forbidden [Deck P230]` badge; independent approvers see the active approval trigger.
   - OCC (Optimistic Concurrency Control) conflict handling (409) implemented with user-facing alerts and automatic reload.
2. **Policy Provenance & Production Gating (`0017` Migration):**
   - Corrected `POL-004` to `draft` / `is_demo_policy = true` with unconfirmed status awaiting client confirmation `[Deck P320 Category 3]`.
   - Server-enforced production gating: `x-governance-mode: production` or `NODE_ENV === 'production'` blocks period close certification if close governance policy is unapproved or demo.
3. **Reconciliation Freshness & Mutation Validation:**
   - Per-vertical watermark validation against `source_watermark` stats (counts, sums, version sums, and timestamps). Detects updates to existing records, reversals, approvals, and new entries.
4. **Evidence-Based Tax Provisioning:**
   - Certification strictly checks for actual tax provision evidence (`tax_amount > 0` or `tax_provision` entry).

### Remaining CFO Gaps & Testing Status:
- **CFO Dedicated Test Suite (`apps/api/test/cfo.api.test.ts`):** 34/34 tests pass cleanly.
- **Two-User Browser Journey:** The end-to-end browser journey (Priya prepare $\to$ logout $\to$ Ananya approve $\to$ verify ledger and credit note) is wired in the UI components, but has not yet been executed as a recorded Playwright browser session.
- **Cross-Role Vertical Lifecycle Suite (`test/vertical_lifecycle.api.test.ts`):** In the full test run, `vertical_lifecycle.api.test.ts` executed all 8 sections successfully, but hung during process teardown due to open HTTP keep-alive connections and database pool sockets. The teardown requires `server.closeAllConnections()` and clean pool closure before running in a full regression harness.
- **Revised Testing Strategy:** As approved, we prioritize completing UI/UX and working functionality role by role. Comprehensive cross-role regressions are deferred until all role feature development is complete. Do not claim full CFO acceptance or production readiness yet.

---

## 4. Local Setup & Launch Commands

### Prerequisites
- Node.js 18+ (tested on Node v20/v22)
- pnpm 9+
- PostgreSQL 16 Alpine running on port `5433`

### Environment Configuration
1. Copy `.env.example` to `.env` in the project root:
   ```bash
   cp .env.example .env
   ```
2. Configure the required environment variables:
   - `PORT=4000`
   - `NODE_ENV=development`
   - `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/finverse_crm`
   - `TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/finverse_test`
   - `SESSION_SECRET=<any-random-string-for-dev>`
   - `CORS_ORIGIN=http://localhost:5173`
   - `VITE_API_URL=http://localhost:4000`

### Build & Run
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Build contracts package:
   ```bash
   pnpm --filter @finverse/contracts build
   ```
3. Run database migrations:
   ```bash
   pnpm --filter @finverse/api exec tsx ../../database/migrate.ts
   ```
4. Seed synthetic demo fixtures (if setting up fresh database):
   ```bash
   pnpm --filter @finverse/api exec tsx ../../database/seed.ts
   ```
5. Start development servers:
   - **API Server (Port 4000):**
     ```bash
     pnpm --filter @finverse/api dev
     ```
   - **Web Application (Port 5173):**
     ```bash
     pnpm --filter @finverse/web dev
     ```
   - Browser URL: `http://localhost:5173`

### Quality & Verification Commands
- **Monorepo Typecheck:**
  ```bash
  pnpm -r typecheck
  ```
- **Monorepo Production Build:**
  ```bash
  pnpm build
  ```
- **Focused CFO Unit & Integration Tests (runs against `finverse_test`):**
  ```bash
  pnpm --filter @finverse/api exec tsx --test test/cfo.api.test.ts
  ```

---

## 5. Synthetic Demo Personas

All credentials in development are synthetic demo users with password `demo1234`:
- **Asha Sharma (SC):** `asha@finverse.demo` (`EMP-001`) — Frontline Caller
- **Tara Pillai (TL):** `tara@finverse.demo` (`EMP-003`) — Team Lead
- **Neel Kothari (MG):** `neel@finverse.demo` (`EMP-007`) — Wealth Manager
- **Kavita Desai (RM):** `kavita@finverse.demo` (`EMP-008`) — Regional Manager
- **Vikram Malhotra (NM):** `vikram@finverse.demo` (`EMP-009`) — National Manager
- **Rajiv Menon (CEO):** `rajiv@finverse.demo` (`EMP-010`) — Chief Executive Officer
- **Ananya Roy (CFO):** `ananya@finverse.demo` (`EMP-011`) — Chief Financial Officer (Approver)
- **Priya Nair (Controller):** `priya@finverse.demo` (`EMP-012`) — Finance Controller (Preparer)

> **Data Policy Reminder:** Demo data is strictly synthetic. Never insert or seed real customer or employee PII.

---

## 6. Key Documentation & Canonical Sources

Consult authoritative documents rather than guessing:
- **Action Catalog & Specifications:** `docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf`, `action_catalogue_v2.json`
- **Product Requirements (PRD):** `docs/product/prd.md`
- **Design System:** `docs/design/design-system.md` (Brand colors `#113F3D`, `#0B2725`, authentic 1:1.22 logo, single solid primary button rule)
- **Technical Requirements (TRD):** `docs/architecture/trd.md`
- **Backend Schema:** `docs/architecture/backend-schema.md`
- **Current Process Records:**
  - `docs/process/STATUS.md` — Current milestone and blocker checkpoint.
  - `docs/process/BUILD_LOG.md` — Step-by-step audit of executed actions.
  - `docs/process/COVERAGE_MATRIX.md` — Per-action implementation status.

---

## 7. Shared Coordination Boundaries

1. **Contracts (`packages/contracts/src/`):**
   - Shared between frontend and backend. Always rebuild (`pnpm --filter @finverse/contracts build`) after modifying any Zod schema.
2. **Layout & Shell (`apps/web/src/components/shell/WorkspaceShell.tsx`):**
   - Shared by all workspaces. Follows six-zone layout (Navigation, Breadcrumbs, Action Header, Metadata Pills, Work Area, Right Rail / Action Bar).
3. **Database Migrations (`database/migrations/`):**
   - Migrations 0001 through 0017 are applied. Any new table or column changes MUST be added as a forward migration (`0018_...sql`). Never modify earlier applied migrations.
4. **Client API Modules (`apps/web/src/lib/`):**
   - Standardized API clients (`cfo-api.ts`, `modules.ts`) use `credentials: 'include'` for cookie-based session authentication.

---

## 8. Next Implementation Tasks & Workflow

1. **CFO UI Browser Verification:**
   - Perform the two-user browser flow (Priya prepare $\to$ Ananya approve) in `http://localhost:5173/cfo/recognition`.
   - Exercise self-approval prevention and record version conflict banners in the browser.
2. **Advance to Super Admin (`SA`) or Next Scheduled Role:**
   - Follow agreed role execution protocol: complete UI/UX and working functionality role by role.
   - Verify each role with focused unit tests and typecheck before advancing.
3. **Defer Comprehensive Regression:**
   - Full monorepo cross-role regression cycle (`pnpm test` across all 9 test suites) will run as a bounded pass once all role features are completed.
