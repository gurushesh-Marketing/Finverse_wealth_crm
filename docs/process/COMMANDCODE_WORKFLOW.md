# Command Code coordination workflow

Runtime: Command Code. Scope: how work is dispatched, executed, returned, and
recorded in this project. Model allocation lives in `MODEL_ASSIGNMENTS.md`;
current progress lives in `STATUS.md`. This document supersedes the Claude Code
coordination rules in `AGENT_WORKFLOW.md` (kept for history).

---

## 1. Hierarchy

- The **human** owns product decisions and release authorization.
- The **main session** dispatches every worker and returns each worker's result
  to the responsible lead.
- **Command Code subagents cannot spawn further subagents** (the delegation tool
  is removed from their tool set). One level of dispatch only.
- **Leads provide plans and assessments.** A lead's proposal becomes a task
  packet that the main session dispatches. Leads do not dispatch directly.

## 2. Task states

`planned` → `assigned` → `running` → `returned` → `reviewed` → `verified` →
`integrated`. Any task may enter `blocked` from any state and leaves it only
with a recorded resolution.

- **planned** — task packet written, not yet dispatched.
- **assigned** — dispatched to a named worker.
- **running** — worker is executing.
- **returned** — worker's result is back with its evidence.
- **reviewed** — an independent review of the actual changes passed.
- **verified** — acceptance criteria confirmed by real test execution.
- **integrated** — merged into the main line and recorded in `BUILD_LOG.md`.
- **blocked** — progress stopped; the blocker, its cause, and spent retries are
  recorded in `STATUS.md`.

## 3. Task packet

Every dispatched task carries:

- **Task ID** — unique identifier and the requesting lead
- **Action IDs** — the catalogue actions involved, if any
- **Acceptance criteria** — testable conditions for completion
- **File ownership** — the exact write scope (disjoint from any parallel task)
- **Relevant skills** — the skills to activate at task start
- **Verification commands** — the commands whose real execution proves done
- **Retry budget** — one justified retry, then at most one model escalation

## 4. Worker return

Every worker returns:

- **Actual changes** — files created or modified, with paths
- **Execution evidence** — real command output (test runs, checks); a plan or a
  claim without execution is not evidence
- **Findings** — behavior notes, assumptions met, discrepancies found
- **Blockers** — anything preventing completion, with cause and retries spent
- **Agent ID** — included where the runtime supplies one

## 5. Execution sequencing

- **One successful foreground cycle first.** Complete one full dispatch →
  execute → return → review → verify → integrate cycle before introducing any
  parallel work.
- **At most two simultaneous builders**, with **disjoint write ownership** — no
  file appears in two running task packets.
- **Shared files have one writer.** A file needed by more than one task is
  written by one task only; others consume it read-only.
- Independent review is followed by **actual test execution** — review does not
  substitute for running the verification commands.
- **Record completion only when the acceptance criteria are verified.**
- **Checkpoint and update `STATUS.md` after each accepted feature batch.**

## 6. Failures and retries

- **One justified retry** per failed task — justified means a changed
  hypothesis, input, or approach, not the same operation verbatim. After that:
  **at most one model escalation** (a stronger planned model per
  `MODEL_ASSIGNMENTS.md`). Then report `blocked`.
- **Diagnose infrastructure failures and code failures separately.** A runtime,
  tooling, or model-routing failure is not evidence about code quality, and a
  code failure is not fixed by retrying infrastructure.
- **A failed named-agent task is reported explicitly** with its task ID, what
  was attempted, and what failed. **The coordinator does not silently claim it
  completed through another agent.**

## 7. Skills

- **Activate relevant compatible skills at task start** and follow their method
  throughout the task. Do not treat a skill as a mid-task afterthought.
- **Keep each agent's core responsibility and completion criteria in its
  definition** (`.commandcode/agents/`), not in skill content.
- **Do not claim Claude-style skills preloading is supported.** Command Code
  agent frontmatter reads only `name`, `description`, `tools`,
  `disallowedTools`, `model`, `reasoningEffort`, `maxTurns`, `permissionMode`,
  `background`, `showOutput`; a Claude-style `skills:` field is ignored. Task-
  start activation is the supported pattern.
- **Skills requiring nested delegation need adaptation** — a subagent cannot
  dispatch further subagents here, so any skill that assumes nested delegation
  must be rewritten to return work to the main session instead.
