import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  createMemoryPackStore,
  createMemoryStore,
  openStores,
  type PackStore,
  type SessionStore,
  type Stores,
} from '@/storage';

const StoreContext = createContext<Stores | null>(null);

function useStores(): Stores {
  const stores = useContext(StoreContext);
  if (!stores) throw new Error('StoreProvider の内側で使ってください');
  return stores;
}

/** 打鍵ログの保存先 */
export function useStore(): SessionStore {
  return useStores().sessions;
}

/** 自作パックの保存先 */
export function usePackStore(): PackStore {
  return useStores().packs;
}

/**
 * 保存先を用意する。テストでは store / packStore を直接渡せる。
 * IndexedDB が使えなければメモリ（保存されない）に切り替える。
 */
export function StoreProvider({
  store,
  packStore,
  children,
}: {
  store?: SessionStore;
  packStore?: PackStore;
  children: ReactNode;
}) {
  const injected = store ? { sessions: store, packs: packStore ?? createMemoryPackStore() } : null;
  const [opened, setOpened] = useState<Stores | null>(null);
  const [persistent, setPersistent] = useState(true);

  useEffect(() => {
    if (store) return;
    let cancelled = false;
    openStores().then(
      (stores) => !cancelled && setOpened(stores),
      (error) => {
        console.error('IndexedDB を開けませんでした。今回の記録は保存されません', error);
        if (!cancelled) {
          setPersistent(false);
          setOpened({ sessions: createMemoryStore(), packs: createMemoryPackStore() });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [store]);

  const current = injected ?? opened;
  if (!current) return <p className="p-8 text-text-muted">読み込み中…</p>;
  return (
    <StoreContext.Provider value={current}>
      {!persistent && (
        <p role="alert" className="bg-danger/20 p-2 text-center text-sm">
          このブラウザでは記録を保存できません（今回の記録は閉じると消えます）
        </p>
      )}
      {children}
    </StoreContext.Provider>
  );
}
