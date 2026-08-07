#!/usr/bin/env python3
"""Extract fur icons from the reference HTML as PNG files."""
import re, os, base64

HTML_PATH = r"D:\WorkBuddy\2026-08-06\金色皮毛效果图鉴.html"
OUT_DIR = r"G:\Projects\个人网站\xingchuan-wiki\xingchuan-wiki\assets\fur-icons"

os.makedirs(OUT_DIR, exist_ok=True)

with open(HTML_PATH, "r", encoding="utf-8") as f:
    html = f.read()

# Find all icon data URIs
icons = re.findall(r'class="icon" src="(data:image/png;base64,[^"]+)"', html)
print(f"Found {len(icons)} icon entries")

# Each icon corresponds to a card. Group by animal section.
sections = re.split(r'<div class="at-title">', html)[1:]
icon_idx = 0

for section in sections:
    title_match = re.match(r"(.*?)</div>", section)
    if not title_match:
        continue
    title = title_match.group(1).strip()
    
    # Find animal type
    animal_match = re.match(r"(\S+?)类", title)
    if not animal_match:
        continue
    animal = animal_match.group(1)
    
    # Find all cards in this section
    cards = section.split('<div class="card">')[1:]
    for card in cards:
        nm_match = re.search(r'<div class="nm">(.*?)</div>', card)
        if not nm_match:
            continue
        raw_name = nm_match.group(1)
        cleaned = re.sub(r'<span class="badge[^"]*">[^<]*</span>', '', raw_name)
        name = re.sub(r'<[^>]+>', '', cleaned).strip()
        
        # Get corresponding icon
        icon_match = re.search(r'class="icon" src="(data:image/png;base64,([^"]+))"', card)
        if icon_match and icon_idx < len(icons):
            b64_data = icon_match.group(2)
            # Create safe filename
            safe_name = name.replace(' ', '_').replace('/', '_')
            filename = f"{animal}_{safe_name}.png"
            filepath = os.path.join(OUT_DIR, filename)
            
            with open(filepath, "wb") as img_f:
                img_f.write(base64.b64decode(b64_data))
            
            print(f"  Saved: {filename}")
            icon_idx += 1

print(f"\nDone! {icon_idx} icons saved to {OUT_DIR}")
