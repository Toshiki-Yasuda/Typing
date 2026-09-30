import { z } from 'zod';
import { AXIS_IDS } from '@/metrics/axes';
import { SKILL_KINDS } from '@/session/bossSkills';

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
  /** 出題に使う組み込みパックの id（`pack` が無いときの出題） */
  packId: z.string().min(1),
  /** テーマ固有の語彙パック（JSON。アプリからの相対パス）。あれば packId より優先する */
  pack: z.string().min(1).optional(),
  /** 倒すべきお題の数（ボスの HP） */
  words: z.number().int().min(1).max(100),
  /** 許されるミスの数。これを超えるミスで敗北 */
  maxMisses: z.number().int().min(0).max(100),
  /** 時間制限（秒）。無ければ無制限。上位の章だけに付ける（docs/spec/boss.md） */
  timeLimitSec: z.number().int().min(10).max(600).optional(),
  /** ボスの技。判定は変えず、表示と敗北条件にだけ作用する。名前と説明はテーマの言葉 */
  skill: z.object({ kind: z.enum(SKILL_KINDS), name: z.string().min(1), text: z.string().min(1) }).optional(),
  intro: z.string().min(1),
  /** 戦闘中の台詞（お題ごとに順に出す） */
  dialogues: z.array(z.string().min(1)).min(1),
  /** フェーズ 2・3・4 に入ったときの台詞（3つ） */
  phaseMessages: z.array(z.string().min(1)).length(3),
  /** ボスを倒したときの台詞 */
  defeat: z.string().min(1),
});
export type Boss = z.infer<typeof BossSchema>;

/** ステージ選択の 1 ステージ。語彙パックを打ち切る練習 */
export const StageSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  /** 語彙パック（JSON。アプリからの相対パス）。選んだときに読み込む */
  pack: z.string().min(1),
});
export type Stage = z.infer<typeof StageSchema>;

/** 章: いくつかのステージと、最後のボス */
export const ChapterSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  number: z.number().int().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  stages: z.array(StageSchema).min(1),
  /** この章のボス（`bosses` の id） */
  boss: z.string().min(1).optional(),
});
export type Chapter = z.infer<typeof ChapterSchema>;

/** 6 軸診断の、テーマでの見せ方。軸（速さ・制御…）を、作品の言葉（系統など）に対応づける */
const AxisFlavorSchema = z.object({
  /** 例: 「強化系」 */
  kind: z.string().min(1),
  /** 性格などの傾向（遊びの意匠） */
  trait: z.string().min(1),
  /** 儀式（水見式）での反応 */
  ritual: z.string().min(1),
});
export const DiagnosisSchema = z.object({
  heading: z.string().min(1),
  intro: z.string().min(1),
  axes: z.object(Object.fromEntries(AXIS_IDS.map((id) => [id, AxisFlavorSchema])) as Record<(typeof AXIS_IDS)[number], typeof AxisFlavorSchema>),
  /** 得意な軸から伸ばす軸までの環の距離 0〜3 に対する「伸ばしやすさ」の割合（演出） */
  affinity: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  /** 水見式のグラスの 3D モデル（glass / water / leaf を含む glTF）。無ければ文字だけで見せる */
  glass: z.string().min(1).optional(),
});
export type Diagnosis = z.infer<typeof DiagnosisSchema>;

/** 修行の型と補助の呼び名（無ければ標準の言葉）。仕様は docs/spec/training.md */
export const TrainSchema = z.object({
  names: z.object({ zetsu: z.string().min(1), ren: z.string().min(1), hatsu: z.string().min(1) }),
  aids: z.object({ gyo: z.string().min(1), en: z.string().min(1) }),
});
export type TrainFlavor = z.infer<typeof TrainSchema>;

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
  /** ゲームの入口（オープニング・タイトル）。無ければ入口は出さず、ホームから始まる */
  title: z
    .object({
      heading: z.string().min(1),
      subheading: z.string().min(1),
      /** タイトルに大きく出す絵（アプリからの相対パス）と、その説明 */
      art: z.string().min(1).optional(),
      artAlt: z.string().min(1).optional(),
    })
    .optional(),
  /** BGM と効果音（アプリからの相対パス）。無ければ無音 */
  audio: z
    .object({
      /** オープニングの爆発の効果音 */
      stinger: z.string().min(1).optional(),
      /** 選択・決定の効果音 */
      confirm: z.string().min(1).optional(),
      /** オープニング〜タイトルメニューの BGM */
      title: z.string().min(1).optional(),
      /** ステージ選択・設定の BGM */
      stage: z.string().min(1).optional(),
      /** 練習・ボス戦の BGM */
      game: z.string().min(1).optional(),
    })
    .optional(),
  /** ホームに出す 3D の演出（glTF のモデル。アプリからの相対パス）。無ければ出さない */
  hero: z.object({ centerpiece: z.string().min(1), orbiter: z.string().min(1) }).optional(),
  /**
   * 打鍵の手応え（コンボの段階）。連続正打の数で段階が上がり、お題の周りの光が強くなる。
   * 無ければ出さない。`at` は 0 から始まり、昇順。
   */
  feel: z
    .object({
      levels: z
        .array(z.object({ at: z.number().int().min(0), name: z.string().min(1) }))
        .min(1)
        .refine((l) => l[0]?.at === 0 && l.every((x, i) => i === 0 || x.at > (l[i - 1]?.at ?? 0)), {
          message: '段階は 0 から始まり、昇順であること',
        }),
    })
    .optional(),
  /** 6 軸診断の見せ方（作品の言葉への対応）。無ければ、軸の名前だけで見せる */
  diagnosis: DiagnosisSchema.optional(),
  /** 縛りの見出し（無ければ「縛り」） */
  vowsHeading: z.string().min(1).optional(),
  /** 修行の型（絶・練・発）と補助（凝・円）の呼び名 */
  train: TrainSchema.optional(),
  /** ステージ選択の章。無ければステージ選択は出ない */
  chapters: z.array(ChapterSchema).optional(),
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
