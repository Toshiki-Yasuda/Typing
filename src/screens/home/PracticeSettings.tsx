import { BUILTIN_PACKS, type ContentPack } from '@/content';
import { COUNT_OPTIONS, type Settings } from '@/settings/settings';

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  customPacks: readonly ContentPack[];
}

/** 練習の設定: パック・語数・弱点優先 */
export function PracticeSettings({ settings, update, customPacks }: Props) {
  const all = [...BUILTIN_PACKS, ...customPacks];
  // 選んでいた自作パックが消えていたら、先頭（基本）を選んでいるように見せる（練習も基本で始まる）
  const selected = all.some((p) => p.id === settings.packId) ? settings.packId : BUILTIN_PACKS[0].id;

  return (
    <section aria-labelledby="settings" className="flex flex-col gap-3">
      <h2 id="settings" className="text-lg font-bold">
        練習の設定
      </h2>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2">
          <span className="text-text-muted">出題</span>
          <select
            aria-label="出題パック"
            value={selected}
            onChange={(e) => update({ packId: e.target.value })}
            className="rounded bg-surface-raised px-3 py-2"
          >
            {BUILTIN_PACKS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（{p.items.length}語）
              </option>
            ))}
            {customPacks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（自作・{p.items.length}語）
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-text-muted">語数</span>
          <select
            aria-label="語数"
            value={settings.count}
            onChange={(e) => update({ count: Number(e.target.value) })}
            className="rounded bg-surface-raised px-3 py-2"
          >
            {COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}語
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.adaptive}
            onChange={(e) => update({ adaptive: e.target.checked })}
            className="h-4 w-4 accent-[var(--viz-series-1)]"
          />
          <span>弱点を優先して出題する</span>
        </label>
      </div>
      <p className="text-sm text-text-muted">
        弱点の優先は、過去の記録から苦手なキーを求めて、そのキーを含むお題を出やすくします（記録が無い間は均等）。
      </p>
    </section>
  );
}
