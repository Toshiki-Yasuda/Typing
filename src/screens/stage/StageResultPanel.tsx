import { Link } from 'react-router';
import { isStageCleared, STAGE_CLEAR_ACCURACY } from '@/session/stageProgress';
import type { Chapter, Stage } from '@/themes/theme';

/** ステージの結果。クリアかどうかを文字で示し、次のステージへ案内する */
export function StageResultPanel({
  chapter,
  stage,
  accuracy,
}: {
  chapter: Chapter;
  stage: Stage;
  accuracy: number;
}) {
  const cleared = isStageCleared(accuracy);
  const at = chapter.stages.findIndex((s) => s.id === stage.id);
  const next = chapter.stages[at + 1];
  return (
    <section aria-labelledby="stage-result" className="flex flex-col gap-2 rounded-lg bg-surface-raised p-4">
      <h2 id="stage-result" className="text-lg font-bold">
        {cleared ? '✓ ステージクリア' : '△ クリアならず'}：第{chapter.number}章 {stage.name}
      </h2>
      <p className="text-sm text-text-muted">
        正確率 {(accuracy * 100).toFixed(1)}%
        {cleared ? '' : `（${Math.round(STAGE_CLEAR_ACCURACY * 100)}% 以上でクリア）`}
      </p>
      <p className="flex flex-wrap gap-4">
        <Link to={`/stage/${stage.id}`} className="underline">
          もう一度このステージ
        </Link>
        {cleared && next && (
          <Link to={`/stage/${next.id}`} className="underline">
            次のステージ: {next.name}
          </Link>
        )}
        {cleared && !next && chapter.boss && (
          <Link to={`/boss/${chapter.boss}`} className="underline">
            この章のボスに挑戦
          </Link>
        )}
        <Link to="/stages" className="underline">
          ステージ選択へ
        </Link>
      </p>
    </section>
  );
}
