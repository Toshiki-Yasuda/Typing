import { z } from 'zod';

/** テーマが上書きできる色。これ以外は上書きできない（グラフの色などは検証済みの固定値のため） */
export const COLOR_TOKENS = ['surface', 'surface-raised', 'text', 'text-muted', 'accent', 'success', 'danger'] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, '#RRGGBB 形式の色');

/** ボス戦のボス1体。データだけで定義し、戦闘のルールはコード（session/bossBattle.ts）にある */
export const BossSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  chapter: z.number().int().min(1),
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  /** 画像（アプリからの相対パス）。無ければ文字だけで表示する */
  image: z.string().min(1).optional(),
  /** 出題に使う組み込みパックの id */
  packId: z.string().min(1),
  /** 倒すべきお題の数（ボスの HP） */
  words: z.number().int().min(1).max(100),
  /** 許されるミスの数。これを超えるミスで敗北 */
  maxMisses: z.number().int().min(0).max(100),
  intro: z.string().min(1),
  /** 戦闘中の台詞（お題ごとに順に出す） */
  dialogues: z.array(z.string().min(1)).min(1),
  /** フェーズ 2・3・4 に入ったときの台詞（3つ） */
  phaseMessages: z.array(z.string().min(1)).length(3),
  /** ボスを倒したときの台詞 */
  defeat: z.string().min(1),
});
export type Boss = z.infer<typeof BossSchema>;

export const ThemeSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  /** true なら、パスワードで解除するまで選べない */
  locked: z.boolean(),
  /** 上書きする色。指定しないトークンは中立テーマの値のまま */
  colors: z.partialRecord(z.enum(COLOR_TOKENS), hex),
  /** 文言。指定しなければ中立の文言 */
  strings: z.object({ tagline: z.string().optional() }),
  /** 効果音（アプリからの相対パス）。無ければ無音。打鍵が合っている / 間違い / 練習の完了 */
  sounds: z
    .object({
      type: z.array(z.string().min(1)).min(1),
      miss: z.array(z.string().min(1)).min(1),
      complete: z.array(z.string().min(1)).min(1),
    })
    .optional(),
  /** ボス戦のボス。無ければボス戦は出ない */
  bosses: z.array(BossSchema).optional(),
});
export type Theme = z.infer<typeof ThemeSchema>;

function luminance(color: string): number {
  const channel = (i: number) => {
    const v = parseInt(color.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** WCAG のコントラスト比 */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * テーマで変わらない色（`src/index.css` の --viz-*）。暗い面で検証した値なので、
 * テーマの背景が明るすぎてこれらが読めなくなるのを、コントラストの検査で防ぐ。
 */
export const FIXED_ON_SURFACE: readonly (readonly [string, string, number])[] = [
  ['--viz-ink-secondary', '#c3c2b7', 4.5], // 運指ガイドのキー・グラフの文字
  ['--viz-muted', '#898781', 4.5], // 運指ガイドの薄いキー・グラフの軸の文字
  ['--viz-series-1', '#3987e5', 3], // グラフの棒・線
];

/** 文字は 4.5:1、アクセント・状態色は 3:1 以上（背景は surface と surface-raised の両方に対して） */
const REQUIRED: readonly (readonly [ColorToken, number])[] = [
  ['text', 4.5],
  ['text-muted', 4.5],
  ['accent', 3],
  ['success', 3],
  ['danger', 3],
];

/** 色が読めるか。満たさなければ、問題の説明を返す（読める場合は空） */
export function contrastProblems(colors: Readonly<Record<ColorToken, string>>): string[] {
  const problems: string[] = [];
  for (const [token, min] of REQUIRED) {
    for (const bg of ['surface', 'surface-raised'] as const) {
      const c = contrast(colors[token], colors[bg]);
      if (c < min) problems.push(`${token} と ${bg} のコントラスト比が ${c.toFixed(2)}（${min} 未満）`);
    }
  }
  for (const [name, color, min] of FIXED_ON_SURFACE) {
    for (const bg of ['surface', 'surface-raised'] as const) {
      const c = contrast(color, colors[bg]);
      if (c < min) problems.push(`固定色 ${name} と ${bg} のコントラスト比が ${c.toFixed(2)}（${min} 未満）`);
    }
  }
  return problems;
}
