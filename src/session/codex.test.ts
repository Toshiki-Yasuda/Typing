import type { Keystroke, SessionRecord } from '@/metrics';
import { accuracyOf, codexStage, progressOf, summarizeCodex, wordProgress } from './codex';

const ks = (item: number, correct: boolean, expected: string | null = 'a'): Keystroke => ({ t: 1, key: 'a', code: 'KeyA', expected, correct, item });
const rec = (targets: string[], keystrokes: Keystroke[], id = 'r'): SessionRecord => ({
  id, startedAt: 1, mode: 'practice', contentId: 'c', targets, engineVersion: '1', ruleVersion: '1', keystrokes,
});

describe('wordProgress', () => {
  it('語ごとに、打ち始めた回数・打鍵数・ミスを数える', () => {
    const p = wordProgress([rec(['ごん', 'じん'], [ks(0, true), ks(0, false), ks(0, true), ks(1, true)])]);
    expect(p.get('ごん')).toEqual({ typed: 1, attempts: 3, misses: 1 });
    expect(p.get('じん')).toEqual({ typed: 1, attempts: 1, misses: 0 });
  });

  it('記録をまたいで、出現の回数が積み上がる。同じ記録の同じ語の打鍵は 1 回と数える', () => {
    const p = wordProgress([rec(['ごん'], [ks(0, true), ks(0, true)], 'a'), rec(['ごん'], [ks(0, true)], 'b')]);
    expect(p.get('ごん')?.typed).toBe(2);
  });

  it('同じ読みが 1 つの記録に 2 回出れば、2 回と数える', () => {
    const p = wordProgress([rec(['ごん', 'ごん'], [ks(0, true), ks(1, true)])]);
    expect(p.get('ごん')?.typed).toBe(2);
  });

  it('打鍵の無いお題（打ち始めていない）は数えない。範囲外の item は無視', () => {
    const p = wordProgress([rec(['ごん', 'じん'], [ks(0, true), ks(5, true)])]);
    expect(p.has('じん')).toBe(false);
    expect(p.size).toBe(1);
  });

  it('期待キーの無い打鍵は、打鍵数に入れない', () => {
    expect(wordProgress([rec(['ごん'], [ks(0, false, null), ks(0, true)])]).get('ごん')).toEqual({ typed: 1, attempts: 1, misses: 0 });
  });
});

describe('codexStage', () => {
  const p = (typed: number, attempts: number, misses: number) => ({ typed, attempts, misses });
  it('未遭遇 / 遭遇 / 習熟', () => {
    expect(codexStage(p(0, 0, 0))).toBe('unseen');
    expect(codexStage(p(1, 4, 0))).toBe('seen');
    expect(codexStage(p(2, 20, 0))).toBe('seen'); // 回数が足りない
    expect(codexStage(p(3, 20, 0))).toBe('mastered');
  });
  it('習熟の正確率は 95% 以上（境界）', () => {
    expect(codexStage(p(3, 20, 1))).toBe('mastered'); // 95%
    expect(codexStage(p(3, 20, 2))).toBe('seen'); // 90%
  });
  it('accuracyOf: 打鍵が無ければ null', () => {
    expect(accuracyOf(p(0, 0, 0))).toBeNull();
    expect(accuracyOf(p(1, 4, 1))).toBe(0.75);
  });
});

describe('summarizeCodex / progressOf', () => {
  it('遭遇と習熟の数を数える。記録に無い語は未遭遇', () => {
    const all = new Map([
      ['a', { typed: 5, attempts: 30, misses: 0 }],
      ['b', { typed: 1, attempts: 3, misses: 0 }],
    ]);
    expect(summarizeCodex(['a', 'b', 'c'], all)).toEqual({ total: 3, seen: 2, mastered: 1 });
    expect(progressOf(all, 'c')).toEqual({ typed: 0, attempts: 0, misses: 0 });
  });
});
