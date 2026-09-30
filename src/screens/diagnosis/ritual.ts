import type { WaterReaction } from '@/effects/waterScene';
import type { AxisId } from '@/metrics/axes';

/** 得意な軸 → 水見式のグラスに起こる反応（見た目）。六系統の対応は docs/spec/axes.md */
export const REACTION_OF_AXIS: Record<AxisId, WaterReaction> = {
  speed: 'level', // 強化系: 水があふれる
  adapt: 'taste', // 変化系: 水の味が変わる
  reach: 'color', // 放出系: 水の色が変わる
  shape: 'impurity', // 具現化系: 不純物が出る
  control: 'leaf-move', // 操作系: 葉が動く
  steady: 'leaf-wither', // 特質系: 葉が枯れる（その他の変化）
};
