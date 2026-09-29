import { useId, useState } from 'react';
import type { KeyStat } from '@/metrics';
import { heatBin } from './scale';
import { Tooltip } from './Tooltip';

const ROWS: readonly { keys: string; indent: number }[] = [
  { keys: '1234567890-', indent: 0 },
  { keys: 'qwertyuiop', indent: 0.5 },
  { keys: "asdfghjkl;", indent: 0.75 },
  { keys: 'zxcvbnm,./', indent: 1.25 },
];

const CELL = 44;
const GAP = 2; // セル間の 2px の隙間（面の色）
/** 値が大きいほど明るい 5 段階（暗い面向け。scripts で検証済みの階調） */
const HEAT = ['var(--viz-heat-1)', 'var(--viz-heat-2)', 'var(--viz-heat-3)', 'var(--viz-heat-4)', 'var(--viz-heat-5)'];
/** 明るい階級（4・5段目）の上の文字は暗い色、それ以外は白 */
const inkOn = (bin: number) => (bin >= 3 ? 'var(--viz-heat-ink-dark)' : 'var(--viz-ink)');
/** これ未満の試行回数は「参考値」と明示する */
const FEW = 5;

type Metric = 'miss' | 'latency';

const METRICS: Record<Metric, { label: string; value: (s: KeyStat) => number | null; format: (v: number) => string }> = {
  miss: {
    label: 'ミス率',
    value: (s) => (s.attempts > 0 ? s.misses / s.attempts : null),
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
  latency: {
    label: '平均遅延',
    value: (s) => s.meanLatencyMs,
    format: (v) => `${Math.round(v)}ms`,
  },
};

export function KeyboardHeatmap({ stats }: { stats: ReadonlyMap<string, KeyStat> }) {
  const id = useId();
  const [metric, setMetric] = useState<Metric>('miss');
  const [active, setActive] = useState<string | null>(null);
  const m = METRICS[metric];

  const values = [...stats.values()].map(m.value).filter((v): v is number => v !== null);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;

  const rows = [...stats.values()]
    .map((s) => ({ s, v: m.value(s) }))
    .filter((r): r is { s: KeyStat; v: number } => r.v !== null)
    .sort((a, b) => b.v - a.v);

  return (
    <figure className="flex flex-col gap-2">
      <figcaption id={`${id}-title`} className="flex items-center justify-between text-lg font-bold">
        <span>キー別の苦手</span>
        <span role="group" aria-label="指標" className="flex gap-1 text-sm font-normal">
          {(Object.keys(METRICS) as Metric[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={metric === k}
              onClick={() => setMetric(k)}
              className={`rounded px-3 py-1 ${metric === k ? 'bg-accent text-surface' : 'bg-surface-raised'}`}
            >
              {METRICS[k].label}
            </button>
          ))}
        </span>
      </figcaption>

      <div aria-labelledby={`${id}-title`} role="group" className="overflow-x-auto rounded-lg bg-surface-raised p-4">
        <div className="flex flex-col" style={{ gap: GAP, width: 'max-content' }}>
          {ROWS.map((row) => (
            <div key={row.keys} className="flex" style={{ gap: GAP, marginLeft: row.indent * (CELL + GAP) }}>
              {[...row.keys].map((key) => {
                const stat = stats.get(key);
                const value = stat ? m.value(stat) : null;
                const bin = value === null ? null : heatBin(value, min, max);
                const label =
                  stat && value !== null
                    ? `${key}: ${m.label} ${m.format(value)}（${stat.attempts}回中ミス${stat.misses}回）`
                    : `${key}: データなし`;
                return (
                  <div
                    key={key}
                    role="img"
                    aria-label={label}
                    tabIndex={0}
                    className="relative flex items-center justify-center rounded font-mono text-lg focus-visible:outline-2 focus-visible:outline-accent"
                    style={{
                      width: CELL,
                      height: CELL,
                      background: bin === null ? 'transparent' : HEAT[bin],
                      color: bin === null ? 'var(--viz-muted)' : inkOn(bin),
                      boxShadow:
                        active === key ? 'inset 0 0 0 2px var(--viz-ink)' : bin === null ? 'inset 0 0 0 1px var(--viz-axis)' : undefined,
                    }}
                    onPointerEnter={() => setActive(key)}
                    onPointerLeave={() => setActive(null)}
                    onFocus={() => setActive(key)}
                    onBlur={() => setActive(null)}
                  >
                    {key}
                    {active === key && (
                      <Tooltip left="50%" top="0%">
                        {stat && value !== null ? (
                          <>
                            <div className="font-bold">{m.format(value)}</div>
                            <div className="text-text-muted">
                              {key}・{m.label}
                            </div>
                            <div className="text-text-muted">
                              試行 {stat.attempts}回・ミス {stat.misses}回
                              {stat.meanLatencyMs !== null && `・平均 ${Math.round(stat.meanLatencyMs)}ms`}
                            </div>
                            {stat.attempts < FEW && <div className="text-text-muted">試行が少ないため参考値です</div>}
                          </>
                        ) : (
                          <div className="text-text-muted">{key}・データなし</div>
                        )}
                      </Tooltip>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm text-text-muted" aria-hidden>
          <span>{values.length ? m.format(min) : '—'}</span>
          <span className="flex" style={{ gap: GAP }}>
            {HEAT.map((c) => (
              <span key={c} className="inline-block h-3 w-8 rounded-sm" style={{ background: c }} />
            ))}
          </span>
          <span>{values.length ? m.format(max) : '—'}</span>
          <span className="ml-2">（明るいほど{metric === 'miss' ? 'ミスが多い' : '遅い'}）</span>
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-text-muted">表で見る</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-text-muted">
              <th className="py-1 font-normal">キー</th>
              <th className="py-1 font-normal">{m.label}</th>
              <th className="py-1 font-normal">試行</th>
              <th className="py-1 font-normal">ミス</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, v }) => (
              <tr key={s.key} className="border-t border-white/5">
                <td className="py-1 font-mono">{s.key}</td>
                <td className="py-1 tabular-nums">{m.format(v)}</td>
                <td className="py-1 tabular-nums">{s.attempts}</td>
                <td className="py-1 tabular-nums">{s.misses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
