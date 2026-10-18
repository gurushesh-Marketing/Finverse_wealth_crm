import json
from pathlib import Path
import re

ROOT_DIR = Path(__file__).resolve().parent.parent
specs = json.loads((ROOT_DIR / "evidence" / "cfo_deck_specs.json").read_text(encoding='utf-8'))

for k in sorted(specs.keys()):
    v = specs[k]
    s_text = v['screen_text']
    p_text = v['spec_text']

    # Extract breadcrumb / title
    lines = [l.strip() for l in s_text.split('\n') if l.strip()]
    header_lines = lines[:8]

    # Find all card headers / uppercase labels
    cards = []
    for line in lines:
        if line.isupper() and len(line) > 3 and len(line) < 50:
            if not any(x in line for x in ['FINVERSE', 'CRM INTERFACE', 'PROPOSAL', 'SEP 2026', 'PAGE']):
                cards.append(line)

    # Find HOW THIS WORKS, WHEN A CHECK FAILS, PERMISSION & EVIDENCE from spec_text
    rail_how = ""
    rail_fails = ""
    rail_perm = ""

    if "BEFORE IT CAN PROCEED" in p_text:
        rail_how = p_text.split("BEFORE IT CAN PROCEED")[1].split("SYSTEM COMMIT")[0].strip()
    if "IF IT CANNOT COMPLETE" in p_text:
        rail_fails = p_text.split("IF IT CANNOT COMPLETE")[1].strip()
    if "PERMISSION & EVIDENCE" in p_text:
        rail_perm = p_text.split("PERMISSION & EVIDENCE")[1].strip()
    elif "SYSTEM COMMIT" in p_text and "REPORTING CONSEQUENCE" in p_text:
        rail_perm = p_text.split("SYSTEM COMMIT")[1].split("REPORTING CONSEQUENCE")[0].strip()

    print(f"=== {k} (Screen P{v['screen_page']} / Spec P{v['spec_page']}) ===")
    print(f"Header: {' | '.join(header_lines[:4])}")
    print(f"Detected Sections/Cards: {cards[:10]}")
    print(f"Rule Before Proceed: {rail_how[:150]}...")
    print(f"Rule If Cannot Complete: {rail_fails[:150]}...")
    print()
