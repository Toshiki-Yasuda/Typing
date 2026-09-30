import { useSettings } from '@/settings/useSettings';
import { VOW_IDS, MEDAL_LABEL, medalOf, type VowId } from '@/session/vows';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';

export const VOW_INFO: Record<VowId, { label: string; detail: string }> = {
  noRomaji: { label: 'ローマ字を隠す', detail: 'ローマ字ガイドが「・」になります（読みと表示は見えます）' },
  noFinger: { label: '運指ガイドなし', detail: '次に打つ指の案内を出しません' },
  noMiss: { label: 'ミスなし', detail: '1 回でもミスしたら、そこで終わります（ボス戦は許容 0 回）' },
  silent: { label: '無音', detail: '効果音・BGM・段階の音を出しません' },
};

/** 縛り（制約と誓約）の選択。ステージ・ボス戦に適用。付き記録は級位・統計に数えない（docs/spec/vows.md） */
export function VowsPicker() {
  const [settings, update] = useSettings();
  const heading = resolveTheme(settings.themeId, loadUnlocked()).vowsHeading ?? '縛り';
  const chosen = new Set<string>(settings.vows);
  const toggle = (id: VowId, on: boolean) => {
    const next = new Set(chosen);
    if (on) next.add(id);
    else next.delete(id);
    update({ vows: VOW_IDS.filter((v) => next.has(v)) });
  };
  const medal = medalOf(settings.vows.length);
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg bg-surface-raised p-4">
      <legend className="px-1 text-lg font-bold">{heading}</legend>
      <p className="text-sm text-text-muted">
        ステージとボス戦に適用します。縛りを付けてクリアすると、メダルが上がります（1 つ=銅・2 つ=銀・3 つ以上=金）。
        縛り付きの記録は、級位・統計には数えません。
      </p>
      {VOW_IDS.map((id) => (
        <label key={id} className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={chosen.has(id)}
            onChange={(e) => toggle(id, e.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--viz-series-1)]"
          />
          <span>
            {VOW_INFO[id].label}
            <span className="block text-sm text-text-muted">{VOW_INFO[id].detail}</span>
          </span>
        </label>
      ))}
      <label className="mt-2 flex items-start gap-2 border-t border-surface pt-2">
        <input
          type="checkbox"
          checked={settings.bossSkills}
          onChange={(e) => update({ bossSkills: e.target.checked })}
          className="mt-1 h-4 w-4 accent-[var(--viz-series-1)]"
        />
        <span>
          ボスの技を使う
          <span className="block text-sm text-text-muted">技は表示と敗北条件にだけ働きます。オフにすると、技なしで戦えます（制限時間は残ります）</span>
        </span>
      </label>
      <p role="status" className="text-sm">
        今の縛り: {settings.vows.length} つ・狙えるメダル: <strong>{MEDAL_LABEL[medal]}</strong>
      </p>
    </fieldset>
  );
}
