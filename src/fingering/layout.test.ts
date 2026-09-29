import { ROMAJI_TABLE } from '@/engine';
import { JIS_LAYOUT, LAYOUTS, US_LAYOUT, describeKey, fingerName, locate, type Finger, type Layout } from './index';

const printable = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i));

/** 文字を打てるキーの組み合わせが、配列の中に何通りあるか */
function countWays(layout: Layout, ch: string): number {
  if (ch === ' ') return 1;
  let n = 0;
  for (const row of layout.rows) {
    for (const key of row.keys) {
      if (key.base === ch) n++;
      const shifted = key.shifted ?? (/^[a-z]$/.test(key.base) ? key.base.toUpperCase() : undefined);
      if (shifted === ch) n++;
    }
  }
  return n;
}

describe.each([US_LAYOUT, JIS_LAYOUT])('$name', (layout) => {
  it('印字できる ASCII 全文字が、ちょうど1通りの打ち方で見つかる', () => {
    for (const ch of printable) {
      expect(locate(layout, ch), JSON.stringify(ch)).not.toBeNull();
      expect(countWays(layout, ch), JSON.stringify(ch)).toBe(1);
    }
  });

  it('エンジンが要求しうる打鍵（入力表・「ん」・「っ」）の全文字を、この配列で打てる', () => {
    const keys = new Set<string>();
    for (const list of ROMAJI_TABLE.units.values()) for (const seq of list) for (const c of seq) keys.add(c);
    for (const seq of [...ROMAJI_TABLE.hatsuon.always, ROMAJI_TABLE.hatsuon.single]) for (const c of seq) keys.add(c);
    for (const seq of ROMAJI_TABLE.sokuon.direct) for (const c of seq) keys.add(c);
    for (const d of ROMAJI_TABLE.sokuon.doubling) for (const c of d.typed) keys.add(c);
    expect(keys.size).toBeGreaterThan(30);
    for (const c of keys) expect(locate(layout, c), `${layout.id}: ${c}`).not.toBeNull();
  });

  it('全キーに指が割り当てられ、8本の指すべてが使われる', () => {
    const used = new Set<Finger>();
    for (const row of layout.rows) for (const key of row.keys) used.add(key.finger);
    expect([...used].sort()).toEqual(
      ['L-index', 'L-middle', 'L-pinky', 'L-ring', 'R-index', 'R-middle', 'R-pinky', 'R-ring'].sort(),
    );
  });

  it('ホームポジション: asdf は左手、jkl; は右手の、それぞれの指', () => {
    const finger = (c: string) => locate(layout, c)?.key.finger;
    expect(['a', 's', 'd', 'f'].map(finger)).toEqual(['L-pinky', 'L-ring', 'L-middle', 'L-index']);
    expect(['j', 'k', 'l', ';'].map(finger)).toEqual(['R-index', 'R-middle', 'R-ring', 'R-pinky']);
  });

  it('人差し指は 2列分（左: 4 5 r t f g v b、右: 6 7 y u h j n m）', () => {
    const finger = (c: string) => locate(layout, c)?.key.finger;
    for (const c of [...'45rtfgvb']) expect(finger(c), c).toBe('L-index');
    for (const c of [...'67yuhjnm']) expect(finger(c), c).toBe('R-index');
  });

  it('大文字は Shift つき。Shift は反対の手の小指', () => {
    expect(locate(layout, 'A')).toMatchObject({ shift: true, shiftFinger: 'R-pinky' });
    expect(locate(layout, 'J')).toMatchObject({ shift: true, shiftFinger: 'L-pinky' });
    expect(locate(layout, 'a')).toMatchObject({ shift: false, shiftFinger: null });
  });

  it('スペースは親指。配列にない文字・複数文字は null', () => {
    expect(locate(layout, ' ')).toMatchObject({ shift: false, key: { finger: 'thumb' } });
    expect(locate(layout, 'あ')).toBeNull();
    expect(locate(layout, 'ab')).toBeNull();
    expect(locate(layout, '')).toBeNull();
  });
});

describe('US と JIS の違い', () => {
  it('引用符・@・= など、記号の位置が違う', () => {
    expect(locate(US_LAYOUT, '"')).toMatchObject({ shift: true, key: { base: "'" } });
    expect(locate(JIS_LAYOUT, '"')).toMatchObject({ shift: true, key: { base: '2' } });
    expect(locate(US_LAYOUT, '@')).toMatchObject({ shift: true, key: { base: '2' } });
    expect(locate(JIS_LAYOUT, '@')).toMatchObject({ shift: false, key: { base: '@' } });
    expect(locate(US_LAYOUT, '=')).toMatchObject({ shift: false });
    expect(locate(JIS_LAYOUT, '=')).toMatchObject({ shift: true, key: { base: '-' } });
    expect(locate(US_LAYOUT, ':')).toMatchObject({ shift: true, key: { base: ';' } });
    expect(locate(JIS_LAYOUT, ':')).toMatchObject({ shift: false });
  });

  it('ローマ字入力で使う記号: ー(-)・「」([ ])・〜(~)・n\' の位置', () => {
    expect(locate(US_LAYOUT, '~')).toMatchObject({ shift: true, key: { base: '`' } });
    expect(locate(JIS_LAYOUT, '~')).toMatchObject({ shift: true, key: { base: '^' } });
    expect(locate(US_LAYOUT, "'")).toMatchObject({ shift: false });
    expect(locate(JIS_LAYOUT, "'")).toMatchObject({ shift: true, key: { base: '7' } });
    for (const layout of [US_LAYOUT, JIS_LAYOUT]) {
      for (const c of ['-', '[', ']', ',', '.', '/']) expect(locate(layout, c)?.shift, `${layout.id}: ${c}`).toBe(false);
    }
  });

  it('LAYOUTS で id から引ける', () => {
    expect(LAYOUTS.us).toBe(US_LAYOUT);
    expect(LAYOUTS.jis).toBe(JIS_LAYOUT);
  });
});

describe('describeKey', () => {
  it('指と、Shift が要るときはその指も示す', () => {
    expect(describeKey(locate(US_LAYOUT, 'j')!)).toBe('右手の人差し指で J');
    expect(describeKey(locate(US_LAYOUT, 'J')!)).toBe('Shift（左手の小指）を押しながら 右手の人差し指で J');
    expect(describeKey(locate(US_LAYOUT, '!')!)).toBe('Shift（右手の小指）を押しながら 左手の小指で 1');
    expect(describeKey(locate(JIS_LAYOUT, '"')!)).toBe('Shift（右手の小指）を押しながら 左手の薬指で 2');
    expect(describeKey(locate(US_LAYOUT, ' ')!)).toBe('親指で スペース');
    expect(describeKey(locate(US_LAYOUT, '-')!)).toBe('右手の小指で -');
  });

  it('fingerName', () => {
    expect(fingerName('L-index')).toBe('左手の人差し指');
    expect(fingerName('thumb')).toBe('親指');
  });
});
