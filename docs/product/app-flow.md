# Master Application State & Flow Specification (App Flow) — Finverse CRM v2

**Document Status:** Canonical Flow Specification  
**Version:** 2.0.0  
**Effective Date:** 2026-10-06  
**Reference Action Deck:** `docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf` (Pages P003–P005, P314–P317)  
**Product Action Catalogue:** `docs/product/action_catalogue_v2.json`  

---

## 1. Authentication & Workspace Resolution Flow

Finverse CRM v2 strictly rejects client-side role switching, user impersonation, or omni-access menus (`[Deck P003, P314]`):

```mermaid
sequenceDiagram
    autonumber
    actor User as Employee Browser
    participant API as Auth Gateway (/api/auth)
    participant DB as Relational Core (PostgreSQL)
    participant UI as Authorized Workspace Shell

    User->>API: POST /api/auth/login { email, password }
    API->>DB: Query employee by email (active employment check)
    DB-->>API: Employee record + scrypt password hash
    API->>API: Verify password hash
    alt Invalid Credentials
        API-->>User: 401 UNAUTHENTICATED
    else Valid Credentials
        API->>DB: Query active effective assignments (NOW() between valid_from and valid_to)
        DB-->>API: Active assignment { role, vertical, team_id }
        alt No Active Assignment Found
            API-->>User: 403 FORBIDDEN ("Account active but no effective assignment granted")
        else Active Assignment Resolved
            API->>API: Generate cryptographically signed session cookie (fvc2_session)
            API-->>User: 200 OK + Set-Cookie + Workspace Manifest
            User->>UI: Redirect to Authorized Route based on Role
            Note over UI: SC -> /wealth/my-day<br/>TL -> /management/overview<br/>MG -> /manager/overview<br/>RM -> /regional/overview<br/>NM -> /national/overview<br/>CEO -> /ceo/overview<br/>CFO -> /cfo/overview<br/>DE -> /intake/batches<br/>HR -> /people/joiners<br/>SA -> /admin/users
        end
    end
```

---

## 2. Master Lead Lifecycle State Machine

The core lead lifecycle governs prospect movement from raw intake through qualification, conversion, loss, and formal reopening (`[Deck P316]`):

```mermaid
stateDiagram-v2
    [*] --> New: Ingestion (DE-01/05 or Self-Sourced SC-05)
    
    New --> NotContacted: Allocated to Caller (TL-02/03)
    
    NotContacted --> Contacted: Successful First Call (SC-06/07)
    NotContacted --> Lost: Disqualified / Invalid Info (SC-21)
    
    Contacted --> FollowUp: Callback Promised (SC-11)
    Contacted --> Qualified: Suitability Passed (SC-15)
    Contacted --> Lost: Uninterested / Competitor (SC-21)
    
    FollowUp --> Contacted: Callback Executed
    FollowUp --> Lost: Max Attempts Reached / Dropped
    
    Qualified --> ProposalSent: Proposal Delivered (SC-17)
    ProposalSent --> PendingConversion: Client Agrees / Mandate Signed (SC-20)
    ProposalSent --> Lost: Commercial Terms Rejected (SC-21)
    
    PendingConversion --> Converted: TL Approves Conversion (TL-07)
    PendingConversion --> ProposalSent: TL Returns Proposal with Feedback (TL-07)
    
    Converted --> [*]: Emits Finance Handoff to CFO (CFO-02)
    
    Lost --> ReopenRequested: Caller Submits Reopen Request with New Evidence (SC-22)
    ReopenRequested --> Contacted: TL Approves Reopening (TL-08)
    ReopenRequested --> Lost: TL Rejects Reopening (TL-08)
```

### 2.1 State Transition Invariants
- **Activity vs State:** Phone calls, WhatsApp messages, and meetings are recorded as timeline *activities*. They do not advance pipeline stages unless accompanied by verified stage evidence.
- **Conversion Gate:** A lead cannot enter `pending_conversion` without uploaded client evidence (`SC-19`) and a valid proposal record (`SC-17`).
- **Audit Immutability:** When marked `lost`, the lead enters a terminal read-only state. Reopening requires a fresh justification and explicit Team Lead adjudication (`TL-08`).

### 2.2 Multi-Vertical Pipeline State Machines & Reusable Flow Architecture

Finverse CRM v2 executes a unified workflow engine across four vertical divisions, preserving shared infrastructure while respecting domain-specific state transitions (`[Deck P005]`):

