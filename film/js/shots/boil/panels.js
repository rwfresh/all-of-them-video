// The three storyboard frames: thumbnails of this film's own hardest shots, drawn (not pasted) as lists of pen
// strokes. Each is built in the frame's own coordinates (centre 0,0; 508 x 286) for a time t in beats: while the
// sketch is a still, t is 0; once the flame has landed on it, t runs and the drawing moves.
//
// An item is one of:
//   { k: 'ink', P, w, seed, ... }        a pen stroke (red: true = the animator's red pencil)
//   { k: 'mask', P }                     paper, to hide what is behind
//   { k: 'fill', P, color, seed }        colour under the line (only once the frame is alive)
//   { k: 'text', s, x, y, u, ... }       hand lettering (x = centre, y = baseline)

import { path, curve, smoothPath, ring, hash, RED, YEL } from './ink.js';

export const PW = 508, PH = 286;
const HW = PW / 2, HH = PH / 2;
const poly = (pts, closed = true, step = 5) => path(closed ? [...pts, pts[0]] : pts, step);
const seg2 = (a, b, step = 5) => path([a, b], step);

/** The frame itself: four ruled-by-hand lines that overshoot their corners. */
export function frame(seed) {
  const o = (k) => 7 + hash(seed + k) * 11;
  return [
    { k: 'ink', P: seg2([-HW - o(1), -HH], [HW + o(2), -HH]), w: 5.6, seed: seed + 1, rough: 1.6 },
    { k: 'ink', P: seg2([HW, -HH - o(3)], [HW, HH + o(4)]), w: 5.6, seed: seed + 2, rough: 1.6 },
    { k: 'ink', P: seg2([HW + o(5), HH], [-HW - o(6), HH]), w: 5.6, seed: seed + 3, rough: 1.6 },
    { k: 'ink', P: seg2([-HW, HH + o(7)], [-HW, -HH - o(8)]), w: 5.6, seed: seed + 4, rough: 1.6 },
  ];
}

/** A curved arrow in red pencil: the storyboard's way of saying "this moves". */
function arrow(pts, seed, head = 13) {
  const c = curve(pts, false, 8), n = c.length, a = c[n - 1], b = c[Math.max(0, n - 4)];
  const ang = Math.atan2(a[1] - b[1], a[0] - b[0]);
  const wing = (d) => [a[0] - head * Math.cos(ang + d), a[1] - head * Math.sin(ang + d)];
  return [
    { k: 'ink', P: path(c, 5), w: 4.2, seed, red: true, rough: 1 },
    { k: 'ink', P: path([wing(0.55), a, wing(-0.55)], 4), w: 4.2, seed: seed + 1, red: true },
  ];
}

/** A four-pointed sparkle. */
export function sparkle(x, y, R, r = R * 0.28, rot = 0) {
  const pts = [];
  for (let i = 0; i < 8; i++) { const a = rot + (i * Math.PI) / 4, q = i % 2 ? r : R; pts.push([x + q * Math.cos(a), y + q * Math.sin(a)]); }
  return poly(pts, true, 4);
}

/** A spiky burst. ky < 1 makes it wider than tall. */
export function burst(x, y, R, r, n, seed, rot = 0, ky = 1) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n, q = (i % 2 ? r : R) * (0.86 + 0.28 * hash(seed + i * 1.7));
    pts.push([x + q * Math.cos(a), y + q * Math.sin(a) * ky]);
  }
  return poly(pts, true, 4);
}

function rrect(cx, cy, w, h, r, rot = 0) {
  const pts = [], c = Math.cos(rot), s = Math.sin(rot);
  const corner = (ox, oy, a0) => { for (let i = 0; i <= 5; i++) { const a = a0 + (i / 5) * (Math.PI / 2); pts.push([ox + r * Math.cos(a), oy + r * Math.sin(a)]); } };
  corner(w / 2 - r, -h / 2 + r, -Math.PI / 2); corner(w / 2 - r, h / 2 - r, 0); corner(-w / 2 + r, h / 2 - r, Math.PI / 2); corner(-w / 2 + r, -h / 2 + r, Math.PI);
  return poly(pts.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]), true, 5);
}

