import { NO_CONSTRAINT, createPlan, type Edge, type Plan } from './plan';
import { ROMAJI_TABLE } from './table';

/** 入力中の1つの候補（どの辺を、何打鍵目まで打ったか） */
export interface Cursor {
  readonly edge: Edge;
  readonly typed: number;
}

/**
 * 入力状態（不変）。打鍵のたびに新しい状態を返す。
 * 候補の集合（NFA）を持つので、「し」を s まで打った時点では si / shi / ci … の全経路が生きている。
 */
export interface TypingState {
  readonly plan: Plan;
  readonly cursors: readonly Cursor[];
  /** 受理した打鍵（正規化済み・小文字）の列 */
  readonly typed: string;
  readonly done: boolean;
  /** 1打鍵前の状態（undo 用） */
  readonly previous: TypingState | null;
}

/**
 * - ok: 受理
 * - done: 受理して、お題を打ち終えた
 * - miss: どの候補にも合わない誤打鍵。状態は変わらない
 * - ignored: 対象外（終了後の打鍵、Shift 等の1文字でないキー）。ミスに数えない
 */
export type Outcome = 'ok' | 'done' | 'miss' | 'ignored';

export interface PressResult {
  readonly state: TypingState;
  readonly outcome: Outcome;
}

export interface Guide {
  /** 受理済みの打鍵 */
  readonly typed: string;
  /** 残りの最短打鍵列（表示ガイド） */
  readonly rest: string;
  /** 残りの最短打鍵数 */
  readonly remaining: number;
  /** お題の何文字目まで確定したか（ガイド経路が現在打っている辺の開始位置） */
  readonly kanaIndex: number;
}

const isLetter = (ch: string) => /^[a-z]$/i.test(ch);

function keyMatches(expected: string, key: string): boolean {
  return expected === key || (isLetter(expected) && expected.toLowerCase() === key.toLowerCase());
}

export function startTyping(target: string | Plan): TypingState {
  const plan = typeof target === 'string' ? createPlan(target) : target;
  return {
    plan,
    cursors: plan.options(0, NO_CONSTRAINT).map((edge) => ({ edge, typed: 0 })),
    typed: '',
    done: plan.length === 0,
    previous: null,
  };
}

export function press(state: TypingState, key: string): PressResult {
  if (state.done || key.length !== 1) return { state, outcome: 'ignored' };

  const { plan } = state;
  const next: Cursor[] = [];
  const seen = new Set<string>();
  const push = (cursor: Cursor) => {
    const id = `${cursor.edge.id}:${cursor.typed}`;
    if (seen.has(id)) return;
    seen.add(id);
    next.push(cursor);
  };

  let canonical: string | null = null;
  let finished = false;
  for (const cursor of state.cursors) {
    const expected = cursor.edge.keys.charAt(cursor.typed);
    if (!keyMatches(expected, key)) continue;
    canonical ??= expected.toLowerCase();
    const typed = cursor.typed + 1;
    if (typed < cursor.edge.keys.length) {
      push({ edge: cursor.edge, typed });
    } else if (cursor.edge.to === plan.length) {
      finished = true;
    } else {
      for (const edge of plan.options(cursor.edge.to, cursor.edge.next)) push({ edge, typed: 0 });
    }
  }

  if (canonical === null) return { state, outcome: 'miss' };
  return {
    state: {
      plan,
      cursors: finished ? [] : next,
      typed: state.typed + canonical,
      done: finished,
      previous: state,
    },
    outcome: finished ? 'done' : 'ok',
  };
}

/** 1打鍵戻す。戻れなければそのまま */
export function undo(state: TypingState): TypingState {
  return state.previous ?? state;
}

/** 次に受理できるキーの一覧 */
export function acceptableKeys(state: TypingState): string[] {
  const keys = new Set<string>();
  for (const c of state.cursors) keys.add(c.edge.keys.charAt(c.typed));
  return [...keys];
}

function remainingOf(plan: Plan, cursor: Cursor): number {
  const { edge, typed } = cursor;
  const tail = edge.to === plan.length ? 0 : plan.shortest(edge.to, edge.next).cost;
  return edge.keys.length - typed + tail;
}

export function getGuide(state: TypingState): Guide {
  const { plan } = state;
  if (state.done) return { typed: state.typed, rest: '', remaining: 0, kanaIndex: plan.length };

  let best: Cursor | null = null;
  let bestCost = Infinity;
  for (const c of state.cursors) {
    const cost = remainingOf(plan, c);
    if (cost < bestCost) {
      best = c;
      bestCost = cost;
    }
  }
  if (!best) return { typed: state.typed, rest: '', remaining: 0, kanaIndex: 0 };

  let rest = best.edge.keys.slice(best.typed);
  let edge: Edge | null = best.edge;
  while (edge && edge.to < plan.length) {
    edge = plan.shortest(edge.to, edge.next).edge;
    if (edge) rest += edge.keys;
  }
  return { typed: state.typed, rest, remaining: bestCost, kanaIndex: best.edge.from };
}

/** お題を最短で打ち切るのに必要な打鍵数。打てない文字を含むと Infinity */
export function minKeystrokes(text: string): number {
  return createPlan(text).shortest(0, NO_CONSTRAINT).cost;
}

export type Validation =
  | { readonly ok: true }
  | { readonly ok: false; readonly unsupported: readonly string[] };

const SUPPORTED = new Set<string>(['ん', 'っ']);
for (const unit of ROMAJI_TABLE.units.keys()) for (const ch of unit) SUPPORTED.add(ch);

/** お題が打てるか検証する（コンテンツ検証用）。正規化済みの文字列を渡すこと */
export function validateTarget(text: string): Validation {
  const unsupported = new Set<string>();
  for (const ch of text) {
    const isAscii = ch >= ' ' && ch <= '~';
    if (!isAscii && !SUPPORTED.has(ch)) unsupported.add(ch);
  }
  return unsupported.size === 0 ? { ok: true } : { ok: false, unsupported: [...unsupported] };
}
