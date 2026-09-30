import { expect, test } from '@playwright/test';

// ビルドした index.html の CSP（vite.config.ts）が、主要な画面（3D・音を含む）を壊していないことを確かめる。
// 違反はブラウザの securitypolicyviolation イベントで拾う
const PATHS = ['/', '/#/play', '/#/stats', '/#/daily', '/#/license', '/#/diagnosis', '/#/codex', '/#/stages', '/#/boss/chapter1'];

test.describe('CSP', () => {
  test('meta で指定されている', async ({ page }) => {
    await page.goto('/');
    const content = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(content).toContain("default-src 'self'");
    expect(content).toContain("object-src 'none'");
  });

  test('主要な画面（HUNTER テーマを含む）で、CSP 違反が出ない', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('typing.themes.unlocked.v1', '["hunter"]');
      localStorage.setItem('typing.settings.v1', JSON.stringify({ themeId: 'hunter', effects: 'full' }));
      (window as unknown as { __csp: string[] }).__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    for (const path of PATHS) {
      await page.goto(path);
      await page.waitForTimeout(1200);
      const violations = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
      expect(violations, `${path} の CSP 違反`).toEqual([]);
    }
  });
});
