import type { ContentPack } from '@/content';
import type { Keystroke, SessionRecord } from '@/metrics';
import { compareWithBest, itemsForTargets } from './retry';

const packs: ContentPack[] = [
  { id: 'a', name: 'A', items: [{ display: '猫', reading: 'ねこ' }, { display: '犬', reading: 'いぬ' }] },
  { id: 'b', name: 'B', items: [{ display: 'ネコ科', reading: 'ねこ' }, { display: '鳥', reading: 'とり' }] },
];

describe('itemsForTargets', () => {
  it('読みから表記を復元する（同じ読みは先のパックを優先）', () => {
    expect(itemsForTargets(['とり', 'ねこ'], packs)).toEqual([
      { display: '鳥', reading: 'とり' },
      { display: '猫', reading: 'ねこ' },
    ]);
  });

  it('どのパックにも無ければ、読みをそのまま表記にする（パックが削除された場合など）', () => {
    expect(itemsForTargets(['うさぎ'], packs)).toEqual([{ display: 'うさぎ', reading: 'うさぎ' }]);
    expect(itemsForTargets([], packs)).toEqual([]);
  });

  it('並びと重複を保つ', () => {
    expect(itemsForTargets(['ねこ', 'ねこ'], packs).map((i) => i.display)).toEqual(['猫', '猫']);
  });
});

const ks = (t: number, item = 0): Keystroke => ({ t, key: 'a', code: '', expected: 'a', correct: true, item });
/** 間隔 step ミリ秒で 4 打鍵（3 区間）→ 速度 = 3 / (3*step) 分 */
const rec = (id: string, targets: string[], step: number): SessionRecord => ({
  id,
  startedAt: 0,
  mode: 'daily',
  contentId: 'a',
  targets,
  engineVersion: '1',
  ruleVersion: 'input-rules-v1',
  keystrokes: [ks(0), ks(step), ks(step * 2), ks(step * 3)],
});

describe('compareWithBest', () => {
  const t = ['ねこ'];

  it('過去最高（今回を除く、同じお題の最速）との差を返す', () => {
    const current = rec('now', t, 100); // 600 打鍵/分
    const r = compareWithBest([rec('slow', t, 200), rec('fast', t, 150), current, rec('other', ['いぬ'], 10)], current);
    expect(r?.best.id).toBe('fast'); // 400 打鍵/分
    expect(r?.bestKpm).toBeCloseTo(400);
    expect(r?.currentKpm).toBeCloseTo(600);
    expect(r?.diffKpm).toBeCloseTo(200);
  });

  it('今回が遅ければ差は負', () => {
    const current = rec('now', t, 300);
    expect(compareWithBest([rec('old', t, 100), current], current)?.diffKpm).toBeCloseTo(-400);
  });

  it('同じお題の過去の記録が無ければ null（自分自身は数えない）', () => {
    const current = rec('now', t, 100);
    expect(compareWithBest([current], current)).toBeNull();
    expect(compareWithBest([current, rec('x', ['いぬ'], 100)], current)).toBeNull();
    expect(compareWithBest([current, rec('y', ['ねこ', 'いぬ'], 100)], current)).toBeNull();
  });
});
