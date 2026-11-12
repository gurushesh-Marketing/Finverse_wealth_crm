---
name: finverse-knowledge-maintainer
description: Maintain deterministic knowledge graph freshness, track changed content, verify required symbols, and manage SQL indexing readiness.
---

# Finverse Knowledge Maintainer

Maintains deterministic Graphify knowledge graph freshness for Finverse CRM v2 using the project-local `.venv-graphify` environment.

## Capabilities & Workflows

1. **Deterministic Freshness Check**:
   Computes SHA-256 digests of indexable workspace files (matching `.graphifyignore`), comparing them against cached state in `.maintenance/knowledge_state.json`.
   ```powershell
   & ".\.venv-graphify\Scripts\python.exe" .agents/skills/finverse-knowledge-maintainer/scripts/freshness.py
   ```

2. **Incremental Refresh**:
   Executes bounded code-only extraction only when changes are detected, verifying that newly introduced symbols (such as `TlProspectDrillDownPage`) are captured in `graphify-out/graph.json`:
   ```powershell
   & ".\.venv-graphify\Scripts\python.exe" .agents/skills/finverse-knowledge-maintainer/scripts/freshness.py --refresh
   ```

3. **SQL Indexing Status**:
   - `tree_sitter_sql` is required for AST extraction of PostgreSQL migrations in `database/migrations/*.sql`.
   - When installed locally in `.venv-graphify`, migrations are parsed for tables, columns, indexes, and references.
   - If missing, SQL files contribute zero AST nodes and the limitation must be explicitly recorded.

4. **Dual Graph Rule**:
   - `graphify-requirements/graph.json`: Requirements, actions, brand handoffs (authoritative reference, do not overwrite with code extraction).
   - `graphify-out/graph.json`: Codebase symbol and dependency relationships.
