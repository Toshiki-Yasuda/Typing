import { bigramWeakness, keyWeakness } from './weakness';
import type { Keystroke } from './types';

let clock = 0;
/** 期待キー expected を n 回打ち、うち misses 回はミス。正打は latency ms 間隔（直前の正打から） */
function attempts(expected: string, n: number, misses: number, latency = 100): Keystroke[] {
  const out: Keystroke[] = [];
  for (let i = 0; i < n; i++) {
    if (i < misses) {
      clock += 500; // ミス
      out.push({ t: clock, key: '1', code: '', expected, correct: false, item: 0 });
      clock += 500;
      out.push({ t: clock, key: expected, code: '', expected, correct: true, item: 0 });
    } else {
      clock += latency;
      out.push({ t: clock, key: expected, code: '', expected, correct: true, item: 0 });
    }
  }
  return out;
}

describe('keyWeakness', () => {
  it('ログが空なら空', () => {
    expect(keyWeakness([]).size).toBe(0);
  });

  it('ミスの多いキーほど弱い', () => {
    const w = keyWeakness([[...attempts('k', 20, 10), ...attempts('a', 20, 0), ...attempts('s', 20, 2)]]);
    const [k, a, s] = [w.get('k'), w.get('a'), w.get('s')] as number[];
    expect(k).toBeGreaterThan(s as number);
    expect(s).toBeGreaterThan(a as number);
  });

  it('遅いキーほど弱い（ミスが同じなら）', () => {
    const w = keyWeakness([[...attempts('k', 30, 0, 300), ...attempts('a', 30, 0, 100), ...attempts('s', 30, 0, 100)]]);
    expect(w.get('k') as number).toBeGreaterThan(w.get('a') as number);
    expect(w.get('a')).toBeCloseTo(w.get('s') as number, 5);
  });

  it('試行が少ないキーは、多い場合より極端な値にならない（縮小推定）', () => {
    const base = [...attempts('a', 40, 0)];
    const few = keyWeakness([[...base, ...attempts('k', 1, 1)]]).get('k') as number;
    const many = keyWeakness([[...base, ...attempts('k', 20, 20)]]).get('k') as number;
    expect(few).toBeGreaterThan(keyWeakness([base]).get('a') as number);
    expect(few).toBeLessThan(many);
  });

  it('priorAttempts を大きくすると、少ない試行の影響が小さくなる', () => {
    const log = [...attempts('a', 40, 0), ...attempts('k', 2, 2)];
    const low = keyWeakness([log], { priorAttempts: 1 }).get('k') as number;
    const high = keyWeakness([log], { priorAttempts: 50 }).get('k') as number;
    expect(high).toBeLessThan(low);
  });

  it('遅延データが無くてもミス率だけで計算できる', () => {
    const log: Keystroke[] = [
      { t: 0, key: '1', code: '', expected: 'k', correct: false, item: 0 },
      { t: 5000, key: 'k', code: '', expected: 'k', correct: true, item: 0 },
    ];
    expect(keyWeakness([log]).get('k') as number).toBeGreaterThan(0);
  });
});

/** 期待キーを順に、それぞれ直前から dt ms 後に正打する（同じお題内） */
function typed(keys: string, dt: number[], start = 0): Keystroke[] {
  let t = start;
  return [...keys].map((expected, i) => {
    t += dt[i] ?? 100;
    return { t, key: expected, code: '', expected, correct: true, item: 0 };
  });
}

describe('bigramWeakness', () => {
  it('ログが空なら空', () => {
    expect(bigramWeakness([]).size).toBe(0);
  });

  it('遅い連接ほど弱く、速い連接は 0', () => {
    // ka: 300ms を 30 回、sa: 100ms を 30 回（ka の前後は別セッションで区切る）
    const sessions = [];
    for (let i = 0; i < 30; i++) sessions.push(typed('ka', [0, 300]), typed('sa', [0, 100]));
    const w = bigramWeakness(sessions);
    expect(w.get('ka') as number).toBeGreaterThan(0.3);
    expect(w.get('sa')).toBe(0);
  });

  it('試行が少ない連接は、多い場合より極端な値にならない（縮小推定）', () => {
    const base = [];
    for (let i = 0; i < 30; i++) base.push(typed('sa', [0, 100]));
    const few = bigramWeakness([...base, typed('ka', [0, 400])]);
    const many = bigramWeakness([...base, ...Array.from({ length: 30 }, () => typed('ka', [0, 400]))]);
    expect(few.get('ka') as number).toBeGreaterThan(0);
    expect(few.get('ka') as number).toBeLessThan(many.get('ka') as number);
  });

  it('セッションの境界では連接を作らない', () => {
    const w = bigramWeakness([typed('a', [0]), typed('b', [0])]);
    expect(w.size).toBe(0);
  });
});
