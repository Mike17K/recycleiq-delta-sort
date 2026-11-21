import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../ops/server/index.js';
import { distance, moveToward, kmeans } from '../ops/server/geo.js';
import { CONFIG, DESTINATIONS, ITEM_KG } from '../ops/server/config.js';
import { DESTINATIONS_CLIENT } from '../ops/web/destinations.js';
import { DICT } from '../ops/web/i18n.js';

const JPEG = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString('base64');
const fast = (app, scale = 10) => { app.store.clock.scale = scale; return app; };
const run = (app, seconds) => { for (let i = 0; i < seconds; i++) app.tick(1); };

test('geo: distance, movement and k-means partition', () => {
  const a = { lat: 37.98, lon: 23.73 }, b = { lat: 37.99, lon: 23.73 };
  assert.ok(Math.abs(distance(a, b) - 1113) < 5);
  assert.equal(moveToward(a, b, 5000).arrived, true);
  const m = moveToward(a, b, 100); assert.ok(!m.arrived && Math.abs(distance(a, m) - 100) < 0.5);
  const pts = Array.from({ length: 50 }, (_, i) => ({ lat: 37.9 + (i % 7) * 0.01, lon: 23.7 + (i % 5) * 0.01 }));
  const g = kmeans(pts, 4); assert.equal(g.flat().length, 50); assert.equal(new Set(g.flat()).size, 50);
});

test('fleet: trucks move, never exceed capacity, never share a target bin, keep fills in range', () => {
  const app = fast(createApp({ persist: false }));
  const start = app.store.publicTrucks().map(t => [t.lat, t.lon]);
  let moved = 0;
  for (let s = 0; s < 400; s++) {
    app.tick(1);
    const targets = app.fleet.trucks.map(t => t.target?.binIdx).filter(x => x !== undefined);
    assert.equal(new Set(targets).size, targets.length, 'two trucks chasing the same bin');
    for (const t of app.fleet.trucks) assert.ok(t.loadKg <= t.capacityKg + 1e-6, `${t.id} overloaded`);
  }
  app.store.publicTrucks().forEach((t, i) => { if (distance({ lat: start[i][0], lon: start[i][1] }, t) > 50) moved++; });
  assert.ok(moved >= 8, `only ${moved} trucks moved`);
  assert.ok(app.store.bins.every(b => b.fill >= 0 && b.fill <= 1));
  assert.ok(app.store.counters.collectedKg.general > 0 && app.store.counters.collectedKg.recycling > 0);
  assert.ok(app.store.counters.unloadedKg.sorting + app.store.counters.unloadedKg.transfer > 0, 'nobody unloaded in 400 s');
  app.server.close();
});

test('store: GPS validation and report snapping', () => {
  const app = createApp({ persist: false }), { store } = app;
  assert.equal(store.ingestGps({ truckId: 'X', lat: 200, lon: 0 }), false);
  assert.equal(store.ingestGps({ truckId: 'EXT-1', lat: 37.98, lon: 23.73, speed: 5, heading: 90 }), true);
  assert.ok(store.publicTrucks().some(t => t.id === 'EXT-1'));
  const bin = store.bins[10], near = store.addReport({ lat: bin.lat + 0.0001, lon: bin.lon });
  assert.equal(near.binId, bin.id); assert.ok(bin.fill >= 0.95); assert.equal(near.candidate, false);
  const far = store.addReport({ lat: 37.5, lon: 23.0 }); assert.equal(far.binId, null); assert.equal(far.candidate, true);
  app.server.close();
});

test('reports: assign -> collected, breakdown returns them to the queue', () => {
  const app = fast(createApp({ persist: false })), { store, fleet } = app;
  const b = store.bins.find(x => x.kind === 'b'), r = store.addReport({ lat: b.lat, lon: b.lon });
  const truck = fleet.nearestTruck(r.lat, r.lon); assert.ok(truck);
  store.assignReport(r.id, truck.id); assert.equal(store.getReport(r.id).status, 'assigned');
  fleet.breakdown(truck.id);
  assert.equal(store.getReport(r.id).status, 'new', 'breakdown must free the report');
  assert.equal(fleet.nearestTruck(r.lat, r.lon).id !== truck.id, true, 'broken truck must not be offered');
  const other = fleet.nearestTruck(r.lat, r.lon); store.assignReport(r.id, other.id);
  for (let s = 0; s < 400 && store.getReport(r.id).status !== 'collected'; s++) app.tick(1);
  assert.equal(store.getReport(r.id).status, 'collected');
  assert.ok(store.kpi([]).avgResponseSimMin > 0);
  app.server.close();
});

