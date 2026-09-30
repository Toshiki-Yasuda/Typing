import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeSettings } from './home/ThemeSettings';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('style');
  delete document.documentElement.dataset.theme;
});

describe('ThemeSettings', () => {
  it('ロック中は選択肢に無く、違うパスワードではエラー', async () => {
    const update = vi.fn();
    render(<ThemeSettings themeId="neutral" update={update} />);
    expect(screen.queryByRole('option', { name: 'HUNTER×HUNTER' })).toBeNull();
    fireEvent.change(screen.getByLabelText(/パスワード/), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: '開く' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('パスワードが違います');
    expect(update).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('SAKI で解除すると、テーマが選ばれて色が反映され、次回も解除済み', async () => {
    const update = vi.fn();
    const { unmount } = render(<ThemeSettings themeId="neutral" update={update} />);
    fireEvent.change(screen.getByLabelText(/パスワード/), { target: { value: 'SAKI' } });
    fireEvent.click(screen.getByRole('button', { name: '開く' }));
    expect(await screen.findByRole('option', { name: 'HUNTER×HUNTER' })).toBeInTheDocument();
    expect(update).toHaveBeenCalledWith({ themeId: 'hunter' });
    expect(document.documentElement.dataset.theme).toBe('hunter');
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#d4af37');
    expect(screen.queryByLabelText(/パスワード/)).toBeNull();
    unmount();

    render(<ThemeSettings themeId="hunter" update={update} />);
    expect(screen.getByRole('option', { name: 'HUNTER×HUNTER' })).toBeInTheDocument();
  });

  it('標準に戻すと色が中立に戻る', async () => {
    localStorage.setItem('typing.themes.unlocked.v1', '["hunter"]');
    render(<ThemeSettings themeId="hunter" update={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'テーマ' }), { target: { value: 'neutral' } });
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#5b9dff');
  });
});
