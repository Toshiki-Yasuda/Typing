import { contrast, contrastProblems, FIXED_ON_SURFACE, ThemeSchema } from './theme';
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

  it('固定色（--viz-*）の値は index.css と一致する', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/index.css', 'utf8');
    for (const [name, color] of FIXED_ON_SURFACE) expect(css).toContain(`${name}: ${color};`);
  });

  it('背景が明るすぎて固定色が読めなくなる配色は検出される', () => {
    const problems = contrastProblems({ ...NEUTRAL_COLORS, 'surface-raised': '#2a2a3e' });
    expect(problems.some((p) => p.includes('--viz-muted'))).toBe(true);
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

describe('ボスの定義', () => {
  it('HUNTER×HUNTER のボスは検証を通り、章が 1..n の連番で id が重複せず、出題パックが実在する', async () => {
    const { BUILTIN_PACKS } = await import('@/content');
    const bosses = HUNTER_THEME.bosses ?? [];
    expect(bosses.length).toBe(7);
    expect(bosses.map((b) => b.chapter)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(bosses.map((b) => b.id)).size).toBe(bosses.length);
    for (const b of bosses) {
      const pack = BUILTIN_PACKS.find((p) => p.id === b.packId);
      expect(pack, `${b.name} のパック ${b.packId}`).toBeDefined();
      // 出題は重複なしで選ぶので、パックの語数以下でなければならない
      expect(b.words).toBeLessThanOrEqual(pack?.items.length ?? 0);
    }
  });

  it('ボスの画像ファイルが public に実在する', async () => {
    const { existsSync } = await import('node:fs');
    for (const b of HUNTER_THEME.bosses ?? []) if (b.image) expect(existsSync(`public/${b.image}`), b.image).toBe(true);
  });

  it('台詞が足りないボスは不正（フェーズの台詞は3つ）', () => {
    const boss = { ...(HUNTER_THEME.bosses?.[0] as object), phaseMessages: ['a', 'b'] };
    expect(ThemeSchema.safeParse({ ...HUNTER_THEME, bosses: [boss] }).success).toBe(false);
  });
});

describe('3D の演出', () => {
  it('HUNTER のモデルが public に実在し、glTF バイナリ（glTF 2.0）である', async () => {
    const { readFileSync } = await import('node:fs');
    const hero = HUNTER_THEME.hero;
    expect(hero).toBeDefined();
    for (const path of Object.values(hero ?? {})) {
      const bytes = readFileSync(`public/${path}`);
      expect(bytes.subarray(0, 4).toString('ascii'), path).toBe('glTF');
      expect(bytes.readUInt32LE(4), `${path} の版`).toBe(2);
      expect(bytes.length, `${path} は軽い（1MB 未満）`).toBeLessThan(1_000_000);
    }
  });

  it('標準テーマには 3D の演出が無い', () => {
    expect(NEUTRAL_THEME.hero).toBeUndefined();
  });
});

describe('テーマの音', () => {
  it('HUNTER の音の素材が public に実在し、MP3 として読める。BGM は軽い（128kbps 相当）', async () => {
    const { readFileSync } = await import('node:fs');
    const audio = HUNTER_THEME.audio ?? {};
    expect(Object.keys(audio).sort()).toEqual(['confirm', 'game', 'stage', 'stinger', 'title']);
    for (const [role, path] of Object.entries(audio)) {
      const bytes = readFileSync(`public/${path}`);
      const isMp3 = bytes.subarray(0, 3).toString('ascii') === 'ID3' || (bytes[0] === 0xff && (bytes[1] as number) >= 0xe0);
      expect(isMp3, `${role}: ${path}`).toBe(true);
      // 長い曲（BGM）は 6MB 未満に収める（公開サイトの配信量）
      if (['title', 'stage', 'game'].includes(role)) expect(bytes.length, path).toBeLessThan(6_000_000);
    }
  });

  it('標準テーマには音が無い', () => {
    expect(NEUTRAL_THEME.audio).toBeUndefined();
  });
});
