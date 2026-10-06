# Technical Requirements Document (TRD) — Finverse CRM v2

**Document Status:** Canonical Technical Specification  
**Version:** 2.1.0 (Corrected — Repository Reconciled)  
**Effective Date:** 2026-10-06  
**Shared Schema Contract:** `packages/contracts/src/`  
**API Implementation:** `apps/api/src/`  
**Reference Action Deck:** `docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf` (Pages P314–P318)  

---

## 1. System Protocols & Contract Specifications

### 1.1 HTTP & Content-Type Standards
- **RESTful Endpoints:** Standard HTTP verbs (`GET`, `POST`, `PUT`, `PATCH`, `DELETE` where permitted; note that hard deletion is forbidden on business transaction records per `[Deck P005]`).
- **Request Payloads:** `application/json; charset=utf-8` with mandatory JSON bodies for mutations.
- **Response Payloads:** `application/json; charset=utf-8` for standard data; `application/pdf` for binary document streaming; `text/csv` for data exports.
- **Anti-CSRF & Content Sniffing Invariants:** 
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - JSON requests guarded by `jsonGuard` middleware (`apps/api/src/middleware/session.ts`).

### 1.2 Standard Error Response Protocol
All API endpoints conform to a standardized error contract across client and server:

```typescript
export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown> | { fieldErrors?: Record<string, string[]> };
  };
}
```

#### Standard Error Code Mapping (`packages/contracts/src/index.ts`)

| HTTP Status | Error Code | Trigger Condition & Remediation |
|---|---|---|
| `400 Bad Request` | `VALIDATION_FAILED` | Malformed JSON or syntax failure. |
| `401 Unauthorized` | `UNAUTHENTICATED` | Session cookie missing, expired, or invalid signature. Client redirects to `/login`. |
| `403 Forbidden` | `FORBIDDEN` | Valid session, but actor lacks the role, vertical grant, team scope, or record ownership. |
| `404 Not Found` | `NOT_FOUND` | Requested entity ID does not exist within the permitted tenant/vertical partition. |
| `409 Conflict` | `VERSION_CONFLICT` | Optimistic concurrency check failed (record updated by another user or session). |
| `422 Unprocessable`| `VALIDATION_FAILED` | Request payload fails Zod schema validation; details contains `fieldErrors`. |
| `500 Server Error` | `INTERNAL` | Unhandled database or operational exception. Sanitized error returned to client; full trace logged. |

---

## 2. Actual Implemented REST API Routes by Role

### 2.1 Authentication & Session (`/api/auth/*`)
- `POST /api/auth/login`: Authenticates credentials (`email`, `password`), resolves active effective assignment, sets HTTP-only signed session cookie, returns user profile and workspace manifest.
- `POST /api/auth/logout`: Invalidates session, clears cookie, emits audit event.
- `GET /api/auth/me`: Resolves current session, verifies assignment validity at `NOW()`, returns active employee context.

