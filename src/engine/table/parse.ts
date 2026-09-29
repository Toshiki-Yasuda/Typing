/** Mozc ローマ字表（TSV: 入力 / 出力 / 次の入力）の1行 */
export interface MozcRow {
  /** 打鍵列 */
  readonly input: string;
  /** 変換結果（かな・記号） */
  readonly output: string;
  /** 変換後に先頭へ戻す打鍵（促音の重ね打ちなど）。無ければ undefined */
  readonly next: string | undefined;
  /** 元ファイルの行番号（1始まり） */
  readonly line: number;
}

export function parseMozcTable(text: string): MozcRow[] {
  const rows: MozcRow[] = [];
  text.split('\n').forEach((raw, index) => {
    const line = raw.replace(/\r$/, '');
    if (line.trim() === '' || line.startsWith('#')) return;
    const [input, output, next] = line.split('\t');
    if (!input || !output) {
      throw new Error(`Mozc表 ${index + 1} 行目が不正です: ${JSON.stringify(line)}`);
    }
    rows.push({ input, output, next: next || undefined, line: index + 1 });
  });
  return rows;
}
