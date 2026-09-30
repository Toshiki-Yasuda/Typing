import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import { AXIS_IDS, type AxisId, type AxisResult } from '@/metrics/axes';
import type { Keystroke, SessionRecord } from '@/metrics';
import { SETTINGS_KEY } from '@/settings/settings';
import { createMemoryStore, type SessionStore } from '@/storage';
import { UNLOCK_KEY } from '@/themes/unlock';
import { DiagnosisScreen } from './DiagnosisScreen';
import { RadarChart } from './RadarChart';

vi.mock('@/sound/bgm', () => ({ getBgm: () => ({ play: vi.fn(), setScale: vi.fn() }) }));

const axesOf = (scores: Partial<Record<AxisId, number | null>>): Record<AxisId, AxisResult> =>
  Object.fromEntries(
    AXIS_IDS.map((id) => [id, { id, score: scores[id] ?? null, sample: 5, needed: 3 }]),
  ) as Record<AxisId, AxisResult>;

describe('RadarChart', () => {
  it('6 つの軸のラベルと得点が文字で読める。点は軸の数だけ、キーボードで選べる', () => {
    render(<RadarChart title="6軸の得点" axes={axesOf({ speed: 90, adapt: 60, shape: 30, steady: 70, control: 80, reach: 50 })} />);
    for (const [label, score] of [['速さ', 90], ['適応', 60], ['形', 30], ['安定', 70], ['制御', 80], ['到達', 50]] as const) {
      expect(screen.getByRole('img', { name: `${label} ${score}点` })).toHaveAttribute('tabindex', '0');
    }
    expect(document.querySelectorAll('polygon[fill-opacity]')).toHaveLength(1); // 得点の面
  });

  it('データ不足の軸は点を打たず、「データ不足」と書く（0 点にしない）', () => {
    render(<RadarChart title="t" axes={axesOf({ speed: 90, adapt: 60, shape: 30, steady: null, control: null, reach: 50 })} />);
    expect(screen.getAllByText('データ不足').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('img', { name: /^安定/ })).toBeNull();
    expect(screen.queryByRole('img', { name: /^制御/ })).toBeNull();
    expect(screen.getAllByRole('img')).toHaveLength(4);
  });

  it('点の軸が 3 つ未満なら、面は描かない（点だけ）', () => {
    render(<RadarChart title="t" axes={axesOf({ speed: 90, adapt: 60 })} />);
    expect(document.querySelectorAll('polygon[fill-opacity]')).toHaveLength(0);
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('点にフォーカスすると値のツールチップが出る。外すと消える', () => {
    render(<RadarChart title="t" axes={axesOf({ speed: 90.4, adapt: 60, shape: 30 })} kinds={{ speed: '強化系' }} />);
    const dot = screen.getByRole('img', { name: '速さ 90点' });
    fireEvent.focus(dot);
    expect(screen.getByRole('tooltip')).toHaveTextContent('90点');
    expect(screen.getByRole('tooltip')).toHaveTextContent('速さ（強化系）');
    fireEvent.blur(dot);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('表ビュー: 全 6 軸の得点・サンプル・見るものが並ぶ（データ不足も）', () => {
    render(<RadarChart title="t" axes={axesOf({ speed: 90.44, adapt: null })} kinds={{ speed: '強化系' }} />);
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveTextContent('速さ（強化系）');
    expect(rows[0]).toHaveTextContent('90.4点');
    expect(rows[0]).toHaveTextContent('5 / 3');
    expect(rows[1]).toHaveTextContent('データ不足');
  });

  it('軸は環の順（速さ→適応→形→安定→制御→到達）に上から時計回り', () => {
    render(<RadarChart title="t" axes={axesOf({ speed: 100, adapt: 100, shape: 100, steady: 100, control: 100, reach: 100 })} />);
    // 100 点の点は外周。最初の点（速さ）は真上（中心と x が同じで y が小さい）
    const pos = screen.getAllByRole('img').map((el) => ({
      name: el.getAttribute('aria-label'),
      x: Number(el.getAttribute('cx')),
      y: Number(el.getAttribute('cy')),
    }));
    expect(pos.map((p) => p.name?.split(' ')[0])).toEqual(['速さ', '適応', '形', '安定', '制御', '到達']);
    expect(pos[0]!.x).toBeCloseTo(180, 0);
    expect(pos[0]!.y).toBeLessThan(pos[3]!.y); // 速さは上、安定は下（向かい合う）
    expect(pos[1]!.x).toBeGreaterThan(180); // 時計回りに、次は右上
    expect(pos).toHaveLength(6);
  });
});

/** n 打鍵を一定の間隔 dt で正しく打つ記録（150ms=400KPM、一貫性 100） */
const run = (n: number, dt: number, startedAt: number, id: string): SessionRecord => {
  const keystrokes: Keystroke[] = Array.from({ length: n }, (_, i) => ({ t: (i + 1) * dt, key: 'x', code: '', expected: 'x', correct: true, item: 0 }));
  return { id, startedAt, mode: 'practice', contentId: 'basic', targets: ['x'], engineVersion: '1', ruleVersion: '1', keystrokes };
};

async function screenWith(records: SessionRecord[], settings: object = {}) {
  const store: SessionStore = createMemoryStore();
  for (const r of records) await store.add(r);
  localStorage.clear();
  localStorage.setItem(UNLOCK_KEY, '["hunter"]');
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  render(
    <StoreProvider store={store}>
      <MemoryRouter initialEntries={['/diagnosis']}>
        <Routes>
          <Route path="/diagnosis" element={<DiagnosisScreen />} />
          <Route path="/title" element={<p>タイトル画面</p>} />
          <Route path="/stats" element={<p>統計画面</p>} />
          <Route path="/" element={<p>ホーム画面</p>} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
  await screen.findByRole('group', { name: '集計の期間' });
  await act(async () => {});
}

afterEach(cleanup);

describe('診断の画面', () => {
  const enough = () => Array.from({ length: 7 }, (_, i) => run(30, 150, Date.now() - i * 1000, `r${i}`));

  it('データが足りていれば、得意な軸と伸ばせる軸を、テーマの言葉（系統・水見式）で示す', async () => {
    await screenWith(enough(), { themeId: 'hunter' });
    expect(await screen.findByRole('heading', { level: 1, name: '念系統診断' })).toBeInTheDocument();
    const result = screen.getByRole('region', { name: '診断の結果' });
    expect(result).toHaveTextContent('得意な軸: 速さ（強化系）');
    expect(result).toHaveTextContent('水見式: 水があふれる');
    // 速さ・制御・安定が同点 100 → 伸ばせる軸は環の順で先の「安定」（特質系）
    expect(result).toHaveTextContent('伸ばせる軸: 安定（特質系）');
    expect(result).toHaveTextContent('伸ばしやすさ（六性図）: 40%（環の距離 3）'); // 速さ↔安定は向かい
    // 演出であることを、伸ばしやすさの説明と、画面の末尾の両方に書く
    expect(screen.getAllByText(/効果の根拠/)).toHaveLength(2);
  });

  it('標準テーマでは、系統など作品の言葉を出さない（軸の名前だけ）', async () => {
    await screenWith(enough(), { themeId: 'neutral' });
    expect(await screen.findByRole('heading', { level: 1, name: '6軸診断' })).toBeInTheDocument();
    const result = screen.getByRole('region', { name: '診断の結果' });
    expect(result).toHaveTextContent('得意な軸: 速さ');
    expect(result).not.toHaveTextContent('強化系');
    expect(result).not.toHaveTextContent('六性図');
  });

  it('記録が無ければ診断せず、足りない軸とサンプルの進みを示す', async () => {
    await screenWith([], { themeId: 'hunter' });
    const result = await screen.findByRole('region', { name: '診断の結果' });
    expect(result).toHaveTextContent('まだ診断できません');
    expect(result).toHaveTextContent('速さ（強化系）: データ不足（0 / 3）');
    const inChart = [...document.querySelectorAll('svg tspan')].filter((t) => t.textContent === 'データ不足');
    expect(inChart).toHaveLength(6); // グラフの 6 軸すべて
  });

  it('期間を絞ると、古い記録は含めない（30日より前の記録は「全期間」でだけ効く）', async () => {
    const old = Array.from({ length: 7 }, (_, i) => run(30, 150, Date.now() - 40 * 86_400_000 - i * 1000, `o${i}`));
    await screenWith(old, { themeId: 'hunter' });
    expect(screen.getByRole('region', { name: '診断の結果' })).toHaveTextContent('得意な軸');
    fireEvent.click(screen.getByRole('button', { name: '30日' }));
    expect(screen.getByRole('button', { name: '30日' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: '診断の結果' })).toHaveTextContent('まだ診断できません');
    fireEvent.click(screen.getByRole('button', { name: '全期間' }));
    expect(screen.getByRole('region', { name: '診断の結果' })).toHaveTextContent('得意な軸');
  });

  it('Esc: 入口のあるテーマはタイトルへ、標準は統計へ', async () => {
    await screenWith([], { themeId: 'hunter' });
    act(() => void fireEvent.keyDown(window, { key: 'Escape' }));
    expect(screen.getByText('タイトル画面')).toBeInTheDocument();
    cleanup();
    await screenWith([], { themeId: 'neutral' });
    act(() => void fireEvent.keyDown(window, { key: 'Escape' }));
    expect(screen.getByText('統計画面')).toBeInTheDocument();
  });
});
