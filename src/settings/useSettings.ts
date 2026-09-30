import { useSyncExternalStore } from 'react';
import { loadSettings, saveSettings, SETTINGS_KEY, type Settings } from './settings';

/**
 * 設定は、全画面で 1 つを共有する（音量を設定画面で変えたら、BGM がすぐ変わるように）。
 * 保存先は localStorage。値は保存文字列が変わったときだけ読み直す（テストやほかのタブの変更にも追従する）。
 */
const listeners = new Set<() => void>();
let lastRaw: string | null | undefined;
let lastValue: Settings | undefined;

function readRaw(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(SETTINGS_KEY);
  } catch {
    return null;
  }
}

function snapshot(): Settings {
  const raw = readRaw();
  if (lastValue === undefined || raw !== lastRaw) {
    lastRaw = raw;
    lastValue = loadSettings();
  }
  return lastValue;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function update(patch: Partial<Settings>): void {
  const next = { ...snapshot(), ...patch };
  saveSettings(next);
  // 保存できない環境（プライベートモード等）でも、この画面の間は変更を保つ
  lastRaw = readRaw();
  lastValue = next;
  listeners.forEach((l) => l());
}

/** 設定を読み書きするフック。更新のたびに保存し、全画面に反映する */
export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const settings = useSyncExternalStore(subscribe, snapshot, snapshot);
  return [settings, update]; // update はモジュールの関数で、常に同じ参照
}
