import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Plant, createLineConfig, createLogisticsConfig, validateLogisticsConfig } from '../src/core/index.js';
import { getScene, listScenes } from '../src/scenes/index.js';
import { playDemo } from '../src/scenes/demo-timeline.js';

const scene = id => Plant.fromScene(getScene(id));
const everyBin = p => p.lines.flatMap(l => Object.values(l.slots)).flatMap(s => s.bins);

/** A tiny one-robot line with small bins so the logistics are exercised within seconds. */
function tinyPlant({ standby = true, amrs = 1, capacity = 5, containerCap = 200, tTruck = null } = {}) {
  const line = createLineConfig({ id: 'T', belt: { length: 3.4, width: 1, speed: 0.5 }, spawn: { rate: 1.5, seed: 3, mix: { HDPE: 1 } },
    robots: [{ x: 1.4 }], bins: { HDPE: { x: 2.0, y: 0.68, capacity, standby } } });
  const homes = Array.from({ length: amrs }, (_, i) => ({ node: `h${i}` }));
  const logistics = createLogisticsConfig({ amrs: homes,
    aisles: { nodes: { a0: { x: 0, y: 1.6 }, a1: { x: 2, y: 1.6 }, a2: { x: 4, y: 1.6 }, h0: { x: -1.2, y: 1.6 }, h1: { x: -1.2, y: 2.6 } },
      edges: [['a0', 'a1'], ['a1', 'a2'], ['h0', 'a0'], ['h1', 'a0']] },
    containers: [{ id: 'C', x: 4.4, y: 1.6, capacity: containerCap, tTruck }] });
  return new Plant({ id: 'tiny', name: { en: 'tiny', el: 'tiny' }, configs: [line], logistics });
}

for (const scene of listScenes().filter(s => s.logistics)) {
  test(`scene ${scene.id}: logistics config is valid`, () => {
    const p = Plant.fromScene(scene);
    assert.deepEqual(validateLogisticsConfig(p.logistics, p.configs), []);
  });
}

test('invariants over a full demo: nothing is ever dropped where no bin is, and bins in transit have no pending items', () => {
  for (const s of listScenes().filter(x => x.logistics)) {
    const p = Plant.fromScene(s);
    for (let i = 0; i < 90 / 0.02; i++) {
      p.step();
      for (const b of everyBin(p)) {
        if (b.loc === 'carried') assert.equal(b.reserved, 0, `${b.id} carried with items in flight`);
        assert.ok(b.reserved >= 0);
      }
      for (const l of p.lines) for (const sl of Object.values(l.slots)) {
        if (sl.state === 'gap' || sl.state === 'switching') assert.equal(sl.canAccept(), false);
      }
    }
    assert.equal(p.summary().totals.violations, 0);
  }
});

test('sorted items are conserved: picked = items in bins + items in containers (+ truck-emptied)', () => {
  for (const s of listScenes().filter(x => x.logistics)) {
    const p = Plant.fromScene(s); p.run(90);
    const inBins = p.lines.reduce((a, l) => a + Object.values(l.slots).filter(sl => sl.material !== 'RESIDUE').flatMap(sl => sl.bins).reduce((n, b) => n + b.fill, 0), 0);
    const inContainers = p.fleet.containers.reduce((a, c) => a + c.fill, 0);
    assert.equal(p.summary().totals.picked, inBins + inContainers, s.id);
  }
});

test('mobile robots complete full service cycles and the slot works again afterwards', () => {
  const p = tinyPlant(); p.run(120);
  assert.ok(p.fleet.stats.serviced >= 2, `serviced ${p.fleet.stats.serviced}`);
  assert.equal(p.summary().totals.violations, 0);
  const slot = p.lines[0].slots.HDPE;
  assert.ok(slot.swaps >= 2);
});

