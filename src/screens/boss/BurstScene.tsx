import { useEffect, useRef } from 'react';
import { startBurstScene } from '@/effects/burstScene';

interface Props {
  model: string;
  outcome: 'won' | 'lost';
  animate: boolean;
}

/** ボス戦の決着の 3D（カードが弾ける / 落ちる）。飾りで、クリックは受けない */
export default function BurstScene({ model, outcome, animate }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    return startBurstScene({
      canvas: el,
      model,
      outcome,
      animate,
      onError: (error) => console.error('決着の3D演出を読み込めませんでした', error),
    });
  }, [model, outcome, animate]);
  return <canvas ref={canvas} className="absolute inset-0 h-full w-full" />;
}
