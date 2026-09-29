import { isGameKey, type KeyEventLike } from './keyFilter';

const ev = (over: Partial<KeyEventLike> = {}): KeyEventLike => ({
  key: 'a',
  repeat: false,
  isComposing: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...over,
});

describe('isGameKey', () => {
  it('通常の1文字は打鍵', () => {
    expect(isGameKey(ev())).toBe(true);
    expect(isGameKey(ev({ key: 'A' }))).toBe(true); // Shift 併用は許可
    expect(isGameKey(ev({ key: '!' }))).toBe(true);
    expect(isGameKey(ev({ key: ' ' }))).toBe(true);
  });

  it('自動連打・IME変換中は除外（isComposing / keyCode 229 のどちらでも）', () => {
    expect(isGameKey(ev({ repeat: true }))).toBe(false);
    expect(isGameKey(ev({ isComposing: true }))).toBe(false);
    expect(isGameKey(ev({ keyCode: 229 }))).toBe(false);
    expect(isGameKey(ev({ key: 'Process', keyCode: 229 }))).toBe(false);
  });

  it('Ctrl / Alt / Meta 併用は除外', () => {
    for (const mod of ['ctrlKey', 'altKey', 'metaKey'] as const) expect(isGameKey(ev({ [mod]: true })), mod).toBe(false);
  });

  it('1文字でないキーは除外', () => {
    for (const key of ['Shift', 'Enter', 'Backspace', 'Tab', 'Escape', 'Unidentified']) {
      expect(isGameKey(ev({ key })), key).toBe(false);
    }
  });
});
