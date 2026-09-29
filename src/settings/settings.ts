import { z } from 'zod';

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
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = { packId: 'basic', count: 10, adaptive: true };

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
