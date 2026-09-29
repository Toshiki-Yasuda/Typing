import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createMemoryStore, openSessionStore, type SessionStore } from '@/storage';

const StoreContext = createContext<SessionStore | null>(null);

export function useStore(): SessionStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreProvider の内側で使ってください');
  return store;
}

/** 保存先を用意する。テストでは store を直接渡せる。IndexedDB が使えなければメモリ（保存されない）に切り替える */
export function StoreProvider({ store, children }: { store?: SessionStore; children: ReactNode }) {
  const [current, setCurrent] = useState<SessionStore | null>(store ?? null);
  const [persistent, setPersistent] = useState(true);

  useEffect(() => {
    if (store) return;
    let cancelled = false;
    openSessionStore().then(
      (opened) => !cancelled && setCurrent(opened),
      (error) => {
        console.error('IndexedDB を開けませんでした。今回の記録は保存されません', error);
        if (!cancelled) {
          setPersistent(false);
          setCurrent(createMemoryStore());
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [store]);

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
