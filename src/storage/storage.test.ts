import { IDBFactory } from 'fake-indexeddb';
import type { SessionRecord } from '@/metrics';
import {
  CURRENT_SCHEMA_VERSION,
  ImportError,
  createMemoryStore,
  exportSessions,
  migrateExport,
  openStores,
  createMemoryPackStore,
  type PackStore,
  parseExport,
  type Migration,
  type SessionStore,
} from './index';

const session = (id: string, startedAt: number, over: Partial<SessionRecord> = {}): SessionRecord => ({
  id,
  startedAt,
  mode: 'practice',
  contentId: 'basic',
  targets: ['かんじ'],
  engineVersion: '1',
  ruleVersion: 'input-rules-v1',
  keystrokes: [
    { t: 0, key: 'k', code: 'KeyK', expected: 'k', correct: true, item: 0 },
    { t: 90, key: 'x', code: 'KeyX', expected: 'a', correct: false, item: 0 },
  ],
  ...over,
});

describe('エクスポート / インポート', () => {
  it('書き出して読み込むと元に戻る', () => {
    const sessions = [session('a', 1), session('b', 2)];
    expect(parseExport(exportSessions(sessions, 1000))).toEqual(sessions);
  });

  it('書き出しには版と日時が入る', () => {
    const json = JSON.parse(exportSessions([], 1234));
    expect(json).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt: 1234, sessions: [] });
  });

  it('壊れた JSON・形式違いは ImportError', () => {
    expect(() => parseExport('{')).toThrow(ImportError);
    expect(() => parseExport('[]')).toThrow(/形式/);
    expect(() => parseExport('{}')).toThrow(/schemaVersion/);
  });

  it('スキーマ違反は、どこが不正かを示して ImportError', () => {
    const bad = JSON.parse(exportSessions([session('a', 1)]));
    bad.sessions[0].keystrokes[0].key = 'ab'; // 1文字でない
    expect(() => parseExport(JSON.stringify(bad))).toThrow(/sessions\.0\.keystrokes\.0\.key/);

    const negative = JSON.parse(exportSessions([session('a', 1)]));
    negative.sessions[0].keystrokes[0].t = -1;
    expect(() => parseExport(JSON.stringify(negative))).toThrow(ImportError);

    const missing = JSON.parse(exportSessions([session('a', 1)]));
    delete missing.sessions[0].id;
    expect(() => parseExport(JSON.stringify(missing))).toThrow(ImportError);
  });

  it('v1 の書き出し（vows なし）は、そのまま読める。版は 2 に上がる', () => {
    const v1 = JSON.stringify({ schemaVersion: 1, exportedAt: 5, sessions: [session('a', 1)] });
    const parsed = parseExport(v1);
    expect(parsed).toEqual([session('a', 1)]);
    expect(parsed[0]?.vows).toBeUndefined();
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
  });

  it('縛り（vows）は書き出し・読み込みで残る。文字列以外は拒否', () => {
    const withVows = { ...session('a', 1), vows: ['noMiss', 'silent'] };
    expect(parseExport(exportSessions([withVows]))[0]?.vows).toEqual(['noMiss', 'silent']);
    const bad = JSON.parse(exportSessions([withVows]));
    bad.sessions[0].vows = [1];
    expect(() => parseExport(JSON.stringify(bad))).toThrow(ImportError);
  });

  it('新しい版のデータは拒否する', () => {
    const future = JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION + 1, exportedAt: 0, sessions: [] });
    expect(() => parseExport(future)).toThrow(/新しい版/);
  });
});

describe('バージョン移行', () => {
  const v1to2: Migration = (d) => ({ ...d, schemaVersion: 2, renamed: d.old });
  const v2to3: Migration = (d) => ({ ...d, schemaVersion: 3, extra: true });

  it('古い版を最新まで順に移行する', () => {
    const out = migrateExport({ schemaVersion: 1, old: 'x' }, { 1: v1to2, 2: v2to3 }, 3);
    expect(out).toEqual({ schemaVersion: 3, old: 'x', renamed: 'x', extra: true });
  });

  it('最新なら何もしない', () => {
    const data = { schemaVersion: 3 };
    expect(migrateExport(data, {}, 3)).toBe(data);
  });

  it('移行手順が欠けていたら ImportError', () => {
    expect(() => migrateExport({ schemaVersion: 1 }, { 1: v1to2 }, 3)).toThrow(/v2 からの移行手順/);
  });

  it('移行結果の版が不正なら ImportError', () => {
    expect(() => migrateExport({ schemaVersion: 1 }, { 1: (d) => d }, 2)).toThrow(/移行結果/);
  });

  it('版が数値でない・0 以下は ImportError', () => {
    for (const schemaVersion of ['1', 0, -1, 1.5, undefined]) {
      expect(() => migrateExport({ schemaVersion })).toThrow(ImportError);
    }
  });
});

