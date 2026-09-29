import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { minKeystrokes } from '@/engine';
import { computeMetrics, confusionMatrix, keyStats, type Metrics, type SessionRecord } from '@/metrics';
import { useStore } from '@/app/StoreContext';
import { compareWithBest, type Comparison } from '@/session/retry';

function summarize(record: SessionRecord): Metrics {
  const min = record.targets.reduce((sum, t) => sum + minKeystrokes(t), 0);
  return computeMetrics(record.keystrokes, { minKeystrokes: min });
}

const fmt = (n: number | null, digits = 0) => (n === null ? '—' : n.toFixed(digits));
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
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

export function Result() {
  const { id = '' } = useParams();
  const store = useStore();
  const [record, setRecord] = useState<SessionRecord | null | undefined>(undefined);
  const [comparison, setComparison] = useState<Comparison | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [r, all] = await Promise.all([store.get(id), store.list()]);
      if (cancelled) return;
      setRecord(r ?? null);
      setComparison(r ? compareWithBest(all, r) : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [store, id]);

  if (record === undefined) return <p className="p-8 text-text-muted">読み込み中…</p>;
  if (record === null) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <p>この記録は見つかりませんでした。</p>
        <Link to="/" className="text-accent underline">ホームへ</Link>
      </main>
    );
  }

  const m = summarize(record);
  const weak = [...keyStats(record.keystrokes).values()]
    .filter((k) => k.misses > 0)
    .sort((a, b) => b.misses - a.misses || b.attempts - a.attempts)
    .slice(0, 5);
  const confusions = [...confusionMatrix(record.keystrokes)].flatMap(([expected, row]) =>
    [...row].map(([actual, count]) => ({ expected, actual, count })),
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-8">
      <h1 className="text-2xl font-bold">結果</h1>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="速度（実効）" value={fmt(m.kpm)} unit="打鍵/分" />
        <Stat label="正確率" value={pct(m.accuracy)} />
        <Stat label="一貫性" value={fmt(m.consistency)} />
        <Stat label="打鍵効率" value={pct(m.efficiency)} />
        <Stat label="時間" value={(m.elapsedMs / 1000).toFixed(1)} unit="秒" />
        <Stat label="ミス" value={String(m.misses)} unit="回" />
      </dl>
      <p className="text-sm text-text-muted">
        WPM換算 {fmt(m.wpm, 1)}・raw {fmt(m.rawKpm)} 打鍵/分・総打鍵 {m.total}
        <br />
        速度は、お題の中の打鍵の間隔だけで計算しています（お題の間の待ちは含みません）。
      </p>
      <section aria-labelledby="weak">
        <h2 id="weak" className="mb-2 text-lg font-bold">ミスの多かったキー</h2>
        {weak.length === 0 ? (
          <p className="text-text-muted">ミスはありませんでした。</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {weak.map((k) => (
              <li key={k.key} className="font-mono">
                <span className="text-accent">{k.key}</span>{' '}
                <span className="text-text-muted">{k.misses} / {k.attempts} 回</span>
              </li>
            ))}
          </ul>
        )}
        {confusions.length > 0 && (
          <p className="mt-2 text-sm text-text-muted">
            打ち間違い: {confusions.map((c) => `${c.expected}→${c.actual}(${c.count})`).join('、')}
          </p>
        )}
      </section>
 {comparison && (
        <p role="status" className="rounded-lg bg-surface-raised p-4">
          {comparison.diffKpm > 0
            ? `自己ベスト更新！ 同じお題の過去最高より ${comparison.diffKpm.toFixed(0)} 打鍵/分 速くなりました（${comparison.bestKpm.toFixed(0)} → ${comparison.currentKpm.toFixed(0)}）`
            : `同じお題の過去最高は ${comparison.bestKpm.toFixed(0)} 打鍵/分（今回は ${Math.abs(comparison.diffKpm).toFixed(0)} 遅い）`}
        </p>
      )}
      <nav className="flex flex-wrap gap-4">
        <Link to={`/play?retry=${record.id}`} className="rounded bg-accent px-6 py-3 font-bold text-surface focus-visible:outline-2">
          同じお題でもう一度
        </Link>
        <Link to="/play" className="rounded bg-surface-raised px-6 py-3">
          新しいお題で練習
        </Link>
        <Link to="/" className="rounded bg-surface-raised px-6 py-3">ホーム</Link>
      </nav>
    </main>
  );
}
