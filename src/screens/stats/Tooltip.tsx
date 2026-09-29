import type { ReactNode } from 'react';

/** 親（position: relative）の left/top に置くツールチップ。値を先に、名前を後に（値が主役） */
export function Tooltip({ left, top, children }: { left: string; top: string; children: ReactNode }) {
  return (
    <div
      role="tooltip"
      style={{ left, top }}
      className="pointer-events-none absolute z-10 w-max max-w-64 -translate-x-1/2 -translate-y-full rounded bg-surface px-3 py-2 text-sm text-text shadow-lg ring-1 ring-white/10"
    >
      {children}
    </div>
  );
}

/** 系列の見出し用の短い線（塗りの箱ではなく線で示す） */
export function LineKey() {
  return <span aria-hidden className="mr-2 inline-block h-0.5 w-3 align-middle" style={{ background: 'var(--viz-series-1)' }} />;
}
