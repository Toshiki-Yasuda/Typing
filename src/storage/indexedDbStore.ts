import type { SessionRecord } from '@/metrics';
import type { SessionStore } from './store';

const STORE = 'sessions';
const DB_VERSION = 1;

const request = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

const finished = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('トランザクションが中断されました'));
  });

/** IndexedDB に打鍵ログを保存する（数年分の生ログを想定するため localStorage は使わない） */
export async function openSessionStore(
  factory: IDBFactory = indexedDB,
  name = 'typing',
): Promise<SessionStore> {
  const open = factory.open(name, DB_VERSION);
  open.onupgradeneeded = (event) => {
    const db = open.result;
    // 将来の版はここで oldVersion ごとに移行する
    if (event.oldVersion < 1) {
      const store = db.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('startedAt', 'startedAt');
    }
  };
  const db = await request(open);

  return {
    async add(session) {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(session);
      await finished(tx);
    },
    async addMany(sessions) {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      let added = 0;
      for (const session of sessions) {
        const check = store.getKey(session.id);
        check.onsuccess = () => {
          if (check.result === undefined) {
            store.add(session);
            added++;
          }
        };
      }
      await finished(tx);
      return added;
    },
    async list() {
      const tx = db.transaction(STORE, 'readonly');
      const all = await request(tx.objectStore(STORE).index('startedAt').getAll() as IDBRequest<SessionRecord[]>);
      return all;
    },
    async clear() {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      await finished(tx);
    },
  };
}
