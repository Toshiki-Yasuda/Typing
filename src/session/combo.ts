import type { PressEvent } from './practiceSession';

/** コンボの段階。`at` は、その段階に入る連続正打の数（最初の段階は 0） */
export interface ComboLevel {
  readonly at: number;
  readonly name: string;
}

export interface LevelInfo {
  /** 何番目の段階か（0 始まり） */
  readonly index: number;
  readonly level: ComboLevel;
  /** 次の段階（最後の段階なら null） */
  readonly next: ComboLevel | null;
  /** 次の段階までの進み 0〜1（最後の段階は 1） */
  readonly progress: number;
  /** 次の段階まであと何回か（最後の段階は 0） */
  readonly remaining: number;
}

/** コンボ数から、段階と次までの進みを求める。levels は `at` の昇順で、最初が 0 */
export function levelAt(levels: readonly ComboLevel[], combo: number): LevelInfo {
  let index = 0;
  for (let i = 0; i < levels.length; i++) if (combo >= (levels[i] as ComboLevel).at) index = i;
  const level = levels[index] as ComboLevel;
  const next = levels[index + 1] ?? null;
  const span = next ? next.at - level.at : 1;
  return {
    index,
    level,
    next,
    progress: next ? Math.min(1, (combo - level.at) / span) : 1,
    remaining: next ? next.at - combo : 0,
  };
}

/**
 * 連続正打の数（コンボ）。正打で増え、ミスで 0 に戻る。
 * 段階に入った瞬間（境界をまたいだ 1 回だけ）を返す。描画・効果音のための値で、判定・計測には関わらない。
 */
export class ComboTracker {
  private _combo = 0;
  private _max = 0;

  constructor(private readonly levels: readonly ComboLevel[]) {}

  get combo(): number {
    return this._combo;
  }
  get max(): number {
    return this._max;
  }

  /** @returns 段階が上がったときだけ、その段階 */
  apply(event: PressEvent): { entered: ComboLevel | null } {
    if (event === 'ignored') return { entered: null };
    if (event === 'miss') {
      this._combo = 0;
      return { entered: null };
    }
    const before = levelAt(this.levels, this._combo).index;
    this._combo++;
    this._max = Math.max(this._max, this._combo);
    const after = levelAt(this.levels, this._combo);
    return { entered: after.index > before ? after.level : null };
  }
}
