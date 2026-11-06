# AGENTS.md — Finverse CRM v2

For the 31 October production target, read `docs/process/RELEASE_2026-10-31.md` and update `docs/process/RELEASE_ISSUES.md` before claiming a defect fixed or a release gate passed. These files coordinate the existing delivery standard; they do not override it.

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
| **WhatsApp CRM (deferred)** | [`docs/product/whatsapp-crm-integration.md`](docs/product/whatsapp-crm-integration.md) | After SA/HR acceptance: evaluate wacrm versus a focused Meta Cloud API adapter; preserve Finverse lead/role ownership and honest simulator labels. |
| **UI/UX Interaction** | [`docs/design/design-flow.md`](docs/design/design-flow.md) | Six-zone workspace anatomy, drawer panel flows, mobile priority tasks & bottom sheets, modal dialogs, conflict resolution. |
| **Relational Schema** | [`docs/architecture/backend-schema.md`](docs/architecture/backend-schema.md) | Actual implemented schema (migrations 0001–0014) vs planned schema (`DE`, `HR`, `SA`), table invariants matrix. |
| **Execution Plan** | [`docs/process/implementation-plan.md`](docs/process/implementation-plan.md) | **Single Authoritative Delivery Standard & Canonical Workflow**: Universal 6-step loop, Action Deck grounding, navigable implementation traceability chain, post-deployment corrections, testing levels, 12 deck acceptance scenarios. |

## Mandatory Delivery Standard & Canonical Workflow

All work across **all verticals (Wealth, Banking, Markets/Trading, Real Estate)**, **Horizontals (Data Entry, HR, Superadmin)**, and **Executives (CEO, CFO)** is strictly governed by the canonical standard in [`docs/process/implementation-plan.md`](docs/process/implementation-plan.md). Parallel or competing workflows are prohibited.

### 1. The Universal Task Sequence (Every Task Follows This Sequence)
```
Resume Checkpoint → Retrieve Relevant Knowledge → Inspect Requirements & Implementation → Smallest Appropriate Change → Verify Affected Behavior → Update Checkpoint & Knowledge
```
- **Resume:** Read `docs/process/STATUS.md` for active milestone, blockers, and exact next task.
- **Retrieve:** Query `graphify-requirements/graph.json` (`& ".\.venv-graphify\Scripts\graphify.exe" query "<q>" --graph graphify-requirements/graph.json`) to locate action nodes and deck pages.
- **Inspect:** Ground every design and function in the canonical Action Deck (`docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf` P001..P320) and brand system (`docs/design/design-system.md`). Inspect actual PDF pages and extracted screens (`evidence/`), never shortened text summaries. Inspect existing shared components before writing code.
- **Change:** Implement the smallest appropriate, type-safe change with Zod contracts and pragmatic SOLID boundaries.
- **Verify:** Run tests against the self-hosted Supabase PostgreSQL service, verify monorepo typecheck/lint/build, and capture live browser screens across Desktop (`1536x800`) and Mobile (`390x844`) after data loads.
- **Update:** Update `STATUS.md`, `BUILD_LOG.md`, and `COVERAGE_MATRIX.md`; refresh both knowledge graphs deterministically.

### 2. Post-Deployment Corrections Protocol
For each reported issue:
1. Identify deployed revision and reproduce symptom on live PostgreSQL.
2. Retrieve affected requirement, implementation, and cross-vertical dependencies.
3. Assess whether shared components or other verticals are affected.
4. Make smallest justified forward fix using compatible migrations; never drop or wipe production data.
5. Verify failed behavior and run regression checks across affected workspaces.
6. Update affected documentation and knowledge graphs.

### 3. Traceability Chain
Every requirement must maintain navigable references:
`Deck Page → Action ID → Route/Component → Contract/Service → DB Table/Migration → Test/Evidence`.

## User-Approved Engineering Policies

### 0. Mandatory Action Deck Grounding & Continuous Memory Policy
- **Zero Hallucination / Zero Stripped-Down UI:** Every operational role and vertical dashboard (Wealth, Banking, Markets, Real Estate) must strictly follow the visual layouts, metrics, zones, and contracts defined in the canonical Action Deck PDF (`docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf`, P001..P320) and the Graphify requirements graph (`graphify-requirements/graph.json`).
- **Never Simplify Dashboards:** Every role workspace must render full visual detailing: institutional breadcrumb, preview notice, vertical scope badge (e.g. `Banking scope` with shield), hero priority card in brand dark teal (`#113F3D`), operating signals with 7-day sparklines, needs-attention breakdowns, commitments table, and the right-rail 3-card guidance stack (`HOW THIS WORKS`, `WHEN A CHECK FAILS`, `PERMISSION & EVIDENCE`).
- **Continuous Knowledge Graph Maintenance:** After every completed slice or change, deterministically refresh both knowledge graphs (`python scripts/build_requirements_graph.py` and `graphify extract . --code-only`), and update `STATUS.md`, `COVERAGE_MATRIX.md`, and `BUILD_LOG.md`.

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
- **Stack & Execution:** pnpm workspace — `apps/web` (React 18 + Vite + Tailwind v4 + shadcn Base UI), `apps/api` (Express + TS), `packages/contracts` (Zod), `database/migrations` (CRM schema inside self-hosted Supabase PostgreSQL).
- **Data Policy:** Demo data is synthetic only — never seed real customer or employee data. Never claim completion without executed evidence. Unresolved business rules stay labelled `[Deck P320]`.
