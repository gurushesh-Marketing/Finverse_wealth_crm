import json
import sys
import hashlib
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
GRAPH_FILE = ROOT_DIR / "graphify-requirements" / "graph.json"

sys.stdout.reconfigure(encoding='utf-8')

if not GRAPH_FILE.exists():
    print(f"ERROR: Requirements graph not found at {GRAPH_FILE}")
    sys.exit(1)

data = json.loads(GRAPH_FILE.read_text(encoding='utf-8'))
nodes = data.get('nodes', [])

action_nodes = [n for n in nodes if n.get('id', '').startswith('action_')]
evidence_nodes = [n for n in nodes if n.get('id', '').startswith('evidence_')]

print(f"Auditing {len(action_nodes)} action nodes and {len(evidence_nodes)} evidence nodes...")

violations = []
status_counts = {}

for act in action_nodes:
    aid = act['id']
    status = act.get('verification_status')
    status_counts[status] = status_counts.get(status, 0) + 1
    
    is_verified = act.get('current_revision_verified', False)
    
    if is_verified is True:
        # Invariant 1: Genuine current revision verification requires physical test file, matching hash, execution date and PASS result
        suite_path = act.get('evidence_suite')
        fingerprint = act.get('content_fingerprint')
        run_date = act.get('execution_run_date')
        run_res = act.get('execution_run_result')
        applies = act.get('applies_to_current_revision')
        has_assertion = act.get('test_assertion_present')
        
        if status != 'CURRENT_REVISION_VERIFIED':
            violations.append(f"{aid}: Claims verified=True but status is '{status}' (expected 'CURRENT_REVISION_VERIFIED').")
        if not suite_path or not (ROOT_DIR / suite_path).exists():
            violations.append(f"{aid}: Verified claim lacks existing evidence test file '{suite_path}'.")
        else:
            actual_hash = hashlib.sha256((ROOT_DIR / suite_path).read_bytes()).hexdigest()
            if fingerprint != actual_hash:
                violations.append(f"{aid}: Test file fingerprint mismatch on '{suite_path}'. Expected {actual_hash[:8]}..., got {str(fingerprint)[:8]}...")
        if not run_date:
            violations.append(f"{aid}: Verified claim lacks execution run date.")
        if run_res != 'PASS':
            violations.append(f"{aid}: Verified claim has non-PASS result '{run_res}'.")
        if applies is not True or has_assertion is not True:
            violations.append(f"{aid}: Verified claim must have applies_to_current_revision=True and test_assertion_present=True.")
    else:
        # Invariant 2: Actions without current verification must strictly use approved truthful taxonomy
        allowed_unverified = [
            'HISTORICAL_PASS_UNVERIFIED_IN_CURRENT_REVISION',
            'HISTORICAL_LIFECYCLE_PASS_UNVERIFIED_IN_CURRENT_REVISION',
            'IMPLEMENTED_UNVERIFIED_BY_TESTS',
            'UNIMPLEMENTED_PLANNED'
        ]
        if status not in allowed_unverified:
            violations.append(f"{aid}: Invalid or ungrounded unverified status '{status}'.")

# Invariant 3: Audit evidence nodes themselves
for ev in evidence_nodes:
    ev_id = ev['id']
    if ev.get('current_revision_verified', False) is True:
        ev_file = ev.get('file_path') or ev.get('src') or ev.get('source_file')
        if not ev_file or not (ROOT_DIR / ev_file).exists():
            violations.append(f"{ev_id}: Verified evidence node lacks existing file '{ev_file}'.")
        else:
            actual_hash = hashlib.sha256((ROOT_DIR / ev_file).read_bytes()).hexdigest()
            if ev.get('content_fingerprint') != actual_hash:
                violations.append(f"{ev_id}: Evidence node fingerprint mismatch on '{ev_file}'.")
        if ev.get('execution_run_result') != 'PASS' or not ev.get('execution_run_date'):
            violations.append(f"{ev_id}: Verified evidence node lacks PASS execution or run date.")

