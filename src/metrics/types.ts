/**
 * 打鍵ログ。指標・統計はすべてここから再計算する（仕様: docs/spec/metrics.md）。
 * 判定ロジックを変えても、過去のログから計算し直せる。
 */
export interface Keystroke {
  /** セッション開始からの相対ミリ秒（`event.timeStamp` ベース。相対比較用で、絶対精度は保証しない） */
  readonly t: number;
  /** 打った文字（`KeyboardEvent.key`、1文字） */
  readonly key: string;
  /** 物理キー位置（`KeyboardEvent.code`） */
  readonly code: string;
  /** 期待されていたキー。誤打鍵のときは、ガイドが示していた次のキー */
  readonly expected: string | null;
  readonly correct: boolean;
  /** 何番目のお題か（お題をまたぐ間隔は統計から除く） */
  readonly item: number;
}

export interface SessionRecord {
  readonly id: string;
  /** 開始時刻（エポックミリ秒） */
  readonly startedAt: number;
  readonly mode: string;
  readonly contentId: string;
  readonly targets: readonly string[];
  readonly engineVersion: string;
  readonly ruleVersion: string;
  readonly keystrokes: readonly Keystroke[];
  /** 縛り（制約と誓約）の id。付けなかったときは持たない。付き記録は級位・統計に数えない（docs/spec/vows.md） */
  readonly vows?: readonly string[];
}

export interface Metrics {
  readonly total: number;
  readonly correct: number;
  readonly misses: number;
  /** 正打鍵 / 総打鍵（打鍵ゼロなら 1） */
  readonly accuracy: number;
  /** 最初の打鍵から最後の正打までのミリ秒（表示用の所要時間。お題の間の待ちを含む） */
  readonly elapsedMs: number;
  /** 打鍵時間: お題の中の連続する打鍵の間隔の合計（お題の間の待ち・休止を除く） */
  readonly activeMs: number;
  /** 実効速度: 正打で終わる間隔の数 / 打鍵時間（分） */
  readonly kpm: number;
  /** raw 速度: 間隔の数 / 打鍵時間（分）。ミスも進んだものとして数える */
  readonly rawKpm: number;
  /** 参考表示: KPM ÷ 5 */
  readonly wpm: number;
  /** 一貫性 0〜100。打鍵間隔が3つ未満なら null */
  readonly consistency: number | null;
  /** 理論最小打鍵数 / 総打鍵。最小打鍵数を渡さなければ null */
  readonly efficiency: number | null;
}
