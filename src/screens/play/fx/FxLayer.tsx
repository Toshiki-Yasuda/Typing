import type { PressFx } from '../types';

/**
 * 打鍵に合わせた演出の層（粒子・達成のピーク・光の呼吸）。U5（担当G）のファイル。いまは何も描かない。
 * 画面全体の上に重ねる（position: fixed; inset: 0; pointer-events: none; aria-hidden）。判定・入力に触れない。
 * 演出の強さ（標準/控えめ/オフ）と prefers-reduced-motion に従う。
 */
export function FxLayer({ press, index, total }: { press: PressFx | undefined; index: number; total: number }) {
  void press;
  void index;
  void total;
  return null;
}
