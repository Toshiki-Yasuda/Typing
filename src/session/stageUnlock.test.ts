import { isOpen, unlockState, type UnlockChapter } from './stageUnlock';

const chapters: UnlockChapter[] = [
  { stages: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }], boss: 'bossA' },
  { stages: [{ id: 'b1' }, { id: 'b2' }], boss: 'bossB' },
  { stages: [{ id: 'c1' }] }, // ボスの無い章
];
const cleared = (...ids: string[]) => (id: string) => ids.includes(id);
const open = (mode: 'all' | 'sequential', ...ids: string[]) => unlockState(chapters, mode, cleared(...ids));

describe('unlockState', () => {
  it('all: すべて開いている（クリアが無くても）', () => {
    const s = open('all');
    expect([...s.stages.values()].every(Boolean)).toBe(true);
    expect([...s.bosses.values()].every(Boolean)).toBe(true);
    expect(s.stages.size).toBe(6);
    expect(s.bosses.size).toBe(2);
  });

  it('sequential: クリアが無ければ、最初のステージだけ開く。ボスは閉じている', () => {
    const s = open('sequential');
    expect([...s.stages]).toEqual([['a1', true], ['a2', false], ['a3', false], ['b1', false], ['b2', false], ['c1', false]]);
    expect(s.bosses.get('bossA')).toBe(false);
    expect(s.bosses.get('bossB')).toBe(false);
  });

  it('直前のステージのクリアで次が開く（1 つ飛ばしでは開かない）', () => {
    expect(open('sequential', 'a1').stages.get('a2')).toBe(true);
    expect(open('sequential', 'a1').stages.get('a3')).toBe(false);
    expect(open('sequential', 'a2').stages.get('a3')).toBe(true); // a1 が未クリアでも、a2 のクリア記録があれば a3 は開く（記録から毎回計算）
    expect(open('sequential', 'a2').stages.get('a2')).toBe(false); // a1 が未クリアなので a2 自体は閉じている
  });

  it('章をまたぐ: 前の章の最後のステージのクリアで、次の章の最初が開く', () => {
    expect(open('sequential', 'a1', 'a2').stages.get('b1')).toBe(false);
    expect(open('sequential', 'a1', 'a2', 'a3').stages.get('b1')).toBe(true);
    expect(open('sequential', 'a1', 'a2', 'a3').stages.get('b2')).toBe(false);
  });

  it('章のボスは、その章のステージがすべてクリア済みで開く。ボスは次の章の解放に関係しない', () => {
    expect(open('sequential', 'a1', 'a2').bosses.get('bossA')).toBe(false);
    const s = open('sequential', 'a1', 'a2', 'a3');
    expect(s.bosses.get('bossA')).toBe(true);
    expect(s.bosses.get('bossB')).toBe(false);
    expect(s.stages.get('b1')).toBe(true);
  });

  it('ボスの無い章は、ボスの項目を作らない', () => {
    expect(open('sequential').bosses.has('undefined')).toBe(false);
    expect([...open('sequential').bosses.keys()]).toEqual(['bossA', 'bossB']);
  });
});

describe('isOpen', () => {
  it('知らない id は開いている扱い', () => {
    const s = open('sequential');
    expect(isOpen(s, 'stage', 'a2')).toBe(false);
    expect(isOpen(s, 'stage', 'a1')).toBe(true);
    expect(isOpen(s, 'boss', 'bossA')).toBe(false);
    expect(isOpen(s, 'stage', 'zzz')).toBe(true);
    expect(isOpen(s, 'boss', 'zzz')).toBe(true);
  });
});
