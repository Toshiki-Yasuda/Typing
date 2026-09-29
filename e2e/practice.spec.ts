import { expect, test, type Page } from '@playwright/test';

const guide = (page: Page) => page.getByLabel('ローマ字ガイド');

/** 今のお題のローマ字ガイド（打鍵済み + 残り）を、1打鍵ずつ実キーで打つ */
async function typeCurrentWord(page: Page) {
  const romaji = ((await guide(page).textContent()) ?? '').replaceAll('␣', ' ');
  expect(romaji.length).toBeGreaterThan(0);
  for (const key of romaji) await page.keyboard.press(key);
}

async function playThrough(page: Page, words = 10) {
  for (let i = 1; i <= words; i++) {
    await expect(page.getByLabel('進捗')).toHaveText(`${i} / ${words}`);
    await typeCurrentWord(page);
  }
}

test('ホームから練習を始め、実キーで打ち切ると結果が表示され、記録が残る', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Typing' })).toBeVisible();
  await expect(page.getByText('まだ記録がありません。')).toBeVisible();

  await page.getByRole('link', { name: /練習を始める/ }).click();
  await expect(page).toHaveURL(/#\/play$/);
  await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
  await playThrough(page);

  await expect(page).toHaveURL(/#\/result\/.+/);
  await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
  await expect(page.getByText('正確率').locator('xpath=following-sibling::dd')).toHaveText('100.0%');
  await expect(page.getByText('打鍵効率').locator('xpath=following-sibling::dd')).toHaveText('100.0%');
  await expect(page.getByText('ミスはありませんでした。')).toBeVisible();

  // リロードしても、IndexedDB から結果を復元できる（URL で画面復帰できる）
  await page.reload();
  await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();

  // ホームの履歴に残る
  await page.getByRole('link', { name: 'ホーム' }).click();
  await expect(page.getByRole('link', { name: /打鍵\/分/ })).toHaveCount(1);
});

/** 練習画面を開き、お題が表示されるまで待つ（読み込み前にキーを押さないため） */
async function startPlay(page: Page) {
  await page.goto('/#/play');
  await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
}

/** ガイドのうち、打鍵済みの部分 */
const typedPart = async (page: Page) => (await guide(page).locator('span').first().textContent()) ?? '';

test('誤打鍵は進行を変えず、ミスとして記録され、結果に出る', async ({ page }) => {
  await startPlay(page);
  const first = ((await guide(page).textContent()) ?? '')[0] as string;

  // どのかなの入力にもならないキー（q は「く」= qu として有効なので使えない）
  await page.keyboard.press('1');
  await expect(page.getByLabel('進捗')).toHaveText('1 / 10');
  expect(await typedPart(page)).toBe(''); // 進まない

  await playThrough(page);
  await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
  await expect(page.getByText('ミス', { exact: true }).locator('xpath=following-sibling::dd')).toHaveText('1回');
  await expect(page.getByText('正確率').locator('xpath=following-sibling::dd')).not.toHaveText('100.0%');
  await expect(page.getByText('ミスの多かったキー')).toBeVisible();
  await expect(page.getByText(`${first}`, { exact: true }).first()).toBeVisible();
});

test('Ctrl 併用・自動連打はゲームの打鍵にならない（ブラウザのショートカットを妨げない）', async ({ page }) => {
  await startPlay(page);
  const first = ((await guide(page).textContent()) ?? '')[0] as string;

  await page.keyboard.press(`Control+${first}`);
  expect(await typedPart(page)).toBe('');

  await page.keyboard.down(first);
  await page.keyboard.down(first); // 押しっぱなし（repeat）は無視される
  await page.keyboard.up(first);
  expect(await typedPart(page)).toBe(first);
});

test('Esc で中断してホームに戻る', async ({ page }) => {
  await startPlay(page);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('heading', { name: 'Typing' })).toBeVisible();
});
