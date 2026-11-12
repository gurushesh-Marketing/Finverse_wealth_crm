# Master Design System Specification — Finverse CRM v2

**Document Status:** Canonical Design Specification  
**Version:** 2.0.0  
**Effective Date:** 2026-10-06  
**Master Brand Reference:** `docs/brand/Finverse Wealth Brand Guidelines.pdf` (10 Pages, SHA-256: `02809e9c...`)  
**Authentic Logo Master:** `docs/brand/NEW Finverse Logo.pdf` (SHA-256: `9b604b04...`), `docs/brand/finverse-logo.png`  
**Reference Action Deck:** `docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf` (Pages P001–P005, P313–P315)  

---

## 1. Brand Identity & Design Philosophy

Finverse CRM v2 embodies the visual identity of a premier financial advisory and institutional wealth institution. The interface conveys **precision, authority, quiet luxury, and operational clarity**:
- **Calm and Focused:** The interface avoids noisy, oversaturated colors, gimmicky animations, or high-friction modal clutter. Information density is high but comfortable, prioritizing scannability during long frontline shifts.
- **Single Institutional Core:** Across all four verticals (Wealth Management, Commercial Banking, Markets & Trading, Real Estate Advisory), the design system enforces visual consistency. A team leader transitioning between Wealth and Real Estate encounters identical component semantics, interaction grammar, and spatial rhythm.
- **Authenticity First:** The brand mark is sacred. Synthetic demo presentation data is clearly signposted, but brand elements and typography are pixel-exact to corporate guidelines.

---

## 2. Authentic Brand Assets & Logo Specification

### 2.1 Logo Rules & Geometry
- **Original Artwork Asset:** `docs/brand/finverse-logo.png` (raster) and `docs/brand/NEW Finverse Logo.pdf` (vector master).
- **Aspect Ratio:** Strictly locked at `1:1.22` (width to height proportional bounding box).
- **Absolute Invariant (`[AGENTS.md, Deck P001]`):** **NEVER recolor the logo.** The original gold-teal emblem and brand lockup must never be filtered, inverted, converted to monochrome, or tinted with CSS.
- **Clear Space:** Minimum clear space surrounding the logo is equal to 50% of the emblem's height ($0.5H$) on all sides. No typography, grid lines, or navigational badges may encroach upon this exclusion zone.
- **Prohibited Alterations:**
  - Do NOT apply drop shadows, outer glows, or bevel effects.
  - Do NOT stretch, skew, rotate, or compress the logo aspect ratio.
  - Do NOT place the logo on busy photographic backgrounds without an approved `#FFFFFF` or `#113F3D` container.

---

## 3. Color Architecture & Design Tokens

The color palette is strictly governed by the approved brand tokens (`[Deck P003, Brand Guidelines P003]`):

### 3.1 Core Palette Tokens

| Token Name | Hex Code | HSL Value | Semantic Role & Architectural Usage |
|---|---|---|---|
| `--color-primary` | `#113F3D` | `hsl(176, 58%, 16%)` | **Deep Forest Spruce.** Master brand color; used for the primary shell header, active navigation states, and the single solid primary action button per screen. |
| `--color-primary-dark` | `#155451` | `hsl(176, 60%, 21%)` | **Deep Teal.** Surface highlight, table header active highlights, and primary button hover states. |
| `--color-accent-mint` | `#6FA8A2` | `hsl(174, 25%, 55%)` | **Mint Accent.** Interactive borders, active tab underlines, focused input rings, and progress metric fills. |
| `--color-mint-pale` | `#7FB5AE` | `hsl(172, 28%, 60%)` | **Pale Mint.** Secondary badges, selected row borders, and subtle graphical accents. |
| `--color-mint-tint` | `#DCEEEA` | `hsl(168, 38%, 90%)` | **Mint Tint.** Soft background fills for success/active chips, summary card icon backdrops, and table row selection highlights. |
| `--color-charcoal` | `#1B1F1E` | `hsl(165, 8%, 12%)` | **Charcoal Body Text.** Master typography color for primary headings, table values, and high-emphasis labels. |
| `--color-gray-muted` | `#6B7280` | `hsl(220, 9%, 46%)` | **Muted Neutral.** Secondary text, helper descriptions, table column headers, and breadcrumb trails. |
| `--color-border-subtle` | `#E5E7EB` | `hsl(220, 13%, 91%)` | **Dividers & Borders.** Standard card borders, table dividers, input borders, and modal separation lines. |
| `--color-surface-bg` | `#F9FAFB` | `hsl(210, 20%, 98%)` | **Canvas Background.** Global application page canvas behind modular white cards. |
| `--color-surface-card` | `#FFFFFF` | `hsl(0, 0%, 100%)` | **Surface Background.** Main content cards, drawer backgrounds, dropdown menus, and modal dialogs. |

