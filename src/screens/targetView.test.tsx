import { render, screen, waitFor } from '@testing-library/react';
import { saveSettings, DEFAULT_SETTINGS } from '@/settings/settings';
import { UNLOCK_KEY } from '@/themes/unlock';
import type { PressFx } from './play/types';
import type { SessionView } from '@/session/practiceSession';
import { TargetView, sizeClasses } from './TargetView';

const view = (display: string, reading: string, typed: string, rest: string, kanaIndex = 0): SessionView => ({
  item: { display, reading },
  index: 0,
  total: 1,
  guide: { typed, rest, remaining: rest.length, kanaIndex },
  finished: false,
  next: null,
  upcoming: [],
});

const D = (v: string) => `text-[length:${v}]`;
const D1 = D('clamp(2.75rem,5.5vw,5rem)');
const D2 = D('clamp(2rem,4vw,3.5rem)');
const D3 = D('clamp(1.5rem,2.8vw,2.5rem)');
const R1 = D('clamp(1.5rem,3vw,2.5rem)');
const R2 = D('clamp(1.25rem,2.4vw,1.75rem)');
const R3 = D('clamp(1rem,1.9vw,1.25rem)');
const K1 = `${D('clamp(2.25rem,4.5vw,3.75rem)')} tracking-widest`;
const K2 = `${D('clamp(1.75rem,3.4vw,2.75rem)')} tracking-wide`;
const K3 = `${D('clamp(1.25rem,2.4vw,1.875rem)')} tracking-normal`;

describe('sizeClasses（長さに応じた大きさ）', () => {
  it('短い語は大きく、長い文は小さくなる', () => {
    expect(sizeClasses(3, 3, 8)).toEqual({ display: D1, reading: R1, romaji: K1 });
    expect(sizeClasses(20, 20, 40)).toEqual({ display: D2, reading: R2, romaji: K2 });
    expect(sizeClasses(30, 30, 70)).toEqual({ display: D3, reading: R3, romaji: K3 });
  });

  it('境界: 12 / 24 / 48 文字までは同じ大きさ、超えると 1 段階小さくなる', () => {
    expect(sizeClasses(12, 12, 24)).toEqual({ display: D1, reading: R1, romaji: K1 });
    expect(sizeClasses(13, 13, 25)).toEqual({ display: D2, reading: R2, romaji: K2 });
    expect(sizeClasses(24, 24, 48)).toEqual({ display: D2, reading: R2, romaji: K2 });
    expect(sizeClasses(25, 25, 49)).toEqual({ display: D3, reading: R3, romaji: K3 });
  });
});

describe('TargetView', () => {
  it('短い語は大きく表示する', () => {
    render(<TargetView view={view('猫', 'ねこ', 'n', 'eko')} missing={false} />);
    expect(screen.getByText('猫')).toHaveClass(D1);
  });

  it('長い文は小さく、折り返せる（はみ出さない）', () => {
    const display = '長い文'.repeat(10); // 30 文字
    render(<TargetView view={view(display, 'あ'.repeat(30), '', 'a'.repeat(60))} missing={false} />);
    expect(screen.getByText(display)).toHaveClass(D3, 'break-words');
    expect(screen.getByLabelText('ローマ字ガイド')).toHaveClass('break-all', K3);
  });

  it('中くらいの文（23 文字）は 1 段階だけ小さい', () => {
    const display = '新しいキーボードを買ったので、練習を始めます。';
    expect([...display]).toHaveLength(23);
    render(<TargetView view={view(display, 'あ'.repeat(29), '', 'a'.repeat(40))} missing={false} />);
    expect(screen.getByText(display)).toHaveClass(D2);
  });

  it('読みの確定部分を強調し、ガイドは 打鍵済み + 次のキー + 残り', () => {
    render(<TargetView view={view('猫', 'ねこ', 'ne', 'ko', 1)} missing={false} />);
    expect(screen.getByLabelText('ローマ字ガイド')).toHaveTextContent('neko');
    expect(screen.getByText('ね')).toHaveClass('text-success');
    expect(screen.getByText('こ')).toHaveClass('text-text-muted');
  });

  it('打ち終えたローマ字は暗くせず、次の1文字は強調クラスを持つ', () => {
    render(<TargetView view={view('猫', 'ねこ', 'n', 'eko')} missing={false} />);
    expect(screen.getByText('n').closest('.target-typed')).not.toBeNull();
    expect(screen.getByText('n').closest('.text-text-muted')).toBeNull();
    expect(screen.getByText('e')).toHaveClass('target-next');
  });

  it('誤打鍵の間は枠とラベルで示し（背景は染めない）、期待した1文字を強調。スペースは ␣ で示す', () => {
    render(<TargetView view={view('a b', 'a b', 'a', ' b', 1)} missing />);
    const card = screen.getByRole('region', { name: 'お題' });
    expect(card).toHaveClass('ring-danger');
    expect(card).not.toHaveClass('bg-danger/20');
    expect(screen.getByText('ミス')).toBeInTheDocument();
    expect(screen.getByText('␣')).toHaveClass('target-expected');
    expect(screen.getByLabelText('ローマ字ガイド')).toHaveTextContent('a␣b');
  });
});

