import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trapezoid, moveTime, mulberry32 } from '../src/core/index.js';

test('trapezoid: monotone in distance, never faster than vmax, ends at 1', () => {
  let prev = 0;
  for (const d of [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2]) {
    const T = trapezoid(d, 2.5, 25).T;
    assert.ok(T > prev && T >= d / 2.5 - 1e-12);
    prev = T;
  }
  const p = trapezoid(0.7, 2.5, 25);
  assert.equal(p.s(0), 0); assert.equal(p.s(p.T), 1);
  assert.ok(Math.abs(p.s(p.T / 2) - 0.5) < 1e-9);
});

test('moveTime is symmetric', () => {
  const m = { vmax: 2.5, amax: 25 }, a = { x: 0, y: 0 }, b = { x: 0.4, y: 0.3 };
  assert.equal(moveTime(a, b, m), moveTime(b, a, m));
});

test('mulberry32 is reproducible', () => {
  const a = mulberry32(5), b = mulberry32(5);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
});
