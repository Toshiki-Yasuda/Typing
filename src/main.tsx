import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { loadSettings } from '@/settings/settings';
import { applySavedTheme } from '@/themes/apply';
import '@/index.css';

applySavedTheme(loadSettings().themeId);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