describe('補助（凝・円）', () => {
  it('凝: 残りのガイドのうち、弱点のキーだけを強調する（表示だけ。文字は変わらない）', () => {
    render(<TargetView view={view('柿', 'かき', 'k', 'aki', 0)} missing={false} weakKeys={new Set(['k', 'i'])} />);
    const weak = [...document.querySelectorAll('[data-weak]')].map((e) => e.textContent);
    expect(weak).toEqual(['k', 'i']);
    expect(screen.getByLabelText('ローマ字ガイド')).toHaveTextContent('kaki');
  });

  it('凝: 強調するキーが無ければ、何も強調しない', () => {
    render(<TargetView view={view('柿', 'かき', '', 'kaki')} missing={false} weakKeys={new Set()} />);
    expect(document.querySelectorAll('[data-weak]')).toHaveLength(0);
  });

  it('円: 次のお題を見せる。オフ・最後のお題では出さない', () => {
    const v = { ...view('柿', 'かき', '', 'kaki'), next: { display: '栗', reading: 'くり' } };
    const { rerender } = render(<TargetView view={v} missing={false} preview />);
    expect(screen.getByText('次: 栗')).toBeInTheDocument();
    rerender(<TargetView view={v} missing={false} />);
    expect(screen.queryByText(/^次:/)).toBeNull();
    rerender(<TargetView view={{ ...v, next: null }} missing={false} preview />);
    expect(screen.queryByText(/^次:/)).toBeNull();
  });
});

