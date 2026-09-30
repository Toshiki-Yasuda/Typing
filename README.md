# Typing

個人学習用のタイピングゲーム（PC専用）。Ver.1（[Mobile-](https://github.com/Toshiki-Yasuda/Mobile-)）を原型に、コアを作り直したもの。

- コアはテーマ非依存。モチーフ・世界観は「テーマパック」として別に用意する
- 詳細な方針とロードマップは [docs/PLAN.md](docs/PLAN.md)、今後のタスクは [task.md](task.md)
- 仕様: [docs/spec/](docs/spec/)（入力ルール・計測）。実機確認: [docs/manual-check.md](docs/manual-check.md)
- **引き継ぎ・現在の状態: [docs/HANDOFF.md](docs/HANDOFF.md)**（新しいセッションはここから）
- 開発者・AI 向けの作業ルール: [CLAUDE.md](CLAUDE.md)

## できること
- ローマ字入力の練習（表記ゆれを正しく許容。入力ルールの正は [docs/spec/input-rules.md](docs/spec/input-rules.md)）。打鍵ログから速さ・正確率・弱点を再計算し、級位・統計・6 軸診断で見られる
- 出題パック（基本・英単語・記号・フレーズ・自作）、デイリー、ゴースト、弱点の重点練習、修行の型（絶・練・発）
- テーマ（パスワードで開く「HUNTER」）: ステージ・ボス戦（時間制限・技・攻撃予告）・図鑑・ライセンス・BGM と効果音・3D 演出
- 記録はブラウザ内（IndexedDB）にだけ保存。JSON で書き出し・取り込み（一定期間書き出していないと、ホームで促す）

## 遊ぶ
公開先: https://toshiki-yasuda.github.io/Typing/ （GitHub Pages。初回はリポジトリの Settings → Pages → Source を「GitHub Actions」に設定する）

## 開発

```bash
npm install
npm run dev     # 開発サーバー
npm run check   # lint → 型チェック → テスト → ビルド → 配信量の予算（CIと同じ）
scripts/verify.sh  # check + E2E（Playwright）。push 前に
```

## 技術スタック
React 19 / TypeScript / Vite / Tailwind CSS 4 / React Router / zod / three.js（3D 演出のあるテーマだけ遅延読み込み）/ Vitest + Testing Library / Playwright + axe / ESLint (flat config)

## セキュリティ
- 外部へ通信しない（保存はすべてブラウザ内）。ビルドした `index.html` に CSP（`script-src 'self'`）を meta で指定。GitHub Pages はヘッダーを足せないため、`frame-ancestors` などヘッダー専用の指定はできない
- テーマのパスワードは公開サイト上のクライアント判定で、セキュリティ機能ではない（目隠し）
- `npm audit --omit=dev` は 0 件（2026-09-30）
