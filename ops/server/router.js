/**
 * Road network and routing for the fleet. Graph built from OpenStreetMap ways (tools/athens-bins/extract_roads.py).
 * Directed edges honour one-way streets; only the largest strongly connected component is kept, so every route exists.
 * Edge cost is travel time using a speed per road class (garbage trucks in a city), found with A*.
 */
import fs from 'node:fs';
import { distance } from './geo.js';

/** m/s for a heavy vehicle, by road class index (motorway, trunk, primary, secondary, tertiary, residential, service): about 50 down to 11 km/h. */
export const CLASS_SPEED = [14, 10, 8, 7, 5.5, 4.5, 3];
const M_LAT = 111320;

export class RoadGraph {
  constructor(data) {
    const n = data.nodes.length / 2;
    this.lat = new Float64Array(n); this.lon = new Float64Array(n);
    for (let i = 0; i < n; i++) { this.lat[i] = data.nodes[2 * i]; this.lon[i] = data.nodes[2 * i + 1]; }
    const adj = Array.from({ length: n }, () => []);                       // [to, lengthM, speed]
    for (const [cls, ow, ...ids] of data.ways) {
      for (let k = 0; k + 1 < ids.length; k++) {
        const a = ids[k], b = ids[k + 1], len = distance({ lat: this.lat[a], lon: this.lon[a] }, { lat: this.lat[b], lon: this.lon[b] });
        adj[a].push([b, len, CLASS_SPEED[cls]]); if (!ow) adj[b].push([a, len, CLASS_SPEED[cls]]);
      }
    }
    this.adj = adj; this._keepLargestComponent(); this._buildGrid();
  }
  static load(file) { return new RoadGraph(JSON.parse(fs.readFileSync(file, 'utf8'))); }

  _keepLargestComponent() {          // Kosaraju (iterative) on the directed graph
    const n = this.adj.length, order = [], seen = new Uint8Array(n);
    for (let s = 0; s < n; s++) {
      if (seen[s]) continue; const st = [[s, 0]]; seen[s] = 1;
      while (st.length) { const top = st[st.length - 1], [u, i] = top; if (i < this.adj[u].length) { top[1]++; const v = this.adj[u][i][0]; if (!seen[v]) { seen[v] = 1; st.push([v, 0]); } } else { order.push(u); st.pop(); } }
    }
    const radj = Array.from({ length: n }, () => []);
    for (let u = 0; u < n; u++) for (const [v] of this.adj[u]) radj[v].push(u);
    const comp = new Int32Array(n).fill(-1), sizes = [];
    for (let k = n - 1; k >= 0; k--) {
      const s = order[k]; if (comp[s] >= 0) continue; const c = sizes.length; let size = 0, st = [s]; comp[s] = c;
      while (st.length) { const u = st.pop(); size++; for (const v of radj[u]) if (comp[v] < 0) { comp[v] = c; st.push(v); } }
      sizes.push(size);
    }
    const best = sizes.indexOf(Math.max(...sizes));
    this.ok = comp.map(c => c === best ? 1 : 0); this.size = sizes[best];
  }
  _buildGrid() {                      // ~200 m cells for nearest-node queries
    this.cell = 0.002; this.grid = new Map();
    for (let i = 0; i < this.lat.length; i++) if (this.ok[i]) { const key = this._key(this.lat[i], this.lon[i]); (this.grid.get(key) ?? this.grid.set(key, []).get(key)).push(i); }
  }
  _key(lat, lon) { return `${Math.floor(lat / this.cell)},${Math.floor(lon / this.cell)}`; }
  /** Nearest routable node to a point (searches growing rings of grid cells). */
  nearestNode(p) {
    const cy = Math.floor(p.lat / this.cell), cx = Math.floor(p.lon / this.cell);
    let best = -1, bd = Infinity;
    for (let r = 0; r < 40; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        for (const i of this.grid.get(`${cy + dy},${cx + dx}`) ?? []) { const d = distance(p, { lat: this.lat[i], lon: this.lon[i] }); if (d < bd) { bd = d; best = i; } }
      }
      if (best >= 0 && bd < (r + 0.5) * this.cell * M_LAT * 0.7) break;
    }
    return best >= 0 ? { node: best, dist: bd } : null;
  }
  pos(i) { return { lat: this.lat[i], lon: this.lon[i] }; }

  /** Fastest route between two nodes: { nodes, lengthM, seconds } or null. */
  route(from, to) {
    if (from === to) return { nodes: [from], lengthM: 0, seconds: 0 };
    const g = new Map([[from, 0]]), prev = new Map(), closed = new Set(), vmax = CLASS_SPEED[0];
    const goal = this.pos(to), h = i => distance(this.pos(i), goal) / vmax;
    const heap = [[h(from), from]];
    const push = e => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const [, u] = pop(); if (closed.has(u)) continue; closed.add(u);
      if (u === to) break;
      for (const [v, len, sp] of this.adj[u]) {
        if (!this.ok[v] || closed.has(v)) continue;
        const nd = g.get(u) + len / sp; if (nd < (g.get(v) ?? Infinity)) { g.set(v, nd); prev.set(v, u); push([nd + h(v), v]); }
      }
    }
    if (!prev.has(to)) return null;
    const nodes = [to]; while (nodes[0] !== from) nodes.unshift(prev.get(nodes[0]));
    let lengthM = 0; for (let k = 1; k < nodes.length; k++) lengthM += distance(this.pos(nodes[k - 1]), this.pos(nodes[k]));
    return { nodes, lengthM, seconds: g.get(to) };
  }
  /** Speed (m/s) on the edge a -> b (best of parallel edges). */
  speedOn(a, b) { let s = 0; for (const [v, , sp] of this.adj[a]) if (v === b && sp > s) s = sp; return s || CLASS_SPEED[5]; }
}
