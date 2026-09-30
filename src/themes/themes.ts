import { HUNTER_BOSSES } from './hunterBosses';
import { HUNTER_CHAPTER_ACCENTS } from './hunterAccents';
import { HUNTER_CHAPTERS } from './hunterChapters';
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
 * 配色は Ver1（Mobile-）の tailwind.config.ts の hunter パレットから取った
 * （dark #1A1A2E / dark-light #2A2A3E / gold #D4AF37 / success #10B981 / error #EF4444）。
 * 背景だけは、グラフ・運指ガイドの固定色（--viz-*）が読める明るさに収めるため、Ver1 より少し暗くした。
 */
export const HUNTER_THEME: Theme = {
  id: 'hunter',
  name: 'HUNTER×HUNTER',
  locked: true,
  colors: {
    surface: '#13131f',
    'surface-raised': '#1e1e33',
    text: '#f4f1e6',
    'text-muted': '#b3b1c2',
    accent: '#d4af37',
    success: '#10b981',
    danger: '#ef4444',
  },
  strings: { tagline: 'HUNTER×HUNTER TYPING MASTER' },
  // 音は Ver1 の効果音（public/themes/hunter/）
  sounds: {
    type: ['themes/hunter/se-type1.mp3', 'themes/hunter/se-type2.mp3'],
    miss: ['themes/hunter/se-heavy1.mp3'],
    complete: ['themes/hunter/se-complete.mp3'],
  },
  title: {
    heading: 'HUNTER×HUNTER',
    subheading: 'TYPING MASTER',
    art: 'themes/hunter/title-art.jpg',
    artAlt: 'HUNTER×HUNTER NEN×TYPING IMPACT',
  },
  // BGM は Ver1 の曲を 128kbps に再エンコードしたもの（public/themes/hunter/audio/）
  audio: {
    stinger: 'themes/hunter/audio/stinger.mp3',
    confirm: 'themes/hunter/audio/confirm.mp3',
    title: 'themes/hunter/audio/opening-bgm.mp3',
    stage: 'themes/hunter/audio/title-bgm.mp3',
    game: 'themes/hunter/audio/game-bgm.mp3',
  },
  // Blender で作ったオリジナルのモデル（art/hunter/build_models.py で生成）
  hero: { centerpiece: 'themes/hunter/models/license.glb', orbiter: 'themes/hunter/models/card.glb' },
  // 念の段階（Ver1 の念レベル）: 連続正打が増えるほど、念が高まる
  feel: {
    levels: [
      { at: 0, name: '念' },
      { at: 5, name: '纏' },
      { at: 10, name: '絶' },
      { at: 20, name: '練' },
      { at: 50, name: '発' },
    ],
  },
  // 6 軸診断を「念の六系統」に対応づける（環の並びは原作の六性図と同じ。docs/spec/axes.md）
  diagnosis: {
    heading: '念系統診断',
    intro: 'あなたの打鍵を、念の六系統で読みます。水見式のように、得意と伸びしろを見てみましょう。',
    axes: {
      speed: { kind: '強化系', trait: '単純で一途', ritual: '水があふれる' },
      adapt: { kind: '変化系', trait: '気まぐれ', ritual: '水の味が変わる' },
      shape: { kind: '具現化系', trait: '神経質', ritual: '水に不純物が出る' },
      steady: { kind: '特質系', trait: '個人主義者', ritual: '葉が枯れる（その他の変化）' },
      control: { kind: '操作系', trait: '理屈屋でマイペース', ritual: '葉が動く' },
      reach: { kind: '放出系', trait: '大雑把', ritual: '水の色が変わる' },
    },
    affinity: [100, 80, 60, 40],
    glass: 'themes/hunter/models/glass.glb',
  },
  codex: {
    heading: '図鑑',
    path: 'themes/hunter/codex.json',
    categories: { character: '人物', ability: '能力', item: '道具', location: '場所', organization: '組織' },
  },
  license: { heading: 'ライセンス', cardTitle: 'HUNTER LICENSE', unnamed: '（ハンターネーム未設定）' },
  vowsHeading: '制約と誓約',
  train: { names: { zetsu: '絶', ren: '練', hatsu: '発' }, aids: { gyo: '凝', en: '円' } },
  chapters: HUNTER_CHAPTERS.map((c) => ({ ...c, accent: HUNTER_CHAPTER_ACCENTS[c.id] })),
  bosses: HUNTER_BOSSES,
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
