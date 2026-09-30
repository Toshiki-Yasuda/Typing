import { MAX_PARTICLES, ParticleField, particleAlpha, particleCount } from './particles';

const mid = () => 0.5;

describe('particleCount', () => {
  it('正打は数個、語の完了は多め、ミスは出さない', () => {
    expect(particleCount('ok')).toBe(3);
    expect(particleCount('wordDone')).toBe(10);
    expect(particleCount('sessionDone')).toBe(24);
    expect(particleCount('miss')).toBe(0);
  });
});

describe('ParticleField', () => {
  it('上限 40 を超えては出さない', () => {
    expect(MAX_PARTICLES).toBe(40);
    const f = new ParticleField();
    expect(f.spawn(30, 0, 0, mid)).toBe(30);
    expect(f.spawn(30, 0, 0, mid)).toBe(MAX_PARTICLES - 30);
    expect(f.count).toBe(MAX_PARTICLES);
    expect(f.spawn(1, 0, 0, mid)).toBe(0);
  });
  it('乱数が 0.5 なら真上に、寿命 0.95 秒で上がる', () => {
    const f = new ParticleField();
    f.spawn(1, 100, 200, mid);
    const p = f.particles[0]!;
    expect(p).toMatchObject({ x: 100, y: 200, vx: 0, age: 0 });
    expect(p.vy).toBeCloseTo(-95, 10);
    expect(p.life).toBeCloseTo(0.95, 10);
    f.step(0.1);
    expect(f.particles[0]!.y).toBeLessThan(200);
    expect(f.particles[0]!.x).toBe(100);
  });
  it('寿命が尽きた粒は消え、count が 0 になる（rAF を止める条件）', () => {
    const f = new ParticleField();
    f.spawn(5, 0, 0, mid);
    f.step(0.5);
    expect(f.count).toBe(5);
    f.step(0.5);
    expect(f.count).toBe(0);
  });
  it('寿命ちょうどで消える', () => {
    const f = new ParticleField();
    f.spawn(1, 0, 0, mid); // 寿命 0.95 秒
    f.step(0.95);
    expect(f.count).toBe(0);
  });
  it('不透明度は生まれた直後 1、寿命で 0', () => {
    const p = { x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 2, r: 1 };
    expect(particleAlpha(p)).toBe(1);
    expect(particleAlpha({ ...p, age: 1 })).toBe(0.5);
    expect(particleAlpha({ ...p, age: 3 })).toBe(0);
  });
});
