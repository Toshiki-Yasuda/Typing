import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import { LAYOUTS, describeKey, locate } from '@/fingering';
import type { Keystroke, SessionRecord, SessionSummary } from '@/metrics';
import { SETTINGS_KEY } from '@/settings/settings';
import { createMemoryPackStore, createMemoryStore, type SessionStore } from '@/storage';
import { FingerGuide } from './FingerGuide';
import { Home } from './Home';
import { PlayRoute } from './PlayRoute';
import { RankCard, RankPanel } from './RankPanel';
import { Stats } from './Stats';

const sm = (id: string, startedAt: number, kpm: number, accuracy = 0.98, total = 100): SessionSummary => ({
  id, startedAt, mode: 'practice', kpm, accuracy, consistency: null, efficiency: null, total, misses: 0,
});

describe('FingerGuide', () => {
  const activeCells = (container: HTMLElement) => [...container.querySelectorAll('[aria-current="true"]')].map((e) => e.textContent);

  it('次のキーを光らせ、指の名前を文字でも示す', () => {
    const { container } = render(<FingerGuide next="j" layout="us" />);
    expect(screen.getByText('右手の人差し指で J')).toBeInTheDocument();
    expect(activeCells(container)).toEqual(['J']);
  });

  it('Shift が要るときは、反対の手の Shift も光る（J は左の Shift）', () => {
    const { container } = render(<FingerGuide next="J" layout="us" />);
    expect(screen.getByText('Shift（左手の小指）を押しながら 右手の人差し指で J')).toBeInTheDocument();
    expect(activeCells(container)).toEqual(['J', 'Shift']); // 画面上の並び順（J はホーム段、Shift は最下段）
    const shifts = [...container.querySelectorAll('div')].filter((d) => d.textContent === 'Shift');
    expect(shifts[0]?.getAttribute('aria-current')).toBe('true'); // 左が光る
    expect(shifts[1]?.getAttribute('aria-current')).toBeNull();
  });

  it('左手のキーなら、右の Shift が光る', () => {
    const { container } = render(<FingerGuide next="A" layout="us" />);
    const shifts = [...container.querySelectorAll('div')].filter((d) => d.textContent === 'Shift');
    expect(shifts[0]?.getAttribute('aria-current')).toBeNull();
    expect(shifts[1]?.getAttribute('aria-current')).toBe('true');
  });

  it('スペースは親指。何も無ければ空', () => {
    const { container, rerender } = render(<FingerGuide next=" " layout="us" />);
    expect(screen.getByText('親指で スペース')).toBeInTheDocument();
    expect(activeCells(container)).toHaveLength(1);
    rerender(<FingerGuide next={undefined} layout="us" />);
    expect(activeCells(container)).toEqual([]);
    expect(screen.queryByText(/で /)).not.toBeInTheDocument();
  });

  it('配列で位置が変わる: " は US では ' + "'" + ' キー、JIS では 2 キー', () => {
    const us = render(<FingerGuide next={'"'} layout="us" />);
    expect(activeCells(us.container)).toContain("'");
    us.unmount();
    const jis = render(<FingerGuide next={'"'} layout="jis" />);
    expect(activeCells(jis.container)).toContain('2');
    expect(screen.getByText(/左手の薬指で 2/)).toBeInTheDocument();
  });

  it('配列に無い文字は何も光らない（例外にならない）', () => {
    const { container } = render(<FingerGuide next="あ" layout="jis" />);
    expect(activeCells(container)).toEqual([]);
  });

  it('ホームポジションの目印は F と J だけ', () => {
    const { container } = render(<FingerGuide next={undefined} layout="us" />);
    const marked = [...container.querySelectorAll('div')].filter((d) => d.querySelector(':scope > span[aria-hidden]')).map((d) => d.textContent);
    expect(marked).toEqual(['F', 'J']);
  });
});

