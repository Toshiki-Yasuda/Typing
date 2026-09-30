import { ThemeSchema, contrastProblems, type ColorToken, type Theme } from './theme';

/** 中立テーマ。`src/index.css` の @theme と同じ値（常に存在し、他のテーマが不正なときの戻り先） */
export const NEUTRAL_COLORS: Readonly<Record<ColorToken, string>> = {
  surface: '#14151a',
  'surface-raised': '#1d1f27',
  text: '#e8e9ee',
  'text-muted': '#9a9db0',
  accent: '#5b9dff',
  success: '#4ade80',
  danger: '#f87171',
};

export const NEUTRAL_THEME: Theme = {
  id: 'neutral',
  name: '標準',
  locked: false,
  colors: {},
  strings: {},
};

/**
 * HUNTER×HUNTER テーマ（ロック付き）。
 * 配色は仮の値（Ver1 の配色を取り込むまでの暫定）。
 */
export const HUNTER_THEME: Theme = {
  id: 'hunter',
  name: 'HUNTER×HUNTER',
  locked: true,
  colors: {
    surface: '#0e1a14',
    'surface-raised': '#16281e',
    text: '#e9f1ea',
    'text-muted': '#a6b9ab',
    accent: '#7fd66b',
  },
  strings: { tagline: 'ハンター試験、開始。' },
};

export const THEMES: readonly Theme[] = [NEUTRAL_THEME, HUNTER_THEME];

/** テーマの色（中立の値に上書きを重ねたもの） */
export function themeColors(theme: Theme): Record<ColorToken, string> {
  return { ...NEUTRAL_COLORS, ...theme.colors };
}

/**
 * id からテーマを引く。存在しない・ロック中・検証に通らない（形式・コントラスト）ときは中立テーマ。
 */
export function resolveTheme(id: string, unlocked: ReadonlySet<string>, themes: readonly Theme[] = THEMES): Theme {
  const theme = themes.find((t) => t.id === id);
  if (!theme || (theme.locked && !unlocked.has(theme.id))) return NEUTRAL_THEME;
  if (!ThemeSchema.safeParse(theme).success) return NEUTRAL_THEME;
  if (contrastProblems(themeColors(theme)).length > 0) return NEUTRAL_THEME;
  return theme;
}
