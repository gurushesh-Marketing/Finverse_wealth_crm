# Finverse CRM v2: self-hosted Supabase on Hostinger

Status: local Supabase cutover verified on 2026-11-06. Hostinger production installation and cutover remain pending. The old source database and backups are retained for rollback.

## Executed local rehearsal

- Official `self-hosted/v0.8.4` Docker release, commit `189adda99d1b56da55fc5a6ee3f849354aaea92a`, checked out under ignored `.data/supabase-source/`. Secrets were generated with its official scripts into ignored `.env`; no default secret was used. All 11 services became healthy.
- The source `public` schema/data was backed up and restored into Supabase's `postgres` database without replacing Supabase's internal schemas. Before applying the newest migration, the verifier confirmed 52 applied migration versions and matching row counts for all 125 CRM tables. Migration 0053 was then applied to the Supabase target; EMP-035 remained pending.
- A separate `finverse_test` database was restored inside the same Supabase PostgreSQL service. Focused API tests passed 59/59. A dedicated `finverse_app` role with CRM table/sequence rights was created; 26/26 focused API tests and live caller/SA login smoke checks passed through that role. The old standalone PostgreSQL server was stopped; the app still authenticated successfully through Supabase.
- Local-only Supabase Docker files, keys, restored data, and original backups remain under ignored `.data/`. The local `.env` now points the API at the private direct Supabase port `127.0.0.1:5434`; it is not a VPS or production configuration. Keep the official Supabase Docker checkout and its volumes backed up locally until the VPS migration is complete.
- Fresh empty-database `pnpm db:migrate` hit a pre-existing fixture dependency at migration 0013 (`sales_finance_handoffs` refers to a lead not present on an empty install). The verified migration path for this existing CRM is restore of the owned public schema/data, followed by unapplied forward migrations. A clean-install migration refactor remains required before claiming greenfield installation support.

## Architecture decision

Supabase includes PostgreSQL. The management decision therefore replaces the **standalone PostgreSQL deployment** with the PostgreSQL service inside self-hosted Supabase; it cannot remove PostgreSQL or SQL from the stack. Keep React/Vite, Express, `pg`, the CRM's own session/auth logic, and the 53 ordered `database/migrations/*.sql` files. The API alone connects to Supabase's database. Do not put its database URL or Supabase secret key in the browser. Do not switch to Supabase Auth or expose CRM tables through PostgREST until the role, team, vertical, and record-level permission model has been independently implemented and tested there.

The CRM tables and constraints are defined by the existing migrations, including HR onboarding, Super Admin team management, caller allocation, finance, and audit records. Do not hand-create a second simplified set in Studio. Supabase also owns internal `auth`, `storage`, and other schemas; restore CRM objects into `public` only and never overwrite those internal schemas.

## Host sizing and service layout

Supabase's published full-stack minimum is 4 GB RAM, 2 cores, 40 GB disk; recommendation is 8 GB+, 4 cores+, 80 GB+ disk. Hostinger currently lists KVM 2 as 2 cores/8 GB/100 GB and KVM 4 as 4 cores/16 GB/200 GB. KVM 2 meets the basic figures but leaves little headroom for the API, web server, backups and builds. Prefer KVM 4 for the complete stack. Measure actual free memory, disk and CPU on the purchased VPS before installation. Build artifacts off-host if resource pressure appears.

Use the official self-hosted Docker distribution from `https://github.com/supabase/supabase/tree/master/docker`, pinned to a tested `self-hosted/v*` release rather than an unpinned `master`. Put Supabase and its persistent volumes outside the web checkout. Keep the database and Studio private to the VPS network. Serve the CRM and any intended Supabase API behind TLS and a reverse proxy. Configure unique production secrets and persistent off-server backups. The user performs VPS setup and cutover manually.

## Staging rehearsal before cutover

1. Preserve a reviewed Git checkpoint and inspect the uncommitted working tree. Do not delete the existing standalone database or its backups.
2. On a separate staging host or isolated network, install the pinned official Supabase Docker stack, generate unique secrets using its supported setup scripts, and confirm every required container is healthy. Never use the Supabase CLI development stack as production hosting.
3. Back up the operational source with `pg_dump` in custom format and record the PostgreSQL server and client major versions. Take a second off-host copy. Quiesce writes for the final cutover dump; a live rehearsal copy may be taken without stopping writes.
4. Restore **only CRM-owned `public` schema objects and data** into the Supabase PostgreSQL instance. Do not use `--clean` against Supabase's entire database. Review ownership and grants before restoring, including any roles in the archive. Use a direct or session-mode connection for dump/restore, not transaction pooling.
5. Compare every CRM migration version, public table name, row count, key sequence, constraints, and indexes against the source. In particular inspect `employees`, `assignments`, `teams`, `hr_lifecycle_requests`, `leads`, `lead_ownership_events`, `sessions`, and `round_robin_cursors` by metadata/count only. Retain the operational pending status of EMP-035 unless the Super Admin decides otherwise. Do not seed the restored target.
6. Point a staging Express API at a private Supabase **direct/session** database connection through `DATABASE_URL`; point automated tests at a separate isolated test database through `TEST_DATABASE_URL`. The code uses advisory locks and transactions, so do not use transaction pooling without proving those paths.
7. Run migrations as a no-op against the restored target, then focused HR/SA, Data Entry/caller routing, login, role isolation, and CFO advisory-lock tests. Run typecheck, lint, build, desktop/mobile browser journeys, and a database-backed readiness probe. Test a full backup and restore into a disposable destination.
8. Only after a clean rehearsal, plan a short maintenance window: stop writes, final dump, restore, recheck counts/sequences, switch the API connection, smoke-test all critical journeys, then enable writes. Keep the old database intact for rollback. Record the switch time and reverse steps.

## Deployment configuration required

- API secrets: `DATABASE_URL`, `SESSION_SECRET`, production CORS origin, and any provider credentials, stored outside Git. Use a dedicated least-privilege CRM database role where compatible with the migrations and keep migration credentials separate.
- Web: serve the built Vite output and reverse-proxy `/api` to Express on the internal network. Set `VITE_API_URL` only if required by the existing client configuration. Disable demo access and synthetic accounts in production as described in the release gate.
- TLS and network: expose 443 and restricted SSH; keep PostgreSQL, Supabase Studio, and internal API ports closed to the public internet unless a specific protected access path is approved.
- Operations: persistent Docker volumes, off-server encrypted backups, restore drill, log rotation, monitoring, updates pinned by release, and a documented rollback.

## Current blockers

- This Windows machine has Docker CLI but no reachable Docker Desktop Linux engine, so a local self-hosted Supabase rehearsal has not run.
- No Hostinger VPS connection, domain, TLS configuration, or pinned Supabase release has been supplied or exercised.
- The existing release ledger still has open Data Entry, deployment, and stale-evidence gates. Do not claim production readiness from this document.

References: [Supabase self-hosted Docker](https://supabase.com/docs/guides/self-hosting/docker), [Supabase self-hosting responsibilities](https://supabase.com/docs/guides/self-hosting), [migrate existing PostgreSQL to Supabase](https://supabase.com/kb/guides/migrate-from-postgres), [Hostinger VPS limits](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/).
