import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface BurstOptions {
  canvas: HTMLCanvasElement;
  /** 飛び散らせるモデル（トランプ） */
  model: string;
  /** won: カードが四方に弾ける（金色の光）/ lost: カードが力なく落ちる（赤い光） */
  outcome: 'won' | 'lost';
  /** false なら動かさず、少し進んだ1コマだけ描く */
  animate: boolean;
  onError?: (error: unknown) => void;
}

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const CARDS = 46;
/** 静止のとき、弾けてから何秒後の姿を描くか */
const STILL_AT = 0.9;

/** ボス戦の決着の 3D。描画だけで、入力・状態には触れない。返す関数で後始末する */
export function startBurstScene({ canvas, model, outcome, animate, onError }: BurstOptions): () => void {
  const won = outcome === 'won';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = won ? 0.6 : 0.25;
  const key = new THREE.DirectionalLight(won ? 0xffe0a0 : 0xff5a4a, won ? 2.6 : 1.8);
  key.position.set(1, 2.5, 4);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(40, 2, 0.1, 60);
  camera.position.set(0, 0, 6);

  const rand = lcg(won ? 7 : 13);
  const parts: { obj: THREE.Object3D; v: THREE.Vector3; spin: THREE.Vector3 }[] = [];
  let disposed = false;
  let raf = 0;

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(() => {
    resize();
    if (!animate) draw(STILL_AT);
  });
  observer.observe(canvas);

  /** t 秒後の姿。速度と減衰から式で求める（フレームの間隔に依らない） */
  function draw(t: number) {
    const drag = won ? 1.6 : 0.4;
    // v0 * (1 - e^{-drag t}) / drag が、減衰しながら進んだ距離
    const travel = (1 - Math.exp(-drag * t)) / drag;
    for (const p of parts) {
      p.obj.position.copy(p.v).multiplyScalar(travel);
      if (!won) p.obj.position.y -= 1.4 * t * t; // 敗北: 重力で落ちる
      p.obj.rotation.set(p.spin.x * t, p.spin.y * t, p.spin.z * t);
    }
    renderer.render(scene, camera);
  }

  // 経過時間は、モデルを読み込み終えた時点から数える（読み込みが遅くても、弾ける瞬間から見せる）
  let start = 0;
  const loop = () => {
    if (disposed) return;
    draw((performance.now() - start) / 1000);
    raf = requestAnimationFrame(loop);
  };

  new GLTFLoader()
    .loadAsync(new URL(model, document.baseURI).href)
    .then((card) => {
      if (disposed) return;
      const upright = (m: THREE.Object3D) => {
        const g = new THREE.Group();
        m.rotation.x = Math.PI / 2;
        g.add(m);
        return g;
      };
      for (let i = 0; i < CARDS; i++) {
        const obj = upright(card.scene.clone(true));
        obj.scale.setScalar(0.45 + rand() * 0.35);
        // 勝利は放射状に速く。敗北は小さく散って落ちる
        const a = rand() * Math.PI * 2;
        const speed = won ? 5 + rand() * 7 : 0.6 + rand() * 1.6;
        const v = new THREE.Vector3(Math.cos(a) * speed, Math.sin(a) * speed * (won ? 0.7 : 0.4), (rand() - 0.3) * (won ? 4 : 1));
        parts.push({ obj, v, spin: new THREE.Vector3((rand() - 0.5) * 8, (rand() - 0.5) * 8, (rand() - 0.5) * 8) });
        scene.add(obj);
      }
      resize();
      draw(animate ? 0 : STILL_AT);
      if (animate) {
        start = performance.now();
        raf = requestAnimationFrame(loop);
      }
    })
    .catch((error: unknown) => {
      if (!disposed) onError?.(error);
    });

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    observer.disconnect();
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    env.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
