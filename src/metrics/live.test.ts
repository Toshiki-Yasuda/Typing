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

  it('全部正打: 5 打・4 間隔 2000ms → 4 / (2/60 分) = 120（出し始めの境界）', () => {
    const r = liveMetrics([k(0), k(500), k(1000), k(1500), k(2000)], 2500);
    expect(r.kpm).toBeCloseTo(120, 9);
    expect(r.accuracy).toBe(1);
    expect(r.misses).toBe(0);
  });

  it('正打が 4 つでは速さを出さない（間隔が長くても）', () => {
    expect(liveMetrics([k(0), k(1000), k(2000), k(3000)], 3500).kpm).toBeNull();
  });

  it('実効時間が 2000ms 未満では速さを出さない（正打は 5 つ）', () => {
    // 4 間隔 × 499ms = 1996ms
    expect(liveMetrics([k(0), k(499), k(998), k(1497), k(1996)], 2500).kpm).toBeNull();
  });

  it('ミスは正確率とミス数に出て、速さは正打で終わる間隔だけ数える', () => {
    // 7 打鍵中 2 ミス（正打 5）。間隔 6 つ（各 500ms、計 3000ms）のうち正打で終わるのは 4 つ → 4 / (3/60) = 80
    const r = liveMetrics([k(0), k(500, false), k(1000), k(1500), k(2000, false), k(2500), k(3000)], 3500);
    expect(r.misses).toBe(2);
    expect(r.accuracy).toBeCloseTo(5 / 7, 9);
    expect(r.kpm).toBeCloseTo(80, 9);
  });

  it('お題をまたぐ間隔と休止（3 秒超）は速さに入れない', () => {
    // 同お題の間隔 500ms が 4 つ（計 2000ms）と、お題をまたぐ 1 間隔（除外）→ 4 / (2/60) = 120
    const r = liveMetrics([k(0), k(500), k(1000), k(9000, true, 1), k(9500, true, 1), k(10000, true, 1)], 10500);
    expect(r.kpm).toBeCloseTo(120, 9);
  });

  it('経過秒は now の切り捨てで、負にならない', () => {
    expect(liveMetrics([], 999).elapsedSec).toBe(0);
    expect(liveMetrics([], 1000).elapsedSec).toBe(1);
    expect(liveMetrics([], -50).elapsedSec).toBe(0);
  });
});
