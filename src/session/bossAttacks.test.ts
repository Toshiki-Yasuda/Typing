import { attackActive, attackLanded, attackRemaining } from './bossAttacks';

const rule = { everyWords: 3, windowMs: 5000 };

describe('攻撃予告', () => {
  it('3 語に 1 つ（0 始まりで 2・5・8 番目）が予告の語', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => attackActive(rule, i))).toEqual([2, 5, 8]);
  });

  it('1 語ごとの設定なら、すべての語が予告', () => {
    expect([0, 1, 2].every((i) => attackActive({ everyWords: 1, windowMs: 1000 }, i))).toBe(true);
  });

  it('負の番号は予告ではない', () => {
    expect(attackActive({ everyWords: 1, windowMs: 1000 }, -1)).toBe(false);
  });

  it('予告の語の残り時間は、猶予から経過を引く（負にならない・経過が負でも猶予を超えない）', () => {
    expect(attackRemaining(rule, 2, 1500)).toBe(3500);
    expect(attackRemaining(rule, 2, 5000)).toBe(0);
    expect(attackRemaining(rule, 2, 9000)).toBe(0);
    expect(attackRemaining(rule, 2, -300)).toBe(5000);
  });

  it('予告の語でなければ残り時間は null', () => {
    expect(attackRemaining(rule, 1, 0)).toBeNull();
  });

  it('猶予ちょうどで当たる（境界）。1ms 手前は当たらない', () => {
    expect(attackLanded(rule, 2, 4999)).toBe(false);
    expect(attackLanded(rule, 2, 5000)).toBe(true);
  });

  it('予告の語でなければ、どれだけ経っても当たらない', () => {
    expect(attackLanded(rule, 3, 60_000)).toBe(false);
  });
});
