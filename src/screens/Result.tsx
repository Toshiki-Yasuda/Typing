import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { minKeystrokes } from '@/engine';
import { computeMetrics, confusionMatrix, keyStats, summarizeSessions, type Metrics, type SessionRecord, type SessionSummary } from '@/metrics';
import { useStore } from '@/app/StoreContext';
import { compareWithBest, type Comparison } from '@/session/retry';
import { useSettings } from '@/settings/useSettings';
import { useSceneBgm } from '@/sound/useSceneBgm';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { BossResultPanel, parseBossOutcome } from './boss/BossResultPanel';
import { hasVows, plainRecords, vowBroken } from '@/session/vows';
import { afterFlow, type FlowInput } from '@/session/afterFlow';
import { chapterAccentStyle, chapterOfBoss } from '@/themes/chapterAccent';
import { AfterActions, AfterKeys } from './AfterActions';
import { parseTrainMode } from '@/session/training';
import { StageResultPanel } from './stage/StageResultPanel';
import { RecommendationNote } from './train/RecommendationNote';
import { VowResultPanel } from './vows/VowResultPanel';
import { isStageCleared } from '@/session/stageProgress';
import { TrainResultPanel } from './train/TrainResultPanel';
import { PageHeading } from './PageHeading';
import { RankPanel } from './RankPanel';

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
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [settings] = useSettings();
  const location = useLocation();
  useSceneBgm(null); // 結果は静か（練習中の曲は決着でフェードアウト済み）

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [r, all] = await Promise.all([store.get(id), store.list()]);
      if (cancelled) return;
      setRecord(r ?? null);
      setComparison(r && !hasVows(r) ? compareWithBest(plainRecords(all), r) : null);
      setSummaries(summarizeSessions(plainRecords(all)));
    })();
    return () => {
      cancelled = true;
    };
  }, [store, id]);

  if (record === undefined) return <p className="p-8 text-text-muted">読み込み中…</p>;
  if (record === null) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <PageHeading title="記録が見つかりません" srOnly />
        <p>この記録は見つかりませんでした。</p>
        <Link to="/" className="text-accent underline">ホームへ</Link>
      </main>
    );
  }

  const outcome = parseBossOutcome(location.state);
  const boss = outcome ? resolveTheme(settings.themeId, loadUnlocked()).bosses?.find((b) => b.id === outcome.id) : undefined;
  const m = summarize(record);
  const theme = resolveTheme(settings.themeId, loadUnlocked());
  const trainKind = parseTrainMode(record.mode);
  const stageId = record.mode.startsWith('stage:') ? record.mode.slice('stage:'.length) : null;
  const stageChapter = stageId ? theme.chapters?.find((c) => c.stages.some((s) => s.id === stageId)) : undefined;
  const stage = stageChapter?.stages.find((s) => s.id === stageId);
  const stageCleared = stage ? isStageCleared(m.accuracy) && !vowBroken(record) : false;
  // 終わった後の動線（docs/spec/flow.md）。ステージ・ボスの結果は、ステージの文脈から出さない
  const chapters = theme.chapters ?? [];
  const bossId = outcome?.id ?? (record.mode.startsWith('boss:') ? record.mode.slice('boss:'.length) : null);
  const bossDef = bossId ? theme.bosses?.find((b) => b.id === bossId) : undefined;
  const bossChapterAt = bossId ? chapters.findIndex((c) => c.boss === bossId) : -1;
  const nextChapterStage = bossChapterAt >= 0 ? chapters[bossChapterAt + 1]?.stages[0] : undefined;
  const nextStage = stageChapter && stage ? stageChapter.stages[stageChapter.stages.findIndex((s) => s.id === stage.id) + 1] : undefined;
  const flowInput: FlowInput = {
    recordId: record.id,
    ...(stageChapter && stage
      ? { stage: { id: stage.id, cleared: stageCleared, next: nextStage ? { id: nextStage.id, name: nextStage.name } : null, bossId: stageChapter.boss ?? null } }
      : {}),
    ...(!stage && bossDef
      ? { boss: { id: bossDef.id, name: bossDef.name, won: outcome ? outcome.rank !== 'D' : null, nextStage: nextChapterStage ? { id: nextChapterStage.id, name: `第${chapters[bossChapterAt + 1]!.number}章 ${nextChapterStage.name}` } : null } }
      : {}),
  };
  const flow = afterFlow(flowInput);
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
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-8" style={chapterAccentStyle(theme, stageChapter ?? (bossId ? chapterOfBoss(theme, bossId) : undefined))}>
      <PageHeading title="結果" className="text-2xl font-bold" />
      {boss && outcome && <BossResultPanel boss={boss} outcome={outcome} />}
      <VowResultPanel record={record} cleared={stageChapter && stage ? stageCleared : null} />
      {trainKind && <TrainResultPanel kind={trainKind} record={record} misses={m.misses} />}
      {stageChapter && stage && <StageResultPanel chapter={stageChapter} stage={stage} accuracy={m.accuracy} cleared={stageCleared} />}
      <AfterKeys flow={flow} />
      {flow.inGame && <AfterActions flow={flow} />}
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
      <RankPanel summaries={summaries} currentId={record.id} goalId={settings.goalRank} />
      <RecommendationNote summaries={summaries.slice(0, summaries.findIndex((s) => s.id === record.id) + 1)} current={summaries.find((s) => s.id === record.id)} />
      {comparison && (
        <p role="status" className="rounded-lg bg-surface-raised p-4">
          {comparison.diffKpm > 0
            ? `自己ベスト更新！ 同じお題の過去最高より ${comparison.diffKpm.toFixed(0)} 打鍵/分 速くなりました（${comparison.bestKpm.toFixed(0)} → ${comparison.currentKpm.toFixed(0)}）`
            : `同じお題の過去最高は ${comparison.bestKpm.toFixed(0)} 打鍵/分（今回は ${Math.abs(comparison.diffKpm).toFixed(0)} 遅い）`}
        </p>
      )}
      {flow.inGame ? (
        <nav aria-label="そのほか" className="flex flex-wrap gap-4">
          <Link to="/" className="rounded bg-surface-raised px-6 py-3">ホーム</Link>
        </nav>
      ) : (
        <nav className="flex flex-wrap gap-4">
          <Link to={flow.primary.to} className="rounded bg-accent px-6 py-3 font-bold text-surface focus-visible:outline-2">
            {flow.primary.label}
          </Link>
          {flow.secondary.map((a) => (
            <Link key={a.to} to={a.to} className="rounded bg-surface-raised px-6 py-3">
              {a.label}
            </Link>
          ))}
        </nav>
      )}
    </main>
  );
}
