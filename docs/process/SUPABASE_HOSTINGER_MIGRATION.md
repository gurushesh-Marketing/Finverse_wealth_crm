# Finverse CRM v2: self-hosted Supabase on Hostinger

Status: preparation only. No Supabase target has been created or verified. The existing operational database remains the source of truth until a tested cutover.

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
