import type { CSSProperties } from 'react';
import { chapterAccentProblems, type Chapter, type Theme } from './theme';
import { themeColors } from './themes';

/**
 * 章のアクセント色を、その画面の範囲だけに効かせるスタイル（CSS 変数 --color-accent の上書き）。
 * 色が無い・読めない（コントラスト不足）ときは undefined で、テーマのアクセントのまま。
 */
export function chapterAccentStyle(theme: Theme, chapter: Chapter | undefined): CSSProperties | undefined {
  const accent = chapter?.accent;
  if (!accent) return undefined;
  if (chapterAccentProblems(accent, themeColors(theme)).length > 0) return undefined;
  return { '--color-accent': accent } as CSSProperties;
}

/** ボスの id から、その章を探す */
export const chapterOfBoss = (theme: Theme, bossId: string): Chapter | undefined => theme.chapters?.find((c) => c.boss === bossId);

/** ステージの id から、その章を探す */
export const chapterOfStage = (theme: Theme, stageId: string): Chapter | undefined =>
  theme.chapters?.find((c) => c.stages.some((s) => s.id === stageId));
