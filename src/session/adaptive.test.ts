import { keysOfTarget, pickAdaptive } from './adaptive';

const items = [
  { reading: 'かき' }, // k a k i
  { reading: 'さし' }, // s a s i
  { reading: 'たち' }, // t a t i
  { reading: 'なに' }, // n a n i
];

/** シード付きの疑似乱数（決定的なテスト用） */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('keysOfTarget', () => {
  it('最短経路のキー列', () => {
    expect(keysOfTarget('かんじ')).toEqual([...'kanzi']);
    expect(keysOfTarget('さっか')).toEqual([...'sakka']);
    expect(keysOfTarget('らーめん')).toEqual([...'ra-menn']);
  });

  it('打てないお題は空', () => {
    expect(keysOfTarget('漢')).toEqual([]);
  });
});

describe('pickAdaptive', () => {
  it('重複なく n 個、n が多ければ全件', () => {
    const picked = pickAdaptive(items, 3, new Map(), { random: seeded(1) });
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    expect(pickAdaptive(items, 10, new Map(), { random: seeded(1) })).toHaveLength(4);
  });

  it('弱いキーを含むお題ほど選ばれやすい', () => {
    const weakness = new Map([['k', 5]]);
    const counts = new Map<string, number>();
    const random = seeded(42);
    for (let i = 0; i < 2000; i++) {
      const first = pickAdaptive(items, 1, weakness, { random })[0]?.reading as string;
      counts.set(first, (counts.get(first) ?? 0) + 1);
    }
    const kaki = counts.get('かき') ?? 0;
    for (const other of ['さし', 'たち', 'なに']) expect(kaki).toBeGreaterThan((counts.get(other) ?? 0) * 3);
  });

  it('連接が弱いお題ほど選ばれやすい（キー単位の弱さが同じでも）', () => {
    // どのキーも同じ弱さ。連接 sa（さし の s→a）だけが弱い
    const weakness = new Map(['k', 'a', 's', 'i', 't', 'n'].map((k) => [k, 1]));
    const bigrams = new Map([['sa', 5]]);
    const counts = new Map<string, number>();
    const random = seeded(11);
    for (let i = 0; i < 2000; i++) {
      const first = pickAdaptive(items, 1, weakness, { bigrams, random })[0]?.reading as string;
      counts.set(first, (counts.get(first) ?? 0) + 1);
    }
    const sashi = counts.get('さし') ?? 0;
    for (const other of ['かき', 'たち', 'なに']) expect(sashi).toBeGreaterThan((counts.get(other) ?? 0) * 2);
  });

  it('連接が無ければ、キー単位だけの重みと同じ', () => {
    const weakness = new Map([['k', 5]]);
    const a = pickAdaptive(items, 4, weakness, { random: seeded(5) });
    const b = pickAdaptive(items, 4, weakness, { bigrams: new Map(), random: seeded(5) });
    expect(b).toEqual(a);
  });

  it('弱点が無いお題も選ばれる（floor）', () => {
    const weakness = new Map([['k', 100]]);
    const seen = new Set<string>();
    const random = seeded(7);
    for (let i = 0; i < 5000; i++) seen.add(pickAdaptive(items, 1, weakness, { random })[0]?.reading as string);
    expect(seen.size).toBe(4);
  });

  it('弱点データが無ければ均等', () => {
    const counts = new Map<string, number>();
    const random = seeded(3);
    for (let i = 0; i < 4000; i++) {
      const r = pickAdaptive(items, 1, new Map(), { random })[0]?.reading as string;
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    for (const c of counts.values()) expect(c).toBeGreaterThan(800);
  });

  it('打てないお題は floor の重みで扱う（例外にしない）', () => {
    expect(pickAdaptive([{ reading: '漢' }, { reading: 'あ' }], 2, new Map())).toHaveLength(2);
  });

  it('乱数が 1 に近くても範囲外にならない', () => {
    expect(pickAdaptive(items, 4, new Map(), { random: () => 0.9999999 })).toHaveLength(4);
  });
});
