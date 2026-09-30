import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import { createMemoryStore } from '@/storage';
import { SETTINGS_KEY } from '@/settings/settings';
import { UNLOCK_KEY } from '@/themes/unlock';
import { HUNTER_THEME } from '@/themes/themes';
import { Home } from '../Home';
import { Entrance } from './Entrance';
import { entranceSeen } from './entrance';
import { BURST_MS } from './opening';
import { TitleRoute } from './TitleScreen';

const bgm = { play: vi.fn(), unlock: vi.fn(), stop: vi.fn() };
const playOnce = vi.fn();
vi.mock('@/sound/bgm', () => ({ getBgm: () => bgm }));
vi.mock('@/sound/oneshot', () => ({ playOnce: (...a: unknown[]) => playOnce(...a) }));

function app(initial: string) {
  render(
    <StoreProvider store={createMemoryStore()}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/" element={<Entrance><Home /></Entrance>} />
          <Route path="/title" element={<TitleRoute />} />
          <Route path="/play" element={<p>練習画面</p>} />
          <Route path="/daily" element={<p>デイリー画面</p>} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
}
function setTheme(themeId: string, extra: object = {}) {
  localStorage.setItem(UNLOCK_KEY, '["hunter"]');
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ themeId, ...extra }));
}
const key = (k: string) => act(() => void fireEvent.keyDown(window, { key: k }));
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  sessionStorage.clear();
  bgm.play.mockClear();
  bgm.unlock.mockClear();
  playOnce.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const menu = () => screen.queryByRole('navigation', { name: 'メニュー' });
const URL_TITLE = HUNTER_THEME.audio?.title;

describe('テーマの入口', () => {
  it('ゲート → 開始 → オープニング → 時間でタイトルメニュー。音は開始の操作から鳴る', async () => {
    setTheme('hunter');
    app('/title');
    const gate = await screen.findByRole('button', { name: /スタート/ });
    expect(menu()).toBeNull();
    expect(bgm.play).not.toHaveBeenCalled(); // ゲートの前は無音（自動再生の制限のため）
    expect(screen.getByText('音が出ます')).toBeInTheDocument();

    fireEvent.click(gate);
    expect(bgm.unlock).toHaveBeenCalled();
    expect(playOnce).toHaveBeenCalledWith(HUNTER_THEME.audio?.stinger, 0.8);
    expect(bgm.play).toHaveBeenCalledWith(URL_TITLE);
    expect(screen.getByRole('button', { name: /飛ばす/ })).toBeInTheDocument(); // オープニング中

    await advance(BURST_MS - 100);
    expect(menu()).toBeNull();
    await advance(200);
    expect(menu()).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: /HUNTER×HUNTER/ })).toBeVisible();
  });

  it('オープニングは Esc・ボタンで飛ばせる。ゲートも Esc でタイトルへ', async () => {
    setTheme('hunter');
    app('/title');
    fireEvent.click(await screen.findByRole('button', { name: /スタート/ }));
    key('Escape');
    expect(menu()).not.toBeNull();
    cleanup();

    app('/title');
    key('Escape'); // ゲートから直接
    expect(menu()).not.toBeNull();
    expect(bgm.play).toHaveBeenLastCalledWith(URL_TITLE);
  });

  it('演出オフはゲートもオープニングも無くタイトル。曲は頼む（最初の操作で鳴る）', async () => {
    setTheme('hunter', { effects: 'off' });
    app('/title');
    expect(await screen.findByRole('navigation', { name: 'メニュー' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /スタート/ })).toBeNull();
    expect(bgm.play).toHaveBeenCalledWith(URL_TITLE);
  });

  it('控えめは、動くオープニングを飛ばしてタイトル（ゲートは出る）', async () => {
    setTheme('hunter', { effects: 'reduced' });
    app('/title');
    fireEvent.click(await screen.findByRole('button', { name: /スタート/ }));
    expect(menu()).not.toBeNull();
    expect(screen.queryByRole('button', { name: /飛ばす/ })).toBeNull();
  });

  it('効果音を切っていれば、爆発音は鳴らさない', async () => {
    setTheme('hunter', { sound: false });
    app('/title');
    fireEvent.click(await screen.findByRole('button', { name: /スタート/ }));
    expect(playOnce).not.toHaveBeenCalled();
    expect(bgm.unlock).toHaveBeenCalled();
  });

  it('メニュー: 番号キーで選べる。↑↓でフォーカスが動く。Enter は各リンクの操作', async () => {
    setTheme('hunter', { effects: 'off' });
    app('/title');
    await screen.findByRole('navigation', { name: 'メニュー' });
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveFocus(); // 最初の項目にフォーカス
    key('ArrowDown');
    expect(links[1]).toHaveFocus();
    key('ArrowUp');
    key('ArrowUp'); // 先頭から上で末尾へ
    expect(links.at(-1)).toHaveFocus();
    key('2');
    expect(await screen.findByText('デイリー画面')).toBeInTheDocument();
  });

  it('この起動で入口を見た後に戻ってきたら、ゲートを出さずメニューから。曲は続ける', async () => {
    setTheme('hunter');
    sessionStorage.setItem('typing.entrance.v1', '1');
    app('/title');
    expect(await screen.findByRole('navigation', { name: 'メニュー' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /スタート/ })).toBeNull();
    expect(bgm.play).toHaveBeenCalledWith(URL_TITLE);
  });

  it('入口を開くと、この起動では見たことになる', async () => {
    setTheme('hunter', { effects: 'off' });
    expect(entranceSeen()).toBe(false);
    app('/title');
    await screen.findByRole('navigation', { name: 'メニュー' });
    expect(entranceSeen()).toBe(true);
  });

  it('入口の無いテーマ（標準）で /title を開くと、ホームへ戻る', async () => {
    setTheme('neutral');
    app('/title');
    expect(await screen.findByRole('heading', { level: 1, name: 'Typing' })).toBeInTheDocument();
  });
});

describe('関所（Entrance）', () => {
  it('入口のあるテーマで、この起動でまだ見ていなければ、ホームより先に入口', async () => {
    setTheme('hunter');
    app('/');
    expect(await screen.findByRole('button', { name: /スタート/ })).toBeInTheDocument();
  });

  it('入口を見た後はホームが出る。標準テーマでは最初からホーム', async () => {
    setTheme('hunter', { effects: 'off' });
    app('/title');
    await screen.findByRole('navigation', { name: 'メニュー' });
    cleanup();
    app('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Typing' })).toBeInTheDocument();
    cleanup();

    sessionStorage.clear();
    setTheme('neutral');
    app('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Typing' })).toBeInTheDocument();
  });
});

describe('テーマを選んだ直後', () => {
  it('パスワードで解除すると、オープニング（入口）へ進む', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ themeId: 'neutral' }));
    sessionStorage.setItem('typing.entrance.v1', '1'); // 起動時の入口は済んでいる状態
    app('/');
    fireEvent.change(await screen.findByLabelText(/パスワードで新しいテーマを開く/), { target: { value: 'SAKI' } });
    fireEvent.click(screen.getByRole('button', { name: '開く' }));
    // 解除の確認（SHA-256）は非同期
    await waitFor(() => expect(screen.getByRole('button', { name: /スタート/ })).toBeInTheDocument());
  });
});
