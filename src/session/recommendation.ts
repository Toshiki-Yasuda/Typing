import { RANK_MIN_ACCURACY, RANK_MIN_KEYSTROKES, type SessionSummary } from '@/metrics';
import type { TrainKind } from './training';

/** 何回分を見るか */
export const RECOMMEND_WINDOW = 3;

export interface Recommendation {
  readonly kind: 'careful' | 'speed';
  /** 根拠の数値を含む一文 */
  readonly message: string;
  /** 勧める修行の型 */
  readonly train: TrainKind;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * 次にやると良い練習。仕様は docs/spec/recommendation.md。
 * @param summaries 開始時刻の昇順（summarizeSessions の結果）
 */
export function recommendation(summaries: readonly SessionSummary[]): Recommendation | null {
  const recent = summaries.filter((s) => s.total >= RANK_MIN_KEYSTROKES).slice(-RECOMMEND_WINDOW);
  if (recent.length < RECOMMEND_WINDOW) return null;
  const accuracies = recent.map((s) => s.accuracy);
  const mid = median(accuracies);
  if (mid < RANK_MIN_ACCURACY) {
    return {
      kind: 'careful',
      message: `直近 ${RECOMMEND_WINDOW} 回の正確率の中央値は ${pct(mid)}（基準 ${pct(RANK_MIN_ACCURACY)}）です。速さより、ミスなく打つことを優先しましょう。`,
      train: 'zetsu',
    };
  }
  if (accuracies.every((a) => a >= RANK_MIN_ACCURACY)) {
    return {
      kind: 'speed',
      message: `直近 ${RECOMMEND_WINDOW} 回とも正確率 ${pct(RANK_MIN_ACCURACY)} 以上です。少し速さに挑戦してみましょう。`,
      train: 'ren',
    };
  }
  return null;
}
