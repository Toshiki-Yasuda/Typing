import { liveMetrics } from './live';
import type { Keystroke } from './types';

const k = (t: number, correct = true, item = 0): Keystroke => ({ t, key: 'a', code: 'KeyA', expected: 'a', correct, item });

describe('liveMetrics', () => {
  it('打鍵が無い: 速さ・正確率は null、ミス 0、経過は now から', () => {
    expect(liveMetrics([], 4999)).toEqual({ kpm: null, accuracy: null, misses: 0, elapsedSec: 4 });
  });

  it('打鍵が 1 つだけ（間隔が無い）: 速さは null、正確率は出る', () => {
    expect(liveMetrics([k(100)], 1000)).toEqual({ kpm: null, accuracy: 1, misses: 0, elapsedSec: 1 });
  });

  it('全部正打: 3 間隔 1500ms → 3 / 0.025 分 = 120', () => {
    const r = liveMetrics([k(0), k(500), k(1000), k(1500)], 2000);
    expect(r.kpm).toBeCloseTo(120, 9);
    expect(r.accuracy).toBe(1);
    expect(r.misses).toBe(0);
  });

  it('ミスは正確率とミス数に出て、速さは正打で終わる間隔だけ数える', () => {
    // 5 打鍵中 2 ミス。間隔 4 つ（各 500ms、計 2000ms）のうち正打で終わるのは 2 つ → 2 / (2/60) = 60
    const r = liveMetrics([k(0), k(500, false), k(1000), k(1500, false), k(2000)], 2500);
    expect(r.misses).toBe(2);
    expect(r.accuracy).toBeCloseTo(0.6, 9);
    expect(r.kpm).toBeCloseTo(60, 9);
  });

  it('お題をまたぐ間隔と休止（3 秒超）は速さに入れない', () => {
    // 間隔: 0→500 (同お題, 500ms), 500→9000 (お題をまたぐ), 9000→9500 (500ms) → 2 / (1000ms) = 120
    const r = liveMetrics([k(0), k(500), k(9000, true, 1), k(9500, true, 1)], 10000);
    expect(r.kpm).toBeCloseTo(120, 9);
  });

  it('経過秒は now の切り捨てで、負にならない', () => {
    expect(liveMetrics([], 999).elapsedSec).toBe(0);
    expect(liveMetrics([], 1000).elapsedSec).toBe(1);
    expect(liveMetrics([], -50).elapsedSec).toBe(0);
  });
});
