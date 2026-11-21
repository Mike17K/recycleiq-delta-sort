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

export async function runDemo({ view, state, post, selectTab, caption }) {
  const say = async (key, ms) => { caption(t(key)); await sleep(ms); };
  view.flyTo([37.985, 23.735], 14); await say('d1', 4500);
  // pick a general bin near the centre that is not already full
  const bins = await fetch('/api/bins').then(r => r.json());
  const c = { lat: 37.985, lon: 23.735 };
  const bin = bins.filter(b => b[3] === 'b').sort((a, b) => Math.hypot(a[1] - c.lat, a[2] - c.lon) - Math.hypot(b[1] - c.lat, b[2] - c.lon))[8];
  selectTab('reports'); view.flyTo([bin[1], bin[2]], 16);
  const r = await post('/api/reports', { lat: bin[1], lon: bin[2], photo: demoPhoto(), note: 'demo' });
  await say('d2', 4500);
  await post(`/api/reports/${r.id}/assign`); await say('d3', 3500);
  const truck = () => state.trucks.find(x => x.id === state.reports.get(r.id)?.assignedTruck);
  if (truck()) view.flyTo([truck().lat, truck().lon], 15);
  caption(t('d4'));
  for (let i = 0; i < 40 && state.reports.get(r.id)?.status !== 'collected'; i++) { if (truck()) view.map.panTo([truck().lat, truck().lon]); await sleep(500); }
  await sleep(1500);
  // second report, then a breakdown of the assigned truck: it is reassigned
  const bin2 = bins.filter(b => b[3] === 'b')[40];
  const r2 = await post('/api/reports', { lat: bin2[1], lon: bin2[2], photo: demoPhoto(), note: 'demo' });
  const a = await post(`/api/reports/${r2.id}/assign`); view.flyTo([bin2[1], bin2[2]], 15); await sleep(2500);
  await post(`/api/trucks/${a.assignedTruck}/breakdown`); await say('d5', 3500);
  await post(`/api/reports/${r2.id}/assign`); await sleep(2500);
  selectTab('plants'); view.flyTo([37.985, 23.735], 13); await say('d6', 7000);
  await say('d7', 6000);
  caption(null);
}
