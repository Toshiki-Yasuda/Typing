import { act, cleanup, render, screen } from '@testing-library/react';
import { SETTINGS_KEY } from './settings';
import { useSettings } from './useSettings';

function Show({ id }: { id: string }) {
  const [s, update] = useSettings();
  return (
    <div>
      <output aria-label={id}>{s.bgmVolume}</output>
      <button onClick={() => update({ bgmVolume: s.bgmVolume + 10 })}>{id}+</button>
    </div>
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('useSettings（共有ストア）', () => {
  it('ある画面で変えた設定が、別の画面（別のフック）にすぐ反映され、保存される', () => {
    render(
      <>
        <Show id="a" />
        <Show id="b" />
      </>,
    );
    expect(screen.getByLabelText('a')).toHaveTextContent('60');
    act(() => screen.getByText('a+').click());
    expect(screen.getByLabelText('a')).toHaveTextContent('70');
    expect(screen.getByLabelText('b')).toHaveTextContent('70');
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) as string).bgmVolume).toBe(70);
  });

  it('保存された値を読む。保存が書き換わったら（テストや別タブ）追従する', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ bgmVolume: 25 }));
    const { unmount } = render(<Show id="a" />);
    expect(screen.getByLabelText('a')).toHaveTextContent('25');
    unmount();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ bgmVolume: 40 }));
    render(<Show id="a" />);
    expect(screen.getByLabelText('a')).toHaveTextContent('40');
  });

  it('範囲外・型違いの新しい項目は既定値になる', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ bgmVolume: 999, gameBgm: 'x', bgm: 'yes' }));
    render(<Show id="a" />);
    expect(screen.getByLabelText('a')).toHaveTextContent('60');
  });
});
