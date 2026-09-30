import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import type { ContentItem } from '@/content';
import { SETTINGS_KEY } from '@/settings/settings';
import type { SoundKind } from '@/sound/player';
import { createMemoryStore } from '@/storage';
import { HUNTER_THEME } from '@/themes/themes';
import { UNLOCK_KEY } from '@/themes/unlock';
import { Play } from '../Play';
import { Result } from '../Result';
import { Stats } from '../Stats';
import { VowsPicker } from './VowsPicker';

vi.mock('@/sound/bgm', () => ({ getBgm: () => ({ play: vi.fn(), setScale: vi.fn() }) }));
const played: SoundKind[] = [];
vi.mock('@/sound/useSoundPlayer', () => ({ useSoundPlayer: () => ({ play: (k: SoundKind) => played.push(k) }) }));

const items: ContentItem[] = [{ display: '柿', reading: 'かき' }, { display: '海', reading: 'うみ' }];
const press = (key: string) => act(() => void fireEvent.keyDown(window, { key, code: `Key${key.toUpperCase()}` }));
const ready = async () => {
  await screen.findByRole('region', { name: 'お題' });
  await act(async () => {});
};

function renderPlay(vows: string[] | undefined, extra: Partial<React.ComponentProps<typeof Play>> = {}) {
  const store = createMemoryStore();
  render(
    <StoreProvider store={store}>
      <MemoryRouter initialEntries={['/play']}>
        <Routes>
          <Route path="/play" element={<Play items={items} mode="stage:x" vows={vows} {...extra} />} />
          <Route path="/result/:id" element={<Result />} />
          <Route path="/stats" element={<Stats />} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
  return store;
}

beforeEach(() => {
  localStorage.clear();
  played.length = 0;
});
afterEach(cleanup);

describe('縛り: ローマ字を隠す', () => {
  it('ガイドの文字を「・」にし、読みは見える。打鍵の判定は同じで、記録に vows が残る', async () => {
    const store = renderPlay(['noRomaji']);
    await ready();
    const guide = screen.getByLabelText('ローマ字ガイド（隠しています）');
    expect(guide).toHaveTextContent('＊・・・'); // 次の 1 文字 + 残り 3 文字（kaki の k を除く aki）
    expect(guide.textContent).not.toMatch(/[a-z]/);
    expect(screen.getByText('かき')).toBeInTheDocument();
    press('k');
    press('1'); // ミス（判定は普通）
    for (const k of 'akiumi') press(k);
    expect(await screen.findByRole('heading', { name: '結果' })).toBeInTheDocument();
    const rec = (await store.list())[0];
    expect(rec?.vows).toEqual(['noRomaji']);
    expect(rec?.keystrokes.map((k) => k.correct)).toEqual([true, false, true, true, true, true, true, true]);
  });

  it('対照: 縛りなしなら、ローマ字が見え、記録に vows を持たない', async () => {
    const store = renderPlay(undefined);
    await ready();
    expect(screen.getByLabelText('ローマ字ガイド')).toHaveTextContent('kaki');
    for (const k of 'kakiumi') press(k);
    await screen.findByRole('heading', { name: '結果' });
    expect('vows' in ((await store.list())[0] ?? {})).toBe(false);
  });
});

describe('縛り: 無音', () => {
  it('効果音を鳴らさない（対照: 縛りなしでは鳴る）', async () => {
    renderPlay(['silent']);
    await ready();
    press('k');
    expect(played).toEqual([]);
    cleanup();
    renderPlay(undefined);
    await ready();
    press('k');
    expect(played).toEqual(['type']);
  });
});

describe('縛り: ミスなし', () => {
  it('ミスをしたらそこで終わり、記録して結果へ。結果にも「破れた」と出る', async () => {
    const store = renderPlay(['noMiss']);
    await ready();
    press('k');
    press('1');
    const soundsAtEnd = played.length;
    press('a'); // 保存が終わる前に打っても、何も起きない（音も鳴らさない）
    press('k');
    expect(played.length).toBe(soundsAtEnd);
    expect(await screen.findByRole('heading', { name: '結果' })).toBeInTheDocument();
    expect(screen.getByText(/「ミスなし」が破れた/)).toBeInTheDocument();
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.vows).toEqual(['noMiss']);
    expect(list[0]?.keystrokes).toHaveLength(2);
  });

  it('ミスをしなければ、最後まで打てて、クリアのメダルが出る（ステージのとき）', async () => {
    renderPlay(['noMiss', 'silent']);
    await ready();
    for (const k of 'kakiumi') press(k);
    expect(await screen.findByRole('heading', { name: '結果' })).toBeInTheDocument();
    expect(screen.queryByText(/破れた/)).toBeNull();
    expect(screen.getByText('縛り付きの練習')).toBeInTheDocument();
  });

  it('ボス戦では、許容 0 回になり、最初のミスで敗北', async () => {
    localStorage.setItem(UNLOCK_KEY, '["hunter"]');
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ themeId: 'hunter' }));
    const boss = HUNTER_THEME.bosses?.find((b) => b.id === 'chapter1') as NonNullable<typeof HUNTER_THEME.bosses>[number];
    renderPlay(['noMiss'], { boss, mode: 'boss:chapter1' });
    await ready();
    expect(screen.getByText(/ミスの余裕 0 回（次のミスで敗北）/)).toBeInTheDocument();
    press('1');
    expect(await screen.findByRole('heading', { name: '結果' })).toBeInTheDocument();
  });
});

