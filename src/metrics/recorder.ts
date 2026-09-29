import { getGuide, press, type Outcome, type TypingState } from '@/engine';
import type { Keystroke } from './types';

export interface RecordedPress {
  readonly state: TypingState;
  readonly outcome: Outcome;
  /** ignored のときは null（ログに残さない） */
  readonly keystroke: Keystroke | null;
}

/**
 * エンジンに1打鍵を渡し、打鍵ログの1件を作る。
 * @param t セッション開始からの相対ミリ秒
 * @param item 何番目のお題か
 */
export function recordPress(
  state: TypingState,
  input: { key: string; code: string },
  t: number,
  item: number,
): RecordedPress {
  const result = press(state, input.key);
  if (result.outcome === 'ignored') return { state, outcome: 'ignored', keystroke: null };

  const correct = result.outcome !== 'miss';
  const expected = correct ? result.state.typed.slice(-1) : getGuide(state).rest.charAt(0) || null;
  return {
    state: result.state,
    outcome: result.outcome,
    keystroke: { t, key: input.key, code: input.code, expected, correct, item },
  };
}
