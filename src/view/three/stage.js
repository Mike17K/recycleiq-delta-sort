/** Renderer, lights, floor and camera. Knows nothing about the simulation except world bounds for framing. */
import { THREE, material } from './three-utils.js';
import { OrbitControls } from 'three/addons/OrbitControls.js';

export const GROUND = -0.75;   // floor height; belt surface is y = 0

export function createStage(canvas, { fast = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !fast, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1f17);
  const camera = new THREE.PerspectiveCamera(38, canvas.width / canvas.height, 0.1, 80);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  scene.add(new THREE.HemisphereLight(0xd5f5e3, 0x0b1f17, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(fast ? 1024 : 2048, fast ? 1024 : 2048);
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), material(0x0f2a1d, { roughness: 0.95, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = GROUND; floor.receiveShadow = true;
  const grid = new THREE.GridHelper(40, 80, 0x1f4a33, 0x15382a); grid.position.y = GROUND + 0.002;
  scene.add(floor, grid);

  let frame = { cx: 0, cz: 0, radius: 5, height: 1.8 };
  /** Aim lights and the camera at world bounds { minX, maxX, minY, maxY, width, depth } (sim metres). */
  function frameBounds(b) {
    const cx = (b.minX + b.maxX) / 2, cz = -(b.minY + b.maxY) / 2;
    const radius = 0.4 * b.width + 0.3 * b.depth;                  // empirical: fills a ~3:1 view for 1..2 lines
    frame = { cx, cz, radius, height: 0.3 * radius + 0.28 * b.depth };
    floor.position.set(cx, GROUND, cz); grid.position.set(cx, GROUND + 0.002, cz);
    sun.position.set(cx + 0.6 * b.width / 2, 6 + b.depth, cz + 4); sun.target.position.set(cx, 0, cz);
    const sc = sun.shadow.camera, hw = b.width / 2 + 1.5, hd = b.depth / 2 + 1.5;
    Object.assign(sc, { left: -hw, right: hw, top: hd + 2, bottom: -hd - 2, near: 1, far: 22 + b.depth });
    sc.updateProjectionMatrix();
    scene.fog = new THREE.Fog(0x0b1f17, radius * 2, radius * 4);
    camera.far = radius * 8; camera.updateProjectionMatrix();
    setPreset('hero');
  }
  function setPreset(name) {
    const { cx, cz, radius: r, height: h } = frame;
    const p = { hero: [cx - 0.35 * r, h, cz + r], top: [cx, r * 1.5, cz + 0.01], side: [cx, 0.3 * h, cz + r * 1.1], end: [cx + r * 1.4, h, cz + r * 0.6] }[name];
    camera.position.set(...p); controls.target.set(cx, name === 'top' ? 0 : -0.05, cz); controls.update();
  }
  /** Deterministic slow drift around the plant, for video capture (depends only on t). */
  function orbit(t) {
    const { cx, cz, radius: r, height: h } = frame, a = Math.sin(t * 0.07) * 0.55;
    camera.position.set(cx + Math.sin(a) * r - 0.06 * r, h * (1 + 0.17 * Math.sin(t * 0.05 + 1)), cz + Math.cos(a) * r);
    controls.target.set(cx, -0.08, cz); camera.lookAt(controls.target);
  }
  function resize(w, h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function render(t) { if (t === undefined) controls.update(); else orbit(t); renderer.render(scene, camera); }

  resize(canvas.width, canvas.height);
  return { scene, camera, controls, renderer, floor, grid, frameBounds, setPreset, resize, render };
}
