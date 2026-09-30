import { Link, useParams } from 'react-router';
import { useThemePack } from '@/content/themePack';
import { isOpen } from '@/session/stageUnlock';
import { vowEffects } from '@/session/vows';
import { stageMode } from '@/session/stageProgress';
import { useSettings } from '@/settings/useSettings';
import { chapterAccentStyle, chapterOfStage } from '@/themes/chapterAccent';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { PageHeading } from '../PageHeading';
import { Play } from '../Play';
import { useUnlock } from './useUnlock';

/** ステージの練習。ステージの語彙パックを読み込み、設定の語数・弱点優先で出題する。記録のモードは stage:<id> */
export function StageRoute() {
  const { id = '' } = useParams();
  const [settings] = useSettings();
  const theme = resolveTheme(settings.themeId, loadUnlocked());
  const stage = theme.chapters?.flatMap((c) => c.stages).find((s) => s.id === id);
  const state = useThemePack(stage?.pack);
  const vows = settings.vows;
  const unlock = useUnlock(theme);

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
  if (!unlock.ready) return <p className="p-8 text-text-muted">準備中…</p>;
  if (!isOpen(unlock.state, 'stage', stage.id)) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <PageHeading title="このステージはまだ開いていません" srOnly />
        <p>🔒 前のステージをクリアすると開きます（設定「順番に開放する」がオンです）。</p>
        <Link to="/stages" className="text-accent underline">
          ステージ選択へ
        </Link>
      </main>
    );
  }
  if (state.status !== 'ready') return <p className="p-8 text-text-muted">準備中…</p>;
  return (
    <div className="contents" style={chapterAccentStyle(theme, chapterOfStage(theme, stage.id))}>
    <Play
      key={stage.id}
      pack={state.pack}
      count={settings.count}
      adaptive={settings.adaptive}
      mode={stageMode(stage.id)}
      fingerGuide={settings.fingerGuide && vowEffects(vows).fingerGuide ? { layout: settings.layout } : null}
      vows={vows}
      exitTo="/stages"
      title={`ステージ: ${stage.name}`}
    />
    </div>
  );
}
