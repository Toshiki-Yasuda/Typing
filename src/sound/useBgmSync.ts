import { useEffect } from 'react';
import { useSettings } from '@/settings/useSettings';
import { getBgm } from './bgm';

/**
 * アプリ全体で 1 度だけ使う。設定（BGM の入切・音量）を再生器に反映し、
 * ページの表示/非表示と、最初のユーザー操作（自動再生の許可）を再生器に伝える。
 */
export function useBgmSync(): void {
  const [settings] = useSettings();

  useEffect(() => {
    const bgm = getBgm();
    bgm.setEnabled(settings.bgm);
    bgm.setVolume(settings.bgmVolume / 100);
  }, [settings.bgm, settings.bgmVolume]);

  useEffect(() => {
    const bgm = getBgm();
    const onVisibility = () => bgm.setHidden(document.hidden);
    // ブラウザは、ユーザー操作の前の再生を拒む。操作のたびに、拒まれていた再生をやり直す（軽い処理）
    const unlock = () => bgm.unlock();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
}
