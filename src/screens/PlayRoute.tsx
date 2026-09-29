import { useEffect, useState } from 'react';
import { BASIC_PACK, BUILTIN_PACKS, type ContentPack } from '@/content';
import { usePackStore } from '@/app/StoreContext';
import { useSettings } from '@/settings/useSettings';
import { Play } from './Play';

/** 設定（パック・語数・弱点優先）を読んで、練習画面を開く */
export function PlayRoute() {
  const [settings] = useSettings();
  const packStore = usePackStore();
  const [custom, setCustom] = useState<ContentPack[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    packStore.list().then((all) => !cancelled && setCustom(all));
    return () => {
      cancelled = true;
    };
  }, [packStore]);

  if (!custom) return <p className="p-8 text-text-muted">準備中…</p>;
  // 選んでいた自作パックが削除されていたら、基本パックで始める
  const pack = [...BUILTIN_PACKS, ...custom].find((p) => p.id === settings.packId) ?? BASIC_PACK;
  return <Play pack={pack} count={settings.count} adaptive={settings.adaptive} />;
}
