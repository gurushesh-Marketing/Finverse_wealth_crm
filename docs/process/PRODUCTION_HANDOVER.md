# Production Deployment & Operations Handover — Finverse CRM v2

**Intended Recipient:** DevOps & Engineering Teams (Project Handover)<br>
**Document Status:** Production Release Preparation Specification  
**Application:** Finverse CRM v2 (Institutional Multi-Vertical CRM)  
**Effective Date:** 2026-10-06  

---

## 1. Overview & Release Gate Architecture

This document governs the operational handover and production deployment of Finverse CRM v2. Finverse CRM v2 operates a unified monorepo architecture (`apps/web`, `apps/api`, `packages/contracts`, `database/migrations`) serving Wealth Management, Commercial Banking, Markets & Trading, and Real Estate Advisory on a single domain with role-resolved workspace access.

Before any production release, all criteria in this handover document must be executed and verified with physical evidence.

---

## 2. Reproducible Build & Migration Procedure

### 2.1 Monorepo Prerequisites
- **Node.js:** v20.x LTS or higher
- **Package Manager:** `pnpm` v9.x or higher
- **Database Engine:** PostgreSQL 16 Alpine
- **Environment:** Linux (Ubuntu 22.04 LTS / Debian 12 recommended) or Windows Server

### 2.2 Clean Build Verification
Execute from the monorepo root:
```bash
# 1. Clean install reproducible lockfile dependencies
pnpm install --frozen-lockfile

# 2. Compile shared contracts first
pnpm --filter @finverse/contracts build

# 3. Typecheck all workspaces
pnpm typecheck

# 4. Production bundle builds
pnpm --filter @finverse/api build
pnpm --filter @finverse/web build
```
Artifacts are generated to:
- `apps/api/dist/` (Node.js production bundle)
- `apps/web/dist/` (Static SPA assets for Nginx / CloudFront / Caddy)

### 2.3 Forward Migration Procedure
Migrations run in strict chronological order from `database/migrations/`:
```bash
# Run database migrations against production target
pnpm db:migrate
```
- Migrations apply incrementally using the `schema_migrations` tracking table.
- **Strict Rule:** Never run `database/seed.ts` or synthetic fixtures on the production database.
- Every migration must be tested on a pre-production staging replica before production execution.

---

## 3. Environment & Secret Configuration

Production secrets must be supplied via secure environment injection (e.g. HashiCorp Vault, AWS Secrets Manager, or Doppler) and never committed to version control.

| Environment Variable | Service | Classification | Purpose & Constraints |
|---|---|---|---|
| `NODE_ENV` | API / Web | Public Config | Must be strictly `production`. |
| `PORT` | API | Network Config | Port for Express server (default `4000`). |
| `DATABASE_URL` | API | Secret URI | PostgreSQL connection URI: `postgresql://<user>:<pwd>@<host>:5432/finverse_prod?sslmode=verify-full`. |
| `SESSION_SECRET` | API | Critical Secret | High-entropy random string (minimum 64 characters) for signing `fvc2_session` cookies. |
| `CORS_ORIGIN` | API | Security Config | Fully qualified domain of the web client (e.g. `https://crm.finversewealth.com`). |
| `VITE_API_URL` | Web | Client Config | Public base URL for the backend API proxy. |
| `VITE_DEMO_ACCESS` | Web | Security Flag | **MUST BE UNSET OR `false`**. Enables demo switcher panel if true. |
| `DEMO_ACCESS_ENABLED`| API | Security Flag | **MUST BE UNSET OR `false`**. Allows synthetic password bypass if true. |
| `STORAGE_DRIVER` | API | Infra Config | Document storage backend (`local` with persistent volume mount, or `s3`). |
| `STORAGE_BUCKET` | API | Infra Config | S3 bucket name or local base path (`/var/data/finverse/documents`). |
| `ENCRYPTION_KEY` | API | Critical Secret | 256-bit AES key for at-rest token/evidence encryption. |

---

## 4. Production Demo-Account & Panel Disablement

To prevent unauthorized access or accidental exposure of demo credentials:

1. **Delete / Disable Demo Access UI:**
   - Remove or tree-shake `apps/web/src/lib/demo-accounts.ts` and `apps/web/src/components/auth/DemoAccessPanel.tsx`.
   - Ensure `apps/web/src/pages/LoginPage.tsx` renders solely the standard corporate email and password inputs.
2. **Environment Flag Verification:**
   - Confirm `VITE_DEMO_ACCESS` is unset or `false` in production build environment.
   - Confirm `DEMO_ACCESS_ENABLED` is unset or `false` on the API server.
3. **Build Artifact Audit:**
   - Run search across `apps/web/dist/` for `@finverse.demo` and demo passwords. Zero matches permitted.
4. **API Hard Guard:**
   - The API strictly enforces that when `NODE_ENV=production`, logins with `@finverse.demo` domains are unconditionally rejected with `401 UNAUTHENTICATED`, even if legacy database entries exist.
