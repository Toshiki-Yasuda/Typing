/**
 * キー配列と運指（どの指でどのキーを打つか）。ガイド表示専用。
 * 判定は `KeyboardEvent.key`（打った文字）で行うので、配列を間違えてもゲームの判定は変わらない。
 */
export type Finger =
  | 'L-pinky'
  | 'L-ring'
  | 'L-middle'
  | 'L-index'
  | 'R-index'
  | 'R-middle'
  | 'R-ring'
  | 'R-pinky'
  | 'thumb';

export interface KeyDef {
  /** Shift なしで出る文字 */
  readonly base: string;
  /** Shift ありで出る文字。英字は省略（大文字になる） */
  readonly shifted?: string;
  readonly finger: Finger;
}

export interface KeyRow {
  readonly keys: readonly KeyDef[];
  /** キー幅を 1 として、左端のずらし量（段ごとのずれ） */
  readonly indent: number;
}

export type LayoutId = 'us' | 'jis';

export interface Layout {
  readonly id: LayoutId;
  readonly name: string;
  readonly rows: readonly KeyRow[];
}

const k = (base: string, finger: Finger, shifted?: string): KeyDef => (shifted ? { base, shifted, finger } : { base, finger });

/** 英字の段: 指は左小指→…→右小指の順に割り当てる */
const letters = (chars: string, fingers: readonly Finger[]): KeyDef[] => [...chars].map((c, i) => k(c, fingers[i] as Finger));

const L = { p: 'L-pinky', r: 'L-ring', m: 'L-middle', i: 'L-index' } as const;
const R = { i: 'R-index', m: 'R-middle', r: 'R-ring', p: 'R-pinky' } as const;

export const US_LAYOUT: Layout = {
  id: 'us',
  name: 'US配列',
  rows: [
    {
      indent: 0,
      keys: [
        k('`', L.p, '~'), k('1', L.p, '!'), k('2', L.r, '@'), k('3', L.m, '#'), k('4', L.i, '$'), k('5', L.i, '%'),
        k('6', R.i, '^'), k('7', R.i, '&'), k('8', R.m, '*'), k('9', R.r, '('), k('0', R.p, ')'), k('-', R.p, '_'), k('=', R.p, '+'),
      ],
    },
    {
      indent: 0.5,
      keys: [
        ...letters('qwertyuiop', [L.p, L.r, L.m, L.i, L.i, R.i, R.i, R.m, R.r, R.p]),
        k('[', R.p, '{'), k(']', R.p, '}'), k('\\', R.p, '|'),
      ],
    },
    {
      indent: 0.75,
      keys: [...letters('asdfghjkl', [L.p, L.r, L.m, L.i, L.i, R.i, R.i, R.m, R.r]), k(';', R.p, ':'), k("'", R.p, '"')],
    },
    {
      indent: 1.25,
      keys: [...letters('zxcvbnm', [L.p, L.r, L.m, L.i, L.i, R.i, R.i]), k(',', R.m, '<'), k('.', R.r, '>'), k('/', R.p, '?')],
    },
  ],
};

export const JIS_LAYOUT: Layout = {
  id: 'jis',
  name: 'JIS配列',
  rows: [
    {
      indent: 0,
      keys: [
        k('1', L.p, '!'), k('2', L.r, '"'), k('3', L.m, '#'), k('4', L.i, '$'), k('5', L.i, '%'),
        k('6', R.i, '&'), k('7', R.i, "'"), k('8', R.m, '('), k('9', R.r, ')'), k('0', R.p), k('-', R.p, '='), k('^', R.p, '~'), k('¥', R.p, '|'),
      ],
    },
    {
      indent: 0.5,
      keys: [...letters('qwertyuiop', [L.p, L.r, L.m, L.i, L.i, R.i, R.i, R.m, R.r, R.p]), k('@', R.p, '`'), k('[', R.p, '{')],
    },
    {
      indent: 0.75,
      keys: [...letters('asdfghjkl', [L.p, L.r, L.m, L.i, L.i, R.i, R.i, R.m, R.r]), k(';', R.p, '+'), k(':', R.p, '*'), k(']', R.p, '}')],
    },
    {
      indent: 1.25,
      keys: [
        ...letters('zxcvbnm', [L.p, L.r, L.m, L.i, L.i, R.i, R.i]),
        k(',', R.m, '<'), k('.', R.r, '>'), k('/', R.p, '?'), k('\\', R.p, '_'),
      ],
    },
  ],
};

export const LAYOUTS: Readonly<Record<LayoutId, Layout>> = { us: US_LAYOUT, jis: JIS_LAYOUT };

export interface KeyLocation {
  readonly key: KeyDef;
  /** Shift を押しながら打つ文字か */
  readonly shift: boolean;
  /** Shift を押す指（キーと反対の手の小指）。Shift が不要なら null */
  readonly shiftFinger: Finger | null;
}

const isLetter = (c: string) => /^[a-z]$/.test(c);

/** 文字を打つキーと、Shift の要否を探す。配列に無い文字は null */
export function locate(layout: Layout, char: string): KeyLocation | null {
  if (char.length !== 1) return null;
  if (char === ' ') return { key: { base: ' ', finger: 'thumb' }, shift: false, shiftFinger: null };
  for (const row of layout.rows) {
    for (const key of row.keys) {
      if (key.base === char) return { key, shift: false, shiftFinger: null };
      const shifted = key.shifted ?? (isLetter(key.base) ? key.base.toUpperCase() : undefined);
      if (shifted === char) return { key, shift: true, shiftFinger: key.finger.startsWith('L-') ? 'R-pinky' : 'L-pinky' };
    }
  }
  return null;
}

const HAND: Record<Finger, string> = {
  'L-pinky': '左手の小指',
  'L-ring': '左手の薬指',
  'L-middle': '左手の中指',
  'L-index': '左手の人差し指',
  'R-index': '右手の人差し指',
  'R-middle': '右手の中指',
  'R-ring': '右手の薬指',
  'R-pinky': '右手の小指',
  thumb: '親指',
};

export const fingerName = (finger: Finger): string => HAND[finger];

/** 画面の説明文。例: 「右手の人差し指で J」「Shift（右手の小指）を押しながら 左手の小指で 1」 */
export function describeKey(loc: KeyLocation): string {
  const label = loc.key.base === ' ' ? 'スペース' : isLetter(loc.key.base) ? loc.key.base.toUpperCase() : loc.key.base;
  const press = `${fingerName(loc.key.finger)}で ${label}`;
  return loc.shift && loc.shiftFinger ? `Shift（${fingerName(loc.shiftFinger)}）を押しながら ${press}` : press;
}
