import { render, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { ResultJingle } from '@/screens/ResultJingle';
import { SETTINGS_KEY } from '@/settings/settings';
import { UNLOCK_KEY } from '@/themes/unlock';
import { useJingle } from './useJingle';

const withSettings = (s: Record<string, unknown>) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(UNLOCK_KEY, '["hunter"]');
});

describe('useJingle（結果の合成音を鳴らすか）', () => {
  it('効果音ありのテーマ（HUNTER）で「効果音を鳴らす」がオンなら鳴らせる', () => {
    withSettings({ themeId: 'hunter', sound: true });
    expect(renderHook(() => useJingle()).result.current).toBeTypeOf('function');
  });

  it('標準テーマで、合成音も選んでいなければ鳴らさない（勝手に鳴らさない）', () => {
    withSettings({ themeId: 'neutral', sound: true });
    expect(renderHook(() => useJingle()).result.current).toBeNull();
  });

  it('標準テーマでも、合成音（synthSound）を選んでいれば鳴らせる', () => {
    withSettings({ themeId: 'neutral', sound: true, synthSound: true });
    expect(renderHook(() => useJingle()).result.current).toBeTypeOf('function');
  });

  it('「効果音を鳴らす」がオフなら、テーマがあっても合成音を選んでいても鳴らさない', () => {
    withSettings({ themeId: 'hunter', sound: false });
    expect(renderHook(() => useJingle()).result.current).toBeNull();
    localStorage.clear();
    localStorage.setItem(UNLOCK_KEY, '["hunter"]');
    withSettings({ themeId: 'neutral', sound: false, synthSound: true });
    expect(renderHook(() => useJingle()).result.current).toBeNull();
  });
});

describe('ResultJingle', () => {
  it('同じ記録では 1 回だけ鳴らす（StrictMode の二重実行でも）。記録が変われば鳴らす', async () => {
    vi.resetModules();
    const play = vi.fn();
    vi.doMock('@/sound/useJingle', () => ({ useJingle: () => play }));
    const { ResultJingle: Mocked } = await import('@/screens/ResultJingle');
    const { rerender } = render(
      <StrictMode>
        <Mocked kind="clear" recordId="a" />
      </StrictMode>,
    );
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith('clear');
    rerender(
      <StrictMode>
        <Mocked kind="clear" recordId="a" />
      </StrictMode>,
    );
    expect(play).toHaveBeenCalledTimes(1);
    rerender(
      <StrictMode>
        <Mocked kind="victory" recordId="b" />
      </StrictMode>,
    );
    expect(play).toHaveBeenLastCalledWith('victory');
    expect(play).toHaveBeenCalledTimes(2);
    vi.doUnmock('@/sound/useJingle');
  });

  it('鳴らせない設定（null）のときは何もしない', () => {
    withSettings({ themeId: 'neutral', sound: true });
    expect(() => render(<ResultJingle kind="clear" recordId="x" />)).not.toThrow();
  });
});
