import { BASIC_PACK, ENGLISH_PACK, SYMBOLS_PACK, type ContentItem, type ContentPack } from '@/content';
import { dayKey } from '@/metrics';

/** デイリーチャレンジのお題の数（設定に関係なく固定。全員が同じ条件で挑む） */
export const DAILY_COUNT = 10;

/**
 * 日替わりで使うパック。かな中心にして、たまに英単語・記号が来る。
 * 並びや構成を変えると、過去の日のお題が変わってしまう（記録のお題は保存済みなので、記録自体は壊れない）。
 */
export const DAILY_PACKS: readonly ContentPack[] = [BASIC_PACK, BASIC_PACK, ENGLISH_PACK, SYMBOLS_PACK];

/** 文字列 → 32bit ハッシュ（FNV-1a） */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 種から決定的な疑似乱数列（0 以上 1 未満）を作る（mulberry32） */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DailyChallenge {
  /** 日付キー（YYYY-MM-DD） */
  readonly day: string;
  readonly pack: ContentPack;
  readonly items: readonly ContentItem[];
}

/** 指定した日のお題。同じ日付なら、いつ・誰が呼んでも同じ結果になる（Math.random を使わない） */
export function dailyChallenge(day: string, count: number = DAILY_COUNT): DailyChallenge {
  const random = seededRandom(hashString(`typing-daily:${day}`));
  const pack = DAILY_PACKS[Math.floor(random() * DAILY_PACKS.length)] as ContentPack;
  const pool = [...pack.items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j] as ContentItem, pool[i] as ContentItem];
  }
  return { day, pack, items: pool.slice(0, count) };
}

/** 今日（実行環境のタイムゾーン）のお題 */
export function todaysChallenge(now: number): DailyChallenge {
  return dailyChallenge(dayKey(now));
}
