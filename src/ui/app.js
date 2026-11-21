/** Page wiring: owns the current plant, the render loop and the views. Everything else lives in focused modules. */
import { Plant, DT } from '../core/index.js';
import { listScenes, getScene, DEFAULT_SCENE } from '../scenes/index.js';
import { materialLabel } from '../core/index.js';
import { createView2D } from '../view/canvas2d/view2d.js';
import { drawGantt, PHASE_COLORS } from '../view/canvas2d/gantt.js';
import { createI18n } from './i18n.js';
import { createDemo } from './demo.js';
import { createDecisionLog } from './decision-log.js';
import { createStatsPanel } from './stats-panel.js';
import { createPlantControls } from './plant-controls.js';
import { installCaptureApi } from './capture-api.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
export const CAPTURE = params.has('capture');

const i18n = createI18n(CAPTURE ? 'en' : 'el');
const view2d = createView2D($('view2d'));
const stats = createStatsPanel(i18n);
const log = createDecisionLog($('log'));
const controls = createPlantControls($('plant-controls'), i18n);

const state = { scene: null, plant: null, demo: null, playing: false, replay: false, mode3d: params.get('view') === '3d', view3d: null, acc: 0 };
const nameOf = id => materialLabel(id, i18n.lang);

// ---------- scene / plant lifecycle ----------
function loadScene(id, seed) {
  state.scene = getScene(id);
  $('seed').value = seed ?? state.scene.seed ?? 1;
  usePlant(Plant.fromScene(state.scene, { seed: +$('seed').value }), { replay: false });
  state.demo = createDemo(state.scene, i18n, $('caption'));
  state.demo.reset();
}

function usePlant(plant, { replay }) {
  state.plant = plant; state.replay = replay; state.acc = 0;
  log.reset(); $('verify').textContent = '';
  controls.rebuild(plant); controls.setLocked(replay);
  $('demo').disabled = replay;
  sizeCanvases(); showMode();
}

function sizeCanvases() {
  const lanes = state.plant.robotCount + (state.plant.fleet?.amrs.length ?? 0);
  let w = 1120, viewH = 420, ganttH = Math.min(240, Math.max(130, lanes * 16 + 36));
  if (CAPTURE) {   // fill the window: header 38 + legend 22 + HUD 96 + gaps/padding 48 are fixed
    w = innerWidth - 24;
    viewH = Math.max(200, innerHeight - 38 - ganttH - 22 - 96 - 48);
  }
  for (const id of ['view2d', 'view3d']) { $(id).width = w; $(id).height = viewH; }
  $('gantt').width = w; $('gantt').height = ganttH;
  state.view3d?.resize(w, viewH);
}

function showMode() {
  const on3d = state.mode3d && !!state.view3d;
  $('view2d').classList.toggle('on', !on3d); $('view3d').classList.toggle('on', on3d);
  $('toggle3d').textContent = on3d ? '2D' : '3D'; $('toggle3d').style.display = state.view3d ? '' : 'none';
}

// ---------- rendering ----------
export function renderFrame() {
  const { plant } = state;
  if (state.mode3d && state.view3d) state.view3d.render(plant, CAPTURE ? plant.t : undefined);
  else view2d.draw(plant, { itemLabels: $('labels').checked, nameOf });
  drawGantt($('gantt'), plant);
  stats.update(plant); log.update(plant);
  $('play').textContent = i18n.t(state.playing ? 'pause' : 'play');
}

/** Advance the simulation by `seconds` (carrying the remainder), running the demo timeline if active. */
export function advance(seconds) {
  state.acc += seconds;
  const n = Math.floor(state.acc / DT + 1e-9);
  state.acc -= n * DT;
  for (let i = 0; i < n; i++) {
    if (state.demoActive && state.demo.tick(state.plant)) { state.playing = false; state.demoActive = false; }
    state.plant.step();
    if (state.replay && state.plant.n >= state.plant.targetSteps) { state.playing = false; break; }
  }
}

let last = 0;
function frame(ts) {
  const dt = Math.min(0.1, (ts - last) / 1000); last = ts;
  if (!CAPTURE) {   // capture mode renders only when the tool calls advance()
    if (state.playing) advance(dt * +$('speed').value);
    renderFrame();
  }
  requestAnimationFrame(frame);
}

// ---------- demo / replay / export ----------
export function startDemo(seed) {
  loadScene(state.scene.id, seed);
  state.demoActive = true; state.playing = !CAPTURE;
}

async function importFile(file) {
  try {
    const obj = JSON.parse(await file.text());
    const ok = Plant.verify(obj);
    usePlant(Plant.fromJSON(obj), { replay: true });
    state.demo = null; state.demoActive = false; state.playing = true;
    $('verify').innerHTML = `${i18n.t(ok ? 'verOk' : 'verBad')}<br>${i18n.t('replaying')}`;
    $('verify').style.color = ok ? 'var(--g4)' : 'var(--bad)';
  } catch { $('verify').textContent = i18n.t('badFile'); $('verify').style.color = 'var(--bad)'; }
}

function exportFile() {
  const p = state.plant, blob = new Blob([JSON.stringify(p.exportJSON(), null, 1)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${p.id}-seed${$('seed').value}-${Math.round(p.t)}s.json` });
  a.click(); URL.revokeObjectURL(a.href);
}

// ---------- language ----------
function applyLang() {
  i18n.apply();
  $('legend').innerHTML = Object.entries(PHASE_COLORS).map(([k, c]) => `<span><i style="background:${c}"></i>${i18n.t('phase')[k]}</span>`).join('');
  [...$('scene').options].forEach(o => (o.textContent = i18n.pick(getScene(o.value).name)));
  state.view3d?.setNames(nameOf);
  state.demo?.refresh();
  if (state.plant) controls.rebuild(state.plant);                  // option labels follow the language
}

// ---------- boot ----------
$('scene').innerHTML = listScenes().map(s => `<option value="${s.id}"></option>`).join('');
$('scene').onchange = e => { state.demoActive = false; loadScene(e.target.value); state.playing = false; };
$('play').onclick = () => { state.playing = !state.playing; };
$('reset').onclick = () => { state.demoActive = false; loadScene(state.scene.id, +$('seed').value || 1); };
$('demo').onclick = () => startDemo(+$('seed').value || undefined);
$('lang').onclick = () => i18n.toggle();
$('toggle3d').onclick = () => { state.mode3d = !state.mode3d; showMode(); };
$('export').onclick = exportFile;
$('importBtn').onclick = () => $('importFile').click();
$('importFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); };
i18n.onChange(() => { applyLang(); stats.update(state.plant); });

const sceneId = params.has('scene') ? params.get('scene') : DEFAULT_SCENE;
$('scene').value = getScene(sceneId).id;
applyLang();
loadScene(sceneId, params.has('seed') ? +params.get('seed') : undefined);
if (CAPTURE) document.body.classList.add('cap');

import('../view/three/index.js').then(m => {
  state.view3d = m.createView3D($('view3d'), { fast: CAPTURE, nameOf });
  sizeCanvases(); showMode();
}).catch(e => { console.error('3D view unavailable, using 2D', e); state.mode3d = false; showMode(); });

installCaptureApi({ i18n, state, advance, renderFrame, startDemo });
requestAnimationFrame(ts => { last = ts; frame(ts); });
