import { lazy, Suspense, useCallback, useState } from 'react';
import { prefersReducedMotion, resolveEffects, webglAvailable, type EffectLevel } from '@/effects/level';
import type { Theme } from '@/themes/theme';

// three.js は大きいので、3D の演出があるテーマを選んだときだけ読み込む
const HeroScene = lazy(() => import('./HeroScene'));

/** テーマの 3D 演出をホームの上に出す。演出がオフ・WebGL 無し・読み込み失敗のときは何も出さない */
export function HeroBanner({ theme, effects }: { theme: Theme; effects: EffectLevel }) {
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);
  const level = resolveEffects(effects, prefersReducedMotion());
  if (!theme.hero || level === 'off' || failed || !webglAvailable()) return null;
  return (
    <Suspense fallback={null}>
      <HeroScene models={theme.hero} animate={level === 'full'} onError={onError} />
    </Suspense>
  );
}