// ---------------------------------------------------------------------------------------------------------------------
// 04 Isometric: a little city of boxes. Alive, the boxes pump up and down in a wave.

const BOXES = [
  [0.35, 0.35, 1.35, 1.35, 2.3, 0], [2.25, 0.25, 1.4, 1.4, 3.7, 1], [4.25, 0.5, 1.3, 1.3, 1.7, 0],
  [0.3, 2.3, 1.4, 1.4, 3.1, 1], [2.3, 2.3, 1.55, 1.55, 5.3, 2], [4.35, 2.45, 1.3, 1.3, 2.7, 0],
  [0.5, 4.35, 1.3, 1.3, 1.5, 0], [2.5, 4.35, 1.3, 1.3, 2.5, 1], [4.4, 4.4, 1.25, 1.25, 1.9, 0],
].sort((a, b) => a[0] + a[1] - b[0] - b[1]);

function iso(t, alive) {
  const CX = 27, CY = 13.5, CH = 21, OY = -28;
  const S = (i, j, k = 0) => [(i - j) * CX, (i + j) * CY + OY - k * CH];
  const it = [];
  // the rough, in red pencil: a slab and a block
  it.push({ k: 'ink', P: poly([S(-0.3, -0.2), S(6.4, -0.1), S(6.2, 6.3), S(-0.2, 6.3)], true, 6), w: 3.2, seed: 90, red: true, rough: 5, under: true });
  it.push({ k: 'ink', P: path([S(2, 2, 5.8), S(4.2, 2, 5.9), S(4.1, 4.1, 5.7), S(4.2, 4.2, 0), S(2, 4.2, 0), S(2, 4, 5.8), S(2, 2, 5.8)], 6), w: 3.2, seed: 91, red: true, rough: 5, under: true });
  it.push({ k: 'ink', P: poly([S(0, 0), S(6, 0), S(6, 6), S(0, 6)], true, 6), w: 3.4, seed: 100, rough: 1.2 });
  BOXES.forEach(([i, j, w, d, h0, tone], n) => {
    const pump = alive ? 0.8 + 0.34 * Math.abs(Math.sin(Math.PI * (t * 0.5 + (i + j) * 0.11))) : 1;
    const h = h0 * pump, sd = 110 + n * 10;
    const A = S(i, j, h), B = S(i + w, j, h), C = S(i + w, j + d, h), D = S(i, j + d, h);
    const B0 = S(i + w, j), C0 = S(i + w, j + d), D0 = S(i, j + d);
    it.push({ k: 'mask', P: poly([A, B, B0, C0, D0, D], true, 8) });
    it.push({ k: 'fill', P: poly([A, B, C, D], true, 8), color: YEL, seed: sd });
    if (tone) it.push({ k: 'fill', P: poly([C, B, B0, C0], true, 8), color: tone === 2 ? RED : YEL, seed: sd + 1, alpha: tone === 2 ? 1 : 0.55 });
    it.push({ k: 'ink', P: poly([A, B, C, D], true, 4), w: 4.4, seed: sd + 2, rough: 0.9 });
    it.push({ k: 'ink', P: path([D, D0, C0, B0, B], 4), w: 4.4, seed: sd + 3, rough: 0.9 });
    it.push({ k: 'ink', P: seg2(C, C0, 4), w: 4.4, seed: sd + 4, rough: 0.7 });
    // hatching on the shadow side, a few windows on the lit side of the tall ones
    const nh = Math.max(1, Math.round(h * 1.25));
    for (let q = 0; q < nh; q++) {
      const f = (q + 0.7) / (nh + 0.4), y0 = h * (1 - f);
      it.push({ k: 'ink', P: seg2(S(i + 0.12, j + d, y0), S(i + w * 0.62, j + d, Math.max(0, y0 - 0.55)), 4), w: 2.2, seed: sd + 5 + q, taper: 6 });
    }
    if (h0 > 2.4) for (let q = 0; q < Math.min(4, Math.floor(h - 0.6)); q++) {
      it.push({ k: 'ink', P: seg2(S(i + w, j + d * 0.3, h - 0.7 - q), S(i + w, j + d * 0.72, h - 0.7 - q), 3), w: 3, seed: sd + 30 + q, taper: 3 });
    }
  });
  it.push(...arrow([[168, 30], [196, -30], [176, -96]], 190));
  return it;
}

