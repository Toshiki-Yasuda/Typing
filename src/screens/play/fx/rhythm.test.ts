import { nextStreak, RHYTHM_FULL_AT, rhythmLevel } from './rhythm';

describe('rhythmLevel（連続正打 → 光の強さ）', () => {
  it.each([
    [0, 0],
    [3, 0.1],
    [15, 0.5],
    [29, 29 / 30],
    [30, 1],
    [31, 1],
    [1000, 1],
    [-4, 0],
    [Number.NaN, 0],
  ])('%d 打 → %d', (streak, want) => {
    expect(rhythmLevel(streak)).toBeCloseTo(want, 10);
  });
  it('30 打で最大', () => expect(RHYTHM_FULL_AT).toBe(30));
});

describe('nextStreak', () => {
  it('正打・語の完了・練習の完了は続き、ミスで 0 に戻る', () => {
    expect(nextStreak(4, 'ok')).toBe(5);
    expect(nextStreak(4, 'wordDone')).toBe(5);
    expect(nextStreak(4, 'sessionDone')).toBe(5);
    expect(nextStreak(4, 'miss')).toBe(0);
  });
});
