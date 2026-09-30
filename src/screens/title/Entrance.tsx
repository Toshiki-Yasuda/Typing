import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useSettings } from '@/settings/useSettings';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { needsEntrance } from './entrance';

/** ホームの手前の関所。入口のあるテーマで、この起動でまだ入口を見ていないなら、先に入口へ送る */
export function Entrance({ children }: { children: ReactNode }) {
  const [settings] = useSettings();
  const theme = resolveTheme(settings.themeId, loadUnlocked());
  return needsEntrance(theme) ? <Navigate to="/title" replace /> : <>{children}</>;
}
