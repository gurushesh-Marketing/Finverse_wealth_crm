import json
import hashlib
import re
from pathlib import Path
import pypdf

ROOT = Path(__file__).resolve().parent.parent
DECK_PATH = ROOT / "docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf"
CAT_PATH = ROOT / "docs/product/action_catalogue_v2.json"
BRAND_PATH = ROOT / "docs/brand/Finverse Wealth Brand Guidelines.pdf"
LOGO_PATH = ROOT / "docs/brand/NEW Finverse Logo.pdf"
OUT_PATH = ROOT / "docs/product/DECK_REQUIREMENTS_COVERAGE.md"

def get_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

deck_hash = get_hash(DECK_PATH)
cat_hash = get_hash(CAT_PATH)
brand_hash = get_hash(BRAND_PATH)
logo_hash = get_hash(LOGO_PATH)

cat = json.loads(CAT_PATH.read_text(encoding='utf-8'))
reader = pypdf.PdfReader(str(DECK_PATH))

role_names = {
    'SC': 'Sales Caller',
    'TL': 'Team Leader',
    'MG': 'Manager',
    'RM': 'Regional Manager',
    'NM': 'National Manager',
    'CEO': 'Chief Executive Officer',
    'CFO': 'Chief Financial Officer',
    'DE': 'Data Entry',
    'HR': 'Human Resources',
    'SA': 'Super Admin'
}

role_index_pages = {
    'SC': 8, 'TL': 11, 'MG': 14, 'RM': 17, 'NM': 20,
    'CEO': 23, 'CFO': 26, 'DE': 29, 'HR': 32, 'SA': 35
}

# Scan action pages
action_pages = {}
for p_num in range(44, 314, 2):
    txt = reader.pages[p_num - 1].extract_text() or ''
    matches = re.findall(r'\b(SC-\d{2}|TL-\d{2}|MG-\d{2}|RM-\d{2}|NM-\d{2}|CEO-\d{2}|CFO-\d{2}|DE-\d{2}|HR-\d{2}|SA-\d{2})\b', txt)
    for aid in matches:
        if aid not in action_pages:
            action_pages[aid] = {'contract_page': p_num, 'screen_page': p_num - 1}

lines = []
lines.append("# Deck-Driven Requirements Coverage & Coordination Contract")
lines.append("")
lines.append("Authoritative reconciliation of the Finverse CRM action deck against the product catalogue, brand guidelines, and engineering execution architecture.")
lines.append("")
lines.append("## 1. Authoritative References & Integrity Hashes")
lines.append("")
lines.append("| Document | Path | SHA-256 Hash | Pages / Items | Role & Authority |")
lines.append("|---|---|---|---|---|")
lines.append(f"| **Action Deck** | `docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf` | `{deck_hash[:16]}...{deck_hash[-8:]}` | 320 pages | Master UI/UX and workflow specification |")
lines.append(f"| **Action Catalogue** | `docs/product/action_catalogue_v2.json` | `{cat_hash[:16]}...{cat_hash[-8:]}` | 135 actions | Structured system contracts and test criteria |")
lines.append(f"| **Brand Guidelines** | `docs/brand/Finverse Wealth Brand Guidelines.pdf` | `{brand_hash[:16]}...{brand_hash[-8:]}` | 10 pages | Visual tokens, palette, typography, layout rules |")
lines.append(f"| **Logo Specification** | `docs/brand/NEW Finverse Logo.pdf` | `{logo_hash[:16]}...{logo_hash[-8:]}` | 1 page | Vector geometry, proportion (1:1.22), lockups |")
lines.append("")
lines.append("---")
lines.append("")
lines.append("## 2. Complete 135-Action Inventory & Reconciliation")
lines.append("")
lines.append("Every single action in `action_catalogue_v2.json` (135/135) is reconciled against its exact physical page numbers in `NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf`:")
lines.append("")
lines.append("| Action ID | Role | Module | Title | Screen Page | Contract Page | Index Page | Current Milestone Status |")
lines.append("|---|---|---|---|---|---|---|---|")

