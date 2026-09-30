import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import type { ContentItem } from '@/content';
import { loadBossProgress } from '@/session/bossProgress';
import { SETTINGS_KEY } from '@/settings/settings';
import { createMemoryStore } from '@/storage';
import { HUNTER_THEME } from '@/themes/themes';
import { UNLOCK_KEY } from '@/themes/unlock';
import { BossResultPanel, parseBossOutcome } from './boss/BossResultPanel';
import { Play } from './Play';
import { Result } from './Result';

vi.mock('@/sound/bgm', () => ({ getBgm: () => ({ play: vi.fn(), setScale: vi.fn() }) }));

const boss = (id: string) => HUNTER_THEME.bosses?.find((b) => b.id === id) as NonNullable<typeof HUNTER_THEME.bosses>[number];
const three: ContentItem[] = [{ display: '柿', reading: 'かき' }, { display: '海', reading: 'うみ' }, { display: '猫', reading: 'ねこ' }];
const press = (key: string) => act(() => void fireEvent.keyDown(window, { key, code: `Key${key.toUpperCase()}` }));
const typeKeys = (keys: string) => [...keys].forEach(press);

function renderBoss(b: ReturnType<typeof boss>, props: Partial<React.ComponentProps<typeof Play>> = {}, items = three) {
  const store = createMemoryStore();
  render(
    <StoreProvider store={store}>
      <MemoryRouter initialEntries={['/play']}>
        <Routes>
          <Route path="/play" element={<Play items={items} boss={b} mode={`boss:${b.id}`} fingerGuide={{ layout: 'jis' }} {...props} />} />
          <Route path="/result/:id" element={<Result />} />
          <Route path="/" element={<p>ホームへ戻った</p>} />
        </Routes>
      </MemoryRouter>
    </StoreProvider>,
  );
  return store;
}
const ready = async () => {
  await screen.findByRole('region', { name: 'お題' });
  await act(async () => {});
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(UNLOCK_KEY, '["hunter"]');
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ themeId: 'hunter', effects: 'off' }));
});
afterEach(cleanup);

