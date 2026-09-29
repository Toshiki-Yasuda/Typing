import type { SessionSummary } from './history';
import { MIN_SAMPLE, WEEKDAY_LABELS, bestBucket, byHour, byWeekday, valueOf, type Bucket } from './timeOfDay';

const JST = 9 * 60;
const sm = (startedAt: number, kpm: number, misses = 0, total = 100): SessionSummary => ({
  id: String(startedAt), startedAt, mode: 'practice', kpm, accuracy: 1 - misses / total, consistency: null, efficiency: null, total, misses,
});
/** JST の日時 → エポックミリ秒 */
const jst = (y: number, mo: number, d: number, h: number, mi = 0) => Date.UTC(y, mo - 1, d, h, mi) - JST * 60_000;

describe('byHour / byWeekday', () => {
  it('常に 24 / 7 区分を返す。空でも値は null', () => {
    const h = byHour([], JST);
    expect(h).toHaveLength(24);
    expect(h.every((b) => b.count === 0 && b.meanKpm === null && b.meanMissRate === null)).toBe(true);
    expect(h.map((b) => b.index)).toEqual(Array.from({ length: 24 }, (_, i) => i));
    expect(byWeekday([], JST)).toHaveLength(7);
  });

  it('練習を始めた時刻の「時」と曜日（月=0）に振り分ける', () => {
    const monday21 = sm(jst(2026, 9, 28, 21, 0), 200);
    const h = byHour([monday21], JST);
    expect(h[21]).toMatchObject({ count: 1, meanKpm: 200 });
    expect(h.filter((b) => b.count > 0)).toHaveLength(1);
    expect(byWeekday([monday21], JST)[0]).toMatchObject({ count: 1 }); // 月曜
  });

  it('日付をまたぐ境界: 23:59（日曜）と 00:30（翌日）は別の区分', () => {
    const sundayLate = sm(jst(2026, 9, 27, 23, 59), 100);
    const tuesdayEarly = sm(jst(2026, 9, 29, 0, 30), 300);
    const h = byHour([sundayLate, tuesdayEarly], JST);
    expect(h[23]?.meanKpm).toBe(100);
    expect(h[0]?.meanKpm).toBe(300);
    const w = byWeekday([sundayLate, tuesdayEarly], JST);
    expect(w[6]?.count).toBe(1); // 日曜
    expect(w[1]?.count).toBe(1); // 火曜
  });

  it('同じ区分の速度は平均、ミス率は「ミス/総打鍵」の平均', () => {
    const a = sm(jst(2026, 9, 28, 21, 0), 200, 2, 100); // ミス率 0.02
    const b = sm(jst(2026, 9, 29, 21, 30), 300, 6, 100); // ミス率 0.06（別の曜日、同じ 21 時台）
    const h21 = byHour([a, b], JST)[21] as Bucket;
    expect(h21.count).toBe(2);
    expect(h21.meanKpm).toBe(250);
    expect(h21.meanMissRate).toBeCloseTo(0.04);
  });

  it('速度を計算できなかった練習（0）は速度の平均に入れないが、回数には数える', () => {
    const h = byHour([sm(jst(2026, 9, 28, 9, 0), 0), sm(jst(2026, 9, 28, 9, 5), 200)], JST)[9] as Bucket;
    expect(h.count).toBe(2);
    expect(h.meanKpm).toBe(200);
  });

  it('打鍵が 0 の練習はミス率に入れない', () => {
    const h = byHour([sm(jst(2026, 9, 28, 9, 0), 0, 0, 0)], JST)[9] as Bucket;
    expect(h.count).toBe(1);
    expect(h.meanMissRate).toBeNull();
  });

  it('全練習が、どこかの区分に必ず入る（合計が一致）', () => {
    const list = Array.from({ length: 50 }, (_, i) => sm(1_700_000_000_000 + i * 5_400_000, 100 + i));
    expect(byHour(list, JST).reduce((n, b) => n + b.count, 0)).toBe(50);
    expect(byWeekday(list, JST).reduce((n, b) => n + b.count, 0)).toBe(50);
  });

  it('タイムゾーンを省略すると、実行環境のローカル時刻で振り分ける', () => {
    const ts = Date.UTC(2026, 5, 15, 3, 20);
    const d = new Date(ts);
    expect(byHour([sm(ts, 100)])[d.getHours()]?.count).toBe(1);
    expect(byWeekday([sm(ts, 100)])[(d.getDay() + 6) % 7]?.count).toBe(1);
  });
});

describe('bestBucket', () => {
  const bucket = (index: number, count: number, meanKpm: number | null, meanMissRate: number | null): Bucket => ({ index, count, meanKpm, meanMissRate });

  it('回数が MIN_SAMPLE 以上の区分から、速度は最大・ミス率は最小を選ぶ', () => {
    const buckets = [bucket(9, 5, 200, 0.05), bucket(21, 4, 260, 0.03), bucket(23, 3, 240, 0.01)];
    expect(bestBucket(buckets, 'kpm')?.index).toBe(21);
    expect(bestBucket(buckets, 'miss')?.index).toBe(23);
  });

  it('回数が少ない区分は選ばない（偶然の好記録を「最良」にしない）', () => {
    const buckets = [bucket(3, MIN_SAMPLE - 1, 999, 0), bucket(9, 5, 200, 0.05), bucket(21, 4, 210, 0.04)];
    expect(bestBucket(buckets, 'kpm')?.index).toBe(21);
  });

  it('比べられる区分が 2 つ未満なら null', () => {
    expect(bestBucket([bucket(9, 5, 200, 0.05)], 'kpm')).toBeNull();
    expect(bestBucket([bucket(9, 5, 200, 0.05), bucket(10, 1, 300, 0)], 'kpm')).toBeNull();
    expect(bestBucket([], 'kpm')).toBeNull();
  });

  it('値の無い区分（null）は対象外', () => {
    expect(bestBucket([bucket(1, 5, null, null), bucket(2, 5, 200, 0.1), bucket(3, 5, 210, 0.2)], 'kpm')?.index).toBe(3);
  });

  it('同値なら、先の区分を返す', () => {
    expect(bestBucket([bucket(1, 5, 200, 0.1), bucket(2, 5, 200, 0.1)], 'kpm')?.index).toBe(1);
  });
});

describe('補助', () => {
  it('valueOf / WEEKDAY_LABELS', () => {
    expect(valueOf({ index: 0, count: 1, meanKpm: 5, meanMissRate: 0.1 }, 'kpm')).toBe(5);
    expect(valueOf({ index: 0, count: 1, meanKpm: 5, meanMissRate: 0.1 }, 'miss')).toBe(0.1);
    expect(WEEKDAY_LABELS).toEqual(['月', '火', '水', '木', '金', '土', '日']);
    expect(MIN_SAMPLE).toBe(3);
  });
});
