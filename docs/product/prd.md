# Master Product Requirements Document (PRD) — Finverse CRM v2

**Document Status:** Canonical Product Specification  
**Version:** 2.1.0 (Corrected — Source Reconciled)  
**Effective Date:** 2026-10-06  
**Reference Action Deck:** `docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf` (320 Pages, SHA-256: `704c03cc...`)  
**Product Action Catalogue:** `docs/product/action_catalogue_v2.json` (135 Actions, SHA-256: `79e47a70...`)  
**Brand Master Reference:** `docs/brand/Finverse Wealth Brand Guidelines.pdf` (SHA-256: `02809e9c...`)  

---

## 1. Product Vision & Operating Model

Finverse CRM v2 is an institutional-grade Customer Relationship Management, Sales Execution, and Financial Control platform designed to serve four business verticals from a single, shared technical foundation:
1. **Wealth Management**
2. **Commercial Banking**
3. **Markets & Securities (Trading)**
4. **Real Estate Advisory**

### 1.1 Core Principles (`[Deck P001–P005, P314–P317]`)
- **One Domain & One Shared Login:** Employees authenticate once at a single entrypoint. The server resolves each employee's active role, vertical, and team grants, opening only the authorized workspace.
- **Ten Dedicated Workspaces:** No cross-role switcher, no impersonation, no other-role menu (`[Deck P314]`).
- **Authorization on Every Request:** Authorization is enforced on every server read and mutation (`[Deck P002, P314]`). A hidden menu is not authorization.
- **Strict Vertical Data Isolation:** Shared identity matching across verticals must never leak customer records or opportunities across vertical boundaries without explicit, consented referral acceptance (`[Deck P005, P317]`).
- **History Survives Change:** Career history, prior scorecards, rule versions, and metric facts remain permanently linked to the employee; successors never inherit a predecessor's historical results (`[Deck P002, P315]`).
- **Synthetic Presentation Baseline:** All client names, phone numbers, and currency values in the deck and prototype are synthetic demo representations (`[Deck P002]`).

---

## 2. Shared System Invariants (Rules That Survive Every Screen)

In strict accordance with Action Deck Pages 314–317:

1. **One Role Interface per Active Workspace (`[Deck P314]`):**
   Authentication resolves the single active approved role. The sidebar displays only that role's modules. Scope filters (e.g., filtering between two assigned teams or two granted verticals) never transform or switch the role interface.
2. **Access Checked on Every Surface (`[Deck P002, P314]`):**
   Active account, active employment, role action, record scope, field permission, and workflow state must be validated by the server on every request. Direct URLs, API IDs, search counts, notifications, files, PDF jobs, and downloads are subject to deny-by-default enforcement.
3. **History Survives Organizational Change (`[Deck P315]`):**
   Promotion, transfer, and exit alter current access at an effective timestamp. Personal history stays with the employee. Replacement staff receive new identities and no inherited personal performance.
4. **Defined Outcomes for All Controls (`[Deck P315]`):**
   - *Apply Filters:* Recomputes and updates the active slice; *Reset* restores defaults.
   - *Cancel / Close:* Performs no commit and prompts if unsaved inputs exist.
   - *Save Draft:* Persists working state without posting business outcomes or triggering approvals.
   - *Submit:* Executes server validation and records durable business state.
   - *Download:* Creates or opens a permission-checked export.
   - *Destructive Changes:* Always require an explicit reason and review step.
5. **Standard Failure & Empty States (`[Deck P315]`):**
   Loading states use labeled skeletons. Empty states explain whether the queue is empty or filters hide results. Validation highlights the field and preserves the draft. Version conflicts display the newer record. Revoked access clears sensitive cached content. No result is shown as success until durable acceptance.
6. **Core Lead State Machine (`[Deck P316]`):**
   `Not Contacted` → `Contacted` → `Follow-up` → `Pending Conversion` → `Converted`.
   - `Contacted` may submit `Pending Conversion` directly if product evidence is complete.
   - Eligible open states may become `Lost` with a mandatory reason.
   - Reopening a lost opportunity requires documented justification and Team Lead approval.
   - Calls and messages are recorded as *activities*, not pipeline stages.
   - No-answer attempts remain in `Not Contacted`.
   - Converted cancellation uses an adjustment/handoff, not silent stage deletion.
