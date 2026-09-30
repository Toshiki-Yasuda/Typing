import { minKeystrokes } from '@/engine';
import { computeMetrics } from './compute';
import { aggregate } from './history';
import { RANK_WINDOW, countsForRank } from './rank';
import type { SessionRecord } from './types';

/**
 * 6 軸診断。仕様: docs/spec/axes.md（しきい値・目標値はすべて仮）。
 * 打鍵ログから毎回計算し、保存しない。サンプルが足りない軸は点を出さない（null）。
 * 純関数。運指は関数で受け取る（配列の設定に依存させない）。
 */

/** 環の順（六性図）。隣どうしが近く、向かいが遠い */
export const AXIS_IDS = ['speed', 'adapt', 'shape', 'steady', 'control', 'reach'] as const;
export type AxisId = (typeof AXIS_IDS)[number];

/** 得点の目標値と最低のサンプル数（仮） */
export const AXIS_PARAMS = {
  /** 速さ: この速度（打鍵/分）で満点 */
  speedFullKpm: 400,
  speedMinSessions: 3,
  /** 制御: 正確率がこの範囲で 0〜100 点 */
  controlAccuracy: [0.85, 0.99],
  controlMinKeystrokes: 200,
  /** 到達: 小指以外の遅延 ÷ 小指の遅延 が、この範囲で 0〜100 点 */
  reachRatio: [0.5, 1],
  reachMinSamples: 30,
  /** 適応: 種類ごとに、数える練習がこの回数以上あること。種類が 2 つ以上必要 */
  adaptMinSessionsPerKind: 2,
  adaptMinKinds: 2,
  /** 形: 数字・記号キーの正確率がこの範囲で 0〜100 点 */
  shapeAccuracy: [0.8, 0.98],
  shapeMinAttempts: 30,
  steadyMinSessions: 3,
  /** 診断に必要な、点の求まった軸の数 */
  minAxes: 3,
} as const;

export interface AxisResult {
  readonly id: AxisId;
  /** 0〜100。サンプルが足りなければ null（データ不足） */
  readonly score: number | null;
  /** 集めたサンプル数（単位は軸による） */
  readonly sample: number;
  /** 点を出すのに必要なサンプル数 */
  readonly needed: number;
}

export type ContentKind = 'kana' | 'english' | 'symbols' | 'phrases' | 'other';

