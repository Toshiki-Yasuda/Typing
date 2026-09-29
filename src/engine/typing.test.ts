import {
  acceptableKeys,
  getGuide,
  minKeystrokes,
  normalizeTarget,
  press,
  startTyping,
  undo,
  validateTarget,
  type Outcome,
  type TypingState,
} from './index';

/** keys を1打鍵ずつ打つ。誤打鍵は状態を変えないので、最後の状態と全結果を返す */
function run(text: string, keys: string) {
  let state = startTyping(text);
  const outcomes: Outcome[] = [];
  for (const key of keys) {
    const r = press(state, key);
    state = r.state;
    outcomes.push(r.outcome);
  }
  return { state, outcomes, last: outcomes[outcomes.length - 1] };
}

/** keys をすべて正しく打てて、最後に打ち終える */
const accepts = (text: string, keys: string) => {
  const { outcomes, state } = run(text, keys);
  return state.done && outcomes.every((o, i) => o === (i === outcomes.length - 1 ? 'done' : 'ok'));
};
/** keys の途中で誤打鍵になる、または打ち終えない */
const rejects = (text: string, keys: string) => !accepts(text, keys);

describe('基本', () => {
  it('複数の打ち方を受け付ける（し = si / shi / ci）', () => {
    for (const keys of ['si', 'shi', 'ci']) expect(accepts('し', keys), keys).toBe(true);
  });

  it('途中で経路が絞られる', () => {
    let s = startTyping('し');
    s = press(s, 's').state;
    expect(acceptableKeys(s).sort()).toEqual(['h', 'i']);
    s = press(s, 'h').state;
    expect(acceptableKeys(s)).toEqual(['i']);
  });

  it('誤打鍵は状態を変えず、miss を返す', () => {
    const s = startTyping('か');
    const r = press(s, 'x');
    expect(r.outcome).toBe('miss');
    expect(r.state).toBe(s);
  });

  it('打ち終わった後・1文字でないキーは ignored', () => {
    const done = run('か', 'ka').state;
    expect(press(done, 'k').outcome).toBe('ignored');
    expect(press(startTyping('か'), 'Shift').outcome).toBe('ignored');
    expect(press(startTyping('か'), 'Backspace').outcome).toBe('ignored');
  });

  it('大文字（Shift）でも受け付ける', () => {
    expect(accepts('か', 'KA')).toBe(true);
  });

  it('空のお題は最初から完了', () => {
    expect(startTyping('').done).toBe(true);
  });

  it('打ち終える最後の打鍵だけが done', () => {
    expect(run('かき', 'kak').outcomes).toEqual(['ok', 'ok', 'ok']);
    expect(run('かき', 'kaki').outcomes).toEqual(['ok', 'ok', 'ok', 'done']);
  });
});

describe('拗音・分割入力・外来音', () => {
  it.each(['sya', 'sha', 'silya', 'sixya', 'shilya', 'shixya', 'sixya'])('しゃ = %s', (keys) => {
    expect(accepts('しゃ', keys)).toBe(true);
  });

  it('ふぁ = fa / hwa / huxa / fuxa', () => {
    for (const keys of ['fa', 'hwa', 'huxa', 'fuxa']) expect(accepts('ふぁ', keys), keys).toBe(true);
  });

  it('てぃ = thi / t\'i / texi', () => {
    for (const keys of ['thi', "t'i", 'texi', 'teli']) expect(accepts('てぃ', keys), keys).toBe(true);
  });

  it('ゔ = vu', () => {
    expect(accepts('ゔ', 'vu')).toBe(true);
  });
});

