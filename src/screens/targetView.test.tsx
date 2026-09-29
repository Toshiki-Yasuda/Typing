import { render, screen } from '@testing-library/react';
import type { SessionView } from '@/session/practiceSession';
import { TargetView, sizeClasses } from './TargetView';

const view = (display: string, reading: string, typed: string, rest: string, kanaIndex = 0): SessionView => ({
  item: { display, reading },
  index: 0,
  total: 1,
  guide: { typed, rest, remaining: rest.length, kanaIndex },
  finished: false,
});

describe('sizeClasses（長さに応じた大きさ）', () => {
  it('短い語は大きく、長い文は小さくなる', () => {
    expect(sizeClasses(3, 3, 8)).toEqual({ display: 'text-4xl', reading: 'text-2xl', romaji: 'text-3xl tracking-widest' });
    expect(sizeClasses(20, 20, 40).display).toBe('text-3xl');
    expect(sizeClasses(20, 20, 40).reading).toBe('text-xl');
    expect(sizeClasses(20, 20, 40).romaji).toBe('text-2xl tracking-wide');
    expect(sizeClasses(30, 30, 70)).toEqual({ display: 'text-2xl', reading: 'text-lg', romaji: 'text-xl tracking-normal' });
  });

  it('境界: 12 / 24 / 48 文字までは同じ大きさ、超えると 1 段階小さくなる', () => {
    expect(sizeClasses(12, 12, 24)).toMatchObject({ display: 'text-4xl', reading: 'text-2xl', romaji: 'text-3xl tracking-widest' });
    expect(sizeClasses(13, 13, 25)).toMatchObject({ display: 'text-3xl', reading: 'text-xl', romaji: 'text-2xl tracking-wide' });
    expect(sizeClasses(24, 24, 48).romaji).toBe('text-2xl tracking-wide');
    expect(sizeClasses(25, 25, 49).romaji).toBe('text-xl tracking-normal');
  });
});

describe('TargetView', () => {
  it('短い語は大きく表示する', () => {
    render(<TargetView view={view('猫', 'ねこ', 'n', 'eko')} missing={false} />);
    expect(screen.getByText('猫')).toHaveClass('text-4xl');
  });

  it('長い文は小さく、折り返せる（はみ出さない）', () => {
    const display = '長い文'.repeat(10); // 30 文字
    render(<TargetView view={view(display, 'あ'.repeat(30), '', 'a'.repeat(60))} missing={false} />);
    expect(screen.getByText(display)).toHaveClass('text-2xl', 'break-words');
    expect(screen.getByLabelText('ローマ字ガイド')).toHaveClass('break-all', 'text-xl');
  });

  it('中くらいの文（23 文字）は 1 段階だけ小さい', () => {
    const display = '新しいキーボードを買ったので、練習を始めます。';
    expect([...display]).toHaveLength(23);
    render(<TargetView view={view(display, 'あ'.repeat(29), '', 'a'.repeat(40))} missing={false} />);
    expect(screen.getByText(display)).toHaveClass('text-3xl');
  });

  it('読みの確定部分を強調し、ガイドは 打鍵済み + 次のキー + 残り', () => {
    render(<TargetView view={view('猫', 'ねこ', 'ne', 'ko', 1)} missing={false} />);
    expect(screen.getByLabelText('ローマ字ガイド')).toHaveTextContent('neko');
    expect(screen.getByText('ね')).toHaveClass('text-success');
    expect(screen.getByText('こ')).toHaveClass('text-text-muted');
  });

  it('誤打鍵の間は背景が変わり、スペースは ␣ で示す', () => {
    render(<TargetView view={view('a b', 'a b', 'a', ' b', 1)} missing />);
    expect(screen.getByRole('region', { name: 'お題' })).toHaveClass('bg-danger/20');
    expect(screen.getByLabelText('ローマ字ガイド')).toHaveTextContent('a␣b');
  });
});
