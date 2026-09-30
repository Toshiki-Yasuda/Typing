import { resolveEffects, webglAvailable, type EffectLevel } from './level';

describe('resolveEffects', () => {
  it('OS が動きを減らすなら、動く演出（full）は控えめ（reduced）になる。それ以外は設定のまま', () => {
    const table: [EffectLevel, boolean, EffectLevel][] = [
      ['full', false, 'full'],
      ['full', true, 'reduced'],
      ['reduced', false, 'reduced'],
      ['reduced', true, 'reduced'],
      ['off', false, 'off'],
      ['off', true, 'off'],
    ];
    for (const [setting, os, expected] of table) expect(resolveEffects(setting, os), `${setting}/${os}`).toBe(expected);
  });
});

describe('webglAvailable', () => {
  it('WebGL の無い環境（jsdom）では false（例外にしない）', () => {
    expect(webglAvailable()).toBe(false);
  });
});
