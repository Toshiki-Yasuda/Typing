import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSettings } from '@/settings/useSettings';
import { useSceneBgm } from '@/sound/useSceneBgm';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { AudioSettings } from './home/AudioSettings';
import { PracticeSettings } from './home/PracticeSettings';
import { ThemeSettings } from './home/ThemeSettings';
import { useCustomPacks } from './home/useCustomPacks';
import { PageHeading } from './PageHeading';

/** 設定画面。テーマ・音・演出・練習の設定を 1 か所に集める（ホームの設定と同じ部品） */
export function SettingsScreen() {
  const navigate = useNavigate();
  const [settings, update] = useSettings();
  const custom = useCustomPacks();
  const theme = resolveTheme(settings.themeId, loadUnlocked());
  const back = theme.title ? '/title' : '/';
  useSceneBgm('stage');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) navigate(back);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, back]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-8">
      <header className="flex items-center justify-between">
        <PageHeading title="設定" className="text-3xl font-bold" />
        <Link to={back} className="rounded bg-surface-raised px-4 py-2">
          {theme.title ? 'タイトルへ戻る（Esc）' : 'ホームへ戻る（Esc）'}
        </Link>
      </header>
      <ThemeSettings
        themeId={settings.themeId}
        effects={settings.effects}
        onChosen={(t) => t.title && navigate('/title', { state: { opening: true } })}
        update={update}
      />
      {theme.audio && <AudioSettings settings={settings} update={update} audio={theme.audio} />}
      <PracticeSettings settings={settings} update={update} customPacks={custom.packs} />
    </main>
  );
}
