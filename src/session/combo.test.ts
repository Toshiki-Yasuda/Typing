import { ComboTracker, levelAt, type ComboLevel } from './combo';
import type { PressEvent } from './practiceSession';

const levels: ComboLevel[] = [
  { at: 0, name: '念' },
  { at: 5, name: '纏' },
  { at: 10, name: '絶' },
  { at: 20, name: '練' },
];

describe('levelAt', () => {
  it('境界ちょうどで次の段階に入る。次までの進みと残りが分かる', () => {
    expect(levelAt(levels, 0)).toMatchObject({ index: 0, progress: 0, remaining: 5 });
    expect(levelAt(levels, 4)).toMatchObject({ index: 0, progress: 0.8, remaining: 1 });
    expect(levelAt(levels, 5)).toMatchObject({ index: 1, progress: 0, remaining: 5 });
    expect(levelAt(levels, 9).level.name).toBe('纏');
    expect(levelAt(levels, 10).level.name).toBe('絶');
    expect(levelAt(levels, 15)).toMatchObject({ index: 2, progress: 0.5, remaining: 5 });
  });

  it('最後の段階では、進みは満タンで残りは 0。どれだけ増えても変わらない', () => {
    expect(levelAt(levels, 20)).toMatchObject({ index: 3, progress: 1, remaining: 0, next: null });
    expect(levelAt(levels, 999)).toMatchObject({ index: 3, progress: 1, remaining: 0 });
  });

  it('段階が 1 つだけでも動く', () => {
    expect(levelAt([{ at: 0, name: 'a' }], 50)).toMatchObject({ index: 0, progress: 1 });
  });
});

describe('ComboTracker', () => {
  const run = (events: PressEvent[]) => {
    const t = new ComboTracker(levels);
    const entered = events.map((e) => t.apply(e).entered?.name ?? null);
    return { t, entered };
  };

  it('正打で増え、ミスで 0 に戻る。最大は残る', () => {
    const { t } = run(['ok', 'ok', 'ok', 'miss', 'ok']);
    expect(t.combo).toBe(1);
    expect(t.max).toBe(3);
  });

  it('お題の終わり（wordDone）・全体の終わり（sessionDone）も正打として数える', () => {
    expect(run(['ok', 'wordDone', 'sessionDone']).t.combo).toBe(3);
  });

  it('段階に入った瞬間だけ知らせる（境界をまたいだ 1 回）', () => {
    const { entered } = run(Array(10).fill('ok') as PressEvent[]);
    expect(entered).toEqual([null, null, null, null, '纏', null, null, null, null, '絶']);
  });

  it('ミスで戻ってから同じ境界にまた達したら、もう一度知らせる', () => {
    const events: PressEvent[] = [...(Array(5).fill('ok') as PressEvent[]), 'miss', ...(Array(5).fill('ok') as PressEvent[])];
    const { entered } = run(events);
    expect(entered.filter((n) => n === '纏')).toHaveLength(2);
  });

  it('ignored は何も変えない', () => {
    const { t } = run(['ok', 'ignored', 'ok']);
    expect(t.combo).toBe(2);
  });
});
