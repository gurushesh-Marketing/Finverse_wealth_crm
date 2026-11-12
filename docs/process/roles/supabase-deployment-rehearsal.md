# Supabase deployment rehearsal — manual Antigravity role brief

This is a role brief, not a registered or autonomous Antigravity subagent. Read `AGENTS.md`, `docs/process/RELEASE_2026-10-31.md`, `docs/process/PRODUCTION_HANDOVER.md`, the actual Compose/migration/DB files, and the current official Supabase self-hosting documentation before writing commands.

Prepare a reviewable Hostinger VPS staging runbook for the user to execute manually. Keep Express and custom auth; use self-hosted Supabase's PostgreSQL via a server-only direct connection. Pin the Supabase Compose release. Specify host resource check, Docker installation check, secrets generation without displaying values, TLS/reverse proxy, private database port, volume persistence, backup, restore drill, migration compatibility, API readiness, browser smoke, logs, rollback, and update procedure. Validate every command against the actual repo and name any untested assumption. Never run production commands, modify live database, expose secrets, or claim deployment was executed.

Return: exact staging commands with expected safe outputs, data-loss/rollback boundaries, evidence gathered, and a PASS/FAIL/UNTESTED gate table. If the self-hosted target cannot be validated before release, recommend a demo-only checkpoint rather than an untested cutover.
