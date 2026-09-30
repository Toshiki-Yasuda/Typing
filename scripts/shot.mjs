// 画面のスクリーンショットを撮る（見た目の確認用）。dist を配信して、名前付きの場面を撮る。
//   npm run build && node scripts/shot.mjs title stages boss      # 場面を指定
//   node scripts/shot.mjs --list                                   # 場面の一覧
// 出力: $SHOT_DIR（既定 /tmp/shots）/<場面>.png。場面は scripts/scenarios.mjs に足す。
import { mkdirSync } from 'node:fs';
import { launch, startPreview } from './lib/browser.mjs';
import { SCENARIOS } from './scenarios.mjs';

const args = process.argv.slice(2);
if (args.includes('--list') || args.length === 0) {
  console.log('場面:', Object.keys(SCENARIOS).join(' '));
  process.exit(0);
}
const out = process.env.SHOT_DIR ?? '/tmp/shots';
mkdirSync(out, { recursive: true });
const preview = await startPreview();
const browser = await launch();
try {
  for (const name of args) {
    const scenario = SCENARIOS[name];
    if (!scenario) {
      console.error(`場面「${name}」はありません（--list で一覧）`);
      process.exitCode = 1;
      continue;
    }
    const path = `${out}/${name}.png`;
    await scenario({ browser, url: preview.url, path });
    console.log('撮影:', path);
  }
} finally {
  await browser.close();
  preview.stop();
}
