import type { TrainFlavor } from '@/themes/theme';
import type { Theme } from '@/themes/theme';
import type { TrainKind } from '@/session/training';

/** 標準の言葉。テーマが train を持てば、その呼び名を使う */
const STANDARD: TrainFlavor = {
  names: { zetsu: '静寂', ren: '速さ', hatsu: '弱点' },
  aids: { gyo: '弱点強調', en: '先読み' },
};

export function trainLabels(theme: Theme): TrainFlavor {
  return theme.train ?? STANDARD;
}

export interface KindInfo {
  readonly kind: TrainKind;
  /** 何をする練習か（型の名前に依らない説明） */
  readonly summary: string;
  /** 結果で見る指標 */
  readonly measure: string;
}

export const KIND_INFO: readonly KindInfo[] = [
  { kind: 'zetsu', summary: '音・演出・運指ガイドを消して、ミスなく打ちます。', measure: 'ミスの数（S:0 / A:1〜2 / B:3〜5 / C:6〜）' },
  { kind: 'ren', summary: '60 秒のあいだに、どれだけ打てるか。', measure: '打ち切った語数と速度' },
  { kind: 'hatsu', summary: '苦手なキーを多く含む語だけで練習します。', measure: '技の名前とミス' },
];
