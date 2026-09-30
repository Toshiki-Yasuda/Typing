import { render, screen } from '@testing-library/react';
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
    expect(screen.getByText('n')).toHaveClass('target-typed');
    expect(screen.getByText('n')).not.toHaveClass('text-text-muted');
    expect(screen.getByText('e')).toHaveClass('target-next');
  });

  it('誤打鍵の間は背景が変わり、スペースは ␣ で示す', () => {
    render(<TargetView view={view('a b', 'a b', 'a', ' b', 1)} missing />);
    expect(screen.getByRole('region', { name: 'お題' })).toHaveClass('bg-danger/20');
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
