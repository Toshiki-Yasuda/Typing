import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useStore } from '@/app/StoreContext';
import { CODEX_CATEGORIES, useCodex, type CodexCategory, type CodexEntry } from '@/content/codex';
import { normalizeTarget } from '@/engine';
import type { SessionRecord } from '@/metrics';
import { accuracyOf, codexStage, progressOf, summarizeCodex, wordProgress, type CodexStage } from '@/session/codex';
import { plainRecords } from '@/session/vows';
import { useSettings } from '@/settings/useSettings';
import { useSceneBgm } from '@/sound/useSceneBgm';
import type { Theme } from '@/themes/theme';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { PageHeading } from '../PageHeading';

const STAGE_LABEL: Record<CodexStage, string> = { unseen: '未遭遇', seen: '遭遇', mastered: '習熟' };
/** 色だけに頼らない: 段階を、記号と文字で示す */
const STAGE_MARK: Record<CodexStage, string> = { unseen: '？', seen: '◇', mastered: '◆' };
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** 図鑑。テーマに図鑑が無ければホームへ */
export function CodexScreen() {
  const [settings] = useSettings();
  const theme = resolveTheme(settings.themeId, loadUnlocked());
  if (!theme.codex) return <Navigate to="/" replace />;
  return <Codex theme={theme} codex={theme.codex} />;
}

function Codex({ theme, codex }: { theme: Theme; codex: NonNullable<Theme['codex']> }) {
  const navigate = useNavigate();
  const store = useStore();
  const state = useCodex(codex.path);
  const [records, setRecords] = useState<SessionRecord[] | null>(null);
  const [category, setCategory] = useState<CodexCategory | 'all'>('all');
  useSceneBgm('stage');

  useEffect(() => {
    let cancelled = false;
    store.list().then((all) => !cancelled && setRecords(plainRecords(all)));
    return () => {
      cancelled = true;
    };
  }, [store]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) navigate(theme.title ? '/title' : '/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, theme.title]);

  const progress = useMemo(() => wordProgress(records ?? []), [records]);
  const loaded = state.status === 'ready' ? state.entries : null;
  const entries: readonly CodexEntry[] = useMemo(() => loaded ?? [], [loaded]);
  const summary = useMemo(() => summarizeCodex(entries.map((e) => e.reading), progress), [entries, progress]);
  const shown = entries.filter((e) => category === 'all' || e.category === category);

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <PageHeading title={codex.heading} className="text-3xl font-bold" />
        <Link to={theme.title ? '/title' : '/'} className="rounded bg-surface-raised px-4 py-2">
          {theme.title ? 'タイトルへ（Esc）' : 'ホームへ'}
        </Link>
      </header>

      {state.status === 'loading' || records === null ? (
        <p className="text-text-muted">読み込み中…</p>
      ) : state.status === 'error' ? (
        <p role="alert">図鑑を読み込めませんでした。</p>
      ) : (
        <>
          <p role="status" className="text-lg">
            遭遇 <strong>{summary.seen}</strong> / 全 {summary.total} ・ 習熟 <strong>{summary.mastered}</strong>
          </p>
          <p className="text-sm text-text-muted">
            ステージなどで語を打つと「遭遇」になり、3 回以上打って正確率 95% 以上で「習熟」になります（縛り付きの練習は数えません）。
          </p>

          <div role="group" aria-label="区分" className="flex flex-wrap gap-2">
            {(['all', ...CODEX_CATEGORIES] as const).map((c) => {
              const count = c === 'all' ? entries.length : entries.filter((e) => e.category === c).length;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={`rounded border px-3 py-1 ${category === c ? 'border-accent bg-accent/20 font-bold' : 'border-surface-raised bg-surface-raised'}`}
                >
                  {c === 'all' ? 'すべて' : codex.categories[c]}（{count}）
                </button>
              );
            })}
          </div>

          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((e) => {
              const p = progressOf(progress, e.reading);
              const stage = codexStage(p);
              const acc = accuracyOf(p);
              return (
                <li key={`${e.display}\t${e.reading}`} className="card flex flex-col gap-1 !p-3" data-stage={stage}>
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-bold">{stage === 'unseen' ? '？？？' : e.display}</span>
                    <span className="text-sm">
                      <span aria-hidden>{STAGE_MARK[stage]} </span>
                      {STAGE_LABEL[stage]}
                    </span>
                  </p>
                  <p className="text-sm text-text-muted">
                    {stage === 'unseen'
                      ? `${codex.categories[e.category]}・第${e.chapter}章`
                      : `${normalizeTarget(e.reading)}・${codex.categories[e.category]}・第${e.chapter}章`}
                  </p>
                  {stage !== 'unseen' && (
                    <p className="text-sm text-text-muted">
                      {p.typed} 回・正確率 {acc === null ? '—' : pct(acc)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
