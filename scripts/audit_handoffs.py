import json

with open("docs/product/action_catalogue_v2.json", "r", encoding="utf-8") as f:
    cat = json.load(f)

for a in cat:
    if a["id"] in ["MG-03", "MG-04", "MG-08", "MG-09", "MG-12", "TL-04", "TL-07", "TL-11", "TL-14", "TL-15", "TL-18"]:
        print(f"=== {a['id']} ({a['role']}): {a.get('title')} [{a.get('module')}] ===")
        print("Steps:", a.get("steps"))
        print("Validation:", a.get("validation"))
        print("System:", a.get("system"))
        print("Exception:", a.get("exception"))
        print()
