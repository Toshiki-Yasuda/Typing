import { Link, useParams } from 'react-router';
import { BUILTIN_PACKS } from '@/content';
import { useThemePack } from '@/content/themePack';
import { prefersReducedMotion, resolveEffects } from '@/effects/level';
import { isOpen } from '@/session/stageUnlock';
import { vowEffects } from '@/session/vows';
import { useSettings } from '@/settings/useSettings';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { PageHeading } from './PageHeading';
import { Play } from './Play';
import { useUnlock } from './stage/useUnlock';

/** ボス戦。選んだテーマのボスを、そのボスの出題パックで戦う（弱点を含むお題を優先して出す） */
export function BossRoute() {
  const { id = '' } = useParams();
  const [settings] = useSettings();
  const theme = resolveTheme(settings.themeId, loadUnlocked());
  const boss = theme.bosses?.find((b) => b.id === id);
  // ボス専用の語彙（テーマのパック）があれば優先。読み込めなければ組み込みパックで代替する
  const themed = useThemePack(boss?.pack);
  const builtin = boss ? BUILTIN_PACKS.find((p) => p.id === boss.packId) : undefined;
  const pack = themed.status === 'ready' ? themed.pack : builtin;

  const unlock = useUnlock(theme);
  if (boss && !unlock.ready) return <p className="p-8 text-text-muted">準備中…</p>;
  if (boss && !isOpen(unlock.state, 'boss', boss.id)) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <PageHeading title="このボスはまだ開いていません" srOnly />
        <p>🔒 この章のステージをすべてクリアすると開きます（設定「順番に開放する」がオンです）。</p>
        <Link to="/stages" className="text-accent underline">
          ステージ選択へ
        </Link>
      </main>
    );
  }
  if (boss && themed.status === 'loading') return <p className="p-8 text-text-muted">準備中…</p>;
  if (!boss || !pack) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <PageHeading title="ボスが見つかりません" srOnly />
        <p>このテーマには、そのボスがいません。</p>
        <Link to="/" className="text-accent underline">
          ホームへ
        </Link>
      </main>
    );
  }
  return (
    <Play
      key={boss.id}
      pack={pack}
      count={boss.words}
      adaptive
      mode={`boss:${boss.id}`}
      boss={boss}
      exitTo="/stages"
      effects={{ level: resolveEffects(settings.effects, prefersReducedMotion()), cardModel: theme.hero?.orbiter ?? null }}
      fingerGuide={settings.fingerGuide && vowEffects(settings.vows).fingerGuide ? { layout: settings.layout } : null}
      vows={settings.vows}
      skillsOn={settings.bossSkills}
    />
  );
}
