import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { seedRecords } from './helpers';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
/** 有限のアニメーション（フェードなど）が終わるのを待つ。途中の半透明の色を測って誤検出しないように */
async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

async function scan(page: Page, label: string) {
  await settle(page);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.map((n) => n.target.join(' ')) }));
  expect(summary, `${label} の違反:\n${JSON.stringify(summary, null, 2)}`).toEqual([]);
}

async function unlock(page: Page) {
  await page.goto('/');
  await page.getByLabel(/パスワードで新しいテーマを開く/).fill('SAKI');
  await page.getByRole('button', { name: '開く' }).click();
  // ゲートの準備（キー受付・フォーカス）が済むのを待つ。早すぎる Esc は取りこぼされる
  await expect(page.getByRole('button', { name: /スタート/ })).toBeFocused();
}

test.describe('テーマの入口', () => {
  test('テーマを開くとゲート → オープニング → タイトルメニュー（各段階で axe も通る）', async ({ page }) => {
    await unlock(page);
    const gate = page.getByRole('button', { name: /スタート/ });
    await expect(gate).toBeVisible();
    await expect(page).toHaveTitle(/HUNTER×HUNTER/);
    await scan(page, '入口（ゲート）');

    await gate.click();
    const skip = page.getByRole('button', { name: /飛ばす/ });
    await expect(skip).toBeVisible();
    await scan(page, '入口（オープニング）');

    // 飛ばさなくても、時間が来ればタイトルへ
    await expect(page.getByRole('navigation', { name: 'メニュー' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: /はじめる/ })).toBeFocused();
    await scan(page, '入口（タイトルメニュー）');
  });

  test('キーボードだけで入れる: Enter でスタート → Esc で飛ばす → 数字キーで練習へ', async ({ page }) => {
    await unlock(page);
    await expect(page.getByRole('button', { name: /スタート/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: /飛ばす/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'メニュー' })).toBeVisible();
    await page.keyboard.press('1');
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
  });

  test('同じタブで入口を見た後は、ホームがそのまま開く。再読み込みしても繰り返さない', async ({ page }) => {
    await unlock(page);
    await page.keyboard.press('Escape'); // ゲートから直接タイトルへ
    await page.getByRole('link', { name: /ホーム/ }).click();
    await expect(page.getByRole('heading', { name: 'ボス戦' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'ボス戦' })).toBeVisible();
  });

  test('新しいタブ（新しい起動）では、保存済みのテーマの入口が先に出る', async ({ page, context }) => {
    await unlock(page);
    await page.keyboard.press('Escape');
    const fresh = await context.newPage(); // sessionStorage は別
    await fresh.goto('/');
    await expect(fresh.getByRole('button', { name: /スタート/ })).toBeVisible();
  });

  test('演出オフでは、ゲートもオープニングも出さずタイトル', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('typing.settings.v1', JSON.stringify({ effects: 'off' })));
    await page.reload();
    await page.getByLabel(/パスワードで新しいテーマを開く/).fill('SAKI');
    await page.getByRole('button', { name: '開く' }).click();
    await expect(page.getByRole('navigation', { name: 'メニュー' })).toBeVisible();
    await expect(page.getByRole('button', { name: /スタート/ })).toHaveCount(0);
  });

  test('OS が動きを減らす設定では、動くオープニングを飛ばしてタイトル', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await unlock(page);
    await page.getByRole('button', { name: /スタート/ }).click();
    await expect(page.getByRole('navigation', { name: 'メニュー' })).toBeVisible();
  });
});

test.describe('設定画面', () => {
  test('タイトルから設定へ（axe も通る）。音量は保存され、Esc でタイトルへ戻る', async ({ page }) => {
    await unlock(page);
    await page.keyboard.press('Escape'); // ゲートから直接タイトルへ
    await page.getByRole('link', { name: /設定/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: '設定' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '音' })).toBeVisible();
    await scan(page, '設定画面');

    const slider = page.getByRole('slider', { name: 'BGM の音量' });
    await slider.focus();
    await page.keyboard.press('ArrowRight'); // 60 → 65
    await expect(page.getByText('65%')).toBeVisible();
    await page.getByRole('combobox', { name: '練習中の BGM' }).selectOption('all');

    await page.reload();
    await expect(page.getByRole('slider', { name: 'BGM の音量' })).toHaveValue('65');
    await expect(page.getByRole('combobox', { name: '練習中の BGM' })).toHaveValue('all');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'メニュー' })).toBeVisible();
  });
});

