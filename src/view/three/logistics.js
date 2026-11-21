/** Mobile-robot layer in 3D: aisle markings, big containers (with fill level) and the mobile robots. */
import { THREE, material, addMesh, labelSprite } from './three-utils.js';
import { GROUND } from './stage.js';

export function buildLogistics(root, plant) {
  const fleet = plant.fleet;
  if (!fleet) return { update() {} };
  const nodes = plant.logistics.aisles.nodes;

  const lane = material(0xc9a227, { transparent: true, opacity: 0.35, roughness: 1 });
  for (const [a, b] of plant.logistics.aisles.edges) {
    const A = nodes[a], B = nodes[b], len = Math.hypot(B.x - A.x, B.y - A.y);
    const strip = addMesh(root, new THREE.BoxGeometry(len, 0.004, 0.05), lane, { shadow: false });
    strip.position.set((A.x + B.x) / 2, GROUND + 0.004, -(A.y + B.y) / 2); strip.rotation.y = Math.atan2(B.y - A.y, B.x - A.x);
  }

  const containers = fleet.containers.map(c => {
    const g = new THREE.Group(); g.position.set(c.x, GROUND, -c.y); root.add(g);
    const wall = material(0x6b7d73, { transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    for (const [x, z, w, d] of [[0, 0.4, 1.0, 0.03], [0, -0.4, 1.0, 0.03], [0.5, 0, 0.03, 0.8], [-0.5, 0, 0.03, 0.8]]) {
      addMesh(g, new THREE.BoxGeometry(w, 0.9, d), wall).position.set(x, 0.45, z);
    }
    addMesh(g, new THREE.BoxGeometry(1.0, 0.03, 0.8), material(0x3d4a43)).position.y = 0.015;
    const fill = addMesh(g, new THREE.BoxGeometry(0.94, 1, 0.74), material(0xd9a441, { roughness: 0.9 }), { shadow: false });
    const label = labelSprite(c.id, 0.4); label.position.set(0, 1.1, 0); g.add(label);
    return { c, fill };
  });

  const amrs = fleet.amrs.map(a => {
    const g = new THREE.Group(); root.add(g);
    const body = material(0x2bb6c4, { metalness: 0.4 }), dark = material(0x1c2a24);
    addMesh(g, new THREE.BoxGeometry(0.6, 0.12, 0.42), body).position.y = 0.1;
    addMesh(g, new THREE.BoxGeometry(0.5, 0.03, 0.34), dark).position.y = 0.175;       // lift plate the bin rides on
    for (const [x, z] of [[0.2, 0.2], [0.2, -0.2], [-0.2, 0.2], [-0.2, -0.2]]) addMesh(g, new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12).rotateX(Math.PI / 2), dark).position.set(x, 0.05, z * 1.1);
    const mast = addMesh(g, new THREE.BoxGeometry(0.04, 0.3, 0.04), dark); mast.position.set(0.25, 0.3, 0);
    const lamp = addMesh(g, new THREE.SphereGeometry(0.035, 10, 8), material(0xffb020, { emissive: 0xffb020, emissiveIntensity: 1 }), { shadow: false }); lamp.position.set(0.25, 0.47, 0);
    const label = labelSprite(`M${a.id}`, 0.3); label.position.y = 0.75; g.add(label);
    return { a, g, body, last: null, yaw: 0 };
  });

  function update(plant, t) {
    for (const { c, fill } of containers) {
      const h = Math.max(0.001, c.ratio * 0.85); fill.visible = c.fill > 0; fill.scale.y = h; fill.position.y = 0.03 + h / 2;
    }
    for (const m of amrs) {
      const p = fleet.amrPos(m.a, t);
      if (m.last) { const dx = p.x - m.last.x, dy = p.y - m.last.y; if (Math.hypot(dx, dy) > 1e-4) m.yaw = Math.atan2(dy, dx); }
      m.last = p;
      m.g.position.set(p.x, GROUND, -p.y); m.g.rotation.y = m.yaw;
      m.body.color.set(m.a.enabled ? 0x2bb6c4 : 0x8a3a30);
    }
  }
  return { update };
}
