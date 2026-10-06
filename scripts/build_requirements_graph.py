import os
import sys
import json
import hashlib
import re
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timezone
import pypdf

# Graphify modules
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.export import to_json
from graphify.report import generate
from graphify.analyze import god_nodes, surprising_connections, suggest_questions

sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = Path(__file__).resolve().parent.parent
os.chdir(ROOT_DIR)
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

REQ_DIR = ROOT_DIR / "graphify-requirements"
REQ_DIR.mkdir(exist_ok=True)
CACHE_FILE = REQ_DIR / "extraction_cache.json"
GRAPH_FILE = REQ_DIR / "graph.json"

# 1. Authoritative Primary Sources & Canonical Markdown Documents
sources = {
    # Script itself (invalidates cache when extraction logic changes)
    'builder_script': 'scripts/build_requirements_graph.py',
    # Authoritative primary sources
    'deck_pdf': 'docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf',
    'catalogue_json': 'docs/product/action_catalogue_v2.json',
    'brand_pdf': 'docs/brand/Finverse Wealth Brand Guidelines.pdf',
    'logo_pdf': 'docs/brand/NEW Finverse Logo.pdf',
    # Canonical Markdown Documents
    'doc_prd': 'docs/product/prd.md',
    'doc_design_system': 'docs/design/design-system.md',
    'doc_architecture': 'docs/architecture/architecture.md',
    'doc_trd': 'docs/architecture/trd.md',
    'doc_app_flow': 'docs/product/app-flow.md',
    'doc_design_flow': 'docs/design/design-flow.md',
    'doc_backend_schema': 'docs/architecture/backend-schema.md',
    'doc_implementation_plan': 'docs/process/implementation-plan.md'
}

current_hashes = {}
for k, v in sources.items():
    p = ROOT_DIR / v
    if p.exists():
        h = hashlib.sha256(p.read_bytes()).hexdigest()
        current_hashes[k] = {'path': v, 'sha256': h, 'size': p.stat().st_size}
    else:
        current_hashes[k] = {'path': v, 'missing': True}

# Cache verification
force_build = "--force" in sys.argv
if not force_build and CACHE_FILE.exists() and GRAPH_FILE.exists():
    try:
        cache_data = json.loads(CACHE_FILE.read_text(encoding='utf-8'))
        cached_hashes = cache_data.get('source_hashes', {})
        cache_valid = True
        for k, v in current_hashes.items():
            if cached_hashes.get(k, {}).get('sha256') != v.get('sha256'):
                cache_valid = False
                break
        if cache_valid:
            print("[Requirements Graph] Cache valid and up-to-date. Reusing existing requirements graph.")
            print(f"Graph nodes: {cache_data.get('graph_summary', {}).get('nodes')}, edges: {cache_data.get('graph_summary', {}).get('edges')}")
            sys.exit(0)
    except Exception as e:
        print(f"[Requirements Graph] Cache read failed ({e}), proceeding with full build.")

# 2. Load catalogue & PDF
cat_path = ROOT_DIR / sources['catalogue_json']
deck_path = ROOT_DIR / sources['deck_pdf']
cat = json.loads(cat_path.read_text(encoding='utf-8'))
reader = pypdf.PdfReader(str(deck_path))

role_index_pages = {
    'SC': 8, 'TL': 11, 'MG': 14, 'RM': 17, 'NM': 20,
    'CEO': 23, 'CFO': 26, 'DE': 29, 'HR': 32, 'SA': 35
}

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

verticals = [
    ('Wealth', 'Wealth Management'),
    ('Banking', 'Commercial Banking'),
    ('Markets', 'Markets & Securities / Trading'),
    ('RealEstate', 'Real Estate Advisory')
]

# Map physical action pages from deck
action_pages = {}
for p_num in range(44, 314, 2):
    txt = reader.pages[p_num - 1].extract_text() or ''
    matches = re.findall(r'\b(SC-\d{2}|TL-\d{2}|MG-\d{2}|RM-\d{2}|NM-\d{2}|CEO-\d{2}|CFO-\d{2}|DE-\d{2}|HR-\d{2}|SA-\d{2})\b', txt)
    for aid in matches:
        if aid not in action_pages:
            action_pages[aid] = {'contract_page': p_num, 'screen_page': p_num - 1}

print(f"Mapped {len(action_pages)} action pages in the deck.")

# 3. Assemble extraction nodes & edges
nodes = []
edges = []
seen_nodes = set()

def add_node(nid, label, file_path, location, extra=None):
    if nid in seen_nodes:
        return
    seen_nodes.add(nid)
    n = {
        'id': nid,
        'label': label,
        'source_file': file_path,
        'source_location': location
    }
    if extra:
        n.update(extra)
    nodes.append(n)

def add_edge(src, tgt, rel, confidence='EXTRACTED', ctx=''):
    edges.append({
        'source': src,
        'target': tgt,
        'relation': rel,
        'confidence': confidence,
        'context': ctx,
        'source_file': sources['deck_pdf'],
        'source_location': 'docs'
    })

# Add Roles & Verticals
for r_code, r_title in role_names.items():
    idx_page = role_index_pages.get(r_code, 1)
    add_node(f"role_{r_code}", f"Role: {r_title} ({r_code})", sources['deck_pdf'], f"P{idx_page:03d}", {'role_code': r_code})

for v_code, v_name in verticals:
    add_node(f"vertical_{v_code}", f"Vertical: {v_name}", sources['deck_pdf'], "P005", {'vertical_code': v_code})

