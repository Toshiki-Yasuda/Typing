import { render, screen } from '@testing-library/react';
import { arrowOf, LAYOUTS, moveFrom } from '@/fingering';
import { SETTINGS_KEY } from '@/settings/settings';
import { FingerGuide } from './FingerGuide';
import type { PressFx } from './play/types';

const press = (p: Partial<PressFx>): PressFx => ({ seq: 1, result: 'ok', key: 'j', expected: null, ...p });
const keyOf = (c: HTMLElement, text: string) => [...c.querySelectorAll('.fg-key')].find((d) => d.firstChild?.textContent === text) as HTMLElement;

describe('FingerGuide: 指の色とラベル', () => {
  beforeEach(() => localStorage.clear());

  it('既定（色分けあり）では、キーに指の頭文字が付く（F=左の人差し指→「人」、A=左の小指→「小」）', () => {
    const { container } = render(<FingerGuide next="j" layout="us" />);
    expect(keyOf(container, 'F').dataset.f).toBe('人');
    expect(keyOf(container, 'A').dataset.f).toBe('小');
    expect(keyOf(container, 'S').dataset.f).toBe('薬');
    expect(keyOf(container, 'D').dataset.f).toBe('中');
  });

  it('色分けを切ると、ラベルも色も付かない', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ fingerColors: false }));
    const { container } = render(<FingerGuide next="j" layout="us" />);
    expect(container.querySelector('[data-f]')).toBeNull();
  });

  it('ラベルはテキストではない（キーの文字は変わらない）', () => {
    const { container } = render(<FingerGuide next="j" layout="us" />);
    expect(keyOf(container, 'J').textContent).toBe('J');
  });

  it('注記は aria-describedby で結ばれる（アクセシブルな名前は変わらない）', () => {
    render(<FingerGuide next="j" layout="jis" />);
    const region = screen.getByRole('region', { name: '運指ガイド' });
    const id = region.getAttribute('aria-describedby')!;
    expect(document.getElementById(id)?.textContent).toContain('JIS配列の表示です');
  });
});

describe('FingerGuide: 直前の打鍵', () => {
  beforeEach(() => localStorage.clear());
  const marks = (c: HTMLElement) => [...c.querySelectorAll('.fg-mark')].map((m) => [m.className.replace('fg-mark ', ''), m.parentElement?.firstChild?.textContent]);

  it('正打は、押したキーに光（ok）', () => {
    const { container } = render(<FingerGuide next="k" layout="us" press={press({ key: 'j' })} />);
    expect(marks(container)).toEqual([['fg-mark-ok', 'J']]);
  });

  it('ミスは、押した実キーに×、正しいキーに枠', () => {
    const { container } = render(<FingerGuide next="k" layout="us" press={press({ result: 'miss', key: 'l', expected: 'k' })} />);
    expect(marks(container)).toEqual([
      ['fg-mark-expected', 'K'],
      ['fg-mark-wrong', 'L'],
    ]);
  });

  it('演出「オフ」では正打の光は出ないが、ミスの×は出る（情報は残す）', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ effects: 'off' }));
    const a = render(<FingerGuide next="k" layout="us" press={press({ key: 'j' })} />);
    expect(marks(a.container)).toEqual([]);
    a.unmount();
    const b = render(<FingerGuide next="k" layout="us" press={press({ result: 'miss', key: 'l', expected: 'k' })} />);
    expect(marks(b.container)).toHaveLength(2);
  });

  it('打鍵が無ければ何も出ない。配列に無いキーでも落ちない', () => {
    const a = render(<FingerGuide next="k" layout="us" />);
    expect(marks(a.container)).toEqual([]);
    a.unmount();
    const b = render(<FingerGuide next="k" layout="us" press={press({ result: 'miss', key: 'あ', expected: 'k' })} />);
    expect(marks(b.container)).toEqual([['fg-mark-expected', 'K']]);
  });

  it('押したキーと正しいキーが同じ位置（Shift 違い）なら、×は出さず枠だけ', () => {
    const { container } = render(<FingerGuide next="J" layout="us" press={press({ result: 'miss', key: 'j', expected: 'J' })} />);
    expect(marks(container)).toEqual([['fg-mark-expected', 'J']]);
  });
});

describe('moveFrom（ホームからの向き）', () => {
  const us = LAYOUTS.us;
  const arrow = (finger: Parameters<typeof moveFrom>[1], key: string) => {
    const m = moveFrom(us, finger, key);
    return m ? arrowOf(m) : null;
  };
  it('ホームのキーは動かない', () => {
    expect(arrow('L-index', 'f')).toBeNull();
    expect(arrow('R-pinky', ';')).toBeNull();
  });
  it('真上・真下', () => {
    expect(arrow('L-middle', 'e')).toBe('↑');
    expect(arrow('L-index', 'v')).toBe('↓');
    expect(arrow('L-index', 'r')).toBe('↑');
  });
  it('横に伸ばすキー', () => {
    expect(arrow('L-index', 'g')).toBe('→');
    expect(arrow('R-index', 'h')).toBe('←');
    expect(arrow('R-index', 'y')).toBe('↖');
    expect(arrow('L-index', 'b')).toBe('↘');
  });
});
