import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import { normalizeTarget } from '@/engine';
import type { Keystroke, SessionRecord } from '@/metrics';
import { keysOfTarget } from '@/session/adaptive';
import { todaysChallenge } from '@/session/daily';
import { createGhost } from '@/session/ghost';
import { PracticeSession } from '@/session/practiceSession';
import { createMemoryPackStore, createMemoryStore, type SessionStore } from '@/storage';
import { DailyRoute } from './DailyRoute';
import { GhostBar, formatAhead } from './GhostBar';
import { Home } from './Home';
import { PlayRoute } from './PlayRoute';
import { Result } from './Result';

const ready = async () => {
  const region = await screen.findByRole('region', { name: 'お題' });
  await act(async () => {});
  return region;
};
const press = (key: string) =>
  act(() => {
    fireEvent.keyDown(window, { key, code: `Key${key.toUpperCase()}` });
  });
const typeCurrentWord = () => {
  for (const key of (screen.getByLabelText('ローマ字ガイド').textContent ?? '').replaceAll('␣', ' ')) press(key);
};
const playThrough = async (count: number) => {
  for (let i = 1; i <= count; i++) {
    await screen.findByText(`${i} / ${count}`);
    typeCurrentWord();
  }
  await screen.findByRole('heading', { name: '結果' });
};

function renderApp(initial: string, store: SessionStore = createMemoryStore()) {
  render(
    <StoreProvider store={store} packStore={createMemoryPackStore()}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<PlayRoute />} />
          <Route path="/daily" element={<DailyRoute />} />
          <Route path="/result/:id" element={<Result />} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
  return store;
}

/** 今日のデイリーと同じお題で、間隔 step ミリ秒で打った記録を作る */
function dailyRecord(id: string, step: number, startedAt = Date.now()): SessionRecord {
  const { items } = todaysChallenge(Date.now());
  const targets = items.map((i) => normalizeTarget(i.reading));
  const keystrokes: Keystroke[] = [];
  let t = 1000;
  targets.forEach((target, item) => {
    for (const key of keysOfTarget(target)) {
      keystrokes.push({ t, key, code: '', expected: key, correct: true, item });
      t += step;
    }
    t += 500;
  });
  return { id, startedAt, mode: 'daily', contentId: 'x', targets, engineVersion: '1', ruleVersion: 'input-rules-v1', keystrokes };
}

describe('formatAhead', () => {
  it('先行・遅れを、符号と語の両方で示す', () => {
    expect(formatAhead(1234)).toEqual({ text: '+1.2秒 先行', ahead: true });
    expect(formatAhead(-800)).toEqual({ text: '−0.8秒 遅れ', ahead: false });
  });

  it('±0.05 秒未満は ±0.0（符号のちらつきを避ける）', () => {
    expect(formatAhead(0)).toEqual({ text: '±0.0秒', ahead: true });
    expect(formatAhead(-40)).toEqual({ text: '±0.0秒', ahead: true });
    expect(formatAhead(49)).toEqual({ text: '±0.0秒', ahead: true });
    expect(formatAhead(60).text).toBe('+0.1秒 先行');
  });
});

describe('GhostBar', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('自分が先行すると「先行」、止まっている間はゴーストが進んで「遅れ」になる', () => {
    vi.useFakeTimers();
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const session = new PracticeSession([{ display: '猫', reading: 'ね' }], 1000, { id: 's', startedAt: 0, mode: 'daily', contentId: 'x' });
    // ゴースト: n を 450ms、e を 900ms に打つ（位置は 0.5 → 1）
    const ghost = createGhost({
      id: 'g', startedAt: 0, mode: 'daily', contentId: 'x', targets: ['ね'], engineVersion: '1', ruleVersion: 'v',
      keystrokes: [
        { t: 450, key: 'n', code: '', expected: 'n', correct: true, item: 0 },
        { t: 900, key: 'e', code: '', expected: 'e', correct: true, item: 0 },
      ],
    });
    render(<GhostBar ghost={ghost} session={session} label="テスト" />);
    expect(screen.getByRole('region', { name: 'ゴースト' })).toHaveTextContent('ゴースト: テスト');
    expect(screen.getByText('±0.0秒')).toBeInTheDocument(); // 開始時点は並んでいる

    // 150ms で n を打つ（位置 0.5）。ゴーストが 0.5 に着くのは 450ms → 300ms 先行
    session.press({ key: 'n', code: 'KeyN' }, 1150);
    now = 1150;
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByText('+0.3秒 先行')).toBeInTheDocument();

    // そのまま 750ms まで止まる → 450 − 750 = −300ms（遅れ）
    now = 1750;
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByText('−0.3秒 遅れ')).toBeInTheDocument();
  });

  it('ゴーストが到達していない位置では、差を出さない', () => {
    vi.useFakeTimers();
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const session = new PracticeSession([{ display: '猫', reading: 'ね' }], 1000, { id: 's', startedAt: 0, mode: 'daily', contentId: 'x' });
    session.press({ key: 'n', code: 'KeyN' }, 1010);
    const incomplete = createGhost({
      id: 'g', startedAt: 0, mode: 'daily', contentId: 'x', targets: ['ね'], engineVersion: '1', ruleVersion: 'v',
      keystrokes: [{ t: 100, key: 'n', code: '', expected: 'n', correct: false, item: 0 }],
    });
    render(<GhostBar ghost={incomplete} session={session} label="不完全" />);
    expect(screen.getByRole('region', { name: 'ゴースト' })).not.toHaveTextContent(/先行|遅れ|±/);
  });

  it('タイマーは、画面から消えると止まる', () => {
    vi.useFakeTimers();
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const spy = vi.spyOn(globalThis, 'clearInterval');
    const session = new PracticeSession([{ display: '猫', reading: 'ね' }], 1000, { id: 's', startedAt: 0, mode: 'daily', contentId: 'x' });
    const ghost = createGhost(dailyRecord('g', 100));
    const { unmount } = render(<GhostBar ghost={ghost} session={session} label="x" />);
    unmount();
    expect(spy).toHaveBeenCalled();
  });
});

