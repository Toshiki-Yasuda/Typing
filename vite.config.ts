import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // 相対パスで配信する。GitHub Pages のサブパス（/Typing/）でも、ルートでも動く（画面遷移はハッシュ）
  base: './',
  // three.js は 3D の演出があるテーマを選んだときだけ読み込む別チャンク（gzip で約 155KB）。メインの大きさは別
  build: { chunkSizeWarningLimit: 700 },
  plugins: [react(), tailwindcss()],
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
