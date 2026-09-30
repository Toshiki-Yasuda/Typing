import { lazy, Suspense } from 'react';
import { webglAvailable, type EffectLevel } from '@/effects/level';
import type { Boss } from '@/themes/theme';

// 3D は大きいので、決着のときだけ読み込む
const BurstScene = lazy(() => import('./BurstScene'));

/** ボス戦の演出の種類 */
export type BossFxState =
  | { kind: 'intro' }
  | { kind: 'phase'; phase: number; line: string }
  | { kind: 'won' | 'lost'; line: string };

interface Props {
  boss: Boss;
  fx: BossFxState;
  /** 'reduced' なら動かさず、最後の姿を出す */
  level: Exclude<EffectLevel, 'off'>;
  /** 決着の 3D に使うモデル（無ければ 3D は出さない） */
  cardModel: string | null;
  /** 決着の画面を閉じて先へ進む（Enter・クリック） */
  onSkip: () => void;
}

/**
 * ボス戦の演出（登場・フェーズ切替・決着）。見た目だけの飾りで、打鍵は受けたまま重ねて出す。
 * 同じ内容は画面の文字（台詞・結果）でも伝えるので、支援技術には見せない。
 */
export function BossFx({ boss, fx, level, cardModel, onSkip }: Props) {
  const finish = fx.kind === 'won' || fx.kind === 'lost';
  return (
    <div
      aria-hidden
      data-fx={level}
      data-kind={fx.kind}
      className={`fx-layer fx-${fx.kind}`}
      // 決着の画面だけクリックを受けて、先へ進める
      style={finish ? { pointerEvents: 'auto', cursor: 'pointer' } : undefined}
      onClick={finish ? onSkip : undefined}
    >
      {/* 登場・フェーズ切替: 文字は画面上部の帯に出して、お題（画面の中ほど）に重ねない */}
      {fx.kind === 'intro' && (
        <>
          {boss.image && <img className="fx-boss-img" src={new URL(boss.image, document.baseURI).href} alt="" />}
          <div className="fx-banner">
            <p className="fx-chapter">第{boss.chapter}章</p>
            <p className="fx-name">{boss.name}</p>
            <p className="fx-title">{boss.title}</p>
          </div>
        </>
      )}
      {fx.kind === 'phase' && (
        <>
          <div className="fx-ring" />
          <div className="fx-ring fx-ring-2" />
          <div className="fx-banner">
            <p className="fx-phase-label">PHASE {fx.phase}</p>
            <p className="fx-line">{fx.line}</p>
          </div>
        </>
      )}
      {finish && (
        <>
          {cardModel && webglAvailable() && (
            <Suspense fallback={null}>
              <BurstScene model={cardModel} outcome={fx.kind === 'won' ? 'won' : 'lost'} animate={level === 'full'} />
            </Suspense>
          )}
          <div className="fx-center">
            <p className="fx-result">{fx.kind === 'won' ? '撃破' : '敗北'}</p>
            <p className="fx-line">{fx.line}</p>
            <p className="fx-hint">Enter またはクリックで進む</p>
          </div>
        </>
      )}
    </div>
  );
}
