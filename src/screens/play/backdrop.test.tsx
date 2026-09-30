import { cleanup, render, screen } from '@testing-library/react';
import { SETTINGS_KEY } from '@/settings/settings';
import { Backdrop } from './Backdrop';

function withEffects(effects: string, reduce = false) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ effects }));
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce'), media: q }));
}
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Backdrop（練習画面の背景）', () => {
  it('飾りとして隠され（aria-hidden）、3 層を持つ', () => {
    withEffects('full');
    const { container } = render(<Backdrop />);
    const root = screen.getByTestId('backdrop');
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root).toHaveAttribute('data-level', 'full');
    for (const c of ['far', 'mid', 'near']) expect(container.querySelector(`.backdrop-${c}`)).not.toBeNull();
  });

  it('控えめは 3 層のまま（動きは CSS が data-level=full のときだけ付ける）', () => {
    withEffects('reduced');
    const { container } = render(<Backdrop />);
    expect(screen.getByTestId('backdrop')).toHaveAttribute('data-level', 'reduced');
    expect(container.querySelectorAll('[class^="backdrop-"]')).toHaveLength(3);
  });

  it('オフは層を出さない', () => {
    withEffects('off');
    const { container } = render(<Backdrop />);
    expect(screen.getByTestId('backdrop')).toHaveAttribute('data-level', 'off');
    expect(container.querySelectorAll('[class^="backdrop-"]')).toHaveLength(0);
  });

  it('OS が動きを減らすなら、標準は静止（reduced）になる', () => {
    withEffects('full', true);
    render(<Backdrop />);
    expect(screen.getByTestId('backdrop')).toHaveAttribute('data-level', 'reduced');
  });
});
