// Flat Vector: the six colours, the three curves and the few shapes the whole shot is cut from.
// Nothing here knows about time; every function draws one flat shape in one of the six colours.

export const C = { ultra: '#2B2BFF', coral: '#FF5A4E', sun: '#FFC62B', mint: '#2EE6A8', cream: '#FFF6E9', ink: '#151433' };
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };

/** CSS cubic-bezier(x1, y1, x2, y2) as a function of progress 0..1. */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 40; i++) { const v = sx(t); if (Math.abs(v - x) < 1e-6) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return sy(t);
  };
}
/** The style's soul: out, a little too far, and back. */
export const BACK = bezier(0.34, 1.56, 0.64, 1);
/** A firm in-and-out for the camera. */
export const INOUT = bezier(0.7, 0, 0.3, 1);
/** A fast start and a long landing. */
export const OUT = bezier(0.16, 1, 0.3, 1);
/** Into a hit: slow, then all at once. */
export const IN = bezier(0.6, 0, 0.9, 0.4);

/** A wobble that dies away: 1 at t = 0, swinging f times a beat, halving every h beats. */
export const wob = (t, f = 2.2, h = 0.12) => (t < 0 ? 0 : Math.pow(0.5, t / h) * Math.cos(t * f * TAU));
/** The same, starting from nothing: for a wobble added to something already at rest. */
export const wobS = (t, f = 2.2, h = 0.12) => (t < 0 ? 0 : Math.pow(0.5, t / h) * Math.sin(t * f * TAU));
/** A hit that dies away without swinging. */
export const hit = (t, h = 0.08) => (t < 0 ? 0 : Math.pow(0.5, t / h));

/**
 * An elastic entrance from the ground: flat and wide, up past full height, back to rest.
 * u is progress 0..1; returns { sx, sy } to scale about the middle of the base.
 */
export function pop(u) {
  if (u <= 0) return { sx: 0, sy: 0 };
  const sy = BACK(clamp(u));
  // a wide sliver at first, a touch thin at the top of the overshoot, then true
  const sx = sy < 1 ? lerp(1.22, 1, clamp(sy)) : 1 - 0.55 * (sy - 1);
  return { sx, sy };
}

export function rect(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
export function rr(g, x, y, w, h, r, col) { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
export function disc(g, x, y, r, col) { if (r <= 0) return; g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
/** A round-ended bar from a to b: limbs, posts, stems. */
export function bar(g, x0, y0, x1, y1, w, col) {
  g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
}
export function poly(g, pts, col) {
  g.fillStyle = col; g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath(); g.fill();
}
/** Scale what fn draws by (sx, sy) about (x, y), and turn it by rot. */
export function about(g, x, y, sx, sy, fn, rot = 0) {
  g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.scale(sx, sy); g.translate(-x, -y); fn(); g.restore();
}
/** The joint of a two-bone limb from a to b (bone lengths l1, l2), bending to side s (+1 or -1). */
export function elbow(ax, ay, bx, by, l1, l2, s = 1) {
  const dx = bx - ax, dy = by - ay, d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / Math.hypot(dx, dy), uy = dy / Math.hypot(dx, dy);
  return [ax + ux * a - uy * h * s, ay + uy * a + ux * h * s];
}
