import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GOAL_AUTO,
  RANKS,
  RANK_CERTIFY_COUNT,
  RANK_MIN_ACCURACY,
  RANK_MIN_KEYSTROKES,
  RANK_WINDOW,
  countsForRank,
  goalProgress,
  nextRank,
  rankById,
  rankFor,
  rankStatus,
  type SessionSample,
} from './rank';

const s = (kpm: number, accuracy = 0.98, total = 100): SessionSample => ({ kpm, accuracy, total });

describe('級位の段階', () => {
  it('低い順に並び、速度の下限は単調に増える。id は重複しない', () => {
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i]!.minKpm).toBeGreaterThan(RANKS[i - 1]!.minKpm);
    expect(new Set(RANKS.map((r) => r.id)).size).toBe(RANKS.length);
    expect(RANKS[0]?.minKpm).toBe(0);
  });

  it('10級から十段まで。ラベルの並び', () => {
    expect(RANKS.map((r) => r.label)).toEqual([
      '10級', '9級', '8級', '7級', '6級', '5級', '4級', '3級', '2級', '1級',
      '初段', '二段', '三段', '四段', '五段', '六段', '七段', '八段', '九段', '十段',
    ]);
  });

  it('rankFor: 境界の値は上の級位に入る', () => {
    expect(rankFor(0).label).toBe('10級');
    expect(rankFor(39.9).label).toBe('10級');
    expect(rankFor(40).label).toBe('9級');
    expect(rankFor(159).label).toBe('6級');
    expect(rankFor(160).label).toBe('5級');
    expect(rankFor(280).label).toBe('1級');
    expect(rankFor(310).label).toBe('初段');
    expect(rankFor(9999).label).toBe('十段');
    expect(rankFor(-5).label).toBe('10級');
  });

  it('nextRank / rankById', () => {
    expect(nextRank(rankFor(160))?.label).toBe('4級');
    expect(nextRank(rankFor(280))?.label).toBe('初段');
    expect(nextRank(rankFor(600))).toBeNull(); // 十段の次は無い
    expect(rankById('d1')?.label).toBe('初段');
    expect(rankById('nothing')).toBeUndefined();
  });
});

describe('countsForRank（級位の判定に数える練習）', () => {
  it('正確率が基準未満・打鍵が少なすぎる・速度が 0 は数えない', () => {
    expect(countsForRank(s(200))).toBe(true);
    expect(countsForRank(s(200, RANK_MIN_ACCURACY))).toBe(true); // ちょうど基準は数える
    expect(countsForRank(s(200, RANK_MIN_ACCURACY - 0.001))).toBe(false);
    expect(countsForRank(s(200, 0.99, 19))).toBe(false);
    expect(countsForRank(s(200, 0.99, 20))).toBe(true);
    expect(countsForRank(s(0))).toBe(false);
  });
});

describe('rankStatus（現在の級位）', () => {
  it('数える練習が無ければ級位なし（暫定）。次は最下位の級', () => {
    const st = rankStatus([]);
    expect(st).toMatchObject({ rank: null, basisKpm: null, count: 0, provisional: true });
    expect(st.next?.label).toBe('10級');
    expect(rankStatus([s(300, 0.9)]).rank).toBeNull(); // 正確率が足りない
  });

  it('直近の数える練習の中央値で決める（外れ値に引っ張られない）', () => {
    const st = rankStatus([s(150), s(160), s(500), s(155), s(158)]);
    expect(st.basisKpm).toBe(158); // 中央値
    expect(st.rank?.label).toBe('6級');
    expect(st.count).toBe(5);
    expect(st.provisional).toBe(false);
  });

  it('偶数回は中央の2つの平均', () => {
    expect(rankStatus([s(100), s(200), s(120), s(180)]).basisKpm).toBe(150); // 100,120,180,200 → (120+180)/2
  });

  it('見るのは直近 RANK_WINDOW 回だけ。数えない練習は飛ばして数える', () => {
    const old = Array.from({ length: 10 }, () => s(50));
    const recent = [s(200), s(210, 0.8), s(220), s(230), s(240), s(250)]; // 2つ目は数えない
    const st = rankStatus([...old, ...recent]);
    expect(RANK_WINDOW).toBe(5);
    expect(st.count).toBe(5);
    expect(st.basisKpm).toBe(230); // 200,220,230,240,250 の中央値
  });

  it('回数が3回未満は暫定', () => {
    expect(rankStatus([s(100), s(110)])).toMatchObject({ provisional: true, count: 2 });
    expect(rankStatus([s(100), s(110), s(120)]).provisional).toBe(false);
  });

  it('次の級位までの差。最上位は null', () => {
    const st = rankStatus([s(170), s(170), s(170)]); // 5級（160〜）、次は4級（190）
    expect(st.rank?.label).toBe('5級');
    expect(st.next?.label).toBe('4級');
    expect(st.toNextKpm).toBe(20);
    const top = rankStatus([s(700), s(700), s(700)]);
    expect(top.rank?.label).toBe('十段');
    expect(top).toMatchObject({ next: null, toNextKpm: null });
  });
});

describe('goalProgress（目標）', () => {
  const status = rankStatus([s(170), s(170), s(170)]); // 5級・次は4級（190）

  it('auto: 次の級位が目標。あと何打鍵/分か', () => {
    const g = goalProgress(status, GOAL_AUTO);
    expect(g?.goal.label).toBe('4級');
    expect(g).toMatchObject({ achieved: false, remainingKpm: 20 });
  });

  it('自分で決めた目標。達成済みなら残りは 0', () => {
    expect(goalProgress(status, 'k2')).toMatchObject({ achieved: false, remainingKpm: 80 });
    expect(goalProgress(status, 'k6')).toMatchObject({ achieved: true, remainingKpm: 0 });
  });

  it('知らない id は auto と同じ扱い', () => {
    expect(goalProgress(status, 'zzz')?.goal.label).toBe('4級');
  });

  it('最上位で auto なら、現在の級位が目標（達成済み）', () => {
    const top = rankStatus([s(700), s(700), s(700)]);
    expect(goalProgress(top, GOAL_AUTO)).toMatchObject({ achieved: true, remainingKpm: 0 });
    expect(goalProgress(top, GOAL_AUTO)?.goal.label).toBe('十段');
  });

  it('級位がまだ無ければ null', () => {
    expect(goalProgress(rankStatus([]), GOAL_AUTO)).toBeNull();
  });
});

describe('仕様書（docs/spec/ranks.md）との一致', () => {
  const doc = readFileSync(resolve(process.cwd(), 'docs/spec/ranks.md'), 'utf-8') // テストはリポジトリのルートで実行する;

  it('級位の表が、コードの段階と完全に一致する', () => {
    const rows = [...doc.matchAll(/^\| (\S+) \| (\d+) \|$/gm)].map((m) => ({ label: m[1], minKpm: Number(m[2]) }));
    expect(rows).toEqual(RANKS.map((r) => ({ label: r.label, minKpm: r.minKpm })));
  });

  it('パラメータの表が、コードの定数と一致する', () => {
    const value = (name: string) => Number(new RegExp(`\\| ${name} \\| ([\\d.]+) \\|`).exec(doc)?.[1]);
    expect(value('RANK_MIN_ACCURACY')).toBe(RANK_MIN_ACCURACY);
    expect(value('RANK_MIN_KEYSTROKES')).toBe(RANK_MIN_KEYSTROKES);
    expect(value('RANK_WINDOW')).toBe(RANK_WINDOW);
    expect(value('RANK_CERTIFY_COUNT')).toBe(RANK_CERTIFY_COUNT);
  });
});
