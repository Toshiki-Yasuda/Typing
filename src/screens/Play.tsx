import { useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { BASIC_PACK, type ContentItem, type ContentPack } from '@/content';
import { isGameKey } from '@/input/keyFilter';
import { keyWeakness } from '@/metrics';
import { pickAdaptive } from '@/session/adaptive';
import type { Ghost } from '@/session/ghost';
import { PracticeSession, pickItems } from '@/session/practiceSession';
import { GhostBar } from './GhostBar';
import { useStore } from '@/app/StoreContext';
import { TargetView } from './TargetView';

interface Props {
  pack?: ContentPack;
  count?: number;
  /** 過去の記録から弱点を求めて、弱いキーを含むお題を優先する（記録が無ければ均等） */
  adaptive?: boolean;
  /** お題を固定する（デイリー・同じお題の再挑戦）。指定すると、語数・弱点優先・乱数は使わない */
  items?: readonly ContentItem[];
  /** 記録に残すモード。省略なら弱点の有無で adaptive / practice */
  mode?: string;
  /** 並走させる過去の記録 */
  ghost?: { ghost: Ghost; label: string } | null;
  random?: () => number;
}

export function Play({ pack = BASIC_PACK, count = 10, adaptive = true, items: fixedItems, mode, ghost = null, random }: Props) {
  const navigate = useNavigate();
  const store = useStore();
  const [session, setSession] = useState<PracticeSession | null>(null);

  // 過去の記録から弱点を求め、弱いキーを含むお題が出やすいように選ぶ（記録が無ければ均等）
  useEffect(() => {
    let cancelled = false;
    store.list().then((records) => {
      if (cancelled) return;
      const weakness = adaptive ? keyWeakness(records.map((r) => r.keystrokes)) : new Map<string, number>();
      const items =
        fixedItems ??
        (weakness.size > 0 ? pickAdaptive(pack.items, count, weakness, { random }) : pickItems(pack.items, count, random));
      setSession(
        new PracticeSession(items, performance.now(), {
          id: crypto.randomUUID(),
          startedAt: Date.now(),
          mode: mode ?? (weakness.size > 0 ? 'adaptive' : 'practice'),
          contentId: pack.id,
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [store, pack, count, adaptive, fixedItems, mode, random]);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [missing, setMissing] = useState(false);
  const [imeWarning, setImeWarning] = useState(false);
  // ウィンドウが非アクティブの間は、キーがページに届かない。ポーズはせず（3秒超の休止は速度から除かれる）、案内だけ出す。
  // 初期値は「アクティブ」とみなす（document.hasFocus() は環境によって不正確なため、イベントだけで切り替える）
  const [focused, setFocused] = useState(true);
  const missTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const onBlur = () => setFocused(false);
    const onFocus = () => setFocused(true);
    const onVisibility = () => setFocused(!document.hidden);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate('/');
        return;
      }
      // IME が変換中のときは keydown が実キーを持たない。警告を出して、打鍵としては扱わない
      if (e.isComposing || e.keyCode === 229) setImeWarning(true);
      if (!isGameKey(e)) return;
      e.preventDefault(); // Space のスクロールや ' / のクイック検索を止める
      setImeWarning(false);

      const result = session.press({ key: e.key, code: e.code }, e.timeStamp);
      if (result === 'miss') {
        setMissing(true);
        clearTimeout(missTimer.current);
        missTimer.current = setTimeout(() => setMissing(false), 160);
      }
      if (result === 'sessionDone') {
        const record = session.toRecord();
        store.add(record).then(
          () => navigate(`/result/${record.id}`),
          (error) => console.error('記録の保存に失敗しました', error),
        );
      }
      rerender();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(missTimer.current);
    };
  }, [navigate, session, store]);

  if (!session) return <p className="p-8 text-text-muted">準備中…</p>;
  const view = session.view();
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 p-8">
      <header className="flex items-center justify-between text-text-muted">
        <span aria-label="進捗">
          {view.index + 1} / {view.total}
        </span>
        <span className="text-sm">Esc で中断</span>
      </header>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={view.total}
        aria-valuenow={view.index}
        className="h-1 rounded bg-surface-raised"
      >
        <div className="h-1 rounded bg-accent" style={{ width: `${(view.index / view.total) * 100}%` }} />
      </div>
      {!focused && (
        <p role="status" className="rounded bg-surface-raised p-3 text-sm">
          ウィンドウがアクティブではありません。画面をクリックすると、続きから打てます。
        </p>
      )}
      {imeWarning && (
        <p role="status" className="rounded bg-danger/20 p-3 text-sm">
          日本語入力がオンのようです。半角/英数モードに切り替えてください。
        </p>
      )}
      {ghost && <GhostBar ghost={ghost.ghost} session={session} label={ghost.label} />}
      <TargetView view={view} missing={missing} />
    </main>
  );
}
