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
  /** ホーム（記録あり）。標準テーマ */
  async homeRich(ctx) {
    const page = await newPage(ctx.browser);
    await page.goto(ctx.url);
    await seedRecords(page, 6, { contentId: 'basic', dt: 170, idPrefix: 'h', missEvery: 40 });
    await page.reload();
    await page.getByRole('heading', { name: 'Typing' }).waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: ctx.path, fullPage: true });
  },
  /** ホーム（記録あり）。HUNTER テーマ */
  async homeHunter(ctx) {
    const page = await newPage(ctx.browser);
    await page.goto(ctx.url);
    await seedRecords(page, 6, { contentId: 'basic', dt: 170, idPrefix: 'h', missEvery: 40 });
    await unlockTheme(page, ctx.url);
    await skipToTitle(page);
    await page.getByRole('link', { name: 'ホーム' }).click();
    await page.getByRole('heading', { name: 'ボス戦' }).waitFor();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: ctx.path, fullPage: true });
  },
  /** 図鑑（一部の語を打った状態） */
  async codex(ctx) {
    const page = await newPage(ctx.browser);
    await page.goto(ctx.url);
    for (const [i, target] of ['ごん', 'じん', 'きるあ', 'ぜつ'].entries()) {
      await seedRecords(page, i === 0 ? 4 : 1, { target, idPrefix: `c${i}`, expected: 'x' });
    }
    await unlockTheme(page, ctx.url);
    await skipToTitle(page);
    await page.keyboard.press('8');
    await page.getByRole('heading', { level: 1, name: '図鑑' }).waitFor();
    await page.getByRole('status').waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: ctx.path, fullPage: false });
  },
  /** マイライセンス */
  async license(ctx) {
    const page = await newPage(ctx.browser);
    await page.goto(ctx.url);
    await seedRecords(page, 8, { idPrefix: 'lic' });
    await unlockTheme(page, ctx.url);
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('typing.settings.v1') ?? '{}');
      localStorage.setItem('typing.settings.v1', JSON.stringify({ ...raw, hunterName: 'ゴン' }));
    });
    await page.reload();
    await skipToTitle(page);
    await page.keyboard.press('9');
    await page.getByRole('region', { name: 'HUNTER LICENSE' }).waitFor();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: ctx.path });
  },
  /** ベースの練習画面（標準テーマ）: 開始直後・入力の途中・ミス直後を 3 枚 */
  async playBase(ctx) {
    const page = await newPage(ctx.browser);
    await page.goto(`${ctx.url}#/play`);
    await page.getByRole('region', { name: 'お題' }).waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: ctx.path.replace('.png', '-1start.png') });
    const romaji = ((await page.getByLabel('ローマ字ガイド').textContent()) ?? '').replaceAll('␣', ' ');
    for (const key of romaji.slice(0, Math.max(2, Math.floor(romaji.length / 2)))) await page.keyboard.press(key);
    await page.waitForTimeout(200);
    await page.screenshot({ path: ctx.path.replace('.png', '-2mid.png') });
    await page.keyboard.press('1');
    await page.waitForTimeout(60);
    await page.screenshot({ path: ctx.path.replace('.png', '-3miss.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: ctx.path.replace('.png', '-4wide.png') });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: ctx.path });
  },
  /** 統合後の練習画面: 幅ごと（1920 / 1440 / 1280 / 1024 / 390）に、入力の途中の状態を撮る */
  async playWidths(ctx) {
    const page = await newPage(ctx.browser);
    await page.goto(`${ctx.url}#/play`);
    await page.getByRole('region', { name: 'お題' }).waitFor();
    const romaji = ((await page.getByLabel('ローマ字ガイド').textContent()) ?? '').replaceAll('␣', ' ');
    for (const key of romaji.slice(0, Math.max(2, Math.floor(romaji.length / 2)))) await page.keyboard.press(key);
    for (const w of [1920, 1440, 1280, 1024, 390]) {
      await page.setViewportSize({ width: w, height: Math.round(w * 0.5625) > 900 ? 1000 : Math.max(700, Math.round(w * 0.56)) });
      await page.waitForTimeout(400);
      await page.screenshot({ path: ctx.path.replace('.png', `-w${w}.png`) });
    }
    await page.screenshot({ path: ctx.path });
  },
};
