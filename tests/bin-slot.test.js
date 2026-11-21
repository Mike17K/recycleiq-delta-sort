import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BinSlot, DT } from '../src/core/index.js';

const slot = (over = {}) => new BinSlot('A', 'HDPE', { x: 2, y: 0.7, capacity: 3, standby: { x: 2.4, y: 0.7 }, tSwitch: 1, ...over }, { x: 0, y: 0 });
const fillTo = (s, n) => { for (let i = 0; i < n; i++) { const b = s.reserve(); assert.ok(s.deposit(b)); } };
const run = (s, from, secs) => { let t = from; for (let i = 0; i < Math.round(secs / DT); i++) { t += DT; s.update(t, DT); } return t; };

test('a fresh slot is open; reservations count against capacity', () => {
  const s = slot();
  assert.equal(s.state, 'open');
  s.reserve(); s.reserve(); s.reserve();
  assert.equal(s.canAccept(), false);          // 3 reserved = full house, nothing more may be sent
  assert.equal(s.state, 'closing');
});

test('a full bin with a standby switches over after tSwitch; during the switch nothing is accepted', () => {
  const s = slot(); fillTo(s, 3);
  s.update(DT, DT);
  assert.equal(s.state, 'switching');
  assert.equal(s.canAccept(), false);
  assert.equal(s.reserve === undefined, false);
  run(s, DT, 0.9); assert.equal(s.state, 'switching');
  run(s, 0.9 + DT, 0.3);
  assert.equal(s.state, 'open'); assert.equal(s.swaps, 1);
  assert.equal(s.parking.full, true);          // the full bin waits in the parking bay
  assert.equal(s.active.fill, 0);
});

test('a bin with items still on their way is never switched or serviced', () => {
  const s = slot(); fillTo(s, 2); const pending = s.reserve();     // 2 in the bin, 1 in flight
  run(s, 0, 2);
  assert.equal(s.swaps, 0); assert.equal(s.serviceable().length, 0);
  assert.ok(s.deposit(pending));
  run(s, 2, 0.1); assert.equal(s.state, 'switching');
});

test('deposit into a bin that is not at the active spot is refused (never silently accepted)', () => {
  const s = slot(); const b = s.reserve();
  s.takeBin(s.active);                                              // bin removed while an item is "in flight"
  assert.equal(s.state, 'gap'); assert.equal(s.canAccept(), false);
  assert.equal(s.deposit(b), false);
});

test('no standby: a full slot stays closed until a mobile robot returns an emptied bin', () => {
  const s = slot({ standby: null }); fillTo(s, 3);
  run(s, 0, 5);
  assert.equal(s.canAccept(), false); assert.equal(s.swaps, 0);
  assert.deepEqual(s.serviceable().map(b => b.loc), ['active']);
  const bin = s.active; s.takeBin(bin);
  assert.equal(s.state, 'gap'); assert.equal(s.canAccept(), false);
  bin.fill = 0; assert.ok(s.placeBin(bin));
  assert.equal(s.state, 'open'); assert.equal(s.active, bin);
});

test('an emptied bin goes to the parking bay when the active bay is occupied', () => {
  const s = slot(); fillTo(s, 3); run(s, 0, 2);                     // switched: full bin now parked
  const parked = s.parking; assert.ok(parked.full);
  s.takeBin(parked); assert.equal(s.parking, null);
  parked.fill = 0; assert.equal(s.placeSpot(), 'parking'); assert.ok(s.placeBin(parked));
  assert.equal(s.parking, parked);
});

test('a full active bin is only serviced when its neighbouring bay is empty (clear path out)', () => {
  const s = slot(); fillTo(s, 3); run(s, 0, 2);                     // switched: full bin parked
  fillTo(s, 3);                                                     // the new active bin fills too, standby bay is occupied
  assert.deepEqual(s.serviceable().map(b => b.loc), ['parking']);   // only the parked one may leave first
  s.takeBin(s.parking);
  assert.deepEqual(s.serviceable().map(b => b.loc), ['active']);    // now the active one has a free neighbour bay
});

test('the carousel keeps the two bins a constant distance apart while switching (they never cross)', () => {
  const s = slot(); fillTo(s, 3);
  s.update(DT, DT);
  const sw = s.switching, d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), base = d(s.spots.active, s.spots.parking);
  for (let k = 0; k <= 10; k++) {
    const t = sw.t0 + (sw.t1 - sw.t0) * k / 10;
    assert.ok(Math.abs(d(s.binPos(sw.from, t), s.binPos(sw.to, t)) - base) < 1e-9);
  }
  assert.ok(base >= 0.39);
  const end = s.binPos(sw.from, sw.t1); assert.ok(d(end, s.spots.parking) < 1e-9);
});

test('unlimited capacity never fills or blocks', () => {
  const s = slot({ capacity: null, standby: null }); fillTo(s, 500);
  assert.equal(s.canAccept(), true); assert.equal(s.serviceable().length, 0);
});

test('blocked time accumulates only while the slot cannot accept', () => {
  const s = slot({ standby: null }); fillTo(s, 3); run(s, 0, 2);
  assert.ok(Math.abs(s.blockedTime - 2) < 0.05);
});
