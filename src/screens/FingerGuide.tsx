import { useId, useState } from 'react';
import type { PressFx } from './play/types';
import { resolveEffects, prefersReducedMotion } from '@/effects/level';
import { FINGER_LABEL, LAYOUTS, arrowOf, describeKey, locate, moveFrom, type Finger, type KeyDef, type LayoutId } from '@/fingering';
import { useSettings } from '@/settings/useSettings';

/** ホームポジションの目印（F と J の突起） */
const HOME_MARKS = new Set(['f', 'j']);

const fingerClass = (f: Finger) => `fg-f-${f}`;

interface CellProps {
  label: string;
  active: boolean;
  home?: boolean;
  width?: number;
  dim?: boolean;
  finger?: Finger;
  /** 直前の打鍵の表示 */
  mark?: 'ok' | 'wrong' | 'expected';
  markSeq?: number;
}

function Cell({ label, active, home, width = 1, dim = false, finger, mark, markSeq }: CellProps) {
  return (
    <div
      aria-current={active ? 'true' : undefined}
      className={`fg-key${finger ? ` ${fingerClass(finger)}` : ''}${dim ? ' fg-dim' : ''}`}
      data-f={finger ? FINGER_LABEL[finger] : undefined}
      style={{ '--w': width } as React.CSSProperties}
    >
      {label}
      {home && !active && <span aria-hidden className="fg-home" />}
      {mark && <i key={markSeq} aria-hidden className={`fg-mark fg-mark-${mark}`} />}
    </div>
  );
}

const labelOf = (key: KeyDef) => (/^[a-z]$/.test(key.base) ? key.base.toUpperCase() : key.base);

/** ホームポジションの手の線画。次に使う指を強調し、遠いキーへは動く向きの矢印を添える */
const TIPS: Readonly<Record<string, readonly [number, number]>> = {
  'L-pinky': [16, 34], 'L-ring': [38, 20], 'L-middle': [60, 14], 'L-index': [82, 22], thumb: [104, 56],
};
function Hands({ finger, arrow, colored }: { finger: Finger | null; arrow: string; colored: boolean }) {
  const hand = (side: 'L' | 'R') => {
    const dx = side === 'L' ? 0 : 130;
    const mirror = (x: number) => (side === 'L' ? x : 116 - x) + dx;
    const fingers = (['pinky', 'ring', 'middle', 'index'] as const).map((n) => {
      const id = `${side}-${n}` as Finger;
      const [x, y] = TIPS[`L-${n}`]!;
      const on = finger === id;
      return (
        <g key={id} className={`${fingerClass(id)} fg-fing${on ? ' fg-fing-on' : ''}${colored ? ' fg-colored' : ''}`}>
          <line x1={mirror(x)} y1={64} x2={mirror(x)} y2={y} />
          {on && arrow && (
            <text x={mirror(x)} y={y - 8} textAnchor="middle" className="fg-arrow">
              {arrow}
            </text>
          )}
        </g>
      );
    });
    const thumbOn = finger === 'thumb';
    return (
      <g key={side}>
        <path className="fg-palm" d={`M${mirror(6)} 62 Q${mirror(6)} 74 ${mirror(24)} 76 L${mirror(92)} 76 Q${mirror(112)} 74 ${mirror(112)} 62`} fill="none" />
        {fingers}
        <line className={`fg-fing fg-thumb${thumbOn ? ' fg-fing-on' : ''}`} x1={mirror(100)} y1={72} x2={mirror(TIPS.thumb![0])} y2={TIPS.thumb![1]} />
      </g>
    );
  };
  return (
    <svg aria-hidden viewBox="0 0 246 84" className="fg-hands" focusable="false">
      {hand('L')}
      {hand('R')}
    </svg>
  );
}

/**
 * 運指ガイド。次に打つキーを光らせ、Shift が要るときは反対側の Shift も光らせる。
 * 図は補助で、指の名前は文字でも示す（図だけに頼らない）。
 * 直前の打鍵（press）は、正しければ押したキーの輪郭が光り、誤りなら押した実キーに×、正しいキーの枠が脈打つ。
 */
export function FingerGuide({ next, layout, press }: { next: string | undefined; layout: LayoutId; /** 直前の打鍵の結果（表示専用） */ press?: PressFx }) {
  const def = LAYOUTS[layout];
  const [settings] = useSettings();
  const [reduced] = useState(prefersReducedMotion);
  const fx = resolveEffects(settings.effects, reduced);
  const colored = settings.fingerColors;
  const noteId = useId();
  const loc = next ? locate(def, next) : null;
  const activeBase = loc?.key.base;
  const shiftSide = loc?.shift ? (loc.shiftFinger === 'R-pinky' ? 'right' : 'left') : null;
  const move = loc && loc.key.base !== ' ' ? moveFrom(def, loc.key.finger, loc.key.base) : null;

  // 直前の打鍵。ok は押したキーの光（演出「オフ」では出さない）、miss は押した実キーの×と正しいキーの枠
  const pressed = press ? locate(def, press.key) : null;
  const expected = press?.expected ? locate(def, press.expected) : null;
  const markOf = (base: string): CellProps['mark'] => {
    if (!press) return undefined;
    if (press.result === 'miss') {
      if (pressed?.key.base === base && expected?.key.base !== base) return 'wrong';
      if (expected?.key.base === base) return 'expected';
      return undefined;
    }
    return fx !== 'off' && pressed?.key.base === base ? 'ok' : undefined;
  };

  return (
    <section
      aria-label="運指ガイド"
      aria-describedby={noteId}
      className="fg flex flex-col items-center gap-3 rounded-lg bg-surface-raised p-4"
      data-fx={fx}
      data-colored={colored ? 'true' : undefined}
    >
      <p className="min-h-6 text-lg font-bold">{loc ? describeKey(loc) : ''}</p>
      <p id={noteId} className="sr-only">
        {def.name}の表示です。判定は打った文字で行うので、配列が違っても遊べます。指の色と頭文字は、キーを打つ指を表します。
      </p>
      {/* 狭い画面（拡大表示を含む）では図を隠す。指の名前は上の文字で示すので、情報は失われない */}
      <div aria-hidden className="hidden flex-col sm:flex fg-board">
        {def.rows.map((row, r) => {
          const last = r === def.rows.length - 1;
          return (
            <div key={r} className="fg-row" style={{ '--indent': row.indent } as React.CSSProperties}>
              {last && <Cell label="Shift" width={1.5} active={shiftSide === 'left'} dim />}
              {row.keys.map((key) => (
                <Cell
                  key={key.base}
                  label={labelOf(key)}
                  active={activeBase === key.base}
                  home={HOME_MARKS.has(key.base)}
                  finger={colored ? key.finger : undefined}
                  mark={markOf(key.base)}
                  markSeq={press?.seq}
                />
              ))}
              {last && <Cell label="Shift" width={1.5} active={shiftSide === 'right'} dim />}
            </div>
          );
        })}
        <div className="fg-row" style={{ '--indent': 3 } as React.CSSProperties}>
          <Cell label="" width={6} active={next === ' '} finger={colored ? 'thumb' : undefined} mark={markOf(' ')} markSeq={press?.seq} />
        </div>
        <Hands finger={loc?.key.finger ?? null} arrow={move ? arrowOf(move) : ''} colored={colored} />
      </div>
    </section>
  );
}
