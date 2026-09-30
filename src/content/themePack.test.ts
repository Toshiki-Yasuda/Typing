import { clearThemePackCache, loadThemePack } from './themePack';

const okJson = { id: 'p', name: 'p', items: [{ display: '猫', reading: 'ねこ' }] };
const res = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(() => clearThemePackCache());

describe('loadThemePack', () => {
  it('取得して検証し、同じパスは 1 度しか取りに行かない', async () => {
    const f = vi.fn(() => res(okJson));
    const a = await loadThemePack('themes/x/p.json', f as unknown as typeof fetch);
    const b = await loadThemePack('themes/x/p.json', f as unknown as typeof fetch);
    expect(a.items).toEqual([{ display: '猫', reading: 'ねこ' }]);
    expect(b).toBe(a);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('取得に失敗したら例外。失敗は覚えず、次はやり直せる', async () => {
    const bad = vi.fn(() => res({}, 404));
    await expect(loadThemePack('themes/x/q.json', bad as unknown as typeof fetch)).rejects.toThrow(/404/);
    const good = vi.fn(() => res(okJson));
    await expect(loadThemePack('themes/x/q.json', good as unknown as typeof fetch)).resolves.toBeDefined();
  });

  it('打てない語・重複のあるパックは、読み込まない（検証を通す）', async () => {
    const broken = { id: 'p', name: 'p', items: [{ display: '漢', reading: '漢' }] };
    await expect(loadThemePack('themes/x/r.json', (() => res(broken)) as unknown as typeof fetch)).rejects.toThrow(/不正/);
  });
});
