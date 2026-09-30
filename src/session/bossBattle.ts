import type { PressEvent } from './practiceSession';

export type BattleStatus = 'fighting' | 'won' | 'lost';
export type BossRank = 'S' | 'A' | 'B' | 'C' | 'D';

/** 強い順。best の比較に使う */
export const BOSS_RANKS: readonly BossRank[] = ['S', 'A', 'B', 'C', 'D'];

export interface BattleRules {
  /** 倒すべきお題の数（ボスの HP。お題を1つ打ち終えるごとに1減る） */
  readonly words: number;
  /** 許されるミスの数。これを超えるミスで敗北 */
  readonly maxMisses: number;
}

export interface BattleState {
  readonly status: BattleStatus;
  /** ボスの残り HP（残りのお題の数） */
  readonly bossRemaining: number;
  readonly bossTotal: number;
  /** 1〜4。ボスの HP の減り具合で上がる */
  readonly phase: number;
  readonly misses: number;
  /** あと何回ミスしても負けないか（0 なら次のミスで敗北） */
  readonly missesLeft: number;
  readonly combo: number;
  readonly maxCombo: number;
}

export const PHASES = 4;

/**
 * ボス戦の進行。DOM にも打鍵の中身にも依存せず、練習の進行結果（PressEvent）だけを受ける。
 * 入力の判定はこのクラスの外（PracticeSession）が行うので、ボス戦の有無で判定・計測は変わらない。
 * 乱数・時計を使わない（同じ入力列なら同じ結果）。
 */
export class BossBattle {
  private done = 0;
  private misses = 0;
  private combo = 0;
  private maxCombo = 0;
  private status: BattleStatus = 'fighting';

  constructor(private readonly rules: BattleRules) {
    if (rules.words < 1) throw new Error('お題が1つも無いボス戦は作れません');
    if (rules.maxMisses < 0) throw new Error('maxMisses は 0 以上');
  }

  /** @returns フェーズが上がったときだけ、新しいフェーズ */
  apply(event: PressEvent): { phaseChanged: number | null } {
    if (this.status !== 'fighting' || event === 'ignored') return { phaseChanged: null };
    const before = this.state().phase;
    if (event === 'miss') {
      this.misses++;
      this.combo = 0;
      if (this.misses > this.rules.maxMisses) this.status = 'lost';
    } else {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      if (event === 'wordDone' || event === 'sessionDone') this.done++;
      if (event === 'sessionDone') this.status = 'won';
    }
    const after = this.state().phase;
    return { phaseChanged: after > before ? after : null };
  }

  state(): BattleState {
    const { words, maxMisses } = this.rules;
    const won = this.status === 'won';
    return {
      status: this.status,
      bossRemaining: won ? 0 : words - this.done,
      bossTotal: words,
      // 倒した瞬間も最終フェーズのまま（5 にならない）
      phase: Math.min(PHASES, 1 + Math.floor((PHASES * this.done) / words)),
      misses: this.misses,
      missesLeft: Math.max(0, maxMisses - this.misses),
      combo: this.combo,
      maxCombo: this.maxCombo,
    };
  }

  /** 結果のランク（戦闘中は null）。S=ノーミス / A=1ミス / B=許容の半分以下 / C=それ以上 / D=敗北 */
  rank(): BossRank | null {
    if (this.status === 'fighting') return null;
    if (this.status === 'lost') return 'D';
    if (this.misses === 0) return 'S';
    if (this.misses <= 1) return 'A';
    return this.misses <= Math.floor(this.rules.maxMisses / 2) ? 'B' : 'C';
  }
}

/** より良い方のランク（null は未挑戦） */
export function betterRank(a: BossRank | null, b: BossRank | null): BossRank | null {
  if (a === null) return b;
  if (b === null) return a;
  return BOSS_RANKS.indexOf(a) <= BOSS_RANKS.indexOf(b) ? a : b;
}
