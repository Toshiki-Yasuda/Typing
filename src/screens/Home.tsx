import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { minKeystrokes } from '@/engine';
import { computeMetrics, currentStreak, dayKey, rankStatus, summarizeSessions, type SessionRecord, type SessionSummary } from '@/metrics';
import { todaysChallenge } from '@/session/daily';
import { ImportError, exportSessions, parseExport } from '@/storage';
import { useStore } from '@/app/StoreContext';
import { AudioSettings } from './home/AudioSettings';
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
import { plainRecords } from '@/session/vows';
import { RankCard } from './RankPanel';
import { RecommendationNote } from './train/RecommendationNote';
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
  const [streak, setStreak] = useState(0);
  const [total, setTotal] = useState(0);
  const [settings, updateSettings] = useSettings();
  const custom = useCustomPacks();
  const theme = resolveTheme(settings.themeId, loadUnlocked());
  const bosses = theme.bosses;
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = () =>
    store.list().then((all) => {
      setHistory(all.slice(-10).reverse());
      setSummaries(summarizeSessions(plainRecords(all))); // 縛り付きは級位・提案に数えない
      setTotal(all.length);
      setStreak(currentStreak(all.map((r) => dayKey(r.startedAt)), dayKey(Date.now())));
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

  const maxKpm = Math.max(1, ...history.map((r) => computeMetrics(r.keystrokes).kpm));
  const rank = rankStatus(summaries);

  return (
    <div className="home-bg min-h-dvh">
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-10 sm:px-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <PageHeading title="Typing" home className="text-5xl font-extrabold tracking-tight sm:text-6xl" />
          <p className="max-w-xl text-text-muted">
            {theme.strings.tagline ?? '日本語ローマ字入力を、正しく測って、弱点から鍛える。'}
          </p>
        </header>

        <HeroBanner theme={theme} effects={settings.effects} />

        <section aria-label="はじめる" className="flex flex-col items-center gap-4">
          <Link to="/play" className="btn-primary focus-visible:outline-2">
            練習を始める（Enter）
          </Link>
          <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
            <Link to="/train" className="tile-link" aria-label="修行（型を選んで練習）" aria-describedby="hint-train">
              <span className="font-bold">修行（型を選んで練習）</span>
              <small id="hint-train">静寂・速さ・弱点。ミスなし／60 秒／苦手だけ</small>
            </Link>
            {theme.license && (
              <Link to="/license" className="tile-link" aria-label={theme.license.heading} aria-describedby="hint-license">
                <span className="font-bold">{theme.license.heading}</span>
                <small id="hint-license">名前・級位・戦績のカード</small>
              </Link>
            )}
            {theme.codex && (
              <Link to="/codex" className="tile-link" aria-label={theme.codex.heading} aria-describedby="hint-codex">
                <span className="font-bold">{theme.codex.heading}</span>
                <small id="hint-codex">出会った語と習熟。人物・能力・道具・場所・組織</small>
              </Link>
            )}
            <Link to="/stats" className="tile-link" aria-label="統計を見る" aria-describedby="hint-stats">
              <span className="font-bold">統計を見る</span>
              <small id="hint-stats">推移・キー別の弱点・時間帯・級位</small>
            </Link>
          </div>
        </section>

        <dl aria-label="いまの状況" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="stat-tile">
            <dt>現在の級位</dt>
            <dd>{rank.rank ? rank.rank.label : '—'}</dd>
          </div>
          <div className="stat-tile">
            <dt>直近の速度（中央値）</dt>
            <dd>
              {rank.basisKpm !== null ? Math.round(rank.basisKpm) : '—'}
              <span className="ml-1 text-sm font-normal text-text-muted">打鍵/分</span>
            </dd>
          </div>
          <div className="stat-tile">
            <dt>連続練習</dt>
            <dd>
              {streak}
              <span className="ml-1 text-sm font-normal text-text-muted">日</span>
            </dd>
          </div>
          <div className="stat-tile">
            <dt>記録の数</dt>
            <dd>
              {total}
              <span className="ml-1 text-sm font-normal text-text-muted">回</span>
            </dd>
          </div>
        </dl>

        <RecommendationNote summaries={summaries} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {daily && (
            <section aria-labelledby="daily" className="card flex flex-col gap-3">
              <h2 id="daily" className="card-title">
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
              <Link to="/daily" className="btn-primary self-start !px-6 !py-2 !text-base focus-visible:outline-2">
                {daily.attempts === 0 ? '挑戦する' : 'もう一度挑戦する（自己ベストと並走）'}
              </Link>
            </section>
          )}
          <RankCard summaries={summaries} goalId={settings.goalRank} />
        </div>

        {bosses && bosses.length > 0 && <BossList bosses={bosses} />}

        <section aria-labelledby="history" className="card flex flex-col gap-3">
          <h2 id="history" className="card-title">
            最近の記録
          </h2>
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
                    <Link
                      to={`/result/${r.id}`}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-lg p-2 hover:bg-accent/10 sm:grid-cols-[13rem_1fr_auto_auto]"
                    >
                      <span className="text-sm text-text-muted">{new Date(r.startedAt).toLocaleString('ja-JP')}</span>
                      <span aria-hidden className="kpm-bar order-last col-span-2 sm:order-none sm:col-span-1">
                        <span style={{ width: `${(m.kpm / maxKpm) * 100}%` }} />
                      </span>
                      <span className="font-bold">{m.kpm.toFixed(0)} 打鍵/分</span>
                      <span className="w-16 text-right text-text-muted">{(m.accuracy * 100).toFixed(1)}%</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">設定とデータ</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-6">
              <PracticeSettings settings={settings} update={updateSettings} customPacks={custom.packs} />
              <CustomPacks packs={custom.packs} state={custom.state} onImport={custom.importFile} onRemove={custom.remove} />
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <ThemeSettings themeId={settings.themeId} effects={settings.effects} onChosen={(t) => t.title && navigate('/title', { state: { opening: true } })} update={updateSettings} />
              {theme.audio && <AudioSettings settings={settings} update={updateSettings} audio={theme.audio} />}
              <section aria-labelledby="data" className="card flex flex-col gap-3">
                <h2 id="data" className="card-title">
                  データ
                </h2>
                <p className="text-sm text-text-muted">
                  記録はこのブラウザにだけ保存されます。ブラウザのデータを消すと失われるので、定期的に書き出してください。
                </p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={onExport} className="tile-link !flex-row !px-4 !py-2">
                    記録を書き出す
                  </button>
                  <button type="button" onClick={() => fileInput.current?.click()} className="tile-link !flex-row !px-4 !py-2">
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
