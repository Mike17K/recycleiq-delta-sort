/** Dashboard entry: connects to the SSE stream and feeds the map and panels. */
import { t, getLang, setLang, applyI18n } from './i18n.js';
import { createMap } from './map.js';
import { renderKpis, renderReports, renderFleet, renderPlants } from './panels.js';
import { runDemo } from './demo.js';

const $ = s => document.querySelector(s);
const state = { trucks: [], reports: new Map(), plants: [], kpi: null, sites: [] };
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then(r => r.json());

const view = createMap('map', {
  onTruck: id => selectTab('fleet', id), onReport: id => { selectTab('reports'); $(`#pane-reports [data-id="${id}"]`)?.scrollIntoView({ block: 'center' }); },
});
const handlers = {
  assign: id => post(`/api/reports/${id}/assign`), reject: id => post(`/api/reports/${id}/reject`),
  breakdown: id => post(`/api/trucks/${id}/breakdown`),
  focus: id => { const tr = state.trucks.find(x => x.id === id) ?? state.reports.get(id); if (tr) view.flyTo([tr.lat, tr.lon], 16); },
};

function selectTab(name, focusId) {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === `pane-${name}`));
  if (focusId) handlers.focus(focusId);
}
document.querySelectorAll('.tabs button').forEach(b => (b.onclick = () => selectTab(b.dataset.tab)));

const reportList = () => [...state.reports.values()].sort((a, b) => a.id.localeCompare(b.id));
function paint() {
  if (state.kpi) renderKpis($('#kpis'), state.kpi);
  renderFleet($('#pane-fleet'), state.trucks, handlers);
  renderReports($('#pane-reports'), reportList(), handlers);
  renderPlants($('#pane-plants'), state.plants);
  view.setTrucks(state.trucks); view.setReports(reportList());
}
function applyLive(d) {
  Object.assign(state, { trucks: d.trucks, kpi: d.kpi, plants: d.plants, sites: d.sites });
  if (!view.sitesSet) { view.setSites(d.sites, getLang()); view.sitesSet = true; }
  // keep scroll position in panes stable: only the visible pane is re-rendered
  renderKpis($('#kpis'), d.kpi); view.setTrucks(d.trucks); view.setRoutes(d.trucks);
  const sp = $('#speed'); if (document.activeElement !== sp && sp.value !== String(d.scale)) sp.value = String(d.scale);
  if ($('#pane-fleet').classList.contains('on')) renderFleet($('#pane-fleet'), d.trucks, handlers);
  if ($('#pane-plants').classList.contains('on')) renderPlants($('#pane-plants'), d.plants);
}

async function boot() {
  const [bins, st] = await Promise.all([fetch('/api/bins').then(r => r.json()), fetch('/api/state').then(r => r.json())]);
  view.setBins(bins); st.reports.forEach(r => state.reports.set(r.id, r)); applyLive(st); paint();
  const es = new EventSource('/api/stream');
  es.onopen = () => $('#conn').classList.add('on'); es.onerror = () => $('#conn').classList.remove('on');
  es.addEventListener('live', e => applyLive(JSON.parse(e.data)));
  es.addEventListener('fills', e => view.setFills(JSON.parse(e.data)));
  es.addEventListener('report', e => {
    const r = JSON.parse(e.data); state.reports.set(r.id, r); view.setReports(reportList());
    if ($('#pane-reports').classList.contains('on')) renderReports($('#pane-reports'), reportList(), handlers);
  });
}
$('#lang').onclick = () => { setLang(getLang() === 'el' ? 'en' : 'el'); $('#lang').textContent = getLang() === 'el' ? 'EN' : 'EL'; applyI18n(); $('#sub').textContent = t('sub'); view.setSites(state.sites, getLang()); paint(); };
$('#speed').onchange = e => post('/api/speed', { scale: Number(e.target.value) });
$('#demo').onclick = () => runDemo({ view, state, post, selectTab, caption: txt => { const c = $('#caption'); c.style.display = txt ? 'block' : 'none'; c.textContent = txt ?? ''; } });
$('#lang').textContent = getLang() === 'el' ? 'EN' : 'EL';
applyI18n(); $('#sub').textContent = t('sub');
boot();
window.__ops = { state, view, selectTab };
