import { HUNTER_THEME, NEUTRAL_THEME } from '@/themes/themes';
import { entranceSeen, markEntranceSeen, needsEntrance } from './entrance';

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('入口を見せるか', () => {
  it('入口のあるテーマで、この起動でまだ見ていないときだけ', () => {
    const s = mem();
    expect(needsEntrance(HUNTER_THEME, s)).toBe(true);
    markEntranceSeen(s);
    expect(entranceSeen(s)).toBe(true);
    expect(needsEntrance(HUNTER_THEME, s)).toBe(false);
  });

  it('入口のないテーマ（標準）には出さない', () => {
    expect(needsEntrance(NEUTRAL_THEME, mem())).toBe(false);
  });

  it('保存先が使えない環境でも落ちない（毎回出るだけ）', () => {
    const broken = {
      getItem: () => {
        throw new Error('x');
      },
      setItem: () => {
        throw new Error('x');
      },
    };
    expect(() => markEntranceSeen(broken)).not.toThrow();
    expect(entranceSeen(broken)).toBe(false);
    expect(needsEntrance(HUNTER_THEME, null)).toBe(true);
  });
});
