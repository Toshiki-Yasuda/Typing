import { ROMAJI_TABLE } from '@/engine';
import { createPlan, NO_CONSTRAINT } from '@/engine/plan';

/** お題の最短経路に現れるキー（重複あり）。弱点との突き合わせに使う */
export function keysOfTarget(reading: string): string[] {
  const plan = createPlan(reading, ROMAJI_TABLE);
  const keys: string[] = [];
  let pos = 0;
  let constraint = NO_CONSTRAINT;
  while (pos < plan.length) {
    const { edge } = plan.shortest(pos, constraint);
    if (!edge) return [];
    keys.push(...edge.keys.toLowerCase());
    pos = edge.to;
    constraint = edge.next;
  }
  return keys;
}

export interface AdaptiveOptions {
  /** 重みの下限。弱点がまったく無いお題も、この確率で選ばれる（単調な練習を避ける） */
  floor?: number;
  random?: () => number;
}

/**
 * 弱いキーを多く含むお題ほど選ばれやすいように、重み付きで重複なく n 個選ぶ。
 * weakness に無いキーの弱さは 0 として扱う。
 */
export function pickAdaptive<T extends { reading: string }>(
  items: readonly T[],
  n: number,
  weakness: ReadonlyMap<string, number>,
  { floor = 0.2, random = Math.random }: AdaptiveOptions = {},
): T[] {
  const weights = items.map((item) => {
    const keys = keysOfTarget(item.reading);
    if (keys.length === 0) return floor;
    const mean = keys.reduce((s, k) => s + (weakness.get(k) ?? 0), 0) / keys.length;
    return floor + mean;
  });

  const pool = items.map((item, i) => ({ item, weight: weights[i] as number }));
  const picked: T[] = [];
  while (picked.length < n && pool.length > 0) {
    const total = pool.reduce((s, p) => s + p.weight, 0);
    let r = random() * total;
    let index = pool.findIndex((p) => (r -= p.weight) < 0);
    if (index === -1) index = pool.length - 1;
    picked.push((pool.splice(index, 1)[0] as { item: T }).item);
  }
  return picked;
}