1. **Commercial Banking Lifecycle (Deck P005, P036):**
   - Sequential Progression: `New` $\to$ `Eligibility` $\to$ `Documents` $\to$ `Sanction` $\to$ `Disbursal` (terminal won) or `Lost`.
   - Gate Preconditions: Moving to `Documents` requires verified financial documentation request; moving to `Sanction` requires completed credit assessment; moving to `Disbursal` requires TL conversion approval of sanction letter terms.
   - Banking Loss Adjudication: Accepts domain-specific rejection codes (`Credit rejected`, `CIBIL / score below threshold`, `Insufficient collateral`, `Pricing / interest rate`).

2. **Markets & Securities Lifecycle (Deck P005):**
   - Sequential Progression: `New` $\to$ `KYC` $\to$ `RiskProfiling` $\to$ `DematTradingOpened` $\to$ `FundedFirstTrade` (terminal won) or `Lost`.
   - Gate Preconditions: Advancing through KYC requires SEBI-compliant identity and address proofs; Demat opening requires depository participant verification; Funded trade requires ledger-cleared deposit.

3. **Real Estate Advisory Lifecycle (Deck P005):**
   - Sequential Progression: `New` $\to$ `Requirement` $\to$ `SiteVisit` $\to$ `EOI_Booking` $\to$ `Registration` (terminal won) or `Lost`.
   - Gate Preconditions: Advancing to Site Visit requires scheduled location appointment; EOI Booking requires earnest money deposit receipt; Registration requires executed sale agreement.

4. **Reusable Implementation & Traceability Invariant:**
   - **Reuse Foundation First:** Workspaces, communication forms, task schedulers, activity feeds, audit ledgers, and document viewers are shared across all verticals. Do not recreate separate workspace stacks for Banking, Markets, or Real Estate.
   - **Visual Grounding:** Before implementing or modifying any vertical screen, inspect the actual Action Deck PDF page visually. Graph summaries complement but do not substitute for the visual layout, fields, and micro-interactions of the deck.
   - **Traceability Standard:**
     `Action Deck page → detailed requirements & visual reference → existing reusable implementation → vertical-specific differences → verification evidence → remaining gaps`.

---

## 3. Tiered Sales-to-Executive Escalation & Handoff Flows

### 3.1 Frontline to Middle Management (SC → TL → MG)
```mermaid
flowchart TD
    SC20[SC-20: Caller Submits Conversion] -->|Payload & Evidence| TL07[TL-07: Team Lead Review]
    TL07 -->|Approve| CONV[Lead Marked Converted]
    TL07 -->|Return with Notes| SC17[SC-17: Caller Revises Proposal]
    
    SC22[SC-22: Caller Requests Reopen] -->|New Business Justification| TL08[TL-08: Team Lead Decision]
    TL08 -->|Approve| REOPEN[Lead Restored to Contacted]
    TL08 -->|Decline| LOST[Lead Remains Lost]
    
    TL04[TL-04: Team Backlog Overloaded] -->|Exceeds Team Bounds| MG04[MG-04: Manager Capacity Recovery Plan]
    TL11[TL-11: TL Submits Team Forecast] -->|Bottom-Up Forecast| MG06[MG-06: Manager Challenge & Approval]
    MG06 -->|Challenge / Return| TL11
    MG06 -->|Accept| MG07[MG-07: Manager Rollup & RM Submission]
    
    TL18[TL-18: TL Activity Correction] -->|Self-Submitted by TL| MG08[MG-08: Manager Exception Review<br/>Requester != Decider]
```

### 3.2 Middle Management to Regional & National Leadership (MG → RM → NM → CEO)
```mermaid
flowchart TD
    MG07[MG-07: Manager Submits Forecast] -->|Adjusted Bottom-Up Total| RM07[RM-07: Regional Forecast Rollup]
    RM07 -->|Submit Regional Forecast| NM06[NM-06: National Forecast Consolidation]
    NM06 -->|Submit Vertical Forecast| CEO05[CEO-05: Consolidated Corporate Forecast]
    
    CEO04[CEO-04: Board Approves Enterprise Targets] -->|Allocate Vertical Targets| NM03[NM-03: National Target Cascade]
    NM03 -->|Allocate Regional Targets| RM04[RM-04: Regional Target Allocation]
    RM04 -->|Allocate Branch Targets| MG05[MG-05: Manager Target Allocation]
    MG05 -->|Allocate Associate Targets| TL10[TL-10: Team Lead Distribution]
    
    MG03[MG-03: Cross-Team Lead Transfer] -->|Cross-Manager Scope| RM05[RM-05: Regional Transfer Adjudication]
    RM05 -->|Cross-Region Scope| NM07[NM-07: National Transfer Adjudication]
```

