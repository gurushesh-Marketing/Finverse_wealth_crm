# Agent workflow and coordination

This document defines the agent hierarchy, delegation contract, and execution boundaries for the Finverse CRM project.

---

## 1. Hierarchy

- **The human** owns product decisions and release authorization.
- **The main Claude session** coordinates delivery and integrates results.
- **Product, Engineering, Design, and QA leads** own their assigned work.
- **Leads** may delegate bounded tasks to permitted specialist workers.
- **A child** returns its result to the parent that assigned it.
- **Parents** verify child results before reporting completion upward.

---

## 2. Delegation contract

Every assignment states:

- **Task ID and parent** — unique identifier and the assigning agent
- **Objective and relevant action IDs** — what success looks like; which catalogue actions apply
- **Source documents and required inputs** — specs, fixtures, and dependencies
- **Starting revision** — the git commit hash the worker branches from (Engineering Lead records this; reviewers assess the diff from that revision)
- **Files or areas owned by the task** — exclusive write scope
- **Permitted actions** — tools, commands, and install permissions
- **Acceptance criteria** — testable conditions for completion
- **Required evidence and return format** — what the parent needs to integrate the result

---

## 3. Skill selection

- Each Finverse agent has a small, role-specific `skills:` list in its
  frontmatter. Claude Code injects those full skills when the agent starts, so
  the worker applies them throughout its task without a separate Skill call.
- The `Skill` tool is for a situational skill whose trigger arises during the
  task; it is not the default way to equip a worker. A worker without the Skill
  tool can still use its preloaded skills.
- Use named project agents via the Agent tool (finverse-product-manager, finverse-data-analyst, etc. are agents, not skills).
- Keep the agent-to-skill preload matrix in `docs/process/SKILL_MAP.md` aligned
  with the actual agent frontmatter and installed SKILL.md files.
- Distinguish skills that are model-invocable from those requiring explicit user invocation (see SKILL_MAP.md §Invocation eligibility).
- Add future skills to an agent's preload list only after installation and a
  role-specific fit are verified. Do not preload a whole skill pack.
- Skills cannot expand the task's scope or permissions.
- Consult recorded decisions in `docs/process/BUILD_LOG.md` and `docs/process/STATUS.md` before asking questions.
- Escalate unresolved business decisions to the main session.
- Never invent the human's answers or claim an unavailable skill ran.
- **Use one primary workflow for a task**; avoid competing workflows running over the same task simultaneously.

---

## 4. Bounded execution

- **Work from evidence:** hypothesis, check, action, verification.
- Allow at most **two additional recovery attempts** per failed task.
- Count retries and reassignments against the same task budget.
- A retry needs a changed hypothesis, input, or approach — not the same operation verbatim.
- **When a task explicitly requires a named child agent:** the parent must not replace a failed child with its own answer and claim completion. On retry budget exhaustion, report the incomplete dependency and continue only independent authorized work.
- Report unresolved blockers upward and continue independent work.
- Stop when acceptance criteria and relevant checks pass.

---

## 5. Integration and reporting

- Give each implementation task clear file ownership.
- **Concurrent writer isolation** is managed by parent leads, not by workers. See §Isolation below.
- Parents inspect changes and evidence before integration.
- Reviewers assess the actual implementation revision (the diff from the starting revision in the delegation contract), not the plan.
- Report status as **planned**, **in progress**, **review**, **verified**, or **blocked**.
- Keep frontend fixture checks distinct from production authorization checks — the fixture enforces `WorkspaceSession` scope in this phase; real server authorization comes later.

---

## Coordination with existing CLAUDE.md workflows

This document extends `CLAUDE.md` §6 (Working cycle) and §7 (Agent coordination and delegation) with the agent coordination layer. When delegating work:

1. Follow the six-step working cycle for every task.
2. Use the delegation contract template above for assignments.
3. Apply the bounded-execution rules to prevent unbounded retries.
4. Follow the integration checklist before marking tasks complete.

For single-session work, continue using `CLAUDE.md` directly.

---

## Agent hierarchy and delegation map

### Human
- Owns product decisions and release authorization
- Delegates to main Claude session

