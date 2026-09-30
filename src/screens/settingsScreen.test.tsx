import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import { createMemoryStore } from '@/storage';
import { SETTINGS_KEY } from '@/settings/settings';
import { HUNTER_THEME } from '@/themes/themes';
import { UNLOCK_KEY } from '@/themes/unlock';
import { SettingsScreen } from './SettingsScreen';
import { useBgmSync } from '@/sound/useBgmSync';

const bgm = {
  play: vi.fn(),
  unlock: vi.fn(),
  stop: vi.fn(),
  setEnabled: vi.fn(),
  setVolume: vi.fn(),
  setScale: vi.fn(),
  setHidden: vi.fn(),
};
const playOnce = vi.fn();
vi.mock('@/sound/bgm', () => ({ getBgm: () => bgm }));
vi.mock('@/sound/oneshot', () => ({ playOnce: (...a: unknown[]) => playOnce(...a) }));

function Sync() {
  useBgmSync();
  return null;
}
function app(initial = '/settings') {
  render(
    <StoreProvider store={createMemoryStore()}>
      <MemoryRouter initialEntries={[initial]}>
        <Sync />
        <Routes>
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/title" element={<p>タイトル画面</p>} />
          <Route path="/" element={<p>ホーム画面</p>} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
}
const theme = (id: string, extra: object = {}) => {
  localStorage.setItem(UNLOCK_KEY, '["hunter"]');
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ themeId: id, ...extra }));
};
const saved = () => JSON.parse(localStorage.getItem(SETTINGS_KEY) as string);

beforeEach(() => {
  localStorage.clear();
  Object.values(bgm).forEach((f) => f.mockClear());
  playOnce.mockClear();
});
afterEach(cleanup);

describe('設定画面', () => {
  it('テーマ・音・練習の設定が並ぶ。ステージ選択の BGM を頼む', () => {
    theme('hunter');
    app();
    expect(screen.getByRole('heading', { level: 1, name: '設定' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'テーマ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '音' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '練習の設定' })).toBeInTheDocument();
    expect(bgm.play).toHaveBeenLastCalledWith(HUNTER_THEME.audio?.stage);
  });

  it('標準テーマには音の設定が出ない。BGM も止める', () => {
    theme('neutral');
    app();
    expect(screen.queryByRole('heading', { name: '音' })).toBeNull();
    expect(bgm.play).toHaveBeenLastCalledWith(null);
  });

  it('Esc・戻るリンクで、入口のあるテーマはタイトルへ、標準はホームへ', () => {
    theme('hunter');
    app();
    act(() => void fireEvent.keyDown(window, { key: 'Escape' }));
    expect(screen.getByText('タイトル画面')).toBeInTheDocument();
    cleanup();

    theme('neutral');
    app();
    expect(screen.getByRole('link', { name: /ホームへ戻る/ })).toHaveAttribute('href', '/');
    act(() => void fireEvent.keyDown(window, { key: 'Escape' }));
    expect(screen.getByText('ホーム画面')).toBeInTheDocument();
  });
});

describe('音の設定', () => {
  it('BGM の入切と音量が保存され、再生器にすぐ反映される', () => {
    theme('hunter');
    app();
    const slider = screen.getByRole('slider', { name: 'BGM の音量' });
    expect(slider).toHaveValue('60');
    fireEvent.change(slider, { target: { value: '35' } });
    expect(saved().bgmVolume).toBe(35);
    expect(screen.getByText('35%')).toBeInTheDocument(); // 数値も文字で出す
    expect(bgm.setVolume).toHaveBeenLastCalledWith(0.35);

    fireEvent.click(screen.getByRole('checkbox', { name: 'BGM を鳴らす' }));
    expect(saved().bgm).toBe(false);
    expect(bgm.setEnabled).toHaveBeenLastCalledWith(false);
    // 切ると、音量と「練習中の BGM」は出ない
    expect(screen.queryByRole('slider', { name: 'BGM の音量' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: '練習中の BGM' })).toBeNull();
  });

  it('効果音の音量: つまみを離すと、今の音量で 1 回鳴る（確かめられる）', () => {
    theme('hunter');
    app();
    const slider = screen.getByRole('slider', { name: '効果音の音量' });
    fireEvent.change(slider, { target: { value: '40' } });
    expect(playOnce).not.toHaveBeenCalled(); // 動かしている間は鳴らさない
    fireEvent.pointerUp(slider);
    expect(playOnce).toHaveBeenCalledWith(HUNTER_THEME.audio?.confirm, 0.4);
    expect(saved().sfxVolume).toBe(40);
  });

  it('練習中の BGM は既定でボス戦だけ。選べる', () => {
    theme('hunter');
    app();
    const select = screen.getByRole('combobox', { name: '練習中の BGM' });
    expect(select).toHaveValue('boss');
    fireEvent.change(select, { target: { value: 'all' } });
    expect(saved().gameBgm).toBe('all');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(
      expect.arrayContaining(['鳴らさない', 'ボス戦だけ', 'すべての練習']),
    );
  });

  it('ページの表示/非表示と、最初の操作を再生器へ伝える', () => {
    theme('hunter');
    app();
    act(() => void fireEvent.pointerDown(window));
    expect(bgm.unlock).toHaveBeenCalled();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(bgm.setHidden).toHaveBeenLastCalledWith(true);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });
});