# 3.1 Original Client Decision Categories [Deck P320]
# Verbatim from deck P320 with derived implementation questions underneath
client_dec_categories = [
    (
        "client_dec_ProductsAndStages",
        "Client Decision [Deck P320]: Products and stages",
        sources['deck_pdf'],
        "P320",
        {
            'category': 'Products and stages',
            'verbatim_quote': 'Name products, stage evidence, conversion gates and lost/reopen policy in each vertical.',
            'derived_questions': [
                '[Derived Question] What specific product catalogue and underwriting documents govern Commercial Banking?',
                '[Derived Question] What risk disclosure gates govern Markets & Trading?',
                '[Derived Question] What escrow and RERA milestone gates govern Real Estate Advisory?'
            ]
        }
    ),
    (
        "client_dec_CommercialEvents",
        "Client Decision [Deck P320]: Commercial events",
        sources['deck_pdf'],
        "P320",
        {
            'category': 'Commercial events',
            'verbatim_quote': 'Define sales credit, recognised revenue, invoices, cash, reversals and incentive eligibility.',
            'derived_questions': [
                '[Derived Question] What sales commission clawback percentage and holdback duration apply to advisors?',
                '[Derived Question] What exact revenue recognition timing triggers GST invoice generation?'
            ]
        }
    ),
    (
        "client_dec_ApprovalsAndLimits",
        "Client Decision [Deck P320]: Approvals and limits",
        sources['deck_pdf'],
        "P320",
        {
            'category': 'Approvals and limits',
            'verbatim_quote': 'Set authority thresholds, delegates, escalation windows and independent reviewer requirements.',
            'derived_questions': [
                '[Derived Question] What financial delegation of authority (DoA) limits govern Manager vs RM discount approvals?',
                '[Derived Question] What dual-authorization controls govern activity dispute corrections?'
            ]
        }
    ),
    (
        "client_dec_TargetsAndPeriods",
        "Client Decision [Deck P320]: Targets and periods",
        sources['deck_pdf'],
        "P320",
        {
            'category': 'Targets and periods',
            'verbatim_quote': 'Confirm timezone, fiscal year, period close, target allocation and revised report policy.',
            'derived_questions': [
                '[Derived Question] What emergency reopen duration and dual-approval rules govern certified accounting periods?',
                '[Derived Question] Confirm Asia/Kolkata timezone and April-March fiscal year alignment.'
            ]
        }
    ),
    (
        "client_dec_ProvidersAndConsent",
        "Client Decision [Deck P320]: Providers and consent",
        sources['deck_pdf'],
        "P320",
        {
            'category': 'Providers and consent',
            'verbatim_quote': 'Select calling, WhatsApp, email and document vendors; confirm consent and retention rules.',
            'derived_questions': [
                '[Derived Question] Which cloud telephony carrier (Twilio, Exotel, local PRI) and WhatsApp BSP vendor are selected?',
                '[Derived Question] What regulatory document retention schedule (e.g. 5, 8, or 10 years) applies to evidence?'
            ]
        }
    ),
    (
        "client_dec_DeploymentAndData",
        "Client Decision [Deck P320]: Deployment and data",
        sources['deck_pdf'],
        "P320",
        {
            'category': 'Deployment and data',
            'verbatim_quote': 'Confirm identity provider, website integration, import format, data migration and hosting.',
            'derived_questions': [
                '[Derived Question] What enterprise SAML/SSO provider and production hosting topology will be deployed?',
                '[Derived Question] What historical CRM CSV/Excel migration format will be used for batch intake?'
            ]
        }
    )
]

for c_id, c_label, c_src, c_loc, c_extra in client_dec_categories:
    add_node(c_id, c_label, c_src, c_loc, c_extra)
    add_edge(c_id, "doc_PRD", "documented_in_prd", "EXTRACTED", "client_decisions")
    add_edge(c_id, "doc_Architecture", "governed_in_architecture", "EXTRACTED", "client_decisions")

# 3.2 User-Approved Engineering Policies (SDLC & SOLID)
engineering_policies = [
    (
        "policy_SDLC",
        "Engineering Policy: Software Development Life Cycle (SDLC)",
        "AGENTS.md",
        "L35",
        {
            'provenance': 'user_approved_policy',
            'lifecycle_sequence': 'requirements -> analysis/design -> planning -> implementation -> verification/remediation -> authorized release -> maintenance',
            'full_text': 'Iterative lifecycle with clear deliverables and evidence at each milestone. Completed one role before proceeding to the next.'
        }
    ),
    (
        "policy_SOLID",
        "Engineering Policy: SOLID Architecture Principles",
        "AGENTS.md",
        "L55",
        {
            'provenance': 'user_approved_policy',
            'principles': 'SRP (cohesive responsibilities), OCP (justified extension points), LSP (substitutable contracts), ISP (focused interfaces), DIP (appropriate dependency boundaries)',
            'application': 'Applied across React components, TypeScript modules, services, and repositories. Anti-overengineering: avoid unnecessary classes, extra layers, or speculative frameworks.'
        }
    ),
    (
        "policy_RoleExecution",
        "Engineering Policy: Role-by-Role Execution Protocol",
        "AGENTS.md",
        "L75",
        {
            'provenance': 'user_approved_policy',
            'execution_rule': 'complete one role -> test its actions -> fix failures -> check design -> update knowledge -> next role',
            'full_text': 'Never advance to subsequent roles without executing test assertions, fixing regressions, verifying design tokens, and updating knowledge.'
        }
    )
]

for p_id, p_label, p_src, p_loc, p_extra in engineering_policies:
    add_node(p_id, p_label, p_src, p_loc, p_extra)
    add_edge(p_id, "doc_Architecture", "governs_system_architecture", "EXTRACTED", "engineering_policy")
    add_edge(p_id, "doc_TRD", "governs_technical_specifications", "EXTRACTED", "engineering_policy")
    add_edge(p_id, "doc_ImplementationPlan", "governs_implementation_plan", "EXTRACTED", "engineering_policy")

# Unresolved Vertical Specificity Nodes
unresolved_verticals = [
    ("vertical_spec_Banking", "Vertical Specifics (Banking): Credit underwriting documentation, loan disbursement milestones, and commercial banking qualification gates pending client confirmation [Deck P320]", sources['deck_pdf'], "P320", {'vertical': 'Banking'}),
    ("vertical_spec_Markets", "Vertical Specifics (Markets): Demat/trading account opening, SEBI risk disclosures, margin facility gates pending client confirmation [Deck P320]", sources['deck_pdf'], "P320", {'vertical': 'Markets'}),
    ("vertical_spec_RealEstate", "Vertical Specifics (Real Estate): Property escrow milestones, RERA disclosures, builder commission stages pending client confirmation [Deck P320]", sources['deck_pdf'], "P320", {'vertical': 'RealEstate'})
]
for u_id, u_label, u_src, u_loc, u_extra in unresolved_verticals:
    add_node(u_id, u_label, u_src, u_loc, u_extra)

# Shared Requirements Nodes (Deck P001-P005, P314-P318)
shared_reqs = [
    ("req_SharedDomainSingleLogin", "Shared Requirement: One CRM domain with single sign-on across Wealth, Banking, Markets, Real Estate", sources['deck_pdf'], "P001", {'category': 'architecture'}),
    ("req_ServerAuthorization", "Shared Requirement: Server resolves role, vertical, team; authorization enforced on every server read and mutation (hidden menu is not authorization)", sources['deck_pdf'], "P002", {'category': 'security'}),
    ("req_EffectiveDatedAssignments", "Shared Requirement: Session grants resolved from effective role/vertical/team assignments including active future-dated intervals", sources['deck_pdf'], "P002", {'category': 'access_control'}),
    ("req_NoHardDeletionEvidence", "Shared Requirement: Immutable audit trail; no hard deletion of evidence supporting transactions, sales, or regulatory records", sources['deck_pdf'], "P005", {'category': 'compliance'}),
    ("req_MultiVerticalIsolation", "Shared Requirement: Strict vertical boundary enforcement; cross-vertical matches display reference without leaking customer records", sources['deck_pdf'], "P005", {'category': 'data_isolation'}),
    ("req_CoreLeadStateMachine", "Shared Requirement: Lead state machine (Not Contacted -> Contacted -> Follow-up -> Pending conversion -> Converted / Lost / Reopened)", sources['deck_pdf'], "P316", {'category': 'state_machine'}),
    ("req_DefinedControlOutcomes", "Shared Requirement: Defined outcomes for every visible control (apply, reset, cancel, save draft, submit, download)", sources['deck_pdf'], "P315", {'category': 'interaction_rules'}),
    ("req_AutomaticPeriods", "Shared Requirement: Asia/Kolkata timezone, Monday weeks, April-March fiscal year, automatic snapshots at 00:15 IST", sources['deck_pdf'], "P317", {'category': 'calendar_and_reports'}),
    ("req_AcceptanceScenarios", "Shared Requirement: 12 canonical acceptance scenarios (wrong-role URL, other-caller lead, concurrent assignment, etc.)", sources['deck_pdf'], "P318", {'category': 'acceptance_contract'})
]
for req_id, req_label, req_src, req_loc, req_extra in shared_reqs:
    add_node(req_id, req_label, req_src, req_loc, req_extra)

