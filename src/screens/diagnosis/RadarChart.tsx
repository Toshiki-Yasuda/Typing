import { useId, useState } from 'react';
import { AXIS_IDS, type AxisId, type AxisResult } from '@/metrics/axes';
import { Tooltip } from '../stats/Tooltip';
import { AXIS_INFO } from './labels';

interface Props {
  title: string;
  axes: Record<AxisId, AxisResult>;
  /** 軸の副題（テーマの言葉。例: 強化系）。無ければ出さない */
  kinds?: Partial<Record<AxisId, string>>;
}

const W = 360;
const H = 350;
const CX = W / 2;
const CY = 178;
const R = 112; // 100 点の半径
const RINGS = [25, 50, 75, 100];

/** 軸 i の角度（上から時計回り）。環の順に並べるので、隣が近く向かいが遠い */
const angle = (i: number) => ((-90 + 60 * i) * Math.PI) / 180;
const point = (i: number, value: number) => ({
  x: CX + Math.cos(angle(i)) * R * (value / 100),
  y: CY + Math.sin(angle(i)) * R * (value / 100),
});
const polygon = (values: readonly number[]) =>
  values.map((v, i) => `${point(i, v).x.toFixed(1)},${point(i, v).y.toFixed(1)}`).join(' ');

/**
 * 6 軸の六角形グラフ（レーダー）。1 系列だけなので色は 1 色（--viz-series-1）。
 * 軸の並びに意味がある（環の順。隣が近く、向かいが遠い）。点はキーボードで選べ、値は文字（軸のラベル）と表でも読める。
 * データ不足の軸は点を打たず「データ不足」と書く（0 点にしない）。
 */
export function RadarChart({ title, axes, kinds = {} }: Props) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const scored = AXIS_IDS.map((axis, i) => ({ axis, i, score: axes[axis].score })).filter(
    (a): a is { axis: AxisId; i: number; score: number } => a.score !== null,
  );

  return (
    <figure className="flex flex-col gap-2">
      <figcaption id={`${id}-title`} className="text-lg font-bold">
        {title}
      </figcaption>
      <div className="relative mx-auto w-full max-w-md rounded-lg bg-surface-raised p-2">
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-labelledby={`${id}-title`} className="w-full">
          {/* 目盛りの六角形（控えめ）と、軸の線 */}
          {RINGS.map((v) => (
            <polygon key={v} points={polygon(AXIS_IDS.map(() => v))} fill="none" stroke="var(--viz-grid)" strokeWidth={1} />
          ))}
          {AXIS_IDS.map((axis, i) => {
            const end = point(i, 100);
            const missing = axes[axis].score === null;
            return (
              <line
                key={axis}
                x1={CX}
                y1={CY}
                x2={end.x}
                y2={end.y}
                stroke="var(--viz-axis)"
                strokeWidth={1}
                strokeDasharray={missing ? '3 4' : undefined}
              />
            );
          })}
          {[50, 100].map((v) => (
            <text key={v} x={CX + 4} y={CY - R * (v / 100) + 11} fontSize={10} fill="var(--viz-muted)">
              {v}
            </text>
          ))}

          {/* 得点の多角形。点が 3 つ以上あるときだけ面にする（データ不足の軸は飛ばして結ぶ） */}
          {scored.length >= 3 && (
            <polygon
              points={scored.map((a) => `${point(a.i, a.score).x.toFixed(1)},${point(a.i, a.score).y.toFixed(1)}`).join(' ')}
              fill="var(--viz-series-1)"
              fillOpacity={0.18}
              stroke="var(--viz-series-1)"
              strokeWidth={2}
              strokeLinejoin="round"
            />
          )}

          {/* 軸のラベル（軸の名前・副題・得点。文字で読める） */}
          {AXIS_IDS.map((axis, i) => {
            const a = angle(i);
            const lx = CX + Math.cos(a) * (R + 16);
            const ly = CY + Math.sin(a) * (R + 16);
            const anchor = Math.cos(a) > 0.3 ? 'start' : Math.cos(a) < -0.3 ? 'end' : 'middle';
            const score = axes[axis].score;
            const dy = Math.sin(a) > 0.5 ? 12 : Math.sin(a) < -0.5 ? -26 : -8;
            return (
              <text key={axis} x={lx} y={ly + dy} textAnchor={anchor} fontSize={13} fill="var(--viz-ink)">
                <tspan fontWeight={700}>{AXIS_INFO[axis].label}</tspan>
                {kinds[axis] && (
                  <tspan fill="var(--viz-ink-secondary)" fontSize={11}>
                    {' '}
                    {kinds[axis]}
                  </tspan>
                )}
                <tspan x={lx} dy={15} fill={score === null ? 'var(--viz-muted)' : 'var(--viz-ink-secondary)'} fontSize={12}>
                  {score === null ? 'データ不足' : `${Math.round(score)}点`}
                </tspan>
              </text>
            );
          })}

          {/* 点（キーボードで選べる。当たり判定は見た目より大きく） */}
          {scored.map((a) => {
            const p = point(a.i, a.score);
            return (
              <g key={a.axis}>
                <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={active === a.i ? 7 : 5}
                  fill="var(--viz-series-1)"
                  stroke="var(--color-surface-raised)"
                  strokeWidth={2}
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={14}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${AXIS_INFO[a.axis].label} ${Math.round(a.score)}点`}
                  onPointerEnter={() => setActive(a.i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(a.i)}
                  onBlur={() => setActive(null)}
                  className="focus-visible:outline-2 focus-visible:outline-accent"
                />
              </g>
            );
          })}
        </svg>
        {active !== null && axes[AXIS_IDS[active] as AxisId].score !== null && (
          <Tooltip
            left={`${(point(active, axes[AXIS_IDS[active] as AxisId].score as number).x / W) * 100}%`}
            top={`${(point(active, axes[AXIS_IDS[active] as AxisId].score as number).y / H) * 100 - 2}%`}
          >
            <div className="font-bold">{Math.round(axes[AXIS_IDS[active] as AxisId].score as number)}点</div>
            <div className="text-text-muted">
              {AXIS_INFO[AXIS_IDS[active] as AxisId].label}
              {kinds[AXIS_IDS[active] as AxisId] ? `（${kinds[AXIS_IDS[active] as AxisId]}）` : ''}
            </div>
          </Tooltip>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-text-muted">
          表で見る<span className="sr-only">（{title}）</span>
        </summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-text-muted">
              <th className="py-1 font-normal">軸</th>
              <th className="py-1 font-normal">得点</th>
              <th className="py-1 font-normal">サンプル</th>
              <th className="py-1 font-normal">見るもの</th>
            </tr>
          </thead>
          <tbody>
            {AXIS_IDS.map((axis) => {
              const r = axes[axis];
              return (
                <tr key={axis} className="border-t border-white/10 align-top">
                  <td className="py-1">
                    {AXIS_INFO[axis].label}
                    {kinds[axis] ? `（${kinds[axis]}）` : ''}
                  </td>
                  <td className="py-1 tabular-nums">{r.score === null ? 'データ不足' : `${r.score.toFixed(1)}点`}</td>
                  <td className="py-1 tabular-nums">
                    {r.sample} / {r.needed}
                  </td>
                  <td className="py-1 text-text-muted">{AXIS_INFO[axis].measures}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
