import { BOSS_PROGRESS_KEY, loadBossProgress, recordBossResult } from './bossProgress';

function memory(initial?: string) {
  const mem = new Map<string, string>(initial === undefined ? [] : [[BOSS_PROGRESS_KEY, initial]]);
  return { mem, getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
}

describe('ボスの戦績', () => {
  it('挑戦・勝利・最高ランクを積み上げ、敗北は最高ランクに入らない', () => {
    const s = memory();
    recordBossResult('b1', 'D', s);
    expect(loadBossProgress(s).b1).toEqual({ attempts: 1, wins: 0, best: null });
    recordBossResult('b1', 'C', s);
    recordBossResult('b1', 'A', s);
    recordBossResult('b1', 'B', s);
    expect(loadBossProgress(s).b1).toEqual({ attempts: 4, wins: 3, best: 'A' });
  });

  it('ボスごとに独立', () => {
    const s = memory();
    recordBossResult('b1', 'S', s);
    recordBossResult('b2', 'C', s);
    expect(loadBossProgress(s).b1?.best).toBe('S');
    expect(loadBossProgress(s).b2?.best).toBe('C');
  });

  it('壊れた保存値・不正な項目は捨てる。保存できなくても落ちない', () => {
    expect(loadBossProgress(memory('{壊れ'))).toEqual({});
    expect(loadBossProgress(memory('[1]'))).toEqual({});
    const s = memory(JSON.stringify({ ok: { attempts: 1, wins: 1, best: 'S' }, ng: { attempts: 'x' }, bad: { attempts: 1, wins: 1, best: 'Z' } }));
    expect(Object.keys(loadBossProgress(s))).toEqual(['ok']);
    expect(() => recordBossResult('b', 'S', { getItem: () => null, setItem: () => { throw new Error('満杯'); } })).not.toThrow();
    expect(loadBossProgress(null)).toEqual({});
  });
});
