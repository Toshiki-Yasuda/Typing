import { expect, test, type Page } from '@playwright/test';

/** 今フォーカスされている要素の、名前（アクセシブルネームに近いもの）を返す */
const focusedName = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return '(body)';
    return el.getAttribute('aria-label') || (el as HTMLInputElement).labels?.[0]?.textContent || el.textContent?.trim().slice(0, 30) || el.tagName;
  });

test.describe('キーボードだけでの操作', () => {
  test('ホーム: 操作用のボタンにフォーカスして Enter を押しても、練習は始まらない（そのボタンの動作だけ）', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Typing' })).toBeVisible();
    await page.getByRole('button', { name: '記録を書き出す' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/$|\/$/); // 練習画面（#/play）に移っていない
    await expect(page.getByRole('heading', { name: 'Typing' })).toBeVisible();
  });

  test('ホーム: 選択肢（select）やチェックボックスの操作で Enter を使っても、練習は始まらない', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('出題パック').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Typing' })).toBeVisible();
    await page.getByLabel('運指ガイドを表示する').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Typing' })).toBeVisible();
  });

  test('ホーム: 何にもフォーカスしていない状態の Enter は、練習を始める（ショートカット）', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Typing' })).toBeVisible();
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
  });

  test('ホーム: Tab だけで、全ての操作要素に順に届く（フォーカスの罠がない）', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Typing' })).toBeVisible();
    const expected = await page
      .locator('a[href], button, select, input:not([type=hidden]):not(.hidden), [tabindex="0"]')
      .evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).length);
    const seen = new Set<string>();
    for (let i = 0; i < expected + 5; i++) {
      await page.keyboard.press('Tab');
      seen.add(await focusedName(page));
    }
    expect(seen.size).toBeGreaterThanOrEqual(expected - 2); // 同名の要素があるので、少し余裕を見る
    expect(seen.has('練習を始める（Enter）')).toBe(true);
    expect(seen.has('出題パック')).toBe(true);
    expect(seen.has('目標の級位')).toBe(true);
  });

  test('フォーカスされた要素には、はっきりした表示（アウトライン）が出る', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Typing' })).toBeVisible();
    const problems: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const cs = getComputedStyle(el);
        const outlined = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2;
        return { name: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 20) || el.tagName, outlined, boxShadow: cs.boxShadow };
      });
      if (!info.outlined && info.boxShadow === 'none') problems.push(info.name);
    }
    expect(problems, `フォーカス表示が無い要素: ${problems.join(', ')}`).toEqual([]);
  });

  test('画面ごとに、タイトルが変わり、見出しにフォーカスが移る', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Typing');
    await page.getByRole('link', { name: '統計を見る' }).click();
    await expect(page.getByRole('heading', { name: '統計' })).toBeVisible();
    await expect(page).toHaveTitle('統計 - Typing');
    expect(await focusedName(page)).toBe('統計');
    await page.getByRole('link', { name: 'ホーム' }).click();
    await expect(page).toHaveTitle('Typing');
  });

  test('練習画面: Esc で戻れる。Tab でフォーカスの罠にならない', async ({ page }) => {
    await page.goto('/#/play');
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    await expect(page).toHaveTitle('練習 - Typing');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Typing' })).toBeVisible();
  });

  test('誤打鍵は、色だけでなく文字でも示される', async ({ page }) => {
    await page.goto('/#/play');
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    await page.keyboard.press('1');
    await expect(page.getByRole('region', { name: 'お題' })).toContainText('ミス');
    // しばらくすると消える
    await expect(page.getByRole('region', { name: 'お題' })).not.toContainText('ミス', { timeout: 2000 });
  });
});

test.describe('表示の条件', () => {
  test('動きを減らす設定: アニメーション・遷移がほぼ 0 になる', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#/play');
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    const durations = await page.evaluate(() =>
      [...document.querySelectorAll('*')].map((e) => parseFloat(getComputedStyle(e).transitionDuration.split(',')[0] ?? '0')),
    );
    expect(Math.max(...durations)).toBeLessThan(0.01);
  });

  for (const path of ['/', '/#/play', '/#/stats']) {
    test(`320px 幅（400% 拡大相当）で、横スクロールが出ない: ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 720 });
      await page.goto(path);
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `はみ出し: ${overflow}px`).toBeLessThanOrEqual(1);
    });
  }

  test('強制カラー（Windows のハイコントラスト）でも、運指ガイドの「次のキー」が見分けられる', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/#/play');
    await expect(page.getByRole('region', { name: '運指ガイド' })).toBeVisible();
    const cells = page.locator('[aria-current="true"]');
    await expect(cells.first()).toBeVisible();
    const active = await cells.first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { outlineWidth: parseFloat(cs.outlineWidth), outlineStyle: cs.outlineStyle, borderWidth: parseFloat(cs.borderTopWidth) };
    });
    const others = await page.locator('[aria-label="運指ガイド"] div[aria-hidden] div:not([aria-current])').first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { outlineWidth: parseFloat(cs.outlineWidth), outlineStyle: cs.outlineStyle, borderWidth: parseFloat(cs.borderTopWidth) };
    });
    // 次のキーだけ、他より太い枠（アウトライン）がある
    expect(active.outlineStyle).not.toBe('none');
    expect(active.outlineWidth).toBeGreaterThan(others.outlineStyle === 'none' ? 0 : others.outlineWidth);
  });
});