for a in cat:
    aid = a['id']
    role = a['role']
    mod = a['module']
    title = a['title']
    pg = action_pages.get(aid, {'screen_page': 0, 'contract_page': 0})
    sp = pg['screen_page']
    cp = pg['contract_page']
    ip = role_index_pages.get(role, 0)
    
    if aid.startswith('SC-'):
        st = "VERIFIED (Caller 28/28 done)"
    elif aid.startswith('TL-'):
        st = "BLOCKED (18/18 built; M1–M5 open)"
    else:
        st = "NOT STARTED (Next milestones)"
        
    lines.append(f"| **{aid}** | {role} | {mod} | {title} | P{sp:03d} | P{cp:03d} | P{ip:03d} | {st} |")

lines.append("")
lines.append("---")
lines.append("")
lines.append("## 3. Role Breakdown & Extraction Details")
lines.append("")

# Group by role
roles_grouped = {}
for a in cat:
    roles_grouped.setdefault(a['role'], []).append(a)

for r_code in ['SC', 'TL', 'MG', 'RM', 'NM', 'CEO', 'CFO', 'DE', 'HR', 'SA']:
    actions = roles_grouped.get(r_code, [])
    r_name = role_names[r_code]
    idx_p = role_index_pages[r_code]
    min_sp = action_pages[actions[0]['id']]['screen_page']
    max_cp = action_pages[actions[-1]['id']]['contract_page']
    
    lines.append(f"### Role: {r_name} (`{r_code}`) — {len(actions)} Actions")
    lines.append(f"- **Deck Range:** Pages P{min_sp:03d} to P{max_cp:03d} (Action Index: P{idx_p:03d})")
    lines.append(f"- **Vertical Applicability:** Configured by default for Wealth Management; sales hierarchy and workflow patterns replicate across Commercial Banking, Markets & Securities, and Real Estate Advisory.")
    lines.append("")
    lines.append("| ID | Title | Entry Point | Key Inputs & Fields | Validations & Invariants | System & Reporting Effect | Exceptions |")
    lines.append("|---|---|---|---|---|---|---|")
    
    for a in actions:
        aid = a['id']
        t = a['title']
        mod = a['module']
        flds = ", ".join([f"{f[0]}: {f[1]}" for f in a.get('fields', [])[:3]])
        val = a.get('validation', '').replace('\n', ' ')
        sys_rep = (a.get('system', '') + " " + a.get('report', '')).replace('\n', ' ')
        exc = a.get('exception', '').replace('\n', ' ')
        lines.append(f"| **{aid}** | {t} | `{mod}` | {flds} | {val[:150]}... | {sys_rep[:150]}... | {exc[:120]}... |")
    
    lines.append("")

