import { ROMAJI_TABLE, type RomajiTable } from './table';

/**
 * お題（読み）から、打鍵の「辺」のグラフを作る。
 * 辺 = 「お題の from〜to 文字を、keys を打って入力する」1通りの打ち方。
 * 打ち方の分岐（し=si/shi/ci、しゃ=しゃ1単位/し+ゃ 等）はすべて辺の違いとして表す。
 * 「ん」「っ」のように次の文字に依存する規則は、辺の `next` 制約で表す（仕様: docs/spec/input-rules.md §2・§3）。
 */

export type EdgeKind = 'unit' | 'hatsuon' | 'sokuon' | 'literal';

/** 直後に選べる辺の制約 */
export type NextConstraint =
  | { readonly type: 'none' }
  /** 「ん」を n 単独で打った直後: 次の打鍵が母音・n・y であってはならない */
  | { readonly type: 'notVowelNY' }
  /** 「っ」を重ね打ちした直後: 次の辺の打鍵列が prefix で始まらなければならない */
  | { readonly type: 'prefix'; readonly prefix: string };

export interface Edge {
  readonly id: number;
  readonly from: number;
  readonly to: number;
  readonly keys: string;
  readonly kind: EdgeKind;
  /** この辺でお題の末尾に達してよいか（語末の「ん」の n 単独、「っ」の重ね打ちは不可） */
  readonly endOk: boolean;
  readonly next: NextConstraint;
}

export interface Shortest {
  readonly cost: number;
  readonly edge: Edge | null;
}

export interface Plan {
  readonly text: string;
  /** お題の文字数（コードポイント単位） */
  readonly length: number;
  /** pos から、制約を満たし、かつ最後まで打ち切れる辺（推奨順） */
  options(pos: number, constraint: NextConstraint): readonly Edge[];
  /** pos から最後までの最短打鍵数と、その最初の辺 */
  shortest(pos: number, constraint: NextConstraint): Shortest;
}

export const NO_CONSTRAINT: NextConstraint = { type: 'none' };
/** 「ん」を n 単独で打った直後に来てはいけない打鍵（n+母音=な行等、n+n=ん）。y は allows() で個別に扱う */
export const HATSUON_SINGLE_FORBIDDEN_NEXT = 'aiueon';

/**
 * 直前の辺が課す制約を、次の辺が満たすか。
 * 「ん」を n 単独で打った直後は、IME が n を次の入力と結び付けて別の文字にしてしまう打鍵を避ける:
 *  - 母音（な行）・n（nn = ん）で始まる辺
 *  - y で始まる辺（nya 等 = にゃ行）。ただし「っ」の重ね打ち（yy）は可: `nyy` は表に無いので、n は「ん」に確定する
 */
function allows(constraint: NextConstraint, edge: Edge): boolean {
  const keys = edge.keys.toLowerCase();
  switch (constraint.type) {
    case 'none':
      return true;
    case 'notVowelNY': {
      const first = keys.charAt(0);
      if (first === 'y') return edge.kind === 'sokuon';
      return !HATSUON_SINGLE_FORBIDDEN_NEXT.includes(first);
    }
    case 'prefix':
      return keys.startsWith(constraint.prefix);
  }
}

function constraintKey(c: NextConstraint): string {
  return c.type === 'prefix' ? `prefix:${c.prefix}` : c.type;
}

const isPrintableAscii = (ch: string) => ch.length === 1 && ch >= ' ' && ch <= '~';

function buildEdges(chars: readonly string[], table: RomajiTable): Edge[][] {
  const edgesFrom: Edge[][] = chars.map(() => []);
  let id = 0;
  const add = (
    from: number,
    to: number,
    keys: string,
    kind: EdgeKind,
    endOk = true,
    next: NextConstraint = NO_CONSTRAINT,
  ) => {
    edgesFrom[from]?.push({ id: id++, from, to, keys, kind, endOk, next });
  };

  chars.forEach((ch, pos) => {
    if (ch === 'ん') {
      // 推奨順: n 単独（条件付き）→ nn 等
      add(pos, pos + 1, table.hatsuon.single, 'hatsuon', false, { type: 'notVowelNY' });
      for (const keys of table.hatsuon.always) add(pos, pos + 1, keys, 'hatsuon');
    } else if (ch === 'っ') {
      for (const keys of table.sokuon.direct) add(pos, pos + 1, keys, 'sokuon');
      for (const d of table.sokuon.doubling) {
        add(pos, pos + 1, d.typed, 'sokuon', false, { type: 'prefix', prefix: d.nextPrefix });
      }
    }
    // 複合単位（しゃ）を先に、単独（し）は後。同じ打鍵数なら複合を優先する
    for (const len of [2, 1]) {
      if (pos + len > chars.length) continue;
      const unit = chars.slice(pos, pos + len).join('');
      for (const keys of table.units.get(unit) ?? []) add(pos, pos + len, keys, 'unit');
    }
    if (isPrintableAscii(ch)) add(pos, pos + 1, ch, 'literal');
  });
  return edgesFrom;
}

export function createPlan(text: string, table: RomajiTable = ROMAJI_TABLE): Plan {
  const chars = Array.from(text);
  const length = chars.length;
  const edgesFrom = buildEdges(chars, table);
  const optionsMemo = new Map<string, readonly Edge[]>();
  const shortestMemo = new Map<string, Shortest>();

  const viable = (e: Edge): boolean =>
    e.to === length ? e.endOk : Number.isFinite(plan.shortest(e.to, e.next).cost);

  const plan: Plan = {
    text,
    length,
    options(pos, constraint) {
      const key = `${pos}|${constraintKey(constraint)}`;
      let result = optionsMemo.get(key);
      if (!result) {
        result = (edgesFrom[pos] ?? []).filter((e) => allows(constraint, e) && viable(e));
        optionsMemo.set(key, result);
      }
      return result;
    },
    shortest(pos, constraint) {
      const key = `${pos}|${constraintKey(constraint)}`;
      let result = shortestMemo.get(key);
      if (!result) {
        let best: Shortest = { cost: Infinity, edge: null };
        for (const e of plan.options(pos, constraint)) {
          const cost = e.keys.length + (e.to === length ? 0 : plan.shortest(e.to, e.next).cost);
          if (cost < best.cost) best = { cost, edge: e };
        }
        result = best;
        shortestMemo.set(key, result);
      }
      return result;
    },
  };
  return plan;
}
