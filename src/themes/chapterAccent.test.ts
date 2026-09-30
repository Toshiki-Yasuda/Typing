import { CHAPTER_ACCENT_MIN_CONTRAST, chapterAccentProblems, contrast, type Chapter } from './theme';
import { chapterAccentStyle, chapterOfBoss, chapterOfStage } from './chapterAccent';
import { HUNTER_CHAPTER_ACCENTS } from './hunterAccents';
import { HUNTER_THEME, themeColors } from './themes';

const colors = themeColors(HUNTER_THEME);
const chapters = HUNTER_THEME.chapters ?? [];

describe('章のアクセント色（HUNTER）', () => {
  it('全 7 章に色があり、#RRGGBB で、互いに違う色', () => {
    expect(chapters).toHaveLength(7);
    const accents = chapters.map((c) => c.accent);
    for (const a of accents) expect(a).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(accents).size).toBe(7);
  });

  it('どの色も、背景（surface / surface-raised）の上で 4.5:1 以上（ボタンの文字が読める）', () => {
    for (const c of chapters) {
      expect(chapterAccentProblems(c.accent!, colors), c.title).toEqual([]);
      expect(contrast(c.accent!, colors.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.accent!, colors['surface-raised'])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('色の表に、存在しない章は無い（章の id と一致）', () => {
    expect(Object.keys(HUNTER_CHAPTER_ACCENTS).sort()).toEqual(chapters.map((c) => c.id).sort());
  });

  it('隣り合う章の色は、見分けやすい（明るさだけでなく色みが違う）', () => {
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
      const max = Math.max(r, g, b);
      const d = max - Math.min(r, g, b);
      if (d === 0) return 0;
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    // 銀（第 7 章。ほぼ無彩色）以外の色相は、15 度以上離れている
    const hues = chapters.slice(0, 6).map((c) => hue(c.accent!));
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        const diff = Math.abs(hues[i]! - hues[j]!);
        expect(Math.min(diff, 360 - diff), `第${i + 1}章と第${j + 1}章`).toBeGreaterThanOrEqual(15);
      }
    }
  });
});

describe('chapterAccentProblems', () => {
  it('基準は 4.5:1。基準の直下の色は問題あり、直上の色は問題なし', () => {
    expect(CHAPTER_ACCENT_MIN_CONTRAST).toBe(4.5);
    // surface-raised #1e1e33 に対して、灰色を明るくしていき、4.5 をまたぐ色を探す
    const grey = (v: number) => `#${v.toString(16).padStart(2, '0').repeat(3)}`;
    let below = 0;
    let above = 0;
    for (let v = 0; v < 256; v++) {
      const ok = chapterAccentProblems(grey(v), colors).length === 0;
      if (ok) {
        above = v;
        break;
      }
      below = v;
    }
    expect(above).toBeGreaterThan(below);
    expect(contrast(grey(above), colors['surface-raised'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(grey(below), colors['surface-raised'])).toBeLessThan(4.5);
    expect(chapterAccentProblems(grey(below), colors).length).toBeGreaterThan(0);
  });
});

describe('chapterAccentStyle', () => {
  const base = chapters[0]!;
  it('章の色を CSS 変数 --color-accent として返す', () => {
    expect(chapterAccentStyle(HUNTER_THEME, base)).toEqual({ '--color-accent': base.accent });
  });

  it('章が無い・色が無いときは undefined（テーマのアクセントのまま）', () => {
    expect(chapterAccentStyle(HUNTER_THEME, undefined)).toBeUndefined();
    const { accent: _omit, ...noAccent } = base;
    void _omit;
    expect(chapterAccentStyle(HUNTER_THEME, noAccent as Chapter)).toBeUndefined();
  });

  it('読めない色（背景とのコントラスト不足）は使わない', () => {
    expect(chapterAccentStyle(HUNTER_THEME, { ...base, accent: '#1e1e33' })).toBeUndefined();
    expect(chapterAccentStyle(HUNTER_THEME, { ...base, accent: '#3a3a55' })).toBeUndefined();
  });

  it('ステージ・ボスの id から章を探せる', () => {
    expect(chapterOfStage(HUNTER_THEME, 'c3s2')?.id).toBe('c3');
    expect(chapterOfStage(HUNTER_THEME, 'nope')).toBeUndefined();
    expect(chapterOfBoss(HUNTER_THEME, 'chapter4')?.id).toBe('c4');
    expect(chapterOfBoss(HUNTER_THEME, 'nope')).toBeUndefined();
  });
});