describe('縛り付きの記録は級位に数えない', () => {
  it('結果画面: 縛り付きの練習には級位の欄を出さない（対照: 縛りなしでは出る）', async () => {
    const keys = (n: number) => Array.from({ length: n }, (_, i) => ({ t: (i + 1) * 150, key: 'a', code: 'KeyA', expected: 'a', correct: true, item: 0 }));
    const store = createMemoryStore();
    await store.add({ id: 'plain', startedAt: 1, mode: 'practice', contentId: 'c', targets: ['a'], engineVersion: '1', ruleVersion: '1', keystrokes: keys(30) });
    await store.add({ id: 'vowed', startedAt: 2, mode: 'stage:x', contentId: 'c', targets: ['a'], engineVersion: '1', ruleVersion: '1', vows: ['silent'], keystrokes: keys(30) });
    const open = (id: string) =>
      render(
        <StoreProvider store={store}>
          <MemoryRouter initialEntries={[`/result/${id}`]}>
            <Routes>
              <Route path="/result/:id" element={<Result />} />
            </Routes>
          </MemoryRouter>
        </StoreProvider>,
      );
    open('plain');
    expect(await screen.findByRole('heading', { name: '級位' })).toBeInTheDocument();
    cleanup();
    open('vowed');
    await screen.findByText('縛り付きの練習');
    expect(screen.queryByRole('heading', { name: '級位' })).toBeNull();
  });
});

describe('縛り付きの記録は統計に数えない', () => {
  it('統計に、含めていない件数を示す', async () => {
    renderPlay(['silent']);
    await ready();
    for (const k of 'kakiumi') press(k);
    await screen.findByRole('heading', { name: '結果' });
    cleanup();
    // 同じストアで統計を開く
    const store = createMemoryStore();
    await store.add({ id: 'v', startedAt: 1, mode: 'stage:x', contentId: 'c', targets: ['a'], engineVersion: '1', ruleVersion: '1', vows: ['silent'],
      keystrokes: [{ t: 100, key: 'a', code: 'KeyA', expected: 'a', correct: true, item: 0 }] });
    render(
      <StoreProvider store={store}>
        <MemoryRouter>
          <Stats />
        </MemoryRouter>
      </StoreProvider>,
    );
    expect(await screen.findByText(/縛り付きの記録 1 件は、この統計に含めていません/)).toBeInTheDocument();
    expect(screen.getByText('この期間の記録がありません。')).toBeInTheDocument();
  });
});

describe('VowsPicker', () => {
  it('選ぶと設定に保存され、メダルの見込みが文字で出る。見出しはテーマに従う', () => {
    render(<VowsPicker />);
    expect(screen.getByRole('group', { name: '縛り' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('狙えるメダル: なし');
    fireEvent.click(screen.getByRole('checkbox', { name: /無音/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /ミスなし/ }));
    expect(screen.getByRole('status')).toHaveTextContent('2 つ');
    expect(screen.getByRole('status')).toHaveTextContent('銀');
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}').vows).toEqual(['noMiss', 'silent']);
    cleanup();
    localStorage.setItem(UNLOCK_KEY, '["hunter"]');
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ themeId: 'hunter' }));
    render(<VowsPicker />);
    expect(screen.getByRole('group', { name: '制約と誓約' })).toBeInTheDocument();
  });
});
