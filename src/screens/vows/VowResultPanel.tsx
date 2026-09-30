import { MEDAL_LABEL, medalOf, parseVows, vowBroken } from '@/session/vows';
import type { SessionRecord } from '@/metrics';
import { VOW_INFO } from './VowsPicker';

/** 縛り付きの結果。何を付けたか・破れたか・メダル（クリアしたステージのとき）を文字で示す */
export function VowResultPanel({ record, cleared }: { record: SessionRecord; cleared: boolean | null }) {
  const vows = parseVows(record.vows);
  if (vows.length === 0) return null;
  const broken = vowBroken(record);
  const medal = medalOf(vows.length);
  return (
    <section aria-labelledby="vow-result" className="flex flex-col gap-2 rounded-lg bg-surface-raised p-4">
      <h2 id="vow-result" className="text-lg font-bold">
        縛り付きの練習
      </h2>
      <p>{vows.map((v) => VOW_INFO[v].label).join('・')}</p>
      {broken && <p role="status">✗ 「ミスなし」が破れたので、ここで終わりました（クリアには数えません）。</p>}
      {!broken && cleared === true && (
        <p role="status">
          ✓ 縛りを守ってクリア：メダル <strong>{MEDAL_LABEL[medal]}</strong>（縛り {vows.length} つ）
        </p>
      )}
      <p className="text-sm text-text-muted">縛り付きの練習は、級位・統計・診断には数えません。</p>
    </section>
  );
}
