import { BURST_MS, initialPhase, nextPhase, type OpeningEvent, type OpeningPhase } from './opening';
import type { EffectLevel } from '@/effects/level';

describe('initialPhase', () => {
  it('演出オフなら、ゲートを出さずタイトル。それ以外はゲートから', () => {
    expect(initialPhase('off')).toBe('title');
    expect(initialPhase('full')).toBe('gate');
    expect(initialPhase('reduced')).toBe('gate');
  });
});

describe('nextPhase', () => {
  const table: [OpeningPhase, OpeningEvent, EffectLevel, OpeningPhase][] = [
    ['gate', 'start', 'full', 'burst'],
    ['gate', 'start', 'reduced', 'title'], // 動くオープニングは飛ばす
    ['gate', 'skip', 'full', 'title'],
    ['gate', 'elapsed', 'full', 'gate'], // ゲートは、操作があるまで進まない
    ['burst', 'skip', 'full', 'title'],
    ['burst', 'elapsed', 'full', 'title'],
    ['burst', 'start', 'full', 'burst'], // 二重の開始は無視
    ['title', 'start', 'full', 'title'],
    ['title', 'skip', 'full', 'title'],
    ['title', 'elapsed', 'full', 'title'],
  ];
  it.each(table)('%s + %s（%s） → %s', (phase, event, level, expected) => {
    expect(nextPhase(phase, event, level)).toBe(expected);
  });

  it('オープニングは数秒（飛ばせるので長すぎない）', () => {
    expect(BURST_MS).toBeGreaterThan(1500);
    expect(BURST_MS).toBeLessThan(4000);
  });
});
