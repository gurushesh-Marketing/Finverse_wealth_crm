import pypdf
import sys

sys.stdout.reconfigure(encoding='utf-8')
reader = pypdf.PdfReader('docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf')
print('Total pages:', len(reader.pages))

target_pages = [0, 1, 2, 3, 4, 5, 34, 35, 36, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320]
for p in target_pages:
    if p < len(reader.pages):
        text = reader.pages[p].extract_text()
        print(f"=== PAGE P{p+1:03d} (index {p}) ===")
        print(text[:600].strip())
        print("-" * 40)