function renderApp(initial: string, store: SessionStore = createMemoryStore()) {
  render(
    <StoreProvider store={store} packStore={createMemoryPackStore()}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<PlayRoute />} />
          <Route path="/stats" element={<Stats />} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
  return store;
}
const ready = async () => {
  const region = await screen.findByRole('region', { name: 'お題' });
  await act(async () => {});
  return region;
};
const press = (key: string) =>
  act(() => {
    fireEvent.keyDown(window, { key, code: `Key${key.toUpperCase()}` });
  });

describe('練習画面の運指ガイド', () => {
  beforeEach(() => localStorage.clear());

  it('既定で表示（JIS）。次のキーの指を示し、打つたびに次のキーに変わる', async () => {
    renderApp('/play');
    await ready();
    const region = screen.getByRole('region', { name: '運指ガイド' });
    const romaji = (screen.getByLabelText('ローマ字ガイド').textContent ?? '').replaceAll('␣', ' ');
    const expected = (i: number) => describeKey(locate(LAYOUTS.jis, romaji[i] as string)!);
    expect(region).toHaveTextContent(expected(0));
    press(romaji[0] as string);
    expect(region).toHaveTextContent(expected(1));
  });

  it('設定で US 配列にできる', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ layout: 'us' }));
    renderApp('/play');
    await ready();
    expect(screen.getByRole('region', { name: '運指ガイド' })).toHaveTextContent('US配列');
  });

  it('設定でオフにすると表示しない', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ fingerGuide: false }));
    renderApp('/play');
    await ready();
    expect(screen.queryByRole('region', { name: '運指ガイド' })).not.toBeInTheDocument();
  });
});

describe('設定（ホーム）', () => {
  beforeEach(() => localStorage.clear());

  it('運指ガイド・配列・目標の級位を保存できる', async () => {
    renderApp('/');
    fireEvent.click(await screen.findByLabelText('運指ガイドを表示する'));
    fireEvent.change(screen.getByLabelText('運指ガイドの配列'), { target: { value: 'us' } });
    fireEvent.change(screen.getByLabelText('目標の級位'), { target: { value: 'k3' } });
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) as string)).toMatchObject({ fingerGuide: false, layout: 'us', goalRank: 'k3' });
  });

  it('目標の選択肢: 自動 + 全級位', async () => {
    renderApp('/');
    const options = within(await screen.findByLabelText('目標の級位')).getAllByRole('option');
    expect(options).toHaveLength(21);
    expect(options[0]).toHaveTextContent('自動（次の級位）');
    expect(options[1]).toHaveTextContent('10級');
    expect(options.at(-1)).toHaveTextContent('十段');
  });
});

