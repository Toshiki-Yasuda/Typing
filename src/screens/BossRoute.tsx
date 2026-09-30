import { Link, useParams } from 'react-router';
import { BUILTIN_PACKS } from '@/content';
import { useThemePack } from '@/content/themePack';
import { prefersReducedMotion, resolveEffects } from '@/effects/level';
import { vowEffects } from '@/session/vows';
import { useSettings } from '@/settings/useSettings';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { PageHeading } from './PageHeading';
import { Play } from './Play';

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
      effects={{ level: resolveEffects(settings.effects, prefersReducedMotion()), cardModel: theme.hero?.orbiter ?? null }}
      fingerGuide={settings.fingerGuide && vowEffects(settings.vows).fingerGuide ? { layout: settings.layout } : null}
      vows={settings.vows}
    />
  );
}
