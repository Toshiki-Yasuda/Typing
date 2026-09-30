import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { minKeystrokes } from '@/engine';
import { computeMetrics, dayKey, summarizeSessions, type SessionRecord, type SessionSummary } from '@/metrics';
import { todaysChallenge } from '@/session/daily';
import { ImportError, exportSessions, parseExport } from '@/storage';
import { useStore } from '@/app/StoreContext';
import { HeroBanner } from './home/HeroBanner';
import { BossList } from './home/BossList';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { ThemeSettings } from './home/ThemeSettings';
import { useSettings } from '@/settings/useSettings';
import { useSceneBgm } from '@/sound/useSceneBgm';
import { CustomPacks } from './home/CustomPacks';
import { PracticeSettings } from './home/PracticeSettings';
import { PageHeading } from './PageHeading';
import { RankCard } from './RankPanel';
import { useCustomPacks } from './home/useCustomPacks';

/** Enter を「その要素の操作」に使う要素。tabindex=-1（見出しへのフォーカス）は対象外 */
const INTERACTIVE = 'a[href], button, input, select, textarea, summary, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function Home() {
  const store = useStore();
  const navigate = useNavigate();
  useSceneBgm(null); // ホームは静か（BGM のある画面から来たときは止める）
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);
  const [daily, setDaily] = useState<{ date: string; packName: string; count: number; attempts: number; bestKpm: number | null } | null>(null);
  const [message, setMessage] = useState('');
  const [settings, updateSettings] = useSettings();
  const custom = useCustomPacks();
  const theme = resolveTheme(settings.themeId, loadUnlocked());
  const bosses = theme.bosses;
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = () =>
    store.list().then((all) => {
      setHistory(all.slice(-10).reverse());
      setSummaries(summarizeSessions(all));
      // 今日のチャレンジの状況（日付は読み込み時点のもの。描画中に Date.now() を呼ばない）
      const now = Date.now();
      const challenge = todaysChallenge(now);
      const today = all.filter((r) => r.mode === 'daily' && dayKey(r.startedAt) === challenge.day);
      setDaily({
        date: challenge.day,
        packName: challenge.pack.name,
        count: challenge.items.length,
        attempts: today.length,
        bestKpm: today.length ? Math.max(...today.map((r) => computeMetrics(r.keystrokes).kpm)) : null,
      });
    });
  useEffect(() => {
    void reload();
    // 一覧の再読み込みは store が変わったときだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.isComposing || e.defaultPrevented) return;
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      // ボタン・リンク・入力欄・選択肢などにフォーカスがあるときの Enter は、その要素の操作（押す・開く）。練習は始めない
      if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
      navigate('/play');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  const onExport = async () => {
    download(`typing-${new Date().toISOString().slice(0, 10)}.json`, exportSessions(await store.list()));
  };

  const onImport = async (file: File) => {
    try {
      const added = await store.addMany(parseExport(await file.text()));
      setMessage(`${added} 件を取り込みました`);
      await reload();
    } catch (error) {
      setMessage(error instanceof ImportError ? `取り込めません: ${error.message}` : '取り込みに失敗しました');
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-8">
      <PageHeading title="Typing" home className="text-3xl font-bold" />
      <HeroBanner theme={theme} effects={settings.effects} />
      <Link
        to="/play"
        className="self-start rounded bg-accent px-8 py-4 text-xl font-bold text-surface focus-visible:outline-2"
      >
        練習を始める（Enter）
      </Link>
      <Link to="/stats" className="self-start rounded bg-surface-raised px-4 py-2">
        統計を見る
      </Link>

      {daily && (
        <section aria-labelledby="daily" className="flex flex-col gap-2 rounded-lg bg-surface-raised p-4">
          <h2 id="daily" className="text-lg font-bold">
            今日のチャレンジ
          </h2>
          <p className="text-sm text-text-muted">
            {daily.date}・{daily.packName}・{daily.count}語（日付で固定。設定に関係なく、同じ日は同じお題です）
          </p>
          <p>
            {daily.attempts === 0
              ? '未挑戦'
              : `挑戦済み（${daily.attempts}回・最高 ${daily.bestKpm?.toFixed(0)} 打鍵/分）`}
          </p>
          <Link to="/daily" className="self-start rounded bg-accent px-6 py-2 font-bold text-surface focus-visible:outline-2">
            {daily.attempts === 0 ? '挑戦する' : 'もう一度挑戦する（自己ベストと並走）'}
          </Link>
        </section>
      )}

      <RankCard summaries={summaries} goalId={settings.goalRank} />

      {bosses && bosses.length > 0 && <BossList bosses={bosses} />}

      <ThemeSettings themeId={settings.themeId} sound={settings.sound} effects={settings.effects} onChosen={(t) => t.title && navigate('/title')} update={updateSettings} />

      <PracticeSettings settings={settings} update={updateSettings} customPacks={custom.packs} />

      <section aria-labelledby="history">
        <h2 id="history" className="mb-2 text-lg font-bold">最近の記録</h2>
        {history.length === 0 ? (
          <p className="text-text-muted">まだ記録がありません。</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {history.map((r) => {
              const m = computeMetrics(r.keystrokes, {
                minKeystrokes: r.targets.reduce((sum, t) => sum + minKeystrokes(t), 0),
              });
              return (
                <li key={r.id}>
                  <Link to={`/result/${r.id}`} className="flex gap-4 rounded p-2 hover:bg-surface-raised">
                    <span className="text-text-muted">{new Date(r.startedAt).toLocaleString('ja-JP')}</span>
                    <span>{m.kpm.toFixed(0)} 打鍵/分</span>
                    <span>{(m.accuracy * 100).toFixed(1)}%</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <CustomPacks packs={custom.packs} state={custom.state} onImport={custom.importFile} onRemove={custom.remove} />

      <section aria-labelledby="data" className="flex flex-col gap-2">
        <h2 id="data" className="text-lg font-bold">データ</h2>
        <p className="text-sm text-text-muted">
          記録はこのブラウザにだけ保存されます。ブラウザのデータを消すと失われるので、定期的に書き出してください。
        </p>
        <div className="flex gap-4">
          <button type="button" onClick={onExport} className="rounded bg-surface-raised px-4 py-2">
            記録を書き出す
          </button>
          <button type="button" onClick={() => fileInput.current?.click()} className="rounded bg-surface-raised px-4 py-2">
            記録を取り込む
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            aria-label="取り込むファイル"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImport(file);
              e.target.value = '';
            }}
          />
        </div>
        {message && <p role="status">{message}</p>}
      </section>
    </main>
  );
}
