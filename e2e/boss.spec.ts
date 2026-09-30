import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  expect(summary, `${label} の違反:\n${JSON.stringify(summary, null, 2)}`).toEqual([]);
}

/** ホームでパスワードを入れてテストを開く */
async function unlock(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Typing' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ボス戦' })).toHaveCount(0);
  await page.getByLabel(/パスワードで新しいテーマを開く/).fill('SAKI');
  await page.getByRole('button', { name: '開く' }).click();
  await expect(page.getByRole('heading', { name: 'ボス戦' })).toBeVisible();
}

test('パスワードでテーマを開くと、ボス戦が出る（ホームの a11y も検査）', async ({ page }) => {
  await unlock(page);
  await expect(page.getByRole('link', { name: /に挑戦する/ })).toHaveCount(7);
  await scan(page, 'ホーム（ボス一覧あり）');
  // 再読み込みしても、解除とテーマは残る
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ボス戦' })).toBeVisible();
});

test('間違ったパスワードでは開かない', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/パスワードで新しいテーマを開く/).fill('nope');
  await page.getByRole('button', { name: '開く' }).click();
  await expect(page.getByRole('alert')).toHaveText('パスワードが違います。');
  await expect(page.getByRole('heading', { name: 'ボス戦' })).toHaveCount(0);
});

test('メルエム（ミスの余裕 1 回）: 2 回ミスすると敗北し、結果と戦績が出る', async ({ page }) => {
  await unlock(page);
  await page.getByRole('link', { name: 'メルエムに挑戦する' }).click();
  await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
  await expect(page.getByText('ミスの余裕 1 回')).toBeVisible();
  await scan(page, 'ボス戦（開始直後）');

  // どのお題でも間違いになるキー（'1'）
  await page.keyboard.press('1');
  await expect(page.getByText('ミスの余裕 0 回（次のミスで敗北）')).toBeVisible();
  await page.keyboard.press('1');

  await expect(page.getByRole('heading', { name: /メルエムに敗れた（ランク D）/ })).toBeVisible();
  await scan(page, 'ボス戦の結果（敗北）');
  await page.getByRole('link', { name: 'ホーム' }).click();
  await expect(page.getByText(/挑戦 1回・最高ランク なし（未勝利）/)).toBeVisible();
});

test('ヒソカ: 全お題を打てば勝ち、ノーミスならランク S', async ({ page }) => {
  await unlock(page);
  await page.getByRole('link', { name: 'ヒソカに挑戦する' }).click();
  const guide = page.getByLabel('ローマ字ガイド');
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByLabel('進捗')).toHaveText(`${i} / 10`);
    const romaji = ((await guide.textContent()) ?? '').replaceAll('␣', ' ');
    for (const key of romaji) await page.keyboard.press(key);
  }
  await expect(page.getByRole('heading', { name: /ヒソカを倒した（ランク S）/ })).toBeVisible();
  await scan(page, 'ボス戦の結果（勝利）');
});