5. **No Synthetic Seeding:**
   - `database/seed.ts` is strictly prohibited on production instances. Initial institutional accounts are provisioned exclusively via Superadmin (`SA-01`).

---

## 5. Required Integrations vs Unresolved Business Decisions

### 5.1 Honest Provider Architecture
In Finverse CRM v2, simulated adapters exist for initial development validation. **These simulated adapters must never be represented as live third-party integrations.** Real production deployment requires binding concrete provider contracts:

| Service Subsystem | Current State | Production Integration Required |
|---|---|---|
| **Voice Telephony** | In-app simulated call modal (`SC-06`, `SC-07`) | WebRTC SIP gateway or provider CTI integration (e.g., Exotel, Twilio Voice, Tata Teleservices). |
| **WhatsApp Business** | Template merge preview with queued simulation (`SC-09`, `SC-10`) | Official Meta WhatsApp Business Platform BSP (e.g., Gupshup, Karix, Twilio WhatsApp). |
| **Email Gateway** | Simulated SMTP dispatch | Institutional SMTP / transactional SES / SendGrid relay. |
| **Object Storage** | Local filesystem (`data/uploads`, `data/exports`) | S3-compatible private institutional bucket with server-side SSE-KMS encryption. |
| **Enterprise Identity**| Local scrypt hash & session cookie | Enterprise SSO (SAML 2.0 / OIDC / Azure AD / Okta) per client decision category 6. |

### 5.2 Unresolved Client Decisions (`[Deck P320]`)
Before production go-live, corporate sign-off must be recorded for the six Action Deck Page 320 categories:
1. **Products and stages:** Definitive product catalog, conversion thresholds, and lost recontact grace periods for Banking, Markets, and Real Estate.
2. **Commercial events:** Frontline sales incentive clawback percentage, clawback holdback window, and revenue recognition trigger criteria.
3. **Approvals and limits:** Financial authority thresholds for Manager vs Regional Manager commercial discount waivers.
4. **Targets and periods:** Fiscal year start date, period close certification authority, and emergency period reopen policy.
5. **Providers and consent:** Selection of cloud telephony and WhatsApp BSP vendors; customer consent evidence retention schedule (e.g. 5 vs 8 vs 10 years).
6. **Deployment and data:** Identity provider selection, legacy CRM CSV import mappings, and hosting sovereignty jurisdiction.

---

## 6. Backup & Demonstrated Restoration Procedure

### 6.1 Automated Backup Schedule
- **Full Database Dumps:** Daily at 02:00 IST via `pg_dump` with custom compressed format (`-Fc`).
- **Continuous Archiving:** Write-Ahead Logging (WAL) archiving enabled with Point-In-Time Recovery (PITR) to secondary cloud object storage with 30-day retention.
- **Document Evidence Backup:** Daily incremental synchronization of persistent storage volume (`/var/data/finverse`).

### 6.2 Restoration Drill Runbook (Demonstrated Restoration)
To verify backup integrity before handover:
```bash
# 1. Spin up an isolated test instance
docker run --name fvc2-restore-test -e POSTGRES_PASSWORD=restore_pwd -p 5499:5432 -d postgres:16-alpine

# 2. Restore schema and data from backup artifact
pg_restore -h localhost -p 5499 -U postgres -d postgres --clean --if-exists /var/backups/finverse_20261006.dump

# 3. Execute integrity verification query
psql -h localhost -p 5499 -U postgres -c "SELECT COUNT(*) FROM employees; SELECT COUNT(*) FROM leads; SELECT COUNT(*) FROM lead_events;"

# 4. Verify no data corruption or foreign key breaches
psql -h localhost -p 5499 -U postgres -c "SELECT 'Integrity Check Passed' WHERE NOT EXISTS (SELECT 1 FROM leads WHERE owner_employee_id IS NOT NULL AND owner_employee_id NOT IN (SELECT id FROM employees));"

# 5. Teardown test container
docker rm -f fvc2-restore-test
```

---

## 7. Monitoring, Failed-Job Recovery & Support Procedures

### 7.1 Health & Liveness Probes
- **Liveness:** `GET /health` returns `200 OK` `{ status: "ok", timestamp: "..." }`.
- **Database Readiness:** `GET /health/ready` validates PostgreSQL connection pool connectivity and latency.
- **Application Metrics:** Prometheus-compatible metrics endpoint scraping request latency, 5xx rate, and active database pool connections.

