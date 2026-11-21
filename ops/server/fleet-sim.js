/**
 * Simulated garbage-truck fleet. Each truck owns a sector of bins, collects the fullest nearby ones, unloads at a plant when
 * it is nearly full, and serves citizen reports the operator assigns to it. Every tick it emits the same GPS message a real
 * on-board unit would send (store.ingestGps), so a real tracker can replace this module without touching anything else.
 */
import { CONFIG, BIN_KINDS } from './config.js';
import { distance, bearing, nearest, kmeans } from './geo.js';
import { RoadGraph } from './router.js';

const MOVING = 'route', IDLE = 'idle', COLLECTING = 'collecting', UNLOADING = 'unloading', BROKEN = 'breakdown';

export class FleetSim {
  constructor(store, { graph, trucks = { general: 7, recycling: 3 } } = {}) {
    this.store = store; this.graph = graph; this.trucks = []; this.claimed = new Set(); this._snap = new Map();
    for (const stream of ['general', 'recycling']) {
      const idx = store.bins.map((b, i) => i).filter(i => BIN_KINDS[store.bins[i].kind].stream === stream);
      const groups = kmeans(idx.map(i => store.bins[i]), trucks[stream]);
      groups.forEach((g, n) => {
        const sector = g.map(j => idx[j]);
        const c0 = { lat: sector.reduce((s, i) => s + store.bins[i].lat, 0) / sector.length, lon: sector.reduce((s, i) => s + store.bins[i].lon, 0) / sector.length };
        const c = graph.pos(graph.nearestNode(c0).node);
        const id = `${stream === 'general' ? 'GT' : 'RT'}-${String(n + 1).padStart(2, '0')}`;
        this.trucks.push({ id, plate: `${stream === 'general' ? 'ΖΑΒ' : 'ΖΑΓ'}-${1000 + this.trucks.length * 37}`, type: stream, capacityKg: stream === 'general' ? 3000 : 2000,
          sector, lat: c.lat, lon: c.lon, loadKg: 0, state: IDLE, target: null, route: null, rid: 0, stops: [], dwell: 0, speed: 0, heading: 0 });
      });
    }
    store.on('assign', r => this._onAssign(r));
    this.tick(0, 1);                                        // publish initial positions
  }

  /** Remaining route of a truck as [[lat, lon], ...] (for the map). */
  routeOf(id) {
    const t = this.truck(id); if (!t?.route) return [];
    return [[t.lat, t.lon], ...t.route.nodes.slice(t.route.seg + 1).map(n => { const p = this.graph.pos(n); return [p.lat, p.lon]; })];
  }
  truck(id) { return this.trucks.find(t => t.id === id) ?? null; }
  /** Nearest able truck of the stream that serves this report's bin class. */
  nearestTruck(lat, lon, stream = 'general') {
    const able = this.trucks.filter(t => t.type === stream && t.state !== BROKEN && t.loadKg < t.capacityKg * 0.8);
    return nearest({ lat, lon }, able)?.item ?? null;
  }
  breakdown(id) {
    const t = this.truck(id); if (!t || t.state === BROKEN) return false;
    for (const s of t.stops) this.store.unassignReport(s.reportId);
    if (t.target?.binIdx !== undefined) this.claimed.delete(t.target.binIdx);
    Object.assign(t, { state: BROKEN, stops: [], target: null, route: null, rid: 0, speed: 0, repairLeft: 900 });
    return true;
  }
  _onAssign(r) {
    const t = this.truck(r.assignedTruck); if (!t) return;
    t.stops.push({ reportId: r.id, lat: r.lat, lon: r.lon, binIdx: r.binId === null ? undefined : this.store.bins.findIndex(b => b.id === r.binId) });
    if (t.state === IDLE || (t.state === MOVING && t.target?.kind === 'bin')) { if (t.target?.binIdx !== undefined) this.claimed.delete(t.target.binIdx); t.target = null; t.state = IDLE; }
  }