---

## 4. Sales-to-Finance Handover Flow (Frontline → CFO)

The bridge between frontline commercial success and statutory financial truth (`[Deck P026, P227-P240]`):

```mermaid
sequenceDiagram
    autonumber
    actor TL as Team Lead
    participant Core as Core CRM Engine
    actor CFO as Chief Financial Officer
    participant Ledger as Statutory Finance Ledger

    TL->>Core: POST /api/tl/requests/:id/conversion-decision { decision: 'approved' }
    Core->>Core: Update lead stage = 'converted'
    Core->>Core: INSERT INTO sales_finance_handoffs { lead_id, converted_amount, review_status: 'pending_verification' }
    Note over CFO: CFO Inspects Handoff Queue (/cfo/recognition)
    CFO->>Core: GET /api/cfo/handoffs
    Core-->>CFO: List of verified conversions
    CFO->>Core: POST /api/cfo/ledger/recognition { handoff_id, grossAmount, taxAmount, policyCode }
    Core->>Ledger: Insert finance_ledger_entries (revenue_recognition)
    Core->>Core: Generate receivable invoice (CFO-04)
    Note over CFO: Bank Settlement Import & Match
    CFO->>Core: POST /api/cfo/receipts (Bank Statement UTR)
    CFO->>Core: POST /api/cfo/receipts/match { invoice_id, receipt_id, allocatedAmount }
    Note over CFO: Period Close 3-Way Reconciliation
    CFO->>Core: POST /api/cfo/reconciliations/freeze { period_id, explanationNotes }
    Core->>Ledger: Verify CRM Sales == Recognized Revenue == Cash Receipts
    Core-->>CFO: Reconciliation Passed & Period Certified (CFO-14)
```

---

## 5. Data Entry Intake & Allocation Routing Flow (`DE-01..07` → `TL-02/03`)

The ingestion pipeline enforces strict data provenance, zero arbitrary ownership for Data Entry, and idempotent publication:

```mermaid
sequenceDiagram
    autonumber
    actor DE as Data Entry Operator
    participant Intake as Intake Subsystem (DE-01..07)
    participant Dedupe as Deduplication & Validation Engine
    participant DB as Leads Repository
    actor TL as Authorized Team Lead (TL-02/03)
    actor SC as Eligible Sales Caller

    DE->>Intake: POST /api/intake/batches/upload (CSV / Excel file) [DE-01, DE-02]
    Intake->>Intake: Stage rows with provenance batch ID (status: 'staging')
    DE->>Intake: POST /api/intake/batches/:id/validate [DE-03]
    Intake->>Dedupe: Match against phone, email, and PAN across vertical
    alt Duplicate or Validation Failure Detected
        Dedupe-->>Intake: Flag rows as 'duplicate_hold' or 'validation_error' [DE-03, DE-04]
        DE->>Intake: Correct rejected rows or mark false duplicate [DE-03, DE-04]
    else Clean Row
        Intake->>Intake: Mark row 'ready_to_publish'
    end
    DE->>Intake: POST /api/intake/batches/:id/publish [DE-05]
    Note over Intake,DB: Atomic Publication Gate: Zero duplicate creation on repeat calls
    Intake->>DB: Atomically insert leads (stage: 'new', owner: NULL, provenance_batch_id: batch.id)
    Intake-->>DE: Provenance intake receipt & batch summary report [DE-06, DE-07]
    Note over DB,TL: Leads arrive in Team Lead Unassigned Queue for target vertical & team
    TL->>DB: GET /api/tl/leads/unassigned (Scoped by granted team & vertical)
    TL->>DB: POST /api/tl/leads/allocate (Single TL-02 or Batch TL-03)
    DB->>DB: Update lead (owner_employee_id: caller.id, stage: 'not-contacted')
    DB->>DB: Insert lead_ownership_events (actor: TL, from: NULL, to: caller.id)
    DB-->>SC: Appears in Caller My Day queue (/wealth/my-day) [SC-01]
```

