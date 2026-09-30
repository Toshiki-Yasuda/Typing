import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { SessionSummary } from '@/metrics';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '@/settings/settings';
import { UNLOCK_KEY } from '@/themes/unlock';
import { RecommendationNote } from './RecommendationNote';

let n = 0;
const s = (accuracy: number): SessionSummary => ({
  id: `s${n++}`, startedAt: n, mode: 'practice', kpm: 200, accuracy, consistency: 0.9, efficiency: 0.9, total: 50, misses: 0,
});
const show = (summaries: SessionSummary[], current?: SessionSummary) =>
  render(
    <MemoryRouter>
      <RecommendationNote summaries={summaries} current={current} />
    </MemoryRouter>,
  );

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('RecommendationNote', () => {
  it('ホーム: 丁寧さの提案は、根拠の数値と修行（標準の言葉）へのリンクを出す', () => {
    show([s(0.9), s(0.91), s(0.92)]);
    const note = screen.getByRole('region', { name: '練習の提案' });
    expect(note).toHaveTextContent('提案：丁寧に');
    expect(note).toHaveTextContent('91.0%');
    expect(screen.getByRole('link', { name: '修行「静寂」へ' })).toHaveAttribute('href', '/train/zetsu');
  });

  it('ホーム: 速さの提案。HUNTER では修行の呼び名が「練」', () => {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(['hunter']));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, themeId: 'hunter' }));
    show([s(0.96), s(0.97), s(0.98)]);
    expect(screen.getByRole('region', { name: '練習の提案' })).toHaveTextContent('提案：速さに挑戦');
    expect(screen.getByRole('link', { name: '修行「練」へ' })).toHaveAttribute('href', '/train/ren');
  });

  it('提案が無ければ何も出さない', () => {
    show([s(0.96)]);
    expect(screen.queryByRole('region', { name: '練習の提案' })).toBeNull();
  });

  it('結果画面: 今回が基準未満の丁寧さの提案だけ出す（今回が良ければ出さない／速さは出さない）', () => {
    const bad = [s(0.9), s(0.91), s(0.92)];
    show(bad, bad[2]);
    expect(screen.getByRole('region', { name: '練習の提案' })).toBeInTheDocument();
    cleanup();
    const mixed = [s(0.9), s(0.91), s(0.99)];
    show(mixed, mixed[2]); // 中央値は基準未満だが、今回は良い
    expect(screen.queryByRole('region', { name: '練習の提案' })).toBeNull();
    cleanup();
    const good = [s(0.96), s(0.97), s(0.98)];
    show(good, good[2]);
    expect(screen.queryByRole('region', { name: '練習の提案' })).toBeNull();
  });
});
