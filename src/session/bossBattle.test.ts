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

describe('betterRank', () => {
  it('強い方を返す。null は未挑戦', () => {
    expect(betterRank('B', 'A')).toBe('A');
    expect(betterRank('S', 'D')).toBe('S');
    expect(betterRank(null, 'C')).toBe('C');
    expect(betterRank('C', null)).toBe('C');
    expect(betterRank(null, null)).toBeNull();
  });
});
