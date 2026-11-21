/** Small geo helpers (WGS84, local equirectangular approximation: fine for city-scale distances). */
const M_LAT = 111320;
const mLon = lat => M_LAT * Math.cos(lat * Math.PI / 180);

export function distance(a, b) {
  const dx = (b.lon - a.lon) * mLon((a.lat + b.lat) / 2), dy = (b.lat - a.lat) * M_LAT;
  return Math.hypot(dx, dy);
}
/** Compass heading in degrees (0 = north, 90 = east) from a to b. */
export function bearing(a, b) {
  const dx = (b.lon - a.lon) * mLon(a.lat), dy = (b.lat - a.lat) * M_LAT;
  return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
}
/** Move point p toward target by `meters`; returns the new point and whether the target was reached. */
export function moveToward(p, target, meters) {
  const d = distance(p, target);
  if (d <= meters) return { lat: target.lat, lon: target.lon, arrived: true };
  const f = meters / d;
  return { lat: p.lat + (target.lat - p.lat) * f, lon: p.lon + (target.lon - p.lon) * f, arrived: false };
}
export function nearest(p, items, key = x => x) {
  let best = null, bd = Infinity;
  for (const it of items) { const d = distance(p, key(it)); if (d < bd) { bd = d; best = it; } }
  return best ? { item: best, dist: bd } : null;
}
/** Deterministic k-means on points {lat, lon}: returns k clusters (arrays of indices). */
export function kmeans(points, k, iterations = 12) {
  const order = points.map((_, i) => i).sort((a, b) => points[a].lon - points[b].lon || points[a].lat - points[b].lat);
  let centers = Array.from({ length: k }, (_, c) => ({ ...points[order[Math.floor((c + 0.5) * points.length / k)]] }));
  let groups = [];
  for (let it = 0; it < iterations; it++) {
    groups = Array.from({ length: k }, () => []);
    points.forEach((p, i) => { let b = 0, bd = Infinity; centers.forEach((c, j) => { const d = distance(p, c); if (d < bd) { bd = d; b = j; } }); groups[b].push(i); });
    centers = groups.map((g, j) => g.length ? { lat: g.reduce((s, i) => s + points[i].lat, 0) / g.length, lon: g.reduce((s, i) => s + points[i].lon, 0) / g.length } : centers[j]);
  }
  return groups;
}
