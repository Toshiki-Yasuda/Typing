import { AXIS_IDS, AXIS_PARAMS, computeAxes, contentKind, diagnose, ringDistance, type AxisId, type AxisResult } from './axes';
import type { Keystroke, SessionRecord } from './types';

/**
 * 記録の作り方。keys の各要素は [期待キー, 正打か, 直前からの間隔 ms]。
 * targets は 1 語（['a']）にして、打鍵効率は見ない。item は 0 のまま（同じお題の中の連続する打鍵）。
 */
function record(
  keys: readonly (readonly [string, boolean, number])[],
  { contentId = 'basic', startedAt = 0, id = `r${Math.random()}` }: { contentId?: string; startedAt?: number; id?: string } = {},
): SessionRecord {
  let t = 0;
  const keystrokes: Keystroke[] = keys.map(([expected, correct, dt]) => {
    t += dt;
    return { t, key: correct ? expected : '\u0000', code: '', expected, correct, item: 0 };
  });
  return { id, startedAt, mode: 'practice', contentId, targets: ['a'], engineVersion: '1', ruleVersion: '1', keystrokes };
}

/** n 打鍵を一定の間隔 dt で正しく打つ（一貫性 100）。間隔 150ms = 400 KPM、300ms = 200 KPM */
const steadyRun = (n: number, dt: number, opts: { contentId?: string; startedAt?: number } = {}) =>
  record(Array.from({ length: n }, (): [string, boolean, number] => ['x', true, dt]), opts);

const fingerOf = (c: string) => ({ a: 'L-pinky', p: 'R-pinky', j: 'R-index', k: 'R-middle', ' ': 'thumb' })[c] ?? null;
const axes = (records: SessionRecord[]) => computeAxes(records, fingerOf);

describe('速さ（speed）', () => {
  it('数える練習が 3 回に満たなければデータ不足（1 つ足りない）', () => {
    const r = axes([steadyRun(30, 150, { startedAt: 1 }), steadyRun(30, 150, { startedAt: 2 })]);
    expect(r.speed).toMatchObject({ score: null, sample: 2, needed: 3 });
  });

  it('直近 5 回の中央値 ÷ 400 × 100。400 KPM で 100、200 KPM で 50', () => {
    const fast = [1, 2, 3].map((i) => steadyRun(30, 150, { startedAt: i }));
    expect(axes(fast).speed.score).toBeCloseTo(100, 5);
    const slow = [1, 2, 3].map((i) => steadyRun(30, 300, { startedAt: i }));
    expect(axes(slow).speed.score).toBeCloseTo(50, 5);
  });

  it('直近 5 回だけを見る（古い遅い練習は効かない）。中央値なので 1 回の好不調に動かされない', () => {
    // 古い 3 回は 100 KPM、直近 5 回は [200, 200, 400, 400, 400] → 中央値 400
    const old = [1, 2, 3].map((i) => steadyRun(30, 600, { startedAt: i }));
    const recent = [200, 200, 400, 400, 400].map((k, i) => steadyRun(30, k === 200 ? 300 : 150, { startedAt: 10 + i }));
    expect(axes([...old, ...recent]).speed.score).toBeCloseTo(100, 5);
  });

  it('正確率 95% 未満の練習は、速くても数えない', () => {
    const sloppy = Array.from({ length: 3 }, (_, i) =>
      record(Array.from({ length: 30 }, (_, j): [string, boolean, number] => ['x', j % 5 !== 0, 150]), { startedAt: i }),
    ); // 正確率 80%
    expect(axes(sloppy).speed).toMatchObject({ score: null, sample: 0 });
  });
});

describe('制御（control）', () => {
  const withMisses = (n: number, misses: number) =>
    record(Array.from({ length: n }, (_, i): [string, boolean, number] => ['x', i >= misses, 100]));

  it('総打鍵が 200 未満ならデータ不足（199）。200 で求まる', () => {
    expect(axes([withMisses(199, 0)]).control).toMatchObject({ score: null, sample: 199 });
    expect(axes([withMisses(200, 0)]).control.score).toBe(100);
  });

  it('(正確率 − 0.85) ÷ 0.14 × 100。200 打鍵でミス 8 → 96% → 78.57', () => {
    expect(axes([withMisses(200, 8)]).control.score).toBeCloseTo(((0.96 - 0.85) / 0.14) * 100, 5);
  });

  it('85% 以下は 0 点、99% 以上は 100 点（丸める）', () => {
    expect(axes([withMisses(200, 40)]).control.score).toBe(0); // 80%
    expect(axes([withMisses(200, 1)]).control.score).toBe(100); // 99.5%
  });

  it('複数の記録の打鍵を合わせて数える', () => {
    expect(axes([withMisses(100, 0), withMisses(100, 0)]).control).toMatchObject({ score: 100, sample: 200 });
  });
});

