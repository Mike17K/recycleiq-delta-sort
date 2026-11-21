/** Top-down 2D view of a Plant (fallback / overview). Scales itself to the plant bounds and canvas size. */
import { MATERIALS, RESIDUE } from '../../core/index.js';

export function createView2D(canvas) {
  const c = canvas.getContext('2d');

  /** @param opts { itemLabels: bool, nameOf: id => string } */
  function draw(plant, { itemLabels = false, nameOf = id => id } = {}) {
    const W = canvas.width, H = canvas.height, b = plant.bounds();
    const S = Math.min(W / b.width, H / b.depth);                          // px per metre
    const ox = (W - b.width * S) / 2, oy = (H - b.depth * S) / 2;
    const ctx = { S, t: plant.t, fs: Math.max(10, S * 0.075), X: x => ox + (x - b.minX) * S, Y: y => oy + (b.maxY - y) * S };
    c.clearRect(0, 0, W, H);
    c.textAlign = 'left'; c.font = `${ctx.fs}px system-ui`;
    c.fillStyle = '#9bbfab'; c.fillText(`t = ${ctx.t.toFixed(1)} s`, 10, ctx.fs + 6);

    drawAisles(plant, ctx);
    for (const line of plant.lines) {
      const { origin } = line.cfg, local = { ...ctx, X: x => ctx.X(origin.x + x), Y: y => ctx.Y(origin.y + y) };   // line -> world
      drawBelt(line, local);
      for (const r of line.robots) drawRobot(line, r, local);
      drawItems(line, local, itemLabels);
      c.fillStyle = '#e8f5ee'; c.font = `bold ${ctx.fs * 1.3}px system-ui`; c.textAlign = 'left';
      c.fillText(line.id, local.X(-0.2), local.Y(line.cfg.belt.width / 2 + 0.12));
    }
    drawBins(plant, ctx, nameOf);
    drawContainers(plant, ctx);
    drawAmrs(plant, ctx);
  }

  function drawBelt(line, { X, Y, S }) {
    const { length, width } = line.cfg.belt;
    c.fillStyle = '#26332d'; c.fillRect(X(0), Y(width / 2), length * S, width * S);
    c.strokeStyle = '#34463d'; c.lineWidth = 2;
    for (let x = -(line.beltDist % 0.25); x < length; x += 0.25) {
      if (x < 0) continue;
      c.beginPath(); c.moveTo(X(x), Y(width / 2)); c.lineTo(X(x), Y(-width / 2)); c.stroke();
    }
  }

  function drawAisles(plant, { X, Y }) {
    if (!plant.fleet) return;
    const nodes = plant.logistics.aisles.nodes;
    c.strokeStyle = '#c9a22755'; c.lineWidth = 2; c.setLineDash([8, 8]);
    for (const [a, b] of plant.logistics.aisles.edges) { c.beginPath(); c.moveTo(X(nodes[a].x), Y(nodes[a].y)); c.lineTo(X(nodes[b].x), Y(nodes[b].y)); c.stroke(); }
    c.setLineDash([]);
  }

  /** Every physical bin with a fill bar; an empty (hatched) outline marks a slot whose bin is missing. */
  function drawBins(plant, { X, Y, S, fs, t }, nameOf) {
    c.textAlign = 'center'; c.font = `${fs * 0.9}px system-ui`;
    for (const slot of plant.slots) {
      const isRes = slot.material === RESIDUE, w = isRes ? 0.5 : 0.36, h = isRes ? 0.9 : 0.28, col = MATERIALS[slot.material].color, a = slot.spots.active;
      if (slot.capacity != null && (slot.state === 'gap' || slot.state === 'switching')) {
        c.strokeStyle = '#ff3b2f'; c.lineWidth = 2; c.setLineDash([4, 4]);
        c.strokeRect(X(a.x - w / 2), Y(a.y + h / 2), w * S, h * S); c.setLineDash([]);
      }
      for (const bin of slot.bins) {
        const p = plant.binPos(bin, t), x0 = X(p.x - w / 2), y0 = Y(p.y + h / 2);
        c.fillStyle = col + '40'; c.strokeStyle = bin.full ? '#ff3b2f' : col; c.lineWidth = 2;
        c.fillRect(x0, y0, w * S, h * S); c.strokeRect(x0, y0, w * S, h * S);
        if (bin.ratio > 0) { c.fillStyle = col + 'cc'; c.fillRect(x0, y0 + h * S * (1 - bin.ratio), w * S, h * S * bin.ratio); }
      }
      c.fillStyle = '#e8f5ee'; c.fillText(nameOf(slot.material), X(a.x), Y(a.y) - 2);
    }
    c.textAlign = 'left';
  }

  function drawContainers(plant, { X, Y, S, fs }) {
    if (!plant.fleet) return;
    for (const k of plant.fleet.containers) {
      const w = 1.0, h = 0.8, x0 = X(k.x - w / 2), y0 = Y(k.y + h / 2);
      c.fillStyle = '#6b7d7366'; c.strokeStyle = '#9bbfab'; c.lineWidth = 2;
      c.fillRect(x0, y0, w * S, h * S); c.strokeRect(x0, y0, w * S, h * S);
      c.fillStyle = '#d9a441cc'; c.fillRect(x0, y0 + h * S * (1 - k.ratio), w * S, h * S * k.ratio);
      c.fillStyle = '#e8f5ee'; c.textAlign = 'center'; c.font = `bold ${fs}px system-ui`; c.fillText(k.id, X(k.x), Y(k.y) + fs * 0.35); c.textAlign = 'left';
    }
  }

  function drawAmrs(plant, { X, Y, S, fs, t }) {
    if (!plant.fleet) return;
    for (const a of plant.fleet.amrs) {
      const p = plant.fleet.amrPos(a, t);
      c.fillStyle = a.enabled ? '#2bb6c4' : '#8a3a30'; c.strokeStyle = '#0a2a2f'; c.lineWidth = 1.5;
      c.beginPath(); c.roundRect(X(p.x) - S * 0.3, Y(p.y) - S * 0.2, S * 0.6, S * 0.4, 5); c.fill(); c.stroke();
      c.fillStyle = '#04150d'; c.font = `bold ${fs * 0.9}px system-ui`; c.textAlign = 'center'; c.fillText(`M${a.id}`, X(p.x), Y(p.y) + fs * 0.3); c.textAlign = 'left';
    }
  }

  function drawRobot(line, r, { X, Y, S, fs, t }) {
    const { R } = line.cfg, on = r.enabled;
    c.strokeStyle = on ? '#2fa36b66' : '#e4572e66'; c.fillStyle = on ? '#2fa36b14' : '#e4572e14';
    c.setLineDash([6, 5]); c.lineWidth = 1.5;
    c.beginPath(); c.arc(X(r.x), Y(r.y), R * S, 0, 7); c.fill(); c.stroke(); c.setLineDash([]);
    const p = line.robotPos(r, t), bx = X(r.x), by = Y(r.y), ex = X(p.x), ey = Y(p.y), anchor = S * 0.13;
    c.strokeStyle = on ? '#8fe3b4' : '#8a5a50'; c.lineWidth = 2;
    for (let k = 0; k < 3; k++) {                                          // three arms from the base to the effector
      const a = Math.PI / 2 + (k * 2 * Math.PI) / 3;
      c.beginPath(); c.moveTo(bx + Math.cos(a) * anchor, by - Math.sin(a) * anchor); c.lineTo(ex, ey); c.stroke();
    }
    c.fillStyle = on ? '#12301f' : '#3a1f18'; c.beginPath(); c.arc(bx, by, S * 0.09, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#e8f5ee'; c.font = `bold ${fs}px system-ui`; c.textAlign = 'center'; c.fillText(`${line.id}${r.id}`, bx, by + fs * 0.35);
    c.fillStyle = on ? '#8fe3b4' : '#e4572e'; c.beginPath(); c.arc(ex, ey, S * 0.045 * (1 + 0.6 * p.z), 0, 7); c.fill();
    c.textAlign = 'left';
  }

  function drawItems(line, { X, Y, S, fs, t }, labels) {
    const half = S * 0.05;
    for (const item of line.items) {
      const p = line.itemPos(item, t);
      c.fillStyle = MATERIALS[item.type].color; c.strokeStyle = '#0008'; c.lineWidth = 1;
      c.beginPath(); c.roundRect(X(p.x) - half, Y(p.y) - half, half * 2, half * 2, 4); c.fill(); c.stroke();
      if (item.claimed && item.state === 'belt') { c.strokeStyle = '#fff'; c.beginPath(); c.arc(X(p.x), Y(p.y), half * 1.5, 0, 7); c.stroke(); }
      if (labels) { c.fillStyle = '#e8f5ee'; c.font = `${fs * 0.8}px system-ui`; c.fillText(`#${item.id} ${item.type}`, X(p.x) - half, Y(p.y) - half * 1.6); }
    }
  }

  return { draw };
}
