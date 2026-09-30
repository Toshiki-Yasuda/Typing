// スクリーンショットの場面。追加するときは、1 つの関数で「その画面まで操作して path に撮る」。
import { newPage, unlockTheme, skipToTitle, typeWord, seedRecords } from './lib/browser.mjs';

async function toTitle({ browser, url }, settings) {
  const page = await newPage(browser, { settings });
  await unlockTheme(page, url);
  await skipToTitle(page);
  return page;
}

export const SCENARIOS = {
  /** ホーム（標準テーマ） */
  async home({ browser, url, path }) {
    const page = await newPage(browser);
    await page.goto(url);
    await page.getByRole('heading', { name: 'Typing' }).waitFor();
    await page.screenshot({ path, fullPage: true });
  },
  /** ゲート */
  async gate({ browser, url, path }) {
    const page = await newPage(browser);
    await unlockTheme(page, url);
    await page.screenshot({ path });
  },
  /** タイトルメニュー */
  async title(ctx) {
    const page = await toTitle(ctx);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: ctx.path });
  },
  /** ステージ選択 */
  async stages(ctx) {
    const page = await toTitle(ctx);
    await page.keyboard.press('2');
    await page.getByRole('heading', { level: 1, name: 'ステージ選択' }).waitFor();
    await page.screenshot({ path: ctx.path, fullPage: true });
  },
  /** 設定 */
  async settings(ctx) {
    const page = await toTitle(ctx);
    await page.keyboard.press('6');
    await page.getByRole('heading', { level: 1, name: '設定' }).waitFor();
    await page.screenshot({ path: ctx.path, fullPage: true });
  },
  /** 練習（コンボが増えた状態） */
  async play(ctx) {
    const page = await toTitle(ctx);
    await page.keyboard.press('1');
    await page.getByRole('region', { name: 'お題' }).waitFor();
    for (let i = 0; i < 3; i++) await typeWord(page);
    await page.screenshot({ path: ctx.path });
  },
  /** ボス戦（演出オフで静かな状態） */
  async boss(ctx) {
    const page = await newPage(ctx.browser, { settings: { effects: 'off' } });
    await unlockTheme(page, ctx.url, { gate: false });
    await page.getByRole('link', { name: /ホーム/ }).click();
    await page.getByRole('link', { name: 'ヒソカに挑戦する' }).click();
    await page.getByRole('region', { name: 'お題' }).waitFor();
    await page.screenshot({ path: ctx.path });
  },
  /** 念系統診断（かな・英字の記録を入れて、点が求まる状態） */
  async diagnosis(ctx) {
    const page = await newPage(ctx.browser);
    await page.goto(ctx.url);
    await seedRecords(page, 5, { contentId: 'basic', dt: 160, idPrefix: 'a' });
    await seedRecords(page, 5, { contentId: 'english', dt: 260, idPrefix: 'b' });
    await unlockTheme(page, ctx.url);
    await skipToTitle(page);
    await page.keyboard.press('5');
    await page.getByRole('heading', { level: 1, name: '念系統診断' }).waitFor();
    await page.getByRole('img', { name: /^速さ/ }).waitFor();
    await page.screenshot({ path: ctx.path, fullPage: true });
  },
  /** 水見式のグラス（診断の画面。反応が起きた最後の姿を撮る） */
  async ritual(ctx) {
    const page = await newPage(ctx.browser);
    await page.goto(ctx.url);
    await seedRecords(page, 5, { contentId: 'basic', dt: 160, idPrefix: 'a' });
    await seedRecords(page, 5, { contentId: 'english', dt: 260, idPrefix: 'b' });
    await unlockTheme(page, ctx.url);
    await skipToTitle(page);
    await page.keyboard.press('5');
    await page.getByRole('heading', { level: 2, name: '水見式' }).waitFor();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: ctx.path, fullPage: true });
  },
  /** 修行（HUNTER の言葉）。入口と、補助（凝・円）をオンにした練の練習画面 */
  async train(ctx) {
    const page = await newPage(ctx.browser);
    await page.goto(ctx.url);
    await seedRecords(page, 3, { missEvery: 3 });
    await unlockTheme(page, ctx.url);
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('typing.settings.v1') ?? '{}');
      localStorage.setItem('typing.settings.v1', JSON.stringify({ ...raw, aidGyo: true, aidEn: true }));
    });
    await skipToTitle(page);
    await page.keyboard.press('7');
    await page.getByRole('heading', { level: 1, name: '修行' }).waitFor();
    await page.screenshot({ path: ctx.path.replace('.png', '-menu.png'), fullPage: true });
    await page.getByRole('link', { name: /^練/ }).click();
    await page.getByRole('region', { name: 'お題' }).waitFor();
    await page.waitForTimeout(600);
    await page.screenshot({ path: ctx.path, fullPage: true });
  },
};