describe('到達（reach）', () => {
  /** j（小指以外）を jDt、a（小指）を aDt で打つ。標本は各 n 個 */
  const alternating = (n: number, jDt: number, aDt: number) => {
    const keys: [string, boolean, number][] = [['j', true, 0]];
    for (let i = 0; i < n; i++) {
      keys.push(['a', true, aDt]);
      keys.push(['j', true, jDt]);
    }
    return record(keys);
  };

  it('(小指以外 ÷ 小指 − 0.5) ÷ 0.5 × 100。100ms ÷ 125ms = 0.8 → 60', () => {
    const r = axes([alternating(30, 100, 125)]);
    expect(r.reach.score).toBeCloseTo(60, 5);
    expect(r.reach.sample).toBe(30);
  });

  it('小指が遅くなければ 100、半分以下の速さなら 0', () => {
    expect(axes([alternating(30, 100, 100)]).reach.score).toBe(100);
    expect(axes([alternating(30, 100, 60)]).reach.score).toBe(100); // 小指のほうが速い → 100
    expect(axes([alternating(30, 100, 200)]).reach.score).toBe(0);
  });

  it('各 30 標本に満たなければデータ不足（29）', () => {
    expect(axes([alternating(29, 100, 125)]).reach).toMatchObject({ score: null, sample: 29 });
  });

  it('親指（スペース）と、配列にない文字は数えない', () => {
    const keys: [string, boolean, number][] = [['j', true, 0]];
    for (let i = 0; i < 40; i++) keys.push([' ', true, 500], ['?', true, 500], ['j', true, 100], ['a', true, 125]);
    // 親指・不明が入っても、j と a の比（0.8）は変わらない
    expect(axes([record(keys)]).reach.score).toBeCloseTo(60, 5);
  });
});

describe('適応（adapt）', () => {
  it('種類ごとの中央値の最小 ÷ 最大。英字 200 KPM・かな 400 KPM → 50', () => {
    const rs = [
      steadyRun(30, 300, { contentId: 'english', startedAt: 1 }),
      steadyRun(30, 300, { contentId: 'english', startedAt: 2 }),
      steadyRun(30, 150, { contentId: 'basic', startedAt: 3 }),
      steadyRun(30, 150, { contentId: 'c1s2', startedAt: 4 }), // ステージの語彙も「かな」
    ];
    expect(axes(rs).adapt).toMatchObject({ score: 50, sample: 2 });
  });

  it('1 種類しかない・種類ごとの練習が 1 回だけなら、データ不足', () => {
    expect(axes([steadyRun(30, 150, { contentId: 'basic', startedAt: 1 }), steadyRun(30, 150, { contentId: 'basic', startedAt: 2 })]).adapt.score).toBeNull();
    const oneEach = [
      steadyRun(30, 150, { contentId: 'basic', startedAt: 1 }),
      steadyRun(30, 300, { contentId: 'english', startedAt: 2 }),
    ];
    expect(axes(oneEach).adapt).toMatchObject({ score: null, sample: 0 });
  });

  it('内容の種類の判定', () => {
    expect(['basic', 'c3s6', 'english', 'symbols', 'phrases', 'my-pack'].map(contentKind)).toEqual([
      'kana', 'kana', 'english', 'symbols', 'phrases', 'other',
    ]);
  });
});

describe('形（shape）', () => {
  /** 数字・記号のキー '1' を n 回、うち misses 回ミス。英字・スペース・'-' も混ぜる（数えない） */
  const symbols = (n: number, misses: number) => {
    const keys: [string, boolean, number][] = [];
    for (let i = 0; i < n; i++) keys.push(['1', i >= misses, 100], ['a', false, 100], [' ', false, 100], ['-', false, 100]);
    return record(keys);
  };

  it('(正確率 − 0.8) ÷ 0.18 × 100。30 回中ミス 3 → 90% → 55.56。英字・スペース・- は数えない', () => {
    const r = axes([symbols(30, 3)]);
    expect(r.shape.score).toBeCloseTo(((0.9 - 0.8) / 0.18) * 100, 5);
    expect(r.shape.sample).toBe(30);
  });

  it('試行が 30 に満たなければデータ不足（29）', () => {
    expect(axes([symbols(29, 0)]).shape).toMatchObject({ score: null, sample: 29 });
  });

  it('80% 以下は 0 点、98% 以上は 100 点', () => {
    expect(axes([symbols(30, 6)]).shape.score).toBe(0);
    expect(axes([symbols(100, 1)]).shape.score).toBe(100);
  });
});

