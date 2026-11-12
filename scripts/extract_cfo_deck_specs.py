import json
from pathlib import Path
import pypdf

ROOT_DIR = Path(__file__).resolve().parent.parent
pdf_file = ROOT_DIR / "docs" / "reference" / "NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf"

reader = pypdf.PdfReader(str(pdf_file))

specs = {}
for idx in range(19):
    action_num = idx + 1
    action_id = f"CFO-{action_num:02d}"
    screen_page = 225 + (idx * 2)
    spec_page = screen_page + 1

    # extract spec page text (even page)
    p_text = reader.pages[spec_page - 1].extract_text()
    # also extract screen page text (odd page)
    s_text = reader.pages[screen_page - 1].extract_text()

    specs[action_id] = {
        'screen_page': screen_page,
        'spec_page': spec_page,
        'spec_text': p_text,
        'screen_text': s_text
    }

out_file = ROOT_DIR / "evidence" / "cfo_deck_specs.json"
out_file.parent.mkdir(parents=True, exist_ok=True)
out_file.write_text(json.dumps(specs, indent=2, ensure_ascii=False), encoding='utf-8')
print(f"Extracted {len(specs)} CFO action specs to {out_file}")
