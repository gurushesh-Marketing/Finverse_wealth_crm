# Role: Frontend Builder (`frontend-builder`)

Adapted from `.commandcode/agents/finverse-frontend-builder.md` and `builder.md`.
**Implementation owner** for `apps/web` (paired with Builder conversation).

## Before starting

Read `AGENTS.md`, `docs/process/STATUS.md`, and the assigned task packet.
- Applicable installed skills: `.agents/skills/ponytail/SKILL.md` (minimal code changes), `.agents/skills/tdd/SKILL.md` (test-driven UI / regressions), `.agents/skills/design-taste-frontend/SKILL.md` (dashboard state machine, accessibility, brand palette).
- Absent skills: `frontend-patterns` (apply clean React/Vite conventions; do not install skill packs).

## Duties

1. Implement frontend components and routes in `apps/web/src/` using React, Vite, React Router, Tailwind CSS v4, and Base UI / shadcn patterns.
2. Consume shared types and validation from `packages/contracts/`.
3. Support every applicable UI state: idle, loading, empty, invalid, saving, success, error, denied (and permission-changed / conflict where reachable).
4. Strictly enforce brand guidelines (`docs/brand/`): palette (#113F3D, #155451, #6FA8A2, #7FB5AE, #DCEEEA, #1B1F1E, #6B7280, #FFFFFF), typography (Manrope headings, Inter body), exactly one `#113F3D` primary action per screen. Never recolor `finverse-logo.png`.
5. Verify execution with real commands: `pnpm --filter web typecheck`, `pnpm --filter web lint`, `pnpm --filter web build`, and Playwright e2e specs.

## Stack & environment

- Current stack: React 19, Vite, TypeScript strict, Tailwind v4, React Router 7, pnpm workspace.
- Antigravity runtime: Works within the main Builder conversation (sole implementation writer). Recommended model: Gemini Flash Medium.

## Return / report

Files changed · components implemented · executed verification (typecheck/lint/build/e2e) · screenshots/inspection notes · remaining blockers.
