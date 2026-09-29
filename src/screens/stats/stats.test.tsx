import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import type { Keystroke, KeyStat, SessionRecord } from '@/metrics';
import { createMemoryStore, type SessionStore } from '@/storage';
import { Stats } from '../Stats';
import { BarList } from './BarList';
import { KeyboardHeatmap } from './KeyboardHeatmap';
import { LineChart } from './LineChart';

const DAY = 86_400_000;
const ks = (t: number, expected: string, correct = true): Keystroke => ({
  t,
  key: correct ? expected : '1',
  code: '',
  expected,
  correct,
  item: 0,
});
/** k a k a k a k a を 100ms 間隔で打つ（k→a が4組・a→k が3組）。withMiss なら最後に 1 回ミス */
function record(id: string, startedAt: number, withMiss = false): SessionRecord {
  const keystrokes = [...'kakakaka'].map((c, i) => ks(i * 100, c));
  if (withMiss) keystrokes.push(ks(900, 'k', false), ks(1500, 'k'));
  return {
    id,
    startedAt,
    mode: 'practice',
    contentId: 'test',
    targets: ['かかかか'],
    engineVersion: '1',
    ruleVersion: 'input-rules-v1',
    keystrokes,
  };
}

function renderStats(store: SessionStore) {
  render(
    <StoreProvider store={store}>
      <MemoryRouter initialEntries={['/stats']}>
        <Routes>
          <Route path="/stats" element={<Stats />} />
          <Route path="/" element={<p>ホーム画面</p>} />
          <Route path="/play" element={<p>練習画面</p>} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
}

describe('Stats 画面', () => {
  it('記録が無ければ案内を出す', async () => {
    renderStats(createMemoryStore());
    expect(await screen.findByText('この期間の記録がありません。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '練習を始める' })).toBeInTheDocument();
  });

  it('要約・推移・キー別・連接別を表示する', async () => {
    const store = createMemoryStore();
    const now = Date.now();
    await store.addMany([record('a', now - 2 * DAY), record('b', now - DAY, true), record('c', now)]);
    renderStats(store);

    expect(await screen.findByRole('heading', { name: '統計' })).toBeInTheDocument();
    expect(screen.getByText('練習した回数').nextElementSibling).toHaveTextContent('3回');
    expect(screen.getByText('累計打鍵').nextElementSibling).toHaveTextContent('26'); // 8 + 10 + 8
    expect(screen.getByText('連続日数').nextElementSibling).toHaveTextContent('3日');
    expect(screen.getByText('速度の推移（打鍵/分）')).toBeInTheDocument();
    expect(screen.getByText('正確率の推移')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^k: ミス率/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'z: データなし' })).toBeInTheDocument();
    // 連接: k→a が 12 組（3セッション × 4）、a→k が 9 組 + …
    expect(screen.getByText('遅くなりやすい連接')).toBeInTheDocument();
    expect(screen.getAllByText('k→a').length).toBeGreaterThan(0);
    expect(screen.getByText('よくある打ち間違い')).toBeInTheDocument();
    expect(screen.getByText(/k→1（1）/)).toBeInTheDocument();
  });

  it('期間フィルタで、古い記録が除かれる（連続日数は全記録から）', async () => {
    const store = createMemoryStore();
    const now = Date.now();
    await store.addMany([record('old', now - 40 * DAY), record('new', now - DAY)]);
    renderStats(store);
    await screen.findByRole('heading', { name: '統計' });
    expect(screen.getByText('練習した回数').nextElementSibling).toHaveTextContent('2回');

    fireEvent.click(screen.getByRole('button', { name: '30日' }));
    expect(screen.getByText('練習した回数').nextElementSibling).toHaveTextContent('1回');
    expect(screen.getByRole('button', { name: '30日' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: '7日' }));
    expect(screen.getByText('練習した回数').nextElementSibling).toHaveTextContent('1回');
    expect(screen.getByText('連続日数').nextElementSibling).toHaveTextContent('1日'); // 昨日のみ → 継続中
  });

  it('期間内に記録が無ければ案内を出す', async () => {
    const store = createMemoryStore();
    await store.add(record('old', Date.now() - 40 * DAY));
    renderStats(store);
    await screen.findByRole('heading', { name: '統計' });
    fireEvent.click(screen.getByRole('button', { name: '7日' }));
    expect(screen.getByText('この期間の記録がありません。')).toBeInTheDocument();
  });
});

describe('LineChart', () => {
  const points = [
    { label: '9/27', value: 100 },
    { label: '9/28', value: 200 },
    { label: '9/29', value: 300 },
  ];
  const renderChart = () =>
    render(<LineChart title="速度" points={points} format={(v) => `${v}打`} yMin={0} valueHeader="打鍵/分" />);

  it('最新の値を直接ラベルで示す。ツールチップは初期状態で出ない', () => {
    renderChart();
    expect(screen.getByText('速度')).toBeInTheDocument();
    expect(screen.getAllByText('300打').length).toBeGreaterThan(0);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('キーボード: フォーカスで最新点、矢印で移動、Escape で消える', () => {
    renderChart();
    const group = screen.getByRole('group', { name: '速度' });
    fireEvent.focus(group);
    expect(within(screen.getByRole('tooltip')).getByText('300打')).toBeInTheDocument();
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(within(screen.getByRole('tooltip')).getByText('200打')).toBeInTheDocument();
    fireEvent.keyDown(group, { key: 'Home' });
    expect(within(screen.getByRole('tooltip')).getByText('100打')).toBeInTheDocument();
    fireEvent.keyDown(group, { key: 'ArrowLeft' }); // 端で止まる
    expect(within(screen.getByRole('tooltip')).getByText('100打')).toBeInTheDocument();
    fireEvent.keyDown(group, { key: 'End' });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(within(screen.getByRole('tooltip')).getByText('300打')).toBeInTheDocument();
    fireEvent.keyDown(group, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('矢印キーだけ押しても、最初の点から動ける', () => {
    renderChart();
    const group = screen.getByRole('group', { name: '速度' });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(within(screen.getByRole('tooltip')).getByText('100打')).toBeInTheDocument();
    fireEvent.blur(group);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('値は表でも読める', () => {
    renderChart();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getByText('打鍵/分')).toBeInTheDocument();
    expect(within(table).getByText('200打')).toBeInTheDocument();
  });

  it('点が1つでも描ける（線は引かない）', () => {
    const { container } = render(<LineChart title="1点" points={[{ label: 'a', value: 5 }]} format={String} />);
    expect(container.querySelectorAll('path')).toHaveLength(0);
    expect(container.querySelectorAll('circle')).toHaveLength(1);
  });

  it('ポインタ移動: 幅が 0 の環境では何もしない（例外にならない）', () => {
    const { container } = renderChart();
    const svg = container.querySelector('svg') as SVGSVGElement;
    act(() => {
      fireEvent.pointerMove(svg, { clientX: 100 });
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('ポインタ移動: 最寄りの点に吸着し、離れると消える', () => {
    const { container } = renderChart();
    const svg = container.querySelector('svg') as SVGSVGElement;
    svg.getBoundingClientRect = () => ({ left: 0, width: 640, top: 0, height: 240, right: 640, bottom: 240, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerMove(svg, { clientX: 330 }); // 中央付近 → 2点目
    expect(within(screen.getByRole('tooltip')).getByText('200打')).toBeInTheDocument();
    fireEvent.pointerMove(svg, { clientX: 20 });
    expect(within(screen.getByRole('tooltip')).getByText('100打')).toBeInTheDocument();
    fireEvent.pointerLeave(svg);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('KeyboardHeatmap', () => {
  const stats = new Map<string, KeyStat>([
    ['k', { key: 'k', attempts: 20, misses: 10, meanLatencyMs: 300, latencyCount: 10 }],
    ['a', { key: 'a', attempts: 20, misses: 0, meanLatencyMs: 100, latencyCount: 10 }],
    ['s', { key: 's', attempts: 2, misses: 1, meanLatencyMs: null, latencyCount: 0 }],
  ]);

  it('キーごとにデータの有無・値を読み上げ用ラベルで示す', () => {
    render(<KeyboardHeatmap stats={stats} />);
    expect(screen.getByRole('img', { name: 'k: ミス率 50%（20回中ミス10回）' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'a: ミス率 0%（20回中ミス0回）' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'q: データなし' })).toBeInTheDocument();
  });

  it('指標を遅延に切り替えられる（遅延データが無いキーは「データなし」）', () => {
    render(<KeyboardHeatmap stats={stats} />);
    fireEvent.click(screen.getByRole('button', { name: '平均遅延' }));
    expect(screen.getByRole('button', { name: '平均遅延' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: 'k: 平均遅延 300ms（20回中ミス10回）' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 's: データなし' })).toBeInTheDocument();
  });

  it('ホバー/フォーカスでツールチップ。試行が少ないキーは参考値と明記', () => {
    render(<KeyboardHeatmap stats={stats} />);
    const k = screen.getByRole('img', { name: /^k:/ });
    fireEvent.pointerEnter(k);
    const tip = screen.getByRole('tooltip');
    expect(within(tip).getByText('50%')).toBeInTheDocument();
    expect(tip).toHaveTextContent('試行 20回・ミス 10回・平均 300ms');
    expect(tip).not.toHaveTextContent('参考値');
    // セルの文字色（明るいセルでは暗い色）を継承すると、暗い背景の上で読めなくなる
    expect(tip.className).toContain('text-text');
    fireEvent.pointerLeave(k);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(screen.getByRole('img', { name: /^s:/ }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('参考値');
    fireEvent.blur(screen.getByRole('img', { name: /^s:/ }));

    fireEvent.pointerEnter(screen.getByRole('img', { name: 'q: データなし' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('データなし');
  });

  it('表: 値の大きい順', () => {
    render(<KeyboardHeatmap stats={stats} />);
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.querySelector('td')?.textContent)).toEqual(['k', 's', 'a']);
  });

  it('データが無くても描ける', () => {
    render(<KeyboardHeatmap stats={new Map()} />);
    expect(screen.getAllByRole('img').every((el) => /データなし/.test(el.getAttribute('aria-label') ?? ''))).toBe(true);
  });
});

describe('BarList', () => {
  const rows = [
    { label: 'k→a', value: 300, detail: '5回' },
    { label: 's→i', value: 150, detail: '3回' },
  ];

  it('棒と値を出し、ホバーでツールチップ', () => {
    render(<BarList title="遅い連接" rows={rows} format={(v) => `${v}ms`} valueHeader="平均遅延" empty="なし" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const first = screen.getAllByRole('listitem')[0] as HTMLElement;
    fireEvent.pointerEnter(first);
    expect(screen.getByRole('tooltip')).toHaveTextContent('300ms');
    expect(screen.getByRole('tooltip')).toHaveTextContent('5回');
    fireEvent.pointerLeave(first);
    fireEvent.focus(first);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(first);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('棒の太さは 24px 以下で、最大値の棒が最も長い', () => {
    const { container } = render(<BarList title="t" rows={rows} format={String} valueHeader="v" empty="なし" />);
    const bars = [...container.querySelectorAll<HTMLElement>('li [aria-hidden]')];
    expect(bars.map((b) => b.style.height)).toEqual(['20px', '20px']);
    expect(parseFloat(bars[0]?.style.width ?? '0')).toBeGreaterThan(parseFloat(bars[1]?.style.width ?? '0'));
  });

  it('行が無ければ案内を出す', () => {
    render(<BarList title="t" rows={[]} format={String} valueHeader="v" empty="まだありません" />);
    expect(screen.getByText('まだありません')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('値がすべて 0 でも幅が NaN にならない', () => {
    const { container } = render(
      <BarList title="t" rows={[{ label: 'a→b', value: 0, detail: '3回' }]} format={String} valueHeader="v" empty="なし" />,
    );
    expect(container.querySelector<HTMLElement>('li [aria-hidden]')?.style.width).toBe('0%');
  });
});
