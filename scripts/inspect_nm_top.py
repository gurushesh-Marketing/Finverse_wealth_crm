from inspect_nm_actions import actions, reader

for idx in [0, 1]:
    nid = f"NM-{idx+1:02d}"
    sp = 181 + idx * 2
    cp = sp + 1
    act = actions.get(nid, {})
    print(f"=== {nid}: {act.get('title')} (Screen P{sp}, Contract P{cp}) ===")
    print("Steps:", act.get('steps'))
    print("Validation:", act.get('validation'))
    print("System:", act.get('system'))
    print("Exception:", act.get('exception'))
    print("Deck Text:\n", reader.pages[cp - 1].extract_text().strip())
    print("\n" + "="*60 + "\n")
