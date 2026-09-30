import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  expect(summary, `${label} の違反:\n${JSON.stringify(summary, null, 2)}`).toEqual([]);
}

async function unlock(page: Page) {
  await page.goto('/');
  await page.getByLabel(/パスワードで新しいテーマを開く/).fill('SAKI');
  await page.getByRole('button', { name: '開く' }).click();
}

test.describe('テーマの入口', () => {
  test('テーマを開くとゲート → オープニング → タイトルメニュー（各段階で axe も通る）', async ({ page }) => {
    await unlock(page);
    const gate = page.getByRole('button', { name: /スタート/ });
    await expect(gate).toBeVisible();
    await expect(page).toHaveTitle(/HUNTER×HUNTER/);
    await scan(page, '入口（ゲート）');

    await gate.click();
    const skip = page.getByRole('button', { name: /飛ばす/ });
    await expect(skip).toBeVisible();
    await scan(page, '入口（オープニング）');

    // 飛ばさなくても、時間が来ればタイトルへ
    await expect(page.getByRole('navigation', { name: 'メニュー' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: /はじめる/ })).toBeFocused();
    await scan(page, '入口（タイトルメニュー）');
  });

  test('キーボードだけで入れる: Enter でスタート → Esc で飛ばす → 数字キーで練習へ', async ({ page }) => {
    await unlock(page);
    await expect(page.getByRole('button', { name: /スタート/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: /飛ばす/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'メニュー' })).toBeVisible();
    await page.keyboard.press('1');
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
  });

  test('同じタブで入口を見た後は、ホームがそのまま開く。再読み込みしても繰り返さない', async ({ page }) => {
    await unlock(page);
    await page.keyboard.press('Escape'); // ゲートから直接タイトルへ
    await page.getByRole('link', { name: /ホーム/ }).click();
    await expect(page.getByRole('heading', { name: 'ボス戦' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'ボス戦' })).toBeVisible();
  });

  test('新しいタブ（新しい起動）では、保存済みのテーマの入口が先に出る', async ({ page, context }) => {
    await unlock(page);
    await page.keyboard.press('Escape');
    const fresh = await context.newPage(); // sessionStorage は別
    await fresh.goto('/');
    await expect(fresh.getByRole('button', { name: /スタート/ })).toBeVisible();
  });

  test('演出オフでは、ゲートもオープニングも出さずタイトル', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('typing.settings.v1', JSON.stringify({ effects: 'off' })));
    await page.reload();
    await page.getByLabel(/パスワードで新しいテーマを開く/).fill('SAKI');
    await page.getByRole('button', { name: '開く' }).click();
    await expect(page.getByRole('navigation', { name: 'メニュー' })).toBeVisible();
    await expect(page.getByRole('button', { name: /スタート/ })).toHaveCount(0);
  });

  test('OS が動きを減らす設定では、動くオープニングを飛ばしてタイトル', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await unlock(page);
    await page.getByRole('button', { name: /スタート/ }).click();
    await expect(page.getByRole('navigation', { name: 'メニュー' })).toBeVisible();
  });
});
