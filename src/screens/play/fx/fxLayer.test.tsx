import { act, cleanup, render, screen } from '@testing-library/react';
import { SETTINGS_KEY } from '@/settings/settings';
import { UNLOCK_KEY } from '@/themes/unlock';
import type { PressFx } from '../types';
import { FxLayer } from './FxLayer';

function setup(settings: Record<string, unknown>, reduce = false) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduce && q.includes('reduce'),
    media: q,
  }));
}
const press = (seq: number, result: PressFx['result']): PressFx => ({
  seq,
  result,
  key: 'k',
  expected: 'k',
});

let rafCalls = 0;
let arcs = 0;
let cardEl: HTMLElement;
beforeEach(() => {
  localStorage.clear();
  rafCalls = 0;
  arcs = 0;
  cardEl = document.createElement('div');
  cardEl.className = 'target-card';
  cardEl.getBoundingClientRect = () => ({
    left: 100,
    top: 200,
    width: 600,
    height: 300,
    right: 700,
    bottom: 500,
    x: 100,
    y: 200,
    toJSON: () => ({}),
  });
  document.body.appendChild(cardEl);
  vi.stubGlobal('requestAnimationFrame', () => ++rafCalls);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  HTMLCanvasElement.prototype.getContext = (() => ({
    setTransform: () => {},
    clearRect: () => {},
    beginPath: () => {},
    arc: () => arcs++,
    fill: () => {},
  })) as never;
});
afterEach(() => {
  cleanup();
  cardEl.remove();
  vi.unstubAllGlobals();
});

const canvas = () => document.querySelector('canvas');

describe('FxLayer（空気と達成）', () => {
  it('飾りとして隠され、標準では光・レール・canvas を持つ', () => {
    setup({ effects: 'full', themeId: 'neutral' });
    const { container } = render(<FxLayer press={undefined} index={0} total={5} />);
    expect(screen.getByTestId('air-layer')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.fx-glow')).not.toBeNull();
    expect(container.querySelector('.fx-rail')).not.toBeNull();
    expect(canvas()).not.toBeNull();
  });

  it('控えめ・OS の動きを減らす・オフでは、粒・光の呼吸を描かない。オフはレールも出さない', () => {
    setup({ effects: 'reduced' });
    const first = render(<FxLayer press={press(1, 'wordDone')} index={1} total={5} />);
    expect(canvas()).toBeNull();
    expect(first.container.querySelector('.fx-glow')).toBeNull();
    expect(first.container.querySelector('.fx-edge')).toBeNull();
    expect(first.container.querySelector('.fx-rail')).not.toBeNull(); // 静止した進み
    cleanup();
    setup({ effects: 'full' }, true);
    render(<FxLayer press={press(1, 'ok')} index={1} total={5} />);
    expect(canvas()).toBeNull();
    cleanup();
    setup({ effects: 'off' });
    const r = render(<FxLayer press={press(1, 'ok')} index={1} total={5} />);
    expect(r.container.querySelector('.fx-rail')).toBeNull();
    expect(canvas()).toBeNull();
    expect(rafCalls).toBe(0);
  });

  it('レールは index/total の進みで、カードの下端の少し下に置く', () => {
    setup({ effects: 'full' });
    const { container } = render(
      <main>
        <FxLayer press={undefined} index={2} total={8} />
      </main>,
    );
    expect(screen.getByTestId('air-layer').style.getPropertyValue('--fx-progress')).toBe('0.25');
    expect((container.firstChild as HTMLElement).style.getPropertyValue('--stage-rail-y')).toBe('514px');
  });

  it('光の強さ --rhythm は連続正打で上がり、ミスで 0 に戻る', () => {
    setup({ effects: 'full', themeId: 'neutral' });
    const layer = () => screen.getByTestId('air-layer').style.getPropertyValue('--rhythm');
    const { rerender } = render(<FxLayer press={undefined} index={0} total={5} />);
    expect(layer()).toBe('0');
    for (let i = 1; i <= 6; i++) rerender(<FxLayer press={press(i, 'ok')} index={0} total={5} />);
    expect(Number(layer())).toBeCloseTo(0.2, 10);
    rerender(<FxLayer press={press(7, 'miss')} index={0} total={5} />);
    expect(layer()).toBe('0');
  });

  it('テーマに手応え（feel）があるときは、光の呼吸を出さない（二重にしない）', () => {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(['hunter']));
    setup({ effects: 'full', themeId: 'hunter' });
    const { container } = render(<FxLayer press={undefined} index={0} total={5} />);
    expect(container.querySelector('.fx-glow')).toBeNull();
    expect(container.querySelector('.fx-rail')).not.toBeNull();
  });

  it('語の完了で縁の光が 1 つ出る。正打では出ない。粒が生きている間だけ rAF を回す', () => {
    setup({ effects: 'full', themeId: 'neutral' });
    const { container, rerender } = render(<FxLayer press={undefined} index={0} total={5} />);
    expect(rafCalls).toBe(0);
    rerender(<FxLayer press={press(1, 'ok')} index={0} total={5} />);
    expect(container.querySelector('.fx-edge')).toBeNull();
    expect(rafCalls).toBe(1);
    rerender(<FxLayer press={press(2, 'miss')} index={0} total={5} />);
    expect(rafCalls).toBe(1); // ミスでは粒を出さない
    rerender(<FxLayer press={press(3, 'wordDone')} index={1} total={5} />);
    expect(container.querySelectorAll('.fx-edge')).toHaveLength(1);
    expect(container.querySelectorAll('.fx-glow__flash')).toHaveLength(1);
  });

  it('語の完了が 400ms より速く続くときは、光らせ直さない', () => {
    setup({ effects: 'full', themeId: 'neutral' });
    const { container, rerender } = render(<FxLayer press={undefined} index={0} total={5} />);
    rerender(<FxLayer press={press(1, 'wordDone')} index={1} total={5} />);
    const first = container.querySelector('.fx-edge');
    expect(first).not.toBeNull();
    rerender(<FxLayer press={press(2, 'wordDone')} index={2} total={5} />);
    expect(container.querySelector('.fx-edge')).toBe(first);
  });

  it('canvas が使えない環境でも例外にしない', () => {
    setup({ effects: 'full' });
    HTMLCanvasElement.prototype.getContext = (() => {
      throw new Error('no canvas');
    }) as never;
    const { rerender } = render(<FxLayer press={undefined} index={0} total={5} />);
    expect(() => act(() => rerender(<FxLayer press={press(1, 'wordDone')} index={1} total={5} />))).not.toThrow();
    HTMLCanvasElement.prototype.getContext = (() => null) as never;
    expect(() => rerender(<FxLayer press={press(2, 'ok')} index={1} total={5} />)).not.toThrow();
  });
});
