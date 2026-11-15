// The pen for the Frame-by-Frame shot. Every mark on screen is a centreline with pressure, redrawn with a little
// variation each time (the boil): a static error, the hand's character, plus an error that changes with the drawing
// number v. Nothing here keeps state: the same stroke, seed and v always give the same ink.

import { clamp, lerp } from '../../util.js';

export const INK = '#1C1815', RED = '#E4432E', YEL = '#F7BC1C', PAPER = '#F1E9DA', GREY = '#7B7067';

// How much of the hand is in the line: 1 = it wobbles and boils as drawn; 0 = dead straight, still and in register.
// The shot sets it at the start of every paint (its last frames ramp it to 0, so Bauhaus takes over a drawing at rest).
let CALM = 1;
export const setCalm = (k) => { CALM = k; };
export const calm = () => CALM;

export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); };
/** Smooth noise, -1 to 1. */
export const vn = (x, seed = 0) => {
  x += seed * 57.31;
  const i = Math.floor(x), f = x - i;
  return lerp(hash(i), hash(i + 1), f * f * (3 - 2 * f)) * 2 - 1;
};

/** A smooth curve through points (Catmull-Rom), as a dense polyline. closed joins the last point to the first. */
export function curve(pts, closed = false, per = 10) {
  const n = pts.length, out = [];
  const P = (i) => (closed ? pts[((i % n) + n) % n] : pts[clamp(i, 0, n - 1)]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(closed ? out[0].slice() : pts[n - 1].slice());
  return out;
}

/** A polyline resampled to an even step: { X, Y, n, step, len }. */
export function path(pts, step = 5) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];
  const n = Math.max(2, Math.round(total / step) + 1), st = total / (n - 1 || 1);
  const X = new Float32Array(n), Y = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const s = i * st;
    while (j < pts.length - 2 && cum[j + 1] < s) j++;
    const f = cum[j + 1] > cum[j] ? clamp((s - cum[j]) / (cum[j + 1] - cum[j])) : 0;
    X[i] = lerp(pts[j][0], pts[j + 1][0], f); Y[i] = lerp(pts[j][1], pts[j + 1][1], f);
  }
  return { X, Y, n, step: st, len: total };
}
export const line = (x0, y0, x1, y1, step = 6) => path([[x0, y0], [x1, y1]], step);
export const smoothPath = (pts, closed = false, step = 5) => path(curve(pts, closed), step);

