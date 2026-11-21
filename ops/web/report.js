/** Citizen portal: one photo + automatic location, two taps. The photo is resized in the browser before upload. */
import { t, getLang, setLang, applyI18n } from './i18n.js';

const $ = s => document.querySelector(s);
let photo = null, pos = null, pmap = null, pin = null;

function setPos(lat, lon, msgKey) {
  pos = { lat, lon }; $('#locmsg').textContent = `${t(msgKey)} (${lat.toFixed(5)}, ${lon.toFixed(5)})`;
  $('#pmap').style.display = 'block';
  if (!pmap) {
    pmap = L.map('pmap').setView([lat, lon], 18);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(pmap);
    pmap.on('click', e => setPos(e.latlng.lat, e.latlng.lng, 'r_loc_ok'));
  }
  pin ? pin.setLatLng([lat, lon]) : (pin = L.marker([lat, lon], { draggable: true }).addTo(pmap).on('dragend', () => { const p = pin.getLatLng(); pos = { lat: p.lat, lon: p.lng }; }));
  pmap.setView([lat, lon]);
}
function locate() {
  $('#locmsg').textContent = t('r_locating');
  if (!navigator.geolocation) return fail();
  navigator.geolocation.getCurrentPosition(p => setPos(p.coords.latitude, p.coords.longitude, 'r_loc_ok'), fail, { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
}
function fail() {
  $('#locmsg').textContent = t('r_loc_fail'); $('#pmap').style.display = 'block';
  if (!pmap) { pmap = L.map('pmap').setView([37.985, 23.735], 14); L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(pmap); pmap.on('click', e => setPos(e.latlng.lat, e.latlng.lng, 'r_loc_ok')); }
}
function resize(file, max = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.72));
    }; img.onerror = reject; img.src = URL.createObjectURL(file);
  });
}
function error(key) { const e = $('#err'); e.textContent = t(key); e.style.display = 'block'; }

$('#take').onclick = () => $('#file').click();
$('#file').onchange = async e => { const f = e.target.files[0]; if (!f) return; photo = await resize(f); const p = $('#preview'); p.src = photo; p.style.display = 'block'; };
$('#send').onclick = async () => {
  $('#err').style.display = 'none';
  if (!photo || !pos) return error('r_need');
  $('#send').disabled = true;
  try {
    const res = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...pos, photo, note: $('#note').value }) });
    if (res.status === 429) { error('r_limit'); return; }
    if (!res.ok) { error('r_err'); return; }
    const r = await res.json(); $('#form').style.display = 'none'; $('#done').style.display = 'block'; $('#doneMsg').textContent = t('r_sent'); $('#rid').textContent = r.id; poll(r.id);
  } catch { error('r_err'); } finally { $('#send').disabled = false; }
};
let timer;
function poll(id) { clearInterval(timer); const f = () => fetch(`/api/reports/${id}`).then(r => r.json()).then(r => ($('#status').textContent = t(r.status))); f(); timer = setInterval(f, 3000); }
$('#again').onclick = () => { clearInterval(timer); photo = null; $('#preview').style.display = 'none'; $('#file').value = ''; $('#note').value = ''; $('#form').style.display = 'block'; $('#done').style.display = 'none'; locate(); };
$('#lang').onclick = () => { setLang(getLang() === 'el' ? 'en' : 'el'); $('#lang').textContent = getLang() === 'el' ? 'EN' : 'EL'; applyI18n(); };
$('#lang').textContent = getLang() === 'el' ? 'EN' : 'EL'; applyI18n(); locate();