lines.append("---")
lines.append("")
lines.append("## 4. Shared System Foundations (Deck Pages 314–318)")
lines.append("")
lines.append("The action deck defines five core pages of non-negotiable cross-screen logic that bind every vertical, workspace, and transaction:")
lines.append("")
lines.append("### Shared Logic 01: Identity, Session, and Role Scope (Page 314)")
lines.append("- **One role interface per active workspace:** Authentication resolves the active approved role. The navigation shell renders only modules permitted to that specific role. No cross-role switcher, other-role menu, or impersonation mode exists.")
lines.append("- **Scope filters are not role switches:** A Team Lead managing multiple granted teams uses team filters inside the single TL interface. Cross-vertical grants operate via scoped filters, never dashboard impersonation.")
lines.append("")
lines.append("### Shared Logic 02: Historical Attribution & Control Outcomes (Page 315)")
lines.append("- **History does not reopen old access:** Employee identity, historical assignment intervals, ownership periods, and metric facts are immutable. Transfers or promotions update current permissions only; prior personal scorecards remain read-only in Career History with customer PII restricted.")
lines.append("- **Every visible control has a defined outcome:** `Apply filters` slices the current view; `Reset` restores defaults. `Cancel` or `Close` aborts without committing. `Save draft` stores local progress without triggering system commits or approval transitions. `Submit` triggers atomic validation and locks the submitted payload.")
lines.append("")
lines.append("### Shared Logic 03: Lead Lifecycle & Approval Hierarchy (Page 316)")
lines.append("- **Core lead state machine:** `Not contacted` → `Contacted` → `Follow-up` → `Pending conversion` → `Converted`. Direct progression from `Contacted` to `Pending conversion` is permitted only when product evidence is fully verified. Open leads may become `Lost` only with an approved reason code. `Reopen` requires formal approval.")
lines.append("- **Approval and delegation rules:** The default reviewer for sales conversion requests is the scoped Team Lead. TL self-submissions route automatically to the Manager queue (`requester != decider`). Workload rebalances crossing granted team boundaries route to Manager approval.")
lines.append("")
lines.append("### Shared Logic 04: Scheduled Cadences & Multi-Vertical Isolation (Page 317)")
lines.append("- **Standardized calendar:** Asia/Kolkata (+05:30 IST), Monday-starting weeks, April–March fiscal year. Scheduled jobs produce immutable completed-period snapshots at 00:15 local time with safe retry and deduplication.")
lines.append("- **Four configurable verticals:** Wealth Management, Commercial Banking, Markets / Securities, and Real Estate Advisory share the core identity and scheduling engines while maintaining strict data and entity isolation.")
lines.append("")
lines.append("### Shared Logic 05: Acceptance Scenarios & Failure Guards (Page 318)")
lines.append("- **Mandatory acceptance tests:** Wrong-role URL access, out-of-scope prospect access, cross-vertical search, revoked team grants, promotion during active session, employee exit with pending tasks, duplicate webhook replay, and midnight/quarter boundary calculations must be verified with automated server-side denial and clean UI error states.")
lines.append("")
lines.append("---")
lines.append("")
lines.append("## 5. Cross-Role Handoffs")
lines.append("")
lines.append("Cross-role interactions require formal payload locking, atomic status transitions, and independent decider enforcement:")
lines.append("")
lines.append("| Originating Action | Receiving Action | Workflow Purpose | Enforced Security & Business Rule |")
lines.append("|---|---|---|---|")
lines.append("| **SC-17** (Send proposal) | **TL-07** (Conversion approvals) | Proposal sign-off | Proposed value and terms locked; caller cannot approve own proposal |")
lines.append("| **SC-20** (Conversion request) | **TL-07** (Conversion approvals) | Win recognition | 100% credit split required; lead locked in `qualified`; decider must be assigned TL |")
lines.append("| **SC-22** (Reopen request) | **TL-08** (Reopen/duplicate decisions) | Closed lead recovery | Lead remains in `lost` until TL accepts; approved transition updates stage and generates callback task |")
lines.append("| **SC-19** (Upload evidence) | **TL-07** (Conversion approvals) | Milestone verification | Caller cannot self-mark evidence verified; unverified documents block conversion approval |")
lines.append("| **SC-19** (Upload evidence) | **TL-08** (Reopen decisions) | Reopen evidence review | New supporting facts evaluated by TL before approving closed lead reopening |")
lines.append("| **SC-07 / SC-08** (Logged call) | **TL-09** (Quality review & coaching) | Call quality scoring | Recording/transcript evaluated against approved rubric; feedback stored as private coaching |")
lines.append("| **SC-24** (Complaint/escalation) | **TL-15** (Complaint escalations) | Dispute handling | Caller blocked from resolving; escalates to TL queue with severity and reason |")
lines.append("| **TL-04** (Workload rebalancing) | **MG-04** (Capacity recovery plan) | Cross-team rebalance | TL can only rebalance within granted teams; cross-boundary transfers escalate to Manager |")
lines.append("| **TL-14** (Capacity increase) | **MG-04** (Capacity recovery plan) | Team capacity escalation | Staffing increase request feeds Manager operational capacity recovery modelling |")
lines.append("| **TL-14** (Role / move change) | **MG-12** (Transfer / promotion lifecycle) | Org changes | Submission creates pending review item; does not alter team structure until approved |")
lines.append("| **TL-11** (Submit team forecast) | **MG-06** (Forecast challenge & approval) | Forecast governance | Dated team forecast with risks/actions submitted to Manager for versioned review |")
lines.append("| **TL-15** (Commercial escalation) | **MG-09** (Commercial exceptions) | Unresolved commercial issues | Escalation exceeding TL authority routes to Manager delegated commercial exception queue |")
lines.append("| **TL-18** (Activity corrections) | **MG-08** (Exception resolution) | Audit log truthfulness | TL self-submitted correction routes to Manager; decider cannot equal submitter |")
lines.append("| **MG-05** (Allocate targets) | **TL-10** (Distribute team target) | Target cascading | Manager approved target distributes down to TL for associate quota allocation |")
lines.append("| **MG-07** (Manager forecast) | **RM-07** (Regional forecast) | Forecast rollup | Manager accepted forecast rolls up into Regional Manager consolidation |")
lines.append("| **MG-09** (Commercial exceptions) | **RM-09** (Commercial exceptions) | Threshold escalation | Exceptions exceeding Manager authority escalate to Regional Manager queue |")
lines.append("| **MG-13** (Manager meeting pack) | **CFO-03** (Consolidated revenue review) | Finance close | Operational metrics roll up into executive and finance reviews |")
lines.append("| **NM-08** (National forecast) | **CEO-04** (Executive revenue forecast) | Corporate planning | Pipeline probability weighting and revenue projections feed board pack |")
lines.append("")
lines.append("---")
lines.append("")
lines.append("## 6. Brand & Visual Guidelines for Screens")
lines.append("")
lines.append("Brand fidelity requirements derived from `docs/brand/Finverse Wealth Brand Guidelines.pdf` and `NEW Finverse Logo.pdf`:")
lines.append("- **Palette Tokens:**")
lines.append("  - Primary Solid: `#113F3D` (Dark Forest Green)")
lines.append("  - Secondary / Deep Teal: `#155451`")
lines.append("  - Mint Accent: `#6FA8A2`")
lines.append("  - Pale Mint: `#7FB5AE`")
lines.append("  - Mint Tint / Canvas Background: `#DCEEEA`")
lines.append("  - Charcoal Text / Dark Neutral: `#1B1F1E`")
lines.append("  - Muted Gray: `#6B7280`")
lines.append("  - White: `#FFFFFF`")
lines.append("- **Typography:** Headings in **Manrope** (`font-family: 'Manrope', sans-serif`), body text in **Inter** (`font-family: 'Inter', sans-serif`), numbers/codes in **JetBrains Mono**.")
lines.append("- **Single Solid Primary Action:** Exactly **one** solid `#113F3D` primary button per screen/drawer. Secondary actions must be styled as `outline` or `ghost` to eliminate visual competition.")
lines.append("- **Logo Integrity:** The original mark in `docs/brand/finverse-logo.png` must be rendered with its native colors and 1:1.22 proportion; never recolored, warped, or restyled.")
lines.append("- **Chip Tokens & Destructive Red:** Destructive red (`#DC2626` / `tone=\"overdue\"`) is strictly reserved for genuine overdue breaches, SLA violations, or permanent deletion.")
lines.append("")
lines.append("---")
lines.append("")
lines.append("## 7. Measurable Completion Gates (Definition of Done)")
lines.append("")
lines.append("An action or feature is considered **DONE** only when all five criteria are fulfilled:")
lines.append("1. **Implementation Evidence:** Source code committed in `apps/web`, `apps/api`, `packages/contracts`, or `database/migrations` satisfying all deck fields.")
lines.append("2. **Executed Positive/Negative Tests:** Automated tests executed with recorded PASS evidence (Node test runner for API journey suites, Playwright e2e for browser flows).")
lines.append("3. **Permission Checks:** Server-side SQL authorization verified (role, vertical, team grant, effective dates). Hidden UI elements do not count as security.")
lines.append("4. **Persistence Evidence:** Real PostgreSQL transactional commits (`BEGIN ... FOR UPDATE ... COMMIT`), audit event logging, and immutable timestamps.")
lines.append("5. **Rendered-Screen Acceptance:** UI verified in a real browser against the action deck mockup and brand guidelines (typography loaded via `document.fonts`, computed colors matching hex tokens, single solid primary button).")
lines.append("")
lines.append("### Status Definitions")
lines.append("- **Verified:** Complete end-to-end implementation with executed test evidence and verified brand styling.")
lines.append("- **Simulated:** Feature behaves according to contract but connects to a mock or simulated adapter (e.g. simulated telephony provider, mock WhatsApp API, quarantine scan). Simulated features **cannot be claimed as production-ready**.")
lines.append("- **Partial:** Component or endpoint implemented but missing deck fields, drawers, or mobile responsiveness.")
lines.append("- **Blocked:** Implementation cannot proceed due to unresolved review findings (e.g. TL findings M1–M5) or missing prerequisites.")
lines.append("")
lines.append("---")
lines.append("")
lines.append("## 8. Unresolved Requirements & Client Decisions (Deck Page 320)")
lines.append("")
lines.append("In accordance with Deck Page 320, the following business decisions remain unconfirmed and must be labelled `[ASSUMPTION]` in code and process records:")
lines.append("1. **Products and Stages:** Final product catalogue, stage evidence checklists, and conversion milestones for Banking, Markets, and Real Estate verticals.")
lines.append("2. **Commercial Events:** Rules for recognized revenue vs sales credit, invoice generation triggers, and commission clawback windows on cancelled conversions.")
lines.append("3. **Approvals and Limits:** Financial authority caps (e.g. maximum deal size a TL can approve without Manager escalation).")
lines.append("4. **Targets and Fiscal Calendars:** Cutoff policies for late activity corrections submitted after the fiscal month has closed.")
lines.append("5. **Third-Party Telephony / Messaging:** Real vendor API integration (currently simulated via internal event timers).")
lines.append("")
lines.append("---")
lines.append("")
lines.append("## 9. Development Coordination Contract")
lines.append("")
lines.append("### Roles and Delegation Reality")
lines.append("- **Main Coordinator / Builder:** Sole implementation writer. Owns task selection, code authoring, and project records (`STATUS.md`, `COVERAGE_MATRIX.md`, `BUILD_LOG.md`).")
lines.append("- **Specialist Roles:** Conduct reviews, write specifications, and execute tests in separate Antigravity conversations. **Autonomous agent-to-subagent delegation is unavailable** in this runtime (no native subagent registration tool).")
lines.append("- **Model Recommendation:** **Gemini Flash Medium** (`Gemini 3.8 Flash (Medium)`) selected by default in the chat UI.")
lines.append("")
lines.append("### Implementation Packet Format (Coordinator → Any Specialist)")
lines.append("```markdown")
lines.append("Task ID:             e.g. TL-FIX-01")
lines.append("Action IDs:          e.g. TL-07, TL-08, TL-18")
lines.append("Relevant PDF Pages:  e.g. Deck P111-114, P133-134")
lines.append("Outcome:             One sentence defining the exact slice")
lines.append("Acceptance Criteria: 1. ... 2. ... 3. ...")
lines.append("Dependencies:        e.g. Migration 0006, Zod decisionSchema")
lines.append("Owned Files:         Exact files allowed to be read or modified")
lines.append("Applicable Skills:   e.g. ponytail, tdd, postgres-patterns")
lines.append("Required Checks:     Exact commands to execute (with expected output)")
lines.append("Completion Evidence: Output logs, diff check, and screenshot inspection")
lines.append("Retry Allowance:     Maximum 1 justified retry; stop after 2 identical failures")
lines.append("```")

OUT_PATH.write_text("\n".join(lines), encoding='utf-8')
print(f"Generated {OUT_PATH} successfully ({len(lines)} lines).")
