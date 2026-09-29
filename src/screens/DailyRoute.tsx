import { useEffect, useState } from 'react';
import { normalizeTarget } from '@/engine';
import { useStore } from '@/app/StoreContext';
import { todaysChallenge, type DailyChallenge } from '@/session/daily';
import { createGhost, findBestRecord, type Ghost } from '@/session/ghost';
import { useSettings } from '@/settings/useSettings';
import { Play } from './Play';

/** 今日のチャレンジ。お題は日付で固定。同じお題の過去の最高記録があれば、ゴーストとして並走する */
export function DailyRoute() {
  const store = useStore();
  const [settings] = useSettings();
  const [data, setData] = useState<{ challenge: DailyChallenge; ghost: { ghost: Ghost; label: string } | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    store.list().then((records) => {
      if (cancelled) return;
      const challenge = todaysChallenge(Date.now());
      const best = findBestRecord(records, challenge.items.map((i) => normalizeTarget(i.reading)));
      setData({ challenge, ghost: best ? { ghost: createGhost(best), label: '同じお題の自己ベスト' } : null });
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  if (!data) return <p className="p-8 text-text-muted">準備中…</p>;
  return (
    <Play
      pack={data.challenge.pack}
      items={data.challenge.items}
      mode="daily"
      ghost={data.ghost}
      fingerGuide={settings.fingerGuide ? { layout: settings.layout } : null}
    />
  );
}
