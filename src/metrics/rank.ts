/**
 * 級位。実効速度（KPM）の段階と、判定の仕方。仕様: docs/spec/ranks.md
 * 段階の値は仮置き（使いながら調整する）。1か所に集めてあるので、ここだけ直せばよい。
 */
export interface Rank {
  readonly id: string;
  readonly label: string;
  /** この級位に必要な実効速度（打鍵/分） */
  readonly minKpm: number;
}

const kyu = (n: number, minKpm: number): Rank => ({ id: `k${n}`, label: `${n}級`, minKpm });
const dan = (label: string, id: string, minKpm: number): Rank => ({ id, label, minKpm });

/** 低い順。10級は 0、9級は 40、それ以降は 30 打鍵/分刻み（初段以降も同じ） */
export const RANKS: readonly Rank[] = [
  kyu(10, 0),
  kyu(9, 40),
  kyu(8, 70),
  kyu(7, 100),
  kyu(6, 130),
  kyu(5, 160),
  kyu(4, 190),
  kyu(3, 220),
  kyu(2, 250),
  kyu(1, 280),
  dan('初段', 'd1', 310),
  dan('二段', 'd2', 340),
  dan('三段', 'd3', 370),
  dan('四段', 'd4', 400),
  dan('五段', 'd5', 430),
  dan('六段', 'd6', 460),
  dan('七段', 'd7', 490),
  dan('八段', 'd8', 520),
  dan('九段', 'd9', 550),
  dan('十段', 'd10', 580),
];

/** 級位の判定に数える練習の、最低の正確率。雑に速く打っても級位が上がらないようにする */
export const RANK_MIN_ACCURACY = 0.95;
/** 打鍵が少なすぎる練習は、たまたまの値なので数えない */
export const RANK_MIN_KEYSTROKES = 20;
/** 現在の級位を決めるために見る、直近の（数える）練習の回数 */
export const RANK_WINDOW = 5;
/** これ未満の回数では「暫定」の級位にする */
export const RANK_CERTIFY_COUNT = 3;

export interface SessionSample {
  readonly kpm: number;
  readonly accuracy: number;
  readonly total: number;
}

/** 速度に対応する級位（正確率は見ない） */
export function rankFor(kpm: number): Rank {
  let result = RANKS[0] as Rank;
  for (const rank of RANKS) if (kpm >= rank.minKpm) result = rank;
  return result;
}

export function rankById(id: string): Rank | undefined {
  return RANKS.find((r) => r.id === id);
}

export function nextRank(rank: Rank): Rank | null {
  const i = RANKS.findIndex((r) => r.id === rank.id);
  return RANKS[i + 1] ?? null;
}

/** この練習は級位の判定に数えるか */
export function countsForRank(s: SessionSample): boolean {
  return s.kpm > 0 && s.accuracy >= RANK_MIN_ACCURACY && s.total >= RANK_MIN_KEYSTROKES;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export interface RankStatus {
  /** 現在の級位。数える練習がまだ無ければ null */
  readonly rank: Rank | null;
  /** 級位の元になった速度（直近の数える練習の中央値） */
  readonly basisKpm: number | null;
  /** 判定に使った練習の回数 */
  readonly count: number;
  /** 回数が少なく、暫定の級位 */
  readonly provisional: boolean;
  readonly next: Rank | null;
  /** 次の級位まであと何打鍵/分か */
  readonly toNextKpm: number | null;
}

/**
 * 現在の級位。判定に数える直近 RANK_WINDOW 回の実効速度の中央値で決める
 * （1回だけ調子が良くても上がらず、1回だけ悪くても下がらない）。
 * @param sessions 開始時刻の昇順
 */
export function rankStatus(sessions: readonly SessionSample[]): RankStatus {
  const recent = sessions.filter(countsForRank).slice(-RANK_WINDOW);
  if (recent.length === 0) {
    return { rank: null, basisKpm: null, count: 0, provisional: true, next: RANKS[0] ?? null, toNextKpm: null };
  }
  const basisKpm = median(recent.map((s) => s.kpm));
  const rank = rankFor(basisKpm);
  const next = nextRank(rank);
  return {
    rank,
    basisKpm,
    count: recent.length,
    provisional: recent.length < RANK_CERTIFY_COUNT,
    next,
    toNextKpm: next ? next.minKpm - basisKpm : null,
  };
}

/** 目標の級位。'auto' なら「次の級位」（最上位なら現在の級位） */
export const GOAL_AUTO = 'auto';

export interface GoalProgress {
  readonly goal: Rank;
  readonly achieved: boolean;
  /** 目標まであと何打鍵/分か（達成済みなら 0） */
  readonly remainingKpm: number;
}

/** 目標に対する進み具合。数える練習がまだ無ければ null */
export function goalProgress(status: RankStatus, goalId: string): GoalProgress | null {
  if (status.rank === null || status.basisKpm === null) return null;
  const chosen = goalId === GOAL_AUTO ? undefined : rankById(goalId);
  const goal = chosen ?? status.next ?? status.rank;
  const remaining = Math.max(0, goal.minKpm - status.basisKpm);
  return { goal, achieved: status.basisKpm >= goal.minKpm, remainingKpm: remaining };
}
