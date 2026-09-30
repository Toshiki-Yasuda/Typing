import { BossBattle, betterRank, type BattleRules } from './bossBattle';
import type { PressEvent } from './practiceSession';

const rules: BattleRules = { words: 4, maxMisses: 3 };
function run(events: PressEvent[], r: BattleRules = rules) {
  const b = new BossBattle(r);
  const phases = events.map((e) => b.apply(e).phaseChanged);
  return { b, phases };
}

describe('BossBattle', () => {
  it('お題を1つ打ち終えるごとにボスの HP が1減り、最後で勝つ', () => {
    const { b } = run(['ok', 'wordDone', 'ok', 'wordDone']);
    expect(b.state()).toMatchObject({ bossRemaining: 2, status: 'fighting' });
    b.apply('ok');
    b.apply('wordDone');
    b.apply('sessionDone');
    expect(b.state()).toMatchObject({ bossRemaining: 0, status: 'won' });
  });

  it('フェーズは HP の減り方で 1→2→3→4 と上がり、上がった瞬間だけ通知する', () => {
    const { phases } = run(['ok', 'wordDone', 'wordDone', 'wordDone', 'sessionDone']);
    // 4語: 1語目を終えると 25%=フェーズ2、2語目 3、3語目 4、最後（勝利）は 4 のまま
    expect(phases).toEqual([null, 2, 3, 4, null]);
  });

  it('コンボは正打で増え、ミスで 0 に戻る。最大は残る', () => {
    const { b } = run(['ok', 'ok', 'ok', 'miss', 'ok']);
    expect(b.state()).toMatchObject({ combo: 1, maxCombo: 3, misses: 1 });
  });

  it('ミスが許容を超えた瞬間に負ける（許容ちょうどでは負けない）', () => {
    const { b } = run(['miss', 'miss', 'miss']);
    expect(b.state()).toMatchObject({ status: 'fighting', missesLeft: 0 });
    b.apply('miss');
    expect(b.state().status).toBe('lost');
  });

  it('決着後の入力は無視される', () => {
    const { b } = run(['miss', 'miss', 'miss', 'miss', 'ok', 'sessionDone']);
    expect(b.state()).toMatchObject({ status: 'lost', combo: 0, bossRemaining: 4 });
    expect(b.apply('ok').phaseChanged).toBeNull();
  });

  it('ignored は何も変えない', () => {
    const { b } = run(['ok', 'ignored']);
    expect(b.state().combo).toBe(1);
  });

  it('ランク: S=ノーミス / A=1ミス / B=許容の半分以下 / C / D=敗北。戦闘中は null', () => {
    const win = (misses: number, max = 6) =>
      run([...Array<PressEvent>(misses).fill('miss'), 'wordDone', 'sessionDone'], { words: 2, maxMisses: max }).b.rank();
    expect(win(0)).toBe('S');
    expect(win(1)).toBe('A');
    expect(win(3)).toBe('B'); // 許容 6 の半分
    expect(win(4)).toBe('C');
    expect(run(['miss', 'miss', 'miss', 'miss']).b.rank()).toBe('D');
    expect(run(['ok']).b.rank()).toBeNull();
  });

  it('maxMisses が 1 のとき、1ミスは A（B の条件より A が優先）', () => {
    expect(run(['miss', 'wordDone', 'sessionDone'], { words: 2, maxMisses: 1 }).b.rank()).toBe('A');
  });

  it('不正な設定は作れない', () => {
    expect(() => new BossBattle({ words: 0, maxMisses: 1 })).toThrow();
    expect(() => new BossBattle({ words: 1, maxMisses: -1 })).toThrow();
  });

  it('1語だけのボスでも、フェーズが 4 を超えない', () => {
    const { b } = run(['sessionDone'], { words: 1, maxMisses: 1 });
    expect(b.state().phase).toBe(4);
  });
});

