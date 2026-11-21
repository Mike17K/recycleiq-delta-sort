/** ~60 s scripted demo: citizen report -> assignment -> collection -> breakdown/reassignment -> sorting flows -> KPIs. */
import { t } from './i18n.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** A drawn stand-in photo (the demo has no real camera): an overflowing bin on a pavement. */
function demoPhoto() {
  const c = document.createElement('canvas'); c.width = 640; c.height = 480; const g = c.getContext('2d');
  g.fillStyle = '#6b6f6a'; g.fillRect(0, 0, 640, 480); g.fillStyle = '#585c57'; g.fillRect(0, 360, 640, 120);
  g.fillStyle = '#2d6a4f'; g.fillRect(230, 150, 180, 220); g.fillStyle = '#1b4332'; g.fillRect(220, 135, 200, 25);
  const junk = ['#e4572e', '#f4b942', '#c4c9cf', '#8fd3f4', '#c89b5a'];
  for (let i = 0; i < 26; i++) { g.fillStyle = junk[i % 5]; g.fillRect(190 + (i * 53) % 260, 90 + (i * 29) % 80 - (i % 3) * 14, 28 + (i % 4) * 9, 18 + (i % 3) * 8); }
  g.fillStyle = '#fff'; g.font = '20px sans-serif'; g.fillText('DEMO PHOTO', 20, 36);
  return c.toDataURL('image/jpeg', 0.7);
}

/** A litter bin 400-700 m (as the crow flies) from some working general truck, so the demo trip is short but still follows streets. */
function binNearATruck(bins, trucks, skip = new Set()) {
  const km = (a, b) => Math.hypot((a.lat - b[1]) * 111320, (a.lon - b[2]) * 88000);
  const cands = [];
  for (const tr of trucks.filter(x => x.type === 'general' && x.status !== 'breakdown'))
    for (const b of bins) if (b[3] === 'b' && !skip.has(b[0])) { const d = km(tr, b); if (d > 400 && d < 700 && Math.abs(b[1] - 37.985) < 0.03) cands.push(b); }
  return cands[Math.floor(cands.length / 2)] ?? bins[0];
}

export async function runDemo({ view, state, post, selectTab, caption }) {
  const say = async (key, ms) => { caption(t(key)); await sleep(ms); };
  const before = document.querySelector('#speed').value; await post('/api/speed', { scale: 5 });   // real time is too slow for a 90 s demo
  view.flyTo([37.985, 23.735], 14); await say('d1', 4500);
  const bins = await fetch('/api/bins').then(r => r.json());
  const bin = binNearATruck(bins, state.trucks);
  selectTab('reports'); view.flyTo([bin[1], bin[2]], 16);
  const r = await post('/api/reports', { lat: bin[1], lon: bin[2], photo: demoPhoto(), note: 'demo' });
  await say('d2', 4500);
  await post(`/api/reports/${r.id}/assign`); await say('d3', 3500);
  const truck = () => state.trucks.find(x => x.id === state.reports.get(r.id)?.assignedTruck);
  if (truck()) view.flyTo([truck().lat, truck().lon], 15);
  caption(t('d4'));
  for (let i = 0; i < 90 && state.reports.get(r.id)?.status !== 'collected'; i++) { if (truck()) view.map.panTo([truck().lat, truck().lon]); await sleep(500); }
  await sleep(1500);
  // second report, then a breakdown of the assigned truck: it is reassigned
  const bin2 = binNearATruck(bins, state.trucks, new Set([bin[0]]));
  const r2 = await post('/api/reports', { lat: bin2[1], lon: bin2[2], photo: demoPhoto(), note: 'demo' });
  const a = await post(`/api/reports/${r2.id}/assign`); view.flyTo([bin2[1], bin2[2]], 15); await sleep(2500);
  await post(`/api/trucks/${a.assignedTruck}/breakdown`); await say('d5', 3500);
  await post(`/api/reports/${r2.id}/assign`); await sleep(2500);
  selectTab('plants'); view.flyTo([37.985, 23.735], 13); await say('d6', 7000);
  await say('d7', 6000);
  caption(null); await post('/api/speed', { scale: Number(before) });
}
