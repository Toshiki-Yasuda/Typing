import { themeColors, resolveTheme } from './themes';
import { loadUnlocked } from './unlock';
import { COLOR_TOKENS, type Theme } from './theme';

/** テーマの色を <html> の CSS 変数に反映する（`@theme` の変数を上書きする） */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  const colors = themeColors(theme);
  for (const token of COLOR_TOKENS) root.style.setProperty(`--color-${token}`, colors[token]);
  root.dataset.theme = theme.id;
}

/** 保存された選択を反映する（起動時）。解除していないテーマは中立になる */
export function applySavedTheme(themeId: string): Theme {
  const theme = resolveTheme(themeId, loadUnlocked());
  applyTheme(theme);
  return theme;
}
