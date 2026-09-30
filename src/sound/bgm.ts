/**
 * BGM の再生。長い曲を丸ごと復号しないよう、`<audio>`（HTMLAudioElement）でストリーミングする。
 *
 * - 1 度に 1 曲。曲を替えるときは、古い曲をフェードアウトしながら新しい曲をフェードインする（クロスフェード）
 * - 音量 = 全体の音量 × 場面ごとの倍率（例: ボス戦のフェーズで下げる）× フェード
 * - ブラウザは、ユーザー操作の前の再生を拒む。拒まれたら「待ち」にして、次の `unlock()`（ユーザー操作）で再試行する
 * - 再生に失敗しても、例外を外に出さない（BGM が無くても練習はできる）
 * - 打鍵・判定とは無関係。DOM にも React にも依存せず、`<audio>` は注入して差し替えられる
 */
export interface AudioLike {
  src: string;
  loop: boolean;
  volume: number;
  preload: string;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
}

export interface BgmDeps {
  createAudio: (src: string) => AudioLike;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (id: unknown) => void;
}

interface Track {
  url: string;
  audio: AudioLike;
  /** 今のフェードの倍率 0〜1 */
  gain: number;
  /** フェードの行き先（0 なら消えたら片付ける） */
  target: number;
  /** 1 ミリ秒あたりの gain の変化量 */
  rate: number;
  /** ブラウザに再生を拒まれた */
  blocked: boolean;
}

const TICK_MS = 50;
const DEFAULT_FADE_MS = 900;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export class BgmManager {
  private tracks: Track[] = [];
  private timer: unknown = null;
  private enabled = true;
  private volume = 0.6;
  private scale = 1;
  private hidden = false;
  /** 今流したい曲（無効・ゲート前でも覚えておき、使えるようになったら鳴らす） */
  private wanted: string | null = null;

  constructor(private readonly deps: BgmDeps) {}

  get current(): string | null {
    return this.wanted;
  }

  /** 音量が実際に出ている（再生中の）曲の URL */
  get playing(): string | null {
    const t = this.tracks.find((x) => x.target > 0 && !x.audio.paused);
    return t?.url ?? null;
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) this.reconcile(DEFAULT_FADE_MS);
    else this.fadeAllOut(DEFAULT_FADE_MS);
  }

  /** 全体の音量（0〜1） */
  setVolume(v: number): void {
    this.volume = clamp01(v);
    this.applyVolumes();
  }

  /** 場面ごとの倍率（0〜1）。ボス戦のフェーズで下げるなど */
  setScale(scale: number): void {
    this.scale = clamp01(scale);
    this.applyVolumes();
  }

  /** この曲を流したい。同じ曲が流れていれば何もしない。`null` なら止める */
  play(url: string | null, fadeMs = DEFAULT_FADE_MS): void {
    if (url === this.wanted) {
      // 同じ曲。ゲート前で待ちになっていた場合の再試行は unlock() が行う
      return;
    }
    this.wanted = url;
    this.reconcile(fadeMs);
  }

  /** 止める（曲の希望も消す） */
  stop(fadeMs = DEFAULT_FADE_MS): void {
    this.play(null, fadeMs);
  }

  /** ユーザー操作の中で呼ぶ。拒まれていた再生をやり直す */
  unlock(): void {
    for (const t of this.tracks) {
      if (t.blocked && t.target > 0) this.start(t);
    }
    if (this.wanted && this.enabled && !this.tracks.some((t) => t.url === this.wanted && t.target > 0)) {
      this.reconcile(DEFAULT_FADE_MS);
    }
  }

  /** ページが隠れている間は止め、戻ったら続ける */
  setHidden(hidden: boolean): void {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    for (const t of this.tracks) {
      if (hidden) t.audio.pause();
      else if (t.target > 0) this.start(t);
    }
  }

  private reconcile(fadeMs: number): void {
    const want = this.enabled ? this.wanted : null;
    for (const t of this.tracks) {
      if (t.url !== want && t.target > 0) this.fadeTo(t, 0, fadeMs);
    }
    if (want && !this.tracks.some((t) => t.url === want && t.target > 0)) {
      const audio = this.deps.createAudio(want);
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0;
      const t: Track = { url: want, audio, gain: 0, target: 1, rate: 1 / Math.max(1, fadeMs), blocked: false };
      this.tracks.push(t);
      this.start(t);
    }
    this.ensureTimer();
  }

  private fadeAllOut(fadeMs: number): void {
    for (const t of this.tracks) if (t.target > 0) this.fadeTo(t, 0, fadeMs);
    this.ensureTimer();
  }

  private fadeTo(t: Track, target: number, fadeMs: number): void {
    t.target = target;
    t.rate = Math.max(0.0001, Math.abs(target - t.gain)) / Math.max(1, fadeMs);
  }

  private start(t: Track): void {
    if (this.hidden) return;
    try {
      t.audio.play().then(
        () => {
          t.blocked = false;
        },
        () => {
          // ユーザー操作の前など。次の unlock() でやり直す
          t.blocked = true;
        },
      );
    } catch {
      t.blocked = true;
    }
  }

  private applyVolumes(): void {
    for (const t of this.tracks) t.audio.volume = clamp01(this.volume * this.scale * t.gain);
  }

  private ensureTimer(): void {
    if (this.timer !== null || this.tracks.every((t) => t.gain === t.target)) return;
    this.timer = this.deps.setInterval(() => this.tick(), TICK_MS);
  }

  private tick(): void {
    for (const t of this.tracks) {
      const delta = t.rate * TICK_MS;
      if (t.gain < t.target) t.gain = Math.min(t.target, t.gain + delta);
      else if (t.gain > t.target) t.gain = Math.max(t.target, t.gain - delta);
    }
    this.applyVolumes();
    // 消えた曲は止めて片付ける
    this.tracks = this.tracks.filter((t) => {
      if (t.target === 0 && t.gain === 0) {
        t.audio.pause();
        t.audio.src = '';
        return false;
      }
      return true;
    });
    if (this.tracks.every((t) => t.gain === t.target) && this.timer !== null) {
      this.deps.clearInterval(this.timer);
      this.timer = null;
    }
  }
}

/** ブラウザの実装 */
export function browserBgmDeps(): BgmDeps {
  return {
    createAudio: (src) => {
      const audio = new Audio();
      audio.preload = 'none';
      audio.src = new URL(src, document.baseURI).href;
      return audio as unknown as AudioLike;
    },
    setInterval: (fn, ms) => window.setInterval(fn, ms),
    clearInterval: (id) => window.clearInterval(id as number),
  };
}

let shared: BgmManager | null = null;
/** アプリ全体で 1 つの BGM 再生器 */
export function getBgm(): BgmManager {
  return (shared ??= new BgmManager(browserBgmDeps()));
}
