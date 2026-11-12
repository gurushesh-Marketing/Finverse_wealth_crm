import re
from pathlib import Path

content = Path("apps/web/src/pages/NationalManagerPages.tsx").read_text(encoding="utf-8")
pattern = re.compile(r'export function (National\w+).*?title="([^"]+)"', re.DOTALL)
for fn, title in pattern.findall(content):
    print(f"{fn} -> {title}")
