import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import type { ContentItem } from '@/content';
import { BOSS_PROGRESS_KEY } from '@/session/bossProgress';
import { SETTINGS_KEY } from '@/settings/settings';
import { HUNTER_THEME } from '@/themes/themes';
import { UNLOCK_KEY } from '@/themes/unlock';
import { createMemoryStore } from '@/storage';
import { Home } from './Home';
import { Play } from './Play';
import { Result } from './Result';

const items: ContentItem[] = [
  { display: '柿', reading: 'かき' },
  { display: '海', reading: 'うみ' },
];
const boss = (id: string) => HUNTER_THEME.bosses?.find((b) => b.id === id) as NonNullable<typeof HUNTER_THEME.bosses>[number];

function renderBoss(id: string | null) {
  const store = createMemoryStore();
  render(
    <StoreProvider store={store}>
      <MemoryRouter initialEntries={['/play']}>
        <Routes>
          <Route path="/play" element={<Play items={items} boss={id ? boss(id) : undefined} mode={id ? `boss:${id}` : 'practice'} />} />
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
    fireEvent.keyDown(window, { key, code: `Key${key.toUpperCase()}` });
  });
const typeKeys = (keys: string) => [...keys].forEach(press);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(UNLOCK_KEY, '["hunter"]');
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ themeId: 'hunter' }));
});
afterEach(cleanup);

describe('ボス戦', () => {
  it('戦闘中は、ボスの体力・フェーズ・ミスの余裕・台詞を文字で示し、お題を打つと体力が減る', async () => {
    renderBoss('chapter1'); // maxMisses 5
    await ready();
    expect(screen.getByRole('heading', { name: 'ボス戦: ヒソカ' })).toBeInTheDocument();
    expect(screen.getByText('ボスの体力 2 / 2')).toBeInTheDocument();
    expect(screen.getByText('ミスの余裕 5 回')).toBeInTheDocument();
    expect(screen.getByText(boss('chapter1').intro)).toBeInTheDocument();

    typeKeys('kaki');
    expect(screen.getByText('ボスの体力 1 / 2')).toBeInTheDocument();
    expect(screen.getByText('フェーズ 3 / 4')).toBeInTheDocument();
    // フェーズ 3 に入った台詞（2語中1語終了 = 50%）
    expect(screen.getByText(boss('chapter1').phaseMessages[1] as string)).toBeInTheDocument();
    press('1');
    expect(screen.getByText('ミスの余裕 4 回')).toBeInTheDocument();
    expect(screen.getByText('コンボ 0')).toBeInTheDocument();
  });

  it('勝つと結果画面にボスの結果（ランク・台詞）が出て、戦績が残る', async () => {
    const store = renderBoss('chapter1');
    await ready();
    typeKeys('kaki');
    press('1'); // 1 ミス → ランク A
    typeKeys('umi');
    expect(await screen.findByRole('heading', { name: /ヒソカを倒した（ランク A）/ })).toBeInTheDocument();
    expect(screen.getByText(boss('chapter1').defeat)).toBeInTheDocument();
    expect(screen.getByText(/ミス 1 回（許容 5 回）/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(BOSS_PROGRESS_KEY) as string)).toEqual({
      chapter1: { attempts: 1, wins: 1, best: 'A' },
    });
    expect((await store.list())[0]?.mode).toBe('boss:chapter1');
  });

  it('ミスが許容を超えると敗北。以降の打鍵は受けず、記録は打ち始めたお題までで 1 回だけ保存される', async () => {
    const store = renderBoss('chapter6'); // maxMisses 1
    await ready();
    press('1');
    press('1'); // 2 回目で敗北
    press('k');
    press('k'); // 敗北後は無視される
    expect(await screen.findByRole('heading', { name: /メルエムに敗れた（ランク D）/ })).toBeInTheDocument();
    const saved = await store.list();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.keystrokes).toHaveLength(2);
    expect(saved[0]?.targets).toHaveLength(1); // 打ち始めた 1 語目まで
    expect(JSON.parse(localStorage.getItem(BOSS_PROGRESS_KEY) as string)).toEqual({
      chapter6: { attempts: 1, wins: 0, best: null },
    });
  });

  it('ボス戦でも、打鍵の判定は通常の練習と同じ（正誤・期待キー・お題の番号）', async () => {
    const keys = 'ka1kiu2mi';
    const a = renderBoss('chapter1');
    await ready();
    typeKeys(keys);
    await screen.findByRole('heading', { name: '結果' });
    const withBoss = (await a.list())[0]?.keystrokes.map(({ key, expected, correct, item }) => ({ key, expected, correct, item }));
    cleanup();

    const b = renderBoss(null);
    await ready();
    typeKeys(keys);
    await screen.findByRole('heading', { name: '結果' });
    const plain = (await b.list())[0]?.keystrokes.map(({ key, expected, correct, item }) => ({ key, expected, correct, item }));
    expect(withBoss).toEqual(plain);
    expect(plain?.filter((k) => !k.correct)).toHaveLength(2);
  });
});

describe('ホームのボス一覧', () => {
  it('テーマを開いていれば 7 体が出て、未挑戦・戦績が文字で分かる', async () => {
    localStorage.setItem(BOSS_PROGRESS_KEY, JSON.stringify({ chapter1: { attempts: 3, wins: 2, best: 'S' } }));
    render(
      <StoreProvider store={createMemoryStore()}>
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      </StoreProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'ボス戦' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /に挑戦する/ })).toHaveLength(7);
    expect(screen.getByText(/挑戦 3回・最高ランク S/)).toBeInTheDocument();
    expect(screen.getAllByText(/未挑戦/).length).toBeGreaterThanOrEqual(6);
  });

  it('標準テーマではボス戦は出ない', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ themeId: 'neutral' }));
    render(
      <StoreProvider store={createMemoryStore()}>
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      </StoreProvider>,
    );
    await screen.findByRole('heading', { name: 'Typing' });
    expect(screen.queryByRole('heading', { name: 'ボス戦' })).toBeNull();
  });
});
