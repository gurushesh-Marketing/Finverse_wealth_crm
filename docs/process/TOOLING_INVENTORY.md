# Tooling and Role Inventory — Finverse CRM v2

Last updated: 2026-10-04.
This record documents development roles, installed skills, runtime capabilities, model selection, and Graphify status for the Antigravity IDE environment.

---

## 1. Verification State Definitions

- **Installed**: File or binary is physically present on the local filesystem.
- **Discovered**: Recognized and indexed by Antigravity runtime (e.g. system prompt, active skills list, or rules). Note: role briefs in `docs/process/roles/` are manual reference documents on disk, NOT runtime-discovered or execution-verified subagents.
- **Execution-verified**: Tested by running actual shell/tool commands with captured real outputs in this workspace. Skill-use claims require executed evidence; otherwise they remain marked unverified.

---

## 2. Twelve-Role Mapping
 
Manual role briefs are available reference instructions, not runtime-discovered or execution-verified subagents. Antigravity IDE has no custom subagent delegation; all implementation is executed by the main Builder conversation.
 
| # | Role Responsibility | Brief Path | Filesystem (Installed) | Role Status | Write Permission | Primary Skills | Notes |
|---|---|---|---|---|---|---|---|
| 1 | `product-manager` | `docs/process/roles/product-manager.md` | Yes | Reference instruction (manual brief) | Read-only | `finverse-reporting-contract` | Absent: `domain-modeling`, `grilling` |
| 2 | `engineering-lead` | `docs/process/roles/engineering-lead.md` | Yes | Reference instruction (manual brief) | Read-only | `ponytail`, `diagnosing-bugs` | Absent: `codebase-design`, `domain-modeling`, `ponytail-review` |
| 3 | `frontend-builder` | `docs/process/roles/frontend-builder.md` | Yes | Reference instruction (manual brief) | Yes (`apps/web`) | `ponytail`, `tdd`, `design-taste-frontend` | Absent: `frontend-patterns`. Paired with Builder. |
| 4 | `backend-builder` | `docs/process/roles/backend-builder.md` | Yes | Reference instruction (manual brief) | Yes (`apps/api`, `packages/contracts`, `database/`) | `postgres-patterns`, `tdd`, `security-review`, `ponytail` | Absent: `backend-patterns`, `domain-modeling`. Paired with Builder. |
| 5 | `design-lead` | `docs/process/roles/design-lead.md` | Yes | Reference instruction (manual brief) | Read-only | `design-taste-frontend` | Reuses `designer.md` brand tokens |
| 6 | `ux-designer` | `docs/process/roles/ux-designer.md` | Yes | Reference instruction (manual brief) | Read-only | `design-taste-frontend` | Reuses `designer.md` state machine/density |
| 7 | `qa-lead` | `docs/process/roles/qa-lead.md` | Yes | Reference instruction (manual brief) | Read-only | `finverse-qa-execution`, `finverse-access-contract`, `finverse-reporting-contract` | Reuses `qa.md` readiness criteria |
| 8 | `qa-tester` | `docs/process/roles/qa-tester.md` | Yes | Reference instruction (manual brief) | Read-only (test artifacts only) | `finverse-qa-execution`, `diagnosing-bugs` | Reuses `qa.md` test commands |
| 9 | `access-reviewer` | `docs/process/roles/access-reviewer.md` | Yes | Reference instruction (manual brief) | Read-only | `finverse-access-contract`, `security-review` | Reuses `reviewer.md` scope tracing |
| 10 | `security-reviewer` | `docs/process/roles/security-reviewer.md` | Yes | Reference instruction (manual brief) | Read-only | `security-review`, `finverse-access-contract`, `postgres-patterns` | Reuses `reviewer.md` security audit |
| 11 | `data-analyst` | `docs/process/roles/data-analyst.md` | Yes | Reference instruction (manual brief) | Read-only | `finverse-reporting-contract` | Absent: `domain-modeling` |
| 12 | `devops-engineer` | `docs/process/roles/devops-engineer.md` | Yes | Reference instruction (manual brief) | Yes (tooling/CI only) | `ponytail`, `diagnosing-bugs` | Paired with Builder |

**Composite briefs retained:**
- `docs/process/roles/builder.md` — Full-stack Builder & Coordinator (sole implementation writer)
- `docs/process/roles/designer.md` — Product Designer (brand, accessibility, states)
- `docs/process/roles/qa.md` — QA Engineer (independent verification)
- `docs/process/roles/reviewer.md` — Security & Code Reviewer (access, isolation, security)

---

## 3. Skill Inventory (`.agents/skills/`)
 
