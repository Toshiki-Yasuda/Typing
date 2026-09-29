/** ゲームの打鍵として扱うかの判定に必要な、KeyboardEvent の最小部分 */
export interface KeyEventLike {
  readonly key: string;
  readonly repeat: boolean;
  readonly isComposing: boolean;
  readonly keyCode?: number;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}

/**
 * 打鍵として扱わない入力（仕様: docs/spec/metrics.md §3）。
 * - 押しっぱなしの自動連打（repeat）
 * - IME 変換中（isComposing / keyCode 229。実装によって片方しか立たないため両方見る）
 * - Ctrl / Alt / Meta との併用（ブラウザのショートカットを妨げない）
 * - 1文字でないキー（Shift・Enter・Backspace 等）
 */
export function isGameKey(e: KeyEventLike): boolean {
  if (e.repeat || e.isComposing || e.keyCode === 229) return false;
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  return e.key.length === 1;
}