// ---------------------------------------------------------------------------------------------------------------------
// 10 Synthwave: the striped sun, the grid, the chrome title. Alive, the grid runs toward us and the title glints.

function synth(t, alive) {
  const it = [], HZ = 44, SX = 0, SY = -26, R = 98;
  const a0 = Math.asin((HZ - SY) / R);
  const arc = [];
  for (let i = 0; i <= 40; i++) { const a = Math.PI - a0 + ((Math.PI + 2 * a0) * i) / 40; arc.push([SX + R * Math.cos(a), SY + R * Math.sin(a)]); }
  // the rough, in red pencil: a horizon, a ball, a slab for the title
  it.push({ k: 'ink', P: seg2([-HW + 14, HZ - 5], [HW - 12, HZ + 6], 6), w: 3.2, seed: 195, red: true, rough: 4, under: true });
  it.push({ k: 'ink', P: ring(SX + 4, SY + 4, R + 7, R + 5, 2.4, 0.5, 6), w: 3.2, seed: 196, red: true, rough: 5, under: true });
  it.push({ k: 'ink', P: poly([[-196, -18], [200, -26], [204, 38], [-192, 44]], true, 6), w: 3.2, seed: 197, red: true, rough: 5, under: true });
  it.push({ k: 'fill', P: poly(arc, true, 8), color: YEL, seed: 200 });
  it.push({ k: 'ink', P: path(arc, 5), w: 5, seed: 201, rough: 1.2 });
  // the sun's stripes (they slide down once it is alive)
  for (let q = 0; q < 3; q++) {
    const y = SY - 34 + ((q + (alive ? (t * 0.5) % 1 : 0.35)) * 26), hw = Math.sqrt(Math.max(0, R * R - (y - SY) * (y - SY)));
    if (hw > 20) it.push({ k: 'ink', P: seg2([SX - hw + 9, y], [SX + hw - 9, y], 5), w: 3 + q * 0.9, seed: 205 + q, rough: 0.8 });
  }
  // horizon and wireframe mountains
  it.push({ k: 'ink', P: seg2([-HW + 6, HZ], [HW - 6, HZ], 6), w: 4.4, seed: 210, rough: 1.4 });
  const mL = [[-248, 26], [-214, -18], [-186, 12], [-158, -34], [-126, 22], [-108, HZ]];
  const mR = [[108, HZ], [130, 14], [160, -26], [188, 16], [216, -10], [248, 28]];
  it.push({ k: 'ink', P: path(mL, 4), w: 4, seed: 211, rough: 1 }, { k: 'ink', P: path(mR, 4), w: 4, seed: 212, rough: 1 });
  for (const [p, b, sd] of [[mL[1], [-226, HZ], 213], [mL[3], [-170, HZ], 214], [mL[3], [-140, HZ], 215], [mR[2], [148, HZ], 216], [mR[2], [176, HZ], 217], [mR[4], [226, HZ], 218]]) {
    it.push({ k: 'ink', P: seg2(p, b, 4), w: 2.4, seed: sd, taper: 8 });
  }
  // the floor: lines to the vanishing point, and bars that come toward us
  for (let q = -4; q <= 4; q++) {
    const xb = q * 96, f = Math.min(1, (HW - 8) / Math.abs(xb || 1));
    const y1 = HZ + (HH - 6 - HZ) * (q ? f : 1);
    it.push({ k: 'ink', P: seg2([xb * 0.07, HZ + 4], [q ? Math.sign(xb) * Math.min(Math.abs(xb), HW - 8) : 0, y1], 5), w: 2.8, seed: 220 + q, rough: 0.7, taper: 10 });
  }
  for (let q = 0; q < 4; q++) {
    const f = (q + (alive ? (t * 1.0) % 1 : 0.5)) / 4, y = HZ + 6 + (HH - 14 - HZ) * Math.pow(f, 1.9);
    it.push({ k: 'ink', P: seg2([-HW + 8, y], [HW - 8, y], 6), w: 2 + 2.4 * f, seed: 230 + q, rough: 0.9 });
  }
  // a few stars
  [[-205, -108, 6], [-96, -118, 4], [118, -112, 5], [214, -84, 7], [-232, -62, 4]].forEach(([x, y, r], q) => {
    const tw = alive ? (Math.floor(t * 3 + q * 1.7) % 3 === 0 ? 1.7 : 1) : 1;
    it.push({ k: 'ink', P: seg2([x - r * tw, y], [x + r * tw, y], 2), w: 2.6, seed: 240 + q, taper: 3 }, { k: 'ink', P: seg2([x, y - r * tw], [x, y + r * tw], 2), w: 2.6, seed: 250 + q, taper: 3 });
  });
  // the title on its own strip of paper
  const TY = 30, bandP = poly([[-206, TY - 52], [208, TY - 58], [212, TY + 10], [-202, TY + 14]], true, 8);
  it.push({ k: 'mask', P: bandP, seed: 260 });
  it.push({ k: 'text', s: 'ALL OF THEM', x: 4, y: TY, u: 3.05, adv: 35.5, heavy: true, slant: 0.2, seed: 261, shadow: RED, pulse: alive ? 1 + 0.05 * Math.abs(Math.sin(Math.PI * t)) : 1 });
  // the glint
  const gk = alive ? [1, 1.5, 0.7, 1.2][Math.floor(t * 3) & 3] : 1, gx = alive ? -168 + 330 * ((t * 0.5) % 1) : -168;
  it.push({ k: 'fill', P: sparkle(gx, TY - 50, 22 * gk), color: YEL, seed: 270 });
  it.push({ k: 'ink', P: sparkle(gx, TY - 50, 22 * gk), w: 3, seed: 271, taper: 0 });
  return it;
}

