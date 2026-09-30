import { computeMetrics } from './compute';
import type { Keystroke } from './types';

/** 速さを出し始める最小の正打数と実効時間。少ないと数千打/分のような値になる */
export const LIVE_MIN_KEYS = 5;
export const LIVE_MIN_ACTIVE_MS = 2000;

/** 練習中に見せる数字（ライブ HUD 用）。null は「まだ出せない」 */
export interface LiveMetrics {
  /** 実効速度（打鍵/分）。打鍵が少なすぎて信頼できなければ null */
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
    kpm: m.correct >= LIVE_MIN_KEYS && m.activeMs >= LIVE_MIN_ACTIVE_MS ? m.kpm : null,
    accuracy: m.total > 0 ? m.accuracy : null,
    misses: m.misses,
    elapsedSec: Math.max(0, Math.floor(nowMs / 1000)),
  };
}
