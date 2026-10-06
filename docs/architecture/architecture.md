# Master System Architecture — Finverse CRM v2

**Document Status:** Canonical Architecture Specification  
**Version:** 2.0.0  
**Effective Date:** 2026-10-06  
**Reference Action Deck:** `docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf` (Pages P001–P005, P314–P319)  
**Codebase Repositories:** `apps/web`, `apps/api`, `packages/contracts`, `database/migrations`  

---

## 1. System Topology & Monorepo Architecture

Finverse CRM v2 is architected as an institutional-grade, highly cohesive pnpm monorepo. It enforces strict separation of concerns across client rendering, domain services, shared contract validation, and relational persistence.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              pnpm Monorepo Root                              │
├───────────────────┬───────────────────┬───────────────────┬─────────────────┤
│    apps/web       │     apps/api      │packages/contracts │    database/    │
│  (React 18 + Vite │(Node.js + Express │ (Zod Schemas + TS │ (PostgreSQL 16  │
│  + Tailwind v4 +  │ + TypeScript + pg │ Shared Interface  │ Versioned SQL   │
│  shadcn Base UI)  │ Connection Pool)  │    Contracts)     │   Migrations)   │
└───────────────────┴───────────────────┴───────────────────┴─────────────────┘
```

### 1.1 Package Responsibilities & Boundaries

| Package | Technology Stack | Architectural Responsibility & Isolation Boundaries |
|---|---|---|
| **`apps/web`** | React 18, Vite, React Router v6, Tailwind CSS v4, shadcn/ui Base UI, `@fontsource/*` | **Zero Trust Presentation Layer.** Renders the server-authorized module manifest. Contains zero database drivers, secret keys, or business logic. All mutations and data queries execute via `/api` HTTP proxy. |
| **`apps/api`** | Node.js, Express, TypeScript, native `pg` driver, `cookie`, `pdfkit` | **Authoritative Domain Engine.** Sole orchestrator of authentication, role/scope authorization, atomic transactions, business rules, outbox events, and streaming PDF exports. |
| **`packages/contracts`** | TypeScript, Zod | **Single Source of Contract Truth.** Shared request/response schemas, DTOs, enum definitions, error models, and validation logic consumed symmetrically by web and api packages. |
| **`database`** | PostgreSQL 16 Alpine, raw SQL migrations, `tsx` runner | **Authoritative State & Audit Store.** Relational schemas with strict foreign keys, check constraints, composite indexes, and immutable event ledgers. |

---

## 2. Multi-Tenant & Multi-Vertical Domain Model

Finverse CRM v2 operates a unified multi-vertical architecture across four distinct commercial divisions:
1. `wealth` (Wealth Management)
2. `banking` (Commercial Banking)
3. `markets` (Markets & Securities / Trading)
4. `real-estate` (Real Estate Advisory)

### 2.1 Multi-Vertical Partitioning & Invariants
```
                      ┌─────────────────────────────────┐
                      │    Shared Enterprise Identity   │
                      │  (employees, teams, assignments)│
                      └────────────────┬────────────────┘
                                       │
     ┌──────────────────┬──────────────┴─────┬──────────────────┐
     ▼                  ▼                    ▼                  ▼
┌──────────────┐ ┌──────────────┐     ┌──────────────┐   ┌──────────────┐
│ Wealth Mgmt  │ │ Comm Banking │     │   Markets    │   │ Real Estate  │
│ - Mandates   │ │ - Loans      │     │ - Demat / KYC│   │ - Properties │
│ - Risk Score │ │ - Collateral │     │ - Brokerage  │   │ - Site Visits│
│ - AUM Track  │ │ - Sanction   │     │ - Turnover   │   │ - GBV Fees   │
└──────────────┘ └──────────────┘     └──────────────┘   └──────────────┘
```

- **Database-Level Isolation:** Leads, tasks, events, and targets are explicitly partitioned by the `vertical` column. Queries dynamically bind the current vertical grant (`WHERE vertical = $vertical`).
- **Opaque Identity Matching (`[Deck P005, P317]`):**
  When an enquiry arrives with an email or phone number existing in another vertical, the system creates an internal linkage token but **NEVER** leaks the prospect's opportunities, assets, or advisor notes across vertical boundaries.
- **Cross-Vertical Referral Handoff Protocol (`SC-23` → `NM-08`):**
  An advisor in Wealth referring a client to Commercial Banking initiates a structured referral (`cross_vertical_referrals`). The referral contains only consented contact details and business rationale. It enters the destination vertical's National Manager queue in status `pending`. Upon explicit acceptance by the destination NM, the referral is published into the destination vertical's allocation pool.

---

## 3. Security, Identity & Authorization Engine

Security in Finverse CRM v2 follows a strict **Deny-by-Default** paradigm enforced at the network, session, and query levels (`[Deck P002, P314]`).

### 3.1 Authentication & Session Management
- **Password Hashing:** Passwords are hashed using cryptographic `scrypt` with salt and cost parameters ($N=16384, r=8, p=1$). Plaintext credentials are never persisted.
- **Session Tokens:** Upon valid authentication, the server creates a cryptographically signed HTTP-only cookie (`fvc2_session`).
- **Cookie Security:** Cookies are configured with `HttpOnly = true`, `SameSite = Lax`, `Path = /`, and `Secure = true` in production environments.
- **CSRF Defense:** Custom header enforcement (`X-Requested-With: XMLHttpRequest` or `Content-Type: application/json`) ensures protection against cross-site request forgery.

### 3.2 Dynamic Scope Resolution & Effective-Dated Grants
Authorization does not rely on static role flags. Instead, every request resolves privileges from the `assignments` table:
```sql
SELECT role, vertical, team_id, valid_from, valid_to 
FROM assignments 
WHERE employee_id = $1 
  AND valid_from <= NOW() 
  AND (valid_to IS NULL OR valid_to > NOW())
ORDER BY created_at DESC;
```
- **Interval Bounds:** An assignment takes effect only when `valid_from <= NOW()`. A future-dated promotion does not confer premature privileges.
- **Boundary Transitions:** When an assignment's `valid_to` expires, active sessions immediately fail subsequent permission checks with `403 FORBIDDEN`.

### 3.3 The Authorization Scoping Hierarchy
Authorization evaluates five orthogonal dimensions on every request:
1. **Role Grant:** Does the employee have the required role (`SC`, `TL`, `MG`, `RM`, `NM`, `CEO`, `CFO`, `DE`, `HR`, `SA`)?
2. **Vertical Grant:** Is the operation scoped to an authorized business vertical?
3. **Hierarchy Scope:**
   - `SC`: Constrained to leads where `assigned_employee_id = employee.id`.
   - `TL`: Constrained to leads within granted teams (`team_id IN (granted_teams)`).
   - `MG`: Constrained to supervised team leaders within assigned vertical.
   - `RM`: Constrained to managers and teams within geographic region.
   - `NM`: Scoped across all regions within the single national vertical.
   - `CEO / CFO`: Cross-vertical visibility across all company entities.
4. **Field-Level Masking:** Unassigned advisors or unauthorized roles view phone numbers and emails masked (`+91 98*****12`).
5. **Workflow State Gate:** Operations validate state preconditions (e.g., cannot approve a conversion unless stage is `pending_conversion`).

---

## 4. Transaction Architecture & The Outbox Pattern

All critical business operations execute within atomic database transactions with an append-only event ledger (`[Deck P003, P317]`):

```
Client Request (e.g. TL-07 Approve Conversion)
       │
       ▼
┌───────────────────────────────────────────────────────────┐
│              BEGIN PostgreSQL Transaction                 │
│                                                           │
│  1. SELECT FOR UPDATE on Lead record (concurrency check)  │
│  2. Validate state invariant: stage = 'pending_conversion'│
│  3. UPDATE leads SET stage = 'converted', ...             │
│  4. INSERT INTO outcome_requests (decision, evidence)     │
│  5. INSERT INTO sales_handoffs (handoff to CFO)           │
│  6. INSERT INTO lead_events (immutable audit fact)        │
│  7. INSERT INTO outbox_events (async worker notification) │
│                                                           │
│                      COMMIT                               │
└───────────────────────────────────────────────────────────┘
       │
       ▼
Client Response (200 OK + Updated Record)
```

### 4.1 Immutable Event Ledger (`lead_events`, `audit_events`)
- Business entities are never mutated in silence. Every state change writes to `lead_events`:
  - `lead_id`: Target entity ID.
  - `actor_employee_id`: Authorized actor.
  - `actor_role`: Role assumed during mutation.
  - `event_type`: Specific action code (e.g., `SC_CONVERSION_SUBMIT`, `TL_CONVERSION_APPROVE`).
  - `payload`: Snapshot of input fields, diffs, and verification hashes.
  - `created_at`: Canonical database timestamp (`NOW()`).
- Hard deletion of transaction evidence, prospect audit logs, or financial facts is strictly prohibited by schema constraints (`[Deck P005]`).

---

## 5. Asynchronous Workers & Scheduled Execution

The API service incorporates high-reliability background schedulers designed for concurrency safety and idempotent execution:

### 5.1 Follow-Up Reminder Engine (`executeDueReminders`)
- **Interval:** Runs every 30 seconds (`30_000ms`).
- **Functionality:** Queries `lead_tasks` where `due_at <= NOW()` and `reminder_sent = false`. Emits operational alerts and appends reminder events to prospect timelines.
- **Worker Safety:** Uses atomic `UPDATE ... RETURNING` queries to prevent duplicate execution across multiple API instances.

### 5.2 Recurring Report Scheduler (`runDueSchedules`)
- **Interval:** Runs every 60 seconds (`60_000ms`).
- **Functionality:** Evaluates registered schedules in `report_schedules` (Team Lead, Manager, Regional, National, CFO).
- **Timezone Discipline:** Adheres strictly to `Asia/Kolkata` local time boundaries:
  - Weekly packs: Every Monday at `09:00 IST`.
  - Monthly packs: 1st of every month at `00:15 IST`.
- **Concurrency Guard:** Implements advisory locks or status flags (`running`, `completed`, `failed`) ensuring a job is never processed concurrently by competing worker threads.

### 5.3 Server-Side Streaming PDF Engine (`pdfkit`)
- **Execution:** Generates pixel-perfect binary PDF documents server-side (Meeting Packs, Certified Finance Packs, One-to-One Review Packs).
- **Security:** PDFs are written to protected directories (`data/*_exports/`) outside public web roots. File downloads require active session authorization matching the generation scope.
- **Verification Hash:** Every generated PDF document embeds a SHA-256 integrity hash in its header and audit event record.

---

## 6. Integration Architecture & External Gateways

While current development utilizes synthetic demo drivers, the system interfaces with external gateways through standardized, vendor-agnostic abstraction adapters. Provider selection remains an open client decision (`[CLIENT DECISION: Undecided, Deck P320]`):

```
┌───────────────────────────────────────────────────────────┐
│                   Domain Service Layer                    │
└─────────────┬───────────────────────────────┬─────────────┘
              │                               │
              ▼                               ▼
    ┌──────────────────┐            ┌──────────────────┐
    │ Telephony Adapter│            │ Messaging Adapter│
    │ (Vendor Agnostic)│            │ (Vendor Agnostic)│
    └─────────┬────────┘            └─────────┬────────┘
              │                               │
              ▼                               ▼
       External Voice                  External Message
       Provider Cloud                   Gateway Cloud
```

1. **Telephony Bridge (`SC-06`, `SC-08`):**
   - Initiates outbound agent-to-prospect call bridges via abstract provider adapter.
   - Listens for webhook completion payloads with call duration, provider call UUID, and recording URL. Provider selection pending client decision (`[Deck P320]`).
2. **Messaging Adapter (`SC-09`):**
   - Transmits registered, pre-approved compliance templates via abstract messaging interface.
   - Enforces opt-out (`SC-24`) and DND compliance before dispatch. Vendor selection pending client decision (`[Deck P320]`).
3. **Document Storage Gateway (`SC-18`, `SC-19`):**
   - Stores KYC and client evidence. In local development, persists to protected filesystem storage under `data/`; designed for pluggable object storage adapter once hosting environment is selected.

---

## 7. User-Approved Engineering Policies (SDLC & SOLID)

### 7.1 Software Development Life Cycle (SDLC) Policy
Every operational role and functional feature advances through a structured, evidence-led iterative lifecycle:
```
requirements → analysis/design → planning → implementation → verification/remediation → authorized release → maintenance
```
- **Requirements Stage:** Extracted from authoritative Action Deck contracts, brand guidelines, and client decision categories.
- **Analysis & Design Stage:** State transitions, UI zone anatomy, error protocols, and mobile ergonomics specified before code changes.
- **Planning Stage:** File paths, component names, and task dependencies documented in `implementation-plan.md`.
- **Implementation Stage:** TypeScript code adhering strictly to `@finverse/contracts` and PostgreSQL relational schema invariants.
- **Verification & Remediation Stage:** Automated test assertions executed and verified. Remediation executed immediately on regressions.
- **Authorized Release Stage:** Formal verification evidence recorded in `STATUS.md` and `BUILD_LOG.md`.
- **Maintenance Stage:** Knowledge graphs refreshed deterministically via local Graphify runtime.

### 7.2 SOLID Architecture Principles in Practice
Applied across React components, TypeScript modules, services, and repositories:
- **Single Responsibility Principle (SRP):** Cohesive responsibilities. UI components render specific tasks; repositories manage specific persistence domains; route handlers handle HTTP validation and response protocol.
- **Open/Closed Principle (OCP):** Extension points (e.g. new vertical business rules, reporting cadences) designed through modular schema definitions rather than altering core transactional logic.
- **Liskov Substitution Principle (LSP):** Symmetrical Zod contracts ensure API responses and UI consumers substitute cleanly without unexpected runtime type coercion.
- **Interface Segregation Principle (ISP):** Repositories expose focused, domain-specific methods rather than fat generic persistence interfaces. Components receive minimal, focused prop surfaces.
- **Dependency Inversion Principle (DIP):** Route controllers depend on repository abstractions; web pages depend on typed client SDK modules (`managerApi`, `wealthApi`, etc.) rather than ad-hoc HTTP calls.
- **Anti-Overengineering Rule:** Apply SOLID to maintain clean boundaries; avoid unnecessary classes, layers, or speculative frameworks.

### 7.3 Role Execution Protocol
When feature development is active:
```
complete one role → test its actions → fix failures → check design → update knowledge → next role
```

---

## 8. Preservation of Original Client Decisions (`[Deck P320]`)

In strict conformance with Action Deck Page 320 (*"CLIENT DECISIONS: Business rules still to approve. Examples in this deck are clearly illustrative; these decisions define the production behaviour"*), all open matters are organized under the six original deck categories:

1. **Products and stages:**
   - *Original Deck Text:* "Name products, stage evidence, conversion gates and lost/reopen policy in each vertical."
   - *[Derived Question]:* What specific qualification documents, investment thresholds, and lost recontact grace periods govern Commercial Banking, Markets & Trading, and Real Estate Advisory?
2. **Commercial events:**
   - *Original Deck Text:* "Define sales credit, recognised revenue, invoices, cash, reversals and incentive eligibility."
   - *[Derived Question]:* What specific commission clawback percentage and holdback duration apply to frontline sales advisors? What exact revenue recognition timing triggers GST invoice issuance?
3. **Approvals and limits:**
   - *Original Deck Text:* "Set authority thresholds, delegates, escalation windows and independent reviewer requirements."
   - *[Derived Question]:* What are the financial threshold limits for Manager vs Regional Manager commercial discount exceptions?
4. **Targets and periods:**
   - *Original Deck Text:* "Confirm timezone, fiscal year, period close, target allocation and revised report policy."
   - *[Derived Question]:* What emergency unlock policies and dual-authorization rules govern reopening a closed accounting period?
5. **Providers and consent:**
   - *Original Deck Text:* "Select calling, WhatsApp, email and document vendors; confirm consent and retention rules."
   - *[Derived Question]:* Which cloud telephony provider (Twilio, Exotel, local carrier), WhatsApp BSP vendor, and object storage provider will be provisioned? What regulatory data retention schedule (e.g. 5, 8, or 10 years) applies?
6. **Deployment and data:**
   - *Original Deck Text:* "Confirm identity provider, website integration, import format, data migration and hosting."
   - *[Derived Question]:* Which enterprise SSO/SAML provider, hosting environment, and legacy CRM import format will be utilized?

---

## 9. Production Delivery Roadmap & Release Architecture

The Finverse CRM v2 production deployment is structured across sequential, evidence-verified milestones to guarantee operational stability and prevent regression across commercial divisions.

### 9.1 Delivery Order & Role Progression
Feature development and verification proceed strictly in order:
1. **Wealth Vertical Finalization:** Caller (`SC-01..28`) → Team Lead (`TL-01..18`) → Manager (`MG-01..13`) → Regional Manager (`RM-01..10`) → National Manager (`NM-01..11`) → CEO (`CEO-01..11`) → CFO (`CFO-01..19`).
   - *Invariant:* Complete one role, execute automated tests, remediate defects, and verify deck-aligned design before proceeding to the next role. Code presence in later roles does not imply acceptance.
2. **Superadmin (`SA-01..SA-11`):** Institutional account activation, scoped role/vertical/team grants, reporting hierarchy maintenance, role transfers/promotions, secure offboarding, disaster recovery, approved system rules, security incident audits, background job management, and expiring emergency access.
3. **Human Resources (`HR-01..HR-07`):** Account provisioning requests, effective-dated transfers/promotions, exits/offboarding, leave records, caller allocation availability dampening, probation/training milestone management, and workforce demographic reporting.
   - *Invariant:* Historical lead ownership, activity ledgers, and performance credits are permanently preserved across personnel transfers, promotions, or departures.
4. **Data Entry (`DE-01..DE-07`):** Batch intake capture/import, schema mapping, rejected-row correction, deduplication review, permitted batch publication, provenance audit receipts, and intake quality metrics.
   - *Routing Chain:* `DE-05` (Batch Publication) → `TL-02` / `TL-03` (Team Allocation Pool). Zero arbitrary lead ownership granted to Data Entry operators. Zero duplicate lead generation on repeated publish attempts. Held/rejected rows remain excluded and independently recoverable.
5. **First Production Release Gate:** Integrated daily operational verification across horizontal and vertical workflows, negative scenario testing, production operations handover for Dhanan, and release package certification.

### 9.2 Later Vertical Release Architecture (Multi-Vertical Expansion)
Subsequent business verticals—`banking` (Corporate/Commercial Banking), `markets` (Markets & Securities Trading), and `real-estate` (Real Estate Advisory)—are introduced into the **same deployed CRM instance**:
- **Persistence Preservation:** Existing client records, caller assignments, historical timelines, uploaded KYC evidence, and in-flight workflows are fully preserved.
- **Backward-Compatible Migrations:** All new vertical schemas use versioned, backward-compatible SQL migrations (additive tables, optional foreign keys).
- **Staging Rehearsal & Regression:** Migrations and vertical workflows are rehearsed in staging against automated regressions before production execution.
- **Isolated Vertical Enablement:** A new vertical is activated only after its vertical-specific roles, shared intake, and administrative interactions pass formal verification.
- **Zero Destructive Operations:** The production database is never reset, reseeded, or replaced with demo data. Destructive rollbacks that discard live operational records entered post-deployment are strictly prohibited.



