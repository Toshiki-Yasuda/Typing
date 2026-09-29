import type { ContentPack } from '@/content';
import type { SessionRecord } from '@/metrics';
import type { PackStore } from './packStore';
import type { SessionStore } from './store';

const STORE = 'sessions';
const PACKS = 'packs';
/** 1: sessions / 2: packs（自作パック）を追加 */
const DB_VERSION = 2;

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

export interface Stores {
  readonly sessions: SessionStore;
  readonly packs: PackStore;
}

/**
 * IndexedDB を開く（打鍵ログは数年分の生ログを想定するため localStorage は使わない）。
 * 版を上げるときは、oldVersion ごとに足りない部分だけ作る（既存のデータを消さない）。
 */
export async function openStores(factory: IDBFactory = indexedDB, name = 'typing'): Promise<Stores> {
  const open = factory.open(name, DB_VERSION);
  open.onupgradeneeded = (event) => {
    const db = open.result;
    if (event.oldVersion < 1) {
      const store = db.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('startedAt', 'startedAt');
    }
    if (event.oldVersion < 2) db.createObjectStore(PACKS, { keyPath: 'id' });
  };
  const db = await request(open);
  return { sessions: sessionStore(db), packs: packStore(db) };
}

function packStore(db: IDBDatabase): PackStore {
  return {
    async put(pack) {
      const tx = db.transaction(PACKS, 'readwrite');
      tx.objectStore(PACKS).put(pack);
      await finished(tx);
    },
    async list() {
      const tx = db.transaction(PACKS, 'readonly');
      const all = await request(tx.objectStore(PACKS).getAll() as IDBRequest<ContentPack[]>);
      return all.sort((a, b) => a.id.localeCompare(b.id));
    },
    async remove(id) {
      const tx = db.transaction(PACKS, 'readwrite');
      tx.objectStore(PACKS).delete(id);
      await finished(tx);
    },
  };
}

function sessionStore(db: IDBDatabase): SessionStore {
  return {    async add(session) {
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
    async get(id) {
      const tx = db.transaction(STORE, 'readonly');
      return request(tx.objectStore(STORE).get(id) as IDBRequest<SessionRecord | undefined>);
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
