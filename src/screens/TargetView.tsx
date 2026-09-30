import { useEffect, useRef, useState } from 'react';
import type { PressFx } from './play/types';
import { prefersReducedMotion, resolveEffects } from '@/effects/level';
import { useSettings } from '@/settings/useSettings';
import { useFeel } from './feel/useFeel';
import type { SessionView } from '@/session/practiceSession';
import { normalizeTarget } from '@/engine';

/** 長い文でも収まるよう、文字数に応じて大きさを変える（短い語は大きく、長い文は小さく折り返す） */
export function sizeClasses(displayLength: number, readingLength: number, romajiLength: number) {
  // Tailwind はソース中の完全なクラス名を走査して生成するため、文字列は連結せず全文で書く
  return {
    display:
      displayLength <= 12
        ? 'text-[length:clamp(2.75rem,5.5vw,5rem)]'
        : displayLength <= 24
          ? 'text-[length:clamp(2rem,4vw,3.5rem)]'
          : 'text-[length:clamp(1.5rem,2.8vw,2.5rem)]',
    reading:
      readingLength <= 12
        ? 'text-[length:clamp(1.5rem,3vw,2.5rem)]'
        : readingLength <= 24
          ? 'text-[length:clamp(1.25rem,2.4vw,1.75rem)]'
          : 'text-[length:clamp(1rem,1.9vw,1.25rem)]',
    romaji:
      romajiLength <= 24
        ? 'text-[length:clamp(2.25rem,4.5vw,3.75rem)] tracking-widest'
        : romajiLength <= 48
          ? 'text-[length:clamp(1.75rem,3.4vw,2.75rem)] tracking-wide'
          : 'text-[length:clamp(1.25rem,2.4vw,1.875rem)] tracking-normal',
  };
}

/** 前の語が薄れる時間（fx.css の target-ghost と合わせる。少し余裕を持たせる） */
const GHOST_MS = 200;

/** 表示: お題・読み（確定した分を強調）・ローマ字ガイド（打鍵済み + 残りの最短） */
export function TargetView({
  view,
  missing,
  weakKeys,
  preview = false,
  hideRomaji = false,
  press,
}: {
  view: SessionView;
  missing: boolean;
  /** 補助（凝）: 強調する弱点のキー。表示だけで、判定には関わらない */
  weakKeys?: ReadonlySet<string>;
  /** 補助（円）: 次のお題を先に見せる */
  preview?: boolean;
  /** 縛り（ローマ字を隠す）: ガイドの文字を「・」にする。読みと表示は見える。表示だけで判定には関わらない */
  hideRomaji?: boolean | 'rest';
  /** 直前の打鍵の結果（U3: 正打の反応・ミスの強調・揺れが使う）。表示だけで、判定には関わらない */
  press?: PressFx;
}) {
  const [settings] = useSettings();
  const level = resolveEffects(settings.effects, prefersReducedMotion());
  // テーマの手応え（feel）があるときは、Play 側が揺らす。二重に揺らさない
  const themeShakes = useFeel() !== null;
  const cardRef = useRef<HTMLElement>(null);
  // 語が変わったら、前の語を薄れさせる（標準のみ）。描画中の state 更新で「前の語」を覚える
  const [seen, setSeen] = useState({ index: view.index, display: view.item.display });
  const [ghost, setGhost] = useState<string | null>(null);
  if (seen.index !== view.index) {
    setSeen({ index: view.index, display: view.item.display });
    setGhost(level === 'full' ? seen.display : null);
  }
  // 薄れ終わったら片づける（アニメーションの終了イベントに頼らず、時間で消す）
  useEffect(() => {
    if (ghost === null) return;
    const t = setTimeout(() => setGhost(null), GHOST_MS);
    return () => clearTimeout(t);
  }, [ghost]);
  // ミスの揺れ: 2px・120ms。連続のミスでも毎回やり直すため、要素のアニメーションで再生する
  const missSeq = press?.result === 'miss' ? press.seq : null;
  useEffect(() => {
    const el = cardRef.current;
    if (missSeq === null || level !== 'full' || themeShakes || !el || typeof el.animate !== 'function') return;
    el.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(0)' }],
      { duration: 120, easing: 'ease-in-out' },
    );
  }, [missSeq, level, themeShakes]);
  const reading = Array.from(normalizeTarget(view.item.reading));
  const { typed, rest, kanaIndex } = view.guide;
  const [next = '', ...others] = Array.from(rest);
  // 直前に打った1文字（正打のときだけ、小さく反応させる）
  const typedChars = Array.from(typed);
  const typedLast = typedChars.pop() ?? '';
  const typedHead = typedChars.join('');
  const hit = level !== 'off' && (press?.result === 'ok' || press?.result === 'wordDone');
  const size = sizeClasses(Array.from(view.item.display).length, reading.length, typed.length + rest.length);
  return (
    <section
      ref={cardRef}
      aria-label="お題"
      data-effect={level}
      className={`target-card relative flex flex-col items-center gap-4 p-8 text-center transition-colors bg-surface-raised ${
        missing ? 'ring-2 ring-danger' : ''
      }`}
    >
      {/* 色だけに頼らず、文字と枠でも誤打鍵を示す。読み上げには出さない（誤打鍵のたびに読み上げると邪魔になる） */}
      {missing && (
        <span aria-hidden className="absolute right-3 top-2 text-sm font-bold text-danger">
          ミス
        </span>
      )}
      {ghost !== null && (
        <p
          aria-hidden
          data-testid="target-ghost"
          className={`target-ghost ${size.display} font-bold break-words`}
        >
          {ghost}
        </p>
      )}
      <div key={view.index} className="target-enter flex w-full flex-col items-center gap-4">
      <p className={`${size.display} font-bold break-words`}>{view.item.display}</p>
      <p className={`${size.reading} tracking-wider break-words`}>
        <span className="text-success">{reading.slice(0, kanaIndex).join('')}</span>
        <span className="text-text-muted">{reading.slice(kanaIndex).join('')}</span>
      </p>
      {hideRomaji ? (
        <p className={`font-mono ${size.romaji} break-all text-text-muted`} aria-label="ローマ字ガイド（隠しています）">
          {hideRomaji === 'rest' ? typed : '・'.repeat(Array.from(typed).length)}
          <span className="text-accent">＊</span>
          {'・'.repeat(Array.from(others.join('')).length)}
        </p>
      ) : (
      <p className={`font-mono ${size.romaji} break-all`} aria-label="ローマ字ガイド">
        <span className="target-typed">
          {typedHead}
          {typedLast && (
            <span key={press?.seq} className={hit ? 'target-hit' : undefined}>
              {typedLast}
            </span>
          )}
        </span>
        <span key={typed.length} className={`target-next${missing ? ' target-expected' : ''}`}>
          {next === ' ' ? '␣' : next}
        </span>
        <span>
          {weakKeys && weakKeys.size > 0
            ? others.map((c, i) =>
                weakKeys.has(c.toLowerCase()) ? (
                  <span key={i} className="font-bold underline decoration-dotted decoration-2 underline-offset-8" data-weak>
                    {c}
                  </span>
                ) : (
                  c
                ),
              )
            : others.join('')}
        </span>
      </p>
      )}
      {preview && view.next && <p className="text-sm text-text-muted">次: {view.next.display}</p>}
      </div>
    </section>
  );
}
