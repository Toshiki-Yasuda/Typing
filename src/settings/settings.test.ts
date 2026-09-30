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
    const custom = { packId: 'english', count: 20, adaptive: false, goalRank: 'k3', fingerGuide: false, layout: 'us' as const, themeId: 'hunter', sound: false, bgm: false, bgmVolume: 30, sfxVolume: 50, gameBgm: 'all' as const, aidGyo: true, aidEn: true, vows: ['silent' as const], bossSkills: false, effects: 'off' as const };
    saveSettings(custom, storage);
    expect(JSON.parse(storage.value as string)).toEqual(custom);
    expect(loadSettings(storage)).toEqual(custom);
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

  it('既定: 目標は自動、運指ガイドは表示、配列は JIS', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ goalRank: 'auto', fingerGuide: true, layout: 'jis' });
  });

  it('新しい項目が無い古い保存値でも、既存の項目は残り、新しい項目は既定値になる', () => {
    const old = JSON.stringify({ packId: 'english', count: 20, adaptive: false });
    expect(loadSettings(memory(old))).toEqual({ ...DEFAULT_SETTINGS, packId: 'english', count: 20, adaptive: false });
  });

  it('配列は us / jis 以外を受け付けない', () => {
    expect(loadSettings(memory(JSON.stringify({ layout: 'dvorak' }))).layout).toBe('jis');
    expect(loadSettings(memory(JSON.stringify({ layout: 'us' }))).layout).toBe('us');
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
