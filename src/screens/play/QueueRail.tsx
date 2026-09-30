import type { CSSProperties } from 'react';
import type { ContentItem } from '@/content';

/** 読みを添える先頭の語数（遠い語は小さく薄いので、読みを付けると読めなくなる） */
const READING_COUNT = 2;

/**
 * 次のお題の待ち行列（左のレール）。遠い語ほど小さく薄く並べる（見た目は styles/stage.css の A 区画）。
 * 出すかどうかは PlayFrame が設定 showQueue で決める。先頭は「次のお題」で、現在の語は含まない。
 * 「NEXT」の見出しは飾り（aria-hidden）。意味は領域名「次のお題」で伝える。
 */
export function QueueRail({ upcoming }: { upcoming: readonly ContentItem[] }) {
  if (upcoming.length === 0) return null;
  return (
    <aside aria-label="次のお題" className="queue-rail">
      <span aria-hidden className="queue-rail__label">
        NEXT
      </span>
      {upcoming.map((item, i) => (
        <p key={`${i}-${item.reading}`} className="queue-rail__item" style={{ '--i': i } as CSSProperties}>
          {item.display}
          {i < READING_COUNT && item.reading !== item.display && <span className="queue-rail__reading">{item.reading}</span>}
        </p>
      ))}
    </aside>
  );
}