7. **Approval and Delegation Rules (`[Deck P316]`):**
   - Default sales conversion reviewer is scoped Team Lead; TL self-submissions escalate to Manager.
   - Cross-team work transfers route to Manager, cross-Manager to RM, cross-region to NM.
   - Finance decisions require explicit finance authority.
   - Approvers cannot approve their own requests.
   - Unset limits block approval. Absence uses dated delegation. Timeout escalates, never auto-approves.
8. **Metric and Attribution Contract (`[Deck P316]`):**
   - Store immutable employee, assignment, event time, vertical, and hierarchy context.
   - Count unique provider IDs for verified activity.
   - Recompute rates from summed numerators and denominators; do not average percentages.
   - Cohort conversion uses the same eligible allocation cohort and observation cutoff.
   - Default win credit locks to the approved closing owner; approved splits sum to 100%.
   - Cash date and sales credit basis remain separate.
9. **Automatic Periods and Report Versions (`[Deck P317]`):**
   - Proposed calendar: `Asia/Kolkata`, Monday weeks, April–March fiscal year.
   - Supports daily, weekly, monthly, quarterly, half-yearly, and yearly reports.
   - Scheduler creates completed-period snapshots after each boundary (proposed 00:15 local time) with readiness checks and safe retry.
   - Live / MTD views are marked provisional. Show cutoff, timezone, definition version, source delay, and finance close state. Late corrections produce a revised version.

---

## 3. Business Verticals & Scope Boundaries

### 3.1 Four Configurable Verticals (`[Deck P005, P036–P042, P317]`)
The deck defines four verticals sharing a familiar shell while adapting pipeline terms, queues, evidence, KPIs, and customer context:

| Vertical | Scope | Illustrative Pipeline (`[Deck P005]`) | Illustrative Evidence / Context |
|---|---|---|---|
| **Wealth Management** | HNIs, Advisory, PMS, Mutual Funds | `New` → `Discovery` → `Suitability` → `Proposal` → `Onboarding` | Risk profile, mandate signed, asset allocation, AUM |
| **Commercial Banking** | Commercial & MSME Lending, Accounts | `New` → `Eligibility` → `Documents` → `Sanction` → `Disbursal` | Financial statements, credit rating, sanction letter |
| **Markets & Securities** | Trading, Broking, Depository | `New` → `KYC` → `Account Opened` → `Funded` → `Active` | CKYC, demat details, first trade, brokerage |
| **Real Estate Advisory** | Property Sales, Advisory | `New` → `Qualified` → `Site Visit` → `Booking` → `Registration` | Micro-market, floor plans, allotment, agreement for sale |

> [!IMPORTANT]
> **Source Rule (`[Deck P005]`):** "The four vertical names are confirmed. Product definitions, stage gates and revenue triggers remain illustrative until approved."
> The detailed 135 action screens in the deck (Pages 43–312) are presented in the **Wealth Management** vertical context. Sales roles replicate across the four verticals in workflow pattern, but product gates, rate cards, and conversion criteria for Banking, Markets, and Real Estate are pending formal client decisions.

---

## 4. Workspaces & Organizational Boundaries (`[Deck P004]`)

Finverse CRM v2 defines ten workspaces across operational sales, executive governance, and shared company functions:

```
Operational Sales Hierarchy (Repeated per vertical):
  SC (Sales Caller / Associate) ──> TL (Team Lead) ──> MG (Manager) ──> RM (Regional Manager) ──> NM (National Manager) ──> CEO

Executive & Governance Workspaces (Company outcomes / finance):
  CEO (Chief Executive Officer) ── Filters across verticals within own workspace [Deck P041]
  CFO (Chief Financial Officer) ── Receives finance facts through separate grant [Deck P004, P042]

Shared Operational Workspaces (Company functions with explicit grants):
  DE (Data Entry)  ── Granted intake across sources [Deck P004]
  HR (Human Resources) ── People lifecycle & assignment intervals [Deck P004]
  SA (Super Admin) ── Identity, access scopes & system configuration [Deck P004]
```

### 4.1 Scope Boundaries by Workspace
1. **Sales Caller (`SC`) (28 Actions, P043–P098):**
   - Scope: Own assigned prospects and scheduled follow-ups within assigned team and vertical.
2. **Team Lead (`TL`) (18 Actions, P099–P134):**
   - Scope: Granted associate teams within assigned vertical. Oversees lead allocation, conversion approvals, call coaching, team targets, and forecasts.
