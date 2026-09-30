import type { Keystroke } from '@/metrics';

/** ボスの技の種類。仕様は docs/spec/boss.md。判定は変えず、表示と敗北条件にだけ作用する */
export const SKILL_KINDS = ['hide', 'strip', 'stamina'] as const;
export type SkillKind = (typeof SKILL_KINDS)[number];

/** hide: この数のお題に 1 つ、ローマ字ガイドの残りを隠す（0 始まりで、番号 % 3 === 2） */
export const HIDE_EVERY = 3;
/** stamina: 正しい打鍵がこの回数つづくごとに、ミスを 1 回ぶん回復する */
export const STAMINA_RECOVER_EVERY = 10;

/** hide: このお題（0 始まり）は、ローマ字ガイドの残りが隠れるか */
export const hideActive = (index: number): boolean => index % HIDE_EVERY === HIDE_EVERY - 1;

/** strip: 直前のお題でミスをしていたら、このお題は運指ガイドを出さない */
export function stripActive(keystrokes: readonly Keystroke[], index: number): boolean {
  return index > 0 && keystrokes.some((k) => k.item === index - 1 && !k.correct);
}

/** 技が戦闘のルールに足すもの */
export function skillRules(kind: SkillKind | undefined): { recoverEvery?: number } {
  return kind === 'stamina' ? { recoverEvery: STAMINA_RECOVER_EVERY } : {};
}
