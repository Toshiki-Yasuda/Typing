import type { BossRank } from '@/session/bossBattle';
import type { Boss } from '@/themes/theme';

export interface BossOutcome {
  id: string;
  rank: BossRank;
  misses: number;
  maxCombo: number;
}

/** 型として正しい結果だけ通す（ブラウザの履歴に入る値なので、信用しない） */
export function parseBossOutcome(value: unknown): BossOutcome | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = (value as { boss?: Partial<BossOutcome> }).boss;
  if (!v || typeof v.id !== 'string' || !['S', 'A', 'B', 'C', 'D'].includes(v.rank as string)) return null;
  if (typeof v.misses !== 'number' || typeof v.maxCombo !== 'number') return null;
  return { id: v.id, rank: v.rank as BossRank, misses: v.misses, maxCombo: v.maxCombo };
}

export function BossResultPanel({ boss, outcome }: { boss: Boss; outcome: BossOutcome }) {
  const won = outcome.rank !== 'D';
  return (
    <section aria-labelledby="boss-result" className="flex flex-col gap-2 rounded-lg bg-surface-raised p-4">
      <h2 id="boss-result" className="text-lg font-bold">
        {won ? `${boss.name}を倒した` : `${boss.name}に敗れた`}（ランク {outcome.rank}）
      </h2>
      <p>{won ? boss.defeat : (boss.dialogues[0] ?? '')}</p>
      <p className="text-sm text-text-muted">
        ミス {outcome.misses} 回（許容 {boss.maxMisses} 回）・最大コンボ {outcome.maxCombo}
      </p>
    </section>
  );
}
