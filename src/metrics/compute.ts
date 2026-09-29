import type { Keystroke, Metrics } from './types';

/** これを超える間隔は「休止」とみなし、速度のばらつき・遅延の統計から除く */
export const PAUSE_MS = 3000;

export interface CleanPair {
  readonly prev: Keystroke;
  readonly cur: Keystroke;
  readonly dt: number;
}

/**
 * 統計に使える連続2打鍵: 同じお題の中で、直前・当該とも正打で、休止でないもの。
 * 誤打鍵の直後の打鍵（ミス後の減速）と、訂正の打鍵は、遅延の推定を汚すので含めない。
 */
export function cleanPairs(keystrokes: readonly Keystroke[]): CleanPair[] {
  const pairs: CleanPair[] = [];
  for (let i = 1; i < keystrokes.length; i++) {
    const prev = keystrokes[i - 1] as Keystroke;
    const cur = keystrokes[i] as Keystroke;
    const dt = cur.t - prev.t;
    if (prev.correct && cur.correct && prev.item === cur.item && dt >= 0 && dt <= PAUSE_MS) {
      pairs.push({ prev, cur, dt });
    }
  }
  return pairs;
}

/** 変動係数（標準偏差 / 平均）を 0〜100 に写す。ばらつきが無ければ 100 */
function consistencyOf(intervals: readonly number[]): number | null {
  if (intervals.length < 3) return null;
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (mean <= 0) return null;
  const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
  const cv = Math.sqrt(variance) / mean;
  return 100 * (1 - Math.tanh(cv));
}

export function computeMetrics(
  keystrokes: readonly Keystroke[],
  options: { minKeystrokes?: number } = {},
): Metrics {
  const total = keystrokes.length;
  const correct = keystrokes.filter((k) => k.correct).length;
  const first = keystrokes[0];
  const lastCorrect = [...keystrokes].reverse().find((k) => k.correct);
  const elapsedMs = first && lastCorrect ? Math.max(0, lastCorrect.t - first.t) : 0;
  const perMinute = (n: number) => (elapsedMs > 0 ? n / (elapsedMs / 60000) : 0);
  const kpm = perMinute(correct);
  const { minKeystrokes } = options;

  return {
    total,
    correct,
    misses: total - correct,
    accuracy: total === 0 ? 1 : correct / total,
    elapsedMs,
    kpm,
    rawKpm: perMinute(total),
    wpm: kpm / 5,
    consistency: consistencyOf(cleanPairs(keystrokes).map((p) => p.dt)),
    efficiency: minKeystrokes !== undefined && total > 0 ? minKeystrokes / total : null,
  };
}
