import { parsePackJson } from './import';

const json = (obj: unknown) => JSON.stringify(obj);
const valid = { id: 'mine', name: '自作', items: [{ display: '猫', reading: 'ねこ' }] };

describe('parsePackJson（自作パックの取り込み）', () => {
  it('正しいパックは受け入れる', () => {
    const r = parsePackJson(json(valid));
    expect(r).toEqual({ ok: true, pack: valid });
  });

  it('JSON でなければ拒否する', () => {
    expect(parsePackJson('{')).toEqual({ ok: false, problems: ['JSON として読み込めません'] });
  });

  it('スキーマ違反は、どこが不正かを示す', () => {
    const r = parsePackJson(json({ id: 'Bad Id', name: '', items: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problems.join('\n')).toMatch(/id/);
      expect(r.problems.join('\n')).toMatch(/name/);
      expect(r.problems.join('\n')).toMatch(/items/);
    }
  });

  it('打てない語・未正規化・重複は、全件を一覧で返す（最初の1件で止めない）', () => {
    const r = parsePackJson(
      json({
        id: 'bad',
        name: 'bad',
        items: [
          { display: 'a', reading: '漢字' },
          { display: 'b', reading: 'カタカナ' },
          { display: 'c', reading: 'ねこ' },
          { display: 'd', reading: 'ねこ' },
        ],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problems.length).toBeGreaterThanOrEqual(4);
      expect(r.problems.join('\n')).toMatch(/#0/);
      expect(r.problems.join('\n')).toMatch(/#1/);
      expect(r.problems.join('\n')).toMatch(/#3.*重複/);
    }
  });

  it('組み込みパックと同じ id は拒否する（組み込みを上書きさせない）', () => {
    for (const id of ['basic', 'english', 'symbols', 'phrases']) {
      const r = parsePackJson(json({ ...valid, id }));
      expect(r.ok, id).toBe(false);
      if (!r.ok) expect(r.problems[0]).toMatch(/組み込み/);
    }
  });

  it('JSON のトップが配列などでも例外にならない', () => {
    expect(parsePackJson('[]').ok).toBe(false);
    expect(parsePackJson('null').ok).toBe(false);
  });
});
