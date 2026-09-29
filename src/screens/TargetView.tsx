import type { SessionView } from '@/session/practiceSession';
import { normalizeTarget } from '@/engine';

/** 長い文でも収まるよう、文字数に応じて大きさを変える（短い語は大きく、長い文は小さく折り返す） */
export function sizeClasses(displayLength: number, readingLength: number, romajiLength: number) {
  return {
    display: displayLength <= 12 ? 'text-4xl' : displayLength <= 24 ? 'text-3xl' : 'text-2xl',
    reading: readingLength <= 12 ? 'text-2xl' : readingLength <= 24 ? 'text-xl' : 'text-lg',
    romaji: romajiLength <= 24 ? 'text-3xl tracking-widest' : romajiLength <= 48 ? 'text-2xl tracking-wide' : 'text-xl tracking-normal',
  };
}

/** 表示: お題・読み（確定した分を強調）・ローマ字ガイド（打鍵済み + 残りの最短） */
export function TargetView({ view, missing }: { view: SessionView; missing: boolean }) {
  const reading = Array.from(normalizeTarget(view.item.reading));
  const { typed, rest, kanaIndex } = view.guide;
  const [next = '', ...others] = Array.from(rest);
  const size = sizeClasses(Array.from(view.item.display).length, reading.length, typed.length + rest.length);
  return (
    <section
      aria-label="お題"
      className={`flex flex-col items-center gap-4 rounded-lg p-8 text-center transition-colors ${
        missing ? 'bg-danger/20' : 'bg-surface-raised'
      }`}
    >
      <p className={`${size.display} font-bold break-words`}>{view.item.display}</p>
      <p className={`${size.reading} tracking-wider break-words`}>
        <span className="text-success">{reading.slice(0, kanaIndex).join('')}</span>
        <span className="text-text-muted">{reading.slice(kanaIndex).join('')}</span>
      </p>
      <p className={`font-mono ${size.romaji} break-all`} aria-label="ローマ字ガイド">
        <span className="text-text-muted">{typed}</span>
        <span className="text-accent underline decoration-2 underline-offset-8">{next === ' ' ? '␣' : next}</span>
        <span>{others.join('')}</span>
      </p>
    </section>
  );
}
