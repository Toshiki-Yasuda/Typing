import type { Keystroke, SessionRecord } from '@/metrics';
import { isStageCleared, STAGE_CLEAR_ACCURACY, stageMode, stageProgress } from './stageProgress';

/** 正打 correct 回・ミス misses 回の記録 */
function record(mode: string, correct: number, misses: number): SessionRecord {
  const keystrokes: Keystroke[] = [];
  let t = 0;
  for (let i = 0; i < correct + misses; i++) {
    t += 100;
    const ok = i < correct;
    keystrokes.push({ t, key: ok ? 'a' : '1', code: '', expected: 'a', correct: ok, item: 0 });
  }
  return { id: `${mode}-${correct}-${misses}`, startedAt: 0, mode, contentId: 'x', targets: ['a'], engineVersion: '1', ruleVersion: '1', keystrokes };
}

describe('stageProgress', () => {
  it('そのステージの記録だけを数え、最高の正確率で判定する', () => {
    const records = [
      record(stageMode('c1s1'), 8, 2), // 80%
      record(stageMode('c1s1'), 19, 1), // 95%
      record(stageMode('c1s2'), 10, 0), // 別ステージ
      record('practice', 10, 0), // 通常の練習は数えない
    ];
    expect(stageProgress(records, 'c1s1')).toEqual({ attempts: 2, bestAccuracy: 0.95, cleared: true });
    expect(stageProgress(records, 'c1s2')).toEqual({ attempts: 1, bestAccuracy: 1, cleared: true });
    expect(stageProgress(records, 'c1s3')).toEqual({ attempts: 0, bestAccuracy: null, cleared: false });
  });

  it('基準ちょうど（90%）でクリア。すぐ下は未クリア', () => {
    expect(STAGE_CLEAR_ACCURACY).toBe(0.9);
    expect(isStageCleared(0.9)).toBe(true);
    expect(isStageCleared(0.8999)).toBe(false);
    expect(stageProgress([record(stageMode('s'), 9, 1)], 's').cleared).toBe(true);
    expect(stageProgress([record(stageMode('s'), 17, 3)], 's')).toMatchObject({ bestAccuracy: 0.85, cleared: false });
  });

  it('似た名前のステージと混ざらない（c1s1 と c1s10）', () => {
    expect(stageProgress([record(stageMode('c1s10'), 10, 0)], 'c1s1').attempts).toBe(0);
  });
});
