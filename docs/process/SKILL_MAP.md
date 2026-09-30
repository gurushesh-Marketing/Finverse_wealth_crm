# Skill map

This document records the exact installed skills, their sources, purposes, and invocation rules.

Last updated: 2026-09-28 (Step 010)

---

## Installed skills — Matt Pocock skill pack

Source: `mattpocock/skills` (GitHub). Verified from `skills-lock.json` — **38 skills** installed.

### Notes on invocation eligibility

Invocation eligibility (whether a skill can be triggered by an agent via the
Skill tool) is determined by the skill's frontmatter, not by labels or guesses.
Skills in the `skills/in-progress/` path are installed but marked not selected
for this project's normal workflow — prefer stable alternatives where listed.

The harness system prompt lists the skills available to this session. That
listing is the ground truth for what can be invoked. If a skill name appears in
`skills-lock.json` but not in the harness listing, it cannot be invoked; the
last-known error for this case is `Unknown skill: <name>` from the Skill tool.

### Engineering skills (17)

| Skill | lockfile path | Purpose | Invocable by agents |
|---|---|---|---|
| `code-review` | `skills/engineering/code-review` | Review changes against coding standards and spec | Yes |
| `codebase-design` | `skills/engineering/codebase-design` | Design module interfaces and architecture | Yes |
| `diagnosing-bugs` | `skills/engineering/diagnosing-bugs` | Debug with structured investigation | Yes |
| `domain-modeling` | `skills/engineering/domain-modeling` | Model domain concepts for business logic | Yes |
| `grill-with-docs` | `skills/engineering/grill-with-docs` | Deep questioning with documentation context | No — user-invoked |
| `implement` | `skills/engineering/implement` | Feature implementation workflow | No — user-invoked |
| `improve-codebase-architecture` | `skills/engineering/improve-codebase-architecture` | Refactor and improve architecture | No — user-invoked |
| `prototype` | `skills/engineering/prototype` | Quick prototyping for exploration | Yes |
| `research` | `skills/engineering/research` | Investigate topics with structured search | Yes |
| `resolving-merge-conflicts` | `skills/engineering/resolving-merge-conflicts` | Merge conflict resolution | Yes |
| `setup-matt-pocock-skills` | `skills/engineering/setup-matt-pocock-skills` | Install Matt Pocock skills (setup complete) | No — user-invoked |
| `tdd` | `skills/engineering/tdd` | Test-driven development workflow | Yes |
| `to-spec` | `skills/engineering/to-spec` | Convert requirements to specification | No — user-invoked |
| `to-tickets` | `skills/engineering/to-tickets` | Break spec into implementation tickets | No — user-invoked |
| `triage` | `skills/engineering/triage` | Bug/issue triage workflow | No — user-invoked |
| `wayfinder` | `skills/engineering/wayfinder` | Codebase navigation and orientation | No — user-invoked |
| `wizard` | `skills/engineering/wizard` | Guided workflows for complex tasks — **user-invoked only** | No (frontmatter disables model invocation) |

### Productivity skills (8)

| Skill | lockfile path | Purpose | Invocable by agents |
|---|---|---|---|
| `ask-matt` | `skills/engineering/ask-matt` | Ask Matt Pocock for guidance | No — user-invoked |
| `grilling` | `skills/productivity/grilling` | Deep questioning technique for requirements | Yes |
| `grill-me` | `skills/productivity/grill-me` | Be grilled on your thinking — **user-invoked only** | No (frontmatter disables model invocation) |
| `handoff` | `skills/productivity/handoff` | Create session handoff documentation | No — user-invoked |
| `teach` | `skills/productivity/teach` | Teaching and explanation workflow | No — user-invoked |
| `to-questionnaire` | `skills/productivity/to-questionnaire` | Convert topic to questionnaire | No — user-invoked |
| `wait-what` | `skills/productivity/wait-what` | Clarify confusing statements | No — user-invoked |
| `writing-for-agents` | `skills/productivity/writing-for-agents` | Write docs optimized for AI agents | Yes |

### In-progress skills (9) — installed but not selected for normal workflow

| Skill | lockfile path | Note |
|---|---|---|
| `claude-handoff` | `skills/in-progress/claude-handoff` | Session handoff (use `handoff` instead) |
| `implement-spec` | `skills/in-progress/implement-spec` | Spec-driven implementation (use `implement`) |
| `loop-me` | `skills/in-progress/loop-me` | Looping workflow (use built-in `loop`) |
| `pr` | `skills/in-progress/pr` | Pull request descriptions (use built-in `pr` skill) |
| `retro` | `skills/in-progress/retro` | Retrospective workflow (not applicable yet) |
| `setup-ts-deep-modules` | `skills/in-progress/setup-ts-deep-modules` | TypeScript deep modules setup |
| `writing-beats` | `skills/in-progress/writing-beats` | Writing rhythm workflow (not applicable to CRM) |
| `writing-fragments` | `skills/in-progress/writing-fragments` | Fragment writing (not applicable to CRM) |
| `writing-shape` | `skills/in-progress/writing-shape` | Shape-driven writing (not applicable to CRM) |

