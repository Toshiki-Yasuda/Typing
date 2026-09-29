import type { ContentItem, ContentPack } from '@/content';
import { computeMetrics, type SessionRecord } from '@/metrics';

/**
 * 記録のお題（読み）から、出題できる形（表記つき）に戻す。
 * パックに見つかれば表記を復元し、見つからなければ（パックが削除された等）読みをそのまま表記にする。
 */
export function itemsForTargets(targets: readonly string[], packs: readonly ContentPack[]): ContentItem[] {
  const byReading = new Map<string, ContentItem>();
  for (const pack of packs) for (const item of pack.items) if (!byReading.has(item.reading)) byReading.set(item.reading, item);
  return targets.map((reading) => byReading.get(reading) ?? { display: reading, reading });
}

export interface Comparison {
  /** 今回を除く、同じお題の記録のうち最速のもの */
  readonly best: SessionRecord;
  readonly bestKpm: number;
  readonly currentKpm: number;
  /** 今回の速度 − 過去最高の速度（正なら更新） */
  readonly diffKpm: number;
}

/** 同じお題（並びも一致）の過去の記録と比べる。過去の記録が無ければ null */
export function compareWithBest(records: readonly SessionRecord[], current: SessionRecord): Comparison | null {
  const currentKpm = computeMetrics(current.keystrokes).kpm;
  let best: { record: SessionRecord; kpm: number } | null = null;
  for (const r of records) {
    if (r.id === current.id) continue;
    if (r.targets.length !== current.targets.length || r.targets.some((t, i) => t !== current.targets[i])) continue;
    const kpm = computeMetrics(r.keystrokes).kpm;
    if (kpm <= 0) continue;
    if (!best || kpm > best.kpm) best = { record: r, kpm };
  }
  return best ? { best: best.record, bestKpm: best.kpm, currentKpm, diffKpm: currentKpm - best.kpm } : null;
}
