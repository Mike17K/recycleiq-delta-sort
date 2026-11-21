/** Scrolling Gantt strip: one lane per delta robot (grouped by line), then one per mobile robot. */
export const PHASE_COLORS = {
  move: '#3aa6ff', grip: '#f4b942', carry: '#2fa36b', release: '#e4572e', return: '#7a8fa6', idle: '#1b3a2a',   // delta robots
  goto: '#2bb6c4', pull: '#d9d36a', haul: '#1f8fa0', empty: '#c98a3a', push: '#e8e08a', park: '#6a8f99', wait: '#e4572e55',   // mobile robots
};

export function drawGantt(canvas, plant, { windowSec = 20 } = {}) {
  const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  const lanes = [
    ...plant.lines.flatMap(line => line.robots.map(robot => ({ label: `${line.id}${robot.id}`, robot }))),
    ...(plant.fleet?.amrs ?? []).map(robot => ({ label: `M${robot.id}`, robot })),
  ];
  const top = 6, bottom = 18, gap = 3, left = 44;
  const laneH = Math.min(36, (H - top - bottom - gap * lanes.length) / lanes.length);
  const t1 = plant.t, t0 = t1 - windowSec, span = W - left - 8;
  c.clearRect(0, 0, W, H);
  c.font = `${Math.max(9, Math.min(12, laneH * 0.7))}px system-ui`;
  lanes.forEach(({ label, robot }, i) => {
    const y = top + i * (laneH + gap);
    c.fillStyle = '#0b1f17'; c.fillRect(left, y, span, laneH);
    for (const s of robot.segs) {
      if (s.t1 < t0 || s.t0 > t1) continue;
      const a = left + ((Math.max(s.t0, t0) - t0) / windowSec) * span, b = left + ((Math.min(s.t1, t1) - t0) / windowSec) * span;
      c.fillStyle = PHASE_COLORS[s.name]; c.fillRect(a, y + 1, Math.max(1, b - a), laneH - 2);
    }
    c.fillStyle = robot.enabled ? '#e8f5ee' : '#e4572e'; c.fillText(label, 8, y + laneH * 0.7);
  });
  c.fillStyle = '#9bbfab'; c.fillText(`−${windowSec} s`, left, H - 5); c.fillText('t', W - 12, H - 5);
}
