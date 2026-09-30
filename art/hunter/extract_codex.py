"""
Ver1（Mobile-）の語彙から、図鑑の見出し語（キャラクター・能力・道具・場所・組織）を取り出して JSON にする。

  python art/hunter/extract_codex.py <Ver1 のリポジトリ> <出力 JSON>

出力: { "entries": [{ display, reading, category, chapter }] }（表記と読みが同じ語は最初の章のものだけ）
説明文は含めない（原作の記述の正確さの確認が要るため、少しずつ別に足す。docs/spec/codex.md）。
"""
import json
import re
import sys
from pathlib import Path

repo = Path(sys.argv[1])
out = Path(sys.argv[2])
KEEP = {'character', 'ability', 'item', 'location', 'organization'}
word_re = re.compile(r"display:\s*(['\"])(.*?)\1,\s*hiragana:\s*(['\"])(.*?)\3,\s*category:\s*'(\w+)'")

entries, seen = [], set()
for chapter in range(1, 8):
    src = (repo / f'src/data/words/chapter{chapter}.ts').read_text(encoding='utf-8')
    for m in word_re.finditer(src):
        display, reading, category = m.group(2), m.group(4), m.group(5)
        if category not in KEEP or (display, reading) in seen:
            continue
        seen.add((display, reading))
        entries.append({'display': display, 'reading': reading, 'category': category, 'chapter': chapter})

out.write_text(json.dumps({'entries': entries}, ensure_ascii=False, indent=0), encoding='utf-8')
by = {}
for e in entries:
    by[e['category']] = by.get(e['category'], 0) + 1
print(len(entries), by)
