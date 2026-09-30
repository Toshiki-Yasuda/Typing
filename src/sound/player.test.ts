import { SoundPlayer, type AudioContextLike, type SoundUrls } from './player';

const urls: SoundUrls = { type: ['t1', 't2'], miss: ['m'], complete: ['c'] };

function fakeContext(state = 'running') {
  const started: unknown[] = [];
  const gains: number[] = [];
  const ctx: AudioContextLike & { resumed: number } = {
    state,
    resumed: 0,
    destination: 'dest',
    resume: async () => {
      ctx.resumed++;
    },
    decodeAudioData: async (data) => `decoded:${new TextDecoder().decode(data)}`,
    createBufferSource: () => {
      const src = {
        buffer: null as unknown,
        connect: () => {},
        start: () => void started.push(src.buffer),
      };
      return src;
    },
    createGain: () => {
      const g = { gain: { value: 0 }, connect: () => void gains.push(g.gain.value) };
      return g;
    },
  };
  return { ctx, started, gains };
}

const bytes = async (url: string) => new TextEncoder().encode(url).buffer as ArrayBuffer;

describe('SoundPlayer', () => {
  it('読み込み後に、種類ごとの音を順番に鳴らす', async () => {
    const { ctx, started } = fakeContext();
    const p = new SoundPlayer(urls, { createContext: () => ctx, fetchBytes: bytes });
    await p.preload();
    p.play('type');
    p.play('type');
    p.play('type');
    p.play('miss');
    p.play('complete');
    expect(started).toEqual(['decoded:t1', 'decoded:t2', 'decoded:t1', 'decoded:m', 'decoded:c']);
  });

  it('種類ごとに音量が違う（完了 > 打鍵）', async () => {
    const { ctx, gains } = fakeContext();
    const p = new SoundPlayer(urls, { createContext: () => ctx, fetchBytes: bytes });
    await p.preload();
    p.play('type');
    p.play('complete');
    expect(gains[1]).toBeGreaterThan(gains[0] as number);
  });

  it('効果音の音量の設定が掛かる。範囲外は丸める', async () => {
    const { ctx, gains } = fakeContext();
    const p = new SoundPlayer(urls, { createContext: () => ctx, fetchBytes: bytes });
    await p.preload();
    p.play('complete');
    p.setVolume(0.5);
    p.play('complete');
    p.setVolume(7);
    p.play('complete');
    p.setVolume(-1);
    p.play('complete');
    expect(gains[1]).toBeCloseTo((gains[0] as number) * 0.5, 5);
    expect(gains[2]).toBeCloseTo(gains[0] as number, 5);
    expect(gains[3]).toBe(0);
  });

  it('読み込み前は鳴らさない（例外にしない）', () => {
    const { ctx, started } = fakeContext();
    const p = new SoundPlayer(urls, { createContext: () => ctx, fetchBytes: bytes });
    p.play('type');
    expect(started).toEqual([]);
  });

  it('Web Audio が無い環境では何もしない', async () => {
    const p = new SoundPlayer(urls, { createContext: () => null, fetchBytes: bytes });
    await p.preload();
    expect(() => p.play('type')).not.toThrow();
  });

  it('読めなかった音だけ鳴らさない', async () => {
    const { ctx, started } = fakeContext();
    const p = new SoundPlayer(urls, {
      createContext: () => ctx,
      fetchBytes: async (url) => (url === 't1' ? Promise.reject(new Error('404')) : bytes(url)),
    });
    await p.preload();
    p.play('type'); // t1（読めていない）
    p.play('type'); // t2
    expect(started).toEqual(['decoded:t2']);
  });

  it('停止中のコンテキストは再開してから鳴らす', async () => {
    const { ctx } = fakeContext('suspended');
    const p = new SoundPlayer(urls, { createContext: () => ctx, fetchBytes: bytes });
    await p.preload();
    p.play('miss');
    expect(ctx.resumed).toBe(1);
  });

  it('再生で例外が出ても呼び出し側には伝えない', async () => {
    const { ctx } = fakeContext();
    ctx.createBufferSource = () => {
      throw new Error('boom');
    };
    const p = new SoundPlayer(urls, { createContext: () => ctx, fetchBytes: bytes });
    await p.preload();
    expect(() => p.play('type')).not.toThrow();
  });
});
