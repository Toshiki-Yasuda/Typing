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
        const ime = simulateIme(MOZC_ROWS, typed);
        expect({ text, typed, ...ime }).toEqual({ text, typed, output: text, pending: '' });
      }),
      { numRuns: 1500 },
    );
  });
});

describe('完全性: IME が変換できる打鍵列はエンジンも受理する', () => {
  it('許容行をランダムに連結した打鍵列', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...allowedInputs), { minLength: 1, maxLength: 5 }), (inputs) => {
        const keys = inputs.join('');
        const { output, pending } = simulateIme(MOZC_ROWS, keys);
        // 未確定が残る（語末の n や っ の重ね打ち）／仕様で出題しない文字になる場合は対象外
        fc.pre(pending === '');
        // Mozc 表の出力は かな・記号のみ。ASCII が混ざるのは、表に一致せず素通りした残骸（有効な入力ではない）
        fc.pre(!/[\x20-\x7e]/.test(output));
        fc.pre(validateTarget(output).ok);
        expect(typeAll(output, keys), `${keys} → ${output}`).toBe(true);
      }),
      { numRuns: 3000 },
    );
  });
});

describe('最適性: 最短打鍵数は総当りの最短と一致する', () => {
  /** 許容行を連結して text を作る最短の打鍵列の長さ（総当り・反復深化） */
  function bruteForceMin(text: string, maxKeys: number): number {
    const search = (keys: string, limit: number): boolean => {
      const { output, pending } = simulateIme(MOZC_ROWS, keys);
      if (!text.startsWith(output)) return false;
      if (output === text && pending === '') return true;
      if (keys.length >= limit) return false;
      return allowedInputs.some((input) => keys.length + input.length <= limit && search(keys + input, limit));
    };
    for (let limit = 1; limit <= maxKeys; limit++) if (search('', limit)) return limit;
    return Infinity;
  }

  it('短いお題（1〜2単位）', () => {
    fc.assert(
      fc.property(textArb(2), (text) => {
        const expected = bruteForceMin(text, 7);
        fc.pre(expected !== Infinity); // 7打鍵以内で打てるものだけ比較する
        expect(minKeystrokes(text), text).toBe(expected);
      }),
      { numRuns: 150 },
    );
  }, 60_000);
});
