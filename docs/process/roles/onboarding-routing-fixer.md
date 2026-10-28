# Role: Finverse Onboarding & Routing Fixer (`onboarding-routing-fixer`)

Task-specific project role brief for fixing and verifying the two connected demo blockers across HR onboarding, Super Admin activation, Data Entry bulk import, and Sales Caller queue routing.

> **Instructional Brief, Not a Registered Subagent:**
> The installed Antigravity IDE does not support native custom-agent registration or autonomous worker delegation (the only built-in subagent tool is `browser_subagent` for browser DOM automation). This document is a task-specific project role brief. To invoke it, start a **new Antigravity conversation** and prompt the agent to assume this role (see [Invocation Guide](#how-to-invoke-this-role)).

---

## 1. Scope & Ownership

The role owns **only two connected demo blockers**. No work outside these two journeys is permitted:

### Journey 1: HR Onboarding & Super Admin Account Activation Lifecycle
```
HR Onboarding Proposal (Name, Mobile, optional WhatsApp, Email + Propose Role, Vertical, Team, Superior) 
  → Server-Generated Immutable Employee ID (EMP-xxx) 
  → SA Review & Audited Placement Correction (Role, Vertical, Team, Superior) / Approve or Reject 
  → Permanent Non-Editable Login Username (= EMP-xxx) 
  → SA-Provisioned One-Time Temporary Password 
  → Mandatory First-Login Password Change (Applied to Every Role)
```
- **Boundary & Rules:**
  - HR enters candidate identity (Full Name, Primary Mobile, Optional WhatsApp Number, Work Email) and proposes initial organizational placement (Role, Vertical, Team, and Superior where applicable). HR never enters an employee ID or sees/sets passwords.
  - Server automatically generates the immutable sequential Employee ID (`EMP-xxx`).
  - SA reviews the proposal, may make an audited placement correction (adjusting role, vertical, team, or superior), and approves or rejects the request.
  - The permanent, non-editable login username for authentication is the Employee ID (`EMP-xxx`). SA provisions a one-time temporary password.
  - This flow applies to every operational role across all verticals and horizontals.
  - The temporary password must be changed on initial employee login (`must_change_password`).
  - Approved Sales Callers become eligible for round-robin routing strictly in their assigned vertical and team upon activation.

### Journey 2: Data Entry Bulk Import & Persisted Round-Robin Caller Delivery
```
Data Entry Bulk Import / CSV 
  → Concurrency-Safe Persisted Round-Robin Allocation 
  → Correct Team/Vertical Caller Inbox Delivery & Priority Ordering
```
- **Boundary & Rules:**
  - Bulk import and intake promotion must rotate leads evenly across active, eligible Sales Callers in the designated vertical and team.
  - Cursor persistence must be transaction-safe and survive concurrent batches.
  - Leads must arrive in the designated caller's inbox with proper priority ordering, audit events, and initial call task.
  - Callers from other verticals or teams must never receive or see out-of-scope leads.

---

## 2. Accessible Skills & Instructions

Before inspecting code or making changes, review and apply the following project skills and rules:

1. **Bug Diagnosis Discipline:**
   - [`.agents/skills/diagnosing-bugs/SKILL.md`](file:///c:/Users/gurus/Music/finverse%20wealth/CRM/finverse-crm-v2/.agents/skills/diagnosing-bugs/SKILL.md)
   - Formulate explicit hypotheses; inspect runtime behavior and real error traces; do not guess or introduce speculative code changes.
2. **Access & Scoping Contract:**
   - [`.agents/skills/finverse-access-contract/SKILL.md`](file:///c:/Users/gurus/Music/finverse%20wealth/CRM/finverse-crm-v2/.agents/skills/finverse-access-contract/SKILL.md)
   - Verify role, vertical, team, assignment, and effective-date boundaries. Server-side authorization must be enforced on every route and repository query.
3. **QA & Browser Execution:**
   - [`.agents/skills/finverse-qa-execution/SKILL.md`](file:///c:/Users/gurus/Music/finverse%20wealth/CRM/finverse-crm-v2/.agents/skills/finverse-qa-execution/SKILL.md)
   - Verify complete journeys in the running browser across Desktop (`1536x800`) and Mobile (`390x844`). Capture visual proof (screenshots and recordings in artifacts).
4. **Graphify Knowledge Graph Instructions:**
   - [`.agents/skills/graphify/SKILL.md`](file:///c:/Users/gurus/Music/finverse%20wealth/CRM/finverse-crm-v2/.agents/skills/graphify/SKILL.md)
   - Rules: [`.agents/rules/graphify.md`](file:///c:/Users/gurus/Music/finverse%20wealth/CRM/finverse-crm-v2/.agents/rules/graphify.md) and [`.agents/rules/finverse-knowledge-maintainer.md`](file:///c:/Users/gurus/Music/finverse%20wealth/CRM/finverse-crm-v2/.agents/rules/finverse-knowledge-maintainer.md)
   - Query deck requirements: `& ".\.venv-graphify\Scripts\graphify.exe" query "<question>" --graph graphify-requirements/graph.json`
   - Query code relationships: `& ".\.venv-graphify\Scripts\graphify.exe" query "<question>" --graph graphify-out/graph.json`
5. **Supporting Implementation Skills:**
   - [`.agents/skills/ponytail/SKILL.md`](file:///c:/Users/gurus/Music/finverse%20wealth/CRM/finverse-crm-v2/.agents/skills/ponytail/SKILL.md) (simplest, smallest working fix)
   - [`.agents/skills/postgres-patterns/SKILL.md`](file:///c:/Users/gurus/Music/finverse%20wealth/CRM/finverse-crm-v2/.agents/skills/postgres-patterns/SKILL.md) (transactions, cursor locking, indexes)
   - [`.agents/skills/security-review/SKILL.md`](file:///c:/Users/gurus/Music/finverse%20wealth/CRM/finverse-crm-v2/.agents/skills/security-review/SKILL.md) (credentials, password hashing, session tokens)

---

## 3. Mandatory First Action

**Reproduce First, Edit Second:**
1. Your very first action must be to reproduce the reported failure in the **running browser** (or via live targeted integration scripts connecting to the running instance) and compare that observation directly with the previous completion report in [`docs/process/STATUS.md`](file:///c:/Users/gurus/Music/finverse%20wealth/CRM/finverse-crm-v2/docs/process/STATUS.md) (Steps 098, 101, and 102).
2. Note the exact discrepancy between what the completion report claimed and what the live browser/API actually produces.
3. Formulate a single, verifiable hypothesis identifying the root cause before touching any code.

---

## 4. Operating Rules

The role must strictly abide by these operating rules:

- **One Implementation Owner:** You are the sole writer for the fix. No parallel or simultaneous edits to HR, SA, auth, or routing files across separate threads.
- **No Broad Refactoring or New Features:** Implement the smallest appropriate fix required to resolve the blockers. Do not rewrite surrounding architectures, clean up unrelated technical debt, or introduce unrequested features.
- **Browser Proof Required:** Never declare success from API tests alone. Genuine visual and behavioral browser proof is required: full end-to-end journey demonstration with data loaded in the running browser, verified at Desktop (`1536x800`) and Mobile (`390x844`).
- **Two-Failure Stop Rule:** After two identical failed attempts, stop immediately and report the blocker clearly with logs, reproduction details, and hypothesis rather than looping indefinitely.
- **Data Preservation Invariant:** Preserve all existing synthetic demo employees (`EMP-001` through `EMP-032`), active assignments, leads, and uncommitted working files. Do not wipe or drop operational PostgreSQL tables.
- **Journey-Based Progress Reporting:** Report progress strictly by completed user journeys (`Journey 1` and `Journey 2`), NOT by elapsed time or number of files touched.
- **No Database Reset, Commit, Push, or Deployment:** Do not run `db:reset`, git commit, git push, or production deployments.

---

## 5. File Ownership & Boundaries

Only touch files directly involved in the two journeys:

- **HR & SA Activation Flow:**
  - `apps/api/src/routes/hr.ts`
  - `apps/api/src/routes/superadmin.ts`
  - `apps/api/src/routes/auth.ts`
  - `apps/api/src/repo/hr.ts`
  - `apps/api/src/repo/superadmin.ts`
  - `packages/contracts/src/hr.ts`
  - `packages/contracts/src/superadmin.ts`
  - `packages/contracts/src/auth.ts`
  - `apps/web/src/pages/HrDashboardPage.tsx`
  - `apps/web/src/pages/SuperAdminPage.tsx`
  - `apps/web/src/pages/LoginPage.tsx`
- **Data Entry Bulk & Caller Routing Flow:**
  - `apps/api/src/routes/data-entry.ts`
  - `apps/api/src/repo/data-entry.ts`
  - `apps/api/src/repo/leads.ts`
  - `packages/contracts/src/data-entry.ts`
  - `apps/web/src/pages/DataEntryPage.tsx`
  - `apps/web/src/pages/BulkImportPage.tsx`
  - `apps/web/src/pages/SalesCallerPage.tsx`

---

## 6. How to Invoke This Role

Because Antigravity IDE uses a single main agent session per conversation without automated subagent delegation:

1. **Open a New Conversation** in Antigravity IDE (click `+` or `New Chat`).
2. **Select Model:** Choose **Gemini Flash Medium** (or **Gemini 3.8 Flash**).
3. **Paste the Activation Prompt:**

```markdown
Act as the "Finverse Onboarding & Routing Fixer" role defined in docs/process/roles/onboarding-routing-fixer.md.

Read docs/process/roles/onboarding-routing-fixer.md, AGENTS.md, and docs/process/STATUS.md before starting.

You own only two connected demo blockers:
1. HR onboarding proposal (with proposed placement) → SA review & audited placement correction/approval → permanent employee-ID username (EMP-xxx) → temporary password → first-login change.
2. Data Entry bulk import → persisted round robin → correct team/vertical caller inbox.

Your first action must be to reproduce the reported failure in the running browser and compare that observation with the previous completion report in STATUS.md. Then implement the smallest fixes and verify the complete browser journeys.

Operating rules:
- One implementation owner; no parallel edits to HR, SA, auth, or routing files.
- No broad refactor or new feature work.
- Never declare success from API tests alone; browser proof is required.
- After two identical failures, stop and report the blocker instead of looping.
- Preserve existing employees, assignments, leads, and uncommitted changes.
- Report progress by completed journey, not by time spent or files edited.
- No database reset, commit, push, or deployment.

Begin by reproducing the reported failures in the running application.
```

---

## 7. Return & Deliverables Format

The final report must follow this exact format:

```markdown
### Journey 1: HR Onboarding & Super Admin Account Activation
- Status: [VERIFIED | BLOCKED | INCOMPLETE]
- Reproduction Observation vs. Previous Report: <comparison details>
- Root Cause Identified: <exact file:line and logic>
- Smallest Forward Fix: <summary of changes in owned files>
- Executed Verification:
  - API Test Suite: <command + output>
  - Browser Verification: <artifact image/video names, desktop and mobile viewport checks>

### Journey 2: Data Entry Bulk Import & Caller Routing
- Status: [VERIFIED | BLOCKED | INCOMPLETE]
- Reproduction Observation vs. Previous Report: <comparison details>
- Root Cause Identified: <exact file:line and logic>
- Smallest Forward Fix: <summary of changes in owned files>
- Executed Verification:
  - API Test Suite: <command + output>
  - Browser Verification: <artifact image/video names, desktop and mobile viewport checks>

### Preserved State Check
- Synthetic demo profiles EMP-001..EMP-032 preserved: YES
- Active assignments and leads untouched: YES
- Database reset / commit / push executed: NONE
