import { startTyping, minKeystrokes } from '@/engine';
import { bigramStats, cleanPairs, computeMetrics, confusionMatrix, keyStats, recordPress } from './index';
import type { Keystroke } from './index';

/** [t, 正打か, 期待キー, お題番号] の並びから打鍵ログを作る */
const log = (...rows: Array<[number, boolean, string?, number?]>): Keystroke[] =>
  rows.map(([t, correct, expected = 'a', item = 0]) => ({
    t,
    key: correct ? expected : 'z',
    code: '',
    expected,
    correct,
    item,
  }));

describe('computeMetrics', () => {
  it('打鍵ゼロ', () => {
    expect(computeMetrics([])).toEqual({
      total: 0,
      correct: 0,
      misses: 0,
      accuracy: 1,
      elapsedMs: 0,
      kpm: 0,
      rawKpm: 0,
      wpm: 0,
      consistency: null,
      efficiency: null,
    });
  });

  it('等間隔の10打鍵: 900ms で 666.7 KPM、一貫性 100', () => {
    const m = computeMetrics(log(...Array.from({ length: 10 }, (_, i): [number, boolean] => [i * 100, true])));
    expect(m.elapsedMs).toBe(900);
    expect(m.kpm).toBeCloseTo(666.67, 1);
    expect(m.wpm).toBeCloseTo(133.33, 1);
    expect(m.accuracy).toBe(1);
    expect(m.consistency).toBe(100);
  });

  it('誤打鍵: 正確率は 正打/総打、raw は総打鍵で数える', () => {
    const m = computeMetrics(log([0, true], [100, false], [200, true], [300, true], [400, true], [500, true]));
    expect(m).toMatchObject({ total: 6, correct: 5, misses: 1, elapsedMs: 500 });
    expect(m.accuracy).toBeCloseTo(5 / 6);
    expect(m.kpm).toBeCloseTo(600); // 5 / (0.5s/60)
    expect(m.rawKpm).toBeCloseTo(720); // 6 / (0.5s/60)
  });

  it('終了は最後の正打。その後の誤打鍵は総数にだけ入る', () => {
    const m = computeMetrics(log([0, true], [100, true], [900, false]));
    expect(m.elapsedMs).toBe(100);
    expect(m.total).toBe(3);
  });

  it('一貫性: 間隔 100/300 の繰り返し（変動係数 0.5）→ 約 53.8', () => {
    const m = computeMetrics(log([0, true], [100, true], [400, true], [500, true], [800, true]));
    expect(m.consistency).toBeCloseTo(100 * (1 - Math.tanh(0.5)), 5);
    expect(m.consistency).toBeCloseTo(53.79, 1);
  });

  it('間隔が3つ未満なら一貫性は null', () => {
    expect(computeMetrics(log([0, true], [100, true], [200, true])).consistency).toBeNull();
  });

  it('効率 = 理論最小打鍵数 / 総打鍵', () => {
    const m = computeMetrics(log([0, true], [100, false], [200, true]), { minKeystrokes: 2 });
    expect(m.efficiency).toBeCloseTo(2 / 3);
  });

  it('経過 0（打鍵が1つだけ）でも NaN にならない', () => {
    const m = computeMetrics(log([50, true]));
    expect(m).toMatchObject({ elapsedMs: 0, kpm: 0, rawKpm: 0 });
  });
});

describe('cleanPairs（統計に使える連続2打鍵）', () => {
  it('誤打鍵の直後・誤打鍵自身は含めない', () => {
    const pairs = cleanPairs(log([0, true], [100, true], [200, false], [300, true], [400, true], [500, true]));
    expect(pairs.map((p) => [p.prev.t, p.cur.t])).toEqual([
      [0, 100],
      [300, 400],
      [400, 500],
    ]);
  });

  it('休止（3秒超）とお題またぎは含めない', () => {
    const pairs = cleanPairs(log([0, true], [100, true], [5100, true], [5200, true, 'a', 1], [5300, true, 'a', 1]));
    expect(pairs.map((p) => p.dt)).toEqual([100, 100]);
    expect(pairs.map((p) => p.cur.t)).toEqual([100, 5300]);
  });
});

describe('統計', () => {
  const ks = log([0, true, 'k'], [120, true, 'a'], [200, false, 'k'], [350, true, 'k'], [470, true, 'a']);

  it('keyStats: 期待キーごとの試行・ミス・平均遅延（ミス直後は遅延に含めない）', () => {
    const stats = keyStats(ks);
    expect(stats.get('k')).toEqual({ key: 'k', attempts: 3, misses: 1, meanLatencyMs: null, latencyCount: 0 });
    expect(stats.get('a')).toEqual({ key: 'a', attempts: 2, misses: 0, meanLatencyMs: 120, latencyCount: 2 });
  });

  it('bigramStats: 連接ごとの平均遅延', () => {
    const stats = bigramStats(ks);
    // a→k は当該が誤打鍵、k→k は直前が誤打鍵なので除外され、k→a の2組だけが残る
    expect([...stats.keys()]).toEqual(['ka']);
    expect(stats.get('ka')).toEqual({ bigram: 'ka', count: 2, meanLatencyMs: 120 });
  });

  it('confusionMatrix: 期待 → 実際（誤打鍵のみ）', () => {
    const m = confusionMatrix(ks);
    expect(m.get('k')?.get('z')).toBe(1);
    expect(m.size).toBe(1);
  });

  it('期待キーが無い打鍵は統計に入れない', () => {
    const noExpected: Keystroke[] = [{ t: 0, key: 'a', code: '', expected: null, correct: false, item: 0 }];
    expect(keyStats(noExpected).size).toBe(0);
    expect(confusionMatrix(noExpected).size).toBe(0);
  });
});

describe('recordPress（エンジンとの接続）', () => {
  it('正打・誤打・終了を記録する。誤打鍵の期待キーはガイドが示す次のキー', () => {
    let state = startTyping('か');
    const rec = (key: string, t: number) => {
      const r = recordPress(state, { key, code: `Key${key.toUpperCase()}` }, t, 0);
      state = r.state;
      return r;
    };
    const miss = rec('x', 10);
    expect(miss.outcome).toBe('miss');
    expect(miss.keystroke).toEqual({ t: 10, key: 'x', code: 'KeyX', expected: 'k', correct: false, item: 0 });

    const upper = rec('K', 20); // Shift 付きでも受理。期待キーは小文字
    expect(upper.keystroke).toMatchObject({ key: 'K', expected: 'k', correct: true });

    const done = rec('a', 30);
    expect(done.outcome).toBe('done');
    expect(done.keystroke).toMatchObject({ expected: 'a', correct: true });
  });

  it('無視される入力はログに残さない', () => {
    const r = recordPress(startTyping('か'), { key: 'Shift', code: 'ShiftLeft' }, 5, 0);
    expect(r).toMatchObject({ outcome: 'ignored', keystroke: null });
  });

  it('1語を打ち切ったログから指標を計算できる（効率 100%）', () => {
    const text = 'かんじ';
    let state = startTyping(text);
    const ks: Keystroke[] = [];
    [...'kanzi'].forEach((key, i) => {
      const r = recordPress(state, { key, code: '' }, i * 100, 0);
      state = r.state;
      if (r.keystroke) ks.push(r.keystroke);
    });
    expect(state.done).toBe(true);
    const m = computeMetrics(ks, { minKeystrokes: minKeystrokes(text) });
    expect(m).toMatchObject({ total: 5, correct: 5, accuracy: 1, efficiency: 1, elapsedMs: 400 });
    expect(m.kpm).toBeCloseTo(750);
  });
});
