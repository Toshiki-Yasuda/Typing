import { z } from 'zod';
import { BOSS_RANKS, betterRank, type BossRank } from './bossBattle';

/** ボスごとの戦績（挑戦回数・勝利回数・最高ランク）。小さな設定値なので localStorage に置く */
export const BOSS_PROGRESS_KEY = 'typing.boss.v1';

const EntrySchema = z.object({
  attempts: z.number().int().min(0),
  wins: z.number().int().min(0),
  best: z.enum(BOSS_RANKS as [BossRank, ...BossRank[]]).nullable(),
  /** 勝利したときの、最大の縛りの数（メダルの元）。旧データには無い */
  bestVows: z.number().int().min(0).max(4).optional(),
});
export type BossEntry = z.infer<typeof EntrySchema>;
export type BossProgress = Readonly<Record<string, BossEntry>>;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function storageOrNull(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadBossProgress(storage: Store | null = storageOrNull()): BossProgress {
  try {
    const data: unknown = JSON.parse(storage?.getItem(BOSS_PROGRESS_KEY) ?? '{}');
    if (typeof data !== 'object' || data === null) return {};
    const out: Record<string, BossEntry> = {};
    for (const [id, value] of Object.entries(data)) {
      const parsed = EntrySchema.safeParse(value);
      if (parsed.success) out[id] = parsed.data;
    }
    return out;
  } catch {
    return {};
  }
}

/** 1回の挑戦結果を足した戦績を返し、保存する */
export function recordBossResult(
  bossId: string,
  rank: BossRank,
  storage: Store | null = storageOrNull(),
  /** この挑戦で付けていた縛りの数 */
  vowCount = 0,
): BossProgress {
  const all = loadBossProgress(storage);
  const before = all[bossId] ?? { attempts: 0, wins: 0, best: null };
  const next: BossProgress = {
    ...all,
    [bossId]: {
      attempts: before.attempts + 1,
      wins: before.wins + (rank === 'D' ? 0 : 1),
      best: betterRank(before.best, rank === 'D' ? null : rank),
      // 勝ったときだけ、縛りの数を更新する（敗北では変えない）
      ...(rank === 'D' ? (before.bestVows !== undefined ? { bestVows: before.bestVows } : {}) : { bestVows: Math.max(before.bestVows ?? 0, vowCount) }),
    },
  };
  try {
    storage?.setItem(BOSS_PROGRESS_KEY, JSON.stringify(next));
  } catch {
    // 保存できなくても、今回の結果は画面に出る
  }
  return next;
}