test.describe('図鑑', () => {
  test('タイトルから開ける。打った語は遭遇・習熟になり、区分で絞れる（axe も通る）', async ({ page }) => {
    await page.goto('/'); // DB を作らせる
    await seedRecords(page, 3, { target: 'ごん', idPrefix: 'gon' });
    await unlock(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('8'); // 図鑑
    await expect(page.getByRole('heading', { level: 1, name: '図鑑' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText(/遭遇 1 \/ 全 \d+ ・ 習熟 1/);
    const gon = page.getByRole('listitem').filter({ hasText: 'ゴン' }).first();
    await expect(gon).toContainText('習熟');
    await expect(gon).toContainText('3 回・正確率 100%');
    await expect(page.getByText('？？？').first()).toBeVisible();
    await page.getByRole('button', { name: /^能力/ }).click();
    await expect(page.getByRole('button', { name: /^能力/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('ゴン')).toHaveCount(0);
    await scan(page, '図鑑');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'メニュー' })).toBeVisible();
  });
});

test.describe('マイライセンス', () => {
  test('タイトルから開ける。ハンターネームを入れるとカードに出て、再読み込みしても残る（axe も通る）', async ({ page }) => {
    await page.goto('/');
    await seedRecords(page, 8, { idPrefix: 'lic' });
    await unlock(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('9'); // ライセンス
    await expect(page.getByRole('heading', { level: 1, name: 'ライセンス' })).toBeVisible();
    const card = page.getByRole('region', { name: 'HUNTER LICENSE' });
    await expect(card).toContainText('（ハンターネーム未設定）');
    await expect(card).toContainText(/星 \d つ・/);
    await page.getByLabel('ハンターネーム').fill('ゴン');
    await expect(card).toContainText('ゴン');
    await page.reload();
    await expect(page.getByRole('region', { name: 'HUNTER LICENSE' })).toContainText('ゴン');
    await page.waitForTimeout(700);
    await scan(page, 'マイライセンス');
  });
});

test.describe('ステージ選択', () => {
  const typeCurrentWord = async (page: Page) => {
    const romaji = ((await page.getByLabel('ローマ字ガイド').textContent()) ?? '').replaceAll('␣', ' ');
    for (const key of romaji) await page.keyboard.press(key);
  };

  test('タイトルからステージ選択へ（axe も通る）。ステージを打ち切るとクリアの印が付く', async ({ page }) => {
    await unlock(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('2'); // ステージ選択
    await expect(page.getByRole('heading', { level: 1, name: 'ステージ選択' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /第1章 ハンター試験編/ })).toBeVisible();
    await scan(page, 'ステージ選択');

    await page.getByRole('link', { name: /未挑戦/ }).first().click();
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    for (let i = 1; i <= 10; i++) {
      await expect(page.getByLabel('進捗')).toHaveText(`${i} / 10`);
      await typeCurrentWord(page);
    }
    await expect(page.getByRole('heading', { level: 2, name: /ステージクリア/ })).toBeVisible();
    await scan(page, 'ステージの結果');

    await page.getByRole('link', { name: 'ステージ選択へ' }).click();
    await expect(page.getByText('✓ クリア済み')).toBeVisible();
    await expect(page.getByText('1 / 5 クリア')).toBeVisible();
  });

  test('制約と誓約: 縛りを付けてクリアするとメダルが付く。付き記録は統計に数えない（axe も通る）', async ({ page }) => {
    await unlock(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('2');
    const vows = page.getByRole('group', { name: '制約と誓約' });
    await vows.getByRole('checkbox', { name: /無音/ }).check();
    await vows.getByRole('checkbox', { name: /運指ガイドなし/ }).check();
    await expect(vows.getByRole('status')).toContainText('銀');
    await scan(page, 'ステージ選択（縛り）');

    await page.getByRole('link', { name: /未挑戦/ }).first().click();
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    await expect(page.getByRole('region', { name: '運指ガイド' })).toHaveCount(0);
    for (let i = 1; i <= 10; i++) {
      await expect(page.getByLabel('進捗')).toHaveText(`${i} / 10`);
      await typeCurrentWord(page);
    }
    const panel = page.getByRole('region', { name: '縛り付きの練習' });
    await expect(panel).toContainText('メダル 銀');
    await expect(page.getByRole('heading', { name: '級位' })).toHaveCount(0);
    await scan(page, '縛り付きの結果');

    await page.getByRole('link', { name: 'ステージ選択へ' }).click();
    await expect(page.getByText('✓ クリア済み（メダル 銀）')).toBeVisible();
    await page.goto('/#/stats');
    await expect(page.getByText(/縛り付きの記録 1 件は、この統計に含めていません/)).toBeVisible();
  });

  test('章を切り替えられ、ボスへも進める', async ({ page }) => {
    await unlock(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('2');
    await page.getByRole('button', { name: /第6章/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: /第6章 キメラアント編/ })).toBeVisible();
    await page.getByRole('link', { name: /ボス メルエムに挑戦する/ }).click();
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    await expect(page.getByText('ミスの余裕 1 回')).toBeVisible();
    // 上位の章は時間制限つき。残り時間を文字で示す
    await expect(page.getByRole('timer')).toContainText(/残り \d+ 秒/);
    await scan(page, 'ボス戦（時間制限つき）');
  });

  test('ボスの技: 章 1 のボスは技を持つ（文字で示す）。設定で切れる', async ({ page }) => {
    await unlock(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('2');
    await page.getByRole('link', { name: /ボス ヒソカに挑戦する/ }).click();
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    await expect(page.getByText(/技「トランプの奇術」/)).toBeVisible();
    await expect(page.getByRole('timer')).toHaveCount(0);
    await scan(page, 'ボス戦（技あり）');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.goto('/#/stages');
    await page.getByRole('checkbox', { name: /ボスの技を使う/ }).uncheck();
    await page.getByRole('link', { name: /ボス ヒソカに挑戦する/ }).click();
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    await expect(page.getByText(/技「/)).toHaveCount(0);
  });
});

test.describe('BGM（実際の再生）', () => {
  /** <audio> の再生を記録する（どの曲を、どの音量で頼んだか） */
  async function spyAudio(page: Page) {
    await page.addInitScript(() => {
      const w = window as unknown as { __plays: { src: string; volume: number }[] };
      w.__plays = [];
      const original = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
        w.__plays.push({ src: this.src.split('/').pop() ?? '', volume: this.volume });
        return original.call(this);
      };
    });
  }
  const plays = (page: Page) =>
    page.evaluate(() => (window as unknown as { __plays: { src: string }[] }).__plays.map((p) => p.src));
  test('ゲートの前は無音。スタートでタイトルの曲、ボス戦でゲームの曲。設定でオフにすると止まる', async ({ page }) => {
    await spyAudio(page);
    await unlock(page);
    await expect(page.getByRole('button', { name: /スタート/ })).toBeVisible();
    expect(await plays(page)).toEqual([]); // ゲートの前は再生を頼まない

    await page.getByRole('button', { name: /スタート/ }).click();
    await expect.poll(() => plays(page)).toContain('opening-bgm.mp3'); // タイトルの曲
    await page.keyboard.press('Escape'); // オープニングを飛ばす
    await expect(page.getByRole('navigation', { name: 'メニュー' })).toBeVisible();

    // ステージ選択の曲へ
    await page.keyboard.press('2');
    await expect.poll(() => plays(page)).toContain('title-bgm.mp3');
    // ボス戦: ゲームの曲（既定は「ボス戦だけ」）
    await page.getByRole('link', { name: /ボス ヒソカに挑戦する/ }).click();
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    await expect.poll(() => plays(page)).toContain('game-bgm.mp3');
  });

  test('通常の練習には、既定では曲を流さない', async ({ page }) => {
    await spyAudio(page);
    await unlock(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('1'); // はじめる（通常の練習）
    await expect(page.getByRole('region', { name: 'お題' })).toBeVisible();
    await page.waitForTimeout(500);
    expect(await plays(page)).not.toContain('game-bgm.mp3');
  });

  test('BGM をオフにすると、タイトルに戻っても曲を頼まない', async ({ page }) => {
    await spyAudio(page);
    await unlock(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('6'); // 設定
    await page.getByRole('checkbox', { name: 'BGM を鳴らす' }).uncheck();
    const before = (await plays(page)).length;
    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'メニュー' })).toBeVisible();
    await page.waitForTimeout(500);
    expect((await plays(page)).length).toBe(before);
  });
});

test.describe('打鍵の手応え', () => {
  test('コンボが増えると段階が上がり、お題の周りが光る。ミスで戻る（axe も通る）', async ({ page }) => {
    await unlock(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('1'); // はじめる
    const hud = page.getByRole('group', { name: 'コンボの段階' });
    await expect(hud).toContainText('0 連続');
    await scan(page, '練習（手応えの表示・開始直後）');

    // 5 連続を超えるまで、お題を 1 語ずつ最後まで打つ（語の途中で止めると、次の語で誤入力になる）
    const combo = async () => Number((await hud.locator('.feel-count strong').textContent()) ?? '0');
    for (let words = 0; words < 6 && (await combo()) < 6; words++) {
      const romaji = ((await page.getByLabel('ローマ字ガイド').textContent()) ?? '').replaceAll('␣', ' ');
      for (const key of romaji) await page.keyboard.press(key);
      await page.waitForTimeout(50);
    }
    expect(await combo()).toBeGreaterThanOrEqual(5); // 少なくとも 5 連続 → 纏
    await expect(hud.locator('.feel-badge')).not.toHaveText('念'); // 纏以上（長い語だと一気に進むこともある）
    await scan(page, '練習（段階が上がった状態）');

    await page.keyboard.press('1'); // ミス
    await expect(hud).toContainText('0 連続');
    await expect(hud.locator('.feel-badge')).toHaveText('念');
  });

  test('演出オフでも、コンボの文字は出る（光は出ない）', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('typing.settings.v1', JSON.stringify({ effects: 'off' })));
    await page.reload();
    await page.getByLabel(/パスワードで新しいテーマを開く/).fill('SAKI');
    await page.getByRole('button', { name: '開く' }).click();
    await page.getByRole('link', { name: /はじめる/ }).click();
    await expect(page.getByRole('group', { name: 'コンボの段階' })).toBeVisible();
    await expect(page.locator('.feel-aura')).toHaveCount(0);
  });
});

test.describe('念系統診断', () => {
  test('記録が無いうちは診断せず、足りない軸を示す（axe も通る）', async ({ page }) => {
    await unlock(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('5'); // 念系統診断
    await expect(page.getByRole('heading', { level: 1, name: '念系統診断' })).toBeVisible();
    await expect(page.getByRole('region', { name: '診断の結果' })).toContainText('まだ診断できません');
    await scan(page, '念系統診断（記録なし）');
  });

  test('記録があれば、六角形のグラフと診断の結果が出る。期間で絞れ、Esc でタイトルへ戻る（axe も通る）', async ({ page }) => {
    await page.goto('/'); // DB を作らせる
    await seedRecords(page, 8);
    await unlock(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('5');
    const result = page.getByRole('region', { name: '診断の結果' });
    await expect(result).toContainText('得意な軸: 速さ（強化系）');
    await expect(result).toContainText('伸ばせる軸: 安定（特質系）');
    await expect(page.getByRole('img', { name: '速さ 100点' })).toBeVisible();
    // 水見式: 結果は文字でも出る。グラスの 3D は飾り（支援技術には見せない）
    const ritual = page.getByRole('region', { name: '水見式' });
    await expect(ritual).toContainText('水があふれる → 強化系');
    await expect(ritual.locator('canvas')).toHaveCount(1);
    await expect(ritual.locator('[aria-hidden="true"] canvas')).toHaveCount(1);
    await page.waitForTimeout(700); // 3D の出現（フェード）が終わってから axe
    await scan(page, '念系統診断（結果あり）');

    await page.getByRole('button', { name: '30日' }).click();
    await expect(page.getByRole('button', { name: '30日' })).toHaveAttribute('aria-pressed', 'true');
    // キーボードだけで、点にフォーカスすると値が出る
    await page.getByRole('img', { name: '速さ 100点' }).focus();
    await expect(page.getByRole('tooltip')).toContainText('100点');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'メニュー' })).toBeVisible();
  });

  test('統計画面からも診断へ行ける（標準テーマでは、系統の言葉を出さない）', async ({ page }) => {
    await page.goto('/#/stats');
    await page.getByRole('link', { name: '6軸診断' }).click();
    await expect(page.getByRole('heading', { level: 1, name: '6軸診断' })).toBeVisible();
    await expect(page.getByText('強化系')).toHaveCount(0);
  });
});
