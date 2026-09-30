import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import type { ContentItem } from '@/content';
import type { EffectLevel } from '@/effects/level';
import { createMemoryStore } from '@/storage';
import { SETTINGS_KEY } from '@/settings/settings';
import { HUNTER_THEME } from '@/themes/themes';
import { UNLOCK_KEY } from '@/themes/unlock';
import { FX_MS, Play } from './Play';
import { Result } from './Result';

const items: ContentItem[] = [
  { display: '柿', reading: 'かき' },
  { display: '海', reading: 'うみ' },
];
const boss = (id: string) => HUNTER_THEME.bosses?.find((b) => b.id === id) as NonNullable<typeof HUNTER_THEME.bosses>[number];

function renderBoss(id: string, level: EffectLevel) {
  const store = createMemoryStore();
  render(
    <StoreProvider store={store}>
      <MemoryRouter initialEntries={['/play']}>
        <Routes>
          <Route path="/play" element={<Play items={items} boss={boss(id)} mode={`boss:${id}`} effects={{ level, cardModel: null }} />} />
          <Route path="/result/:id" element={<Result />} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
  return store;
}
const ready = async () => {
  await screen.findByRole('region', { name: 'お題' });
  await act(async () => {});
};
const press = (key: string) =>
  act(() => {
    fireEvent.keyDown(window, { key, code: key === 'Enter' ? 'Enter' : `Key${key.toUpperCase()}` });
  });
const typeKeys = (keys: string) => [...keys].forEach(press);
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const layer = () => document.querySelector('.fx-layer');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  localStorage.setItem(UNLOCK_KEY, '["hunter"]');
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ themeId: 'hunter' }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ボス戦の演出', () => {
  it('登場の演出が出ても、打鍵はすぐ受け付ける。時間が来ると消える', async () => {
    renderBoss('chapter1', 'full');
    await ready();
    expect(layer()?.getAttribute('data-kind')).toBe('intro');
    expect(screen.getByText('第1章')).toBeInTheDocument();
    expect(document.querySelector('.fx-banner')).not.toBeNull(); // 文字は上部の帯（お題に重ねない）
    expect(layer()?.getAttribute('aria-hidden')).toBe('true'); // 飾り。同じ内容は画面の文字でも伝える

    typeKeys('ka'); // 演出の最中に打てる
    expect(screen.getByText('コンボ 2')).toBeInTheDocument();

    await advance(FX_MS.intro + 50);
    expect(layer()).toBeNull();
  });

  it('フェーズが上がると、その演出が出る', async () => {
    renderBoss('chapter1', 'full');
    await ready();
    await advance(FX_MS.intro + 50);
    typeKeys('kaki'); // 2 語中 1 語 = フェーズ 3
    expect(layer()?.getAttribute('data-kind')).toBe('phase');
    expect(screen.getByText('PHASE 3')).toBeInTheDocument();
    await advance(FX_MS.phase + 50);
    expect(layer()).toBeNull();
  });

  it('勝つと決着の演出を見せてから結果へ。Enter で飛ばせる', async () => {
    renderBoss('chapter1', 'full');
    await ready();
    typeKeys('kakiumi');
    expect(await screen.findByText('撃破')).toBeInTheDocument();
    expect(screen.getByText(boss('chapter1').defeat)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /ヒソカを倒した/ })).toBeNull(); // まだ結果には行かない

    press('Enter');
    expect(await screen.findByRole('heading', { name: /ヒソカを倒した（ランク S）/ })).toBeInTheDocument();
  });

  it('飛ばさなくても、時間が来れば結果へ進む（控えめは短い）', async () => {
    renderBoss('chapter1', 'reduced');
    await ready();
    expect(layer()?.getAttribute('data-fx')).toBe('reduced'); // 動かない
    typeKeys('kakiumi');
    expect(await screen.findByText('撃破')).toBeInTheDocument();
    await advance(FX_MS.finishReduced - 100);
    expect(screen.queryByRole('heading', { name: /ヒソカを倒した/ })).toBeNull();
    await advance(200);
    expect(await screen.findByRole('heading', { name: /ヒソカを倒した/ })).toBeInTheDocument();
    expect(FX_MS.finishReduced).toBeLessThan(FX_MS.finishFull);
  });

  it('敗北の演出。演出中の打鍵は記録に入らない', async () => {
    const store = renderBoss('chapter6', 'full'); // ミスの余裕 1 回
    await ready();
    press('1');
    press('1');
    expect(await screen.findByText('敗北')).toBeInTheDocument();
    typeKeys('kaki'); // 演出中の打鍵は無視
    press('Enter');
    expect(await screen.findByRole('heading', { name: /メルエムに敗れた（ランク D）/ })).toBeInTheDocument();
    expect((await store.list())[0]?.keystrokes).toHaveLength(2);
  });

  it('演出オフでは、演出も待ちも無く、すぐ結果へ', async () => {
    renderBoss('chapter1', 'off');
    await ready();
    expect(layer()).toBeNull();
    typeKeys('kakiumi');
    expect(await screen.findByRole('heading', { name: /ヒソカを倒した（ランク S）/ })).toBeInTheDocument();
    expect(layer()).toBeNull();
  });
});
