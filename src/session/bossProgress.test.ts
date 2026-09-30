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
    expect(loadBossProgress(s).b1).toEqual({ attempts: 4, wins: 3, best: 'A', bestVows: 0 });
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

describe('ボスの戦績: 縛り（メダルの元）', () => {
  it('勝ったときに、付けていた縛りの数の最大を残す。敗北では変えない', () => {
    const s = memory();
    recordBossResult('b', 'C', s, 1);
    expect(loadBossProgress(s).b?.bestVows).toBe(1);
    recordBossResult('b', 'B', s, 3);
    recordBossResult('b', 'A', s, 2); // 少ない縛りでは下がらない
    expect(loadBossProgress(s).b?.bestVows).toBe(3);
    recordBossResult('b', 'D', s, 4); // 敗北は数えない
    expect(loadBossProgress(s).b).toMatchObject({ attempts: 4, wins: 3, bestVows: 3 });
  });

  it('縛りなしで勝つと 0。敗北だけなら項目を持たない', () => {
    const s = memory();
    recordBossResult('a', 'D', s, 2);
    expect(loadBossProgress(s).a).toEqual({ attempts: 1, wins: 0, best: null });
    recordBossResult('b', 'S', s);
    expect(loadBossProgress(s).b?.bestVows).toBe(0);
  });

  it('旧データ（bestVows なし）は、そのまま読める。次の勝利で項目が付く', () => {
    const s = memory(JSON.stringify({ old: { attempts: 2, wins: 1, best: 'B' } }));
    expect(loadBossProgress(s).old).toEqual({ attempts: 2, wins: 1, best: 'B' });
    recordBossResult('old', 'A', s, 2);
    expect(loadBossProgress(s).old).toEqual({ attempts: 3, wins: 2, best: 'A', bestVows: 2 });
  });

  it('不正な縛りの数は捨てる', () => {
    const s = memory(JSON.stringify({ bad: { attempts: 1, wins: 1, best: 'S', bestVows: 9 } }));
    expect(loadBossProgress(s)).toEqual({});
  });
});

