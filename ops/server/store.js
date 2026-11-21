/** In-memory state of the operations centre (bins, trucks, reports, counters) with a JSON snapshot. Emits events for the SSE stream. */
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { CONFIG, BIN_KINDS } from './config.js';
import { distance, nearest } from './geo.js';
import { mulberry32 } from '../../src/core/rng.js';

export class Store extends EventEmitter {
  constructor({ binRows, sites, snapshotFile = null, seed = CONFIG.seed }) {
    super();
    const rng = mulberry32(seed);
    this.sites = sites;
    this.bins = binRows.map(([id, lat, lon, kind]) => ({ id, lat, lon, kind, fill: 0.05 + rng() * 0.6, rate: 0.5 + rng(), lastReportAt: null }));
    this.trucks = new Map();
    this.reports = [];
    this.seq = 0;
    this.counters = { collectedKg: { general: 0, recycling: 0 }, unloadedKg: { sorting: 0, transfer: 0 }, km: 0, reportsCollected: 0, responseSecSum: 0 };
    this.snapshotFile = snapshotFile;
    this._rate = new Map();                      // ip -> [timestamps]
    if (snapshotFile) this._load();
  }

  // ---- GPS: the same message a real tracker would send (POST /api/gps) ----
  ingestGps(m) {
    const ok = m && typeof m.truckId === 'string' && Number.isFinite(m.lat) && Number.isFinite(m.lon) && Math.abs(m.lat) <= 90 && Math.abs(m.lon) <= 180;
    if (!ok) return false;
    const t = this.trucks.get(m.truckId) ?? { id: m.truckId, plate: m.plate ?? m.truckId, type: m.type ?? 'general', capacityKg: m.capacityKg ?? 3000, loadKg: 0, status: 'idle', km: 0, stops: 0 };
    Object.assign(t, { lat: m.lat, lon: m.lon, speed: m.speed ?? 0, heading: m.heading ?? 0, ts: m.ts ?? Date.now() });
    if (m.status) t.status = m.status;
    if (Number.isFinite(m.loadKg)) t.loadKg = m.loadKg;
    this.trucks.set(t.id, t);
    return true;
  }

  // ---- citizen reports ----
  rateLimited(ip) {
    const now = Date.now(), list = (this._rate.get(ip) ?? []).filter(t => now - t < 60000);
    if (list.length >= CONFIG.rateLimit.perMinute) { this._rate.set(ip, list); return true; }
    list.push(now); this._rate.set(ip, list); return false;
  }
  addReport({ lat, lon, photo = null, note = '' }) {
    const snap = nearest({ lat, lon }, this.bins);
    const bin = snap && snap.dist <= CONFIG.reportSnapMeters ? snap.item : null;
    const r = { id: `R${String(++this.seq).padStart(4, '0')}`, lat, lon, binId: bin?.id ?? null, candidate: !bin, photo, note: String(note).slice(0, 300),
      status: 'new', createdAt: Date.now(), assignedAt: null, assignedTruck: null, collectedAt: null };
    if (bin) { bin.fill = Math.max(bin.fill, 0.95); bin.lastReportAt = r.createdAt; }
    this.reports.push(r); this._save(); this.emit('report', r);
    return r;
  }
  getReport(id) { return this.reports.find(r => r.id === id) ?? null; }
  assignReport(id, truckId) {
    const r = this.getReport(id), t = this.trucks.get(truckId);
    if (!r || !t || r.status === 'collected' || r.status === 'rejected') return null;
    Object.assign(r, { status: 'assigned', assignedTruck: truckId, assignedAt: Date.now() });
    this.emit('assign', r); this.emit('report', r); this._save();
    return r;
  }
  unassignReport(id) { const r = this.getReport(id); if (r && r.status === 'assigned') { Object.assign(r, { status: 'new', assignedTruck: null, assignedAt: null }); this.emit('report', r); this._save(); } }
  rejectReport(id) { const r = this.getReport(id); if (!r || r.status === 'collected') return null; r.status = 'rejected'; this.emit('report', r); this._save(); return r; }
  completeReport(id) {
    const r = this.getReport(id); if (!r || r.status === 'collected') return null;
    r.status = 'collected'; r.collectedAt = Date.now();
    this.counters.reportsCollected++; this.counters.responseSecSum += (r.collectedAt - r.createdAt) / 1000;
    this.emit('report', r); this._save(); return r;
  }

  // ---- derived numbers ----
  /** Operational KPIs. `plants` is the PlantSim summary list (sorting numbers come from the headless sorter simulation). */
  kpi(plants = []) {
    const c = this.counters, trucks = [...this.trucks.values()];
    const collected = c.collectedKg.general + c.collectedKg.recycling;
    const sorted = plants.reduce((s, p) => s + p.sortedKg, 0), residue = plants.reduce((s, p) => s + p.residueKg, 0);
    const recovery = sorted + residue ? sorted / (sorted + residue) : null;
    const streamShare = collected ? c.collectedKg.recycling / collected : null;
    const open = this.reports.filter(r => r.status === 'new' || r.status === 'assigned').length;
    return {
      collectedKg: Math.round(collected), collectedRecyclingKg: Math.round(c.collectedKg.recycling),
      streamShare, recovery, recycledRate: streamShare !== null && recovery !== null ? streamShare * recovery : null,
      sortedKgPerHour: plants.reduce((s, p) => s + p.kgPerHour, 0),
      avgResponseSimMin: c.reportsCollected ? c.responseSecSum / c.reportsCollected * CONFIG.moveX / 60 : null,
      kmPerTonne: collected ? c.km / (collected / 1000) : null,
      fleetAvailability: trucks.length ? trucks.filter(t => t.status !== 'breakdown').length / trucks.length : null,
      binsOver80: this.bins.filter(b => b.fill >= 0.8).length, bins: this.bins.length,
      reportsOpen: open, reportsTotal: this.reports.length, reportsCollected: c.reportsCollected,
    };
  }
  publicTrucks() {
    return [...this.trucks.values()].map(t => ({ id: t.id, plate: t.plate, type: t.type, lat: +t.lat.toFixed(6), lon: +t.lon.toFixed(6),
      speed: +(t.speed ?? 0).toFixed(1), heading: Math.round(t.heading ?? 0), status: t.status, loadKg: Math.round(t.loadKg), capacityKg: t.capacityKg, ts: t.ts }));
  }
  fills() { return this.bins.map(b => Math.round(b.fill * 100)); }

  _save() {
    if (!this.snapshotFile) return;
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      try { fs.mkdirSync(new URL('.', `file://${this.snapshotFile}`).pathname, { recursive: true }); fs.writeFileSync(this.snapshotFile, JSON.stringify({ seq: this.seq, reports: this.reports, counters: this.counters })); } catch { /* snapshot is best effort */ }
    }, 500);
    this._t.unref?.();
  }
  _load() {
    try { const d = JSON.parse(fs.readFileSync(this.snapshotFile, 'utf8')); this.seq = d.seq ?? 0; this.reports = d.reports ?? []; Object.assign(this.counters, d.counters ?? {}); } catch { /* first run */ }
  }
}
export { BIN_KINDS, distance };
