---
trigger: always_on
description: Maintain deterministic knowledge graph freshness, track changed content, and manage requirements and code graph pipelines for Finverse CRM v2.
---

## Finverse Knowledge Maintainer Rule

- Maintain knowledge graph freshness deterministically using the v2-local environment:
  `.\.venv-graphify\Scripts\graphify.exe`
- Always verify knowledge graph freshness before and after completed implementation slices.
- Two distinct Graphify knowledge graphs are maintained:
  1. **Requirements, Actions, Brand & Canonical Documents**: `graphify-requirements/graph.json`
     - Built and refreshed via: `& ".\.venv-graphify\Scripts\python.exe" scripts/build_requirements_graph.py`
     - Ingests `action_catalogue_v2.json`, `NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf`, brand guidelines, and all 8 canonical Markdown documents (`docs/product/prd.md`, `docs/design/design-system.md`, `docs/architecture/architecture.md`, `docs/architecture/trd.md`, `docs/product/app-flow.md`, `docs/design/design-flow.md`, `docs/architecture/backend-schema.md`, `docs/process/implementation-plan.md`).
     - Automatic caching in `graphify-requirements/extraction_cache.json` reuses unchanged extractions.
  2. **Codebase Structure & Relationships**: `graphify-out/graph.json`
     - Built and refreshed via: `& ".\.venv-graphify\Scripts\graphify.exe" extract . --code-only` (bounded by `.graphifyignore`).
- Query guidance:
  - Pass `--graph` explicitly to select the targeted graph:
    `& ".\.venv-graphify\Scripts\graphify.exe" query "<question>" --graph graphify-requirements/graph.json`
    `& ".\.venv-graphify\Scripts\graphify.exe" query "<question>" --graph graphify-out/graph.json`
- Inspect change freshness:
  `& ".\.venv-graphify\Scripts\python.exe" .agents/skills/finverse-knowledge-maintainer/scripts/freshness.py`
- Respect `.graphifyignore` and `.gitignore`. Never index `.venv-graphify/`, `logs/`, or `.maintenance/`.
