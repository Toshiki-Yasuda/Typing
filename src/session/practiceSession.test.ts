import { PracticeSession, pickItems, type PressEvent } from './practiceSession';

const meta = { id: 's1', startedAt: 1_700_000_000_000, mode: 'practice', contentId: 'basic' };
const items = [
  { display: '柿', reading: 'かき' },
  { display: '海', reading: 'うみ' },
];

/** keys を 100ms 間隔で打つ（開始は performance 時刻 1000） */
function play(session: PracticeSession, keys: string, from = 1000, step = 100): PressEvent[] {
  return [...keys].map((key, i) => session.press({ key, code: '' }, from + step * (i + 1)));
}

describe('PracticeSession', () => {
  it('お題を順に打ち、最後で sessionDone', () => {
    const s = new PracticeSession(items, 1000, meta);
    expect(play(s, 'kaki')).toEqual(['ok', 'ok', 'ok', 'wordDone']);
    expect(s.view()).toMatchObject({ index: 1, total: 2, finished: false });
    expect(s.view().item.display).toBe('海');
    expect(play(s, 'umi', 1400)).toEqual(['ok', 'ok', 'sessionDone']);
    expect(s.view()).toMatchObject({ finished: true, index: 1 });
  });

  it('終了後の打鍵は ignored でログに残らない', () => {
    const s = new PracticeSession(items, 0, meta);
    play(s, 'kakiumi');
    const n = s.keystrokes.length;
    expect(s.press({ key: 'a', code: '' }, 9999)).toBe('ignored');
    expect(s.keystrokes).toHaveLength(n);
  });

  it('誤打鍵は miss。ログには期待キーと共に残り、進行は変わらない', () => {
    const s = new PracticeSession(items, 0, meta);
    expect(s.press({ key: 'x', code: 'KeyX' }, 50)).toBe('miss');
    expect(s.keystrokes[0]).toEqual({ t: 50, key: 'x', code: 'KeyX', expected: 'k', correct: false, item: 0 });
    expect(s.view().guide.rest).toBe('kaki'); // 誤打鍵では状態が変わらない
  });

  it('1文字でないキーは ignored（ログに残さない）', () => {
    const s = new PracticeSession(items, 0, meta);
    expect(s.press({ key: 'Shift', code: 'ShiftLeft' }, 10)).toBe('ignored');
    expect(s.keystrokes).toHaveLength(0);
  });

  it('打鍵の時刻は開始からの相対ミリ秒、お題番号が付く', () => {
    const s = new PracticeSession(items, 1000, meta);
    play(s, 'kakiumi');
    expect(s.keystrokes.map((k) => k.t)).toEqual([100, 200, 300, 400, 500, 600, 700]);
    expect(s.keystrokes.map((k) => k.item)).toEqual([0, 0, 0, 0, 1, 1, 1]);
  });

  it('指標: 全お題の最小打鍵数に対する効率が出る', () => {
    const s = new PracticeSession(items, 0, meta);
    play(s, 'kakiumi', 0, 100);
    expect(s.minKeystrokesTotal).toBe(7);
    expect(s.metrics()).toMatchObject({ total: 7, correct: 7, accuracy: 1, efficiency: 1, elapsedMs: 600 });
  });

  it('保存用レコードを作れる（読みは正規化済み、版を記録）', () => {
    const s = new PracticeSession(items, 0, meta);
    play(s, 'kaki', 0);
    expect(s.toRecord()).toMatchObject({
      ...meta,
      targets: ['かき', 'うみ'],
      engineVersion: '1',
      ruleVersion: 'input-rules-v1',
    });
    expect(s.toRecord().keystrokes).toHaveLength(4);
  });

  it('位置: お題の番号 + お題の中の進み具合。経過時間は開始からの差', () => {
    const s = new PracticeSession(items, 1000, meta);
    expect(s.position()).toBe(0);
    play(s, 'k'); // かき = kaki の 1/4
    expect(s.position()).toBeCloseTo(0.25);
    play(s, 'aki', 1100);
    expect(s.position()).toBe(1); // 1つ目を打ち終えた
    play(s, 'u', 1400); // うみ = umi の 1/3
    expect(s.position()).toBeCloseTo(1 + 1 / 3);
    play(s, 'mi', 1500);
    expect(s.position()).toBe(2);
    expect(s.elapsedMs(1750)).toBe(750);
  });

  it('お題が空ならエラー', () => {
    expect(() => new PracticeSession([], 0, meta)).toThrow(/お題がありません/);
  });
});

describe('pickItems', () => {
  it('重複なく n 個選ぶ', () => {
    const picked = pickItems([1, 2, 3, 4, 5, 6, 7, 8], 5);
    expect(picked).toHaveLength(5);
    expect(new Set(picked).size).toBe(5);
  });

  it('n が多ければ全件', () => {
    expect(pickItems([1, 2, 3], 10).sort()).toEqual([1, 2, 3]);
  });

  it('乱数を差し替えられる（決定的）', () => {
    expect(pickItems([1, 2, 3, 4], 4, () => 0)).toEqual([2, 3, 4, 1]);
  });

  it('元の配列を変更しない', () => {
    const src = [1, 2, 3];
    pickItems(src, 2);
    expect(src).toEqual([1, 2, 3]);
  });
});
