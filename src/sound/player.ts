/** 効果音の種類 */
export type SoundKind = 'type' | 'miss' | 'complete';
export type SoundUrls = Readonly<Record<SoundKind, readonly string[]>>;

/** Web Audio のうち使う部分だけ（テストで差し替えるため） */
export interface AudioContextLike {
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  decodeAudioData(data: ArrayBuffer): Promise<unknown>;
  createBufferSource(): { buffer: unknown; connect(node: unknown): void; start(when?: number): void };
  createGain(): { gain: { value: number }; connect(node: unknown): void };
}

export interface SoundDeps {
  createContext: () => AudioContextLike | null;
  fetchBytes: (url: string) => Promise<ArrayBuffer>;
}

const VOLUME: Readonly<Record<SoundKind, number>> = { type: 0.5, miss: 0.6, complete: 0.8 };

/**
 * 効果音の再生。事前に読み込んで復号しておき、鳴らす処理は同期で軽い（打鍵の判定・描画を待たせない）。
 * 読み込み前・失敗時・Web Audio が無い環境では、何もしない（練習には影響しない）。
 * 同じ種類に複数の音があるときは、順番に使う（乱数を使わない）。
 */
export class SoundPlayer {
  private ctx: AudioContextLike | null = null;
  private readonly buffers = new Map<string, unknown>();
  private readonly cursor: Record<SoundKind, number> = { type: 0, miss: 0, complete: 0 };

  constructor(
    private readonly urls: SoundUrls,
    private readonly deps: SoundDeps,
  ) {}

  /** 音を読み込む。ユーザー操作の後に呼ぶ（ブラウザが音の開始を許すため） */
  async preload(): Promise<void> {
    const ctx = (this.ctx ??= this.deps.createContext());
    if (!ctx) return;
    const all = new Set(Object.values(this.urls).flat());
    await Promise.all(
      [...all].map(async (url) => {
        try {
          this.buffers.set(url, await ctx.decodeAudioData(await this.deps.fetchBytes(url)));
        } catch {
          // 読めない音は鳴らさない
        }
      }),
    );
  }

  play(kind: SoundKind): void {
    const ctx = this.ctx;
    const list = this.urls[kind];
    if (!ctx || list.length === 0) return;
    const url = list[this.cursor[kind] % list.length] as string;
    this.cursor[kind]++;
    const buffer = this.buffers.get(url);
    if (!buffer) return;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = VOLUME[kind];
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
    } catch {
      // 鳴らせなくても練習は続ける
    }
  }
}

/** ブラウザの実装 */
export function browserSoundDeps(): SoundDeps {
  return {
    createContext: () => {
      const Ctor = globalThis.AudioContext as (new () => AudioContextLike) | undefined;
      return Ctor ? new Ctor() : null;
    },
    fetchBytes: async (url) => {
      const res = await fetch(new URL(url, document.baseURI));
      if (!res.ok) throw new Error(`音を読めません: ${url}`);
      return res.arrayBuffer();
    },
  };
}
