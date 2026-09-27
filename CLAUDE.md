# CLAUDE.md — Finverse CRM


> Phase: **Frontend execution**

---

## 1. Product and brand sources of truth

Do not duplicate product logic, brand tokens, or business rules in this file.
Read the originals when you need them:

| What | Where |
|---|---|
| Frontend execution plan and build order | `docs/product/FRONTEND_EXECUTION.md` |
| All 135 catalogued actions (roles, fields, steps, validation, system effect, report, exception) | `docs/product/action_catalogue_v2.json` |
| Brand palette, typography, logo rules | `docs/brand/Finverse Wealth Brand Guidelines.pdf` |
| Visual and interaction reference | `docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf` *(gitignored — read locally)* |
| Project history and verified step record | `docs/process/BUILD_LOG.md` |

The coded prototype at `crm-prototype/` (once it exists) is a visual reference only.
New production code goes in the Next.js app.

---

## 2. Phase and scope

**Phase: frontend execution.** Backend API, authentication, and server-side
authorization decisions are deferred. The frontend may use a typed mock repository
first, defining request/response and error contracts so the mock can be replaced
by the real API later without rewriting UI behavior.

Do not design or implement a real database schema, auth system, or server in this
phase unless a slice explicitly needs a Next.js Route Handler for local data
serving.

---

## 3. Core architecture decisions (from FRONTEND_EXECUTION.md)

- **Framework:** Next.js App Router · React · TypeScript (strict) · Tailwind CSS ·
  shadcn/ui
- **Package manager:** `pnpm` — one lockfile; add dependencies only when a vertical
  slice needs them
- **Validation/forms:** Zod for runtime boundaries, React Hook Form for substantial
  forms (add when needed)
- **Tables:** TanStack Table for large scoped tables (add when needed)
- **Testing:** Playwright for end-to-end workflows
- **Mock data layer:** typed fixture repository implementing the same interface the
  real API will use; do not hard-code fixture data into components

---

## 4. Four verticals and role access

The CRM has four verticals. These must be preserved in every routing, fixture, and
permission decision:

```
wealth | banking | markets | real-estate
```

Roles (from FRONTEND_EXECUTION.md):

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

**Strict access boundary rule:** A hidden menu is not authorization. Every route,
query, and mutation must be gated by the `WorkspaceSession` fixture in this phase
and by real server-side checks once the API exists. Another caller's lead, another
vertical's records, and out-of-scope teams must return an empty or denied state —
never customer data.

CEO and CFO see all four verticals.
A Team Lead may have multiple `teamGrants` when assigned by Super Admin;
access remains limited to those granted teams.
All other roles see only their `verticalGrants`.

---

## 5. Component behavior contract (summary)

Each action must handle the states that are relevant to it. Not every state
applies to every control; implement the ones that can actually occur:

| State | Applies when |
|---|---|
| `idle` | Control is mounted and waiting for user input |
| `loading` | An async operation is in flight |
| `ready` | Data loaded successfully |
| `empty` | Scoped query returned no results |
| `invalid` | Form validation failed |
| `saving` | Write operation in flight |
| `success` | Write accepted by the system |
| `conflict` | Optimistic update collided with a concurrent change |
| `permission-changed` | Session grants changed mid-workflow |
| `provider-failure` | An external service is unavailable |

- `Save draft` ≠ system commit.
- `Submit` validates and shows the accepted state.
- `Cancel` leaves data unchanged.
- No activity counts as a verified call merely because a button was clicked.

Reuse the shared primitive set: tables, filters, forms, dialog/drawer, permission
message, activity timeline, report period control, audit note.

Full behavioral detail lives in `docs/product/FRONTEND_EXECUTION.md` §"Component
behavior contract."

---

## 6. Working cycle

For every task in this project:

1. **Understand** — read the relevant action IDs from `docs/product/action_catalogue_v2.json`
   and the build-order slice from `docs/product/FRONTEND_EXECUTION.md`.
2. **Plan** — identify files to create or change; call out assumptions explicitly
   (see §8).
3. **Implement** — one slice at a time; match the existing code style.
4. **Review** — for application-code changes, run `pnpm build` and `pnpm lint`
   once the app exists and fix errors before marking done. For documentation or
   configuration-only changes, use checks appropriate to those files (e.g.,
   Markdown linting, JSON validation).
5. **Verify** — for application-code changes, run Playwright for the user
   workflows affected by the slice and confirm role and scope isolation with
   fixture data. For documentation or configuration-only changes, verify the
   content is accurate and consistent with the sources of truth.
6. **Update docs** — add a dated step entry to `docs/process/BUILD_LOG.md` using the
   established format:
   ```
   - Purpose:
   - Exact terminal command or Claude prompt:
   - What it was expected to change:
   - What actually changed:
   - Verification and result:
   - Problem and fix, if any:
   ```

Do not skip the BUILD_LOG entry. It is the project's teaching record.

---

## 7. Subagents and Git worktrees

Task-specific subagents are allowed when a slice benefits from isolation (e.g.,
parallel build-fix and review, or a self-contained Playwright run). Spin up an
isolated Git worktree for work that could leave the tree in an intermediate state
before merging.

OmniRoute selects the model. Do not pin a model ID in prompts or scripts.

Prefer small, verifiable slices over one large agent sweep of all 135 actions.
Review each completed slice against the catalogue's validation, system effect,
reporting effect, and exception rules before starting the next.

---

## 8. Assumptions (unresolved business rules)

The following are working assumptions, not confirmed product decisions. Label them
`[ASSUMPTION]` in code comments and fixture data until Finverse approves:

- Example prospect names, amounts, products, and pipeline stages shown in the
  prototype and catalogue are **illustrative only**.
- Vertical-specific compliance rules (e.g., what a Banking SC can see vs. a Wealth
  SC) are not yet documented; the fixture uses the most conservative read — grant
  nothing extra by default.
- The definition of "active assignment" and concurrent-assignment policy is
  unresolved. The fixture uses a single active assignment per employee as a
  starting point, but concurrent or overlapping assignments, role changes
  mid-period, and effective-date boundaries are not yet specified. Mark any
  fixture logic that depends on this as `[ASSUMPTION]`.
- Report aggregation rules are stated in FRONTEND_EXECUTION.md as must-use facts
  (not card sums or averaged percentages) — implementation defers totals to the
  mock repository layer until confirmed.

When a business rule is resolved, remove it from this list, update the fixture,
and remove any corresponding `[ASSUMPTION]` comments.

---

## 9. What not to store here

ECC's full rule catalog, skill definitions, and hook catalog live in the ECC plugin
and its own documentation. Do not copy them here. For harness guidance, use the
`ecc:ecc-guide` skill or read `docs/process/BUILD_LOG.md` §Step 004.
