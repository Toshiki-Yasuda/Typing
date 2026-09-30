import '@testing-library/jest-dom/vitest';

// jsdom は <audio> の再生を実装していない（呼ぶと "Not implemented" が出る）ので、何もしない実装にする
Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() });
Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: () => {} });