/** A circle (or ellipse) as a closed path that overlaps its own start a little, like a pen coming round. */
export function ring(cx, cy, rx, ry = rx, a0 = -1.9, over = 0.35, step = 5) {
  const pts = [], n = Math.max(12, Math.ceil((Math.PI * (rx + ry)) / 6));
  for (let i = 0; i <= n; i++) { const a = a0 + ((Math.PI * 2 + over) * i) / n; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return path(pts, step);
}

/**
 * Ink one stroke.
 *   w      width in px                    seed   which stroke this is
 *   v      drawing number (the boil)      boil   how far a redrawing may stray, px
 *   rough  the hand's fixed error, px     taper  px over which the pen lands and lifts
 *   from, to   the part drawn, 0 to 1     dry    0 to 1: a dry pencil that skips
 *   press  heavier where the pen lands, lighter where it leaves (0 = even)
 *   color, alpha, tf   a transform [a, b, c, d, e, f] applied to every point (for things that move)
 */
export function ink(g, P, o = {}) {
  const w = o.w ?? 5, seed = o.seed ?? 1, v = o.v ?? 0, boil = (o.boil ?? 1.3) * CALM, rough = (o.rough ?? 0) * CALM, taper = o.taper ?? 16;
  const a = clamp(o.from ?? 0) * P.len, b = clamp(o.to ?? 1) * P.len;
  if (b - a < 0.4) return;
  const st = P.step, i0 = Math.floor(a / st + 1e-6), i1 = Math.min(P.n - 1, Math.ceil(b / st - 1e-6));
  const tf = o.tf, dry = o.dry || 0, press = o.press || 0, rl = o.roughLen ?? 85, bl = o.boilLen ?? 44, vs = v * 9.73;
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = o.color || INK;
  const ga = g.globalAlpha;
  if (o.alpha !== undefined) g.globalAlpha = ga * o.alpha;
  let lx = 0, ly = 0, lq = -1, open = false;
  for (let i = i0; i <= i1; i++) {
    let s = i * st, x, y;
    if (s < a) { const f = (a - s) / st; x = lerp(P.X[i], P.X[i + 1], f); y = lerp(P.Y[i], P.Y[i + 1], f); s = a; }
    else if (s > b) { const f = (s - b) / st; x = lerp(P.X[i], P.X[i - 1], f); y = lerp(P.Y[i], P.Y[i - 1], f); s = b; }
    else { x = P.X[i]; y = P.Y[i]; }
    if (rough) { x += vn(s / rl, seed) * rough; y += vn(s / rl, seed + 5) * rough; }
    if (boil) { x += vn(s / bl + vs, seed + 11 + v * 3) * boil; y += vn(s / bl + vs, seed + 17 + v * 3) * boil; }
    if (tf) { const tx = tf[0] * x + tf[2] * y + tf[4]; y = tf[1] * x + tf[3] * y + tf[5]; x = tx; }
    const e = Math.min(s - a, b - s);
    let ww = w * (0.76 + 0.24 * vn(s / 52, seed + 23 + v));
    if (press) ww *= 1 + press * (0.5 - (s - a) / (b - a));              // a marker lands heavy and leaves light
    if (taper > 0) ww *= 0.4 + 0.6 * clamp(e / taper + 0.1);
    const skip = dry > 0 && vn(s / 6.5, seed + 31 + v) > 1 - dry * 1.3;
    const q = skip ? -2 : Math.max(1, Math.round(ww * 2.5));
    if (i === i0) { lx = x; ly = y; lq = q; continue; }
    if (lq !== -2) {
      if (!open) { g.beginPath(); g.moveTo(lx, ly); g.lineWidth = lq / 2.5; open = true; }
      g.lineTo(x, y);
      if (q !== lq) { g.stroke(); open = false; }
    }
    lx = x; ly = y; lq = q;
  }
  if (open) g.stroke();
  // a stroke shorter than one step is still a dot of ink
  if (i1 === i0) { g.beginPath(); g.arc(lx, ly, w * 0.5, 0, Math.PI * 2); g.fillStyle = o.color || INK; g.fill(); }
  g.globalAlpha = ga;
}

/** A filled shape with a hand-cut edge: the colour that goes under the line work, a little off register. */
export function fill(g, P, o = {}) {
  const seed = o.seed ?? 1, v = o.v ?? 0, boil = (o.boil ?? 1.6) * CALM, rough = (o.rough ?? 0) * CALM, tf = o.tf, vs = v * 9.73;
  const dx = (o.dx ?? 0) * CALM, dy = (o.dy ?? 0) * CALM;
  g.beginPath();
  for (let i = 0; i < P.n; i++) {
    const s = i * P.step;
    let x = P.X[i], y = P.Y[i];
    if (rough) { x += vn(s / 85, seed) * rough; y += vn(s / 85, seed + 5) * rough; }
    if (boil) { x += vn(s / 44 + vs, seed + 41 + v * 3) * boil; y += vn(s / 44 + vs, seed + 47 + v * 3) * boil; }
    if (tf) { const tx = tf[0] * x + tf[2] * y + tf[4]; y = tf[1] * x + tf[3] * y + tf[5]; x = tx; }
    if (i) g.lineTo(x + dx, y + dy); else g.moveTo(x + dx, y + dy);
  }
  g.closePath();
  g.fillStyle = o.color || YEL;
  const ga = g.globalAlpha;
  if (o.alpha !== undefined) g.globalAlpha = ga * o.alpha;
  g.fill();
  g.globalAlpha = ga;
}

/** Compose 2D transforms: translate, rotate, scale (sx, sy) about the origin, as [a, b, c, d, e, f]. */
export function xf(x, y, rot = 0, sx = 1, sy = sx) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [c * sx, s * sx, -s * sy, c * sy, x, y];
}
export const xmul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
export const xpt = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
