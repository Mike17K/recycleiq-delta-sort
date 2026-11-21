import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph, makePath } from '../src/core/index.js';
import { aisleGraph, bayXs, binRows } from '../src/scenes/layout.js';

test('shortest path goes the short way round and reports its length', () => {
  const g = new Graph({ nodes: { a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, c: { x: 2, y: 0 }, d: { x: 1, y: 5 } }, edges: [['a', 'b'], ['b', 'c'], ['a', 'd'], ['d', 'c']] });
  const p = g.path('a', 'c');
  assert.deepEqual(p.ids, ['a', 'b', 'c']); assert.equal(p.length, 2);
  assert.equal(g.nearest({ x: 1.9, y: 0.1 }).id, 'c');
  assert.ok(g.connected());
});

test('one-way edges are respected and strong connectivity is checked', () => {
  const g = new Graph({ nodes: { a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, c: { x: 1, y: 1 } }, edges: [['a', 'b', '>'], ['b', 'c', '>']] });
  assert.ok(g.path('a', 'c')); assert.equal(g.path('c', 'a'), null); assert.equal(g.connected(), false);
  const loop = new Graph({ nodes: g.nodes, edges: [['a', 'b', '>'], ['b', 'c', '>'], ['c', 'a', '>']] });
  assert.ok(loop.connected()); assert.deepEqual(loop.path('b', 'a').ids, ['b', 'c', 'a']);
});

test('unreachable nodes give null and connected() is false', () => {
  const g = new Graph({ nodes: { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } }, edges: [] });
  assert.equal(g.path('a', 'b'), null); assert.equal(g.connected(), false);
});

test('makePath interpolates, gives directions and ignores zero-length legs', () => {
  const p = makePath([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }]);
  assert.equal(p.length, 4);
  assert.deepEqual(p.at(1), { x: 1, y: 0 }); assert.deepEqual(p.at(3), { x: 2, y: 1 });
  assert.deepEqual(p.at(99), { x: 2, y: 2 }); assert.deepEqual(p.at(-1), { x: 0, y: 0 });
  assert.deepEqual(p.dirAt(1), { x: 1, y: 0 }); assert.deepEqual(p.dirAt(3), { x: 0, y: 1 });
});

test('aisleGraph: one-way loop is strongly connected, lanes run in their direction, homes are two-way spurs', () => {
  const { nodes, edges } = aisleGraph({
    lanes: [{ y: 1, dir: 1 }, { y: -1, dir: -1 }], xs: [2, 3], x0: 0, x1: 5,
    links: [{ from: 0, to: 1, at: 'x1' }, { from: 1, to: 0, at: 'x0' }], homes: [{ x: -1.5, y: 1, lane: 0 }],
  });
  const g = new Graph({ nodes, edges });
  assert.ok(g.connected());
  const east = g.path('L0_0', 'L0_3'), back = g.path('L0_3', 'L0_0');
  assert.equal(east.length, 5);                                  // along the lane
  assert.equal(back.length, 9);                                  // must go round the loop (down, along the other lane, up), never against the lane
  assert.deepEqual(g.path('H0', 'L0_0').ids, ['H0', 'L0_0']); assert.deepEqual(g.path('L0_0', 'H0').ids, ['L0_0', 'H0']);
});

test('bayXs lists every bay incl. standby bays; binRows centres the bay pair on the slot', () => {
  const bins = binRows(['HDPE', 'PP'], [2.0], 0.68, { capacity: 10, standby: true });
  assert.equal(bins.HDPE.x, 1.8); assert.deepEqual(bayXs(bins), [1.8, 2.2]);
});
