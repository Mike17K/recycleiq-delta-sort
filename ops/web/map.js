/** Leaflet map: bins (canvas, coloured by fill), trucks (rotating arrows), citizen reports (pulsing pins), plant sites. */
import { t } from './i18n.js';

const fillColor = f => (f >= 80 ? '#e4572e' : f >= 50 ? '#f4b942' : '#2ecc71');
const STATUS_COLOR = { route: '#4aa3f4', idle: '#9fb8a9', collecting: '#2ecc71', unloading: '#b07cc6', breakdown: '#e4572e' };
const KIND_LABEL = { b: 'bin_basket', r: 'bin_recycling', d: 'bin_disposal' };
const truckSVG = c => `<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="12" fill="#0b1f17" stroke="#fff" stroke-width="1.5"/><path d="M13 3.5 L19.5 20 L13 16 L6.5 20 Z" fill="${c}" stroke="#fff" stroke-width="1" stroke-linejoin="round"/></svg>`;

export function createMap(el, { onTruck, onReport } = {}) {
  const map = L.map(el, { zoomControl: true, preferCanvas: true }).setView([37.985, 23.735], 14);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors (ODbL)' }).addTo(map);
  const canvas = L.canvas({ padding: 0.3 });
  let binMarkers = [], truckMarkers = new Map(), reportMarkers = new Map(), siteMarkers = [];
  const routeLines = new Map();     // truck id -> { rid, line }

  function setBins(rows) {          // rows: [id, lat, lon, kind, fill%]
    binMarkers.forEach(m => m.remove());
    binMarkers = rows.map(([id, lat, lon, k, f]) => {
      const m = L.circleMarker([lat, lon], { renderer: canvas, radius: k === 'r' ? 4 : 3, color: '#0b1f17', weight: 1, fillColor: fillColor(f), fillOpacity: 0.95 }).addTo(map);
      m._fill = f; m._k = k; m._id = id;
      m.bindPopup(() => `<b>${t(KIND_LABEL[k])}</b><br>${t('fill')}: ${m._fill}%<br><small>OSM node <a target="_blank" href="https://www.openstreetmap.org/node/${id}">${id}</a></small>`);
      return m;
    });
  }
  function setFills(fills) { fills.forEach((f, i) => { const m = binMarkers[i]; if (m && m._fill !== f) { m._fill = f; m.setStyle({ fillColor: fillColor(f) }); } }); }

  function setTrucks(trucks) {
    for (const tr of trucks) {
      let m = truckMarkers.get(tr.id);
      const c = STATUS_COLOR[tr.status] ?? '#fff';
      if (!m) {
        m = L.marker([tr.lat, tr.lon], { icon: L.divIcon({ className: '', html: `<div class="truck">${truckSVG(c)}</div>`, iconSize: [0, 0] }), zIndexOffset: 1000 }).addTo(map);
        m.on('click', () => onTruck?.(tr.id)); truckMarkers.set(tr.id, m);
      }
      m.setLatLng([tr.lat, tr.lon]);
      const svg = m.getElement()?.querySelector('svg');
      if (svg) { svg.style.transform = `rotate(${tr.heading}deg)`; svg.querySelector('path').setAttribute('fill', c); }
      m.bindTooltip(`${tr.id} · ${tr.loadKg}/${tr.capacityKg} kg`, { direction: 'top', offset: [0, -10] });
    }
  }
  /** Draw each truck's current road route; refetched only when the truck's route id changes. */
  function setRoutes(trucks) {
    for (const tr of trucks) {
      const cur = routeLines.get(tr.id);
      if (!tr.rid) { if (cur) { cur.line?.remove(); routeLines.delete(tr.id); } continue; }
      if (cur?.rid === tr.rid) continue;
      cur?.line?.remove(); const entry = { rid: tr.rid, line: null }; routeLines.set(tr.id, entry);
      fetch(`/api/trucks/${tr.id}/route`).then(r => r.json()).then(pts => {
        if (routeLines.get(tr.id) !== entry || !pts.length) return;
        entry.line = L.polyline(pts, { color: tr.type === 'recycling' ? '#2ecc71' : '#4aa3f4', weight: 5, opacity: 0.8, lineCap: 'round', interactive: false }).addTo(map);
      }).catch(() => {});
    }
  }
  function setReports(reports) {
    const live = reports.filter(r => r.status === 'new' || r.status === 'assigned'), ids = new Set(live.map(r => r.id));
    for (const [id, m] of reportMarkers) if (!ids.has(id)) { m.remove(); reportMarkers.delete(id); }
    for (const r of live) {
      let m = reportMarkers.get(r.id);
      if (!m) { m = L.marker([r.lat, r.lon], { icon: L.divIcon({ className: '', html: `<div class="pulse ${r.status}"></div>`, iconSize: [0, 0] }), zIndexOffset: 900 }).addTo(map); m.on('click', () => onReport?.(r.id)); reportMarkers.set(r.id, m); }
      m.getElement()?.firstChild?.setAttribute('class', `pulse ${r.status}`);
    }
  }
  function setSites(sites, lang) {
    siteMarkers.forEach(m => m.remove());
    siteMarkers = sites.map(s => L.marker([s.lat, s.lon], { icon: L.divIcon({ className: '', html: `<div class="site" style="background:${s.kind === 'sorting' ? '#2ecc71' : '#8a7560'}">${s.kind === 'sorting' ? 'S' : 'T'}</div>`, iconSize: [0, 0] }) }).addTo(map).bindTooltip(s.name[lang]));
  }
  return { map, setBins, setFills, setTrucks, setRoutes, setReports, setSites, truckMarker: id => truckMarkers.get(id), flyTo: (ll, z = 16) => map.flyTo(ll, z, { duration: 1.2 }) };
}
