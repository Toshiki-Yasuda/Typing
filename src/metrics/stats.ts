import { cleanPairs } from './compute';
import type { Keystroke } from './types';

export interface KeyStat {
  readonly key: string;
  /** そのキーが期待された打鍵の数（正打 + 誤打） */
  readonly attempts: number;
  readonly misses: number;
  /** 直前が正打のときの、そのキーへの到達時間の平均（ミス直後・休止・お題またぎは除く） */
  readonly meanLatencyMs: number | null;
  readonly latencyCount: number;
}

export interface BigramStat {
  readonly bigram: string;
  readonly count: number;
  readonly meanLatencyMs: number;
}

/** 期待キーごとの統計。誤打鍵は「期待されていたキー」に数える */
export function keyStats(keystrokes: readonly Keystroke[]): Map<string, KeyStat> {
  const acc = new Map<string, { attempts: number; misses: number; sum: number; n: number }>();
  const get = (key: string) => {
    let a = acc.get(key);
    if (!a) acc.set(key, (a = { attempts: 0, misses: 0, sum: 0, n: 0 }));
    return a;
  };
  for (const k of keystrokes) {
    if (k.expected === null) continue;
    const a = get(k.expected);
    a.attempts++;
    if (!k.correct) a.misses++;
  }
  for (const { cur, dt } of cleanPairs(keystrokes)) {
    if (cur.expected === null) continue;
    const a = get(cur.expected);
    a.sum += dt;
    a.n++;
  }
  return new Map(
    [...acc].map(([key, a]) => [
      key,
      { key, attempts: a.attempts, misses: a.misses, meanLatencyMs: a.n ? a.sum / a.n : null, latencyCount: a.n },
    ]),
  );
}

/** 連接（直前のキー→今のキー）ごとの平均遅延 */
export function bigramStats(keystrokes: readonly Keystroke[]): Map<string, BigramStat> {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const { prev, cur, dt } of cleanPairs(keystrokes)) {
    if (prev.expected === null || cur.expected === null) continue;
    const key = prev.expected + cur.expected;
    const a = acc.get(key) ?? { sum: 0, n: 0 };
    a.sum += dt;
    a.n++;
    acc.set(key, a);
  }
  return new Map([...acc].map(([bigram, a]) => [bigram, { bigram, count: a.n, meanLatencyMs: a.sum / a.n }]));
}

/** 混同行列: 期待キー → 実際に打ったキー → 回数（誤打鍵のみ） */
export function confusionMatrix(keystrokes: readonly Keystroke[]): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>();
  for (const k of keystrokes) {
    if (k.correct || k.expected === null) continue;
    const row = matrix.get(k.expected) ?? new Map<string, number>();
    const actual = k.key.toLowerCase();
    row.set(actual, (row.get(actual) ?? 0) + 1);
    matrix.set(k.expected, row);
  }
  return matrix;
}
