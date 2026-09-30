import type { Keystroke } from '@/metrics';
import { keysOfTarget } from './adaptive';

/** 修行の型。仕様は docs/spec/training.md */
export const TRAIN_KINDS = ['zetsu', 'ren', 'hatsu'] as const;
export type TrainKind = (typeof TRAIN_KINDS)[number];

/** 練の制限時間（ミリ秒） */
export const REN_LIMIT_MS = 60_000;
/** 発が狙う弱点キーの数 */
export const HATSU_KEYS = 3;

export const trainMode = (kind: TrainKind): string => `train:${kind}`;

export function parseTrainMode(mode: string): TrainKind | null {
  if (!mode.startsWith('train:')) return null;
  const kind = mode.slice('train:'.length);
  return (TRAIN_KINDS as readonly string[]).includes(kind) ? (kind as TrainKind) : null;
}

export type ZetsuRank = 'S' | 'A' | 'B' | 'C';

/** 絶の段階。ミスの数だけで決める */
export function zetsuRank(misses: number): ZetsuRank {
  if (misses <= 0) return 'S';
  if (misses <= 2) return 'A';
  if (misses <= 5) return 'B';
  return 'C';
}

/** 練の残り時間。開始 startMs・現在 nowMs はどちらも同じ時間軸のミリ秒（注入する）。0 未満にならない */
export function remainingMs(startMs: number, nowMs: number, limitMs: number = REN_LIMIT_MS): number {
  return Math.max(0, limitMs - (nowMs - startMs));
}

/**
 * 打ち切ったお題の数。最後に打ち始めたお題は、打ち終えたか分からないので数えない
 * （お題は順に進むので、それより前のお題はすべて打ち終えている）。
 */
export function wordsCompleted(keystrokes: readonly Keystroke[]): number {
  let last = 0;
  for (const k of keystrokes) last = Math.max(last, k.item);
  return keystrokes.length === 0 ? 0 : last;
}

export interface Technique {
  /** 狙う弱点キー（弱い順） */
  readonly keys: readonly string[];
  /** 技の名前。最も弱いキーから付ける */
  readonly name: string;
}

/** 弱点（キー→弱さ）から技を作る。弱さが正のキーが無ければ null（記録が足りない） */
export function technique(weakness: ReadonlyMap<string, number>, count: number = HATSU_KEYS): Technique | null {
  const ranked = [...weakness]
    .filter(([key, w]) => w > 0 && key.length === 1 && key !== ' ')
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, count)
    .map(([key]) => key);
  const head = ranked[0];
  return head === undefined ? null : { keys: ranked, name: `『${head}』の型` };
}

/**
 * 技のキーを多く含むお題を、得点の高い順に n 個（同点は乱数）。
 * 得点 = 最短経路のキーのうち、技のキーの弱さの合計。得点 0 のお題は、足りないときだけ埋めに使う。
 */
export function pickTechniqueItems<T extends { reading: string }>(
  items: readonly T[],
  n: number,
  tech: Technique,
  weakness: ReadonlyMap<string, number>,
  random: () => number = Math.random,
): T[] {
  const set = new Set(tech.keys);
  const scored = items.map((item) => ({
    item,
    score: keysOfTarget(item.reading).reduce((s, k) => (set.has(k) ? s + (weakness.get(k) ?? 0) : s), 0),
    tie: random(),
  }));
  scored.sort((a, b) => b.score - a.score || a.tie - b.tie);
  return scored.slice(0, n).map((s) => s.item);
}
