#!/usr/bin/env node
/* Frame-exact MP4 capture of a scene's scripted demo.
 *
 * Serves the repo on localhost, opens index.html?capture&scene=<id> in headless Chrome, advances the simulation one
 * video frame at a time through window.__riq (src/ui/capture-api.js), screenshots each frame and pipes it to ffmpeg.
 * Same scene + seed + options => identical video, independent of machine speed.
 *
 *   node tools/capture-video/capture.js --list
 *   node tools/capture-video/capture.js [--scene twin-lines] [--out videos/x.mp4] [--seed N] [--fps 24] [--speed 1.5]
 *        [--lang en|el] [--view 3d|2d] [--duration SIM_SECONDS] [--width W] [--height H] [--crf 18] [--chrome PATH]
 * Defaults come from the scene (seed, demo duration, optional video size). --speed = sim seconds per video second.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listScenes, getScene, DEFAULT_SCENE } from '../../src/scenes/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fail = msg => { console.error('capture: ' + msg); process.exit(1); };

// ---------- options ----------
function parseArgs(argv) {
  const out = {};
  argv.forEach((x, i) => { if (x.startsWith('--')) out[x.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true'; });
  return out;
}

function resolveOptions(args) {
  if (args.list) {
    listScenes().forEach(s => console.log(`${s.id}\t${s.name.en}\t${s.lines.length} line(s), ${s.lines.reduce((n, l) => n + l.robots.length, 0)} robots, demo ${s.demo.duration}s`));
    process.exit(0);
  }
  const scene = getScene(args.scene || DEFAULT_SCENE), size = scene.video ?? {};
  return {
    scene,
    out: path.resolve(args.out || path.join(ROOT, 'videos', `${scene.id}-demo.mp4`)),
    seed: args.seed ? +args.seed : undefined,
    fps: +(args.fps || 24), speed: +(args.speed || 1.5), lang: args.lang || 'en', view: args.view || '3d',
    duration: +(args.duration || scene.demo.duration),
    width: +(args.width || size.width || 1280), height: +(args.height || size.height || 720), crf: +(args.crf || 18),
    chrome: args.chrome,
  };
}

// ---------- environment ----------
function findChrome(preferred) {
  const candidates = [preferred, process.env.CHROME_PATH, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'].filter(Boolean);
  for (const c of candidates) {
    if (c.includes('/') && fs.existsSync(c)) return c;
    const r = spawnSync('which', [c]);
    if (r.status === 0) return r.stdout.toString().trim();
  }
  return null;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
function startStaticServer() {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/favicon')) { res.writeHead(204); return res.end(); }
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function startEncoder(o) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(o.fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', String(o.crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', o.out], { stdio: ['pipe', 'inherit', 'inherit'] });
  ff.stdin.on('error', () => {});
  return { ff, done: new Promise(r => ff.on('close', r)) };
}

// ---------- render ----------
async function render(o, chrome, server) {
  const puppeteer = (await import('puppeteer-core').catch(() => fail('puppeteer-core missing — run `npm install` in the repo root'))).default;
  const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--force-device-scale-factor=1'] });
  const page = await browser.newPage();
  await page.setViewport({ width: o.width, height: o.height, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));

  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?capture&view=${o.view}&scene=${o.scene.id}`, { waitUntil: 'load' });
  await page.waitForFunction('window.__riq && window.__riq.ready', { timeout: 20000 });
  await page.evaluate((lang, seed) => { __riq.setLang(lang); __riq.startDemo(seed); }, o.lang, o.seed);
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  if (overflow > 2) console.warn(`capture: warning — page is ${overflow}px taller than the viewport; the bottom will be cropped`);

  const frames = Math.round((o.duration * o.fps) / o.speed), dt = o.speed / o.fps;
  const { ff, done } = startEncoder(o);
  const started = Date.now();
  for (let i = 0; i < frames; i++) {
    await page.evaluate(d => __riq.advance(d), i === 0 ? 0 : dt);
    const frame = await page.screenshot({ type: 'jpeg', quality: 95, optimizeForSpeed: true });
    if (!ff.stdin.write(frame)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % o.fps === 0) process.stdout.write(`\rframe ${i}/${frames}  sim t=${(await page.evaluate(() => __riq.t)).toFixed(1)}s  `);
  }
  ff.stdin.end();
  const code = await done;
  await browser.close();
  if (errors.length) console.warn('\npage errors:\n' + errors.join('\n'));
  if (code !== 0) fail(`ffmpeg exited with ${code}`);
  const mb = (fs.statSync(o.out).size / 1048576).toFixed(1);
  console.log(`\nwrote ${o.out} (${mb} MB, ${frames} frames, ${o.width}x${o.height}, ${((Date.now() - started) / 1000).toFixed(0)} s render)`);
}

async function main() {
  const o = resolveOptions(parseArgs(process.argv.slice(2)));
  if (spawnSync('ffmpeg', ['-version']).status !== 0) fail('ffmpeg not found on PATH');
  const chrome = findChrome(o.chrome) ?? fail('Chrome/Chromium not found (use --chrome PATH or CHROME_PATH)');
  fs.mkdirSync(path.dirname(o.out), { recursive: true });
  const server = await startStaticServer();
  try { await render(o, chrome, server); } finally { server.close(); }
}
main().catch(e => { console.error(e); process.exit(1); });
