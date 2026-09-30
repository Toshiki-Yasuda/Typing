/**
 * ボスの攻撃予告（docs/spec/boss.md）。予告の語が出てからの制限時間内に打ち終えれば回避、
 * 間に合わなければミス扱い（戦闘のミスとして 1 回。打鍵ログは変えない）。
 * 時計を持たない純関数。経過時間は呼び出し側が渡す。
 */
export interface AttackRule {
  /** この語数ごとに 1 語が予告になる（0 始まりで、番号 % everyWords === everyWords - 1） */
  readonly everyWords: number;
  /** 予告の語が出てから、打ち終えるまでの猶予（ミリ秒） */
  readonly windowMs: number;
}

/** このお題（0 始まり）は攻撃予告の語か */
export const attackActive = (rule: AttackRule, index: number): boolean =>
  index >= 0 && index % rule.everyWords === rule.everyWords - 1;

/** 予告の残り時間（ミリ秒）。予告の語でなければ null。sinceWordMs は、その語が出てからの経過 */
export function attackRemaining(rule: AttackRule, index: number, sinceWordMs: number): number | null {
  if (!attackActive(rule, index)) return null;
  return Math.max(0, rule.windowMs - Math.max(0, sinceWordMs));
}

/** 猶予が尽きたか（予告の語で、経過が猶予以上） */
export const attackLanded = (rule: AttackRule, index: number, sinceWordMs: number): boolean =>
  attackActive(rule, index) && sinceWordMs >= rule.windowMs;
