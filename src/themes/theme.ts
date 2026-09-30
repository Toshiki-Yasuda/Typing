import { z } from 'zod';

/** テーマが上書きできる色。これ以外は上書きできない（グラフの色などは検証済みの固定値のため） */
export const COLOR_TOKENS = ['surface', 'surface-raised', 'text', 'text-muted', 'accent', 'success', 'danger'] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, '#RRGGBB 形式の色');

export const ThemeSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  /** true なら、パスワードで解除するまで選べない */
  locked: z.boolean(),
  /** 上書きする色。指定しないトークンは中立テーマの値のまま */
  colors: z.partialRecord(z.enum(COLOR_TOKENS), hex),
  /** 文言。指定しなければ中立の文言 */
  strings: z.object({ tagline: z.string().optional() }),
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
  return problems;
}
