import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useStore } from '@/app/StoreContext';
import { LAYOUTS, locate } from '@/fingering';
import { AXIS_IDS, computeAxes, diagnose, type AxisId } from '@/metrics/axes';
import { withinDays } from '@/metrics/history';
import type { SessionRecord } from '@/metrics/types';
import { useSettings } from '@/settings/useSettings';
import { useSceneBgm } from '@/sound/useSceneBgm';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { PageHeading } from '../PageHeading';
import { AXIS_INFO } from './labels';
import { RadarChart } from './RadarChart';

type Range = { label: string; days: number | null };
const RANGES: readonly Range[] = [
  { label: '30日', days: 30 },
  { label: '90日', days: 90 },
  { label: '全期間', days: null },
];

/** 6 軸診断。打鍵ログから毎回計算する（保存しない）。テーマがあれば、作品の言葉（系統など）で見せる */
export function DiagnosisScreen() {
  const navigate = useNavigate();
  const store = useStore();
  const [settings] = useSettings();
  const theme = resolveTheme(settings.themeId, loadUnlocked());
  const flavor = theme.diagnosis;
  const [loaded, setLoaded] = useState<{ records: SessionRecord[]; now: number } | null>(null);
  const [range, setRange] = useState<Range>(RANGES[2] as Range);
  useSceneBgm('stage');

  useEffect(() => {
    let cancelled = false;
    store.list().then((records) => !cancelled && setLoaded({ records, now: Date.now() }));
    return () => {
      cancelled = true;
    };
  }, [store]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) navigate(theme.title ? '/title' : '/stats');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, theme.title]);

  const layout = LAYOUTS[settings.layout];
  const axes = useMemo(() => {
    const records = loaded ? withinDays(loaded.records, range.days, loaded.now) : [];
    return computeAxes(records, (c) => locate(layout, c)?.key.finger ?? null);
  }, [loaded, range, layout]);
  const diagnosis = useMemo(() => diagnose(axes), [axes]);

  const kinds = flavor ? (Object.fromEntries(AXIS_IDS.map((id) => [id, flavor.axes[id].kind])) as Record<AxisId, string>) : undefined;
  const name = (id: AxisId) => `${AXIS_INFO[id].label}${flavor ? `（${flavor.axes[id].kind}）` : ''}`;
  const heading = flavor?.heading ?? '6軸診断';
  const weak = diagnosis ? AXIS_INFO[diagnosis.weakest] : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <PageHeading title={heading} className="text-3xl font-bold" />
        <nav className="flex gap-2">
          <Link to="/stats" className="rounded bg-surface-raised px-4 py-2">
            統計へ
          </Link>
          <Link to={theme.title ? '/title' : '/'} className="rounded bg-surface-raised px-4 py-2">
            {theme.title ? 'タイトルへ（Esc）' : 'ホームへ'}
          </Link>
        </nav>
      </header>

      <p className="text-text-muted">
        {flavor?.intro ?? '打鍵の記録を、6 つの軸で見ます。得意な軸と、伸ばせる軸が分かります。'}
      </p>

      <div role="group" aria-label="集計の期間" className="flex flex-wrap items-center gap-2">
        <span className="text-text-muted">期間</span>
        {RANGES.map((r) => (
          <button
            key={r.label}
            type="button"
            aria-pressed={r.label === range.label}
            onClick={() => setRange(r)}
            className={`rounded border px-3 py-1 ${r.label === range.label ? 'border-accent bg-accent/20 font-bold' : 'border-surface-raised bg-surface-raised'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {!loaded ? (
        <p className="text-text-muted">読み込み中…</p>
      ) : (
        <>
          <RadarChart title="6軸の得点" axes={axes} kinds={kinds} />

          <section aria-labelledby="result" className="flex flex-col gap-3 rounded-lg bg-surface-raised p-4">
            <h2 id="result" className="text-lg font-bold">
              診断の結果
            </h2>
            {diagnosis && weak ? (
              <>
                <p>
                  得意な軸: <strong>{name(diagnosis.strongest)}</strong>
                  {flavor && (
                    <span className="text-text-muted">
                      ・{flavor.axes[diagnosis.strongest].trait}／水見式: {flavor.axes[diagnosis.strongest].ritual}
                    </span>
                  )}
                </p>
                <p>
                  伸ばせる軸: <strong>{name(diagnosis.weakest)}</strong>
                  <span className="text-text-muted">（{weak.measures}）</span>
                </p>
                {flavor && (
                  <p className="text-sm text-text-muted">
                    {`得意な系統から見た伸ばしやすさ（六性図）: ${flavor.affinity[diagnosis.distance]}%（環の距離 ${diagnosis.distance}）。演出であり、学習効果の根拠ではありません。`}
                  </p>
                )}
                <p>{weak.advice}</p>
                <p>
                  <Link to={weak.to} className="text-accent underline">
                    {weak.toLabel}
                  </Link>
                </p>
              </>
            ) : (
              <>
                <p>まだ診断できません。点の求まった軸が 3 つ以上になると診断します（いまは {AXIS_IDS.filter((id) => axes[id].score !== null).length} 軸）。</p>
                <ul className="list-disc pl-6 text-sm text-text-muted">
                  {AXIS_IDS.filter((id) => axes[id].score === null).map((id) => (
                    <li key={id}>
                      {name(id)}: データ不足（{axes[id].sample} / {axes[id].needed}）
                    </li>
                  ))}
                </ul>
                <p>
                  <Link to="/play" className="text-accent underline">
                    練習へ
                  </Link>
                </p>
              </>
            )}
          </section>

          <p className="text-sm text-text-muted">
            これは打鍵の記録を 6 つの軸に整理した「遊び」の診断です。軸の対応づけに、打鍵学習の効果の根拠はありません。点は毎回、記録から計算します（保存しません）。
          </p>
        </>
      )}
    </main>
  );
}
