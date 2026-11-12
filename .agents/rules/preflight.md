# Finverse CRM v2 Preflight Rule

Always enforce these operational constraints before executing, modifying, or testing any part of Finverse CRM v2:

1. **v2-Local Tools**
   - Use the project-local virtual environment: `.\.venv-graphify\Scripts\graphify.exe` (Graphify 0.9.69) and `.\.venv-graphify\Scripts\python.exe`.
   - Never reference or invoke the discarded v1 environment (`finverse-crm`).
   - Do not install dependencies globally. Only compatible dependencies (`pypdf`, `tree_sitter_sql`) are installed inside `.venv-graphify`.

2. **Authoritative Stack**
   - pnpm workspace: `apps/web` (React, Vite, TypeScript, React Router, Tailwind v4, `@base-ui/react`), `apps/api` (Express, TypeScript), `packages/contracts` (shared Zod schemas), and `database` (PostgreSQL 16 on Docker host port 5433, versioned SQL migrations, simple repository layer).
   - Real credentials and database passwords are server-only and gitignored. Never expose credentials in client `VITE_*` variables or process docs.

3. **Observed Runtime Capabilities**
   - Antigravity IDE operates with a single implementation writer (Builder). Worker delegation, subagent spawning, and `.commandcode/agents/` configs do not configure Antigravity.
   - Recommended model: Gemini Flash Medium (`Gemini 3.8 Flash (Medium)`).

4. **Source-Backed Graph Relationships**
   - Maintain and preserve both distinct Graphify knowledge graphs:
     - Requirements, actions, brand, and handoffs: `graphify-requirements/graph.json`
     - Code relationships: `graphify-out/graph.json`
   - Every action handoff, prerequisite, and vertical applicability must be verified against source requirements:
     - `docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf`
     - `docs/product/action_catalogue_v2.json`
   - Never guess action IDs or fabricate cross-role workflows.

5. **Isolated Tests & Persistent Demo Data**
   - Automated tests must run in isolated namespaces (e.g. `FV-9...` leads, dedicated test prefixes for schedules and tasks).
   - Never perform broad table deletions (`DELETE FROM leads`, `DELETE FROM messages WHERE lead_id IS NULL`, etc.) that corrupt seeded demo users (`EMP-001`, `EMP-002`, `EMP-003`, etc.).
   - Make all test suites self-contained with explicit setup and targeted teardown.

6. **Accurate Checkpoints & Truthful Accounting**
   - Never claim completion without executed evidence. Record executed and proposed checks separately.
   - Reconcile `docs/process/STATUS.md`, `docs/process/COVERAGE_MATRIX.md`, and `docs/process/BUILD_LOG.md` after each completed slice.
   - Do not imply unbuilt workspaces (e.g. Manager, Regional Manager, National Manager, CEO) are complete. Do not start Manager development until prior role milestones pass independent review.
   - Unresolved business policies (such as capacity ceiling `20`) must be explicitly labelled `[ASSUMPTION]` until formal requirements establish them.
