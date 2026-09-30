import { SYNTH_VOICES, SynthPlayer, type SynthContextLike } from './synth';

function fakeCtx(state = 'running') {
  const log = {
    osc: [] as {
      type: string;
      freqs: number[];
      start: number[];
      stop: number[];
    }[],
    peaks: [] as number[],
    ends: [] as number[],
    resumed: 0,
  };
  const param = (sink?: (v: number, t: number) => void) => ({
    value: 0,
    setValueAtTime: () => {},
    linearRampToValueAtTime: (v: number, t: number) => sink?.(v, t),
    exponentialRampToValueAtTime: (_v: number, t: number) => log.ends.push(t),
  });
  const ctx: SynthContextLike = {
    state,
    currentTime: 10,
    destination: {},
    resume: async () => {
      log.resumed++;
    },
    createGain: () => ({
      gain: param((v) => log.peaks.push(v)),
      connect: () => {},
    }),
    createOscillator: () => {
      const o = {
        type: '',
        freqs: [] as number[],
        start: [] as number[],
        stop: [] as number[],
      };
      log.osc.push(o);
      return {
        set type(v: string) {
          o.type = v;
        },
        frequency: {
          ...param(),
          setValueAtTime: (v: number) => o.freqs.push(v),
        },
        connect: () => {},
        start: (t?: number) => o.start.push(t ?? 0),
        stop: (t?: number) => o.stop.push(t ?? 0),
      };
    },
  };
  return { ctx, log };
}

describe('SynthPlayer（合成音）', () => {
  it('音の長さは 打鍵 30ms・ミス 90ms・完了 180ms', () => {
    expect(Object.fromEntries(Object.entries(SYNTH_VOICES).map(([k, v]) => [k, v.ms]))).toEqual({ type: 30, miss: 90, complete: 180 });
  });
  it('打鍵: 30ms で消える 1 音。音量は設定を掛ける', () => {
    const { ctx, log } = fakeCtx();
    const p = new SynthPlayer({ createContext: () => ctx });
    p.setVolume(0.5);
    p.play('type');
    expect(log.osc).toHaveLength(1);
    expect(log.osc[0]!.freqs).toEqual([880]);
    expect(log.ends[0]).toBeCloseTo(10.03, 10);
    expect(log.peaks[0]).toBeCloseTo(0.09 * 0.5, 10);
  });
  it('完了: 180ms を 2 音で順に鳴らす', () => {
    const { ctx, log } = fakeCtx();
    const p = new SynthPlayer({ createContext: () => ctx });
    p.play('complete');
    expect(log.osc.map((o) => o.freqs[0])).toEqual([659, 988]);
    expect(log.osc[1]!.start[0]).toBeCloseTo(10.09, 10);
    expect(log.ends[0]).toBeCloseTo(10.18, 10);
  });
  it('音量 0 では鳴らさず、コンテキストも作らない', () => {
    const create = vi.fn(() => fakeCtx().ctx);
    const p = new SynthPlayer({ createContext: create });
    p.setVolume(0);
    p.play('type');
    expect(create).not.toHaveBeenCalled();
  });
  it('コンテキストは最初の打鍵で作り、suspended なら resume する。作るのは 1 回だけ', () => {
    const { ctx, log } = fakeCtx('suspended');
    const create = vi.fn(() => ctx);
    const p = new SynthPlayer({ createContext: create });
    expect(create).not.toHaveBeenCalled();
    p.play('type');
    p.play('miss');
    expect(create).toHaveBeenCalledTimes(1);
    expect(log.resumed).toBe(2);
  });
  it('AudioContext が無くても、鳴らせず例外を投げても、何も起きない', () => {
    expect(() => new SynthPlayer({ createContext: () => null }).play('type')).not.toThrow();
    expect(() =>
      new SynthPlayer({
        createContext: () => {
          throw new Error('拒否');
        },
      }).play('complete'),
    ).not.toThrow();
  });
});
