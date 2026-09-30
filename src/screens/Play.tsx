import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { BossBattle, type BattleState } from '@/session/bossBattle';
import { recordBossResult } from '@/session/bossProgress';
import type { Boss } from '@/themes/theme';
import { playOnce } from '@/sound/oneshot';
import { ComboTracker, levelAt } from '@/session/combo';
import { BossFx, type BossFxState } from './boss/BossFx';
import { FeelHud } from './feel/FeelHud';
import { useFeel } from './feel/useFeel';
import { BossHud } from './boss/BossHud';
import { webglAvailable, type EffectLevel } from '@/effects/level';
import { BASIC_PACK, type ContentItem, type ContentPack } from '@/content';
import { isGameKey } from '@/input/keyFilter';
import { bigramWeakness, keyWeakness } from '@/metrics';
import { pickAdaptive } from '@/session/adaptive';
import { plainRecords, vowEffects } from '@/session/vows';
import { REN_LIMIT_MS, remainingMs, type TrainKind } from '@/session/training';
import type { Ghost } from '@/session/ghost';
import { PracticeSession, pickItems } from '@/session/practiceSession';
import type { LayoutId } from '@/fingering';
import { FingerGuide } from './FingerGuide';
import { GhostBar } from './GhostBar';
import { useStore } from '@/app/StoreContext';
import { useGameBgm } from '@/sound/useGameBgm';
import { useSoundPlayer } from '@/sound/useSoundPlayer';
import { PageHeading } from './PageHeading';
import { TargetView } from './TargetView';

/** 画面の見出し（視覚的には隠す）。モードごとに、何の画面かを示す */
const HEADINGS: Record<string, string> = { daily: '今日のチャレンジ', retry: '同じお題でもう一度' };

/** 型の見出し（読み上げ用）。名前は label があればそれ */
const TRAIN_HEADINGS: Record<TrainKind, string> = { zetsu: '修行: 静寂', ren: '修行: 速さ', hatsu: '修行: 弱点' };

/** 演出の長さ（ミリ秒）。登場・フェーズ切替は打鍵を受けたまま重ねる。決着は打鍵が終わった後なので、Enter で飛ばせる */
export const FX_MS = { intro: 3000, phase: 1900, finishFull: 3400, finishReduced: 1600 } as const;

interface Props {
  pack?: ContentPack;
  count?: number;
  /** 過去の記録から弱点を求めて、弱いキーを含むお題を優先する（記録が無ければ均等） */
  adaptive?: boolean;
  /** お題を固定する（デイリー・同じお題の再挑戦）。指定すると、語数・弱点優先・乱数は使わない */
  items?: readonly ContentItem[];
  /** 記録に残すモード。省略なら弱点の有無で adaptive / practice */
  mode?: string;
  /** 次に打つキーと使う指を示す運指ガイド。省略なら表示しない */
  fingerGuide?: { layout: LayoutId } | null;
  /** 並走させる過去の記録 */
  ghost?: { ghost: Ghost; label: string } | null;
  /** 画面の見出し（読み上げ用）。省略ならモードから決める */
  title?: string;
  /** ボス戦。指定すると、ボスの HP・ミスの許容・台詞が加わる（判定・計測は通常の練習と同じ） */
  boss?: Boss;
  /** ボス戦の演出。省略なら演出なし（待ち時間もない）。level が off も同じ */
  effects?: { level: EffectLevel; cardModel: string | null };
  /** 修行の型。絶は音・演出を出さず、練は制限時間で終わる。判定・計測は通常の練習と同じ */
  train?: { kind: TrainKind; /** 画面に出す型の名前や技の名前 */ label?: string; limitMs?: number };
  /** 補助（表示だけ）。gyo=弱点キーの強調、en=次のお題の先読み */
  aids?: { gyo: boolean; en: boolean };
  /** 縛り（制約と誓約）。ステージ・ボス戦だけで渡す。表示と終わり方に作用し、判定・計測は変えない（docs/spec/vows.md） */
  vows?: readonly string[];
  random?: () => number;
}