describe('ボス戦: 時間制限', () => {
  it('残り時間を文字で出し、時間が来ると敗北（時間切れ）。記録と戦績が残る', async () => {
    const store = renderBoss({ ...boss('chapter1'), timeLimitSec: 1 });
    await ready();
    expect(screen.getByRole('timer')).toHaveTextContent(/残り [01] 秒/);
    typeKeys('k');
    expect(await screen.findByRole('heading', { name: /に敗れた（時間切れ）（ランク D）/ }, { timeout: 3000 })).toBeInTheDocument();
    expect((await store.list())[0]?.keystrokes).toHaveLength(1);
    expect(loadBossProgress().chapter1).toMatchObject({ attempts: 1, wins: 0 });
  });

  it('1 打もないまま時間切れなら、記録せずホームへ', async () => {
    const store = renderBoss({ ...boss('chapter1'), timeLimitSec: 1 });
    expect(await screen.findByText('ホームへ戻った', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await store.list()).toHaveLength(0);
  });

  it('時間の切れた後の打鍵は受けない', async () => {
    const store = renderBoss({ ...boss('chapter1'), timeLimitSec: 1 });
    await ready();
    typeKeys('k');
    const now = performance.now();
    const spy = vi.spyOn(performance, 'now').mockReturnValue(now + 5000);
    typeKeys('a');
    spy.mockRestore();
    await screen.findByRole('heading', { name: /時間切れ/ }, { timeout: 3000 });
    expect((await store.list())[0]?.keystrokes).toHaveLength(1);
  });

  it('時間制限の無いボスに、タイマーは出ない', async () => {
    renderBoss(boss('chapter1'));
    await ready();
    expect(screen.queryByRole('timer')).toBeNull();
  });
});

describe('ボス戦: 攻撃予告', () => {
  // 2 語ごとに 1 語が予告（1 番目＝うみ）。猶予 5 秒
  const attacker = () => ({ ...boss('chapter2'), attacks: { everyWords: 2, windowSec: 5 } });

  it('予告の語では残り時間を文字で出し、予告の無い語ではそう書く', async () => {
    renderBoss(attacker());
    await ready();
    expect(screen.getByText(/この語は予告なし/)).toBeInTheDocument();
    typeKeys('kaki');
    expect(await screen.findByText(/残り [45]\.\d 秒（間に合わないとミス扱い）/)).toBeInTheDocument();
  });

  it('猶予が尽きると、戦闘のミスを 1 回だけ受ける。打鍵の記録は変わらない', async () => {
    const store = renderBoss(attacker());
    await ready();
    typeKeys('kaki');
    await screen.findByText(/残り [45]\.\d 秒/);
    expect(screen.getByText(/ミスの余裕 3 回/)).toBeInTheDocument();
    const spy = vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 6000);
    expect(await screen.findByText(/攻撃を受けた/, {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByText(/ミスの余裕 2 回/)).toBeInTheDocument();
    await act(async () => void (await new Promise((r) => setTimeout(r, 700)))); // さらに待っても、同じ語では 2 回目を受けない
    expect(screen.getByText(/ミスの余裕 2 回/)).toBeInTheDocument();
    spy.mockRestore();
    typeKeys('umineko');
    await vi.waitFor(async () => expect(await store.list()).toHaveLength(1), { timeout: 3000 });
    const rec = (await store.list())[0];
    expect(rec?.keystrokes).toHaveLength(11); // kaki + umi + neko。攻撃のミスは打鍵ログに入らない
    expect(rec?.keystrokes.every((k) => k.correct)).toBe(true);
  });

  it('猶予の内に打ち終えれば、ミスは受けない', async () => {
    renderBoss(attacker());
    await ready();
    typeKeys('kaki');
    await screen.findByText(/残り [45]\.\d 秒/);
    const spy = vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 3000);
    typeKeys('umi');
    spy.mockRestore();
    await act(async () => void (await new Promise((r) => setTimeout(r, 500))));
    expect(screen.queryByText(/攻撃を受けた/)).toBeNull();
    expect(screen.getByText(/ミスの余裕 3 回/)).toBeInTheDocument();
  });

  it('猶予は、予告の語が出た時点から数える（前の語に時間をかけても、その分は引かれない）', async () => {
    renderBoss(attacker());
    await ready();
    const t0 = performance.now();
    const spy = vi.spyOn(performance, 'now').mockReturnValue(t0 + 3000);
    typeKeys('kaki'); // 1 語目に 3 秒かけた → 予告の語は「3 秒時点」から数える
    await screen.findByText(/残り [45]\.\d 秒/);
    spy.mockReturnValue(t0 + 6000); // 予告の語が出て 3 秒 < 猶予 5 秒
    await act(async () => void (await new Promise((r) => setTimeout(r, 700))));
    spy.mockRestore();
    expect(screen.queryByText(/攻撃を受けた/)).toBeNull();
  });

  it('設定 bossSkills をオフにすると、攻撃予告も出ない', async () => {
    renderBoss(attacker(), { skillsOn: false });
    await ready();
    typeKeys('kaki');
    await act(async () => void (await new Promise((r) => setTimeout(r, 500))));
    expect(screen.queryByText(/攻撃予告/)).toBeNull();
  });

  it('攻撃予告の無いボスには出ない', async () => {
    renderBoss(boss('chapter1'));
    await ready();
    expect(screen.queryByText(/攻撃予告/)).toBeNull();
  });
});

describe('ボスの技', () => {
  it('hide（ヒソカ）: 3 つ目のお題だけ、ローマ字の残りが隠れる（打った分は見える）。技を切れば隠れない', async () => {
    renderBoss(boss('chapter1'));
    await ready();
    expect(screen.getByText(/技「トランプの奇術」/)).toBeInTheDocument();
    typeKeys('kakiumi');
    expect(screen.getByLabelText('ローマ字ガイド（隠しています）')).toHaveTextContent('＊・・');
    expect(screen.getByText(/この語は、ローマ字の残りが隠れています/)).toBeInTheDocument();
    typeKeys('n');
    expect(screen.getByLabelText('ローマ字ガイド（隠しています）')).toHaveTextContent('n＊・');
    cleanup();
    renderBoss(boss('chapter1'), { skillsOn: false });
    await ready();
    typeKeys('kakiumi');
    expect(screen.getByLabelText('ローマ字ガイド')).toHaveTextContent('neko');
    expect(screen.queryByText(/技「/)).toBeNull();
  });

  it('strip（クロロ）: ミスした次のお題だけ、運指ガイドを出さない', async () => {
    renderBoss(boss('chapter3'));
    await ready();
    expect(screen.getByRole('region', { name: '運指ガイド' })).toBeInTheDocument();
    press('k');
    press('1'); // ミス
    typeKeys('aki');
    expect(screen.queryByRole('region', { name: '運指ガイド' })).toBeNull();
    expect(screen.getByText(/この語は、運指ガイドを奪われています/)).toBeInTheDocument();
    typeKeys('umi');
    expect(screen.getByRole('region', { name: '運指ガイド' })).toBeInTheDocument(); // 3 つ目は戻る
  });

  it('stamina（ビスケ）: 10 連続の正打で、ミスの余裕が 1 回ぶん戻る', async () => {
    renderBoss(boss('chapter4'), {}, [{ display: '長', reading: 'かきくけこかきくけこ' }, { display: '海', reading: 'うみ' }]);
    await ready();
    expect(screen.getByText('ミスの余裕 5 回')).toBeInTheDocument();
    press('1');
    expect(screen.getByText('ミスの余裕 4 回')).toBeInTheDocument();
    typeKeys('kakikukeko'); // 10 打（かきくけこ = ka ki ku ke ko）
    expect(screen.getByText('ミスの余裕 5 回')).toBeInTheDocument();
  });

  it('技の無いボス（ヒソカ以外の章 2）には、技の表示が出ない', async () => {
    renderBoss(boss('chapter2'));
    await ready();
    expect(screen.queryByText(/技「/)).toBeNull();
  });
});

describe('ボスの報酬（メダル）', () => {
  it('縛りを付けて勝つと、戦績に縛りの数が残り、結果にメダルが出る。敗北では変わらない', async () => {
    renderBoss(boss('chapter1'), { vows: ['silent', 'noFinger'] });
    await ready();
    typeKeys('kakiumineko');
    expect(await screen.findByText('縛り 2 つで勝利：メダル 銀')).toBeInTheDocument();
    expect(loadBossProgress().chapter1).toMatchObject({ wins: 1, bestVows: 2 });
  });
});

describe('ボスの結果パネル', () => {
  const outcome = { id: 'chapter6', rank: 'D', misses: 1, maxCombo: 3, lostBy: 'time', vows: 2 };
  it('parse: 敗北の理由と縛りの数を受け取る。不正な値は捨てる', () => {
    expect(parseBossOutcome({ boss: outcome })).toEqual(outcome);
    expect(parseBossOutcome({ boss: { ...outcome, lostBy: 'x', vows: -1 } })).toEqual({ id: 'chapter6', rank: 'D', misses: 1, maxCombo: 3 });
  });

  it('時間切れの敗北と、縛りつき勝利のメダルを文字で示す', () => {
    const b = boss('chapter6');
    const { rerender } = render(<BossResultPanel boss={b} outcome={{ id: b.id, rank: 'D', misses: 0, maxCombo: 1, lostBy: 'time' }} />);
    expect(screen.getByRole('heading')).toHaveTextContent('に敗れた（時間切れ）');
    expect(screen.getByText(/制限時間 90 秒/)).toBeInTheDocument();
    rerender(<BossResultPanel boss={b} outcome={{ id: b.id, rank: 'B', misses: 0, maxCombo: 5, vows: 2 }} />);
    expect(screen.getByText('縛り 2 つで勝利：メダル 銀')).toBeInTheDocument();
    rerender(<BossResultPanel boss={b} outcome={{ id: b.id, rank: 'D', misses: 0, maxCombo: 5, vows: 2 }} />);
    expect(screen.queryByText(/で勝利/)).toBeNull();
  });
});
