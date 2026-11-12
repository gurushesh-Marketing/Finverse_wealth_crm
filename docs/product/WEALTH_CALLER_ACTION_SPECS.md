# Wealth Caller action specifications (SC-01…SC-28)

Condensed from `docs/product/action_catalogue_v2.json` (authoritative) + deck
composition. Each entry: fields · validation · states · permissions · data/
timeline · reporting · acceptance. Missing source detail = `[ASSUMPTION]`.
COVERAGE_MATRIX.md rows link here. Implementation checklist order = slice plan.

## SC-01 My day
Fields: Period(today), Priority(Overdue first), Availability(Available/Busy/Away), Queue(My active assignment). Validation: active assignment mandatory; availability does not change ownership. States: loading/empty/error/stale-data badge. Data: availability change recorded with effective time. Report: workload only; historical team/role preserved per event. Acceptance: overdue-first queue opens record; availability change visible with effective time; stale badge on delayed data `[ASSUMPTION: simulated delay]`.

## SC-02 Lead Inbox
Fields: Search, Stage, Source, Due, Saved view(name). Validation: search/counts obey ownership scope; saved views store filters only. States: empty + Clear filters; foreign lead ID → no exposed data. Data: employee-specific view definitions re-checked against current permissions. Report: filters change display only. Acceptance: apply/reset/save view; view re-applies with current scope.

## SC-03 Prospect record
Fields: Opportunity, Contact(masked), Product, Source, Owner, Next action + tabs Summary/Timeline/Tasks/Conversations/Documents/Pipeline/Requests. Validation: opportunity in current workload; contact links scoped. States: access-changed → read-only + clear sensitive + return. Report: viewing is not contact activity. Acceptance: all tabs usable; SC-06/07/08/09/10/11/23/24 entry points functional (built before claiming done).

## SC-04 Correct prospect information
Fields: Display name, Phone(verified), Email(opt), Preferred language, Correction reason. Validation: phone/email format; possible duplicate → pause identity change + review; caller cannot change source/vertical/ownership. Data: versioned save + before/after audit, intake provenance retained. Report: correction ≠ new lead. Acceptance: valid save + audit entry; invalid format blocked; protected fields not editable.

## SC-05 Self-sourced enquiry
Fields: Prospect, Phone, Product(V1), Source, Permission evidence(ref+date), Need. Validation: role grant + mandatory + evidence; duplicate check before new opportunity. Data: manual intake stored separately (origin+creator); publish via routing (self-ownership NOT assumed). Report: invalid/duplicate intake reported separately. Acceptance: submit → processing reference; duplicate → link/review path `[ASSUMPTION: duplicate = matching phone]`.

## SC-06 Place a voice call (SIMULATED provider)
Fields: Prospect, Number(unmasked only at authorised dial), Call mode, Permission, Provider state. Validation: owner, contact permission, hours, frequency cap, opt-out suppression, provider health. Data: one call per idempotency key; states connecting/ringing/connected/ended/failed. Report: only provider-confirmed calls count (simulator = SIMULATED, never verified). Acceptance: state machine visible; double-click starts one call; failure → Retry/manual path; suppression blocks dial.

## SC-07 Call wrap-up
Fields: Call ID, Disposition(Connected/No answer/Busy/Wrong number/Callback), Need confirmed, Note, Next action, Due. Validation: Connected ≠ qualified; follow-up needs due+owner; No-answer cannot set Contacted. Data: append activity + allowed stage event; create/update next task atomically; close completed task. Report: call facts use call-start date; repeated save counts once. Acceptance: save → task+timeline update; uncertain outcome → Needs wrap-up `[ASSUMPTION]`.

## SC-08 Manual activity (honest evidence)
Fields: Activity type, Occurred at, Outcome, Duration(self-reported), Reason, Note. Validation: backdating window `[ASSUMPTION: 24h]`; no future time; no fabricated provider ID. Data: actor/entered-time/event-time + manual verification status; edit history preserved. Report: manual shown separately from verified. Acceptance: save labelled MANUAL; correction path, no silent deletion.

