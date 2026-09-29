import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { aggregate, currentStreak, dayKey, summarizeSessions, withinDays, type SessionRecord } from '@/metrics';
import { useStore } from '@/app/StoreContext';
import { BarList } from './stats/BarList';
import { KeyboardHeatmap } from './stats/KeyboardHeatmap';
import { LineChart } from './stats/LineChart';

type Range = { label: string; days: number | null };
const RANGES: readonly Range[] = [
  { label: '7日', days: 7 },
  { label: '30日', days: 30 },
  { label: '90日', days: 90 },
  { label: '全期間', days: null },
];

/** 折れ線に出す最大セッション数（多すぎると読めない） */
const MAX_POINTS = 60;
/** 連接の遅延ランキングに入れる最小の回数（少ないと偶然に左右される） */
const MIN_BIGRAM_COUNT = 3;

const dateLabel = (ts: number) => new Date(ts).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg bg-surface-raised p-4">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-3xl font-bold">
        {value}
        {unit && <span className="ml-1 text-base font-normal text-text-muted">{unit}</span>}
      </dd>
    </div>
  );
}

export function Stats() {
  const store = useStore();
  // 読み込んだ時点の時刻を一緒に持つ（描画のたびに Date.now() を呼ぶと、結果が不安定になる）
  const [loaded, setLoaded] = useState<{ records: SessionRecord[]; now: number } | null>(null);
  const [range, setRange] = useState<Range>(RANGES[3] as Range);

  useEffect(() => {
    let cancelled = false;
    store.list().then((records) => !cancelled && setLoaded({ records, now: Date.now() }));
    return () => {
      cancelled = true;
    };
  }, [store]);

  const view = useMemo(() => {
    if (!loaded) return null;
    const { records, now } = loaded;
    const scoped = withinDays(records, range.days, now);
    const summaries = summarizeSessions(scoped);
    const agg = aggregate(scoped);
    const today = dayKey(now);
    return {
      summaries,
      agg,
      streak: currentStreak(records.map((r) => dayKey(r.startedAt)), today),
      keystrokes: summaries.reduce((s, x) => s + x.total, 0),
      best: summaries.reduce((m, x) => Math.max(m, x.kpm), 0),
      accuracy: summaries.length ? summaries.reduce((s, x) => s + x.accuracy, 0) / summaries.length : 0,
    };
  }, [loaded, range]);

  if (!view) return <p className="p-8 text-text-muted">読み込み中…</p>;

  const recent = view.summaries.slice(-MAX_POINTS);
  const slowest = [...view.agg.bigrams.values()]
    .filter((b) => b.count >= MIN_BIGRAM_COUNT)
    .sort((a, b) => b.meanLatencyMs - a.meanLatencyMs)
    .slice(0, 8);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">統計</h1>
        <Link to="/" className="rounded bg-surface-raised px-4 py-2">
          ホーム
        </Link>
      </header>

      <div role="group" aria-label="期間" className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-text-muted">期間</span>
        {RANGES.map((r) => (
          <button
            key={r.label}
            type="button"
            aria-pressed={range === r}
            onClick={() => setRange(r)}
            className={`rounded px-3 py-1 ${range === r ? 'bg-accent text-surface' : 'bg-surface-raised'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {view.summaries.length === 0 ? (
        <section className="rounded-lg bg-surface-raised p-6">
          <p>この期間の記録がありません。</p>
          <Link to="/play" className="text-accent underline">
            練習を始める
          </Link>
        </section>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Tile label="練習した回数" value={String(view.summaries.length)} unit="回" />
            <Tile label="累計打鍵" value={view.keystrokes.toLocaleString('ja-JP')} />
            <Tile label="最高速度" value={view.best.toFixed(0)} unit="打鍵/分" />
            <Tile label="連続日数" value={String(view.streak)} unit="日" />
          </dl>
          <p className="-mt-4 text-sm text-text-muted">連続日数は期間に関わらず、全記録から数えます。</p>

          <LineChart
            title="速度の推移（打鍵/分）"
            valueHeader="打鍵/分"
            points={recent.map((s) => ({ label: dateLabel(s.startedAt), value: s.kpm }))}
            format={(v) => v.toFixed(0)}
            yMin={0}
          />
          <LineChart
            title="正確率の推移"
            valueHeader="正確率"
            points={recent.map((s) => ({ label: dateLabel(s.startedAt), value: s.accuracy * 100 }))}
            format={(v) => `${Number.isInteger(v) ? v : v.toFixed(1)}%`}
            yMax={100}
          />
          <KeyboardHeatmap stats={view.agg.keys} />
          <BarList
            title="遅くなりやすい連接"
            valueHeader="平均遅延"
            rows={slowest.map((b) => ({
              label: [...b.bigram].join('→'),
              value: b.meanLatencyMs,
              detail: `${b.count}回`,
            }))}
            format={(v) => `${Math.round(v)}ms`}
            empty={`回数が ${MIN_BIGRAM_COUNT} 回以上の連接がまだありません。`}
          />
          {view.agg.confusions.length > 0 && (
            <section aria-labelledby="confusions">
              <h2 id="confusions" className="mb-2 text-lg font-bold">
                よくある打ち間違い
              </h2>
              <p className="font-mono text-text-muted">
                {view.agg.confusions
                  .slice(0, 8)
                  .map((c) => `${c.expected}→${c.actual}（${c.count}）`)
                  .join('　')}
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
