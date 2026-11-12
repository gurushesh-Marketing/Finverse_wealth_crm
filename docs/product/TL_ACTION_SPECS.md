# Wealth Team Lead — action specifications (TL-01…TL-18)

Extracted once from `docs/product/action_catalogue_v2.json` (authoritative
fields/steps/validation/system/report/exception per action) and the Team Lead
deck section (`NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf` pages
100–160, even pages are action screens; page 11 is the TL index). Deck page
refs below marked [deck] were read from rendered pages; refiner pass by
fvc2-designer adds per-action composition notes.

Shared rules (all actions): scope = server-derived TL grants (vertical wealth
+ granted teams; multi-team = deduplicated union — every fact counts once);
drill-down stays inside the TL workspace (never the Caller interface);
requester ≠ approver for every decision; historical employee/team/event
attribution is immutable; restricted admin/commercial changes are REQUESTS
only (submitting executes nothing); simulated providers labelled.

## TL-01 Team overview — inspect team health, drill into a metric [deck p100]
Fields: Team (granted, incl. deduplicated union), Period, Metric, Comparison.
Drill: KPI → member + opportunity breakdown; assign corrective task in-TL.
Validation: filters from current grants; revoked team disappears; historical
facts via approved historical path; overlaps counted once. Report: actual/target,
overdue work, idle capacity, pending approvals, data freshness.

## TL-02 Allocate an unassigned lead [deck p102]
Fields: Queue (V1 new leads), Lead, Recipient (eligible associate), Capacity
(x of y), Reason. Validation: lead+recipient in scope; active employment,
leave, product eligibility, capacity checked; never a disabled user. System:
atomic ownership + first-contact task + notification on the record version.
Report: first allocation ≠ transfer ≠ reassignment. Exception: no eligible
associate → queue ownership retained + capacity escalation.

## TL-03 Batch distribution with preview [deck p104]
Fields: Batch (bounded), Method (weighted round-robin), Team, Capacity cap,
Preview (n eligible / m held). Validation: scope+capacity revalidated at
commit; concurrent allocators cannot double-assign (unique batch key + atomic
per-lead assignment). Report: queue age + fair distribution separate from
conversion. Exception: stale/ineligible recipient fails that row only; partial
results visible + downloadable in scope.

## TL-04 Rebalance work within granted teams [deck p106]
Fields: Source owner, Destination, Open leads, Open tasks, Reason, handoff
deadline. Validation: preserve original due times + attribution; cross-team
moves need authority over both (else Manager request). System: close old
ownership interval, open new, move open tasks together, handoff note.
Report: inherited backlog separate for recipient; earlier calls/wins never
transfer. Exception: pending approvals locked → explicit handling.

## TL-05 Resolve an overdue follow-up [deck p108]
Fields: Queue (Overdue, severity-sorted), Employee, Task, Age, Action
(coach / reassign / escalate). Validation: TL cannot erase missed deadlines or
backdate completion; new contact must stay channel-eligible. System: append
escalation + recovery task (owner, deadline, reason); original history kept.
Report: breach count, overdue age, time to recovery. Exception: breach
threshold → notify Manager with evidence pack.

## TL-06 Review an associate in the TL workspace [deck p110]
Fields: Employee, Assignment (team/role), View (workload + performance),
Period, History (permitted intervals). Validation: granted members only; HR
fields + other vertical work excluded; sensitive evidence access audited.
System: current workload + labelled historical segments; open lead or start
review without switching role. Report: personal vs inherited vs team-attributed.

## TL-07 Approve or return a conversion [deck p112]
Fields: Request, Submitted by, Evidence pack, Value, Decision
(Approve / Return with specific missing items). Validation: approver ≠
submitter; current scope, authority limits, rule version, unchanged payload.
System: decision receipt; approval locks attribution + finance verification
task. Report: win counts once on approval; revenue separate until finance rule.
Exception: conflict/missing evidence → next eligible approver.

## TL-08 Resolve a reopen or duplicate request [deck p114]
Fields: Request type (reopen lost lead / duplicate), Reference, New evidence,
Decision (Approve / Return / Reject). Validation: merge authority separate;
never collapse distinct products or cross-vertical by phone alone. System:
append decision or reviewed duplicate disposition; retain IDs + source links.
Report: duplicate exclusions + reopen counts auditable. Exception: restricted
cross-vertical match → match-review reference only.

## TL-09 Review call quality and log coaching [deck p116]
Fields: Activity, Evidence (recording/transcript — explicit grant), Rubric
(approved checklist version), Feedback. Validation: playback requires grant +
policy; score ≠ sales metric; missing evidence → unassessed (never inferred).
System: rubric version + evidence ref + reviewer + feedback visibility; access
log. Report: sample size + assessed calls (small samples ≠ full coverage).

