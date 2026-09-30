import type { SessionSummary } from '@/metrics';
import { recommendation } from './recommendation';

let n = 0;
const s = (accuracy: number, total = 50): SessionSummary => ({
  id: `s${n++}`, startedAt: n, mode: 'practice', kpm: 200, accuracy, consistency: 0.9, efficiency: 0.9, total, misses: 0,
});

describe('recommendation', () => {
  it('3 回に満たなければ提案しない', () => {
    expect(recommendation([])).toBeNull();
    expect(recommendation([s(0.5), s(0.5)])).toBeNull();
  });

  it('中央値が 95% 未満 → 丁寧さ（絶）。根拠の数値を文に含む', () => {
    const r = recommendation([s(0.9), s(0.92), s(0.99)]);
    expect(r).toMatchObject({ kind: 'careful', train: 'zetsu' });
    expect(r?.message).toContain('92.0%');
    expect(r?.message).toContain('95.0%');
    expect(r?.message).toContain('3 回');
  });

  it('中央値がちょうど 95% なら丁寧さではない（境界）', () => {
    expect(recommendation([s(0.9), s(0.95), s(0.99)])).toBeNull();
    expect(recommendation([s(0.949), s(0.949), s(0.99)])?.kind).toBe('careful');
  });

  it('3 回とも 95% 以上 → 速さ（練）。境界の 95% ちょうども含む', () => {
    expect(recommendation([s(0.95), s(0.97), s(1)])).toMatchObject({ kind: 'speed', train: 'ren' });
  });

  it('1 回だけ基準未満（中央値は基準以上）なら、動かさない', () => {
    expect(recommendation([s(0.99), s(0.8), s(0.98)])).toBeNull();
  });

  it('直近 3 回だけを見る（古い不調は無関係）', () => {
    expect(recommendation([s(0.5), s(0.5), s(0.96), s(0.97), s(0.98)])?.kind).toBe('speed');
  });

  it('打鍵が少ない練習（20 未満）は数えない', () => {
    // 数えるのは 96,97 の 2 回だけ → 3 回に満たない
    expect(recommendation([s(0.96), s(0.97), s(0.5, 19)])).toBeNull();
    expect(recommendation([s(0.5, 20), s(0.5), s(0.5)])?.kind).toBe('careful'); // 20 ちょうどは数える
  });

  it('偶数の中央値ではなく 3 回の中央値（奇数）', () => {
    expect(recommendation([s(0.6), s(0.96), s(0.97)])).toBeNull(); // 中央値 0.96
  });
});
