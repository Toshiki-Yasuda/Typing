import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import type { ContentItem } from '@/content';
import { SETTINGS_KEY } from '@/settings/settings';
import { createMemoryStore } from '@/storage';
import { HUNTER_THEME } from '@/themes/themes';
import { UNLOCK_KEY } from '@/themes/unlock';
import { Play } from './Play';

const playOnce = vi.fn();
vi.mock('@/sound/oneshot', () => ({ playOnce: (...a: unknown[]) => playOnce(...a) }));
vi.mock('@/sound/bgm', () => ({
  getBgm: () => ({ play: vi.fn(), setScale: vi.fn(), unlock: vi.fn(), stop: vi.fn(), setEnabled: vi.fn(), setVolume: vi.fn() }),
}));

// 1 語で 20 打鍵（かきくけこ ×2）: 段階の境界（5・10・20）をまたげる長さ
const items: ContentItem[] = [{ display: '長い', reading: 'かきくけこかきくけこ' }];
const CONFIRM = HUNTER_THEME.audio?.confirm;

function start(settings: object = {}, themeId = 'hunter') {
  localStorage.clear();
  localStorage.setItem(UNLOCK_KEY, '["hunter"]');
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ themeId, ...settings }));
  render(
    <StoreProvider store={createMemoryStore()}>
      <MemoryRouter initialEntries={['/play']}>
        <Routes>
          <Route path="/play" element={<Play items={items} />} />
          <Route path="/result/:id" element={<p>結果</p>} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
}
const ready = async () => {
  await screen.findByRole('region', { name: 'お題' });
  await act(async () => {});
};
const type = (keys: string) =>
  [...keys].forEach((k) => act(() => void fireEvent.keyDown(window, { key: k, code: `Key${k.toUpperCase()}` })));
const hud = () => screen.getByRole('group', { name: 'コンボの段階' });
const aura = () => document.querySelector('.feel-aura') as HTMLElement | null;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  playOnce.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('打鍵の手応え', () => {
  it('コンボと段階を文字で示す。正打で増え、ミスで 0 に戻り、段階も戻る', async () => {
    start();
    await ready();
    expect(hud()).toHaveTextContent('念');
    expect(hud()).toHaveTextContent('0 連続');
    expect(hud()).toHaveTextContent('次の「纏」まで あと 5');
    type('kaki');
    expect(hud()).toHaveTextContent('4 連続');
    expect(hud()).toHaveTextContent('あと 1');
    type('k'); // 5 連続 → 纏
    expect(hud()).toHaveTextContent('纏');
    expect(hud()).toHaveTextContent('5 連続');
    expect(hud()).toHaveTextContent('次の「絶」まで あと 5');
    type('1'); // ミス
    expect(hud()).toHaveTextContent('0 連続');
    expect(hud().querySelector('.feel-badge')?.textContent).toBe('念');
  });

  it('段階が上がった瞬間に、名前を出し、決定音を 1 回鳴らす。しばらくすると消える', async () => {
    start();
    await ready();
    type('kakiku'); // 6 連続: 纏に入った
    expect(screen.getByRole('status')).toHaveTextContent('「纏」に到達');
    expect(hud()).toContainElement(screen.getByRole('status')); // お題に重ねず、HUD の中に出す
    expect(playOnce).toHaveBeenCalledTimes(1);
    expect(playOnce).toHaveBeenCalledWith(CONFIRM, 0.8);
    type('kek'); // 9 連続まで、同じ段階の中では鳴らさない
    expect(playOnce).toHaveBeenCalledTimes(1);
    type('o'); // 10 連続 → 絶
    expect(playOnce).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toHaveTextContent('絶');
    await act(async () => void (await vi.advanceTimersByTimeAsync(1500)));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('お題の周りの光は、段階とともに強まる（0 → 0.25 → 0.5）。ミスで戻る', async () => {
    start();
    await ready();
    expect(aura()?.style.getPropertyValue('--aura')).toBe('0');
    type('kakik');
    expect(aura()?.style.getPropertyValue('--aura')).toBe('0.25'); // 纏（5 段階の 2 番目）
    type('ukeko');
    expect(aura()?.style.getPropertyValue('--aura')).toBe('0.5'); // 絶
    type('1');
    expect(aura()?.style.getPropertyValue('--aura')).toBe('0');
  });

  it('ミスでは小さく揺れる（標準のときだけ）', async () => {
    start();
    await ready();
    type('1');
    expect(aura()).toHaveClass('feel-shake');
    cleanup();
    start({ effects: 'reduced' });
    await ready();
    type('1');
    expect(aura()).not.toHaveClass('feel-shake');
  });

  it('演出オフ: 光・段階の表示・揺れ・決定音は出さないが、コンボの文字は出す', async () => {
    start({ effects: 'off' });
    await ready();
    type('kakik');
    expect(hud()).toHaveTextContent('5 連続');
    expect(aura()).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(playOnce).not.toHaveBeenCalled();
  });

  it('控えめ: 光と段階の表示は出るが、動かない（アニメーションなし）', async () => {
    start({ effects: 'reduced' });
    await ready();
    type('kakik');
    expect(aura()).toHaveAttribute('data-effect', 'reduced');
    expect(screen.getByRole('status')).toHaveAttribute('data-animate', 'false');
  });

  it('効果音を切っていれば、決定音は鳴らさない（名前は出る）', async () => {
    start({ sound: false });
    await ready();
    type('kakik');
    expect(screen.getByRole('status')).toHaveTextContent('纏');
    expect(playOnce).not.toHaveBeenCalled();
  });

  it('効果音の音量が決定音に掛かる', async () => {
    start({ sfxVolume: 30 });
    await ready();
    type('kakik');
    expect(playOnce).toHaveBeenCalledWith(CONFIRM, 0.3);
  });

  it('標準テーマには手応えが無い（静か）', async () => {
    start({}, 'neutral');
    await ready();
    type('kakik');
    expect(screen.queryByRole('group', { name: 'コンボの段階' })).toBeNull();
    expect(aura()).toBeNull();
    expect(playOnce).not.toHaveBeenCalled();
  });

  it('手応えは判定に影響しない: 最後まで打ち切ると結果へ進む', async () => {
    start();
    await ready();
    type('kakikukekokakikukeko');
    expect(await screen.findByText('結果')).toBeInTheDocument();
  });
});
