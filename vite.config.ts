import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * コンテンツセキュリティポリシー（ビルドした index.html にだけ入れる。開発サーバーは HMR のため除く）。
 * GitHub Pages は HTTP ヘッダーを足せないので meta で指定する（frame-ancestors などヘッダー専用の指定はできない）。
 * style は React の style 属性のため 'unsafe-inline' を許す。script は同一オリジンのみ（インラインなし）。
 * 違反は e2e/csp.spec.ts で検出する。外部へ通信する機能を足すときは connect-src を見直す。
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export default defineConfig({
  // 相対パスで配信する。GitHub Pages のサブパス（/Typing/）でも、ルートでも動く（画面遷移はハッシュ）
  base: './',
  // three.js は 3D の演出があるテーマを選んだときだけ読み込む別チャンク（gzip で約 155KB）。メインの大きさは別
  build: { chunkSizeWarningLimit: 700 },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'csp-meta',
      apply: 'build',
      transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
    },
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      include: ['src/engine/**', 'src/metrics/**', 'src/storage/**', 'src/input/**', 'src/settings/**', 'src/content/**', 'src/session/**', 'src/fingering/**'],
      exclude: ['src/engine/testing/**', '**/*.test.ts'],
      thresholds: { statements: 95, branches: 90, functions: 95, lines: 95 },
    },
  },
});
