import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Plant, isReachable } from '../src/core/index.js';
import { getScene } from '../src/scenes/index.js';

const single = (seed = 3) => Plant.fromScene(getScene('single-line'), { seed });
const key = p => JSON.stringify(p.decisions.map(d => [d.step, d.line, d.robot, d.item, d.pickXY]));

test('same seed gives the same sequence; a different seed differs', () => {
  const a = single(7), b = single(7), c = single(8);
  [a, b, c].forEach(p => p.run(40));
  assert.equal(key(a), key(b));
  assert.notEqual(key(a), key(c));
  assert.ok(a.decisions.length > 20);
});

test('every pick is inside the workspace, IK-reachable, and its bin is in reach', () => {
  const p = single(); p.run(60);
  const line = p.lines[0], { cfg } = line;
  for (const d of p.decisions) {
    const r = line.robots[d.robot - 1], bin = cfg.bins[d.bin];
    assert.ok(Math.hypot(d.pickXY[0] - r.x, d.pickXY[1] - r.y) <= cfg.R + 1e-6);
    assert.ok(isReachable(d.pickXY[0] - r.x, d.pickXY[1] - r.y, cfg.delta.zPick, cfg.delta));
    assert.ok(Math.hypot(bin.x - r.x, bin.y - r.y) <= cfg.binReach + 1e-6);
    assert.ok(d.reason);
  }
});

test('each item is picked once and a robot is never busy longer than elapsed time', () => {
  const p = single(5); p.run(60);
  const ids = p.decisions.map(d => d.item);
  assert.equal(new Set(ids).size, ids.length);
  p.lines[0].robots.forEach(r => assert.ok(r.busy <= p.t + 1e-9));
});

test('items are conserved: spawned = picked + misses + residue + in flight', () => {
  const p = single(11); p.control({ type: 'rate', value: 3 }); p.run(90);
  const l = p.lines[0], s = l.stats;
  assert.equal(s.spawned, s.picked + s.misses + s.residueExpected + l.items.length);
});

test('with all robots disabled every sortable item is a miss', () => {
  const p = single(2);
  [1, 2, 3].forEach(id => p.control({ type: 'robot', line: 'A', id, enabled: false }));
  p.run(40);
  assert.equal(p.lines[0].stats.picked, 0);
  assert.ok(p.lines[0].stats.misses > 10);
});

test('disabling a robot redistributes work to the others', () => {
  const p = single(4); p.run(10);
  p.control({ type: 'robot', line: 'A', id: 2, enabled: false });
  const before = p.decisions.length; p.run(30);
  const after = p.decisions.slice(before);
  assert.ok(after.length > 10 && after.every(d => d.robot !== 2));
});

test('a surge raises misses compared with the baseline', () => {
  const base = single(9); base.run(60);
  const surge = single(9); surge.control({ type: 'surge', mult: 3, dur: 30 }); surge.run(60);
  assert.ok(surge.lines[0].stats.misses > base.lines[0].stats.misses);
});
