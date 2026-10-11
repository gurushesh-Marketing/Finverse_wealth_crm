# AGENTS.md — Finverse CRM v2

One CRM application for Wealth, Banking, Markets/Trading and Real Estate: one
domain, one shared login. The server resolves each employee's role, vertical and
team permissions and opens the authorized workspace. Authorization is enforced
on every server read and mutation — a hidden menu is not authorization.

## Document Index (Authoritative Sources)

Consult the canonical document governing the specific domain rather than guessing or searching unstructured files:

| Domain | Canonical File | Scope & Contents |
|---|---|---|
| **Product & Scope** | [`docs/product/prd.md`](docs/product/prd.md) | Product vision, 4 verticals, 10 workspaces, invariants, 135-action applicability matrix, open decisions `[Deck P320]`. |
| **Design System** | [`docs/design/design-system.md`](docs/design/design-system.md) | Authentic logo rules (1:1.22, unrecolored), brand palette (#113F3D..), typography (Manrope/Inter/Mono), single solid primary button rule, mobile tasks. |
| **Architecture** | [`docs/architecture/architecture.md`](docs/architecture/architecture.md) | Monorepo topology, multi-vertical isolation, deny-by-default security, atomic transactions, outbox pattern, async workers, user-approved SDLC & SOLID policy. |
| **Technical Specs** | [`docs/architecture/trd.md`](docs/architecture/trd.md) | REST API routes by role, standard error protocol, Zod contracts, OCC locking (`record_version`), idempotency keys, streaming PDFs, SOLID contract boundaries. |
| **Application Flows** | [`docs/product/app-flow.md`](docs/product/app-flow.md) | Auth flow, lead state machine (`Not Contacted -> Converted/Lost/Reopened`), tiered escalations (SC->TL->MG->RM->NM->CEO->CFO), referrals. |
| **UI/UX Interaction** | [`docs/design/design-flow.md`](docs/design/design-flow.md) | Six-zone workspace anatomy, drawer panel flows, mobile priority tasks & bottom sheets, modal dialogs, conflict resolution. |
| **Relational Schema** | [`docs/architecture/backend-schema.md`](docs/architecture/backend-schema.md) | Actual implemented schema (migrations 0001–0014) vs planned schema (`DE`, `HR`, `SA`), table invariants matrix. |
| **Execution Plan** | [`docs/process/implementation-plan.md`](docs/process/implementation-plan.md) | Phased roadmap, testing levels, 12 deck acceptance scenarios, compact Manager resume packet, SDLC role-completion protocol. |

## User-Approved Engineering Policies

### 1. Software Development Life Cycle (SDLC) Policy
Every operational role and functional feature must advance through the structured, evidence-led lifecycle:
```
requirements → analysis/design → planning → implementation → verification/remediation → authorized release → maintenance
```
- **Requirements:** Extracted from Action Deck (`action_catalogue_v2.json`, Deck P044..P312), brand guidelines, or explicit client decision categories (`[Deck P320]`).
- **Analysis & Design:** Specify exact state machine transitions, error codes, wireframe zone anatomy, and responsive mobile adaptations.
- **Planning:** Task chunking in `implementation-plan.md` with explicit dependencies and file paths before code writing.
- **Implementation:** Clean, type-safe TypeScript code with Zod validation contracts and zero hard-coded assumptions.
- **Verification & Remediation:** Automated test execution (API supertest suites, E2E specs, and browser styling proofs). Remediate failures immediately; never skip failing assertions.
- **Authorized Release:** Formal verification packet review with genuine executed evidence recorded in `STATUS.md`, `COVERAGE_MATRIX.md`, and `BUILD_LOG.md`.
- **Maintenance:** Deterministic knowledge graph freshness and regression prevention.

### 2. SOLID Architecture Principles in Practice
Applied across React components, TypeScript modules, services, and PostgreSQL repositories:
- **Single Responsibility (SRP):** Cohesive modules. A React component renders one specific zone/task; a repository handles data persistence for a specific domain entity; an API route handler validates input and delegates to domain functions.
- **Open/Closed (OCP):** System extensions (e.g. new vertical qualification rules or report schedules) use justified extension points and configuration schemas without mutating stabilized core transaction lifecycles.
- **Liskov Substitution (LSP):** Shared contracts defined in `@finverse/contracts` (Zod schemas and TypeScript types) guarantee that domain implementations can be substituted reliably across client and server.
- **Interface Segregation (ISP):** Clients depend only on the methods they use. React pages receive focused props; API repositories expose small, task-specific methods rather than fat generic interfaces.
- **Dependency Inversion (DIP):** Route handlers and business logic depend on data access abstractions, not low-level database socket handles. Pages consume typed client SDKs, avoiding direct ad-hoc HTTP calls.
- **Pragmatic Boundary Rule:** Apply SOLID to maintain clean boundaries; avoid unnecessary classes, extra boilerplate layers, or speculative frameworks.

### 3. Agreed Role Execution Protocol
When feature development is active, execute strictly role-by-role:
```
complete one role → test its actions → fix failures → check design → update knowledge → next role
```
Never jump ahead across multiple unfinished roles or claim completion without executed test and visual proof.

## Process Records (Read First at Session Start)

- `docs/process/STATUS.md` — current checkpoint, blockers, active processes, and exact next task
- `docs/process/COVERAGE_MATRIX.md` — action implementation/test evidence
- `docs/process/BUILD_LOG.md` — concise execution record with executed evidence
- `docs/process/TOOLING_INVENTORY.md` — roles, skills, runtime capabilities, and Graphify status

Always read the current checkpoint in `docs/process/STATUS.md` at session start, and update it (along with `COVERAGE_MATRIX.md` and `BUILD_LOG.md`) after each completed slice.

## Knowledge Graphs (Graphify Runtime)

Two distinct Graphify knowledge graphs are maintained deterministically:
- **Requirements, actions, brand, and canonical documents**: `graphify-requirements/graph.json`
- **Code relationships**: `graphify-out/graph.json`
Preserve both graphs.

Working executable (v0.9.69, invoked via PowerShell call operator `&` and quoted absolute path):
`& "C:\Users\gurus\Music\finverse wealth\CRM\finverse-crm-v2\.venv-graphify\Scripts\graphify.exe"`

Query rules:
- Query deck requirements, action catalog specifications, brand tokens, or canonical markdown documents:
  `& "C:\Users\gurus\Music\finverse wealth\CRM\finverse-crm-v2\.venv-graphify\Scripts\graphify.exe" query "<question>" --graph graphify-requirements/graph.json`
- Query codebase structure and symbol relationships:
  `& "C:\Users\gurus\Music\finverse wealth\CRM\finverse-crm-v2\.venv-graphify\Scripts\graphify.exe" query "<question>" --graph graphify-out/graph.json`
- Refresh requirements and canonical document graph:
  `& ".\.venv-graphify\Scripts\python.exe" scripts/build_requirements_graph.py` (caching reuses unchanged extractions automatically).
- Refresh code graph after a completed implementation slice:
  `& ".\.venv-graphify\Scripts\graphify.exe" extract . --code-only` (bounded by `.graphifyignore`).

## Agent Context & Resume Workflow

### At Each New Session:
1. **Read Current Checkpoint:** View `docs/process/STATUS.md` to identify the active milestone, existing blockers, and exact next task.
2. **Query Graph Requirements:** Query `graphify-requirements/graph.json` for the exact action or role requirements in scope.
3. **Load Minimal Canonical Context:** View only the specific canonical document sections or source deck pages needed for the task. **Do NOT load the entire graph or all documents into every prompt.**
4. **Resume Unfinished Work:** Continue the exact pending task without re-exploring stabilized systems.

### At Each Completed Batch:
1. **Update Affected Canonical Documents:** Synchronize any altered schema, flow, or contract details in `docs/`.
2. **Record Execution State:** Record executed evidence in `STATUS.md`, `COVERAGE_MATRIX.md`, and `BUILD_LOG.md`.
3. **Refresh Graph Content:** Run `scripts/build_requirements_graph.py` if documents changed, or code extraction if source changed.
4. **Checkpoint Next Step:** Record remaining work and the exact next task before finishing.

## IDE Capabilities & Team Roles

- **Single Main Builder Session:** In Antigravity IDE, the main Builder conversation owns all implementation, editing, and integration (sole implementation writer).
- **No Autonomous Delegation:** Antigravity does **not** support native worker delegation or custom agent registration. Written role briefs in `docs/process/roles/` are manual reference guidelines for human-initiated specialist conversations, not registered subagents.
- **Model Selection:** Recommend **Gemini Flash Medium** (`Gemini 3.8 Flash (Medium)`) by default. Command Code model pins in `.commandcode/agents/` do not configure Antigravity.
- **Stack & Execution:** pnpm workspace — `apps/web` (React 18 + Vite + Tailwind v4 + shadcn Base UI), `apps/api` (Express + TS), `packages/contracts` (Zod), `database/migrations` (PostgreSQL 16 Alpine on `:5433`).
- **Data Policy:** Demo data is synthetic only — never seed real customer or employee data. Never claim completion without executed evidence. Unresolved business rules stay labelled `[Deck P320]`.
