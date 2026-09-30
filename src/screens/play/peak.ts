import type { EffectLevel } from '@/effects/level';

/** 練習を打ち終えてから結果画面へ移るまでの間（達成の演出を見せる時間）。ミリ秒 */
export const FINISH_PEAK_MS = 650;

/**
 * 結果へ移る前に待つ時間。演出「標準」のときだけ待つ（控えめ・オフ・OS の「動きを減らす」は待たない）。
 * 単体テストでは待たない（テストの待ち時間を増やさないため。待つ挙動は vi.stubEnv('MODE', 'production') で確かめる）。
 * 保存は待つ前に済ませてある。待つ間の入力は受けない（Play が finishing を立てる）。
 */
export function finishPeakMs(level: EffectLevel): number {
  return level === 'full' && import.meta.env.MODE !== 'test' ? FINISH_PEAK_MS : 0;
}
