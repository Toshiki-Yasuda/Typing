import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { BASIC_PACK, BUILTIN_PACKS, type ContentItem, type ContentPack } from '@/content';
import { usePackStore, useStore } from '@/app/StoreContext';
import { keyWeakness } from '@/metrics';
import { plainRecords } from '@/session/vows';
import { parseTrainMode, pickTechniqueItems, technique, trainMode, type Technique, type TrainKind } from '@/session/training';
import { useSettings } from '@/settings/useSettings';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { PageHeading } from '../PageHeading';
import { Play } from '../Play';
import { trainLabels } from './labels';

type Prepared = { pack: ContentPack; items: ContentItem[] | null; tech: Technique | null };

/** 修行の練習。型ごとに出題を用意して Play に渡す。記録のモードは train:<型> */
export function TrainRoute() {
  const { kind: param = '' } = useParams();
  const kind = parseTrainMode(`train:${param}`);
  if (!kind) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <PageHeading title="修行が見つかりません" srOnly />
        <p>そのような修行はありません。</p>
        <Link to="/train" className="text-accent underline">
          修行の一覧へ
        </Link>
      </main>
    );
  }
  return <Prepare kind={kind} />;
}

function Prepare({ kind }: { kind: TrainKind }) {
  const [settings] = useSettings();
  const store = useStore();
  const packStore = usePackStore();
  const theme = resolveTheme(settings.themeId, loadUnlocked());
  const labels = trainLabels(theme);
  const [data, setData] = useState<Prepared | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([packStore.list(), store.list()]).then(([custom, records]) => {
      if (cancelled) return;
      const pack = [...BUILTIN_PACKS, ...custom].find((p) => p.id === settings.packId) ?? BASIC_PACK;
      if (kind !== 'hatsu') return setData({ pack, items: null, tech: null });
      const weakness = keyWeakness(plainRecords(records).map((r) => r.keystrokes));
      const tech = technique(weakness);
      setData({ pack, tech, items: tech ? pickTechniqueItems(pack.items, settings.count, tech, weakness) : null });
    });
    return () => {
      cancelled = true;
    };
  }, [kind, packStore, store, settings.packId, settings.count]);

  if (!data) return <p className="p-8 text-text-muted">準備中…</p>;
  if (kind === 'hatsu' && !data.items) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-8">
        <PageHeading title={`修行: ${labels.names.hatsu}`} className="text-2xl font-bold" />
        <p>まだ弱点が求まっていません。何回か練習して、記録がたまると、その人だけの練習を作れます。</p>
        <p>
          <Link to="/play" className="text-accent underline">
            練習へ
          </Link>
        </p>
      </main>
    );
  }
  const label = kind === 'hatsu' ? `${labels.names.hatsu}：${data.tech?.name}` : labels.names[kind];
  return (
    <Play
      key={kind}
      pack={data.pack}
      // 練は、時間内に打てるだけ出す（パックの全語まで）
      count={kind === 'ren' ? data.pack.items.length : settings.count}
      adaptive={kind !== 'ren' && settings.adaptive}
      items={data.items ?? undefined}
      mode={trainMode(kind)}
      fingerGuide={kind !== 'zetsu' && settings.fingerGuide ? { layout: settings.layout } : null}
      train={{ kind, label }}
      aids={kind === 'zetsu' ? undefined : { gyo: settings.aidGyo, en: settings.aidEn }}
    />
  );
}