### 3.2 Semantic & Status Tokens

| Semantic State | Base Hex | Light Background | Border Token | Usage Context |
|---|---|---|---|---|
| **Success / Converted** | `#0D9488` | `#F0FDF4` | `#BBF7D0` | Lead converted, payment matched, period closed, target achieved. |
| **Warning / Due Soon** | `#D97706` | `#FFFBEB` | `#FDE68A` | Task due today, unallocated remainder warning, forecast challenge pending. |
| **Danger / Overdue SLA** | `#DC2626` | `#FEF2F2` | `#FECACA` | Overdue follow-up breach, lost lead, duplicate rejected, exception denied. |
| **Info / Active Pipeline** | `#2563EB` | `#EFF6FF` | `#BFDBFE` | General workflow status, document pending review, system notification. |

---

## 4. Typography System

Typography balances institutional authority with optimal tabular legibility:

```
Headings:      Manrope (600 Semi-Bold, 700 Bold, 800 Extra-Bold)
Body & UI:     Inter (400 Regular, 500 Medium, 600 Semi-Bold)
Numbers & IDs: JetBrains Mono (400 Regular, 500 Medium)
```

### 4.1 Type Scale & Application Rules

| Level | Font Family | Size / Line-Height | Weight | Tracking | Primary Usage |
|---|---|---|---|---|---|
| `Display 1` | Manrope | `32px / 40px` | 800 | `-0.02em` | Executive Overview hero metrics, login title. |
| `Heading 1` | Manrope | `24px / 32px` | 700 | `-0.015em` | Workspace module headers, main screen titles. |
| `Heading 2` | Manrope | `18px / 26px` | 600 | `-0.01em` | Section headings, card headers, modal titles. |
| `Heading 3` | Manrope | `15px / 22px` | 600 | `0` | Drawer section titles, sub-card headers. |
| `Body Large` | Inter | `16px / 24px` | 400, 500 | `0` | Lead synopsis, rich text notes, email/WhatsApp content. |
| `Body Base` | Inter | `14px / 20px` | 400, 500 | `0` | Standard UI labels, form controls, table cells, comments. |
| `Body Small` | Inter | `12px / 16px` | 400, 500 | `0` | Helper text, secondary timestamps, badge text. |
| `Caption` | Inter | `11px / 14px` | 600 | `+0.04em` | Column headers (all caps), micro-labels, status tags. |
| `Monospace` | JetBrains Mono | `13px / 18px` | 500 | `0` | Lead IDs (`FV-1042`), monetary values (`₹75,00,000`), phone numbers (`+91 98***`), audit hashes. |

---

## 5. Visual Rules & Component Invariants

### 5.1 The Single Solid Primary Button Rule (`[Deck P004, P315]`)
- **Strict Invariant:** There must be **EXACTLY ONE** solid `#113F3D` primary action button per visible screen/viewport.
- **Rationale:** Eliminate cognitive fatigue for frontline operators processing hundreds of leads per day. The user must instinctively know the next progressive forward action.
- **Secondary Actions:** All other actions on the same viewport (e.g., *Cancel*, *Back*, *Save Draft*, *Clear Filters*, *Export CSV*, *View History*) must use **Outline**, **Ghost**, or **Muted Secondary** treatments:
  - *Outline Button:* Transparent background, `1px solid #D1D5DB`, text `#374151`, hover `#F3F4F6`.
  - *Ghost Button:* Transparent background, zero border, text `#6B7280`, hover `#F3F4F6`.
  - *Destructive Button:* Outline or soft tinted red (`#FEE2E2` fill, text `#DC2626`). A solid red button is permitted only inside a confirmation modal where it is the sole primary action.

### 5.2 Component Library Standards (Tailwind v4 + shadcn Base UI)
All components inherit centralized design tokens:
1. **Cards & Panels (`Card`, `CardHeader`, `CardContent`):**
   - Background: `#FFFFFF`.
   - Border: `1px solid #E5E7EB`.
   - Border Radius: `8px` (`rounded-lg`).
   - Shadow: `0 1px 3px 0 rgba(0, 0, 0, 0.05)` (subtle institutional elevation; no heavy drop shadows).
2. **Data Tables (`Table`, `TableHeader`, `TableRow`, `TableCell`):**
   - Header Row: Background `#F9FAFB`, border bottom `1px solid #E5E7EB`, text `#6B7280` in `11px` uppercase tracking.
   - Table Rows: Height `48px`, border bottom `1px solid #F3F4F6`, hover background `#F9FAFB`.
   - Numerical Columns: Right-aligned, formatted in `JetBrains Mono`.