## SC-09 WhatsApp (SIMULATED provider)
Fields: Conversation, Permission, Template, Language, Variables, Preview. Validation: policy, product, permission, window, template approval, opt-out. Data: one outbound message, provider ID(sim), status queued/delivered/read/replied/failed. Report: sent ≠ successful contact. Acceptance: preview + send + status flow; disabled Send with reason when ineligible; suppression suppresses queued.

## SC-10 Inbound reply / missed call
Fields: Channel, Matched enquiry, Received, Intent, Next task. Validation: ambiguous match resolved w/o cross-vertical leak; unowned → supervisor queue `[ASSUMPTION: TL queue]`. Data: dedupe inbound IDs; append to enquiry; notify owner. Report: first response + unresolved age separate. Acceptance: handle flow records response/next action; ownership change re-routes.

## SC-11 Schedule follow-up (DONE partial → complete)
Fields: Lead, Action, Due, Priority, Reminder, Purpose. Validation: future due, current owner, eligible channel; conflict warning. Data: versioned task + **reminder job (persisted)**; timeline event; stage → follow-up if allowed. Report: due-period denominator; revision traceable. Acceptance: reminder row persisted and executed (marked sent + timeline note); duplicate purpose → update/confirm path (409 handled).

## SC-12 Reschedule
Fields: Task, Original due(read-only), New due, Reason, Customer informed. Validation: original deadline retained; repeated deferral threshold → TL approval `[ASSUMPTION: >2 deferrals]`. Data: schedule revision + reminder job replacement; SLA history kept. Report: missed commitment retained; revised workload separate. Acceptance: both dates visible; old reminder cancelled + replacement created.

## SC-13 Complete / cancel / reopen task
Fields: Task, Outcome, Evidence, Next step, Next due, Cancellation reason. Validation: truthful outcome; cancel reason allowed; reopen = logged correction. Data: task transition + linked activity once; reminders cancelled on terminal; next task created. Report: eligible due tasks remain in metric; approved cancellations excluded. Acceptance: each transition works; moved-owner task not completable from stale screen (403/409).

## SC-14 Book meeting / visit
Fields: Meeting type, Lead, Slot, Location, Attendees, Agenda. Validation: slot conflicts, attendee access, external channel approved. Data: atomic slot reserve, attendee tasks, invitation delivery status (SIMULATED). Report: booked/attended/no-show separate. Acceptance: conflict → alternatives; invitation failure ≠ cancel.

## SC-15 Qualification
Fields: Need, Product(V1), Expected value+currency, Time horizon, Fit checklist, Next step. Validation: product-specific mandatory; estimate ≠ verified revenue. Data: answers + checklist version + activity. Report: qualification completion vs estimated pipeline separate. Acceptance: save + recommended next step; product mismatch → referral request.

## SC-16 Pipeline move
Fields: Opportunity, Current stage(read-only), Requested stage, Reason, Required evidence. Validation: server-side allowed transition + ownership + required fields; Converted needs approval. Data: stage event (prior, actor, reason, rule version); related tasks updated in same tx. Report: counts/ageing from events. Acceptance: allowed move persists; stale record → conflict state; rejected transition reverts.

## SC-17 Proposal
Fields: Product, Template version, Commercial terms, Validity, Attachments, Recipient. Validation: no unapproved claims/discounts beyond authority; disclosures from approved content. Data: versioned proposal + approval evidence + send status (SIMULATED). Report: sent = milestone, not revenue. Acceptance: draft → submit-for-approval → send approved; edit-after-approval re-approvals.

