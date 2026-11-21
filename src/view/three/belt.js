/** Conveyor: moving-stripe belt, rails, legs and end drums. */
import { THREE, material, addMesh } from './three-utils.js';
import { GROUND } from './stage.js';

const STRIPE = 0.25;   // stripe period (m)

export function buildBelt(parent, cfg) {
  const { length: L, width: W } = cfg.belt;
  const c = document.createElement('canvas'); c.width = 128; c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#2b3a33'; g.fillRect(0, 0, 128, 16); g.fillStyle = '#3d5247'; g.fillRect(0, 0, 10, 16);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(L / STRIPE, 1); tex.anisotropy = 4;

  const side = material(0x1c2a24);
  const belt = addMesh(parent, new THREE.BoxGeometry(L, 0.06, W),
    [side, side, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), side, side, side]);
  belt.position.set(L / 2, -0.03, 0);

  const steel = material(0x8fa399, { metalness: 0.6 });
  for (const s of [-1, 1]) addMesh(parent, new THREE.BoxGeometry(L + 0.1, 0.08, 0.04), steel).position.set(L / 2, 0, s * (W / 2 + 0.02));
  for (const x of [0.2, L / 2, L - 0.2]) for (const s of [-1, 1]) {
    addMesh(parent, new THREE.BoxGeometry(0.06, -GROUND - 0.06, 0.06), material(0x5b6b63)).position.set(x, (GROUND - 0.06) / 2, s * (W / 2 - 0.02));
  }
  for (const x of [0, L]) addMesh(parent, new THREE.CylinderGeometry(0.05, 0.05, W, 20).rotateX(Math.PI / 2), material(0x93a59b, { metalness: 0.7 })).position.set(x, -0.03, 0);

  return { update(line) { tex.offset.x = -(line.beltDist / STRIPE); } };
}