describe('「ん」', () => {
  it('次が子音なら n 単独でよい', () => {
    for (const keys of ['kanji', 'kanzi', 'kannji', 'kannzi', "kan'ji", 'kaxnji']) {
      expect(accepts('かんじ', keys), keys).toBe(true);
    }
  });

  it('語末は n 単独では打ち終えない（nn / n\' / xn が必要）', () => {
    expect(run('かん', 'kan').state.done).toBe(false);
    for (const keys of ['kann', "kan'", 'kaxn']) expect(accepts('かん', keys), keys).toBe(true);
  });

  it('次が母音・な行・や行なら nn が必要', () => {
    expect(accepts('んあ', 'nna')).toBe(true);
    expect(rejects('んあ', 'na')).toBe(true);
    expect(accepts('こんにちは', 'konnnitiha')).toBe(true);
    expect(rejects('こんにちは', 'konnitiha')).toBe(true);
    expect(accepts('んや', 'nnya')).toBe(true);
    expect(rejects('んや', 'nya')).toBe(true);
  });

  it('次が n で始まる（んん）', () => {
    expect(accepts('んん', 'nnnn')).toBe(true);
    expect(rejects('んん', 'nnn')).toBe(true);
    expect(accepts('んん', 'nxn')).toBe(true);
  });

  it('n の直後に別の子音が来たら、その子音は次の文字の頭', () => {
    expect(accepts('んか', 'nka')).toBe(true);
    expect(accepts('んわ', 'nwa')).toBe(true);
  });

  it('n を打った直後、n 単独が使えない文脈では次の n が必要', () => {
    const s = run('んな', 'n').state;
    expect(acceptableKeys(s).sort()).toEqual(["'", 'n']); // nn か n' のみ（n 単独は「な」になる）
  });
});

describe('「っ」', () => {
  it('子音の重ね打ち・xtu 系', () => {
    for (const keys of ['sakka', 'saxtuka', 'saltuka', 'saxtsuka', 'saltsuka']) {
      expect(accepts('さっか', keys), keys).toBe(true);
    }
  });

  it('ち行の前: tchi / tti / cchi', () => {
    for (const keys of ['matchi', 'matti', 'macchi']) {
      expect(accepts('まっち', keys), keys).toBe(true);
    }
  });

  it('次が母音のときは重ね打ちできない', () => {
    expect(rejects('っあ', 'ka')).toBe(true);
    expect(run('っあ', 'k').last).toBe('miss');
    expect(accepts('っあ', 'xtua')).toBe(true);
  });

  it('語末は xtu 系のみ', () => {
    expect(run('あっ', 'ak').last).toBe('miss');
    expect(accepts('あっ', 'axtu')).toBe(true);
    expect(accepts('あっ', 'altsu')).toBe(true);
  });

  it('っ+ん は xtu 系のみ', () => {
    expect(accepts('っん', 'xtunn')).toBe(true);
    expect(rejects('っん', 'nn')).toBe(true);
  });

  it('っ+拗音（kkya）と、分割入力', () => {
    expect(accepts('っきゃ', 'kkya')).toBe(true);
    expect(accepts('っきゃ', 'xtukya')).toBe(true);
  });

  it('連続する っ', () => {
    expect(accepts('っっか', 'kkka')).toBe(true);
  });

  it('l・x の重ね打ちは不可', () => {
    expect(rejects('っあ', 'lla')).toBe(true);
    expect(rejects('っか', 'xxka')).toBe(true);
  });
});

describe('長音・記号・その他', () => {
  it('長音は - のみ', () => {
    expect(accepts('らーめん', 'ra-menn')).toBe(true);
    expect(rejects('らーめん', 'raamenn')).toBe(true);
  });

  it('「を」は wo のみ', () => {
    expect(accepts('を', 'wo')).toBe(true);
    expect(rejects('を', 'o')).toBe(true);
  });

  it('「ぢ」「づ」は di / du', () => {
    expect(accepts('ぢ', 'di')).toBe(true);
    expect(rejects('ぢ', 'zi')).toBe(true);
    expect(accepts('づ', 'du')).toBe(true);
  });

  it('句読点・括弧', () => {
    expect(accepts('「あ」、。・', '[a],.z/')).toBe(true);
    expect(accepts('「あ」、。・', '[a,.z/')).toBe(false); // ] が抜けている
    expect(accepts('〜', '~')).toBe(true);
  });

  it('英字・数字・記号はそのまま打つ（英字は大文字小文字を区別しない）', () => {
    expect(accepts('Type 12!', 'type 12!')).toBe(true);
    expect(accepts('Type 12!', 'TYPE 12!')).toBe(true);
    expect(rejects('Type 12!', 'type 12?')).toBe(true);
  });

  it('かなと英数の混在', () => {
    expect(accepts('たいぷ1', 'taipu1')).toBe(true);
  });
});

