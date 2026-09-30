import { BUILTIN_PACKS, type ContentPack } from '@/content';
import { GOAL_AUTO, RANKS } from '@/metrics/rank';
import { COUNT_OPTIONS, type Settings } from '@/settings/settings';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { trainLabels } from '../train/labels';

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

  const aidNames = trainLabels(resolveTheme(settings.themeId, loadUnlocked())).aids;

  return (
    <section aria-labelledby="settings" className="card flex flex-col gap-3">
      <h2 id="settings" className="card-title">
        練習の設定
      </h2>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex min-w-0 max-w-full items-center gap-2">
          <span className="shrink-0 text-text-muted">出題</span>
          <select
            aria-label="出題パック"
            value={selected}
            onChange={(e) => update({ packId: e.target.value })}
            className="min-w-0 max-w-full rounded bg-surface-raised px-3 py-2"
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
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.fingerGuide}
            onChange={(e) => update({ fingerGuide: e.target.checked })}
            className="h-4 w-4 accent-[var(--viz-series-1)]"
          />
          <span>運指ガイドを表示する</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.aidGyo}
            onChange={(e) => update({ aidGyo: e.target.checked })}
            className="h-4 w-4 accent-[var(--viz-series-1)]"
          />
          <span>弱点のキーを強調する（{aidNames.gyo}）</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.aidEn}
            onChange={(e) => update({ aidEn: e.target.checked })}
            className="h-4 w-4 accent-[var(--viz-series-1)]"
          />
          <span>次のお題を先に見せる（{aidNames.en}）</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showQueue}
            onChange={(e) => update({ showQueue: e.target.checked })}
            className="h-4 w-4 accent-[var(--viz-series-1)]"
          />
          <span>次のお題を横に並べて見せる</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.liveStats}
            onChange={(e) => update({ liveStats: e.target.checked })}
            className="h-4 w-4 accent-[var(--viz-series-1)]"
          />
          <span>練習中に速さなどの数字を出す</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.fingerColors}
            onChange={(e) => update({ fingerColors: e.target.checked })}
            className="h-4 w-4 accent-[var(--viz-series-1)]"
          />
          <span>運指ガイドを指ごとに色分けする</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-text-muted">配列</span>
          <select
            aria-label="運指ガイドの配列"
            value={settings.layout}
            onChange={(e) => update({ layout: e.target.value as Settings['layout'] })}
            className="rounded bg-surface-raised px-3 py-2"
          >
            <option value="jis">JIS配列</option>
            <option value="us">US配列</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-text-muted">目標の級位</span>
          <select
            aria-label="目標の級位"
            value={settings.goalRank}
            onChange={(e) => update({ goalRank: e.target.value })}
            className="rounded bg-surface-raised px-3 py-2"
          >
            <option value={GOAL_AUTO}>自動（次の級位）</option>
            {RANKS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}（{r.minKpm}打鍵/分〜）
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm text-text-muted">
        弱点の優先は、過去の記録から苦手なキーを求めて、そのキーを含むお題を出やすくします（記録が無い間は均等）。
      </p>
    </section>
  );
}
