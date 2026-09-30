import type { EffectLevel } from '@/effects/level';

/**
 * オープニングの状態機械（純関数）。
 *  gate  : 「Enter でスタート」。ブラウザが音の再生を許すのは、ユーザー操作の後だけなので、ここを操作にする
 *  burst : 光・効果音・3D のカードが弾けるオープニング演出
 *  title : ロゴとメニュー
 */
export type OpeningPhase = 'gate' | 'burst' | 'title';
export type OpeningEvent = 'start' | 'skip' | 'elapsed';

/** オープニング演出の長さ（ミリ秒）。飛ばさなくても、この時間でタイトルに進む */
export const BURST_MS = 2600;

/** 演出オフなら、ゲートもオープニングも出さず、すぐタイトル（音は最初の操作で鳴る） */
export function initialPhase(level: EffectLevel): OpeningPhase {
  return level === 'off' ? 'title' : 'gate';
}

export function nextPhase(phase: OpeningPhase, event: OpeningEvent, level: EffectLevel): OpeningPhase {
  switch (phase) {
    case 'gate':
      if (event === 'skip') return 'title';
      // 控えめは、動くオープニングを飛ばして、最後の姿（タイトル）へ
      if (event === 'start') return level === 'full' ? 'burst' : 'title';
      return 'gate';
    case 'burst':
      return event === 'skip' || event === 'elapsed' ? 'title' : 'burst';
    case 'title':
      return 'title';
  }
}
