import { useEffect, useMemo } from 'react';
import { useSettings } from '@/settings/useSettings';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { browserSoundDeps, SoundPlayer } from './player';

/** 設定（音の ON/OFF）と選んだテーマの効果音から、再生器を作って読み込む。音が無ければ null */
export function useSoundPlayer(): SoundPlayer | null {
  const [settings] = useSettings();
  const sounds = useMemo(
    () => (settings.sound ? resolveTheme(settings.themeId, loadUnlocked()).sounds : undefined),
    [settings.sound, settings.themeId],
  );
  const player = useMemo(() => (sounds ? new SoundPlayer(sounds, browserSoundDeps()) : null), [sounds]);
  useEffect(() => {
    void player?.preload();
  }, [player]);
  return player;
}
