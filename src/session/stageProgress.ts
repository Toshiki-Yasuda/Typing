import { computeMetrics, type SessionRecord } from '@/metrics';

/** ステージのクリア基準（仮）: 正確率がこの値以上で打ち切ること。速度は問わない */
export const STAGE_CLEAR_ACCURACY = 0.9;

/** ステージの練習を記録するときのモード */
export const stageMode = (stageId: string) => `stage:${stageId}`;

export interface StageProgress {
  readonly attempts: number;
  /** 最も高かった正確率（挑戦が無ければ null） */
  readonly bestAccuracy: number | null;
  readonly cleared: boolean;
}

export const isStageCleared = (accuracy: number) => accuracy >= STAGE_CLEAR_ACCURACY;

/** 記録（打鍵ログ）から、そのステージの戦績を求める。戦績は保存せず、毎回ログから計算する */
export function stageProgress(records: readonly SessionRecord[], stageId: string): StageProgress {
  const mode = stageMode(stageId);
  let attempts = 0;
  let best: number | null = null;
  for (const r of records) {
    if (r.mode !== mode) continue;
    attempts++;
    const accuracy = computeMetrics(r.keystrokes).accuracy;
    if (best === null || accuracy > best) best = accuracy;
  }
  return { attempts, bestAccuracy: best, cleared: best !== null && isStageCleared(best) };
}
