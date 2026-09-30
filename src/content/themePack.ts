import { useEffect, useState } from 'react';
import { loadPack, type ContentPack } from './schema';

const cache = new Map<string, Promise<ContentPack>>();

/** テーマの語彙パック（JSON）を読み込んで検証する。同じパスは 1 度だけ取得する。不正・取得失敗は例外 */
export function loadThemePack(path: string, fetcher: typeof fetch = fetch): Promise<ContentPack> {
  let p = cache.get(path);
  if (!p) {
    p = fetcher(new URL(path, document.baseURI))
      .then((res) => {
        if (!res.ok) throw new Error(`語彙を読み込めません（${res.status}）: ${path}`);
        return res.json() as Promise<unknown>;
      })
      .then(loadPack);
    // 失敗はキャッシュしない（次の機会にやり直せる）
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

export type ThemePackState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; pack: ContentPack }
  | { status: 'error'; message: string };

/** テーマの語彙パックを読み込むフック。path が無ければ 'none' */
export function useThemePack(path: string | undefined): ThemePackState {
  const [state, setState] = useState<{ path: string; result: ThemePackState } | null>(null);
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    loadThemePack(path).then(
      (pack) => !cancelled && setState({ path, result: { status: 'ready', pack } }),
      (e: unknown) => !cancelled && setState({ path, result: { status: 'error', message: String(e) } }),
    );
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!path) return { status: 'none' };
  return state?.path === path ? state.result : { status: 'loading' };
}

/** テスト用: 取得済みの語彙を忘れる */
export function clearThemePackCache(): void {
  cache.clear();
}
