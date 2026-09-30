import { Link, useParams } from 'react-router';
import { useThemePack } from '@/content/themePack';
import { vowEffects } from '@/session/vows';
import { stageMode } from '@/session/stageProgress';
import { useSettings } from '@/settings/useSettings';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { PageHeading } from '../PageHeading';
import { Play } from '../Play';

/** ステージの練習。ステージの語彙パックを読み込み、設定の語数・弱点優先で出題する。記録のモードは stage:<id> */
export function StageRoute() {
  const { id = '' } = useParams();
  const [settings] = useSettings();
  const theme = resolveTheme(settings.themeId, loadUnlocked());
  const stage = theme.chapters?.flatMap((c) => c.stages).find((s) => s.id === id);
  const state = useThemePack(stage?.pack);
  const vows = settings.vows;

  if (!stage || state.status === 'error') {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <PageHeading title={stage ? 'ステージを読み込めません' : 'ステージが見つかりません'} srOnly />
        <p>{stage ? 'ステージの語彙を読み込めませんでした。' : 'このテーマには、そのステージがありません。'}</p>
        <Link to="/stages" className="text-accent underline">
          ステージ選択へ
        </Link>
      </main>
    );
  }
  if (state.status !== 'ready') return <p className="p-8 text-text-muted">準備中…</p>;
  return (
    <Play
      key={stage.id}
      pack={state.pack}
      count={settings.count}
      adaptive={settings.adaptive}
      mode={stageMode(stage.id)}
      fingerGuide={settings.fingerGuide && vowEffects(vows).fingerGuide ? { layout: settings.layout } : null}
      vows={vows}
      title={`ステージ: ${stage.name}`}
    />
  );
}