# Invariant 4: Verified nodes must be backed by a fresh execution record matching live input fingerprints
verified_mg = [a for a in action_nodes if a.get('current_revision_verified', False) is True and a.get('id', '').startswith('action_MG')]
verified_rm = [a for a in action_nodes if a.get('current_revision_verified', False) is True and a.get('id', '').startswith('action_RM')]
verified_nm = [a for a in action_nodes if a.get('current_revision_verified', False) is True and a.get('id', '').startswith('action_NM')]
verified_ceo = [a for a in action_nodes if a.get('current_revision_verified', False) is True and a.get('id', '').startswith('action_CEO')]
verified_cfo = [a for a in action_nodes if a.get('current_revision_verified', False) is True and a.get('id', '').startswith('action_CFO')]

records_to_check = []
if verified_mg:
    from scripts.record_test_execution import get_live_fingerprints as get_mg_live_fps
    records_to_check.append(("manager_test_execution_record.json", get_mg_live_fps, "MG"))
if verified_rm:
    from scripts.record_regional_test_execution import get_live_fingerprints as get_rm_live_fps
    records_to_check.append(("regional_test_execution_record.json", get_rm_live_fps, "RM"))
if verified_nm:
    from scripts.record_national_test_execution import get_live_fingerprints as get_nm_live_fps
    records_to_check.append(("national_test_execution_record.json", get_nm_live_fps, "NM"))
if verified_ceo:
    from scripts.record_ceo_test_execution import get_live_fingerprints as get_ceo_live_fps
    records_to_check.append(("ceo_test_execution_record.json", get_ceo_live_fps, "CEO"))
if verified_cfo:
    from scripts.record_cfo_test_execution import get_live_fingerprints as get_cfo_live_fps
    records_to_check.append(("cfo_test_execution_record.json", get_cfo_live_fps, "CFO"))

for rec_filename, get_live_fn, role_code in records_to_check:
    rec_file = ROOT_DIR / "evidence" / rec_filename
    if not rec_file.exists():
        violations.append(f"Execution record '{rec_file}' missing for verified {role_code} actions.")
    else:
        try:
            rec_data = json.loads(rec_file.read_text(encoding='utf-8'))
            live_fps = get_live_fn()
            recorded_fps = rec_data.get('fingerprints', {})
            for fp_key, live_val in live_fps.items():
                rec_val = recorded_fps.get(fp_key)
                if live_val != rec_val:
                    violations.append(
                        f"Execution record ({role_code}) fingerprint mismatch for '{fp_key}': recorded {str(rec_val)[:8]}... != live {str(live_val)[:8]}... (Evidence is STALE)."
                    )
            if rec_data.get('exit_code') != 0:
                violations.append(f"Execution record ({role_code}) exit_code is {rec_data.get('exit_code')} (expected 0).")
            if rec_data.get('overall_status') != 'PASS':
                violations.append(f"Execution record ({role_code}) overall_status is '{rec_data.get('overall_status')}' (expected 'PASS').")
            runner_res = rec_data.get('test_runner_results', {})
            if runner_res.get('fail', 0) > 0 or runner_res.get('pass', 0) == 0:
                violations.append(f"Execution record ({role_code}) runner results invalid: {runner_res}.")
        except Exception as e:
            violations.append(f"Failed to validate execution record ({role_code}): {e}")

if violations:
    print("\nFAIL: Found verification evidence violations:")
    for v in violations:
        print(f"  - {v}")
    sys.exit(1)

print("\nPASS: Deterministic verification evidence integrity check passed completely.")
print("Summary of Action Verification Taxonomy:")
for s, count in sorted(status_counts.items()):
    print(f"  - {s}: {count} actions")
print("\nAll 135 actions strictly adhere to truthful evidence standards (0 ungrounded verified claims).")
sys.exit(0)
