/**
 * バックアップ（記録の書き出し）の促し。記録はこのブラウザにだけあり、消えると戻らない。
 * 最後に書き出した日時だけを localStorage に持つ（記録そのものには触れない）。純関数 `backupNudge` が文言を決める。
 */
export const BACKUP_KEY = 'typing.backup.v1';
/** この件数に満たない間は促さない（消えても惜しくない） */
export const NUDGE_MIN_RECORDS = 20;
/** 最後の書き出しからこの日数を過ぎたら促す */
export const NUDGE_INTERVAL_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function storageOrNull(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** 最後に書き出した時刻（エポックミリ秒）。無い・壊れているときは null */
export function loadLastBackup(storage: Store | null = storageOrNull()): number | null {
  try {
    const value = Number(storage?.getItem(BACKUP_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function saveLastBackup(now: number, storage: Store | null = storageOrNull()): void {
  try {
    storage?.setItem(BACKUP_KEY, String(now));
  } catch {
    /* 保存できなくても、書き出し自体は成功している */
  }
}

/** 促す文言。促す必要が無ければ null */
export function backupNudge(args: { records: number; lastAt: number | null; now: number }): string | null {
  const { records, lastAt, now } = args;
  if (records < NUDGE_MIN_RECORDS) return null;
  if (lastAt === null) return `記録が ${records} 件あります。まだ書き出していません。`;
  const days = Math.floor((now - lastAt) / DAY_MS);
  return days >= NUDGE_INTERVAL_DAYS ? `最後に書き出してから ${days} 日たっています（記録 ${records} 件）。` : null;
}