  /** Road node nearest to a point, cached per rounded location (bins and sites never move). */
  snap(p) {
    const key = `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
    if (!this._snap.has(key)) this._snap.set(key, this.graph.nearestNode(p).node);
    return this._snap.get(key);
  }

  /** Advance everything by dtReal real seconds at clock multiplier `scale`. */
  tick(dtReal, scale = 1) {
    const { store } = this, simDt = dtReal * scale, fillHours = simDt * CONFIG.fillPerScale / 3600;
    store.clock.simT += simDt;
    for (const b of store.bins) b.fill = Math.min(1, b.fill + b.rate * BIN_KINDS[b.kind].kgPerHour * fillHours / BIN_KINDS[b.kind].capacityKg);
    for (const t of this.trucks) this._step(t, simDt);
    for (const t of this.trucks) {
      store.ingestGps({ truckId: t.id, plate: t.plate, type: t.type, capacityKg: t.capacityKg, lat: t.lat, lon: t.lon, speed: t.speed,
        heading: t.heading, status: t.state, loadKg: t.loadKg, rid: t.rid, ts: Date.now() });
    }
  }

  _step(t, simDt) {
    const { store } = this;
    if (t.state === BROKEN) { t.repairLeft -= simDt; t.speed = 0; if (t.repairLeft <= 0) t.state = IDLE; return; }
    if (t.state === COLLECTING || t.state === UNLOADING) {
      t.speed = 0; t.dwell -= simDt;
      if (t.dwell <= 0) (t.state === COLLECTING ? this._collect(t) : this._unload(t));
      return;
    }
    if (t.state === IDLE) { this._choose(t); if (!t.target) { t.speed = 0; return; } if (!this._plan(t)) return; t.state = MOVING; }
    // drive along the road route
    const r = t.route, g = this.graph; let left = simDt, sp = 0;
    while (left > 1e-9 && r.seg < r.nodes.length - 1) {
      const a = r.nodes[r.seg], b = r.nodes[r.seg + 1], len = distance(g.pos(a), g.pos(b)); sp = g.speedOn(a, b);
      const need = (len - r.off) / sp;
      if (need <= left) { left -= need; store.counters.km += (len - r.off) / 1000; r.seg++; r.off = 0; }
      else { r.off += sp * left; store.counters.km += sp * left / 1000; left = 0; }
    }
    if (r.seg >= r.nodes.length - 1) {
      const p = g.pos(r.nodes[r.nodes.length - 1]); t.lat = p.lat; t.lon = p.lon; t.speed = 0; t.route = null; t.rid = 0;
      if (t.target.kind === 'site') { t.state = UNLOADING; t.dwell = CONFIG.unloadSeconds; } else { t.state = COLLECTING; t.dwell = CONFIG.collectSeconds; }
      return;
    }
    const a = g.pos(r.nodes[r.seg]), b = g.pos(r.nodes[r.seg + 1]), f = r.off / Math.max(distance(a, b), 1e-9);
    t.lat = a.lat + (b.lat - a.lat) * f; t.lon = a.lon + (b.lon - a.lon) * f; t.heading = bearing(a, b); t.speed = sp;
  }

  /** Road route from the truck's position to its target; on failure the target is dropped (bin stays unclaimed). */
  _plan(t) {
    const from = this.graph.nearestNode(t).node, to = this.snap(t.target), route = this.graph.route(from, to);
    if (!route) { if (t.target.binIdx !== undefined) this.claimed.delete(t.target.binIdx); t.stops = t.stops.filter(s => s.reportId !== t.target.reportId); t.target = null; return false; }
    t.route = { nodes: route.nodes, seg: 0, off: 0 }; t.routeId = (t.routeId ?? 0) + 1; t.rid = t.routeId; return true;
  }

  _choose(t) {
    const { store } = this;
    if (t.loadKg >= t.capacityKg * 0.85) {                  // full: go to the nearest suitable site
      const kind = t.type === 'recycling' ? 'sorting' : 'transfer';
      const site = nearest(t, store.sites.filter(s => s.kind === kind))?.item;
      if (site) { t.target = { kind: 'site', site, lat: site.lat, lon: site.lon }; return; }
    }
    if (t.stops.length) {                                    // operator-assigned citizen reports first
      const s = t.stops[0]; t.target = { kind: 'bin', reportId: s.reportId, binIdx: s.binIdx, lat: s.lat, lon: s.lon };
      if (s.binIdx !== undefined) this.claimed.add(s.binIdx);
      return;
    }
    let best = -1, bs = -Infinity;                           // fullest-and-close bin of the sector
    for (const i of t.sector) {
      const b = store.bins[i]; if (b.fill < 0.6 || this.claimed.has(i)) continue;
      const score = b.fill - distance(t, b) / 4000; if (score > bs) { bs = score; best = i; }
    }
    if (best >= 0) { this.claimed.add(best); const b = store.bins[best]; t.target = { kind: 'bin', binIdx: best, lat: b.lat, lon: b.lon }; }
  }

  _collect(t) {
    const { store } = this, tg = t.target;
    let kg = 20;
    if (tg.binIdx !== undefined) { const b = store.bins[tg.binIdx], k = BIN_KINDS[b.kind]; kg = b.fill * k.capacityKg; b.fill = 0; this.claimed.delete(tg.binIdx); }
    t.loadKg += kg; t.stops = t.stops.filter(s => s.reportId !== tg.reportId);
    store.counters.collectedKg[t.type] += kg;
    if (tg.reportId) store.completeReport(tg.reportId);
    t.target = null; t.state = IDLE;
  }
  _unload(t) {
    const { store } = this, kind = t.target.site.kind;
    store.counters.unloadedKg[kind] += t.loadKg; t.loadKg = 0; t.target = null; t.state = IDLE;
  }
}