### 2.2 Frontline Sales Caller & Pipeline (`/api/*` via `wealthRouter` & `leadsRouter`)
- `GET /api/my-day`: Returns today's tasks, overdue follow-ups, appointments, and caller availability (`SC-01`).
- `GET /api/my-day/signal`: Returns live queue counts and operational workload signal (`SC-01`).
- `POST /api/availability`: Updates availability state (`available`, `break`, `meeting`, `offline`) (`SC-01`).
- `GET /api/leads`: Paginated lead query scoped by ownership, stage, source, search filters (`SC-02`).
- `GET /api/leads/:id`: Full lead record with masked fields, timeline events, and active tasks (`SC-03`).
- `PATCH /api/leads/:id`: Prospect information correction with immutable change tracking (`SC-04`).
- `GET /api/leads/:id/audit`: Returns field-level audit history for a prospect (`SC-04`).
- `GET /api/enquiries`: Lists self-sourced enquiries created by caller (`SC-05`).
- `POST /api/enquiries`: Creates self-sourced enquiry with source attribution (`SC-05`).
- `POST /api/enquiries/:id/publish`: Promotes enquiry into lead pool (`SC-05`).
- `GET /api/leads/:id/conversations`: Returns voice and message interaction history (`SC-06`, `SC-09`).
- `POST /api/leads/:id/calls`: Initiates simulated or bridged voice call (`SC-06`).
- `POST /api/calls/:id/state`: Advances call progress state (`SC-06`).
- `POST /api/calls/:id/wrapup`: Submits call wrap-up disposition and next action (`SC-07`).
- `POST /api/leads/:id/activities`: Records unrecorded manual interaction (`SC-08`).
- `POST /api/leads/:id/messages`: Sends pre-approved WhatsApp template message (`SC-09`).
- `POST /api/messages/:id/status`: Updates message delivery status (`SC-09`).
- `POST /api/inbound`: Receives inbound reply or missed call event (`SC-10`).
- `POST /api/leads/:id/opt-out`: Records DND opt-out or contact complaint (`SC-24`).
- `GET /api/tasks`: Lists active tasks and callbacks for caller (`SC-11`, `SC-13`).
- `POST /api/leads/:id/follow-ups`: Schedules follow-up callback (`SC-11`).
- `POST /api/tasks/:id/reschedule`: Reschedules promised callback with mandatory reason (`SC-12`).
- `POST /api/tasks/:id/transition`: Completes, cancels, or reopens task (`SC-13`).
- `POST /api/leads/:id/meetings`: Books prospect meeting or site visit (`SC-14`).
- `POST /api/meetings/:id/outcome`: Records meeting completion outcome (`attended`, `no-show`, `cancelled`) (`SC-14`).
- `POST /api/leads/:id/qualification`: Submits versioned suitability / qualification assessment (`SC-15`).
- `POST /api/leads/:id/stage`: Moves opportunity stage with gate validation (`SC-16`).
- `GET /api/leads/:id/proposals`: Lists proposals for lead (`SC-17`).
- `POST /api/leads/:id/proposals`: Creates draft proposal (`SC-17`).
- `POST /api/proposals/:id/submit`: Submits proposal for leadership approval (`SC-17`).
- `POST /api/proposals/:id/send`: Delivers approved proposal to prospect (`SC-17`).
- `POST /api/leads/:id/conversion`: Submits conversion request with credit splits for TL review (`SC-20`).
- `POST /api/leads/:id/loss`: Marks lead lost with mandatory reason (`SC-21`).
- `POST /api/leads/:id/reopen`: Submits lost lead reopen request (`SC-22`).
- `POST /api/leads/:id/handoff`: Requests lead handoff or cross-vertical referral (`SC-23`).
- `POST /api/leads/:id/help`: Raises operational blocker or metric correction request (`SC-28`).
- `GET /api/leads/:id/requests`: Lists pending outcome and help requests (`SC-20`, `SC-22`).
- `POST /api/requests/:id/decide`: Decides outcome request (Approve / Return / Reject) (`TL-07`, `TL-08`).
- `POST /api/leads/:id/documents/request`: Sends document upload request to client (`SC-18`).
- `POST /api/leads/:id/documents`: Uploads KYC or suitability evidence (`SC-19`).
- `GET /api/leads/:id/documents`: Lists verified document attachments (`SC-19`).
- `GET /api/views`: Lists caller saved views (`SC-02`).
- `POST /api/views`: Creates saved view definition (`SC-02`).
- `DELETE /api/views/:id`: Removes saved view definition (`SC-02`).
- `GET /api/performance`: Returns personal scorecard and KPI calculation basis (`SC-25`).
- `POST /api/reviews`: Records one-to-one reflection and commitments (`SC-26`).
- `POST /api/reports/meeting-pack`: Generates personal meeting review PDF (`SC-27`).

