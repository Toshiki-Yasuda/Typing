import type { MozcRow } from './parse';
import { EXCLUDED_ROWS, PREFERRED_KEYS, type Exclusion } from './rules';

/** 促音の重ね打ち。`typed` を打ち、次の単位が `nextPrefix` で始まるときに「っ」になる */
export interface SokuonDoubling {
  readonly typed: string;
  readonly nextPrefix: string;
}

export interface RomajiTable {
  /** 出力（かな・記号）→ 打鍵列（表示ガイドの優先順） */
  readonly units: ReadonlyMap<string, readonly string[]>;
  /** 「ん」。`always` は常に確定できる打鍵列、`single` は条件付きで確定できる打鍵 */
  readonly hatsuon: { readonly always: readonly string[]; readonly single: string };
  /** 「っ」。`direct` は単独で打つ小書き、`doubling` は次の単位に依存する重ね打ち */
  readonly sokuon: {
    readonly direct: readonly string[];
    readonly doubling: readonly SokuonDoubling[];
  };
}

/** Mozc の行を、許容表のどの部分に入れるかで分類した結果 */
export interface Classification {
  readonly units: readonly MozcRow[];
  readonly hatsuon: readonly MozcRow[];
  readonly sokuonDirect: readonly MozcRow[];
  readonly sokuonDoubling: readonly MozcRow[];
  readonly excluded: readonly MozcRow[];
}

export function classifyRows(
  rows: readonly MozcRow[],
  exclusions: readonly Exclusion[] = EXCLUDED_ROWS,
): Classification {
  const excludedInputs = new Set(exclusions.map((e) => e.input));
  const result = {
    units: [] as MozcRow[],
    hatsuon: [] as MozcRow[],
    sokuonDirect: [] as MozcRow[],
    sokuonDoubling: [] as MozcRow[],
    excluded: [] as MozcRow[],
  };
  for (const row of rows) {
    if (excludedInputs.has(row.input)) result.excluded.push(row);
    else if (row.output === 'ん') result.hatsuon.push(row);
    else if (row.output === 'っ' && row.next !== undefined) result.sokuonDoubling.push(row);
    else if (row.output === 'っ') result.sokuonDirect.push(row);
    else result.units.push(row);
  }
  return result;
}

function preferenceIndex(keys: string): number {
  const i = PREFERRED_KEYS.indexOf(keys);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/** 短いものを優先。同数なら優先リスト、それも無ければ元ファイルの順 */
function byPreference(a: MozcRow, b: MozcRow): number {
  return (
    a.input.length - b.input.length ||
    preferenceIndex(a.input) - preferenceIndex(b.input) ||
    a.line - b.line
  );
}

export function buildRomajiTable(
  rows: readonly MozcRow[],
  exclusions: readonly Exclusion[] = EXCLUDED_ROWS,
): RomajiTable {
  const c = classifyRows(rows, exclusions);

  const units = new Map<string, string[]>();
  for (const row of [...c.units].sort(byPreference)) {
    const keys = units.get(row.output);
    if (!keys) units.set(row.output, [row.input]);
    else if (!keys.includes(row.input)) keys.push(row.input); // Mozc 表には同一行の重複がある
  }

  const hatsuonSorted = [...c.hatsuon].sort(byPreference).map((r) => r.input);
  const single = 'n';
  if (!hatsuonSorted.includes(single)) throw new Error('Mozc 表に「ん」の n が見つかりません');

  return {
    units,
    hatsuon: { always: hatsuonSorted.filter((k) => k !== single), single },
    sokuon: {
      direct: [...c.sokuonDirect].sort(byPreference).map((r) => r.input),
      doubling: c.sokuonDoubling.map((r) => {
        const next = r.next as string; // 分類で next の存在を確認済み
        return { typed: r.input.slice(0, r.input.length - next.length), nextPrefix: next };
      }),
    },
  };
}
