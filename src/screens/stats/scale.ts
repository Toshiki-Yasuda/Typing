/** 1, 2, 5 × 10^n の「きりのよい」刻み幅 */
function niceStep(rough: number): number {
  const exp = Math.floor(Math.log10(rough));
  const base = rough / 10 ** exp;
  const nice = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10;
  return nice * 10 ** exp;
}

export interface Scale {
  readonly min: number;
  readonly max: number;
  readonly ticks: readonly number[];
}

/** 軸の範囲と目盛り。ticks はきりのよい値で、min〜max を覆う */
export function niceScale(min: number, max: number, count = 4): Scale {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, ticks: [0, 1] };
  if (max === min) {
    const pad = Math.abs(max) > 0 ? Math.abs(max) * 0.1 : 1;
    min -= pad;
    max += pad;
  }
  const step = niceStep((max - min) / count);
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  // 刻み幅の桁数に丸めて、0.6000000000000001 のような浮動小数の誤差を残さない
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const round = (v: number) => Number(v.toFixed(decimals));
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(round(v));
  return { min: round(lo), max: round(hi), ticks };
}

/** value を [min, max] の中で bins 個の階級に分ける（0 始まり）。範囲が 0 なら中央の階級 */
export function heatBin(value: number, min: number, max: number, bins = 5): number {
  if (max <= min) return Math.floor(bins / 2);
  const bin = Math.floor(((value - min) / (max - min)) * bins);
  return Math.min(bins - 1, Math.max(0, bin));
}