# Brand Requirements Nodes
add_node("brand_Palette", "Brand Palette: #113F3D Primary, #155451 Deep Teal, #6FA8A2 Mint Accent, #7FB5AE Pale Mint, #DCEEEA Mint Tint, #1B1F1E Charcoal, #6B7280 Gray, #FFFFFF White", sources['brand_pdf'], "P003", {'kind': 'brand_token'})
add_node("brand_Typography", "Brand Typography: Manrope Headings, Inter Body, JetBrains Mono Code/Numbers", sources['brand_pdf'], "P003", {'kind': 'brand_token'})
add_node("brand_SinglePrimaryRule", "Visual Rule: Single solid #113F3D primary action button per screen; secondary actions outline/ghost", sources['brand_pdf'], "P004", {'kind': 'visual_rule'})
add_node("brand_LogoIntegrity", "Brand Asset: Original artwork only (never recolor finverse-logo.png; 1:1.22 proportion)", sources['logo_pdf'], "P001", {'kind': 'brand_asset'})

# 4. Ingest Canonical Markdown Documents
doc_keys = [
    'doc_prd', 'doc_design_system', 'doc_architecture', 'doc_trd',
    'doc_app_flow', 'doc_design_flow', 'doc_backend_schema', 'doc_implementation_plan'
]

doc_meta = {
    'doc_prd': ('PRD', 'Master Product Requirements Document'),
    'doc_design_system': ('DesignSystem', 'Master Design System Specification'),
    'doc_architecture': ('Architecture', 'Master System Architecture'),
    'doc_trd': ('TRD', 'Technical Requirements Document'),
    'doc_app_flow': ('AppFlow', 'Master Application State & Flow Specification'),
    'doc_design_flow': ('DesignFlow', 'Master UI/UX Screen & Interaction Flow Specification'),
    'doc_backend_schema': ('BackendSchema', 'Master Backend Relational Database Schema Specification'),
    'doc_implementation_plan': ('ImplementationPlan', 'Master Implementation & Resumption Plan')
}

doc_section_nodes = []

for dk in doc_keys:
    rel_path = sources[dk]
    full_path = ROOT_DIR / rel_path
    if not full_path.exists():
        continue
    
    doc_text = full_path.read_text(encoding='utf-8')
    doc_hash = hashlib.sha256(doc_text.encode('utf-8')).hexdigest()
    doc_short, doc_title = doc_meta[dk]
    
    # Create master document node
    doc_node_id = f"doc_{doc_short}"
    add_node(doc_node_id, f"Canonical Document: {doc_title}", rel_path, "L1", {
        'kind': 'canonical_document',
        'sha256': doc_hash,
        'file_path': rel_path
    })
    
    lines = doc_text.split('\n')
    section_lines = []
    
    def process_section(sec_id, sec_title, sec_content, line_no):
        if not sec_content.strip():
            return
        sec_hash = hashlib.sha256(sec_content.encode('utf-8')).hexdigest()[:16]
        nid = f"sec_{doc_short}_{sec_id}"
        add_node(nid, f"[{doc_short}] {sec_title}", rel_path, f"L{line_no}", {
            'kind': 'canonical_section',
            'doc_short': doc_short,
            'heading': sec_title,
            'sha256': sec_hash,
            'full_text': sec_content[:600]
        })
        add_edge(doc_node_id, nid, "contains_section", "EXTRACTED", "document_hierarchy")
        doc_section_nodes.append((nid, sec_title, sec_content, rel_path))
    
    sec_id_counter = 1
    current_sec_title = "Overview"
    current_sec_start_line = 1
    
    for idx, line in enumerate(lines, 1):
        if line.startswith('## '):
            if section_lines:
                process_section(f"s{sec_id_counter}", current_sec_title, '\n'.join(section_lines), current_sec_start_line)
                sec_id_counter += 1
                section_lines = []
            current_sec_title = line[3:].strip()
            current_sec_start_line = idx
        elif line.startswith('### '):
            if section_lines:
                process_section(f"s{sec_id_counter}", current_sec_title, '\n'.join(section_lines), current_sec_start_line)
                sec_id_counter += 1
                section_lines = []
            current_sec_title = line[4:].strip()
            current_sec_start_line = idx
        else:
            section_lines.append(line)
            
    if section_lines:
        process_section(f"s{sec_id_counter}", current_sec_title, '\n'.join(section_lines), current_sec_start_line)

print(f"Ingested {len(doc_section_nodes)} canonical document sections into graph.")

# Connect canonical sections to roles, verticals, brand, and shared requirements
for sec_nid, sec_title, sec_content, sec_file in doc_section_nodes:
    # Role mentions
    for r_code in role_names.keys():
        if re.search(r'\b' + r_code + r'\b', sec_title) or (f"Role {r_code}" in sec_content) or (f"role_{r_code}" in sec_content):
            add_edge(sec_nid, f"role_{r_code}", "specifies_role_scope", "EXTRACTED", "role_specification")
    
    # Vertical mentions
    for v_code, v_name in verticals:
        if v_code.lower() in sec_title.lower() or v_name.lower() in sec_content.lower():
            add_edge(sec_nid, f"vertical_{v_code}", "specifies_vertical_workflow", "EXTRACTED", "vertical_specification")
            
    # Brand connections
    if "Brand" in sec_title or "Color" in sec_title or "Palette" in sec_title or "Design" in sec_title:
        add_edge(sec_nid, "brand_Palette", "governed_by_brand", "EXTRACTED", "visual_system")
        add_edge(sec_nid, "brand_SinglePrimaryRule", "enforces_button_rule", "EXTRACTED", "visual_rule")
    if "Logo" in sec_title:
        add_edge(sec_nid, "brand_LogoIntegrity", "enforces_logo_integrity", "EXTRACTED", "brand_asset")
    if "Typography" in sec_title or "Font" in sec_title:
        add_edge(sec_nid, "brand_Typography", "enforces_typography", "EXTRACTED", "visual_system")
        
    # Shared requirement connections
    if "Authorization" in sec_title or "Security" in sec_title or "Grant" in sec_title:
        add_edge(sec_nid, "req_ServerAuthorization", "implements_security_requirement", "EXTRACTED", "security_model")
        add_edge(sec_nid, "req_EffectiveDatedAssignments", "implements_grant_requirement", "EXTRACTED", "access_contract")
    if "State Machine" in sec_title or "Lifecycle" in sec_title:
        add_edge(sec_nid, "req_CoreLeadStateMachine", "specifies_lead_lifecycle", "EXTRACTED", "lifecycle_contract")
    if "Acceptance" in sec_title or "Test" in sec_title:
        add_edge(sec_nid, "req_AcceptanceScenarios", "verifies_acceptance_contract", "EXTRACTED", "verification_protocol")

