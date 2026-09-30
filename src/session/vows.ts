import type { SessionRecord } from '@/metrics';

/** 縛りの id（正規の並び）。仕様は docs/spec/vows.md */
export const VOW_IDS = ['noRomaji', 'noFinger', 'noMiss', 'silent'] as const;
export type VowId = (typeof VOW_IDS)[number];

/** 保存値・記録の値から、正しい縛りだけを、重複なく正規の順で取り出す */
export function parseVows(value: unknown): VowId[] {
  if (!Array.isArray(value)) return [];
  return VOW_IDS.filter((id) => value.includes(id));
}

export interface VowEffects {
  readonly showRomaji: boolean;
  readonly fingerGuide: boolean;
  readonly sound: boolean;
  /** 許されるミスの数の上限。null なら縛りによる上限なし */
  readonly maxMisses: number | null;
}

/** 縛りが表示・終わり方に及ぼす作用。判定・計測には触れない */
export function vowEffects(vows: readonly string[]): VowEffects {
  const has = (id: VowId) => vows.includes(id);
  return {
    showRomaji: !has('noRomaji'),
    fingerGuide: !has('noFinger'),
    sound: !has('silent'),
    maxMisses: has('noMiss') ? 0 : null,
  };
}

export type Medal = 'none' | 'bronze' | 'silver' | 'gold';

/** 縛りの数 → メダル */
export function medalOf(count: number): Medal {
  if (count >= 3) return 'gold';
  if (count === 2) return 'silver';
  if (count === 1) return 'bronze';
  return 'none';
}

export const MEDAL_LABEL: Record<Medal, string> = { none: 'なし', bronze: '銅', silver: '銀', gold: '金' };

export const MEDAL_RANK: Record<Medal, number> = { none: 0, bronze: 1, silver: 2, gold: 3 };

/** 戦績のメダル表示用（勝利したときの最大の縛りの数 → 文字）。無ければ空 */
export function medalText(bestVows: number | undefined): string {
  const m = medalOf(bestVows ?? 0);
  return m === 'none' ? '' : `メダル ${MEDAL_LABEL[m]}`;
}

export const hasVows = (r: SessionRecord): boolean => (r.vows?.length ?? 0) > 0;

/** 縛りの無い記録だけ。級位・統計・診断・推奨・弱点・ゴーストは、これを通した記録で求める */
export function plainRecords(records: readonly SessionRecord[]): SessionRecord[] {
  return records.filter((r) => !hasVows(r));
}

/** 「ミスなし」の縛りが破れたか（その記録にミスがある） */
export function vowBroken(r: SessionRecord): boolean {
  return !!r.vows?.includes('noMiss') && r.keystrokes.some((k) => !k.correct);
}
