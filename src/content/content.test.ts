import { BASIC_PACK, BUILTIN_PACKS, ContentPackSchema, ENGLISH_PACK, SYMBOLS_PACK, loadPack, validatePackContent } from './index';
import { minKeystrokes } from '@/engine';

describe('出題データの検証', () => {
  it('基本パックの全語が、読み込み時の検証を通る', () => {
    expect(BASIC_PACK.items.length).toBeGreaterThanOrEqual(90);
    expect(validatePackContent(BASIC_PACK)).toEqual([]);
  });

  it('全語が打てて、最短打鍵数が現実的（1〜30）', () => {
    for (const item of BASIC_PACK.items) {
      const n = minKeystrokes(item.reading);
      expect(n, item.display).toBeGreaterThanOrEqual(1);
      expect(n, item.display).toBeLessThanOrEqual(30);
    }
  });

  it('促音・撥音・長音・拗音・外来音を含む（エンジンの主要ケースを実データでも通す）', () => {
    const readings = BASIC_PACK.items.map((i) => i.reading).join('|');
    for (const part of ['っ', 'ん', 'ー', 'ゃ', 'ゅ', 'ょ', 'ぃ', 'ゔ', 'ふぁ']) expect(readings).toContain(part);
  });

  it('組み込みパックは3つで、id が重複せず、すべて検証を通る', () => {
    expect(BUILTIN_PACKS.map((p) => p.id)).toEqual(['basic', 'english', 'symbols']);
    for (const pack of BUILTIN_PACKS) {
      expect(validatePackContent(pack), pack.id).toEqual([]);
      for (const item of pack.items) expect(minKeystrokes(item.reading), `${pack.id}: ${item.reading}`).toBeGreaterThan(0);
    }
  });

  it('英単語・記号パック: 打鍵数はお題の文字数と一致する（かな変換が入らない）', () => {
    for (const pack of [ENGLISH_PACK, SYMBOLS_PACK]) {
      expect(pack.items.length).toBeGreaterThanOrEqual(20);
      for (const item of pack.items) expect(minKeystrokes(item.reading), item.reading).toBe(item.reading.length);
    }
  });

  it('記号パックに、空白・Shift が要る記号・数字が含まれる', () => {
    const all = SYMBOLS_PACK.items.map((i) => i.reading).join('');
    for (const ch of [' ', '@', '$', '%', '(', '"', '&', '0']) expect(all).toContain(ch);
  });

  it('打てない文字・未正規化・重複を検出する', () => {
    const pack = ContentPackSchema.parse({
      id: 'bad',
      name: 'bad',
      items: [
        { display: 'a', reading: 'かんじ漢' },
        { display: 'b', reading: 'カタカナ' },
        { display: 'c', reading: 'ぬこ' },
        { display: 'd', reading: 'ぬこ' },
      ],
    });
    const problems = validatePackContent(pack);
    // かんじ漢: 打てない文字 / カタカナ: 未正規化 + 打てない文字 / ぬこ: 重複
    expect(problems).toHaveLength(4);
    expect(problems.join('\n')).toMatch(/打てない文字.*漢/);
    expect(problems.join('\n')).toMatch(/未正規化/);
    expect(problems.join('\n')).toMatch(/重複/);
  });

  it('loadPack: スキーマ違反・内容の不正は例外', () => {
    expect(() => loadPack({ id: 'X', name: 'n', items: [] })).toThrow();
    expect(() => loadPack({ id: 'ok', name: 'n', items: [{ display: 'a', reading: '漢' }] })).toThrow(/出題データが不正/);
    expect(loadPack({ id: 'ok', name: 'n', items: [{ display: 'a', reading: 'あ' }] }).items).toHaveLength(1);
  });
});