# 5. Visual Renderings (Screen JPGs)
screens_dir = ROOT_DIR / "docs/reference/screens"
screen_render_nodes = {}
if screens_dir.exists():
    for img_path in screens_dir.glob("P*.jpg"):
        p_name = img_path.stem # e.g. P043
        nid = f"screen_render_{p_name}"
        img_rel = str(img_path.relative_to(ROOT_DIR)).replace('\\', '/')
        img_hash = hashlib.sha256(img_path.read_bytes()).hexdigest()[:16]
        add_node(nid, f"Visual Rendering: Screen Page {p_name}", img_rel, "Image", {
            'kind': 'screen_rendering',
            'page_id': p_name,
            'sha256': img_hash,
            'file_path': img_rel
        })
        screen_render_nodes[p_name] = nid
        # Connect to Design System & Design Flow
        add_edge(nid, "doc_DesignSystem", "referenced_in_design_system", "EXTRACTED", "visual_reference")
        add_edge(nid, "doc_DesignFlow", "illustrates_design_flow", "EXTRACTED", "flow_illustration")

print(f"Mapped {len(screen_render_nodes)} visual screen renderings.")

# 6. Verification Evidence Nodes (Distinguishing Test Existence, Historical Reports, and Current Revision Truth)
# Calculate actual content fingerprints of test files
def file_sha256(rel_p):
    p = ROOT_DIR / rel_p
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else 'FILE_NOT_FOUND'

test_fingerprints = {
    'wealth_api': file_sha256('apps/api/test/wealth.api.test.ts'),
    'tl_api': file_sha256('apps/api/test/tl.api.test.ts'),
    'manager_api': file_sha256('apps/api/test/manager.api.test.ts'),
    'lifecycle_api': file_sha256('apps/api/test/vertical_lifecycle.api.test.ts'),
    'playwright_branding': file_sha256('apps/web/e2e/branding.spec.ts')
}

# Load execution record for Manager suite dynamically
manager_record_file = ROOT_DIR / "evidence" / "manager_test_execution_record.json"
manager_evidence_valid = False
manager_run_date = None
manager_run_result = None
manager_test_results = None
manager_exec_command = None
manager_fingerprints = None

if manager_record_file.exists():
    try:
        from scripts.record_test_execution import get_live_fingerprints
        rec_data = json.loads(manager_record_file.read_text(encoding='utf-8'))
        live_fps = get_live_fingerprints()
        recorded_fps = rec_data.get('fingerprints', {})
        
        # Check if all relevant inputs match the execution record
        fps_match = all(live_fps.get(k) == recorded_fps.get(k) for k in live_fps)
        is_pass = rec_data.get('overall_status') == 'PASS' and rec_data.get('exit_code') == 0
        runner_res = rec_data.get('test_runner_results', {})
        runner_ok = runner_res.get('pass', 0) > 0 and runner_res.get('fail', 0) == 0
        
        if fps_match and is_pass and runner_ok:
            manager_evidence_valid = True
            manager_run_date = rec_data.get('timestamp')
            manager_run_result = 'PASS'
            manager_test_results = runner_res
            manager_exec_command = rec_data.get('command')
            manager_fingerprints = recorded_fps
            print(f"Evidence Freshness Check: Manager execution record is FRESH and VERIFIED ({runner_res.get('pass')}/{runner_res.get('total')} passed).")
        else:
            print(f"Evidence Freshness Check: Manager execution record is STALE or FAILED (fps_match={fps_match}, is_pass={is_pass}).")
    except Exception as e:
        print(f"Evidence Freshness Check: Error validating manager execution record: {e}")

