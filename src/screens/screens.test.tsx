import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import type { ContentPack } from '@/content';
import { exportSessions, createMemoryStore, type SessionStore } from '@/storage';
import type { SessionRecord } from '@/metrics';
import { Home } from './Home';
import { Play } from './Play';
import { Result } from './Result';

const pack: ContentPack = {
  id: 'test',
  name: 'test',
  items: [
    { display: '柿', reading: 'かき' },
    { display: '海', reading: 'うみ' },
  ],
};

function renderApp(initial: string, store: SessionStore = createMemoryStore()) {
  render(
    <StoreProvider store={store}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Play pack={pack} count={2} random={() => 0} />} />
          <Route path="/result/:id" element={<Result />} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
  return store;
}

const press = (key: string, extra: KeyboardEventInit = {}) =>
  act(() => {
    fireEvent.keyDown(window, { key, code: `Key${key.toUpperCase()}`, ...extra });
  });
const typeKeys = (keys: string) => [...keys].forEach((k) => press(k));

describe('Play', () => {
  it('お題・読み・ローマ字ガイドを表示する', async () => {
    renderApp('/play');
    await screen.findByRole('region', { name: 'お題' });
    // random=()=>0 の並べ替えは [うみ, かき]... どちらが先でも、表示されるお題の読みは pack のどちらか
    const target = screen.getByRole('region', { name: 'お題' });
    expect(target.textContent).toMatch(/柿|海/);
    expect(screen.getByLabelText('進捗')).toHaveTextContent('1 / 2');
  });

  it('打ち切ると保存されて、結果画面に移る', async () => {
    const store = renderApp('/play');
    await screen.findByRole('region', { name: 'お題' });
    const first = screen.getByRole('region', { name: 'お題' }).textContent?.includes('柿') ? 'kaki' : 'umi';
    const second = first === 'kaki' ? 'umi' : 'kaki';
    typeKeys(first);
    expect(screen.getByLabelText('進捗')).toHaveTextContent('2 / 2');
    typeKeys(second);

    expect(await screen.findByRole('heading', { name: '結果' })).toBeInTheDocument();
    const saved = await store.list();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.keystrokes).toHaveLength(7);
    expect(screen.getByText('正確率').nextElementSibling).toHaveTextContent('100.0%');
    expect(screen.getByText('打鍵効率').nextElementSibling).toHaveTextContent('100.0%');
    expect(screen.getByText('ミスはありませんでした。')).toBeInTheDocument();
  });

  it('誤打鍵で一瞬ハイライトし、進行は変わらない。ミスは結果に出る', async () => {
    const store = renderApp('/play');
    await screen.findByRole('region', { name: 'お題' });
    const first = screen.getByRole('region', { name: 'お題' }).textContent?.includes('柿') ? 'kaki' : 'umi';
    const second = first === 'kaki' ? 'umi' : 'kaki';
    press('z');
    expect(screen.getByRole('region', { name: 'お題' }).className).toContain('bg-danger');
    expect(screen.getByLabelText('進捗')).toHaveTextContent('1 / 2');
    typeKeys(first + second);

    await screen.findByRole('heading', { name: '結果' });
    const saved = (await store.list())[0] as SessionRecord;
    expect(saved.keystrokes.filter((k) => !k.correct)).toHaveLength(1);
    expect(screen.getByText('ミスの多かったキー')).toBeInTheDocument();
  });

  it('IME 変換中の入力は打鍵にせず、警告を出す', async () => {
    renderApp('/play');
    await screen.findByRole('region', { name: 'お題' });
    press('k', { isComposing: true });
    expect(screen.getByRole('status')).toHaveTextContent('半角/英数');
    expect(screen.getByLabelText('進捗')).toHaveTextContent('1 / 2');
    press('a', { keyCode: 229 });
    expect(screen.queryByText(/ミス/)).not.toBeInTheDocument();
  });

  it('Ctrl 併用・自動連打は打鍵にしない', async () => {
    renderApp('/play');
    await screen.findByRole('region', { name: 'お題' });
    const target = () => screen.getByRole('region', { name: 'お題' }).className;
    press('k', { ctrlKey: true });
    press('k', { repeat: true });
    expect(target()).not.toContain('bg-danger');
  });

  it('過去にミスの多いキーがあれば、弱点モードで選ぶ。記録が無ければ通常モード', async () => {
    const store = createMemoryStore();
    renderApp('/play', store);
    await screen.findByRole('region', { name: 'お題' });
    // 通常モードの記録を1件作る
    const target = screen.getByRole('region', { name: 'お題' }).textContent?.includes('柿') ? 'kaki' : 'umi';
    const other = target === 'kaki' ? 'umi' : 'kaki';
    press('1'); // ミスを1つ入れる
    typeKeys(target + other);
    await screen.findByRole('heading', { name: '結果' });
    expect((await store.list())[0]?.mode).toBe('practice');

    // 記録がある状態で新しく始めると、弱点モード
    const again = createMemoryStore();
    await again.addMany(await store.list());
    cleanup();
    renderApp('/play', again);
    await screen.findByRole('region', { name: 'お題' });
    press('1');
    const next = screen.getByRole('region', { name: 'お題' }).textContent?.includes('柿') ? 'kaki' : 'umi';
    typeKeys(next + (next === 'kaki' ? 'umi' : 'kaki'));
    await screen.findByRole('heading', { name: '結果' });
    const modes = (await again.list()).map((r) => r.mode).sort();
    expect(modes).toEqual(['adaptive', 'practice']);
  });

  it('Esc でホームに戻る', async () => {
    renderApp('/play');
    await screen.findByRole('region', { name: 'お題' });
    press('Escape');
    expect(screen.getByRole('heading', { name: 'Typing' })).toBeInTheDocument();
  });
});

