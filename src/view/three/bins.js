/**
 * Plant-level bins: one mesh per physical bin (active, standby, carried), with a live fill level, a "full" light and an
 * empty-slot marker that shows whenever no bin is present at an active spot (so a missing bin is visibly unavailable).
 */
import { THREE, material, addMesh, labelSprite } from './three-utils.js';
import { GROUND } from './stage.js';
import { MATERIALS, RESIDUE } from '../../core/index.js';

export const BIN_HEIGHT = 0.6;
const CARRY_LIFT = 0.16;     // carried bins ride on the mobile robot

function makeBin(root, bin, w, d) {
  const color = new THREE.Color(MATERIALS[bin.slot.material].color);
  const group = new THREE.Group(); root.add(group);
  const wall = material(color, { transparent: true, opacity: 0.5, roughness: 0.4, side: THREE.DoubleSide });
  addMesh(group, new THREE.BoxGeometry(w, 0.02, d), material(color.clone().multiplyScalar(0.6))).position.y = 0.01;
  for (const [x, z, bw, bd] of [[0, d / 2, w, 0.02], [0, -d / 2, w, 0.02], [w / 2, 0, 0.02, d], [-w / 2, 0, 0.02, d]]) {
    addMesh(group, new THREE.BoxGeometry(bw, BIN_HEIGHT, bd), wall).position.set(x, BIN_HEIGHT / 2, z);
  }
  const fill = addMesh(group, new THREE.BoxGeometry(w - 0.06, 1, d - 0.06), material(color, { roughness: 0.8 }), { shadow: false });
  const light = addMesh(group, new THREE.BoxGeometry(0.1, 0.05, 0.1), material(0xff3b2f, { emissive: 0xff3b2f, emissiveIntensity: 1.2 }), { shadow: false });
  light.position.set(w / 2 - 0.08, BIN_HEIGHT + 0.04, 0);
  return { bin, group, fill, light, usable: BIN_HEIGHT - 0.06 };
}

export function buildBins(root, plant, nameOf) {
  const views = [], markers = [], labels = [];
  for (const slot of plant.slots) {
    const isResidue = slot.material === RESIDUE, w = isResidue ? 0.5 : 0.36, d = isResidue ? 0.9 : 0.28, s = slot.spots.active;
    if (slot.spots.parking) {                                          // turntable under the bay pair
      const P = slot.spots.parking, disc = addMesh(root, new THREE.CylinderGeometry(0.3, 0.3, 0.012, 28), material(0x26332d, { roughness: 0.7 }), { shadow: false });
      disc.position.set((s.x + P.x) / 2, GROUND + 0.004, -(s.y + P.y) / 2);
    }
    slot.bins.forEach(b => views.push(makeBin(root, b, w, d)));
    if (slot.capacity != null || isResidue) {
      const marker = addMesh(root, new THREE.BoxGeometry(w, 0.01, d), material(0xff3b2f, { transparent: true, opacity: 0.35 }), { shadow: false });
      marker.position.set(s.x, GROUND + 0.006, -s.y); markers.push({ slot, marker });
    }
    labels.push({ slot, sprite: null });
  }
  function setNames(fn) {
    for (const l of labels) {
      if (l.sprite) root.remove(l.sprite);
      const s = l.slot.spots.active;
      l.sprite = labelSprite(fn(l.slot.material)); l.sprite.position.set(s.x, GROUND + BIN_HEIGHT + 0.14, -s.y); root.add(l.sprite);
    }
  }
  setNames(nameOf);

  function update(plant, t) {
    for (const v of views) {
      const p = plant.binPos(v.bin, t), carried = v.bin.loc === 'carried';
      v.group.position.set(p.x, GROUND + (carried ? CARRY_LIFT : 0), -p.y);
      const r = v.bin.ratio, h = Math.max(0.001, r * v.usable);
      v.fill.visible = r > 0; v.fill.scale.y = h; v.fill.position.y = 0.02 + h / 2;
      v.light.visible = v.bin.full;
    }
    for (const m of markers) m.marker.visible = m.slot.capacity != null && m.slot.state !== 'open' && m.slot.state !== 'closing';
  }
  return { update, setNames };
}
