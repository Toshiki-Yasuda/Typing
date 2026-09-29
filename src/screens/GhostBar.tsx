import { useEffect, useState } from 'react';
import { aheadMs, type Ghost } from '@/session/ghost';
import type { PracticeSession } from '@/session/practiceSession';

/** 差の表示。色だけに頼らず、符号と「先行/遅れ」の語でも伝える */
export function formatAhead(ms: number): { text: string; ahead: boolean } {
  const seconds = Math.abs(ms) / 1000;
  if (Math.round(seconds * 10) === 0) return { text: '±0.0秒', ahead: true };
  return ms > 0 ? { text: `+${seconds.toFixed(1)}秒 先行`, ahead: true } : { text: `−${seconds.toFixed(1)}秒 遅れ`, ahead: false };
}

/** 更新の間隔。打鍵が無い間も、ゴーストは進み続ける */
const TICK_MS = 100;

interface Props {
  ghost: Ghost;
  session: PracticeSession;
  /** 何のゴーストか（例: 今日の最高） */
  label: string;
}

/** 自分（青）とゴースト（灰）の位置を並べて示す。差は秒で出す */
export function GhostBar({ ghost, session, label }: Props) {
  // 描画中に performance.now() を呼ばない。一定間隔で読んだ値を state に持つ
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const total = ghost.totalItems;
  const elapsed = session.elapsedMs(now);
  const you = session.position();
  const ghostPosition = ghost.positionAt(elapsed);
  const delta = aheadMs(ghost, you, elapsed);
  const shown = delta === null ? null : formatAhead(delta);
  const pct = (position: number) => `${Math.min(100, (position / total) * 100)}%`;

  return (
    <section aria-label="ゴースト" className="flex flex-col gap-2 rounded-lg bg-surface-raised p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-muted">ゴースト: {label}</span>
        {shown && (
          <span className="font-bold" style={{ color: shown.ahead ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {shown.text}
          </span>
        )}
      </div>
      <div aria-hidden className="relative h-3 rounded" style={{ background: 'var(--viz-grid)' }}>
        <div className="absolute inset-y-0 left-0 rounded" style={{ width: pct(ghostPosition), background: 'var(--viz-muted)' }} />
        <div className="absolute inset-y-0 left-0 rounded" style={{ width: pct(you), background: 'var(--viz-series-1)', height: '50%', top: '25%' }} />
      </div>
      <div className="flex gap-4 text-xs text-text-muted" aria-hidden>
        <span>
          <span className="mr-1 inline-block h-2 w-3 align-middle" style={{ background: 'var(--viz-series-1)' }} />
          あなた
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-3 align-middle" style={{ background: 'var(--viz-muted)' }} />
          ゴースト
        </span>
      </div>
    </section>
  );
}
