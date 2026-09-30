/** 粒の上限。これを超えては出さない */
export const MAX_PARTICLES = 40;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  r: number;
}

/** 打鍵の結果ごとに出す粒の数。正打は数個、語の完了は多め、ミスは出さない */
export function particleCount(result: 'ok' | 'miss' | 'wordDone' | 'sessionDone'): number {
  switch (result) {
    case 'ok':
      return 3;
    case 'wordDone':
      return 10;
    case 'sessionDone':
      return 24;
    default:
      return 0;
  }
}

/** 粒の集まり。位置の更新だけを持つ純粋な部分（描画は FxLayer）。rand は 0〜1 の乱数 */
export class ParticleField {
  private items: Particle[] = [];

  get count(): number {
    return this.items.length;
  }
  get particles(): readonly Particle[] {
    return this.items;
  }

  /** (x, y) から上向きに n 個出す。上限を超える分は捨てる。出した数を返す */
  spawn(n: number, x: number, y: number, rand: () => number): number {
    const room = Math.max(0, MAX_PARTICLES - this.items.length);
    const k = Math.min(n, room);
    for (let i = 0; i < k; i++) {
      this.items.push({
        x: x + (rand() - 0.5) * 160,
        y,
        vx: (rand() - 0.5) * 50,
        vy: -(60 + rand() * 70),
        age: 0,
        life: 0.7 + rand() * 0.5,
        r: 1.5 + rand() * 1.5,
      });
    }
    return k;
  }

  /** dt 秒だけ進める。寿命が尽きた粒は消す */
  step(dt: number): void {
    for (const p of this.items) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy *= Math.max(0, 1 - 1.2 * dt); // 上がるほど減速して、ふわっと消える
    }
    this.items = this.items.filter((p) => p.age < p.life);
  }
}

/** 粒の不透明度（生まれた直後が最大、寿命で 0） */
export function particleAlpha(p: Particle): number {
  return Math.max(0, 1 - p.age / p.life);
}
