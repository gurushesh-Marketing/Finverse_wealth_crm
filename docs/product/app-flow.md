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
            Note over UI: SC -> /wealth/my-day<br/>REL -> /rel/portfolio<br/>MG -> /manager/overview<br/>RM -> /regional/overview<br/>NM -> /national/overview<br/>CEO -> /ceo/overview<br/>CFO -> /cfo/overview<br/>DE -> /intake/batches<br/>HR -> /people/joiners<br/>SA -> /admin/users
        end
    end
```

### 1.1 HR Joiner Onboarding & Super Admin Account Activation Flow

```mermaid
sequenceDiagram
    autonumber
    actor HR as Human Resources (HR)
    actor SA as Super Admin (SA)
    actor Emp as New Employee
    participant API as Finverse API
    participant DB as PostgreSQL 16
    participant UI as Workspace UI

    HR->>API: POST /api/hr/onboarding/submit { fullName, primaryMobile, whatsappNumber, email }
    Note over HR,API: HR does not enter password or employee ID
    API->>DB: Check unique email & primary mobile
    alt Duplicate Identity
        API-->>HR: 409 CONFLICT (Duplicate Identity)
    else Unique Validated
        API->>DB: SELECT generate_next_employee_id()
        API->>DB: INSERT INTO employees (id, status='pending_approval', must_change_password=true, ...)
        API->>DB: INSERT INTO hr_lifecycle_requests (id, status='submitted', ...)
        API-->>HR: 201 Created { employeeId: "EMP-xxx", status: "Pending Super Admin Approval" }
    end

    Note over Emp: Pending candidate cannot log in (401 UNAUTHENTICATED) and receives zero leads

    SA->>API: GET /api/superadmin/onboarding/requests
    API-->>SA: List of pending candidates with full audit trail

    SA->>API: POST /api/superadmin/onboarding/approve { requestId, role, vertical, teamId, reportingManagerId, username }
    API->>DB: Validate team and manager belong to vertical; validate manager eligibility
    API->>API: Generate secure one-time temporary password (e.g. Tmp#...!)
    API->>DB: UPDATE employees SET status='active', username=..., password_hash=scrypt(...)
    API->>DB: INSERT INTO assignments (role, vertical, team_id, effective_from=CURRENT_DATE, ...)
    API->>DB: UPDATE hr_lifecycle_requests SET status='activated_by_admin'
    API-->>SA: 200 OK { username, temporaryPassword, ... }
    Note over SA: One-time temporary password displayed once in secure dialog

    Emp->>API: POST /api/auth/login { email: username, password: temporaryPassword }
    API-->>Emp: 200 OK { session: { mustChangePassword: true } }
    UI-->>Emp: Force Initial Login: Password Change Required Modal
    Emp->>API: POST /api/auth/change-password { newPassword }
    API->>DB: UPDATE employees SET password_hash=scrypt(newPassword), must_change_password=false
    API-->>Emp: 200 OK
    UI-->>Emp: Unlock authorized role workspace (/wealth/dashboard)
    Note over Emp: Sales Caller is now active and eligible for round-robin leads in assigned team
```

### 1.2 Universal Password Recovery Flow (`/login` -> Forgot Password)

1. **Self-Service Request:**
   - Any active CRM employee across all roles and verticals can click "Forgot password?" on `/login`.
   - The user enters their registered work email or username.
   - **Neutral Response:** The system always returns `"If an active account matches the details provided, a password reset link has been dispatched to the registered address."` whether or not the account exists, strictly preventing account enumeration attacks.
2. **Cryptographic Token & Outbox:**
   - If an active employee matches, the server generates a cryptographically secure 32-byte random token (`randomBytes(32)`).
   - Only its SHA-256 hash is stored in `account_recovery_requests` with a 1-hour expiration timestamp.
   - The reset link (`/reset-password?token=...`) is written to `local_delivery_outbox` with channel label `Local Delivery Adapter (Demo: No External Email Service)`.
3. **Atomic Consumption & Session Revocation:**
   - When the employee submits their new password via `/reset-password?token=...`:
     * The token is checked against `account_recovery_requests` (verified pending, not expired, matching hash).
     * The target employee must have `status: 'active'` (pending, rejected, disabled, or offboarded employees fail with 422 `ACCOUNT_INACTIVE`).
     * The employee's password hash is atomically replaced with a new scrypt hash, and `must_change_password` is set to `false`.
     * The recovery token and outbox record are marked consumed (`status: 'completed'`).
     * All existing sessions for that employee are revoked (`DELETE FROM sessions WHERE employee_id = ...`).
     * Subsequent attempts to reuse the token fail with 422 `TOKEN_ALREADY_USED`.

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

## 5. Data Entry Manual Publish & Caller Assignment Flow

The active contract is [Data Entry intake and routing](data-entry-intake-routing.md).
Normal manual form submission publishes immediately. An older staged draft remains
invisible to callers until the operator explicitly publishes it from the saved-records table.

```mermaid
sequenceDiagram
    autonumber
    actor DE as Data Entry Operator
    participant API as Data Entry API
    participant DB as PostgreSQL
    actor SC as Assigned Sales Caller

    DE->>API: POST /api/data-entry/manual-records (vertical, priority, publishImmediately: true)
    API->>API: Validate required fields and vertical grant
    API->>DB: Transaction: insert intake row, allocate eligible caller, insert lead and audit, mark published
    DB-->>API: Committed intake row, lead ID, assigned caller and team
    API-->>DE: Published receipt or explicit routing exception
    DE->>API: GET /api/data-entry/manual-records/:id
    API-->>DE: Persisted publication readback
    SC->>API: GET /api/leads
    API-->>SC: Assigned lead with priority flag; no other caller can read it
```

If no caller is eligible, the transaction records an unassigned routing exception
instead of cross-assigning the prospect. Round-robin grants one caller ownership;
the entire caller team does not receive access to that lead.

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
3. **Leave-Aware Allocation:** Approved leave registered in HR (`HR-05`) immediately dampens frontline caller allocation availability in Team Lead workflows.

### 6.2 Multi-Tier Superior Approval Hierarchy (Owner Requirement)
Every employee across all 4 operational verticals (Wealth, Banking, Markets, Real Estate) and shared horizontals must submit leave requests through an upward superior hierarchy:

```mermaid
sequenceDiagram
    autonumber
    actor Sub as Subordinate Employee (SC / TL / MG / RM / NM)
    participant Core as Leave Approval Engine
    actor Sup as Designated Superior Approver
    actor HR as HR Specialist

    Sub->>Core: POST /api/hr/leave-requests { leave_type, start_date, end_date, reason, handover_notes }
    Core->>Core: Determine next approval tier based on employee role & team
    Core-->>Sub: Request submitted (status: 'submitted', current_tier_approver_id: Sup.id)
    Sup->>Core: GET /api/approvals/leave-requests/pending
    Sup->>Core: POST /api/approvals/leave-requests/:id/decision { decision: 'approved' | 'rejected', notes }
    alt Approved
        Core->>Core: Set status = 'approved'
        Core->>Core: Sync to employee_leaves (dampen lead allocation 100%)
        Core-->>HR: Emit leave_approved event for workforce visibility
    else Rejected
        Core->>Core: Set status = 'rejected', record rejection_reason
    end
```

#### Universal Line-of-Command Routing
```
Sales Caller (SC) ──> Team Lead (TL) ──> Manager (MG) ──> Regional Manager (RM) ──> National Manager (NM) ──> Chief Executive Officer (CEO)
```

#### Non-Hierarchical / Governance Approver Configuration
For roles outside the vertical sales line, approvers are explicitly configured via system rules:
| Subordinate Role | Primary Configured Approver | Fallback Approver | Self-Approval Policy |
|---|---|---|---|
| **Data Entry (DE)** | Operations Lead / Intake Head | Super Admin | `422 SELF_APPROVAL_FORBIDDEN` |
| **Human Resources (HR)** | Chief Executive Officer (CEO) | Chief Financial Officer (CFO) | `422 SELF_APPROVAL_FORBIDDEN` |
| **Super Administrator (SA)** | Chief Executive Officer (CEO) | Chief Financial Officer (CFO) | `422 SELF_APPROVAL_FORBIDDEN` |
| **Chief Financial Officer (CFO)** | Chief Executive Officer (CEO) | Board Audit Committee Chair | `422 SELF_APPROVAL_FORBIDDEN` |
| **Chief Executive Officer (CEO)** | Board of Directors / Compensation Chair | Senior Non-Executive Director | `422 SELF_APPROVAL_FORBIDDEN` |

### 6.3 Paid Work-From-Home (WFH) & Attendance Evidence Flow (Owner Requirement)
**Mandatory Invariant:** CRM login or token authentication alone is **strictly NOT attendance**. Attendance requires verified active engagement:

```mermaid
sequenceDiagram
    autonumber
    actor Emp as Remote Employee
    participant API as Attendance API
    participant DB as Attendance Records
    actor Sup as Direct Supervisor

    Emp->>API: POST /api/attendance/check-in { mode: 'wfh', location_coordinates, timestamp }
    API->>DB: INSERT attendance_records (status: 'pending_review', check_in_at: NOW())
    API-->>Emp: Check-in logged. Attendance pending progress submission.
    
    loop During Shift
        Emp->>API: POST /api/attendance/progress-log { deliverable_title, progress_pct, evidence_artifact_path }
        API->>DB: INSERT attendance_progress_logs
    end

    Emp->>API: POST /api/attendance/check-out { wfh_progress_summary, work_evidence_url }
    API->>DB: UPDATE attendance_records (check_out_at: NOW(), total_hours: derived)
    
    Sup->>API: GET /api/attendance/supervisor-review
    Sup->>API: POST /api/attendance/:id/verify { decision: 'verified' | 'rejected', notes }
    API->>DB: UPDATE attendance_records (status: 'verified', verified_by: Sup.id)
```

### 6.4 Effective-Dated Compensation & Payroll Calculation Flow (Owner Requirement)
```mermaid
sequenceDiagram
    autonumber
    actor HR as HR Specialist
    actor CFO as Chief Financial Officer
    participant Engine as Payroll Engine
    participant DB as PostgreSQL Payroll Tables

    HR->>Engine: POST /api/hr/salary-structures { employee_id, effective_from, monthly_ctc, components }
    Engine->>DB: INSERT employee_salary_structures (versioned, non-overlapping)
    
    Note over HR,CFO: Monthly Cycle: 28th of (M-1) to 27th of M
    HR->>Engine: POST /api/payroll/cycles/preview { cycle_month: '2026-02', period_start: '2026-01-28', period_end: '2026-02-27' }
    Engine->>DB: Aggregate attendance_records (attended_days)
    Engine->>DB: Aggregate employee_leaves (approved_leave_days)
    Engine->>Engine: Calculate pro-rata factor and gross/net pay
    Engine-->>HR: Return payroll preview packet
    
    HR->>Engine: POST /api/payroll/cycles/lock { cycle_month: '2026-02' }
    Engine->>DB: UPDATE payroll_periods SET status = 'locked'
    
    CFO->>Engine: POST /api/cfo/payroll/certify { cycle_month: '2026-02', cryptographic_hash }
    Engine->>DB: UPDATE payroll_periods SET status = 'certified', certified_at = NOW()
```

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

---

## 8. Priority Lead Allocation & Lead Inbox Workflow (Client-Added Requirement)

```mermaid
sequenceDiagram
    autonumber
    actor DE as Data Entry Operator
    participant API as Ingestion API (/api/data-entry)
    participant DB as PostgreSQL Core (Round-Robin Cursor & Leads)
    actor SC as Sales Caller (Assigned)
    participant UI as Lead Inbox UI (/wealth/prospects)

    DE->>API: POST /api/data-entry/bulk-import/jobs/:id/process-chunk (with isPriority rows)
    API->>DB: SELECT * FROM round_robin_cursors WHERE vertical = $1 AND team_id = $2 FOR UPDATE
    DB-->>API: Cursor (last_assigned_employee_id)
    API->>API: Select next active Sales Caller (WFH eligible, not away, not on leave)
    API->>DB: INSERT INTO leads (..., is_priority = true, assigned_at = NOW())
    API->>DB: INSERT INTO lead_events (kind: 'priority-marked') & lead_audit (field: 'is_priority')
    API->>DB: UPDATE round_robin_cursors SET last_assigned_employee_id = caller.id, updated_at = NOW()
    
    SC->>UI: Open Lead Inbox (/wealth/prospects)
    UI->>API: GET /api/wealth/leads
    API->>DB: SELECT * FROM leads WHERE owner_employee_id = SC.id ORDER BY is_priority DESC, assigned_at DESC NULLS LAST, due_at ASC NULLS LAST, id ASC
    DB-->>UI: Leads sorted with priority leads first, recent assignments first
    UI->>UI: Check localStorage for dismissed priority lead IDs
    alt Unacknowledged Priority Leads Present
        UI->>SC: Display prominent dismissible banner ("High-Priority Leads Assigned")
        SC->>UI: Click "Dismiss Notification"
        UI->>UI: Persist dismissed IDs in localStorage (no repeat on refresh)
    end
```

---

## 9. Secure Click-to-Call & Voice Provider Architecture (`SC-06` Preparation)

```mermaid
sequenceDiagram
    autonumber
    actor SC as Sales Caller (Browser)
    participant UI as Caller UI (/wealth/prospects/:id)
    participant API as Finverse API Gateway
    participant Config as Restricted Server Config
    participant DB as PostgreSQL Core
    participant Adapter as Voice Provider Adapter (Synthetic / Bonvoice)

    Note over SC,UI: Caller sees ONLY masked number (+91 •••••345)
    SC->>UI: Click "Call now"
    UI->>API: POST /api/calls/initiate { leadId: 'FV-1001' }
    
    API->>DB: Query lead by ID & caller ownership / vertical scope
    alt Not Owned or Outside Scope
        DB-->>API: 0 rows returned
        API-->>UI: 403 FORBIDDEN / 404 NOT FOUND
    else Authorized Owner
        DB-->>API: ScopedLead record (includes raw phone)
    end

    API->>DB: Check contact_suppressions (lead_id, active = true)
    alt Voice Suppression Active
        API-->>UI: 403 FORBIDDEN ("Contact suppression active")
    end

    API->>Config: Get approved outbound calling identity (caller_calling_identities)
    alt No Approved Identity Found
        API-->>UI: 422 UNPROCESSABLE ("CALLER_IDENTITY_NOT_CONFIGURED")
    end

    Note over API,Adapter: Raw destination passed privately in server memory
    API->>Adapter: initiateOutboundCall(callId, callerIdentity, rawDestination)
    Adapter-->>API: VoiceProviderCallResult { providerRef: 'SYN-CALL-...', status: 'connecting', evidenceStatus: 'simulated' }

    API->>DB: INSERT INTO calls (status: 'connecting', provider_ref, caller_identity, destination_masked)
    API->>DB: INSERT INTO lead_events (kind: 'call', note: 'Outbound test call simulation initiated...')

    API-->>UI: 201 Created { id, status: 'connecting', evidenceStatus: 'simulated', providerRef, destinationMasked }
    Note over UI,SC: UI displays state 'connecting', Provider Ref, and masked target
```