3. **Badges & Status Chips (`Badge`):**
   - Height: `22px`, horizontal padding `8px`, border radius `9999px` (`rounded-full`).
   - Typography: `11px` Inter font-weight 600.
   - Status Variants: Green (`#DCEEEA` fill, `#113F3D` text), Amber (`#FEF3C7` fill, `#92400E` text), Red (`#FEE2E2` fill, `#991B1B` text).
4. **Slide-Over Drawers (`DrawerPanel`):**
   - Entry: Slides from right edge over canvas with a 30% black backdrop (`rgba(0, 0, 0, 0.3)`).
   - Width: `480px` on desktop, `100vw` on mobile.
   - Sticky Header & Footer: Drawer body scrolls independently. Footer houses the single solid primary action and secondary cancel button.
5. **Form Controls (`Input`, `Select`, `Textarea`):**
   - Height: `38px` (`Input`, `Select`), border radius `6px`.
   - Border: `1px solid #D1D5DB`, focus ring `2px solid #113F3D` with `1px` offset.
   - Error State: Border `#DC2626`, focus ring `#DC2626`, inline helper message below control in `#DC2626`.

---

## 6. Layout Architecture & Spatial Grid

### 6.1 Desktop Grid (1440px / 1280px Standards)
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header Bar: 64px height (Logo, Employee Profile, Role Tag, Time Asia/Kolkata)│
├───────────────┬──────────────────────────────────────────────────────────────┤
│ Navigation    │ Summary KPI Ribbon: 4 Metric Cards (88px height)             │
│ Sidebar:      ├──────────────────────────────────────────────────────────────┤
│ 260px fixed   │ Filter Bar: Search, Stage, Source, Date Range, Views         │
│ width         ├──────────────────────────────────────────────────────────────┤
│ (Role-only    │ Primary Content Area: Data Grid / Stage Columns / Detail     │
│ modules)      │ (min-height calc(100vh - 200px), scrollable)                 │
│               │                                                              │
└───────────────┴──────────────────────────────────────────────────────────────┘
```
- **Navigation Sidebar:** 260px width, sticky full height, background `#113F3D` or `#FFFFFF` (high contrast institutional mode). Houses only the server-authorized modules for the active role.
- **Main Container:** Padding `24px` (`p-6`), max-width `1600px`.
- **KPI Ribbon:** Grid with 4 equal-width cards displaying Target Pace %, Numerator/Denominator, Trend Delta, and SLA compliance.

### 6.2 Mobile Key Tasks Layout (`[Deck P313]`)
Mobile layouts do **not** attempt to shrink complex desktop grids. Instead, mobile provides dedicated ergonomic task surfaces:
- **Target Viewports:** 375px (iPhone standard) to 412px (Android standard).
- **Zero Horizontal Scroll:** All mobile views strictly enforce `overflow-x: hidden`. Tables transform into card stacks with essential lead details.
- **Caller Mobile Task Surface:**
  - Full-width call list sorted by overdue priority.
  - Direct thumb-friendly call trigger (`tel:` or VoIP dialer).
  - Bottom sheet wrap-up drawer popping up immediately after call completion for one-tap disposition.
- **Leadership Mobile Approval Surface:**
  - Card-based approval deck. Each card shows conversion value, caller name, customer profile, and attached evidence thumbnail.
  - Two unambiguous thumb buttons at the bottom: Outline Return vs Solid `#113F3D` Approve.

---

## 7. State System & User Feedback

In accordance with Deck Page 315 (`Standard failure and empty states`):

1. **Labelled Skeleton Loaders:**
   - Shimmering rectangular skeletons matching exact component dimensions (`CardSkeleton`, `TableSkeleton`, `DrawerSkeleton`).
   - Skeletons display a subtle status label: *"Loading team backlog..."* or *"Fetching statutory ledger..."* so the operator knows what data is loading.
2. **Explicit Empty States:**
   - Empty states explicitly distinguish between:
     - **No Records Exist:** *"No leads in unassigned queue. New intake batches will appear here."*
     - **Active Filter Suppression:** *"0 leads match stage 'Qualified' and source 'Website'. [Clear Filters]"*
3. **Form Validation & Draft Preservation:**
   - Client-side validation triggers on blur; server errors map back to specific fields.
   - Form inputs are cached locally in session state (`sessionStorage` draft) so a transient network error or tab switch never loses caller notes or suitability answers.
4. **Access Revocation & Session Timeout:**
   - If an employee's assignment expires mid-session or role is changed, the UI immediately displays a non-dismissible banner: *"Access privileges updated. Redirecting to your active workspace..."* Sensitive customer data on screen is purged from DOM memory before redirecting to `/login`.
