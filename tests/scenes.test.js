import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Plant, createLineConfig, validateLineConfig } from '../src/core/index.js';
import { listScenes } from '../src/scenes/index.js';

for (const scene of listScenes()) {
  test(`scene ${scene.id}: every line config is valid`, () => {
    const problems = scene.lines.flatMap(def => validateLineConfig(createLineConfig(def)));
    assert.deepEqual(problems, []);
  });
  test(`scene ${scene.id}: ids are unique and demo steps are ordered`, () => {
    assert.equal(new Set(scene.lines.map(l => l.id)).size, scene.lines.length);
    const ts = scene.demo.steps.map(s => s.t);
    assert.deepEqual(ts, [...ts].sort((a, b) => a - b));
  });
  test(`scene ${scene.id}: runs 60 s, conserves items, every robot works`, () => {
    const p = Plant.fromScene(scene); p.run(60);
    for (const l of p.lines) {
      const s = l.stats;
      assert.equal(s.spawned, s.picked + s.misses + s.residueExpected + l.items.length, `${l.id} conservation`);
      assert.ok(s.picked > 20, `${l.id} picked ${s.picked}`);
      l.robots.forEach(r => assert.ok(r.done > 0, `${l.id} robot ${r.id} never picked`));
    }
  });
}
