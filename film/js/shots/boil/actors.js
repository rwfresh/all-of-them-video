// The cast of the Frame-by-Frame shot: the matchstick (the terminal's cursor), the flame spirit that jumps out of it,
// and the hand-drawn effects they throw off: smears, speed lines, sparks, star bursts, smoke that curls and breaks up.
// Poses are held for a drawing (on twos, or on ones in the air); nothing eases between drawings.
// F is one frame in beats; END is the shot's last beat, by which the effects are cleared and the flame has gathered itself.

import { ink, fill, path, ring, smoothPath, xf, xmul, xpt, hash, INK, RED, YEL, PAPER, GREY } from './ink.js';
import { sparkle, burst } from './panels.js';
import { clamp, lerp, smooth } from '../../util.js';

const UP = -Math.PI / 2;

export function makeActors({ T, PANELS, PH, DOCK, twos, cmdLen, F, END }) {
  const ones = (lb) => Math.floor(lb * 12 + 1e-6);
  const top = (i) => { const p = PANELS[i]; return [p.cx + Math.sin(p.rot) * PH * 0.5, p.cy - Math.cos(p.rot) * PH * 0.5 - 2]; };
  const cellX = (col) => DOCK.x + col * DOCK.adv + DOCK.adv / 2;
  const FOOT = DOCK.rowC + 3, TALL = 66;                 // the match at home: its foot, and how tall it stands
  const HOME = [cellX(2 + cmdLen), FOOT - TALL];         // its head, standing after the prompt that was just entered
  const S0 = [1716, 236], S1 = [984, 250];               // the swipe, above the frames: where the head starts and where it catches fire
  const KF = 1.25;                                       // the flame's full size
  const SMEAR2 = T.zip1 - 2 * F;                         // the sweep's smear: the two frames before the row is clear
  const TOP = 58;                                        // nothing thrown off by an effect goes above this (title-safe)

  // ---- the match ----
  /** Where the match is while it is away from the row: { hx, hy (its head), dir (foot to head), s, burnt, sq, smear }. */
  function matchPose(L) {
    if (L < T.jump) return { hx: HOME[0], hy: HOME[1] + 16, dir: UP, s: 1, sq: 0.74 };
    if (L < T.smear) {
      const i = ones(L) - ones(T.jump), u = Math.min(1, (i + 0.7) / 4.9);
      return { hx: lerp(HOME[0], S0[0], u), hy: lerp(HOME[1], S0[1], u) - 4 * 96 * u * (1 - u), dir: lerp(UP, -Math.PI - 0.4, smooth(u)), s: lerp(1.1, 2.4, u), sq: i === 0 ? 1.3 : 1 };
    }
    // the swipe: one drawing, two frames long, the match pulled to two and a half times its length along its path
    if (L < T.strike) return { smear: [S1[0] + 124 + TALL * 2.4 * 2.5, S1[1] - 9, S1[0] + 124, S1[1] - 2], back: (S0[0] - S1[0] - 124) / (TALL * 2.4 * 2.5) - 1, s: 2.4 };
    if (L < T.leap) {
      const i = twos(L) - twos(T.strike);
      return [
        { hx: 952, hy: 248, dir: -Math.PI - 0.24, s: 2.4 },
        { hx: 930, hy: 228, dir: -Math.PI + 0.42, s: 2.3 },
        { hx: 922, hy: 214, dir: UP - 0.5, s: 2.2 },
      ][Math.min(2, i)];
    }
    if (L < T.leap + 1 / 6) return { hx: 926, hy: 238, dir: UP - 0.2, s: 2.2, burnt: true, sq: 0.84 };
    if (L < T.hop) return { hx: 922, hy: 218, dir: UP - 0.34, s: 2.2, burnt: true };
    if (L < T.hop + 0.5) {
      const i = twos(L) - twos(T.hop), u = (i + 0.75) / 3.5;
      return { hx: lerp(922, HOME[0], u), hy: lerp(218, HOME[1], u * u) - 4 * 30 * u * (1 - u), dir: UP - 0.34 + (0.34 + Math.PI * 2) * u, s: lerp(2.2, 1.05, u), burnt: true };
    }
    if (L < T.back) return { hx: HOME[0], hy: HOME[1] + 15, dir: UP, s: 1, burnt: true, sq: 0.75 };
    if (L >= T.zip0 && L < SMEAR2) return { hx: HOME[0] + 20, hy: HOME[1] + 12, dir: UP + 0.5, s: 1, burnt: true, sq: 0.82 };
    if (L >= SMEAR2 && L < T.zip1) return { smear: [cellX(2) + TALL * 2.8, FOOT - 23, cellX(2) - 4, FOOT - 26], back: (HOME[0] - cellX(2)) / (TALL * 2.8) - 1, row: true, s: 1, burnt: true };
    return null;
  }

  /** The match, drawn from its head back along dir. */
  function drawMatch(g, p, v, o = {}) {
    const s = p.s, len = TALL * s * (p.sq || 1) * 0.82, c = Math.cos(p.dir), sn = Math.sin(p.dir);
    const wide = p.sq ? 1 / Math.sqrt(p.sq) : 1;
    const hx = p.hx, hy = p.hy, bx = hx - len * c, by = hy - len * sn, w = 6.2 * Math.pow(s, 0.8) * wide;
    const stick = path([[bx, by], [hx - 7 * s * c, hy - 7 * s * sn]], 4);
    ink(g, stick, { w, seed: 601, v, boil: 0.5 * s, color: YEL, taper: 0, tf: [1, 0, 0, 1, 3.4 * s, 2 * s] });
    ink(g, stick, { w, seed: 602, v, boil: 0.5 * s, taper: 0 });
    const k = (o.pulse || 1) * (p.burnt ? 0.82 : 1);
    const head = ring(0, 0, 8.8 * s * k * wide, 11.8 * s * k / wide, -2, 0.5, 2.5), tf = xf(hx, hy, p.dir - UP);
    fill(g, head, { color: p.burnt ? INK : RED, seed: 603, v, boil: 0.5, tf, dx: p.burnt ? 0 : 1.6 * s, dy: p.burnt ? 0 : 1.2 * s });
    ink(g, head, { w: 3.4 * Math.pow(s, 0.7), seed: 604, v, boil: 0.5, tf, taper: 0 });
    if (p.burnt) {
      if (o.lit !== false) {                              // the ember, and a thread of smoke
        fill(g, ring(0, -2 * s, 3.4 * s, 3.8 * s, 0, 0.4, 1.5), { color: RED, seed: 605, v, boil: 0.3, tf });
        fill(g, ring(0, -2.4 * s, 1.5 * s, 1.7 * s, 0, 0.4, 1), { color: YEL, seed: 606, v, boil: 0.2, tf });
      }
      const n = o.n || 0, tx = hx + 12 * s * c, ty = hy + 12 * s * sn, q = (j) => (hash(n * 1.7 + j * 3.1) - 0.5) * 12 * s;
      if (!o.noSmoke) ink(g, smoothPath([[tx, ty - 3 * s], [tx + q(1), ty - 13 * s], [tx + q(2), ty - 23 * s], [tx + q(3) * 1.3, ty - 33 * s]], false, 3), { w: 2.6 * Math.sqrt(s), seed: 607, v, color: GREY, dry: 0.12, taper: 10, boil: 0.6 });
    }
  }

  /** A smear: for one drawing the match is stretched along its path; speed lines run `back` smear-lengths behind it. */
  function drawSmear(g, [x0, y0, x1, y1], s, v, burnt, back = 0) {
    const dx = x1 - x0, dy = y1 - y0, D = Math.hypot(dx, dy), ux = dx / D, uy = dy / D, nx = -uy, ny = ux;
    const P = (t, off = 0) => [x0 + dx * t + nx * off, y0 + dy * t + ny * off];
    // the stick, pulled long and thin
    ink(g, path([P(0), P(0.62)], 8), { w: 3.6 * s, seed: 611, v, boil: 1, color: YEL, taper: D * 0.3, tf: [1, 0, 0, 1, 2.4 * s, 2 * s] });
    ink(g, path([P(0.04), P(0.64)], 8), { w: 3.4 * s, seed: 612, v, boil: 1, taper: D * 0.34 });
    // the head, a long drop
    const hw = 8.5 * s, drop = smoothPath([P(1, 0), P(0.985, -hw * 0.8), P(0.9, -hw), P(0.74, -hw * 0.5), P(0.56, 0), P(0.74, hw * 0.5), P(0.9, hw), P(0.985, hw * 0.8)], true, 5);
    fill(g, drop, { color: burnt ? INK : RED, seed: 613, v, boil: 1, dx: burnt ? 0 : 2 * s, dy: burnt ? 0 : 1.6 * s });
    ink(g, drop, { w: 2.6 * Math.sqrt(s) * 1.2, seed: 614, v, boil: 0.8, taper: 0 });
    // speed lines either side
    [[-2.3, 0.02, 0.5], [-3.6, 0.2, 0.86], [2.2, 0.08, 0.6], [3.5, 0.3, 0.94], [-4.8, 0.5, 0.78], [4.7, 0.12, 0.44]].forEach(([o, a, b], i) => {
      ink(g, path([P(a, o * hw * 0.8), P(b, o * hw * 0.8)], 8), { w: (i < 4 ? 3.4 : 2.4) * Math.sqrt(s), seed: 615 + i, v, boil: 1.2, taper: D * 0.16 });
    });
    if (back > 0) [[-1.5, 0.96, 0.06], [1.7, 0.8, 0.22], [-3.3, 0.6, 0.3], [3.2, 0.42, 0.12], [-0.3, 1, 0.02]].forEach(([o, a, b], i) => {
      ink(g, path([P(-a * back, o * hw * 0.8), P(b, o * hw * 0.8)], 8), { w: (i < 2 ? 3.2 : 2.4) * Math.sqrt(s), seed: 625 + i, v, boil: 1.2, taper: D * 0.3 });
    });
  }

  // ---- the flame spirit ----
  const FH = 70;                                          // from its feet to its middle, at full size
  function flameShape(n, wild = 1, sway = 0, tuck = 0) {
    const a = (hash(n * 1.31 + 2) - 0.5) * wild, b = (hash(n * 2.17 + 5) - 0.5) * wild, c = (hash(n * 3.03 + 9) - 0.5) * wild;
    const tx = a * 24 + sway, ty = b * 12, s1 = sway * 0.22, s2 = sway * 0.5;
    const pts = [
      [0, -1], [27, -4], [45, -28], [48, -62], [39 + s1, -90 + c * 6], [24 + b * 10 + s2, -110], [15 + a * 6 + s2 * 1.4, -129], [6 + tx, -155 + ty], [5 + tx, -156 + ty],
      [-7 + tx * 0.4 + s2, -128], [-20 - c * 10 + s2, -108], [-37 + s1, -88 - a * 6], [-48, -60], [-45, -28], [-27, -4],
    ];
    // gathered: the tip is drawn down into the body, which rounds out toward a ball
    if (tuck > 0) for (const p of pts) { if (p[1] < -62) { p[1] = -62 + (p[1] + 62) * (1 - 0.56 * tuck); p[0] *= 1 + 0.42 * tuck * Math.min(1, (-62 - p[1]) / 40); } }
    return pts;
  }
  /**
   * Draw the flame through transform M (its own units: feet at 0,0, head up).
   * k: size, for line weights. o: { n (flicker), arms, eyes, mouth, legs, look }
   */
  function drawFlame(g, M, k, v, o = {}) {
    const n = o.n || 0, kk = Math.max(0.5, Math.sqrt(k)), tuck = o.tuck || 0, shape = flameShape(n, o.wild ?? 1, o.sway || 0, tuck);
    const body = smoothPath(shape, true, 5);
    const inner = smoothPath(flameShape(n + 31, 1.3 * (o.wild ?? 1), (o.sway || 0) * 0.8, tuck).map(([x, y]) => [x * 0.55, (y + 12) * 0.56 - 18]), true, 5);
    const lw = 5.4 * kk;
    // arms and legs behind the body
    const arm = { up: [[42, -50], [64, -62], [74, -90]], out: [[44, -52], [66, -56], [82, -66]], down: [[44, -50], [60, -38], [63, -22]], back: [[42, -54], [60, -44], [76, -48]] }[o.arms === 'in' ? '' : o.arms || 'down'];
    if (arm && k > 0.5) for (const sg of [-1, 1]) ink(g, smoothPath(arm.map(([x, y]) => [x * sg, y]), false, 4), { w: lw * 1.5, seed: 720 + sg, v, tf: M, taper: 4, boil: 1, press: 0.5 });
    if (o.legs === 'stand') for (const sg of [-1, 1]) ink(g, path([[13 * sg, -6], [15 * sg, 9], [26 * sg, 10]], 3), { w: lw * 0.9, seed: 724 + sg, v, tf: M, taper: 3, boil: 0.7 });
    if (o.legs === 'air') for (const sg of [-1, 1]) ink(g, smoothPath([[12 * sg, -6], [16 * sg, 10], [10 * sg, 24]], false, 3), { w: lw * 0.9, seed: 726 + sg, v, tf: M, taper: 4, boil: 0.7 });
    fill(g, body, { color: PAPER, tf: M, boil: 0 });
    g.save(); g.globalCompositeOperation = 'multiply';
    fill(g, body, { color: RED, tf: M, v, seed: 700, boil: 1.6, dx: 6 * kk, dy: 5 * kk });
    g.restore();
    fill(g, inner, { color: YEL, tf: M, v, seed: 701, boil: 1.6, dx: 3 * kk, dy: 2 * kk });
    ink(g, body, { w: lw, tf: M, v, seed: 702, boil: 1.2, taper: 0 });
    if (k < 0.42) return;
    // the face
    const lx = (o.look || 0) * 4;
    for (const sg of [-1, 1]) {
      const ex = 15 * sg + lx, ey = -60;
      if (o.eyes === 'closed') ink(g, smoothPath([[ex - 7, ey + 2], [ex, ey - 5], [ex + 7, ey + 2]], false, 2), { w: lw * 0.7, seed: 710 + sg, v, tf: M, taper: 2, boil: 0.5 });
      else fill(g, ring(ex, ey, o.eyes === 'wide' ? 6.6 : 5.6, o.eyes === 'wide' ? 10 : 8.4, 0, 0.3, 2), { color: INK, seed: 712 + sg, v, boil: 0.5, tf: M });
    }
    if (o.mouth === 'open') fill(g, ring(lx, -38, 7, 8.5, 0, 0.3, 2), { color: INK, seed: 716, v, boil: 0.5, tf: M });
    else if (o.mouth === 'happy') fill(g, smoothPath([[-12 + lx, -43], [lx, -44.5], [12 + lx, -43], [9 + lx, -33], [lx, -28], [-9 + lx, -33]], true, 2), { color: INK, seed: 718, v, boil: 0.5, tf: M });
    else ink(g, smoothPath([[-9 + lx, -41], [lx, -34], [9 + lx, -41]], false, 2), { w: lw * 0.62, seed: 717, v, tf: M, taper: 2, boil: 0.5 });
  }

  // the jumps: [leaves, lands, from, to, how high above the straight path]
  const SPOT = [top(0), top(1), top(2)];
  const LAST = [SPOT[1][0], SPOT[1][1]];
  const JUMPS = [
    { t0: T.leap, t1: T.land[0], a: [910, 196], b: SPOT[0], h: 34, k0: 0.7 },
    { t0: T.land[0] + 0.5, t1: T.land[1], a: SPOT[0], b: SPOT[1], h: 66 },
    { t0: T.land[1] + 0.5, t1: T.land[2], a: SPOT[1], b: SPOT[2], h: 104 },
    { t0: T.burst0, t1: T.burst, a: SPOT[2], b: LAST, h: 128, flip: true },
  ];
  /** The flame at beat L: null before it exists; { M, k, cx, cy, ... } after. */
  function flamePose(L) {
    if (L < T.strike) return null;
    const q = twos(L);
    const grounded = (x, y, sx, sy, k, extra) => ({ x, y, k, cx: x, cy: y - FH * k * sy, M: xf(x, y, extra.rot || 0, k * sx, k * sy), n: q, legs: 'stand', ...extra });
    if (L < T.leap) {
      const i = q - twos(T.strike), m = matchPose(L), k = [0.34, 0.54, 0.7][Math.min(2, i)];
      const c = Math.cos(m.dir), s = Math.sin(m.dir);
      return grounded(m.hx + 10 * m.s * c, m.hy + 10 * m.s * s, i === 2 ? 1.3 : 1, i === 2 ? 0.66 : 1, k, { legs: 'none', arms: i === 2 ? 'out' : null, eyes: i === 2 ? 'closed' : 'open', wild: 1.6 });
    }
    for (let j = 0; j < JUMPS.length; j++) {
      const J = JUMPS[j];
      if (L >= J.t0 && L < J.t1) {
        const N = Math.round((J.t1 - J.t0) * 12), i = ones(L) - ones(J.t0), s = (i + 0.6) / (N + 0.2);
        const x = lerp(J.a[0], J.b[0], s), y = lerp(J.a[1], J.b[1], s) - 4 * J.h * s * (1 - s);
        const vx = J.b[0] - J.a[0], vy = J.b[1] - J.a[1] - 4 * J.h * (1 - 2 * s);
        const k = J.k0 ? lerp(J.k0, KF, s) : KF, lean = Math.atan2(vx, -vy);
        const rot = J.flip ? -Math.PI * 2 * smooth(s) : -clamp(lean, -0.5, 0.5) * 0.5;      // it leans back a little; its tip trails
        const st = J.flip ? 1.12 : i === 0 ? 1.36 : 1.2;
        const cx = x, cy = y - FH * k;
        return { x, y, k, cx, cy, air: true, s, vx, vy, n: ones(L), legs: 'air', arms: J.flip ? 'up' : 'back', eyes: 'wide', mouth: 'open', look: Math.sign(vx) * (J.flip ? 0 : 1),
          M: xmul(xf(cx, cy, rot, k / Math.sqrt(st), k * st), xf(0, FH)), trail: J, wild: 1.5, sway: J.flip ? 0 : -Math.sign(vx) * 34 };
      }
    }
    // standing on a frame
    let i = 0;
    while (i < 2 && L >= T.land[i + 1]) i++;
    if (L >= T.burst) {
      const d = q - twos(T.burst), [x, y] = LAST;
      if (d === 0) return grounded(x, y, 1.3, 0.68, KF, { arms: 'out', eyes: 'closed', mouth: 'open' });
      if (d === 1) return grounded(x, y, 0.82, 1.3, KF, { arms: 'up', eyes: 'wide', mouth: 'open' });
      if (d === 2) return grounded(x, y, 0.95, 1.08, KF, { arms: 'up', eyes: 'open', mouth: 'open' });
      // the last half-beat: it gathers itself, a small rise and then a crouch, tip tucked in, so it can be pressed into a disc
      if (L >= END - 0.5) {
        const st = L >= END ? 4 : L >= END - 2 * F ? 3 : Math.min(2, Math.floor((L - (END - 0.5)) * 6 + 1e-6));
        const [sx, sy, tuck, wild, arms] = [[0.95, 1.07, 0, 0.6, 'down'], [1.12, 0.84, 0.45, 0.4, 'in'], [1.22, 0.72, 0.8, 0.2, 'in'], [1.27, 0.67, 1, 0, 'in'], [1.27, 0.67, 1, 0, 'in']][st];
        return grounded(x, y, sx, sy, KF, { arms, eyes: st ? 'closed' : 'open', mouth: st ? 'smile' : 'happy', tuck, wild, n: 7, look: 0 });
      }
      // ta-da, and a small bounce on every beat to stay alive
      const b = L - Math.floor(L), dn = L >= T.hold ? b < 0.25 : b < 1 / 6, up = !dn && b < 0.5;
      return grounded(x, y, dn ? 1.07 : up ? 0.97 : 1, dn ? 0.9 : up ? 1.05 : 1, KF, { arms: 'up', eyes: Math.floor(L) % 3 === 2 && b > 0.5 && b < 0.75 ? 'closed' : 'open', mouth: 'happy', n: L >= T.hold ? Math.floor(L * 4) : q, look: 0 });
    }
    const [x, y] = SPOT[i], d = q - twos(T.land[i]);
    if (d === 0) return grounded(x, y, 1.4, 0.58, KF, { arms: 'out', eyes: 'closed' });
    if (d === 1) return grounded(x, y, 0.86, 1.2, KF, { arms: 'up', eyes: 'open', mouth: 'open' });
    if (i < 2) return grounded(x, y, 1.26, 0.74, KF, { arms: 'back', eyes: 'open', look: 1 });       // crouch for the next hop
    if (L >= T.burst0 - 1 / 3) return grounded(x + (d % 2 ? 3 : -3), y, 1.44, 0.56, KF, { arms: 'back', eyes: 'closed', look: -1 });   // the big crouch
    if (d === 2) return grounded(x, y, 1, 1, KF, { arms: 'down', eyes: 'open' });
    // a little dance on the last frame: lean one way, then the other, on every half-beat
    const h = Math.floor((L - T.land[2]) * 2), ph = q - twos(T.land[2] + h * 0.5), side = h % 2 ? 1 : -1;
    const pose = [[1.12, 0.88, 0.16, 'out'], [0.92, 1.1, 0.08, 'up'], [1, 1, 0.04, 'up']][Math.min(2, ph)];
    return grounded(x, y, pose[0], pose[1], KF, { rot: pose[2] * side, arms: pose[3], eyes: ph === 0 ? 'closed' : 'open', mouth: ph === 0 ? 'smile' : 'happy', look: side });
  }

  // ---- effects ----
  /** A cartoon smoke puff: a scalloped cloud with a curl inside. age in drawings; it drifts, turns and breaks up. */
  function puff(g, x, y, R, age, life, seed, v, rot = 0) {
    if (age < 0 || age >= life) return;
    const u = age / life, r = R * (age === 0 ? 0.6 : 1 - 0.55 * u * u), bumps = 5 + (Math.floor(seed) % 2), pts = [];
    for (let i = 0; i < bumps * 7; i++) {
      const a = rot + (i / (bumps * 7)) * Math.PI * 2, q = r * (0.7 + 0.36 * Math.pow(Math.abs(Math.sin((a - rot) * bumps * 0.5 + seed)), 0.6));
      pts.push([x + q * Math.cos(a) * 1.12, y + q * Math.sin(a) * 0.88]);
    }
    const P = smoothPath(pts, true, 4), dry = u > 0.55 ? (u - 0.45) * 0.9 : 0;
    if (u < 0.75) fill(g, P, { color: PAPER, boil: 0 });
    ink(g, P, { w: 4, seed, v, boil: 1.3, taper: 0, dry });
    if (u < 0.6) {
      const c = [];
      for (let i = 0; i < 8; i++) { const a = rot + 0.8 + i * 0.7, q = r * (0.12 + i * 0.06); c.push([x + q * Math.cos(a), y + q * Math.sin(a) * 0.9]); }
      ink(g, smoothPath(c, false, 3), { w: 3, seed: seed + 1, v, boil: 0.8, taper: 8 });
    }
  }
  /** A spark: a small star thrown out along an arc, twinkling as it goes. */
  function spark(g, x, y, ang, speed, age, life, seed, v, size = 1) {
    if (age < 0 || age >= life) return;
    const t = age + 0.6, d = speed * (1 - Math.pow(0.72, t)) * 3.2;
    const px = x + Math.cos(ang) * d, py = y + Math.sin(ang) * d + 2.2 * t * t;
    if (py < TOP + 14) return;                                      // burnt out before it leaves the page
    const big = (age + Math.floor(seed)) % 2 === 0, R = (big ? 15 : 9) * size * (1 - 0.5 * (age / life));
    if (big) { fill(g, sparkle(px, py, R, R * 0.3, ang), { color: YEL, seed, v, boil: 0.6, dx: 2, dy: 2 }); ink(g, sparkle(px, py, R, R * 0.3, ang), { w: 2.8, seed, v, boil: 0.5, taper: 0 }); }
    else { ink(g, path([[px - R, py], [px + R, py]], 2), { w: 3, seed, v, taper: 3 }); ink(g, path([[px, py - R], [px, py + R]], 2), { w: 3, seed: seed + 1, v, taper: 3 }); }
  }
  /** Short lines thrown out from a point: impact. */
  function rays(g, x, y, r0, r1, n, seed, v, a0 = 0, a1 = Math.PI * 2, w = 4) {
    for (let i = 0; i < n; i++) {
      const a = a0 + ((i + 0.5 + (hash(seed + i) - 0.5) * 0.5) / n) * (a1 - a0), k = 0.75 + 0.5 * hash(seed + i * 3.3);
      ink(g, path([[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * (r0 + (r1 - r0) * k), y + Math.sin(a) * (r0 + (r1 - r0) * k)]], 5), { w: w * (0.7 + 0.5 * hash(seed + i * 5.1)), seed: seed + i, v, taper: (r1 - r0) * 0.45, boil: 1 });
    }
  }
  /**
   * The rays of a burst: from one ellipse out to another (a flash wider than tall), so that none leaves the top of the
   * page. A ray that would end above TOP is shortened to it; one that would cross the style tag is left out.
   */
  function flash(g, x, y, [ax, ay], [bx, by], n, seed, v, a0, a1, w = 4.6) {
    for (let i = 0; i < n; i++) {
      const a = a0 + ((i + 0.5 + (hash(seed + i) - 0.5) * 0.5) / n) * (a1 - a0), k = 0.6 + 0.4 * hash(seed + i * 3.3);
      const c = Math.cos(a), sn = Math.sin(a), p0 = [x + c * ax, y + sn * ay];
      let p1 = [x + c * (ax + (bx - ax) * k), y + sn * (ay + (by - ay) * k)];
      if (p1[1] < TOP) { const f = (p0[1] - TOP) / (p0[1] - p1[1]); p1 = [lerp(p0[0], p1[0], f), TOP]; }
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      if (p0[1] < TOP + 6 || len < 16 || (p1[0] < 760 && p1[1] < 140)) continue;
      ink(g, path([p0, p1], 5), { w: w * (0.7 + 0.5 * hash(seed + i * 5.1)), seed: seed + i, v, taper: len * 0.45, boil: 1 });
    }
  }
  /** A star burst: yellow off register under an inked zigzag. ky < 1: wider than tall. */
  function star(g, x, y, R, r, n, seed, v, rot = 0, inked = true, solid = false, ky = 1) {
    const P = burst(x, y, R, r, n, seed, rot, ky);
    if (solid) fill(g, P, { color: PAPER, boil: 0 });              // in front of the drawing behind it, not printed over it
    g.save(); g.globalCompositeOperation = 'multiply';
    fill(g, P, { color: YEL, seed, v, boil: 2, dx: 7, dy: 6 });
    g.restore();
    if (inked) ink(g, P, { w: 5, seed: seed + 1, v, boil: 1.4, taper: 0 });
  }

  const R = (n) => hash(n * 7.77 + 1.3);
  const SPARKS = Array.from({ length: 14 }, (_, i) => ({ a: -Math.PI * 0.5 + (i - 6.5) * 0.42 + (R(i) - 0.5) * 0.3, sp: 62 + R(i + 20) * 60, life: 5 + Math.floor(R(i + 40) * 5), size: 0.9 + R(i + 60) * 0.6 }));
  const PUFFS = [[-150, 30, 46, -1], [150, 26, 50, 1], [-112, -58, 38, -1], [116, -66, 42, 1], [-196, -14, 34, -1], [204, -20, 36, 1], [-30, -82, 30, 1]];
  const TWINK = [[-150, -140, 26], [196, -128, 30], [-126, -14, 17], [152, -2, 19], [-262, -64, 15], [290, -52, 17], [74, -158, 16]];

  function draw(g, env, L, v) {
    const q = twos(L);
    const m = L >= T.go && L < T.zip1 ? matchPose(L) : null;
    const f = flamePose(L);

    // ---- the strike: the mark it leaves, the flash, the sparks ----
    const ds = q - twos(T.strike) + 1;
    if (L >= T.smear && ds < 7) {
      const y = S1[1] + 24, sc = smoothPath([[S0[0] - 30, y - 10], [1440, y + 2], [1180, y - 4], [S1[0] + 60, y + 4]], false, 6);
      ink(g, sc, { w: 9, seed: 640, v, color: GREY, dry: 0.5 + ds * 0.06, boil: 0.8, taper: 60, alpha: 0.5 * (1 - ds / 8) });
      ink(g, sc, { w: 3, seed: 641, v, color: GREY, dry: 0.3, boil: 1.6, rough: 3, taper: 60, alpha: 0.7 * (1 - ds / 8) });
    }
    const df = q - twos(T.strike);
    if (df === 0) star(g, 950, 238, 128, 66, 10, 650, v, 0.2);
    if (df === 1) star(g, 932, 216, 92, 54, 9, 652, v, 0.5, false);
    if (df >= 0 && df < 6) for (let i = 0; i < 8; i++) spark(g, 950, 238, -2.9 + i * 0.5, 36 + R(i + 80) * 46, df, 3 + (i % 4), 660 + i * 2, v, 0.9);
    if (df === 0) flash(g, 950, 238, [146, 146], [214, 238 - TOP], 12, 680, v, -3.5, 0.36, 4.4);

    // ---- the match, while it is away from the row ----
    if (m) {
      if (m.smear) {
        drawSmear(g, m.smear, m.s, v, m.burnt, m.back);
      } else drawMatch(g, m, v, { n: q, lit: true });
    }
    // dust where the old prompt was swept away
    const dz = q - twos(T.zip1);
    if (dz >= 0 && dz < 6 && L >= T.zip1) for (let i = 0; i < 3; i++) puff(g, 700 - i * 180 + dz * 7, FOOT - 36 - dz * 8, 31 - i * 3, dz, 5 + (i % 2), 690 + i, v, dz * 0.4);

    if (!f) return;
    // ---- landings: a few lines of impact and a pop ----
    T.land.forEach((at, i) => {
      const d = q - twos(at);
      if (L < at || d > 2) return;
      const [x, y] = SPOT[i];
      if (d === 0) { rays(g, x, y - 6, 74, 122, 5, 730 + i * 9, v, Math.PI * 1.08, Math.PI * 1.42, 4.4); rays(g, x, y - 6, 74, 122, 5, 735 + i * 9, v, -Math.PI * 0.42, -Math.PI * 0.08, 4.4); }
      for (let j = 0; j < 4; j++) spark(g, x + (j < 2 ? -50 : 50), y - 30, j < 2 ? -2.5 - j * 0.4 : -0.64 + (j - 2) * 0.4, 30 + j * 6, d, 3, 740 + i * 9 + j, v, 0.8);
    });

    // ---- the burst (behind the flame) ----
    const db = q - twos(T.burst), [bx, by] = [LAST[0], LAST[1] - FH * KF];
    if (L >= T.burst) {
      // a flash wider than tall, so the whole of it stays on the page under the peg holes
      if (db === 0) { star(g, bx, by, 190, 110, 13, 800, v, 0.1, true, true, 0.74); flash(g, bx, by, [238, 168], [356, by - TOP], 21, 810, v, -Math.PI * 1.05, Math.PI * 0.05, 5.4); }
      if (db === 1) { star(g, bx, by, 154, 98, 12, 802, v, 0.34, false, true, 0.8); flash(g, bx, by, [272, 172], [372, by - TOP], 15, 830, v, -Math.PI * 1.04, Math.PI * 0.04, 4); }
      PUFFS.forEach(([dx, dy, r, dir], i) => {
        const a = db - 1 - (i > 3 ? 1 : 0), u = 1 - Math.pow(0.74, Math.max(0, a));
        puff(g, bx + dx * (1 + 0.85 * u), by + dy * (1 + 0.7 * u) - a * 3, r, a, 6 + (i % 3), 850 + i * 3, v, dir * a * 0.35);      // all gone a third of a beat before the end
      });
    }

    // ---- speed lines behind a jump ----
    if (f.air) {
      const J = f.trail;
      for (let i = 0; i < 3; i++) {
        const s1 = f.s - 0.1 - i * 0.03, s0 = s1 - 0.3 + i * 0.07, off = (i - 1) * 30 * f.k;
        if (s1 <= 0.02) continue;
        const pt = (s) => { const ss = Math.max(0, s); return [lerp(J.a[0], J.b[0], ss) + off * 0.3, lerp(J.a[1], J.b[1], ss) - 4 * J.h * ss * (1 - ss) - FH * f.k + off]; };
        ink(g, smoothPath([pt(s0), pt((s0 + s1) / 2), pt(s1)], false, 6), { w: 3.6, seed: 760 + i, v, taper: 40, boil: 1.2 });
      }
    }

    drawFlame(g, f.M, f.k, v, f);

    // ---- the burst (in front): sparks, and the sparkles that stay ----
    if (L >= T.burst) {
      SPARKS.forEach((s, i) => spark(g, bx + Math.cos(s.a) * 110, by + Math.sin(s.a) * 100, s.a, s.sp * 0.8, db, s.life, 870 + i * 2, v, s.size));
      const th = L >= T.hold ? Math.floor(L * 4) : q;
      TWINK.forEach(([dx, dy, r], i) => {
        if (db < 2 + (i % 3) || L >= END - 0.75 + 0.25 * (i % 2)) return;       // they go out, some a drawing before the others
        const k = [1, 0.62, 0.86, 0.5][(th + i * 3) & 3], P = sparkle(bx + dx, by + dy, r * k, r * k * 0.26, (i % 2) * 0.5);
        if (i < 4) fill(g, P, { color: YEL, seed: 900 + i, v, boil: 0.6, dx: 3, dy: 3 });
        ink(g, P, { w: i < 4 ? 3.4 : 2.8, seed: 910 + i, v, boil: 0.6, taper: 0 });
      });
    }
  }

  return {
    draw, flamePose,
    /** The flame's middle and size, for the shot that follows. Before there is a flame: where it will end. */
    flameAt(L) { const f = flamePose(L); return f ? { x: f.cx, y: f.cy, r: 64 * f.k } : { x: LAST[0], y: LAST[1] - FH * KF, r: 64 * KF }; },
    /** The column the match stands in on the prompt row, or null while it is off in the picture. */
    matchHome(env) {
      const lb = env.lb, c = env.term.rowC;
      if (c.mode === 'cmd') {
        if (lb < T.go) return { col: 2 + c.text.length, burnt: false };
        if (lb >= T.back && lb < T.zip0) return { col: 2 + c.text.length, burnt: true };
        return null;
      }
      if (c.mode === 'typing' && c.cursor) return { col: 2 + c.n, burnt: lb >= T.zip1, settle: lb >= T.zip1 ? twos(lb) - twos(T.zip1) : 9, key: c.n ? c.keyAge(c.n - 1) : 9 };
      return null;
    },
    /** How many letters of the old prompt are still on the row (the match sweeps them all off in one drawing). */
    swept: (lb, n) => (lb >= SMEAR2 ? 0 : n),
    matchAtHome(g, home, env, v) {
      const lean = home.settle !== undefined ? [-0.34, 0.16, -0.06][home.settle] || 0 : 0;
      const hopped = home.key !== undefined && home.key < 1 / 12 ? 7 : 0;      // a small hop with every key
      const x = cellX(home.col), p = { hx: x + Math.sin(lean) * TALL, hy: FOOT - TALL * Math.cos(lean) - hopped, dir: UP + lean, s: 1, burnt: home.burnt };
      drawMatch(g, p, v, { n: twos(Math.min(env.lb, END - 1 / 3)), lit: env.term.blink, pulse: !home.burnt && env.term.blink ? 1.16 : 1, noSmoke: env.lb >= END - 1 / 3 });
    },
    sfx: [
      ...T.sheets.map((b, i) => ({ b, s: 'boil_paper', g: [0.9, 0.7, 0.75, 0.7][i] })),
      { b: T.board, s: 'boil_flip', g: 0.9, a: 'peak' },
      { b: T.panel[0], s: 'boil_scribble', g: 0.7 }, { b: T.panel[1], s: 'boil_scribble', g: 0.7 }, { b: T.panel[2], s: 'boil_scribble', g: 0.7 },
      { b: T.strike, s: 'boil_strike', g: 1, a: 'peak' },
      { b: T.leap, s: 'boil_boing', g: 0.7 },
      { b: T.land[0], s: 'boil_pop', g: 0.9, a: 'peak' }, { b: T.land[1], s: 'boil_pop', g: 0.9, a: 'peak' }, { b: T.land[2], s: 'boil_pop', g: 0.95, a: 'peak' },
      { b: T.zip1 - 1 / 12, s: 'boil_zip', g: 0.6 },
      { b: T.burst, s: 'boil_burst', g: 1, a: 'peak' },
    ],
  };
}
