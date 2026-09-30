import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { BASIC_PACK, BUILTIN_PACKS, type ContentItem, type ContentPack } from '@/content';
import { usePackStore, useStore } from '@/app/StoreContext';
import { createGhost, findBestRecord, type Ghost } from '@/session/ghost';
import { itemsForTargets } from '@/session/retry';
import { plainRecords } from '@/session/vows';
import { useSettings } from '@/settings/useSettings';
import { PageHeading } from './PageHeading';
import { Play } from './Play';

/** 設定（パック・語数・弱点優先）を読んで、練習画面を開く。`?retry=記録ID` なら、その記録と同じお題で再挑戦する */
export function PlayRoute() {
  const [params] = useSearchParams();
  const retryId = params.get('retry');
  return retryId ? <RetryPlay id={retryId} /> : <SettingsPlay />;
}

/** 設定の運指ガイド（オフなら null） */
function useFingerGuide() {
  const [settings] = useSettings();
  return settings.fingerGuide ? { layout: settings.layout } : null;
}

function SettingsPlay() {
  const [settings] = useSettings();
  const fingerGuide = useFingerGuide();
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
  return <Play pack={pack} count={settings.count} adaptive={settings.adaptive} fingerGuide={fingerGuide} />;
}

/** 過去の記録と同じお題で、もう一度。同じお題の最高記録をゴーストにする */
function RetryPlay({ id }: { id: string }) {
  const fingerGuide = useFingerGuide();
  const store = useStore();
  const packStore = usePackStore();
  const [data, setData] = useState<
    { pack: ContentPack; items: ContentItem[]; ghost: { ghost: Ghost; label: string } | null } | 'missing' | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [records, custom] = await Promise.all([store.list(), packStore.list()]);
      if (cancelled) return;
      const source = records.find((r) => r.id === id);
      if (!source) return setData('missing');
      const packs = [...BUILTIN_PACKS, ...custom];
      const best = findBestRecord(plainRecords(records), source.targets);
      setData({
        pack: packs.find((p) => p.id === source.contentId) ?? BASIC_PACK,
        items: itemsForTargets(source.targets, packs),
        ghost: best ? { ghost: createGhost(best), label: '同じお題の自己ベスト' } : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [store, packStore, id]);

  if (data === null) return <p className="p-8 text-text-muted">準備中…</p>;
  if (data === 'missing') {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <PageHeading title="記録が見つかりません" srOnly />
        <p>元の記録が見つかりませんでした。</p>
      </main>
    );
  }
  return <Play pack={data.pack} items={data.items} mode="retry" ghost={data.ghost} fingerGuide={fingerGuide} />;
}
