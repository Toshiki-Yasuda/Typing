/**
 * Mozc 表から許容表を作るときの調整。仕様: docs/spec/input-rules.md
 * 除外は理由付きで明示する。理由のない除外は認めない。
 */

export interface Exclusion {
  readonly input: string;
  readonly reason: string;
}

export const EXCLUDED_ROWS: readonly Exclusion[] = [
  // 矢印・記号ショートカット（出題しない）
  { input: 'zh', reason: '矢印（←）は出題しない' },
  { input: 'zj', reason: '矢印（↓）は出題しない' },
  { input: 'zk', reason: '矢印（↑）は出題しない' },
  { input: 'zl', reason: '矢印（→）は出題しない' },
  { input: 'z.', reason: '「…」は出題しない' },
  { input: 'z,', reason: '「‥」は出題しない' },
  { input: 'z-', reason: '「〜」は `~` で打つ（重複を避ける）' },
  { input: 'z[', reason: '「『」は出題しない' },
  { input: 'z]', reason: '「』」は出題しない' },
  // 出題しない文字
  { input: 'xka', reason: '「ヵ」は出題しない' },
  { input: 'lka', reason: '「ヵ」は出題しない' },
  { input: 'xke', reason: '「ヶ」は出題しない' },
  { input: 'lke', reason: '「ヶ」は出題しない' },
  { input: 'wyi', reason: '「ゐ」は出題しない' },
  { input: 'wye', reason: '「ゑ」は出題しない' },
  // 誤入力を誘発する重ね打ち
  { input: 'll', reason: '`l` の重ね打ちで「っ」は誤入力を誘発する' },
  { input: 'xx', reason: '`x` の重ね打ちで「っ」は誤入力を誘発する' },
  // Mozc 固有の特殊行
  { input: 'www', reason: 'Mozc 固有の特殊行（w を3回打つと「w」+次入力 ww）。判定に不要' },
];

/**
 * 同じ長さの打鍵列が複数あるときの優先順（表示ガイドに使う）。
 * 短い打鍵列を優先し、同数のときは訓令式寄りで先に並べる。
 */
export const PREFERRED_KEYS: readonly string[] = [
  // 最短が同数のとき、先に並べる（訓令式寄り・打ちやすい方）
  'nn', 'hu', 'xa', 'xi', 'xu', 'xe', 'xo', 'xya', 'xyu', 'xyo', 'xwa',
  'ka', 'ku', 'ko', 'si', 'se', 'zi', 'zyi',
  'sya', 'syu', 'sye', 'syo',
  'tya', 'cha', 'tyu', 'chu', 'tye', 'che', 'tyo', 'cho', 'tyi',
  'thi', 'dhi', 'twu', 'dwu',
];
