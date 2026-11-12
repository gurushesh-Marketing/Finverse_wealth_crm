from pathlib import Path
import pypdf

ROOT_DIR = Path(__file__).resolve().parent.parent
pdf_file = ROOT_DIR / "docs" / "reference" / "NEW-Finverse_Wealth_CRM_Premium_UIUX_Action_Deck.pdf"
screens_dir = ROOT_DIR / "docs" / "reference" / "screens"
screens_dir.mkdir(parents=True, exist_ok=True)

reader = pypdf.PdfReader(str(pdf_file))

for idx in range(19):
    screen_p = 225 + (idx * 2)
    page_idx = screen_p - 1
    page = reader.pages[page_idx]

    if page.images:
        img = page.images[0]
        out_file = screens_dir / f"P{screen_p}.jpg"
        out_file.write_bytes(img.data)
        print(f"Extracted P{screen_p}.jpg ({len(img.data)} bytes) from page {screen_p}")
    else:
        print(f"No image on page {screen_p}")
