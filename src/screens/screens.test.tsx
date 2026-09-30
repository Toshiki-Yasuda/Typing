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

/**
 * 練習画面の準備完了を待つ。お題の表示だけでは、キー受付のリスナー（effect）の登録が終わっていない
 * ことがあるので、保留中の effect を流してから返す。
 */
const ready = async () => {
  const region = await screen.findByRole('region', { name: 'お題' });
  await act(async () => {});
  return region;
};

const press = (key: string, extra: KeyboardEventInit = {}) =>
  act(() => {
    fireEvent.keyDown(window, { key, code: `Key${key.toUpperCase()}`, ...extra });
  });
const typeKeys = (keys: string) => [...keys].forEach((k) => press(k));

describe('Play', () => {
  it('お題・読み・ローマ字ガイドを表示する', async () => {
    renderApp('/play');
    await ready();
    // random=()=>0 の並べ替えは [うみ, かき]... どちらが先でも、表示されるお題の読みは pack のどちらか
    const target = screen.getByRole('region', { name: 'お題' });
    expect(target.textContent).toMatch(/柿|海/);
    expect(screen.getByLabelText('進捗')).toHaveTextContent('1 / 2');
  });

  it('打ち切ると保存されて、結果画面に移る', async () => {
    const store = renderApp('/play');
    await ready();
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
    await ready();
    const first = screen.getByRole('region', { name: 'お題' }).textContent?.includes('柿') ? 'kaki' : 'umi';
    const second = first === 'kaki' ? 'umi' : 'kaki';
    press('z');
    expect(screen.getByRole('region', { name: 'お題' }).className).toContain('ring-danger');
    // 対照: 誤打のときは、お題カードに「ミス」の表示が出る（IME 中の入力では出ないことを別のテストで確かめている）
    expect(screen.getByText('ミス', { selector: 'span[aria-hidden]' })).toBeInTheDocument();
    expect(screen.getByLabelText('進捗')).toHaveTextContent('1 / 2');
    typeKeys(first + second);

    await screen.findByRole('heading', { name: '結果' });
    const saved = (await store.list())[0] as SessionRecord;
    expect(saved.keystrokes.filter((k) => !k.correct)).toHaveLength(1);
    expect(screen.getByText('ミスの多かったキー')).toBeInTheDocument();
  });

  it('IME 変換中の入力は打鍵にせず、警告を出す', async () => {
    renderApp('/play');
    await ready();
    press('k', { isComposing: true });
    expect(screen.getByRole('status')).toHaveTextContent('半角/英数');
    expect(screen.getByLabelText('進捗')).toHaveTextContent('1 / 2');
    press('a', { keyCode: 229 });
    // お題カードの「ミス」表示（HUD の数字欄の「ミス」ラベルとは別）
    expect(screen.queryByText('ミス', { selector: 'span[aria-hidden]' })).not.toBeInTheDocument();
  });

  it('Ctrl 併用・自動連打は打鍵にしない', async () => {
    renderApp('/play');
    await ready();
    const target = () => screen.getByRole('region', { name: 'お題' }).className;
    press('k', { ctrlKey: true });
    press('k', { repeat: true });
    expect(target()).not.toContain('bg-danger');
  });

  it('過去にミスの多いキーがあれば、弱点モードで選ぶ。記録が無ければ通常モード', async () => {
    const store = createMemoryStore();
    renderApp('/play', store);
    await ready();
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
    await ready();
    press('1');
    const next = screen.getByRole('region', { name: 'お題' }).textContent?.includes('柿') ? 'kaki' : 'umi';
    typeKeys(next + (next === 'kaki' ? 'umi' : 'kaki'));
    await screen.findByRole('heading', { name: '結果' });
    const modes = (await again.list()).map((r) => r.mode).sort();
    expect(modes).toEqual(['adaptive', 'practice']);
  });

  it('ウィンドウが非アクティブの間は案内を出し、戻ると消える（進行は保たれる）', async () => {
    renderApp('/play');
    await ready();
    expect(screen.queryByText(/アクティブではありません/)).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('アクティブではありません');
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(screen.queryByText(/アクティブではありません/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('進捗')).toHaveTextContent('1 / 2');
  });

  it('タブが隠れている間も同様', async () => {
    renderApp('/play');
    await ready();
    const setHidden = (hidden: boolean) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
    };
    setHidden(true);
    expect(screen.getByRole('status')).toHaveTextContent('アクティブではありません');
    setHidden(false);
    expect(screen.queryByText(/アクティブではありません/)).not.toBeInTheDocument();
  });

  it('Esc でホームに戻る', async () => {
    renderApp('/play');
    await ready();
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

  it('記録が 20 件以上あって未バックアップなら促し、書き出すと消える。少なければ出ない', async () => {
    const few = createMemoryStore();
    for (let i = 0; i < 19; i++) await few.add(record(`f${i}`));
    renderApp('/', few);
    await screen.findAllByRole('link', { name: /打鍵\/分/ });
    expect(screen.queryByTestId('backup-nudge')).toBeNull();
    cleanup();

    const many = createMemoryStore();
    for (let i = 0; i < 20; i++) await many.add(record(`m${i}`));
    renderApp('/', many);
    expect(await screen.findByTestId('backup-nudge')).toHaveTextContent('記録が 20 件あります。まだ書き出していません。');
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    act(() => screen.getByRole('button', { name: '記録を書き出す' }).click());
    await waitFor(() => expect(screen.queryByTestId('backup-nudge')).toBeNull());
    expect(localStorage.getItem('typing.backup.v1')).not.toBeNull();
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