/** contentId から内容の種類。組み込みの英字・記号・短文以外で、ステージ（c章s番号）と basic は「かな」、それ以外は自作パック */
export function contentKind(contentId: string): ContentKind {
  if (contentId === 'english' || contentId === 'symbols' || contentId === 'phrases') return contentId;
  if (contentId === 'basic' || /^c\d+s\d+$/.test(contentId)) return 'kana';
  return 'other';
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const scale = (v: number, [lo, hi]: readonly [number, number]) => clamp01((v - lo) / (hi - lo)) * 100;

function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

interface Counted {
  readonly startedAt: number;
  readonly kind: ContentKind;
  readonly kpm: number;
  readonly consistency: number | null;
}

/** 級位の判定に数える練習だけを、指標つきで取り出す（古い順） */
function countedSessions(records: readonly SessionRecord[]): Counted[] {
  const out: Counted[] = [];
  for (const r of records) {
    const min = r.targets.reduce((sum, t) => sum + minKeystrokes(t), 0);
    const m = computeMetrics(r.keystrokes, { minKeystrokes: min });
    if (!countsForRank({ kpm: m.kpm, accuracy: m.accuracy, total: m.total })) continue;
    out.push({ startedAt: r.startedAt, kind: contentKind(r.contentId), kpm: m.kpm, consistency: m.consistency });
  }
  return out.sort((a, b) => a.startedAt - b.startedAt);
}

const isPinky = (finger: string | null) => finger === 'L-pinky' || finger === 'R-pinky';

/** 遅延の加重平均（標本数つき）。標本が無ければ null */
function weightedLatency(items: readonly { mean: number; n: number }[]): { mean: number; n: number } | null {
  const n = items.reduce((s, i) => s + i.n, 0);
  return n === 0 ? null : { mean: items.reduce((s, i) => s + i.mean * i.n, 0) / n, n };
}

/**
 * 6 軸の得点を求める。
 * @param fingerOf 文字 → 打つ指（'L-pinky' など）。配列にない文字は null
 */
export function computeAxes(
  records: readonly SessionRecord[],
  fingerOf: (char: string) => string | null,
): Record<AxisId, AxisResult> {
  const P = AXIS_PARAMS;
  const counted = countedSessions(records);
  const agg = aggregate(records);

  // 速さ: 直近の数える練習の中央値
  const recent = counted.slice(-RANK_WINDOW);
  const speed: AxisResult = {
    id: 'speed',
    score: counted.length >= P.speedMinSessions ? Math.min(1, median(recent.map((c) => c.kpm)) / P.speedFullKpm) * 100 : null,
    sample: counted.length,
    needed: P.speedMinSessions,
  };

  // 制御: 全打鍵の正確率
  const total = records.reduce((s, r) => s + r.keystrokes.length, 0);
  const correct = records.reduce((s, r) => s + r.keystrokes.filter((k) => k.correct).length, 0);
  const control: AxisResult = {
    id: 'control',
    score: total >= P.controlMinKeystrokes ? scale(correct / total, P.controlAccuracy) : null,
    sample: total,
    needed: P.controlMinKeystrokes,
  };

  // 到達: 小指のキーと、それ以外（親指・配列にない文字を除く）の遅延
  const pinky: { mean: number; n: number }[] = [];
  const others: { mean: number; n: number }[] = [];
  for (const [key, stat] of agg.keys) {
    if (stat.meanLatencyMs === null || stat.latencyCount === 0) continue;
    const finger = fingerOf(key);
    if (finger === null || finger === 'thumb') continue;
    (isPinky(finger) ? pinky : others).push({ mean: stat.meanLatencyMs, n: stat.latencyCount });
  }
  const p = weightedLatency(pinky);
  const o = weightedLatency(others);
  const reachSample = Math.min(p?.n ?? 0, o?.n ?? 0);
  const reach: AxisResult = {
    id: 'reach',
    score: p && o && p.n >= P.reachMinSamples && o.n >= P.reachMinSamples ? scale(o.mean / p.mean, P.reachRatio) : null,
    sample: reachSample,
    needed: P.reachMinSamples,
  };

  // 適応: 内容の種類ごとの速度（数える練習が 2 回以上ある種類）の、最小 ÷ 最大
  const byKind = new Map<ContentKind, number[]>();
  for (const c of counted) byKind.set(c.kind, [...(byKind.get(c.kind) ?? []), c.kpm]);
  const kindSpeeds = [...byKind.values()].filter((v) => v.length >= P.adaptMinSessionsPerKind).map(median);
  const adapt: AxisResult = {
    id: 'adapt',
    score: kindSpeeds.length >= P.adaptMinKinds ? (Math.min(...kindSpeeds) / Math.max(...kindSpeeds)) * 100 : null,
    sample: kindSpeeds.length,
    needed: P.adaptMinKinds,
  };

  // 形: 数字・記号のキー（英字・スペース・長音の `-` を除く）の正確率
  let attempts = 0;
  let misses = 0;
  for (const [key, stat] of agg.keys) {
    if (/^[a-z]$/.test(key) || key === ' ' || key === '-') continue;
    attempts += stat.attempts;
    misses += stat.misses;
  }
  const shape: AxisResult = {
    id: 'shape',
    score: attempts >= P.shapeMinAttempts ? scale(1 - misses / attempts, P.shapeAccuracy) : null,
    sample: attempts,
    needed: P.shapeMinAttempts,
  };

  // 安定: 数える練習の一貫性の中央値
  const steadyValues = counted.map((c) => c.consistency).filter((v): v is number => v !== null);
  const steady: AxisResult = {
    id: 'steady',
    score: steadyValues.length >= P.steadyMinSessions ? median(steadyValues) : null,
    sample: steadyValues.length,
    needed: P.steadyMinSessions,
  };

  return { speed, adapt, shape, steady, control, reach };
}

/** 環の上の距離 0〜3（同じ=0、隣=1、向かい=3） */
export function ringDistance(a: AxisId, b: AxisId): number {
  const d = Math.abs(AXIS_IDS.indexOf(a) - AXIS_IDS.indexOf(b));
  return Math.min(d, AXIS_IDS.length - d);
}

export interface Diagnosis {
  /** 得意な軸（得点が最大。同点は環の順で先） */
  readonly strongest: AxisId;
  /** 伸ばす軸（得意な軸以外で得点が最小。同点は環の順で先） */
  readonly weakest: AxisId;
  /** 得意な軸から伸ばす軸までの環の距離 */
  readonly distance: number;
}

/** 診断。点の求まった軸が minAxes 未満なら null（データ不足） */
export function diagnose(axes: Record<AxisId, AxisResult>): Diagnosis | null {
  const scored = AXIS_IDS.map((id) => axes[id]).filter((a): a is AxisResult & { score: number } => a.score !== null);
  if (scored.length < AXIS_PARAMS.minAxes) return null;
  const strongest = scored.reduce((best, a) => (a.score > best.score ? a : best));
  const rest = scored.filter((a) => a.id !== strongest.id);
  const weakest = rest.reduce((low, a) => (a.score < low.score ? a : low));
  return { strongest: strongest.id, weakest: weakest.id, distance: ringDistance(strongest.id, weakest.id) };
}
