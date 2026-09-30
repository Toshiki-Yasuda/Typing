export type StageUnlockMode = 'all' | 'sequential';

/** 判定に必要な章の形（テーマの Chapter のうち、id と並びだけ） */
export interface UnlockChapter {
  readonly stages: readonly { readonly id: string }[];
  /** その章のボスの id */
  readonly boss?: string;
}

export interface UnlockState {
  /** ステージ id → 開いているか */
  readonly stages: ReadonlyMap<string, boolean>;
  /** ボス id → 開いているか */
  readonly bosses: ReadonlyMap<string, boolean>;
}

/**
 * 順番解放の判定。仕様は docs/spec/unlock.md。
 * @param isCleared ステージがクリア済みか（記録から求めた関数を渡す）
 */
export function unlockState(
  chapters: readonly UnlockChapter[],
  mode: StageUnlockMode,
  isCleared: (stageId: string) => boolean,
): UnlockState {
  const stages = new Map<string, boolean>();
  const bosses = new Map<string, boolean>();
  let previousCleared = true; // 最初のステージは常に開いている
  for (const chapter of chapters) {
    for (const stage of chapter.stages) {
      stages.set(stage.id, mode === 'all' || previousCleared);
      previousCleared = isCleared(stage.id);
    }
    if (chapter.boss) {
      bosses.set(chapter.boss, mode === 'all' || chapter.stages.every((s) => isCleared(s.id)));
    }
  }
  return { stages, bosses };
}

/** ステージ id・ボス id が開いているか。判定の対象外（知らない id）は開いている扱い */
export const isOpen = (state: UnlockState, kind: 'stage' | 'boss', id: string): boolean =>
  (kind === 'stage' ? state.stages : state.bosses).get(id) ?? true;
