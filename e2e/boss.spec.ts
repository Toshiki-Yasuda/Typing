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

/** ホームでパスワードを入れてテーマを開く。解除するとテーマの入口へ進むので、飛ばしてホームへ戻る */
async function unlock(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Typing' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ボス戦' })).toHaveCount(0);
  await page.getByLabel(/パスワードで新しいテーマを開く/).fill('SAKI');
  await page.getByRole('button', { name: '開く' }).click();
  await expect(page.getByRole('button', { name: /スタート/ })).toBeVisible(); // 入口のゲート
  await page.keyboard.press('Escape'); // オープニングを飛ばす
  await page.getByRole('link', { name: /ホーム/ }).click();
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

  // 決着の演出（敗北）。Enter で結果へ進む
  await expect(page.getByText('Enter またはクリックで進む')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /メルエムに敗れた（ランク D）/ })).toBeVisible();
  await scan(page, 'ボス戦の結果（敗北）');
  await page.getByRole('link', { name: 'ホーム' }).click();
  await expect(page.getByText(/挑戦 1回・最高ランク なし（未勝利）/)).toBeVisible();
});

test('ヒソカ: 全お題を打てば勝ち、ノーミスならランク S', async ({ page }) => {
  // ヒソカの技（3 つに 1 つ、ローマ字が隠れる）は切っておく。ガイドを読んで打つテストのため
  await page.addInitScript(() => localStorage.setItem('typing.settings.v1', JSON.stringify({ bossSkills: false })));
  await unlock(page);
  await page.getByRole('link', { name: 'ヒソカに挑戦する' }).click();
  const guide = page.getByLabel('ローマ字ガイド');
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByLabel('進捗')).toHaveText(`${i} / 10`);
    const romaji = ((await guide.textContent()) ?? '').replaceAll('␣', ' ');
    for (const key of romaji) await page.keyboard.press(key);
  }
  await expect(page.getByText('Enter またはクリックで進む')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /ヒソカを倒した（ランク S）/ })).toBeVisible();
  await scan(page, 'ボス戦の結果（勝利）');
});

test.describe('3D の演出（ホーム）', () => {
  test('テーマを開くと 3D の canvas が出て、演出をオフにすると消える（axe も通る）', async ({ page }) => {
    await unlock(page);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    // 何かが描かれている: 演出を消したときの同じ領域と、見た目が違う
    const box = (await canvas.boundingBox())!;
    const clip = { x: box.x, y: box.y, width: box.width, height: box.height };
    await page.waitForTimeout(1500); // モデルの読み込みと、フェードインを待つ
    const withHero = await page.screenshot({ clip });
    await scan(page, 'ホーム（3D の演出あり）');

    await page.getByRole('combobox', { name: '演出' }).selectOption('off');
    await expect(canvas).toHaveCount(0);
    const withoutHero = await page.screenshot({ clip });
    expect(withHero.equals(withoutHero)).toBe(false);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'ボス戦' })).toBeVisible();
    await expect(canvas).toHaveCount(0);
  });

  test('OS が動きを減らす設定でも、静止した1コマは出る', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await unlock(page);
    await expect(page.locator('canvas')).toBeVisible();
  });
});
