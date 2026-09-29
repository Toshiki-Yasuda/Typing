import { useId, useState, type KeyboardEvent } from 'react';
import { niceScale } from './scale';
import { LineKey, Tooltip } from './Tooltip';

export interface Column {
  /** 横軸のラベル（短く: 「21」「月」） */
  readonly label: string;
  /** ツールチップ・表に出す名前（「21時台」「月曜日」）。省略すると label */
  readonly name?: string;
  readonly value: number | null;
  /** 集計に使った練習の回数 */
  readonly count: number;
}

interface Props {
  title: string;
  columns: readonly Column[];
  format: (value: number) => string;
  valueHeader: string;
  /** この回数未満の棒は「参考値」（枠だけで描く） */
  minSample: number;
  /** 横軸のラベルを何本おきに出すか */
  labelEvery?: number;
}

const W = 640;
const H = 220;
const M = { top: 16, right: 16, bottom: 28, left: 48 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;
const MAX_BAR = 24; // 棒の太さの上限
const RADIUS = 4;

/** 下端（ベースライン）は四角、先端だけ 4px 丸めた棒 */
function barPath(x: number, width: number, top: number, base: number): string {
  const r = Math.min(RADIUS, (base - top) / 2, width / 2);
  return `M${x},${base} V${top + r} a${r},${r} 0 0 1 ${r},${-r} H${x + width - r} a${r},${r} 0 0 1 ${r},${r} V${base} Z`;
}

/**
 * 縦棒（区分ごとの比較）。ゼロを基準に伸びる。回数が少ない区分は枠だけで描き、色以外でも区別する。
 * ホバー/キーボードで区分を選ぶと、値と回数をツールチップに出す。値は表でも読める。
 */
export function ColumnChart({ title, columns, format, valueHeader, minSample, labelEvery = 1 }: Props) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  // キーボードで区分を移動したときだけ、読み上げ用に通知する
  const [announce, setAnnounce] = useState('');
  const n = columns.length;
  const values = columns.map((c) => c.value).filter((v): v is number => v !== null);
  const scale = niceScale(0, values.length ? Math.max(...values) : 1);
  const slot = PLOT_W / n;
  const barW = Math.min(MAX_BAR, slot * 0.7);
  const y = (v: number) => M.top + PLOT_H * (1 - (v - scale.min) / (scale.max - scale.min));
  const base = y(scale.min);
  const cx = (i: number) => M.left + slot * i + slot / 2;

  const onKeyDown = (e: KeyboardEvent) => {
    const move = (next: number) => {
      e.preventDefault();
      const index = Math.min(n - 1, Math.max(0, next));
      setActive(index);
      const c = columns[index];
      if (c) setAnnounce(c.value === null ? `${c.name ?? c.label}: 練習なし` : `${c.name ?? c.label}: ${format(c.value)}（${c.count}回${c.count < minSample ? '・参考値' : ''}）`);
    };
    if (e.key === 'ArrowLeft') move((active ?? n) - 1);
    else if (e.key === 'ArrowRight') move((active ?? -1) + 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(n - 1);
    else if (e.key === 'Escape') setActive(null);
  };

  const shown = active !== null ? columns[active] : undefined;
  const hasFew = columns.some((c) => c.value !== null && c.count < minSample);

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
        aria-description="左右の矢印キーで区分ごとの値を確認できます"
        onKeyDown={onKeyDown}
        onFocus={() => setActive((a) => a ?? 0)}
        onBlur={() => setActive(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" aria-hidden onPointerLeave={() => setActive(null)}>
          {scale.ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} strokeWidth={1} style={{ stroke: t === scale.min ? 'var(--viz-axis)' : 'var(--viz-grid)' }} />
              <text x={M.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={12} style={{ fill: 'var(--viz-muted)' }}>
                {format(t)}
              </text>
            </g>
          ))}
          {columns.map((c, i) => (
            <g key={i} data-column={i} onPointerEnter={() => setActive(i)}>
              {/* 当たり判定: 棒より広い区分全体 */}
              <rect x={M.left + slot * i} y={M.top} width={slot} height={PLOT_H} fill="transparent" />
              {active === i && <rect x={M.left + slot * i} y={M.top} width={slot} height={PLOT_H} style={{ fill: 'var(--viz-ink)', opacity: 0.06 }} />}
              {c.value !== null && (
                <path
                  d={barPath(cx(i) - barW / 2, barW, y(c.value), base)}
                  strokeWidth={c.count < minSample ? 1.5 : 0}
                  style={{
                    fill: 'var(--viz-series-1)',
                    fillOpacity: c.count < minSample ? 0.15 : 1,
                    stroke: 'var(--viz-series-1)',
                  }}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={cx(i)} y={H - 8} textAnchor="middle" fontSize={12} style={{ fill: 'var(--viz-muted)' }}>
                  {c.label}
                </text>
              )}
            </g>
          ))}
        </svg>
        <div aria-live="polite" className="sr-only">
          {announce}
        </div>
        {shown && active !== null && (
          <Tooltip left={`${(cx(active) / W) * 100}%`} top={`${((shown.value !== null ? y(shown.value) : base) / H) * 100}%`}>
            {shown.value !== null ? (
              <>
                <div className="font-bold">{format(shown.value)}</div>
                <div className="text-text-muted">
                  <LineKey />
                  {shown.name ?? shown.label}・{shown.count}回
                </div>
                {shown.count < minSample && <div className="text-text-muted">回数が少ないため参考値です</div>}
              </>
            ) : (
              <div className="text-text-muted">{shown.name ?? shown.label}・練習なし</div>
            )}
          </Tooltip>
        )}
      </div>
      {hasFew && <p className="text-xs text-text-muted">枠だけの棒は、練習が {minSample} 回未満の参考値です。</p>}
      <details className="text-sm">
        <summary className="cursor-pointer text-text-muted">
          表で見る<span className="sr-only">（{title}）</span>
        </summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-text-muted">
              <th className="py-1 font-normal">区分</th>
              <th className="py-1 font-normal">{valueHeader}</th>
              <th className="py-1 font-normal">回数</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((c, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="py-1">{c.name ?? c.label}</td>
                <td className="py-1 tabular-nums">{c.value === null ? '—' : format(c.value)}</td>
                <td className="py-1 tabular-nums">{c.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
