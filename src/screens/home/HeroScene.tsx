import { useEffect, useRef, useState } from 'react';
import { startHeroScene, type HeroModels } from '@/effects/heroScene';

interface Props {
  models: HeroModels;
  /** false なら動かさず1コマだけ描く */
  animate: boolean;
  /** 読み込めなかったとき（画面からこの演出を外す） */
  onError: () => void;
}

/** テーマの 3D 演出。飾りなので支援技術には見せない。クリック等は受けない */
export default function HeroScene({ models, animate, onError }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    return startHeroScene({
      canvas: el,
      models,
      animate,
      onReady: () => setReady(true),
      onError: (error) => {
        console.error('3D 演出を読み込めませんでした', error);
        onError();
      },
    });
  }, [models, animate, onError]);

  return (
    <div aria-hidden className="pointer-events-none relative h-64 w-full sm:h-72">
      <canvas
        ref={canvas}
        className="h-full w-full transition-opacity duration-700"
        style={{ opacity: ready ? 1 : 0 }}
      />
    </div>
  );
}