## TL-10 Distribute an approved team target [deck p118]
Fields: Parent target, Period, Associate allocations, Unallocated (visible
balance), Basis (capacity, start dates, approved prorating). Validation: child
allocations reconcile to parent with explicit remainder; closed periods
immutable. System: versioned allocation + employee notification; exceptions →
Manager. Report: attainment = approved target version + same-period actual.

## TL-11 Submit the team forecast [deck p120]
Fields: Forecast period, Category (Commit / Best case / Pipeline), Expected
revenue, Risk notes. Validation: won ≠ expected; stage probability from
approved version; unpriced/stale excluded from totals (shown as incomplete).
System: frozen version + supporting opportunity IDs + assumptions; notify
Manager. Report: forecast vs actual on same period/currency/basis.

## TL-12 Schedule and run an associate one-to-one [deck p122]
Fields: Employee, Period, Agenda, Snapshot (version), Actions (owner+deadline).
Validation: authorised period data; private reviewer notes separated;
disagreement recorded. System: freeze meeting snapshot, create commitments,
version later edits. Report: completion, acknowledgement, overdue commitments
separately. Exception: missing response ≠ agreement.

## TL-13 Assign an intern mentor and graded workload [deck p124]
Fields: Intern, Mentor (eligible TL/senior), Work cap, Allowed products
(training-approved), Review date. Validation: TL allocates work but cannot
grant roles; mentor visibility scoped + dated + explicit. System: mentorship +
task assignments; permission expansion → HR/Super Admin request. Report:
trainee output vs mentor reviews vs independent conversions. Exception:
expired internship/delegation blocks allocation + alerts supervisor.

## TL-14 Request a move, role change or capacity increase [deck p126]
Fields: Employee/team, Request type, Business reason, Effective date, Impact.
Validation: requesting grants no access; organisational changes need business
approval + admin execution. System: lifecycle request + approval chain +
unresolved handoff items. Report: queue impact + response time (no fabricated
staffing change). Exception: rejection leaves assignments unchanged + shows reason.

## TL-15 Escalate a complaint or commercial exception [deck p128]
Fields: Category (customer complaint / commercial), Lead, Severity, Evidence
(activity references), Requested decision, proposed owner. Validation:
escalation routing configured; TL cannot approve finance adjustments or
conceal contact restrictions; suppression applies immediately (pre-approval).
System: exception with due time + escalation path + immutable evidence refs.
Report: open exceptions, ageing, resolution; related lead stays in performance
without approved rule. Exception: owner absence → named delegation.

## TL-16 Generate a team review pack (PDF) [deck p130]
Fields: Scope (granted teams/union), Period (month/quarter), Sections (team,
members, actions), Historical mode (event-time team), Audience. Validation:
union deduplicates; appendix uses same cutoff + formula version as summary.
System: snapshot-bound export; recipient + current scope re-checked on
generation AND download. Report: six report periods, original/revised versions,
target reconciliation. Exception: removed team excluded from pending exports.

## TL-17 Schedule a recurring report [deck p132]
Fields: Report (saved team report), Cadence (e.g. Monday 09:00 IST), Period
(previous complete week), Recipients (approved internal), Delivery (protected
report centre). Validation: recipient + owner permissions rechecked every run;
revoked scope never preserved. System: scheduled job + dedupe key; one version
per period; alert on failure. Report: schedule owner, as-of, metric version,
distribution audit. Exception: owner offboarded/grant expired → suspend.

## TL-18 Approve a documented activity correction [deck p134]
Fields: Request, Activity, Requested correction, Evidence (provider event),
Decision (Accept / Return). Validation: provider truth needs evidence; closed
finance facts → finance adjustments instead. System: append-only correction
w/ reviewer + original fact reference; permitted metric recomputation; flag
affected report versions. Report: snapshots keep original + show revised.
Exception: self-submitted → Manager; never delete an unfavourable activity.

## Slice 0 (restoration — retracted descope)
Trend module, "Where to next" module, stage-flow band + Completion/WHR band
items are deck-required (removal in BUILD_LOG step 009 was NOT human
authorized). Restore per designer deck-p6/7/8 reading and verify.

## Unresolved business rules → [ASSUMPTION] (demo)
- Capacity caps (20/associate), breach threshold (3), SLA times, authority
  limits (value cap for TL approval), prorating rule = configured constants.
- Recording/transcript evidence = simulated (no provider integration).
- Recurring schedule job runs on the API interval tick (documented cadence).
- IST fixed +05:30 period bounds (as SC reporting).
