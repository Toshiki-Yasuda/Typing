import type { Theme } from '@/themes/theme';

/** この起動（タブ）で、テーマの入口をもう見たか。sessionStorage に印を残す（タブを閉じると消える） */
const KEY = 'typing.entrance.v1';

function storage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function entranceSeen(s = storage()): boolean {
  try {
    return s?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markEntranceSeen(s = storage()): void {
  try {
    s?.setItem(KEY, '1');
  } catch {
    // 印を残せなくても、入口は出る（毎回出るだけ）
  }
}

/** ホームに来たとき、先にテーマの入口を見せるか（入口のあるテーマで、この起動でまだ見ていない） */
export function needsEntrance(theme: Theme, s = storage()): boolean {
  return !!theme.title && !entranceSeen(s);
}
