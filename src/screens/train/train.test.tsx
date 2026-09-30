import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import type { ContentPack } from '@/content';
import type { Keystroke, SessionRecord } from '@/metrics';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '@/settings/settings';
import type { SoundKind } from '@/sound/player';
import { createMemoryStore, type SessionStore } from '@/storage';
import { UNLOCK_KEY } from '@/themes/unlock';
import { Play } from '../Play';
import { TrainRoute } from './TrainRoute';
import { TrainScreen } from './TrainScreen';

vi.mock('@/sound/bgm', () => ({ getBgm: () => ({ play: vi.fn(), setScale: vi.fn() }) }));
const played: SoundKind[] = [];
vi.mock('@/sound/useSoundPlayer', () => ({ useSoundPlayer: () => ({ play: (k: SoundKind) => played.push(k) }) }));

const pack: ContentPack = { id: 'test', name: 'test', items: [{ display: '柿', reading: 'かき' }, { display: '栗', reading: 'くり' }] };
const press = (key: string) => act(() => void fireEvent.keyDown(window, { key, code: `Key${key.toUpperCase()}` }));

function renderPlay(store: SessionStore, node: React.ReactNode, at = '/x') {
  return render(
    <StoreProvider store={store}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/x" element={node} />
          <Route path="/train/:kind" element={<TrainRoute />} />
          <Route path="/train" element={<p>修行の一覧</p>} />
          <Route path="/result/:id" element={<p>結果へ移動</p>} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
}

beforeEach(() => {
  played.length = 0;
  localStorage.clear();
});
afterEach(cleanup);

describe('絶（静寂）', () => {
  it('効果音を鳴らさない。記録のモードは train:zetsu。ミスは普通に数える', async () => {
    const store = createMemoryStore();
    renderPlay(store, <Play pack={pack} count={1} items={[pack.items[0]!]} mode="train:zetsu" train={{ kind: 'zetsu', label: '静寂' }} />);
    await screen.findByRole('region', { name: 'お題' });
    await act(async () => {});
    for (const k of ['k', '1', 'a', 'k', 'i']) press(k);
    expect(await screen.findByText('結果へ移動')).toBeInTheDocument();
    expect(played).toEqual([]);
    const rec = (await store.list())[0];
    expect(rec?.mode).toBe('train:zetsu');
    expect(rec?.keystrokes.map((k) => k.correct)).toEqual([true, false, true, true, true]);
  });

  it('テーマのコンボ表示（手応え）も出さない。対照: 型が無ければ出る', async () => {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(['hunter']));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, themeId: 'hunter' }));
    const zetsu = renderPlay(createMemoryStore(), <Play pack={pack} items={pack.items} mode="train:zetsu" train={{ kind: 'zetsu' }} />);
    await screen.findByRole('region', { name: 'お題' });
    expect(screen.queryByRole('group', { name: 'コンボの段階' })).toBeNull();
    zetsu.unmount();
    renderPlay(createMemoryStore(), <Play pack={pack} items={pack.items} />);
    await screen.findByRole('region', { name: 'お題' });
    expect(screen.getByRole('group', { name: 'コンボの段階' })).toBeInTheDocument();
  });

  it('対照: 型の指定が無ければ、同じ操作で音が鳴る', async () => {
    renderPlay(createMemoryStore(), <Play pack={pack} count={1} items={[pack.items[0]!]} />);
    await screen.findByRole('region', { name: 'お題' });
    await act(async () => {});
    press('k');
    expect(played).toEqual(['type']);
  });
});

/** jsdom の timeStamp は epoch ミリ秒。実ブラウザと同じ performance.now() の時間軸にして送る */
const pressNow = (key: string) =>
  act(() => {
    const e = new KeyboardEvent('keydown', { key, code: `Key${key.toUpperCase()}`, bubbles: true, cancelable: true });
    Object.defineProperty(e, 'timeStamp', { value: performance.now() });
    window.dispatchEvent(e);
  });

