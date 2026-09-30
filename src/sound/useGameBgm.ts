import { useEffect } from 'react';
import type { Settings } from '@/settings/settings';
import { useSettings } from '@/settings/useSettings';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import type { Theme } from '@/themes/theme';
import { getBgm } from './bgm';

/** 練習中は、打鍵の邪魔にならない小さな音量の倍率にする */
export const PRACTICE_SCALE = 0.3;
/** ボス戦: フェーズが上がるほど、少しずつ大きくする（最後は盛り上がる） */
export const PHASE_SCALE: readonly number[] = [0.3, 0.4, 0.5, 0.6];
/** 決着で、曲をフェードアウトする長さ（ミリ秒） */
export const END_FADE_MS = 1200;

/** 練習中に流す曲。流さないなら null（BGM オフ・テーマに曲が無い・設定が「鳴らさない」/ボス戦以外） */
export function gameBgmUrl(theme: Theme, settings: Pick<Settings, 'bgm' | 'gameBgm'>, isBoss: boolean): string | null {
  if (!settings.bgm || !theme.audio?.game) return null;
  if (settings.gameBgm === 'all' || (settings.gameBgm === 'boss' && isBoss)) return theme.audio.game;
  return null;
}

/** 音量の倍率。ボス戦はフェーズ（1〜4）で、それ以外は一定 */
export function gameBgmScale(isBoss: boolean, phase: number | null): number {
  if (!isBoss || phase === null) return PRACTICE_SCALE;
  return PHASE_SCALE[Math.min(Math.max(phase, 1), PHASE_SCALE.length) - 1] as number;
}

/**
 * 練習・ボス戦の間の BGM。曲を流さない設定なら、タイトルなど前の画面の曲を止める。
 * 決着（ended）で曲をフェードアウトする。打鍵の判定・計測には関わらない。
 */
export function useGameBgm({ isBoss, phase, ended }: { isBoss: boolean; phase: number | null; ended: boolean }): void {
  const [settings] = useSettings();
  const url = gameBgmUrl(resolveTheme(settings.themeId, loadUnlocked()), settings, isBoss);
  const scale = gameBgmScale(isBoss, phase);

  useEffect(() => {
    getBgm().setScale(scale);
  }, [scale]);

  useEffect(() => {
    if (ended) getBgm().play(null, END_FADE_MS);
    else getBgm().play(url);
  }, [url, ended]);
}
