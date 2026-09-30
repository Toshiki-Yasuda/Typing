import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/app/StoreContext';
import type { SessionRecord } from '@/metrics';
import { stageProgress } from '@/session/stageProgress';
import { unlockState, type UnlockState } from '@/session/stageUnlock';
import { useSettings } from '@/settings/useSettings';
import type { Theme } from '@/themes/theme';

/**
 * 順番解放の状態。設定が all なら、記録を読まずにすぐ「すべて開いている」を返す。
 * sequential のときは記録を読み、読めるまで ready は false（閉じているかどうか分からないため）。
 */
export function useUnlock(theme: Theme): { ready: boolean; state: UnlockState } {
  const store = useStore();
  const [settings] = useSettings();
  const mode = settings.stageUnlock;
  const [records, setRecords] = useState<SessionRecord[] | null>(null);

  useEffect(() => {
    if (mode === 'all') return;
    let cancelled = false;
    store.list().then((all) => !cancelled && setRecords(all));
    return () => {
      cancelled = true;
    };
  }, [store, mode]);

  const chapters = theme.chapters;
  const state = useMemo(
    () => unlockState(chapters ?? [], mode, (id) => stageProgress(records ?? [], id).cleared),
    [chapters, mode, records],
  );
  return { ready: mode === 'all' || records !== null, state };
}
