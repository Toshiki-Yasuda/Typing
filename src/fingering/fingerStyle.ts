import type { Finger, Layout } from './layout';

/**
 * 運指ガイドの表示用データ（指のラベル・色の番号・ホームポジションからの移動方向）。表示専用で、判定には使わない。
 * 色は `dataviz` の検証（暗い面 #1d1f27 上で、隣り合う指の CVD ΔE 8.4 以上・通常視 19.3 以上・コントラスト 3:1 以上）を通した
 * 8 色を、左小指 → 右小指の順に割り当てる。色だけに頼らないよう、ラベル（頭文字）を併記する。
 */
export const FINGER_ORDER: readonly Finger[] = ['L-pinky', 'L-ring', 'L-middle', 'L-index', 'R-index', 'R-middle', 'R-ring', 'R-pinky'];

/** キーに併記する頭文字 */
export const FINGER_LABEL: Readonly<Record<Finger, string>> = {
  'L-pinky': '小',
  'L-ring': '薬',
  'L-middle': '中',
  'L-index': '人',
  'R-index': '人',
  'R-middle': '中',
  'R-ring': '薬',
  'R-pinky': '小',
  thumb: '親',
};

/** 各指のホームポジションのキー */
export const HOME_KEY: Readonly<Partial<Record<Finger, string>>> = {
  'L-pinky': 'a',
  'L-ring': 's',
  'L-middle': 'd',
  'L-index': 'f',
  'R-index': 'j',
  'R-middle': 'k',
  'R-ring': 'l',
  'R-pinky': ';',
};

export type Move = { readonly dx: -1 | 0 | 1; readonly dy: -1 | 0 | 1 };

/** キーの中心の横位置（段のずれを含む。キー幅を 1 とする）と、段の番号 */
function positionOf(layout: Layout, base: string): { x: number; row: number } | null {
  for (let r = 0; r < layout.rows.length; r++) {
    const row = layout.rows[r]!;
    const i = row.keys.findIndex((k) => k.base === base);
    if (i >= 0) return { x: row.indent + i, row: r };
  }
  return null;
}

const HOME_ROW = 2;
/** 横に動くと見なす、ホームからの横のずれ（段のずれ 0.75 までは「真上・真下」と見なす） */
const LATERAL = 0.9;

/** ホームポジションから見た、指の動く向き。ホームのキー（と、動かないとき）は null */
export function moveFrom(layout: Layout, finger: Finger, base: string): Move | null {
  const homeBase = HOME_KEY[finger];
  if (!homeBase || base === homeBase) return null;
  const home = positionOf(layout, homeBase);
  const to = positionOf(layout, base);
  if (!home || !to) return null;
  const dy = Math.sign(to.row - HOME_ROW) as -1 | 0 | 1;
  const ddx = to.x - home.x;
  const dx = Math.abs(ddx) >= LATERAL ? (Math.sign(ddx) as -1 | 1) : 0;
  return dx === 0 && dy === 0 ? null : { dx, dy };
}

const ARROWS: Readonly<Record<string, string>> = {
  '-1,-1': '↖', '0,-1': '↑', '1,-1': '↗', '-1,0': '←', '1,0': '→', '-1,1': '↙', '0,1': '↓', '1,1': '↘',
};
export const arrowOf = (m: Move): string => ARROWS[`${m.dx},${m.dy}`] ?? '';
