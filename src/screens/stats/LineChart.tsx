import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { niceScale } from './scale';
import { LineKey, Tooltip } from './Tooltip';

export interface ChartPoint {
  /** 横軸の見出し（日時など）。ツールチップと表に出す */
  readonly label: string;
  readonly value: number;
}

interface Props {
  title: string;
  points: readonly ChartPoint[];
  format: (value: number) => string;
  /** 縦軸の下端・上端。null ならデータから決める */
  yMin?: number | null;
  yMax?: number | null;
  valueHeader?: string;
}

const W = 640;
const H = 240;
const M = { top: 16, right: 72, bottom: 28, left: 48 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

/**
 * 単一系列の折れ線（推移）。軸は1本。
 * ホバー/キーボードで縦線が最寄りの点に吸着し、ツールチップに値を出す。値は表でも読める。
 */
export function LineChart({ title, points, format, yMin = null, yMax = null, valueHeader = '値' }: Props) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  // キーボードで値を移動したときだけ、読み上げ用に通知する（ポインタのホバーでは通知しない）
  const [announce, setAnnounce] = useState('');
  const n = points.length;

  const values = points.map((p) => p.value);
  const scale = niceScale(yMin ?? Math.min(...values), yMax ?? Math.max(...values));
  const x = (i: number) => (n === 1 ? M.left + PLOT_W / 2 : M.left + (PLOT_W * i) / (n - 1));
  const y = (v: number) => M.top + PLOT_H * (1 - (v - scale.min) / (scale.max - scale.min));

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${path} L${x(n - 1).toFixed(1)},${y(scale.min)} L${x(0).toFixed(1)},${y(scale.min)} Z`;

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - vx) < Math.abs(x(nearest) - vx)) nearest = i;
    setActive(nearest);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const move = (next: number) => {
      e.preventDefault();
      const index = Math.min(n - 1, Math.max(0, next));
      setActive(index);
      const p = points[index];
      if (p) setAnnounce(`${p.label}: ${format(p.value)}`);
    };
    if (e.key === 'ArrowLeft') move((active ?? n) - 1);
    else if (e.key === 'ArrowRight') move((active ?? -1) + 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(n - 1);
    else if (e.key === 'Escape') setActive(null);
  };

  const last = points[n - 1];
  const showAllMarkers = n <= 20;
  const shown = active !== null ? points[active] : undefined;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption id={`${id}-title`} className="text-lg font-bold">
        {title}
      </figcaption>
      <div
        className="relative rounded-lg bg-surface-raised p-2 focus-visible:outline-2 focus-visible:outline-accent"
        tabIndex={0}
        role="group"
        aria-labelledby={`${id}-title`}
        aria-description={last ? `${n}件。最新は ${format(last.value)}。左右の矢印キーで値を確認できます` : undefined}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((a) => a ?? n - 1)}
        onBlur={() => setActive(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full touch-none"
          aria-hidden
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
        >
          {scale.ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} strokeWidth={1} style={{ stroke: t === scale.min ? 'var(--viz-axis)' : 'var(--viz-grid)' }} />
              <text x={M.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={12} style={{ fill: 'var(--viz-muted)' }}>
                {format(t)}
              </text>
            </g>
          ))}
          {points[0] && (
            <text x={M.left} y={H - 8} fontSize={12} style={{ fill: 'var(--viz-muted)' }}>
              {points[0].label}
            </text>
          )}
          {n > 1 && last && (
            <text x={W - M.right} y={H - 8} textAnchor="end" fontSize={12} style={{ fill: 'var(--viz-muted)' }}>
              {last.label}
            </text>
          )}
          {n > 1 && <path d={area} style={{ fill: 'var(--viz-series-1)', opacity: 0.1 }} />}
          {n > 1 && (
            <path d={path} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: 'var(--viz-series-1)' }} />
          )}
          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={M.top} y2={H - M.bottom} strokeWidth={1} style={{ stroke: 'var(--viz-axis)' }} />
          )}
          {points.map((p, i) =>
            showAllMarkers || i === n - 1 || i === active ? (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.value)}
                r={i === active ? 5 : 4}
                strokeWidth={2}
                style={{ fill: 'var(--viz-series-1)', stroke: 'var(--color-surface-raised)' }}
              />
            ) : null,
          )}
          {last && (
            <text x={x(n - 1) + 12} y={y(last.value)} dominantBaseline="middle" fontSize={14} fontWeight={700} style={{ fill: 'var(--viz-ink)' }}>
              {format(last.value)}
            </text>
          )}
        </svg>
        <div aria-live="polite" className="sr-only">
          {announce}
        </div>
        {shown && active !== null && (
          <Tooltip left={`${(x(active) / W) * 100}%`} top={`${(y(shown.value) / H) * 100}%`}>
            <div className="font-bold">{format(shown.value)}</div>
            <div className="text-text-muted">
              <LineKey />
              {shown.label}
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
              <th className="py-1 font-normal">日時</th>
              <th className="py-1 font-normal">{valueHeader}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="py-1">{p.label}</td>
                <td className="py-1 tabular-nums">{format(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
