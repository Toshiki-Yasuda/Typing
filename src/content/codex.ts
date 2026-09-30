import { useEffect, useState } from 'react';
import { z } from 'zod';
import { normalizeTarget, validateTarget } from '@/engine';

/** 図鑑の区分（テーマの語彙のうち、見出しにする語の種類） */
export const CODEX_CATEGORIES = ['character', 'ability', 'item', 'location', 'organization'] as const;
export type CodexCategory = (typeof CODEX_CATEGORIES)[number];

export const CodexEntrySchema = z.object({
  display: z.string().min(1),
  reading: z.string().min(1),
  category: z.enum(CODEX_CATEGORIES),
  chapter: z.number().int().min(1),
});
export type CodexEntry = z.infer<typeof CodexEntrySchema>;

export const CodexSchema = z.object({ entries: z.array(CodexEntrySchema).min(1) });

/** 図鑑のデータを検証する。全語が打てる・（表記, 読み）の重複が無い。違反は例外（どこが不正かを示す） */
export function loadCodex(data: unknown): CodexEntry[] {
  const parsed = CodexSchema.safeParse(data);
  if (!parsed.success) throw new Error(`図鑑のデータが不正です: ${parsed.error.issues[0]?.message ?? ''}`);
  const seen = new Set<string>();
  return parsed.data.entries.map((e) => {
    const reading = normalizeTarget(e.reading.trim());
    const v = validateTarget(reading);
    if (!v.ok) throw new Error(`図鑑「${e.display}」に打てない文字があります: ${v.unsupported.join('')}`);
    const key = `${e.display}\t${reading}`;
    if (seen.has(key)) throw new Error(`図鑑「${e.display}」が重複しています`);
    seen.add(key);
    return { ...e, display: e.display.trim(), reading };
  });
}

const cache = new Map<string, Promise<CodexEntry[]>>();

export function loadCodexFile(path: string, fetcher: typeof fetch = fetch): Promise<CodexEntry[]> {
  let p = cache.get(path);
  if (!p) {
    p = fetcher(new URL(path, document.baseURI))
      .then((res) => {
        if (!res.ok) throw new Error(`図鑑を読み込めません（${res.status}）`);
        return res.json() as Promise<unknown>;
      })
      .then(loadCodex);
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

export type CodexState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; entries: CodexEntry[] }
  | { status: 'error'; message: string };

export function useCodex(path: string | undefined): CodexState {
  const [state, setState] = useState<{ path: string; result: CodexState } | null>(null);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    loadCodexFile(path).then(
      (entries) => !cancelled && setState({ path, result: { status: 'ready', entries } }),
      (e: unknown) => !cancelled && setState({ path, result: { status: 'error', message: String(e) } }),
    );
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!path) return { status: 'none' };
  return state?.path === path ? state.result : { status: 'loading' };
}

/** テスト用: 取得済みの図鑑を忘れる */
export function clearCodexCache(): void {
  cache.clear();
}
