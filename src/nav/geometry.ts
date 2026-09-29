import type { LngLat } from "../lib/geo";

const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LNG = 111320;

// Flat-earth distances are accurate to well under a metre over a few hundred metres,
// which is all that snapping a GPS fix to a road needs.
export function metersBetween(a: LngLat, b: LngLat) {
  const dx = (b[0] - a[0]) * M_PER_DEG_LNG * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  const dy = (b[1] - a[1]) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

export function cumulative(line: LngLat[]): number[] {
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + metersBetween(line[i - 1], line[i]));
  return cum;
}

export type Snap = { along: number; off: number };

// Finds the closest point on the route to a position. `window` limits the search to the part of the
// route near where you already were, so a route that passes the same spot twice can't jump ahead.
export function snapToRoute(
  line: LngLat[],
  cum: number[],
  p: LngLat,
  window?: { from: number; to: number },
): Snap {
  const mx = M_PER_DEG_LNG * Math.cos((p[1] * Math.PI) / 180);
  let best: Snap = { along: 0, off: Infinity };
  for (let i = 0; i < line.length - 1; i++) {
    if (window && (cum[i + 1] < window.from || cum[i] > window.to)) continue;
    const ax = (line[i][0] - p[0]) * mx;
    const ay = (line[i][1] - p[1]) * M_PER_DEG_LAT;
    const bx = (line[i + 1][0] - p[0]) * mx;
    const by = (line[i + 1][1] - p[1]) * M_PER_DEG_LAT;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2));
    const off = Math.hypot(ax + t * dx, ay + t * dy);
    if (off < best.off) best = { off, along: cum[i] + t * Math.sqrt(len2) };
  }
  return best;
}

// Compass bearing in degrees (0 = north) from one point towards another.
export function bearing(a: LngLat, b: LngLat) {
  const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180);
  const dy = b[1] - a[1];
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}
