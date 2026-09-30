import { computeMetrics } from './compute';
import type { Keystroke } from './types';

/** 練習中に見せる数字（ライブ HUD 用）。null は「まだ出せない」 */
export interface LiveMetrics {
  /** 実効速度（打鍵/分）。計算に使える打鍵間隔がまだ無ければ null */
  readonly kpm: number | null;
  /** 正確率 0〜1。打鍵がまだ無ければ null */
  readonly accuracy: number | null;
  readonly misses: number;
  /** 経過秒（切り捨て） */
  readonly elapsedSec: number;
}

/**
 * 打鍵ログから、練習中の表示用の数字を出す純関数。
 * 定義は `computeMetrics` と同じもの（実効速度・正確率・ミス数）を使い、二重に定義しない。
 * @param nowMs セッション開始からの相対ミリ秒（`Keystroke.t` と同じ基準）
 */
export function liveMetrics(keystrokes: readonly Keystroke[], nowMs: number): LiveMetrics {
  const m = computeMetrics(keystrokes);
  return {
    kpm: m.activeMs > 0 ? m.kpm : null,
    accuracy: m.total > 0 ? m.accuracy : null,
    misses: m.misses,
    elapsedSec: Math.max(0, Math.floor(nowMs / 1000)),
  };
}
