import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface HeroModels {
  /** 中央に浮かべるモデル（ライセンスカード） */
  centerpiece: string;
  /** 周りを舞うモデル（トランプ） */
  orbiter: string;
}

export interface HeroOptions {
  canvas: HTMLCanvasElement;
  models: HeroModels;
  /** false なら、動かさず1コマだけ描く */
  animate: boolean;
  onReady?: () => void;
  onError?: (error: unknown) => void;
}

/** 決まった乱数（毎回同じ配置にする） */
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Blender のモデルは面が上（+Y）を向いて出てくるので、面を正面（+Z）に向ける親を作る */
function upright(model: THREE.Object3D): THREE.Group {
  const pivot = new THREE.Group();
  model.rotation.x = Math.PI / 2;
  pivot.add(model);
  return pivot;
}

const ORBITERS = 14;
const SPARKS = 140;

/**
 * ハンターのカードが浮かび、トランプが周りを舞う 3D シーン。
 * 描画だけを担当し、アプリの状態・入力には触れない。返す関数で後始末（GPU の解放）をする。
 */
export function startHeroScene({ canvas, models, animate, onReady, onError }: HeroOptions): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(32, 2, 0.1, 50);
  camera.position.set(0, 0.1, 4.6);

  const key = new THREE.DirectionalLight(0xffdca0, 2.4);
  key.position.set(2.5, 3, 4);
  const rim = new THREE.DirectionalLight(0x7f8cff, 1.6);
  rim.position.set(-3, 1, -2);
  scene.add(key, rim);

  // 金の粒子
  const rand = lcg(20260930);
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkSpeed = new Float32Array(SPARKS);
  for (let i = 0; i < SPARKS; i++) {
    sparkPos[i * 3] = (rand() - 0.5) * 7;
    sparkPos[i * 3 + 1] = (rand() - 0.5) * 3.2;
    sparkPos[i * 3 + 2] = (rand() - 0.5) * 3;
    sparkSpeed[i] = 0.06 + rand() * 0.14;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    color: 0xffd76a,
    size: 0.025,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  scene.add(sparks);

  const stage = new THREE.Group();
  scene.add(stage);
  const orbit: { obj: THREE.Object3D; radius: number; speed: number; phase: number; height: number; spin: number }[] = [];
  let center: THREE.Object3D | null = null;

  let disposed = false;
  let raf = 0;
  const pointer = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };

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
    if (!animate) draw(0);
  });
  observer.observe(canvas);

  function draw(t: number) {
    smooth.x += (pointer.x - smooth.x) * 0.05;
    smooth.y += (pointer.y - smooth.y) * 0.05;
    if (center) {
      center.rotation.y = Math.sin(t * 0.5) * 0.4 + smooth.x * 0.35;
      center.rotation.x = -0.18 + Math.sin(t * 0.4) * 0.05 - smooth.y * 0.2;
      center.position.y = Math.sin(t * 0.9) * 0.06;
    }
    for (const o of orbit) {
      const a = o.phase + t * o.speed;
      o.obj.position.set(Math.cos(a) * o.radius, o.height + Math.sin(a * 2) * 0.08, Math.sin(a) * o.radius * 0.55);
      o.obj.rotation.set(t * o.spin * 0.6, t * o.spin, a * 0.5);
    }
    if (animate) {
      const p = sparkGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < SPARKS; i++) {
        let y = p.getY(i) + sparkSpeed[i]! * 0.016;
        if (y > 1.7) y = -1.7;
        p.setY(i, y);
      }
      p.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }

  const start = performance.now();
  const loop = () => {
    if (disposed) return;
    if (!document.hidden) draw((performance.now() - start) / 1000);
    raf = requestAnimationFrame(loop);
  };
  const onMove = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
  };

  const loader = new GLTFLoader();
  const url = (path: string) => new URL(path, document.baseURI).href;
  Promise.all([loader.loadAsync(url(models.centerpiece)), loader.loadAsync(url(models.orbiter))])
    .then(([license, card]) => {
      if (disposed) return;
      center = upright(license.scene);
      center.scale.setScalar(2.1);
      stage.add(center);
      for (let i = 0; i < ORBITERS; i++) {
        const obj = upright(card.scene.clone(true));
        obj.scale.setScalar(0.3 + rand() * 0.14);
        stage.add(obj);
        orbit.push({
          obj,
          radius: 1.9 + rand() * 0.9,
          speed: (0.12 + rand() * 0.12) * (i % 2 === 0 ? 1 : -1),
          phase: (i / ORBITERS) * Math.PI * 2,
          height: (rand() - 0.5) * 1.5,
          spin: 0.6 + rand() * 1.2,
        });
      }
      resize();
      draw(0);
      if (animate) {
        window.addEventListener('pointermove', onMove);
        raf = requestAnimationFrame(loop);
      }
      onReady?.();
    })
    .catch((error: unknown) => {
      if (!disposed) onError?.(error);
    });

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    observer.disconnect();
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    envTexture.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
