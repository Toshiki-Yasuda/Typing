// 配信量の予算の検査（ビルドの後に実行）。docs/budget.json の上限を超えたら失敗する。
// 使い方: node scripts/check-budget.mjs   （npm run budget。npm run check にも入っている）
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const budget = JSON.parse(readFileSync('docs/budget.json', 'utf8'));
const kb = (n) => (n / 1024).toFixed(1);
const problems = [];

const assets = readdirSync('dist/assets').map((name) => {
  const buf = readFileSync(join('dist/assets', name));
  return { name, raw: buf.length, gzip: gzipSync(buf).length };
});
const js = assets.filter((a) => a.name.endsWith('.js')).sort((a, b) => b.gzip - a.gzip);
const css = assets.filter((a) => a.name.endsWith('.css'));

const main = js.find((a) => a.name.startsWith('index-'));
if (!main) problems.push('メインの JS（index-*.js）が見つかりません');
const lazy = js.filter((a) => a !== main);

const check = (label, actual, limit) => {
  const ok = actual <= limit * 1024;
  console.log(`${ok ? '✔' : '✘'} ${label}: ${kb(actual)}KB（上限 ${limit}KB）`);
  if (!ok) problems.push(`${label} が予算を超えています: ${kb(actual)}KB > ${limit}KB`);
};

if (main) check('メイン JS（gzip）', main.gzip, budget.mainJsGzipKB);
for (const a of lazy) check(`遅延チャンク ${a.name}（gzip）`, a.gzip, budget.lazyChunkGzipKB);
check('CSS（gzip、合計）', css.reduce((s, a) => s + a.gzip, 0), budget.cssGzipKB);

// テーマの素材（公開する public/themes の合計）
const dirSize = (dir) =>
  readdirSync(dir).reduce((sum, n) => {
    const p = join(dir, n);
    return sum + (statSync(p).isDirectory() ? dirSize(p) : statSync(p).size);
  }, 0);
check('テーマの素材（public/themes、合計）', dirSize('public/themes'), budget.themesMB * 1024);

if (problems.length > 0) {
  console.error('\n配信量の予算を超えました:\n- ' + problems.join('\n- '));
  console.error('意図した増加なら docs/budget.json を、理由と一緒に更新してください。');
  process.exit(1);
}
