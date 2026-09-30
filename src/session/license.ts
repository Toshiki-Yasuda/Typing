import type { SessionRecord } from '@/metrics';
import { RANKS, type Rank } from '@/metrics';
import type { BossProgress } from './bossProgress';
import { stageProgress } from './stageProgress';

/** ハンターネームの最大文字数 */
export const HUNTER_NAME_MAX = 12;

/** 級位 → 星の数（1〜5）。20 段階を 4 つずつ束ねる。級位が無ければ 0 */
export function starsOf(rank: Rank | null): number {
  if (!rank) return 0;
  const index = RANKS.findIndex((r) => r.id === rank.id);
  return index < 0 ? 0 : 1 + Math.floor(index / 4); // 20 段階なら最大 5（テストで固定）
}

/** 勝利したことのあるボスの数（テーマのボス id の中で数える） */
export function bossWins(progress: BossProgress, bossIds: readonly string[]): number {
  return bossIds.filter((id) => (progress[id]?.wins ?? 0) > 0).length;
}

/** クリアしたステージの数 */
export function stagesCleared(records: readonly SessionRecord[], stageIds: readonly string[]): number {
  return stageIds.filter((id) => stageProgress(records, id).cleared).length;
}

/** 入力されたハンターネームを整える（前後の空白を除き、最大文字数で切る） */
export function normalizeHunterName(input: string): string {
  return Array.from(input.trim()).slice(0, HUNTER_NAME_MAX).join('');
}
