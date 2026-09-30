import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import type { ContentItem } from '@/content';
import { SETTINGS_KEY } from '@/settings/settings';
import { END_FADE_MS, PHASE_SCALE, PRACTICE_SCALE } from '@/sound/useGameBgm';
import { createMemoryStore } from '@/storage';
import { HUNTER_THEME } from '@/themes/themes';
import { UNLOCK_KEY } from '@/themes/unlock';
import { Play } from './Play';

const bgm = { play: vi.fn(), setScale: vi.fn(), unlock: vi.fn(), stop: vi.fn(), setEnabled: vi.fn(), setVolume: vi.fn() };
vi.mock('@/sound/bgm', () => ({ getBgm: () => bgm }));

const GAME = HUNTER_THEME.audio?.game;
const items: ContentItem[] = [
  { display: '柿', reading: 'かき' },
  { display: '海', reading: 'うみ' },
];
const boss = HUNTER_THEME.bosses?.[0] as NonNullable<typeof HUNTER_THEME.bosses>[number];

function start(settings: object, withBoss: boolean, level: 'off' | 'full' = 'off') {
  localStorage.clear();
  localStorage.setItem(UNLOCK_KEY, '["hunter"]');
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ themeId: 'hunter', effects: 'off', ...settings }));
  render(
    <StoreProvider store={createMemoryStore()}>
      <MemoryRouter initialEntries={['/play']}>
        <Routes>
          <Route path="/play" element={<Play items={items} boss={withBoss ? boss : undefined} effects={withBoss ? { level, cardModel: null } : undefined} />} />
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

beforeEach(() => Object.values(bgm).forEach((f) => f.mockClear()));
afterEach(cleanup);

describe('練習中の BGM', () => {
  it('ボス戦では曲を流し、フェーズが上がるごとに音量の倍率を上げる', async () => {
    start({}, true); // 既定 gameBgm = boss
    await ready();
    expect(bgm.play).toHaveBeenLastCalledWith(GAME);
    expect(bgm.setScale).toHaveBeenLastCalledWith(PHASE_SCALE[0]);
    type('kaki'); // 2 語中 1 語 = フェーズ 3
    expect(bgm.setScale).toHaveBeenLastCalledWith(PHASE_SCALE[2]);
  });

  it('決着の演出に入ったら、曲をフェードアウトする（勝利も敗北も）', async () => {
    start({}, true, 'full');
    await ready();
    type('kakiumi');
    expect(await screen.findByText('撃破', {}, { timeout: 4000 })).toBeInTheDocument();
    // 画面の更新の直後は、effect（曲を止める）がまだ動いていないことがある
    await waitFor(() => expect(bgm.play).toHaveBeenLastCalledWith(null, END_FADE_MS));
    cleanup();
    bgm.play.mockClear();

    start({}, true, 'full');
    await ready();
    for (let i = 0; i < 6; i++) type('1'); // ミスが許容（5 回）を超える
    expect(await screen.findByText('敗北', {}, { timeout: 4000 })).toBeInTheDocument();
    await waitFor(() => expect(bgm.play).toHaveBeenLastCalledWith(null, END_FADE_MS));
  });

  it('既定（ボス戦だけ）では、通常の練習に曲は流さない（前の画面の曲は止める）', async () => {
    start({}, false);
    await ready();
    expect(bgm.play).toHaveBeenLastCalledWith(null);
    expect(bgm.play).not.toHaveBeenCalledWith(GAME);
  });

  it('「すべての練習」なら、通常の練習でも流す（小さな音量で）', async () => {
    start({ gameBgm: 'all' }, false);
    await ready();
    expect(bgm.play).toHaveBeenLastCalledWith(GAME);
    expect(bgm.setScale).toHaveBeenLastCalledWith(PRACTICE_SCALE);
  });

  it('「鳴らさない」・BGM オフなら、ボス戦でも流さない', async () => {
    start({ gameBgm: 'off' }, true);
    await ready();
    expect(bgm.play).toHaveBeenLastCalledWith(null);
    cleanup();
    bgm.play.mockClear();
    start({ bgm: false, gameBgm: 'all' }, true);
    await ready();
    expect(bgm.play).not.toHaveBeenCalledWith(GAME);
  });
});
