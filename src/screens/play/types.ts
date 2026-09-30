/** 直前の打鍵の結果。演出（キャレット・キー図・粒子）が「いま何が起きたか」を知るための、表示専用の値。判定・計測には使わない */
export interface PressFx {
  /** 打鍵ごとに増える連番。同じ結果が続いても、演出を最初から再生し直すために使う（key に使う） */
  readonly seq: number;
  readonly result: 'ok' | 'miss' | 'wordDone' | 'sessionDone';
  /** 押されたキー（KeyboardEvent.key） */
  readonly key: string;
  /** 打つべきだったキー（ミスのとき、正しいキーを示す）。分からなければ null */
  readonly expected: string | null;
}