describe('時間制限（tick）', () => {
  const timed: BattleRules = { words: 3, maxMisses: 3, timeLimitMs: 10_000 };

  it('制限の手前では何も起きず、ちょうど制限で敗北（理由は時間切れ）', () => {
    const b = new BossBattle(timed);
    expect(b.tick(9_999)).toBe(false);
    expect(b.state().status).toBe('fighting');
    expect(b.tick(10_000)).toBe(true);
    expect(b.state()).toMatchObject({ status: 'lost', lostBy: 'time' });
    expect(b.rank()).toBe('D');
  });

  it('制限が無ければ、どれだけ経っても負けない', () => {
    const b = new BossBattle(rules);
    expect(b.tick(1e9)).toBe(false);
    expect(b.state().status).toBe('fighting');
  });

  it('決着した後の tick は何も変えない（勝利は時間切れにならない・敗北の理由は変わらない）', () => {
    const won = new BossBattle({ words: 1, maxMisses: 1, timeLimitMs: 100 });
    won.apply('sessionDone');
    expect(won.tick(1000)).toBe(false);
    expect(won.state()).toMatchObject({ status: 'won', lostBy: null });
    const lost = new BossBattle({ words: 2, maxMisses: 0, timeLimitMs: 100 });
    lost.apply('miss');
    expect(lost.tick(1000)).toBe(false);
    expect(lost.state().lostBy).toBe('misses');
  });

  it('敗北の理由: ミスなら misses。戦闘中・勝利は null', () => {
    expect(new BossBattle(rules).state().lostBy).toBeNull();
    expect(run(['miss', 'miss', 'miss', 'miss']).b.state()).toMatchObject({ status: 'lost', lostBy: 'misses' });
  });

  it('不正な制限は作れない', () => {
    expect(() => new BossBattle({ words: 1, maxMisses: 1, timeLimitMs: 0 })).toThrow();
    expect(() => new BossBattle({ words: 1, maxMisses: 1, timeLimitMs: -5 })).toThrow();
  });
});

describe('スタミナ（recoverEvery）', () => {
  const stamina: BattleRules = { words: 50, maxMisses: 2, recoverEvery: 3 };
  const oks = (n: number): PressEvent[] => Array(n).fill('ok');

  it('正しい打鍵が指定の回数つづくごとに、ミスを 1 回ぶん回復する', () => {
    const { b } = run(['miss', 'miss', ...oks(3)], stamina);
    expect(b.state()).toMatchObject({ misses: 1, missesTotal: 2, missesLeft: 1 });
    b.apply('ok');
    b.apply('ok');
    b.apply('ok');
    expect(b.state()).toMatchObject({ misses: 0, missesTotal: 2, missesLeft: 2 });
  });

  it('回復は、初期の許容を超えない（ミスが 0 なら回復しない）', () => {
    const { b } = run(oks(9), stamina);
    expect(b.state()).toMatchObject({ misses: 0, missesLeft: 2 });
  });

  it('連続が途切れると数え直し（ミスでコンボが 0 に戻る）', () => {
    const { b } = run(['miss', 'ok', 'ok', 'miss', 'ok', 'ok'], stamina);
    expect(b.state().misses).toBe(2); // どこも 3 連続に届かない
  });

  it('回復があるので、総数では許容を超えても負けないことがある。ランクは総数で決める', () => {
    const { b } = run(['miss', 'miss', ...oks(3), 'miss', ...oks(2), 'sessionDone'], { ...stamina, words: 1 });
    // 総ミス 3 > 許容 2 だが、回復して超えていない
    expect(b.state()).toMatchObject({ status: 'won', missesTotal: 3 });
    expect(b.rank()).toBe('C'); // 総数 3 は許容の半分（1）超え
  });

  it('ミスを回復しても、ランクは S にならない（総数 1 は A）', () => {
    const { b } = run(['miss', ...oks(2), 'sessionDone'], { words: 1, maxMisses: 2, recoverEvery: 3 });
    expect(b.state()).toMatchObject({ misses: 0, missesTotal: 1 });
    expect(b.rank()).toBe('A');
  });

  it('スタミナ無しでは回復しない（対照）', () => {
    const { b } = run(['miss', ...oks(10)], rules);
    expect(b.state().misses).toBe(1);
  });

  it('不正な回復間隔は作れない', () => {
    expect(() => new BossBattle({ words: 1, maxMisses: 1, recoverEvery: 0 })).toThrow();
    expect(() => new BossBattle({ words: 1, maxMisses: 1, recoverEvery: 1.5 })).toThrow();
  });
});

describe('betterRank', () => {
  it('強い方を返す。null は未挑戦', () => {
    expect(betterRank('B', 'A')).toBe('A');
    expect(betterRank('S', 'D')).toBe('S');
    expect(betterRank(null, 'C')).toBe('C');
    expect(betterRank('C', null)).toBe('C');
    expect(betterRank(null, null)).toBeNull();
  });
});
