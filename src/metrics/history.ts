import { minKeystrokes } from '@/engine';
import { computeMetrics } from './compute';
import { bigramStats, confusionMatrix, keyStats, type BigramStat, type KeyStat } from './stats';
import type { SessionRecord } from './types';

export interface SessionSummary {
  readonly id: string;
  readonly startedAt: number;
  readonly mode: string;
  readonly kpm: number;
  readonly accuracy: number;
  readonly consistency: number | null;
  readonly efficiency: number | null;
  readonly total: number;
  readonly misses: number;
}

/** 1セッションの指標。開始時刻の昇順で返す */
export function summarizeSessions(records: readonly SessionRecord[]): SessionSummary[] {
  return records
    .map((r) => {
      const min = r.targets.reduce((sum, t) => sum + minKeystrokes(t), 0);
      const m = computeMetrics(r.keystrokes, { minKeystrokes: min });
      return {
        id: r.id,
        startedAt: r.startedAt,
        mode: r.mode,
        kpm: m.kpm,
        accuracy: m.accuracy,
        consistency: m.consistency,
        efficiency: m.efficiency,
        total: m.total,
        misses: m.misses,
      };
    })
    .sort((a, b) => a.startedAt - b.startedAt);
}

const DAY_MS = 86_400_000;

/** 日付キー（YYYY-MM-DD）。offsetMinutes は UTC からの東向きのずれ（既定は実行環境のタイムゾーン） */
export function dayKey(ts: number, offsetMinutes: number = -new Date(ts).getTimezoneOffset()): string {
  return new Date(ts + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

const shiftDay = (key: string, days: number): string =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * 連続して練習した日数。今日やっていなければ昨日までの連続を数える
 * （今日はまだ終わっていないので、途切れたとはみなさない）。
 */
export function currentStreak(days: Iterable<string>, today: string): number {
  const set = new Set(days);
  let cursor = set.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

/** 直近 days 日のセッションだけに絞る。null なら全期間 */
export function withinDays(records: readonly SessionRecord[], days: number | null, now: number): SessionRecord[] {
  return days === null ? [...records] : records.filter((r) => r.startedAt >= now - days * DAY_MS);
}

export function mergeKeyStats(list: Iterable<ReadonlyMap<string, KeyStat>>): Map<string, KeyStat> {
  const acc = new Map<string, { attempts: number; misses: number; sum: number; n: number }>();
  for (const stats of list) {
    for (const s of stats.values()) {
      const a = acc.get(s.key) ?? { attempts: 0, misses: 0, sum: 0, n: 0 };
      a.attempts += s.attempts;
      a.misses += s.misses;
      if (s.meanLatencyMs !== null) {
        a.sum += s.meanLatencyMs * s.latencyCount;
        a.n += s.latencyCount;
      }
      acc.set(s.key, a);
    }
  }
  return new Map(
    [...acc].map(([key, a]) => [
      key,
      { key, attempts: a.attempts, misses: a.misses, meanLatencyMs: a.n ? a.sum / a.n : null, latencyCount: a.n },
    ]),
  );
}

export function mergeBigramStats(list: Iterable<ReadonlyMap<string, BigramStat>>): Map<string, BigramStat> {
  const acc = new Map<string, { count: number; sum: number }>();
  for (const stats of list) {
    for (const s of stats.values()) {
      const a = acc.get(s.bigram) ?? { count: 0, sum: 0 };
      a.count += s.count;
      a.sum += s.meanLatencyMs * s.count;
      acc.set(s.bigram, a);
    }
  }
  return new Map([...acc].map(([bigram, a]) => [bigram, { bigram, count: a.count, meanLatencyMs: a.sum / a.count }]));
}

export interface Confusion {
  readonly expected: string;
  readonly actual: string;
  readonly count: number;
}

export interface Aggregate {
  readonly keys: Map<string, KeyStat>;
  readonly bigrams: Map<string, BigramStat>;
  /** 回数の多い順 */
  readonly confusions: Confusion[];
}

/**
 * 複数セッションの集計。遅延はセッションごとに求めてから合算する
 * （セッションをまたぐと時刻がリセットされるため、打鍵を連結して数えてはいけない）。
 */
export function aggregate(records: readonly SessionRecord[]): Aggregate {
  const confusion = new Map<string, number>();
  for (const r of records) {
    for (const [expected, row] of confusionMatrix(r.keystrokes)) {
      for (const [actual, n] of row) confusion.set(`${expected}\t${actual}`, (confusion.get(`${expected}\t${actual}`) ?? 0) + n);
    }
  }
  return {
    keys: mergeKeyStats(records.map((r) => keyStats(r.keystrokes))),
    bigrams: mergeBigramStats(records.map((r) => bigramStats(r.keystrokes))),
    confusions: [...confusion]
      .map(([k, count]) => {
        const [expected = '', actual = ''] = k.split('\t');
        return { expected, actual, count };
      })
      .sort((a, b) => b.count - a.count),
  };
}
