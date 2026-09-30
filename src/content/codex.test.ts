import { readFileSync } from 'node:fs';
import { CODEX_CATEGORIES, loadCodex } from './codex';

const e = (display: string, reading: string, category = 'character') => ({ display, reading, category, chapter: 1 });

describe('loadCodex', () => {
  it('正しいデータは、読みを正規化して返す', () => {
    expect(loadCodex({ entries: [e('ゴン', 'ごん')] })).toEqual([{ display: 'ゴン', reading: 'ごん', category: 'character', chapter: 1 }]);
  });
  it('打てない読み・重複・不明な区分・空は、理由つきで拒否する', () => {
    expect(() => loadCodex({ entries: [e('漢', '漢字')] })).toThrow(/打てない文字/);
    expect(() => loadCodex({ entries: [e('ゴン', 'ごん'), e('ゴン', 'ごん')] })).toThrow(/重複/);
    expect(() => loadCodex({ entries: [e('ゴン', 'ごん', 'monster')] })).toThrow(/不正/);
    expect(() => loadCodex({ entries: [] })).toThrow(/不正/);
    expect(() => loadCodex(null)).toThrow(/不正/);
  });
  it('表記が同じでも読みが違えば別の語', () => {
    expect(loadCodex({ entries: [e('王', 'おう'), e('王', 'きんぐ')] })).toHaveLength(2);
  });
});

describe('HUNTER の図鑑データ（codex.json）', () => {
  const entries = loadCodex(JSON.parse(readFileSync('public/themes/hunter/codex.json', 'utf-8')));
  it('全語が打てて重複が無く（読み込みで検証）、5 つの区分をすべて含む', () => {
    expect(entries.length).toBeGreaterThan(250);
    for (const c of CODEX_CATEGORIES) expect(entries.some((x) => x.category === c), c).toBe(true);
  });
  it('章は 1〜7', () => {
    expect(new Set(entries.map((x) => x.chapter))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]));
  });
});
