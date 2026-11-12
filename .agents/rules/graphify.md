---
trigger: always_on
description: Consult the graphify knowledge graph at graphify-out/ for codebase and architecture questions when graph.json exists.
---

## graphify

Two distinct Graphify knowledge graphs are maintained:
- **Requirements, actions, brand, and handoffs**: `graphify-requirements/graph.json`
- **Code relationships**: `graphify-out/graph.json`
Preserve both graphs.

Working executable (v0.9.69, invoked via PowerShell call operator `&` and quoted absolute path):
`& "C:\Users\gurus\Music\finverse wealth\CRM\finverse-crm-v2\.venv-graphify\Scripts\graphify.exe"`
(Do not use the generic launcher; it fails with "uv trampoline failed to canonicalize script path". Do not repair global PATH or reinstall tools.)

Rules:
- Pass `--graph` explicitly to select the appropriate graph:
  - For deck requirements, action catalog specifications, and brand handoffs:
    `& "C:\Users\gurus\Music\finverse wealth\CRM\finverse-crm-v2\.venv-graphify\Scripts\graphify.exe" query "<question>" --graph graphify-requirements/graph.json`
  - For codebase structure and code relationships (when `graphify-out/graph.json` exists):
    `& "C:\Users\gurus\Music\finverse wealth\CRM\finverse-crm-v2\.venv-graphify\Scripts\graphify.exe" query "<question>" --graph graphify-out/graph.json`
- Prefer exact action-node lookup or `explain "<node>"` when broad queries return unrelated actions.
- Read `full_text` and referenced source pages, not shortened labels.
- If `graphify-out/wiki/index.md` exists, navigate it instead of reading raw files.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review or when query/path/explain do not surface enough context.
- Update the code graph **after a completed implementation slice**, not after every individual file edit:
  `& "C:\Users\gurus\Music\finverse wealth\CRM\finverse-crm-v2\.venv-graphify\Scripts\graphify.exe" extract . --code-only` (bounded by `.graphifyignore`).
