import { useEffect, useRef } from 'react';
import type { JingleKind } from '@/sound/jingle';
import { useJingle } from '@/sound/useJingle';

/**
 * 結果画面で 1 回だけ短い合成音を鳴らす（描画なし）。鳴らす設定でなければ何もしない。
 * 同じ記録では 1 回だけ（開発時の StrictMode の二重実行でも 2 回鳴らさない）。
 */
export function ResultJingle({ kind, recordId }: { kind: JingleKind; recordId: string }) {
  const play = useJingle();
  const played = useRef<string | null>(null);
  useEffect(() => {
    if (!play || played.current === recordId) return;
    played.current = recordId;
    play(kind);
  }, [play, kind, recordId]);
  return null;
}
