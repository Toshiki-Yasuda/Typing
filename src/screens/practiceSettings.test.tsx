import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import { ENGLISH_PACK } from '@/content';
import { SETTINGS_KEY } from '@/settings/settings';
import { createMemoryPackStore, createMemoryStore, type PackStore, type SessionStore } from '@/storage';
import { Home } from './Home';
import { PlayRoute } from './PlayRoute';
import { Result } from './Result';

function renderApp(initial: string, store: SessionStore = createMemoryStore(), packStore: PackStore = createMemoryPackStore()) {
  render(
    <StoreProvider store={store} packStore={packStore}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<PlayRoute />} />
          <Route path="/result/:id" element={<Result />} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
  return { store, packStore };
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

const press = (key: string) =>
  act(() => {
    fireEvent.keyDown(window, { key, code: `Key${key.toUpperCase()}` });
  });

/** 今のお題を、ガイドどおりに打つ */
const typeCurrentWord = () => {
  const romaji = (screen.getByLabelText('ローマ字ガイド').textContent ?? '').replaceAll('␣', ' ');
  for (const key of romaji) press(key);
};
const playThrough = async (count: number) => {
  for (let i = 1; i <= count; i++) {
    await waitFor(() => expect(screen.getByLabelText('進捗')).toHaveTextContent(`${i} / ${count}`));
    typeCurrentWord();
  }
  await screen.findByRole('heading', { name: '結果' });
};

const packFile = (obj: unknown) => new File([JSON.stringify(obj)], 'pack.json', { type: 'application/json' });
const importPack = (file: File) =>
  fireEvent.change(screen.getByLabelText('取り込むパックのファイル'), { target: { files: [file] } });
const mine = { id: 'mine', name: '自作の単語', items: [{ display: '猫', reading: 'ねこ' }, { display: '犬', reading: 'いぬ' }] };

beforeEach(() => localStorage.clear());

describe('練習の設定（ホーム）', () => {
  it('既定: 基本パック・10語・弱点優先', async () => {
    renderApp('/');
    expect(await screen.findByLabelText('出題パック')).toHaveValue('basic');
    expect(screen.getByLabelText('語数')).toHaveValue('10');
    expect(screen.getByLabelText('弱点を優先して出題する')).toBeChecked();
  });

  it('変更は保存され、開き直しても残る', async () => {
    renderApp('/');
    fireEvent.change(await screen.findByLabelText('出題パック'), { target: { value: 'english' } });
    fireEvent.change(screen.getByLabelText('語数'), { target: { value: '20' } });
    fireEvent.click(screen.getByLabelText('弱点を優先して出題する'));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) as string)).toEqual({ packId: 'english', count: 20, adaptive: false });

    document.body.innerHTML = '';
    renderApp('/');
    expect(await screen.findByLabelText('出題パック')).toHaveValue('english');
    expect(screen.getByLabelText('語数')).toHaveValue('20');
    expect(screen.getByLabelText('弱点を優先して出題する')).not.toBeChecked();
  });

  it('組み込みの3パックを選べる', async () => {
    renderApp('/');
    const select = await screen.findByLabelText('出題パック');
    expect(within(select).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual(['basic', 'english', 'symbols']);
  });
});

describe('設定が練習に反映される', () => {
  it('英単語パック・5語: お題が5つ、英単語で、打ち切ると記録される', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ packId: 'english', count: 5, adaptive: true }));
    const { store } = renderApp('/play');
    await ready();
    const shown = screen.getByRole('region', { name: 'お題' }).textContent ?? '';
    expect(ENGLISH_PACK.items.some((i) => shown.includes(i.display))).toBe(true);
    await playThrough(5);

    const [record] = await store.list();
    expect(record).toMatchObject({ contentId: 'english', mode: 'practice' });
    expect(record?.targets).toHaveLength(5);
    expect(record?.targets.every((t) => /^[a-z]+$/.test(t))).toBe(true);
  });

  it('数字と記号パック: 空白・Shift が要る記号も打てる', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ packId: 'symbols', count: 30, adaptive: false }));
    const { store } = renderApp('/play');
    await ready();
    await playThrough(30); // パックは32語だが、語数の設定（最大30）までで終わる
    const [record] = await store.list();
    expect(record?.targets).toHaveLength(30);
    expect(record?.keystrokes.every((k) => k.correct)).toBe(true);
  });

  it('弱点優先: 記録があるときだけ adaptive モード。オフなら常に通常モード', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ packId: 'english', count: 5, adaptive: true }));
    const { store } = renderApp('/play');
    await ready();
    press('1'); // ミスを1つ入れて、弱点データを作る
    await playThrough(5);
    expect((await store.list())[0]?.mode).toBe('practice');

    document.body.innerHTML = '';
    const second = renderApp('/play', store);
    await ready();
    await playThrough(5);
    expect((await second.store.list()).map((r) => r.mode).sort()).toEqual(['adaptive', 'practice']);

    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ packId: 'english', count: 5, adaptive: false }));
    document.body.innerHTML = '';
    renderApp('/play', store);
    await ready();
    await playThrough(5);
    expect((await store.list()).map((r) => r.mode).sort()).toEqual(['adaptive', 'practice', 'practice']);
  });

  it('パックの語数より設定の語数が多ければ、パックの全語で終わる', async () => {
    const packStore = createMemoryPackStore();
    await packStore.put(mine);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ packId: 'mine', count: 30, adaptive: false }));
    renderApp('/play', createMemoryStore(), packStore);
    await ready();
    expect(screen.getByLabelText('進捗')).toHaveTextContent('1 / 2');
  });

  it('選んでいた自作パックが無くなっていたら、基本パックで始まる', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ packId: 'gone', count: 5, adaptive: false }));
    const { store } = renderApp('/play');
    await ready();
    await playThrough(5);
    expect((await store.list())[0]?.contentId).toBe('basic');
  });
});

