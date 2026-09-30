import type { BattleState } from '@/session/bossBattle';
import { PHASES } from '@/session/bossBattle';
import type { Boss } from '@/themes/theme';

interface Props {
  boss: Boss;
  state: BattleState;
  /** ボスの今の台詞 */
  line: string;
}

/** ボス戦の表示。HP・フェーズ・ミスの残りは、色だけでなく文字でも示す */
export function BossHud({ boss, state, line }: Props) {
  const ratio = state.bossRemaining / state.bossTotal;
  return (
    <section aria-label="ボス" className="flex items-center gap-4 rounded-lg bg-surface-raised p-4">
      {boss.image && (
        <img src={new URL(boss.image, document.baseURI).href} alt="" className="h-24 w-auto rounded" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="font-bold">
          {boss.name}
          <span className="ml-2 text-sm font-normal text-text-muted">{boss.title}</span>
        </p>
        <div
          role="progressbar"
          aria-label="ボスの体力"
          aria-valuemin={0}
          aria-valuemax={state.bossTotal}
          aria-valuenow={state.bossRemaining}
          aria-valuetext={`残り ${state.bossRemaining} / ${state.bossTotal} 語`}
          className="h-3 rounded bg-surface"
        >
          <div className="h-3 rounded bg-danger" style={{ width: `${ratio * 100}%` }} />
        </div>
        <p className="flex flex-wrap gap-x-4 text-sm text-text-muted">
          <span>
            ボスの体力 {state.bossRemaining} / {state.bossTotal}
          </span>
          <span>
            フェーズ {state.phase} / {PHASES}
          </span>
          <span>
            ミスの余裕 {state.missesLeft} 回{state.missesLeft === 0 && '（次のミスで敗北）'}
          </span>
          <span>コンボ {state.combo}</span>
        </p>
        <p role="status" className="min-h-6">
          {line}
        </p>
      </div>
    </section>
  );
}
