/** Minimal three-column Sankey drawn as SVG: sorter input -> materials -> destinations. Pure function of the plant summaries. */
import { material, MATERIAL_COLOR, getLang, t } from './i18n.js';

export function sankeySVG(plants, w = 440, h = 300) {
  const mat = {}, dest = {};
  for (const p of plants) {
    for (const [m, kg] of Object.entries(p.materials)) mat[m] = (mat[m] ?? 0) + kg;
    mat.RESIDUE = (mat.RESIDUE ?? 0);
  }
  const resKg = plants.reduce((s, p) => s + p.residueKg, 0); mat.RESIDUE = resKg;
  for (const p of plants) for (const o of p.outbound) { const k = o.destination[getLang()]; dest[k] = (dest[k] ?? 0) + o.kg; }
  const total = Object.values(mat).reduce((a, b) => a + b, 0);
  if (total <= 0) return '<svg viewBox="0 0 10 10"></svg>';
  const pad = 14, usable = h - 2 * pad, gap = 4;
  const col = (entries) => { const sc = (usable - gap * (entries.length - 1)) / total; let y = pad; return entries.map(([k, v]) => { const n = { k, v, y, h: Math.max(v * sc, 1), sc }; y += n.h + gap; return n; }); };
  const mats = col(Object.entries(mat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]));
  const dests = col(Object.entries(dest).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]));
  const x0 = 62, x1 = 190, x2 = 290, bw = 10;
  const input = { y: pad, h: usable - gap * 0 };
  let out = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">`;
  const band = (xa, ya, xb, yb, th, color) => { const mx = (xa + xb) / 2; return `<path d="M${xa},${ya + th / 2} C${mx},${ya + th / 2} ${mx},${yb + th / 2} ${xb},${yb + th / 2}" stroke="${color}" stroke-opacity=".45" stroke-width="${Math.max(th, 1)}" fill="none"/>`; };
  let iy = pad;
  for (const n of mats) { out += band(x0 + bw, iy, x1, n.y, n.h, MATERIAL_COLOR[n.k] ?? '#8a7560'); iy += n.h; }
  const dOff = Object.fromEntries(dests.map(d => [d.k, d.y]));
  const matByDest = {};
  for (const p of plants) for (const [m, kg] of Object.entries({ ...p.materials, RESIDUE: p.residueKg })) {
    const d = p.outbound.length ? destOf(m) : null; if (d) (matByDest[m] ??= {})[d] = (matByDest[m][d] ?? 0) + kg;
  }
  for (const n of mats) {
    let my = n.y;
    for (const [d, kg] of Object.entries(matByDest[n.k] ?? {})) {
      const th = kg * n.sc; out += band(x1 + bw, my, x2, dOff[d] ?? 0, th, MATERIAL_COLOR[n.k] ?? '#8a7560'); my += th; if (dOff[d] !== undefined) dOff[d] += th;
    }
  }
  out += `<rect x="${x0}" y="${input.y}" width="${bw}" height="${input.h}" fill="#2ecc71"/><text x="${x0 - 4}" y="${h / 2}" text-anchor="end">${t('plant_in')}</text>`;
  for (const n of mats) out += `<rect x="${x1}" y="${n.y}" width="${bw}" height="${n.h}" fill="${MATERIAL_COLOR[n.k] ?? '#8a7560'}"/><text x="${x1 - 4}" y="${n.y + Math.max(n.h, 9) / 2 + 3}" text-anchor="end">${material(n.k)}</text>`;
  for (const n of dests) out += `<rect x="${x2}" y="${n.y}" width="${bw}" height="${n.h}" fill="#9fd3b6"/><text x="${x2 + bw + 4}" y="${n.y + Math.max(n.h, 9) / 2 + 3}">${n.k.length > 17 ? n.k.slice(0, 16) + '…' : n.k}</text>`;
  return out + '</svg>';
}
import { DESTINATIONS_CLIENT } from './destinations.js';
function destOf(m) { return DESTINATIONS_CLIENT[m]?.[getLang()]; }
