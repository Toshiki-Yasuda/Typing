import { fireEvent, render, screen, within } from '@testing-library/react';
import type { SessionSummary } from '@/metrics';
import { ColumnChart, type Column } from './ColumnChart';
import { TimeOfDay } from './TimeOfDay';

const cols: Column[] = [
  { label: '月', value: 200, count: 5 },
  { label: '火', value: 300, count: 4 },
  { label: '水', value: 250, count: 1 }, // 回数が少ない
  { label: '木', value: null, count: 0 }, // 練習なし
];

const renderChart = (columns: readonly Column[] = cols) =>
  render(<ColumnChart title="曜日別" columns={columns} format={(v) => `${v}打`} valueHeader="速度" minSample={3} />);

/** barPath の d 属性から、棒の幅を求める（M x,base V… a r,r … H (x+width-r)） */
function widthOf(d: string): number {
  const m = /^M([\d.]+),[\d.]+ V[\d.]+ a([\d.]+),[\d.]+ 0 0 1 [\d.]+,-[\d.]+ H([\d.]+)/.exec(d);
  if (!m) throw new Error(`解析できない: ${d}`);
  return Number(m[3]) + Number(m[2]) - Number(m[1]);
}

describe('ColumnChart', () => {
  it('値のある区分だけ棒を描く。練習なしの区分は棒なし', () => {
    const { container } = renderChart();
    expect(container.querySelectorAll('path')).toHaveLength(3);
  });

  it('回数が少ない棒は、枠だけ（塗りが薄く、枠線がある）。色以外でも区別できる', () => {
    const { container } = renderChart();
    const [full, , few] = [...container.querySelectorAll('path')] as SVGPathElement[];
    expect(full?.style.fillOpacity).toBe('1');
    expect(few?.style.fillOpacity).toBe('0.15');
    expect(few?.getAttribute('stroke-width')).toBe('1.5');
    expect(full?.getAttribute('stroke-width')).toBe('0');
    expect(screen.getByText(/枠だけの棒は、練習が 3 回未満の参考値です/)).toBeInTheDocument();
  });

  it('少ない区分が無ければ、参考値の注記は出さない', () => {
    renderChart([{ label: '月', value: 1, count: 9 }]);
    expect(screen.queryByText(/枠だけの棒/)).not.toBeInTheDocument();
  });

  it('棒の太さは 24px 以下。区分が多いと、隣と重ならない細さになる', () => {
    const few = renderChart([{ label: 'a', value: 1, count: 9 }, { label: 'b', value: 2, count: 9 }]);
    for (const p of few.container.querySelectorAll('path')) expect(widthOf(p.getAttribute('d') as string)).toBeLessThanOrEqual(24.001);
    few.unmount();

    const many = renderChart(Array.from({ length: 24 }, (_, i) => ({ label: String(i), value: i + 1, count: 9 })));
    const widths = [...many.container.querySelectorAll('path')].map((p) => widthOf(p.getAttribute('d') as string));
    const slot = (640 - 48 - 16) / 24; // 24 区分の 1 区分の幅
    for (const w of widths) expect(w).toBeLessThan(slot); // 隣の棒とくっつかない
  });

  it('棒は下端が四角、先端だけ丸い（先端の円弧は 2 つ、下端に円弧なし）', () => {
    const { container } = renderChart([{ label: 'a', value: 5, count: 9 }]);
    const d = container.querySelector('path')?.getAttribute('d') as string;
    expect(d.match(/ a/g)).toHaveLength(2);
    expect(d.endsWith('V' + d.match(/^M[\d.]+,([\d.]+)/)?.[1] + ' Z')).toBe(true); // 下端は直線で閉じる
  });

  it('キーボード: フォーカスで先頭、矢印で移動、端で止まる、Esc で消える', () => {
    renderChart();
    const group = screen.getByRole('group', { name: '曜日別' });
    fireEvent.focus(group);
    expect(within(screen.getByRole('tooltip')).getByText('200打')).toBeInTheDocument();
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(within(screen.getByRole('tooltip')).getByText('300打')).toBeInTheDocument();
    fireEvent.keyDown(group, { key: 'Home' });
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(within(screen.getByRole('tooltip')).getByText('200打')).toBeInTheDocument();
    fireEvent.keyDown(group, { key: 'End' });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('木・練習なし');
    fireEvent.keyDown(group, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.blur(group);
  });

  it('ツールチップ: 値・区分・回数。回数が少なければ参考値と明記', () => {
    renderChart();
    const group = screen.getByRole('group', { name: '曜日別' });
    fireEvent.keyDown(group, { key: 'ArrowRight' }); // 先頭
    expect(screen.getByRole('tooltip')).toHaveTextContent('月・5回');
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('参考値');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('水・1回');
    expect(screen.getByRole('tooltip')).toHaveTextContent('回数が少ないため参考値です');
  });

  it('ポインタで区分を選び、離れると消える', () => {
    const { container } = renderChart();
    const svg = container.querySelector('svg') as SVGSVGElement;
    fireEvent.pointerEnter(svg.querySelector('[data-column="1"]') as Element);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.pointerLeave(svg);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('表でも読める（値なしは —）', () => {
    renderChart();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(5);
    expect(rows[4]).toHaveTextContent('木—0');
    expect(rows[1]).toHaveTextContent('月200打5');
  });

  it('すべて値なしでも描ける（例外にならない）', () => {
    const { container } = renderChart(cols.map((c) => ({ ...c, value: null, count: 0 })));
    expect(container.querySelectorAll('path')).toHaveLength(0);
  });
});

describe('TimeOfDay', () => {
  /** 実行環境のローカル時刻で作る（時間帯の振り分けもローカル時刻なので、タイムゾーンに依らない） */
  const at = (month: number, day: number, hour: number) => new Date(2026, month - 1, day, hour, 0).getTime();
  const sm = (startedAt: number, kpm: number, misses = 0): SessionSummary => ({
    id: String(startedAt), startedAt, mode: 'practice', kpm, accuracy: 1 - misses / 100, consistency: null, efficiency: null, total: 100, misses,
  });
  // 月曜 21 時に 3 回（300・ミス 1）、火曜 9 時に 3 回（200・ミス 5）
  const data = [
    ...[28, 5, 12].map((d) => sm(at(d === 28 ? 9 : 10, d, 21), 300, 1)),
    ...[29, 6, 13].map((d) => sm(at(d === 29 ? 9 : 10, d, 9), 200, 5)),
  ];

  it('速度が高い時間帯・曜日を、回数つきで示す', () => {
    render(<TimeOfDay summaries={data} />);
    expect(screen.getByRole('status')).toHaveTextContent('速度が高い時間帯: 21時台（300・3回）');
    expect(screen.getByRole('status')).toHaveTextContent('速度が高い曜日: 月曜日（300・3回）');
    expect(screen.getByText('時間帯別の速度')).toBeInTheDocument();
    expect(screen.getByText('曜日別の速度')).toBeInTheDocument();
  });

  it('ミス率に切り替えると、ミスが少ない区分を示す', () => {
    render(<TimeOfDay summaries={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'ミス率' }));
    expect(screen.getByRole('button', { name: 'ミス率' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('ミスが少ない時間帯: 21時台（1.0%・3回）');
    expect(screen.getByText('時間帯別のミス率')).toBeInTheDocument();
  });

  it('比べられる区分が少ないときは、傾向を出さず理由を示す', () => {
    render(<TimeOfDay summaries={[sm(at(9, 28, 21), 300), sm(at(9, 28, 22), 200)]} />);
    expect(screen.getByRole('status')).toHaveTextContent('傾向は出せません（3 回以上の時間帯が 2 つ以上必要です）');
  });

  it('練習が無くても描ける', () => {
    render(<TimeOfDay summaries={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent('傾向は出せません');
    expect(screen.getAllByRole('group', { name: /別の速度/ })).toHaveLength(2);
  });

  it('ツールチップと表の名前は「21時台」「月曜日」。軸は短いラベル', () => {
    render(<TimeOfDay summaries={data} />);
    const hourGroup = screen.getByRole('group', { name: '時間帯別の速度' });
    fireEvent.keyDown(hourGroup, { key: 'End' }); // 23 時台
    expect(screen.getByRole('tooltip')).toHaveTextContent('23時台・');
    const dayGroup = screen.getByRole('group', { name: '曜日別の速度' });
    fireEvent.keyDown(dayGroup, { key: 'Home' });
    expect(screen.getAllByRole('tooltip').at(-1)).toHaveTextContent('月曜日・3回');
    const hourTable = screen.getAllByRole('table')[0] as HTMLElement;
    expect(within(hourTable).getByText('21時台')).toBeInTheDocument();
    expect(within(screen.getAllByRole('table')[1] as HTMLElement).getByText('月曜日')).toBeInTheDocument();
  });

  it('時間帯は 24 区分、曜日は 7 区分の表になる', () => {
    render(<TimeOfDay summaries={data} />);
    const tables = screen.getAllByRole('table');
    expect(within(tables[0] as HTMLElement).getAllByRole('row')).toHaveLength(25);
    expect(within(tables[1] as HTMLElement).getAllByRole('row')).toHaveLength(8);
  });
});
