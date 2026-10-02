# Project status

Last updated: 2026-10-01 (Step 025 — branding complete+verified; goal INCOMPLETE, Parts 3–6 pending)

> **GOAL HANDOFF (read first):** Wealth Caller SC-01…SC-28 completion gate → TL-01…TL-18. Track every row in `docs/process/COVERAGE_MATRIX.md`. **Part 2 (branding) is DONE and verified**: `apps/web/public/finverse-logo.png` = faithful crop of the NEW Finverse Logo.pdf artwork (original colors), applied to login + Sidebar + MobileNav; exact tokens applied (primary #113F3D/#155451, sage #6FA8A2/#7FB5AE, mint #DCEEEA, ink #1B1F1E, muted #6B7280, white #FFFFFF; navy/gold removed); Manrope headings + Inter body verified `loaded` in browser (computed colours exact). **Next (Parts 3–6, dependency order):** build the Wealth Caller workspace — nav expansion to the deck's 8 SC items (My day, Lead Inbox, Conversations, Calendar & tasks, My pipeline, Documents, Performance, Reviews & help; expect nav-test label updates), then SC-01…SC-28 per the matrix entry points and the full catalogue contracts (SC-15…SC-28 records still to be read in full from `action_catalogue_v2.json`), caller memory + provider simulators + PDF report (SC-27), then the completion-gate verification suite and final handoff. Preview: http://localhost:3000 (restore after restarts). Demo accounts: `ravi@`/`sana@`/`asha@finverse.demo`, password `demo1234` (Wealth caller = asha). Evidence: scratchpad `visual/` (brand-*/before-*/after-*/deck-*); logo source render verified. Tooling: `read_file` refuses PDFs (headless-Edge render instead — PDF viewer zoom is nondeterministic, crop from a known-good render); scratchpad env rotates across compactions (use absolute paths to the 10804061-… scratchpad); PowerShell cwd persists; lint carries 3 known `no-img-element` warnings on logo imgs + 5 fixture.ts warnings. Latest results: Playwright 4/4, lint 0 errors, build PASS.

---

## Current checkpoint

**Phase:** Banking milestone 1 delivered in the shared app — shared login → Banking caller dashboard → assigned lead queue → prospect detail → validated follow-up save with durable persistence. Journey tests 4/4 green.

**Completed:**
- Step 001–013: foundation through Phase 0 (see BUILD_LOG history)
- Step 014–017: Command Code foundation, 12 agents, 17 skills, execution guardrails
- Step 018–019: FV-CYCLE1 nav repair (builder timeout) and independent verification
- Step 020–021: Caller journey batch 1 (Wealth, partial — see blockers), shared-app architecture clarification
- Step 022: **Banking milestone 1 implemented directly by the main session** — persistent local SQLite database (node:sqlite, zero new dependencies) with synthetic seed; shared login + server-resolved WorkspaceSession (role/vertical/team/permissions) with permission-based landing; Banking caller dashboard, assigned lead queue (search/filters/empty state), prospect detail (summary/tasks/timeline, honest `SIMULATED — no provider integration` Call/WhatsApp controls); SC-11 follow-up save (future due + action + purpose validation) writing task + timeline activity + lead update through the repository interface; every read/mutation session-scoped server-side. Verified: 4/4 Playwright tests green, lint 0 errors, build PASS, durable rows confirmed on disk.

**Committed at:** 9df1a6e (Steps 014–022 uncommitted)

---

## Implemented URLs (localhost preview, http://localhost:3000 — user's server, preserved)

- Increment 1 (storage + seed): `apps/web/.data/finverse.db` (gitignored) — users/assignments/sessions/leads/lead_tasks/lead_activities, illustrative seed data
- Increment 2 (shared auth + landing): **http://localhost:3000/login** (one login for all verticals; demo users `ravi@` / `sana@` / `asha@finverse.demo`, password `demo1234`)
- Increment 3 (journey screens): **http://localhost:3000/banking/dashboard**, **http://localhost:3000/banking/clients** (queue), **http://localhost:3000/banking/clients/FV-2003** (detail + follow-up)
- Increment 4 (persistence): logout/login round-trip verified by test; durable rows verified on disk

---

## Verification evidence (Step 022)

- **Playwright (Chromium, --retries=0): 4/4 PASS (8.0s)** — journey: login → permission landing → scoped queue + search → detail + simulated labels → follow-up validation (purpose required, future-due) → save → tasks/timeline update → logout/login persistence; isolation: cross-caller (Sana ↛ Ravi's FV-2003) and cross-vertical (Asha denied on banking record); nav: Wealth SC sidebar isolation + banking route denied state.
- **Lint:** exit 0 — 0 errors, 5 known unused-import warnings in preserved Wealth `fixture.ts` (unchanged).
- **Build:** exit 0 — routes `/`, `/login`, `/banking/dashboard`, `/banking/clients`, `/banking/clients/[id]`, `/wealth/dashboard`.
- **Persistence:** saved follow-up row durable in `.data/finverse.db` (`TASK-1790852622732` on FV-2003, "Follow-up call / Confirm documents") — process-independent storage; a restarted app reads the same file. Full two-process restart check was cut short (QA turn limit; its `pnpm start` on :3100 failed) — file-level evidence stands in its place, recorded honestly.
- **Independent QA (bg-5-769c335e):** ran 54 tool uses over 856s and **hit its maxTurns (25) before returning a final report** — incomplete verdict, but its partial findings drove two real fixes (see below). No processes left behind (:3100 free; user preview :3000 preserved throughout).

**Defects found and fixed during verification:**
1. SC action grants omitted `deal.read` (broke the 5-link sidebar contract) — fixed to fixture-contract parity.
2. Sidebar footer displayed the fixture session instead of the live session — fixed (session prop).
3. Native `required` validation swallowed server error messages — switched to server-driven validation for consistent `role="alert"` display.
4. Spec races (login redirect and GET-form navigation landing after clicks) — synchronized with `waitForURL`.

---

## Remaining gaps

- SC-06 dialer states / SC-09 WhatsApp sending: simulated label-only controls (explicitly out of scope).
- SC-04/05/08/10/12–SC-28 (incl. qualification, documents, TL+ surfaces): not built.
- Wealth journey batch (Step 020 blockers B1–B4): pending authorized continuation; preserved `types.ts`/`fixture.ts` work intact and now extended (FollowUpInput/ILeadFollowUpRepository, `isOverdue`).
- App-restart persistence proven at file level only; a clean two-instance restart check remains a QA item.
- [ASSUMPTION] items A1–A8 from the design spec still await Finverse decisions.
- Production authentication, real API/database, communication integrations: future deliverables — this milestone is fixture/seed-based demo behavior, explicitly not production authorization.

---

## Notes

- Local database approach: `node:sqlite` (built-in; zero new packages) at `apps/web/.data/finverse.db`, behind the typed repository interfaces (`IWealthLeadRepository`, `ILeadFollowUpRepository`). Auth: scrypt-hashed demo passwords, SHA-256 session tokens in HttpOnly cookies, server-resolved `WorkspaceSession` on every request.
- URL/role/vertical parameters grant nothing: all repository methods take the session explicitly and scope in the SQL itself.
- Retry discipline this step: each conditioned re-run targeted a distinct newly-diagnosed failure (4 suite runs total); no identical command was ever rerun unchanged.