describe('デイリーチャレンジ', () => {
  it('ホーム: 未挑戦と表示し、挑戦へのリンクがある。お題の日付とパックを示す', async () => {
    renderApp('/');
    expect(await screen.findByText('未挑戦')).toBeInTheDocument();
    const { day, pack } = todaysChallenge(Date.now());
    expect(screen.getByText(new RegExp(`${day}・${pack.name}・10語`))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '挑戦する' })).toHaveAttribute('href', '/daily');
  });

  it('初回はゴーストが無い。打ち切ると mode=daily・今日のお題で保存される', async () => {
    const store = renderApp('/daily');
    await ready();
    expect(screen.queryByRole('region', { name: 'ゴースト' })).not.toBeInTheDocument();
    await playThrough(10);
    const [record] = await store.list();
    expect(record?.mode).toBe('daily');
    expect(record?.targets).toEqual(todaysChallenge(Date.now()).items.map((i) => normalizeTarget(i.reading)));
    expect(screen.queryByText(/自己ベスト更新！|同じお題の過去最高は/)).not.toBeInTheDocument(); // 比較対象が無いので、比較は出ない
  });

  it('過去の記録があればゴーストが並走し、上回ると自己ベスト更新と表示される。ホームに挑戦回数が出る', async () => {
    const store = createMemoryStore();
    await store.add(dailyRecord('slow', 1000)); // 1打鍵 1 秒のゆっくりした記録
    renderApp('/daily', store);
    await ready();
    expect(screen.getByRole('region', { name: 'ゴースト' })).toHaveTextContent('ゴースト: 同じお題の自己ベスト');
    await playThrough(10);
    expect(await screen.findByText(/自己ベスト更新！/)).toBeInTheDocument();

    cleanup();
    renderApp('/', store);
    expect(await screen.findByText(/挑戦済み（2回・最高/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /もう一度挑戦する/ })).toHaveAttribute('href', '/daily');
  });

  it('別の日の記録は「今日の挑戦済み」に数えない', async () => {
    const store = createMemoryStore();
    await store.add(dailyRecord('old', 500, Date.now() - 3 * 86_400_000));
    renderApp('/', store);
    expect(await screen.findByText('未挑戦')).toBeInTheDocument();
  });

  it('通常の練習（mode=practice）は、今日の挑戦に数えない', async () => {
    const store = createMemoryStore();
    await store.add({ ...dailyRecord('p', 500), mode: 'practice' });
    renderApp('/', store);
    expect(await screen.findByText('未挑戦')).toBeInTheDocument();
  });
});

describe('同じお題でもう一度', () => {
  const playFirst = async () => {
    const store = createMemoryStore();
    renderApp('/play', store);
    await ready();
    await playThrough(10);
    return store;
  };

  it('結果画面から、同じお題・同じ並びで再挑戦できる。前回がゴーストになる', async () => {
    const store = await playFirst();
    const [first] = await store.list();
    const link = screen.getByRole('link', { name: '同じお題でもう一度' });
    expect(link).toHaveAttribute('href', `/play?retry=${first?.id}`);
    fireEvent.click(link);

    await ready();
    expect(screen.getByRole('region', { name: 'ゴースト' })).toBeInTheDocument();
    await playThrough(10);
    const records = await store.list();
    expect(records).toHaveLength(2);
    expect(records[1]?.mode).toBe('retry');
    expect(records[1]?.targets).toEqual(first?.targets);
  });

  it('結果画面に、同じお題の過去最高との比較が出る', async () => {
    await playFirst();
    fireEvent.click(screen.getByRole('link', { name: '同じお題でもう一度' }));
    await ready();
    await playThrough(10);
    expect(screen.getByRole('status')).toHaveTextContent(/自己ベスト更新！|同じお題の過去最高は/);
  });

  it('元の記録が無ければ案内を出す', async () => {
    renderApp('/play?retry=none');
    expect(await screen.findByText('元の記録が見つかりませんでした。')).toBeInTheDocument();
  });

  it('「新しいお題で練習」は再挑戦ではなく通常の練習', async () => {
    await playFirst();
    expect(screen.getByRole('link', { name: '新しいお題で練習' })).toHaveAttribute('href', '/play');
  });
});
