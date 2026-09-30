import type { Keystroke, SessionRecord } from '@/metrics';
import { hasVows, medalOf, parseVows, plainRecords, vowBroken, vowEffects } from './vows';

const ks = (correct: boolean): Keystroke => ({ t: 100, key: 'a', code: 'KeyA', expected: 'a', correct, item: 0 });
/** accuracy = correct / total */
const rec = (mode: string, vows: string[] | undefined, correct: number, wrong: number, id = 'r'): SessionRecord => ({
  id, startedAt: 1, mode, contentId: 'c', targets: ['a'], engineVersion: '1', ruleVersion: '1',
  keystrokes: [...Array(correct).fill(0).map(() => ks(true)), ...Array(wrong).fill(0).map(() => ks(false))],
  ...(vows ? { vows } : {}),
});

describe('parseVows', () => {
  it('正しい縛りだけを、重複なく正規の順で', () => {
    expect(parseVows(['silent', 'noMiss', 'silent', 'x', 3])).toEqual(['noMiss', 'silent']);
    expect(parseVows('noMiss')).toEqual([]);
    expect(parseVows(undefined)).toEqual([]);
  });
});

describe('vowEffects', () => {
  it('縛り無しは、すべて通常', () => {
    expect(vowEffects([])).toEqual({ showRomaji: true, fingerGuide: true, sound: true, maxMisses: null });
  });
  it('縛りごとに 1 つだけ変わる', () => {
    expect(vowEffects(['noRomaji'])).toMatchObject({ showRomaji: false, fingerGuide: true, sound: true, maxMisses: null });
    expect(vowEffects(['noFinger'])).toMatchObject({ showRomaji: true, fingerGuide: false, sound: true, maxMisses: null });
    expect(vowEffects(['silent'])).toMatchObject({ showRomaji: true, fingerGuide: true, sound: false, maxMisses: null });
    expect(vowEffects(['noMiss'])).toMatchObject({ showRomaji: true, fingerGuide: true, sound: true, maxMisses: 0 });
  });
});

describe('medalOf', () => {
  it.each([[0, 'none'], [1, 'bronze'], [2, 'silver'], [3, 'gold'], [4, 'gold']] as const)('縛り %i つ → %s', (n, m) => {
    expect(medalOf(n)).toBe(m);
  });
});

describe('plainRecords / hasVows', () => {
  it('縛り付きを除く。空配列の vows は縛りなしとみなす', () => {
    const a = rec('practice', undefined, 5, 0, 'a');
    const b = rec('stage:x', ['silent'], 5, 0, 'b');
    const c = rec('stage:x', [], 5, 0, 'c');
    expect(plainRecords([a, b, c]).map((r) => r.id)).toEqual(['a', 'c']);
    expect(hasVows(b)).toBe(true);
    expect(hasVows(c)).toBe(false);
  });
});

describe('vowBroken', () => {
  it('「ミスなし」の記録にミスがあれば破れ。他の縛り・ミスなしの記録は破れではない', () => {
    expect(vowBroken(rec('s', ['noMiss'], 5, 1))).toBe(true);
    expect(vowBroken(rec('s', ['noMiss'], 5, 0))).toBe(false);
    expect(vowBroken(rec('s', ['silent'], 5, 1))).toBe(false);
    expect(vowBroken(rec('s', undefined, 5, 1))).toBe(false);
  });
});
