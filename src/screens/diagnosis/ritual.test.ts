import { AXIS_IDS } from '@/metrics/axes';
import { HUNTER_THEME } from '@/themes/themes';
import { REACTION_OF_AXIS } from './ritual';

describe('水見式の反応の対応', () => {
  it('6 つの軸が、互いに違う 6 つの反応になる（見た目で系統を見分けられる）', () => {
    const reactions = AXIS_IDS.map((id) => REACTION_OF_AXIS[id]);
    expect(new Set(reactions).size).toBe(6);
  });

  it('原作の水見式の対応: 強化＝水位／変化＝味／放出＝色／具現化＝不純物／操作＝葉が動く／特質＝枯れる', () => {
    expect(REACTION_OF_AXIS).toEqual({
      speed: 'level',
      adapt: 'taste',
      reach: 'color',
      shape: 'impurity',
      control: 'leaf-move',
      steady: 'leaf-wither',
    });
    const ritual = HUNTER_THEME.diagnosis?.axes;
    expect(ritual?.speed.ritual).toContain('あふれる');
    expect(ritual?.reach.ritual).toContain('色');
    expect(ritual?.control.ritual).toContain('葉');
    expect(ritual?.steady.ritual).toContain('枯れる');
  });
});
