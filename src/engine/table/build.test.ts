import { classifyRows, buildRomajiTable, MOZC_ROWS, ROMAJI_TABLE, parseMozcTable } from './index';
import { EXCLUDED_ROWS, PREFERRED_KEYS } from './rules';

const keysOf = (kana: string) => ROMAJI_TABLE.units.get(kana);

describe('parseMozcTable', () => {
  it('同梱した Mozc 表を全行読み込める', () => {
    expect(MOZC_ROWS).toHaveLength(323);
    expect(MOZC_ROWS[0]).toMatchObject({ input: '-', output: 'ー', next: undefined });
  });

  it('次の入力（3列目）を読む', () => {
    const kk = MOZC_ROWS.find((r) => r.input === 'kk');
    expect(kk).toMatchObject({ output: 'っ', next: 'k' });
  });

  it('不正な行はエラーにする', () => {
    expect(() => parseMozcTable('a')).toThrow(/1 行目/);
  });

  it('空行とコメント行は無視する', () => {
    expect(parseMozcTable('# c\n\nka\tか\n')).toHaveLength(1);
  });
});

describe('行の分類（Mozc 表との照合）', () => {
  const c = classifyRows(MOZC_ROWS);

  it('全行がちょうど1つに分類される', () => {
    const total =
      c.units.length + c.hatsuon.length + c.sokuonDirect.length + c.sokuonDoubling.length + c.excluded.length;
    expect(total).toBe(MOZC_ROWS.length);
  });

  it('除外リストに、Mozc 表に存在しない古い項目が無い', () => {
    const inputs = new Set(MOZC_ROWS.map((r) => r.input));
    for (const e of EXCLUDED_ROWS) expect(inputs.has(e.input), e.input).toBe(true);
  });

  it('除外は全て理由付き', () => {
    for (const e of EXCLUDED_ROWS) expect(e.reason.length, e.input).toBeGreaterThan(0);
  });

  it('同じ入力が異なる出力に割り当てられていない', () => {
    const outputs = new Map<string, Set<string>>();
    for (const r of MOZC_ROWS) {
      const key = `${r.input}\t${r.next ?? ''}`;
      outputs.set(key, (outputs.get(key) ?? new Set()).add(r.output));
    }
    for (const [key, set] of outputs) expect(set.size, key).toBe(1);
  });

  it('除外以外の行はすべて生成表で再現できる', () => {
    for (const r of [...c.units]) expect(keysOf(r.output), r.input).toContain(r.input);
    for (const r of c.hatsuon) {
      const { always, single } = ROMAJI_TABLE.hatsuon;
      expect([...always, single]).toContain(r.input);
    }
    for (const r of c.sokuonDirect) expect(ROMAJI_TABLE.sokuon.direct).toContain(r.input);
    for (const r of c.sokuonDoubling) {
      const next = r.next as string;
      expect(ROMAJI_TABLE.sokuon.doubling).toContainEqual({
        typed: r.input.slice(0, r.input.length - next.length),
        nextPrefix: next,
      });
    }
  });

  it('生成表に、Mozc 表に無い打鍵列が含まれない', () => {
    const mozcInputs = new Set(MOZC_ROWS.map((r) => r.input));
    for (const keys of ROMAJI_TABLE.units.values()) for (const k of keys) expect(mozcInputs.has(k), k).toBe(true);
  });

  it('打鍵列が重複しない', () => {
    for (const [kana, keys] of ROMAJI_TABLE.units) expect(new Set(keys).size, kana).toBe(keys.length);
  });
});