### Main Claude session
- Coordinates delivery and integrates all results
- Does not duplicate lead responsibilities
- Delegates to:
  - **finverse-product-manager** (requirements, scope, acceptance)
  - **finverse-engineering-lead** (technical coordination)
  - **finverse-design-lead** (brand, interaction, density)
  - **finverse-qa-lead** (acceptance, readiness)
  - **finverse-devops-engineer** (tooling, CI, environment)

### Product lead (finverse-product-manager)
- Requirements, action IDs, acceptance criteria
- Has: Agent tool — can delegate to workers
- Delegates to:
  - **finverse-data-analyst** (KPI definitions, reporting logic)

### Engineering lead (finverse-engineering-lead)
- Technical planning, file ownership, integration
- Has: Agent tool — can delegate to workers and manage isolation
- Delegates to:
  - **finverse-frontend-builder** (implementation with exclusive file ownership)

### Design lead (finverse-design-lead)
- Brand compliance, interaction consistency
- Has: Agent tool — can delegate to workers
- Delegates to:
  - **finverse-ux-designer** (screen specifications, flows)

### QA lead (finverse-qa-lead)
- Test strategy, acceptance coverage, readiness
- Has: Agent tool — can delegate to workers
- Delegates to:
  - **finverse-qa-tester** (exploratory testing)
  - **finverse-access-reviewer** (isolation verification)

### Workers (do not delegate further)
- **finverse-data-analyst** → returns to Product lead
- **finverse-frontend-builder** → returns to Engineering lead
- **finverse-ux-designer** → returns to Design lead
- **finverse-qa-tester** → returns to QA lead
- **finverse-access-reviewer** → returns to QA lead
- **finverse-devops-engineer** → returns to main session

Workers have no Agent tool. Workflows requiring Agent, WebSearch, WebFetch,
or other tools not in the worker's set must be escalated to the parent, not
attempted in the worker.

---

## Isolation for concurrent writers

When multiple agents need to write to the project simultaneously, concurrent
writer isolation is parent-managed:

1. **Engineering Lead assigns non-overlapping file sets.** Before spawning
   any worker, the Engineering Lead:
   - Lists all files in the slice and partitions them into non-overlapping
     ownership sets (no shared file appears in two concurrent assignments).
   - Records the starting revision (git commit hash) in each delegation
     contract so reviewers can assess the exact diff.
   - Documents owned files in the delegation contract per §2.

2. **Workers do not create or manage worktrees.** EnterWorktree and
   ExitWorktree are supported Claude Code capabilities, but they are not
   available to worker agents in this project. Isolation is achieved through
   file-ownership partitioning, not separate git worktrees.

3. **Workers stay within their assigned file set.** No modifications to
   shared primitives, CLAUDE.md, or BUILD_LOG.md without Engineering Lead
   approval.

4. **Sequential review.** Workers complete and return results one set at a
   time. The Engineering Lead reviews and integrates each set before starting
   the next overlapping assignment.

5. **Reference access.** Workers must have access to:
   - CLAUDE.md and AGENT_WORKFLOW.md (both committed)
   - docs/product/action_catalogue_v2.json (committed)
   - docs/brand/Finverse Wealth Brand Guidelines.pdf (committed)
   - docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf
     (gitignored — may not exist in a fresh clone; workers handle gracefully
     without committing it; request from main session if needed)

---

## Workflow rules for nested agents

These are workflow rules, not enforcement guarantees:

- A worker that completes its task returns its result to the parent that
  assigned it. It does not report to the main session directly.
- A lead that receives a worker result verifies it before reporting upward.
- If a worker fails past the retry budget, the lead escalates the blocker to
  the main session with the task ID, what was tried, and what failed.
- The main session does not bypass leads to reassign directly to workers (it
  may spawn independent agents for parallel non-conflicting work).
- These rules are documented to guide agent behavior; Claude Code does not
  mechanically enforce the reporting path.

---

## Recovery and retry budget

Per §4 (Bounded execution):
- Allow at most **two additional recovery attempts** per failed task
- Count retries AND reassignments against the same task budget
- A retry needs changed hypothesis, input, or approach

Example:
- Initial attempt fails → 1st recovery attempt with different approach
- 1st recovery fails → 2nd recovery attempt with different input
- 2nd recovery fails → escalate blocker to parent; do not retry further

This limit is shared across the task lifecycle: if Engineering lead tries twice and fails, then reassigns to a different worker, that worker inherits the spent budget and has zero retries remaining before escalation.