| Skill Directory | Filesystem (Installed) | Discovered in Antigravity | Execution-Verified | Applicable Roles |
|---|---|---|---|---|
| `design-taste-frontend` | Yes (`.agents/skills/design-taste-frontend/SKILL.md`) | Yes | Unverified (no executed command log) | `design-lead`, `ux-designer`, `frontend-builder` |
| `diagnosing-bugs` | Yes (`.agents/skills/diagnosing-bugs/SKILL.md`) | Yes | Unverified (no executed command log) | `qa-tester`, `engineering-lead`, `devops-engineer` |
| `finverse-access-contract` | Yes (`.agents/skills/finverse-access-contract/SKILL.md`) | Yes | Unverified (no executed command log) | `access-reviewer`, `security-reviewer`, `qa-lead` |
| `finverse-qa-execution` | Yes (`.agents/skills/finverse-qa-execution/SKILL.md`) | Yes | Unverified (no executed command log) | `qa-lead`, `qa-tester` |
| `finverse-reporting-contract` | Yes (`.agents/skills/finverse-reporting-contract/SKILL.md`) | Yes | Unverified (no executed command log) | `data-analyst`, `product-manager`, `qa-lead` |
| `graphify` | Yes (`.agents/skills/graphify/SKILL.md`) | Yes | Yes (v0.9.69 extract & query executed) | All roles (codebase & requirements navigation) |
| `ponytail` | Yes (`.agents/skills/ponytail/SKILL.md`) | Yes | Unverified (no executed command log) | `frontend-builder`, `backend-builder`, `engineering-lead`, `devops-engineer` |
| `postgres-patterns` | Yes (`.agents/skills/postgres-patterns/SKILL.md`) | Yes | Unverified (no executed command log) | `backend-builder`, `security-reviewer` |
| `security-review` | Yes (`.agents/skills/security-review/SKILL.md`) | Yes | Unverified (no executed command log) | `security-reviewer`, `access-reviewer`, `backend-builder` |
| `tdd` | Yes (`.agents/skills/tdd/SKILL.md`) | Yes | Unverified (no executed command log) | `frontend-builder`, `backend-builder` |

**Built-in IDE Skills (Discovered):**
- `agy-customizations`: Built-in IDE skill.
- `antigravity-guide`: Built-in IDE skill.

**Absent Skills (Explicitly Marked — do not install packs):**
- `domain-modeling`: Absent from `.agents/skills/`.
- `codebase-design`: Absent from `.agents/skills/`.
- `ponytail-review`: Absent from `.agents/skills/`.
- `frontend-patterns`: Absent from `.agents/skills/`.
- `backend-patterns`: Absent from `.agents/skills/`.
- `grilling`: Absent from `.agents/skills/`.

---

## 4. Runtime Capabilities & Model Selection

- **Antigravity IDE Subagent Reality**:
  - The runtime **does not support custom subagent registration** or worker delegation tools. Only `browser_subagent` is available.
  - Roles cannot be automatically dispatched or orchestrated by background agents.
  - Each role brief is an honest guide for a human opening a **separate conversation** and passing structured task packets.
  - **One implementation writer**: Only the Builder conversation edits application code, database migrations, or shared contracts.
- **Model Selection Method**:
  - Recommended Model: **Gemini Flash Medium** (`Gemini 3.8 Flash (Medium)`).
  - Selected directly via the Antigravity chat UI model selector dropdown.
  - Command Code model pins (`model:` lines in `.commandcode/agents/*.md`), tool lists, and `maxTurns` do not configure the Antigravity IDE.

---

## 5. Graphify Registration and Graph Status

- **Working Executable**:
  - Path: `C:\Users\gurus\Music\finverse wealth\CRM\finverse-crm-v2\.venv-graphify\Scripts\graphify.exe`
  - Version: `0.9.69` (execution-verified via Python importlib.metadata).
  - Invocation Method (PowerShell): Must invoke with call operator `&` and quoted path:
    `& "C:\Users\gurus\Music\finverse wealth\CRM\finverse-crm-v2\.venv-graphify\Scripts\graphify.exe" <command>`
  - Note: The generic launcher previously failed with `"uv trampoline failed to canonicalize script path"`. Do not modify global PATH or reinstall tools.
- **Registration Artifacts**:
  - Rule: `.agents/rules/graphify.md` (Updated: query-first applies only when `graphify-out/graph.json` exists; update after completed implementation slice).
  - Workflow: `.agents/workflows/graphify.md` (Discovered).
  - Skill: `.agents/skills/graphify/SKILL.md` (Discovered).
  - Ignore file: `.graphifyignore` created to bound extraction to `apps/`, `packages/`, and `database/migrations/` (excluding `.agents/`, `.commandcode/`, `docs/`, `*.log`, `node_modules/`, `dist/`).
- **Graph Status**:
  - **Built & Execution-verified**: Bounded code-only index extracted and clustered.
  - Artifacts present:
    - `graphify-out/graph.json`: 859 nodes, 1859 edges, 34 communities.
    - `graphify-out/GRAPH_REPORT.md`: Audit report generated.
    - `graphify-out/graph.html`: Visualizer generated.
    - `graphify-out/.graphify_analysis.json`: Analysis sidecar generated.
- **Query Demonstration (Execution-verified)**:
  - Command: `& "C:\Users\gurus\Music\finverse wealth\CRM\finverse-crm-v2\.venv-graphify\Scripts\graphify.exe" query "TL decision handling"`
  - Result: BFS traversal found 19 nodes, starting at `DecisionForm()` (`apps/web/src/pages/TlPages.tsx:L522`), tracing calls to `label()`, `TlQualityPage()`, and related navigation routes.
- **Precise Blocker / Missing Dependency**:
  - AST extraction reported: `warning: 6 .sql file(s) contributed nothing to the graph because a dependency is missing: tree_sitter_sql not installed`.
  - In accordance with constraints (no tool reinstallation / environment modification), this limitation is documented: SQL migration files in `database/migrations/` are detected but their internal AST is unparsed due to missing `tree_sitter_sql`. TypeScript/JavaScript code across `apps/` and `packages/` is fully indexed.