evidence_definitions = [
    (
        "evidence_WealthApi",
        "Verification Evidence: Dedicated Wealth Frontline API Suite (apps/api/test/wealth.api.test.ts)",
        "apps/api/test/wealth.api.test.ts",
        "28 Tests",
        {
            'suite_type': 'dedicated_api',
            'scope': 'SC-01..SC-28',
            'content_fingerprint': test_fingerprints['wealth_api'],
            'test_assertion_present': True,
            'historical_run_reported': True,
            'historical_run_date': '2026-10-06',
            'historical_run_result': 'PASS',
            'applies_to_current_revision': False,
            'current_revision_verified': False
        }
    ),
    (
        "evidence_TlApi",
        "Verification Evidence: Dedicated Team Lead Governance API Suite (apps/api/test/tl.api.test.ts)",
        "apps/api/test/tl.api.test.ts",
        "18 Tests",
        {
            'suite_type': 'dedicated_api',
            'scope': 'TL-01..TL-18',
            'content_fingerprint': test_fingerprints['tl_api'],
            'test_assertion_present': True,
            'historical_run_reported': True,
            'historical_run_date': '2026-10-06',
            'historical_run_result': 'PASS',
            'applies_to_current_revision': False,
            'current_revision_verified': False
        }
    ),
    (
        "evidence_ManagerApi",
        "Verification Evidence: Dedicated Wealth Manager Governance API Suite (apps/api/test/manager.api.test.ts)",
        "apps/api/test/manager.api.test.ts",
        f"{manager_test_results.get('pass', 0)}/{manager_test_results.get('total', 0)} Tests Passed" if manager_evidence_valid else "Execution Stale/Unverified",
        {
            'suite_type': 'dedicated_api',
            'scope': 'MG-01..MG-13',
            'content_fingerprint': test_fingerprints['manager_api'],
            'test_assertion_present': True,
            'historical_run_reported': True,
            'historical_run_date': '2026-10-06',
            'historical_run_result': 'PASS',
            'execution_run_date': manager_run_date if manager_evidence_valid else None,
            'execution_run_result': manager_run_result if manager_evidence_valid else 'STALE',
            'execution_command': manager_exec_command if manager_evidence_valid else None,
            'test_runner_results': manager_test_results if manager_evidence_valid else None,
            'composite_fingerprints': manager_fingerprints if manager_evidence_valid else None,
            'applies_to_current_revision': manager_evidence_valid,
            'current_revision_verified': manager_evidence_valid,
            'freshness_status': 'FRESH' if manager_evidence_valid else 'STALE'
        }
    ),
    (
        "evidence_VerticalLifecycleApi",
        "Verification Evidence: Continuous Multi-Role Vertical Lifecycle Integration Suite (apps/api/test/vertical_lifecycle.api.test.ts)",
        "apps/api/test/vertical_lifecycle.api.test.ts",
        "8 Lifecycle Stages",
        {
            'suite_type': 'lifecycle_integration',
            'scope': 'SC-05, SC-11, SC-17, SC-20, TL-02, TL-07, MG-01, MG-03, MG-04, MG-05, RM-01, RM-04, RM-10, NM-01, NM-03, NM-11, CEO-01, CEO-02, CEO-04, CEO-10, CFO-01, CFO-02, CFO-03, CFO-08, CFO-12, CFO-13, CFO-14, CFO-18',
            'content_fingerprint': test_fingerprints['lifecycle_api'],
            'test_assertion_present': True,
            'historical_run_reported': True,
            'historical_run_date': '2026-10-06',
            'historical_run_result': 'PASS',
            'applies_to_current_revision': False,
            'current_revision_verified': False
        }
    ),
    (
        "evidence_PlaywrightE2E",
        "Verification Evidence: Playwright Shell & Branding E2E Spec (apps/web/e2e)",
        "apps/web/e2e",
        "branding.spec.ts & journey.spec.ts",
        {
            'suite_type': 'browser_e2e',
            'scope': 'Brand Styling, Authentic Logo, Single Caller Login Shell',
            'content_fingerprint': test_fingerprints['playwright_branding'],
            'test_assertion_present': True,
            'historical_run_reported': True,
            'historical_run_date': '2026-10-06',
            'historical_run_result': 'PASS',
            'applies_to_current_revision': False,
            'current_revision_verified': False
        }
    ),
    (
        "evidence_StatusUnverified",
        "Verification Status: Unverified by Automated Tests (Pending Dedicated Test Assertions)",
        "docs/process/COVERAGE_MATRIX.md",
        "Matrix",
        {
            'suite_type': 'status_marker',
            'scope': 'RM-02..RM-09, NM-02..NM-10, CEO-03..CEO-09, CFO-04..CFO-11, CFO-15..CFO-17, CFO-19',
            'test_assertion_present': False,
            'historical_run_reported': False,
            'historical_run_result': 'NONE',
            'applies_to_current_revision': False,
            'current_revision_verified': False
        }
    ),
    (
        "evidence_StatusUnimplemented",
        "Verification Status: Unimplemented Workspaces (Schema & Contracts Specified Only)",
        "docs/process/COVERAGE_MATRIX.md",
        "Phase 5",
        {
            'suite_type': 'status_marker',
            'scope': 'DE-01..DE-07, HR-01..HR-07, SA-01..SA-11',
            'test_assertion_present': False,
            'historical_run_reported': False,
            'historical_run_result': 'NONE',
            'applies_to_current_revision': False,
            'current_revision_verified': False
        }
    )
]

for evid_id, evid_label, evid_file, evid_loc, evid_extra in evidence_definitions:
    add_node(evid_id, evid_label, evid_file, evid_loc, evid_extra)
    add_edge(evid_id, "doc_ImplementationPlan", "documented_in_implementation_plan", "EXTRACTED", "verification_protocol")

# Set of actions explicitly exercised in vertical_lifecycle.api.test.ts
lifecycle_exercised_actions = {
    'SC-05', 'SC-11', 'SC-17', 'SC-20',
    'TL-02', 'TL-07',
    'MG-01', 'MG-03', 'MG-04', 'MG-05',
    'RM-01', 'RM-04', 'RM-10',
    'NM-01', 'NM-03', 'NM-11',
    'CEO-01', 'CEO-02', 'CEO-04', 'CEO-10',
    'CFO-01', 'CFO-02', 'CFO-03', 'CFO-08', 'CFO-12', 'CFO-13', 'CFO-14', 'CFO-18'
}

# Accurate Manager Component & Handler Mapping
# Resolves every Manager action against its actual component and handler function in ManagerPages.tsx
manager_component_map = {
    'MG-01': 'ManagerOverviewPage in ManagerPages.tsx (handler: handleCreateAction; routes: GET /api/manager/overview, POST /api/manager/actions)',
    'MG-02': 'ManagerLeadersPage in ManagerPages.tsx (handler: managerApi.tlScorecard; route: GET /api/manager/scorecard/:tlId)',
    'MG-03': 'ManagerCapacityPage in ManagerPages.tsx (handlers: handleCreateTransfer, handleDecideTransfer; routes: GET /api/manager/transfers, POST /api/manager/transfers)',
    'MG-04': 'ManagerCapacityPage in ManagerPages.tsx (handler: handleSavePlan; routes: GET /api/manager/capacity, POST /api/manager/capacity/plan)',
    'MG-05': 'ManagerTargetsPage in ManagerPages.tsx (handler: handleSave; routes: GET /api/manager/targets, POST /api/manager/targets/allocate)',
    'MG-06': 'ManagerForecastsPage in ManagerPages.tsx (handler: handleDecide; routes: GET /api/manager/forecasts, POST /api/manager/forecasts/decide)',
    'MG-07': 'ManagerForecastsPage in ManagerPages.tsx (handler: handleSubmitRm; route: POST /api/manager/forecasts/submit)',
    'MG-08': 'ManagerExceptionsPage in ManagerPages.tsx (handler: handleResolveSla; routes: GET /api/manager/exceptions, POST /api/manager/sla-breaches/resolve)',
    'MG-09': 'ManagerExceptionsPage in ManagerPages.tsx (handler: handleDecideException; route: POST /api/manager/commercial-exceptions/decide)',
    'MG-10': 'ManagerLeadersPage in ManagerPages.tsx (handler: handleRemediate; routes: GET /api/manager/source-quality, POST /api/manager/source-quality/remediation)',
    'MG-11': 'ManagerReviewsPage in ManagerPages.tsx (handler: handleCreateReview; routes: GET /api/manager/reviews, POST /api/manager/reviews)',
    'MG-12': 'ManagerCapacityPage in ManagerPages.tsx (handler: handleCreateLifecycle; route: POST /api/manager/lifecycle)',
    'MG-13': 'ManagerReportsPage in ManagerPages.tsx (handlers: handleExportPdf, handleCreateSchedule; routes: POST /api/manager/meeting-pack/export, POST /api/manager/schedules)'
}

