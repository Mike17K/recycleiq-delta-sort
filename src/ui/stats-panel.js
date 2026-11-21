/** KPI strip, per-robot utilisation and per-class bin counts, aggregated over the plant's lines. */
import { MATERIALS, RESIDUE, materialLabel } from '../core/index.js';

export function createStatsPanel(i18n) {
  const $ = id => document.getElementById(id);

  function update(plant) {
    const s = plant.summary(), t = i18n.t, total = s.totals.picked + s.totals.misses;
    $('kMin').textContent = s.totals.itemsPerMin.toFixed(0);
    $('kPicked').textContent = s.totals.picked;
    $('kMiss').textContent = s.totals.misses;
    $('kRate').textContent = total ? `${((100 * s.totals.misses) / total).toFixed(0)}%` : '0%';
    $('kTripsBox').style.display = s.logistics ? '' : 'none';
    if (s.logistics) $('kTrips').textContent = s.logistics.serviced;

    $('util').innerHTML = `<tr><th>${t('util')}</th><th></th><th></th></tr>` + plant.lines.map((line, li) =>
      line.robots.map((r, i) => {
        const u = s.lines[li].utilisation[i] * 100;
        return `<tr><td>${line.id}${r.id}${r.enabled ? '' : ' ⛔'}</td><td style="width:55%"><div class="bar"><div style="width:${u}%"></div></div></td><td>${u.toFixed(0)}%</td></tr>`;
      }).join('')).join('');

    $('logi').innerHTML = s.logistics ? logisticsRows(plant, s, t) : '';

    const materials = Object.keys(MATERIALS).filter(k => plant.lines.some(l => k in l.cfg.bins));
    $('bins').innerHTML = `<tr><th>${t('bin')}</th><th>${t('count')}</th><th>${t('purity')}</th></tr>` + materials.map(k => {
      if (k === RESIDUE) return `<tr><td>${materialLabel(k, i18n.lang)}</td><td>${s.totals.misses + s.lines.reduce((a, l) => a + l.residueExpected, 0)}</td><td>${t('na')}</td></tr>`;
      const n = s.lines.reduce((a, l) => a + (l.bins[k] ?? 0), 0);
      return `<tr><td><span style="color:${MATERIALS[k].color}">■</span> ${materialLabel(k, i18n.lang)}</td><td>${n}</td><td>${n ? '100%' : t('na')}</td></tr>`;
    }).join('');
  }
  return { update };
}

/** Mobile robots, containers, bin swaps and bin-unavailable misses. */
function logisticsRows(plant, s, t) {
  const swaps = plant.slots.reduce((n, sl) => n + sl.swaps, 0);
  const bar = u => `<td style="width:55%"><div class="bar"><div style="width:${u}%"></div></div></td><td>${u.toFixed(0)}%</td>`;
  return `<tr><th>${t('logistics')}</th><th></th><th></th></tr>` +
    plant.fleet.amrs.map((a, i) => `<tr><td>M${a.id}${a.enabled ? '' : ' ⛔'}</td>${bar(s.logistics.utilisation[i] * 100)}</tr>`).join('') +
    plant.fleet.containers.map(c => `<tr><td>${c.id}</td>${bar(c.ratio * 100)}</tr>`).join('') +
    `<tr><td colspan="2">${t('swaps')}</td><td>${swaps}</td></tr><tr><td colspan="2">${t('binMiss')}</td><td>${s.totals.missBinUnavailable}</td></tr>`;
}