describe('Home', () => {
  const record = (id: string): SessionRecord => ({
    id,
    startedAt: 1_700_000_000_000,
    mode: 'practice',
    contentId: 'test',
    targets: ['か'],
    engineVersion: '1',
    ruleVersion: 'input-rules-v1',
    keystrokes: [
      { t: 0, key: 'k', code: 'KeyK', expected: 'k', correct: true, item: 0 },
      { t: 100, key: 'a', code: 'KeyA', expected: 'a', correct: true, item: 0 },
    ],
  });

  it('記録が無ければ案内を出す', async () => {
    renderApp('/');
    expect(await screen.findByText('まだ記録がありません。')).toBeInTheDocument();
  });

  it('最近の記録から結果画面に移れる', async () => {
    const store = createMemoryStore();
    await store.add(record('abc'));
    renderApp('/', store);
    const link = await screen.findByRole('link', { name: /打鍵\/分/ });
    expect(link).toHaveAttribute('href', '/result/abc');
    act(() => link.click());
    expect(await screen.findByRole('heading', { name: '結果' })).toBeInTheDocument();
  });

  it('Enter で練習を始める', async () => {
    renderApp('/');
    press('Enter');
    expect(await screen.findByRole('region', { name: 'お題' })).toBeInTheDocument();
  });

  it('書き出したファイルを取り込める。不正なファイルはエラー表示', async () => {
    const store = renderApp('/');
    const input = screen.getByLabelText('取り込むファイル');
    const file = (text: string) => new File([text], 'x.json', { type: 'application/json' });

    fireEvent.change(input, { target: { files: [file(exportSessions([record('a'), record('b')]))] } });
    expect(await screen.findByText('2 件を取り込みました')).toBeInTheDocument();
    expect(await store.list()).toHaveLength(2);

    fireEvent.change(input, { target: { files: [file('これはJSONではない')] } });
    expect(await screen.findByText(/取り込めません: JSON として読み込めません/)).toBeInTheDocument();
    expect(await store.list()).toHaveLength(2);
  });
});

describe('Result', () => {
  it('存在しない記録は案内を出す', async () => {
    renderApp('/result/none');
    await waitFor(() => expect(screen.getByText('この記録は見つかりませんでした。')).toBeInTheDocument());
  });
});
