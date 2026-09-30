import { useEffect, useMemo } from 'react';
import { useSettings } from '@/settings/useSettings';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { JinglePlayer, type JingleKind } from './jingle';
import { browserSynthDeps } from './synth';

/**
 * 結果画面の短い合成音を鳴らす関数。鳴らさない設定のときは null。
 * 条件: 「効果音を鳴らす」がオン、かつ、テーマに効果音がある（HUNTER）か、合成音（synthSound）を選んでいる。
 * 標準テーマで何も選んでいなければ、勝手に鳴らさない。音量は sfxVolume。
 */
export function useJingle(): ((kind: JingleKind) => void) | null {
  const [settings] = useSettings();
  const themed = settings.sound && !!resolveTheme(settings.themeId, loadUnlocked()).sounds;
  const enabled = settings.sound && (themed || settings.synthSound);
  const player = useMemo(() => (enabled ? new JinglePlayer(browserSynthDeps()) : null), [enabled]);
  useEffect(() => {
    player?.setVolume(settings.sfxVolume / 100);
  }, [player, settings.sfxVolume]);
  return useMemo(() => (player ? (kind: JingleKind) => player.play(kind) : null), [player]);
}
