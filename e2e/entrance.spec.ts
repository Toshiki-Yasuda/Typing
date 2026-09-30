import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
/** 有限のアニメーション（フェードなど）が終わるのを待つ。途中の半透明の色を測って誤検出しないように */
async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

async function scan(page: Page, label: string) {
  await settle(page);
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

test.describe('設定画面', () => {
  test('タイトルから設定へ（axe も通る）。音量は保存され、Esc でタイトルへ戻る', async ({ page }) => {
    await unlock(page);
    await page.keyboard.press('Escape'); // ゲートから直接タイトルへ
    await page.getByRole('link', { name: /設定/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: '設定' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '音' })).toBeVisible();
    await scan(page, '設定画面');

    const slider = page.getByRole('slider', { name: 'BGM の音量' });
    await slider.focus();
    await page.keyboard.press('ArrowRight'); // 60 → 65
    await expect(page.getByText('65%')).toBeVisible();
    await page.getByRole('combobox', { name: '練習中の BGM' }).selectOption('all');

    await page.reload();
    await expect(page.getByRole('slider', { name: 'BGM の音量' })).toHaveValue('65');
    await expect(page.getByRole('combobox', { name: '練習中の BGM' })).toHaveValue('all');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'メニュー' })).toBeVisible();
  });
});

test.describe('ステージ選択', () => {
  const typeCurrentWord = async (page: Page) => {
    const romaji = ((await page.getByLabel('ローマ字ガイド').textContent()) ?? '').replaceAll('␣', ' ');
    for (const key of romaji) await page.keyboard.press(key);
  };

  test('タイトルからステージ選択へ（axe も通る）。ステージを打ち切るとクリアの印が付く', async ({ page }) => {
    await unlock(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('2'); // ステージ選択
    await expect(page.getByRole('heading', { level: 1, name: 'ステージ選択' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /第1章 ハンター試験編/ })).toBeVisible();
    await scan(page, 'ステージ選択');

    await page.getByRole('link', { name: /未挑戦/ }).first().click();
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    for (let i = 1; i <= 10; i++) {
      await expect(page.getByLabel('進捗')).toHaveText(`${i} / 10`);
      await typeCurrentWord(page);
    }
    await expect(page.getByRole('heading', { level: 2, name: /ステージクリア/ })).toBeVisible();
    await scan(page, 'ステージの結果');

    await page.getByRole('link', { name: 'ステージ選択へ' }).click();
    await expect(page.getByText('✓ クリア済み')).toBeVisible();
    await expect(page.getByText('1 / 5 クリア')).toBeVisible();
  });

  test('章を切り替えられ、ボスへも進める', async ({ page }) => {
    await unlock(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('2');
    await page.getByRole('button', { name: /第6章/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: /第6章 キメラアント編/ })).toBeVisible();
    await page.getByRole('link', { name: /ボス メルエムに挑戦する/ }).click();
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    await expect(page.getByText('ミスの余裕 1 回')).toBeVisible();
  });
});
