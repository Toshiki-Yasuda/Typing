import { lazy, Suspense, useCallback, useEffect, useReducer } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { prefersReducedMotion, resolveEffects, webglAvailable, type EffectLevel } from '@/effects/level';
import { useSettings } from '@/settings/useSettings';
import { getBgm } from '@/sound/bgm';
import { playOnce } from '@/sound/oneshot';
import { bgmUrl } from '@/sound/useSceneBgm';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import type { Theme } from '@/themes/theme';
import { PageHeading } from '../PageHeading';
import { entranceSeen, markEntranceSeen } from './entrance';
import { BURST_MS, initialPhase, nextPhase, type OpeningEvent } from './opening';

// 3D のカードが弾ける演出は大きいので、オープニングのときだけ読み込む
const BurstScene = lazy(() => import('../boss/BurstScene'));

/** タイトルメニュー。番号キー（1〜）でも選べる */
const MENU = [
  { to: '/play', label: 'はじめる', hint: '弱点を優先した練習' },
  { to: '/stages', label: 'ステージ選択', hint: '章ごとの語彙・ボス' },
  { to: '/daily', label: '今日のチャレンジ', hint: '日替わりのお題' },
  { to: '/stats', label: '統計', hint: '記録の推移・弱点' },
  { to: '/settings', label: '設定', hint: '音・演出・練習' },
  { to: '/', label: 'ホーム', hint: 'ボス戦・記録・データ' },
] as const;

/** テーマの入口。ゲート → オープニング → タイトルメニュー。入口の無いテーマなら、ホームへ戻す */
export function TitleRoute() {
  const [settings] = useSettings();
  const theme = resolveTheme(settings.themeId, loadUnlocked());
  if (!theme.title) return <Navigate to="/" replace />;
  return <TitleScreen theme={theme} level={resolveEffects(settings.effects, prefersReducedMotion())} />;
}

function TitleScreen({ theme, level }: { theme: Theme; level: EffectLevel }) {
  const navigate = useNavigate();
  const [settings] = useSettings();
  const title = theme.title as NonNullable<Theme['title']>;
  // この起動で入口を見た後に戻ってきたときは、メニューから（他の画面からの戻り）。
  // テーマを選んだ直後（state.opening）と、この起動で初めてのときは、ゲート・オープニングから。
  const { state } = useLocation();
  const replay = !!(state as { opening?: boolean } | null)?.opening;
  const [phase, dispatch] = useReducer(
    (p: ReturnType<typeof initialPhase>, e: OpeningEvent) => nextPhase(p, e, level),
    level,
    (l: EffectLevel) => (!replay && entranceSeen() ? 'title' : initialPhase(l)),
  );
  const music = bgmUrl(theme, 'title');

  useEffect(() => {
    markEntranceSeen();
  }, []);

  // 曲は、ゲートを抜けてから流す（ゲートの操作が、ブラウザに音の再生を許してもらう操作）
  useEffect(() => {
    if (phase === 'gate') return;
    getBgm().setScale(1);
    getBgm().play(music);
  }, [phase, music]);

  // 段階が替わるたびに、操作の起点（ゲート/スキップのボタン、メニューの最初の項目）へフォーカス。
  // 見出しへのフォーカス（PageHeading）より後に行うため、autoFocus ではなくこの画面の effect で行う
  useEffect(() => {
    document.querySelector<HTMLElement>(phase === 'title' ? '[data-menu] a' : '.op-cover')?.focus();
  }, [phase]);

  // オープニングは、時間が来たらタイトルへ
  useEffect(() => {
    if (phase !== 'burst') return;
    const id = setTimeout(() => dispatch('elapsed'), BURST_MS);
    return () => clearTimeout(id);
  }, [phase]);

  const start = useCallback(() => {
    if (settings.sound) playOnce(theme.audio?.stinger, settings.sfxVolume / 100);
    getBgm().unlock();
    dispatch('start');
  }, [settings.sound, settings.sfxVolume, theme.audio?.stinger]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'Escape' && phase !== 'title') return dispatch('skip');
      if (phase !== 'title') return; // ゲート・オープニングの Enter/Space は、フォーカス中のボタンが受ける
      // タイトルメニュー: 番号キーで選ぶ。フォーカス中の操作要素の Enter・Space は奪わない
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= MENU.length) {
        navigate(MENU[n - 1]!.to);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const links = [...document.querySelectorAll<HTMLElement>('[data-menu] a')];
        const at = links.findIndex((el) => el === document.activeElement);
        const next = e.key === 'ArrowDown' ? (at + 1) % links.length : (at - 1 + links.length) % links.length;
        e.preventDefault();
        links[next < 0 ? 0 : next]?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, navigate]);

  const showBurst3d = phase === 'burst' && level === 'full' && !!theme.hero && webglAvailable();

  return (
    <main className="op-root" data-fx={level} data-phase={phase}>
      <div aria-hidden className="op-bg" />
      <PageHeading title={title.heading} srOnly={phase !== 'title'} className="op-heading">
        {title.heading}
        <span className="op-subheading">{title.subheading}</span>
      </PageHeading>

      {phase === 'gate' && (
        <button type="button" className="op-cover" onClick={start}>
          <span className="op-gate-text">Enter またはクリックでスタート</span>
          {theme.audio && <span className="op-gate-note">音が出ます</span>}
        </button>
      )}

      {phase === 'burst' && (
        <>
          <div aria-hidden className="op-flash" />
          {showBurst3d && (
            <div aria-hidden className="op-3d">
              <Suspense fallback={null}>
                <BurstScene model={(theme.hero as NonNullable<Theme['hero']>).orbiter} outcome="won" animate />
              </Suspense>
            </div>
          )}
          <div aria-hidden className="op-burst-title">
            <p className="op-burst-main">{title.heading}</p>
            <p className="op-burst-sub">{title.subheading}</p>
          </div>
          <button type="button" className="op-cover op-skip" onClick={() => dispatch('skip')}>
            <span className="op-skip-text">Enter・Esc・クリックで飛ばす</span>
          </button>
        </>
      )}

      {phase === 'title' && (
        <div className="op-title">
          {title.art && (
            <img className="op-art" src={new URL(title.art, document.baseURI).href} alt={title.artAlt ?? ''} />
          )}
          <nav aria-label="メニュー" data-menu>
            <ul className="op-menu">
              {MENU.map((m, i) => (
                <li key={m.to} style={{ ['--i' as string]: i }}>
                  <Link to={m.to} className="op-menu-item">
                    <span className="op-menu-key" aria-hidden>
                      {i + 1}
                    </span>
                    <span className="op-menu-label">{m.label}</span>
                    <span className="op-menu-hint">{m.hint}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="op-foot">数字キー・↑↓・Enter で選べます</p>
        </div>
      )}
    </main>
  );
}