describe('自作パックの取り込み', () => {
  it('取り込むと一覧と選択肢に現れ、保存される。削除できる', async () => {
    const { packStore } = renderApp('/');
    await screen.findByLabelText('出題パック');
    importPack(packFile(mine));
    expect(await screen.findByText('「自作の単語」を取り込みました（2語）')).toBeInTheDocument();
    expect(within(screen.getByLabelText('出題パック')).getByRole('option', { name: '自作の単語（自作・2語）' })).toBeInTheDocument();
    expect((await packStore.list()).map((p) => p.id)).toEqual(['mine']);

    fireEvent.click(screen.getByRole('button', { name: '自作の単語を削除' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '自作の単語を削除' })).not.toBeInTheDocument());
    expect(await packStore.list()).toEqual([]);
  });

  it('同じ id を取り込むと上書きと表示する', async () => {
    renderApp('/');
    await screen.findByLabelText('出題パック');
    importPack(packFile(mine));
    await screen.findByText(/取り込みました/);
    importPack(packFile({ ...mine, name: '新しい名前' }));
    expect(await screen.findByText('「新しい名前」を上書き取り込みました（2語）')).toBeInTheDocument();
  });

  it('不正なパックは取り込まず、問題を一覧で示す', async () => {
    const { packStore } = renderApp('/');
    await screen.findByLabelText('出題パック');
    importPack(packFile({ id: 'bad', name: 'bad', items: [{ display: 'a', reading: '漢字' }, { display: 'b', reading: 'ねこ' }, { display: 'c', reading: 'ねこ' }] }));
    expect(await screen.findByText(/取り込めません（2件の問題）/)).toBeInTheDocument();
    const list = screen.getByRole('status');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(list).toHaveTextContent('打てない文字');
    expect(list).toHaveTextContent('重複');
    expect(await packStore.list()).toEqual([]);
  });

  it('問題が多いときは先頭10件と残りの件数だけ表示する', async () => {
    renderApp('/');
    await screen.findByLabelText('出題パック');
    const items = Array.from({ length: 15 }, (_, i) => ({ display: `x${i}`, reading: '漢' }));
    importPack(packFile({ id: 'many', name: 'many', items }));
    // 15語 × 打てない文字 + 2語目以降 14語 × 重複 = 29件
    await screen.findByText(/取り込めません（29件の問題）/);
    expect(within(screen.getByRole('status')).getAllByRole('listitem')).toHaveLength(11);
    expect(screen.getByText('…ほか 19 件')).toBeInTheDocument();
  });

  it('組み込みと同じ id・JSON でないファイルは拒否する', async () => {
    renderApp('/');
    await screen.findByLabelText('出題パック');
    importPack(packFile({ ...mine, id: 'basic' }));
    expect(await screen.findByText(/組み込みのパックと同じ/)).toBeInTheDocument();
    importPack(new File(['これはJSONではない'], 'x.json'));
    expect(await screen.findByText(/JSON として読み込めません/)).toBeInTheDocument();
  });

  it('選択中の自作パックを削除すると、基本パックを選んだ表示に戻る', async () => {
    const packStore = createMemoryPackStore();
    await packStore.put(mine);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ packId: 'mine', count: 10, adaptive: true }));
    renderApp('/', createMemoryStore(), packStore);
    expect(await screen.findByLabelText('出題パック')).toHaveValue('mine');
    fireEvent.click(await screen.findByRole('button', { name: '自作の単語を削除' }));
    await waitFor(() => expect(screen.getByLabelText('出題パック')).toHaveValue('basic'));
  });
});
