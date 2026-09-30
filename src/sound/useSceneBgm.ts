import { useEffect } from 'react';
import { useSettings } from '@/settings/useSettings';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import type { Theme } from '@/themes/theme';
import { getBgm } from './bgm';

export type BgmRole = 'title' | 'stage' | 'game';

/** 場面ごとのテーマの BGM。無ければ null */
export function bgmUrl(theme: Theme, role: BgmRole | null): string | null {
  return role ? (theme.audio?.[role] ?? null) : null;
}

/**
 * この画面の間、その場面の BGM を流す。null なら止める（BGM の無い画面）。
 * 画面が替わるたびに次の画面が曲を決めるので、離れるときの後片付けは不要。
 */
export function useSceneBgm(role: BgmRole | null): void {
  const [settings] = useSettings();
  const url = bgmUrl(resolveTheme(settings.themeId, loadUnlocked()), role);
  useEffect(() => {
    getBgm().setScale(1); // 練習中に下げた音量の倍率を戻す
    getBgm().play(url);
  }, [url]);
}
