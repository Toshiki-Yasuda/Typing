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

test('統計画面: 練習を重ねると推移・キー別が表示され、ホバーで値が読める', async ({ page }) => {
  for (let i = 0; i < 2; i++) {
    await startPlay(page);
    await playThrough(page);
    await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
  }

  await page.goto('/#/stats');
  await expect(page.getByRole('heading', { name: '統計' })).toBeVisible();
  await expect(page.getByText('練習した回数').locator('xpath=following-sibling::dd')).toHaveText('2回');
  await expect(page.getByText('連続日数').locator('xpath=following-sibling::dd')).toHaveText('1日');

  // 折れ線: ポインタを重ねると、最寄りの点の値がツールチップに出る
  const chart = page.locator('figure').first().locator('svg');
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  // ヒートマップ: データのあるキーにホバーすると、値が読める色（暗いセル色を継承しない）で出る
  const cell = page.locator('[role=img][aria-label*="ミス率"]:not([aria-label*="データなし"])').first();
  await cell.hover();
  const value = page.getByRole('tooltip').locator('div').first();
  await expect(value).toBeVisible();
  expect(await value.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(232, 233, 238)');

  // 期間の切り替え
  await page.getByRole('button', { name: '7日' }).click();
  await expect(page.getByRole('button', { name: '7日' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('練習した回数').locator('xpath=following-sibling::dd')).toHaveText('2回');

  // 表でも読める
  await page.getByText('表で見る').first().click();
  await expect(page.getByRole('table').first()).toBeVisible();
});
