# Model assignments

Status: **definitions created 2026-09-30 (Step 015), runtime validation
pending.** The 12 project agent definitions exist in `.commandcode/agents/`
with the exact `model` pins below. None has been runtime-tested in Command
Code, and live model availability has not been confirmed. Do not claim a
validated agent run until one is recorded. Verify each model ID against the
live model catalog (`cmd --list-models`) before the first execution.

Model IDs are recorded exactly as proposed for this project. A proposed ID
here is not confirmation that the catalog serves it.

---

## Assigned models (pinned in `.commandcode/agents/` frontmatter)

| Agent | Model | maxTurns | Tools |
|---|---|---|---|
| Main coordinator (session) | `xiaomi/mimo-v2.6-pro` | — | session default |
| finverse-product-manager | `xiaomi/mimo-v2.6-pro` | 15 | read/search |
| finverse-design-lead | `xiaomi/mimo-v2.6-pro` | 15 | read/search |
| finverse-ux-designer | `xiaomi/mimo-v2.6-pro` | 15 | read/search |
| finverse-frontend-builder | `deepseek/deepseek-v4-pro` | 40 | read/search + edit/write + shell |
| finverse-engineering-lead | `deepseek/deepseek-v4-pro` | 15 | read/search |
| finverse-backend-builder | `deepseek/deepseek-v4-pro` | 40 | read/search + edit/write + shell |
| finverse-data-analyst | `deepseek/deepseek-v4-pro` | 15 | read/search |
| finverse-qa-tester | `z-ai/glm-5.3-flash` | 25 | read/search + shell |
| finverse-devops-engineer | `z-ai/glm-5.3-flash` | 20 | read/search + edit/write + shell |
| finverse-access-reviewer | `zai-org/glm-5.3` | 15 | read/search |
| finverse-qa-lead | `zai-org/glm-5.3` | 15 | read/search |
| finverse-security-reviewer | `gpt-5.6-sol` | 15 | read/search |
| Reserve — architecture reviewer | `qwen/qwen3.8-max-0902` | — | not created |
| Reserve — difficult-defect escalation | `moonshotai/kimi-k3` | — | not created |
| Optional headless classification helper | `typesafe/jev` | — | not created |

All definitions inherit the session permission mode (`background: false`,
`showOutput: true`; no `permissionMode` or `reasoningEffort` override). The
three reserve/helper entries remain planned only — no definitions exist.

## Budget — planning controls only

- Plan for **30 shared GOAT credits** during the weekly window.
- **Reserve 5 credits for recovery**; treat 25 as the working budget.
- Respect the **14-credit five-hour window** when scheduling bursts of work.
- Use **actual `/usage` readings where available** as the ground truth for
  consumption.
- These are **planning controls, not enforced spending limits**. Nothing here is
  metered by the runtime. **Never invent actual consumption** — record only
  readings that were really observed.
- The `maxTurns` values bound individual agent runs; they are not a monetary
  budget.

## Escalation reserves

- `qwen/qwen3.8-max-0902` — architecture review reserve; engage only after the
  one permitted model escalation in `COMMANDCODE_WORKFLOW.md` §6.
- `moonshotai/kimi-k3` — difficult-defect escalation reserve; same gate.
- `gpt-5.6-sol` — security review (finverse-security-reviewer exists); human
  authorization for production remains required regardless of model.
- `typesafe/jev` — optional headless classification helper; not part of the
  core delivery chain.