In-progress skills may or may not be invocable depending on their frontmatter.
Do not use them in place of stable alternatives.

### Misc skills (4)

| Skill | lockfile path | Purpose | Invocable by agents |
|---|---|---|---|
| `git-guardrails-claude-code` | `skills/misc/git-guardrails-c‍laude-code` | Git safety practices | Yes |
| `migrate-to-shoehorn` | `skills/misc/migrate-to-shoehorn` | Migration workflow | Migration phase only |
| `scaffold-exercises` | `skills/misc/scaffold-exercises` | Create learning exercises | No (not applicable to CRM) |
| `setup-pre-commit` | `skills/misc/setup-pre-commit` | Configure pre-commit hooks | Setup phase only |

---

## Claude Code built-in skills

These are provided by the Claude Code harness and do not appear in `skills-lock.json`.
They are listed in the harness system prompt as the available set.

| Skill | Purpose | Invocable by agents |
|---|---|---|
| `artifact-design` | Design guidance for Artifacts — load before writing any artifact | Yes |
| `artifact-diagramming` | Diagramming know-how for Artifacts | Yes |
| `code-review` | Review diff/PR/branch for correctness | Yes |
| `simplify` | Review for reuse/efficiency cleanups and apply fixes | Yes |
| `fewer-permission-prompts` | Scan transcripts and add allowlist | No (user-invoked) |
| `loop` | Run recurring task on interval | No (user-invoked) |
| `claude-api` | Claude API reference and migration | Yes |
| `workflow-authoring` | Workflow script authoring reference | Yes (before authoring) |
| `run` | Launch and drive the app to verify changes | Yes |
| `init` | Initialize project | No (user-invoked, once per project) |
| `security-review` | Security review skill | Yes |
| `dataviz` | Charts, graphs, dashboards, visualizations — load before creating viz | Yes |
| `update-config` | Configure Claude Code via settings.json | No (user-invoked) |
| `keybindings-help` | Customize keyboard shortcuts | No (user-invoked) |
| `pr` | Write a PR body | Yes |
| `writing-for-agents` | Write docs optimized for AI agents | Yes |

---

## ECC skill pack — separate from agent definitions

The ECC plugin (`ecc@ecc`, installed at project scope) provides:
- **386 skills** — accessed by ECC skill syntax (e.g., `ecc:some-skill`)
- **74 agent definitions** — these are agents, not skills; they have their own invocation path
- **24 hooks** — executed by the harness on trigger events
- **1 plugin MCP server** — accessible via `/reload-plugins`

**Important distinction:** The ECC entries listed below are agent *definitions*
provided by ECC, not skills. Referencing `ecc:react-build-resolver` in agent
instructions means spawning an ECC agent, not invoking a skill. Agents in this
project's `.claude/agents/` do not reference ECC agents directly; escalate to
the main session instead.

The full ECC skill catalog is not enumerated here. For guidance on what ECC
provides, use the `ecc:ecc-guide` skill if it appears in the harness listing,
or read the ECC plugin documentation directly.

---

## Not installed (pending or requested)

The following skill packs have been mentioned but are **not currently installed**.
When a skill pack is requested, add it here with the request date and requester.
Move to "Installed skills" only after verification with `skills-lock.json`.

| Pack | Correct purpose | Status |
|---|---|---|
| VibeSec | Security workflows | Not installed |
| SkillSpector | Skill analysis | Not installed |
| Impeccable | Quality enforcement | Not installed |
| Anti-Slop | Output quality | Not installed |
| UIUX Pro Max | Advanced UI/UX workflows | Not installed |
| Awesome Claude Design/Skills | Community collections | Not installed |
| jeffallan/claude-skills | Community skills | Not installed |
| alirezarezvani/claude-skills | Community skills | Not installed |

---
## Recently installed (development-tools setup — 2026-09-28)

Verification sources vary by skill: `skills-lock.json` entries for Matt Pocock and
ECC skills; plugin record (`claude plugin list --json`) for Graphify and
Claude-Mem; file presence in `.claude/skills/<name>/SKILL.md` for copied project
skills (Design Taste Frontend). Ponytail appears in both `skills-lock.json`
(`DietrichGebert/ponytail`) and as a copied project skill. A fresh checkout must
reinstall the Graphify runtime (`.venv-graphify/`) for its hooks to function.

