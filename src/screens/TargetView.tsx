import type { SessionView } from '@/session/practiceSession';
import { normalizeTarget } from '@/engine';

/** 表示: お題・読み（確定した分を強調）・ローマ字ガイド（打鍵済み + 残りの最短） */
export function TargetView({ view, missing }: { view: SessionView; missing: boolean }) {
  const reading = Array.from(normalizeTarget(view.item.reading));
  const { typed, rest, kanaIndex } = view.guide;
  const [next = '', ...others] = Array.from(rest);
  return (
    <section
      aria-label="お題"
      className={`flex flex-col items-center gap-4 rounded-lg p-8 transition-colors ${
        missing ? 'bg-danger/20' : 'bg-surface-raised'
      }`}
    >
      <p className="text-4xl font-bold">{view.item.display}</p>
      <p className="text-2xl tracking-wider">
        <span className="text-success">{reading.slice(0, kanaIndex).join('')}</span>
        <span className="text-text-muted">{reading.slice(kanaIndex).join('')}</span>
      </p>
      <p className="font-mono text-3xl tracking-widest" aria-label="ローマ字ガイド">
        <span className="text-text-muted">{typed}</span>
        <span className="text-accent underline decoration-2 underline-offset-8">{next === ' ' ? '␣' : next}</span>
        <span>{others.join('')}</span>
      </p>
    </section>
  );
}
