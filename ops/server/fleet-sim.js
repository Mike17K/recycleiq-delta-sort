/**
 * Simulated garbage-truck fleet. Each truck owns a sector of bins, collects the fullest nearby ones, unloads at a plant when
 * it is nearly full, and serves citizen reports the operator assigns to it. Every tick it emits the same GPS message a real
 * on-board unit would send (store.ingestGps), so a real tracker can replace this module without touching anything else.
 */
import { CONFIG, BIN_KINDS } from './config.js';
import { distance, bearing, moveToward, nearest, kmeans } from './geo.js';

const MOVING = 'route', IDLE = 'idle', COLLECTING = 'collecting', UNLOADING = 'unloading', BROKEN = 'breakdown';

export class FleetSim {
  constructor(store, { trucks = { general: 7, recycling: 3 } } = {}) {
    this.store = store; this.trucks = []; this.claimed = new Set();
    for (const stream of ['general', 'recycling']) {
      const idx = store.bins.map((b, i) => i).filter(i => BIN_KINDS[store.bins[i].kind].stream === stream);
      const groups = kmeans(idx.map(i => store.bins[i]), trucks[stream]);
      groups.forEach((g, n) => {
        const sector = g.map(j => idx[j]);
        const c = { lat: sector.reduce((s, i) => s + store.bins[i].lat, 0) / sector.length, lon: sector.reduce((s, i) => s + store.bins[i].lon, 0) / sector.length };
        const id = `${stream === 'general' ? 'GT' : 'RT'}-${String(n + 1).padStart(2, '0')}`;
        this.trucks.push({ id, plate: `${stream === 'general' ? 'ΖΑΒ' : 'ΖΑΓ'}-${1000 + this.trucks.length * 37}`, type: stream, capacityKg: stream === 'general' ? 3000 : 2000,
          sector, lat: c.lat, lon: c.lon, loadKg: 0, state: IDLE, target: null, stops: [], dwell: 0, speed: 0, heading: 0 });
      });
    }
    store.on('assign', r => this._onAssign(r));
    this.tick(0);                                           // publish initial positions
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
    Object.assign(t, { state: BROKEN, stops: [], target: null, speed: 0, repairLeft: 900 });
    return true;
  }
  _onAssign(r) {
    const t = this.truck(r.assignedTruck); if (!t) return;
    t.stops.push({ reportId: r.id, lat: r.lat, lon: r.lon, binIdx: r.binId === null ? undefined : this.store.bins.findIndex(b => b.id === r.binId) });
    if (t.state === IDLE || (t.state === MOVING && t.target?.kind === 'bin')) { if (t.target?.binIdx !== undefined) this.claimed.delete(t.target.binIdx); t.target = null; t.state = IDLE; }
  }

  tick(dtReal) {
    const { store } = this, simDt = dtReal * CONFIG.moveX, fillHours = dtReal * CONFIG.fillX / 3600;
    for (const b of store.bins) b.fill = Math.min(1, b.fill + b.rate * BIN_KINDS[b.kind].kgPerHour * fillHours / BIN_KINDS[b.kind].capacityKg);
    for (const t of this.trucks) this._step(t, simDt);
    for (const t of this.trucks) {
      store.ingestGps({ truckId: t.id, plate: t.plate, type: t.type, capacityKg: t.capacityKg, lat: t.lat, lon: t.lon, speed: t.speed,
        heading: t.heading, status: t.state, loadKg: t.loadKg, ts: Date.now() });
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
    if (t.state === IDLE) { this._choose(t); if (!t.target) { t.speed = 0; return; } t.state = MOVING; }
    // move
    const step = CONFIG.truckSpeed * simDt, next = moveToward(t, t.target, step);
    t.heading = bearing(t, t.target) || t.heading;
    const d = distance(t, next); store.counters.km += d / 1000; t.speed = Math.min(CONFIG.truckSpeed, d / Math.max(simDt, 1e-9));
    t.lat = next.lat; t.lon = next.lon;
    if (next.arrived) {
      t.speed = 0;
      if (t.target.kind === 'site') { t.state = UNLOADING; t.dwell = CONFIG.unloadSeconds; }
      else { t.state = COLLECTING; t.dwell = CONFIG.collectSeconds; }
    }
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