### 2.3 Team Lead Governance (`/api/tl/*` via `tlRouter`)
- `GET /api/tl/overview`: Returns team health, target pace, conversion rates, SLA breaches (`TL-01`).
- `GET /api/tl/leads/unassigned`: Lists unassigned leads available for allocation (`TL-02`).
- `POST /api/tl/leads/allocate`: Allocates single unassigned lead to associate (`TL-02`).
- `POST /api/tl/leads/batch-allocate`: Algorithmic batch allocation with capacity preview (`TL-03`).
- `POST /api/tl/workload/rebalance`: Rebalances active leads across supervised associates (`TL-04`).
- `GET /api/tl/workload/overdue`: Lists overdue callback tasks exceeding SLA (`TL-05`).
- `GET /api/tl/associates/:id`: Detailed associate performance drill-down (`TL-06`).
- `POST /api/tl/requests/:id/decision`: Approves or returns conversion proposal with structured evidence (`TL-07`).
- `POST /api/tl/quality/review`: Logs call quality scoring and coaching rubric (`TL-09`).
- `POST /api/tl/targets/distribute`: Distributes team target across associates (`TL-10`).
- `POST /api/tl/forecasts/submit`: Submits bottom-up team revenue forecast to Manager (`TL-11`).
- `POST /api/tl/coaching/one-to-one`: Schedules and logs associate one-to-one coaching (`TL-12`).
- `POST /api/tl/coaching/mentorship`: Assigns intern mentor and graded workload cap (`TL-13`).
- `POST /api/tl/requests/escalate`: Submits staffing or commercial escalation to Manager (`TL-14`, `TL-15`).
- `POST /api/tl/reports/export`: Generates binary Team Review Pack PDF (`TL-16`).
- `POST /api/tl/reports/schedules`: Configures recurring team report schedule (`TL-17`).
- `POST /api/tl/activity-corrections/:id/decision`: Decides activity correction request (`TL-18`).

### 2.4 Manager Governance (`/api/manager/*` via `managerRouter`)
- `GET /api/manager/overview`: Multi-team overview, target pace, backlog ageing (`MG-01`).
- `GET /api/manager/tls`: Lists supervised Team Leads and team scorecards (`MG-02`).
- `GET /api/manager/scorecard/:tlId`: Operating scorecard for specific Team Lead (`MG-02`).
- `POST /api/manager/actions`: Creates management action directive with 48h deadline (`MG-01`, `MG-08`).
- `GET /api/manager/actions`: Lists management actions within manager scope (`MG-01`).
- `GET /api/manager/transfers`: Lists cross-team transfer requests (`MG-03`).
- `POST /api/manager/transfers`: Creates cross-team lead transfer (`MG-03`).
- `POST /api/manager/transfers/decide`: Approves or returns lead transfer request (`MG-03`).
- `GET /api/manager/capacity`: Returns caller capacity utilization analysis (`MG-04`).
- `POST /api/manager/capacity/plan`: Saves and approves capacity recovery plan (`MG-04`).
- `GET /api/manager/targets`: Returns approved parent target and TL allocations (`MG-05`).
- `POST /api/manager/targets/allocate`: Allocates targets across TLs with remainder validation (`MG-05`).
- `GET /api/manager/forecasts`: Lists submitted TL team forecasts (`MG-06`).
- `POST /api/manager/forecasts/decide`: Challenges or approves TL forecast submission (`MG-06`).
- `GET /api/manager/forecasts/rollup`: Calculates bottom-up sum of accepted TL forecasts (`MG-07`).
- `POST /api/manager/forecasts/submit`: Freezes and submits adjusted Manager forecast to RM (`MG-07`).
- `GET /api/manager/sla-breaches`: Lists repeated SLA failure breaches (`MG-08`).
- `POST /api/manager/sla-breaches/resolve`: Enacts SLA breach resolution plan (`MG-08`).
- `GET /api/manager/commercial-exceptions`: Lists commercial exception requests (`MG-09`).
- `POST /api/manager/commercial-exceptions/decide`: Decides exception or escalates to RM (`MG-09`).
- `GET /api/manager/source-quality`: Returns lead source intake quality analysis (`MG-10`).
- `POST /api/manager/source-quality/remediation`: Requests vendor intake remediation (`MG-10`).
- `GET /api/manager/reviews`: Lists completed TL performance reviews (`MG-11`).
- `POST /api/manager/reviews`: Conducts formal review with structured commitments (`MG-11`).
- `GET /api/manager/lifecycle`: Lists associate promotion and transfer requests (`MG-12`).
- `POST /api/manager/lifecycle`: Submits employee lifecycle request to HR (`MG-12`).
- `GET /api/manager/meeting-pack/preview`: Previews Manager Meeting Pack KPI summary (`MG-13`).
- `POST /api/manager/meeting-pack/export`: Generates binary Meeting Pack PDF (`MG-13`).
- `GET /api/manager/meeting-pack/download/:id`: Downloads generated Meeting Pack PDF (`MG-13`).
- `GET /api/manager/schedules`: Lists recurring report generation schedules (`MG-13`).
- `POST /api/manager/schedules`: Registers recurring report schedule (`MG-13`).

