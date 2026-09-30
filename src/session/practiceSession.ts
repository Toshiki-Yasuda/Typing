import { ENGINE_VERSION, RULE_VERSION } from '@/engine/version';
import { getGuide, minKeystrokes, normalizeTarget, startTyping, type Guide, type TypingState } from '@/engine';
import { computeMetrics, recordPress, type Keystroke, type Metrics, type SessionRecord } from '@/metrics';
import type { ContentItem } from '@/content';
import { userPosition } from './ghost';

export type PressEvent = 'ok' | 'miss' | 'wordDone' | 'sessionDone' | 'ignored';

export interface SessionView {
  readonly item: ContentItem;
  readonly index: number;
  readonly total: number;
  readonly guide: Guide;
  readonly finished: boolean;
  /** 次のお題（最後のお題なら null）。先読みの表示用 */
  readonly next: ContentItem | null;
}

/**
 * 1回の練習（複数のお題を順に打つ）を進める。DOM に依存しない。
 * 打鍵ログはここに溜め、終わったら SessionRecord にして保存する。
 */
export class PracticeSession {
  private readonly items: readonly ContentItem[];
  private index = 0;
  private engine: TypingState;
  private readonly log: Keystroke[] = [];
  private finished = false;

  constructor(
    items: readonly ContentItem[],
    /** 開始時刻（`performance.now()` と同じ時間軸）。打鍵の t はこれからの相対ミリ秒 */
    private readonly startedAtPerf: number,
    readonly meta: { id: string; startedAt: number; mode: string; contentId: string; vows?: readonly string[] },
  ) {
    if (items.length === 0) throw new Error('お題がありません');
    this.items = items;
    this.engine = startTyping(normalizeTarget(items[0]?.reading ?? ''));
  }

  /** @param timeStamp `KeyboardEvent.timeStamp`（`performance.now()` と同じ時間軸） */
  press(input: { key: string; code: string }, timeStamp: number): PressEvent {
    if (this.finished) return 'ignored';
    const r = recordPress(this.engine, input, timeStamp - this.startedAtPerf, this.index);
    if (r.keystroke) this.log.push(r.keystroke);
    if (r.outcome === 'ignored') return 'ignored';
    this.engine = r.state;
    if (r.outcome === 'miss') return 'miss';
    if (r.outcome === 'ok') return 'ok';

    this.index++;
    if (this.index >= this.items.length) {
      this.finished = true;
      return 'sessionDone';
    }
    this.engine = startTyping(normalizeTarget(this.items[this.index]?.reading ?? ''));
    return 'wordDone';
  }

  view(): SessionView {
    const shown = Math.min(this.index, this.items.length - 1);
    return {
      item: this.items[shown] as ContentItem,
      index: shown,
      total: this.items.length,
      guide: getGuide(this.engine),
      finished: this.finished,
      next: this.items[shown + 1] ?? null,
    };
  }

  get keystrokes(): readonly Keystroke[] {
    return this.log;
  }

  /** セッション開始からの経過ミリ秒（`now` は performance.now() と同じ時間軸） */
  elapsedMs(now: number): number {
    return now - this.startedAtPerf;
  }

  /** 今の位置（お題の何個分進んだか）。ゴーストとの比較に使う */
  position(): number {
    return userPosition(this.view());
  }

  /** 全お題の理論最小打鍵数 */
  get minKeystrokesTotal(): number {
    return this.items.reduce((sum, item) => sum + minKeystrokes(normalizeTarget(item.reading)), 0);
  }

  metrics(): Metrics {
    return computeMetrics(this.log, { minKeystrokes: this.minKeystrokesTotal });
  }

  /**
   * 記録にする。途中で終わった（ボス戦の敗北など）ときは、打ち始めたお題までを targets にする
   * （打鍵ログと targets の対応を保つため）。
   */
  toRecord(): SessionRecord {
    const upTo = this.finished ? this.items.length : Math.min(this.index + 1, this.items.length);
    return {
      ...this.meta,
      targets: this.items.slice(0, upTo).map((i) => normalizeTarget(i.reading)),
      engineVersion: ENGINE_VERSION,
      ruleVersion: RULE_VERSION,
      keystrokes: [...this.log],
    };
  }
}

/** 重複なく n 個を無作為に選ぶ（Fisher–Yates） */
export function pickItems<T>(items: readonly T[], n: number, random: () => number = Math.random): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j] as T, pool[i] as T];
  }
  return pool.slice(0, n);
}
