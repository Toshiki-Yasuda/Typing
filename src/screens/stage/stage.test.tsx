import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import { clearThemePackCache } from '@/content/themePack';
import type { Keystroke, SessionRecord } from '@/metrics';
import { BOSS_PROGRESS_KEY } from '@/session/bossProgress';
import { stageMode } from '@/session/stageProgress';
import { SETTINGS_KEY } from '@/settings/settings';
import { createMemoryStore, type SessionStore } from '@/storage';
import { HUNTER_THEME } from '@/themes/themes';
import { UNLOCK_KEY } from '@/themes/unlock';
import { Result } from '../Result';
import { StageRoute } from './StageRoute';
import { StageSelectRoute } from './StageSelect';

vi.mock('@/sound/bgm', () => ({ getBgm: () => ({ play: vi.fn(), unlock: vi.fn(), stop: vi.fn(), setEnabled: vi.fn(), setVolume: vi.fn() }) }));

const chapters = HUNTER_THEME.chapters ?? [];
const record = (stageId: string, correct: number, misses: number, id = `${stageId}-${correct}-${misses}`): SessionRecord => {
  const keystrokes: Keystroke[] = [];
  for (let i = 0; i < correct + misses; i++) keystrokes.push({ t: (i + 1) * 100, key: 'a', code: '', expected: 'a', correct: i < correct, item: 0 });
  return { id, startedAt: 1, mode: stageMode(stageId), contentId: 'x', targets: ['a'], engineVersion: '1', ruleVersion: '1', keystrokes };
};

function app(initial: string, store: SessionStore = createMemoryStore()) {
  render(
    <StoreProvider store={store}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/stages" element={<StageSelectRoute />} />
          <Route path="/stage/:id" element={<StageRoute />} />
          <Route path="/boss/:id" element={<p>ボス画面</p>} />
          <Route path="/result/:id" element={<Result />} />
          <Route path="/title" element={<p>タイトル画面</p>} />
          <Route path="/" element={<p>ホーム画面</p>} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
  return store;
}
const setup = (extra: object = {}) => {
  localStorage.clear();
  localStorage.setItem(UNLOCK_KEY, '["hunter"]');
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ themeId: 'hunter', effects: 'off', count: 5, ...extra }));
};

