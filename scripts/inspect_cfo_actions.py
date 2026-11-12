import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
cat_file = ROOT_DIR / "docs" / "product" / "action_catalogue_v2.json"
data = json.loads(cat_file.read_text(encoding='utf-8'))

cfo_actions = [a for a in data if a.get('id', '').startswith('CFO')]
print(f"Total CFO actions in catalogue: {len(cfo_actions)}\n")

for a in cfo_actions:
    aid = a['id']
    title = a.get('title')
    module = a.get('module')
    kind = a.get('kind')
    fields = a.get('fields', [])
    steps = a.get('steps', [])
    validation = a.get('validation', [])
    print(f"[{aid}] {title}")
    print(f"  Module: {module} | Kind: {kind}")
    print(f"  Fields: {fields}")
    print(f"  Validation: {validation}")
    print(f"  Steps: {steps}\n")
