/**
 * テーマの解除（パスワード）。
 * これは公開サイト上のクライアント判定で、ソースを読めば突破できる「目隠し」。セキュリティ機能ではない。
 * 平文はソースに置かず、SHA-256 のハッシュと比べる。
 */
export const UNLOCK_KEY = 'typing.themes.unlocked.v1';

/** テーマ id → パスワード（小文字）の SHA-256（16進） */
export const THEME_PASSWORD_HASHES: Readonly<Record<string, string>> = {
  hunter: 'bb0db3ff9cca761dd697b6bd74fcafe19e05bf5edc6116c830a1e48628581c70',
};

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** パスワードが合っているか。大文字小文字・前後の空白は区別しない */
export async function checkPassword(themeId: string, input: string): Promise<boolean> {
  const expected = THEME_PASSWORD_HASHES[themeId];
  if (!expected) return false;
  return (await sha256Hex(input.trim().toLowerCase())) === expected;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function storageOrNull(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadUnlocked(storage: Store | null = storageOrNull()): Set<string> {
  try {
    const data: unknown = JSON.parse(storage?.getItem(UNLOCK_KEY) ?? '[]');
    return new Set(Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveUnlocked(ids: ReadonlySet<string>, storage: Store | null = storageOrNull()): void {
  try {
    storage?.setItem(UNLOCK_KEY, JSON.stringify([...ids]));
  } catch {
    // 保存できなくても、今回は使える
  }
}
