import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import type { AfterFlow } from '@/session/afterFlow';

/** フォーカス中の操作要素（リンク・ボタン・入力欄など）の Enter / Esc は奪わない（Home と同じ判定） */
const INTERACTIVE = 'a[href], button, input, select, textarea, summary, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

/** 結果画面のキー操作: Enter＝主ボタン、Esc＝戻り先。押しっぱなしの繰り返しは無視する */
export function useAfterKeys(flow: AfterFlow) {
  const navigate = useNavigate();
  const { primary, escTo } = flow;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.key !== 'Enter' && e.key !== 'Escape') return;
      if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
      e.preventDefault();
      navigate(e.key === 'Enter' ? primary.to : escTo);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, primary.to, escTo]);
}

/** キー操作だけを受ける（描画なし）。結果画面が早期 return を持つので、フックを子コンポーネントに分ける */
export function AfterKeys({ flow }: { flow: AfterFlow }) {
  useAfterKeys(flow);
  return null;
}

/** ステージ・ボスの結果の動線。先へ進む主ボタンを大きく、副を小さく。キーの案内は文字で示す */
export function AfterActions({ flow }: { flow: AfterFlow }) {
  return (
    <nav aria-label="次の行動" className="flex flex-col gap-3">
      <Link
        to={flow.primary.to}
        className="rounded-lg bg-accent px-8 py-4 text-center text-xl font-bold text-surface focus-visible:outline-2"
      >
        {flow.primary.label}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        {flow.secondary.map((a) => (
          <Link key={a.to + a.label} to={a.to} className="rounded bg-surface-raised px-4 py-2">
            {a.label}
          </Link>
        ))}
        <span className="text-sm text-text-muted">Enter: {flow.primary.label}・Esc: {flow.escTo === '/' ? 'ホーム' : 'ステージ選択'}</span>
      </div>
    </nav>
  );
}
