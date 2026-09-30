import type { Page } from '@playwright/test';

/**
 * 打鍵の記録を IndexedDB（データベース typing・ストア sessions）へ直接入れる。
 * 診断や統計のように「記録がたくさん要る」画面を、遊びを繰り返さずに確かめるため。
 * missEvery が正なら、その打鍵ごとにミスにする（弱点のある記録）。
 * target は記録のお題（正規化した読み。打鍵はすべてその 1 語 = item 0）。
 * 先に一度ページを開いて（DB を作らせて）から呼び、呼んだ後に再読み込みする。
 */
export async function seedRecords(page: Page, count: number, { contentId = 'basic', keys = 30, dt = 150, idPrefix = 'seed', missEvery = 0, target = 'x' } = {}) {
  await page.evaluate(
    async ({ count, contentId, keys, dt, idPrefix, missEvery, target }) => {
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const open = indexedDB.open('typing', 2);
        open.onupgradeneeded = () => {
          const d = open.result;
          if (!d.objectStoreNames.contains('sessions')) d.createObjectStore('sessions', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('packs')) d.createObjectStore('packs', { keyPath: 'id' });
        };
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      const tx = db.transaction('sessions', 'readwrite');
      for (let i = 0; i < count; i++) {
        tx.objectStore('sessions').put({
          id: `${idPrefix}-${i}`,
          startedAt: Date.now() - i * 60_000,
          mode: 'practice',
          contentId,
          targets: [target],
          engineVersion: '1',
          ruleVersion: '1',
          keystrokes: Array.from({ length: keys }, (_, k) => ({
            t: (k + 1) * dt,
            key: missEvery > 0 && (k + 1) % missEvery === 0 ? 'z' : 'x',
            code: 'KeyX',
            expected: 'x',
            correct: !(missEvery > 0 && (k + 1) % missEvery === 0),
            item: 0,
          })),
        });
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { count, contentId, keys, dt, idPrefix, missEvery, target },
  );
}
