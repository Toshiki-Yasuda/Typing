import { useEffect, useRef, useState } from 'react';
import { startWaterScene, type WaterReaction } from '@/effects/waterScene';

interface Props {
  model: string;
  reaction: WaterReaction;
  /** false なら動かさず、反応が起きた最後の姿を1コマだけ描く */
  animate: boolean;
  /** 変えると、反応を最初からやり直す */
  replay: number;
  onError: () => void;
}

/** 水見式のグラス（3D）。飾りなので支援技術には見せない。結果は画面の文字で伝える */
export default function WaterGlass({ model, reaction, animate, replay, onError }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    return startWaterScene({
      canvas: el,
      model,
      reaction,
      animate,
      onReady: () => setReady(true),
      onError: (error) => {
        console.error('水見式の 3D を読み込めませんでした', error);
        onError();
      },
    });
  }, [model, reaction, animate, replay, onError]);

  return (
    <div aria-hidden className="pointer-events-none relative h-64 w-full">
      <canvas ref={canvas} className="h-full w-full transition-opacity duration-700" style={{ opacity: ready ? 1 : 0 }} />
    </div>
  );
}
