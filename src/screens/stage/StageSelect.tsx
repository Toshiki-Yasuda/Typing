import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useStore } from '@/app/StoreContext';
import type { SessionRecord } from '@/metrics';
import { loadBossProgress } from '@/session/bossProgress';
import { MEDAL_LABEL, medalText } from '@/session/vows';
import { isOpen, unlockState } from '@/session/stageUnlock';
import { STAGE_CLEAR_ACCURACY, stageMedal, stageProgress } from '@/session/stageProgress';
import { useSettings } from '@/settings/useSettings';
import { useSceneBgm } from '@/sound/useSceneBgm';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import type { Chapter, Theme } from '@/themes/theme';
import { PageHeading } from '../PageHeading';
import { VowsPicker } from '../vows/VowsPicker';

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

  const [settings, updateSettings] = useSettings();
  const unlock = useMemo(
    () => unlockState(chapters, settings.stageUnlock, (id) => progressOf(id).cleared),
    [chapters, settings.stageUnlock, progressOf],
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
  const stageMedalText = (stageId: string) => {
    const m = stageMedal(records ?? [], stageId);
    return m === 'none' ? '' : `（メダル ${MEDAL_LABEL[m]}）`;
  };
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

      {/* 設定は折りたたむ（開くたびに長い設定を越えないと、ステージ一覧に届かないため）。いまの状態は見出しに文字で出す */}
      <details className="card !p-0" data-testid="stage-rules">
        <summary className="cursor-pointer p-4 font-bold">
          ルール設定
          <span className="ml-3 text-sm font-normal text-text-muted">
            縛り {settings.vows.length} つ・順番に開放: {settings.stageUnlock === 'sequential' ? 'オン' : 'オフ'}
          </span>
        </summary>
        <div className="flex flex-col gap-4 p-4 pt-0">
          <VowsPicker />

          <label className="card flex items-start gap-2 !p-3">
            <input
              type="checkbox"
              checked={settings.stageUnlock === 'sequential'}
              onChange={(e) => updateSettings({ stageUnlock: e.target.checked ? 'sequential' : 'all' })}
              className="mt-1 h-4 w-4 accent-[var(--viz-series-1)]"
            />
            <span>
              ステージを順番に開放する
              <span className="block text-sm text-text-muted">前のステージをクリアすると次が開き、章のボスは、その章のステージをすべてクリアすると開きます。</span>
            </span>
          </label>
        </div>
      </details>

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
            if (!isOpen(unlock, 'stage', s.id)) {
              return (
                <li key={s.id}>
                  <div
                    aria-disabled="true"
                    className="grid grid-cols-[2rem_1fr_auto] items-center gap-x-3 rounded-lg border border-dashed border-text-muted/40 p-3 text-text-muted"
                  >
                    <span className="row-span-2 text-center font-mono" aria-hidden>
                      {i + 1}
                    </span>
                    <span className="font-bold">{s.name}</span>
                    <span className="text-sm">🔒 閉じています</span>
                    <span className="text-sm">前のステージをクリアで開く</span>
                  </div>
                </li>
              );
            }
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
                    {!records ? '…' : p.cleared ? `✓ クリア済み${stageMedalText(s.id)}` : p.attempts > 0 ? '△ 挑戦中' : '未挑戦'}
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
          {boss && !isOpen(unlock, 'boss', boss.id) && (
            <li>
              <div
                aria-disabled="true"
                className="grid grid-cols-[2rem_1fr_auto] items-center gap-x-3 rounded-lg border border-dashed border-text-muted/40 p-3 text-text-muted"
              >
                <span className="row-span-2 text-center" aria-hidden>
                  ★
                </span>
                <span className="font-bold">ボス: {boss.name}</span>
                <span className="text-sm">🔒 閉じています</span>
                <span className="text-sm">この章のステージをすべてクリアで開く</span>
              </div>
            </li>
          )}
          {boss && isOpen(unlock, 'boss', boss.id) && (
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
                  {bossProgress[boss.id]?.best ? `最高ランク ${bossProgress[boss.id]?.best}${bossProgress[boss.id]?.bestVows ? `（${medalText(bossProgress[boss.id]?.bestVows)}）` : ''}` : '未勝利'}
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
