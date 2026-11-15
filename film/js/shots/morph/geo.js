// Geometry for the Shape Morph shot. Two kinds of outline, both chosen so an in-between can never knot:
//   radial  a shape seen from a point inside it, as one distance for each of N directions. Any mix of two radial
//           shapes is again one distance a direction, so its outline cannot cross itself.
//   stroke  a centre line with a width and round ends (a brace, an arc, a slash). Mixing two centre lines point for
//           point and mixing the widths gives another stroke.
// A circle and a capsule are both at once, which is why every change goes through one of them.

export const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;

/** CSS cubic-bezier(x1, y1, x2, y2) as a function of progress 0..1. */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 32; i++) { const v = sx(t); if (Math.abs(v - x) < 1e-6) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return sy(t);
  };
}

/** A closed polygon with its corners rounded (one radius, or one a corner; 0 keeps a corner sharp). Dense points. */
export function roundPoly(P, rad, step = 2) {
  const n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = P[i], a = P[(i - 1 + n) % n], b = P[(i + 1) % n], r0 = Array.isArray(rad) ? rad[i] : rad;
    const ux = a[0] - p[0], uy = a[1] - p[1], vx = b[0] - p[0], vy = b[1] - p[1];
    const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    const u = [ux / lu, uy / lu], v = [vx / lv, vy / lv];
    const phi = Math.acos(clamp(u[0] * v[0] + u[1] * v[1], -1, 1));
    if (r0 <= 0 || phi > Math.PI - 1e-3) { out.push([p[0], p[1]]); continue; }
    const d = Math.min(r0 / Math.tan(phi / 2), lu / 2, lv / 2), r = d * Math.tan(phi / 2);
    const t0 = [p[0] + u[0] * d, p[1] + u[1] * d], t1 = [p[0] + v[0] * d, p[1] + v[1] * d];
    const bx = u[0] + v[0], by = u[1] + v[1], bl = Math.hypot(bx, by), cd = r / Math.sin(phi / 2);
    const c = [p[0] + (bx / bl) * cd, p[1] + (by / bl) * cd];
    const a0 = Math.atan2(t0[1] - c[1], t0[0] - c[0]);
    let da = Math.atan2(t1[1] - c[1], t1[0] - c[0]) - a0;
    while (da > Math.PI) da -= TAU;
    while (da < -Math.PI) da += TAU;
    const m = Math.max(2, Math.ceil((Math.abs(da) * r) / step));
    for (let k = 0; k <= m; k++) { const aa = a0 + (da * k) / m; out.push([c[0] + r * Math.cos(aa), c[1] + r * Math.sin(aa)]); }
  }
  return out;
}

/** A polygon seen from (cx, cy): the distance to its outline in each of N directions (the farthest crossing). */
export function radialOf(poly, cx, cy, N) {
  const R = new Float32Array(N), n = poly.length;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU, dx = Math.cos(a), dy = Math.sin(a);
    let best = 0;
    for (let j = 0; j < n; j++) {
      const p = poly[j], q = poly[(j + 1) % n], ex = q[0] - p[0], ey = q[1] - p[1], den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const px = p[0] - cx, py = p[1] - cy, t = (px * ey - py * ex) / den, s = (px * dy - py * dx) / den;
      if (t > best && s >= -1e-6 && s <= 1 + 1e-6) best = t;
    }
    R[i] = best;
  }
  return R;
}

/** A capsule seen from its centre: h from the centre to the middle of each round end, r the end's radius, ang its axis. */
export function capsuleR(h, r, ang, N) {
  const R = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const b = (i / N) * TAU - ang, c = Math.abs(Math.cos(b)), s = Math.abs(Math.sin(b));
    let t = s > 1e-6 ? r / s : Infinity;
    if (t * c > h) t = h * c + Math.sqrt(Math.max(0, r * r - h * h * s * s));
    R[i] = t;
  }
  return R;
}

export const circleR = (r, N) => new Float32Array(N).fill(r);

/** An open polyline resampled to M points, evenly along its length. */
export function resample(pts, M) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1], out = [];
  let j = 0;
  for (let i = 0; i < M; i++) {
    const s = (total * i) / (M - 1);
    while (j < pts.length - 2 && cum[j + 1] < s) j++;
    const f = cum[j + 1] > cum[j] ? (s - cum[j]) / (cum[j + 1] - cum[j]) : 0;
    out.push([lerp(pts[j][0], pts[j + 1][0], f), lerp(pts[j][1], pts[j + 1][1], f)]);
  }
  return out;
}

export function cubicPts(p0, c1, c2, p1, n = 40) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0], u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1]]);
  }
  return out;
}

export function arcPts(cx, cy, r, a0, a1, n = 40) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}

export const linePts = (a, b, M) => Array.from({ length: M }, (_, i) => [lerp(a[0], b[0], i / (M - 1)), lerp(a[1], b[1], i / (M - 1))]);
