import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSettings } from '@/settings/useSettings';
import { useSceneBgm } from '@/sound/useSceneBgm';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { PageHeading } from '../PageHeading';
import { KIND_INFO, trainLabels } from './labels';

/** 修行の入口。型を選ぶ。どの型も、判定・計測は通常の練習と同じ（出題・終わり方・表示が違う） */
export function TrainScreen() {
  const navigate = useNavigate();
  const [settings] = useSettings();
  const theme = resolveTheme(settings.themeId, loadUnlocked());
  const labels = trainLabels(theme);
  useSceneBgm('stage');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) navigate(theme.title ? '/title' : '/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, theme.title]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <PageHeading title="修行" className="text-3xl font-bold" />
        <Link to={theme.title ? '/title' : '/'} className="rounded bg-surface-raised px-4 py-2">
          {theme.title ? 'タイトルへ（Esc）' : 'ホームへ'}
        </Link>
      </header>
      <p className="text-text-muted">型を選んで練習します。打鍵の判定と計測は、いつもの練習と同じです。記録は統計にも入ります。</p>
      <ul className="flex flex-col gap-3">
        {KIND_INFO.map((info) => (
          <li key={info.kind}>
            <Link
              to={`/train/${info.kind}`}
              className="flex flex-col gap-1 rounded-lg bg-surface-raised p-4 focus-visible:outline-2"
            >
              <span className="text-xl font-bold">{labels.names[info.kind]}</span>
              <span>{info.summary}</span>
              <span className="text-sm text-text-muted">結果で見るもの: {info.measure}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm text-text-muted">
        補助（{labels.aids.gyo}・{labels.aids.en}）は、設定で切り替えます。表示だけで、判定には影響しません。
      </p>
    </main>
  );
}
