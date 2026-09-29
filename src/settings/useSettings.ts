import { useCallback, useState } from 'react';
import { loadSettings, saveSettings, type Settings } from './settings';

/** 設定を読み書きするフック。更新のたびに保存する */
export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);
  return [settings, update];
}