| Pack | Source | Version | Scope | Purpose | Verification |
|---|---|---|---|---|---|
| Graphify | cli install | 0.9.69 | project | Code and document knowledge graphs — query, path, explain, update | `graphify-out/graph.json` created (27 nodes, 46 edges, 6 communities); **baseline graph covers setup scripts and shell utilities only, not CRM application code** |
| Ponytail | `DietrichGebert/ponytail` (skills-lock.json) | — | project | Forces laziest working solution — YAGNI, stdlib-first, shortest diff | Two entries: `ponytail` (main skill, `.claude/skills/ponytail/SKILL.md`) and `ponytail-review` (review companion, `.claude/skills/ponytail-review/SKILL.md`); both verified from SKILL.md files directly |
| Design Taste Frontend | copied project skill | — | project | Anti-slop frontend design for landing pages / portfolios / redesigns | Copied to `.claude/skills/design-taste-frontend/SKILL.md`; does **not** appear in `skills-lock.json` — installed by file presence |
| Claude-Mem | MCP server | 13.28.0 | project | Persistent context recall, project memory | Worker healthy on port 37991; `mcpReady: true, degraded: false`; **worker health does not prove memory capture or compression** — first search returned no stored observations; related facts surfaced from project docs, not memory store |

---

## Preloaded skills by Finverse agent

Claude Code injects each listed skill's full content into that agent's context
at startup through the agent's `skills:` frontmatter. This is an always-loaded
task method, not a separate Skill tool call or a trained model. The agent's
own prompt and tool list still determine its job and what it can execute.

| Agent | Skills loaded at launch | Task capability |
|---|---|---|
| finverse-product-manager | `domain-modeling` | sharpen role, assignment, and action terms before acceptance criteria |
| finverse-design-lead | `design-taste-frontend` | read the Finverse brief and review visual direction; dashboard rules stay in the product specs |
| finverse-ux-designer | `design-taste-frontend` | design role-specific screens from the brand and action contract |
| finverse-engineering-lead | `codebase-design`, `ponytail` | choose a clear module seam and minimum implementation |
| finverse-frontend-builder | `ponytail`, `tdd` | implement lean behavior with meaningful tests |
| finverse-qa-lead | `finverse-qa-execution` | decide readiness from executed evidence |
| finverse-qa-tester | `finverse-qa-execution` | run targeted Playwright checks when available; report actual results |
| finverse-access-reviewer | `finverse-access-contract` | trace route, read, and write scope; run focused checks |
| finverse-data-analyst | `finverse-reporting-contract` | define fact-based metrics and attribution with worked examples |
| finverse-devops-engineer | `ponytail` | keep local tooling and CI setup lean |

The three `finverse-*` skills above are project-local skills in
`.claude/skills/`; they are intentionally absent from `skills-lock.json`.
Workers without a `Skill` tool can still use these preloaded skills. The QA
tester and access reviewer have Bash for targeted checks but no Write/Edit;
they report findings to their parent instead of fixing application code.
Future skill packs are mapped here only after installation and a concrete
role/task fit are verified.

---

## Known issues

### Unknown-skill error (2026-09-27)

**Issue:** The Skill tool returned `Unknown skill: writing-for-agents` even though
the skill appeared in `skills-lock.json`.

**Current evidence:** `.claude/skills/` exists and `writing-for-agents` was
successfully invoked via the Skill tool in Step 009. The Step 008 error did
not establish a persistent registration failure. If it recurs, inspect the
session's loaded skill list and the specific skill's frontmatter before
claiming a cause. Reading SKILL.md directly is not proof of Skill invocation.

**Status:** Historical transient error; no current directory issue.

### CLI auto-update warning (2026-09-27)

**Issue:** Running `claude skill list` in the terminal launched an interactive Claude
session instead of printing a skill list, and printed an unrecognized-model warning:
`"FREE-STACK-COMBO" isn't described by this version's model catalog`.

**Cause:** Two separate issues:
1. OmniRoute provides `FREE-STACK-COMBO` as the model route. Claude Code's local model
   catalog does not recognize this name and falls back to auto-compact at 200k tokens.
   This is expected behavior when using a custom model route via OmniRoute.
2. `claude skill list` does not print a machine-readable skill list; it opens an
   interactive conversation. This is a CLI behavior, not an error.

**Workaround for model warning:** This is expected. No action needed; OmniRoute selects
the actual model. To raise the context window, append `[1m]` to the model name or set
`CLAUDE_CODE_MAX_CONTEXT_TOKENS`.

**Status:** Expected behavior, not a bug. Documented separately from the unknown-skill error.

---

## Skill selection guidelines

1. **Prefer specific over general:** Use `tdd` for test-driven work, `diagnosing-bugs` for debugging.
2. **One workflow per task:** Do not run both `code-review` (Matt Pocock) and the built-in `code-review` on the same change; choose one.
3. **Check invocability:** Skills with `disable-model-invocation: true` in their frontmatter must be user-invoked and cannot be preloaded. This includes the project-local `implement`, `to-spec`, `to-tickets`, `wizard`, and `grill-me` skills. Do not have agents auto-invoke the built-in user-only commands either.
4. **Load before creating:** Always load `dataviz` before creating any chart; `artifact-design` before creating any artifact.
5. **In-progress skills:** Installed but not selected for this project's normal workflow; prefer stable alternatives.
6. **ECC agents ≠ skills:** ECC provides both agent definitions and skills. Do not reference ECC agent names in skill invocations.
