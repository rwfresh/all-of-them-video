// 01/15 Line Art. "all of them." + Enter: the real terminal thins out into gold line work, the welcome box's border
// turns champagne gold and is pulled out, as one thread, into a single continuous line on midnight blue. The cursor
// has left the prompt row and leads it as a softly glowing pen tip. The line draws the film's own energy curve (the
// treatment): a hook, a climb in three steps, the hero at 63 % (a loop at the summit that fills with gold and becomes a
// play button), a breath, an end. The camera follows the tip, then dollies out past the whole drawing (to 0.95) and
// creeps back in to 1:1. The line does not stop at its end: it turns down the right margin, runs left as the prompt
// row's top rule and closes into the cursor a sixteenth before the next prompt is typed; each key then pulls the
// cursor, and the line's end with it, one cell along.
//
// Everything is placed in beats. The one line is three polylines sampled every 2 px: the box's perimeter (the thread
// still to be pulled), the curve (in the camera's world) and the tail (on the terminal's grid, outside the camera; the
// two meet in a vertical, which hides the camera's moves). Drawing speed follows a cost that rises with curvature, so
// the pen eases into corners.

import { DOCK, BOX, WELCOME, MASCOT, swapDock, cursorRect } from '../term.js';
import { ROWS } from './open.js';
import { clamp, lerp, seg, smooth, smoother, ease, tw, spring } from '../util.js';

const FAM = '"JBM Line"';
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C_GROUND = hex('#0B1320'), C_GOLD = hex('#E9D7A5'), C_TERM = hex('#0c0c0e'), C_ORANGE = hex('#D97757'), C_HOT = hex('#FFF4D6');
const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const css = (c, a = 1) => (a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);

const LINE_W = 3;                       // the line's width on screen, whatever the camera does
const FOCUS = { x: 960, y: 430 };       // where the camera holds the pen tip on screen
const ZOOM = 1.45;                      // how close the camera rides behind the pen on the climb
const ZMID = 1.2;                       // ...and at the summit, where the hero and the breath after it must share the frame
const WIDE = 0.95;                      // how far it dollies out before settling at 1:1

// the timeline, in local beats
const T0 = {
  dot0: 0, touch: 0.55, sweep1: 1.3, gap0: 0.15, gap1: 0.7,     // the cursor flies to the border; gold runs round it
  pull: 1.0, gone: 3.1,                                         // the thread leaves the box; the last of it is out
  hook: 2.0, mid: 4.0, loop0: 5.45, loop1: 6.0, dip: 7.0, end: 7.5,
  rule: 8.0,                                                    // the line has dropped and turns onto the prompt's rule, on the bar line
  zin0: 2.5, zin1: 3.9,                                         // the camera pushes in behind the pen
  ease0: 5.3, ease1: 6.9,                                       // and eases back a little for the summit
  zout0: 7.0, zout1: 9.5,                                       // the dolly out: 2.5 beats (1.2 s), cubic in and out
  push0: 9.5, push1: 11.25,                                     // then a slow push back to 1:1
  fill1: 6.55, play0: 6.3, play1: 6.8,
};
const START = 46;                       // the line begins here on the curve: the stub that led out of the box is drawn in

/** A polyline builder: lines, arcs and cubic curves sampled finely, then resampled to an even 2 px. */
class PB {
  constructor() { this.p = []; this.marks = {}; }
  get last() { return this.p[this.p.length - 1]; }
  M(x, y) { this.p.push([x, y]); return this; }
  L(x, y) {
    const [x0, y0] = this.last, n = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / 2));
    for (let i = 1; i <= n; i++) this.p.push([lerp(x0, x, i / n), lerp(y0, y, i / n)]);
    return this;
  }
  A(cx, cy, r, a0, a1) {
    const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / 2));
    for (let i = 1; i <= n; i++) { const a = lerp(a0, a1, i / n); this.p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return this;
  }
  C(x1, y1, x2, y2, x, y) {
    const [x0, y0] = this.last;
    const n = Math.max(8, Math.ceil((Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x - x2, y - y2)) / 2));
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      this.p.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y]);
    }
    return this;
  }
  mark(name) { this.marks[name] = this.p.length - 1; return this; }
  build(ds = 2) {
    const p = this.p, cum = [0];
    for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    const total = cum[cum.length - 1], n = Math.floor(total / ds) + 1;
    const X = new Float32Array(n), Y = new Float32Array(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = i * ds;
      while (j < p.length - 2 && cum[j + 1] < s) j++;
      const f = cum[j + 1] > cum[j] ? (s - cum[j]) / (cum[j + 1] - cum[j]) : 0;
      X[i] = lerp(p[j][0], p[j + 1][0], f); Y[i] = lerp(p[j][1], p[j + 1][1], f);
    }
    const marks = {};
    for (const k of Object.keys(this.marks)) marks[k] = cum[this.marks[k]];
    const len = (n - 1) * ds;
    const at = (s) => {
      const u = clamp(s / ds, 0, n - 1), i = Math.min(n - 2, Math.floor(u)), f = u - i;
      return [lerp(X[i], X[i + 1], f), lerp(Y[i], Y[i + 1], f)];
    };
    return { X, Y, n, ds, len, marks, at };
  }
}