// ---------------------------------------------------------------------------------------------------------------------
// 15 Variety Captions: a phone, and loud captions around it. Alive, the phone shakes and the captions bounce.

function phone(t, alive) {
  const it = [];
  const tk = Math.floor(t * 3);
  const shake = alive ? [0.1, 0.04, 0.12, 0.05][tk & 3] : 0.075, px = alive ? [0, 3, -2, 2][tk & 3] : 0, py = 2;
  // the rough, in red pencil: a slab for the phone, a blob for the burst, a line for the shout
  it.push({ k: 'ink', P: rrect(2, 2, 122, 214, 20, 0.05), w: 3.2, seed: 295, red: true, rough: 6, under: true });
  it.push({ k: 'ink', P: ring(152, 64, 58, 54, 1, 0.5, 6), w: 3.2, seed: 296, red: true, rough: 6, under: true });
  it.push({ k: 'ink', P: seg2([-240, -30], [-84, -66], 6), w: 3.2, seed: 297, red: true, rough: 4, under: true });
  // the burst behind
  const bk = alive ? [1, 1.12, 0.95, 1.08][tk & 3] : 1;
  it.push({ k: 'fill', P: burst(150, 62, 64 * bk, 40 * bk, 9, 300, alive ? tk * 0.13 : 0), color: YEL, seed: 300 });
  it.push({ k: 'ink', P: burst(150, 62, 64 * bk, 40 * bk, 9, 300, alive ? tk * 0.13 : 0), w: 4, seed: 301, taper: 0 });
  it.push({ k: 'text', s: '!', x: 150, y: 86, u: 3.9, heavy: true, seed: 302, rot: 0.12 });
  // the phone
  it.push({ k: 'mask', P: rrect(px, py, 112, 204, 18, shake) });
  it.push({ k: 'fill', P: rrect(px, py, 92, 168, 8, shake), color: RED, seed: 310, alpha: 0.92 });
  it.push({ k: 'ink', P: rrect(px, py, 112, 204, 18, shake), w: 5.2, seed: 311, rough: 0.8, taper: 0 });
  it.push({ k: 'ink', P: rrect(px, py, 92, 168, 8, shake), w: 3.2, seed: 312, rough: 0.6, taper: 0 });
  const c = Math.cos(shake), s = Math.sin(shake), R = (x, y) => [px + x * c - y * s, py + x * s + y * c];
  it.push({ k: 'ink', P: seg2(R(-12, -92), R(12, -92), 3), w: 3.6, seed: 313, taper: 2 });
  // on its screen: a play triangle and two caption bars
  it.push({ k: 'ink', P: poly([R(-14, -52), R(20, -30), R(-14, -8)], true, 4), w: 4, seed: 314 });
  it.push({ k: 'ink', P: seg2(R(-30, 30), R(30, 30), 4), w: 6.5, seed: 315, taper: 4 });
  it.push({ k: 'ink', P: seg2(R(-22, 52), R(22, 52), 4), w: 6.5, seed: 316, taper: 4 });
  // shake marks
  for (const sgn of [-1, 1]) for (let q = 0; q < 2; q++) {
    const x = sgn * (72 + q * 13), k = alive && ((tk + q) & 1) ? 1.25 : 1;
    it.push({ k: 'ink', P: smoothPath([R(x, -34 * k), R(x + sgn * 7, 0), R(x, 34 * k)], false, 4), w: 3, seed: 320 + q + (sgn > 0 ? 5 : 0), taper: 9 });
  }
  // captions
  const b1 = alive ? [0, -7, 0, 3][tk & 3] : 0;
  it.push({ k: 'text', s: 'WAIT—', x: -160, y: -44 + b1, u: 3.0, adv: 33, heavy: true, seed: 330, rot: -0.13, shadow: RED });
  it.push({ k: 'ink', P: smoothPath([[-236, -18 + b1], [-170, -30 + b1], [-92, -36 + b1]], false, 5), w: 4.4, seed: 331, taper: 12 });
  for (let q = 0; q < 3; q++) {
    const b = alive ? [0, -12, -3, 0][(tk + q * 3) & 3] : 0;
    it.push({ k: 'text', s: '?', x: 108 + q * 44, y: -52 + b + q * 4, u: 3.7, heavy: true, seed: 340 + q, rot: -0.2 + q * 0.2, shadow: q === 1 ? RED : null });
  }
  // sparkles and a sweat drop
  it.push({ k: 'ink', P: sparkle(-196, 66, alive ? [16, 22, 13, 19][tk & 3] : 16), w: 3, seed: 350, taper: 0 });
  it.push({ k: 'ink', P: sparkle(-128, 104, alive ? [11, 8, 14, 9][tk & 3] : 10), w: 2.6, seed: 351, taper: 0 });
  it.push({ k: 'ink', P: smoothPath([[-94, 44], [-106, 66], [-96, 76], [-86, 66], [-94, 44]], false, 3), w: 3, seed: 352, taper: 0 });
  return it;
}

export const SKETCH = [iso, synth, phone];

/** Total pen travel of a list of items, for drawing them in at an even speed. */
export function travel(items) {
  let s = 0;
  for (const it of items) {
    if (it.k === 'ink') { it.s0 = s; s += it.P.len; it.s1 = s; }
    else if (it.k === 'text') { it.s0 = s; s += it.s.length * (it.u || 3) * 14; it.s1 = s; }
    else { it.s0 = s; it.s1 = s; }
  }
  return s;
}
export { ring };
