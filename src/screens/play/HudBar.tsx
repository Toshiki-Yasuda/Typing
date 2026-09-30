interface Props {
  /** 0 始まりの、いま打っているお題の番号 */
  index: number;
  total: number;
  /** 修行の型の名前など（あれば中央に出す） */
  label?: string;
  /** 練・ボスの残り時間（ミリ秒）。無ければ出さない */
  remaining: number | null;
}

/**
 * 練習画面の上部バー（進捗・時間・中断）。U2（ライブ HUD）の担当ファイル。
 * アクセシブルな名前（進捗 / タイマー）は変えない。
 */
export function HudBar({ index, total, label, remaining }: Props) {
  return (
    <>
      <header className="flex items-center justify-between text-text-muted">
        {/* 進捗バーの役割は、見える文字（1 / 10）を持つ要素に付ける。バーそのものは装飾 */}
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
        {remaining !== null && (
          <span role="timer" className="font-mono text-lg text-text">
            残り {Math.ceil(remaining / 1000)} 秒
          </span>
        )}
        <span className="text-sm">Esc で中断</span>
      </header>
      <div aria-hidden className="h-1 rounded bg-surface-raised">
        <div className="h-1 rounded bg-accent" style={{ width: `${(index / total) * 100}%` }} />
      </div>
    </>
  );
}
