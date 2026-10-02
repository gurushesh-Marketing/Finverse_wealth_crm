# AGENTS.md — Finverse CRM (Command Code)

> Runtime: Command Code. Coordination rules: `docs/process/COMMANDCODE_WORKFLOW.md`.
> Model allocation: `docs/process/MODEL_ASSIGNMENTS.md`. Status: `docs/process/STATUS.md`.

## Session roles

- The **main session** coordinates execution and integration. It dispatches every
  worker and returns each worker's result to the responsible lead.
- **Command Code subagents cannot spawn further subagents** — the delegation tool
  is removed from their tool set. All dispatching happens from the main session.
- **Leads** (product, engineering, design, QA) provide plans and assessments only;
  they do not dispatch in this runtime. Their proposals become task packets that
  the main session dispatches as workers.
- Workers execute one bounded task and return a structured result. Detailed
  coordination rules live in `docs/process/COMMANDCODE_WORKFLOW.md`, not here.

## Resuming work

- Read `docs/process/STATUS.md` and the relevant task records before starting.
- Read only the action records and source files the current task needs.
- Record every completed step in `docs/process/BUILD_LOG.md`.

## Product and scope

- Sources of truth: `docs/product/FRONTEND_EXECUTION.md`,
  `docs/product/action_catalogue_v2.json` (all 135 actions),
  `docs/brand/Finverse Wealth Brand Guidelines.pdf`. Do not duplicate product
  logic here.
- **Target: frontend AND backend for all 135 catalogue actions.** The one-week
  window is a delivery target only — it is not verified completion and not
  permission to omit functionality.
- **Shared application architecture (binding on all current and future
  work):** ONE CRM application under ONE domain with ONE shared login page
  covering Wealth, Banking, Markets/Trading and Real Estate. After
  authentication the server resolves the employee's effective role, vertical
  grants, team grants and permissions, then opens the authorized workspace
  automatically. Internal workspace routes may differ within the same
  application; users cannot gain access by changing the URL, role or vertical
  parameters — authorization is enforced on every server read and mutation.
  Explicit multi-team grants appear within the employee's own workspace;
  CEO/CFO vertical focus stays inside their respective executive workspaces.
  Banking-first is the implementation/demo priority ONLY: never a separate
  Banking application, domain, login portal, or deployment.
- Preserve the existing Next.js, TypeScript (strict), pnpm and shadcn/Base UI
  work in `apps/web`. Add dependencies only when a slice needs them.
- Product examples and unresolved business rules stay labelled `[ASSUMPTION]`
  until Finverse resolves them.
- **Fixture isolation is not production authorisation.** The `WorkspaceSession`
  fixture enforces scope in this phase; real server-side authorization is a
  separate, still-required deliverable.
- Production deployment and client communication are separate from local
  implementation and are not authorized by local task completion.

## Skills

- Activate relevant compatible skills at task start and follow their method
  throughout the task; keep each agent's core responsibility and completion
  criteria in its definition. See `docs/process/COMMANDCODE_WORKFLOW.md` §Skills
  for status distinctions (installed / migrated / runtime-verified).

## Model allocation

- Per-agent model assignments are **planned, not applied**. They live in
  `docs/process/MODEL_ASSIGNMENTS.md`; do not claim assigned agents exist or
  have been runtime-tested. Credit budgets there are planning controls only.

## Execution guardrails

Every task follows the task contract, declared deadlines, and the shared
retry budget in `docs/process/COMMANDCODE_WORKFLOW.md` §9. Deadlines and
completion criteria are part of each assignment; command timeouts are never
disabled, and expired work is explicitly cancelled.

## Working cycle (summary)

1. Understand — relevant action IDs and slice spec. 2. Plan — files and
   assumptions. 3. Implement — one slice, matching existing style. 4. Review —
   `pnpm build` / `pnpm lint` for app code; file-appropriate checks for docs and
   config. 5. Verify — run the affected tests with real execution. 6. Record —
   dated BUILD_LOG entry. Never record completion before acceptance criteria
   are verified.

## Legacy files

`CLAUDE.md`, `apps/web/CLAUDE.md`, and `docs/process/AGENT_WORKFLOW.md` document
the previous Claude Code setup and remain unchanged for history. Where they
conflict with this file or `COMMANDCODE_WORKFLOW.md`, the Command Code documents
govern current work.
