/** 光の呼吸が最大になる連続正打の数 */
export const RHYTHM_FULL_AT = 30;

/**
 * 直近の連続正打の数（streak）から、舞台の後ろの光の強さ（0〜1）を決める。
 * 0 打で 0、RHYTHM_FULL_AT 打で 1、その間は直線。負・小数・NaN は 0 として扱う。
 * 明るさだけを表す値で、色や判定には関わらない。
 */
export function rhythmLevel(streak: number): number {
  if (!Number.isFinite(streak) || streak <= 0) return 0;
  return Math.min(1, streak / RHYTHM_FULL_AT);
}

/** 打鍵の結果から、次の連続正打の数を求める。ミスで途切れる（語の完了・練習の完了は正打） */
export function nextStreak(streak: number, result: 'ok' | 'miss' | 'wordDone' | 'sessionDone'): number {
  return result === 'miss' ? 0 : streak + 1;
}
