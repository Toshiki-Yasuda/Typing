import { DAILY_COUNT, DAILY_PACKS, dailyChallenge, hashString, seededRandom, todaysChallenge } from './daily';
import { dayKey } from '@/metrics';

describe('seededRandom / hashString', () => {
  it('同じ種なら同じ列、違う種なら違う列', () => {
    const a = seededRandom(1);
    const b = seededRandom(1);
    const c = seededRandom(2);
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(Array.from({ length: 5 }, c)).not.toEqual(seqA);
  });

  it('値は 0 以上 1 未満', () => {
    const r = seededRandom(123456);
    for (let i = 0; i < 10000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('一様に近い（10 個の箱に偏りなく入る）', () => {
    const r = seededRandom(99);
    const bins = new Array<number>(10).fill(0);
    for (let i = 0; i < 20000; i++) bins[Math.floor(r() * 10)]!++;
    for (const n of bins) expect(n).toBeGreaterThan(1700);
  });

  it('hashString: 決定的で、日付が違えば別の値', () => {
    expect(hashString('a')).toBe(hashString('a'));
    expect(hashString('typing-daily:2026-09-29')).not.toBe(hashString('typing-daily:2026-09-30'));
    // FNV-1a の既知の値（空文字は初期値）
    expect(hashString('')).toBe(0x811c9dc5);
  });
});

describe('dailyChallenge', () => {
  it('同じ日付なら、何度呼んでも、Math.random を使わずに同じお題', () => {
    const spy = vi.spyOn(Math, 'random');
    const a = dailyChallenge('2026-09-29');
    const b = dailyChallenge('2026-09-29');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    expect(b).toEqual(a);
    expect(a.items).toHaveLength(DAILY_COUNT);
  });

  it('お題は重複せず、パックに含まれる', () => {
    const c = dailyChallenge('2026-01-01');
    expect(new Set(c.items.map((i) => i.reading)).size).toBe(c.items.length);
    for (const item of c.items) expect(c.pack.items).toContainEqual(item);
  });

  it('日付が変わればお題が変わる（連続30日で、同じ並びが2回出ない）', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 30; d++) {
      const key = dailyChallenge(`2026-06-${String(d).padStart(2, '0')}`).items.map((i) => i.reading).join('|');
      expect(seen.has(key), `6/${d}`).toBe(false);
      seen.add(key);
    }
  });

  it('全パックが使われる。かなが多めで、英単語・記号もたまに出る', () => {
    const counts = new Map<string, number>();
    for (let d = 0; d < 400; d++) {
      const id = dailyChallenge(`2027-${String(1 + Math.floor(d / 28)).padStart(2, '0')}-${String(1 + (d % 28)).padStart(2, '0')}`).pack.id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(['basic', 'english', 'symbols']);
    expect(counts.get('basic')).toBeGreaterThan(counts.get('english') ?? 0);
    expect(counts.get('basic')).toBeGreaterThan(counts.get('symbols') ?? 0);
    expect(DAILY_PACKS).toHaveLength(4);
  });

  it('お題の数を指定できる。パックより多ければ全語', () => {
    expect(dailyChallenge('2026-09-29', 3).items).toHaveLength(3);
    expect(dailyChallenge('2026-09-29', 1000).items.length).toBeLessThanOrEqual(dailyChallenge('2026-09-29').pack.items.length);
  });

  it('todaysChallenge は実行環境の今日の日付', () => {
    const now = Date.now();
    expect(todaysChallenge(now).day).toBe(dayKey(now));
  });
});
