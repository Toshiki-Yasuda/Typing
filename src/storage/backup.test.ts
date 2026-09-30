import { BACKUP_KEY, NUDGE_INTERVAL_DAYS, NUDGE_MIN_RECORDS, backupNudge, loadLastBackup, saveLastBackup } from './backup';

const DAY = 24 * 60 * 60 * 1000;
const now = 1_800_000_000_000;

describe('backupNudge', () => {
  it('記録が少ない間は促さない（境界: 19 件は null、20 件から）', () => {
    expect(backupNudge({ records: NUDGE_MIN_RECORDS - 1, lastAt: null, now })).toBeNull();
    expect(backupNudge({ records: NUDGE_MIN_RECORDS, lastAt: null, now })).toBe('記録が 20 件あります。まだ書き出していません。');
  });

  it('書き出してから 30 日未満なら促さない。30 日ちょうどから促す（29.99 日は促さない）', () => {
    expect(backupNudge({ records: 50, lastAt: now - NUDGE_INTERVAL_DAYS * DAY + 1, now })).toBeNull();
    expect(backupNudge({ records: 50, lastAt: now - NUDGE_INTERVAL_DAYS * DAY, now })).toBe('最後に書き出してから 30 日たっています（記録 50 件）。');
  });

  it('日数は切り捨てで数える', () => {
    expect(backupNudge({ records: 25, lastAt: now - 45.9 * DAY, now })).toContain('45 日');
  });

  it('記録が少なければ、書き出しが古くても促さない', () => {
    expect(backupNudge({ records: 3, lastAt: now - 400 * DAY, now })).toBeNull();
  });
});

describe('最後の書き出しの保存', () => {
  it('保存した時刻を読める。無い・壊れている・0 以下は null', () => {
    const data = new Map<string, string>();
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    expect(loadLastBackup(store)).toBeNull();
    saveLastBackup(now, store);
    expect(data.get(BACKUP_KEY)).toBe(String(now));
    expect(loadLastBackup(store)).toBe(now);
    data.set(BACKUP_KEY, 'abc');
    expect(loadLastBackup(store)).toBeNull();
    data.set(BACKUP_KEY, '0');
    expect(loadLastBackup(store)).toBeNull();
  });

  it('保存先が使えなくても例外にしない', () => {
    const broken = {
      getItem: () => {
        throw new Error('x');
      },
      setItem: () => {
        throw new Error('x');
      },
    };
    expect(loadLastBackup(broken)).toBeNull();
    expect(() => saveLastBackup(now, broken)).not.toThrow();
    expect(loadLastBackup(null)).toBeNull();
  });
});
