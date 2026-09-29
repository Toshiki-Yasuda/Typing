import fc from 'fast-check';
import {
  acceptableKeys,
  minKeystrokes,
  press,
  startTyping,
  validateTarget,
  ROMAJI_TABLE,
} from './index';
import { simulateIme } from './testing/imeSimulator';
import { EXCLUDED_ROWS, MOZC_ROWS } from './table';

/**
 * エンジンを、独立実装の IME シミュレータ（Mozc 表）と突き合わせる。
 * - 健全性: エンジンが受理する打鍵列は、IME でも同じかな列になる
 * - 完全性: IME が同じかな列に変換する打鍵列は、エンジンも受理する（仕様上の除外を除く）
 * - 最適性: 最短打鍵数が、総当りの最短と一致する
 */

/** 通常は数千回。FC_RUNS で増やして、まれな反例を探せる（例: FC_RUNS=200000 npx vitest run src/engine/property.test.ts） */
const RUNS = Number(process.env.FC_RUNS ?? 3000);
const TIMEOUT = 600_000; // 試行数を増やしたときのため。通常の回数なら 1 秒未満

const excluded = new Set(EXCLUDED_ROWS.map((e) => e.input));
const allowedInputs = MOZC_ROWS.filter((r) => !excluded.has(r.input)).map((r) => r.input);

const tokens = ['ん', 'っ', ...ROMAJI_TABLE.units.keys()];
const textArb = (max: number) =>
  fc.array(fc.constantFrom(...tokens), { minLength: 1, maxLength: max }).map((t) => t.join(''));

function typeAll(text: string, keys: string): boolean {
  let state = startTyping(text);
  for (const key of keys) {
    const r = press(state, key);
    if (r.outcome === 'miss' || r.outcome === 'ignored') return false;
    state = r.state;
  }
  return state.done;
}

describe('健全性: エンジンが受理する打鍵列は IME でも同じかなになる', () => {
  it('ランダムなお題を、ランダムな経路で打ち切る', () => {
    fc.assert(
      fc.property(textArb(6), fc.array(fc.nat(), { minLength: 80, maxLength: 80 }), (text, choices) => {
        let state = startTyping(text);
        let typed = '';
        for (const choice of choices) {
          if (state.done) break;
          const keys = acceptableKeys(state);
          expect(keys.length, `${text} / ${typed}`).toBeGreaterThan(0); // 行き止まりが無い
          const key = keys[choice % keys.length] as string;
          const r = press(state, key);
          expect(r.outcome).not.toBe('miss');
          state = r.state;
          typed += key;
        }
        expect(state.done, `${text} を ${typed} で打ち切れない`).toBe(true);
        const { output, pending } = simulateIme(MOZC_ROWS, typed);
        expect({ text, typed, output, pending }).toEqual({ text, typed, output: text, pending: '' });
      }),
      { numRuns: RUNS / 2 },
    );
  }, TIMEOUT);
});

describe('完全性: IME が変換できる打鍵列はエンジンも受理する', () => {
  it('許容行をランダムに連結した打鍵列', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...allowedInputs), { minLength: 1, maxLength: 5 }), (inputs) => {
        const keys = inputs.join('');
        const { output, pending, used } = simulateIme(MOZC_ROWS, keys);
        // 未確定が残る（語末の n や っ の重ね打ち）／仕様で出題しない文字になる場合は対象外
        fc.pre(pending === '');
        // IME が、仕様で意図的に除外した行（例: z- → 〜）を使って解釈した打鍵列は、エンジンが受理しないのが正しい
        fc.pre(used.every((input) => !excluded.has(input)));
        // Mozc 表の出力は かな・記号のみ。ASCII が混ざるのは、表に一致せず素通りした残骸（有効な入力ではない）
        fc.pre(!/[\x20-\x7e]/.test(output));
        fc.pre(validateTarget(output).ok);
        expect(typeAll(output, keys), `${keys} → ${output}`).toBe(true);
      }),
      { numRuns: RUNS },
    );
  }, TIMEOUT);
});

describe('仕様で除外した行の扱い（過去の反例を固定）', () => {
  it('zz- は IME では「っ〜」（z- → 〜）だが、z- は除外した行なので、エンジンは受理しない', () => {
    const { output, used } = simulateIme(MOZC_ROWS, 'zz-');
    expect(output).toBe('っ〜');
    expect(used).toContain('z-');
    expect(typeAll('っ〜', 'zz-')).toBe(false);
    expect(typeAll('っ〜', 'xtu~')).toBe(true); // 「〜」は ~ で打つ
  });
});

describe('最適性: 最短打鍵数は総当りの最短と一致する', () => {
  /**
   * text を打てる最短の打鍵数（総当り・反復深化）。
   * 行の入力を連結すると、っ の重ね打ち（hh + hyi = hhyi の h の共有）で打鍵数を数え違えるため、1打鍵ずつ伸ばす。
   * 仕様で除外した行を使う解釈は対象外。
   */
  const alphabet = [...new Set(allowedInputs.join(''))];
  function bruteForceMin(text: string, maxKeys: number): number {
    const search = (keys: string, limit: number): boolean => {
      const { output, pending, used } = simulateIme(MOZC_ROWS, keys);
      if (!text.startsWith(output) || used.some((input) => excluded.has(input))) return false;
      if (output === text && pending === '') return true;
      if (keys.length >= limit) return false;
      return alphabet.some((key) => search(keys + key, limit));
    };
    for (let limit = 1; limit <= maxKeys; limit++) if (search('', limit)) return limit;
    return Infinity;
  }

  it('っ の重ね打ちで h を共有する経路（っひぃ = hhyi の4打鍵）を数え違えない（過去の反例を固定）', () => {
    expect(bruteForceMin('っひぃ', 7)).toBe(4);
    expect(minKeystrokes('っひぃ')).toBe(4);
  });

  it('短いお題（1〜2単位）', () => {
    fc.assert(
      fc.property(textArb(2), (text) => {
        const expected = bruteForceMin(text, 7);
        fc.pre(expected !== Infinity); // 7打鍵以内で打てるものだけ比較する
        expect(minKeystrokes(text), text).toBe(expected);
      }),
      { numRuns: RUNS / 20 }, // 通常 150 回。総当りは重いので少なめ
    );
  }, TIMEOUT);
});
