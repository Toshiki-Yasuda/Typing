import { mergeKeyStats } from './history';
import { keyStats, type KeyStat } from './stats';
import type { Keystroke } from './types';

/**
 * キーごとの「弱さ」（0 以上。大きいほど苦手）。
 * - ミス率と、全体平均に対する遅延の比の、2つから作る
 * - 試行回数が少ないキーは推定が不安定なので、全体の平均に寄せる（縮小推定）
 */
export interface WeaknessOptions {
  /** 何回分の「平均的な実績」を事前に持たせるか。大きいほど、少ない試行の影響が小さくなる */
  priorAttempts?: number;
}

/**
 * @param sessions セッションごとの打鍵ログ。遅延はセッションごとに求めて合算する
 *                 （連結すると、セッションの境界で時刻がリセットされて偽の連続2打鍵ができるため）
 */
export function keyWeakness(
  sessions: readonly (readonly Keystroke[])[],
  { priorAttempts = 10 }: WeaknessOptions = {},
): Map<string, number> {
  const stats = [...mergeKeyStats(sessions.map((s) => keyStats(s))).values()];
  if (stats.length === 0) return new Map();

  const totalAttempts = stats.reduce((s, k) => s + k.attempts, 0);
  const totalMisses = stats.reduce((s, k) => s + k.misses, 0);
  const globalMissRate = totalMisses / totalAttempts;

  const timed = stats.filter((k): k is KeyStat & { meanLatencyMs: number } => k.meanLatencyMs !== null);
  const globalLatency = timed.length
    ? timed.reduce((s, k) => s + k.meanLatencyMs * k.latencyCount, 0) / timed.reduce((s, k) => s + k.latencyCount, 0)
    : null;

  const result = new Map<string, number>();
  for (const k of stats) {
    // ミス率: 事前分布（全体のミス率を priorAttempts 回分）と混ぜる
    const missRate = (k.misses + globalMissRate * priorAttempts) / (k.attempts + priorAttempts);
    // 遅延: 全体平均に対する比（データが無ければ 1）。同じく事前分布と混ぜる
    let latencyRatio = 1;
    if (globalLatency !== null && k.meanLatencyMs !== null) {
      const mean = (k.meanLatencyMs * k.latencyCount + globalLatency * priorAttempts) / (k.latencyCount + priorAttempts);
      latencyRatio = mean / globalLatency;
    }
    // ミスは強く効かせる（練習では正確さを優先する）
    result.set(k.key, missRate * 10 + Math.max(0, latencyRatio - 1));
  }
  return result;
}
