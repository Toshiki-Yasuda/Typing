/**
 * お題（読み）の正規化。エンジンは正規化済みの文字列だけを扱う。
 * - カタカナ → ひらがな（「ー」は保持）
 * - 全角英数記号 → 半角、全角空白 → 半角空白
 */
export function normalizeTarget(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) as number;
    if (code >= 0x30a1 && code <= 0x30f4) out += String.fromCodePoint(code - 0x60);
    else if (code >= 0xff01 && code <= 0xff5e) out += String.fromCodePoint(code - 0xfee0);
    else if (code === 0x3000) out += ' ';
    else out += ch;
  }
  return out;
}