### 7.2 Background Job & Advisory Lock Governance
- Scheduled recurring jobs (e.g., `TL-17` team report generator, `MG-13` meeting pack exporter, SLA escalation checks) use PostgreSQL session-level advisory locks (e.g., `pg_try_advisory_lock(884422)`).
- **Concurrency Protection:** Jobs run with deterministic deduplication; overlapping execution attempts safely exit with zero mutations.
- **Failed Job Recovery:**
  - Failed job dispatches write error entries to `system_job_logs` with stack trace and parameters.
  - An automatic retry policy with exponential backoff (max 3 attempts) is enforced for transient network/I/O errors.
  - Permanently failed jobs alert operations via webhook and can be re-triggered via Superadmin jobs console (`SA-10`).

### 7.3 Support Escalation Matrix
- **Level 1 (Operational Support):** Login issues, user lockouts, report generation timeouts — resolved via Superadmin workspace (`SA-01`, `SA-02`).
- **Level 2 (Application Support):** Lead allocation queue stuck, commercial exception routing stalls — handled by CRM operations team.
- **Level 3 (Platform & Database Engineering):** Relational lock contention, database replication lag, fatal API 500 errors — handled by platform & backend engineering teams.

---

## 8. Release Verification & Recovery Plan

### 8.1 Pre-Release Smoke Verification
Following deployment to the target production environment:
1. Verify database migrations status: `SELECT version FROM schema_migrations ORDER BY version;`.
2. Verify API health check: `curl -f https://<api-domain>/health`.
3. Verify TLS certificate and HTTPS redirect.
4. Execute authenticated smoke test: Log in via Superadmin, verify dashboard loads, inspect audit incident log (`SA-09`).
5. Confirm zero console errors or missing static chunk 404s on the client bundle.

### 8.2 Rollback & Recovery Strategy
- **Forward-Fix Principle:** Relational databases holding live operational customer data must never be subjected to destructive `DOWN` migrations that drop tables or wipe columns.
- If a critical software defect occurs post-release:
  1. **Application Rollback:** Point web routing and API container services back to the prior stable container tag (blue/green or canary swap).
  2. **Database Backward Compatibility:** All migrations must maintain additive backward-compatibility with the prior release, ensuring the older application version functions without errors.
  3. **Zero Data Discard:** Never execute `DROP DATABASE` or restore an earlier snapshot over a running production database that has accepted live client work.

---

## 9. Engineering & Feature Branch Collaboration Handoff (Same CRM)

### 9.1 Branching & Workspace Strategy
- **Single Monorepo, Shared Domain:** Contributors work within the **SAME Finverse CRM v2 repository** on a dedicated feature branch (e.g. `feature/<task-or-vertical>`).
- **Do Not Branch Off Outdated Heads:** Branch directly from the published Wealth Manager checkpoint.
- **Push Without Force:** Never force-push (`git push --force`) to shared branches.

### 9.2 Local Development Setup
```bash
# 1. Clone/Fetch and create your feature branch
git checkout -b feature/<vertical>

# 2. Install workspace dependencies
pnpm install

# 3. Spin up local PostgreSQL container (port 5433)
docker compose up -d postgres

# 4. Configure local environment variables
cp .env.example .env
# Edit .env with your local credentials:
# POSTGRES_PASSWORD=your_password
# DATABASE_URL=postgresql://finverse:your_password@localhost:5433/finverse_crm
# TEST_DATABASE_URL=postgresql://finverse:your_password@localhost:5433/finverse_test
# SESSION_SECRET=local-development-secret-minimum-64-characters

# 5. Run database migrations (0001..0013)
pnpm db:migrate

# 6. Seed synthetic development demo data (NEVER on production)
pnpm db:seed

# 7. Start API dev server (:4000) and Web client (:5173)
pnpm dev
```

### 9.3 Verification & Evidence Protocol
- **Type Safety:** Run `pnpm typecheck` before pushing. All contracts in `@finverse/contracts` must strictly compile.
- **Dedicated Test Suite:** Run tests against `TEST_DATABASE_URL` (`finverse_test`):
  ```bash
  pnpm --filter @finverse/api test
  # Or run the Manager suite:
  node --import tsx --test apps/api/test/manager.api.test.ts
  ```
- **Evidence Freshness:**
  - When modifying API, Web, or Contract code, record execution evidence via:
    `python scripts/record_test_execution.py`
  - Rebuild the requirements graph:
    `python scripts/build_requirements_graph.py`
  - Validate evidence integrity:
    `python scripts/verify_evidence_integrity.py`

### 9.4 Vertical Ownership & Scope Boundary
- **Wealth Management Vertical:** Frontline Caller (`SC-01..28`), Team Lead (`TL-01..18`), and Manager (`MG-01..13`) are fully implemented and verified. Regional Manager (`RM-01..10`) is the exact next role on the roadmap.
- **Shared Contracts (`packages/contracts`):** Do not mutate stabilized schemas (`Lead`, `Task`, `Employee`, `Transfer`) without maintaining backward compatibility.
- **Unresolved Business Logic:** Unconfirmed financial clawbacks, thresholds, and retention policies remain explicitly labeled `[Deck P320]`. Do not introduce invented production defaults.