describe('undo', () => {
  it('1打鍵戻せる。誤打鍵は履歴に積まれない', () => {
    let s = startTyping('かき');
    s = press(s, 'k').state;
    s = press(s, 'a').state;
    s = press(s, 'x').state; // miss
    expect(s.typed).toBe('ka');
    s = undo(s);
    expect(s.typed).toBe('k');
    s = undo(s);
    expect(s.typed).toBe('');
    expect(undo(s)).toBe(s);
  });

  it('打ち終えた状態からも戻せる', () => {
    const done = run('か', 'ka').state;
    expect(undo(done).done).toBe(false);
    expect(undo(done).typed).toBe('k');
  });
});

describe('表示ガイド', () => {
  const guide = (text: string, keys = '') => getGuide(run(text, keys).state);

  it('最短経路を表示する（訓令式寄り）', () => {
    expect(guide('し').rest).toBe('si');
    expect(guide('つ').rest).toBe('tu');
    expect(guide('ふ').rest).toBe('hu');
    expect(guide('ちゃ').rest).toBe('tya');
    expect(guide('じゃ').rest).toBe('ja');
    expect(guide('かんじ').rest).toBe('kanzi');
    expect(guide('さっか').rest).toBe('sakka');
    expect(guide('まっち').rest).toBe('matti');
  });

  it('「ん」: 語末・母音前は nn、それ以外は n', () => {
    expect(guide('かん').rest).toBe('kann');
    expect(guide('こんにちは').rest).toBe('konnnitiha');
    expect(guide('かんじ').rest).toBe('kanzi');
  });

  it('打鍵に応じて残りが縮み、ユーザーが選んだ経路に切り替わる', () => {
    expect(guide('し', 's')).toMatchObject({ typed: 's', rest: 'i', remaining: 1 });
    expect(guide('し', 'sh')).toMatchObject({ typed: 'sh', rest: 'i' });
    expect(guide('ちゃ', 'c').rest).toBe('ha');
    expect(guide('ちゃ', 'cy').rest).toBe('a');
  });

  it('ガイド + 打鍵済み がお題を打ち切る打鍵列になる', () => {
    for (const text of ['かんじ', 'さっか', 'こんにちは', 'しゃ', 'あっ', 'ふぁいる']) {
      const g = guide(text, text.length > 2 ? 'ka'.slice(0, 0) : '');
      expect(accepts(text, g.typed + g.rest), text).toBe(true);
    }
  });

  it('kanaIndex はお題のどこまで確定したかを表す', () => {
    expect(guide('かき', '').kanaIndex).toBe(0);
    expect(guide('かき', 'ka').kanaIndex).toBe(1);
    expect(guide('かき', 'kak').kanaIndex).toBe(1);
    expect(guide('かき', 'kaki')).toMatchObject({ kanaIndex: 2, rest: '', remaining: 0 });
  });

  it('remaining は残りの最短打鍵数', () => {
    expect(guide('かんじ').remaining).toBe(5);
  });
});

describe('minKeystrokes / validateTarget / normalizeTarget', () => {
  it('最短打鍵数', () => {
    expect(minKeystrokes('かんじ')).toBe(5);
    expect(minKeystrokes('さっか')).toBe(5);
    expect(minKeystrokes('しゃ')).toBe(3);
    expect(minKeystrokes('')).toBe(Infinity);
  });

  it('打てない文字を検出する', () => {
    expect(validateTarget('かんじ abc')).toEqual({ ok: true });
    expect(validateTarget('漢字ヵ')).toEqual({ ok: false, unsupported: ['漢', '字', 'ヵ'] });
    expect(minKeystrokes('漢')).toBe(Infinity);
  });

  it('正規化: カタカナ→ひらがな、全角英数→半角', () => {
    expect(normalizeTarget('ラーメン　ＡＢＣ１２３！')).toBe('らーめん ABC123!');
    expect(normalizeTarget('ヴァイオリン')).toBe('ゔぁいおりん');
    expect(validateTarget(normalizeTarget('ヴァイオリン'))).toEqual({ ok: true });
  });
});

describe('状態の不変性', () => {
  it('press は元の状態を変更しない', () => {
    const s0: TypingState = startTyping('かき');
    const before = JSON.stringify(s0.cursors.map((c) => [c.edge.id, c.typed]));
    press(s0, 'k');
    expect(JSON.stringify(s0.cursors.map((c) => [c.edge.id, c.typed]))).toBe(before);
    expect(s0.typed).toBe('');
  });
});
