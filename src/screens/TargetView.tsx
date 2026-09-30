import type { PressFx } from './play/types';
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

/** 表示: お題・読み（確定した分を強調）・ローマ字ガイド（打鍵済み + 残りの最短） */
export function TargetView({
  view,
  missing,
  weakKeys,
  preview = false,
  hideRomaji = false,
}: {
  view: SessionView;
  missing: boolean;
  /** 補助（凝）: 強調する弱点のキー。表示だけで、判定には関わらない */
  weakKeys?: ReadonlySet<string>;
  /** 補助（円）: 次のお題を先に見せる */
  preview?: boolean;
  /** 縛り（ローマ字を隠す）: ガイドの文字を「・」にする。読みと表示は見える。表示だけで判定には関わらない */
  hideRomaji?: boolean | 'rest';
  /** 直前の打鍵の結果（U3: キャレット・ミスの表現が使う）。いまは未使用 */
  press?: PressFx;
}) {
  const reading = Array.from(normalizeTarget(view.item.reading));
  const { typed, rest, kanaIndex } = view.guide;
  const [next = '', ...others] = Array.from(rest);
  const size = sizeClasses(Array.from(view.item.display).length, reading.length, typed.length + rest.length);
  return (
    <section
      aria-label="お題"
      className={`target-card relative flex flex-col items-center gap-4 p-8 text-center transition-colors ${
        missing ? 'bg-danger/20 ring-2 ring-danger' : 'bg-surface-raised'
      }`}
    >
      {/* 色だけに頼らず、文字と枠でも誤打鍵を示す。読み上げには出さない（誤打鍵のたびに読み上げると邪魔になる） */}
      {missing && (
        <span aria-hidden className="absolute right-3 top-2 text-sm font-bold text-danger">
          ミス
        </span>
      )}
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
        <span className="target-typed">{typed}</span>
        <span className="target-next">{next === ' ' ? '␣' : next}</span>
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
    </section>
  );
}
