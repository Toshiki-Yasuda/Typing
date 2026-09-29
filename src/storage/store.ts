import type { SessionRecord } from '@/metrics';

export interface SessionStore {
  /** 同じ id が既にあれば上書きする */
  add(session: SessionRecord): Promise<void>;
  /** 既存の id を除いて追加し、追加した件数を返す（インポート用） */
  addMany(sessions: readonly SessionRecord[]): Promise<number>;
  /** 開始時刻の昇順 */
  list(): Promise<SessionRecord[]>;
  clear(): Promise<void>;
}

export function createMemoryStore(): SessionStore {
  const map = new Map<string, SessionRecord>();
  return {
    async add(session) {
      map.set(session.id, session);
    },
    async addMany(sessions) {
      let added = 0;
      for (const s of sessions) {
        if (map.has(s.id)) continue;
        map.set(s.id, s);
        added++;
      }
      return added;
    },
    async list() {
      return [...map.values()].sort((a, b) => a.startedAt - b.startedAt);
    },
    async clear() {
      map.clear();
    },
  };
}
