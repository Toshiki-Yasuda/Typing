import { BgmManager, type AudioLike, type BgmDeps } from './bgm';

class FakeAudio implements AudioLike {
  src: string;
  loop = false;
  volume = 1;
  preload = '';
  paused = true;
  plays = 0;
  reject = false;
  constructor(src: string) {
    this.src = src;
  }
  async play() {
    this.plays++;
    if (this.reject) throw new Error('NotAllowedError');
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
}

function setup() {
  const audios: FakeAudio[] = [];
  const state = { rejectNext: false };
  const deps: BgmDeps = {
    createAudio: (src) => {
      const a = new FakeAudio(src);
      a.reject = state.rejectNext;
      audios.push(a);
      return a;
    },
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (id) => clearInterval(id as ReturnType<typeof setInterval>),
  };
  return { bgm: new BgmManager(deps), audios, state };
}
const advance = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
};
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('BgmManager', () => {
  it('曲を流すと、ループで再生し、フェードインして音量に達する', async () => {
    const { bgm, audios } = setup();
    bgm.setVolume(0.5);
    bgm.play('a.mp3', 1000);
    await flush();
    expect(audios).toHaveLength(1);
    expect(audios[0]?.loop).toBe(true);
    expect(audios[0]?.paused).toBe(false);
    expect(audios[0]?.volume).toBe(0); // フェード前
    await advance(500);
    expect(audios[0]?.volume).toBeGreaterThan(0.2);
    expect(audios[0]?.volume).toBeLessThan(0.3); // 半分の途中（0.5 × 約 0.5）
    await advance(600);
    expect(audios[0]?.volume).toBeCloseTo(0.5, 5);
    expect(bgm.playing).toBe('a.mp3');
  });

  it('同じ曲を続けて頼んでも、作り直さない', async () => {
    const { bgm, audios } = setup();
    bgm.play('a.mp3');
    bgm.play('a.mp3');
    await flush();
    expect(audios).toHaveLength(1);
    expect(audios[0]?.plays).toBe(1);
  });

  it('曲を替えると、古い曲はフェードアウトして片付き、新しい曲が入る（クロスフェード）', async () => {
    const { bgm, audios } = setup();
    bgm.setVolume(1);
    bgm.play('a.mp3', 500);
    await advance(600);
    bgm.play('b.mp3', 500);
    await flush();
    expect(audios).toHaveLength(2);
    await advance(250);
    expect(audios[0]?.volume).toBeLessThan(1);
    expect(audios[1]?.volume).toBeGreaterThan(0);
    await advance(400);
    expect(audios[0]?.paused).toBe(true);
    expect(audios[0]?.src).toBe(''); // 解放
    expect(audios[1]?.volume).toBeCloseTo(1, 5);
    expect(bgm.playing).toBe('b.mp3');
  });

  it('止めると、フェードアウトして消える', async () => {
    const { bgm, audios } = setup();
    bgm.play('a.mp3', 200);
    await advance(300);
    bgm.stop(200);
    await advance(300);
    expect(audios[0]?.paused).toBe(true);
    expect(bgm.playing).toBeNull();
    expect(bgm.current).toBeNull();
  });

  it('場面ごとの倍率と全体の音量を掛け合わせる', async () => {
    const { bgm, audios } = setup();
    bgm.setVolume(0.8);
    bgm.play('a.mp3', 100);
    await advance(300);
    bgm.setScale(0.25);
    expect(audios[0]?.volume).toBeCloseTo(0.2, 5);
    bgm.setVolume(0.4);
    expect(audios[0]?.volume).toBeCloseTo(0.1, 5);
    bgm.setVolume(5); // 範囲外は 1 に丸める
    bgm.setScale(-1); // 範囲外は 0
    expect(audios[0]?.volume).toBe(0);
  });

  it('無効にすると止まり、有効に戻すと、希望していた曲が再開する', async () => {
    const { bgm, audios } = setup();
    bgm.play('a.mp3', 100);
    await advance(300);
    bgm.setEnabled(false);
    await advance(1200);
    expect(bgm.playing).toBeNull();
    expect(bgm.current).toBe('a.mp3'); // 希望は残る
    bgm.setEnabled(true);
    await advance(1200);
    expect(bgm.playing).toBe('a.mp3');
    expect(audios.length).toBe(2);
  });

  it('無効のときに曲を頼んでも鳴らさない。有効にすると鳴る', async () => {
    const { bgm, audios } = setup();
    bgm.setEnabled(false);
    bgm.play('a.mp3');
    await flush();
    expect(audios).toHaveLength(0);
    bgm.setEnabled(true);
    await flush();
    expect(audios).toHaveLength(1);
  });

  it('ブラウザに再生を拒まれたら待ちにして、unlock() でやり直す（例外は出さない）', async () => {
    const { bgm, audios, state } = setup();
    state.rejectNext = true;
    bgm.play('a.mp3', 100);
    await flush();
    expect(audios[0]?.paused).toBe(true);
    expect(audios[0]?.plays).toBe(1);
    audios[0]!.reject = false; // ユーザー操作の後は許される
    bgm.unlock();
    await advance(300);
    expect(audios[0]?.plays).toBe(2);
    expect(audios[0]?.paused).toBe(false);
    expect(bgm.playing).toBe('a.mp3');
  });

  it('ページが隠れている間は止め、戻ったら続ける', async () => {
    const { bgm, audios } = setup();
    bgm.play('a.mp3', 100);
    await advance(300);
    bgm.setHidden(true);
    expect(audios[0]?.paused).toBe(true);
    bgm.setHidden(false);
    await flush();
    expect(audios[0]?.paused).toBe(false);
  });

  it('隠れている間に頼んだ曲は、戻ったときに鳴る', async () => {
    const { bgm, audios } = setup();
    bgm.setHidden(true);
    bgm.play('a.mp3', 100);
    await flush();
    expect(audios[0]?.plays).toBe(0);
    bgm.setHidden(false);
    await flush();
    expect(audios[0]?.paused).toBe(false);
  });

  it('タイマーは、フェードが終わったら止まる（動き続けない）', async () => {
    const { bgm } = setup();
    bgm.play('a.mp3', 200);
    await advance(400);
    expect(vi.getTimerCount()).toBe(0);
  });
});
