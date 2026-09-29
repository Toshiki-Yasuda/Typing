import type { SessionSummary } from './history';

/** これ未満の練習回数の区分は「参考値」（少ないデータの誤読を避ける） */
export const MIN_SAMPLE = 3;

export interface Bucket {
  /** 時間帯なら 0〜23、曜日なら 0=月 … 6=日 */
  readonly index: number;
  /** 練習の回数 */
  readonly count: number;
  /** 実効速度の平均（速度を計算できた練習のみ） */
  readonly meanKpm: number | null;
  /** ミス率（ミス/総打鍵）の平均 */
  readonly meanMissRate: number | null;
}

interface Parts {
  readonly hour: number;
  /** 0=月 … 6=日 */
  readonly weekday: number;
}

/** offsetMinutes は UTC からの東向きのずれ（省略すると実行環境のタイムゾーン） */
function partsOf(ts: number, offsetMinutes?: number): Parts {
  if (offsetMinutes === undefined) {
    const d = new Date(ts);
    return { hour: d.getHours(), weekday: (d.getDay() + 6) % 7 };
  }
  const d = new Date(ts + offsetMinutes * 60_000);
  return { hour: d.getUTCHours(), weekday: (d.getUTCDay() + 6) % 7 };
}

function bucketize(
  summaries: readonly SessionSummary[],
  size: number,
  pick: (parts: Parts) => number,
  offsetMinutes?: number,
): Bucket[] {
  const acc = Array.from({ length: size }, () => ({ count: 0, kpmSum: 0, kpmN: 0, missSum: 0, missN: 0 }));
  for (const s of summaries) {
    const a = acc[pick(partsOf(s.startedAt, offsetMinutes))];
    if (!a) continue;
    a.count++;
    if (s.kpm > 0) {
      a.kpmSum += s.kpm;
      a.kpmN++;
    }
    if (s.total > 0) {
      a.missSum += s.misses / s.total;
      a.missN++;
    }
  }
  return acc.map((a, index) => ({
    index,
    count: a.count,
    meanKpm: a.kpmN ? a.kpmSum / a.kpmN : null,
    meanMissRate: a.missN ? a.missSum / a.missN : null,
  }));
}

/** 練習を始めた時刻の「時」（0〜23）ごとの集計。24 区分を必ず返す */
export function byHour(summaries: readonly SessionSummary[], offsetMinutes?: number): Bucket[] {
  return bucketize(summaries, 24, (p) => p.hour, offsetMinutes);
}

/** 曜日（0=月 … 6=日）ごとの集計。7 区分を必ず返す */
export function byWeekday(summaries: readonly SessionSummary[], offsetMinutes?: number): Bucket[] {
  return bucketize(summaries, 7, (p) => p.weekday, offsetMinutes);
}

export type TimeMetric = 'kpm' | 'miss';

export const valueOf = (b: Bucket, metric: TimeMetric): number | null => (metric === 'kpm' ? b.meanKpm : b.meanMissRate);

/**
 * 最も良い区分（速度は最大、ミス率は最小）。
 * 回数が MIN_SAMPLE 以上の区分が 2 つ以上あるときだけ返す（1つだけでは、比べようがない）。
 */
export function bestBucket(buckets: readonly Bucket[], metric: TimeMetric): Bucket | null {
  const eligible = buckets.filter((b) => b.count >= MIN_SAMPLE && valueOf(b, metric) !== null);
  if (eligible.length < 2) return null;
  return eligible.reduce((best, b) => {
    const v = valueOf(b, metric) as number;
    const bv = valueOf(best, metric) as number;
    return (metric === 'kpm' ? v > bv : v < bv) ? b : best;
  });
}

export const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'] as const;
