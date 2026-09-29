import { expect, test, type Page } from '@playwright/test';
import { LAYOUTS, describeKey, locate } from '../src/fingering';

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

test('設定: 英単語パック・5語で通しプレイでき、設定は再読み込み後も残る', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('出題パック').selectOption('english');
  await page.getByLabel('語数').selectOption('5');
  await page.getByLabel('弱点を優先して出題する').uncheck();

  await page.reload();
  await expect(page.getByLabel('出題パック')).toHaveValue('english');
  await expect(page.getByLabel('語数')).toHaveValue('5');
  await expect(page.getByLabel('弱点を優先して出題する')).not.toBeChecked();

  await page.getByRole('link', { name: /練習を始める/ }).click();
  await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
  await playThrough(page, 5);
  await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
  await expect(page.getByText('ミスはありませんでした。')).toBeVisible();
});

test('自作パック: 取り込み → 選択 → 練習。不正なパックは理由を示して取り込まない', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('取り込むパックのファイル');
  const file = (obj: unknown) => ({ name: 'pack.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(obj)) });

  await input.setInputFiles(
    file({ id: 'bad', name: 'bad', items: [{ display: '漢', reading: '漢字' }, { display: 'x', reading: 'ねこ' }, { display: 'y', reading: 'ねこ' }] }),
  );
  await expect(page.getByText(/取り込めません（2件の問題）/)).toBeVisible();
  await expect(page.getByRole('status')).toContainText('打てない文字');
  await expect(page.getByRole('status')).toContainText('重複');
  await expect(page.getByLabel('出題パック').locator('option')).toHaveCount(3);

  await input.setInputFiles(
    file({ id: 'mine', name: '自作', items: [{ display: '猫', reading: 'ねこ' }, { display: '犬', reading: 'いぬ' }, { display: '鳥', reading: 'とり' }] }),
  );
  await expect(page.getByText('「自作」を取り込みました（3語）')).toBeVisible();
  await page.getByLabel('出題パック').selectOption('mine');

  await page.reload(); // IndexedDB に残っている
  await expect(page.getByLabel('出題パック')).toHaveValue('mine');

  await page.getByRole('link', { name: /練習を始める/ }).click();
  await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
  await expect(page.getByLabel('進捗')).toHaveText('1 / 3');
  await playThrough(page, 3);
  await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
});

test('ウィンドウが非アクティブになると案内が出て、戻ると消える（進行は保たれる）', async ({ page }) => {
  await startPlay(page);
  const first = ((await guide(page).textContent()) ?? '')[0] as string;
  await page.keyboard.press(first);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByText(/アクティブではありません/)).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText(/アクティブではありません/)).toHaveCount(0);
  expect(await typedPart(page)).toBe(first);
});

test('デイリー: 初回はゴーストなし → 2回目は自己ベストと並走 → 結果に比較が出る', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('未挑戦')).toBeVisible();
  await page.getByRole('link', { name: '挑戦する' }).click();
  await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'ゴースト' })).toHaveCount(0);
  await playThrough(page);
  await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();

  // 同じ日のデイリーは同じお題。前回の記録がゴーストになる
  await page.goto('/#/daily');
  await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'ゴースト' })).toContainText('ゴースト: 同じお題の自己ベスト');
  await expect(page.getByRole('region', { name: 'ゴースト' })).toContainText(/先行|遅れ|±0\.0秒/);
  await playThrough(page);
  await expect(page.getByText(/自己ベスト更新！|同じお題の過去最高は/)).toBeVisible();

  await page.getByRole('link', { name: 'ホーム' }).click();
  await expect(page.getByText(/挑戦済み（2回・最高/)).toBeVisible();
});

test('デイリーのお題は、日を変えなければ何度開いても同じ', async ({ page }) => {
  const firstWord = async () => {
    await page.goto('/#/daily');
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    return (await page.getByRole('region', { name: 'お題' }).textContent()) ?? '';
  };
  const a = await firstWord();
  await page.reload();
  const b = await firstWord();
  expect(b).toBe(a);
});

test('結果から「同じお題でもう一度」: 同じお題で、前回がゴーストになる', async ({ page }) => {
  await startPlay(page);
  await playThrough(page);
  await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
  await page.getByRole('link', { name: '同じお題でもう一度' }).click();
  await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'ゴースト' })).toBeVisible();
  await playThrough(page);
  await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
  await expect(page.getByText(/自己ベスト更新！|同じお題の過去最高は/)).toBeVisible();
});

test('運指ガイド: 次のキーの指を示し、打つと変わる。設定で配列の切替・非表示にできる', async ({ page }) => {
  await startPlay(page);
  const region = page.getByRole('region', { name: '運指ガイド' });
  await expect(region).toBeVisible();
  await expect(region).toContainText('JIS配列');
  // ガイドの説明文は、ローマ字ガイドの各文字に対応する指の説明と一致する（打つたびに次のキーへ進む）
  const romaji = ((await guide(page).textContent()) ?? '').replaceAll('␣', ' ');
  const caption = region.locator('p').first();
  const expected = (i: number) => describeKey(locate(LAYOUTS.jis, romaji[i] as string)!);
  await expect(caption).toHaveText(expected(0));
  await expect(region.locator('[aria-current="true"]').first()).toBeVisible();
  await page.keyboard.press(romaji[0] as string);
  await expect(caption).toHaveText(expected(1));
  await page.keyboard.press(romaji[1] as string);
  if (romaji.length > 2) await expect(caption).toHaveText(expected(2));

  await page.goto('/');
  await page.getByLabel('運指ガイドの配列').selectOption('us');
  await page.getByRole('link', { name: /練習を始める/ }).click();
  await expect(page.getByRole('region', { name: '運指ガイド' })).toContainText('US配列');

  await page.goto('/');
  await page.getByLabel('運指ガイドを表示する').uncheck();
  await page.getByRole('link', { name: /練習を始める/ }).click();
  await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
  await expect(page.getByRole('region', { name: '運指ガイド' })).toHaveCount(0);
});

test('級位: 最初の練習で暫定の級位が付き、結果・ホーム・統計に出る。目標も選べる', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/級位はまだありません/)).toBeVisible();
  await page.getByRole('link', { name: /練習を始める/ }).click();
  await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
  await playThrough(page);

  await expect(page.getByRole('heading', { name: '級位' })).toBeVisible();
  await expect(page.getByText('この練習:', { exact: false })).toContainText('相当');
  await expect(page.getByText(/級位が付きました: .+（暫定）/)).toBeVisible();
  await expect(page.getByText(/現在の級位:/)).toBeVisible();
  await expect(page.getByText(/目標 .+ まで あと \d+ 打鍵\/分|目標 .+ を達成しています/)).toBeVisible();

  await page.getByRole('link', { name: 'ホーム' }).click();
  await expect(page.getByRole('heading', { name: '級位と目標' })).toBeVisible();
  await expect(page.getByText(/現在の級位:/)).toBeVisible();
  await page.getByLabel('目標の級位').selectOption('k10');
  await expect(page.getByText('目標 10級 を達成しています')).toBeVisible();

  await page.goto('/#/stats');
  await expect((await page.getByText('級位', { exact: true }).locator('xpath=following-sibling::dd').textContent()) ?? '').toMatch(/級|段/);
});