describe('安定（steady）', () => {
  /** 間隔が 100 と 200 の交互（平均 150・標準偏差 50・変動係数 1/3）→ 一貫性 = 100 × (1 − tanh(1/3)) */
  const wobbly = (startedAt: number) =>
    record(Array.from({ length: 31 }, (_, i): [string, boolean, number] => ['x', true, i === 0 ? 0 : i % 2 === 1 ? 100 : 200]), { startedAt });

  it('一貫性の中央値。ばらつきが無ければ 100、交互なら 100 × (1 − tanh(1/3)) ≈ 67.85', () => {
    expect(axes([1, 2, 3].map((i) => steadyRun(30, 150, { startedAt: i }))).steady.score).toBe(100);
    expect(axes([1, 2, 3].map(wobbly)).steady.score).toBeCloseTo(100 * (1 - Math.tanh(1 / 3)), 5);
  });

  it('3 回に満たなければデータ不足', () => {
    expect(axes([wobbly(1), wobbly(2)]).steady).toMatchObject({ score: null, sample: 2 });
  });
});

describe('診断（diagnose）と環', () => {
  const result = (scores: Partial<Record<AxisId, number | null>>): Record<AxisId, AxisResult> =>
    Object.fromEntries(AXIS_IDS.map((id) => [id, { id, score: scores[id] ?? null, sample: 0, needed: 0 }])) as Record<AxisId, AxisResult>;

  it('環の並びは 速さ→適応→形→安定→制御→到達', () => {
    expect([...AXIS_IDS]).toEqual(['speed', 'adapt', 'shape', 'steady', 'control', 'reach']);
  });

  it('環の距離: 同じ 0・隣 1・2 つ先 2・向かい 3（端の隣も 1）', () => {
    expect(ringDistance('speed', 'speed')).toBe(0);
    expect(ringDistance('speed', 'adapt')).toBe(1);
    expect(ringDistance('speed', 'reach')).toBe(1); // 環なので最後と最初が隣
    expect(ringDistance('speed', 'shape')).toBe(2);
    expect(ringDistance('speed', 'control')).toBe(2);
    expect(ringDistance('speed', 'steady')).toBe(3); // 向かい
    expect(ringDistance('adapt', 'control')).toBe(3);
    expect(ringDistance('shape', 'reach')).toBe(3);
    for (const a of AXIS_IDS) for (const b of AXIS_IDS) expect(ringDistance(a, b)).toBe(ringDistance(b, a));
  });

  it('得意＝最大、伸ばす＝得意以外で最小。距離も返す', () => {
    const d = diagnose(result({ speed: 90, control: 70, steady: 40, shape: 60 }));
    expect(d).toEqual({ strongest: 'speed', weakest: 'steady', distance: 3 });
  });

  it('求まった軸が 3 未満なら診断しない（ちょうど 3 なら診断する）', () => {
    expect(diagnose(result({ speed: 90, control: 70 }))).toBeNull();
    expect(diagnose(result({ speed: 90, control: 70, shape: 10 }))).not.toBeNull();
    expect(AXIS_PARAMS.minAxes).toBe(3);
  });

  it('同点は環の順で先。データ不足の軸（null）は選ばれない', () => {
    // 得意: speed と control が同点 → 環の順で先の speed。伸ばす: adapt と shape が同点 → adapt
    const d = diagnose(result({ speed: 80, control: 80, adapt: 20, shape: 20, steady: null, reach: null }));
    expect(d).toEqual({ strongest: 'speed', weakest: 'adapt', distance: 1 });
  });

  it('全部同点でも、得意と伸ばす軸は別になる', () => {
    const d = diagnose(result({ speed: 50, adapt: 50, shape: 50 }));
    expect(d?.strongest).toBe('speed');
    expect(d?.weakest).toBe('adapt');
  });

  it('記録が空なら全軸がデータ不足で、診断なし', () => {
    const r = axes([]);
    expect(AXIS_IDS.every((id) => r[id].score === null)).toBe(true);
    expect(diagnose(r)).toBeNull();
  });
});
