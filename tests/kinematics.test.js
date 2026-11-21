import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ik, deltaPose, isReachable, reachRadius, DEFAULT_DELTA as P } from '../src/core/index.js';

const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('IK is symmetric on the axis and null out of reach', () => {
  const a = ik(0, 0, P.zPick, P);
  assert.ok(Math.abs(a[0] - a[1]) < 1e-9 && Math.abs(a[1] - a[2]) < 1e-9);
  assert.equal(ik(5, 0, P.zPick, P), null);
});

test('reach radius is consistent with isReachable', () => {
  const R = reachRadius(P);
  assert.ok(R > 0.9, `R=${R}`);
  assert.ok(isReachable(R * 0.95, 0, P.zPick, P));
  assert.ok(!isReachable(R * 1.2, 0, P.zPick, P));
});

test('deltaPose keeps arm lengths and puts wrists on the effector ring', () => {
  for (const [x, y, z] of [[0, 0, P.zPick], [0.4, -0.3, P.zPick], [-0.5, 0.45, P.zPick + 0.15], [0.7, 0.2, P.zPick + 0.1]]) {
    const pose = deltaPose(x, y, z, P);
    assert.ok(pose);
    for (const a of pose) {
      assert.ok(Math.abs(d3(a.shoulder, a.elbow) - P.rf) < 1e-9, 'upper arm');
      assert.ok(Math.abs(d3(a.elbow, a.wrist) - P.re) < 1e-6, 'forearm');
      assert.ok(Math.abs(Math.hypot(a.wrist.x - x, a.wrist.y - y) - P.e / (2 * Math.sqrt(3))) < 1e-9, 'wrist ring');
    }
  }
  assert.equal(deltaPose(5, 0, P.zPick, P), null);
});
