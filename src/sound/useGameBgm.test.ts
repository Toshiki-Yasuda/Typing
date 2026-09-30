import { HUNTER_THEME, NEUTRAL_THEME } from '@/themes/themes';
import { gameBgmScale, gameBgmUrl, PHASE_SCALE, PRACTICE_SCALE } from './useGameBgm';

const GAME = HUNTER_THEME.audio?.game;

describe('gameBgmUrl（練習中に流す曲）', () => {
  const table: [string, 'off' | 'boss' | 'all', boolean, boolean, string | null][] = [
    ['BGM オン・ボス戦のみ・ボス戦', 'boss', true, true, GAME as string],
    ['BGM オン・ボス戦のみ・通常の練習', 'boss', false, true, null],
    ['BGM オン・すべて・通常の練習', 'all', false, true, GAME as string],
    ['BGM オン・すべて・ボス戦', 'all', true, true, GAME as string],
    ['BGM オン・鳴らさない・ボス戦', 'off', true, true, null],
    ['BGM オフ・すべて・ボス戦', 'all', true, false, null],
  ];
  it.each(table)('%s', (_name, gameBgm, isBoss, bgm, expected) => {
    expect(gameBgmUrl(HUNTER_THEME, { bgm, gameBgm }, isBoss)).toBe(expected);
  });

  it('テーマに曲が無ければ、設定に関わらず鳴らさない', () => {
    expect(gameBgmUrl(NEUTRAL_THEME, { bgm: true, gameBgm: 'all' }, true)).toBeNull();
  });
});

describe('gameBgmScale（音量の倍率）', () => {
  it('通常の練習は一定で小さい。ボス戦はフェーズが上がるほど大きい', () => {
    expect(gameBgmScale(false, null)).toBe(PRACTICE_SCALE);
    expect(gameBgmScale(false, 4)).toBe(PRACTICE_SCALE);
    expect(gameBgmScale(true, null)).toBe(PRACTICE_SCALE);
    expect([1, 2, 3, 4].map((p) => gameBgmScale(true, p))).toEqual([...PHASE_SCALE]);
    for (let i = 1; i < PHASE_SCALE.length; i++) expect(PHASE_SCALE[i]).toBeGreaterThan(PHASE_SCALE[i - 1] as number);
  });

  it('範囲外のフェーズは端に丸める。いつも 1 未満（打鍵を邪魔しない）', () => {
    expect(gameBgmScale(true, 0)).toBe(PHASE_SCALE[0]);
    expect(gameBgmScale(true, 9)).toBe(PHASE_SCALE.at(-1));
    expect(Math.max(...PHASE_SCALE)).toBeLessThan(1);
  });
});
