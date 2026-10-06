# Wealth Sales Caller (SC-01–SC-28) Independent Review Packet

**Date**: 2026-10-04  
**Author**: Builder  
**Review Target**: Independent QA Lead, QA Tester, Access Reviewer  
**Scope**: Wealth Sales Caller SC-01 through SC-28 conformance against Action Deck (P006–P007, P043–P098) and Corrective Audit Milestone (Batches A–E)  
**Status**: BUILDER-VERIFIED; PENDING INDEPENDENT REVIEW GATE (Builder does not self-certify independent acceptance)

---

## 1. Executive Summary & Verification Evidence

All 28 Wealth Sales Caller actions have been audited and corrected to conform directly with the approved Action Deck and Action Catalogue v2.

### Executed Test Evidence
- **Automated API Acceptance**: 26/26 test groups PASS (`node --import tsx --test test/wealth.api.test.ts` against isolated `finverse_test`).
- **End-to-End Journey Suite**: 16/16 test groups PASS (`node --import tsx --test test/journey.api.test.ts` against isolated `finverse_test`, including mixed-role grant isolation regression).
- **TypeScript Typecheck**: PASS with 0 errors (`pnpm typecheck` across `packages/contracts`, `apps/api`, `apps/web`).
- **ESLint**: PASS with 0 errors (`pnpm --filter @finverse/web lint`).
- **Production Build**: PASS (`pnpm --filter @finverse/web build` built in 1.06s).
- **Whitespace / Formatting**: `git diff --check` passed clean (0 errors).
- **Working Tree Status**: Active working copy is dirty with uncommitted v2 changes and untracked artifacts (per AGENTS.md rules, not committed/pushed).
- **Persistent Demo Data**: Cleanly preserved and isolated on Docker PostgreSQL port 5433 (`finverse_crm`); demo caller `Asha Rao` (`EMP-001`, `E-CALLER-01`) intact.

---

## 2. Key Audited & Corrected Actions

