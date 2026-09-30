import { renderHook } from '@testing-library/react';
import { SETTINGS_KEY } from '@/settings/settings';
import { UNLOCK_KEY } from '@/themes/unlock';
import { SoundPlayer } from './player';
import { SynthPlayer } from './synth';
import { useSoundPlayer } from './useSoundPlayer';

function withSettings(s: Record<string, unknown>) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new ArrayBuffer(1))),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('useSoundPlayer（テーマの音か、合成音か）', () => {
  it('テーマに効果音があれば、それを使う（synthSound が true でも）', () => {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(['hunter']));
    withSettings({ sound: true, themeId: 'hunter', synthSound: true });
    const { result } = renderHook(() => useSoundPlayer());
    expect(result.current).toBeInstanceOf(SoundPlayer);
  });
  it('テーマに効果音が無く synthSound が true なら、合成音', () => {
    withSettings({ sound: true, themeId: 'neutral', synthSound: true });
    const { result } = renderHook(() => useSoundPlayer());
    expect(result.current).toBeInstanceOf(SynthPlayer);
  });
  it('既定（synthSound が false）で、テーマに効果音が無ければ何も鳴らさない', () => {
    withSettings({ sound: true, themeId: 'neutral' });
    const { result } = renderHook(() => useSoundPlayer());
    expect(result.current).toBeNull();
  });
  it('「効果音を鳴らす」がオフなら、synthSound が true でも何も鳴らさない', () => {
    withSettings({ sound: false, themeId: 'neutral', synthSound: true });
    const { result } = renderHook(() => useSoundPlayer());
    expect(result.current).toBeNull();
  });
});
