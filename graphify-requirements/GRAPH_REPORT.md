# Graph Report - finverse-crm-v2  (2026-10-06)

## Corpus Check
- 13 files · ~245,000 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1906 nodes · 3804 edges · 139 communities (133 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Requirements Cluster 0
- Requirements Cluster 1
- Requirements Cluster 2
- Requirements Cluster 3
- Requirements Cluster 4
- Requirements Cluster 5
- Requirements Cluster 6
- Requirements Cluster 7
- Requirements Cluster 8
- Requirements Cluster 9
- Requirements Cluster 10
- Requirements Cluster 11
- Requirements Cluster 12
- Requirements Cluster 13
- Requirements Cluster 14
- Requirements Cluster 15
- Requirements Cluster 16
- Requirements Cluster 17
- Requirements Cluster 18
- Requirements Cluster 19
- Requirements Cluster 20
- Requirements Cluster 21
- Requirements Cluster 22
- Requirements Cluster 23
- Requirements Cluster 24
- Requirements Cluster 25
- Requirements Cluster 26
- Requirements Cluster 27
- Requirements Cluster 28
- Requirements Cluster 29
- Requirements Cluster 30
- Requirements Cluster 31
- Requirements Cluster 32
- Requirements Cluster 33
- Requirements Cluster 34
- Requirements Cluster 35
- Requirements Cluster 36
- Requirements Cluster 37
- Requirements Cluster 38
- Requirements Cluster 39
- Requirements Cluster 40
- Requirements Cluster 41
- Requirements Cluster 42
- Requirements Cluster 43
- Requirements Cluster 44
- Requirements Cluster 45
- Requirements Cluster 46
- Requirements Cluster 47
- Requirements Cluster 48
- Requirements Cluster 49
- Requirements Cluster 50
- Requirements Cluster 51
- Requirements Cluster 52
- Requirements Cluster 53
- Requirements Cluster 54
- Requirements Cluster 55
- Requirements Cluster 56
- Requirements Cluster 57
- Requirements Cluster 58
- Requirements Cluster 59
- Requirements Cluster 60
- Requirements Cluster 61
- Requirements Cluster 62
- Requirements Cluster 63
- Requirements Cluster 64
- Requirements Cluster 65
- Requirements Cluster 66
- Requirements Cluster 67
- Requirements Cluster 68
- Requirements Cluster 69
- Requirements Cluster 70
- Requirements Cluster 71
- Requirements Cluster 72
- Requirements Cluster 73
- Requirements Cluster 74
- Requirements Cluster 75
- Requirements Cluster 76
- Requirements Cluster 77
- Requirements Cluster 78
- Requirements Cluster 79
- Requirements Cluster 80
- Requirements Cluster 81
- Requirements Cluster 82
- Requirements Cluster 83
- Requirements Cluster 84
- Requirements Cluster 85
- Requirements Cluster 86
- Requirements Cluster 87
- Requirements Cluster 88
- Requirements Cluster 89
- Requirements Cluster 90
- Requirements Cluster 91
- Requirements Cluster 92
- Requirements Cluster 93
- Requirements Cluster 94
- Requirements Cluster 95
- Requirements Cluster 96
- Requirements Cluster 97
- Requirements Cluster 98
- Requirements Cluster 99
- Requirements Cluster 100
- Requirements Cluster 101
- Requirements Cluster 102
- Requirements Cluster 103
- Requirements Cluster 104
- Requirements Cluster 105
- Requirements Cluster 106
- Requirements Cluster 107
- Requirements Cluster 108
- Requirements Cluster 109
- Requirements Cluster 110
- Requirements Cluster 111
- Requirements Cluster 112
- Requirements Cluster 113
- Requirements Cluster 114
- Requirements Cluster 115
- Requirements Cluster 116
- Requirements Cluster 117
- Requirements Cluster 118
- Requirements Cluster 119
- Requirements Cluster 120
- Requirements Cluster 121
- Requirements Cluster 122
- Requirements Cluster 123
- Requirements Cluster 124
- Requirements Cluster 125
- Requirements Cluster 126
- Requirements Cluster 127
- Requirements Cluster 128
- Requirements Cluster 129
- Requirements Cluster 130
- Requirements Cluster 131
- Requirements Cluster 132
- Requirements Cluster 133
- Requirements Cluster 134
- Requirements Cluster 135
- Requirements Cluster 136
- Requirements Cluster 137
- Requirements Cluster 138

## God Nodes (most connected - your core abstractions)
1. `Canonical Document: Technical Requirements Document` - 283 edges
2. `Canonical Document: Master Product Requirements Document` - 152 edges
3. `Canonical Document: Master Backend Relational Database Schema Specification` - 148 edges
4. `Canonical Document: Master Application State & Flow Specification` - 147 edges
5. `Vertical: Commercial Banking` - 145 edges
6. `Vertical: Wealth Management` - 144 edges
7. `Vertical: Real Estate Advisory` - 142 edges
8. `Shared Requirement: Server resolves role, vertical, team; authorization enforced on every server read and mutation (hidden menu is not authorization)` - 138 edges
9. `Vertical: Markets & Securities / Trading` - 136 edges
10. `Shared Requirement: Immutable audit trail; no hard deletion of evidence supporting transactions, sales, or regulatory records` - 135 edges

## Surprising Connections (you probably didn't know these)
- `Verification Evidence: Dedicated Wealth Manager Governance API Suite (apps/api/test/manager.api.test.ts)` --documented_in_implementation_plan--> `Canonical Document: Master Implementation & Resumption Plan`  [EXTRACTED]
  apps/api/test/manager.api.test.ts → docs/process/implementation-plan.md
- `Verification Evidence: Dedicated Team Lead Governance API Suite (apps/api/test/tl.api.test.ts)` --documented_in_implementation_plan--> `Canonical Document: Master Implementation & Resumption Plan`  [EXTRACTED]
  apps/api/test/tl.api.test.ts → docs/process/implementation-plan.md
- `Verification Evidence: Continuous Multi-Role Vertical Lifecycle Integration Suite (apps/api/test/vertical_lifecycle.api.test.ts)` --documented_in_implementation_plan--> `Canonical Document: Master Implementation & Resumption Plan`  [EXTRACTED]
  apps/api/test/vertical_lifecycle.api.test.ts → docs/process/implementation-plan.md
- `Verification Evidence: Dedicated Wealth Frontline API Suite (apps/api/test/wealth.api.test.ts)` --documented_in_implementation_plan--> `Canonical Document: Master Implementation & Resumption Plan`  [EXTRACTED]
  apps/api/test/wealth.api.test.ts → docs/process/implementation-plan.md
- `SC-02 Filter, search and save a lead view` --has_dedicated_suite_assertions--> `Verification Evidence: Dedicated Wealth Frontline API Suite (apps/api/test/wealth.api.test.ts)`  [EXTRACTED]
  docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf → apps/api/test/wealth.api.test.ts

## Communities (139 total, 6 thin omitted)

### Community 0 - "Requirements Cluster 0"
Cohesion: 0.04
Nodes (49): CEO-05 Review the consolidated company forecast, DE-07 Export an intake quality report, NM-10 Run an RM performance review, Canonical Document: Master Backend Relational Database Schema Specification, Exception Handling (CEO-05): Unaccepted or late submissions remain visible rather than silently replaced...., Exception Handling (DE-07): A batch still processing is labelled incomplete and not counted as fully accepted...., Exception Handling (NM-10): Unresolved metric corrections remain visible and linked...., Field (CEO-05) Confidence: Evidence-based categories (+41 more)

### Community 1 - "Requirements Cluster 1"
Cohesion: 0.05
Nodes (43): SC-17 Prepare and send a proposal, SC-20 Submit a conversion for approval, TL-07 Approve or return a conversion, Exception Handling (SC-17): Expired or withdrawn product content blocks sending. An approved proposal edited afterward must be approved again...., Exception Handling (SC-20): Rejected submission returns with precise reasons. The caller corrects and resubmits a new version without losing history..., Exception Handling (TL-07): Conflict, missing evidence or absent authority blocks approval and routes to the next eligible approver...., Field (SC-17) Attachments: Approved product document, Field (SC-17) Commercial terms: Within allowed limits (+35 more)

### Community 2 - "Requirements Cluster 2"
Cohesion: 0.05
Nodes (40): SC-19 Upload, replace or inspect evidence, SC-22 Request a lost opportunity to be reopened, TL-08 Resolve a reopen or duplicate request, Exception Handling (SC-19): Rejected evidence shows the reviewer reason and correction path. No hard deletion of evidence supporting an approved sal..., Exception Handling (SC-22): Old lead outside current scope: send a reference-only request through support; do not reveal its customer details...., Exception Handling (TL-08): Restricted cross-vertical match shows only a match-review reference, not the other vertical customer record...., Field (SC-19) Document type: Milestone evidence, Field (SC-19) File: Approved format and size (+32 more)

### Community 3 - "Requirements Cluster 3"
Cohesion: 0.08
Nodes (28): Brand Asset: Original artwork only (never recolor finverse-logo.png; 1:1.22 proportion), Brand Typography: Manrope Headings, Inter Body, JetBrains Mono Code/Numbers, Canonical Document: Master UI/UX Screen & Interaction Flow Specification, Canonical Document: Master Design System Specification, Visual Rendering: Screen Page P006, Visual Rendering: Screen Page P007, Visual Rendering: Screen Page P043, [DesignFlow] Overview (+20 more)

### Community 4 - "Requirements Cluster 4"
Cohesion: 0.07
Nodes (27): HR-01 Request a new employee account, SA-01 Create an account and activation invitation, Exception Handling (HR-01): Incomplete placement leaves access pending, never a default company-wide dashboard...., Exception Handling (SA-01): Duplicate identity or absent placement blocks activation rather than creating broad default access...., Field (HR-01) Approvals: Hiring authority, Field (HR-01) Employee: New unique identity, Field (HR-01) Employment type: Permanent / intern, Field (HR-01) Proposed role: Caller (+19 more)

### Community 5 - "Requirements Cluster 5"
Cohesion: 0.07
Nodes (27): SC-07 Complete call wrap-up and next action, TL-09 Review call quality and log coaching, Exception Handling (SC-07): Uncertain outcome: keep the call in Needs wrap-up. Unsaved notes stay in a recoverable draft with an expiry policy...., Exception Handling (TL-09): Missing or unavailable recording: mark unassessed. Never invent a score from call duration alone...., Field (SC-07) Call ID: CALL-7821, Field (SC-07) Conversation note: Callback requested, Field (SC-07) Disposition: Connected, Field (SC-07) Due: 26 Sep, 11:00 IST (+19 more)

### Community 6 - "Requirements Cluster 6"
Cohesion: 0.08
Nodes (26): DE-05 Publish valid rows to allocation, TL-02 Allocate an unassigned lead, Exception Handling (DE-05): Partial failures stay visible and retry independently. No duplicate creation on repeated publish...., Exception Handling (TL-02): No eligible associate: retain visible queue ownership and escalate capacity need. Never assign to a disabled user...., Field (DE-05) Batch: B-104, Field (DE-05) Destination: V1 allocation queue, Field (DE-05) Eligible rows: 430, Field (DE-05) Held rows: 70 (+18 more)

### Community 7 - "Requirements Cluster 7"
Cohesion: 0.08
Nodes (26): HR-02 Request an effective-dated team transfer, SA-05 Activate a transfer or promotion, Exception Handling (HR-02): A pending transfer does not expose the destination interface or move leads early...., Exception Handling (SA-05): Failed activation transaction leaves the prior valid state intact and raises an Admin incident...., Field (HR-02) Effective time: 01 Oct, 09:00, Field (HR-02) Employee: Asha, Field (HR-02) Handoff: Named lead owners, Field (HR-02) New assignment: V1 Beta (+18 more)

### Community 8 - "Requirements Cluster 8"
Cohesion: 0.08
Nodes (26): MG-05 Allocate Manager targets to TLs, TL-10 Distribute an approved team target, Exception Handling (MG-05): Unallocated remainder is visible and never silently distributed...., Exception Handling (TL-10): Transfer mid-period: apply the approved prorating rule, preserve prior target versions and explain the difference...., Field (MG-05) Approved parent target: 100 wins, Field (MG-05) Period: October, Field (MG-05) Proration: Approved policy, Field (MG-05) Remainder: Visible (+18 more)

### Community 9 - "Requirements Cluster 9"
Cohesion: 0.08
Nodes (25): CEO-04 Approve company and vertical targets, NM-08 Accept or decline a cross-vertical referral, Exception Handling (CEO-04): Unresolved finance basis or inconsistent allocations block final approval...., Exception Handling (NM-08): No acceptance leaves the request pending and escalates at its deadline; it does not expose the other vertical...., Field (CEO-04) Capacity assumptions: Attached, Field (CEO-04) Company target: Proposed basis, Field (CEO-04) Planning cycle: Next quarter, Field (CEO-04) Vertical allocations: V1-V4 (+17 more)

### Community 10 - "Requirements Cluster 10"
Cohesion: 0.08
Nodes (25): CFO-08 Reconcile sales, revenue and cash totals, CFO-14 Close a reporting period, Exception Handling (CFO-08): Unexplained material variance blocks period certification according to the approved close policy...., Exception Handling (CFO-14): Failed checklist blocks close and assigns correction owners; it does not silently ignore material gaps...., Field (CFO-08) Cash: Settled receipts, Field (CFO-08) Difference: Explained bridge, Field (CFO-08) Period: September, Field (CFO-08) Revenue: Recognition ledger (+17 more)

### Community 11 - "Requirements Cluster 11"
Cohesion: 0.08
Nodes (24): MG-06 Challenge and approve TL forecasts, TL-11 Submit the team forecast, Exception Handling (MG-06): Late submissions remain flagged; no silent substitution with zero or the previous month...., Exception Handling (TL-11): Unpriced or stale opportunities appear as incomplete. Exclude them from numeric totals until their basis is defined...., Field (MG-06) Assumptions: Stages and close dates, Field (MG-06) Decision: Accept / Return, Field (MG-06) Forecast cycle: October, Field (MG-06) TL submission: Version 2 (+16 more)

### Community 12 - "Requirements Cluster 12"
Cohesion: 0.08
Nodes (24): MG-07 Submit the Manager forecast to RM, RM-07 Submit the regional forecast, Exception Handling (MG-07): An unapproved override cannot enter the official forecast...., Exception Handling (RM-07): Incomplete submissions are disclosed and escalated; no silent roll-forward...., Field (MG-07) Accepted TL forecasts: 14 of 14, Field (MG-07) Overrides: Explicit reason, Field (MG-07) Period: October, Field (MG-07) Risks: Capacity and ageing (+16 more)

### Community 13 - "Requirements Cluster 13"
Cohesion: 0.12
Nodes (21): Brand Palette: #113F3D Primary, #155451 Deep Teal, #6FA8A2 Mint Accent, #7FB5AE Pale Mint, #DCEEEA Mint Tint, #1B1F1E Charcoal, #6B7280 Gray, #FFFFFF White, Visual Rule: Single solid #113F3D primary action button per screen; secondary actions outline/ghost, Canonical Document: Master Implementation & Resumption Plan, Verification Evidence: Playwright Shell & Branding E2E Spec (apps/web/e2e), Engineering Policy: Role-by-Role Execution Protocol, Engineering Policy: Software Development Life Cycle (SDLC), Engineering Policy: SOLID Architecture Principles, Shared Requirement: 12 canonical acceptance scenarios (wrong-role URL, other-caller lead, concurrent assignment, etc.) (+13 more)

### Community 14 - "Requirements Cluster 14"
Cohesion: 0.12
Nodes (17): Canonical Document: Master System Architecture, [Architecture] Overview, [Architecture] 4. Transaction Architecture & The Outbox Pattern, [Architecture] 4.1 Immutable Event Ledger (`lead_events`, `audit_events`), [Architecture] 5. Asynchronous Workers & Scheduled Execution, [Architecture] 5.1 Follow-Up Reminder Engine (`executeDueReminders`), [Architecture] 5.2 Recurring Report Scheduler (`runDueSchedules`), [Architecture] 5.3 Server-Side Streaming PDF Engine (`pdfkit`) (+9 more)

### Community 15 - "Requirements Cluster 15"
Cohesion: 0.12
Nodes (16): SC-04 Correct prospect information, Exception Handling (SC-04): Possible duplicate: pause the identity change and submit a review. Never merge customer records automatically from this ..., Field (SC-04) Correction reason: Customer correction, Field (SC-04) Display name: Prospect B, Field (SC-04) Email: Optional, Field (SC-04) Phone: Verified contact field, Field (SC-04) Preferred language: English, Reporting (SC-04): A correction does not create a new lead or improve contact counts. Contact permission remains a separate record.... (+8 more)

### Community 16 - "Requirements Cluster 16"
Cohesion: 0.13
Nodes (15): SC-03 Open a prospect and inspect the full record, Exception Handling (SC-03): Reassigned while open: show a read-only access-changed message, clear sensitive fields and return to the inbox...., Field (SC-03) Contact: Prospect B / masked number, Field (SC-03) Next action: Call today 11:00, Field (SC-03) Opportunity: FV-1042, Field (SC-03) Owner: Asha / Alpha, Field (SC-03) Product: V1 product, Field (SC-03) Source: Website / campaign C12 (+7 more)

### Community 17 - "Requirements Cluster 17"
Cohesion: 0.13
Nodes (15): SC-05 Create a permitted self-sourced enquiry, Exception Handling (SC-05): Existing enquiry: link or send for duplicate review. Missing permission keeps the record out of outbound contact queues...., Field (SC-05) Need: Customer requirement, Field (SC-05) Permission evidence: Reference and date, Field (SC-05) Phone: Required verified format, Field (SC-05) Product: Within V1, Field (SC-05) Prospect: New prospect, Field (SC-05) Source: Employee referral (+7 more)

### Community 18 - "Requirements Cluster 18"
Cohesion: 0.13
Nodes (15): SC-08 Record a manual call with clear evidence status, Exception Handling (SC-08): Duplicate suspected: flag for TL review. Incorrect saved entries use a correction, not silent deletion...., Field (SC-08) Activity type: Manual voice call, Field (SC-08) Duration: Self-reported, Field (SC-08) Note: Customer callback, Field (SC-08) Occurred at: 25 Sep, 14:00 IST, Field (SC-08) Outcome: Connected, Field (SC-08) Reason: Provider outage (+7 more)

### Community 19 - "Requirements Cluster 19"
Cohesion: 0.13
Nodes (15): SC-09 Send an approved WhatsApp message, Exception Handling (SC-09): Template unavailable or permission missing: disable Send with a reason. Use a secure document link for sensitive informa..., Field (SC-09) Conversation: Prospect B / V1, Field (SC-09) Language: English, Field (SC-09) Permission: Recorded and active, Field (SC-09) Preview: Customer-facing text, Field (SC-09) Template: Appointment reminder, Field (SC-09) Variables: Date, time, secure link (+7 more)

### Community 20 - "Requirements Cluster 20"
Cohesion: 0.13
Nodes (15): SC-11 Schedule a follow-up, Exception Handling (SC-11): Duplicate open task for the same purpose: offer Update existing or explicitly confirm a separate task...., Field (SC-11) Action: Voice call, Field (SC-11) Due: 26 Sep, 11:00 IST, Field (SC-11) Lead: FV-1042, Field (SC-11) Priority: Normal, Field (SC-11) Purpose: Confirm documents, Field (SC-11) Reminder: 15 minutes before (+7 more)

### Community 21 - "Requirements Cluster 21"
Cohesion: 0.13
Nodes (15): SC-13 Complete, cancel or reopen a task, Exception Handling (SC-13): A task moved to another owner cannot be completed from a stale caller screen...., Field (SC-13) Cancellation reason: Required if cancelled, Field (SC-13) Evidence: Call or note reference, Field (SC-13) Next due: 27 Sep, 10:00, Field (SC-13) Next step: Submit documents, Field (SC-13) Outcome: Completed, Field (SC-13) Task: TASK-120 (+7 more)

### Community 22 - "Requirements Cluster 22"
Cohesion: 0.13
Nodes (15): SC-14 Book a prospect meeting or visit, Exception Handling (SC-14): Slot taken during save: show alternative slots. Failed invitation does not silently cancel an already reserved appointme..., Field (SC-14) Agenda: Product discussion, Field (SC-14) Attendees: Prospect and advisor, Field (SC-14) Lead: FV-1042, Field (SC-14) Location: Office / approved link, Field (SC-14) Meeting type: Consultation / visit, Field (SC-14) Slot: 28 Sep, 15:00 IST (+7 more)

### Community 23 - "Requirements Cluster 23"
Cohesion: 0.13
Nodes (15): SC-15 Qualify the opportunity, Exception Handling (SC-15): Product mismatch: request an approved referral. The caller cannot change the lead into another vertical...., Field (SC-15) Expected value: Estimate with currency, Field (SC-15) Fit checklist: Configured questions, Field (SC-15) Need: Documented requirement, Field (SC-15) Next step: Prepare proposal, Field (SC-15) Product: Approved V1 product, Field (SC-15) Time horizon: Within 30 days (+7 more)

### Community 24 - "Requirements Cluster 24"
Cohesion: 0.13
Nodes (15): SC-18 Request documents securely, Exception Handling (SC-18): Expired link can be replaced after permission checking. A suspicious file stays quarantined and unavailable to users...., Field (SC-18) Checklist: V1 product version 2, Field (SC-18) Due: 29 Sep, Field (SC-18) Lead: FV-1042, Field (SC-18) Reminder: Enabled, Field (SC-18) Requested files: Configured evidence, Field (SC-18) Upload link: Expiring customer link (+7 more)

### Community 25 - "Requirements Cluster 25"
Cohesion: 0.14
Nodes (14): CFO-11 Approve a credit note or revenue reversal, Exception Handling (CFO-11): Adjustment beyond authority or into a locked period requires escalation and cannot be backdated silently...., Field (CFO-11) Adjustment type: Credit / reversal, Field (CFO-11) Amount: Verified correction, Field (CFO-11) Effective date: Open permitted period, Field (CFO-11) Original entry: REV-310 / INV-310, Field (CFO-11) Reason: Cancellation, Reporting (CFO-11): Revised finance totals reconcile to the full ledger; historic reports retain prior versions.... (+6 more)

### Community 26 - "Requirements Cluster 26"
Cohesion: 0.14
Nodes (14): SA-02 Grant a role with precise organisation scope, Exception Handling (SA-02): Conflicting grants or a reporting cycle block publication. Administrative authority is not a routine sales override...., Field (SA-02) Allowed teams: Alpha and Beta, Field (SA-02) Approver: Approved request, Field (SA-02) Employee: Meera, Field (SA-02) Role: Team leader, Field (SA-02) Validity: Start and optional expiry, Field (SA-02) Vertical: V1 (+6 more)

### Community 27 - "Requirements Cluster 27"
Cohesion: 0.14
Nodes (14): SC-02 Filter, search and save a lead view, Exception Handling (SC-02): No match: show an empty state and Clear filters. Another caller lead ID returns no exposed customer information...., Field (SC-02) Due: Today, Field (SC-02) Saved view: New website leads, Field (SC-02) Search: Prospect or lead ID, Field (SC-02) Source: Website, Field (SC-02) Stage: Not contacted, Reporting (SC-02): Changing a filter changes the displayed slice only. It never changes lead attribution or report definitions.... (+6 more)

### Community 28 - "Requirements Cluster 28"
Cohesion: 0.14
Nodes (14): SC-06 Place a voice call, Exception Handling (SC-06): Provider unavailable: offer Retry or a labelled manual activity. Repeated button clicks must not start duplicate calls...., Field (SC-06) Call mode: Approved business line, Field (SC-06) Number: Masked until authorised dial, Field (SC-06) Permission: Eligible, Field (SC-06) Prospect: FV-1042 / Prospect B, Field (SC-06) Provider: Connected, Reporting (SC-06): Only unique provider-confirmed calls count as verified attempts. Connected duration comes from provider evidence.... (+6 more)

### Community 29 - "Requirements Cluster 29"
Cohesion: 0.14
Nodes (14): SC-10 Handle an inbound reply or missed call, Exception Handling (SC-10): Ownership changed: route to the new owner. Never leave an inbound message assigned to a disabled account...., Field (SC-10) Channel: WhatsApp reply, Field (SC-10) Customer intent: Reschedule, Field (SC-10) Matched enquiry: FV-1042, Field (SC-10) Next task: Confirm new time, Field (SC-10) Received: 25 Sep, 14:10 IST, Reporting (SC-10): Track first response and unresolved inbound age separately from outbound attempt counts.... (+6 more)

### Community 30 - "Requirements Cluster 30"
Cohesion: 0.14
Nodes (14): SC-12 Reschedule a promised callback, Exception Handling (SC-12): Approval required: keep the old committed deadline active until the change is approved; display both dates clearly...., Field (SC-12) Customer informed: Yes, Field (SC-12) New due: 26 Sep, 16:00, Field (SC-12) Original due: 26 Sep, 11:00, Field (SC-12) Reason: Customer requested, Field (SC-12) Task: TASK-120, Reporting (SC-12): Rescheduling never erases a missed commitment. Show revised workload and original on-time performance separately.... (+6 more)

### Community 31 - "Requirements Cluster 31"
Cohesion: 0.14
Nodes (14): SC-16 Move an opportunity in the pipeline, Exception Handling (SC-16): Stale record: show the newer stage and request review. A UI drag cannot bypass a locked or rejected milestone...., Field (SC-16) Current stage: Contacted, Field (SC-16) Opportunity: FV-1042, Field (SC-16) Reason: Customer requested callback, Field (SC-16) Requested stage: Follow-up, Field (SC-16) Required evidence: Next task details, Reporting (SC-16): Stage counts and ageing refresh from authoritative events. Dragging a card without saving changes no metrics.... (+6 more)

### Community 32 - "Requirements Cluster 32"
Cohesion: 0.14
Nodes (14): SC-21 Mark a lead lost with a useful reason, Exception Handling (SC-21): Converted records cannot be changed to Lost by the caller. Use a cancellation/refund request to protect financial histor..., Field (SC-21) Competitor: Optional factual entry, Field (SC-21) Explanation: Customer declined current offer, Field (SC-21) Future contact: Based on permission, Field (SC-21) Loss reason: Not interested, Field (SC-21) Opportunity: FV-1042, Reporting (SC-21): Loss analysis groups by product, reason, source and event-time hierarchy. Cohort metrics preserve their defined denomina... (+6 more)

### Community 33 - "Requirements Cluster 33"
Cohesion: 0.14
Nodes (14): SC-23 Request a handoff or cross-vertical referral, Exception Handling (SC-23): Declined referral returns with reason. The sender sees handoff status, not the receiving vertical workspace...., Field (SC-23) Customer permission: Evidence attached, Field (SC-23) Destination: Approved receiving queue, Field (SC-23) Handoff note: Minimum necessary context, Field (SC-23) Opportunity: FV-1042, Field (SC-23) Reason: Different product need, Reporting (SC-23): Earlier activities stay with the original actor. Referral credit, if used, is separately configured and cannot duplicate... (+6 more)

### Community 34 - "Requirements Cluster 34"
Cohesion: 0.14
Nodes (14): SC-24 Record an opt-out or contact complaint, Exception Handling (SC-24): Conflicting channel evidence is reviewed by the policy owner; outreach remains blocked for the disputed channel...., Field (SC-24) Channels: Requested suppression scope, Field (SC-24) Complaint note: Customer statement, Field (SC-24) Received at: 25 Sep, 16:20, Field (SC-24) Request: Stop WhatsApp contact, Field (SC-24) Source: Customer reply, Reporting (SC-24): Suppressed contacts are visible as a separate operational category. Users cannot erase opt-out to improve reachability.... (+6 more)

### Community 35 - "Requirements Cluster 35"
Cohesion: 0.14
Nodes (14): SC-25 Inspect personal performance and its calculation, Exception Handling (SC-25): Late evidence displays a revised report version. Open finance periods remain provisional and visibly labelled...., Field (SC-25) Comparison: Previous equivalent period, Field (SC-25) Metric: Conversion cohort, Field (SC-25) Other periods: Quarter / Half-year / Year, Field (SC-25) Period: Daily / Weekly / Monthly, Field (SC-25) View: Historical assignment, Reporting (SC-25): Show verified/manual activity, transfers received, targets, wins, credited revenue and last refresh independently.... (+6 more)

### Community 36 - "Requirements Cluster 36"
Cohesion: 0.14
Nodes (14): SC-26 Prepare for and acknowledge a one-to-one, Exception Handling (SC-26): Disputed metric: submit a correction request linked to the evidence. Do not overwrite the meeting snapshot silently...., Field (SC-26) Commitments: Owner and due date, Field (SC-26) Employee response: Optional disagreement, Field (SC-26) Review: September performance, Field (SC-26) Reviewer: Current authorised TL, Field (SC-26) Self-reflection: Wins and blockers, Reporting (SC-26): Review completion and commitment closure appear in the permitted coaching report, separate from sales results.... (+6 more)

### Community 37 - "Requirements Cluster 37"
Cohesion: 0.14
Nodes (14): SC-27 Generate a personal meeting PDF, Exception Handling (SC-27): Access revoked before download: deny the file. Downloaded copies cannot be technically recalled...., Field (SC-27) Period: September, Field (SC-27) Recipient: Self / authorised reviewer, Field (SC-27) Report: Personal performance, Field (SC-27) Sections: Results, funnel, commitments, Field (SC-27) Snapshot: As-of 25 Sep, 18:00, Reporting (SC-27): PDF stores metric version, cutoff and period. It must reconcile with the selected on-screen snapshot.... (+6 more)

### Community 38 - "Requirements Cluster 38"
Cohesion: 0.14
Nodes (14): SC-28 Raise a blocker or request a metric correction, Exception Handling (SC-28): Urgent access issue goes to Super Admin. A pending dispute never grants temporary access to another dashboard...., Field (SC-28) Evidence: Permitted attachment, Field (SC-28) Expected correction: Describe discrepancy, Field (SC-28) Priority: Normal, Field (SC-28) Record reference: CALL-7821, Field (SC-28) Request type: Incorrect activity attribution, Reporting (SC-28): Accepted corrections append an adjustment or revised fact and retain the prior report version.... (+6 more)

### Community 39 - "Requirements Cluster 39"
Cohesion: 0.14
Nodes (14): Client Decision [Deck P320]: Approvals and limits, Client Decision [Deck P320]: Commercial events, Client Decision [Deck P320]: Deployment and data, Client Decision [Deck P320]: Products and stages, Client Decision [Deck P320]: Providers and consent, Client Decision [Deck P320]: Targets and periods, Canonical Document: Master Product Requirements Document, [PRD] Overview (+6 more)

### Community 40 - "Requirements Cluster 40"
Cohesion: 0.15
Nodes (13): CEO-06 Approve a growth or capacity initiative, Exception Handling (CEO-06): Budget not approved: keep initiative conditionally approved and block dependent spending commitments...., Field (CEO-06) Budget dependency: CFO review, Field (CEO-06) Business case: Demand and forecast gap, Field (CEO-06) Initiative: Additional V1 sales capacity, Field (CEO-06) Milestones: Named owners, Field (CEO-06) Sponsor: NM V1, Reporting (CEO-06): Track approved plan against actual milestones and measured outcome, not only planned benefits.... (+5 more)

### Community 41 - "Requirements Cluster 41"
Cohesion: 0.15
Nodes (13): CFO-02 Verify a sales-to-finance handoff, Exception Handling (CFO-02): Conflicting amount or missing evidence blocks finance posting while preserving the approved sales event...., Field (CFO-02) Conversion approval: WIN-120, Field (CFO-02) Deal: DEAL-310, Field (CFO-02) Decision: Accept / Return, Field (CFO-02) Evidence: Milestone and contract, Field (CFO-02) Product rule: Revenue version 2, Reporting (CFO-02): Track pending finance handoffs and processing age separately from conversion counts.... (+5 more)

### Community 42 - "Requirements Cluster 42"
Cohesion: 0.15
Nodes (13): CFO-03 Approve a revenue recognition entry, Exception Handling (CFO-03): Closed period or self-approval blocks posting. Use a governed adjustment workflow...., Field (CFO-03) Amount: INR 25,000, Field (CFO-03) Entry: REV-310, Field (CFO-03) Evidence: Verified earning milestone, Field (CFO-03) Policy: Approved product trigger, Field (CFO-03) Recognition date: 25 Sep, Reporting (CFO-03): Recognised revenue is the sum of approved positive and negative entries by recognition date.... (+5 more)

### Community 43 - "Requirements Cluster 43"
Cohesion: 0.15
Nodes (13): CFO-04 Create or approve a receivable invoice, Exception Handling (CFO-04): Invalid tax/configuration or duplicate invoice reference holds the draft for correction...., Field (CFO-04) Customer / counterparty: Verified entity, Field (CFO-04) Deal reference: DEAL-310, Field (CFO-04) Due date: 30 Sep, Field (CFO-04) Net amount: INR 25,000, Field (CFO-04) Tax: Approved external tax rule, Reporting (CFO-04): Receivables use invoices, credits and allocated receipts. Invoice amount is not automatically recognised revenue.... (+5 more)

### Community 44 - "Requirements Cluster 44"
Cohesion: 0.15
Nodes (13): CFO-07 Investigate an unmatched payment, Exception Handling (CFO-07): Suspected duplicate or fraud is escalated to the designated owner; no automatic write-off...., Field (CFO-07) Amount: INR 12,500, Field (CFO-07) Case owner: Finance reviewer, Field (CFO-07) Evidence: Bank reference, Field (CFO-07) Receipt: RCPT-505, Field (CFO-07) Status: Unmatched, Reporting (CFO-07): Unmatched cash remains visible in cash totals and suspense, not as unexplained revenue.... (+5 more)

### Community 45 - "Requirements Cluster 45"
Cohesion: 0.15
Nodes (13): CFO-10 Approve a refund request, Exception Handling (CFO-10): Approval alone does not mean money was refunded. Failed execution stays pending with an accountable owner...., Field (CFO-10) Beneficiary: Verified original path, Field (CFO-10) Eligible amount: Verified balance, Field (CFO-10) Original receipt: RCPT-504, Field (CFO-10) Reason: Approved cancellation, Field (CFO-10) Request: REFUND-040, Reporting (CFO-10): Refund reporting uses actual settlement date and linked commercial reversal where applicable.... (+5 more)

### Community 46 - "Requirements Cluster 46"
Cohesion: 0.15
Nodes (13): DE-01 Capture a source-backed enquiry, Exception Handling (DE-01): Missing permission can retain a quarantined record for correction but cannot authorise outreach...., Field (DE-01) Contact: Validated phone/email, Field (DE-01) Permission evidence: Reference and date, Field (DE-01) Product: Granted vertical, Field (DE-01) Prospect: New enquiry, Field (DE-01) Source: Named source, Reporting (DE-01): Count accepted, invalid and duplicate intake separately.... (+5 more)

### Community 47 - "Requirements Cluster 47"
Cohesion: 0.15
Nodes (13): DE-02 Upload and map a data file, Exception Handling (DE-02): Retry the same batch without duplicating opportunities. A mapping change creates a new reviewed version...., Field (DE-02) File: Approved CSV/XLSX template, Field (DE-02) Mapping: Name, phone, product, evidence, Field (DE-02) Preview: First validated rows, Field (DE-02) Source: Vendor batch reference, Field (DE-02) Vertical: V1, Reporting (DE-02): Quality report reconciles submitted rows to accepted, duplicate, invalid and pending rows.... (+5 more)

### Community 48 - "Requirements Cluster 48"
Cohesion: 0.15
Nodes (13): DE-03 Correct rejected intake rows, Exception Handling (DE-03): Ambiguous source information stays pending and routes back to the source owner...., Field (DE-03) Batch: B-104, Field (DE-03) Correction: Approved V1 product, Field (DE-03) Error: Missing product, Field (DE-03) Reason: Source confirmation, Field (DE-03) Status: Invalid, Reporting (DE-03): Measure error rate and correction turnaround without treating retries as new submissions.... (+5 more)

### Community 49 - "Requirements Cluster 49"
Cohesion: 0.15
Nodes (13): DE-04 Review a possible duplicate, Verification Status: Unimplemented Workspaces (Schema & Contracts Specified Only), Exception Handling (DE-04): Data Entry cannot merge restricted customer identities without a specific steward grant...., Field (DE-04) Decision: Link / New enquiry / Escalate, Field (DE-04) Incoming row: B-104 / 18, Field (DE-04) Match: Restricted candidate summary, Field (DE-04) Reason: Same contact and enquiry, Reporting (DE-04): Duplicate intake is excluded from fresh-opportunity counts but remains visible in source quality.... (+5 more)

### Community 50 - "Requirements Cluster 50"
Cohesion: 0.15
Nodes (13): HR-03 Request a promotion with retained career history, Exception Handling (HR-03): Dual duties require explicit dated grants; they are never inferred from the promotion...., Field (HR-03) Effective time: 01 Oct, Field (HR-03) Employee: Asha, Field (HR-03) New role: Team leader, Field (HR-03) Old workload: Reassign or explicit secondary duty, Field (HR-03) Reporting scope: Approved teams, Reporting (HR-03): Promotion does not transfer past personal sales into new team performance.... (+5 more)

### Community 51 - "Requirements Cluster 51"
Cohesion: 0.15
Nodes (13): HR-04 Coordinate an employee exit, Exception Handling (HR-04): Urgent suspension routes immediately to Admin; business work goes to an accountable holding queue if no recipient exists..., Field (HR-04) Access revocation: Scheduled, Field (HR-04) Employee: Employee J, Field (HR-04) Exit time: 30 Sep, 18:00, Field (HR-04) Open work: Handoff checklist, Field (HR-04) Replacement: Separate new identity, Reporting (HR-04): Exit checklist tracks operational completion without copying the leavers personal performance to another person.... (+5 more)

### Community 52 - "Requirements Cluster 52"
Cohesion: 0.15
Nodes (13): HR-05 Record leave and allocation availability, Exception Handling (HR-05): Leave does not automatically transfer every lead. Supervisor must confirm the required handoff...., Field (HR-05) Absence: Approved leave, Field (HR-05) Allocation status: Unavailable, Field (HR-05) Coverage owner: TL, Field (HR-05) Employee: Asha, Field (HR-05) Start/end: 28-30 Sep, Reporting (HR-05): Capacity reports use available eligible staff; performance prorating follows the signed target policy.... (+5 more)

### Community 53 - "Requirements Cluster 53"
Cohesion: 0.15
Nodes (13): HR-06 Track probation, training and review completion, Exception Handling (HR-06): Expired intern grants trigger access review, not automatic permanent-role conversion...., Field (HR-06) Due date: 30 Sep, Field (HR-06) Employee: Dev, Field (HR-06) Milestone: Probation review, Field (HR-06) Supervisor: Meera, Field (HR-06) Training: Required modules, Reporting (HR-06): Track completion rates using eligible employee cohorts and explicit exclusions.... (+5 more)

### Community 54 - "Requirements Cluster 54"
Cohesion: 0.15
Nodes (13): MG-01 Investigate performance across team leaders, Verification Evidence: Dedicated Wealth Manager Governance API Suite (apps/api/test/manager.api.test.ts), Exception Handling (MG-01): A low sample-size team displays its sample size; do not automatically rank it as best or worst...., Field (MG-01) Compare: Same cohort basis, Field (MG-01) Drill-down: TL then associate, Field (MG-01) Period: Month to date, Field (MG-01) Scope: Assigned TLs, Reporting (MG-01): Show numerator, denominator, cutoffs and data gaps for fair comparisons.... (+5 more)

### Community 55 - "Requirements Cluster 55"
Cohesion: 0.15
Nodes (13): MG-03 Approve a cross-team lead transfer, Exception Handling (MG-03): Out-of-scope destination routes to RM. A conflict at commit returns a record-specific failure...., Field (MG-03) Destination: Gamma, Field (MG-03) Handoff: Open tasks included, Field (MG-03) Leads: 12 open records, Field (MG-03) Reason: Skill match, Field (MG-03) Source: Alpha, Reporting (MG-03): Preserve old activity attribution and flag transferred backlog for the new owners.... (+5 more)

### Community 56 - "Requirements Cluster 56"
Cohesion: 0.15
Nodes (13): MG-08 Resolve a repeated SLA failure, Exception Handling (MG-08): If the cause is source quality or an outage, label it and route to the accountable service owner...., Field (MG-08) Deadline: 48 business hours, Field (MG-08) Decision: Recovery plan, Field (MG-08) Escalation: ESC-042, Field (MG-08) Evidence: Repeated overdue tasks, Field (MG-08) Team: Alpha, Reporting (MG-08): Show repeat rate, recovery time and overdue action counts.... (+5 more)

### Community 57 - "Requirements Cluster 57"
Cohesion: 0.15
Nodes (13): MG-12 Request employee transfers or promotions, Exception Handling (MG-12): A rejected promotion does not modify permissions or expose the TL interface...., Field (MG-12) Business approval: Manager recommendation, Field (MG-12) Effective date: 01 Oct, Field (MG-12) Employee: Asha, Field (MG-12) Handoff plan: Open leads and targets, Field (MG-12) Proposed change: Caller to TL, Reporting (MG-12): Past performance remains attached to the old assignment. Future facts use the new assignment.... (+5 more)

### Community 58 - "Requirements Cluster 58"
Cohesion: 0.15
Nodes (13): NM-05 Propose pipeline or product rule changes, Exception Handling (NM-05): Failed validation blocks publication. NM proposal does not directly rewrite all active opportunities...., Field (NM-05) Current version: 2, Field (NM-05) Effective date: 01 Nov, Field (NM-05) Proposed version: 3, Field (NM-05) Reason: Approved product process change, Field (NM-05) Rule: V1 conversion milestone, Reporting (NM-05): Reports label rule versions so before/after comparisons remain interpretable.... (+5 more)

### Community 59 - "Requirements Cluster 59"
Cohesion: 0.15
Nodes (13): NM-07 Approve a cross-region work transfer, Exception Handling (NM-07): Cross-vertical need uses a new linked enquiry with explicit receiving acceptance...., Field (NM-07) Destination: V1 West, Field (NM-07) Handoff: Tasks and evidence, Field (NM-07) Reason: Coverage change, Field (NM-07) Source: V1 South, Field (NM-07) Work: Selected opportunities, Reporting (NM-07): Transfer reports distinguish moved backlog from new business generation.... (+5 more)

### Community 60 - "Requirements Cluster 60"
Cohesion: 0.15
Nodes (13): RM-08 Resolve a regional escalation, Exception Handling (RM-08): Overdue high-severity risks notify NM automatically under the configured escalation policy...., Field (RM-08) Accountable Manager: Arjun, Field (RM-08) Decision: Recovery plan, Field (RM-08) Review date: 30 Sep, Field (RM-08) Risk: Source backlog, Field (RM-08) Severity: High, Reporting (RM-08): Track regional risk ageing and recovery evidence.... (+5 more)

### Community 61 - "Requirements Cluster 61"
Cohesion: 0.15
Nodes (13): SA-03 Grant a second team or vertical in the same role, Exception Handling (SA-03): Revoking the added grant removes its data and queued exports immediately while preserving permitted historical reports...., Field (SA-03) Additional scope: TL / V2 Gamma, Field (SA-03) Employee: Meera, Field (SA-03) Existing scope: TL / V1 Alpha, Field (SA-03) Start/end: Approved dates, Field (SA-03) View: Same TL interface, Reporting (SA-03): Team reports remain partitioned; combined views use unique fact IDs.... (+5 more)

### Community 62 - "Requirements Cluster 62"
Cohesion: 0.15
Nodes (13): SA-04 Create or restructure the reporting hierarchy, Exception Handling (SA-04): Unresolved orphan teams or missing accountable owners block activation...., Field (SA-04) Effective date: 01 Oct, Field (SA-04) Leader: Eligible assignment, Field (SA-04) Parent: Approved organisation node, Field (SA-04) Unit: South / Manager group, Field (SA-04) Vertical: V1, Reporting (SA-04): Historical reports retain event-time paths. New facts use the newly effective hierarchy.... (+5 more)

### Community 63 - "Requirements Cluster 63"
Cohesion: 0.15
Nodes (13): SA-06 Disable access and complete offboarding, Exception Handling (SA-06): If reassignment cannot finish immediately, access still ends and work enters a supervised holding queue...., Field (SA-06) Effective time: 30 Sep, 18:00, Field (SA-06) Employee: Employee J, Field (SA-06) Reason: Approved exit, Field (SA-06) Sessions: Revoke all, Field (SA-06) Work handoff: Verified plan, Reporting (SA-06): Audit disable time, completion and residual-access checks.... (+5 more)

### Community 64 - "Requirements Cluster 64"
Cohesion: 0.15
Nodes (13): SA-07 Reset account access safely, Exception Handling (SA-07): Unverified requests remain blocked and route to the security owner...., Field (SA-07) Action: Reset invitation, Field (SA-07) Identity check: Approved procedure, Field (SA-07) Issue: Locked account / MFA recovery, Field (SA-07) Sessions: Revoke, Field (SA-07) User: Verified employee, Reporting (SA-07): Track failed recovery and repeated lockout incidents separately from sales performance.... (+5 more)

### Community 65 - "Requirements Cluster 65"
Cohesion: 0.15
Nodes (13): SA-08 Publish an approved rule version, Exception Handling (SA-08): Incompatible or untested changes stay in draft. Migration of active opportunities requires separate approval...., Field (SA-08) Approvals: Business owner, Field (SA-08) Configuration: Stage, SLA, routing or fiscal calendar, Field (SA-08) Effective date: Scheduled, Field (SA-08) Impact: Preview, Field (SA-08) Version: Approved next version, Reporting (SA-08): Events retain the rule version used. Report definitions remain traceable across changes.... (+5 more)

### Community 66 - "Requirements Cluster 66"
Cohesion: 0.15
Nodes (13): SA-09 Investigate an access or data-change incident, Exception Handling (SA-09): Exceptional data inspection requires a named, time-limited grant. No silent impersonation of employee dashboards...., Field (SA-09) Actor: Employee or service, Field (SA-09) Correlation ID: Request reference, Field (SA-09) Event type: Denied access / scope change, Field (SA-09) Evidence: Restricted audit, Field (SA-09) Period: Time window, Reporting (SA-09): Report access anomalies, resolution time and repeated policy failures.... (+5 more)

### Community 67 - "Requirements Cluster 67"
Cohesion: 0.15
Nodes (13): SA-10 Recover a failed integration or report job, Exception Handling (SA-10): Expired permission or offboarded job owner blocks execution and requires an authorised replacement...., Field (SA-10) Failure: Provider unavailable, Field (SA-10) Job: JOB-201, Field (SA-10) Queue: Imports / reminders / exports, Field (SA-10) Retry: Same idempotency key, Field (SA-10) State: Failed, Reporting (SA-10): Show failed job age and last successful source watermark.... (+5 more)

### Community 68 - "Requirements Cluster 68"
Cohesion: 0.15
Nodes (13): SA-11 Review expiring access and temporary delegation, Exception Handling (SA-11): No response means expiry, never indefinite renewal or automatic transfer of authority...., Field (SA-11) Approvals: Required owner, Field (SA-11) Decision: Expire / renew, Field (SA-11) Expiry: 30 Sep, Field (SA-11) Grant: Temporary approver / team scope, Field (SA-11) Owner: Named employee, Reporting (SA-11): Report overdue access reviews and temporary-grant duration.... (+5 more)

### Community 69 - "Requirements Cluster 69"
Cohesion: 0.15
Nodes (13): SC-01 Start the day and prioritise work, Verification Evidence: Dedicated Wealth Frontline API Suite (apps/api/test/wealth.api.test.ts), Exception Handling (SC-01): No active assignment: show access pending. A delayed provider shows a stale-data badge, not zero calls...., Field (SC-01) Availability: Available, Field (SC-01) Period: Today, 25 Sep, Field (SC-01) Priority: Overdue first, Field (SC-01) Queue: My active assignment, Reporting (SC-01): My day shows operational workload. Personal performance keeps the historical team and role for each event.... (+5 more)

### Community 70 - "Requirements Cluster 70"
Cohesion: 0.15
Nodes (13): TL-01 Inspect team health and drill into a metric, Verification Evidence: Dedicated Team Lead Governance API Suite (apps/api/test/tl.api.test.ts), Exception Handling (TL-01): Revoked team disappears immediately. Drill-down is a TL view of permitted records, never the caller dashboard...., Field (TL-01) Comparison: Previous day, Field (TL-01) Metric: Overdue tasks, Field (TL-01) Period: Today, Field (TL-01) Team: Alpha + Beta, Reporting (TL-01): Display actual/target, overdue work, idle capacity, pending approvals and data freshness.... (+5 more)

### Community 71 - "Requirements Cluster 71"
Cohesion: 0.15
Nodes (13): TL-03 Distribute a batch using a preview, Exception Handling (TL-03): A stale or newly ineligible recipient fails that row. Partial completion must be visible and downloadable within scope...., Field (TL-03) Batch: 20 selected leads, Field (TL-03) Capacity cap: Configured, Field (TL-03) Method: Weighted round-robin, Field (TL-03) Preview: 18 eligible / 2 held, Field (TL-03) Team: Alpha, Reporting (TL-03): Measure queue age and fair distribution separately from employee conversion.... (+5 more)

### Community 72 - "Requirements Cluster 72"
Cohesion: 0.15
Nodes (13): TL-04 Rebalance work within granted teams, Exception Handling (TL-04): Locked pending approvals need explicit handling. Cross-boundary moves become a Manager request instead...., Field (TL-04) Destination: Ravi, Field (TL-04) Open leads: 6, Field (TL-04) Open tasks: 9, Field (TL-04) Reason: Approved absence, Field (TL-04) Source owner: Asha, Reporting (TL-04): Inherited backlog appears separately for the recipient. Earlier calls and wins never become their personal work.... (+5 more)

### Community 73 - "Requirements Cluster 73"
Cohesion: 0.15
Nodes (13): TL-05 Resolve an overdue follow-up, Exception Handling (TL-05): Repeated breach crosses the configured threshold: notify Manager with the evidence pack...., Field (TL-05) Action: Coach / reassign / escalate, Field (TL-05) Age: 2 business hours, Field (TL-05) Employee: Asha, Field (TL-05) Queue: Overdue, Field (TL-05) Task: TASK-120, Reporting (TL-05): Track breach count, overdue age and time to recovery alongside sales outcomes.... (+5 more)

### Community 74 - "Requirements Cluster 74"
Cohesion: 0.15
Nodes (13): TL-06 Review an associate within the TL workspace, Exception Handling (TL-06): Employee transfers away: current details close. Historical access follows the explicit report retention grant...., Field (TL-06) Assignment: Alpha / Sales caller, Field (TL-06) Employee: Asha, Field (TL-06) History: Permitted intervals, Field (TL-06) Period: September, Field (TL-06) View: Workload and performance, Reporting (TL-06): Separate personal activity, inherited work and team-attributed outcomes.... (+5 more)

### Community 75 - "Requirements Cluster 75"
Cohesion: 0.15
Nodes (13): TL-12 Schedule and run an associate one-to-one, Exception Handling (TL-12): Missing employee response does not imply agreement. An unresolved data dispute stays linked to the review...., Field (TL-12) Actions: Owner and deadline, Field (TL-12) Agenda: Performance and blockers, Field (TL-12) Employee: Asha, Field (TL-12) Period: September, Field (TL-12) Snapshot: Version 3, Reporting (TL-12): Track review completion, acknowledgement and overdue commitments separately.... (+5 more)

### Community 76 - "Requirements Cluster 76"
Cohesion: 0.15
Nodes (13): TL-13 Assign an intern mentor and graded workload, Exception Handling (TL-13): Expired internship or mentor delegation blocks further allocation and alerts the accountable supervisor...., Field (TL-13) Allowed products: Training-approved, Field (TL-13) Intern: Dev, Field (TL-13) Mentor: Eligible TL / senior associate, Field (TL-13) Review date: 30 Sep, Field (TL-13) Work cap: 8 opportunities, Reporting (TL-13): Separate trainee output, mentor reviews and independent conversions.... (+5 more)

### Community 77 - "Requirements Cluster 77"
Cohesion: 0.15
Nodes (13): TL-14 Request a move, role change or capacity increase, Exception Handling (TL-14): Rejected request leaves current assignments unchanged and displays the decision reason...., Field (TL-14) Business reason: Queue SLA risk, Field (TL-14) Effective date: 01 Oct, Field (TL-14) Employee / team: Alpha, Field (TL-14) Impact: Leads and targets, Field (TL-14) Request: Additional caller capacity, Reporting (TL-14): Capacity request reporting includes queue impact and response time, not a fabricated staffing change.... (+5 more)

### Community 78 - "Requirements Cluster 78"
Cohesion: 0.15
Nodes (13): TL-15 Escalate a complaint or commercial exception, Exception Handling (TL-15): Urgent suppression takes effect before the approval workflow. Owner absence activates the named delegation...., Field (TL-15) Category: Customer complaint, Field (TL-15) Evidence: Allowed activity references, Field (TL-15) Lead: FV-1042, Field (TL-15) Requested decision: Manager review, Field (TL-15) Severity: High, Reporting (TL-15): Report open exceptions, ageing and resolution; do not remove the related lead from performance without an approved rule.... (+5 more)

### Community 79 - "Requirements Cluster 79"
Cohesion: 0.15
Nodes (13): TL-16 Generate a team review pack, Exception Handling (TL-16): A removed team is excluded from pending exports. Exports never include another role interface or unauthorised member rec..., Field (TL-16) Audience: Authorised Manager, Field (TL-16) Historical mode: Event-time team, Field (TL-16) Period: Month / quarter, Field (TL-16) Scope: Alpha + Beta, Field (TL-16) Sections: Team, members, actions, Reporting (TL-16): Include six report periods, original/revised versions and a target reconciliation summary.... (+5 more)

### Community 80 - "Requirements Cluster 80"
Cohesion: 0.15
Nodes (13): TL-17 Schedule a recurring report, Exception Handling (TL-17): Owner offboarded or grant expired: suspend schedule pending an authorised replacement. No automatic public email attachm..., Field (TL-17) Cadence: Monday, 09:00 IST, Field (TL-17) Delivery: Protected report centre, Field (TL-17) Period: Previous complete week, Field (TL-17) Recipients: Approved internal audience, Field (TL-17) Report: Team weekly review, Reporting (TL-17): Report provenance includes schedule owner, as-of date, metric version and distribution audit.... (+5 more)

### Community 81 - "Requirements Cluster 81"
Cohesion: 0.15
Nodes (13): TL-18 Approve a documented activity correction, Exception Handling (TL-18): Self-submitted correction goes to Manager. Never delete an unfavourable activity to improve a scorecard...., Field (TL-18) Activity: CALL-7821, Field (TL-18) Decision: Accept / Return, Field (TL-18) Evidence: Provider event, Field (TL-18) Request: COR-084, Field (TL-18) Requested correction: Wrong disposition, Reporting (TL-18): Historical snapshots retain their original version and show the approved revised version.... (+5 more)

### Community 82 - "Requirements Cluster 82"
Cohesion: 0.17
Nodes (12): CEO-02 Compare verticals fairly, Exception Handling (CEO-02): Incomparable or incomplete data shows a labelled limitation rather than an invented rank...., Field (CEO-02) Context: Product cycle and maturity, Field (CEO-02) Measure: Approved revenue basis, Field (CEO-02) Period: Quarter, Field (CEO-02) Verticals: V1, V2, V3, V4, Reporting (CEO-02): Show basis, denominators, currencies and FX versions on comparative financial measures...., Step (CEO-02.1): Choose comparable measures and observation periods.... (+4 more)

### Community 83 - "Requirements Cluster 83"
Cohesion: 0.17
Nodes (12): CEO-03 Review a national manager contribution, Verification Status: Unverified by Automated Tests (Pending Dedicated Test Assertions), Exception Handling (CEO-03): An NM replacement sees a new personal record; the vertical retains organisational history...., Field (CEO-03) Evidence: Forecast and commitments, Field (CEO-03) National manager: NM V1, Field (CEO-03) Period: September, Field (CEO-03) View: Vertical scorecard, Reporting (CEO-03): Historical responsibility follows the NM assignment at event time.... (+4 more)

### Community 84 - "Requirements Cluster 84"
Cohesion: 0.17
Nodes (12): CEO-07 Resolve a cross-vertical priority conflict, Exception Handling (CEO-07): If policy or finance approval is required, keep the action pending until that independent decision is complete...., Field (CEO-07) Affected verticals: V1 and V2, Field (CEO-07) Decision: Priority and accountable owners, Field (CEO-07) Evidence: Competing plans, Field (CEO-07) Issue: Shared capacity demand, Reporting (CEO-07): Track implementation and exception resolution against the original decision...., Step (CEO-07.1): Review both NM proposals and customer/service impact.... (+4 more)

### Community 85 - "Requirements Cluster 85"
Cohesion: 0.17
Nodes (12): CEO-08 Review a critical complaint or operating risk, Exception Handling (CEO-08): A sensitive incident may require a restricted case grant; seniority alone cannot bypass that boundary...., Field (CEO-08) Age: Business-time ageing, Field (CEO-08) Evidence: Restricted summary, Field (CEO-08) Owner: Named NM, Field (CEO-08) Risk: High-severity unresolved issue, Reporting (CEO-08): Risk dashboard tracks overdue decisions and verified resolution, not only ticket closure...., Step (CEO-08.1): Inspect the executive risk summary and previous decisions.... (+4 more)

### Community 86 - "Requirements Cluster 86"
Cohesion: 0.17
Nodes (12): CEO-09 Conduct an NM leadership review, Exception Handling (CEO-09): A disputed finance number remains linked to the CFO-certified version and correction process...., Field (CEO-09) Agenda: Execution, forecast and people, Field (CEO-09) Period: Quarter, Field (CEO-09) Reviewee: NM V1, Field (CEO-09) Scorecard: Approved vertical results, Reporting (CEO-09): Track commitments and leadership review cadence independently of revenue measures...., Step (CEO-09.1): Prepare a frozen vertical scorecard and prior commitments.... (+4 more)

### Community 87 - "Requirements Cluster 87"
Cohesion: 0.17
Nodes (12): CEO-11 Follow through on executive commitments, Exception Handling (CEO-11): Overdue delegated actions return to the accountable sponsor for intervention...., Field (CEO-11) Due: This week, Field (CEO-11) Owner: CEO / assigned leaders, Field (CEO-11) Priority: Strategic, Field (CEO-11) Status: Open and overdue, Reporting (CEO-11): Measure commitment completion and decision latency separately from sales attainment...., Step (CEO-11.1): Review decisions requiring action and overdue commitments.... (+4 more)

### Community 88 - "Requirements Cluster 88"
Cohesion: 0.17
Nodes (12): CFO-01 Inspect revenue, cash and outstanding balances, Exception Handling (CFO-01): Finance-feed outage freezes the last valid balance with a stale label; it does not report zero cash...., Field (CFO-01) Close state: Provisional, Field (CFO-01) Currency: INR / approved reporting currency, Field (CFO-01) Period: Month to date, Field (CFO-01) Scope: V1-V4 finance grant, Reporting (CFO-01): Display reconciliation gaps and provisional totals alongside approved figures...., Step (CFO-01.1): Review recognised revenue, receipts, receivables and unmatched cash.... (+4 more)

### Community 89 - "Requirements Cluster 89"
Cohesion: 0.17
Nodes (12): CFO-05 Import or inspect settled receipt evidence, Exception Handling (CFO-05): A failed retry must reuse the batch/event key and cannot add cash twice...., Field (CFO-05) Batch: PAY-0925, Field (CFO-05) Currency: INR, Field (CFO-05) External transaction ID: Unique, Field (CFO-05) Settlement date: 25 Sep, Field (CFO-05) Source: Bank / approved payment feed, Reporting (CFO-05): Show imported, duplicate, pending and settled totals separately.... (+4 more)

### Community 90 - "Requirements Cluster 90"
Cohesion: 0.17
Nodes (12): CFO-06 Match a receipt to invoices, Exception Handling (CFO-06): Ambiguous match requires human review. A match suggestion never posts automatically without the configured authority...., Field (CFO-06) Allocation: INR 25,000, Field (CFO-06) Candidate invoice: INV-310, Field (CFO-06) Evidence: Reference match, Field (CFO-06) Receipt: RCPT-504 / INR 25,000, Field (CFO-06) Unallocated balance: INR 0, Reporting (CFO-06): Age only unpaid invoice balances. Keep unapplied cash in suspense.... (+4 more)

### Community 91 - "Requirements Cluster 91"
Cohesion: 0.17
Nodes (12): CFO-09 Review ageing and assign collection work, Exception Handling (CFO-09): Disputed invoice is flagged and routed for resolution; a promise-to-pay never counts as received cash...., Field (CFO-09) Age bucket: Current / 1-30 / 31-60 / 60+ days, Field (CFO-09) Counterparty: Permitted entity, Field (CFO-09) Owner: Authorised collection owner, Field (CFO-09) Vertical: V1, Reporting (CFO-09): Measure overdue balance, days outstanding and resolved disputes with the same as-of date...., Step (CFO-09.1): Inspect unpaid balances aged from due date.... (+4 more)

### Community 92 - "Requirements Cluster 92"
Cohesion: 0.17
Nodes (12): CFO-12 Review an incentive calculation, Exception Handling (CFO-12): A dispute holds only the affected item where policy allows; record reason and evidence, not an unexplained total edit...., Field (CFO-12) Adjustments: Clawbacks and caps, Field (CFO-12) Basis: Approved credit and revenue, Field (CFO-12) Employee: Asha, Field (CFO-12) Period: September, Field (CFO-12) Scheme: Approved version 3, Step (CFO-12.1): Inspect eligible credited outcomes and scheme rules.... (+4 more)

### Community 93 - "Requirements Cluster 93"
Cohesion: 0.17
Nodes (12): CFO-13 Resolve a finance or incentive dispute, Exception Handling (CFO-13): Unresolved policy ambiguity goes to the named scheme owner and remains pending...., Field (CFO-13) Affected item: Commission allocation, Field (CFO-13) Case: FIN-088, Field (CFO-13) Claim: Documented discrepancy, Field (CFO-13) Decision: Accept / Reject / Return, Field (CFO-13) Evidence: Credit and scheme versions, Step (CFO-13.1): Review original rules, evidence and employee claim.... (+4 more)

### Community 94 - "Requirements Cluster 94"
Cohesion: 0.17
Nodes (12): CFO-15 Request a controlled period reopening, Exception Handling (CFO-15): Unapproved reopening remains blocked even for a finance administrator...., Field (CFO-15) Closed period: September, Field (CFO-15) Impact: Ledger and published reports, Field (CFO-15) Reason: Material verified correction, Field (CFO-15) Second approval: Required authority, Reporting (CFO-15): Show original and restated versions with the reason for change...., Step (CFO-15.1): Create a reopening request with impact assessment.... (+4 more)

### Community 95 - "Requirements Cluster 95"
Cohesion: 0.17
Nodes (12): CFO-16 Review budget and cost performance, Exception Handling (CFO-16): Missing source data shows incomplete rather than zero expense or inflated margin...., Field (CFO-16) Actual costs: Verified source, Field (CFO-16) Basis: Comparable cost classification, Field (CFO-16) Budget: Approved vertical plan, Field (CFO-16) Period: Quarter, Field (CFO-16) Scope: V1-V4, Reporting (CFO-16): Separate proposed, approved, committed and actual amounts.... (+4 more)

### Community 96 - "Requirements Cluster 96"
Cohesion: 0.17
Nodes (12): CFO-17 Approve finance assumptions in the forecast, Exception Handling (CFO-17): Later forecast edits invalidate prior concurrence when material finance assumptions change...., Field (CFO-17) Assumptions: Fees, timing and collection, Field (CFO-17) Basis: Expected CRM revenue, Field (CFO-17) Decision: Concur / Return, Field (CFO-17) Submission: NM V1 forecast, Reporting (CFO-17): CEO sees forecast value and finance-review state separately...., Step (CFO-17.1): Review commercial estimates and finance assumptions.... (+4 more)

### Community 97 - "Requirements Cluster 97"
Cohesion: 0.17
Nodes (12): CFO-18 Generate a certified finance pack, Exception Handling (CFO-18): An open period must be labelled provisional. Reopening generates a new report version...., Field (CFO-18) Audience: Approved leadership, Field (CFO-18) Period: Any of six periods, Field (CFO-18) Sections: Revenue, cash, ageing, adjustments, Field (CFO-18) State: Provisional / Certified, Reporting (CFO-18): Include recognition, cash, receivable and adjustment bridges with unresolved exceptions...., Step (CFO-18.1): Choose the period and close version.... (+4 more)

### Community 98 - "Requirements Cluster 98"
Cohesion: 0.17
Nodes (12): CFO-19 Propose finance approval limits and policies, Exception Handling (CFO-19): Rejected changes leave existing policy active. Historical entries are never recalculated silently...., Field (CFO-19) Effective date: 01 Oct, Field (CFO-19) Limit: Amount and currency, Field (CFO-19) Policy: Refund authority matrix, Field (CFO-19) Role / scope: Named finance approver, Field (CFO-19) Second approver: Authorised policy owner, Reporting (CFO-19): Transactions retain the policy version used for their decision.... (+4 more)

### Community 99 - "Requirements Cluster 99"
Cohesion: 0.17
Nodes (12): DE-06 Maintain source evidence and contact provenance, Exception Handling (DE-06): Source suspension holds dependent new outreach until an approved resolution...., Field (DE-06) Effective dates: Recorded, Field (DE-06) Evidence: Approved collection basis, Field (DE-06) Products: Permitted scope, Field (DE-06) Source: Campaign / vendor register, Reporting (DE-06): Report source completeness and held batches by cause...., Step (DE-06.1): Open a source record and inspect evidence completeness.... (+4 more)

### Community 100 - "Requirements Cluster 100"
Cohesion: 0.17
Nodes (12): HR-07 Prepare a people operations pack, Exception Handling (HR-07): Sensitive detail is redacted unless recipient has the specific field-level grant...., Field (HR-07) Period: Six supported periods, Field (HR-07) Scope: Granted workforce, Field (HR-07) Sections: Joiners, movers, leavers, reviews, Field (HR-07) Sensitive fields: Restricted, Reporting (HR-07): Separate employee lifecycle completion from sales performance and staffing forecasts...., Step (HR-07.1): Select workforce scope and approved report sections.... (+4 more)

### Community 101 - "Requirements Cluster 101"
Cohesion: 0.17
Nodes (12): MG-02 Inspect a TL operating scorecard, Exception Handling (MG-02): Historical teams moved outside scope expose only approved historical summaries...., Field (MG-02) Metrics: Execution and coaching, Field (MG-02) Period: September, Field (MG-02) Team lead: Meera, Field (MG-02) Teams: Alpha + Beta, Reporting (MG-02): Keep team performance separate from any independently granted personal selling activity...., Step (MG-02.1): Open the TL record from the authorised roster.... (+4 more)

### Community 102 - "Requirements Cluster 102"
Cohesion: 0.17
Nodes (12): MG-04 Build a capacity recovery plan, Exception Handling (MG-04): Hiring/role changes become HR/Admin requests. A scenario is clearly labelled until enacted...., Field (MG-04) Action: Rebalance / request staff, Field (MG-04) Capacity: Eligible available callers, Field (MG-04) Constraint: Unassigned backlog, Field (MG-04) Teams: Assigned TL groups, Reporting (MG-04): Measure queue age, utilisation and recovery milestones without resetting SLA clocks...., Step (MG-04.1): Compare due work with eligible available capacity.... (+4 more)

### Community 103 - "Requirements Cluster 103"
Cohesion: 0.17
Nodes (12): MG-09 Approve a delegated commercial exception, Exception Handling (MG-09): Finance or policy exceptions go to the relevant owner; Manager title does not authorise them automatically...., Field (MG-09) Evidence: Business justification, Field (MG-09) Exception: Permitted fee adjustment, Field (MG-09) Limit: Configured authority, Field (MG-09) Proposal: PROP-088, Reporting (MG-09): Track exception volume and downstream verified commercial effect...., Step (MG-09.1): Compare requested terms with approved product terms.... (+4 more)

### Community 104 - "Requirements Cluster 104"
Cohesion: 0.17
Nodes (12): MG-10 Review source quality and request remediation, Exception Handling (MG-10): Changes to source routing follow configuration approval; reports alone do not change allocation rules...., Field (MG-10) Cohort: September allocations, Field (MG-10) Metrics: Invalid, contact, conversion, Field (MG-10) Owner: Intake / campaign owner, Field (MG-10) Source: Campaign C12, Reporting (MG-10): Separate invalid intake, failed contact and commercial losses...., Step (MG-10.1): Compare sources using consistent cohorts and observation windows.... (+4 more)

### Community 105 - "Requirements Cluster 105"
Cohesion: 0.17
Nodes (12): MG-11 Run a TL performance review, Exception Handling (MG-11): An unresolved metric dispute remains open and linked to the signed meeting version...., Field (MG-11) Actions: Capacity and conversion, Field (MG-11) Evidence: Team and coaching scorecard, Field (MG-11) Period: September, Field (MG-11) Reviewee: Meera, Reporting (MG-11): Track review cadence and action completion alongside operating results...., Step (MG-11.1): Prepare the snapshot and invite the TL reflection.... (+4 more)

### Community 106 - "Requirements Cluster 106"
Cohesion: 0.17
Nodes (12): MG-13 Publish the Manager meeting pack, Exception Handling (MG-13): Missing provider data is flagged in the pack rather than portrayed as employee underperformance...., Field (MG-13) Period: Week / Month / Quarter, Field (MG-13) Recipient: RM, Field (MG-13) Scope: Assigned TL hierarchy, Field (MG-13) Sections: Targets, forecast, risks, actions, Reporting (MG-13): Include forecast version, target version, cutoff, exclusions and open action owners...., Step (MG-13.1): Select period, scope and approved snapshot.... (+4 more)

### Community 107 - "Requirements Cluster 107"
Cohesion: 0.17
Nodes (12): NM-01 Inspect national vertical performance, Exception Handling (NM-01): Missing regional data displays as incomplete; it never appears as a zero-performance region...., Field (NM-01) Breakdown: Region and product, Field (NM-01) Metric: Target attainment, Field (NM-01) Period: Month to date, Field (NM-01) Vertical: V1 only, Reporting (NM-01): National metrics show formula, cutoff, currency and source readiness...., Step (NM-01.1): Inspect region contributions, national pipeline and unresolved risk.... (+4 more)

### Community 108 - "Requirements Cluster 108"
Cohesion: 0.17
Nodes (12): NM-02 Compare regions and open an RM scorecard, Exception Handling (NM-02): Changing filters does not change official submitted report versions...., Field (NM-02) Compare: Same metric and cohort, Field (NM-02) Focus: Conversion and capacity, Field (NM-02) Period: Quarter, Field (NM-02) Regions: Authorised V1 regions, Reporting (NM-02): Show actual results plus reasons for incomparable or immature cohorts...., Step (NM-02.1): Compare eligible regional scorecards.... (+4 more)

### Community 109 - "Requirements Cluster 109"
Cohesion: 0.17
Nodes (12): NM-04 Review product and source economics, Exception Handling (NM-04): Unknown cost displays N/A for ROI and a data-owner action...., Field (NM-04) Cohort: Quarter, Field (NM-04) Costs: Validated campaign costs, Field (NM-04) Metrics: Conversion and net revenue, Field (NM-04) Product: V1 product catalogue, Reporting (NM-04): Show sample size, time lag, cancellations and cost coverage alongside ratios...., Step (NM-04.1): Compare product/source cohorts and data completeness.... (+4 more)

### Community 110 - "Requirements Cluster 110"
Cohesion: 0.17
Nodes (12): NM-06 Submit the national forecast, Exception Handling (NM-06): Unresolved regional submissions are visible in the national pack...., Field (NM-06) Management adjustment: Separate line, Field (NM-06) Period: October, Field (NM-06) Recipients: CEO and CFO by subject, Field (NM-06) Regions: Accepted submissions, Reporting (NM-06): Retain bottom-up, adjustment and final values for later forecast-accuracy assessment...., Step (NM-06.1): Review regional submissions, ageing and stage assumptions.... (+4 more)

### Community 111 - "Requirements Cluster 111"
Cohesion: 0.17
Nodes (12): NM-09 Escalate a national commercial or finance issue, Exception Handling (NM-09): Conflicting decisions pause the dependent action and escalate to the named accountable executive...., Field (NM-09) Category: Revenue assumption / strategic exception, Field (NM-09) Decision deadline: Configured, Field (NM-09) Evidence: Vertical case, Field (NM-09) Requested owner: CEO / CFO, Reporting (NM-09): Show decision ageing, dependencies and affected forecast version...., Step (NM-09.1): Document the issue and proposed action.... (+4 more)

### Community 112 - "Requirements Cluster 112"
Cohesion: 0.17
Nodes (12): RM-02 Review a Manager scorecard, Exception Handling (RM-02): Transferred Managers expose only approved history for the period of the RM relationship...., Field (RM-02) Evidence: Forecast, capacity and reviews, Field (RM-02) Manager: Arjun, Field (RM-02) Period: September, Field (RM-02) Scope: Assigned hierarchy, Reporting (RM-02): Separate operational health and actual sales performance...., Step (RM-02.1): Open an authorised Manager.... (+4 more)

### Community 113 - "Requirements Cluster 113"
Cohesion: 0.17
Nodes (12): RM-03 Plan territory coverage, Exception Handling (RM-03): No eligible destination keeps the queue visible and assigned to an accountable supervisor...., Field (RM-03) Coverage: Capacity gaps, Field (RM-03) Products: V1 eligible products, Field (RM-03) Queues: Language and locality, Field (RM-03) Territory: South sub-region, Reporting (RM-03): Compare response time and conversion before/after with stable cohort definitions...., Step (RM-03.1): Inspect lead demand against current authorised coverage.... (+4 more)

### Community 114 - "Requirements Cluster 114"
Cohesion: 0.17
Nodes (12): RM-04 Allocate regional targets to Managers, Exception Handling (RM-04): A mid-period restructure requires approved prorating and preserves earlier assignments...., Field (RM-04) Manager split: Proposed, Field (RM-04) Parent target: Approved regional plan, Field (RM-04) Period: October, Field (RM-04) Remainder: Visible, Reporting (RM-04): Track allocated, unallocated and achieved values separately...., Step (RM-04.1): Open the regional target approved by NM.... (+4 more)

### Community 115 - "Requirements Cluster 115"
Cohesion: 0.17
Nodes (12): RM-05 Approve a cross-Manager transfer, Exception Handling (RM-05): Other-region destination requires NM approval; another vertical requires the referral workflow...., Field (RM-05) Destination Manager: Sara, Field (RM-05) Reason: Capacity recovery, Field (RM-05) Selected work: Open opportunities, Field (RM-05) Source Manager: Arjun, Reporting (RM-05): Report transferred work separately from new allocations and preserve old activity credit...., Step (RM-05.1): Inspect eligibility, tasks and forecast impact on both sides.... (+4 more)

### Community 116 - "Requirements Cluster 116"
Cohesion: 0.17
Nodes (12): RM-06 Approve a regional staffing plan, Exception Handling (RM-06): Budget beyond authority escalates; the system must not treat requested headcount as available capacity...., Field (RM-06) Business evidence: Queue ageing, Field (RM-06) Decision: Approve recommendation, Field (RM-06) Need: Eligible callers by product, Field (RM-06) Plan: South October staffing, Reporting (RM-06): Show planned, approved and active capacity separately...., Step (RM-06.1): Review Manager capacity proposals and expected demand.... (+4 more)

### Community 117 - "Requirements Cluster 117"
Cohesion: 0.17
Nodes (12): RM-09 Run a Manager review, Exception Handling (RM-09): Metric disputes remain attached to the review and use the correction workflow...., Field (RM-09) Agenda: Results, staffing and forecast, Field (RM-09) Period: Quarter, Field (RM-09) Reviewee: Arjun, Field (RM-09) Snapshot: Regional approved version, Reporting (RM-09): Review cadence and completion are distinct from sales attainment...., Step (RM-09.1): Prepare evidence and Manager self-reflection.... (+4 more)

### Community 118 - "Requirements Cluster 118"
Cohesion: 0.17
Nodes (12): RM-10 Produce the regional review pack, Exception Handling (RM-10): Changes to scope suspend affected schedules until a permitted owner confirms them...., Field (RM-10) Audience: NM, Field (RM-10) Period: Any of six reporting periods, Field (RM-10) Scope: V1 South, Field (RM-10) Sections: Managers, risks and forecast, Reporting (RM-10): Include target bridge, forecast changes, quality flags and open actions...., Step (RM-10.1): Choose period and permitted report sections.... (+4 more)

### Community 119 - "Requirements Cluster 119"
Cohesion: 0.18
Nodes (11): CEO-01 Inspect the company operating picture, Verification Evidence: Continuous Multi-Role Vertical Lifecycle Integration Suite (apps/api/test/vertical_lifecycle.api.test.ts), Exception Handling (CEO-01): Unreconciled or missing vertical data is visibly flagged and excluded from certified totals as appropriate...., Field (CEO-01) Basis: Comparable metric definitions, Field (CEO-01) Period: Month to date, Field (CEO-01) Scope: V1-V4 executive grant, Field (CEO-01) View: Company summary, Step (CEO-01.1): Inspect attainment, pipeline, forecast confidence and critical decisions.... (+3 more)

### Community 120 - "Requirements Cluster 120"
Cohesion: 0.18
Nodes (11): CEO-10 Create the executive or board meeting pack, Exception Handling (CEO-10): If a section is provisional, label it clearly instead of mixing it into certified results...., Field (CEO-10) Audience: Approved leadership recipients, Field (CEO-10) Period: Quarter, Field (CEO-10) Scope: Company summaries, Field (CEO-10) Sections: Results, forecast, risks, decisions, Step (CEO-10.1): Choose certified snapshots and recipient-appropriate detail...., Step (CEO-10.2): Preview the executive narrative, charts and decision list.... (+3 more)

### Community 121 - "Requirements Cluster 121"
Cohesion: 0.18
Nodes (11): NM-03 Allocate the national target to regions, Exception Handling (NM-03): A CEO target revision triggers controlled downstream revision, not silent overwrite...., Field (NM-03) Approved vertical target: CEO-approved plan, Field (NM-03) Period: Financial year / quarter, Field (NM-03) Regional split: Draft, Field (NM-03) Remainder: Unallocated balance, Step (NM-03.1): Open the agreed vertical target and capacity assumptions...., Step (NM-03.2): Allocate regional targets using the same metric basis.... (+3 more)

### Community 122 - "Requirements Cluster 122"
Cohesion: 0.18
Nodes (11): NM-11 Prepare the national executive pack, Exception Handling (NM-11): A scope or recipient change invalidates queued exports and is evaluated again before delivery...., Field (NM-11) Audience: CEO and CFO, Field (NM-11) Period: Month / Quarter / Half-year / Year, Field (NM-11) Scope: V1, Field (NM-11) Sections: Results and finance risks, Step (NM-11.1): Select approved report versions and recipient-specific sections...., Step (NM-11.2): Preview reconciliation to regional totals.... (+3 more)

### Community 123 - "Requirements Cluster 123"
Cohesion: 0.18
Nodes (11): RM-01 Investigate regional gaps, Exception Handling (RM-01): Historical restructuring is shown by dated segments, not rewritten to match the current organisation...., Field (RM-01) Focus: Target gap, Field (RM-01) Period: Month to date, Field (RM-01) Region: South, Field (RM-01) Vertical: V1, Step (RM-01.1): Inspect Manager contributions and regional exceptions...., Step (RM-01.2): Select a metric to drill through Managers, TLs and permitted evidence.... (+3 more)

### Community 124 - "Requirements Cluster 124"
Cohesion: 0.20
Nodes (11): Canonical Document: Master Application State & Flow Specification, Shared Requirement: Lead state machine (Not Contacted -> Contacted -> Follow-up -> Pending conversion -> Converted / Lost / Reopened), Role: Human Resources (HR), Role: Super Admin (SA), [AppFlow] Overview, [AppFlow] 5.1 Invariants for Data Entry to Team Lead Routing, [AppFlow] 6. People Lifecycle & Access Provisioning Flow (`HR-01..07` → `SA-01..11`), [AppFlow] 6.1 Invariants for Personnel Governance (+3 more)

### Community 125 - "Requirements Cluster 125"
Cohesion: 0.20
Nodes (10): Canonical Document: Technical Requirements Document, [TRD] Overview, [TRD] 2.5 Regional, National, Executive & Financial Endpoints, [TRD] 3. Concurrency Control & Optimistic Locking, [TRD] 4. Idempotency & Financial Safety, [TRD] 1.1 HTTP & Content-Type Standards, [TRD] 1.2 Standard Error Response Protocol, [TRD] 2.1 Authentication & Session (`/api/auth/*`) (+2 more)

### Community 126 - "Requirements Cluster 126"
Cohesion: 0.22
Nodes (9): Shared Requirement: Immutable audit trail; no hard deletion of evidence supporting transactions, sales, or regulatory records, System Commit (CEO-01): Aggregate reconciled vertical facts with clear freshness and finance close status...., System Commit (CEO-03): Serve authorised national summaries and action references...., System Commit (CEO-11): Append action changes, evidence and notifications with due-time history...., System Commit (CFO-05): Store source provenance, settlement date and receipt amount. Quarantine invalid or conflicting rows...., System Commit (CFO-06): Write allocation rows transactionally and update reconciled balances without changing original receipt evidence...., System Commit (CFO-11): Append the adjustment with original ID, reason, policy and effective date...., System Commit (CFO-16): Store budget versions, actual-source references and finance decisions.... (+1 more)

### Community 127 - "Requirements Cluster 127"
Cohesion: 0.36
Nodes (9): [Architecture] 8. Preservation of Original Client Decisions (`[Deck P320]`), [Architecture] 9.2 Later Vertical Release Architecture (Multi-Vertical Expansion), [Architecture] 2. Multi-Tenant & Multi-Vertical Domain Model, [Architecture] 2.1 Multi-Vertical Partitioning & Invariants, [PRD] 6. Client Decisions Still to Approve (`[Deck P320]`), [PRD] 1. Product Vision & Operating Model, [PRD] 3.1 Four Configurable Verticals (`[Deck P005, P036–P042, P317]`), Vertical: Commercial Banking (+1 more)

### Community 128 - "Requirements Cluster 128"
Cohesion: 0.25
Nodes (8): Reporting (CEO-01): Separate approved won value, recognised revenue and cash throughout the executive view...., Reporting (CEO-10): Every chart carries its metric basis, cutoff and finance state...., Reporting (CFO-12): Separate accrued, approved and paid incentives. Staff replacement never inherits prior employee entitlement...., Reporting (CFO-13): Reports show dispute status, corrected version and impact on entitlement...., Reporting (NM-03): Show allocation balance and later achievement against the applicable version...., Reporting (NM-11): Pack identifies target, forecast and finance close versions plus open decisions...., Reporting (RM-01): Show regional attainment, source mix, backlog, forecast and action progress...., Shared Requirement: Asia/Kolkata timezone, Monday weeks, April-March fiscal year, automatic snapshots at 00:15 IST

### Community 129 - "Requirements Cluster 129"
Cohesion: 0.29
Nodes (7): Role: Manager (MG), [AppFlow] 3.1 Frontline to Middle Management (SC → TL → MG), [BackendSchema] 2.2 Wealth Caller Extensions (`0002_wealth_caller.sql`, `0003_comms_tasks.sql`), [ImplementationPlan] 4. Wealth Manager (MG-01..MG-13) Completion & Audit Evidence, [PRD] 5.1 Applicability Rules, [TRD] 2.2 Frontline Sales Caller & Pipeline (`/api/*` via `wealthRouter` & `leadsRouter`), Vertical: Wealth Management

### Community 130 - "Requirements Cluster 130"
Cohesion: 0.60
Nodes (5): Shared Requirement: Session grants resolved from effective role/vertical/team assignments including active future-dated intervals, Shared Requirement: Server resolves role, vertical, team; authorization enforced on every server read and mutation (hidden menu is not authorization), [Architecture] 3. Security, Identity & Authorization Engine, [Architecture] 3.2 Dynamic Scope Resolution & Effective-Dated Grants, [Architecture] 3.3 The Authorization Scoping Hierarchy

### Community 131 - "Requirements Cluster 131"
Cohesion: 0.50
Nodes (4): Role: Chief Executive Officer (CEO), Role: National Manager (NM), Role: Regional Manager (RM), [AppFlow] 3.2 Middle Management to Regional & National Leadership (MG → RM → NM → CEO)

### Community 132 - "Requirements Cluster 132"
Cohesion: 0.67
Nodes (3): Role: Data Entry (DE), Role: Team Leader (TL), [AppFlow] 5. Data Entry Intake & Allocation Routing Flow (`DE-01..07` → `TL-02/03`)

## Knowledge Gaps
- **1124 isolated node(s):** `Vertical Specifics (Banking): Credit underwriting documentation, loan disbursement milestones, and commercial banking qualification gates pending client confirmation [Deck P320]`, `Vertical Specifics (Markets): Demat/trading account opening, SEBI risk disclosures, margin facility gates pending client confirmation [Deck P320]`, `Vertical Specifics (Real Estate): Property escrow milestones, RERA disclosures, builder commission stages pending client confirmation [Deck P320]`, `Shared Requirement: One CRM domain with single sign-on across Wealth, Banking, Markets, Real Estate`, `Shared Requirement: Strict vertical boundary enforcement; cross-vertical matches display reference without leaking customer records` (+1119 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 1124 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Vertical: Commercial Banking` connect `Requirements Cluster 127` to `Requirements Cluster 0`, `Requirements Cluster 1`, `Requirements Cluster 2`, `Requirements Cluster 3`, `Requirements Cluster 4`, `Requirements Cluster 5`, `Requirements Cluster 6`, `Requirements Cluster 7`, `Requirements Cluster 8`, `Requirements Cluster 9`, `Requirements Cluster 10`, `Requirements Cluster 11`, `Requirements Cluster 12`, `Requirements Cluster 13`, `Requirements Cluster 15`, `Requirements Cluster 16`, `Requirements Cluster 17`, `Requirements Cluster 18`, `Requirements Cluster 19`, `Requirements Cluster 20`, `Requirements Cluster 21`, `Requirements Cluster 22`, `Requirements Cluster 23`, `Requirements Cluster 24`, `Requirements Cluster 25`, `Requirements Cluster 26`, `Requirements Cluster 27`, `Requirements Cluster 28`, `Requirements Cluster 29`, `Requirements Cluster 30`, `Requirements Cluster 31`, `Requirements Cluster 32`, `Requirements Cluster 33`, `Requirements Cluster 34`, `Requirements Cluster 35`, `Requirements Cluster 36`, `Requirements Cluster 37`, `Requirements Cluster 38`, `Requirements Cluster 40`, `Requirements Cluster 41`, `Requirements Cluster 42`, `Requirements Cluster 43`, `Requirements Cluster 44`, `Requirements Cluster 45`, `Requirements Cluster 46`, `Requirements Cluster 47`, `Requirements Cluster 48`, `Requirements Cluster 49`, `Requirements Cluster 50`, `Requirements Cluster 51`, `Requirements Cluster 52`, `Requirements Cluster 53`, `Requirements Cluster 54`, `Requirements Cluster 55`, `Requirements Cluster 56`, `Requirements Cluster 57`, `Requirements Cluster 58`, `Requirements Cluster 59`, `Requirements Cluster 60`, `Requirements Cluster 61`, `Requirements Cluster 62`, `Requirements Cluster 63`, `Requirements Cluster 64`, `Requirements Cluster 65`, `Requirements Cluster 66`, `Requirements Cluster 67`, `Requirements Cluster 68`, `Requirements Cluster 69`, `Requirements Cluster 70`, `Requirements Cluster 71`, `Requirements Cluster 72`, `Requirements Cluster 73`, `Requirements Cluster 74`, `Requirements Cluster 75`, `Requirements Cluster 76`, `Requirements Cluster 77`, `Requirements Cluster 78`, `Requirements Cluster 79`, `Requirements Cluster 80`, `Requirements Cluster 81`, `Requirements Cluster 82`, `Requirements Cluster 83`, `Requirements Cluster 84`, `Requirements Cluster 85`, `Requirements Cluster 86`, `Requirements Cluster 87`, `Requirements Cluster 88`, `Requirements Cluster 89`, `Requirements Cluster 90`, `Requirements Cluster 91`, `Requirements Cluster 92`, `Requirements Cluster 93`, `Requirements Cluster 94`, `Requirements Cluster 95`, `Requirements Cluster 96`, `Requirements Cluster 97`, `Requirements Cluster 98`, `Requirements Cluster 99`, `Requirements Cluster 100`, `Requirements Cluster 101`, `Requirements Cluster 102`, `Requirements Cluster 103`, `Requirements Cluster 104`, `Requirements Cluster 105`, `Requirements Cluster 106`, `Requirements Cluster 107`, `Requirements Cluster 108`, `Requirements Cluster 109`, `Requirements Cluster 110`, `Requirements Cluster 111`, `Requirements Cluster 112`, `Requirements Cluster 113`, `Requirements Cluster 114`, `Requirements Cluster 115`, `Requirements Cluster 116`, `Requirements Cluster 117`, `Requirements Cluster 118`, `Requirements Cluster 119`, `Requirements Cluster 120`, `Requirements Cluster 121`, `Requirements Cluster 122`, `Requirements Cluster 123`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Why does `Vertical: Real Estate Advisory` connect `Requirements Cluster 127` to `Requirements Cluster 0`, `Requirements Cluster 1`, `Requirements Cluster 2`, `Requirements Cluster 4`, `Requirements Cluster 5`, `Requirements Cluster 6`, `Requirements Cluster 7`, `Requirements Cluster 8`, `Requirements Cluster 9`, `Requirements Cluster 10`, `Requirements Cluster 11`, `Requirements Cluster 12`, `Requirements Cluster 13`, `Requirements Cluster 15`, `Requirements Cluster 16`, `Requirements Cluster 17`, `Requirements Cluster 18`, `Requirements Cluster 19`, `Requirements Cluster 20`, `Requirements Cluster 21`, `Requirements Cluster 22`, `Requirements Cluster 23`, `Requirements Cluster 24`, `Requirements Cluster 25`, `Requirements Cluster 26`, `Requirements Cluster 27`, `Requirements Cluster 28`, `Requirements Cluster 29`, `Requirements Cluster 30`, `Requirements Cluster 31`, `Requirements Cluster 32`, `Requirements Cluster 33`, `Requirements Cluster 34`, `Requirements Cluster 35`, `Requirements Cluster 36`, `Requirements Cluster 37`, `Requirements Cluster 38`, `Requirements Cluster 40`, `Requirements Cluster 41`, `Requirements Cluster 42`, `Requirements Cluster 43`, `Requirements Cluster 44`, `Requirements Cluster 45`, `Requirements Cluster 46`, `Requirements Cluster 47`, `Requirements Cluster 48`, `Requirements Cluster 49`, `Requirements Cluster 50`, `Requirements Cluster 51`, `Requirements Cluster 52`, `Requirements Cluster 53`, `Requirements Cluster 54`, `Requirements Cluster 55`, `Requirements Cluster 56`, `Requirements Cluster 57`, `Requirements Cluster 58`, `Requirements Cluster 59`, `Requirements Cluster 60`, `Requirements Cluster 61`, `Requirements Cluster 62`, `Requirements Cluster 63`, `Requirements Cluster 64`, `Requirements Cluster 65`, `Requirements Cluster 66`, `Requirements Cluster 67`, `Requirements Cluster 68`, `Requirements Cluster 69`, `Requirements Cluster 70`, `Requirements Cluster 71`, `Requirements Cluster 72`, `Requirements Cluster 73`, `Requirements Cluster 74`, `Requirements Cluster 75`, `Requirements Cluster 76`, `Requirements Cluster 77`, `Requirements Cluster 78`, `Requirements Cluster 79`, `Requirements Cluster 80`, `Requirements Cluster 81`, `Requirements Cluster 82`, `Requirements Cluster 83`, `Requirements Cluster 84`, `Requirements Cluster 85`, `Requirements Cluster 86`, `Requirements Cluster 87`, `Requirements Cluster 88`, `Requirements Cluster 89`, `Requirements Cluster 90`, `Requirements Cluster 91`, `Requirements Cluster 92`, `Requirements Cluster 93`, `Requirements Cluster 94`, `Requirements Cluster 95`, `Requirements Cluster 96`, `Requirements Cluster 97`, `Requirements Cluster 98`, `Requirements Cluster 99`, `Requirements Cluster 100`, `Requirements Cluster 101`, `Requirements Cluster 102`, `Requirements Cluster 103`, `Requirements Cluster 104`, `Requirements Cluster 105`, `Requirements Cluster 106`, `Requirements Cluster 107`, `Requirements Cluster 108`, `Requirements Cluster 109`, `Requirements Cluster 110`, `Requirements Cluster 111`, `Requirements Cluster 112`, `Requirements Cluster 113`, `Requirements Cluster 114`, `Requirements Cluster 115`, `Requirements Cluster 116`, `Requirements Cluster 117`, `Requirements Cluster 118`, `Requirements Cluster 119`, `Requirements Cluster 120`, `Requirements Cluster 121`, `Requirements Cluster 122`, `Requirements Cluster 123`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `Vertical: Wealth Management` connect `Requirements Cluster 129` to `Requirements Cluster 0`, `Requirements Cluster 1`, `Requirements Cluster 2`, `Requirements Cluster 3`, `Requirements Cluster 4`, `Requirements Cluster 5`, `Requirements Cluster 6`, `Requirements Cluster 7`, `Requirements Cluster 8`, `Requirements Cluster 9`, `Requirements Cluster 10`, `Requirements Cluster 11`, `Requirements Cluster 12`, `Requirements Cluster 13`, `Requirements Cluster 15`, `Requirements Cluster 16`, `Requirements Cluster 17`, `Requirements Cluster 18`, `Requirements Cluster 19`, `Requirements Cluster 20`, `Requirements Cluster 21`, `Requirements Cluster 22`, `Requirements Cluster 23`, `Requirements Cluster 24`, `Requirements Cluster 25`, `Requirements Cluster 26`, `Requirements Cluster 27`, `Requirements Cluster 28`, `Requirements Cluster 29`, `Requirements Cluster 30`, `Requirements Cluster 31`, `Requirements Cluster 32`, `Requirements Cluster 33`, `Requirements Cluster 34`, `Requirements Cluster 35`, `Requirements Cluster 36`, `Requirements Cluster 37`, `Requirements Cluster 38`, `Requirements Cluster 40`, `Requirements Cluster 41`, `Requirements Cluster 42`, `Requirements Cluster 43`, `Requirements Cluster 44`, `Requirements Cluster 45`, `Requirements Cluster 46`, `Requirements Cluster 47`, `Requirements Cluster 48`, `Requirements Cluster 49`, `Requirements Cluster 50`, `Requirements Cluster 51`, `Requirements Cluster 52`, `Requirements Cluster 53`, `Requirements Cluster 54`, `Requirements Cluster 55`, `Requirements Cluster 56`, `Requirements Cluster 57`, `Requirements Cluster 58`, `Requirements Cluster 59`, `Requirements Cluster 60`, `Requirements Cluster 61`, `Requirements Cluster 62`, `Requirements Cluster 63`, `Requirements Cluster 64`, `Requirements Cluster 65`, `Requirements Cluster 66`, `Requirements Cluster 67`, `Requirements Cluster 68`, `Requirements Cluster 69`, `Requirements Cluster 70`, `Requirements Cluster 71`, `Requirements Cluster 72`, `Requirements Cluster 73`, `Requirements Cluster 74`, `Requirements Cluster 75`, `Requirements Cluster 76`, `Requirements Cluster 77`, `Requirements Cluster 78`, `Requirements Cluster 79`, `Requirements Cluster 80`, `Requirements Cluster 81`, `Requirements Cluster 82`, `Requirements Cluster 83`, `Requirements Cluster 84`, `Requirements Cluster 85`, `Requirements Cluster 86`, `Requirements Cluster 87`, `Requirements Cluster 88`, `Requirements Cluster 89`, `Requirements Cluster 90`, `Requirements Cluster 91`, `Requirements Cluster 92`, `Requirements Cluster 93`, `Requirements Cluster 94`, `Requirements Cluster 95`, `Requirements Cluster 96`, `Requirements Cluster 97`, `Requirements Cluster 98`, `Requirements Cluster 99`, `Requirements Cluster 100`, `Requirements Cluster 101`, `Requirements Cluster 102`, `Requirements Cluster 103`, `Requirements Cluster 104`, `Requirements Cluster 105`, `Requirements Cluster 106`, `Requirements Cluster 107`, `Requirements Cluster 108`, `Requirements Cluster 109`, `Requirements Cluster 110`, `Requirements Cluster 111`, `Requirements Cluster 112`, `Requirements Cluster 113`, `Requirements Cluster 114`, `Requirements Cluster 115`, `Requirements Cluster 116`, `Requirements Cluster 117`, `Requirements Cluster 118`, `Requirements Cluster 119`, `Requirements Cluster 120`, `Requirements Cluster 121`, `Requirements Cluster 122`, `Requirements Cluster 123`, `Requirements Cluster 127`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **What connects `Vertical Specifics (Banking): Credit underwriting documentation, loan disbursement milestones, and commercial banking qualification gates pending client confirmation [Deck P320]`, `Vertical Specifics (Markets): Demat/trading account opening, SEBI risk disclosures, margin facility gates pending client confirmation [Deck P320]`, `Vertical Specifics (Real Estate): Property escrow milestones, RERA disclosures, builder commission stages pending client confirmation [Deck P320]` to the rest of the system?**
  _1124 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Requirements Cluster 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `Requirements Cluster 1` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `Requirements Cluster 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._