test('roads: routes follow directed streets, snap is close, real-time speeds are realistic', () => {
  const app = createApp({ persist: false }), { graph, fleet, store } = app;
  const a = graph.nearestNode({ lat: 37.9755, lon: 23.7348 }).node, b = graph.nearestNode({ lat: 38.0123, lon: 23.7655 }).node;
  const r = graph.route(a, b); assert.ok(r && r.lengthM > 5000 && r.lengthM < 12000, `route length ${r?.lengthM}`);
  for (let k = 1; k < r.nodes.length; k++) assert.ok(graph.adj[r.nodes[k - 1]].some(e => e[0] === r.nodes[k]), 'route uses a non-existent (or wrong-way) edge');
  assert.ok(r.seconds / 60 > 8 && r.seconds / 60 < 40, `trip ${(r.seconds / 60).toFixed(1)} min`);
  const far = store.bins.filter(x => graph.nearestNode(x).dist > 150).length; assert.ok(far / store.bins.length < 0.05, `${far} bins are far from any road`);
  let prev = store.publicTrucks(), maxStep = 0;
  for (let s = 0; s < 120; s++) { app.tick(1); const cur = store.publicTrucks(); cur.forEach((t, i) => { maxStep = Math.max(maxStep, distance(t, prev[i])); }); prev = cur; }
  assert.ok(maxStep <= 14.5, `a truck moved ${maxStep.toFixed(1)} m in one real second at 1x`);
  assert.ok(fleet.trucks.some(t => t.state === 'route'), 'somebody should be driving');
  app.server.close();
});

test('plants: mass balance and destinations add up', () => {
  const app = fast(createApp({ persist: false })); run(app, 60);
  for (const p of app.plants.summary()) {
    const mats = Object.values(p.materials).reduce((a, b) => a + b, 0);
    assert.ok(p.sortedKg > 0);
    assert.ok(Math.abs(mats - p.sortedKg) < 0.05);
    assert.ok(Math.abs(p.sortedKg + p.residueKg - p.inputKg) < 0.05);
    assert.ok(Math.abs(p.outbound.reduce((s, o) => s + o.kg, 0) - p.inputKg) < 0.1, 'outbound must equal input');
    assert.ok(p.recovery > 0 && p.recovery <= 1);
  }
  app.server.close();
});

test('client mirrors: destinations table and EL/EN keys stay in sync', () => {
  assert.deepEqual(DESTINATIONS_CLIENT, DESTINATIONS);
  assert.deepEqual(Object.keys(DICT.el).sort(), Object.keys(DICT.en).sort());
  assert.deepEqual(Object.keys(ITEM_KG).sort(), Object.keys(DESTINATIONS).sort());
});

test('HTTP API: state, GPS, reports, limits, static files', async () => {
  const app = createApp({ persist: false, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'riq-')) });
  await new Promise(r => app.server.listen(0, r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const j = (u, o) => fetch(base + u, o).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
  const post = (u, body) => j(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const st = await j('/api/state'); assert.equal(st.status, 200); assert.equal(st.body.trucks.length, 10); assert.ok(st.body.kpi.bins === 1943);
  assert.equal((await post('/api/speed', { scale: 5 })).body.scale, 5); assert.equal((await post('/api/speed', { scale: 500 })).status, 400);
  const tid = st.body.trucks[0].id; assert.ok(Array.isArray((await j(`/api/trucks/${tid}/route`)).body));
  assert.equal((await post('/api/gps', { truckId: 'EXT-9', lat: 37.97, lon: 23.72 })).body.accepted, 1);
  assert.equal((await post('/api/gps', [{ truckId: 'EXT-9', lat: 999, lon: 0 }])).status, 400);

  assert.equal((await post('/api/reports', { lat: 37.98 })).status, 400, 'location required');
  assert.equal((await post('/api/reports', { lat: 37.98, lon: 23.73, photo: 'data:text/html;base64,AAAA' })).status, 400, 'only jpeg');
  assert.equal((await post('/api/reports', { lat: 37.98, lon: 23.73, photo: 'data:image/jpeg;base64,AAAA' })).status, 400, 'not a real jpeg');
  const ok = await post('/api/reports', { lat: 37.98, lon: 23.73, photo: JPEG, note: 'x' }); assert.equal(ok.status, 201);
  assert.match(ok.body.photo, /^\/photos\/p.+\.jpg$/);
  assert.equal((await j(`/api/reports/${ok.body.id}`)).body.status, 'new');
  const asg = await post(`/api/reports/${ok.body.id}/assign`, {}); assert.equal(asg.status, 200); assert.equal(asg.body.status, 'assigned');
  assert.equal((await post('/api/reports/R9999/assign', {})).status, 404);

  let limited = false;
  for (let i = 0; i < CONFIG.rateLimit.perMinute + 1; i++) if ((await post('/api/reports', { lat: 37.98, lon: 23.73 })).status === 429) limited = true;
  assert.ok(limited, 'rate limit must trigger');

  for (const u of ['/', '/report', '/app.js', '/style.css']) assert.equal((await fetch(base + u)).status, 200, u);
  assert.notEqual((await fetch(base + '/..%2f..%2fpackage.json')).status, 200, 'path traversal');
  assert.equal((await fetch(base + '/photos/' + ok.body.photo.slice(8))).status, 200);
  app.server.close(); app.server.closeAllConnections?.();
});
