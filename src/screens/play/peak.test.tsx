import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import type { ContentPack } from '@/content';
import { createMemoryStore } from '@/storage';
import { SETTINGS_KEY } from '@/settings/settings';
import { Play } from '../Play';
import { FINISH_PEAK_MS, finishPeakMs } from './peak';

vi.mock('@/sound/bgm', () => ({ getBgm: () => ({ play: vi.fn(), setScale: vi.fn() }) }));

const pack: ContentPack = { id: 't', name: 't', items: [{ display: '柿', reading: 'かき' }] };
const press = (key: string) => act(() => void fireEvent.keyDown(window, { key, code: `Key${key.toUpperCase()}` }));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe('finishPeakMs（結果へ移る前の待ち）', () => {
  it('演出「標準」の本番だけ待つ。控えめ・オフは待たない。単体テスト中は待たない', () => {
    vi.stubEnv('MODE', 'production');
    expect(finishPeakMs('full')).toBe(FINISH_PEAK_MS);
    expect(finishPeakMs('reduced')).toBe(0);
    expect(finishPeakMs('off')).toBe(0);
    vi.stubEnv('MODE', 'test');
    expect(finishPeakMs('full')).toBe(0);
  });
  it('待ち時間は、演出が見え、結果を待たせすぎない範囲（0.4〜1 秒）', () => {
    expect(FINISH_PEAK_MS).toBeGreaterThanOrEqual(400);
    expect(FINISH_PEAK_MS).toBeLessThanOrEqual(1000);
  });
});

describe('練習を打ち終えたあと', () => {
  async function play(effects: string) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ effects }));
    const store = createMemoryStore();
    render(
      <StoreProvider store={store}>
        <MemoryRouter initialEntries={['/play']}>
          <Routes>
            <Route path="/play" element={<Play pack={pack} count={1} items={pack.items} />} />
            <Route path="/result/:id" element={<p>結果へ移動</p>} />
            <Route path="/" element={<p>ホームへ戻った</p>} />
          </Routes>
        </MemoryRouter>
      </StoreProvider>,
    );
    await screen.findByRole('region', { name: 'お題' });
    await act(async () => {});
    return store;
  }

  it('演出「標準」（本番相当）: 保存してから、待って結果へ。待つ間の打鍵は記録に入らない', async () => {
    vi.stubEnv('MODE', 'production');
    const store = await play('full');
    for (const k of 'kaki') press(k);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });
    expect(await store.list()).toHaveLength(1); // 保存は待つ前に済んでいる
    expect(screen.queryByText('結果へ移動')).toBeNull();
    press('z'); // 待つ間の入力
    expect(await screen.findByText('結果へ移動', {}, { timeout: 2000 })).toBeInTheDocument();
    expect((await store.list())[0]?.keystrokes).toHaveLength(4);
  });

  it('打ち終えると、光のレールの進みが端（100%）になる（達成の演出）', async () => {
    vi.stubEnv('MODE', 'production');
    await play('full');
    const progress = () => screen.getByTestId('air-layer').style.getPropertyValue('--fx-progress');
    expect(progress()).toBe('0');
    for (const k of 'kaki') press(k);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(progress()).toBe('1');
  });

  it('待つ間に Esc を押すとホームへ戻り、あとで結果へ移らない', async () => {
    vi.stubEnv('MODE', 'production');
    await play('full');
    for (const k of 'kaki') press(k);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    press('Escape');
    expect(await screen.findByText('ホームへ戻った')).toBeInTheDocument();
    await act(async () => {
      await new Promise((r) => setTimeout(r, FINISH_PEAK_MS + 200));
    });
    expect(screen.queryByText('結果へ移動')).toBeNull();
  });

  it('演出「オフ」: 待たずに結果へ', async () => {
    vi.stubEnv('MODE', 'production');
    await play('off');
    for (const k of 'kaki') press(k);
    expect(await screen.findByText('結果へ移動', {}, { timeout: 400 })).toBeInTheDocument();
  });
});
