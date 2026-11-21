/**
 * The factory hall around the plant: concrete floor with safety markings, walls with windows and a roller door,
 * steel columns, overhead lamps and a slow bridge crane, plus props (bale stacks, pallets, a shipping container,
 * a forklift, an office). Purely decorative: it reads only the world bounds and never touches the simulation.
 * Props live in the margin bands outside the plant bounds so they can never overlap a conveyor, bin or AMR lane.
 */
import { THREE, material, addMesh } from './three-utils.js';
import { GROUND } from './stage.js';

const H = 12;                                  // hall height above the floor (overhead gear stays above the orbiting camera)
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const STEEL = () => material(0x5d6b73, { roughness: 0.5, metalness: 0.6 });
const YELLOW = () => material(0xe8b923, { roughness: 0.6, metalness: 0.1 });
const glow = (color) => new THREE.MeshBasicMaterial({ color });

/** Small procedural canvas texture; draw(g, w, h) paints it. */
function texture(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}
const concrete = (g, w, h) => {
  g.fillStyle = '#5e6561'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${i % 2 ? '255,255,255' : '0,0,0'},${0.02 + (i * 7 % 9) / 300})`; g.fillRect((i * 37) % w, (i * 91) % h, 2, 2); }
  g.strokeStyle = 'rgba(15,20,18,.55)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);   // expansion joints
};
const corrugated = (g, w, h) => {
  for (let x = 0; x < w; x += 8) { g.fillStyle = (x / 8) % 2 ? '#7d8a91' : '#9aa7ad'; g.fillRect(x, 0, 8, h); }
};
const hazard = (g, w, h) => {
  g.fillStyle = '#e8b923'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b1f1d';
  for (let x = -h; x < w + h; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill(); }
};
const windowsTex = (g, w, h) => {
  g.fillStyle = '#9fd3ee'; g.fillRect(0, 0, w, h); g.strokeStyle = '#37464e'; g.lineWidth = 5;
  g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
};
const signTex = (g, w, h) => {
  g.fillStyle = '#0f3d2a'; g.fillRect(0, 0, w, h); g.fillStyle = '#2ecc71'; g.fillRect(0, h - 14, w, 14);
  g.fillStyle = '#eaf7ef'; g.font = 'bold 84px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('RecycleIQ', w / 2, h / 2 - 8);
};

export function buildFactory(parent, bounds) {
  const root = new THREE.Group(); parent.add(root);
  const overhead = new THREE.Group(); root.add(overhead);          // hidden when the camera rises above it
  const cx = (bounds.minX + bounds.maxX) / 2;
  const x0 = bounds.minX - 4.5, x1 = bounds.maxX + 4.5;             // side walls
  const zBack = -bounds.maxY - 3.4;                                  // sim +y side
  const zFront = -bounds.minY + 0.4 * bounds.width + 0.3 * bounds.depth + 4;
  const W = x1 - x0, D = zFront - zBack, zMid = (zFront + zBack) / 2, top = GROUND + H;

  // ---- floor with joints and a hazard border around the plant footprint
  const floor = addMesh(root, new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({
    map: texture(256, 256, concrete, W / 4, D / 4), roughness: 0.85, metalness: 0.05, color: 0x9ea6a1 }), { shadow: false });
  floor.rotation.x = -Math.PI / 2; floor.position.set(cx, GROUND + 0.004, zMid);
  const m = 0.7, bx0 = bounds.minX - m, bx1 = bounds.maxX + m, bz0 = -bounds.maxY - m, bz1 = -bounds.minY + m, sw = 0.14;
  [[bx0, bx1, bz0], [bx0, bx1, bz1]].forEach(([a, b, z]) => strip(a, b, z, true));
  [[bz0, bz1, bx0], [bz0, bz1, bx1]].forEach(([a, b, x]) => strip(a, b, x, false));
  function strip(a, b, at, alongX) {
    const len = b - a, mesh = addMesh(root, new THREE.PlaneGeometry(alongX ? len : sw, alongX ? sw : len),
      new THREE.MeshStandardMaterial({ map: texture(128, 32, hazard, len / 0.5, 1), roughness: 0.7 }), { shadow: false });
    mesh.rotation.x = -Math.PI / 2; if (!alongX) mesh.rotation.z = Math.PI / 2;
    mesh.position.set(alongX ? (a + b) / 2 : at, GROUND + 0.008, alongX ? at : (a + b) / 2);
  }
  // bollards at the corners of the footprint
  [[bx0, bz0], [bx1, bz0], [bx0, bz1], [bx1, bz1]].forEach(([x, z]) => {
    const p = addMesh(root, new THREE.CylinderGeometry(0.09, 0.09, 0.9, 12), YELLOW());
    p.position.set(x, GROUND + 0.45, z);
  });

  // ---- walls (built along local x, then rotated into place; all face the hall interior)
  const wallMat = () => new THREE.MeshStandardMaterial({ map: texture(128, 64, corrugated, 1, 1), roughness: 0.7, metalness: 0.3 });
  function wall(len, place) {
    const g = new THREE.Group(); root.add(g); place(g);
    const low = addMesh(g, box(len, 2.4, 0.3), material(0x6b726f, { roughness: 0.9, metalness: 0 }), { shadow: false });
    low.position.set(0, GROUND + 1.2, 0);
    const upMat = wallMat(); upMat.map.repeat.set(len / 1.0, 1);
    const up = addMesh(g, box(len, H - 2.4, 0.2), upMat, { shadow: false });
    up.position.set(0, GROUND + 2.4 + (H - 2.4) / 2, 0);
    const wins = addMesh(g, new THREE.PlaneGeometry(len - 1, 1.3), new THREE.MeshBasicMaterial({
      map: texture(512, 64, windowsTex, Math.round(len / 2.4), 1) }), { shadow: false });
    wins.position.set(0, GROUND + 5.7, 0.13);
    return g;
  }
  const back = wall(W, g => g.position.set(cx, 0, zBack));
  const left = wall(D, g => { g.position.set(x0, 0, zMid); g.rotation.y = Math.PI / 2; });
  const right = wall(D, g => { g.position.set(x1, 0, zMid); g.rotation.y = -Math.PI / 2; });

  // company sign on the back wall
  const sign = addMesh(back, new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: texture(640, 160, signTex) }), { shadow: false });
  sign.position.set(-W / 2 + 6, GROUND + 4.1, 0.14);

  // roller door on the right wall (truck side), opposite the big containers
  const door = new THREE.Group(); right.add(door); door.position.set(0, GROUND, 0.16);
  const doorFrame = addMesh(door, box(5.4, 4.2, 0.12), YELLOW(), { shadow: false }); doorFrame.position.y = 2.1;
  const slats = new THREE.MeshStandardMaterial({ map: texture(64, 128, (g, w, h) => {
    for (let y = 0; y < h; y += 8) { g.fillStyle = (y / 8) % 2 ? '#434d52' : '#566168'; g.fillRect(0, y, w, 8); } }), roughness: 0.6, metalness: 0.5 });
  const slab = addMesh(door, new THREE.PlaneGeometry(5, 3.9), slats, { shadow: false }); slab.position.set(0, 2.05, 0.07);

  // ---- columns and beams
  const colX = [], colZ = [];
  for (let x = x0 + 2.5; x < x1 - 1; x += 6) colX.push(x);
  for (let z = zBack + 2.5; z < zFront - 1; z += 6) colZ.push(z);
  const column = (x, z) => {
    const g = new THREE.Group(); g.position.set(x, GROUND, z); root.add(g);
    const shaft = addMesh(g, box(0.34, H, 0.34), STEEL()); shaft.position.y = H / 2;
    const flange = addMesh(g, box(0.5, 0.06, 0.5), STEEL()); flange.position.y = 0.03;
    const guard = addMesh(g, box(0.4, 1.0, 0.4), YELLOW()); guard.position.y = 0.5;
  };
  colX.forEach(x => column(x, zBack + 0.45));
  colZ.forEach(z => { column(x0 + 0.45, z); column(x1 - 0.45, z); });
  const beam = (len, x, y, z, rotY = 0) => { const b = addMesh(overhead, box(len, 0.3, 0.18), STEEL(), { shadow: false }); b.position.set(x, y, z); b.rotation.y = rotY; };
  beam(W, cx, top - 0.3, zBack + 0.45);
  colZ.forEach(z => beam(W, cx, top - 0.25, z));                    // main trusses across the hall

  // ---- overhead lamps and the bridge crane (moves slowly with sim time)
  const lampGeo = new THREE.ConeGeometry(0.42, 0.28, 16, 1, true), discGeo = new THREE.CircleGeometry(0.4, 16);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xc9d1d4, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 });
  const lampGlow = glow(0xfff4d6);
  for (let x = x0 + 4; x < x1 - 1; x += 4) for (let z = zBack + 3; z < zFront - 1; z += 4.5) {
    const cone = new THREE.Mesh(lampGeo, lampMat); cone.position.set(x, top - 1.1, z); overhead.add(cone);
    const disc = new THREE.Mesh(discGeo, lampGlow); disc.rotation.x = Math.PI / 2; disc.position.set(x, top - 1.26, z); overhead.add(disc);
  }
  const crane = new THREE.Group(); overhead.add(crane);
  const railY = top - 1.7;
  [x0 + 0.35, x1 - 0.35].forEach(x => { const r = addMesh(overhead, box(0.22, 0.22, D), STEEL(), { shadow: false }); r.position.set(x, railY, zMid); });
  const bridge = addMesh(crane, box(W - 0.6, 0.5, 0.5), YELLOW(), { shadow: false }); bridge.position.set(cx, railY + 0.3, 0);
  const trolley = new THREE.Group(); crane.add(trolley);
  const car = addMesh(trolley, box(1.0, 0.4, 0.9), STEEL(), { shadow: false }); car.position.y = railY;
  const cable = addMesh(trolley, new THREE.CylinderGeometry(0.02, 0.02, 1, 6), material(0x222222), { shadow: false });
  const hook = addMesh(trolley, box(0.35, 0.4, 0.25), YELLOW(), { shadow: false });
  const cableLen = 2.4; cable.scale.y = cableLen; cable.position.y = railY - cableLen / 2; hook.position.y = railY - cableLen - 0.2;

  // ---- props in the margin bands
  const colors = [0x8fb8d8, 0xd9d9d9, 0x3f8f5a, 0xc8a165, 0x7a7f86];
  const bale = (g, x, y, z, i) => {
    const b = addMesh(g, box(1.0, 0.75, 0.8), material(colors[i % colors.length], { roughness: 0.9, metalness: 0 }));
    b.position.set(x, y, z);
    [-0.25, 0.25].forEach(dx => { const s = addMesh(g, box(0.04, 0.77, 0.82), material(0x20252a, { roughness: 0.8 }), { shadow: false }); s.position.set(x + dx, y, z); });
  };
  const pallet = (g, x, z) => {
    const p = addMesh(g, box(1.2, 0.14, 0.8), material(0x9a7448, { roughness: 0.9, metalness: 0 })); p.position.set(x, GROUND + 0.07, z);
  };
  const props = new THREE.Group(); root.add(props);
  // bale stacks along the back wall, between the left wall and the sign
  for (let s = 0; s < 3; s++) {
    const bx = x0 + 3 + s * 2.4, bz = zBack + 1.1;
    pallet(props, bx, bz);
    for (let lv = 0; lv < 3 - (s % 2); lv++) bale(props, bx, GROUND + 0.14 + 0.375 + lv * 0.75, bz, s + lv);
  }
  // shipping container, standing along the back wall near the right-hand side
  const sc = new THREE.Group(); props.add(sc); sc.position.set(x1 - 8.2, GROUND, zBack + 1.5);
  const scBody = addMesh(sc, box(6.0, 2.5, 2.3), new THREE.MeshStandardMaterial({ map: texture(128, 64, (g, w, h) => {
    for (let x = 0; x < w; x += 8) { g.fillStyle = (x / 8) % 2 ? '#7a2e2a' : '#8d3a35'; g.fillRect(x, 0, 8, h); } }, 24, 1), roughness: 0.6, metalness: 0.4 }));
  scBody.position.y = 1.25 + 0.1;
  const scFoot = addMesh(sc, box(6.0, 0.2, 2.3), STEEL()); scFoot.position.y = 0.1;
  // site office
  const office = new THREE.Group(); props.add(office); office.position.set(x1 - 2.4, GROUND, zBack + 1.8);
  addMesh(office, box(3.2, 2.5, 2.4), material(0xdfe5e8, { roughness: 0.7, metalness: 0.05 })).position.y = 1.25;
  const officeWin = addMesh(office, new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshBasicMaterial({ color: 0x86c5e6 }), { shadow: false });
  officeWin.position.set(0, 1.5, 1.21);
  addMesh(office, box(3.4, 0.12, 2.6), STEEL()).position.y = 2.56;
  // forklift parked in the left front margin
  const fork = new THREE.Group(); props.add(fork); fork.position.set(x0 + 2.2, GROUND, zFront - 6.5); fork.rotation.y = 0.5;
  const fl = (g, w, h, d, x, y, z, mat) => { const mesh = addMesh(g, box(w, h, d), mat); mesh.position.set(x, y, z); return mesh; };
  fl(fork, 1.0, 0.55, 1.7, 0, 0.55, 0, material(0xe8b923, { roughness: 0.5 }));
  fl(fork, 0.95, 0.12, 0.9, 0, 1.55, -0.2, material(0x2b2f33));                            // overhead guard
  [[-0.45, -0.7], [0.45, -0.7], [-0.45, 0.35], [0.45, 0.35]].forEach(([x, z]) => fl(fork, 0.06, 0.95, 0.06, x, 1.05, z + 0.2, material(0x2b2f33)));
  fl(fork, 0.9, 1.4, 0.1, 0, 0.9, 0.95, material(0x30363a));                               // mast
  [-0.3, 0.3].forEach(x => fl(fork, 0.1, 0.06, 0.9, x, 0.12, 1.4, material(0x30363a)));    // forks
  [[-0.5, -0.55], [0.5, -0.55], [-0.5, 0.55], [0.5, 0.55]].forEach(([x, z]) => {
    const w = addMesh(fork, new THREE.CylinderGeometry(0.28, 0.28, 0.22, 14), material(0x15181a, { roughness: 0.9 }));
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.28, z);
  });
  // pallet with a wrapped bale stack in front of the forklift
  pallet(props, x0 + 3.2, zFront - 8.8); [0, 1].forEach(lv => bale(props, x0 + 3.2, GROUND + 0.14 + 0.375 + lv * 0.75, zFront - 8.8, lv + 2));

  // fire extinguisher and info boards on the back wall columns
  colX.slice(0, 4).forEach((x, i) => {
    const e = addMesh(props, new THREE.CylinderGeometry(0.07, 0.07, 0.38, 10), material(0xc0392b, { roughness: 0.4 }));
    e.position.set(x, GROUND + 1.3, zBack + 0.66 + (i % 2) * 0);
  });

  /** Called each frame: moves the crane and hides overhead gear when the camera is above it. */
  function update(t, camera) {
    crane.position.z = zMid + Math.sin(t * 0.05) * (D / 2 - 3);
    trolley.position.x = cx + Math.sin(t * 0.09 + 1) * (W / 2 - 4);
    if (camera) overhead.visible = camera.position.y < top - 1.5;
  }
  update(0);
  return { root, update, hall: { x0, x1, zBack, zFront, H } };
}