- **Installed, migrated, and runtime-verified are separate statuses.** Record
  only the highest one actually proven for each skill.
- **Graphify and Claude-Mem compatibility is pending.** Neither blocks initial
  execution; do not record them as working in Command Code until verified.

## 8. Status and records

- `STATUS.md` is the resume point: current checkpoint, working tree, next
  tasks, unresolved issues.
- `BUILD_LOG.md` records each completed step in the established format. Never
  record a step as complete before its verification actually ran.
- Distinguish **configuration checks** (settings JSON validation, `git diff
  --check`, document consistency) from **application testing** (build, lint,
  Playwright). State explicitly which ran.

## 9. Execution guardrails (stalls and no-progress protection)

Applies to every task packet dispatched by the main coordinator. Runtime
facts below are verified against **Command Code 1.72.4** (official tools
reference and local tool schemas, 2026-09-30).

### 9.1 Task contract

Every dispatched task states:

- **One concrete deliverable** with **explicit completion criteria**.
- **Relevant action IDs** and **limited file ownership** (disjoint from any
  parallel task).
- **A declared execution deadline** from §9.2.
- **The shared retry budget** (§9.4), shared across coordinator and workers.
- **A concise result contract:** `completed`, `blocked`, `failed`, or
  `timed out` — with actual evidence and the next actionable step.

Split larger work into separate deliverables; never one open-ended run.

### 9.2 Initial limits (deadlines)

| Scope | Deadline |
|---|---|
| Read-only planning/review delegation | 5 minutes |
| Implementation delegation | 15 minutes per bounded task |
| Server readiness | 120 seconds |
| Focused test execution | 180 seconds |
| Lint | 120 seconds |
| Production build | 300 seconds |

An extension requires a documented reason and measurable progress — **never
automatic renewal**.

### 9.3 Command deadline enforcement (runtime-enforced)

- Foreground `shell_command` / `powershell` calls carry `timeout` in ms (tool
  default 30,000; maximum 600,000). On expiry the command's **process tree is
  killed**. Map §9.2 deadlines onto `timeout` values. **Never** pass `0`
  (unlimited) or rely on the bare default for diagnostics, tests, or builds.
- `shell_output`'s `timeout_ms` bounds only the **wait**, not the process —
  an expired wait leaves the task running. When a wait expires, **explicitly
  cancel** with `task_stop` (signals the whole process group) or `kill_shell`
  (SIGTERM → poll → SIGKILL; `taskkill /T` then `/F` on Windows), then verify
  the task's child processes are actually gone.
- `monitor_command` tasks set `maxDurationMs` (auto-SIGTERM) to their bound.
- **Never kill unrelated Node processes, VS Code, or the user's preview
  server.** Attribute first (tracked `taskId`, then `pid`/`port`); never kill
  a `pid` or `port` you cannot identify.

### 9.4 Repeated-failure protection (no-progress loops)

- **At most one retry**, and only after changing a relevant condition (input,
  hypothesis, environment, configuration).
- **Never rerun the same failed command unchanged.**
- The retry budget is **shared across coordinator and workers**; switching
  agent or model does **not** reset it.
- On repeated identical failures: **stop**, record the blocker (command, exit
  code, evidence), and continue independent backlog items where possible.
- **No unconditional `Stop` hook** may be configured to force continuation.
  (Command Code supports `Stop` hooks that force turn revision, capped at 3
  retries; this project deliberately does not use one to force progress.)

### 9.5 Agent wall-clock limits — instruction-only (known gap)

Runtime facts: the `agent` tool has **no timeout parameter**, and custom-agent
frontmatter offers `maxTurns` (a **turn** cap, default 100). Neither is a
wall-clock timeout. Consequences:

- The 5/15-minute agent deadlines in §9.2 are **written policy, not runtime
  enforcement**. The coordinator enforces them procedurally: prefer
  `run_in_background: true` for agents, track elapsed time with `sleep`, read
  `agent_output` `status`, and **cancel an expired agent with `agent_output`
  action `kill`**. A foreground `agent` call blocks until the agent returns
  and cannot be auto-cancelled at a deadline.
- **Do not describe unattended execution as wall-clock-protected.** Command
  deadlines (§9.3) are runtime-enforced; agent deadlines are not.
