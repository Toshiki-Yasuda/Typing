import {
  aggregate,
  currentStreak,
  dayKey,
  keyWeakness,
  mergeBigramStats,
  mergeKeyStats,
  summarizeSessions,
  withinDays,
} from './index';
import type { Keystroke, SessionRecord } from './index';

const JST = 9 * 60;
const ks = (t: number, expected: string, correct = true, item = 0): Keystroke => ({
  t,
  key: correct ? expected : '1',
  code: '',
  expected,
  correct,
  item,
});
const session = (id: string, startedAt: number, keystrokes: Keystroke[], targets = ['かき']): SessionRecord => ({
  id,
  startedAt,
  mode: 'practice',
  contentId: 'test',
  targets,
  engineVersion: '1',
  ruleVersion: 'input-rules-v1',
  keystrokes,
});

describe('summarizeSessions', () => {
  it('開始時刻の昇順で、各セッションの指標を返す', () => {
    const a = session('a', 2000, [ks(0, 'k'), ks(100, 'a'), ks(200, 'k'), ks(300, 'i')]);
    const b = session('b', 1000, [ks(0, 'k'), ks(100, 'a', false), ks(200, 'a'), ks(300, 'k'), ks(400, 'i')]);
    const out = summarizeSessions([a, b]);
    expect(out.map((s) => s.id)).toEqual(['b', 'a']);
    expect(out[1]).toMatchObject({ total: 4, misses: 0, accuracy: 1, efficiency: 1 });
    expect(out[0]).toMatchObject({ total: 5, misses: 1 });
    expect(out[0]?.accuracy).toBeCloseTo(4 / 5);
    expect(out[0]?.efficiency).toBeCloseTo(4 / 5);
  });
});

describe('日付・連続日数', () => {
  it('dayKey: 指定したオフセットの日付になる（JST の 0 時をまたぐ）', () => {
    const utc = Date.UTC(2026, 8, 28, 15, 30); // UTC 15:30 = JST 翌日 00:30
    expect(dayKey(utc, 0)).toBe('2026-09-28');
    expect(dayKey(utc, JST)).toBe('2026-09-29');
  });

  it('currentStreak: 今日までの連続日数', () => {
    expect(currentStreak(['2026-09-27', '2026-09-28', '2026-09-29'], '2026-09-29')).toBe(3);
  });

  it('今日まだ練習していなくても、昨日までの連続は途切れない', () => {
    expect(currentStreak(['2026-09-27', '2026-09-28'], '2026-09-29')).toBe(2);
  });

  it('一昨日以前で途切れていたら 0。途中の欠けで数え直す', () => {
    expect(currentStreak(['2026-09-26'], '2026-09-29')).toBe(0);
    expect(currentStreak(['2026-09-25', '2026-09-27', '2026-09-28'], '2026-09-28')).toBe(2);
    expect(currentStreak([], '2026-09-29')).toBe(0);
  });

  it('月・年をまたいでも数えられる', () => {
    expect(currentStreak(['2025-12-31', '2026-01-01', '2026-01-02'], '2026-01-02')).toBe(3);
    expect(currentStreak(['2026-02-28', '2026-03-01'], '2026-03-01')).toBe(2);
  });

  it('withinDays: 直近 n 日に絞る。null は全期間', () => {
    const now = Date.UTC(2026, 8, 29);
    const day = 86_400_000;
    const records = [session('old', now - 40 * day, []), session('mid', now - 10 * day, []), session('new', now - day, [])];
    expect(withinDays(records, 30, now).map((r) => r.id)).toEqual(['mid', 'new']);
    expect(withinDays(records, 7, now).map((r) => r.id)).toEqual(['new']);
    expect(withinDays(records, null, now)).toHaveLength(3);
  });
});

describe('集計（複数セッション）', () => {
  // A の最後の打鍵と B の最初の打鍵は、時刻が偶然つながって見える（A 終了 t=200、B 開始 t=250）
  const a = session('a', 1000, [ks(0, 'k'), ks(100, 'a'), ks(200, 'k')]);
  const b = session('b', 2000, [ks(250, 'a'), ks(350, 'k')]);

  it('mergeKeyStats: 試行・ミスを合算し、遅延は回数で重み付け平均', () => {
    const merged = mergeKeyStats([
      new Map([['k', { key: 'k', attempts: 4, misses: 1, meanLatencyMs: 100, latencyCount: 2 }]]),
      new Map([['k', { key: 'k', attempts: 6, misses: 2, meanLatencyMs: 200, latencyCount: 2 }]]),
      new Map([['a', { key: 'a', attempts: 1, misses: 0, meanLatencyMs: null, latencyCount: 0 }]]),
    ]);
    expect(merged.get('k')).toEqual({ key: 'k', attempts: 10, misses: 3, meanLatencyMs: 150, latencyCount: 4 });
    expect(merged.get('a')?.meanLatencyMs).toBeNull();
  });

  it('mergeBigramStats: 回数で重み付け平均', () => {
    const merged = mergeBigramStats([
      new Map([['ka', { bigram: 'ka', count: 1, meanLatencyMs: 100 }]]),
      new Map([['ka', { bigram: 'ka', count: 3, meanLatencyMs: 200 }]]),
    ]);
    expect(merged.get('ka')).toEqual({ bigram: 'ka', count: 4, meanLatencyMs: 175 });
  });

  it('aggregate: セッションの境界をまたぐ連接は数えない', () => {
    const { bigrams } = aggregate([a, b]);
    // A: k→a, a→k。B: a→k。境界の k→a（200→250）は偽物なので含めない
    expect(bigrams.get('ka')).toEqual({ bigram: 'ka', count: 1, meanLatencyMs: 100 });
    expect(bigrams.get('ak')).toEqual({ bigram: 'ak', count: 2, meanLatencyMs: 100 });
  });

  it('aggregate: 打ち間違いを回数順に集計する', () => {
    const wrong = session('w', 1, [ks(0, 'k', false), ks(500, 'k'), ks(600, 'a', false), ks(1500, 'a')]);
    const wrong2 = session('w2', 2, [ks(0, 'k', false), ks(500, 'k')]);
    const { confusions } = aggregate([wrong, wrong2]);
    expect(confusions[0]).toEqual({ expected: 'k', actual: '1', count: 2 });
    expect(confusions[1]).toEqual({ expected: 'a', actual: '1', count: 1 });
  });

  it('keyWeakness も、セッションの境界をまたぐ偽の遅延を混ぜない', () => {
    // 連結すると、A の最後(t=200)から B の最初(t=2900)が「k に 2700ms かかった」ように見えてしまう
    const sessionA = [ks(0, 'a'), ks(100, 'a'), ks(200, 'a')];
    const sessionB = [ks(2900, 'k')];
    const separate = keyWeakness([sessionA, sessionB]).get('k') as number;
    const concatenated = keyWeakness([[...sessionA, ...sessionB]]).get('k') as number;
    expect(separate).toBe(0);
    expect(concatenated).toBeGreaterThan(0);
  });
});
