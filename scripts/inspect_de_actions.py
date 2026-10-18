import json

with open("docs/product/action_catalogue_v2.json", "r", encoding="utf-8") as f:
    data = json.load(f)

de_actions = [item for item in data if str(item.get("id", "")).startswith("DE-")]
print(f"Total DE actions: {len(de_actions)}")
for a in de_actions:
    print(f"\n=======================================================")
    print(f"Action: {a.get('id')} - {a.get('title')}")
    print(json.dumps(a, indent=2))
