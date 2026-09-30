import type { LevelInfo } from '@/session/combo';

interface Props {
  combo: number;
  info: LevelInfo;
  /** 段階が上がった直後（しばらくして消える）。動かすかどうかも渡す */
  reached?: { name: string; animate: boolean } | null;
}

/**
 * コンボと今の段階。段階の名前・連続数・次までの残りを、色ではなく文字で示す。
 * 打鍵のたびに変わるので、読み上げ（aria-live）にはしない。段階が上がった瞬間だけ「到達」を知らせる。
 * お題の文字に重ねない（HUD の帯の中だけで完結させる）。
 */
export function FeelHud({ combo, info, reached = null }: Props) {
  return (
    <div role="group" aria-label="コンボの段階" className="feel-hud">
      {/* key を段階にして、段階が変わったときにバッジの「跳ね」を最初から再生する */}
      <span key={info.index} className="feel-badge" data-animate={reached?.animate ?? false} data-bump={info.index > 0}>
        {info.level.name}
      </span>
      <span className="feel-count">
        <strong>{combo}</strong> 連続
      </span>
      <span aria-hidden className="feel-meter">
        <span className="feel-meter-fill" style={{ width: `${info.progress * 100}%` }} />
      </span>
      <span className="feel-next">{info.next ? `次の「${info.next.name}」まで あと ${info.remaining}` : '最高の段階'}</span>
      {reached && (
        <span role="status" data-animate={reached.animate} className="feel-pop">
          「{reached.name}」に到達
        </span>
      )}
    </div>
  );
}