describe('U3 打鍵の手応え', () => {
  const setEffects = (effects: 'full' | 'reduced' | 'off') => saveSettings({ ...DEFAULT_SETTINGS, effects });
  const ok = (seq: number): PressFx => ({ seq, result: 'ok', key: 'e', expected: null });
  const miss = (seq: number): PressFx => ({ seq, result: 'miss', key: '1', expected: 'e' });
  afterEach(() => localStorage.clear());

  it('正打: 直前に打った1文字だけが反応の対象（標準）。ミスの打鍵では付かない', () => {
    setEffects('full');
    const { rerender } = render(<TargetView view={view('猫', 'ねこ', 'ne', 'ko', 1)} missing={false} press={ok(1)} />);
    expect(screen.getByText('e')).toHaveClass('target-hit');
    expect(screen.getByText('n')).not.toHaveClass('target-hit');
    expect(screen.getByLabelText('ローマ字ガイド')).toHaveTextContent('neko');
    rerender(<TargetView view={view('猫', 'ねこ', 'ne', 'ko', 1)} missing press={miss(2)} />);
    expect(document.querySelector('.target-hit')).toBeNull();
  });

  it('正打の反応は、控えめでも付く（太さだけ。動きは data-effect が full のときだけ CSS で付く）。オフでは付かない', () => {
    setEffects('reduced');
    const { unmount } = render(<TargetView view={view('猫', 'ねこ', 'n', 'eko')} missing={false} press={ok(1)} />);
    expect(screen.getByRole('region', { name: 'お題' })).toHaveAttribute('data-effect', 'reduced');
    expect(screen.getByText('n')).toHaveClass('target-hit');
    unmount();
    setEffects('off');
    render(<TargetView view={view('猫', 'ねこ', 'n', 'eko')} missing={false} press={ok(1)} />);
    expect(screen.getByRole('region', { name: 'お題' })).toHaveAttribute('data-effect', 'off');
    expect(document.querySelector('.target-hit')).toBeNull();
  });

  it('語の切り替え: 標準では前の語が薄れる幽霊が出て、終わると消える。控えめ・オフでは出ない', async () => {
    setEffects('full');
    const a = view('猫', 'ねこ', 'neko', '');
    const b = { ...view('犬', 'いぬ', '', 'inu'), index: 1 };
    const { rerender, unmount } = render(<TargetView view={a} missing={false} />);
    expect(screen.queryByTestId('target-ghost')).toBeNull();
    rerender(<TargetView view={b} missing={false} />);
    const ghost = screen.getByTestId('target-ghost');
    expect(ghost).toHaveTextContent('猫');
    expect(ghost).toHaveAttribute('aria-hidden', 'true');
    await waitFor(() => expect(screen.queryByTestId('target-ghost')).toBeNull());
    unmount();
    for (const lv of ['reduced', 'off'] as const) {
      setEffects(lv);
      const r = render(<TargetView view={a} missing={false} />);
      r.rerender(<TargetView view={b} missing={false} />);
      expect(screen.queryByTestId('target-ghost')).toBeNull();
      r.unmount();
    }
  });

  it('ミスの揺れ: 標準のときだけ、ミスのたびに 2px・120ms で再生する', () => {
    const animate = vi.fn();
    Element.prototype.animate = animate;
    try {
      setEffects('full');
      const v = view('猫', 'ねこ', 'n', 'eko');
      const { rerender } = render(<TargetView view={v} missing={false} press={ok(1)} />);
      expect(animate).not.toHaveBeenCalled();
      rerender(<TargetView view={v} missing press={miss(2)} />);
      rerender(<TargetView view={v} missing press={miss(3)} />);
      expect(animate).toHaveBeenCalledTimes(2);
      expect(animate.mock.calls[0]![1]).toMatchObject({ duration: 120 });
      expect(JSON.stringify(animate.mock.calls[0]![0])).toContain('2px');
    } finally {
      Reflect.deleteProperty(Element.prototype, 'animate');
    }
  });

  it('ミスの揺れ: 控えめ・オフでは再生しない', () => {
    const animate = vi.fn();
    Element.prototype.animate = animate;
    try {
      for (const lv of ['reduced', 'off'] as const) {
        setEffects(lv);
        const r = render(<TargetView view={view('猫', 'ねこ', 'n', 'eko')} missing press={miss(2)} />);
        r.unmount();
      }
      expect(animate).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(Element.prototype, 'animate');
    }
  });

  it('テーマの手応え（feel）があるときは、Play 側が揺らすので TargetView は揺らさない', () => {
    const animate = vi.fn();
    Element.prototype.animate = animate;
    try {
      localStorage.setItem(UNLOCK_KEY, JSON.stringify(['hunter']));
      saveSettings({ ...DEFAULT_SETTINGS, effects: 'full', themeId: 'hunter' });
      render(<TargetView view={view('猫', 'ねこ', 'n', 'eko')} missing press={miss(2)} />);
      expect(animate).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(Element.prototype, 'animate');
    }
  });
});
