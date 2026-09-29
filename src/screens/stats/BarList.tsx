import { useId, useState } from 'react';
import { Tooltip } from './Tooltip';

export interface BarRow {
  readonly label: string;
  readonly value: number;
  /** ツールチップの補足（回数など） */
  readonly detail: string;
}

interface Props {
  title: string;
  rows: readonly BarRow[];
  format: (value: number) => string;
  valueHeader: string;
  empty: string;
}

const BAR_HEIGHT = 20; // 24px 以下

/** 横棒のランキング。棒はベースライン（左）から伸び、先端だけ 4px 丸める。値は棒の先に出す */
export function BarList({ title, rows, format, valueHeader, empty }: Props) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...rows.map((r) => r.value), 0);

  return (
    <figure className="flex flex-col gap-2">
      <figcaption id={`${id}-title`} className="text-lg font-bold">
        {title}
      </figcaption>
      {rows.length === 0 ? (
        <p className="rounded-lg bg-surface-raised p-4 text-text-muted">{empty}</p>
      ) : (
        <ul aria-labelledby={`${id}-title`} className="flex flex-col gap-1 rounded-lg bg-surface-raised p-4">
          {rows.map((r, i) => (
            <li
              key={r.label}
              tabIndex={0}
              className="relative flex items-center gap-3 rounded py-1 focus-visible:outline-2 focus-visible:outline-accent"
              style={{ background: active === i ? 'rgba(255,255,255,0.05)' : undefined }}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <span className="w-12 shrink-0 text-right font-mono">{r.label}</span>
              <span className="flex flex-1 items-center gap-2">
                <span
                  aria-hidden
                  style={{
                    height: BAR_HEIGHT,
                    width: `${max > 0 ? Math.max(2, (r.value / max) * 85) : 0}%`,
                    background: 'var(--viz-series-1)',
                    borderRadius: '0 4px 4px 0',
                  }}
                />
                <span className="tabular-nums text-text-muted">{format(r.value)}</span>
              </span>
              {active === i && (
                <Tooltip left="50%" top="0%">
                  <div className="font-bold">{format(r.value)}</div>
                  <div className="text-text-muted">
                    {r.label}・{r.detail}
                  </div>
                </Tooltip>
              )}
            </li>
          ))}
        </ul>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-text-muted">
          表で見る<span className="sr-only">（{title}）</span>
        </summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-text-muted">
              <th className="py-1 font-normal">連接</th>
              <th className="py-1 font-normal">{valueHeader}</th>
              <th className="py-1 font-normal">回数</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-white/5">
                <td className="py-1 font-mono">{r.label}</td>
                <td className="py-1 tabular-nums">{format(r.value)}</td>
                <td className="py-1 text-text-muted">{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