3. **Manager (`MG`) (13 Actions, P135–P160):**
   - Scope: Assigned Team Leads within vertical. Oversees cross-team transfers, capacity plans, target allocations, forecast challenges, and SLA breach resolution.
4. **Regional Manager (`RM`) (10 Actions, P161–P180):**
   - Scope: Assigned geographic region within vertical. Oversees branch managers, territory plans, regional target cascade, staffing envelopes, and regional forecast.
5. **National Manager (`NM`) (11 Actions, P181–P202):**
   - Scope: One national vertical. Oversees regional benchmarking, national targets, product economics, cross-region transfers, and inter-vertical referrals.
6. **CEO (`CEO`) (11 Actions, P203–P224):**
   - Scope: Company-wide outcomes across all four verticals. Focus views filter by vertical within the executive workspace without opening subordinate dashboards (`[Deck P041]`).
7. **CFO (`CFO`) (19 Actions, P225–P262):**
   - Scope: Company finance across all four verticals. Sales-to-finance handoffs, revenue recognition, invoice issuance, receipt matching, 3-way reconciliation, incentives, period close certification, and DoA limits (`[Deck P042]`).
8. **Data Entry (`DE`) (7 Actions, P263–P276):**
   - Scope: Granted intake. Batch file upload, staging row validation, deduplication review, publish to allocation queues, source registry.
9. **HR (`HR`) (7 Actions, P277–P290):**
   - Scope: Company people lifecycle. New joiners, effective-dated transfers, promotions, leaver offboarding, leave/availability calendar, probation tracking.
10. **Super Admin (`SA`) (11 Actions, P291–P312):**
    - Scope: Identity, roles, and system configuration. User provisioning, assignment grants, org hierarchy, rule versions, audit incidents, job recovery.

---

## 5. Role × Vertical × Action Applicability Matrix

### 5.1 Applicability Rules
- **Sales Roles (`SC-01..SC-28`, `TL-01..TL-18`, `MG-01..MG-13`, `RM-01..RM-10`, `NM-01..NM-11`):**
  - Workflow structure and authority hierarchy replicate across **all four verticals**.
  - Action screens in the deck (Pages 43–202) are illustrated with Wealth Management terminology.
  - Applying these actions to Banking, Markets, and Real Estate uses the same role interface shell, but vertical-specific fields, product gates, and evidence rules are pending client sign-off (`[CLIENT DECISION: Undecided]`).
- **Executive Roles (`CEO-01..CEO-11`, `CFO-01..CFO-19`):**
  - Company-wide scope. These actions operate across **all four verticals** simultaneously via executive focus filtering (`[Deck P041, P042]`). They do not duplicate per vertical.
- **Shared Roles (`DE-01..DE-07`, `HR-01..HR-07`, `SA-01..SA-11`):**
  - Enterprise shared functions. These actions operate **across all verticals** under explicit horizontal grants (`[Deck P004]`). They do not duplicate per vertical.

### 5.2 Summary Matrix

| Role | Action Range | Total Actions | Deck Pages | Vertical Applicability | Status |
|---|---|---|---|---|---|
| **SC** | `SC-01` .. `SC-28` | 28 | P043–P098 | Wealth (illustrated); Banking, Markets, Real Estate (workflow replicates; gates pending client decision) | Dedicated API test suite verified in Wealth; cross-role happy path verified |
| **TL** | `TL-01` .. `TL-18` | 18 | P099–P134 | Wealth (illustrated); Banking, Markets, Real Estate (workflow replicates; gates pending client decision) | Dedicated API test suite verified in Wealth; cross-role happy path verified |
| **MG** | `MG-01` .. `MG-13` | 13 | P135–P160 | Wealth (illustrated); Banking, Markets, Real Estate (workflow replicates; gates pending client decision) | Implemented; happy path exercised in lifecycle test; action-level audit packet pending |
| **RM** | `RM-01` .. `RM-10` | 10 | P161–P180 | Wealth (illustrated); Banking, Markets, Real Estate (workflow replicates; gates pending client decision) | Implemented; happy path exercised in lifecycle test; dedicated action suite pending |
| **NM** | `NM-01` .. `NM-11` | 11 | P181–P202 | Wealth (illustrated); Banking, Markets, Real Estate (workflow replicates; gates pending client decision) | Implemented; happy path exercised in lifecycle test; dedicated action suite pending |
| **CEO**| `CEO-01` .. `CEO-11` | 11 | P203–P224 | Company-Wide (Focus filters across Wealth, Banking, Markets, Real Estate) | Implemented; happy path exercised in lifecycle test; dedicated action suite pending |
| **CFO**| `CFO-01` .. `CFO-19` | 19 | P225–P262 | Company-Wide (Consolidated finance across Wealth, Banking, Markets, Real Estate) | Implemented; happy path exercised in lifecycle test; dedicated action suite pending |
| **DE** | `DE-01` .. `DE-07` | 7 | P263–P276 | Shared Horizontal (Intake across all 4 verticals) | Planned (Schema & contracts specified) |
| **HR** | `HR-01` .. `HR-07` | 7 | P277–P290 | Shared Horizontal (Personnel across all 4 verticals) | Planned (Schema & contracts specified) |
| **SA** | `SA-01` .. `SA-11` | 11 | P291–P312 | Shared Horizontal (Identity/Admin across all 4 verticals) | Planned (Schema & contracts specified) |
| **Total** | | **135** | | | |

