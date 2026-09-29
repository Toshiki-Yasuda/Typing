import { z } from 'zod';
import { normalizeTarget, validateTarget } from '@/engine';

export const ContentItemSchema = z.object({
  /** 画面に見せる表記（漢字かな混じり等） */
  display: z.string().min(1).max(40),
  /** 実際に打つ読み（ひらがな・英数記号）。正規化済みであること */
  reading: z.string().min(1).max(40),
});

export const ContentPackSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  items: z.array(ContentItemSchema).min(1),
});

export type ContentItem = z.infer<typeof ContentItemSchema>;
export type ContentPack = z.infer<typeof ContentPackSchema>;

/** スキーマを通ったパックの、打てるかどうか等の内容検証。問題点の一覧を返す（空なら問題なし） */
export function validatePackContent(pack: ContentPack): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  pack.items.forEach((item, i) => {
    const label = `#${i} ${item.display}`;
    if (normalizeTarget(item.reading) !== item.reading) problems.push(`${label}: 読みが未正規化です（${item.reading}）`);
    const v = validateTarget(item.reading);
    if (!v.ok) problems.push(`${label}: 打てない文字があります（${v.unsupported.join('')}）`);
    if (seen.has(item.reading)) problems.push(`${label}: 読みが重複しています（${item.reading}）`);
    seen.add(item.reading);
  });
  return problems;
}

/** JSON を検証して読み込む。不正なら Error */
export function loadPack(json: unknown): ContentPack {
  const pack = ContentPackSchema.parse(json);
  const problems = validatePackContent(pack);
  if (problems.length > 0) throw new Error(`出題データが不正です:\n${problems.join('\n')}`);
  return pack;
}
