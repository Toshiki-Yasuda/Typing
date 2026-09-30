import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import { clearCodexCache } from '@/content/codex';
import type { Keystroke, SessionRecord } from '@/metrics';
import { BOSS_PROGRESS_KEY } from '@/session/bossProgress';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '@/settings/settings';
import { createMemoryStore, type SessionStore } from '@/storage';
import { HUNTER_THEME } from '@/themes/themes';
import { UNLOCK_KEY } from '@/themes/unlock';
import { LicenseScreen } from './LicenseScreen';

vi.mock('@/sound/bgm', () => ({ getBgm: () => ({ play: vi.fn(), setScale: vi.fn() }) }));

const CODEX = { entries: [{ display: 'ゴン', reading: 'ごん', category: 'character', chapter: 1 }, { display: 'ジン', reading: 'じん', category: 'character', chapter: 1 }] };
const keys = (n: number, dt: number, item = 0): Keystroke[] =>
  Array.from({ length: n }, (_, i) => ({ t: dt * (i + 1), key: 'a', code: 'KeyA', expected: 'a', correct: true, item }));
const rec = (id: string, mode: string, target: string, n: number, dt: number, vows?: string[]): SessionRecord => ({
  id, startedAt: 1, mode, contentId: 'c', targets: [target], engineVersion: '1', ruleVersion: '1', keystrokes: keys(n, dt), ...(vows ? { vows } : {}),
});

const stageIds = (HUNTER_THEME.chapters ?? []).flatMap((c) => c.stages.map((s) => s.id));

async function open(store: SessionStore, settings: object = {}) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, themeId: 'hunter', ...settings }));
  render(
    <StoreProvider store={store}>
      <MemoryRouter initialEntries={['/license']}>
        <Routes>
          <Route path="/license" element={<LicenseScreen />} />
          <Route path="/title" element={<p>タイトルへ戻った</p>} />
          <Route path="/" element={<p>ホームへ戻った</p>} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
  await screen.findByRole('heading', { level: 1, name: 'ライセンス' });
  return await screen.findByRole('region', { name: 'HUNTER LICENSE' });
}
const field = (card: HTMLElement, name: RegExp) => within(card).getByText(name).closest('div') as HTMLElement;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(UNLOCK_KEY, '["hunter"]');
  clearCodexCache();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => CODEX })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('マイライセンス', () => {
  it('記録が無ければ、名前は未設定・星なし・未診断・討伐 0', async () => {
    const card = await open(createMemoryStore());
    expect(card).toHaveTextContent('（ハンターネーム未設定）');
    expect(card).toHaveTextContent('星 0 つ・級位なし');
    expect(field(card, /^系統$/)).toHaveTextContent('未診断');
    expect(field(card, /^ボス討伐$/)).toHaveTextContent(`0 / ${HUNTER_THEME.bosses?.length}`);
    expect(field(card, /^ステージクリア$/)).toHaveTextContent(`0 / ${stageIds.length}`);
    expect(field(card, /図鑑/)).toHaveTextContent('0・0 / 2');
  });

  it('設定のハンターネームを出す。入力すると設定に保存され、カードに反映される（12 文字まで）', async () => {
    const card = await open(createMemoryStore(), { hunterName: 'ゴン' });
    expect(card).toHaveTextContent('ゴン');
    const input = screen.getByLabelText('ハンターネーム');
    fireEvent.change(input, { target: { value: 'キルア' } });
    expect(card).toHaveTextContent('キルア');
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').hunterName).toBe('キルア');
    fireEvent.change(input, { target: { value: 'あ'.repeat(20) } });
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').hunterName).toBe('あ'.repeat(12));
  });

  it('級位と星: 速い記録から級位がつき、星の数を文字で示す（暫定つき）', async () => {
    const store = createMemoryStore();
    // 30 打鍵を 0.1 秒間隔 → 約 600 打鍵/分 = 十段（最上位）
    await store.add(rec('a', 'practice', 'ごん', 30, 100));
    const card = await open(store);
    expect(card).toHaveTextContent('星 5 つ・十段（暫定）');
  });

  it('診断できるだけの記録があれば、得意な軸の系統名が出る', async () => {
    const store = createMemoryStore();
    // 30 打鍵を 0.15 秒間隔 × 8 回: 速さ・制御・安定の 3 軸が求まり、最高得点は速さ（強化系）
    for (let i = 0; i < 8; i++) await store.add({ ...rec(`d${i}`, 'practice', 'x', 30, 150), startedAt: i + 1 });
    const card = await open(store);
    expect(field(card, /^系統$/)).toHaveTextContent('強化系');
  });

  it('ボス討伐・ステージクリア・図鑑の数は、戦績と記録から。縛り付きの記録は級位に数えないが、ステージには数える', async () => {
    localStorage.setItem(BOSS_PROGRESS_KEY, JSON.stringify({ chapter1: { attempts: 2, wins: 1, best: 'B' }, chapter2: { attempts: 1, wins: 0, best: null } }));
    const store = createMemoryStore();
    await store.add(rec('s', `stage:${stageIds[0]}`, 'じん', 30, 100, ['silent']));
    const card = await open(store);
    expect(field(card, /^ボス討伐$/)).toHaveTextContent(`1 / ${HUNTER_THEME.bosses?.length}`);
    expect(field(card, /^ステージクリア$/)).toHaveTextContent(`1 / ${stageIds.length}`);
    expect(card).toHaveTextContent('級位なし'); // 縛り付きは級位に数えない
    expect(field(card, /図鑑/)).toHaveTextContent('0・0 / 2'); // 図鑑にも数えない
  });

  it('図鑑の遭遇・習熟の数', async () => {
    const store = createMemoryStore();
    for (const id of ['1', '2', '3']) await store.add(rec(id, 'practice', 'ごん', 20, 400));
    await store.add(rec('4', 'practice', 'じん', 20, 400));
    const card = await open(store);
    expect(field(card, /図鑑/)).toHaveTextContent('2・1 / 2');
  });

  it('Esc でタイトルへ。ただし名前の入力中の Esc では戻らない', async () => {
    await open(createMemoryStore());
    const input = screen.getByLabelText('ハンターネーム');
    input.focus();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('タイトルへ戻った')).toBeNull();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(await screen.findByText('タイトルへ戻った')).toBeInTheDocument();
  });

  it('ライセンスの無いテーマ（標準）では、ホームへ戻す', async () => {
    localStorage.clear();
    render(
      <StoreProvider store={createMemoryStore()}>
        <MemoryRouter initialEntries={['/license']}>
          <Routes>
            <Route path="/license" element={<LicenseScreen />} />
            <Route path="/" element={<p>ホームへ戻った</p>} />
          </Routes>
        </MemoryRouter>
      </StoreProvider>,
    );
    expect(await screen.findByText('ホームへ戻った')).toBeInTheDocument();
  });
});
