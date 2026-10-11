import json
from pathlib import Path
import pypdf

ROOT_DIR = Path(__file__).resolve().parent.parent
cat_file = ROOT_DIR / "docs" / "product" / "action_catalogue_v2.json"
pdf_file = ROOT_DIR / "docs" / "reference" / "NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf"

cat = json.loads(cat_file.read_text(encoding="utf-8"))
actions = {a["id"]: a for a in cat}

reader = pypdf.PdfReader(str(pdf_file))

nm_ids = [f"NM-{i:02d}" for i in range(1, 12)]

for idx, nid in enumerate(nm_ids):
    screen_p = 181 + (idx * 2)
    contract_p = screen_p + 1

    print("=" * 80)
    print(f"ACTION {nid} | Screen Page P{screen_p} | Contract Page P{contract_p}")
    print("=" * 80)

    act = actions.get(nid, {})
    print(f"TITLE: {act.get('title')}")
    print(f"MODULE: {act.get('module')}")
    print(f"KIND: {act.get('kind')}")
    print(f"STEPS: {json.dumps(act.get('steps', []), indent=2)}")
    print(f"VALIDATION: {json.dumps(act.get('validation', []), indent=2)}")
    print(f"SYSTEM COMMIT: {json.dumps(act.get('system', []), indent=2)}")
    print(f"EXCEPTION HANDLING: {json.dumps(act.get('exception', []), indent=2)}")

    # Extract contract text from PDF
    contract_text = reader.pages[contract_p - 1].extract_text()
    print("\n--- PHYSICAL DECK CONTRACT TEXT (PAGE P%d) ---" % contract_p)
    print(contract_text.strip())
    print("\n")
