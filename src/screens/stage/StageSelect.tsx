import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useStore } from '@/app/StoreContext';
import type { SessionRecord } from '@/metrics';
import { loadBossProgress } from '@/session/bossProgress';
import { STAGE_CLEAR_ACCURACY, stageProgress } from '@/session/stageProgress';
import { useSettings } from '@/settings/useSettings';
import { useSceneBgm } from '@/sound/useSceneBgm';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import type { Chapter, Theme } from '@/themes/theme';
import { PageHeading } from '../PageHeading';

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** ステージ選択。章を選び、その章のステージ（と最後のボス）を選ぶ。入口の無い・章の無いテーマではホームへ */
export function StageSelectRoute() {
  const [settings] = useSettings();
  const theme = resolveTheme(settings.themeId, loadUnlocked());
  if (!theme.chapters || theme.chapters.length === 0) return <Navigate to="/" replace />;
  return <StageSelect theme={theme} chapters={theme.chapters} />;
}

function StageSelect({ theme, chapters }: { theme: Theme; chapters: readonly Chapter[] }) {
  const navigate = useNavigate();
  const store = useStore();
  const [records, setRecords] = useState<SessionRecord[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [bossProgress] = useState(() => loadBossProgress());
  useSceneBgm('stage');

  useEffect(() => {
    let cancelled = false;
    store.list().then((all) => !cancelled && setRecords(all));
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

  const progressOf = useMemo(
    () => (stageId: string) => stageProgress(records ?? [], stageId),
    [records],
  );

  // 初めて開いたときは、まだ終えていないステージがある最初の章を開く
  const firstOpen = useMemo(() => {
    if (!records) return chapters[0]!.id;
    const open = chapters.find(
      (c) => c.stages.some((s) => !progressOf(s.id).cleared) || (c.boss && !bossProgress[c.boss]?.best),
    );
    return (open ?? chapters[chapters.length - 1]!).id;
  }, [records, chapters, progressOf, bossProgress]);
  const chapter = chapters.find((c) => c.id === (picked ?? firstOpen)) ?? chapters[0]!;
  const boss = chapter.boss ? theme.bosses?.find((b) => b.id === chapter.boss) : undefined;
  const clearedCount = (c: Chapter) => c.stages.filter((s) => progressOf(s.id).cleared).length;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between gap-4">
        <PageHeading title="ステージ選択" className="text-3xl font-bold" />
        <Link to={theme.title ? '/title' : '/'} className="rounded bg-surface-raised px-4 py-2">
          {theme.title ? 'タイトルへ戻る（Esc）' : 'ホームへ戻る（Esc）'}
        </Link>
      </header>

      <nav aria-label="章" className="flex flex-wrap gap-2">
        {chapters.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.id === chapter.id}
            onClick={() => setPicked(c.id)}
            className={`rounded border px-3 py-2 text-left ${
              c.id === chapter.id
                ? 'border-accent bg-accent/20 font-bold'
                : 'border-surface-raised bg-surface-raised'
            }`}
          >
            第{c.number}章
            <span className="block text-xs font-normal text-text-muted">
              {records ? `${clearedCount(c)} / ${c.stages.length} クリア` : '…'}
            </span>
          </button>
        ))}
      </nav>

      <section aria-labelledby="chapter" className="flex flex-col gap-3">
        <h2 id="chapter" className="text-xl font-bold">
          第{chapter.number}章 {chapter.title}
          <span className="ml-3 text-sm font-normal tracking-widest text-text-muted">{chapter.subtitle}</span>
        </h2>
        <p className="text-sm text-text-muted">
          正確率 {pct(STAGE_CLEAR_ACCURACY)} 以上で打ち切るとクリアです（速度は問いません）。
        </p>
        <ul className="flex flex-col gap-2">
          {chapter.stages.map((s, i) => {
            const p = progressOf(s.id);
            return (
              <li key={s.id}>
                <Link
                  to={`/stage/${s.id}`}
                  className="grid grid-cols-[2rem_1fr_auto] items-center gap-x-3 rounded-lg bg-surface-raised p-3 hover:bg-accent/20"
                >
                  <span className="row-span-2 text-center font-mono text-accent" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="font-bold">{s.name}</span>
                  <span className="text-sm">
                    {!records ? '…' : p.cleared ? '✓ クリア済み' : p.attempts > 0 ? '△ 挑戦中' : '未挑戦'}
                  </span>
                  <span className="text-sm text-text-muted">{s.description}</span>
                  <span className="text-sm text-text-muted">
                    {records && p.attempts > 0
                      ? `${p.attempts}回・最高正確率 ${pct(p.bestAccuracy ?? 0)}`
                      : ''}
                  </span>
                </Link>
              </li>
            );
          })}
          {boss && (
            <li>
              <Link
                to={`/boss/${boss.id}`}
                aria-label={`ボス ${boss.name}に挑戦する`}
                className="grid grid-cols-[2rem_1fr_auto] items-center gap-x-3 rounded-lg border border-accent bg-surface-raised p-3 hover:bg-accent/20"
              >
                <span className="row-span-2 text-center text-accent" aria-hidden>
                  ★
                </span>
                <span className="font-bold">
                  ボス: {boss.name}
                  <span className="ml-2 text-sm font-normal text-text-muted">{boss.title}</span>
                </span>
                <span className="text-sm">
                  {bossProgress[boss.id]?.best ? `最高ランク ${bossProgress[boss.id]?.best}` : '未勝利'}
                </span>
                <span className="text-sm text-text-muted">
                  {boss.words}語・ミスの余裕 {boss.maxMisses}回
                </span>
              </Link>
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
