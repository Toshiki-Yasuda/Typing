import type { Keystroke } from '@/metrics';
import { hideActive, skillRules, stripActive } from './bossSkills';

const ks = (item: number, correct: boolean): Keystroke => ({ t: 1, key: 'a', code: 'KeyA', expected: 'a', correct, item });

describe('hideActive', () => {
  it('3 つに 1 つ（0 始まりで 2・5・8 番目）', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(hideActive)).toEqual([false, false, true, false, false, true, false, false, true]);
  });
});

describe('stripActive', () => {
  it('直前のお題でミスをしていたら、次のお題だけ', () => {
    const log = [ks(0, true), ks(1, false), ks(1, true)];
    expect(stripActive(log, 2)).toBe(true);
    expect(stripActive(log, 1)).toBe(false); // 0 番目にミスは無い
    expect(stripActive(log, 3)).toBe(false); // 2 番目にはミスが無い（奪うのは 1 つ先だけ）
  });
  it('最初のお題は奪わない。ログが空でも奪わない', () => {
    expect(stripActive([ks(0, false)], 0)).toBe(false);
    expect(stripActive([], 1)).toBe(false);
  });
});

describe('skillRules', () => {
  it('スタミナだけが回復の間隔を足す', () => {
    expect(skillRules('stamina')).toEqual({ recoverEvery: 10 });
    expect(skillRules('hide')).toEqual({});
    expect(skillRules('strip')).toEqual({});
    expect(skillRules(undefined)).toEqual({});
  });
});