describe('RankPanel（結果画面）', () => {
  it('初めて級位が付いたら知らせる（暫定）', () => {
    render(<RankPanel summaries={[sm('a', 1, 150)]} currentId="a" goalId="auto" />);
    expect(screen.getByText('この練習:', { exact: false })).toHaveTextContent('6級相当（150 打鍵/分）');
    expect(screen.getByRole('status')).toHaveTextContent('級位が付きました: 6級（暫定）');
  });

  it('昇級を知らせる（直近5回の中央値が上の級位に届いたとき）', () => {
    const list = [150, 150, 150, 200, 200, 200].map((k, i) => sm(`s${i}`, i, k));
    render(<RankPanel summaries={list} currentId="s5" goalId="auto" />);
    expect(screen.getByRole('status')).toHaveTextContent('昇級！ 6級 → 4級');
    expect(screen.getByText(/現在の級位:/)).toHaveTextContent('4級');
  });

  it('1回だけ速くても昇級しない（中央値）', () => {
    const list = [150, 150, 150, 400].map((k, i) => sm(`s${i}`, i, k));
    render(<RankPanel summaries={list} currentId="s3" goalId="auto" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText(/現在の級位:/)).toHaveTextContent('6級');
    expect(screen.getByText('この練習:', { exact: false })).toHaveTextContent('四段相当'); // 400 打鍵/分（四段は 400〜）
  });

  it('正確率が低い練習は、級位の判定に数えないと明示し、昇級もしない', () => {
    const list = [sm('a', 1, 150), sm('b', 2, 150), sm('c', 3, 150), sm('d', 4, 500, 0.9)];
    render(<RankPanel summaries={list} currentId="d" goalId="auto" />);
    expect(screen.getByText(/級位の判定には数えません/)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText(/現在の級位:/)).toHaveTextContent('6級');
  });

  it('目標: 自動は次の級位まで。自分で決めた目標が達成済みならそう表示', () => {
    const list = [200, 200, 200].map((k, i) => sm(`s${i}`, i, k)); // 4級（190〜）、次は3級（220）
    const { unmount } = render(<RankPanel summaries={list} currentId="s2" goalId="auto" />);
    expect(screen.getByText('目標 3級 まで あと 20 打鍵/分')).toBeInTheDocument();
    unmount();
    render(<RankPanel summaries={list} currentId="s2" goalId="k4" />);
    expect(screen.getByText('目標 4級 を達成しています')).toBeInTheDocument();
  });

  it('暫定は、回数が 3 回に達するまで表示する', () => {
    const list = [sm('a', 1, 200), sm('b', 2, 200)];
    const { unmount } = render(<RankPanel summaries={list} currentId="b" goalId="auto" />);
    expect(screen.getByText('（暫定）')).toBeInTheDocument();
    unmount();
    render(<RankPanel summaries={[...list, sm('c', 3, 200)]} currentId="c" goalId="auto" />);
    expect(screen.queryByText('（暫定）')).not.toBeInTheDocument();
  });

  it('該当の記録が無ければ何も出さない', () => {
    const { container } = render(<RankPanel summaries={[sm('a', 1, 150)]} currentId="none" goalId="auto" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('RankCard（ホーム）', () => {
  const renderCard = (summaries: SessionSummary[]) =>
    render(
      <MemoryRouter>
        <RankCard summaries={summaries} goalId="auto" />
      </MemoryRouter>,
    );

  it('級位がまだ無いとき、認定の条件と現在の回数を示す', () => {
    renderCard([sm('a', 1, 300, 0.8)]);
    expect(screen.getByText(/級位はまだありません/)).toHaveTextContent('3 回で認定されます（今は 0 回）');
  });

  it('現在の級位・中央値・目標を示す', () => {
    renderCard([200, 200, 200].map((k, i) => sm(`s${i}`, i, k)));
    expect(screen.getByText(/現在の級位:/)).toHaveTextContent('4級');
    expect(screen.getByText(/直近 3 回の中央値 200 打鍵\/分/)).toBeInTheDocument();
    expect(screen.getByText(/目標 3級 まで あと 20/)).toBeInTheDocument();
  });
});

describe('統計の級位タイル', () => {
  const ks = (i: number): Keystroke => ({ t: i * 100, key: 'a', code: '', expected: 'a', correct: true, item: 0 });
  const rec = (id: string): SessionRecord => ({
    id, startedAt: Date.now(), mode: 'practice', contentId: 'x', targets: ['あ'], engineVersion: '1', ruleVersion: 'v',
    keystrokes: Array.from({ length: 30 }, (_, i) => ks(i)),
  });

  it('数える練習が無ければ —、あれば級位（暫定つき）', async () => {
    const empty = createMemoryStore();
    await empty.add({ ...rec('short'), keystrokes: [ks(0), ks(1)] });
    renderApp('/stats', empty);
    expect((await screen.findByText('級位')).nextElementSibling).toHaveTextContent('—');

    const store = createMemoryStore();
    await store.add(rec('a'));
    document.body.innerHTML = '';
    renderApp('/stats', store);
    const dd = (await screen.findByText('級位')).nextElementSibling;
    expect(dd).toHaveTextContent('十段'); // 29 区間 / 2.9 秒 = 600 打鍵/分
    expect(dd).toHaveTextContent('暫定');
  });
});