## SC-18 Request documents
Fields: Lead, Checklist, Requested files, Upload link(expiring), Due, Reminder. Validation: permitted docs for product/stage only. Data: scoped upload tokens + expiry; evidence linked; scan before release. Report: completeness ≠ verified. Acceptance: request created + link generated (expiry enforced); resend after expiry with permission check.

## SC-19 Upload / replace / inspect evidence
Fields: Document type, File, Version, Visibility, Validation. Validation: type/size/scan; caller cannot self-verify. Data: **genuine stored file + authorized retrieval**, version + access audit, retention `[ASSUMPTION: retain]`. Report: requested/received/accepted/rejected separate. Acceptance: real upload+download via API in scope; replace = new version; rejected shows reason.

## SC-20 Submit conversion
Fields: Opportunity, Win milestone, Milestone date, Value, Evidence, Proposed credit. Validation: complete evidence, no blocking exceptions, independent approver, credit totals 100%. Data: versioned approval request; locked payload; notify approver. Report: pending ≠ win. Acceptance: submit → Pending conversion; reject returns reasons; resubmit = new version.

## SC-21 Mark lost
Fields: Loss reason, Explanation, Competitor(opt), Future contact. Validation: allowed reason; duplicate/invalid-data use own dispositions. Data: loss event + cancel obsolete tasks; history preserved; opt-out also suppresses. Report: loss analysis by product/reason/source/time. Acceptance: converted cannot be lost by caller; loss persists with reason.

## SC-22 Request reopen
Fields: Opportunity, Reason, New evidence, Requested next stage, Next action. Validation: suppression stays binding. Data: reopen approval; original loss kept; approved → reopen event + task. Report: reopen counts separate. Acceptance: request stays pending until approver; out-of-scope lead → reference-only.

## SC-23 Handoff / cross-vertical referral
Fields: Opportunity, Reason, Destination, Customer permission, Handoff note. Validation: caller cannot browse destination data; referral = scoped linked enquiry. Data: notify receiving authority; accept/decline + deadline; tasks move only on approved same-enquiry transfer. Report: earlier activities stay with actor. Acceptance: sender sees status only; declined returns reason.

## SC-24 Opt-out / contact complaint
Fields: Request, Source, Received at, Channels, Complaint note. Validation: explicit opt-out immediate, no approval. Data: suppression + cancel queued outbound + notify owner; complaint → resolution queue. Report: suppressed = separate category; cannot be erased. Acceptance: suppression blocks subsequent SC-06/09 eligibility immediately.

## SC-25 Personal performance
Fields: Period(D/W/M/Q/H/Y), Metric, View(historical assignment), Comparison. Validation: facts tied to employee; zero targets → N/A. Data: versioned metric queries with period tz + cutoff. Report: verified/manual activity, transfers, targets, wins, credited revenue, refresh time independent. Acceptance: KPI click shows formula/numerator/denominator/evidence; numbers computed from stored events.

## SC-26 One-to-one
Fields: Review, Reviewer(read-only), Self-reflection, Commitments, Employee response. Validation: acknowledgement ≠ agreement; no edit of reviewer rating. Data: versioned review + ack time + commitment tasks. Report: coaching report separate from sales. Acceptance: reflect → acknowledge + response; commitments tracked to completion.

## SC-27 Meeting PDF (real download)
Fields: Report, Period, Snapshot as-of, Sections, Recipient. Validation: personal scope re-checked at generation AND download. Data: export job + snapshot + expiry + audit; watermark; revoke on access change. Report: PDF stores metric version/cutoff/period; reconciles with on-screen. Acceptance: downloadable PDF contains real scoped data from the application.

## SC-28 Blocker / metric correction
Fields: Request type, Record reference, Expected correction, Evidence, Priority. Validation: reference must be caller-identifiable; attachments/text scoped. Data: route to TL/ops/finance/access by category; owner+SLA+decision+correction linkage. Report: accepted correction appends adjustment, prior version kept. Acceptance: request stays pending until decision-maker; no direct protected-fact edits.