beforeEach(() => {
  clearThemePackCache();
  // ステージの語彙は public/ から返す（本番の配信の代わり）
  vi.stubGlobal('fetch', async (url: URL | string) => {
    const path = new URL(String(url)).pathname.replace(/^\//, '');
    try {
      return new Response(readFileSync(`public/${path}`, 'utf8'));
    } catch {
      return new Response('', { status: 404 });
    }
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ステージ選択', () => {
  it('章の切り替えと、その章のステージ・ボスが並ぶ。未挑戦は文字で示す', async () => {
    setup();
    app('/stages');
    expect(await screen.findByRole('heading', { level: 1, name: 'ステージ選択' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: '章' });
    expect(within(nav).getAllByRole('button')).toHaveLength(7);
    const first = chapters[0]!;
    expect(screen.getByRole('heading', { level: 2, name: new RegExp(`第1章 ${first.title}`) })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /未挑戦/ })).toHaveLength(5);
    expect(screen.getByRole('link', { name: /ボス ヒソカに挑戦する/ })).toHaveAttribute('href', '/boss/chapter1');

    fireEvent.click(within(nav).getByRole('button', { name: /第3章/ }));
    expect(screen.getByRole('heading', { level: 2, name: /第3章 幻影旅団編/ })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /第3章/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(nav).getByRole('button', { name: /第1章/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('クリア済み（正確率 90% 以上）・挑戦中・未挑戦を、記号と文字で区別する。ボスの最高ランクも出る', async () => {
    setup();
    localStorage.setItem(BOSS_PROGRESS_KEY, JSON.stringify({ chapter1: { attempts: 2, wins: 1, best: 'A' } }));
    const store = createMemoryStore();
    await store.add(record('c1s1', 19, 1)); // 95%
    await store.add(record('c1s2', 8, 2)); // 80%
    app('/stages', store);
    await screen.findByText(/✓ クリア済み/);
    expect(screen.getByText(/1回・最高正確率 95%/)).toBeInTheDocument();
    expect(screen.getByText(/△ 挑戦中/)).toBeInTheDocument();
    expect(screen.getByText(/1回・最高正確率 80%/)).toBeInTheDocument();
    expect(screen.getByText('最高ランク A')).toBeInTheDocument();
    expect(screen.getByText('1 / 5 クリア')).toBeInTheDocument(); // 章の進み具合
  });

  it('最初に開く章は、終えていないステージがある最初の章', async () => {
    setup();
    const store = createMemoryStore();
    for (const s of chapters[0]!.stages) await store.add(record(s.id, 20, 0));
    localStorage.setItem(BOSS_PROGRESS_KEY, JSON.stringify({ chapter1: { attempts: 1, wins: 1, best: 'S' } }));
    app('/stages', store);
    expect(await screen.findByRole('heading', { level: 2, name: /第2章/ })).toBeInTheDocument();
  });

  it('Esc・リンクでタイトルへ。章の無いテーマ（標準）ではホームへ戻す', async () => {
    setup();
    app('/stages');
    await screen.findByRole('heading', { level: 1, name: 'ステージ選択' });
    act(() => void fireEvent.keyDown(window, { key: 'Escape' }));
    expect(screen.getByText('タイトル画面')).toBeInTheDocument();
    cleanup();

    setup({ themeId: 'neutral' });
    app('/stages');
    expect(await screen.findByText('ホーム画面')).toBeInTheDocument();
  });
});

describe('ステージの練習', () => {
  it('語彙を読み込んで出題し、打ち切ると結果に「ステージクリア」と次への案内が出る', async () => {
    setup();
    const store = app('/stage/c1s1');
    const region = await screen.findByRole('region', { name: 'お題' });
    await act(async () => {});
    expect(screen.getByRole('heading', { level: 1, name: 'ステージ: ' + chapters[0]!.stages[0]!.name })).toBeInTheDocument();
    for (let i = 1; i <= 5; i++) {
      await waitFor(() => expect(screen.getByLabelText('進捗')).toHaveTextContent(`${i} / 5`));
      const romaji = (screen.getByLabelText('ローマ字ガイド').textContent ?? '').replaceAll('␣', ' ');
      for (const k of romaji) act(() => void fireEvent.keyDown(window, { key: k, code: `Key${k.toUpperCase()}` }));
    }
    expect(region).toBeDefined();
    expect(await screen.findByRole('heading', { level: 2, name: /ステージクリア/ })).toBeInTheDocument();
    expect(screen.getByText(/正確率 100.0%/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /次のステージ: / })).toHaveAttribute('href', '/stage/c1s2');
    expect(screen.getByRole('link', { name: 'ステージ選択へ' })).toHaveAttribute('href', '/stages');
    expect((await store.list())[0]?.mode).toBe('stage:c1s1');
  });

  it('クリアならず（正確率 90% 未満）のときは、基準を文字で示し、次へは案内しない', async () => {
    setup();
    const store = createMemoryStore();
    await store.add(record('c1s1', 8, 2, 'weak'));
    app('/result/weak', store);
    expect(await screen.findByRole('heading', { level: 2, name: /クリアならず/ })).toBeInTheDocument();
    expect(screen.getByText(/90% 以上でクリア/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /次のステージ/ })).toBeNull();
  });

  it('最後のステージをクリアすると、その章のボスへ案内する', async () => {
    setup();
    const store = createMemoryStore();
    const last = chapters[0]!.stages.at(-1)!;
    await store.add(record(last.id, 10, 0, 'last'));
    app('/result/last', store);
    expect(await screen.findByRole('link', { name: 'この章のボスに挑戦' })).toHaveAttribute('href', '/boss/chapter1');
  });

  it('存在しないステージ・語彙を取得できないときは、案内を出す', async () => {
    setup();
    app('/stage/nothing');
    expect(await screen.findByText(/そのステージがありません/)).toBeInTheDocument();
    cleanup();
    vi.stubGlobal('fetch', async () => new Response('', { status: 500 }));
    clearThemePackCache();
    app('/stage/c1s1');
    expect(await screen.findByText(/語彙を読み込めませんでした/)).toBeInTheDocument();
  });
});