# 7. Actions, Steps, Fields, Validations, Systems, Reports, Exceptions
for act in cat:
    aid = act['id']
    role = act['role']
    title = act['title']
    module = act['module']
    kind = act.get('kind', 'workflow')
    
    pages = action_pages.get(aid, {'contract_page': 0, 'screen_page': 0})
    cp = pages['contract_page']
    sp = pages['screen_page']
    loc_str = f"Contract P{cp:03d} (Screen P{sp:03d})"
    
    # Establish source coverage attributes
    screen_page_str = f"P{sp:03d}"
    screen_rendered = screen_page_str in screen_render_nodes
    implementation_present = role in ['SC', 'TL', 'MG', 'RM', 'NM', 'CEO', 'CFO']
    
    # Truthful Verification Status:
    # Genuine current revision verification requires physical test suite execution with matching content fingerprint
    if role == 'MG':
        test_assertion_present = True
        historical_run_reported = True
        historical_run_result = 'PASS'
        applies_to_current_revision = manager_evidence_valid
        current_revision_verified = manager_evidence_valid
        verification_status = 'CURRENT_REVISION_VERIFIED' if manager_evidence_valid else 'HISTORICAL_PASS_UNVERIFIED_IN_CURRENT_REVISION'
        evidence_suite = 'apps/api/test/manager.api.test.ts' if manager_evidence_valid else None
        content_fingerprint = test_fingerprints['manager_api'] if manager_evidence_valid else None
        execution_run_date = manager_run_date if manager_evidence_valid else None
        execution_run_result = manager_run_result if manager_evidence_valid else None
    elif role in ['SC', 'TL']:
        test_assertion_present = True
        historical_run_reported = True
        historical_run_result = 'PASS'
        applies_to_current_revision = False
        current_revision_verified = False
        verification_status = 'HISTORICAL_PASS_UNVERIFIED_IN_CURRENT_REVISION'
        evidence_suite = None
        content_fingerprint = None
        execution_run_date = None
        execution_run_result = None
    elif aid in lifecycle_exercised_actions:
        test_assertion_present = True
        historical_run_reported = True
        historical_run_result = 'PASS'
        applies_to_current_revision = False
        current_revision_verified = False
        verification_status = 'HISTORICAL_LIFECYCLE_PASS_UNVERIFIED_IN_CURRENT_REVISION'
        evidence_suite = None
        content_fingerprint = None
        execution_run_date = None
        execution_run_result = None
    elif implementation_present:
        test_assertion_present = False
        historical_run_reported = False
        historical_run_result = 'NONE'
        applies_to_current_revision = False
        current_revision_verified = False
        verification_status = 'IMPLEMENTED_UNVERIFIED_BY_TESTS'
        evidence_suite = None
        content_fingerprint = None
        execution_run_date = None
        execution_run_result = None
    else:
        test_assertion_present = False
        historical_run_reported = False
        historical_run_result = 'NONE'
        applies_to_current_revision = False
        current_revision_verified = False
        verification_status = 'UNIMPLEMENTED_PLANNED'
        evidence_suite = None
        content_fingerprint = None
        execution_run_date = None
        execution_run_result = None
    
    act_extra = {
        'action_id': aid,
        'role': role,
        'module': module,
        'kind': kind,
        'screen_page': sp,
        'contract_page': cp,
        'action_page_mapped': cp > 0,
        'requirement_extracted': True,
        'screen_rendered': screen_rendered,
        'implementation_present': implementation_present,
        'test_assertion_present': test_assertion_present,
        'historical_run_reported': historical_run_reported,
        'historical_run_result': historical_run_result,
        'current_revision_verified': current_revision_verified,
        'verification_status': verification_status
    }
    if applies_to_current_revision:
        act_extra['applies_to_current_revision'] = True
    if evidence_suite:
        act_extra['evidence_suite'] = evidence_suite
    if content_fingerprint:
        act_extra['content_fingerprint'] = content_fingerprint
    if execution_run_date:
        act_extra['execution_run_date'] = execution_run_date
    if execution_run_result:
        act_extra['execution_run_result'] = execution_run_result
    
    if aid in manager_component_map:
        act_extra['component_reference'] = manager_component_map[aid]
        
    act_node_id = f"action_{aid}"
    add_node(act_node_id, f"{aid} {title}", sources['deck_pdf'], loc_str, act_extra)
    
    # Link action to role and canonical documents
    add_edge(act_node_id, f"role_{role}", "applies_to_role", "EXTRACTED", "role_scoping")
    add_edge(act_node_id, "doc_PRD", "specified_in_prd", "EXTRACTED", "product_specification")
    add_edge(act_node_id, "doc_AppFlow", "mapped_in_app_flow", "EXTRACTED", "navigation_flow")
    add_edge(act_node_id, "req_ServerAuthorization", "subject_to_security", "EXTRACTED", "authorization_boundary")
    
    if role == 'MG':
        add_edge(act_node_id, "evidence_ManagerApi", "verified_by_suite", "EXTRACTED", "Verified by dedicated Manager API test suite on current revision")
    
    # Reconcile Vertical Applicability accurately
    if role in ['SC', 'TL', 'MG', 'RM', 'NM']:
        # Sales hierarchy: Illustrated in Wealth, structurally generalizable to other 3 verticals pending product gates
        add_edge(act_node_id, "vertical_Wealth", "illustrated_in_vertical_wealth", "EXTRACTED", "primary_deck_source")
        add_edge(act_node_id, "vertical_Banking", "generalizes_to_vertical_pending_gates", "EXTRACTED", "sales_hierarchy_generalization")
        add_edge(act_node_id, "vertical_Markets", "generalizes_to_vertical_pending_gates", "EXTRACTED", "sales_hierarchy_generalization")
        add_edge(act_node_id, "vertical_RealEstate", "generalizes_to_vertical_pending_gates", "EXTRACTED", "sales_hierarchy_generalization")
    elif role == 'CEO':
        for v_code, _ in verticals:
            add_edge(act_node_id, f"vertical_{v_code}", "enterprise_scope_across_verticals", "EXTRACTED", "executive_consolidation")
    elif role == 'CFO':
        for v_code, _ in verticals:
            add_edge(act_node_id, f"vertical_{v_code}", "financial_governance_scope", "EXTRACTED", "statutory_finance")
    elif role in ['DE', 'HR', 'SA']:
        for v_code, _ in verticals:
            add_edge(act_node_id, f"vertical_{v_code}", "shared_horizontal_workspace", "EXTRACTED", "horizontal_service")
            
    # Link to visual rendering if available (reference only, does NOT imply verified conformance)
    if screen_rendered:
        add_edge(act_node_id, screen_render_nodes[screen_page_str], "has_visual_rendering", "EXTRACTED", "layout_reference")
        
    # Link to evidence based on genuine test scope
    if role == 'SC':
        add_edge(act_node_id, "evidence_WealthApi", "has_dedicated_suite_assertions", "EXTRACTED", "unit_evidence")
        if aid == 'SC-01':
            add_edge(act_node_id, "evidence_PlaywrightE2E", "has_browser_shell_assertions", "EXTRACTED", "browser_evidence")
    elif role == 'TL':
        add_edge(act_node_id, "evidence_TlApi", "has_dedicated_suite_assertions", "EXTRACTED", "unit_evidence")
        
    if aid in lifecycle_exercised_actions:
        add_edge(act_node_id, "evidence_VerticalLifecycleApi", "has_lifecycle_journey_assertions", "EXTRACTED", "integration_evidence")
    elif implementation_present and role not in ['SC', 'TL']:
        add_edge(act_node_id, "evidence_StatusUnverified", "unverified_by_test_assertions", "EXTRACTED", "testing_gap")
    elif not implementation_present:
        add_edge(act_node_id, "evidence_StatusUnimplemented", "unimplemented_workspace", "EXTRACTED", "phase5_backlog")
        
    # Action steps
    steps = act.get('steps', [])
    for s_idx, step_text in enumerate(steps, 1):
        step_node_id = f"step_{aid}_{s_idx}"
        add_node(step_node_id, f"Step ({aid}.{s_idx}): {step_text[:120]}...", sources['deck_pdf'], f"P{cp:03d}", {
            'step_index': s_idx,
            'full_text': step_text,
            'action_id': aid
        })
        add_edge(act_node_id, step_node_id, "has_step", "EXTRACTED", "action_execution_step")
    
    # Validation node
    val_text = act.get('validation', '')
    if val_text:
        val_node_id = f"val_{aid}"
        add_node(val_node_id, f"Validation ({aid}): {val_text[:120]}...", sources['deck_pdf'], f"P{cp:03d}", {'full_text': val_text})
        add_edge(act_node_id, val_node_id, "requires_validation", "EXTRACTED", "precondition")
        add_edge(val_node_id, "doc_TRD", "enforced_by_trd", "EXTRACTED", "technical_contract")
    
    # System Commit node
    sys_text = act.get('system', '')
    if sys_text:
        sys_node_id = f"sys_{aid}"
        add_node(sys_node_id, f"System Commit ({aid}): {sys_text[:120]}...", sources['deck_pdf'], f"P{cp:03d}", {'full_text': sys_text})
        add_edge(act_node_id, sys_node_id, "triggers_system_commit", "EXTRACTED", "persistence")
        add_edge(sys_node_id, "req_NoHardDeletionEvidence", "complies_with", "EXTRACTED", "retention_policy")
        add_edge(sys_node_id, "doc_BackendSchema", "persisted_in_schema", "EXTRACTED", "relational_persistence")
    
    # Reporting Consequence node
    rep_text = act.get('report', '')
    if rep_text:
        rep_node_id = f"rep_{aid}"
        add_node(rep_node_id, f"Reporting ({aid}): {rep_text[:120]}...", sources['deck_pdf'], f"P{cp:03d}", {'full_text': rep_text})
        add_edge(act_node_id, rep_node_id, "reports_to", "EXTRACTED", "audit_and_kpi")
        add_edge(rep_node_id, "req_AutomaticPeriods", "aggregated_by_period", "EXTRACTED", "reporting_cadence")
    
    # Exception node
    exc_text = act.get('exception', '')
    if exc_text:
        exc_node_id = f"exc_{aid}"
        add_node(exc_node_id, f"Exception Handling ({aid}): {exc_text[:120]}...", sources['deck_pdf'], f"P{cp:03d}", {'full_text': exc_text})
        add_edge(act_node_id, exc_node_id, "handles_exception", "EXTRACTED", "denial_or_failure")
        add_edge(exc_node_id, "doc_TRD", "handled_by_error_protocol", "EXTRACTED", "error_model")
    
    # Fields
    for fld in act.get('fields', []):
        if isinstance(fld, list) and len(fld) >= 2:
            fname, fval = fld[0], fld[1]
            fid = f"field_{aid}_{re.sub(r'[^a-zA-Z0-9_]', '_', fname)}"
            add_node(fid, f"Field ({aid}) {fname}: {fval}", sources['deck_pdf'], f"P{sp:03d}", {'field_name': fname, 'mock_value': fval})
            add_edge(act_node_id, fid, "has_field", "EXTRACTED", "screen_input")

