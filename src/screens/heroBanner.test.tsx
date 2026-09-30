import { render, waitFor } from '@testing-library/react';
import { HeroBanner } from './home/HeroBanner';
import { HUNTER_THEME, NEUTRAL_THEME } from '@/themes/themes';

const start = vi.fn<(options: unknown) => () => void>(() => () => {});
let reduced = false;
let webgl = true;
vi.mock('@/effects/heroScene', () => ({ startHeroScene: (o: unknown) => start(o) }));
vi.mock('@/effects/level', async (orig) => ({
  ...(await orig<typeof import('@/effects/level')>()),
  prefersReducedMotion: () => reduced,
  webglAvailable: () => webgl,
}));

beforeEach(() => {
  start.mockClear();
  reduced = false;
  webgl = true;
});

const lastAnimate = () => (start.mock.calls.at(-1) as unknown as [{ animate: boolean }])[0].animate;

describe('HeroBanner', () => {
  it('標準では動かす。3D の canvas は飾りとして支援技術から隠す', async () => {
    const { container } = render(<HeroBanner theme={HUNTER_THEME} effects="full" />);
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(lastAnimate()).toBe(true);
    expect(container.querySelector('canvas')?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('控えめ・OS が動きを減らすときは、動かさず1コマだけ', async () => {
    render(<HeroBanner theme={HUNTER_THEME} effects="reduced" />);
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(lastAnimate()).toBe(false);

    start.mockClear();
    reduced = true;
    render(<HeroBanner theme={HUNTER_THEME} effects="full" />);
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(lastAnimate()).toBe(false);
  });

  it('オフ・3D の無いテーマ・WebGL 無しのときは、何も出さず、読み込みもしない', async () => {
    const off = render(<HeroBanner theme={HUNTER_THEME} effects="off" />);
    const neutral = render(<HeroBanner theme={NEUTRAL_THEME} effects="full" />);
    webgl = false;
    const noGl = render(<HeroBanner theme={HUNTER_THEME} effects="full" />);
    await new Promise((r) => setTimeout(r, 50));
    for (const r of [off, neutral, noGl]) expect(r.container.querySelector('canvas')).toBeNull();
    expect(start).not.toHaveBeenCalled();
  });
});
