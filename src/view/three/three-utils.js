/** Small Three.js helpers shared by the scene parts. Sim coordinates (x along belt, y across, z up) map to three (x, z, -y). */
import * as THREE from 'three';

export { THREE };
export const toThree = (x, y, z) => new THREE.Vector3(x, z, -y);
export const material = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2, ...opts });

export const rodGeometry = new THREE.CylinderGeometry(1, 1, 1, 10);   // unit rod, scaled by rod()
const UP = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();

/** Stretch a unit cylinder mesh between points a and b with radius r. */
export function rod(mesh, a, b, r) {
  tmp.copy(b).sub(a);
  const len = tmp.length();
  mesh.position.copy(a).addScaledVector(tmp, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, tmp.normalize());
  mesh.scale.set(r, len, r);
}

export function addMesh(parent, geometry, mat, { shadow = true } = {}) {
  const m = new THREE.Mesh(geometry, mat);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Text sprite used for bin names. */
export function labelSprite(text, width = 0.6) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(8,24,16,.78)'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#e8f5ee'; g.font = 'bold 28px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(width, width / 4, 1); s.renderOrder = 10;
  return s;
}
