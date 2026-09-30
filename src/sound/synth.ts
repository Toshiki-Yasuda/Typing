import type { SoundKind } from './player';

/** 合成音で使う Web Audio の部分だけ（テストで差し替えるため） */
export interface SynthParam {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
  exponentialRampToValueAtTime(v: number, t: number): unknown;
}
export interface SynthContextLike {
  readonly state: string;
  readonly currentTime: number;
  readonly destination: unknown;
  resume(): Promise<void>;
  createOscillator(): {
    type: string;
    frequency: SynthParam;
    connect(node: unknown): void;
    start(when?: number): void;
    stop(when?: number): void;
  };
  createGain(): { gain: SynthParam; connect(node: unknown): void };
}
export interface SynthDeps {
  createContext: () => SynthContextLike | null;
}

/** 音ごとの形。長さは 打鍵 30ms・ミス 90ms・完了 180ms。周波数の並びは等分して順に鳴らす */
export interface SynthVoice {
  readonly ms: number;
  readonly wave: 'sine' | 'triangle';
  readonly freqs: readonly number[];
  /** 音量のピーク（0〜1）。全体の音量（設定）を掛ける前の値。合成音は控えめにする */
  readonly peak: number;
}
export const SYNTH_VOICES: Readonly<Record<SoundKind, SynthVoice>> = {
  type: { ms: 30, wave: 'sine', freqs: [880], peak: 0.09 },
  miss: { ms: 90, wave: 'triangle', freqs: [196], peak: 0.14 },
  complete: { ms: 180, wave: 'sine', freqs: [659, 988], peak: 0.16 },
};

const ATTACK = 0.004;
const FLOOR = 0.0001;

/**
 * 合成音の再生。ファイルを読まず、鳴らす瞬間に Web Audio で短い音を作る。
 * AudioContext は最初の打鍵（ユーザー操作）で作って resume() する。作れない・鳴らせないときは何もしない（練習には影響しない）。
 * 音量は設定 `sfxVolume`（setVolume）。SoundPlayer と同じ `play(kind)` / `setVolume` を持つ。
 */
export class SynthPlayer {
  private ctx: SynthContextLike | null = null;
  private master = 1;

  constructor(private readonly deps: SynthDeps) {}

  setVolume(v: number): void {
    this.master = Math.max(0, Math.min(1, v));
  }

  play(kind: SoundKind): void {
    if (this.master <= 0) return;
    try {
      const ctx = (this.ctx ??= this.deps.createContext());
      if (!ctx) return;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      const voice = SYNTH_VOICES[kind];
      const t0 = ctx.currentTime;
      const dur = voice.ms / 1000;
      const peak = Math.max(FLOOR * 2, voice.peak * this.master);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(FLOOR, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + ATTACK);
      gain.gain.exponentialRampToValueAtTime(FLOOR, t0 + dur);
      gain.connect(ctx.destination);
      const step = dur / voice.freqs.length;
      voice.freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = voice.wave;
        osc.frequency.setValueAtTime(f, t0 + i * step);
        osc.connect(gain);
        osc.start(t0 + i * step);
        osc.stop(t0 + (i + 1) * step + 0.01);
      });
    } catch {
      // 鳴らせなくても練習は続ける
    }
  }
}

export function browserSynthDeps(): SynthDeps {
  return {
    createContext: () => {
      const Ctor = globalThis.AudioContext as (new () => SynthContextLike) | undefined;
      return Ctor ? new Ctor() : null;
    },
  };
}
