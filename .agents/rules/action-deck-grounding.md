# Action Deck Grounding & Continuous Memory Update Protocol

## Core Policy: Absolute Visual & Functional Grounding

Every agent working on Finverse CRM must adhere to these non-negotiable rules. No agent may invent, simplify, strip down, or approximate dashboard screens, forms, or role workflows.

### 1. Mandatory Grounding Before Writing Code
Before implementing or modifying ANY screen, dashboard, drawer, or action:
1. **Query the Requirements Knowledge Graph:**
   `& ".\.venv-graphify\Scripts\graphify.exe" query "<Action ID or Role Dashboard>" --graph graphify-requirements/graph.json`
2. **Inspect the Canonical Action Deck Screen (`docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf`):**
   - Cross-reference the exact page number (e.g. SC: P044..P098, TL: P099..P134, MG: P135..P162, Vertical Gallery: P036).
   - Visually extract all fields, zones, micro-interactions, metrics, and guidance cards. Summaries guide navigation, but the **actual PDF screen is the ground truth**.

### 2. Mandatory Dashboard Anatomy & Detailing
Every role dashboard across all 4 verticals (Wealth, Banking, Markets, Real Estate) must implement the complete, authentic Action Deck detailing:

1. **Top Bar & Contract Sub-banner:**
   - Institutional breadcrumb (e.g., `Finverse CRM / Sales caller`, `Finverse CRM / Team leader`, `Finverse CRM / Manager`).
   - Authentic preview contract notice: `DESIGN PREVIEW · SYNTHETIC DATA · AUTHORIZATION SHOWN AS A PRODUCT CONTRACT`.
2. **Workspace Header & Scope Badge:**
   - Eyebrow with action code and title (e.g. `PERSONAL WORKSPACE / BANKING`, `TL-01 / TEAM OVERVIEW`, `MG-01 / MANAGER OVERVIEW`).
   - Dynamic vertical scope badge with shield icon: `Banking scope`, `Wealth scope`, `Markets / Trading scope`, or `Real Estate scope` (never hardcoded to Wealth).
   - Top action buttons and quick guidance modal trigger.
3. **Sub-navigation Tabs (when present in Action Deck):**
   - E.g. for Sales Caller: `My day` | `Lead inbox` | `Pipeline` | `Performance`.
4. **Hero Priority Zone (Left Card):**
   - Authentic `#113F3D` brand dark teal container with `#FFFFFF` text.
   - `YOUR PRIORITY` label, phone icon, `Next best action` headline, actionable guidance, and single solid action button (`Open work area ->`).
   - Footer: `As of 09:42 IST · Assigned scope only`.
5. **Metric & Operating Signal Cards (Center & Right):**
   - 4-metric grid with authentic domain denominators (e.g. for Banking: `Contacted / eligible`, `Wins / target`, `Due today`, `Overdue`).
   - `OPERATING SIGNAL`: `Verified activity trend` with 7-day sparkline SVG, percentage change, and `Verified activity and approved outcomes only` disclaimer.
   - `NEEDS ATTENTION`: Breakdown items with high-contrast numbers (`03 Promised callbacks`, `08 Uncontacted today`, `04 Replies to review`) and navigational arrows.
6. **Assigned Work / Commitments Table:**
   - Table columns: `LEAD ID` | `PROSPECT` | `CONTEXT` | `DUE` with clean status badges and view links.
7. **Right-Rail Three-Card Guidance Stack (TL, Manager, and Action Screens):**
   - `HOW THIS WORKS / Your next steps` (numbered sequence: 01, 02, 03).
   - `WHEN A CHECK FAILS` (specific security/authorization boundary consequence).
   - `PERMISSION & EVIDENCE` (immutable audit trail and scope derivation rules).
8. **Bottom Authorization Footer & Single Solid Primary Button:**
   - Shield icon with `Current role and scope checked on submit`.
   - Single solid primary button rule (`Continue ->` or `Open work area ->`).

### 3. Vertical Authenticity (Zero Generic Placeholders)
For the Banking vertical (and other non-wealth verticals):
- **Pipeline Stages:** `New` -> `Eligibility` -> `Documents` -> `Sanction` -> `Disbursal` (terminal won).
- **Products:** `Corporate Term Loan`, `V1 Current Account`, `Working Capital Facility`, `Trade Finance & Escrow`.
- **Intake:** `Branch Intake`, `Corporate Portal`, `Relationship Manager Referral`, `Website`, `Employee referral`.
- **Loss Reasons:** `Credit rejected`, `CIBIL / score below threshold`, `Insufficient collateral`, `Pricing / interest rate`, etc.
- **Labels & Tone:** Credit Inbox, Disbursal Target, Sanction Pipeline, Loan Facility.

### 4. Continuous Memory & Graph Updates
Every completed slice must update:
1. `docs/process/STATUS.md` (Current checkpoint and verified evidence).
2. `docs/process/BUILD_LOG.md` (Executed steps with exact commands).
3. `docs/process/COVERAGE_MATRIX.md` (Role and action compliance matrix).
4. Deterministic Graphify refresh:
   - `& ".\.venv-graphify\Scripts\python.exe" scripts/build_requirements_graph.py`
   - `& ".\.venv-graphify\Scripts\graphify.exe" extract . --code-only`