describe('練（時間制限）', () => {
  // 時間は Play が performance.now() と KeyboardEvent.timeStamp（同じ時間軸）で測るため、偽の時計は使わず、短い制限時間を渡す
  it('既定は 60 秒。残りを秒で出す', async () => {
    renderPlay(createMemoryStore(), <Play pack={pack} items={pack.items} mode="train:ren" train={{ kind: 'ren' }} />);
    await screen.findByRole('region', { name: 'お題' });
    expect(screen.getByRole('timer')).toHaveTextContent('残り 60 秒');
  });

  it('時間が来ると、そこまでの記録を保存して結果へ。時間切れの後の打鍵は記録しない', async () => {
    const store = createMemoryStore();
    renderPlay(store, <Play pack={pack} items={pack.items} mode="train:ren" train={{ kind: 'ren', limitMs: 500 }} />);
    await screen.findByRole('region', { name: 'お題' });
    await act(async () => {});
    pressNow('k');
    expect(await screen.findByText('結果へ移動', {}, { timeout: 3000 })).toBeInTheDocument();
    pressNow('a'); // 移動した後の打鍵は、どこにも記録されない
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.mode).toBe('train:ren');
    expect(list[0]?.keystrokes).toHaveLength(1);
  });

  it('制限を過ぎた時刻の打鍵は、記録せずに終える（タイマーの刻みを待たない）', async () => {
    const store = createMemoryStore();
    renderPlay(store, <Play pack={pack} items={pack.items} mode="train:ren" train={{ kind: 'ren' }} />);
    await screen.findByRole('region', { name: 'お題' });
    await act(async () => {}); // キー受付の登録（effect）が済むのを待つ
    const now = performance.now();
    const spy = vi.spyOn(performance, 'now').mockReturnValue(now + 61_000); // 61 秒後の時計
    press('k');
    spy.mockRestore();
    expect(await screen.findByText('修行の一覧', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(await store.list()).toHaveLength(0);
  });

  it('1 打もないまま時間切れなら、記録せず修行の一覧へ戻る', async () => {
    const store = createMemoryStore();
    renderPlay(store, <Play pack={pack} items={pack.items} mode="train:ren" train={{ kind: 'ren', limitMs: 300 }} />);
    expect(await screen.findByText('修行の一覧', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await store.list()).toHaveLength(0);
  });
});

describe('補助は絶では出さず、練・発では設定に従う', () => {
  const withAids = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, aidEn: true, aidGyo: true }));

  it('円: 練では次のお題が出る。絶では出ない', async () => {
    withAids();
    const ren = renderPlay(createMemoryStore(), null, '/train/ren');
    await screen.findByRole('region', { name: 'お題' });
    expect(screen.getByText(/^次:/)).toBeInTheDocument();
    ren.unmount();
    renderPlay(createMemoryStore(), null, '/train/zetsu');
    await screen.findByRole('region', { name: 'お題' });
    expect(screen.queryByText(/^次:/)).toBeNull();
  });

  it('絶では運指ガイドも出さない（設定でオンでも）', async () => {
    const ren = renderPlay(createMemoryStore(), null, '/train/ren');
    await screen.findByRole('region', { name: 'お題' });
    expect(screen.getByRole('region', { name: '運指ガイド' })).toBeInTheDocument(); // 対照
    ren.unmount();
    renderPlay(createMemoryStore(), null, '/train/zetsu');
    await screen.findByRole('region', { name: 'お題' });
    expect(screen.queryByRole('region', { name: '運指ガイド' })).toBeNull();
  });
});

describe('発（弱点から作る技）', () => {
  it('記録が無ければ、始めずに案内を出す', async () => {
    renderPlay(createMemoryStore(), null, '/train/hatsu');
    expect(await screen.findByText(/まだ弱点が求まっていません/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'お題' })).toBeNull();
  });

  it('弱いキーがあれば、その型の名前で始まる', async () => {
    const store = createMemoryStore();
    const ks = (correct: boolean, item: number): Keystroke => ({ t: 100 * item, key: correct ? 'k' : 'x', code: 'KeyK', expected: 'k', correct, item });
    const record: SessionRecord = {
      id: 'r1', startedAt: 1, mode: 'practice', contentId: 'basic', targets: ['か'], engineVersion: '1', ruleVersion: '1',
      keystrokes: [ks(false, 0), ks(false, 0), ks(true, 0)],
    };
    await store.add(record);
    renderPlay(store, null, '/train/hatsu');
    expect(await screen.findByRole('region', { name: 'お題' })).toBeInTheDocument();
    // 見出し（読み上げ用）と、画面上の表示の 2 か所
    expect(screen.getAllByText('弱点：『k』の型')).toHaveLength(2);
  });

  it('知らない型は「見つかりません」', async () => {
    renderPlay(createMemoryStore(), null, '/train/xxx');
    expect(await screen.findByText('そのような修行はありません。')).toBeInTheDocument();
  });
});

describe('修行の入口', () => {
  const open = () =>
    render(
      <MemoryRouter>
        <TrainScreen />
      </MemoryRouter>,
    );

  it('標準の言葉で 3 つの型を並べ、それぞれの行き先と指標を文字で示す', () => {
    open();
    expect(screen.getByRole('heading', { level: 1, name: '修行' })).toBeInTheDocument();
    for (const [name, to, measure] of [['静寂', '/train/zetsu', 'ミスの数'], ['速さ', '/train/ren', '語数'], ['弱点', '/train/hatsu', '技の名前']]) {
      const link = screen.getByRole('link', { name: new RegExp(name as string) });
      expect(link).toHaveAttribute('href', to);
      expect(link).toHaveTextContent(measure as string);
    }
  });

  it('HUNTER テーマでは、絶・練・発と、補助の凝・円', () => {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(['hunter']));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, themeId: 'hunter' }));
    open();
    for (const name of ['絶', '練', '発']) expect(screen.getByRole('link', { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    expect(screen.getByText(/補助（凝・円）/)).toBeInTheDocument();
  });
});
