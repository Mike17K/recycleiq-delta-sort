/** RecycleIQ Ops server: static web app + REST + Server-Sent Events. Run: node ops/server/index.js */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG, SITES } from './config.js';
import { Store } from './store.js';
import { FleetSim } from './fleet-sim.js';
import { PlantSim } from './plant-sim.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

export function createApp({ dataDir = path.join(ROOT, 'data'), persist = true } = {}) {
  const binRows = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/bins.json'), 'utf8'));
  const store = new Store({ binRows, sites: SITES, snapshotFile: persist ? path.join(dataDir, 'state.json') : null });
  const fleet = new FleetSim(store), plants = new PlantSim(SITES);
  const clients = new Set();
  let plantSummary = plants.summary();

  const send = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const broadcast = (event, data) => clients.forEach(c => send(c, event, data));
  const live = () => ({ trucks: store.publicTrucks(), kpi: store.kpi(plantSummary), plants: plantSummary, sites: SITES, t: Date.now() });
  store.on('report', r => broadcast('report', r));

  let n = 0, last = Date.now();
  const timer = setInterval(() => {
    const now = Date.now(), dt = Math.min((now - last) / 1000, 5); last = now;
    fleet.tick(dt); plants.tick(dt); plantSummary = plants.summary(); n++;
    broadcast('live', live());
    if (n % 3 === 0) broadcast('fills', store.fills());
  }, CONFIG.tickMs);
  timer.unref?.();

  const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  const readBody = (req, limit) => new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch { reject(Object.assign(new Error('bad json'), { code: 400 })); } });
  });
  const publicReport = r => ({ ...r });

  async function api(req, res, url) {
    const m = req.method, p = url.pathname;
    if (m === 'GET' && p === '/api/bins') return json(res, 200, binRows.map(([id, lat, lon, k], i) => [id, lat, lon, k, Math.round(store.bins[i].fill * 100)]));
    if (m === 'GET' && p === '/api/state') return json(res, 200, { ...live(), reports: store.reports.map(publicReport), fills: store.fills(), config: { moveX: CONFIG.moveX, fillX: CONFIG.fillX, plantX: CONFIG.plantX } });
    if (m === 'GET' && p === '/api/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write('retry: 2000\n\n'); clients.add(res);
      send(res, 'live', live()); send(res, 'fills', store.fills());
      req.on('close', () => clients.delete(res)); return;
    }
    if (m === 'POST' && p === '/api/gps') {                 // custom GPS unit endpoint (single message or an array)
      const body = await readBody(req, 100_000), list = Array.isArray(body) ? body : [body];
      const accepted = list.filter(x => store.ingestGps(x)).length;
      return json(res, accepted ? 200 : 400, { accepted });
    }
    if (m === 'POST' && p === '/api/reports') {
      const ip = req.socket.remoteAddress ?? 'ip';
      if (store.rateLimited(ip)) return json(res, 429, { error: 'rate_limited' });
      const b = await readBody(req, CONFIG.maxPhotoBytes * 1.4);
      if (!Number.isFinite(b.lat) || !Number.isFinite(b.lon) || Math.abs(b.lat) > 90 || Math.abs(b.lon) > 180) return json(res, 400, { error: 'location_required' });
      let photo = null;
      if (typeof b.photo === 'string') {
        const mm = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(b.photo);
        if (!mm) return json(res, 400, { error: 'photo_must_be_jpeg' });
        const buf = Buffer.from(mm[1], 'base64');
        if (buf.length > CONFIG.maxPhotoBytes || buf[0] !== 0xff || buf[1] !== 0xd8) return json(res, 400, { error: 'bad_photo' });
        const name = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.jpg`;
        fs.mkdirSync(path.join(dataDir, 'photos'), { recursive: true }); fs.writeFileSync(path.join(dataDir, 'photos', name), buf); photo = `/photos/${name}`;
      }
      return json(res, 201, publicReport(store.addReport({ lat: b.lat, lon: b.lon, photo, note: b.note })));
    }
    let mm;
    if (m === 'GET' && (mm = /^\/api\/reports\/(R\d+)$/.exec(p))) { const r = store.getReport(mm[1]); return r ? json(res, 200, publicReport(r)) : json(res, 404, { error: 'not_found' }); }
    if (m === 'POST' && (mm = /^\/api\/reports\/(R\d+)\/(assign|reject)$/.exec(p))) {
      const r = store.getReport(mm[1]); if (!r) return json(res, 404, { error: 'not_found' });
      if (mm[2] === 'reject') return json(res, 200, store.rejectReport(r.id) ?? { error: 'cannot_reject' });
      const body = await readBody(req, 10_000);
      const stream = r.binId !== null && store.bins.find(b => b.id === r.binId)?.kind === 'r' ? 'recycling' : 'general';
      const truck = body.truckId ? fleet.truck(body.truckId) : fleet.nearestTruck(r.lat, r.lon, stream);
      if (!truck) return json(res, 409, { error: 'no_truck_available' });
      return json(res, 200, store.assignReport(r.id, truck.id) ?? { error: 'cannot_assign' });
    }
    if (m === 'POST' && (mm = /^\/api\/trucks\/([\w-]+)\/breakdown$/.exec(p))) return json(res, fleet.breakdown(mm[1]) ? 200 : 404, { ok: fleet.truck(mm[1])?.state === 'breakdown' });
    return json(res, 404, { error: 'not_found' });
  }

  function serveFile(res, base, rel) {
    const file = path.resolve(base, '.' + path.posix.normalize('/' + rel));
    if (!file.startsWith(base + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(buf);
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (url.pathname.startsWith('/photos/')) return serveFile(res, path.join(dataDir, 'photos'), url.pathname.slice(8));
      const rel = url.pathname === '/' ? 'index.html' : url.pathname === '/report' ? 'report.html' : url.pathname.slice(1);
      return serveFile(res, path.join(ROOT, 'web'), rel);
    } catch (e) { json(res, e.code === 413 || e.code === 400 ? e.code : 500, { error: e.message }); }
  });
  server.on('close', () => { clearInterval(timer); clients.forEach(c => c.end()); });
  return { server, store, fleet, plants, tick: dt => { fleet.tick(dt); plants.tick(dt); plantSummary = plants.summary(); } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server } = createApp();
  server.listen(CONFIG.port, () => console.log(`RecycleIQ Ops: http://localhost:${CONFIG.port}  (citizen portal: /report)`));
}
