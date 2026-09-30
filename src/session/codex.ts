import type { SessionRecord } from '@/metrics';
import { RANK_MIN_ACCURACY } from '@/metrics';

/** 習熟に必要な、その語を打ち始めた回数 */
export const CODEX_MASTER_TYPED = 3;

export type CodexStage = 'unseen' | 'seen' | 'mastered';

export interface WordProgress {
  /** その語を打ち始めた回数（記録ごとの語の出現） */
  readonly typed: number;
  readonly attempts: number;
  readonly misses: number;
}

const EMPTY: WordProgress = { typed: 0, attempts: 0, misses: 0 };

/**
 * 記録から、語（正規化した読み）ごとの進み具合を数える。仕様は docs/spec/codex.md。
 * 呼び出し側で、縛り付きの記録を除いておく（plainRecords）。
 */
export function wordProgress(records: readonly SessionRecord[]): Map<string, WordProgress> {
  const out = new Map<string, { typed: number; attempts: number; misses: number }>();
  for (const r of records) {
    const startedItems = new Set<number>();
    for (const k of r.keystrokes) {
      const reading = r.targets[k.item];
      if (reading === undefined) continue;
      const w = out.get(reading) ?? { typed: 0, attempts: 0, misses: 0 };
      if (!startedItems.has(k.item)) {
        startedItems.add(k.item);
        w.typed++;
      }
      if (k.expected !== null) {
        w.attempts++;
        if (!k.correct) w.misses++;
      }
      out.set(reading, w);
    }
  }
  return out;
}

export const progressOf = (all: ReadonlyMap<string, WordProgress>, reading: string): WordProgress => all.get(reading) ?? EMPTY;

/** 正確率（打鍵が無ければ null） */
export function accuracyOf(p: WordProgress): number | null {
  return p.attempts === 0 ? null : (p.attempts - p.misses) / p.attempts;
}

export function codexStage(p: WordProgress): CodexStage {
  if (p.typed === 0) return 'unseen';
  const acc = accuracyOf(p);
  return p.typed >= CODEX_MASTER_TYPED && acc !== null && acc >= RANK_MIN_ACCURACY ? 'mastered' : 'seen';
}

export interface CodexSummary {
  readonly total: number;
  readonly seen: number;
  readonly mastered: number;
}

/** 読み（正規化済み）の並びから、遭遇・習熟の数を数える */
export function summarizeCodex(readings: readonly string[], all: ReadonlyMap<string, WordProgress>): CodexSummary {
  let seen = 0;
  let mastered = 0;
  for (const reading of readings) {
    const stage = codexStage(progressOf(all, reading));
    if (stage !== 'unseen') seen++;
    if (stage === 'mastered') mastered++;
  }
  return { total: readings.length, seen, mastered };
}
