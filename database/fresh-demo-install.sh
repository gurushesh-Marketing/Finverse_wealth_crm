#!/usr/bin/env sh
# Build an EMPTY database into the full demo CRM (RELEASE_ISSUES P1-06).
#
# Why the odd order: migrations 0013+ embed demo fixtures that reference the
# demo employees/leads created by database/seed.ts, while seed.ts uses lead
# stages that only become valid at migration 0027. Historically the CRM was
# built migrate -> seed -> migrate, so this script replays that order:
#   1. migrate      (stops at the first fixture that needs demo rows)
#   2. seed         (creates teams/employees/leads; may stop at a later stage)
#   3. migrate      (must now finish all migrations)
#   4. seed         (must now finish; idempotent)
#
# Usage:  DATABASE_URL=postgresql://... sh database/fresh-demo-install.sh
# Never point this at a database holding real data: it loads synthetic demo data.
set -u
cd "$(dirname "$0")/.."

echo "[fresh-install] pass 1: migrate (an early stop here is expected on an empty DB)"
pnpm -s db:migrate >/dev/null 2>&1 || echo "[fresh-install] pass 1 stopped early (expected)"

echo "[fresh-install] pass 1: seed (an early stop here is expected)"
pnpm -s db:seed >/dev/null 2>&1 || echo "[fresh-install] seed pass 1 stopped early (expected)"

echo "[fresh-install] pass 2: migrate (must succeed)"
pnpm -s db:migrate | tail -1 || exit 1

echo "[fresh-install] pass 2: seed (must succeed)"
pnpm -s db:seed | tail -1 || exit 1
