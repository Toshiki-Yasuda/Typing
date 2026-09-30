import type { Keystroke } from '@/metrics';
import {
  parseTrainMode,
  pickTechniqueItems,
  remainingMs,
  technique,
  trainMode,
  wordsCompleted,
  zetsuRank,
} from './training';

const ks = (item: number): Keystroke => ({ t: 0, key: 'a', code: 'KeyA', expected: 'a', correct: true, item });

describe('モード', () => {
  it('train:<型> の往復。知らない型・他のモードは null', () => {
    expect(trainMode('zetsu')).toBe('train:zetsu');
    expect(parseTrainMode('train:ren')).toBe('ren');
    expect(parseTrainMode('train:hatsu')).toBe('hatsu');
    expect(parseTrainMode('train:foo')).toBeNull();
    expect(parseTrainMode('stage:x')).toBeNull();
    expect(parseTrainMode('practice')).toBeNull();
  });
});

describe('zetsuRank', () => {
  it.each([
    [0, 'S'],
    [1, 'A'],
    [2, 'A'],
    [3, 'B'],
    [5, 'B'],
    [6, 'C'],
    [40, 'C'],
  ])('ミス %i 回 → %s', (misses, rank) => {
    expect(zetsuRank(misses)).toBe(rank);
  });
});

describe('remainingMs', () => {
  it('60 秒から、経過を引く。負にならない', () => {
    expect(remainingMs(1000, 1000)).toBe(60_000);
    expect(remainingMs(1000, 21_000)).toBe(40_000);
    expect(remainingMs(1000, 61_000)).toBe(0);
    expect(remainingMs(1000, 90_000)).toBe(0);
  });
  it('制限時間を渡せる', () => {
    expect(remainingMs(0, 3000, 10_000)).toBe(7000);
  });
});

describe('wordsCompleted', () => {
  it('最後に打ち始めたお題は数えない', () => {
    expect(wordsCompleted([])).toBe(0);
    expect(wordsCompleted([ks(0), ks(0)])).toBe(0);
    expect(wordsCompleted([ks(0), ks(1), ks(2), ks(2)])).toBe(2);
  });
});

describe('technique', () => {
  it('弱い順に上位 3 キー。名前は最も弱いキー', () => {
    const t = technique(new Map([['a', 1], ['k', 5], ['s', 3], ['t', 2], ['u', 0]]));
    expect(t).toEqual({ keys: ['k', 's', 't'], name: '『k』の型' });
  });
  it('弱さが同じなら、キーの順で安定', () => {
    expect(technique(new Map([['b', 2], ['a', 2]]))?.keys).toEqual(['a', 'b']);
  });
  it('弱点が無い・0 だけ・記号だけなら null', () => {
    expect(technique(new Map())).toBeNull();
    expect(technique(new Map([['a', 0]]))).toBeNull();
    expect(technique(new Map([[' ', 9]]))).toBeNull();
  });
});

describe('pickTechniqueItems', () => {
  const items = [{ reading: 'さし' }, { reading: 'かき' }, { reading: 'かけ' }, { reading: 'たち' }];
  // かき=k a k i, かけ=k a k e: k が 2 つ。さし=s a s i, たち=t a t i
  const weakness = new Map([['k', 4]]);
  const tech = { keys: ['k'], name: '『k』の型' };

  it('技のキーを多く含む順に選ぶ（k を含まない語は後回し）', () => {
    const picked = pickTechniqueItems(items, 2, tech, weakness, () => 0.5);
    expect(picked.map((i) => i.reading).sort()).toEqual(['かき', 'かけ']);
  });
  it('得点 0 の語は、足りないときの埋めに使う', () => {
    const picked = pickTechniqueItems(items, 4, tech, weakness, () => 0.5);
    expect(picked).toHaveLength(4);
    expect(picked.slice(0, 2).map((i) => i.reading).sort()).toEqual(['かき', 'かけ']);
  });
  it('同点は乱数で順が変わる', () => {
    const a = pickTechniqueItems(items, 1, tech, weakness, () => 0);
    const seq = [0.9, 0.5, 0.1, 0.5];
    let i = 0;
    const b = pickTechniqueItems(items, 1, tech, weakness, () => seq[i++ % 4] as number);
    expect(a[0]?.reading).toBe('かき');
    expect(b[0]?.reading).toBe('かけ');
  });
});
