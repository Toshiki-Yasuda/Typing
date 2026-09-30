import { STAGE_CLEAR_ACCURACY } from '@/session/stageProgress';
import type { Chapter, Stage } from '@/themes/theme';

/** ステージの結果。クリアかどうかを文字で示す。次の行動は結果画面の AfterActions（session/afterFlow.ts） */
export function StageResultPanel({
  chapter,
  stage,
  accuracy,
  cleared,
}: {
  chapter: Chapter;
  stage: Stage;
  accuracy: number;
  /** クリアしたか（縛り「ミスなし」が破れた記録は、正確率が高くてもクリアに数えない） */
  cleared: boolean;
}) {
  return (
    <section aria-labelledby="stage-result" className="flex flex-col gap-2 rounded-lg bg-surface-raised p-4">
      <h2 id="stage-result" className="text-lg font-bold">
        {cleared ? '✓ ステージクリア' : '△ クリアならず'}：第{chapter.number}章 {stage.name}
      </h2>
      <p className="text-sm text-text-muted">
        正確率 {(accuracy * 100).toFixed(1)}%
        {cleared ? '' : `（${Math.round(STAGE_CLEAR_ACCURACY * 100)}% 以上でクリア）`}
      </p>
    </section>
  );
}
