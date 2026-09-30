import type { SynthContextLike, SynthDeps } from './synth';

/**
 * 結果画面で 1 回だけ鳴らす、短い合成音（ステージクリア・ボス勝利・ボス敗北）。
 * 練習中の効果音（player.ts / synth.ts）とは別。Web Audio でその場で作るので、ファイルを増やさない。
 * 鳴らすかどうかは設定（useJingle）が決める。ここは音の形と再生だけ。
 */
export type JingleKind = 'clear' | 'victory' | 'defeat';

export interface JingleNote {
  readonly freq: number;
  readonly ms: number;
}
export interface JingleSpec {
  readonly wave: 'sine' | 'triangle';
  /** 音量のピーク（0〜1）。設定の音量を掛ける前。合成音は控えめにする */
  readonly peak: number;
  /** 順に鳴らす音（重ならない） */
  readonly notes: readonly JingleNote[];
}

export const JINGLES: Readonly<Record<JingleKind, JingleSpec>> = {
  // クリア: 明るい上昇 3 音（ド・ミ・ソ）
  clear: { wave: 'triangle', peak: 0.14, notes: [{ freq: 523, ms: 110 }, { freq: 659, ms: 110 }, { freq: 784, ms: 280 }] },
  // 勝利: 上昇 4 音（ド・ミ・ソ・高いド）で、最後を長く
  victory: { wave: 'triangle', peak: 0.16, notes: [{ freq: 523, ms: 120 }, { freq: 659, ms: 120 }, { freq: 784, ms: 120 }, { freq: 1047, ms: 420 }] },
  // 敗北: 下降 3 音。低く静かに（驚かせない）
  defeat: { wave: 'sine', peak: 0.1, notes: [{ freq: 247, ms: 180 }, { freq: 208, ms: 180 }, { freq: 165, ms: 360 }] },
};

/** 全体の長さ（ミリ秒）。どの音も 1 秒未満に収める */
export const jingleMs = (kind: JingleKind): number => JINGLES[kind].notes.reduce((sum, n) => sum + n.ms, 0);

const ATTACK = 0.008;
const FLOOR = 0.0001;

export class JinglePlayer {
  private ctx: SynthContextLike | null = null;
  private master = 1;

  constructor(private readonly deps: SynthDeps) {}

  setVolume(v: number): void {
    this.master = Math.max(0, Math.min(1, v));
  }

  play(kind: JingleKind): void {
    if (this.master <= 0) return;
    try {
      const ctx = (this.ctx ??= this.deps.createContext());
      if (!ctx) return;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      const spec = JINGLES[kind];
      const peak = Math.max(FLOOR * 2, spec.peak * this.master);
      let at = ctx.currentTime;
      for (const note of spec.notes) {
        const end = at + note.ms / 1000;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(FLOOR, at);
        gain.gain.linearRampToValueAtTime(peak, at + ATTACK);
        gain.gain.exponentialRampToValueAtTime(FLOOR, end);
        gain.connect(ctx.destination);
        const osc = ctx.createOscillator();
        osc.type = spec.wave;
        osc.frequency.setValueAtTime(note.freq, at);
        osc.connect(gain);
        osc.start(at);
        osc.stop(end + 0.01);
        at = end;
      }
    } catch {
      // 鳴らせなくても結果は見られる
    }
  }
}

export type { SynthDeps };