---

## 6. Client Decisions Still to Approve (`[Deck P320]`)

In strict accordance with Action Deck Page 320 (*"CLIENT DECISIONS: Business rules still to approve. Examples in this deck are clearly illustrative; these decisions define the production behaviour"*), all undecided matters are organized under the six original deck categories:

1. **Products and stages (`[Deck P320]`):**
   - *Original Deck Text:* "Name products, stage evidence, conversion gates and lost/reopen policy in each vertical."
   - *[Derived Question]:* What specific product lists, stage evidence documents, conversion qualification gates, and lost/reopen policies govern Commercial Banking, Markets & Trading, and Real Estate Advisory?
2. **Commercial events (`[Deck P320]`):**
   - *Original Deck Text:* "Define sales credit, recognised revenue, invoices, cash, reversals and incentive eligibility."
   - *[Derived Question]:* What sales commission clawback percentage and holdback duration apply to advisors? What exact revenue recognition milestones and tax/GST schedules govern receivable invoicing?
3. **Approvals and limits (`[Deck P320]`):**
   - *Original Deck Text:* "Set authority thresholds, delegates, escalation windows and independent reviewer requirements."
   - *[Derived Question]:* What financial delegation limits govern Manager vs Regional Manager commercial discount exceptions, and what dual-approval rules apply to activity dispute corrections?
4. **Targets and periods (`[Deck P320]`):**
   - *Original Deck Text:* "Confirm timezone, fiscal year, period close, target allocation and revised report policy."
   - *[Derived Question]:* What emergency unlock windows and dual-authorization controls govern reopening a certified closed accounting period?
5. **Providers and consent (`[Deck P320]`):**
   - *Original Deck Text:* "Select calling, WhatsApp, email and document vendors; confirm consent and retention rules."
   - *[Derived Question]:* Which cloud telephony provider, WhatsApp BSP vendor, and object storage service will be provisioned? What regulatory data retention duration applies to customer records and audit trails?
6. **Deployment and data (`[Deck P320]`):**
   - *Original Deck Text:* "Confirm identity provider, website integration, import format, data migration and hosting."
   - *[Derived Question]:* Which enterprise identity provider (SAML / SSO / Active Directory), website lead capture webhooks, batch import formats, and hosting topology will be deployed?

### 6.1 Prototype Implementation Assumptions (Separate from Deck Requirements)
The current repository contains certain illustrative values used to make synthetic demo accounts and test suites functional:
- **`[IMPL ASSUMPTION: Demo Passwords]`** Synthetic test accounts use password `demo1234` in local testing.
- **`[IMPL ASSUMPTION: Synthetic Target Values]`** Test seeds use illustrative revenue figures (e.g., ₹75,00,000 converted value).
- **`[IMPL ASSUMPTION: Scheduler Cadence]`** Local dev timers use 30s for reminders and 60s for report checks to permit interactive testing, while deck P317 proposes production snapshots at 00:15 local time.
- **`[IMPL ASSUMPTION: Illustrative Thresholds]`** Prototype UI displays illustrative reference markers (such as 20 leads/caller capacity cap in `ManagerPages.tsx`); these are working prototype defaults, not confirmed corporate policy.
