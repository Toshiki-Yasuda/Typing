"""
Ver1（Mobile-）の語彙を取り出して JSON にする（ステージ選択用）。

  python art/hunter/extract_ver1_words.py <Ver1 のリポジトリ> <出力 JSON>

出力: { "chapters": [{ number, title, subtitle, stages: [{ number, name, description, words: [{display, reading}] }] }] }
Ver1 の src/data/words/chapter{1..7}.ts（語彙）と、StageSelectScreen の CHAPTERS（章・ステージの名前）を読む。
打てない語・重複の除去は、こちらのアプリ側の検証（src/content/stageBuild.ts）で行う。
"""
import json
import re
import sys
from pathlib import Path

repo = Path(sys.argv[1])
out = Path(sys.argv[2])

# 章・ステージの名前
select = (repo / 'src/components/screens/StageSelectScreen/index.tsx').read_text(encoding='utf-8')
block = select[select.index('const CHAPTERS'):]
chapters = []
for m in re.finditer(r"id:\s*(\d+),\s*kanji:\s*'([^']*)',\s*romaji:\s*'([^']*)',\s*stages:\s*\[(.*?)\n\s*\],", block, re.S):
    number, title, subtitle, body = int(m.group(1)), m.group(2), m.group(3), m.group(4)
    stages = [
        {'number': int(s.group(1)), 'name': s.group(2), 'description': s.group(3)}
        for s in re.finditer(r"number:\s*(\d+),\s*name:\s*'([^']*)',\s*description:\s*'([^']*)'", body)
    ]
    chapters.append({'number': number, 'title': title, 'subtitle': subtitle, 'stages': stages})

# 語彙
word_re = re.compile(r"display:\s*(['\"])(.*?)\1,\s*hiragana:\s*(['\"])(.*?)\3")
for ch in chapters:
    src = (repo / f"src/data/words/chapter{ch['number']}.ts").read_text(encoding='utf-8')
    for st in ch['stages']:
        m = re.search(rf"export const stage{ch['number']}_{st['number']}:\s*Word\[\]\s*=\s*\[(.*?)\n\];", src, re.S)
        st['words'] = [{'display': w.group(2), 'reading': w.group(4)} for w in word_re.finditer(m.group(1))] if m else []

out.write_text(json.dumps({'chapters': chapters}, ensure_ascii=False, indent=1), encoding='utf-8')
for ch in chapters:
    print(ch['number'], ch['title'], [len(s['words']) for s in ch['stages']])
