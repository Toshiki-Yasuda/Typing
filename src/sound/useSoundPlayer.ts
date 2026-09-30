import { useEffect, useMemo } from 'react';
import { useSettings } from '@/settings/useSettings';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { browserSoundDeps, SoundPlayer, type SoundKind } from './player';
import { browserSynthDeps, SynthPlayer } from './synth';

/** 練習中に鳴らす側が使う部分（テーマの音も合成音も同じ形） */
export interface KindPlayer {
  play(kind: SoundKind): void;
  setVolume(v: number): void;
}

/**
 * 設定と選んだテーマの効果音から、再生器を作る。テーマに効果音があればそれを使い、
 * 無くて `synthSound` が true なら合成音（synth.ts）を使う。どちらも無ければ null
 */
export function useSoundPlayer(): KindPlayer | null {
  const [settings] = useSettings();
  const sounds = useMemo(
    () => (settings.sound ? resolveTheme(settings.themeId, loadUnlocked()).sounds : undefined),
    [settings.sound, settings.themeId],
  );
  // 「効果音を鳴らす」がオフなら、合成音も鳴らさない
  const synth = settings.sound && !sounds && settings.synthSound;
  const player = useMemo<KindPlayer | null>(
    () => (sounds ? new SoundPlayer(sounds, browserSoundDeps()) : synth ? new SynthPlayer(browserSynthDeps()) : null),
    [sounds, synth],
  );
  useEffect(() => {
    if (player instanceof SoundPlayer) void player.preload();
  }, [player]);
  useEffect(() => {
    player?.setVolume(settings.sfxVolume / 100);
  }, [player, settings.sfxVolume]);
  return player;
}
