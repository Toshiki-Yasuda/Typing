/** 練習中に見せる数字（`liveMetrics` の結果と同じ形）。null は「まだ出せない」 */
export interface HudStats {
  kpm: number | null;
  accuracy: number | null;
  misses: number;
  elapsedSec: number;
}

interface Props {
  /** 0 始まりの、いま打っているお題の番号 */
  index: number;
  total: number;
  /** 修行の型の名前など（あれば中央に出す） */
  label?: string;
  /** 練・ボスの残り時間（ミリ秒）。無ければ出さない */
  remaining: number | null;
  /** 練習中の数字。渡されなければ数字は出さない */
  stats?: HudStats;
  /** false（設定「練習中の数字を隠す」）なら数字を出さない。既定は true */
  showStats?: boolean;
  /** 渡されたときだけ「中断」をボタンにする（Esc は Play が受ける） */
  onAbort?: () => void;
}

/** 秒を 0:00 の形に */
export function formatElapsed(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 刻みで並べる語数の上限。これより多いと1つが細くなりすぎるので、連続したバーにする */
export const MAX_TICKS = 30;

/** 語ごとの刻み。完了（塗り）・現在（太い枠＋下線）・未来（細い枠）を形で分ける。多いときは連続バー。読み上げ対象外 */
function Ticks({ index, total }: { index: number; total: number }) {
  if (total > MAX_TICKS) {
    return (
      <div aria-hidden className="hud-bar" data-testid="hud-bar">
        <div className="hud-bar__fill" style={{ width: `${Math.min(100, (index / total) * 100)}%` }} />
      </div>
    );
  }
  return (
    <ol aria-hidden className="hud-ticks">
      {Array.from({ length: total }, (_, i) => (
        <li key={i} className="hud-tick" data-state={i < index ? 'done' : i === index ? 'current' : 'todo'} />
      ))}
    </ol>
  );
}

/**
 * 練習画面の上部バー（進捗・時間・数字・中断）。U2（ライブ HUD）の担当ファイル。
 * アクセシブルな名前（進捗 / タイマー）は変えない。数字は aria-live にしない（読み上げで邪魔をしない）。
 */
export function HudBar({ index, total, label, remaining, stats, showStats = true, onAbort }: Props) {
  const abortText = (
    <>
      中断<span className="hud-abort-key">（Esc）</span>
    </>
  );
  return (
    <>
      <header className="flex items-center justify-between gap-3 text-text-muted">
        {/* 進捗の役割は、見える文字（1 / 10）を持つ要素に付ける。刻みは装飾で、文字を含めない */}
        <div
          role="progressbar"
          aria-label="進捗"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={index}
          aria-valuetext={`${total}問中 ${index + 1}問目`}
        >
          {index + 1} / {total}
        </div>
        {label && <span className="font-bold text-text">{label}</span>}
        {stats && showStats && (
          <dl className="hud-stats" data-testid="hud-stats">
            <div>
              <dt>速さ</dt>
              <dd>
                {stats.kpm === null ? '--' : Math.round(stats.kpm)}
                <span className="hud-unit">打/分</span>
              </dd>
            </div>
            <div>
              <dt>正確率</dt>
              <dd>{stats.accuracy === null ? '--' : `${Math.floor(stats.accuracy * 100)}%`}</dd>
            </div>
            <div>
              <dt>ミス</dt>
              <dd>{stats.misses}</dd>
            </div>
            <div>
              <dt>経過</dt>
              <dd>{formatElapsed(stats.elapsedSec)}</dd>
            </div>
          </dl>
        )}
        {remaining !== null && (
          <span role="timer" className="font-mono text-lg text-text">
            残り {Math.ceil(remaining / 1000)} 秒
          </span>
        )}
        {onAbort ? (
          <button type="button" className="hud-abort" onClick={onAbort} title="記録は残りません">
            {abortText}
          </button>
        ) : (
          <span className="hud-abort" title="記録は残りません">
            {abortText}
          </span>
        )}
      </header>
      <Ticks index={index} total={total} />
    </>
  );
}
