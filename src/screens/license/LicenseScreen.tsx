import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useStore } from '@/app/StoreContext';
import { useCodex } from '@/content/codex';
import { prefersReducedMotion, resolveEffects } from '@/effects/level';
import { LAYOUTS, locate } from '@/fingering';
import { computeAxes, diagnose } from '@/metrics/axes';
import { rankStatus, summarizeSessions, type SessionRecord } from '@/metrics';
import { loadBossProgress } from '@/session/bossProgress';
import { summarizeCodex, wordProgress } from '@/session/codex';
import { HUNTER_NAME_MAX, bossWins, stagesCleared, starsOf } from '@/session/license';
import { plainRecords } from '@/session/vows';
import { useSettings } from '@/settings/useSettings';
import { useSceneBgm } from '@/sound/useSceneBgm';
import type { Theme } from '@/themes/theme';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { PageHeading } from '../PageHeading';
import { HeroBanner } from '../home/HeroBanner';

/** マイライセンス。テーマに license が無ければホームへ */
export function LicenseScreen() {
  const [settings] = useSettings();
  const theme = resolveTheme(settings.themeId, loadUnlocked());
  if (!theme.license) return <Navigate to="/" replace />;
  return <License theme={theme} license={theme.license} />;
}

function License({ theme, license }: { theme: Theme; license: NonNullable<Theme['license']> }) {
  const navigate = useNavigate();
  const store = useStore();
  const [settings, update] = useSettings();
  const [records, setRecords] = useState<SessionRecord[] | null>(null);
  const [progress] = useState(() => loadBossProgress());
  const codex = useCodex(theme.codex?.path);
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
      if (e.key === 'Escape' && !e.defaultPrevented && !(e.target instanceof HTMLInputElement)) navigate(theme.title ? '/title' : '/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, theme.title]);

  const layout = LAYOUTS[settings.layout];
  const data = useMemo(() => {
    if (!records) return null;
    const plain = plainRecords(records);
    const rank = rankStatus(summarizeSessions(plain));
    const axes = computeAxes(plain, (c) => locate(layout, c)?.key.finger ?? null);
    const d = diagnose(axes);
    const kind = d && theme.diagnosis ? theme.diagnosis.axes[d.strongest].kind : null;
    const bossIds = (theme.bosses ?? []).map((b) => b.id);
    const stageIds = (theme.chapters ?? []).flatMap((c) => c.stages.map((s) => s.id));
    const words = codex.status === 'ready' ? codex.entries.map((e) => e.reading) : null;
    return {
      rank,
      kind,
      bosses: { won: bossWins(progress, bossIds), total: bossIds.length },
      stages: { cleared: stagesCleared(records, stageIds), total: stageIds.length },
      codex: words ? summarizeCodex(words, wordProgress(plain)) : null,
    };
  }, [records, layout, theme, progress, codex]);

  const level = resolveEffects(settings.effects, prefersReducedMotion());
  const name = settings.hunterName.trim();
  const stars = data ? starsOf(data.rank.rank) : 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <PageHeading title={license.heading} className="text-3xl font-bold" />
        <Link to={theme.title ? '/title' : '/'} className="rounded bg-surface-raised px-4 py-2">
          {theme.title ? 'タイトルへ（Esc）' : 'ホームへ'}
        </Link>
      </header>

      {level !== 'off' && <HeroBanner theme={theme} effects={settings.effects} />}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-3">
          <span className="text-text-muted">ハンターネーム</span>
          <input
            type="text"
            value={settings.hunterName}
            maxLength={HUNTER_NAME_MAX}
            onChange={(e) => update({ hunterName: Array.from(e.target.value).slice(0, HUNTER_NAME_MAX).join('') })}
            aria-describedby="name-hint"
            className="rounded border border-text-muted/40 bg-surface px-3 py-2"
          />
        </label>
        <span id="name-hint" className="text-sm text-text-muted">
          {HUNTER_NAME_MAX} 文字まで
        </span>
      </div>

      {!data ? (
        <p className="text-text-muted">読み込み中…</p>
      ) : (
        <section aria-labelledby="license-card" className="license-card flex flex-col gap-4">
          <p id="license-card" className="text-sm font-bold tracking-[0.3em] text-accent">
            {license.cardTitle}
          </p>
          <p className="text-3xl font-extrabold">{name === '' ? license.unnamed : name}</p>
          <p>
            <span className="license-stars" aria-hidden>
              {'★'.repeat(stars)}
              {'☆'.repeat(5 - stars)}
            </span>
            <span className="ml-3">
              星 {stars} つ・{data.rank.rank ? `${data.rank.rank.label}${data.rank.provisional ? '（暫定）' : ''}` : '級位なし'}
            </span>
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <dt className="text-sm text-text-muted">系統</dt>
              <dd className="text-lg font-bold">{data.kind ?? '未診断'}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-muted">ボス討伐</dt>
              <dd className="text-lg font-bold">
                {data.bosses.won} / {data.bosses.total}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-text-muted">ステージクリア</dt>
              <dd className="text-lg font-bold">
                {data.stages.cleared} / {data.stages.total}
              </dd>
            </div>
            {theme.codex && (
              <div>
                <dt className="text-sm text-text-muted">{theme.codex.heading}（遭遇・習熟）</dt>
                <dd className="text-lg font-bold">
                  {data.codex ? `${data.codex.seen}・${data.codex.mastered} / ${data.codex.total}` : '…'}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}
      <p className="text-sm text-text-muted">カードの内容は、縛りなしの記録と戦績から毎回計算します（保存するのはハンターネームだけです）。</p>
    </main>
  );
}
