import json

with open("docs/product/action_catalogue_v2.json", "r", encoding="utf-8") as f:
    cat = json.load(f)

actions = {a["id"]: a for a in cat}
check_ids = ["MG-03", "MG-04", "MG-05", "MG-06", "MG-07", "MG-08", "MG-09", "MG-10", "MG-12", "TL-07", "TL-08", "TL-09", "TL-10", "TL-11", "TL-14", "TL-15", "TL-18", "SC-17", "SC-18", "SC-19", "SC-20"]
for cid in check_ids:
    a = actions.get(cid)
    if a:
        print(f"=== {a['id']} ({a['role']}): {a.get('title')} [{a.get('module')}] ===")
        print("Steps:", a.get("steps"))
        print("Validation:", a.get("validation"))
        print("System:", a.get("system"))
        print("Exception:", a.get("exception"))
        print()
