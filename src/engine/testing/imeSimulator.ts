import type { MozcRow } from '../table';

/**
 * テスト用の簡易 IME シミュレータ（Mozc 表のみに基づく独立実装）。
 * エンジンの判定ロジックには依存しない。エンジンの正しさを検証する「オラクル」として使う。
 *
 * 規則: 打鍵をバッファに溜め、
 *  1. バッファを先頭とする、より長い入力が表にあれば待つ
 *  2. バッファ全体が表の入力なら変換する（3列目があれば、それをバッファに戻す）
 *  3. どちらでもなければ、バッファの最長一致の接頭辞を変換して残りを続ける（一致なしなら1文字をそのまま出力）
 */
export interface ImeResult {
  readonly output: string;
  /** 未確定のバッファ（語末の n など） */
  readonly pending: string;
  /** 変換に使った表の行（入力）。仕様で除外した行を使った結果かどうかの判定に使う */
  readonly used: readonly string[];
}

interface Index {
  readonly byInput: ReadonlyMap<string, MozcRow>;
  /** より長い入力の接頭辞になっている文字列（この状態のバッファは待つ） */
  readonly waiting: ReadonlySet<string>;
}

const indexCache = new WeakMap<readonly MozcRow[], Index>();

function indexOf(rows: readonly MozcRow[]): Index {
  let index = indexCache.get(rows);
  if (!index) {
    const byInput = new Map<string, MozcRow>();
    for (const row of rows) if (!byInput.has(row.input)) byInput.set(row.input, row);
    const waiting = new Set<string>();
    for (const input of byInput.keys()) for (let n = 1; n < input.length; n++) waiting.add(input.slice(0, n));
    index = { byInput, waiting };
    indexCache.set(rows, index);
  }
  return index;
}

export function simulateIme(rows: readonly MozcRow[], keys: string): ImeResult {
  const { byInput, waiting } = indexOf(rows);
  const hasLonger = (buf: string) => waiting.has(buf);

  let output = '';
  let buf = '';
  const used: string[] = [];
  const apply = (row: MozcRow, consumed: number) => {
    used.push(row.input);
    output += row.output;
    buf = (row.next ?? '') + buf.slice(consumed);
  };

  for (const key of keys) {
    buf += key;
    while (buf !== '') {
      if (hasLonger(buf)) break;
      const exact = byInput.get(buf);
      if (exact) {
        apply(exact, buf.length);
        continue;
      }
      let matched: MozcRow | undefined;
      for (let len = buf.length - 1; len >= 1 && !matched; len--) matched = byInput.get(buf.slice(0, len));
      if (matched) apply(matched, matched.input.length);
      else {
        output += buf.charAt(0);
        buf = buf.slice(1);
      }
    }
  }
  return { output, pending: buf, used };
}
