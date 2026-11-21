/** Item meshes, created on demand and removed when the item leaves the simulation. Shape is data (SHAPES). */
import { THREE, material } from './three-utils.js';
import { MATERIALS } from '../../core/index.js';

const cyl = (r, h) => () => new THREE.CylinderGeometry(r, r, h, 14).rotateZ(Math.PI / 2);   // lying bottle / can
const SHAPES = {   // half height resting on the belt + geometry factory + look
  PET_CLEAR: { h: 0.04,  geo: cyl(0.04, 0.2), look: { transparent: true, opacity: 0.82, roughness: 0.15 } },
  PET_COLOR: { h: 0.04,  geo: cyl(0.04, 0.2), look: { transparent: true, opacity: 0.82, roughness: 0.15 } },
  HDPE:      { h: 0.05,  geo: () => new THREE.BoxGeometry(0.1, 0.1, 0.07) },
  PP:        { h: 0.03,  geo: () => new THREE.BoxGeometry(0.13, 0.06, 0.1) },
  PS:        { h: 0.03,  geo: () => new THREE.CylinderGeometry(0.05, 0.035, 0.06, 14) },
  ALU:       { h: 0.033, geo: cyl(0.033, 0.12), look: { metalness: 0.9, roughness: 0.25 } },
  GLASS:     { h: 0.05,  geo: () => new THREE.CylinderGeometry(0.035, 0.045, 0.1, 14), look: { transparent: true, opacity: 0.75, roughness: 0.1 } },
  CARTON:    { h: 0.04,  geo: () => new THREE.BoxGeometry(0.14, 0.08, 0.1) },
  STEEL:     { h: 0.035, geo: cyl(0.035, 0.1), look: { metalness: 0.95, roughness: 0.3 } },
  RESIDUE:   { h: 0.05,  geo: () => new THREE.DodecahedronGeometry(0.055) },
};
const FALLBACK = SHAPES.RESIDUE;

export function createItemsView(parent) {
  const meshes = new Map(), materials = new Map();
  const looks = type => {
    if (!materials.has(type)) materials.set(type, material(MATERIALS[type].color, { roughness: 0.7, ...(SHAPES[type] ?? FALLBACK).look }));
    return materials.get(type);
  };
  const yawOf = id => (((id * 2654435761) % 628) / 100);

  function update(line, t, robotViews) {
    const seen = new Set();
    for (const item of line.items) {
      seen.add(item.id);
      const shape = SHAPES[item.type] ?? FALLBACK;
      let mesh = meshes.get(item.id);
      if (!mesh) {
        mesh = new THREE.Mesh(shape.geo(), looks(item.type));
        mesh.castShadow = true; mesh.rotation.y = yawOf(item.id);
        parent.add(mesh); meshes.set(item.id, mesh);
      }
      const p = line.itemPos(item, t);
      const carried = item.state === 'carried' && item.holder;
      const y = carried ? robotViews[item.holder.id - 1].effectorHeight(line, t) - 0.1 + (shape.h - 0.04) : shape.h;
      mesh.position.set(p.x, y, -p.y);
    }
    for (const [id, mesh] of meshes) if (!seen.has(id)) { parent.remove(mesh); meshes.delete(id); }
  }
  return { update };
}
