import { ZodError } from 'zod';
import { BUILTIN_PACKS, type ContentPack } from './index';
import { ContentPackSchema, validatePackContent } from './schema';

export type ImportResult =
  | { readonly ok: true; readonly pack: ContentPack }
  | { readonly ok: false; readonly problems: readonly string[] };

const formatZodIssues = (error: ZodError): string[] =>
  error.issues.map((i) => `${i.path.length ? i.path.join('.') : '全体'}: ${i.message}`);

/**
 * 自作パック（JSON テキスト）を検証する。問題は行ごとに全て返す（最初の1件で止めない）。
 * 組み込みパックと同じ id は不可（上書きできてしまうと、組み込みを壊せるため）。
 */
export function parsePackJson(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, problems: ['JSON として読み込めません'] };
  }
  const parsed = ContentPackSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, problems: formatZodIssues(parsed.error) };

  const problems = validatePackContent(parsed.data);
  if (BUILTIN_PACKS.some((p) => p.id === parsed.data.id)) {
    problems.unshift(`id「${parsed.data.id}」は組み込みのパックと同じです。別の id にしてください`);
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, pack: parsed.data };
}
