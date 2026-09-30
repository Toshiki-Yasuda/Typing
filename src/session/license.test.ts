import type { Keystroke, SessionRecord } from '@/metrics';
import { RANKS } from '@/metrics';
import { bossWins, normalizeHunterName, HUNTER_NAME_MAX, stagesCleared, starsOf } from './license';

describe('starsOf', () => {
  it('級位が無ければ 0。20 段階を 4 つずつ束ねて 1〜5', () => {
    expect(starsOf(null)).toBe(0);
    const at = (i: number) => starsOf(RANKS[i] ?? null);
    expect([0, 3].map(at)).toEqual([1, 1]);
    expect([4, 7].map(at)).toEqual([2, 2]);
    expect([8, 11].map(at)).toEqual([3, 3]);
    expect([12, 15].map(at)).toEqual([4, 4]);
    expect([16, 19].map(at)).toEqual([5, 5]);
    expect(RANKS).toHaveLength(20);
  });
  it('一覧に無い級位は 0', () => {
    expect(starsOf({ id: 'zz', label: 'x', minKpm: 0 })).toBe(0);
  });
});

describe('bossWins', () => {
  const p = { a: { attempts: 3, wins: 1, best: 'B' as const }, b: { attempts: 2, wins: 0, best: null }, z: { attempts: 1, wins: 1, best: 'S' as const } };
  it('勝ったボスだけを、指定の id の中で数える', () => {
    expect(bossWins(p, ['a', 'b', 'c'])).toBe(1);
    expect(bossWins(p, ['a', 'z'])).toBe(2);
    expect(bossWins({}, ['a'])).toBe(0);
  });
});

describe('stagesCleared', () => {
  const ks = (correct: boolean): Keystroke => ({ t: 1, key: 'a', code: 'KeyA', expected: 'a', correct, item: 0 });
  const rec = (mode: string, correct: number, wrong: number): SessionRecord => ({
    id: mode + correct, startedAt: 1, mode, contentId: 'c', targets: ['a'], engineVersion: '1', ruleVersion: '1',
    keystrokes: [...Array(correct).fill(0).map(() => ks(true)), ...Array(wrong).fill(0).map(() => ks(false))],
  });
  it('正確率 90% 以上の記録があるステージだけ数える', () => {
    const rs = [rec('stage:s1', 10, 0), rec('stage:s2', 8, 2), rec('practice', 10, 0)];
    expect(stagesCleared(rs, ['s1', 's2', 's3'])).toBe(1);
  });
});

describe('normalizeHunterName', () => {
  it('前後の空白を除き、12 文字で切る（文字単位。サロゲートペアを割らない）', () => {
    expect(normalizeHunterName('  ゴン  ')).toBe('ゴン');
    expect(normalizeHunterName('あ'.repeat(20))).toBe('あ'.repeat(HUNTER_NAME_MAX));
    expect(normalizeHunterName('😀'.repeat(13))).toBe('😀'.repeat(12));
    expect(normalizeHunterName('')).toBe('');
  });
});
