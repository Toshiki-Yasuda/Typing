import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import { clearCodexCache } from '@/content/codex';
import type { Keystroke, SessionRecord } from '@/metrics';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '@/settings/settings';
import { createMemoryStore, type SessionStore } from '@/storage';
import { UNLOCK_KEY } from '@/themes/unlock';
import { CodexScreen } from './CodexScreen';

vi.mock('@/sound/bgm', () => ({ getBgm: () => ({ play: vi.fn(), setScale: vi.fn() }) }));

const DATA = {
  entries: [
    { display: 'ゴン', reading: 'ごん', category: 'character', chapter: 1 },
    { display: 'ジン', reading: 'じん', category: 'character', chapter: 1 },
    { display: 'ねん', reading: 'ねん', category: 'ability', chapter: 2 },
    { display: 'ライセンス', reading: 'らいせんす', category: 'item', chapter: 1 },
  ],
};
const keys = (item: number, n: number, wrong = 0): Keystroke[] =>
  Array.from({ length: n }, (_, i) => ({ t: 100 * (i + 1), key: 'a', code: 'KeyA', expected: 'a', correct: i >= wrong, item }));
const rec = (id: string, targets: string[], keystrokes: Keystroke[], vows?: string[]): SessionRecord => ({
  id, startedAt: 1, mode: 'practice', contentId: 'c', targets, engineVersion: '1', ruleVersion: '1', keystrokes, ...(vows ? { vows } : {}),
});

async function open(store: SessionStore) {
  render(
    <StoreProvider store={store}>
      <MemoryRouter initialEntries={['/codex']}>
        <Routes>
          <Route path="/codex" element={<CodexScreen />} />
          <Route path="/" element={<p>ホームへ戻った</p>} />
          <Route path="/title" element={<p>タイトルへ戻った</p>} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: '図鑑' });
  await screen.findByRole('status');
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(UNLOCK_KEY, '["hunter"]');
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, themeId: 'hunter' }));
  clearCodexCache();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => DATA })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const card = (name: string | RegExp) => screen.getByText(name).closest('li') as HTMLElement;

describe('図鑑', () => {
  it('記録が無ければ、すべて未遭遇（名前を伏せる）。総数を示す', async () => {
    await open(createMemoryStore());
    expect(screen.getByRole('status')).toHaveTextContent('遭遇 0 / 全 4 ・ 習熟 0');
    expect(screen.getAllByText('？？？')).toHaveLength(4);
    expect(screen.queryByText('ゴン')).toBeNull();
    expect(screen.getAllByText('未遭遇')).toHaveLength(4);
  });

  it('打った語は名前が出て「遭遇」、3 回以上・正確率 95% 以上で「習熟」。段階は文字で示す', async () => {
    const store = createMemoryStore();
    await store.add(rec('a', ['ごん', 'じん'], [...keys(0, 10), ...keys(1, 4, 1)]));
    await store.add(rec('b', ['ごん'], keys(0, 10)));
    await store.add(rec('c', ['ごん'], keys(0, 10)));
    await open(store);
    expect(screen.getByRole('status')).toHaveTextContent('遭遇 2 / 全 4 ・ 習熟 1');
    expect(within(card('ゴン')).getByText(/習熟/)).toBeInTheDocument();
    expect(card('ゴン')).toHaveTextContent('3 回・正確率 100%');
    expect(within(card('ジン')).getByText(/遭遇/)).toBeInTheDocument();
    expect(card('ジン')).toHaveTextContent('1 回・正確率 75%');
    expect(screen.getAllByText('？？？')).toHaveLength(2);
  });

  it('縛り付きの記録は数えない', async () => {
    const store = createMemoryStore();
    await store.add(rec('v', ['ごん'], keys(0, 10), ['silent']));
    await open(store);
    expect(screen.getByRole('status')).toHaveTextContent('遭遇 0 / 全 4');
  });

  it('区分で絞れる（人数つきの選択肢。aria-pressed）', async () => {
    await open(createMemoryStore());
    const all = screen.getByRole('button', { name: 'すべて（4）' });
    expect(all).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '人物（2）' }));
    expect(screen.getByRole('button', { name: '人物（2）' })).toHaveAttribute('aria-pressed', 'true');
    expect(all).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '道具（1）' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('未遭遇でも、区分と章はヒントとして出す。Esc でタイトルへ', async () => {
    await open(createMemoryStore());
    expect(screen.getByText('能力・第2章')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByText('タイトルへ戻った')).toBeInTheDocument();
  });

  it('読み込めなければ、そのことを示す', async () => {
    clearCodexCache();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    render(
      <StoreProvider store={createMemoryStore()}>
        <MemoryRouter initialEntries={['/codex']}>
          <Routes>
            <Route path="/codex" element={<CodexScreen />} />
          </Routes>
        </MemoryRouter>
      </StoreProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('図鑑を読み込めませんでした');
  });

  it('図鑑の無いテーマ（標準）では、ホームへ戻す', async () => {
    localStorage.clear();
    render(
      <StoreProvider store={createMemoryStore()}>
        <MemoryRouter initialEntries={['/codex']}>
          <Routes>
            <Route path="/codex" element={<CodexScreen />} />
            <Route path="/" element={<p>ホームへ戻った</p>} />
          </Routes>
        </MemoryRouter>
      </StoreProvider>,
    );
    expect(await screen.findByText('ホームへ戻った')).toBeInTheDocument();
  });
});
