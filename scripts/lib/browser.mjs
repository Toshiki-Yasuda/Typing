// 実ブラウザでの確認用の共通部品（スクリーンショット・調査スクリプトから使う）。
// 落とし穴は docs/WORKFLOW.md の「実ブラウザ確認の作法」を参照。
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

// クラウド環境の Chromium（CHROMIUM_PATH があればそれ）。無ければ Playwright 標準のブラウザ
export const CHROMIUM = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

/** `vite preview` を子プロセスで起動する（dist を配信。事前に npm run build）。返す stop() で止める（pkill は使わない） */
export async function startPreview(port = 4300 + Math.floor(Math.random() * 500)) {
  const child = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
  const url = `http://localhost:${port}/`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      /* まだ起動していない */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { url, stop: () => child.kill() };
}

export async function launch(opts = {}) {
  const browser = await chromium.launch({ executablePath: CHROMIUM, ...opts });
  return browser;
}

export async function newPage(browser, { width = 1200, height = 800, settings } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  if (settings) await page.addInitScript((s) => localStorage.setItem('typing.settings.v1', JSON.stringify(s)), settings);
  return page;
}

/**
 * ホームでパスワードを入れてテーマを開く。
 * 既定はゲートが出るまで待つ。演出オフの設定のときはゲートが無いので { gate: false }（タイトルメニューを待つ）
 */
export async function unlockTheme(page, url, { gate = true } = {}) {
  await page.goto(url);
  await page.getByLabel(/パスワードで新しいテーマを開く/).fill('SAKI');
  await page.getByRole('button', { name: '開く' }).click();
  if (gate) await page.getByRole('button', { name: /スタート/ }).waitFor();
  else await page.getByRole('navigation', { name: 'メニュー' }).waitFor();
}

/** ゲートを飛ばしてタイトルメニューへ（Esc） */
export async function skipToTitle(page) {
  await page.keyboard.press('Escape');
  await page.getByRole('navigation', { name: 'メニュー' }).waitFor();
}

/** いまのお題を最後まで打つ（ローマ字ガイドの文字をそのまま押す） */
export async function typeWord(page) {
  const romaji = ((await page.getByLabel('ローマ字ガイド').textContent()) ?? '').replaceAll('␣', ' ');
  for (const key of romaji) await page.keyboard.press(key);
}

/** 画面遷移だけを止める（演出を撮るため。タイマーは触らない: Suspense が止まる） */
export const blockNavigation = (page) =>
  page.evaluate(() => {
    history.pushState = () => {};
    history.replaceState = () => {};
  });

/** 有限のアニメーションが終わるのを待つ */
export const settle = (page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );

/**
 * 打鍵の記録を IndexedDB（typing / sessions）へ直接入れる（e2e/helpers.ts の seedRecords と同じ）。
 * 先に一度ページを開いてから呼び、呼んだ後にもう一度開く。
 */
export async function seedRecords(page, count, { contentId = 'basic', keys = 30, dt = 150, idPrefix = 'seed', expected = 'x' } = {}) {
  await page.evaluate(
    async ({ count, contentId, keys, dt, idPrefix, expected }) => {
      const db = await new Promise((resolve, reject) => {
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
          targets: ['x'],
          engineVersion: '1',
          ruleVersion: '1',
          keystrokes: Array.from({ length: keys }, (_, k) => ({ t: (k + 1) * dt, key: expected, code: 'K', expected, correct: true, item: 0 })),
        });
      }
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { count, contentId, keys, dt, idPrefix, expected },
  );
}
