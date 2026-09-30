import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import type { ContentPack } from '@/content';
import { createMemoryStore } from '@/storage';
import type { SoundKind } from '@/sound/player';
import { Play } from './Play';

const played: SoundKind[] = [];
let throwing = false;
vi.mock('@/sound/useSoundPlayer', () => ({
  useSoundPlayer: () => ({
    play: (kind: SoundKind) => {
      played.push(kind);
      if (throwing) throw new Error('音が鳴らせない');
    },
  }),
}));

const pack: ContentPack = { id: 'test', name: 'test', items: [{ display: '柿', reading: 'かき' }] };

async function start() {
  const store = createMemoryStore();
  render(
    <StoreProvider store={store}>
      <MemoryRouter initialEntries={['/play']}>
        <Routes>
          <Route path="/play" element={<Play pack={pack} count={1} />} />
          <Route path="/result/:id" element={<p>結果へ移動</p>} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
  await screen.findByRole('region', { name: 'お題' });
  await act(async () => {});
  return store;
}
const press = (key: string) =>
  act(() => {
    fireEvent.keyDown(window, { key, code: `Key${key.toUpperCase()}` });
  });

beforeEach(() => {
  played.length = 0;
  throwing = false;
});

describe('練習中の効果音', () => {
  it('正しい打鍵・ミス・完了で、それぞれの音を鳴らす', async () => {
    const store = await start();
    press('k'); // 正
    press('1'); // ミス
    press('a');
    press('k');
    press('i'); // 完了
    expect(await screen.findByText('結果へ移動')).toBeInTheDocument();
    expect(played).toEqual(['type', 'miss', 'type', 'type', 'complete']);
    expect((await store.list())[0]?.keystrokes).toHaveLength(5);
  });

  it('音が例外を投げても、判定と記録は同じ', async () => {
    throwing = true;
    const store = await start();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const k of ['k', '1', 'a', 'k', 'i']) press(k);
    expect(await screen.findByText('結果へ移動')).toBeInTheDocument();
    const rec = (await store.list())[0];
    expect(rec?.keystrokes.map((k) => k.correct)).toEqual([true, false, true, true, true]);
  });
});
