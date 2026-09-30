import type { ReactNode } from 'react';
import { useSettings } from '@/settings/useSettings';
import { Backdrop } from './Backdrop';

interface Props {
  /** 上部バー（進捗・時間・中断）。HudBar */
  hud: ReactNode;
  /** お題の上に出す通知（コンボ・警告・ボス・ゴースト）。無いときは null */
  notices: ReactNode;
  /** 主役: お題（TargetView） */
  stage: ReactNode;
  /** 指の案内（FingerGuide）。運指ガイドがオフなら null */
  guide: ReactNode;
  /** 次のお題の待ち行列（QueueRail）。設定 showQueue が false のときは出さない */
  queue?: ReactNode;
  /** 画面全体を覆う演出（ボスの登場など）。最前面 */
  overlay?: ReactNode;
  /** 読み上げ用の見出し（sr-only） */
  heading: ReactNode;
}

/**
 * 練習画面の骨組み。どの部品をどこに置くかだけを決める（判定・入力・状態は Play に残す）。
 * 3ゾーン（左: 待ち行列 / 中央: 通知＋舞台 / 右: 指の案内）。幅ごとの配置は styles/stage.css の A 区画。
 *   1200px 以上: 3列 / 1024〜1199px: 待ち行列は上に横並びに畳む / それ未満: 縦1列（待ち行列は出さない）
 * 読み上げの順は DOM の順（見出し → 上部バー → 通知 → お題 → 指の案内 → 次のお題）。
 */
export function PlayFrame({ hud, notices, stage, guide, queue, overlay, heading }: Props) {
  const [settings] = useSettings();
  const showQueue = settings.showQueue && queue != null;
  return (
    <main className="play-frame">
      <Backdrop />
      {overlay}
      {heading}
      <div className="play-frame__hud">{hud}</div>
      <div className="play-frame__zones" data-queue={showQueue ? 'on' : 'off'} data-guide={guide ? 'on' : 'off'}>
        <div className="play-frame__center">
          {notices}
          {stage}
        </div>
        {guide && <div className="play-frame__guide">{guide}</div>}
        {showQueue && <div className="play-frame__queue">{queue}</div>}
      </div>
    </main>
  );
}
