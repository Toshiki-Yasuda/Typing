import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, saveSettings } from './settings';

const memory = (initial?: string) => {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_: string, v: string) => {
      value = v;
    },
    get value() {
      return value;
    },
  };
};

describe('設定の読み書き', () => {
  it('保存が無ければ既定値', () => {
    expect(loadSettings(memory())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('保存して読み戻せる', () => {
    const storage = memory();
    saveSettings({ packId: 'english', count: 20, adaptive: false }, storage);
    expect(JSON.parse(storage.value as string)).toEqual({ packId: 'english', count: 20, adaptive: false });
    expect(loadSettings(storage)).toEqual({ packId: 'english', count: 20, adaptive: false });
  });

  it('一部だけ・型違いの項目は、読めた項目だけ採用し、残りは既定値', () => {
    expect(loadSettings(memory(JSON.stringify({ packId: 'symbols' })))).toEqual({ ...DEFAULT_SETTINGS, packId: 'symbols' });
    expect(loadSettings(memory(JSON.stringify({ packId: 5, count: 20, adaptive: 'yes' })))).toEqual({
      ...DEFAULT_SETTINGS,
      count: 20,
    });
    expect(loadSettings(memory(JSON.stringify({ count: 0 })))).toEqual(DEFAULT_SETTINGS); // 範囲外
    expect(loadSettings(memory(JSON.stringify({ count: 1.5 })))).toEqual(DEFAULT_SETTINGS);
  });

  it('壊れた JSON・オブジェクトでない値は既定値', () => {
    for (const raw of ['{', 'null', '[]', '"x"', '5']) expect(loadSettings(memory(raw)), raw).toEqual(DEFAULT_SETTINGS);
  });

  it('localStorage が例外を投げても落ちない（プライベートモード等）', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS, broken)).not.toThrow();
  });

  it('保存キーは版つき', () => {
    expect(SETTINGS_KEY).toBe('typing.settings.v1');
  });
});