export function Play({
  pack = BASIC_PACK,
  count = 10,
  adaptive = true,
  items: fixedItems,
  mode,
  ghost = null,
  fingerGuide = null,
  title,
  boss,
  effects,
  train,
  aids,
  vows,
  random,
}: Props) {
  const navigate = useNavigate();
  const store = useStore();
  const [session, setSession] = useState<PracticeSession | null>(null);
  const quiet = train?.kind === 'zetsu';
  const limitMs = train?.kind === 'ren' ? (train.limitMs ?? REN_LIMIT_MS) : null;
  const vowKey = (vows ?? []).join(',');
  const eff = useMemo(() => vowEffects(vowKey ? vowKey.split(',') : []), [vowKey]);
  const silent = !eff.sound;
  const soundPlayer = useSoundPlayer();
  const sound = quiet || silent ? null : soundPlayer;
  const [weakKeys, setWeakKeys] = useState<ReadonlySet<string> | null>(null);
  const [remaining, setRemaining] = useState<number | null>(limitMs);
  const finishing = useRef(false);
  const battle = useRef<BossBattle | null>(null);
  const [bossLine, setBossLine] = useState('');
  const [battleState, setBattleState] = useState<BattleState | null>(null);

  // ボス戦の演出。level は途中で変わらないが、effect の依存を増やさないよう ref に写す
  const level = effects?.level ?? 'off';
  const levelRef = useRef<EffectLevel>(level);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);
  // 決着の 3D は、戦闘の始まりに先読みする（決着の瞬間に読み込むと、演出に間に合わない）
  const cardModel = effects?.cardModel ?? null;
  useEffect(() => {
    if (!boss || level === 'off' || !cardModel || !webglAvailable()) return;
    void import('./boss/BurstScene');
    fetch(new URL(cardModel, document.baseURI)).catch(() => {});
  }, [boss, level, cardModel]);
  // 打鍵の手応え（コンボの段階）。描画・効果音だけで、判定・計測には関わらない
  const themeFeel = useFeel();
  const feel = useMemo(
    () => (quiet ? null : silent && themeFeel ? { ...themeFeel, cue: null } : themeFeel),
    [quiet, silent, themeFeel],
  );
  const feelRef = useRef(feel);
  useEffect(() => {
    feelRef.current = feel;
  }, [feel]);
  const tracker = useRef<ComboTracker | null>(null);
  const [combo, setCombo] = useState(0);
  const [pop, setPop] = useState<{ name: string; n: number } | null>(null);
  const popTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(popTimer.current), []);
  const [fx, setFx] = useState<BossFxState | null>(null);
  // 練習中の BGM（設定に従う）。決着の演出に入ったらフェードアウト
  useGameBgm({ isBoss: !!boss, phase: battleState?.phase ?? null, ended: quiet || silent || fx?.kind === 'won' || fx?.kind === 'lost' });
  const fxTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** 決着の演出を閉じて先へ進む関数（決着の演出中だけ入る） */
  const skip = useRef<(() => void) | null>(null);
  const showFx = useCallback((next: BossFxState, ms: number) => {
    clearTimeout(fxTimer.current);
    setFx(next);
    fxTimer.current = setTimeout(() => setFx(null), ms);
  }, []);
  useEffect(() => () => clearTimeout(fxTimer.current), []);

  // 過去の記録から弱点を求め、弱いキーを含むお題が出やすいように選ぶ（記録が無ければ均等）
  useEffect(() => {
    let cancelled = false;
    store.list().then((all) => {
      if (cancelled) return;
      const records = plainRecords(all); // 縛り付きの記録は、弱点に数えない
      const weakness = adaptive ? keyWeakness(records.map((r) => r.keystrokes)) : new Map<string, number>();
      // 補助（凝）: 弱点の上位のキー
      if (aids?.gyo) {
        const top = [...keyWeakness(records.map((r) => r.keystrokes))].filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
        setWeakKeys(new Set(top.map(([k]) => k)));
      } else setWeakKeys(null);
      const bigrams = adaptive ? bigramWeakness(records.map((r) => r.keystrokes)) : undefined;
      const items =
        fixedItems ??
        (weakness.size > 0
          ? pickAdaptive(pack.items, count, weakness, { bigrams, random })
          : pickItems(pack.items, count, random));
      tracker.current = feelRef.current ? new ComboTracker(feelRef.current.levels) : null;
      setCombo(0);
      battle.current = boss ? new BossBattle({ words: items.length, maxMisses: Math.min(boss.maxMisses, eff.maxMisses ?? boss.maxMisses) }) : null;
      setBossLine(boss?.intro ?? '');
      setBattleState(battle.current?.state() ?? null);
      setSession(
        new PracticeSession(items, performance.now(), {
          id: crypto.randomUUID(),
          startedAt: Date.now(),
          mode: mode ?? (weakness.size > 0 ? 'adaptive' : 'practice'),
          contentId: pack.id,
          ...(vowKey ? { vows: vowKey.split(',') } : {}),
        }),
      );
      if (boss && levelRef.current !== 'off') showFx({ kind: 'intro' }, FX_MS.intro);
    });
    return () => {
      cancelled = true;
    };
  }, [store, pack, count, adaptive, fixedItems, mode, boss, random, showFx, aids?.gyo, vowKey, eff.maxMisses]);
  // 練: 制限時間。残りは注入した経過時間（セッション開始からの経過）から求める。0 になったら、そこまでの記録で終える
  const endRun = useCallback(() => {
    if (!session || finishing.current) return;
    finishing.current = true;
    if (session.keystrokes.length === 0) return navigate('/train');
    const record = session.toRecord();
    store.add(record).then(
      () => navigate(`/result/${record.id}`),
      (error) => console.error('記録の保存に失敗しました', error),
    );
  }, [session, store, navigate]);
  useEffect(() => {
    if (!session || limitMs === null) return;
    const tick = () => {
      const left = remainingMs(0, session.elapsedMs(performance.now()), limitMs);
      setRemaining(left);
      if (left === 0) endRun();
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [session, limitMs, endRun]);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [missing, setMissing] = useState(false);
  const [imeWarning, setImeWarning] = useState(false);
  // ウィンドウが非アクティブの間は、キーがページに届かない。ポーズはせず（3秒超の休止は速度から除かれる）、案内だけ出す。
  // 初期値は「アクティブ」とみなす（document.hasFocus() は環境によって不正確なため、イベントだけで切り替える）
  const [focused, setFocused] = useState(true);
  const missTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const onBlur = () => setFocused(false);
    const onFocus = () => setFocused(true);
    const onVisibility = () => setFocused(!document.hidden);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate('/');
        return;
      }
      // 決着の演出中: Enter・Space で先へ進む。打鍵としては扱わない
      if (skip.current) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          skip.current();
        }
        return;
      }
      // IME が変換中のときは keydown が実キーを持たない。警告を出して、打鍵としては扱わない
      if (e.isComposing || e.keyCode === 229) setImeWarning(true);
      if (!isGameKey(e)) return;
      // 練: 時間切れの後の打鍵は記録しない
      if (limitMs !== null && remainingMs(0, session.elapsedMs(e.timeStamp), limitMs) === 0) {
        e.preventDefault();
        endRun();
        return;
      }
      e.preventDefault(); // Space のスクロールや ' / のクイック検索を止める
      setImeWarning(false);

      // 終わった後（時間切れ・縛りの破れ・敗北の保存中）の打鍵は受けない
      if (finishing.current) return;
      if (battle.current && battle.current.state().status === 'lost') return;
      const result = session.press({ key: e.key, code: e.code }, e.timeStamp);
      const fight = battle.current;
      const f = feelRef.current;
      if (tracker.current && f) {
        const { entered } = tracker.current.apply(result);
        setCombo(tracker.current.combo);
        // 段階が上がった瞬間: 名前を出し、決定音を 1 回鳴らす（演出オフでは出さない）
        if (entered && f.effect !== 'off') {
          setPop((prev) => ({ name: entered.name, n: (prev?.n ?? 0) + 1 }));
          clearTimeout(popTimer.current);
          popTimer.current = setTimeout(() => setPop(null), 1400);
          if (f.cue) playOnce(f.cue.url, f.cue.volume);
        }
      }
      if (fight && boss) {
        const { phaseChanged } = fight.apply(result);
        setBattleState(fight.state());
        if (phaseChanged) {
          const line = boss.phaseMessages[phaseChanged - 2] ?? '';
          setBossLine(line);
          if (levelRef.current !== 'off') showFx({ kind: 'phase', phase: phaseChanged, line }, FX_MS.phase);
        }
        else if (result === 'wordDone') setBossLine(boss.dialogues[session.view().index % boss.dialogues.length] ?? '');
        else if (result === 'sessionDone') setBossLine(boss.defeat);
      }
      // 縛り「ミスなし」（ボス戦以外）: ミスをしたら、そこまでの記録で終わる。ボス戦は許容 0 の敗北になる
      if (result === 'miss' && eff.maxMisses === 0 && !boss) {
        endRun();
        return;
      }
      if (result === 'miss') {
        setMissing(true);
        clearTimeout(missTimer.current);
        missTimer.current = setTimeout(() => setMissing(false), 160);
      }
      const lost = fight?.state().status === 'lost';
      if (result === 'sessionDone' || lost) {
        const record = session.toRecord();
        const rank = fight?.rank() ?? null;
        store.add(record).then(
          () => {
            if (fight && boss && rank) {
              recordBossResult(boss.id, rank);
              const s = fight.state();
              const go = () => {
                skip.current = null;
                clearTimeout(fxTimer.current);
                navigate(`/result/${record.id}`, {
                  state: { boss: { id: boss.id, rank, misses: s.misses, maxCombo: s.maxCombo } },
                });
              };
              const lvl = levelRef.current;
              if (lvl === 'off') return go();
              // 決着の演出を見せてから結果へ（Enter・クリックで飛ばせる。保存は済んでいる）
              skip.current = go;
              showFx({ kind: rank === 'D' ? 'lost' : 'won', line: rank === 'D' ? (boss.dialogues[0] ?? '') : boss.defeat }, 60_000);
              clearTimeout(fxTimer.current);
              fxTimer.current = setTimeout(go, lvl === 'full' ? FX_MS.finishFull : FX_MS.finishReduced);
            } else {
              navigate(`/result/${record.id}`);
            }
          },
          (error) => console.error('記録の保存に失敗しました', error),
        );
      }
      rerender();
      // 音は判定・描画の後に鳴らす（鳴らす処理は軽く、失敗しても練習に影響しない）
      try {
        if (result === 'ok' || result === 'wordDone') sound?.play('type');
        else if (result === 'miss') sound?.play('miss');
        else if (result === 'sessionDone') sound?.play('complete');
      } catch (error) {
        console.error('効果音を鳴らせませんでした', error);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(missTimer.current);
    };
  }, [navigate, session, store, sound, boss, showFx, limitMs, endRun, eff.maxMisses]);

  if (!session) return <p className="p-8 text-text-muted">準備中…</p>;
  const view = session.view();
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 p-8">
      {fx && boss && level !== 'off' && (
        <BossFx boss={boss} fx={fx} level={level} cardModel={cardModel} onSkip={() => skip.current?.()} />
      )}
      <PageHeading title={title ?? (train ? (train.label ?? TRAIN_HEADINGS[train.kind]) : boss ? `ボス戦: ${boss.name}` : (HEADINGS[mode ?? ''] ?? '練習'))} srOnly />
      <header className="flex items-center justify-between text-text-muted">
        {/* 進捗バーの役割は、見える文字（1 / 10）を持つ要素に付ける。バーそのものは装飾 */}
        <div
          role="progressbar"
          aria-label="進捗"
          aria-valuemin={0}
          aria-valuemax={view.total}
          aria-valuenow={view.index}
          aria-valuetext={`${view.total}問中 ${view.index + 1}問目`}
        >
          {view.index + 1} / {view.total}
        </div>
        {train?.label && <span className="font-bold text-text">{train.label}</span>}
        {remaining !== null && (
          <span role="timer" className="font-mono text-lg text-text">
            残り {Math.ceil(remaining / 1000)} 秒
          </span>
        )}
        <span className="text-sm">Esc で中断</span>
      </header>
      <div aria-hidden className="h-1 rounded bg-surface-raised">
        <div className="h-1 rounded bg-accent" style={{ width: `${(view.index / view.total) * 100}%` }} />
      </div>
      {feel && (
        <FeelHud
          combo={combo}
          info={levelAt(feel.levels, combo)}
          reached={pop ? { name: pop.name, animate: feel.effect === 'full' } : null}
        />
      )}
      {!focused && (
        <p role="status" className="rounded bg-surface-raised p-3 text-sm">
          ウィンドウがアクティブではありません。画面をクリックすると、続きから打てます。
        </p>
      )}
      {imeWarning && (
        <p role="status" className="rounded bg-danger/20 p-3 text-sm">
          日本語入力がオンのようです。半角/英数モードに切り替えてください。
        </p>
      )}
      {boss && battleState && <BossHud boss={boss} state={battleState} line={bossLine} />}
      {ghost && <GhostBar ghost={ghost.ghost} session={session} label={ghost.label} />}
      <div
        className={feel && feel.effect !== 'off' ? `feel-aura ${missing && feel.effect === 'full' ? 'feel-shake' : ''}` : ''}
        data-effect={feel?.effect}
        style={feel ? ({ '--aura': levelAt(feel.levels, combo).index / Math.max(1, feel.levels.length - 1) } as CSSProperties) : undefined}
      >
        <TargetView view={view} missing={missing} weakKeys={weakKeys ?? undefined} preview={!!aids?.en} hideRomaji={!eff.showRomaji} />
      </div>
      {fingerGuide && <FingerGuide next={view.guide.rest[0]} layout={fingerGuide.layout} />}
    </main>
  );
}
