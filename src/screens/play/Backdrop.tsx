import { prefersReducedMotion, resolveEffects } from '@/effects/level';
import { useSettings } from '@/settings/useSettings';

/**
 * 練習画面の背景（遠景・中景・前景の 3 層）。U1c。
 * - 遠景: 淡いグリッドと放射線。標準のときだけ 60 秒周期でゆっくり流れる（transform のみ。再描画なし）
 * - 中景: アクセント色の光とビネット
 * - 前景: 舞台の足元の光のレール（静的な線。伸びる動きは U5）
 * 演出「オフ」では層を出さない（フラット）。「控えめ」と OS の「動きを減らす」では静止した最後の姿。
 * 色は `--stage-*`（--stage-glow / --stage-grid / --stage-rail / --stage-vignette）でテーマから差し替えられる。
 * 飾りなので aria-hidden・pointer-events なし。判定・入力・計測に触れない。
 */
export function Backdrop() {
  const [settings] = useSettings();
  const level = resolveEffects(settings.effects, prefersReducedMotion());
  return (
    <div aria-hidden className="backdrop" data-level={level} data-testid="backdrop">
      {level !== 'off' && (
        <>
          <div className="backdrop-far" />
          <div className="backdrop-mid" />
          <div className="backdrop-near" />
        </>
      )}
    </div>
  );
}
