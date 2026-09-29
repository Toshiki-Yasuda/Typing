import { RANKS, goalProgress, rankFor, rankStatus, type GoalProgress, type RankStatus, type SessionSummary } from '@/metrics';
import { Link } from 'react-router';

const kpm = (n: number) => n.toFixed(0);
const rankIndex = (status: RankStatus) => (status.rank ? RANKS.findIndex((r) => r.id === status.rank?.id) : -1);

function StatusLines({ status, goal }: { status: RankStatus; goal: GoalProgress | null }) {
  if (!status.rank || status.basisKpm === null) {
    return (
      <p className="text-text-muted">
        級位はまだありません。正確率 95% 以上・20 打鍵以上の練習が 3 回で認定されます（今は {status.count} 回）。
      </p>
    );
  }
  return (
    <>
      <p>
        現在の級位: <span className="text-xl font-bold">{status.rank.label}</span>
        {status.provisional && <span className="ml-1 text-text-muted">（暫定）</span>}
        <span className="ml-2 text-sm text-text-muted">
          直近 {status.count} 回の中央値 {kpm(status.basisKpm)} 打鍵/分
        </span>
      </p>
      {goal && (
        <p>
          {goal.achieved
            ? `目標 ${goal.goal.label} を達成しています`
            : `目標 ${goal.goal.label} まで あと ${kpm(goal.remainingKpm)} 打鍵/分`}
        </p>
      )}
    </>
  );
}

/** 結果画面: この練習の級位相当、昇級、現在の級位と目標 */
export function RankPanel({ summaries, currentId, goalId }: { summaries: readonly SessionSummary[]; currentId: string; goalId: string }) {
  const index = summaries.findIndex((s) => s.id === currentId);
  const me = summaries[index];
  if (!me) return null;
  const before = rankStatus(summaries.slice(0, index));
  const after = rankStatus(summaries.slice(0, index + 1));
  const counted = me.kpm > 0 && me.accuracy >= 0.95 && me.total >= 20;
  const promoted = after.rank && rankIndex(after) > rankIndex(before);

  return (
    <section aria-labelledby="rank" className="flex flex-col gap-2 rounded-lg bg-surface-raised p-4">
      <h2 id="rank" className="text-lg font-bold">
        級位
      </h2>
      <p>
        この練習: <span className="font-bold">{rankFor(me.kpm).label}相当</span>（{kpm(me.kpm)} 打鍵/分）
        {!counted && (
          <span className="block text-sm text-text-muted">正確率 95% 未満、または打鍵が少ないため、級位の判定には数えません。</span>
        )}
      </p>
      {promoted && after.rank && (
        <p role="status" className="rounded bg-success/20 p-3 font-bold">
          {before.rank ? `昇級！ ${before.rank.label} → ${after.rank.label}` : `級位が付きました: ${after.rank.label}`}
          {after.provisional && '（暫定）'}
        </p>
      )}
      <StatusLines status={after} goal={goalProgress(after, goalId)} />
    </section>
  );
}

/** ホーム: 現在の級位と目標 */
export function RankCard({ summaries, goalId }: { summaries: readonly SessionSummary[]; goalId: string }) {
  const status = rankStatus(summaries);
  return (
    <section aria-labelledby="rank-card" className="flex flex-col gap-2 rounded-lg bg-surface-raised p-4">
      <h2 id="rank-card" className="text-lg font-bold">
        級位と目標
      </h2>
      <StatusLines status={status} goal={goalProgress(status, goalId)} />
      <Link to="/stats" className="self-start text-sm text-accent underline">
        統計を見る
      </Link>
    </section>
  );
}
