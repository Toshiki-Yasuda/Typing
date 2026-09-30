import { afterFlow, type FlowInput } from './afterFlow';

const next = { id: 'c1s2', name: 'ホームポジション' };
const stage = (over: Partial<NonNullable<FlowInput['stage']>>): FlowInput => ({
  recordId: 'r1',
  stage: { id: 'c1s1', cleared: true, next, bossId: 'chapter1', ...over },
});
const labels = (f: ReturnType<typeof afterFlow>) => [f.primary.label, ...f.secondary.map((a) => a.label)];

describe('afterFlow: ステージ', () => {
  it('クリアして次があれば、主は「次のステージ」。副は「もう一度」「ステージ選択」。Esc はステージ選択', () => {
    const f = afterFlow(stage({}));
    expect(f.primary).toEqual({ label: '次のステージ: ホームポジション', to: '/stage/c1s2' });
    expect(f.secondary).toEqual([
      { label: 'もう一度このステージ', to: '/stage/c1s1' },
      { label: 'ステージ選択へ', to: '/stages' },
    ]);
    expect(f.escTo).toBe('/stages');
    expect(f.inGame).toBe(true);
  });

  it('クリアして章の最後なら、主は章のボス', () => {
    const f = afterFlow(stage({ next: null }));
    expect(f.primary).toEqual({ label: 'この章のボスに挑戦', to: '/boss/chapter1' });
    expect(labels(f)).toEqual(['この章のボスに挑戦', 'もう一度このステージ', 'ステージ選択へ']);
  });

  it('クリアして最後で、ボスも無ければ、主はステージ選択', () => {
    const f = afterFlow(stage({ next: null, bossId: null }));
    expect(labels(f)).toEqual(['ステージ選択へ', 'もう一度このステージ']);
  });

  it('クリアならずなら、主は「もう一度このステージ」（次へは進めない）', () => {
    const f = afterFlow(stage({ cleared: false }));
    expect(labels(f)).toEqual(['もう一度このステージ', 'ステージ選択へ']);
    expect(f.primary.to).toBe('/stage/c1s1');
  });
});

describe('afterFlow: ボス', () => {
  const boss = (won: boolean | null, nextStage: { id: string; name: string } | null): FlowInput => ({
    recordId: 'r2',
    boss: { id: 'chapter1', name: 'ヒソカ', won, nextStage },
  });
  const ch2 = { id: 'c2s1', name: '第2章の最初' };

  it('勝って次の章があれば、主は「次の章へ」', () => {
    const f = afterFlow(boss(true, ch2));
    expect(f.primary).toEqual({ label: '次の章へ: 第2章の最初', to: '/stage/c2s1' });
    expect(labels(f)).toEqual(['次の章へ: 第2章の最初', 'ヒソカにもう一度挑戦', 'ステージ選択へ']);
    expect(f.escTo).toBe('/stages');
  });

  it('勝って最後の章なら、主はステージ選択', () => {
    expect(labels(afterFlow(boss(true, null)))).toEqual(['ステージ選択へ', 'ヒソカにもう一度挑戦']);
  });

  it('負けたら、主は「もう一度挑戦」（次の章には進めない）', () => {
    const f = afterFlow(boss(false, ch2));
    expect(labels(f)).toEqual(['ヒソカにもう一度挑戦', 'ステージ選択へ']);
    expect(f.primary.to).toBe('/boss/chapter1');
  });

  it('勝敗が分からないとき（履歴から開き直した）は、先へ進めず、主はステージ選択', () => {
    expect(labels(afterFlow(boss(null, ch2)))).toEqual(['ステージ選択へ', 'ヒソカにもう一度挑戦']);
  });
});

describe('afterFlow: ふつうの練習', () => {
  it('主は「同じお題でもう一度」（記録の ID つき）。Esc はホーム。ステージの文脈ではない', () => {
    const f = afterFlow({ recordId: 'abc' });
    expect(f.primary).toEqual({ label: '同じお題でもう一度', to: '/play?retry=abc' });
    expect(labels(f)).toEqual(['同じお題でもう一度', '新しいお題で練習', 'ホーム']);
    expect(f.escTo).toBe('/');
    expect(f.inGame).toBe(false);
  });
});