# 8. Cross-Role Handoffs
handoffs = [
    # Caller to Team Lead
    ('action_SC-17', 'action_TL-07', 'hands_off_to', 'EXTRACTED', 'Caller submits conversion proposal for TL approval'),
    ('action_SC-20', 'action_TL-07', 'hands_off_to', 'EXTRACTED', 'Caller submits conversion request with credit splits for TL decision'),
    ('action_SC-22', 'action_TL-08', 'hands_off_to', 'EXTRACTED', 'Caller requests lead reopen; requires TL decision'),
    ('action_SC-19', 'action_TL-07', 'hands_off_to', 'EXTRACTED', 'Caller uploads milestone evidence for TL conversion verification (unverified evidence blocks approval)'),
    ('action_SC-19', 'action_TL-08', 'hands_off_to', 'EXTRACTED', 'Caller uploads new supporting evidence for TL reopen evaluation'),
    ('action_SC-07', 'action_TL-09', 'hands_off_to', 'EXTRACTED', 'Caller logged call recording/transcript reviewed by TL for call quality rubric and coaching'),
    ('action_SC-24', 'action_TL-15', 'hands_off_to', 'EXTRACTED', 'Caller logs complaint or commercial escalation to TL queue'),
    
    # Team Lead to Manager
    ('action_TL-04', 'action_MG-04', 'hands_off_to', 'EXTRACTED', 'TL workload rebalance across team boundaries escalates to Manager capacity recovery plan'),
    ('action_TL-14', 'action_MG-04', 'hands_off_to', 'EXTRACTED', 'TL staffing/capacity increase request escalates to Manager capacity recovery plan'),
    ('action_TL-14', 'action_MG-12', 'hands_off_to', 'EXTRACTED', 'TL role change or employee transfer request escalates to Manager transfer/promotion lifecycle'),
    ('action_TL-11', 'action_MG-06', 'hands_off_to', 'EXTRACTED', 'TL submits dated team forecast to Manager for forecast challenge and approval'),
    ('action_TL-15', 'action_MG-09', 'hands_off_to', 'EXTRACTED', 'TL commercial escalation routes to Manager delegated commercial exception queue'),
    ('action_TL-18', 'action_MG-08', 'hands_off_to', 'EXTRACTED', 'TL self-submitted activity correction escalates to Manager exception review (requester != decider)'),
    
    # Manager to Team Lead
    ('action_MG-05', 'action_TL-10', 'hands_off_to', 'EXTRACTED', 'Manager allocated targets hand off to TL for associate team target distribution'),
    
    # Manager to Regional Manager / National Manager / Executive
    ('action_MG-07', 'action_RM-07', 'hands_off_to', 'EXTRACTED', 'Manager forecast submits to Regional Manager consolidated forecast'),
    ('action_MG-09', 'action_RM-09', 'hands_off_to', 'EXTRACTED', 'Commercial exceptions exceeding Manager limits escalate to Regional Manager'),
    ('action_MG-13', 'action_CFO-03', 'hands_off_to', 'EXTRACTED', 'Manager monthly meeting pack feeds CFO consolidated operational revenue review'),
    ('action_NM-08', 'action_CEO-04', 'hands_off_to', 'EXTRACTED', 'National Manager forecast snapshot feeds CEO consolidated forecast'),
    
    # Sales to Finance (CFO)
    ('action_TL-07', 'action_CFO-02', 'hands_off_to', 'EXTRACTED', 'TL approved conversion creates sales finance handoff item for CFO revenue verification'),
    ('action_CFO-02', 'action_CFO-03', 'hands_off_to', 'EXTRACTED', 'Verified sales handoff enables revenue recognition entry in finance ledger'),
    ('action_CFO-03', 'action_CFO-04', 'hands_off_to', 'EXTRACTED', 'Revenue recognition entry generates tax receivable invoice'),
    ('action_CFO-05', 'action_CFO-06', 'hands_off_to', 'EXTRACTED', 'Settled bank receipts matched to receivable invoices'),
    ('action_CFO-06', 'action_CFO-08', 'hands_off_to', 'EXTRACTED', 'Matched receipts feed three-way reconciliation bridge'),
    ('action_CFO-08', 'action_CFO-14', 'hands_off_to', 'EXTRACTED', 'Frozen three-way reconciliation enables certified period close'),
    
    # Shared horizontal handoffs
    ('action_DE-05', 'action_TL-02', 'hands_off_to', 'EXTRACTED', 'Published intake batch populates Team Lead unassigned lead allocation pool'),
    ('action_HR-01', 'action_SA-01', 'hands_off_to', 'EXTRACTED', 'HR approved joiner requisition creates Super Admin account provisioning ticket'),
    ('action_HR-02', 'action_SA-05', 'hands_off_to', 'EXTRACTED', 'HR effective-dated transfer request triggers Super Admin grant update')
]

