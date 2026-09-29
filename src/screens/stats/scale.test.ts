import { heatBin, niceScale } from './scale';

describe('niceScale', () => {
  it('きりのよい目盛りで範囲を覆う', () => {
    expect(niceScale(0, 97)).toEqual({ min: 0, max: 100, ticks: [0, 50, 100] }); // 刻みは 1・2・5 系列
    expect(niceScale(230, 480, 5)).toMatchObject({ min: 200, max: 500 });
    expect(niceScale(0, 1000, 5).ticks).toEqual([0, 200, 400, 600, 800, 1000]);
  });

  it('範囲が 0 でも広げて返す', () => {
    const s = niceScale(50, 50);
    expect(s.min).toBeLessThan(50);
    expect(s.max).toBeGreaterThan(50);
    expect(niceScale(0, 0).ticks.length).toBeGreaterThan(1);
  });

  it('小数の範囲（0〜1）でも浮動小数の誤差が出ない', () => {
    expect(niceScale(0, 1, 4).ticks).toEqual([0, 0.5, 1]);
    expect(niceScale(0.1, 0.7, 3).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8]);
  });

  it('不正な値は 0〜1', () => {
    expect(niceScale(NaN, 5)).toEqual({ min: 0, max: 1, ticks: [0, 1] });
  });
});

describe('heatBin', () => {
  it('範囲を 5 階級に分ける（端は端の階級）', () => {
    expect([0, 0.19, 0.2, 0.5, 0.99, 1].map((v) => heatBin(v, 0, 1))).toEqual([0, 0, 1, 2, 4, 4]);
  });

  it('範囲外は端に丸める。範囲 0 なら中央', () => {
    expect(heatBin(-5, 0, 1)).toBe(0);
    expect(heatBin(9, 0, 1)).toBe(4);
    expect(heatBin(3, 3, 3)).toBe(2);
  });
});