describe('仕様（docs/spec/input-rules.md）', () => {
  it('「を」は wo のみ（o は不可）', () => {
    expect(keysOf('を')).toEqual(['wo']);
  });

  it('「ぢ」「づ」は di / du（zi / zu は「じ」「ず」）', () => {
    expect(keysOf('ぢ')).toEqual(['di']);
    expect(keysOf('づ')).toEqual(['du']);
    expect(keysOf('じ')).toContain('zi');
    expect(keysOf('ず')).toContain('zu');
  });

  it('長音は - のみ', () => {
    expect(keysOf('ー')).toEqual(['-']);
  });

  it('句読点・括弧・波ダッシュ', () => {
    expect(keysOf('、')).toEqual([',']);
    expect(keysOf('。')).toEqual(['.']);
    expect(keysOf('・')).toEqual(['z/']);
    expect(keysOf('「')).toEqual(['[']);
    expect(keysOf('」')).toEqual([']']);
    expect(keysOf('〜')).toEqual(['~']);
  });

  it('出題しない文字は含まない', () => {
    for (const kana of ['ヵ', 'ヶ', 'ゐ', 'ゑ', '←', '↓', '↑', '→', '…', '‥', '『', '』']) {
      expect(ROMAJI_TABLE.units.has(kana), kana).toBe(false);
    }
  });

  it('「ん」: nn / n\' / xn は常に確定、n は条件付き', () => {
    expect([...ROMAJI_TABLE.hatsuon.always].sort()).toEqual(["n'", 'nn', 'xn']);
    expect(ROMAJI_TABLE.hatsuon.single).toBe('n');
  });

  it('「っ」: 単独は xtu / ltu / xtsu / ltsu', () => {
    expect([...ROMAJI_TABLE.sokuon.direct].sort()).toEqual(['ltsu', 'ltu', 'xtsu', 'xtu']);
  });

  it('「っ」の重ね打ちは仕様の子音のみ（l・x は不可）、tch を含む', () => {
    const typed = ROMAJI_TABLE.sokuon.doubling.map((d) => `${d.typed}>${d.nextPrefix}`).sort();
    // 仕様: k g s z j t d h f b p m r w c q v y ＋ tch
    const doubled = [...'kgszjtdhfbpmrwcqvy'].map((ch) => `${ch}>${ch}`);
    expect(typed).toEqual([...doubled, 't>ch'].sort());
  });

  it('拗音・外来音の主要な打ち方', () => {
    expect(keysOf('しゃ')).toEqual(expect.arrayContaining(['sya', 'sha']));
    expect(keysOf('ふぁ')).toEqual(expect.arrayContaining(['fa', 'hwa']));
    expect(keysOf('てぃ')).toContain('thi');
    expect(keysOf('ゔ')).toContain('vu');
    expect(keysOf('くぁ')).toEqual(expect.arrayContaining(['qa', 'kwa']));
  });

  it('小書きは x 系・l 系の両方', () => {
    expect(keysOf('ぁ')).toEqual(['xa', 'la']);
    expect(keysOf('ゃ')).toEqual(['xya', 'lya']);
  });
});

describe('表示ガイド用の推奨順', () => {
  it('打鍵列は短い順に並ぶ', () => {
    for (const [kana, keys] of ROMAJI_TABLE.units) {
      const lengths = keys.map((k) => k.length);
      expect(lengths, kana).toEqual([...lengths].sort((a, b) => a - b));
    }
  });

  it('推奨（先頭）は訓令式寄りの短い打ち方', () => {
    const first = (k: string) => keysOf(k)?.[0];
    expect(first('し')).toBe('si');
    expect(first('つ')).toBe('tu');
    expect(first('ふ')).toBe('hu');
    expect(first('ち')).toBe('ti');
    expect(first('じ')).toBe('zi');
    expect(first('しゃ')).toBe('sya');
    expect(first('ちゃ')).toBe('tya');
    expect(first('じゃ')).toBe('ja');
    expect(first('ぁ')).toBe('xa');
  });

  it('最短が複数あるとき、推奨は優先リストで明示されている', () => {
    for (const [kana, keys] of ROMAJI_TABLE.units) {
      const min = Math.min(...keys.map((k) => k.length));
      const tied = keys.filter((k) => k.length === min);
      if (tied.length > 1) expect(PREFERRED_KEYS, `${kana}: ${tied.join(' ')}`).toContain(keys[0]);
    }
  });
});

describe('buildRomajiTable', () => {
  it('「ん」の n が無い表はエラー', () => {
    expect(() => buildRomajiTable(parseMozcTable('nn\tん\n'), [])).toThrow(/n が見つかりません/);
  });

  it('除外を渡さなければ全行を取り込む', () => {
    const table = buildRomajiTable(MOZC_ROWS, []);
    expect(table.units.has('ヵ')).toBe(true);
  });
});