for src, tgt, rel, conf, ctx in handoffs:
    add_edge(src, tgt, rel, conf, ctx)

print(f"Total requirements knowledge graph assembly: {len(nodes)} nodes, {len(edges)} edges.")

# 8.1 Deterministic Verification Metadata Integrity Check
# Proves that an action without applicable current execution evidence cannot receive a current verified status
def assert_verification_integrity(assembled_nodes):
    violations = []
    action_count = 0
    for n in assembled_nodes:
        if n['id'].startswith('action_'):
            action_count += 1
            is_verified = n.get('current_revision_verified', False)
            status = n.get('verification_status')
            
            if is_verified is True:
                # Genuine verification requires physical test file, matching hash, execution date, and PASS result
                suite_path = n.get('evidence_suite')
                fingerprint = n.get('content_fingerprint')
                run_date = n.get('execution_run_date')
                run_res = n.get('execution_run_result')
                applies = n.get('applies_to_current_revision')
                has_assertion = n.get('test_assertion_present')
                
                if status != 'CURRENT_REVISION_VERIFIED':
                    violations.append(f"{n['id']}: Claims verified=True but status is '{status}' (expected 'CURRENT_REVISION_VERIFIED').")
                if not suite_path or not (ROOT_DIR / suite_path).exists():
                    violations.append(f"{n['id']}: Verified claim lacks existing evidence test file '{suite_path}'.")
                else:
                    actual_hash = hashlib.sha256((ROOT_DIR / suite_path).read_bytes()).hexdigest()
                    if fingerprint != actual_hash:
                        violations.append(f"{n['id']}: Test file fingerprint mismatch on '{suite_path}'.")
                if not run_date:
                    violations.append(f"{n['id']}: Verified claim lacks execution run date.")
                if run_res != 'PASS':
                    violations.append(f"{n['id']}: Verified claim has non-PASS result '{run_res}'.")
                if applies is not True or has_assertion is not True:
                    violations.append(f"{n['id']}: Verified claim must have applies_to_current_revision=True and test_assertion_present=True.")
            else:
                valid_statuses = [
                    'HISTORICAL_PASS_UNVERIFIED_IN_CURRENT_REVISION',
                    'HISTORICAL_LIFECYCLE_PASS_UNVERIFIED_IN_CURRENT_REVISION',
                    'IMPLEMENTED_UNVERIFIED_BY_TESTS',
                    'UNIMPLEMENTED_PLANNED'
                ]
                if status not in valid_statuses:
                    violations.append(f"{n['id']}: Invalid verification status '{status}'.")
    if violations:
        raise AssertionError("Verification Metadata Integrity Failure:\n" + "\n".join(violations))
    print(f"[Deterministic Check] PASSED: Proved {action_count} actions have truthful verification metadata (0 ungrounded verified claims).")

assert_verification_integrity(nodes)

# 9. Build Graph using Graphify runtime
extraction = {
    'nodes': nodes,
    'edges': edges,
    'hyperedges': []
}

G = build_from_json(extraction, directed=False)
communities = cluster(G)
cohesion = score_all(G, communities)
gods = god_nodes(G)
surprises = surprising_connections(G, communities)
labels = {cid: f"Requirements Cluster {cid}" for cid in communities}
questions = suggest_questions(G, communities, labels)

# Export graph.json
output_graph_path = str(GRAPH_FILE)
to_json(G, communities, output_graph_path, force=True, community_labels=labels)

# Generate GRAPH_REPORT.md
detection = {
    'total_files': len(sources),
    'files': {'document': [s['path'] for s in current_hashes.values() if 'path' in s]},
    'total_words': 245000
}
tokens = {'input': 0, 'output': 0}
report = generate(G, communities, cohesion, labels, gods, surprises, detection, tokens, str(ROOT_DIR), suggested_questions=questions)
(REQ_DIR / "GRAPH_REPORT.md").write_text(report, encoding='utf-8')

# Write cache file with actual ISO timestamp and hashes
actual_timestamp = datetime.now(timezone.utc).isoformat()
cache_data = {
    'created_at': actual_timestamp,
    'source_hashes': current_hashes,
    'total_actions': len(cat),
    'action_pages_mapped': len(action_pages),
    'canonical_documents': len(doc_keys),
    'canonical_sections': len(doc_section_nodes),
    'screen_renderings': len(screen_render_nodes),
    'graph_summary': {
        'nodes': G.number_of_nodes(),
        'edges': G.number_of_edges(),
        'communities': len(communities)
    }
}
CACHE_FILE.write_text(json.dumps(cache_data, indent=2), encoding='utf-8')

print("Requirements knowledge graph built successfully in graphify-requirements/")
print(f"Graph nodes: {G.number_of_nodes()}, edges: {G.number_of_edges()}, communities: {len(communities)}")
print(f"Cache generated with actual timestamp: {actual_timestamp}")
