import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { StoreProvider } from '@/app/StoreContext';
import { createMemoryPackStore, createMemoryStore } from '@/storage';
import { Home } from './Home';
import { PageHeading } from './PageHeading';
import { TargetView } from './TargetView';

describe('PageHeading', () => {
  it('タイトルを「画面名 - Typing」にし、見出しにフォーカスを移す', () => {
    render(<PageHeading title="統計" />);
    expect(document.title).toBe('統計 - Typing');
    expect(screen.getByRole('heading', { name: '統計' })).toHaveFocus();
    expect(screen.getByRole('heading', { name: '統計' })).toHaveAttribute('tabindex', '-1'); // Tab では止まらない
  });

  it('ホームは「Typing」のまま。読み上げ専用にもできる', () => {
    render(<PageHeading title="Typing" home srOnly />);
    expect(document.title).toBe('Typing');
    expect(screen.getByRole('heading', { name: 'Typing' })).toHaveClass('sr-only');
  });

  it('画面名が変わればタイトルも変わる', () => {
    const { rerender } = render(<PageHeading title="結果" />);
    rerender(<PageHeading title="練習" />);
    expect(document.title).toBe('練習 - Typing');
  });
});

describe('ホームの Enter ショートカット', () => {
  const renderHome = () =>
    render(
      <StoreProvider store={createMemoryStore()} packStore={createMemoryPackStore()}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/play" element={<p>練習画面</p>} />
          </Routes>
        </MemoryRouter>
      </StoreProvider>,
    );
  const enter = (target: Element | Window, init: KeyboardEventInit = {}) =>
    act(() => {
      fireEvent.keyDown(target, { key: 'Enter', ...init });
    });

  it('何にもフォーカスしていなければ、練習を始める', async () => {
    renderHome();
    await screen.findByRole('heading', { name: 'Typing' });
    enter(document.body);
    expect(screen.getByText('練習画面')).toBeInTheDocument();
  });

  it('画面遷移で見出し（tabindex=-1）にフォーカスがあっても、ショートカットは使える', async () => {
    renderHome();
    const h1 = await screen.findByRole('heading', { name: 'Typing' });
    expect(h1).toHaveFocus();
    enter(h1);
    expect(screen.getByText('練習画面')).toBeInTheDocument();
  });

  it.each([
    ['ボタン', () => screen.getByRole('button', { name: '記録を書き出す' })],
    ['選択肢', () => screen.getByLabelText('出題パック')],
    ['チェックボックス', () => screen.getByLabelText('運指ガイドを表示する')],
    ['リンク', () => screen.getByRole('link', { name: '統計を見る' })],
  ])('%s にフォーカスがあるときの Enter は、その要素の操作。練習は始めない', async (_name, get) => {
    renderHome();
    await screen.findByRole('heading', { name: 'Typing' });
    const el = get();
    el.focus();
    enter(el);
    expect(screen.queryByText('練習画面')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Typing' })).toBeInTheDocument();
  });

  it('修飾キー併用・IME 変換中・他が処理済みの Enter は無視する', async () => {
    renderHome();
    await screen.findByRole('heading', { name: 'Typing' });
    for (const init of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true }, { isComposing: true }]) {
      enter(document.body, init);
      expect(screen.queryByText('練習画面')).not.toBeInTheDocument();
    }
  });
});

describe('誤打鍵の表示（色だけに頼らない）', () => {
  const view = { item: { display: '猫', reading: 'ねこ' }, index: 0, total: 1, guide: { typed: '', rest: 'neko', remaining: 4, kanaIndex: 0 }, finished: false, next: null };

  it('誤打鍵の間は「ミス」の文字と枠が出る。読み上げには出さない', () => {
    render(<TargetView view={view} missing />);
    const region = screen.getByRole('region', { name: 'お題' });
    expect(region).toHaveTextContent('ミス');
    expect(region).toHaveClass('ring-2');
    expect(screen.getByText('ミス')).toHaveAttribute('aria-hidden', 'true');
  });

  it('通常時は出ない', () => {
    render(<TargetView view={view} missing={false} />);
    expect(screen.getByRole('region', { name: 'お題' })).not.toHaveTextContent('ミス');
  });
});
