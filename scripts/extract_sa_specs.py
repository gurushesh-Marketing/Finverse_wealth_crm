import json

with open('docs/product/action_catalogue_v2.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

sa_actions = [a for a in data if a.get('id', '').startswith('SA-')]
print(f"Total SA actions found: {len(sa_actions)}")

for a in sa_actions:
    print("=" * 80)
    print(f"ACTION: {a.get('id')} - {a.get('title')} ({a.get('module')})")
    print(f"Kind: {a.get('kind')}")
    print(f"Fields: {json.dumps(a.get('fields', []), indent=2)}")
    print(f"Steps: {json.dumps(a.get('steps', []), indent=2)}")
    print(f"Validation: {json.dumps(a.get('validation', []), indent=2)}")
    print(f"System: {json.dumps(a.get('system', []), indent=2)}")
    print(f"Report: {json.dumps(a.get('report', []), indent=2)}")
    print(f"Exception: {json.dumps(a.get('exception', []), indent=2)}")
