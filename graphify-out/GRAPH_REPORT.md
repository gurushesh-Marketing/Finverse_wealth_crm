# Graph Report - finverse-crm-v2  (2026-10-04)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 859 nodes · 1859 edges · 34 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `03635090`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33

## God Nodes (most connected - your core abstractions)
1. `HttpError` - 55 edges
2. `notFound()` - 52 edges
3. `assertTl()` - 38 edges
4. `forbidden()` - 30 edges
5. `useSubmit()` - 28 edges
6. `react` - 20 edges
7. `teamFilter()` - 18 edges
8. `label()` - 18 edges
9. `attributionFor()` - 15 edges
10. `useSession()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `deleteSavedView()` --calls--> `notFound()`  [EXTRACTED]
  apps/api/src/repo/work.ts → apps/api/src/lib/errors.ts
- `setMeetingOutcome()` --calls--> `notFound()`  [EXTRACTED]
  apps/api/src/repo/work.ts → apps/api/src/lib/errors.ts
- `wealthRouter()` --indirect_call--> `requireSession()`  [INFERRED]
  apps/api/src/routes/wealth.ts → apps/api/src/middleware/session.ts
- `PerformancePage()` --calls--> `exportDownloadPath()`  [EXTRACTED]
  apps/web/src/pages/AreaPages.tsx → apps/web/src/lib/wealth-api.ts
- `PipelineTab()` --calls--> `useSubmit()`  [EXTRACTED]
  apps/web/src/pages/ProspectPage.tsx → apps/web/src/components/leads/RecordForms.tsx

## Import Cycles
- None detected.

## Communities (34 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (130): activityCorrectionSchema, AllocationReceipt, allocationSchema, AuditEntry, AVAILABILITY_STATUSES, AvailabilityChangeInput, availabilityChangeSchema, AvailabilityStatus (+122 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (78): forbidden(), notFound(), downloadDocument(), reviewDocument(), approveProposal(), computePerformance(), count(), createExport() (+70 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (24): env, app, reminderTimer, executeDueReminders(), ApiResult, results, stamp, Session (+16 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (34): devDependencies, dotenv, eslint, @eslint/js, pg, tsx, @types/node, @types/pg (+26 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (31): assertWealthAssignment(), createEnquiry(), createProposal(), createRequest(), listAudit(), listProposals(), listRequests(), ownedLead() (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (24): ACTION_LABELS, FollowUpForm(), Button(), buttonVariants, FieldError(), Input(), Label(), Textarea() (+16 more)

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (25): Landing(), ProtectedLayout(), MobileNav(), NavLinks(), Sidebar(), WorkspaceShell(), ALL_MODULES, canAccessModule() (+17 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (29): dependencies, cookie, dotenv, express, @finverse/contracts, pdfkit, pg, zod (+21 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (28): parse(), wealthRouter(), wrap(), packages_contracts_dist_index_availabilitychangeschema, packages_contracts_dist_index_callstartschema, packages_contracts_dist_index_conversionschema, packages_contracts_dist_index_documentrequestschema, packages_contracts_dist_index_enquiryschema (+20 more)

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (25): CallPanel(), DocumentsTab(), EditDetailsDrawer(), fmt(), InboundForm(), ManualActivityForm(), MeetingDialog(), RequestsTab() (+17 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (25): activeSuppressions(), advanceCall(), advanceMessageStatus(), assertLeadInScope(), CALL_TRANSITIONS, listConversations(), logManualActivity(), MESSAGE_TRANSITIONS (+17 more)

### Community 11 - "Community 11"
Cohesion: 0.13
Nodes (24): createFollowUp(), dueStatusFrom(), EventRow, getLead(), LeadRow, listLeads(), maskPhone(), myDay() (+16 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (14): DrawerPanel(), label(), OVERRIDES, ProspectPage(), DecisionForm(), TlAllocationPage(), TlCoachingPage(), TlOverviewPage() (+6 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (21): compilerOptions, module, moduleResolution, types, extends, include, ../../tsconfig.base.json, compilerOptions (+13 more)

### Community 14 - "Community 14"
Cohesion: 0.11
Nodes (17): deleteSavedView(), getAvailability(), listMyTasks(), rescheduleTask(), setAvailability(), setMeetingOutcome(), taskReminders(), TaskView (+9 more)

### Community 15 - "Community 15"
Cohesion: 0.20
Nodes (16): verifyPassword(), createSessionToken(), hashToken(), SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionRow(), deleteSessionRow(), findSessionEmployeeId() (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.19
Nodes (14): Card(), CardContent(), CardHeader(), CardTitle(), PageHeader(), DeniedPanel(), EmptyState(), ErrorState() (+6 more)

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (19): AuthedRequest, AuthContext, scopeOf(), sendError(), wrap(), packages_contracts_dist_index_activitycorrectionschema, packages_contracts_dist_index_allocationschema, packages_contracts_dist_index_batchallocationschema (+11 more)

### Community 18 - "Community 18"
Cohesion: 0.19
Nodes (16): HttpError, saveWrapup(), correctProspect(), decideRequest(), markLost(), moveStage(), ownedLeadStrict(), requestConversion() (+8 more)

### Community 19 - "Community 19"
Cohesion: 0.12
Nodes (15): compilerOptions, declaration, noEmit, outDir, rootDir, exclude, extends, include (+7 more)

### Community 20 - "Community 20"
Cohesion: 0.19
Nodes (14): ALLOWED_TYPES, createDocumentRequest(), docRequestView(), docView(), listDocumentRequests(), listDocuments(), ownedLead(), rotateUploadToken() (+6 more)

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (14): name, private, type, version, @base-ui/react, class-variance-authority, shadcn, tailwindcss (+6 more)

### Community 22 - "Community 22"
Cohesion: 0.34
Nodes (11): createApp(), errorBody(), unauthenticated(), errorHandler(), jsonGuard(), requireSession(), leadsRouter(), tlRouter() (+3 more)

### Community 23 - "Community 23"
Cohesion: 0.14
Nodes (14): dependencies, @base-ui/react, class-variance-authority, cn, @finverse/contracts, @fontsource/inter, @fontsource/jetbrains-mono, @fontsource/manrope (+6 more)

### Community 24 - "Community 24"
Cohesion: 0.23
Nodes (10): pool, AssignmentRow, EmployeeRow, ROLE_ACTIONS, Scope, readScopeSql(), requireLeadForRead(), ScopedLead (+2 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (12): dependencies, zod, zod, main, name, private, scripts, build (+4 more)

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, noEmit, resolveJsonModule, skipLibCheck (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.24
Nodes (5): isMobile(), login(), loginOk(), logout(), @playwright/test

### Community 28 - "Community 28"
Cohesion: 0.22
Nodes (8): BACKDATE_WINDOW_HOURS, ENQUIRY_SOURCES, LOSS_REASONS, MAX_DEFERRALS_BEFORE_APPROVAL, STAGE_RULE_VERSION, WEALTH_PRODUCTS, WEALTH_STAGE_TRANSITIONS, WHATSAPP_TEMPLATES

### Community 29 - "Community 29"
Cohesion: 0.25
Nodes (8): devDependencies, @playwright/test, tailwindcss, @tailwindcss/vite, @types/react, @types/react-dom, vite, @vitejs/plugin-react

### Community 30 - "Community 30"
Cohesion: 0.32
Nodes (5): ApiError, request(), tlApi, packages_contracts_dist_index_errorresponse, packages_contracts_dist_index_followupresult

### Community 31 - "Community 31"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, preview, test:e2e, typecheck

### Community 32 - "Community 32"
Cohesion: 0.29
Nodes (6): App(), apps_web_src_styles, @fontsource/inter, @fontsource/jetbrains-mono, @fontsource/manrope, react-dom

### Community 33 - "Community 33"
Cohesion: 0.50
Nodes (3): fmt(), LeadInboxPage(), removeView()

## Knowledge Gaps
- **304 isolated node(s):** `AllocationReceipt`, `AuditEntry`, `AvailabilityChangeInput`, `AvailabilityStatus`, `CallRecord` (+299 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 424 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `express` connect `Community 22` to `Community 7`, `Community 8`, `Community 11`, `Community 15`, `Community 17`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `dotenv` connect `Community 3` to `Community 7`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `react` connect `Community 5` to `Community 32`, `Community 6`, `Community 9`, `Community 12`, `Community 16`, `Community 21`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **What connects `AllocationReceipt`, `AuditEntry`, `AvailabilityChangeInput` to the rest of the system?**
  _304 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.015151515151515152 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0533515731874145 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05919661733615222 - nodes in this community are weakly interconnected._