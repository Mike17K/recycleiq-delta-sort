/** Controls that depend on the plant: line selector, rate/belt sliders, per-robot toggles, mobile robots, bin fill and surge. */
import { materialLabel } from '../core/index.js';

export function createPlantControls(container, i18n) {
  let plant = null, lock = false, target = 'all';
  const el = {};

  function rebuild(p) {
    plant = p;
    const multi = p.lines.length > 1;
    target = multi ? 'all' : p.lines[0].id;
    container.innerHTML = `
      <div class="row" ${multi ? '' : 'hidden'}><label data-i="line"></label>
        <select id="lineSel"><option value="all" data-i="allLines"></option>${p.lines.map(l => `<option value="${l.id}">${l.id}</option>`).join('')}</select></div>
      <div class="row"><label data-i="rate"></label><input type="range" id="rate" min="0.2" max="8" step="0.1"><span id="rateV"></span></div>
      <div class="row"><label data-i="belt"></label><input type="range" id="belt" min="0.2" max="1.5" step="0.05"><span id="beltV"></span></div>
      <div class="row"><label data-i="robots"></label><div class="chips" id="chips">${p.lines.flatMap(l => l.robots.map(r =>
        `<label data-robot="${l.id}:${r.id}"><input type="checkbox" checked> ${l.id}${r.id}</label>`)).join('')}</div>
        <button id="surge" data-i="surge"></button></div>
      ${p.fleet ? `<div class="row"><label data-i="mobile"></label><div class="chips">${p.fleet.amrs.map(a =>
        `<label data-amr="${a.id}"><input type="checkbox" checked> M${a.id}</label>`).join('')}</div></div>
      <div class="row"><select id="fillSel">${p.slots.filter(s => s.capacity != null).map(s =>
        `<option value="${s.lineId}|${s.material}">${s.lineId} · ${materialLabel(s.material, i18n.lang)}</option>`).join('')}</select>
        <button id="fillBtn" data-i="fillBin"></button></div>` : ''}`;
    for (const id of ['lineSel', 'rate', 'belt', 'surge']) el[id] = container.querySelector('#' + id);
    el.rateV = container.querySelector('#rateV'); el.beltV = container.querySelector('#beltV');
    i18n.apply(container);

    if (el.lineSel) el.lineSel.onchange = () => { target = el.lineSel.value; sync(); };
    el.rate.oninput = () => send({ type: 'rate', value: +el.rate.value });
    el.belt.oninput = () => send({ type: 'belt', value: +el.belt.value });
    el.surge.onclick = () => send({ type: 'surge', mult: 2, dur: 10 });
    container.querySelectorAll('[data-amr]').forEach(lab => {
      lab.querySelector('input').onchange = e => send({ type: 'amr', id: +lab.dataset.amr, enabled: e.target.checked });
    });
    const fillBtn = container.querySelector('#fillBtn');
    if (fillBtn) fillBtn.onclick = () => { const [line, material] = container.querySelector('#fillSel').value.split('|'); send({ type: 'fillBin', line, material, fraction: 0.95 }); };
    container.querySelectorAll('[data-robot]').forEach(lab => {
      const [line, id] = lab.dataset.robot.split(':');
      lab.querySelector('input').onchange = e => send({ type: 'robot', line, id: +id, enabled: e.target.checked });
    });
    sync();
  }

  const send = evt => { if (lock) return; plant.control(evt.type === 'robot' ? evt : { ...evt, line: target }); sync(); };

  /** Reflect the plant's state in the widgets (the sliders show the selected line, or the first line for "all"). */
  function sync() {
    if (!plant) return;
    const line = plant.line(target) ?? plant.lines[0];
    el.rate.value = line.rate; el.belt.value = line.v;
    el.rateV.textContent = line.rate.toFixed(1); el.beltV.textContent = line.v.toFixed(2);
    container.querySelectorAll('[data-robot]').forEach(lab => {
      const [lid, id] = lab.dataset.robot.split(':'), r = plant.line(lid).robots[id - 1];
      lab.querySelector('input').checked = r.enabled; lab.classList.toggle('off', !r.enabled);
    });
    container.querySelectorAll('[data-amr]').forEach(lab => {
      const a = plant.fleet.amrs[lab.dataset.amr - 1];
      lab.querySelector('input').checked = a.enabled; lab.classList.toggle('off', !a.enabled);
    });
    container.querySelectorAll('input,select,button').forEach(x => (x.disabled = lock));
  }
  return { rebuild, sync, setLocked(v) { lock = v; sync(); } };
}
