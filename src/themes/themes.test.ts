import { contrast, contrastProblems, ThemeSchema } from './theme';
import { HUNTER_THEME, NEUTRAL_COLORS, NEUTRAL_THEME, THEMES, resolveTheme, themeColors } from './themes';
import { checkPassword, loadUnlocked, saveUnlocked, sha256Hex } from './unlock';

describe('contrast', () => {
  it('白と黒は 21、同色は 1', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#336699', '#336699')).toBeCloseTo(1, 5);
  });
});

describe('テーマの定義', () => {
  it('組み込みテーマは形式とコントラストを満たす', () => {
    for (const t of THEMES) {
      expect(ThemeSchema.safeParse(t).success).toBe(true);
      expect(contrastProblems(themeColors(t))).toEqual([]);
    }
  });

  it('中立テーマの色は index.css の @theme と一致する', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/index.css', 'utf8');
    for (const [token, value] of Object.entries(NEUTRAL_COLORS)) {
      expect(css).toContain(`--color-${token}: ${value};`);
    }
  });

  it('読めない配色は検出される', () => {
    expect(contrastProblems({ ...NEUTRAL_COLORS, text: '#20222a' }).length).toBeGreaterThan(0);
  });
});

describe('resolveTheme', () => {
  it('ロック中は中立、解除すれば使える', () => {
    expect(resolveTheme('hunter', new Set())).toBe(NEUTRAL_THEME);
    expect(resolveTheme('hunter', new Set(['hunter']))).toBe(HUNTER_THEME);
  });

  it('不明な id は中立', () => {
    expect(resolveTheme('nothing', new Set(['nothing']))).toBe(NEUTRAL_THEME);
  });

  it('コントラスト不足のテーマは、解除済みでも中立に戻す', () => {
    const bad = { ...NEUTRAL_THEME, id: 'bad', colors: { text: '#20222a' } };
    expect(resolveTheme('bad', new Set(), [bad])).toBe(NEUTRAL_THEME);
  });
});

describe('パスワード', () => {
  it('SHA-256 が正しい', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('SAKI は大文字小文字・前後の空白を問わず通り、他は通らない', async () => {
    for (const ok of ['SAKI', 'saki', ' Saki ']) expect(await checkPassword('hunter', ok)).toBe(true);
    for (const ng of ['', 'sak', 'sakii', 'password']) expect(await checkPassword('hunter', ng)).toBe(false);
  });

  it('パスワードの無いテーマは通らない', async () => {
    expect(await checkPassword('neutral', 'saki')).toBe(false);
  });

  it('ソースに平文を置かない', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/themes/unlock.ts', 'utf8').toLowerCase()).not.toContain('saki');
  });
});

describe('解除の保存', () => {
  it('保存して読み戻せる。壊れた値は空', () => {
    const mem = new Map<string, string>();
    const store = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    };
    saveUnlocked(new Set(['hunter']), store);
    expect([...loadUnlocked(store)]).toEqual(['hunter']);
    mem.set('typing.themes.unlocked.v1', '{壊れた');
    expect(loadUnlocked(store).size).toBe(0);
    mem.set('typing.themes.unlocked.v1', '[1,"a"]');
    expect([...loadUnlocked(store)]).toEqual(['a']);
  });
});
