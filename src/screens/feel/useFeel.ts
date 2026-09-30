import { prefersReducedMotion, resolveEffects, type EffectLevel } from '@/effects/level';
import type { ComboLevel } from '@/session/combo';
import { useSettings } from '@/settings/useSettings';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';

export interface Feel {
  readonly levels: readonly ComboLevel[];
  /** 演出の強さ（オフなら、光・段階が上がる表示・揺れは出さない。コンボの文字は出す） */
  readonly effect: EffectLevel;
  /** 段階が上がった瞬間の効果音（無ければ鳴らさない） */
  readonly cue: { url: string; volume: number } | null;
}

/** 選んだテーマの「打鍵の手応え」の設定。テーマに無ければ null（標準テーマは静か） */
export function useFeel(): Feel | null {
  const [settings] = useSettings();
  const theme = resolveTheme(settings.themeId, loadUnlocked());
  if (!theme.feel) return null;
  const url = theme.audio?.confirm;
  return {
    levels: theme.feel.levels,
    effect: resolveEffects(settings.effects, prefersReducedMotion()),
    cue: settings.sound && url ? { url, volume: settings.sfxVolume / 100 } : null,
  };
}
