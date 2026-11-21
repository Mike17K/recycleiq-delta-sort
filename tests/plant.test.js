import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Plant } from '../src/core/index.js';
import { getScene } from '../src/scenes/index.js';

const twin = () => Plant.fromScene(getScene('twin-lines'));

test('controls are scoped by line; "all" and omitted line hit every line', () => {
  const p = twin();
  p.control({ type: 'rate', line: 'A', value: 1 });
  assert.equal(p.line('A').rate, 1); assert.notEqual(p.line('B').rate, 1);
  p.control({ type: 'belt', value: 0.3 });
  assert.equal(p.line('A').v, 0.3); assert.equal(p.line('B').v, 0.3);
  p.control({ type: 'robot', line: 'B', id: 4, enabled: false });
  assert.equal(p.line('B').robots[3].enabled, false); assert.equal(p.line('A').robots[3].enabled, true);
});

test('lines are independent: changing one line does not alter the other', () => {
  const a = twin(), b = twin();
  b.control({ type: 'robot', line: 'A', id: 1, enabled: false });
  a.run(30); b.run(30);
  assert.deepEqual(a.line('B').summary(), b.line('B').summary());
});

test('replaying an exported run (controls on several lines) reproduces it; a tampered file fails', () => {
  const p = twin();
  p.run(10); p.control({ type: 'surge', line: 'all', mult: 2, dur: 8 });
  p.run(10); p.control({ type: 'robot', line: 'A', id: 3, enabled: false });
  p.run(10); p.control({ type: 'belt', line: 'B', value: 0.5 });
  p.run(10);
  const file = JSON.parse(JSON.stringify(p.exportJSON()));
  assert.ok(Plant.verify(file));
  file.summary.totals.picked += 1;
  assert.ok(!Plant.verify(file));
});

test('bounds cover every line', () => {
  const b = twin().bounds();
  assert.ok(b.width > 9 && b.depth > 4);
});
