# Finverse CRM frontend execution handoff

Status: execution plan, 26 September 2026. The coded design source is `crm-prototype/`; the 320-slide client deck is `output/pdf/Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf`. Both use synthetic data. Neither provides production authentication, server authorization, persistence, or integrations.

## Technical direction

- Build one production frontend in Next.js App Router, React, TypeScript, Tailwind CSS and shadcn/ui. Next.js includes React; do not maintain a separate React SPA as the production CRM.
- Keep `crm-prototype/` as a visual and interaction reference while porting its tokens, logo, shell and components. New work belongs in the production app, not in PDF builders or screenshot scripts.
- Use one package manager (`pnpm`) and one lockfile for the app. Add dependencies only when a vertical slice needs them. Candidate additions are Zod for runtime boundary validation, React Hook Form for substantial forms, TanStack Table for large scoped tables, and Playwright for end-to-end workflows. The shadcn/ui CLI adds component source to the project; it is a component foundation, not the CRM business logic.
- The frontend may use a typed mock repository first. Define the request/response and error contracts now, so the mock can be replaced by the real API without rewriting UI behavior.
- Keep example names, amounts, products and pipeline stages visibly labelled as illustrative until Finverse approves vertical policies.

## One role, one workspace

The production shell resolves the active employee's role and effective scope from a session contract. The sidebar is built from a permitted module manifest. CEO and CFO each have a distinct workspace with All verticals and four focus filters. Other roles only see granted verticals, teams, records and actions. A hidden menu is not authorization: direct routes, queries, files and mutations still require backend checks when the API is built.

Proposed frontend types:

```ts
type Role = 'SC' | 'TL' | 'MG' | 'RM' | 'NM' | 'CEO' | 'CFO' | 'DE' | 'HR' | 'SA'
type Vertical = 'wealth' | 'banking' | 'markets' | 'real-estate'
type WorkspaceSession = {
  employeeId: string
  role: Role
  activeAssignmentId: string
  verticalGrants: Vertical[]
  teamGrants: string[]
  allowedActions: string[]
  effectiveFrom: string
  permissionVersion: string
}
```

In the mock stage, use test fixtures for this contract. Do not hard-code a role picker into the production UI or treat the current `/preview/{role}` routes as access control.

## Component behavior contract

Every user-facing action needs a visible state and outcome: idle, loading, ready, empty, invalid, saving, success, conflict, permission changed, and provider failure where relevant. `Save draft` does not post a business outcome. `Submit` validates and shows the accepted state. `Cancel` leaves data unchanged. Search results and counts use the active scope. A role/team transfer refreshes the workspace and clears data from the previous assignment. No activity counts as a verified call merely because a button was clicked.

Reuse primitives for tables, filters, forms, dialog/drawer, permission message, activity timeline, report period control and audit note. Keep role-specific compositions: caller queue and prospect workspace; TL allocation and coaching; leadership drill-down; CFO finance bridge; Data Entry validation; HR lifecycle; Super Admin grant preview.

## Build order

### 0. Foundation

Create the Next.js app, install shadcn/ui, port the supplied brand assets and tokens, set up TypeScript strict mode, linting, Playwright and a fixture-backed repository interface. Implement the shared responsive shell and an explicit workspace-session fixture. Establish route-level empty/error states. Verify the app builds on Windows.

### 1. Caller vertical slice — SC-01 through SC-16

Make the first real interaction chain work with fixture data: My day → owned lead inbox → prospect record → call/message intent → activity wrap-up → follow-up task → qualification → pipeline. Filters, sorting and pagination must affect the displayed dataset. Forms must validate. A saved activity or task must update the local mock store and all related views. Simulate transfer, permission loss, duplicate lead, no-answer and provider failure. Preserve the brand UI from the prototype.

Acceptance: the caller can complete a synthetic lead's full journey without dead buttons; another caller's lead and another vertical's records are not returned by the fixture service; refresh retains the fixture store for the test run; mobile follow-up works without horizontal overflow. These are frontend contract tests, not a substitute for future server authorization tests.

### 2. Team Lead slice — TL-01 through TL-18

Connect unassigned lead allocation, workload comparison, approval/return, coaching and the one-to-one review to the same fixture repository. Explicit two-team grants appear as filters inside the TL interface. Allocation changes the caller queue at the effective time; historical activity attribution does not move. Self-approval and out-of-scope teams yield a denied state.

### 3. Manager to National Manager

Build the shared hierarchy reporting primitives once, then compose distinct Manager, RM and NM pages. Drill-down stays inside the superior's workspace. Filter by assigned hierarchy and period; report totals come from facts, not card sums or averaged percentages. Add target, capacity, forecast and exception workflows by role.

### 4. CEO, CFO and company functions

CEO: company outcomes, vertical focus, strategy decisions and leadership reviews. CFO: revenue, invoice, receipt, reconciliation, receivable and close views with separate figures. Data Entry: batch validation, duplicate hold and publication. HR: joiner/mover/leaver and dated review flows. Super Admin: role/scope assignment preview, lifecycle and audit. These screens must use their own role navigation and fixture access rules.

### 5. Completion gate

Cover all 135 catalogue actions with an implementation status: working, intentionally read-only, or awaiting an approved business rule. Remove generic `Continue` buttons where the real result is more specific. Run keyboard and mobile checks, end-to-end paths for each role, accessibility checks for critical flows, and a production build. Only then connect the real backend.

## Definition of done for each action

1. The action's entry point is visible only to the appropriate role and scope fixture.
2. Every control produces the named result, including cancel, reset, download and retry.
3. Validation, duplicate submissions, stale versions, permission changes and empty states are represented.
4. The local fixture store reflects the proposed system commit; related pages update consistently.
5. The reporting consequence described in `action_catalogue_v2.json` is tested where the mock can represent it.
6. The flow is usable by keyboard and at the relevant desktop/mobile widths.

## Claude Code working brief

Start Claude Code from this workspace and give it one slice at a time. The first prompt can be:

> Read `planning/crm/FRONTEND_EXECUTION.md`, `planning/crm/action_catalogue_v2.json`, and the existing `crm-prototype/`. Build Phase 0 and the SC-01 to SC-03 portion of Phase 1 in a new Next.js production app. Preserve the supplied Finverse logo, palette and role-adaptive design. Implement real state transitions against a typed fixture repository, not static click-throughs. Keep the production role session fixture separate from the review prototype routes. Add meaningful Playwright tests for caller scope, search/filter, record open, empty state and mobile width. Run build and tests; report working controls, remaining mock boundaries and exact files changed.

After this slice passes, continue with SC-04 through SC-16, then Team Lead. Do not ask the agent to implement all 135 actions in one prompt. Review each completed slice against the deck's validation, system effect, reporting effect and exception rules.

## Agent-tool discipline

Use one baseline orchestration system in Claude Code, then add specialized skills only when a task calls for them. Record installed plugins, versions and active hooks. Avoid overlapping always-on style, memory and security hooks. Graphify is useful as a milestone index after a slice lands; it should not replace concise source-of-truth specifications. An external model router should use a stable, known working route for a coding slice, with tests deciding correctness rather than token allowance or model count.
