// 指定の幅で、はみ出している要素を探す（320px 幅の横スクロールの原因調べ）。
// 使い方: node scripts/overflow.mjs [幅=320] [ハッシュ=/]  ※事前に npm run build
import { launch, newPage, startPreview } from './lib/browser.mjs';

const width = Number(process.argv[2] ?? 320);
const route = process.argv[3] ?? '/';
const server = await startPreview();
const browser = await launch();
try {
  const page = await newPage(browser, { width, height: 720 });
  await page.goto(`${server.url}#${route}`);
  await page.waitForTimeout(600);
  const rows = await page.evaluate((w) => {
    const describe = (e) => {
      const r = e.getBoundingClientRect();
      return `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 70)} right=${Math.round(r.right)} width=${Math.round(r.width)}`;
    };
    return [...document.querySelectorAll('body *')]
      .filter((e) => e.getBoundingClientRect().right > w + 1)
      .slice(0, 15)
      .map(describe);
  }, width);
  console.log(rows.length ? rows.join('\n') : 'はみ出しなし');
} finally {
  await browser.close();
  server.stop();
}