/** Stroke the part of a path between arc lengths a and b, coloured piece by piece (opaque, so the pieces never show). */
function strokeRange(g, P, a, b, colorAt) {
  a = Math.max(0, a); b = Math.min(P.len, b);
  if (b - a < 0.01) return;
  const step = 14;                                   // samples a piece (28 px)
  let i0 = a / P.ds;
  const iEnd = b / P.ds;
  while (i0 < iEnd - 1e-6) {
    const i1 = Math.min(iEnd, Math.floor(i0 + 1e-6) + step);
    const p0 = P.at(i0 * P.ds);
    g.beginPath();
    g.moveTo(p0[0], p0[1]);
    for (let k = Math.floor(i0) + 1; k < i1; k++) g.lineTo(P.X[k], P.Y[k]);
    const p1 = P.at(i1 * P.ds);
    g.lineTo(p1[0], p1[1]);
    g.strokeStyle = colorAt(((i0 + i1) / 2) * P.ds);
    g.stroke();
    i0 = i1;
  }
}

/** Monotone cubic through (xs, ys), flat at both ends: the pen starts from rest and comes to rest. */
function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return ys[i] * (2 * t3 - 3 * t2 + 1) + m[i] * h * (t3 - 2 * t2 + t) + ys[i + 1] * (-2 * t3 + 3 * t2) + m[i + 1] * h * (t3 - t2);
  };
}

