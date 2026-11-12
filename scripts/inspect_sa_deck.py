import pypdf

reader = pypdf.PdfReader('docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf')

with open('evidence/sa_deck_text.txt', 'w', encoding='utf-8') as f:
    for page_num in range(290, 312):
        text = reader.pages[page_num].extract_text()
        f.write(f"=== PAGE {page_num+1} ===\n")
        f.write(text or "EMPTY")
        f.write("\n\n")

print("Dumped SA deck text to evidence/sa_deck_text.txt")
