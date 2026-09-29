import { useCallback, useEffect, useState } from 'react';
import { parsePackJson } from '@/content/import';
import type { ContentPack } from '@/content';
import { usePackStore } from '@/app/StoreContext';

export interface ImportState {
  readonly kind: 'idle' | 'ok' | 'error';
  readonly message: string;
  /** 取り込めなかった理由の一覧（語ごと） */
  readonly problems: readonly string[];
}

const IDLE: ImportState = { kind: 'idle', message: '', problems: [] };

/** 自作パックの一覧・取り込み・削除 */
export function useCustomPacks() {
  const store = usePackStore();
  const [packs, setPacks] = useState<ContentPack[]>([]);
  const [state, setState] = useState<ImportState>(IDLE);

  const reload = useCallback(() => store.list().then(setPacks), [store]);
  useEffect(() => {
    let cancelled = false;
    store.list().then((all) => !cancelled && setPacks(all));
    return () => {
      cancelled = true;
    };
  }, [store]);

  const importFile = useCallback(
    async (file: File) => {
      const result = parsePackJson(await file.text());
      if (!result.ok) {
        setState({ kind: 'error', message: `取り込めません（${result.problems.length}件の問題）`, problems: result.problems });
        return;
      }
      const overwritten = packs.some((p) => p.id === result.pack.id);
      await store.put(result.pack);
      await reload();
      setState({
        kind: 'ok',
        message: `「${result.pack.name}」を${overwritten ? '上書き' : ''}取り込みました（${result.pack.items.length}語）`,
        problems: [],
      });
    },
    [store, packs, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await store.remove(id);
      await reload();
      setState(IDLE);
    },
    [store, reload],
  );

  return { packs, state, importFile, remove };
}