const contract = (name: string, create: () => Promise<SessionStore>) => {
  describe(`SessionStore: ${name}`, () => {
    it('保存して、開始時刻の昇順で取り出せる', async () => {
      const store = await create();
      await store.add(session('late', 30));
      await store.add(session('early', 10));
      await store.add(session('mid', 20));
      expect((await store.list()).map((s) => s.id)).toEqual(['early', 'mid', 'late']);
    });

    it('打鍵ログがそのまま戻る', async () => {
      const store = await create();
      const s = session('a', 1);
      await store.add(s);
      expect(await store.list()).toEqual([s]);
    });

    it('get: id で1件取り出せる。無ければ undefined', async () => {
      const store = await create();
      await store.add(session('a', 1));
      expect((await store.get('a'))?.id).toBe('a');
      expect(await store.get('nothing')).toBeUndefined();
    });

    it('同じ id の add は上書き', async () => {
      const store = await create();
      await store.add(session('a', 1, { mode: 'old' }));
      await store.add(session('a', 1, { mode: 'new' }));
      const all = await store.list();
      expect(all).toHaveLength(1);
      expect(all[0]?.mode).toBe('new');
    });

    it('addMany は既存の id を除いて、追加した件数を返す', async () => {
      const store = await create();
      await store.add(session('a', 1, { mode: 'keep' }));
      expect(await store.addMany([session('a', 1, { mode: 'dup' }), session('b', 2), session('c', 3)])).toBe(2);
      const all = await store.list();
      expect(all.map((s) => s.id)).toEqual(['a', 'b', 'c']);
      expect(all[0]?.mode).toBe('keep');
      expect(await store.addMany([session('b', 2)])).toBe(0);
    });

    it('clear で空になる', async () => {
      const store = await create();
      await store.add(session('a', 1));
      await store.clear();
      expect(await store.list()).toEqual([]);
    });

    it('空の状態でも list できる', async () => {
      expect(await (await create()).list()).toEqual([]);
    });
  });
};

contract('メモリ', async () => createMemoryStore());
contract('IndexedDB', async () => (await openStores(new IDBFactory(), 'typing-test')).sessions);

describe('IndexedDB: 永続性', () => {
  it('開き直しても残っている', async () => {
    const factory = new IDBFactory();
    const first = (await openStores(factory, 'persist')).sessions;
    await first.add(session('a', 1));
    const second = (await openStores(factory, 'persist')).sessions;
    expect((await second.list()).map((s) => s.id)).toEqual(['a']);
  });

  it('エクスポート → 別ストアへインポートで移せる', async () => {
    const from = (await openStores(new IDBFactory(), 'from')).sessions;
    await from.addMany([session('a', 1), session('b', 2)]);
    const json = exportSessions(await from.list());
    const to = (await openStores(new IDBFactory(), 'to')).sessions;
    expect(await to.addMany(parseExport(json))).toBe(2);
    expect(await to.list()).toEqual(await from.list());
  });
});


const pack = (id: string, name = id) => ({ id, name, items: [{ display: 'あ', reading: 'あ' }] });

const packContract = (name: string, create: () => Promise<PackStore>) => {
  describe(`PackStore: ${name}`, () => {
    it('保存して id 順に取り出せる。同じ id は上書き', async () => {
      const store = await create();
      await store.put(pack('b'));
      await store.put(pack('a', '旧'));
      await store.put(pack('a', '新'));
      const all = await store.list();
      expect(all.map((p) => p.id)).toEqual(['a', 'b']);
      expect(all[0]?.name).toBe('新');
    });

    it('remove で消える。無い id を消しても例外にならない', async () => {
      const store = await create();
      await store.put(pack('a'));
      await store.remove('a');
      await store.remove('none');
      expect(await store.list()).toEqual([]);
    });
  });
};

packContract('メモリ', async () => createMemoryPackStore());
packContract('IndexedDB', async () => (await openStores(new IDBFactory(), 'packs-test')).packs);

describe('IndexedDB: 版の引き上げ（v1 → v2）', () => {
  it('v1 で保存済みの記録を保ったまま、自作パックの保存先が使えるようになる', async () => {
    const factory = new IDBFactory();
    // v1 の DB を、当時のスキーマで作って記録を1件入れる
    await new Promise<void>((resolve, reject) => {
      const open = factory.open('legacy', 1);
      open.onupgradeneeded = () => {
        const store = open.result.createObjectStore('sessions', { keyPath: 'id' });
        store.createIndex('startedAt', 'startedAt');
      };
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('sessions', 'readwrite');
        tx.objectStore('sessions').put(session('old-1', 5));
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });

    const { sessions, packs } = await openStores(factory, 'legacy');
    expect((await sessions.list()).map((s) => s.id)).toEqual(['old-1']);
    await packs.put(pack('mine'));
    expect((await packs.list()).map((p) => p.id)).toEqual(['mine']);
  });
});
