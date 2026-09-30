import { render, screen, within } from '@testing-library/react';
import type { ContentItem } from '@/content';
import { SETTINGS_KEY } from '@/settings/settings';
import { PlayFrame } from './PlayFrame';
import { QueueRail } from './QueueRail';

const items: ContentItem[] = [
  { display: '猫', reading: 'ねこ' },
  { display: '犬', reading: 'いぬ' },
  { display: '鳥', reading: 'とり' },
];

beforeEach(() => localStorage.clear());

describe('QueueRail', () => {
  it('次のお題を、渡された順に並べる（現在の語は含まない）', () => {
    render(<QueueRail upcoming={items} />);
    const rail = screen.getByRole('complementary', { name: '次のお題' });
    expect(within(rail).getAllByText(/[猫犬鳥]/).map((e) => e.firstChild?.textContent)).toEqual(['猫', '犬', '鳥']);
  });

  it('読みは先頭の 2 語だけに添える（遠い語は小さく薄いので付けない）', () => {
    render(<QueueRail upcoming={items} />);
    const rail = screen.getByRole('complementary', { name: '次のお題' });
    expect(within(rail).queryByText('ねこ')).toBeInTheDocument();
    expect(within(rail).queryByText('いぬ')).toBeInTheDocument();
    expect(within(rail).queryByText('とり')).not.toBeInTheDocument();
  });

  it('表記と読みが同じ語（かな）には読みを重ねない', () => {
    render(<QueueRail upcoming={[{ display: 'ねこ', reading: 'ねこ' }]} />);
    expect(screen.getAllByText('ねこ')).toHaveLength(1);
  });

  it('遠い語ほど小さく薄くなる（順番 --i を各語に持たせる。CSS が大きさと濃さを決める）', () => {
    render(<QueueRail upcoming={items} />);
    expect(['猫', '犬', '鳥'].map((t) => screen.getByText(t).style.getPropertyValue('--i'))).toEqual(['0', '1', '2']);
  });

  it('飾りの「NEXT」は読み上げない', () => {
    render(<QueueRail upcoming={items} />);
    expect(screen.getByText('NEXT')).toHaveAttribute('aria-hidden', 'true');
  });

  it('待ち行列が空（最後の語）のときは何も出さない', () => {
    const { container } = render(<QueueRail upcoming={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

const frame = (queue?: React.ReactNode, guide: React.ReactNode = <p>ガイド</p>) => (
  <PlayFrame
    heading={<h1>練習</h1>}
    hud={<p>上部</p>}
    notices={<p>通知</p>}
    stage={<p>お題</p>}
    guide={guide}
    queue={queue}
  />
);

describe('PlayFrame（3ゾーン）', () => {
  it('設定が既定（待ち行列を出す）のとき、待ち行列を出す', () => {
    render(frame(<QueueRail upcoming={items} />));
    expect(screen.getByRole('complementary', { name: '次のお題' })).toBeInTheDocument();
  });

  it('設定 showQueue が false なら、待ち行列を出さない', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showQueue: false }));
    render(frame(<QueueRail upcoming={items} />));
    expect(screen.queryByRole('complementary', { name: '次のお題' })).not.toBeInTheDocument();
    expect(screen.getByText('お題')).toBeInTheDocument();
  });

  it('待ち行列の部品が無ければ、ゾーンを作らない', () => {
    const { container } = render(frame(undefined));
    expect(container.querySelector('.play-frame__queue')).toBeNull();
    expect(container.querySelector('.play-frame__zones')).toHaveAttribute('data-queue', 'off');
  });

  it('指の案内が無い（運指ガイドがオフ）ときは、右のゾーンを作らない', () => {
    const { container } = render(frame(<QueueRail upcoming={items} />, null));
    expect(container.querySelector('.play-frame__guide')).toBeNull();
    expect(container.querySelector('.play-frame__zones')).toHaveAttribute('data-guide', 'off');
  });

  it('読み上げの順: 見出し → 上部 → 通知 → お題 → 指の案内 → 次のお題', () => {
    const { container } = render(frame(<QueueRail upcoming={items} />));
    const text = container.textContent ?? '';
    const order = ['練習', '上部', '通知', 'お題', 'ガイド', 'NEXT'].map((t) => text.indexOf(t));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i >= 0)).toBe(true);
  });
});