test('with a standby bin the slot keeps accepting through a service trip; without one it blocks', () => {
  const withStandby = tinyPlant({ standby: true }); withStandby.run(120);
  const without = tinyPlant({ standby: false }); without.run(120);
  assert.ok(without.lines[0].slots.HDPE.blockedTime > withStandby.lines[0].slots.HDPE.blockedTime);
  assert.ok(without.lines[0].stats.missBinUnavailable > withStandby.lines[0].stats.missBinUnavailable);
});

test('with no mobile robots the bins eventually block and items become "bin unavailable" misses', () => {
  const p = tinyPlant({ amrs: 1 }); p.control({ type: 'amr', id: 1, enabled: false }); p.run(120);
  assert.equal(p.fleet.stats.serviced, 0);
  assert.ok(p.lines[0].stats.missBinUnavailable > 5);
  assert.equal(p.lines[0].stats.violations, 0);
});

test('a full container is not used until it is emptied; a truck frees it', () => {
  const stuck = tinyPlant({ containerCap: 7 }); stuck.run(150);
  assert.ok(stuck.fleet.containers[0].fill <= 7);
  const served = tinyPlant({ containerCap: 7, tTruck: 10 }); served.run(150);
  assert.ok(served.fleet.containers[0].emptied >= 1);
  assert.ok(served.fleet.stats.serviced > stuck.fleet.stats.serviced);
});

test('a bin is claimed by one mobile robot only', () => {
  const p = tinyPlant({ amrs: 2 });
  for (let i = 0; i < 150 / 0.02; i++) {
    p.step();
    const claimed = p.fleet.amrs.filter(a => a.plan?.ctx.bin).map(a => a.plan.ctx.bin.id);
    assert.equal(new Set(claimed).size, claimed.length);
  }
});

test('replay with logistics (fillBin and amr controls included) reproduces the run', () => {
  const p = scene('single-line');
  p.run(15); p.control({ type: 'fillBin', line: 'A', material: 'HDPE', fraction: 0.95 });
  p.run(15); p.control({ type: 'amr', id: 1, enabled: false });
  p.run(15); p.control({ type: 'amr', id: 1, enabled: true });
  p.run(30);
  const file = JSON.parse(JSON.stringify(p.exportJSON()));
  assert.ok(p.fleet.decisions.length > 0);
  assert.ok(Plant.verify(file));
  file.summary.logistics.serviced += 1;
  assert.ok(!Plant.verify(file));
});

// ---------- collisions and layout ----------
const demoPlant = id => { const sc = getScene(id); return { sc, p: Plant.fromScene(sc) }; };
const binsOf = p => p.lines.flatMap(l => Object.values(l.slots)).flatMap(s => s.bins);

test('mobile robots keep their distance on both demo scenes (no collisions, no deadlock)', () => {
  for (const id of ['single-line', 'twin-lines']) {
    const { sc, p } = demoPlant(id);
    playDemo(p, sc.demo, { seconds: 120 });
    assert.ok(p.fleet.stats.minDistance >= 0.7, `${id}: closest approach ${p.fleet.stats.minDistance.toFixed(2)} m`);
    const forced = sc.demo.steps.flatMap(x => x.controls ?? []).filter(c => c.type === 'fillBin').length;
    assert.ok(p.fleet.stats.serviced >= forced, `${id}: serviced ${p.fleet.stats.serviced} of ${forced} forced bins`);
    p.fleet.amrs.forEach(a => assert.ok(a.waited < 0.4 * p.t, `${id}: AMR${a.id} waited ${a.waited.toFixed(1)} s`));
  }
});

test('bins never overlap each other, and a full bin is only pulled out through a free bay', () => {
  const { sc, p } = demoPlant('twin-lines');
  playDemo(p, sc.demo, { seconds: 100, onStep: pl => {
    if (pl.n % 5) return;
    const bins = binsOf(pl), t = pl.t, pos = bins.map(b => pl.binPos(b, t));
    for (let i = 0; i < bins.length; i++) for (let j = i + 1; j < bins.length; j++) {
      const same = bins[i].slot === bins[j].slot, d = Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y);
      assert.ok(d >= (same ? 0.39 : 0.3), `${bins[i].id} / ${bins[j].id} only ${d.toFixed(2)} m apart at ${t.toFixed(1)} s`);
    }
    for (const a of pl.fleet.amrs) {
      const ph = a.plan?.phase;
      if (ph?.name === 'pull' && a.plan.ctx.bin.loc === 'active') assert.equal(a.plan.ctx.slot.parking, null, 'pulled the active bin through an occupied neighbour bay');
    }
  } });
});

