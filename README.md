# Typing

個人学習用のタイピングゲーム（PC専用）。Ver.1（[Mobile-](https://github.com/Toshiki-Yasuda/Mobile-)）を原型に、コアを作り直したもの。

- コアはテーマ非依存。モチーフ・世界観は「テーマパック」として別に用意する
- 詳細な方針とロードマップは [docs/PLAN.md](docs/PLAN.md)

## 開発

```bash
npm install
npm run dev     # 開発サーバー
npm run check   # lint → 型チェック → テスト → ビルド（CIと同じ）
```

## 技術スタック
React 19 / TypeScript / Vite / Tailwind CSS 4 / Zustand / React Router / Vitest + Testing Library / ESLint (flat config)