| Action ID | Deck Pages | Description & Deck Conformance | Executed Fix / Verification |
|---|---|---|---|
| **SC-01** | P006–P007, P043–P044 | Start day & prioritize: dark emerald `#113F3D` priority card, 4 metric cards (`Due today`, `Overdue`, `Contacted / eligible`, `Wins / target`), trend curve, attention rows, today's commitments, opportunity pipeline, shortcuts. | Resolved PostgreSQL 500 error in `daySignal` (`GROUP BY 1 ORDER BY date_trunc`), joined `leads` for prospect names, redesigned `MyDayPage.tsx`. Recorded in `dashboard_top_1791132723367.png`. |
| **SC-02** | P045–P046 | Lead inbox & saved views: 5-filter bar (Search, Stage, Due, Product, Source), Deck P045 columns (`REFERENCE`, `PROSPECT / SEARCH`, `STAGE`, `STATE / DUE`, `NEXT`), saved views. | Added missing `product` filter parameter to `packages/contracts`, `repo/leads.ts`, and `LeadInboxPage.tsx`. Recorded in `sc02_guidance_1791133374276.png`. |
| **SC-03** | P047–P048 | Prospect record hub: green avatar banner, large name/phone, quick actions, split Customer Context and Recent History preview. | Redesigned `ProspectPage.tsx` header layout to match Deck P047 with avatar, Call/WhatsApp/Edit buttons, and split cards. Recorded in `sc03_guidance_1791133476300.png`. |
| **SC-04** | P049–P050 | Correct prospect information: display name, phone, email, language, required reason, audit history expander. | Aligned `EditDetailsDrawer` with Deck P049. Recorded in `sc04_edit_details_1791133523854.png`. |
| **SC-05** | P051–P052 | Permitted self-sourced enquiry: prospect name, verified phone, product, source, permission evidence, duplicate check. | Aligned `NewEnquiryDialog` with Deck P051. Recorded in `sc05_new_enquiry_1791133410947.png`. |
| **SC-06** | P053–P054 | Voice call: simulated provider, connecting/ringing/connected/ended state machine, mute/unmute, duration timer. | Verified call simulation and truthful SIMULATED label. Recorded in `sc06_call_dialog_1791133583404.png`. |
| **SC-07** | P055–P056 | Wrap-up & next action: disposition, need confirmed, notes, next action, dueAt; atomic task update. | Single-save constraint, stage progression, and timeline event persistence verified. |
| **SC-08** | P057–P058 | Manual call logging: manual tag, 24h backdating window, future times blocked, reason, outcome. | Verified manual activity form and truthful label. |
| **SC-09** | P059–P060 | Approved WhatsApp: template selection, variable merge preview, simulated delivery, opt-out check. | Verified template gating and preview. Recorded in `sc09_whatsapp_dialog_1791133612443.png`. |
| **SC-10** | P061–P062 | Inbound reply / missed call: matched inbound queue, supervisor routing for unmatched items. | Verified deduplication and matching on `/wealth/conversations`. |
| **SC-11..14** | P063–P070 | Follow-ups, callbacks, task state transitions, and conflict-checked meeting bookings. | Reminder jobs executed via DB; reschedule preserves `original_due_at`; owner-only transitions; conflict check verified. |
| **SC-15..17** | P071–P076 | Qualification & fit checklist, pipeline stage progression, proposal draft/approval lifecycle. | Illegal stage jumps blocked; caller self-approval blocked; proposal review gate verified. |
| **SC-18..20** | P077–P082 | Document requests, genuine evidence upload, conversion approval submission. | Token expiry enforced; real disk upload with SHA-256; distinct `returned` state and caller resubmission verified. |
| **SC-21..24** | P083–P090 | Mark lost, reopen request, cross-vertical referral, opt-out suppression. | Converted protection; pending reopen queue; sender status-only view; immediate suppression of voice & WhatsApp outreach. |
| **SC-25..28** | P091–P098 | Personal performance KPIs, review acknowledgement, binary PDF export, metric blockers. | Formulas expanded with real event counts; acknowledgement is not agreement; real binary PDF (`%PDF`) export. |

---

## 3. Access & Security Hardening (Batches C & D and Focused Corrections)

1. **Restored Approved Caller Sections & Grants**:
   - `deal.read`, `deal.update`, `document.request`, `document.read`, and `review.acknowledge` added to `ROLE_ACTIONS.SC` in `apps/api/src/repo/users.ts`.
   - Effective dated assignments with future end dates (`effective_to > CURRENT_DATE`) properly resolved.
2. **Consistent Role & Vertical Grant Isolation**:
   - `buildContext` in `users.ts` scopes `verticals` and `teams` strictly to `roleRows` (the active role's assignments). Different-role assignments (e.g. TL in Banking) cannot expand the selected role's permissions or verticals (e.g. SC in Wealth).
   - Verified via regression test in `journey.api.test.ts`.
3. **Direct Route Isolation**:
   - Route guard in `apps/web/src/App.tsx` prevents Caller from directly browsing `/management/*` routes (redirects to `/wealth/dashboard`).
4. **Server-Side Role Guarding**:
   - Write mutations (`requireLeadForWrite`, `createFollowUp`, `bookMeeting`) reject non-`SC` callers with 403 (FORBIDDEN).
5. **Dedicated Test Database & Test Guard**:
   - Tests execute against dedicated `finverse_test` database on port 5433 (`TEST_DATABASE_URL`).
   - `assertTestDatabaseGuard` prevents tests from running against or mutating the persistent demo database `finverse_crm`.
   - Automated tests run exclusively within run-scoped namespaces (`FV-9...`).

---

## 4. Unresolved Assumptions & Boundaries

- **Simulated Providers**: Comms providers (telephony, WhatsApp, virus scanning) are simulated and explicitly labelled `SIMULATED` in the UI per project rules.
- **Independent Acceptance Gate**: The Builder presents this packet and executed evidence for independent evaluation. Independent reviewer sign-off is required before concluding the milestone.

