/** Side-panel and KPI renderers (plain DOM strings; no framework). */
import { t, material, getLang } from './i18n.js';
import { sankeySVG } from './sankey.js';

const pct = v => (v === null || v === undefined ? '–' : `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`);
const num = (v, d = 0) => (v === null || v === undefined ? '–' : v.toLocaleString(getLang() === 'el' ? 'el-GR' : 'en-GB', { maximumFractionDigits: d }));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderKpis(el, k) {
  const items = [
    ['k_rate', pct(k.recycledRate)], ['k_share', pct(k.streamShare)], ['k_recovery', pct(k.recovery)], ['k_kgh', num(k.sortedKgPerHour)],
    ['k_resp', k.avgResponseSimMin === null ? '–' : `${num(k.avgResponseSimMin, 1)} ${t('min')}`], ['k_kmt', num(k.kmPerTonne, 1)],
    ['k_avail', pct(k.fleetAvailability)], ['k_full', `${k.binsOver80}/${k.bins}`], ['k_open', k.reportsOpen],
  ];
  el.innerHTML = items.map(([key, v]) => `<div class="kpi"><b>${v}</b><span>${t(key)}</span></div>`).join('');
}

export function renderReports(el, reports, handlers) {
  if (!reports.length) { el.innerHTML = `<p class="mute">${t('noreports')}</p>`; return; }
  el.innerHTML = [...reports].reverse().map(r => `<div class="row" data-id="${r.id}">
    ${r.photo ? `<img class="thumb" src="${esc(r.photo)}" alt="">` : '<div class="thumb"></div>'}
    <div class="grow"><b>${r.id}</b> <span class="tag ${r.status}">${t(r.status)}</span> ${r.candidate ? `<span class="tag">${t('candidate')}</span>` : ''}<br>
      <small>${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}${r.assignedTruck ? ` · ${esc(r.assignedTruck)}` : ''}${r.note ? ` · ${esc(r.note)}` : ''}</small></div>
    ${r.status === 'new' ? `<button class="small primary" data-assign="${r.id}">${t('assign')}</button><button class="small" data-reject="${r.id}">×</button>` : ''}</div>`).join('');
  el.querySelectorAll('[data-assign]').forEach(b => (b.onclick = e => { e.stopPropagation(); handlers.assign(b.dataset.assign); }));
  el.querySelectorAll('[data-reject]').forEach(b => (b.onclick = e => { e.stopPropagation(); handlers.reject(b.dataset.reject); }));
  el.querySelectorAll('.row').forEach(r => (r.onclick = () => handlers.focus(r.dataset.id)));
}

export function renderFleet(el, trucks, handlers) {
  el.innerHTML = trucks.map(tr => {
    const f = tr.loadKg / tr.capacityKg;
    return `<div class="row" data-id="${tr.id}"><div class="grow"><b>${tr.id}</b> <small>${esc(tr.plate)}</small> <span class="tag ${tr.status}">${t('st_' + tr.status)}</span>
      <div class="bar ${f > 0.85 ? 'full' : f > 0.6 ? 'hi' : ''}"><i style="width:${Math.min(f, 1) * 100}%"></i></div>
      <small>${t('load')} ${tr.loadKg}/${tr.capacityKg} kg · ${tr.speed.toFixed(1)} m/s</small></div>
      <button class="small" data-break="${tr.id}" ${tr.status === 'breakdown' ? 'disabled' : ''}>${t('breakdown')}</button></div>`;
  }).join('');
  el.querySelectorAll('[data-break]').forEach(b => (b.onclick = e => { e.stopPropagation(); handlers.breakdown(b.dataset.break); }));
  el.querySelectorAll('.row').forEach(r => (r.onclick = () => handlers.focus(r.dataset.id)));
}

export function renderPlants(el, plants) {
  const lang = getLang(), mats = {};
  for (const p of plants) for (const [m, kg] of Object.entries(p.materials)) mats[m] = (mats[m] ?? 0) + kg;
  const residue = plants.reduce((s, p) => s + p.residueKg, 0);
  el.innerHTML = `<h3>${t('flow')}</h3>${sankeySVG(plants)}
    ${plants.map(p => `<h3>${esc(p.name[lang])}</h3><table>
      <tr><td>${t('items_min')}</td><td class="n">${num(p.itemsPerMin, 1)}</td></tr>
      <tr><td>${t('sorted')}</td><td class="n">${num(p.sortedKg)} kg</td></tr>
      <tr><td>${t('residue')}</td><td class="n">${num(p.residueKg)} kg</td></tr>
      <tr><td>${t('k_recovery')}</td><td class="n">${pct(p.recovery)}</td></tr></table>`).join('')}
    <h3>${t('materials')}</h3><table>${Object.entries({ ...mats, RESIDUE: residue }).sort((a, b) => b[1] - a[1]).map(([m, kg]) => `<tr><td>${material(m)}</td><td class="n">${num(kg, 1)} kg</td></tr>`).join('')}</table>
    <h3>${t('outbound')}</h3><table>${aggregateOutbound(plants, lang).map(([d, kg]) => `<tr><td>${esc(d)}</td><td class="n">${num(kg, 1)} kg</td></tr>`).join('')}</table>
    <p class="mute" style="font-size:12px">${t('purity_note')}</p>`;
}
function aggregateOutbound(plants, lang) {
  const o = {}; for (const p of plants) for (const x of p.outbound) o[x.destination[lang]] = (o[x.destination[lang]] ?? 0) + x.kg;
  return Object.entries(o).sort((a, b) => b[1] - a[1]);
}
