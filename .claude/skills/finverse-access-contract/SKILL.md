---
name: finverse-access-contract
description: Trace and verify Finverse CRM fixture access by employee, role, vertical, team, assignment, action, and effective date. Preload for the access reviewer.
---

# Finverse access contract review

Use the confirmed `WorkspaceSession` contract in `CLAUDE.md` and the relevant
catalogue action. Build a small access matrix for the assigned scenario:
session identity, grant, target record, requested action, expected allow/deny.

Trace the same case through three boundaries where they exist:

1. **Route:** opening a URL directly must not expose another role's workspace.
2. **Read:** repository queries must filter records and totals to the session's
   employee, granted verticals, teams, and effective assignment.
3. **Write:** mutation checks must reject out-of-scope records and actions,
   including stale or changed permission versions when the slice supports them.

Include transfer, promotion, multi-team Team Lead, and leaver cases only when
the assigned feature touches them. Historical attribution and current access
are separate questions. CEO and CFO may focus on any of the four verticals,
but their distinct workspaces and action grants still apply.

Run focused fixture or UI checks when available. Report the exact test command
and observed result; otherwise label the finding source-review-only. Quote
file and line for a violation. Mark unknown business policy as [ASSUMPTION]
instead of granting access by guesswork.

Done when each assigned matrix row has a route/read/write finding or an
explicitly absent boundary, and no fixture result leaks an out-of-scope
customer record. This verifies the frontend mock only; server authorization
must be checked when the backend is built.
