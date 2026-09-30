/**
 * 演出の強さ。
 * - full: 動く演出
 * - reduced: 動きを止めた（静止した）演出。OS の「動きを減らす」設定のとき、full はこれになる
 * - off: 演出なし
 * 演出は描画だけで、打鍵の判定・計測とは関係しない。
 */
export const EFFECT_LEVELS = ['full', 'reduced', 'off'] as const;
export type EffectLevel = (typeof EFFECT_LEVELS)[number];

export const EFFECT_LABELS: Readonly<Record<EffectLevel, string>> = {
  full: '標準（動く）',
  reduced: '控えめ（動かない）',
  off: 'オフ',
};

/** 設定と OS の「動きを減らす」から、実際に使う強さを決める（OS が減らすなら、動く演出は出さない） */
export function resolveEffects(setting: EffectLevel, prefersReducedMotion: boolean): EffectLevel {
  return setting === 'full' && prefersReducedMotion ? 'reduced' : setting;
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** WebGL が使えるか（使えない環境では、3D の演出は出さずに、そのまま動かす） */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
