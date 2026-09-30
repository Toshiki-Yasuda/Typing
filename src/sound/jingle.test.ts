import { JINGLES, JinglePlayer, jingleMs, type JingleKind } from './jingle';
import type { SynthContextLike } from './synth';

function fakeCtx(state = 'running') {
  const log = { osc: [] as { type: string; freqs: number[]; start: number[]; stop: number[] }[], peaks: [] as number[], ends: [] as number[], resumed: 0, gains: 0 };
  const param = (sink?: (v: number) => void) => ({
    value: 0,
    setValueAtTime: () => {},
    linearRampToValueAtTime: (v: number) => sink?.(v),
    exponentialRampToValueAtTime: (_v: number, t: number) => log.ends.push(t),
  });
  const ctx: SynthContextLike = {
    state,
    currentTime: 10,
    destination: {},
    resume: async () => void log.resumed++,
    createGain: () => {
      log.gains++;
      return { gain: param((v) => log.peaks.push(v)), connect: () => {} };
    },
    createOscillator: () => {
      const o = { type: '', freqs: [] as number[], start: [] as number[], stop: [] as number[] };
      log.osc.push(o);
      return {
        set type(v: string) {
          o.type = v;
        },
        frequency: { ...param(), setValueAtTime: (v: number) => o.freqs.push(v) },
        connect: () => {},
        start: (t?: number) => o.start.push(t ?? 0),
        stop: (t?: number) => o.stop.push(t ?? 0),
      };
    },
  };
  return { ctx, log };
}

describe('結果画面の合成音（jingle）', () => {
  it('長さは クリア 500ms・勝利 780ms・敗北 720ms（どれも 1 秒未満）', () => {
    expect(Object.fromEntries((Object.keys(JINGLES) as JingleKind[]).map((k) => [k, jingleMs(k)]))).toEqual({ clear: 500, victory: 780, defeat: 720 });
  });

  it('クリア: 上昇 3 音（523→659→784Hz）を重ならず順に鳴らす。各音で終わりの時刻が前の音の終わり', () => {
    const { ctx, log } = fakeCtx();
    new JinglePlayer({ createContext: () => ctx }).play('clear');
    expect(log.osc.map((o) => o.freqs[0])).toEqual([523, 659, 784]);
    expect(log.osc.map((o) => o.type)).toEqual(['triangle', 'triangle', 'triangle']);
    expect(log.osc.map((o) => o.start[0])).toEqual([10, 10.11, 10.22].map((t) => expect.closeTo(t, 10)));
    expect(log.ends.map((t) => t)).toEqual([10.11, 10.22, 10.5].map((t) => expect.closeTo(t, 10)));
  });

  it('勝利は上昇 4 音、敗北は下降 3 音（周波数が単調に下がる）', () => {
    const v = fakeCtx();
    new JinglePlayer({ createContext: () => v.ctx }).play('victory');
    const vf = v.log.osc.map((o) => o.freqs[0]!);
    expect(vf).toEqual([523, 659, 784, 1047]);
    const d = fakeCtx();
    new JinglePlayer({ createContext: () => d.ctx }).play('defeat');
    const df = d.log.osc.map((o) => o.freqs[0]!);
    expect(df).toHaveLength(3);
    expect(df[0]! > df[1]! && df[1]! > df[2]!).toBe(true);
  });

  it('音量は設定を掛ける。0 なら鳴らさない（文脈も作らない）', () => {
    const { ctx, log } = fakeCtx();
    const create = vi.fn(() => ctx);
    const p = new JinglePlayer({ createContext: create });
    p.setVolume(0.5);
    p.play('clear');
    expect(log.peaks[0]).toBeCloseTo(0.14 * 0.5, 10);
    p.setVolume(0);
    p.play('clear');
    expect(log.osc).toHaveLength(3); // 増えていない
    const silent = new JinglePlayer({ createContext: create });
    silent.setVolume(0);
    silent.play('victory');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('音量は 0〜1 に丸める', () => {
    const { ctx, log } = fakeCtx();
    const p = new JinglePlayer({ createContext: () => ctx });
    p.setVolume(5);
    p.play('clear');
    expect(log.peaks[0]).toBeCloseTo(0.14, 10);
  });

  it('止まっている文脈は resume する。作れない・例外のときは何もしない', () => {
    const { ctx, log } = fakeCtx('suspended');
    new JinglePlayer({ createContext: () => ctx }).play('clear');
    expect(log.resumed).toBe(1);
    expect(() => new JinglePlayer({ createContext: () => null }).play('clear')).not.toThrow();
    expect(() =>
      new JinglePlayer({
        createContext: () => {
          throw new Error('x');
        },
      }).play('defeat'),
    ).not.toThrow();
  });
});
