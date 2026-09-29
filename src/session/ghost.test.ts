import type { Keystroke, SessionRecord } from '@/metrics';
import { aheadMs, createGhost, findBestRecord, userPosition } from './ghost';

const ks = (t: number, item: number, correct = true): Keystroke => ({
  t,
  key: 'a',
  code: '',
  expected: 'a',
  correct,
  item,
});
const record = (id: string, targets: string[], keystrokes: Keystroke[]): SessionRecord => ({
  id,
  startedAt: 0,
  mode: 'daily',
  contentId: 'basic',
  targets,
  engineVersion: '1',
  ruleVersion: 'input-rules-v1',
  keystrokes,
});

// お題0: 正打 t=100,200（k=2）／お題1: 正打 t=500,600,700（k=3）と、650 のミス（数えない）
const base = record('g', ['あい', 'うえお'], [ks(100, 0), ks(200, 0), ks(500, 1), ks(600, 1), ks(650, 1, false), ks(700, 1)]);

describe('createGhost', () => {
  const ghost = createGhost(base);

  it('位置は、お題ごとに正打鍵の割合で按分する', () => {
    expect(ghost.positionAt(0)).toBe(0);
    expect(ghost.positionAt(100)).toBeCloseTo(0.5);
    expect(ghost.positionAt(200)).toBeCloseTo(1);
    expect(ghost.positionAt(450)).toBeCloseTo(1); // お題の間の待ち
    expect(ghost.positionAt(500)).toBeCloseTo(1 + 1 / 3);
    expect(ghost.positionAt(650)).toBeCloseTo(1 + 2 / 3); // ミスでは進まない
    expect(ghost.positionAt(700)).toBeCloseTo(2);
    expect(ghost.positionAt(99999)).toBeCloseTo(2);
  });

  it('到達時刻: その位置に初めて届いた時刻', () => {
    expect(ghost.timeToReach(0)).toBe(0);
    expect(ghost.timeToReach(-1)).toBe(0);
    expect(ghost.timeToReach(0.5)).toBe(100);
    expect(ghost.timeToReach(1)).toBe(200);
    expect(ghost.timeToReach(1.2)).toBe(500);
    expect(ghost.timeToReach(2)).toBe(700); // 1/3 を3回足しても届く（浮動小数の誤差を許す）
    expect(ghost.timeToReach(2.1)).toBeNull();
  });

  it('お題数・終了時刻', () => {
    expect(ghost.totalItems).toBe(2);
    expect(ghost.finishedAtMs).toBe(700);
  });

  it('正打が無い記録は、位置が動かず到達しない', () => {
    const empty = createGhost(record('e', ['あ'], [ks(10, 0, false)]));
    expect(empty.positionAt(1000)).toBe(0);
    expect(empty.timeToReach(0.1)).toBeNull();
    expect(empty.finishedAtMs).toBe(0);
  });

  it('ログの時刻が前後していても、時刻順に再生する', () => {
    const shuffled = createGhost(record('s', ['あい'], [ks(200, 0), ks(100, 0)]));
    expect(shuffled.positionAt(150)).toBeCloseTo(0.5);
    expect(shuffled.timeToReach(1)).toBe(200);
  });
});

describe('userPosition', () => {
  it('お題の番号 + お題の中の進み具合（打鍵済み / 全体）', () => {
    expect(userPosition({ index: 1, finished: false, total: 3, guide: { typed: 'ka', remaining: 2 } })).toBeCloseTo(1.5);
    expect(userPosition({ index: 0, finished: false, total: 3, guide: { typed: '', remaining: 4 } })).toBe(0);
    expect(userPosition({ index: 2, finished: false, total: 3, guide: { typed: 'abc', remaining: 1 } })).toBeCloseTo(2.75);
  });

  it('終了なら全お題分。分母が 0 でも NaN にならない', () => {
    expect(userPosition({ index: 2, finished: true, total: 3, guide: { typed: '', remaining: 0 } })).toBe(3);
    expect(userPosition({ index: 1, finished: false, total: 3, guide: { typed: '', remaining: 0 } })).toBe(1);
  });
});

describe('aheadMs（ゴーストとの差）', () => {
  const ghost = createGhost(base);

  it('正ならゴーストより先行、負なら遅れ', () => {
    expect(aheadMs(ghost, 1, 150)).toBe(50); // ゴーストは 200 で着く。自分は 150 で着いた
    expect(aheadMs(ghost, 1, 260)).toBe(-60);
    expect(aheadMs(ghost, 1, 200)).toBe(0);
  });

  it('ゴーストが到達しない位置なら null', () => {
    expect(aheadMs(ghost, 2.5, 100)).toBeNull();
  });
});

describe('findBestRecord', () => {
  const fast = record('fast', ['あい', 'うえお'], [ks(0, 0), ks(100, 0), ks(200, 1), ks(300, 1)]);
  const slow = record('slow', ['あい', 'うえお'], [ks(0, 0), ks(500, 0), ks(1000, 1), ks(1500, 1)]);
  const other = record('other', ['あい', 'かき'], [ks(0, 0), ks(10, 0), ks(20, 1), ks(30, 1)]);
  const reversed = record('rev', ['うえお', 'あい'], [ks(0, 0), ks(10, 0), ks(20, 1), ks(30, 1)]);

  it('お題の並びが完全に一致する記録のうち、最速を返す', () => {
    expect(findBestRecord([slow, other, fast, reversed], ['あい', 'うえお'])?.id).toBe('fast');
  });

  it('並びが違う・長さが違う記録は対象外。無ければ null', () => {
    expect(findBestRecord([other, reversed], ['あい', 'うえお'])).toBeNull();
    expect(findBestRecord([fast], ['あい'])).toBeNull();
    expect(findBestRecord([], ['あい'])).toBeNull();
  });

  it('速度が計算できない（打鍵間隔が無い）記録は対象外', () => {
    const single = record('one', ['あ'], [ks(0, 0)]);
    expect(findBestRecord([single], ['あ'])).toBeNull();
  });
});
