import { render, screen } from '@testing-library/react';
import { HudBar, formatElapsed } from './HudBar';

const stats = { kpm: 123.6, accuracy: 0.955, misses: 3, elapsedSec: 75 };

describe('HudBar', () => {
  it('stats が無ければ数字を出さない（進捗・中断は出る）', () => {
    render(<HudBar index={0} total={10} remaining={null} />);
    expect(screen.queryByTestId('hud-stats')).toBeNull();
    expect(screen.getByLabelText('進捗')).toHaveTextContent(/^1 \/ 10$/);
    expect(screen.getByText(/中断/)).toBeInTheDocument();
  });

  it('showStats=false なら stats があっても隠す', () => {
    render(<HudBar index={0} total={10} remaining={null} stats={stats} showStats={false} />);
    expect(screen.queryByTestId('hud-stats')).toBeNull();
  });

  it('数字: 速さは四捨五入、正確率は切り捨て、経過は m:ss', () => {
    render(<HudBar index={0} total={10} remaining={null} stats={stats} />);
    const box = screen.getByTestId('hud-stats');
    expect(box).toHaveTextContent('速さ124');
    expect(box).toHaveTextContent('正確率95%');
    expect(box).toHaveTextContent('ミス3');
    expect(box).toHaveTextContent('経過1:15');
  });

  it('出せない数字は -- にする', () => {
    render(<HudBar index={0} total={10} remaining={null} stats={{ kpm: null, accuracy: null, misses: 0, elapsedSec: 0 }} />);
    const box = screen.getByTestId('hud-stats');
    expect(box).toHaveTextContent('速さ--');
    expect(box).toHaveTextContent('正確率--');
    expect(box).toHaveTextContent('経過0:00');
  });

  it('読み上げにしない: aria-live を持たない', () => {
    const { container } = render(<HudBar index={0} total={10} remaining={null} stats={stats} />);
    expect(container.querySelector('[aria-live]')).toBeNull();
  });

  it('刻みは語の数だけ。完了・現在・未来の数が合う', () => {
    const { container } = render(<HudBar index={3} total={10} remaining={null} />);
    const ticks = [...container.querySelectorAll('.hud-tick')].map((t) => t.getAttribute('data-state'));
    expect(ticks).toHaveLength(10);
    expect(ticks.filter((s) => s === 'done')).toHaveLength(3);
    expect(ticks[3]).toBe('current');
    expect(ticks.filter((s) => s === 'todo')).toHaveLength(6);
  });

  it('刻みは装飾（aria-hidden）で、進捗の文字に混ざらない', () => {
    const { container } = render(<HudBar index={0} total={5} remaining={null} />);
    expect(container.querySelector('.hud-ticks')?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByLabelText('進捗').textContent).toBe('1 / 5');
  });

  it('タイマーは remaining があるときだけ', () => {
    const { rerender } = render(<HudBar index={0} total={5} remaining={null} />);
    expect(screen.queryByRole('timer')).toBeNull();
    rerender(<HudBar index={0} total={5} remaining={4200} />);
    expect(screen.getByRole('timer')).toHaveTextContent('残り 5 秒');
  });

  it('onAbort があれば中断がボタンになり、押すと呼ばれる', () => {
    const onAbort = vi.fn();
    render(<HudBar index={0} total={5} remaining={null} onAbort={onAbort} />);
    screen.getByRole('button', { name: /中断/ }).click();
    expect(onAbort).toHaveBeenCalledOnce();
  });
});

describe('formatElapsed', () => {
  it.each([
    [0, '0:00'],
    [9, '0:09'],
    [60, '1:00'],
    [605, '10:05'],
    [-3, '0:00'],
  ])('%i 秒 → %s', (sec, text) => {
    expect(formatElapsed(sec)).toBe(text);
  });
});
