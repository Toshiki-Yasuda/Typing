import { LAYOUTS, describeKey, locate, type KeyDef, type LayoutId } from '@/fingering';

const CELL = 36;
const GAP = 2;
/** ホームポジションの目印（F と J の突起） */
const HOME_MARKS = new Set(['f', 'j']);

function Cell({ label, active, home, width = 1, dim = false }: { label: string; active: boolean; home?: boolean; width?: number; dim?: boolean }) {
  return (
    <div
      aria-current={active ? 'true' : undefined}
      className="relative flex items-center justify-center rounded font-mono text-sm"
      style={{
        width: CELL * width + GAP * (width - 1),
        height: CELL,
        background: active ? 'var(--color-accent)' : 'transparent',
        color: active ? 'var(--viz-heat-ink-dark)' : dim ? 'var(--viz-muted)' : 'var(--viz-ink-secondary)',
        boxShadow: active ? undefined : 'inset 0 0 0 1px var(--viz-axis)',
        fontWeight: active ? 700 : 400,
      }}
    >
      {label}
      {home && !active && <span aria-hidden className="absolute bottom-1 h-0.5 w-3 rounded" style={{ background: 'var(--viz-muted)' }} />}
    </div>
  );
}

const labelOf = (key: KeyDef) => (/^[a-z]$/.test(key.base) ? key.base.toUpperCase() : key.base);

/**
 * 運指ガイド。次に打つキーを光らせ、Shift が要るときは反対側の Shift も光らせる。
 * 図は補助で、指の名前は文字でも示す（図だけに頼らない）。
 */
export function FingerGuide({ next, layout }: { next: string | undefined; layout: LayoutId }) {
  const def = LAYOUTS[layout];
  const loc = next ? locate(def, next) : null;
  const activeBase = loc?.key.base;
  const shiftSide = loc?.shift ? (loc.shiftFinger === 'R-pinky' ? 'right' : 'left') : null;

  return (
    <section aria-label="運指ガイド" className="flex flex-col items-center gap-3 rounded-lg bg-surface-raised p-4">
      <p className="min-h-6 text-lg font-bold">{loc ? describeKey(loc) : ''}</p>
      <div aria-hidden className="flex flex-col" style={{ gap: GAP }}>
        {def.rows.map((row, r) => {
          const last = r === def.rows.length - 1;
          return (
            <div key={r} className="flex" style={{ gap: GAP, marginLeft: row.indent * (CELL + GAP) }}>
              {last && <Cell label="Shift" width={1.5} active={shiftSide === 'left'} dim />}
              {row.keys.map((key) => (
                <Cell key={key.base} label={labelOf(key)} active={activeBase === key.base} home={HOME_MARKS.has(key.base)} />
              ))}
              {last && <Cell label="Shift" width={1.5} active={shiftSide === 'right'} dim />}
            </div>
          );
        })}
        <div className="flex justify-center" style={{ marginLeft: 3 * (CELL + GAP) }}>
          <Cell label="" width={6} active={next === ' '} />
        </div>
      </div>
      <p className="text-xs text-text-muted">
        {def.name}の表示です（判定は打った文字で行うので、配列が違っても遊べます）
      </p>
    </section>
  );
}
