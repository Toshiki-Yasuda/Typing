import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { prefersReducedMotion, resolveEffects } from '@/effects/level';
import { useSettings } from '@/settings/useSettings';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import type { PressFx } from '../types';
import { ParticleField, particleAlpha, particleCount } from './particles';
import { nextStreak, rhythmLevel } from './rhythm';

interface CardRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** お題のカード（.target-card）の位置を測る。無ければ null */
function measureCard(): CardRect | null {
  const el = document.querySelector('.target-card');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width === 0 && r.height === 0 ? null : { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** 光のレールを、お題の下端の少し下に置く */
const RAIL_GAP_PX = 14;
/** 語の完了の光の最短間隔。これより速い連続では光らせない（1 秒に 3 回以上の明滅を作らない） */
const FLASH_GAP_MS = 400;

/**
 * 打鍵に合わせた演出の層（U5）。画面全体の上に重ねる（position: fixed; inset: 0; pointer-events: none; aria-hidden）。
 * - 光の呼吸: 連続正打の数（rhythmLevel）で、舞台の後ろの光（.fx-glow）の明るさだけをゆっくり変える。
 *   テーマに手応え（feel）があるときは、そちらの段階を使うので出さない（二重にしない）
 * - 光のレールの進み: index/total に応じて、背景のレール（--stage-rail-y）に沿って細い光を伸ばす
 * - 語の完了の縁の光: お題のカードの縁が 1 回だけ光って戻る
 * - 粒: 正打でカードの足元から数個、語の完了で多めに（上限 40。rAF は粒があるときだけ）
 * 動く部分は演出「標準」のみ。「控えめ」はレールの進みだけ静止して出し、「オフ」と OS の「動きを減らす」は何も描かない。
 * 判定・入力・計測には触れない。canvas が使えなくても例外にしない。
 */
export function FxLayer({ press, index, total }: { press: PressFx | undefined; index: number; total: number }) {
  const [settings] = useSettings();
  const level = resolveEffects(settings.effects, prefersReducedMotion());
  const hasFeel = resolveTheme(settings.themeId, loadUnlocked()).feel !== undefined;
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [card, setCard] = useState<CardRect | null>(null);
  const [streak, setStreak] = useState(0);
  /** 語の完了の光を再生し直すための連番（0 は未再生）。速い連続では出さない（FLASH_GAP_MS） */
  const [flashSeq, setFlashSeq] = useState(0);
  const lastSeq = useRef(0);
  const lastFlashAt = useRef(-Infinity);

  // 連続正打の数と語の完了の光（表示専用。判定とは別に、ここで数える）
  useEffect(() => {
    if (!press || press.seq === lastSeq.current) return;
    lastSeq.current = press.seq;
    setStreak((s) => nextStreak(s, press.result));
    if (press.result === 'wordDone' || press.result === 'sessionDone') {
      const now = performance.now();
      if (now - lastFlashAt.current >= FLASH_GAP_MS) {
        lastFlashAt.current = now;
        setFlashSeq(press.seq);
      }
    }
  }, [press]);

  // お題のカードの位置を測り、レールの高さに反映する（リサイズ・語の変化に追従）
  useLayoutEffect(() => {
    if (level === 'off') return;
    const root = rootRef.current;
    const host = root?.parentElement;
    const apply = () => {
      const rect = measureCard();
      setCard(rect);
      if (host && rect) host.style.setProperty('--stage-rail-y', `${Math.round(rect.top + rect.height + RAIL_GAP_PX)}px`);
    };
    apply();
    window.addEventListener('resize', apply);
    let ro: ResizeObserver | undefined;
    const el = document.querySelector('.target-card');
    if (el && typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(apply);
      ro.observe(el);
    }
    return () => {
      window.removeEventListener('resize', apply);
      ro?.disconnect();
      host?.style.removeProperty('--stage-rail-y');
    };
  }, [level, index]);

  // 粒: 標準のときだけ。粒が生きている間だけ rAF を回す
  const field = useRef(new ParticleField());
  const raf = useRef<number | null>(null);
  const lastT = useRef(0);
  const spawnRef = useRef<((result: PressFx['result']) => void) | null>(null);
  const cardRef = useRef(card);
  useEffect(() => {
    cardRef.current = card;
  }, [card]);
  useEffect(() => {
    if (level !== 'full') return;
    const canvas = canvasRef.current;
    const ctx = (() => {
      try {
        return canvas?.getContext('2d') ?? null;
      } catch {
        return null;
      }
    })();
    if (!canvas || !ctx) return;
    const g = ctx;
    // 粒の色は canvas の CSS の color（accent）。直書きしない
    const color = getComputedStyle(canvas).color || 'currentColor';
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const frame = (t: number) => {
      const dt = Math.min(0.05, Math.max(0, (t - lastT.current) / 1000));
      lastT.current = t;
      field.current.step(dt);
      g.clearRect(0, 0, window.innerWidth, window.innerHeight);
      g.fillStyle = color;
      for (const p of field.current.particles) {
        const a = particleAlpha(p);
        g.globalAlpha = a * 0.25;
        g.beginPath();
        g.arc(p.x, p.y, p.r * 2.6, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = a * 0.9;
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      raf.current = field.current.count > 0 ? requestAnimationFrame(frame) : null;
      if (raf.current === null) g.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
    spawnRef.current = (result) => {
      const c = cardRef.current;
      const x = c ? c.left + c.width / 2 : window.innerWidth / 2;
      const y = c ? c.top + c.height : window.innerHeight * 0.62;
      field.current.spawn(particleCount(result), x, y, Math.random);
      if (raf.current === null && field.current.count > 0) {
        lastT.current = performance.now();
        raf.current = requestAnimationFrame(frame);
      }
    };
    return () => {
      spawnRef.current = null;
      window.removeEventListener('resize', resize);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
      field.current = new ParticleField();
    };
  }, [level]);

  // 打鍵が来たら粒を出す（描画は rAF の中）
  useEffect(() => {
    if (press) spawnRef.current?.(press.result);
  }, [press]);

  if (level === 'off') return <div ref={rootRef} aria-hidden data-testid="air-layer" data-level="off" className="air-layer" />;

  const phase = !press || press.result === 'wordDone' || press.result === 'sessionDone' ? 'idle' : 'typing';
  const progress = total > 0 ? Math.min(1, Math.max(0, index / total)) : 0;
  return (
    <>
      <div
        ref={rootRef}
        aria-hidden
        data-testid="air-layer"
        data-level={level}
        className="air-layer"
        style={
          {
            '--rhythm': rhythmLevel(streak),
            '--fx-progress': progress,
          } as CSSProperties
        }
      >
        {level === 'full' && !hasFeel && (
          <div className="fx-glow" data-phase={phase}>
            {flashSeq > 0 && <div key={flashSeq} className="fx-glow__flash" />}
          </div>
        )}
        {card && <div className="fx-rail" data-testid="fx-rail" />}
        {level === 'full' && card && flashSeq > 0 && (
          <div
            key={flashSeq}
            className="fx-edge"
            style={{
              left: card.left,
              top: card.top,
              width: card.width,
              height: card.height,
            }}
          />
        )}
      </div>
      {/* 粒は内容の手前（お題の下に隠れないように）。別の層にして、光は内容の後ろに置く */}
      {level === 'full' && <canvas ref={canvasRef} aria-hidden className="fx-canvas" />}
    </>
  );
}
