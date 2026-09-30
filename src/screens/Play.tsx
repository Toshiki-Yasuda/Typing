import { useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { BossBattle, type BattleState } from '@/session/bossBattle';
import { recordBossResult } from '@/session/bossProgress';
import type { Boss } from '@/themes/theme';
import { BossHud } from './boss/BossHud';
import { BASIC_PACK, type ContentItem, type ContentPack } from '@/content';
import { isGameKey } from '@/input/keyFilter';
import { bigramWeakness, keyWeakness } from '@/metrics';
import { pickAdaptive } from '@/session/adaptive';
import type { Ghost } from '@/session/ghost';
import { PracticeSession, pickItems } from '@/session/practiceSession';
import type { LayoutId } from '@/fingering';
import { FingerGuide } from './FingerGuide';
import { GhostBar } from './GhostBar';
import { useStore } from '@/app/StoreContext';
import { useSoundPlayer } from '@/sound/useSoundPlayer';
import { PageHeading } from './PageHeading';
import { TargetView } from './TargetView';

/** 画面の見出し（視覚的には隠す）。モードごとに、何の画面かを示す */
const HEADINGS: Record<string, string> = { daily: '今日のチャレンジ', retry: '同じお題でもう一度' };

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
  /** ボス戦。指定すると、ボスの HP・ミスの許容・台詞が加わる（判定・計測は通常の練習と同じ） */
  boss?: Boss;
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
  boss,
  random,
}: Props) {
  const navigate = useNavigate();
  const store = useStore();
  const [session, setSession] = useState<PracticeSession | null>(null);
  const sound = useSoundPlayer();
  const battle = useRef<BossBattle | null>(null);
  const [bossLine, setBossLine] = useState('');
  const [battleState, setBattleState] = useState<BattleState | null>(null);

  // 過去の記録から弱点を求め、弱いキーを含むお題が出やすいように選ぶ（記録が無ければ均等）
  useEffect(() => {
    let cancelled = false;
    store.list().then((records) => {
      if (cancelled) return;
      const weakness = adaptive ? keyWeakness(records.map((r) => r.keystrokes)) : new Map<string, number>();
      const bigrams = adaptive ? bigramWeakness(records.map((r) => r.keystrokes)) : undefined;
      const items =
        fixedItems ??
        (weakness.size > 0
          ? pickAdaptive(pack.items, count, weakness, { bigrams, random })
          : pickItems(pack.items, count, random));
      battle.current = boss ? new BossBattle({ words: items.length, maxMisses: boss.maxMisses }) : null;
      setBossLine(boss?.intro ?? '');
      setBattleState(battle.current?.state() ?? null);
      setSession(
        new PracticeSession(items, performance.now(), {
          id: crypto.randomUUID(),
          startedAt: Date.now(),
          mode: mode ?? (weakness.size > 0 ? 'adaptive' : 'practice'),
          contentId: pack.id,
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [store, pack, count, adaptive, fixedItems, mode, boss, random]);
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
      // IME が変換中のときは keydown が実キーを持たない。警告を出して、打鍵としては扱わない
      if (e.isComposing || e.keyCode === 229) setImeWarning(true);
      if (!isGameKey(e)) return;
      e.preventDefault(); // Space のスクロールや ' / のクイック検索を止める
      setImeWarning(false);

      // 決着後（敗北の保存中）の打鍵は受けない
      if (battle.current && battle.current.state().status === 'lost') return;
      const result = session.press({ key: e.key, code: e.code }, e.timeStamp);
      const fight = battle.current;
      if (fight && boss) {
        const { phaseChanged } = fight.apply(result);
        setBattleState(fight.state());
        if (phaseChanged) setBossLine(boss.phaseMessages[phaseChanged - 2] ?? '');
        else if (result === 'wordDone') setBossLine(boss.dialogues[session.view().index % boss.dialogues.length] ?? '');
        else if (result === 'sessionDone') setBossLine(boss.defeat);
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
              navigate(`/result/${record.id}`, {
                state: { boss: { id: boss.id, rank, misses: s.misses, maxCombo: s.maxCombo } },
              });
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
  }, [navigate, session, store, sound, boss]);

  if (!session) return <p className="p-8 text-text-muted">準備中…</p>;
  const view = session.view();
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-8 p-8">
      <PageHeading title={boss ? `ボス戦: ${boss.name}` : (HEADINGS[mode ?? ''] ?? '練習')} srOnly />
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
        <span className="text-sm">Esc で中断</span>
      </header>
      <div aria-hidden className="h-1 rounded bg-surface-raised">
        <div className="h-1 rounded bg-accent" style={{ width: `${(view.index / view.total) * 100}%` }} />
      </div>
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
      <TargetView view={view} missing={missing} />
      {fingerGuide && <FingerGuide next={view.guide.rest[0]} layout={fingerGuide.layout} />}
    </main>
  );
}
