import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** WCAG 2.0/2.1/2.2 の A・AA と、ベストプラクティスを検査する */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => `${n.target.join(' ')} :: ${(n.failureSummary ?? '').split('\n').slice(1, 3).join(' / ')}`),
  }));
  expect(summary, `${label} の違反:\n${JSON.stringify(summary, null, 2)}`).toEqual([]);
}

const guide = (page: Page) => page.getByLabel('ローマ字ガイド');
async function typeCurrentWord(page: Page) {
  const romaji = ((await guide(page).textContent()) ?? '').replaceAll('␣', ' ');
  for (const key of romaji) await page.keyboard.press(key);
}
async function playThrough(page: Page, words = 10) {
  for (let i = 1; i <= words; i++) {
    await expect(page.getByLabel('進捗')).toHaveText(`${i} / ${words}`);
    await typeCurrentWord(page);
  }
}

test.describe('axe による自動検査', () => {
  test('ホーム（記録なし）', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Typing' })).toBeVisible();
    await scan(page, 'ホーム（記録なし）');
  });

  test('練習・結果・ホーム（記録あり）・統計', async ({ page }) => {
    await page.goto('/#/play');
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    await scan(page, '練習（開始直後）');

    await typeCurrentWord(page);
    await scan(page, '練習（1語目を打ち終えた後）');
    await page.keyboard.press('1'); // 誤打鍵の表示中
    await scan(page, '練習（誤打鍵の直後）');
    await page.getByLabel('進捗').waitFor();
    // 残りを打ち切る
    for (let i = 2; i <= 10; i++) {
      await expect(page.getByLabel('進捗')).toHaveText(`${i} / 10`);
      await typeCurrentWord(page);
    }
    await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
    await scan(page, '結果');

    await page.goto('/');
    await expect(page.getByRole('heading', { name: '級位と目標' })).toBeVisible();
    await scan(page, 'ホーム（記録あり）');

    await page.goto('/#/stats');
    await expect(page.getByRole('heading', { name: '統計' })).toBeVisible();
    await scan(page, '統計');
  });

  test('デイリー（ゴースト表示中）・再挑戦', async ({ page }) => {
    await page.goto('/#/daily');
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    await playThrough(page);
    await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
    await page.goto('/#/daily');
    await expect(page.getByRole('region', { name: 'ゴースト' })).toBeVisible();
    await scan(page, 'デイリー（ゴースト表示中）');
  });

  test('ホーム: 自作パックの取り込みエラー表示・設定', async ({ page }) => {
    await page.goto('/');
    const bad = { id: 'bad', name: 'bad', items: [{ display: '漢', reading: '漢字' }] };
    await page.getByLabel('取り込むパックのファイル').setInputFiles({ name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
    await expect(page.getByText(/取り込めません/)).toBeVisible();
    await scan(page, 'ホーム（取り込みエラー表示）');
  });
});

/** 統計が意味を持つ量の、合成データ（取り込み用 JSON）。時間帯・曜日・キーにばらつきを持たせる */
function syntheticExport() {
  const words: [string, string][] = [['さくら', 'sakura'], ['やま', 'yama'], ['かわ', 'kawa'], ['うみ', 'umi'], ['そら', 'sora']];
  const now = Date.now();
  const sessions = Array.from({ length: 14 }, (_, n) => {
    const keystrokes: object[] = [];
    let t = 1200;
    words.forEach(([, romaji], item) => {
      for (const ch of romaji) {
        if ((n + item + ch.charCodeAt(0)) % 17 === 0) {
          t += 250;
          keystrokes.push({ t, key: 'x', code: 'KeyX', expected: ch, correct: false, item });
        }
        t += 150 + ((n * 7 + ch.charCodeAt(0)) % 90);
        keystrokes.push({ t, key: ch, code: `Key${ch.toUpperCase()}`, expected: ch, correct: true, item });
      }
      t += 500;
    });
    const startedAt = now - (13 - n) * 86_400_000 * 0.7 - (n % 4) * 3_600_000 * 5;
    return {
      id: `synthetic-${n}`, startedAt: Math.round(startedAt), mode: 'practice', contentId: 'basic',
      targets: words.map((w) => w[0]), engineVersion: '1', ruleVersion: 'input-rules-v1', keystrokes,
    };
  });
  return { schemaVersion: 1, exportedAt: now, sessions };
}

async function importSynthetic(page: Page) {
  await page.goto('/');
  await page.getByLabel('取り込むファイル').setInputFiles({
    name: 'data.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(syntheticExport())),
  });
  await expect(page.getByText(/14 件を取り込みました/)).toBeVisible();
}

test.describe('axe: 操作中の状態', () => {
  test('統計（実データ・ツールチップ表示中・表を開いた状態）', async ({ page }) => {
    await importSynthetic(page);
    await scan(page, 'ホーム（実データ・級位カード）');
    await page.goto('/#/stats');
    await expect(page.getByRole('heading', { name: '統計' })).toBeVisible();
    await scan(page, '統計（実データ）');

    // ツールチップ表示中: 折れ線・ヒートマップ・時間帯グラフを、キーボードで操作する
    for (const name of ['速度の推移（打鍵/分）', '時間帯別の速度', 'キー別の苦手']) {
      const group = page.getByRole('group', { name });
      await group.scrollIntoViewIfNeeded();
      await group.focus();
      await page.keyboard.press('ArrowRight');
      await scan(page, `統計（${name} をキーボードで操作中）`);
    }
    // ヒートマップの各セルにフォーカスした状態
    await page.getByRole('img', { name: /^s:/ }).first().focus();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await scan(page, '統計（ヒートマップのセルにフォーカス中）');

    // すべての「表で見る」を開く
    for (const summary of await page.locator('summary').all()) await summary.click();
    await scan(page, '統計（表をすべて開いた状態）');
  });

  test('練習: IME 警告・非アクティブ案内の表示中', async ({ page }) => {
    await page.goto('/#/play');
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', isComposing: true })));
    await expect(page.getByText(/日本語入力がオンのようです/)).toBeVisible();
    await scan(page, '練習（IME 警告）');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.getByText(/アクティブではありません/)).toBeVisible();
    await scan(page, '練習（非アクティブ案内）');
  });

  test('ホーム: 自作パックが登録済み・取り込み成功の表示', async ({ page }) => {
    await page.goto('/');
    const ok = { id: 'mine', name: '自作', items: [{ display: '猫', reading: 'ねこ' }] };
    await page.getByLabel('取り込むパックのファイル').setInputFiles({ name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(ok)) });
    await expect(page.getByText(/取り込みました/)).toBeVisible();
    await scan(page, 'ホーム（自作パック登録済み）');
  });
});

test.describe('文字サイズ 200%', () => {
  for (const path of ['/', '/#/play', '/#/daily', '/#/stats']) {
    test(`横スクロールが出ず、自動検査も通る: ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path);
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `はみ出し: ${overflow}px`).toBeLessThanOrEqual(1);
      await scan(page, `文字サイズ 200%: ${path}`);
    });
  }
});
