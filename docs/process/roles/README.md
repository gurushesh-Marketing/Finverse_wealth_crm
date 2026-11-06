# Development roles — Antigravity IDE setup (tool-specific)

Shared product rules, the single authoritative delivery standard, and progress stay in `AGENTS.md`,
[`docs/process/implementation-plan.md`](../implementation-plan.md), and `docs/process/`
(`STATUS.md`, `COVERAGE_MATRIX.md`, `BUILD_LOG.md`). All roles must strictly follow
the canonical workflow defined in `docs/process/implementation-plan.md`. This folder
only holds role instructions for running the team in the Antigravity IDE.

> **These are role instructions, not registered subagents.** The installed
> Antigravity IDE (checked 2026-10-04) documents rules, skills, plugins, hooks
> and MCP servers, but no custom-agent registration format, and the session
> exposes no general worker-delegation tool (only a browser subagent). So
> nothing here is automatically discovered as an agent, auto-orchestrated,
> model-routed, permission-scoped or skill-preloaded. A human starts each role
> as a separate conversation and relays packets/results.

## Twelve-Role Mapping

| # | Role Responsibility | Antigravity Brief | Reused / Composite Brief | Writes? | Installed Skills (`.agents/skills/`) | Absent Skills (marked) |
|---|---|---|---|---|---|---|
| 1 | `product-manager` | [product-manager.md](product-manager.md) | — | No (spec only) | `finverse-reporting-contract` (when metrics/KPIs in scope) | `domain-modeling`, `grilling` |
| 2 | `engineering-lead` | [engineering-lead.md](engineering-lead.md) | — | No (planning/review only) | `ponytail`, `diagnosing-bugs` | `codebase-design`, `domain-modeling`, `ponytail-review` |
| 3 | `frontend-builder` | [frontend-builder.md](frontend-builder.md) | [builder.md](builder.md) | Yes (`apps/web`) | `ponytail`, `tdd`, `design-taste-frontend` | `frontend-patterns` |
| 4 | `backend-builder` | [backend-builder.md](backend-builder.md) | [builder.md](builder.md) | Yes (`apps/api`, `packages/contracts`, `database/`) | `postgres-patterns`, `tdd`, `security-review`, `ponytail` | `backend-patterns`, `domain-modeling` |
| 5 | `design-lead` | [design-lead.md](design-lead.md) | [designer.md](designer.md) | No (review/spec only) | `design-taste-frontend` | None |
| 6 | `ux-designer` | [ux-designer.md](ux-designer.md) | [designer.md](designer.md) | No (spec only) | `design-taste-frontend` | None |
| 7 | `qa-lead` | [qa-lead.md](qa-lead.md) | [qa.md](qa.md) | No (verdict only) | `finverse-qa-execution`, `finverse-access-contract`, `finverse-reporting-contract` | None |
| 8 | `qa-tester` | [qa-tester.md](qa-tester.md) | [qa.md](qa.md) | No (test artifacts only) | `finverse-qa-execution`, `diagnosing-bugs` | None |
| 9 | `access-reviewer` | [access-reviewer.md](access-reviewer.md) | [reviewer.md](reviewer.md) | No (findings only) | `finverse-access-contract`, `security-review` | None |
| 10 | `security-reviewer` | [security-reviewer.md](security-reviewer.md) | [reviewer.md](reviewer.md) | No (findings only) | `security-review`, `finverse-access-contract`, `postgres-patterns` | None |
| 11 | `data-analyst` | [data-analyst.md](data-analyst.md) | — | No (spec/math only) | `finverse-reporting-contract` | `domain-modeling` |
| 12 | `devops-engineer` | [devops-engineer.md](devops-engineer.md) | — | Yes (tooling/CI; paired with Builder) | `ponytail`, `diagnosing-bugs` | None |

> Note: `builder.md`, `designer.md`, `qa.md`, and `reviewer.md` remain available as composite briefs when running combined workflows in a single conversation.
>
> Task-Specific Role Briefs:
> - `onboarding-routing-fixer.md` — [Finverse Onboarding & Routing Fixer](onboarding-routing-fixer.md): Dedicated implementation owner for demo blockers in HR/SA onboarding and Data Entry bulk import routing.
> - `release-coordinator.md` — one issue ledger and evidence-based 31 October release gate; coordinates existing Builder, QA, access/security and DevOps briefs.
> - `supabase-deployment-rehearsal.md` — prepares the self-hosted Supabase staging and data-restore runbook for user-operated Hostinger deployment.

## Starting a role (manual)

1. Open a **new** Antigravity conversation in this workspace.
2. Select **Gemini Flash Medium** (Gemini 3.8 Flash (Medium)) in the UI model selector (Antigravity does not honor Command Code model pins in `.commandcode/agents/`).
3. First message:
   `Act as the <role> defined in docs/process/roles/<file>.md. Read it,
   AGENTS.md and docs/process/STATUS.md, then read the listed SKILL.md files
   before starting. Task packet: <paste packet>.`
4. Copy the role's final report back to the Builder conversation, which
   records the outcome in `BUILD_LOG.md` / `STATUS.md`.

## Task packet (Builder → any role)

```
Role:            designer | qa | reviewer
Outcome:         one sentence, one bounded task
Scope / files:   exact paths the role may read (and, Builder only, write)
Acceptance:      numbered, checkable criteria
Commands:        exact bounded commands allowed (QA), with expected results
Deadline:        e.g. "stop after 30 min or 2 failed attempts; report blocked"
Return:          verdict + evidence (commands run, outputs, file:line refs)
```

## Working agreements (all roles)

- **One implementation owner:** only the Builder conversation edits source,
  tests, migrations or config. Other roles are read-only by instruction —
  Antigravity does not enforce per-role tool limits.
- **Narrow scope:** one packet = one task, explicit files and acceptance.
- **Bounded commands:** state each command and its expected result; no
  open-ended scans of `node_modules`/dependency folders.
- **Deadlines:** written into the packet and self-enforced; Antigravity has no
  `maxTurns` equivalent for conversations.
- **No repeated identical failed attempts:** after a failure, change the
  hypothesis or input; after two failures, stop and report `blocked`.
- **Evidence-based completion:** report `executed` (with output), `proposed`
  (not run) and `blocked` separately. Never claim unexecuted checks.
- **Resumable checkpoints:** Builder updates `STATUS.md` (next exact task) and
  appends to `BUILD_LOG.md` at each accepted checkpoint.

## Skills copy

`.agents/skills/` is a byte-identical copy (hash-checked 2026-10-04) of
`.commandcode/skills/` — including `LICENSE`, `scripts/` and reference files —
so Antigravity can discover them. `.commandcode/skills/` stays the Command
Code copy; if either copy is edited, re-sync the other to avoid drift.
Discovery in Antigravity is verified only once a new conversation lists these
skills.
