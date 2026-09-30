import { z } from 'zod';
import { EFFECT_LEVELS } from '@/effects/level';
import { GOAL_AUTO } from '@/metrics/rank';
import { VOW_IDS } from '@/session/vows';

/** 練習の設定。localStorage に保存する（小さな設定値なので。打鍵ログは IndexedDB） */
export const SETTINGS_KEY = 'typing.settings.v1';
export const COUNT_OPTIONS = [5, 10, 20, 30] as const;

export const SettingsSchema = z.object({
  /** 出題パックの id（組み込み or 自作） */
  packId: z.string().min(1),
  /** 1回の練習で出すお題の数 */
  count: z.number().int().min(1).max(100),
  /** 過去の記録から弱点を求め、弱いキーを含むお題を優先する（記録が無ければ無視される） */
  adaptive: z.boolean(),
  /** 目標の級位。'auto' なら「次の級位」。それ以外は級位の id（rank.ts） */
  goalRank: z.string().min(1),
  /** 練習中に、次に打つキーと使う指を示す */
  fingerGuide: z.boolean(),
  /** 運指ガイドのキー配列（表示だけ。判定には影響しない） */
  layout: z.enum(['us', 'jis']),
  /** テーマの id（ロック中・不明なら中立テーマになる。記録には持たせない） */
  themeId: z.string().min(1),
  /** テーマに効果音があれば鳴らす（判定・計測には影響しない） */
  sound: z.boolean(),
  /** BGM を鳴らす（テーマに BGM があるとき） */
  bgm: z.boolean(),
  /** BGM の音量 0〜100 */
  bgmVolume: z.number().int().min(0).max(100),
  /** 効果音の音量 0〜100 */
  sfxVolume: z.number().int().min(0).max(100),
  /** 練習中の BGM。off=鳴らさない / boss=ボス戦だけ / all=すべての練習（集中したいので既定は boss） */
  gameBgm: z.enum(['off', 'boss', 'all']),
  /** 補助・凝: 弱点のキーをローマ字ガイドで強調する（表示だけ。判定には影響しない） */
  aidGyo: z.boolean(),
  /** 補助・円: 次のお題を先に見せる（表示だけ） */
  aidEn: z.boolean(),
  /** 縛り（制約と誓約）。ステージ・ボス戦に適用する。仕様は docs/spec/vows.md */
  vows: z.array(z.enum(VOW_IDS)),
  /** ハンターネーム（マイライセンスに表示。12 文字まで）。docs/spec/license.md */
  hunterName: z.string().max(12),
  /** ボスの技を使う（表示と敗北条件にだけ作用する。無効にできる）。docs/spec/boss.md */
  bossSkills: z.boolean(),
  /** 演出の強さ（見た目だけ。判定・計測には影響しない） */
  effects: z.enum(EFFECT_LEVELS),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  packId: 'basic',
  count: 10,
  adaptive: true,
  goalRank: GOAL_AUTO,
  fingerGuide: true,
  layout: 'jis',
  themeId: 'neutral',
  sound: true,
  bgm: true,
  bgmVolume: 60,
  sfxVolume: 80,
  gameBgm: 'boss',
  aidGyo: false,
  aidEn: false,
  vows: [],
  bossSkills: true,
  hunterName: '',
  effects: 'full',
};

/** localStorage を使えない環境（プライベートモード等）でも落ちないようにする */
function storageOrNull(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** 保存値を読む。壊れている・一部だけの値は、読めた項目だけを採用し、残りは既定値にする */
export function loadSettings(storage: Pick<Storage, 'getItem'> | null = storageOrNull()): Settings {
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return DEFAULT_SETTINGS;
    const merged = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      const field = SettingsSchema.shape[key].safeParse((data as Record<string, unknown>)[key]);
      if (field.success) (merged as Record<string, unknown>)[key] = field.data;
    }
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings, storage: Pick<Storage, 'setItem'> | null = storageOrNull()): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 保存できなくても、今回の練習には影響しない
  }
}