export default async function make(ctx) {
  const { W, H, font } = ctx;
  // when the next prompt starts to be typed (from the cue sheet): the line has to be home, as the cursor, just before
  const me = (ctx.clock && ctx.clock.shot && ctx.clock.shot.line) || ctx.shot || { b0: 0 };
  const nextUp = ctx.script && ctx.script.shots && ctx.script.shots.line && ctx.script.shots.line.next;
  const typeAt = nextUp ? nextUp.keys[0] - me.b0 : 9.375;
  const home = Math.max(T0.end + 0.75, typeAt - 0.125);
  const T = { ...T0, home, rule: Math.min(T0.rule, T0.end + (home - T0.end) * 0.4) };
  await Promise.all([
    font('JBM Line', '/assets/line/JetBrainsMono-Thin.ttf', { weight: '100' }),
    font('JBM Line', '/assets/line/JetBrainsMono-ExtraLight.ttf', { weight: '200' }),
    font('JBM Line', '/assets/line/JetBrainsMono-Light.ttf', { weight: '300' }),
  ]);

  // ---- the thread still in the box: its perimeter from the cut (E, the foot of the left side) all the way round ----
  const b = BOX, r = b.r, x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
  const E = [x0, y1 - r];
  const BOXP = new PB().M(E[0], E[1])
    .A(x0 + r, y1 - r, r, Math.PI, Math.PI / 2).L(x1 - r, y1)
    .A(x1 - r, y1 - r, r, Math.PI / 2, 0).L(x1, y0 + r)
    .A(x1 - r, y0 + r, r, 0, -Math.PI / 2).mark('top').L(x0 + r, y0)
    .A(x0 + r, y0 + r, r, -Math.PI / 2, -Math.PI).L(E[0], E[1])
    .build();
  // the gap in the top border where the title sat (term.js drawWelcome): x 188 to 700
  const GAP = [BOXP.marks.top + (x1 - r - 700), BOXP.marks.top + (x1 - r - 188)];

  // ---- the line: the film's energy curve ----
  const SUN = { x: 1165, y: 190, r: 64 };
  const CURVE = new PB().M(E[0], E[1])
    .L(132, 660).A(190, 660, 58, Math.PI, Math.PI / 2).L(236, 718)            // down out of the box, round, and away
    .C(268, 718, 296, 640, 322, 452).mark('hook')                             // the hook: a spike
    .C(334, 560, 352, 636, 398, 640)
    .C(450, 644, 470, 600, 520, 580).C(560, 564, 590, 572, 640, 560)          // the climb, step one
    .C(700, 546, 720, 470, 790, 450).mark('mid')                              // step two
    .C(840, 436, 880, 446, 930, 430)
    .C(990, 410, 1010, 300, 1070, 272).C(1100, 258, 1130, 254, SUN.x, SUN.y + SUN.r).mark('loop0')   // step three, to the summit
    .A(SUN.x, SUN.y, SUN.r, Math.PI / 2, Math.PI / 2 - Math.PI * 2).mark('loop1')                    // the loop on the summit
    .C(1215, 254, 1262, 300, 1310, 400).C(1352, 488, 1420, 600, 1513, 600).mark('dip')               // down, and breathe
    .C(1580, 600, 1610, 520, 1668, 500).C(1700, 489, 1724, 487, 1752, 487)                           // a last lift, composed
    .build();
  const END = CURVE.at(CURVE.len);

  // ---- the tail: past its end the line turns down the right margin, runs left as the prompt row's top rule, and
  // closes into the cursor. It lives on the terminal's grid (screen pixels); only its first turn is in the camera's world.
  const IDENT = { z: 1, cx: FOCUS.x, cy: FOCUS.y };
  const toScreen = (p, cam) => [FOCUS.x + (p[0] - cam.cx) * cam.z, FOCUS.y + (p[1] - cam.cy) * cam.z];
  const RULE_Y = ROWS.rule1, RC = DOCK.right - END[0], SR = 10;      // both big turns have the same radius; SR turns into the cursor
  /** The cursor's outline for a (fractional) column of the prompt. */
  const curBox = (col) => { const c = cursorRect(DOCK.x + (2 + col) * DOCK.adv, DOCK.rowC, DOCK.size); return { l: c.x + 3, t: c.y + 2, r: c.x + c.w - 1, b: c.y + c.h - 2 }; };
  /** The tail as it stands on screen for this camera and cursor column (withBox: on round the cursor's outline too). */
  function tailPath(cam, col, withBox = false) {
    const a = toScreen(END, cam), c = toScreen([END[0], END[1] + RC], cam), xd = c[0] + RC * cam.z, box = curBox(col);
    const pb = new PB().M(a[0], a[1])
      .A(c[0], c[1], RC * cam.z, -Math.PI / 2, 0).mark('elbow')                     // round, and down (with the drawing)
      .L(xd, RULE_Y - RC).mark('drop')                                              // the vertical: world above, grid below
      .A(xd - RC, RULE_Y - RC, RC, 0, Math.PI / 2).mark('corner')
      .L(box.r + SR, RULE_Y).mark('rule')                                           // the prompt row's top rule
      .A(box.r + SR, RULE_Y + SR, SR, -Math.PI / 2, -Math.PI).L(box.r, box.t).mark('stem');
    if (withBox) pb.L(box.r, box.b).L(box.l, box.b).L(box.l, box.t).L(box.r, box.t).mark('box');
    return pb.build();
  }
  const TAIL0 = tailPath(IDENT, 0, true);                      // at 1:1 with the cursor on an empty prompt: the pen's road
  const TAIL_GEO = tailPath(IDENT, 0);                         // the same without the cursor's outline, for the next shot
  const TAIL_KEYS = ['elbow', 'drop', 'corner', 'rule', 'stem'];
  /** Length st along TAIL0, as a length along this frame's tail P (each stretch keeps its share). */
  function onTail(st, P) {
    let a0 = 0, b0 = 0;
    for (const k of TAIL_KEYS) {
      const a1 = TAIL0.marks[k], b1 = Math.min(P.len, P.marks[k]);
      if (st <= a1) return b0 + ((st - a0) / (a1 - a0)) * (b1 - b0);
      a0 = a1; b0 = b1;
    }
    return P.len;
  }

  // drawing cost: 1 a pixel on the straight, more where the line bends, so the pen eases into corners
  const costOf = ({ X, Y, n, ds }) => {
    const th = new Float32Array(n), k = new Float32Array(n), Tc = new Float32Array(n);
    for (let i = 0; i < n; i++) { const a = Math.max(0, i - 3), c = Math.min(n - 1, i + 3); th[i] = Math.atan2(Y[c] - Y[a], X[c] - X[a]); }
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 4), c = Math.min(n - 1, i + 4);
      let d = th[c] - th[a];
      while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      k[i] = Math.abs(d) / ((c - a) * ds);
    }
    for (let i = 1; i < n; i++) {
      let s = 0, m = 0;
      for (let j = Math.max(0, i - 10); j <= Math.min(n - 1, i + 10); j++) { s += k[j]; m++; }
      Tc[i] = Tc[i - 1] + ds * (1 + Math.min(2.6, (s / m) * 70));
    }
    const costAt = (s) => { const u = clamp(s / ds, 0, n - 1), i = Math.min(n - 2, Math.floor(u)); return lerp(Tc[i], Tc[i + 1], u - i); };
    const sAt = (c) => {
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (Tc[mid] <= c) lo = mid; else hi = mid; }
      return (lo + (Tc[hi] > Tc[lo] ? (c - Tc[lo]) / (Tc[hi] - Tc[lo]) : 0)) * ds;
    };
    return { costAt, sAt, total: Tc[n - 1] };
  };
  const COST = costOf(CURVE), COST_T = costOf(TAIL0);
  const M = CURVE.marks;
  const sched = monotone(
    [T.pull, T.hook, T.mid, T.loop0, T.loop1, T.dip, T.end, T.rule, T.home],
    [...[0, M.hook, M.mid, M.loop0, M.loop1, M.dip, CURVE.len].map(COST.costAt), COST.total + COST_T.costAt(TAIL0.marks.corner), COST.total + COST_T.total],
  );
  /** How much of the curve the pen has drawn (px along it) at local beat lb. */
  const tipS = (lb) => COST.sAt(Math.min(COST.total, sched(lb)));
  /** How far the pen has gone on past the curve's end (px along TAIL0). */
  const tailS = (lb) => (lb <= T.end ? 0 : COST_T.sAt(sched(lb) - COST.total));
  const BOX_FROM = TAIL0.marks.stem, BOX_LEN = TAIL0.len - TAIL0.marks.stem;
  /** How much of the cursor's outline the line has drawn, 0 to 1. */
  const boxDrawn = (lb) => (lb >= T.home ? 1 : clamp((tailS(lb) - BOX_FROM) / BOX_LEN));
  /** The cursor's column: each key struck pulls it one cell along. */
  const cursorCol = (m) => { const c = m.rowC; return c.mode === 'typing' && c.n > 0 ? c.n - 1 + ease.outCubic(clamp(c.keyAge(c.n - 1) / 0.12)) : 0; };
  /** A point a share f of the way round the cursor's outline, from its top right corner, down first. */
  const boxPoint = (bx, f) => {
    const w = bx.r - bx.l, h = bx.b - bx.t;
    let d = clamp(f) * 2 * (w + h);
    if (d <= h) return [bx.r, bx.t + d];
    d -= h; if (d <= w) return [bx.r - d, bx.b];
    d -= w; if (d <= h) return [bx.l, bx.b - d];
    return [bx.l + (d - h), bx.t];
  };

  // ---- the mascot's outline, as loops of line (outer edge and the two eyes) ----
  const MAS = (() => {
    const rows = [[[3, 14]], [[3, 4], [6, 11], [13, 14]], [[1, 16]], [[3, 14]], [[4, 4], [6, 6], [11, 11], [13, 13]]];
    const filled = new Set();
    rows.forEach((spans, y) => spans.forEach(([a, c]) => { for (let x = a; x <= c; x++) filled.add(x + ',' + y); }));
    const has = (x, y) => filled.has(x + ',' + y);
    const next = new Map();                          // boundary edges, clockwise, keyed by their start corner
    for (const key of filled) {
      const [x, y] = key.split(',').map(Number);
      if (!has(x, y - 1)) next.set(`${x},${y}`, [x + 1, y]);
      if (!has(x + 1, y)) next.set(`${x + 1},${y}`, [x + 1, y + 1]);
      if (!has(x, y + 1)) next.set(`${x + 1},${y + 1}`, [x, y + 1]);
      if (!has(x - 1, y)) next.set(`${x},${y + 1}`, [x, y]);
    }
    const qw = 22, qh = 44, ox = b.x + b.w / 2 - (MASCOT.cols * qw) / 2 - qw / 2, oy = b.y + 164;
    const loops = [];
    while (next.size) {
      const startKey = next.keys().next().value;
      let key = startKey;
      const [sx, sy] = key.split(',').map(Number);
      const pb = new PB().M(ox + sx * qw, oy + sy * qh);
      do { const [nx, ny] = next.get(key); next.delete(key); pb.L(ox + nx * qw, oy + ny * qh); key = `${nx},${ny}`; } while (key !== startKey && next.has(key));
      loops.push(pb.build());
    }
    loops.sort((p, q) => q.len - p.len);
    return loops;
  })();

  // ---- small helpers ----
  const thin = (g, size, weight = 200) => { g.font = `${weight} ${size}px ${FAM}`; g.textBaseline = 'alphabetic'; g.textAlign = 'left'; };
  /** Letters on a fixed pitch from x (left edge of the first cell). */
  function spaced(g, s, x, y, size, pitch, color, weight = 200) {
    thin(g, size, weight);
    g.fillStyle = color;
    const off = (pitch - size * 0.6) / 2;
    for (let i = 0; i < s.length; i++) if (s[i] !== ' ') g.fillText(s[i], x + i * pitch + off, y);
  }
  /** Centred text whose letters drift apart by `open` (0 = set normally), for a graceful exit. */
  function centred(g, s, cx, y, size, color, weight, open = 0) {
    const pitch = size * 0.6 * (1 + open);
    spaced(g, s, cx - (s.length * pitch) / 2, y, size, pitch, color, weight);
  }

  /** The camera: behind the pen while it draws, then a dolly out past the whole poster and a slow push back to 1:1. */
  const camera = (lb) => {
    const kin = smooth(seg(lb, T.zin0, T.zin1));
    if (kin <= 0.0001) return IDENT;
    let sx = 0, sy = 0;
    const N = 9;
    for (let i = 0; i < N; i++) { const p = CURVE.at(tipS(lb + (i / (N - 1) - 0.5) * 0.9)); sx += p[0]; sy += p[1]; }
    const zf = 1 + (ZOOM - 1) * kin - (ZOOM - ZMID) * smooth(seg(lb, T.ease0, T.ease1));
    let cx = lerp(FOCUS.x, sx / N, kin), cy = lerp(FOCUS.y, sy / N, kin);
    // from the summit on, never let the loop (the hero) leave the top of the frame, nor drift left into the tag
    const hold = smooth(seg(lb, T.loop0 - 0.9, T.loop0 - 0.1));
    cy = lerp(cy, Math.min(cy, SUN.y - SUN.r - 110 + FOCUS.y / zf), hold);
    cx = lerp(cx, Math.min(cx, SUN.x + 50 / zf), hold);
    const out = ease.inOutCubic(seg(lb, T.zout0, T.zout1));
    if (out <= 0) return { z: zf, cx, cy };
    const zEnd = lerp(WIDE, 1, smooth(seg(lb, T.push0, T.push1)));
    return { z: Math.exp(lerp(Math.log(zf), Math.log(zEnd), out)), cx: lerp(cx, FOCUS.x, out), cy: lerp(cy, FOCUS.y, out) };
  };

  /** The pen tip: a soft glow and a bright core. */
  function tipDot(g, x, y, a = 1, scale = 1) {
    if (a <= 0) return;
    const R = 34 * scale, gr = g.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, css(C_HOT, 0.55 * a)); gr.addColorStop(0.25, css(C_GOLD, 0.28 * a)); gr.addColorStop(1, css(C_GOLD, 0));
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
    g.fillStyle = css(C_HOT, a);
    g.beginPath(); g.arc(x, y, 5.2 * scale, 0, Math.PI * 2); g.fill();
  }

  const CUR0 = cursorRect(DOCK.x + (2 + 12) * DOCK.adv, DOCK.rowC, DOCK.size);          // the cursor after "all of them."
  const quad = (p0, c, p1, t) => [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]];

  // ---- the terminal's two rows, as thin gold lettering ----
  function rowText(g, text, x, y, color, weight, reveal = 1) {
    if (reveal <= 0) return;
    if (reveal < 1) { g.save(); g.beginPath(); g.rect(x - 4, y - 70, (text.length * DOCK.adv + 8) * reveal, 100); g.clip(); }
    spaced(g, text, x, y, DOCK.size, DOCK.adv, color, weight);
    if (reveal < 1) g.restore();
  }
  function dock(g, env, part) {
    const m = env.term, lb = env.lb;
    const gold = css(C_GOLD), soft = css(mix3(C_GROUND, C_GOLD, 0.62));
    if (part !== 'C' && m.last) {
      const o = m.last, x = DOCK.x, y = DOCK.rowB, wr = clamp(o.age / 0.6);       // written on, left to right
      g.lineWidth = LINE_W; g.lineCap = 'round'; g.lineJoin = 'round';
      if (o.kind === 'result') {
        g.strokeStyle = soft;
        g.beginPath(); g.moveTo(x + 2 * DOCK.adv + 18, y - 44); g.lineTo(x + 2 * DOCK.adv + 18, y - 8); g.lineTo(x + 2 * DOCK.adv + 46, y - 8); g.stroke();
        rowText(g, o.text, x + 5 * DOCK.adv, y, soft, 200, wr);
      } else {
        // the bullet is a ring; when the tool has finished it fills from its centre (a small line-to-fill of its own)
        const cx = x + 18, cy = y - 19, done = o.kind === 'tool' ? ease.outCubic(seg(o.age, 0.35, 0.7)) : 0;
        g.strokeStyle = gold;
        g.beginPath(); g.arc(cx, cy, 11, 0, Math.PI * 2); g.stroke();
        if (done > 0) { g.fillStyle = gold; g.beginPath(); g.arc(cx, cy, 11 * done, 0, Math.PI * 2); g.fill(); }
        const k = o.kind === 'tool' ? o.text.indexOf('(') : 0;
        const shown = o.kind === 'say' ? o.text.slice(0, o.chars) : o.text;
        if (k > 0) {
          g.save(); g.beginPath(); g.rect(x, y - 70, (2 + shown.length) * DOCK.adv * wr + 40, 100); g.clip();
          spaced(g, shown.slice(0, k), x + 2 * DOCK.adv, y, DOCK.size, DOCK.adv, gold, 300);
          spaced(g, shown.slice(k), x + (2 + k) * DOCK.adv, y, DOCK.size, DOCK.adv, gold, 200);
          g.restore();
        } else rowText(g, shown, x + 2 * DOCK.adv, y, gold, 200, o.kind === 'say' ? 1 : wr);
      }
    }
    if (part === 'B') return;
    const c = m.rowC, x = DOCK.x, y = DOCK.rowC, tx = x + 2 * DOCK.adv;
    spaced(g, '>', x, y, DOCK.size, DOCK.adv, soft, 200);
    if (c.mode === 'cmd') {
      // before the next prompt is typed, the old one is taken back, right to left
      const clearAt = m.typing ? m.typing.start - 1 : Infinity;
      rowText(g, c.text, tx, y, gold, 200, 1 - tw(lb, clearAt - 0.7, clearAt - 0.05, ease.inOutCubic));
    } else {
      for (let i = 0; i < c.n; i++) {
        if (c.text[i] === ' ') continue;
        const age = c.keyAge(i), cx = tx + i * DOCK.adv;
        // each letter is written in as its key is struck, and glows for a moment
        g.save();
        g.beginPath(); g.rect(cx - 2, y - 70, (DOCK.adv + 4) * clamp(age / 0.12), 100); g.clip();
        spaced(g, c.text[i], cx, y, DOCK.size, DOCK.adv, css(mix3(C_GOLD, C_HOT, 1 - clamp(age / 0.6))), 200);
        g.restore();
      }
      // the cursor: an outlined block, and the end of the one line, which draws it (from its top right corner, down first)
      const f = lb < 0 ? 1 : boxDrawn(lb);
      if (c.cursor && f > 0) {
        const bx = curBox(cursorCol(m)), w = bx.r - bx.l, h = bx.b - bx.t;
        g.strokeStyle = m.blink || f < 1 ? gold : css(mix3(C_GROUND, C_GOLD, 0.35));     // unlit, it dims; it never leaves the line
        g.lineWidth = LINE_W; g.lineJoin = 'round'; g.lineCap = 'round';
        g.beginPath(); g.moveTo(bx.r, bx.t);
        let d = f * 2 * (w + h), px = bx.r, py = bx.t;
        for (const [x, y, len] of [[bx.r, bx.b, h], [bx.l, bx.b, w], [bx.l, bx.t, h], [bx.r, bx.t, w]]) {
          if (d <= 0) break;
          const k = Math.min(1, d / len);
          g.lineTo(lerp(px, x, k), lerp(py, y, k));
          px = x; py = y; d -= len;
        }
        if (f >= 1) g.closePath();
        g.stroke();
      }
    }
  }

  const LABELS = [
    ['HOOK', 322, 414, 'c', T.hook],
    ['CLIMB', 700, 640, 'c', 3.5],
    ['HERO', 1262, 182, 'l', T.loop1],
    ['BREATHE', 1513, 672, 'c', T.dip],
    ['END', 1752, 436, 'r', T.end],
  ];

  function render(g, env) {
    const lb = Math.max(0, env.lb);
    const handing = !!(env.other && env.role === 'in' && env.otherImpl && env.otherImpl.layers);

    // ---- ground: terminal black to midnight ----
    const groundK = env.other || env.lb < 0.2 ? smooth(seg(lb, 0.2, 1.9)) : 1;
    const GROUND = mix3(C_TERM, C_GROUND, handing || env.lb < 2 ? groundK : 1);
    const gold = (k) => css(mix3(GROUND, C_GOLD, k));
    g.fillStyle = css(GROUND);
    g.fillRect(0, 0, W, H);
    const vig = smooth(seg(lb, 1.2, 3));
    if (vig > 0) {
      const gr = g.createRadialGradient(960, 470, 420, 960, 470, 1250);
      gr.addColorStop(0, 'rgba(3,6,14,0)'); gr.addColorStop(1, `rgba(3,6,14,${0.5 * vig})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    }

    const cam = camera(lb);
    const lw = LINE_W / cam.z;
    g.save();
    g.translate(FOCUS.x, FOCUS.y); g.scale(cam.z, cam.z); g.translate(-cam.cx, -cam.cy);
    g.lineCap = 'round'; g.lineJoin = 'round';

    // ---- the real terminal drains away, and the same things stand for a moment as thin gold line work ----
    const drain = tw(lb, 0.15, 0.95, ease.inOutCubic);
    if (handing && drain < 1) {
      g.save();
      g.globalAlpha = 1 - drain;
      env.otherImpl.layers(g, env.otherEnv, { bg: false, border: false });
      g.restore();
    }
    if (lb < 2.9) {
      const inn = drain;
      const part = (t0, t1) => ({ a: inn * (1 - tw(lb, t0, t1, ease.inCubic)), open: 0.55 * tw(lb, t0, t1, ease.inCubic) });
      const cx = b.x + b.w / 2;
      let p = part(1.55, 2.3);
      if (p.a > 0) centred(g, 'Welcome back!', cx, b.y + 116, 48, css(C_GOLD, p.a), 300, p.open);
      p = part(1.7, 2.45);
      if (p.a > 0) { centred(g, WELCOME.model, cx, b.y + 468, 44, css(C_GOLD, p.a), 200, p.open); centred(g, WELCOME.cwd, cx, b.y + 532, 44, css(C_GOLD, p.a * 0.6), 200, p.open); }
      p = part(0.95, 1.5);
      if (p.a > 0) {
        const pitch = DOCK.adv * (1 + p.open * 0.5);
        spaced(g, '>', DOCK.x, ROWS.cmd, DOCK.size, DOCK.adv, css(C_GOLD, p.a * 0.6), 200);
        spaced(g, 'make me a video.', DOCK.x + 2 * DOCK.adv, ROWS.cmd, DOCK.size, pitch, css(C_GOLD, p.a), 200);
      }
      // the input's two rules are lines already: they turn gold, then are drawn back in from both ends
      const rk = 1 - tw(lb, 1.5, 2.5, ease.inOutCubic);
      if (inn > 0 && rk > 0) {
        g.strokeStyle = css(C_GOLD, inn * 0.55); g.lineWidth = 2;
        for (const y of [ROWS.rule1, ROWS.rule2]) { g.beginPath(); g.moveTo(DOCK.left, y); g.lineTo(lerp(DOCK.left, DOCK.right, rk), y); g.stroke(); }
      }
      // the mascot: its fill drains, its outline is traced in gold, then the outline is taken back
      const on = tw(lb, 0.25, 1.15, ease.inOutCubic), off = tw(lb, 1.9, 2.75, ease.inOutCubic);
      if (on > 0 && off < 1) {
        g.lineWidth = lw;
        MAS.forEach((loop, i) => {
          const o2 = i === 0 ? on : clamp((on - 0.6) / 0.4);
          strokeRange(g, loop, loop.len * off, loop.len * o2, () => css(C_GOLD));
        });
      }
    }

    // ---- the hero's fill: the loop on the summit fills with gold from its anchor, and is a play button ----
    const fill = ease.outCubic(seg(lb, T.loop1, T.fill1));
    if (fill > 0) {
      g.save();
      g.beginPath(); g.arc(SUN.x, SUN.y, SUN.r, 0, Math.PI * 2); g.clip();
      g.fillStyle = css(C_GOLD);
      g.beginPath(); g.arc(SUN.x, SUN.y + SUN.r, (SUN.r * 2 + 6) * fill, 0, Math.PI * 2); g.fill();
      g.restore();
      const beat = lb - Math.floor(lb);
      const ps = lb < T.play0 ? 0 : clamp(spring((lb - T.play0) * env.spb, 3.4, 0.5), 0, 1.3) * (1 + 0.045 * Math.pow(1 - beat, 3) * seg(lb, T.play1, T.play1 + 0.5));
      if (ps > 0) {
        g.save();
        g.translate(SUN.x + 3, SUN.y); g.scale(ps, ps);
        g.fillStyle = css(GROUND);
        g.beginPath(); g.moveTo(-19, -29); g.lineTo(31, 0); g.lineTo(-19, 29); g.closePath(); g.fill();
        g.restore();
      }
    }

    // ---- the one line ----
    const sTip = tipS(lb);
    const pulled = lb >= T.pull;
    // past the curve's end: this frame's tail (on the terminal's grid) and how much of it is drawn
    const m = env.term, entered = !!(m.typing && m.typing.entered);
    const st = tailS(lb), TP = st > 0 ? tailPath(cam, cursorCol(m)) : null;
    let sTail = TP ? onTail(st, TP) : 0;
    // once the prompt is entered there is no cursor to end in: the last turn is drawn back into the rule
    if (TP && entered) sTail = Math.min(sTail, lerp(TP.len, TP.marks.rule, tw(lb, m.typing.enterAt, m.typing.enterAt + 0.3, ease.inOutCubic)));
    // the thread left in the box: its free end runs round the border and out through the cut
    const tail = BOXP.len * smoother(seg(lb, T.pull, T.gone));          // it whips round and is gone while the frame is still wide
    const dimIn = smooth(seg(lb, T.pull, T.pull + 1.4));                    // older line dims as the pen moves on...
    const relit = lerp(-300, CURVE.len + 300, tw(lb, 7.25, 8.55, ease.inOutCubic));   // ...and is lit again for the poster
    const GLEAM = CURVE.len + TAIL0.marks.stem + 600;
    const glint = lb > T.home + 0.25 ? (((lb - T.home - 0.25) / 5) % 1) * GLEAM - 300 : -9999;   // a slow gleam down the finished line
    const bright = (d, s) => {
      let k = lerp(1, 0.35 + 0.65 * Math.exp(-d / 620), dimIn);
      k = Math.max(k, 0.88 * smooth(clamp((relit - s) / 300)));
      if (s >= M.loop0 && s <= M.loop1) k = Math.max(k, fill);            // the filled loop's own line is full gold
      const gd = Math.abs(s - glint);
      if (gd < 300) k = Math.max(k, 0.88 + 0.12 * smooth(1 - gd / 300));
      return k;
    };
    g.lineWidth = lw;
    if (tail < BOXP.len) {
      // before the cut: orange turning gold from the touch point, round both ways; the title's gap closes
      const front = (BOXP.len / 2 + 70) * tw(lb, T.touch, T.sweep1, ease.inOutCubic);
      const colorAt = (u) => {
        const dE = Math.min(u, BOXP.len - u);
        const goldK = lb < T.touch ? 0 : smooth(clamp((front - dE) / 90 + 0.5));
        const base = mix3(C_ORANGE, C_GOLD, goldK);
        return css(mix3(GROUND, base, lerp(bright(sTip, 0), lerp(1, 0.8, dimIn), smooth((BOXP.len - u) / 420))));
      };
      const gp = 1 - tw(lb, T.gap0, T.gap1, ease.inOutCubic), gm = (GAP[0] + GAP[1]) / 2, gh = ((GAP[1] - GAP[0]) / 2) * gp;
      if (gh > 1 && tail < gm - gh) { strokeRange(g, BOXP, tail, gm - gh, colorAt); strokeRange(g, BOXP, Math.max(tail, gm + gh), BOXP.len, colorAt); }
      else strokeRange(g, BOXP, tail, BOXP.len, colorAt);
    }
    if (pulled) {
      // once the last of the thread has left the box, the stub that led out of it is drawn in: the line starts on its first curve
      const lift = tw(lb, T.gone - 0.1, T.gone + 0.5, ease.inOutCubic);
      strokeRange(g, CURVE, lerp(0, START, lift), sTip, (s) => gold(bright(sTip - s + sTail, s)));
      if (glint > -300 && glint < CURVE.len + 300) {
        g.save();
        g.shadowColor = css(C_HOT, 0.9); g.shadowBlur = 16;
        strokeRange(g, CURVE, glint - 70, glint + 70, () => css(C_HOT));
        g.restore();
      }
      // a little bloom on the fresh ink behind the pen (it follows the pen on to the tail)
      if (sTail < 90 && lb < T.home) {
        g.save();
        g.shadowColor = css(C_GOLD, 0.8); g.shadowBlur = 14 * cam.z;
        strokeRange(g, CURVE, sTip - (90 - sTail) / cam.z, sTip, () => css(C_GOLD));
        g.restore();
      }
    }

    // ---- the treatment's words, set as the pen passes ----
    for (const [word, x, y, align, at] of LABELS) {
      const pitch = 38 * (1 + 0.5 * (1 - tw(lb, at, at + 0.5, ease.outCubic))), w = word.length * pitch;
      const mid = toScreen([align === 'c' ? x : align === 'r' ? x - w / 2 : x + w / 2, y - 13], cam);
      const edge = smooth((mid[0] - 70) / 110) * smooth((1850 - mid[0]) / 110) * smooth((mid[1] - 40) / 60) * smooth((742 - mid[1]) / 50);
      const a = tw(lb, at, at + 0.5, ease.outCubic) * edge;
      if (a <= 0.004) continue;
      const left = align === 'c' ? x - w / 2 : align === 'r' ? x - w + (pitch - 24) / 2 : x;
      spaced(g, word, left, y, 40, pitch, gold(0.8 * a), 300);
    }

    // the pen tip, while it draws
    const tipW = pulled ? CURVE.at(sTip) : E;
    g.restore();                                                   // back to screen space

    // ---- the lower part of the frame belongs to the terminal's rows: the drawing fades out behind them ----
    const veil = smooth(seg(lb, 2.2, 3.0));
    if (veil > 0) {
      const gr = g.createLinearGradient(0, 748, 0, 806);
      gr.addColorStop(0, css(GROUND, 0)); gr.addColorStop(1, css(GROUND, veil));
      g.fillStyle = gr;
      g.fillRect(0, 748, W, H - 748);
    }

    // ---- the tail: down the right margin, left along the prompt row's rule, into the cursor ----
    if (TP && sTail > 0) {
      g.lineWidth = LINE_W; g.lineCap = 'round'; g.lineJoin = 'round';
      const gt = glint - CURVE.len;                                    // the gleam, when it has run on to the tail
      const gs = gt > -300 && gt < TAIL0.marks.stem + 300 ? onTail(clamp(gt, 0, TAIL0.marks.stem), TP) + Math.min(0, gt) + Math.max(0, gt - TAIL0.marks.stem) : -9999;
      strokeRange(g, TP, 0, sTail, (s) => {
        let k = Math.max(0.88, 0.35 + 0.65 * Math.exp(-(sTail - s) / 620));
        const gd = Math.abs(s - gs);
        if (gd < 300) k = Math.max(k, 0.88 + 0.12 * smooth(1 - gd / 300));
        return gold(k);
      });
      if (gs > -200) {
        g.save();
        g.shadowColor = css(C_HOT, 0.9); g.shadowBlur = 16;
        strokeRange(g, TP, Math.max(0, gs - 70), Math.min(sTail, gs + 70), () => css(C_HOT));
        g.restore();
      }
      // fresh ink behind the pen: the faster it runs, the longer it glows
      if (lb < T.home) {
        const trail = clamp(sTail - onTail(tailS(lb - 0.07), TP), 70, 460);
        g.save();
        g.shadowColor = css(C_GOLD, 0.8); g.shadowBlur = 14;
        strokeRange(g, TP, sTail - trail, sTail, () => css(C_GOLD));
        g.restore();
      }
    }

    // ---- the pen tip (the cursor): out of the prompt row, onto the border, along the whole line, and into the cursor ----
    const curC = [CUR0.x + CUR0.w / 2, CUR0.y + CUR0.h / 2];
    if (lb < T.touch) {
      const p = ease.inOutCubic(seg(lb, T.dot0 + 0.04, T.touch));
      const pos = quad(curC, [150, 930], E, p);
      const k = clamp(lb / 0.22);                                   // the block draws in to a point
      if (k < 1) {
        g.strokeStyle = css(mix3(hex('#ecebe8'), C_GOLD, k)); g.lineWidth = LINE_W;
        const w2 = (CUR0.w / 2) * (1 - k), h2 = (CUR0.h / 2) * (1 - k);
        g.strokeRect(pos[0] - w2, pos[1] - h2, w2 * 2, h2 * 2);
      }
      tipDot(g, pos[0], pos[1], clamp(lb / 0.15), 0.8 + 0.2 * k);
    } else if (lb < T.home + 0.4) {
      const bf = boxDrawn(lb);
      const p = bf > 0 ? boxPoint(curBox(cursorCol(m)), bf) : TP ? TP.at(sTail) : toScreen(tipW, cam);
      const touch = 1 - clamp((lb - T.touch) / 0.5);                // a ring rings out where the pen touches the border
      if (touch > 0) {
        g.strokeStyle = css(C_GOLD, touch * 0.8); g.lineWidth = 2;
        g.beginPath(); g.arc(p[0], p[1], 10 + 60 * ease.outCubic(1 - touch), 0, Math.PI * 2); g.stroke();
      }
      tipDot(g, p[0], p[1], 1 - seg(lb, T.home, T.home + 0.4), 1 + 0.5 * touch);   // home: the glow goes out, the cursor stays
    }

    // ---- the tag ----
    const tagIn = seg(lb, 3.2, 4.1);
    if (env.tag && tagIn > 0) {
      const s = `${env.tag.num}/${env.tag.of}  ${env.tag.name}`;
      thin(g, 40, 300);
      for (let i = 0; i < s.length; i++) {
        const a = ease.outCubic(clamp(tagIn * 2.2 - i * 0.075));
        if (a <= 0 || s[i] === ' ') continue;
        g.fillStyle = gold(0.86 * a);
        g.fillText(s[i], DOCK.x + i * DOCK.adv + 6 + (1 - a) * 14, 150);
      }
    }

    // ---- the terminal's two rows ----
    if (env.noDock) return;
    if (handing && env.otherImpl.dock) swapDock(g, env, dock, (lb - 0.15) / 1.6);
    else dock(g, env);
  }

  return {
    dock,
    render,
    // for the shot that takes this drawing over (frame pixels at 1:1, where the camera rests from beat 11.25 on).
    // curve, sun, labels, lineWidth: as before. New keys: start = where the visible line begins on the curve (px along
    // it); tail = the line's run-on from the curve's end, { path (to the rule's far left end, cursor on an empty prompt),
    // marks (px along it: elbow, drop, corner, rule, stem), ruleY, dropX, stemX(n) = where it ends above column n };
    // view(lb) = the camera { z, cx, cy, fx, fy }: screen = (fx, fy) + (p - (cx, cy)) * z.
    geometry: {
      curve: CURVE, sun: SUN, labels: LABELS, lineWidth: LINE_W,
      start: START,
      tail: { path: TAIL_GEO, marks: TAIL_GEO.marks, ruleY: RULE_Y, dropX: DOCK.right, stemX: (n) => curBox(n).r },
      view: (lb) => ({ ...camera(lb), fx: FOCUS.x, fy: FOCUS.y }),
    },
    sfx: [
      { b: T.touch, s: 'line_touch', g: 0.7 },          // a small glassy tick: the pen meets the border
      { b: T.pull, s: 'line_pen', g: 0.6 },             // pen on paper, a long quiet stroke (about 3.4 s)
      { b: T.hook, s: 'line_pluck', g: 0.7 },           // the hook: one plucked note
      { b: T.loop1, s: 'line_chime', g: 0.9, a: 'peak' },   // the fill: a delicate chime
      { b: T.rule, s: 'line_settle', g: 0.7 },          // the line lands on the prompt's rule, on the bar line: a soft low note
      { b: T.rule, s: 'line_run', g: 0.6 },             // the flourish: a pen swish along the rule that quickens, then slows to a stop as the cursor closes
    ],
  };
}
