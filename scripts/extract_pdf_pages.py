import pypdf

reader = pypdf.PdfReader("docs/reference/NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf")
print("Total pages:", len(reader.pages))
for p in range(262, 277):
    print(f"\n==================== PDF PAGE {p+1} ====================")
    text = reader.pages[p].extract_text()
    print(text)
