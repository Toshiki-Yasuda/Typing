import { buildStagePack } from './stageBuild';
import { validatePackContent } from './schema';

describe('buildStagePack', () => {
  it('打てる語だけを残し、読みを正規化し、重複・打てない語・長すぎる語・空を理由付きで除く', () => {
    const { pack, dropped } = buildStagePack('s1', '試験', [
      { display: 'ハンター', reading: 'はんたー' },
      { display: 'ゴン', reading: 'ごん' },
      { display: 'ゴン（別表記）', reading: 'ごん' }, // 読みが重複
      { display: '漢字', reading: '漢字' }, // 読みに漢字 → 打てない
      { display: 'x'.repeat(41), reading: 'x' }, // 表記が長すぎる
      { display: '空', reading: '  ' },
      { display: ' 余白 ', reading: ' よはく ' }, // 前後の空白は取る
    ]);
    expect(pack.items).toEqual([
      { display: 'ハンター', reading: 'はんたー' },
      { display: 'ゴン', reading: 'ごん' },
      { display: '余白', reading: 'よはく' },
    ]);
    expect(dropped.map((d) => d.reason)).toEqual([
      '読みが重複',
      expect.stringContaining('打てない文字'),
      expect.stringContaining('長すぎる'),
      '空',
    ]);
    expect(pack).toMatchObject({ id: 's1', name: '試験' });
  });

  it('できたパックは、アプリの検証（全語が打てる・正規化済み・重複なし）を通る', () => {
    const { pack } = buildStagePack('s2', 't', [
      { display: 'カタカナ', reading: 'カタカナ' }, // カタカナの読みは正規化されてひらがなになる
      { display: 'a', reading: 'a' },
    ]);
    expect(validatePackContent(pack)).toEqual([]);
    expect(pack.items[0]?.reading).toBe('かたかな');
  });

  it('全部除かれても落ちない（空のパック。呼び出し側で扱う）', () => {
    expect(buildStagePack('s', 'n', [{ display: '漢', reading: '漢' }]).pack.items).toEqual([]);
  });
});
