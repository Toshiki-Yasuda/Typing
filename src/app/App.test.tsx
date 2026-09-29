import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('ホーム画面を表示する', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Typing' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /練習を始める/ })).toHaveAttribute('href', '#/play');
  });
});
