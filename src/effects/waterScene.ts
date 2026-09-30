import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** 水見式の反応の種類（見た目の違い）。どの軸がどれになるかは、画面側で決める */
export type WaterReaction = 'level' | 'taste' | 'color' | 'impurity' | 'leaf-move' | 'leaf-wither';

export interface WaterOptions {
  canvas: HTMLCanvasElement;
  /** glass.glb（glass / water / leaf の3つ。art/hunter/build_models.py で生成） */
  model: string;
  reaction: WaterReaction;
  /** false なら動かさず、反応が起きた「最後の姿」を1コマだけ描く */
  animate: boolean;
  onReady?: () => void;
  onError?: (error: unknown) => void;
}

/** 反応が起きるまでの秒数 */
export const REACTION_SECONDS = 3.2;

/** 水の高さの基準（モデルの水は 0.34 単位。水位 1 = 口の少し下） */
const WATER_BASE = 0.045;
const WATER_UNIT = 0.34;
const IMPURITIES = 90;
/** 葉は小さくて見えにくいので、モデルより大きく見せる */
const LEAF_SIZE = 1.9;

const PLAIN_WATER = new THREE.Color(0x3f9ee0);
const LEAF_GREEN = new THREE.Color(0x3a9a34);
const LEAF_BROWN = new THREE.Color(0x7a5230);

/** 決まった乱数（毎回同じ配置にする） */
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const ease = (p: number) => 1 - Math.pow(1 - p, 3);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * 水見式のグラス。葉の浮かぶ水に、反応が起きる 3D シーン。
 * 描画だけを担当し、アプリの状態・入力には触れない。返す関数で後始末（GPU の解放）をする。
 */
export function startWaterScene({ canvas, model, reaction, animate, onReady, onError }: WaterOptions): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 20);
  camera.position.set(0, 0.78, 1.05);
  camera.lookAt(0, 0.26, 0);

  const key = new THREE.DirectionalLight(0xfff0d0, 2.2);
  key.position.set(1.5, 2.5, 2);
  const rim = new THREE.DirectionalLight(0x8090ff, 1.4);
  rim.position.set(-2, 1, -1.5);
  const aura = new THREE.PointLight(0xffd76a, 0, 2.2);
  aura.position.set(0, 0.85, 0.2);
  scene.add(key, rim, aura);

  const stage = new THREE.Group();
  scene.add(stage);

  // 水に混ざる不純物（具現化）。底に近い所へ寄せる
  const rand = lcg(20260930);
  const dustPos = new Float32Array(IMPURITIES * 3);
  const dustBase = new Float32Array(IMPURITIES * 3);
  for (let i = 0; i < IMPURITIES; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 0.13;
    dustBase[i * 3] = Math.cos(a) * r;
    dustBase[i * 3 + 1] = 0.06 + rand() * 0.2;
    dustBase[i * 3 + 2] = Math.sin(a) * r;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0xf2e4b0, size: 0.016, transparent: true, opacity: 0, depthWrite: false });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.visible = reaction === 'impurity';
  stage.add(dust);

  let water: THREE.Mesh | null = null;
  let waterMat: THREE.MeshStandardMaterial | null = null;
  let leaf: THREE.Mesh | null = null;
  let leafMat: THREE.MeshStandardMaterial | null = null;
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
    if (!animate) draw(REACTION_SECONDS);
  });
  observer.observe(canvas);

  /** t 秒目の姿を描く。t が REACTION_SECONDS 以上なら「最後の姿」 */
  function draw(t: number) {
    if (!water || !waterMat || !leaf || !leafMat) return;
    const p = ease(clamp01(t / REACTION_SECONDS));
    // 手かざしの光（反応の直前まで強まり、最後の姿では消える）
    aura.intensity = animate ? Math.sin(clamp01(t / REACTION_SECONDS) * Math.PI) * 3 : 0;

    let level = 1;
    let color = PLAIN_WATER.clone();
    let leafSpin = 0;
    let leafShade = LEAF_GREEN.clone();
    let leafCurl = 1;
    dustMat.opacity = 0;

    switch (reaction) {
      case 'level': // 強化系: 水があふれる（水位が口まで届く）
        level = 1 + 0.36 * p;
        break;
      case 'taste': // 変化系: 味が変わる（見た目は、淡い緑みへ。文字でも伝える）
        color = PLAIN_WATER.clone().lerp(new THREE.Color(0x9ee6c8), p);
        break;
      case 'color': // 放出系: 水の色が変わる
        color = PLAIN_WATER.clone().lerp(new THREE.Color(0xd070e0), p);
        break;
      case 'impurity': // 具現化系: 不純物が現れる
        dustMat.opacity = 0.9 * p;
        break;
      case 'leaf-move': // 操作系: 葉が動く
        leafSpin = p * 1.6;
        break;
      case 'leaf-wither': // 特質系: 葉が枯れる
        leafShade = LEAF_GREEN.clone().lerp(LEAF_BROWN, p);
        leafCurl = 1 - 0.35 * p;
        break;
    }

    water.scale.y = level;
    waterMat.color.copy(color);
    const surface = WATER_BASE + WATER_UNIT * level;
    leaf.position.y = surface + 0.003;
    leaf.rotation.y = leafSpin + (reaction === 'leaf-move' && animate ? Math.sin(t * 2.2) * 0.25 * p : 0);
    leaf.scale.set(LEAF_SIZE * leafCurl, LEAF_SIZE, LEAF_SIZE * leafCurl);
    leafMat.color.copy(leafShade);

    // 不純物: 水の中をゆっくり漂う
    const pos = dustGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < IMPURITIES; i++) {
      const drift = animate ? Math.sin(t * 0.8 + i) * 0.006 : 0;
      pos.setXYZ(i, dustBase[i * 3]! + drift, dustBase[i * 3 + 1]! + drift, dustBase[i * 3 + 2]! - drift);
    }
    pos.needsUpdate = true;

    stage.rotation.y = animate ? Math.sin(t * 0.35) * 0.35 : 0.25;
    renderer.render(scene, camera);
  }

  let start = performance.now();
  const loop = () => {
    if (disposed) return;
    if (!document.hidden) draw((performance.now() - start) / 1000);
    raf = requestAnimationFrame(loop);
  };

  new GLTFLoader()
    .loadAsync(new URL(model, document.baseURI).href)
    .then((gltf) => {
      if (disposed) return;
      const find = (name: string) => gltf.scene.getObjectByName(name) as THREE.Mesh | undefined;
      const glass = find('glass');
      const w = find('water');
      const l = find('leaf');
      if (!glass || !w || !l) throw new Error('glass.glb に glass / water / leaf がありません');
      // 素材は、見た目を確かめやすいよう three.js 側で置き換える（形だけをモデルから使う）
      glass.material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.04,
        metalness: 0,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      glass.renderOrder = 2;
      waterMat = new THREE.MeshStandardMaterial({ color: PLAIN_WATER, roughness: 0.12, transparent: true, opacity: 0.88 });
      w.material = waterMat;
      w.renderOrder = 1;
      leafMat = new THREE.MeshStandardMaterial({ color: LEAF_GREEN, roughness: 0.6, side: THREE.DoubleSide });
      l.material = leafMat;
      water = w;
      leaf = l;
      stage.add(gltf.scene);
      resize();
      draw(animate ? 0 : REACTION_SECONDS);
      if (animate) {
        start = performance.now();
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
