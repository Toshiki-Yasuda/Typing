import type { ReactNode } from 'react';
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
  /** 次のお題の待ち行列（QueueRail）。U1a で使う。いまは未使用 */
  queue?: ReactNode;
  /** 画面全体を覆う演出（ボスの登場など）。最前面 */
  overlay?: ReactNode;
  /** 読み上げ用の見出し（sr-only） */
  heading: ReactNode;
}

/**
 * 練習画面の骨組み。どの部品をどこに置くかだけを決める（判定・入力・状態は Play に残す）。
 * U1（舞台）の担当ファイル。いまは従来どおりの縦1列。U1a で3ゾーン（待ち行列 / 舞台 / 指の案内）にする。
 */
export function PlayFrame({ hud, notices, stage, guide, overlay, heading }: Props) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 p-8">
      <Backdrop />
      {overlay}
      {heading}
      {hud}
      {notices}
      {stage}
      {guide}
    </main>
  );
}