test('mobile robots stay in the aisles: never close to a bin resting in its bay', () => {
  const { sc, p } = demoPlant('twin-lines');
  playDemo(p, sc.demo, { seconds: 100, onStep: pl => {
    if (pl.n % 5) return;
    for (const a of pl.fleet.amrs) {
      const pos = pl.fleet.amrPos(a);
      for (const b of binsOf(pl)) {
        if (b.carrier === a) continue;                                  // the bin it is moving
        const q = pl.binPos(b, pl.t);
        assert.ok(Math.hypot(pos.x - q.x, pos.y - q.y) >= 0.6, `AMR${a.id} within ${Math.hypot(pos.x - q.x, pos.y - q.y).toFixed(2)} m of ${b.id}`);
      }
    }
  } });
});

test('no mobile robot ever drives against a one-way lane (position always follows the aisle graph direction)', () => {
  const { sc, p } = demoPlant('single-line');
  const g = p.fleet.graph; let moved = 0;
  playDemo(p, sc.demo, { seconds: 100, onStep: pl => {
    for (const a of pl.fleet.amrs) {
      const h = pl.fleet.heading(a), pos = pl.fleet.amrPos(a);
      if (!a.plan || !(h.x || h.y)) continue;
      // on the two long lanes the heading must match the lane direction
      if (pos.x < -0.3) continue;                                      // sidings are two-way spurs
      if (Math.abs(pos.y - 1.6) < 1e-6 && Math.abs(h.x) > 0.5) { assert.ok(h.x > 0, 'top lane runs east'); moved++; }
      if (Math.abs(pos.y + 1.6) < 1e-6 && Math.abs(h.x) > 0.5) { assert.ok(h.x < 0, 'bottom lane runs west'); moved++; }
    }
  } });
  assert.ok(moved > 100); assert.ok(g.connected());
});

test('forced fills lead to a full cycle: carousel swap, bin hauled and emptied in ~1 s, bin back as standby', () => {
  const { sc, p } = demoPlant('single-line');
  playDemo(p, sc.demo, { seconds: 70 });
  const slot = p.lines[0].slots.PET_CLEAR;
  assert.ok(slot.swaps >= 1);
  assert.ok(p.fleet.stats.serviced >= 1);
  assert.equal(p.fleet.cfg.tEmpty, 1);
  assert.ok(slot.bins.every(b => !b.claimed || b.carrier), 'no bin stuck in a half-finished trip');
  assert.equal(p.summary().totals.violations, 0);
});

test('stress: every bin of the twin plant filled at once is serviced by 5 mobile robots without touching or deadlock', () => {
  const p = Plant.fromScene(getScene('twin-lines'));
  p.run(5);
  for (const l of p.lines) for (const sl of Object.values(l.slots)) if (sl.capacity != null) p.control({ type: 'fillBin', line: l.id, material: sl.material, fraction: 1 });
  p.control({ type: 'rate', value: 0.05 });                       // stop the inflow so the queue can drain
  let min = Infinity;
  for (let i = 0; i < 500 / 0.02; i++) { p.step(); min = Math.min(min, p.fleet.stats.minDistance); }
  const stuck = p.slots.filter(s => s.capacity != null && s.serviceable().length);
  assert.ok(p.fleet.stats.serviced >= 18, `serviced ${p.fleet.stats.serviced}`);
  assert.equal(stuck.length, 0, `still waiting: ${stuck.map(s => s.id).join(', ')}`);
  assert.ok(min >= 0.7, `closest approach ${min.toFixed(2)} m`);
  assert.equal(p.summary().totals.violations, 0);
});
