# Caller / TL completion coverage matrix

Goal: Wealth Sales Caller SC-01…SC-28 (completion gate), then Wealth Team Lead TL-01…TL-18.
Status vocabulary: **done** (implemented + independently verified) · **impl** (implemented, verification pending) · **analogue** (pattern proven in the Banking slice; Wealth screen not yet built) · **not-started** · **blocked**.
Boundary codes: **D** demonstrated demo behavior · **S** simulated provider (labelled, evidence status retained) · **P** unresolved business policy = explicit demo assumption.
PDF page: action-deck reference page (`docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf`, 320 pp). `TBD` = full-size action page not yet rendered into the reference cache.

| Action ID | PDF page | Entry point (planned) | Implementation | Verification | Boundary |
|---|---|---|---|---|---|
| SC-01 | 006–007 | /wealth/dashboard (My day) | analogue | analogue verified | D |
| SC-02 | 008 | /wealth/prospects (Lead Inbox) | analogue | analogue verified | D |
| SC-03 | TBD | /wealth/prospects/[id] (record) | analogue | analogue verified | D |
| SC-04 | TBD | record → Edit details | not-started | — | — |
| SC-05 | TBD | Lead Inbox → New enquiry | not-started | — | P |
| SC-06 | TBD | record → Call control | analogue (SIMULATED only) | partial | S |
| SC-07 | TBD | record → Wrap-up drawer | analogue (follow-up only) | partial | D/S |
| SC-08 | TBD | record → Add activity | not-started | — | S/P |
| SC-09 | TBD | record → WhatsApp control | analogue (SIMULATED only) | partial | S |
| SC-10 | TBD | Conversations (/wealth/activities) | not-started | — | S |
| SC-11 | TBD | record → Schedule follow-up | analogue | analogue verified | D |
| SC-12 | TBD | Calendar/tasks → task → Reschedule | not-started | — | P |
| SC-13 | TBD | Calendar/tasks (/wealth/tasks) | not-started | — | P |
| SC-14 | TBD | Calendar/tasks → Book meeting | not-started | — | P |
| SC-15 | TBD | record → Qualification | not-started | — | P |
| SC-16 | TBD | My pipeline (/wealth/deals) | not-started | — | P |
| SC-17 | TBD | record → Proposal | not-started | — | S/P |
| SC-18 | TBD | Documents (/wealth/documents) → Request | not-started | — | S |
| SC-19 | TBD | Documents → Upload/replace/inspect | not-started | — | — |
| SC-20 | TBD | record → Submit conversion | not-started | — | P |
| SC-21 | TBD | record → Mark lost | not-started | — | P |
| SC-22 | TBD | record → Request reopen | not-started | — | P |
| SC-23 | TBD | record → Referral/handoff | not-started | — | P |
| SC-24 | TBD | record → Opt-out/complaint | not-started | — | P |
| SC-25 | TBD | Performance (/wealth/reports) | not-started | — | — |
| SC-26 | TBD | Reviews & help (/wealth/reviews) | not-started | — | — |
| SC-27 | TBD | Performance → Meeting PDF | not-started | — | — |
| SC-28 | TBD | Reviews & help → Blocker/correction | not-started | — | P |

TL section (starts after the Caller gate passes):

| Action ID | PDF page | Entry point (planned) | Implementation | Verification | Boundary |
|---|---|---|---|---|---|
| TL-01…TL-18 | 009–011 workspace refs | /management/team + TL workspace | not-started | — | — |

## Branding gate (goal Part 2) — DONE, verified 2026-10-01

- [x] Original logo artwork converted to `apps/web/public/finverse-logo.png` (faithful crop of `NEW Finverse Logo.pdf` render; original colors preserved; applied to login + Sidebar + MobileNav; no CSS/letter approximations remain)
- [x] Exact brand tokens applied (primary teal #113F3D/#155451, sage #6FA8A2/#7FB5AE, mint #DCEEEA, ink #1B1F1E, muted #6B7280, white #FFFFFF); invented navy/gold removed
- [x] Manrope headings + Inter body actually loaded (document.fonts: Manrope/Inter/JetBrains Mono `loaded`); computed colours verified exact (#1B1F1E on #FFFFFF, muted #6B7280)

## Completion gate checklist (all required)

- [x] Brand: original logo artwork, loaded fonts, computed brand tokens verified in browser
- [ ] All 28 SC rows reach `done` (demo behavior demonstrated end to end)
- [ ] Shared login + Wealth Caller landing verified (Wealth workspace build pending)
- [ ] Persistent caller workflows across refresh, logout/login, app restart
- [ ] Cross-employee/team/vertical access denial verified (Wealth records)
- [ ] Reporting consequences + downloadable PDFs verified
- [ ] Keyboard + mobile key tasks verified
- [ ] Screenshots compared against rendered deck references (for Wealth screens)
- [ ] Workflow tests, lint, build green (currently green on Banking regression only)

Maintained per the /goal directive. Update a row's status only with evidence.
