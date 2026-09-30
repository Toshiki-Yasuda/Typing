import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { seedRecords } from './helpers';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  expect(summary, `${label} の違反:\n${JSON.stringify(summary, null, 2)}`).toEqual([]);
}

const guide = (page: Page) => page.getByLabel('ローマ字ガイド');
async function typeCurrentWord(page: Page) {
  const romaji = ((await guide(page).textContent()) ?? '').replaceAll('␣', ' ');
  for (const key of romaji) await page.keyboard.press(key);
}

test.describe('修行の型', () => {
  test('入口: 3 つの型が並び、ホームから行ける（axe も通る）', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /修行/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: '修行' })).toBeVisible();
    for (const name of ['静寂', '速さ', '弱点']) await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
    await scan(page, '修行の入口');
  });

  test('絶: 運指ガイドを出さず、打ち切ると、ミスの段階が結果に出る。記録は train:zetsu', async ({ page }) => {
    await page.goto('/#/train/zetsu');
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    await expect(page.getByRole('region', { name: '運指ガイド' })).toHaveCount(0);
    await scan(page, '絶の練習');
    for (let i = 1; i <= 10; i++) {
      await expect(page.getByLabel('進捗')).toHaveText(`${i} / 10`);
      await typeCurrentWord(page);
    }
    await expect(page).toHaveURL(/#\/result\/.+/);
    const panel = page.getByRole('region', { name: /修行の結果/ });
    await expect(panel).toContainText('段階 S');
    await scan(page, '絶の結果');
    const modes = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const open = indexedDB.open('typing');
          open.onsuccess = () => {
            const req = open.result.transaction('sessions').objectStore('sessions').getAll();
            req.onsuccess = () => resolve((req.result as { mode: string }[]).map((r) => r.mode));
          };
        }),
    );
    expect(modes).toEqual(['train:zetsu']);
  });

  test('練: 残り時間が出て、円をオンにすると次のお題が出る', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('typing.settings.v1', JSON.stringify({ aidEn: true, aidGyo: true }));
    });
    await page.goto('/#/train/ren');
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    await expect(page.getByRole('timer')).toContainText(/残り \d+ 秒/);
    await expect(page.getByText(/^次:/)).toBeVisible();
    await scan(page, '練の練習');
    await typeCurrentWord(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Typing' })).toBeVisible();
  });

  test('発: 記録が無ければ案内。弱点のある記録があれば、技の名前で始まる', async ({ page }) => {
    await page.goto('/#/train/hatsu');
    await expect(page.getByText(/まだ弱点が求まっていません/)).toBeVisible();
    await scan(page, '発（記録なし）');
    await seedRecords(page, 3, { missEvery: 3 });
    await page.reload(); // 同じ URL なので、読み直して記録を反映させる
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    await expect(page.getByText(/『.』の型/).first()).toBeVisible();
  });

  test('練習の提案: 正確率が低い記録が続くと、ホームに丁寧さの提案が出る（axe も通る）', async ({ page }) => {
    await page.goto('/');
    await seedRecords(page, 3, { missEvery: 3 }); // 正確率 約 67%
    await page.reload();
    const note = page.getByRole('region', { name: '練習の提案' });
    await expect(note).toContainText('提案：丁寧に');
    await scan(page, 'ホーム（提案あり）');
    await note.getByRole('link', { name: /静寂/ }).click();
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    await expect(page).toHaveURL(/#\/train\/zetsu$/);
  });
});