### 2.5 Regional, National, Executive & Financial Endpoints
- **Regional Manager (`/api/regional/*`):** Territory coverage (`RM-03`), regional target cascade (`RM-04`), cross-manager transfers (`RM-05`), staffing plans (`RM-06`), regional forecast (`RM-07`), regional escalations (`RM-08`), manager reviews (`RM-09`), regional PDF packs (`RM-10`).
- **National Manager (`/api/national/*`):** Regional benchmarking (`NM-02`), national targets (`NM-03`), product economics (`NM-04`), product rule proposals (`NM-05`), national forecast (`NM-06`), cross-region transfers (`NM-07`), inter-vertical referrals (`NM-08`), national escalations (`NM-09`), RM reviews (`NM-10`), national PDF packs (`NM-11`).
- **CEO (`/api/ceo/*`):** Executive operating picture (`CEO-01`), cross-vertical comparisons (`CEO-02`), NM scorecards (`CEO-03`), corporate targets (`CEO-04`), consolidated forecast (`CEO-05`), growth initiatives (`CEO-06`), priority conflicts (`CEO-07`), operating risks (`CEO-08`), NM reviews (`CEO-09`), board PDF pack (`CEO-10`), commitment follow-through (`CEO-11`).
- **CFO (`/api/cfo/*`):** Revenue & cash overview (`CFO-01`), sales handoff verification (`CFO-02`), revenue recognition entries (`CFO-03`), receivable invoices (`CFO-04`), bank receipts import (`CFO-05`), invoice-receipt matching (`CFO-06`), suspense reconciliation (`CFO-07`), 3-way reconciliation freeze (`CFO-08`), ageing schedule (`CFO-09`), refunds (`CFO-10`), credit notes (`CFO-11`), incentive pools (`CFO-12`), disputes (`CFO-13`), period close certification (`CFO-14`), period reopening (`CFO-15`), budget variance (`CFO-16`), finance concurrence (`CFO-17`), certified finance PDF pack (`CFO-18`), DoA limits policy (`CFO-19`).

---

## 3. Concurrency Control & Optimistic Locking

Entities subject to concurrent modification (`leads`, `lead_tasks`, `team_targets`, `manager_targets`) include an integer `version` column:
- Updates check `WHERE id = $id AND version = $expectedVersion`.
- If zero rows are affected, the mutation fails with `409 Conflict` (`VERSION_CONFLICT`).
- The client receives the newer record state and prompts the user without silent data overwrite.

---

## 4. Idempotency & Financial Safety

Sensitive financial mutations (`CFO-03` revenue recognition, `CFO-04` invoice issuance, `CFO-14` period close) enforce idempotency:
- State transitions are validated against strict state preconditions.
- Duplicate submission of identical business keys within closed periods returns the existing durable record without duplicate ledger postings.
- Hard deletions are forbidden by foreign key constraints and append-only ledgers (`lead_events`, `finance_ledger_entries`, `audit_events`).
