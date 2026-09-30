import type { ContentItem } from '@/content';

/**
 * 次のお題の待ち行列（左のレール）。U1a の担当ファイル。いまは PlayFrame が使わないので、画面には出ない。
 * 遠い語ほど小さく薄く。先の語を見せるかは設定で切れるようにする（計画書 §2 の確認事項）。
 */
export function QueueRail({ upcoming }: { upcoming: readonly ContentItem[] }) {
  return (
    <aside aria-label="次のお題" className="flex flex-col gap-2">
      {upcoming.map((item, i) => (
        <p key={`${i}-${item.reading}`} className="rounded bg-surface-raised px-3 py-2" style={{ opacity: 1 - i * 0.25 }}>
          {item.display}
        </p>
      ))}
    </aside>
  );
}
