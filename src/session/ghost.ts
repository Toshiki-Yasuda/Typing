import { computeMetrics, type SessionRecord } from '@/metrics';

/**
 * 過去の記録を再生する「ゴースト」。同じお題を打った記録との並走に使う。
 *
 * 位置は「お題の何個分進んだか」（0〜お題数）。お題ごとに、正打鍵が何割済んだかで按分する。
 * 経路（si / shi など）が違っても、お題の境界では必ず一致するので、比較できる。
 */
export interface Ghost {
  readonly record: SessionRecord;
  readonly totalItems: number;
  /** 記録の最後の正打の時刻（セッション開始からのミリ秒） */
  readonly finishedAtMs: number;
  /** elapsedMs 時点のゴーストの位置 */
  positionAt(elapsedMs: number): number;
  /** ゴーストが position に到達した時刻（ミリ秒）。到達しない記録なら null */
  timeToReach(position: number): number | null;
}

interface Step {
  readonly t: number;
  /** この時点までの位置（累積） */
  readonly position: number;
}

export function createGhost(record: SessionRecord): Ghost {
  const totalItems = record.targets.length;
  const correctByItem = new Map<number, number[]>();
  for (const k of record.keystrokes) {
    if (!k.correct) continue;
    const list = correctByItem.get(k.item) ?? [];
    list.push(k.t);
    correctByItem.set(k.item, list);
  }

  const events: { t: number; delta: number }[] = [];
  for (const times of correctByItem.values()) {
    for (const t of times) events.push({ t, delta: 1 / times.length });
  }
  events.sort((a, b) => a.t - b.t);

  const steps: Step[] = [];
  let position = 0;
  for (const e of events) {
    position += e.delta;
    steps.push({ t: e.t, position });
  }

  return {
    record,
    totalItems,
    finishedAtMs: steps.at(-1)?.t ?? 0,
    positionAt(elapsedMs) {
      let result = 0;
      for (const s of steps) {
        if (s.t > elapsedMs) break;
        result = s.position;
      }
      return result;
    },
    timeToReach(target) {
      if (target <= 0) return 0;
      // 浮動小数の誤差（1/3 を3回足して 1 に届かない等）を許す
      const step = steps.find((s) => s.position >= target - 1e-9);
      return step ? step.t : null;
    },
  };
}

/** 今の練習の位置（お題の何個分進んだか）。ガイドの打鍵済み／残りの比で、お題の中を按分する */
export function userPosition(view: {
  index: number;
  finished: boolean;
  total: number;
  guide: { typed: string; remaining: number };
}): number {
  if (view.finished) return view.total;
  const typed = view.guide.typed.length;
  const denominator = typed + view.guide.remaining;
  return view.index + (denominator > 0 ? typed / denominator : 0);
}

/**
 * ゴーストとの差（ミリ秒）。正ならゴーストより先行、負なら遅れ。
 * ゴーストがその位置に着いた時刻から、自分がそこに着いた時刻を引く。到達していない記録なら null。
 */
export function aheadMs(ghost: Ghost, position: number, elapsedMs: number): number | null {
  const reached = ghost.timeToReach(position);
  return reached === null ? null : reached - elapsedMs;
}

/** お題の並びが完全に一致する記録のうち、最も速い（実効速度が最大の）もの */
export function findBestRecord(
  records: readonly SessionRecord[],
  targets: readonly string[],
): SessionRecord | null {
  let best: { record: SessionRecord; kpm: number } | null = null;
  for (const record of records) {
    if (record.targets.length !== targets.length || record.targets.some((t, i) => t !== targets[i])) continue;
    const kpm = computeMetrics(record.keystrokes).kpm;
    if (kpm <= 0) continue;
    if (!best || kpm > best.kpm) best = { record, kpm };
  }
  return best?.record ?? null;
}