### 5.1 Invariants for Data Entry to Team Lead Routing
1. **Zero Lead Ownership for Data Entry:** Data Entry operators never hold ownership of leads (`owner_employee_id` remains `NULL` upon publication).
2. **Canonical Lead Identifiers & Provenance:** Every published lead receives a canonical ID and links immutably to its `intake_batch_id` and raw row receipt.
3. **Idempotent Publication:** Repeated calls to `POST /api/intake/batches/:id/publish` are idempotent; already-published rows are skipped without generating duplicate records.
4. **Traceable Exclusions & Partial Recovery:** Held or rejected rows remain quarantined, excluded from the lead pool, and independently recoverable.
5. **Eligibility Dampening:** Team Lead allocation algorithms (`TL-02`, `TL-03`) automatically respect caller availability, capacity caps (max 20 active), and HR-recorded leave status.

---

## 6. People Lifecycle & Access Provisioning Flow (`HR-01..07` → `SA-01..11`)

Employee lifecycle operations maintain complete governance across HR requests, Superadmin provisioning, and operational continuity:

```mermaid
sequenceDiagram
    autonumber
    actor HR as HR Specialist (HR-01..07)
    participant Core as Personnel Directory
    actor SA as Super Administrator (SA-01..11)
    actor Emp as Operational Employee
    participant Ops as Operational Workflows

    HR->>Core: POST /api/hr/joiners { full_name, email, vertical, base_role, join_date } [HR-01]
    Core->>Core: Record employee_profiles (status: 'pending_provisioning')
    Note over SA: SA Inspects Joiner Queue (/admin/users) [SA-01]
    SA->>Core: POST /api/admin/users { employee_id, temp_credentials } [SA-01]
    Core->>Core: Create user account + activation token
    SA->>Core: POST /api/admin/grants { employee_id, role, vertical, team_id, valid_from } [SA-02]
    Core->>Core: Insert effective assignment record
    Emp->>Core: Complete activation & set credentials
    Emp->>Core: Login -> Authorized Workspace opens automatically
    
    opt Personnel Transfer / Promotion / Exit
        HR->>Core: POST /api/hr/lifecycle { employee_id, change_type, effective_date } [HR-02, HR-03]
        SA->>Core: POST /api/admin/assignments/transition [SA-04, SA-05]
        Note over Core,Ops: Historical Ownership Preservation Invariant
        Core->>Ops: Rebalance in-flight open tasks; preserve historical lead events & closed deals
    end
    
    opt Leave & Availability Dampening
        HR->>Core: POST /api/hr/leave { employee_id, leave_type, start_date, end_date } [HR-04]
        Core->>Ops: Suppress caller from TL automated allocation queues for leave duration
    end
```

### 6.1 Invariants for Personnel Governance
1. **Preservation of Historical Record:** When an employee transfers, is promoted, or exits (`HR-02`, `HR-03`, `SA-05`), their historical lead ownership events, call recordings, converted deals, and commission calculations remain immutable.
2. **Effective-Dated Assignment Scoping:** All system grants use `effective_from` and `effective_to` dates. Changes take effect on designated dates without disrupting past audit attribution.
3. **Leave-Aware Allocation:** Approved leave registered in HR (`HR-04`) immediately dampens frontline caller allocation availability in Team Lead workflows.


---

## 7. Multi-Vertical Referral Flow (`SC-23` → `NM-08`)

```mermaid
sequenceDiagram
    autonumber
    actor SC_W as Wealth Caller
    participant Hub as Inter-Vertical Referral Hub
    actor NM_B as Commercial Banking NM
    actor TL_B as Commercial Banking TL

    SC_W->>Hub: POST /api/wealth/referrals { prospect_id, target_vertical: 'banking', client_consent: true, rationale }
    Hub->>Hub: Create referral token (status: 'pending_review')
    Note over NM_B: NM Banking inspects incoming referrals (/national/exceptions)
    NM_B->>Hub: POST /api/national/referrals/decide { referral_id, decision: 'accepted' }
    Hub->>Hub: Create new Banking Lead record in stage 'new'
    Hub->>Hub: Record referral credit split for SC_W (percentage governed by client policy [Deck P320])
    Note over TL_B: Banking Lead enters Banking TL Allocation Queue
    TL_B->>Hub: Allocate lead to Banking Loan Officer
```
