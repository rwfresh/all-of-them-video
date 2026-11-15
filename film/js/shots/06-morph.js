// 06/15 Shape Morph. "don't cut. morph." + Enter: the dot Flat Vector leaves behind swells into a colour field that
// wipes the frame, shrinks back, bounces, and is then ONE hero shape that becomes a new icon exactly on every beat:
//   dot, camera (struck through: the one thing this film never used), code braces, film frame, play, speaker, drop.
// Every change takes about 19 frames and ends on its beat: 8 frames in to a simple in-between (a circle, a capsule or
// a pair of bars), 3 frames held on it, 8 frames out to the new icon, each half on cubic-bezier(0.7, 0, 0.3, 1). The
// whole hero turns 20 to 25 degrees into the in-between and back, and the in-between is stretched 12 %.
// Three threads run through all seven icons, so parts change together:
//   L    dot, camera body, left brace, left half of the film, the play disc, a sound wave, the drop's shine
//   R    the red slash, right brace, right half of the film, a sound wave, a second shine
//   EYE  the lens, the point between the braces, the lit frame, the play triangle, the speaker, the drop
// The ground is a flat colour field that changes with every morph by a clean colour-block wipe; everything on screen
// (hero, lettering, cursor) changes palette exactly where the wipe's edge has passed. Each wipe's edge crosses the
// hero while it is held on its in-between, so both halves of every morph are seen whole, in one palette each.
// The drop lets go as the last full stop of "pour in the sound." is typed and falls through the bar line into Liquid.
//
// In-betweens can never knot or go lumpy: a shape is a rounded rectangle with its own numbers (so it stays one all the
// way), a stroke (a centre line and a width), or a radial outline (see morph/geo.js).

import { DOCK, swapDock } from '../term.js';
import { clamp, lerp, seg, smooth, ease } from '../util.js';
import { TAU, bezier, roundPoly, radialOf, circleR, resample, cubicPts, arcPts, linePts } from './morph/geo.js';

const FAM = '"RH Mono"';
const W = 1920, H = 1080;
const HC = { x: 960, y: 432 };          // the hero's place on screen
const HS = 1.15;                        // the icons are drawn on a 440 px module and shown this much larger
const N = 480, M = 56;                  // directions of a radial shape; points of a stroke's centre line
const EM = bezier(0.7, 0, 0.3, 1);      // the morph curve
const EW = bezier(0.5, 0, 0.5, 1);      // a wipe's edge
const EOUT = bezier(0.16, 1, 0.3, 1);
const RAD = Math.PI / 180;

// ---- the timeline, in local beats (a beat is 29 frames) ----
const LAND = [1, 2, 3, 4, 5, 6, 7];     // each icon is complete exactly on its beat
const IN = 0.275, HOLD = 0.105, OUT = 0.275;   // 8 frames in to the in-between, 3 held on it, 8 out to the new icon
const MD = IN + HOLD + OUT;             // so a change starts 19 frames before its beat and each icon holds 10
const ARRIVE = 0.93;                    // the flood has shrunk back to the dot's size (still moving: it lands on beat 1)
const STRIKE = 1.9;                     // the slash starts out of the lens; it is across the camera on beat 2
const REL = 7.5;                        // the drop lets go (with the last key of the next prompt)
const GRAV = 2250;                      // px a beat squared, chosen so the drop's belly touches the prompt row's baseline (y 960) on the bar line
const SAG = 0.15;                       // how much longer the drop hangs before it lets go
const NAMES = ['DOT', 'NO CAMERA', 'CODE', 'FRAMES', 'PLAY', 'SOUND', 'DROP'];

// ---- colour ----
const C = { ink: '#151433', coral: '#FF5A4E', sun: '#FFC62B', ultra: '#2B2BFF', mint: '#2EE6A8', cream: '#FFF6E9', violet: '#6A35F2', hot: '#FF6426', peach: '#FFD3BA' };
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixHex = (a, b, k) => { const A = rgb(a), B = rgb(b); return `rgb(${Math.round(lerp(A[0], B[0], k))},${Math.round(lerp(A[1], B[1], k))},${Math.round(lerp(A[2], B[2], k))})`; };
const luma = (h) => { const c = rgb(h); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; };
const pal = (o) => ({ ring: o.G, glint: C.cream, chrome: true, ...o, dim: mixHex(o.G, o.T, 0.62), rip: mixHex(o.G, o.T, 0.13) });
// one palette for each ground: G ground, T lettering, L / R / eye the three threads, cur the cursor and bullets
const PAL = [
  pal({ G: C.coral, T: C.ink, L: C.coral, R: C.coral, eye: C.coral, cur: C.ink, chrome: false }),   // 0 the flood
  pal({ G: C.ink, T: C.cream, L: C.coral, R: C.coral, eye: C.coral, cur: C.coral }),               // 1 dot
  pal({ G: C.sun, T: C.ink, L: C.ink, R: C.coral, eye: C.ink, cur: C.coral }),                     // 2 camera
  pal({ G: C.ultra, T: C.cream, L: C.cream, R: C.cream, eye: C.sun, cur: C.sun }),                 // 3 braces
  pal({ G: C.mint, T: C.ink, L: C.ink, R: C.ink, eye: C.cream, cur: C.ink }),                      // 4 film
  pal({ G: C.coral, T: C.ink, L: C.cream, R: C.cream, eye: C.ink, cur: C.cream }),                 // 5 play
  pal({ G: C.violet, T: C.cream, L: C.sun, R: C.sun, eye: C.cream, cur: C.sun }),                  // 6 speaker
  pal({ G: C.cream, T: C.ink, L: C.peach, R: C.peach, eye: C.hot, cur: C.hot }),                   // 7 drop
];
const DOT0 = { x: 960, y: 440, r: 120, color: C.coral, bg: C.cream };   // Flat Vector's dot, if it does not say

// ---- the colour-block wipes: which palette gives way to which, when, and how the edge travels ----
const TH = (i) => LAND[i + 1] - OUT - HOLD / 2;                 // the middle of change i's hold on its in-between
const WW = 0.3;                                                // a wipe runs this long either side of it
const WIPES = [
  { from: -1, to: 0, t0: 0, t1: 0.5, kind: 'swell' },          // the dot swells and floods the frame
  { from: 0, to: 1, t0: 0.5, t1: ARRIVE, kind: 'shrink' },     // ...and shrinks back to be the hero
  // one for each change of icon; its edge is on the hero's centre at the middle of the hold. Never an edge that runs
  // the same way as the shape under it: the pill that lies along the slash is crossed by the other diagonal, the two
  // leaning bars by the diagonal that cuts across them.
  ...['slant', 'diag2', 'diag', 'up', 'slantR', 'down'].map((kind, i) => ({ from: i + 1, to: i + 2, t0: TH(i) - WW, t1: TH(i) + WW, kind })),
];
function wipeAt(lb) {
  if (lb < 0) return { a: -1, b: null, w: null };
  let a = -1;
  for (const w of WIPES) { if (lb < w.t0) break; if (lb < w.t1) return { a: w.from, b: w.to, w }; a = w.to; }
  return { a, b: null, w: null };
}
const FAR = (x, y) => Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y));
/** Add the wipe's region to the current path. Returns true if the NEW palette is inside it, false if outside. */
function traceWipe(g, w, lb, dot) {
  const u = seg(lb, w.t0, w.t1), e = EW(u), q = Math.SQRT1_2, L = 4000;
  switch (w.kind) {
    case 'swell': { const r = lerp(dot.r, FAR(dot.x, dot.y) + 8, 2 * EM(u / 2)); g.moveTo(dot.x + r, dot.y); g.arc(dot.x, dot.y, r, 0, TAU); return true; }
    case 'shrink': {
      // fast out of the flood, and still closing when it reaches the dot's size: the dot carries the move on (heroAt)
      const r = lerp(FAR(HC.x, HC.y) + 8, R_DOT * HS, 0.78 * (1 - Math.pow(1 - u, 3)) + 0.22 * u);
      g.moveTo(HC.x + r, HC.y); g.arc(HC.x, HC.y, r, 0, TAU);
      return false;
    }
    case 'slant': { const xe = lerp(HC.x - 1260, HC.x + 1260, e), s = 0.2; g.moveTo(-1400, -10); g.lineTo(xe + s * 442, -10); g.lineTo(xe - s * 658, H + 10); g.lineTo(-1400, H + 10); g.closePath(); return true; }
    case 'diag': {                                            // an edge that runs like the slash, from the top right corner
      const dc = (HC.x - HC.y) * q, d = lerp(dc + 1330, dc - 1330, e), ex = q * d, ey = -q * d;
      g.moveTo(ex - q * L, ey - q * L); g.lineTo(ex + q * L, ey + q * L); g.lineTo(ex + q * L + q * L, ey + q * L - q * L); g.lineTo(ex - q * L + q * L, ey - q * L - q * L); g.closePath();
      return true;
    }
    case 'diag2': {                                           // the other diagonal, from the top left corner
      const dc = (HC.x + HC.y) * q, d = lerp(dc - 1330, dc + 1330, e), ex = q * d, ey = q * d;
      g.moveTo(ex - q * L, ey + q * L); g.lineTo(ex + q * L, ey - q * L); g.lineTo(ex + q * L - q * L, ey - q * L - q * L); g.lineTo(ex - q * L - q * L, ey + q * L - q * L); g.closePath();
      return true;
    }
    case 'up': { const y = lerp(HC.y + 850, HC.y - 850, e); g.rect(-10, y, W + 20, H + 2000); return true; }     // the way film runs
    case 'slantR': { const xe = lerp(HC.x + 1260, HC.x - 1260, e), s = 0.2; g.moveTo(W + 1400, -10); g.lineTo(xe - s * 442, -10); g.lineTo(xe + s * 658, H + 10); g.lineTo(W + 1400, H + 10); g.closePath(); return true; }   // from the right, leaning the other way
    default: { const y = lerp(HC.y - 850, HC.y + 850, e); g.rect(-10, -2000, W + 20, y + 2000); return true; }   // down: the way a drop falls
  }
}

// ---- the icons, in the hero's own coordinates (0, 0 is HC) ----
const R_DOT = 128;
const LENS = [0, 22];
const SLASH_D = [Math.SQRT1_2, Math.SQRT1_2], SLASH_LEN = 282, SLASH_W = 46;
const PITCH = 220 / 3;                  // three sprocket holes to a frame

// a rounded rectangle by its numbers (a circle and a capsule are two of them): mixing the numbers gives another one
const Q = (cx, cy, w, h, r, rot = 0) => ({ cx, cy, w, h, r, rot });
const mixQ = (A, B, k) => { const w = lerp(A.w, B.w, k), h = lerp(A.h, B.h, k), cx = lerp(A.cx, B.cx, k), cy = lerp(A.cy, B.cy, k); return { k: 'q', cx, cy, x: cx - w / 2, y: cy - h / 2, w, h, rr: lerp(A.r, B.r, k), rot: lerp(A.rot, B.rot, k) }; };
const Q_DOT = Q(0, 0, 256, 256, 128), Q_CAP = Q(0, 14, 404, 204, 102), Q_CAM = Q(LENS[0], LENS[1], 430, 280, 46), Q_PILL = Q(0, 12, 120, 400, 60, -20 * RAD);   // the pill leans 20 degrees: with the hero's turn it lies along the slash
const Q_STRIP = Q(0, 0, 390, 440, 34), Q_MID4 = Q(0, 0, 366, 366, 183), Q_DISC = Q(0, 0, 400, 400, 200), Q_MID5 = Q(0, 0, 216, 216, 108);
const Q_EYE3 = Q(0, 0, 60, 60, 30), Q_WIN = Q(0, 0, 232, 176, 14), Q_EYE4 = Q(0, 0, 372, 372, 186);
const HUMP = roundPoly([[-104, 6], [-100, 0], [-80, -48], [80, -48], [100, 0], [104, 6]], [0, 0, 18, 18, 0, 0]);   // the camera's top, from the body's top edge

const rad = (poly, c) => ({ R: radialOf(poly, c[0], c[1], N), c });
const strk = (pts, w) => ({ pts: resample(pts, M), w });
const dotS = (c, r) => ({ pts: Array.from({ length: M }, () => [c[0], c[1]]), w: 2 * r });
const mirror = (f) => ({ ...f, pts: f.pts.map((p) => [-p[0], p[1]]) });

const SLASH = strk([[LENS[0] - SLASH_D[0] * SLASH_LEN, LENS[1] - SLASH_D[1] * SLASH_LEN], [LENS[0] + SLASH_D[0] * SLASH_LEN, LENS[1] + SLASH_D[1] * SLASH_LEN]], SLASH_W);
const S_PILL = { pts: linePts([-140 * Math.cos(70 * RAD), 12 - 140 * Math.sin(70 * RAD)], [140 * Math.cos(70 * RAD), 12 + 140 * Math.sin(70 * RAD)], M), w: 120 };   // Q_PILL again, as a stroke
const BRACE = strk([
  ...cubicPts([-100, -200], [-150, -200], [-168, -185], [-168, -140]),
  ...cubicPts([-168, -58], [-168, -22], [-196, 0], [-236, 0]),
  ...cubicPts([-236, 0], [-196, 0], [-168, 22], [-168, 58]),
  ...cubicPts([-168, 140], [-168, 185], [-150, 200], [-100, 200]),
], 46);
const BRACE_R = mirror(BRACE);
const S_BAR = { pts: linePts([-150, -177], [-150, 177], M), w: 46 }, S_BAR_R = mirror(S_BAR);   // a brace pulled straight
const S_MID5 = dotS([0, 0], 108);                                            // Q_MID5 again, as a stroke
const arcA = (r, deg) => arcPts(10, 0, r, -deg * RAD, deg * RAD, 60);
const ARC1 = strk(arcA(96, 42), 38), ARC2 = strk(arcA(176, 40), 38);
const TRI = rad(roundPoly([[-62, -106], [120, 0], [-62, 106]], 26), [-2, 0]);
const SPK = rad(roundPoly([[-190, -54], [-120, -54], [-12, -142], [-12, 142], [-120, 54], [-190, 54]], [16, 10, 20, 20, 10, 16]), [-96, 0]);
const DROP_C = [0, 50], DROP_R = 128, DROP_TIP = [0, -200];
const DROPF = rad((() => {
  const a = -15 * RAD, T = [DROP_C[0] + DROP_R * Math.cos(a), DROP_C[1] + DROP_R * Math.sin(a)];
  const tan = [Math.sin(a), -Math.cos(a)];                      // up along the circle at the join
  const right = cubicPts([3, -197], [16, -150], [T[0] + tan[0] * 105, T[1] + tan[1] * 105], T, 50);
  const belly = arcPts(DROP_C[0], DROP_C[1], DROP_R, a, Math.PI - a, 160).slice(1, -1);
  const left = right.map((p) => [-p[0], p[1]]).reverse();
  const cap = arcPts(0, -197, 3, Math.PI, Math.PI * 2, 6).slice(1, -1);   // a small round point, not a cut one
  return [...cap, ...right, ...belly, ...left];
})(), [0, 30]);
const SHINE1 = strk(arcPts(DROP_C[0], DROP_C[1], 84, 166 * RAD, 116 * RAD, 40), 26);
const SHINE2 = strk(arcPts(DROP_C[0], DROP_C[1], 84, 192 * RAD, 186 * RAD, 8), 26);
const mid = (f, w) => ({ pts: Array.from({ length: M }, () => [f.pts[M >> 1][0], f.pts[M >> 1][1]]), w });
const P_SH1 = mid(SHINE1, 38), P_SH2 = mid(SHINE2, 38);     // where each wave gathers before it is a shine
const C186 = circleR(186, N), C112 = circleR(112, N), C122 = circleR(122, N);

const BUF = () => ({ R: new Float32Array(N), pts: Array.from({ length: M }, () => [0, 0]) });
const B_L = BUF(), B_R = BUF(), B_E = BUF();

function mixR(RA, RB, k, cA, cB, buf) {
  const R = buf.R;
  for (let i = 0; i < N; i++) R[i] = RA[i] + (RB[i] - RA[i]) * k;
  return { k: 'r', R, cx: lerp(cA[0], cB[0], k), cy: lerp(cA[1], cB[1], k), rot: 0 };
}
/** Mix two strokes. thinFirst: the width gets there ahead of the bending, so a fat bar slims before it curls (no lumps). */
function mixS(A, B, k, buf, thinFirst = false) {
  const pts = buf.pts;
  for (let i = 0; i < M; i++) { pts[i][0] = lerp(A.pts[i][0], B.pts[i][0], k); pts[i][1] = lerp(A.pts[i][1], B.pts[i][1], k); }
  return { k: 's', pts, w: lerp(A.w, B.w, thinFirst ? 1 - Math.pow(1 - k, 2.6) : k) };
}
/** A pill parting into a brace: it slims and moves out as a straight bar first, and curls last (A pill, B bar, Cc brace). */
function partS(A, B, Cc, k, buf) {
  const pts = buf.pts, a = 1 - (1 - k) * (1 - k), b = Math.pow(k, 2.4);
  for (let i = 0; i < M; i++) {
    pts[i][0] = A.pts[i][0] + (B.pts[i][0] - A.pts[i][0]) * a + (Cc.pts[i][0] - B.pts[i][0]) * b;
    pts[i][1] = A.pts[i][1] + (B.pts[i][1] - A.pts[i][1]) * a + (Cc.pts[i][1] - B.pts[i][1]) * b;
  }
  return { k: 's', pts, w: lerp(A.w, Cc.w, 1 - Math.pow(1 - k, 2.6)) };
}
const holdS = (f) => ({ k: 's', pts: f.pts, w: f.w });
const holdR = (f) => ({ k: 'r', R: f.R, cx: f.c[0], cy: f.c[1], rot: 0 });
const circD = (cx, cy, r) => ({ k: 'c', cx, cy, r });
/** A straight bar (k = 0) widening into its half of the film frame (k = 1): a rounded rectangle all the way. */
function barToHalf(side, k) {
  const kc = Math.min(1, k / 0.8);                               // the two halves meet a little before the beat, so no seam is left on it
  const xa = side < 0 ? lerp(-173, -195, k) : lerp(127, -3, kc), xb = side < 0 ? lerp(-127, 3, kc) : lerp(173, 195, k), y = lerp(-200, -220, k);
  const ro = lerp(23, 34, k), ri = lerp(23, 0, k);
  return { k: 'q', x: xa, y, w: xb - xa, h: -2 * y, rr: side < 0 ? [ro, ri, ri, ro] : [ri, ro, ro, ri] };
}
/**
 * A sound wave on its way to being the drop's shine. On the way in it draws together to a point behind the circle
 * (where the shine will be); on the way out the shine grows from that point, on the drop. Never a hairline.
 */
function wave(A, B, P, k1, k2, buf) {
  if (k2 <= 0) return mixS(A, P, k1, buf);
  const d = mixS(P, B, k2, buf);
  d.w = B.w * (1 - (1 - k2) * (1 - k2));
  return d;
}

// where the whole hero sits at each icon, how it arcs between them, how far it turns into each in-between (degrees)
// and along which of its own axes the in-between is stretched
const POS = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [-4, 0], [0, -26]];
const ARC = [[0, -30], [26, -22], [0, 22], [0, -26], [-34, -8], [0, -54]];
const TURN = [-22, -25, 20, -25, 25, -20];
const AXIS = [0, 90, 90, 90, 0, 90];
const STRETCH = 0.12;
const RING0 = [128, 260, 250, 262, 200, 215, 215];   // roughly each icon's reach, for the ring its landing knocks out

// 2x3 matrices [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const mT = (x, y) => [1, 0, 0, 1, x, y];
const mS = (sx, sy, px = 0, py = 0) => [sx, 0, 0, sy, px - sx * px, py - sy * py];
const mR = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
const mAt = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

/** Everything about the hero at local beat lb: its three threads as outlines, the small parts, and where it stands. */
function heroAt(lb) {
  let s = 0;
  while (s < 6 && lb >= LAND[s + 1]) s++;
  // a change: k1 runs 0 to 1 on the way in to the in-between, k2 on the way out of it; between them it is held
  let mi = -1, k1 = 0, k2 = 0, u = 0;
  if (s < 6 && lb > LAND[s + 1] - MD) { const b = LAND[s + 1]; mi = s; k1 = EM(seg(lb, b - MD, b - MD + IN)); k2 = EM(seg(lb, b - OUT, b)); u = seg(lb, b - MD, b); }
  const first = k2 <= 0;
  const tau = lb - LAND[s];                                     // beats since this icon landed
  const h = { s, mi, k1, k2, lb, order: s >= 6 || (mi === 5 && !first) ? 'drop' : s >= 2 ? 'film' : 'cam', L: null, R: null, E: null };

  switch (mi) {
    case 0:   // dot, a wide capsule, camera. The lens opens and the top rises on the way out; the slash strikes last.
      h.L = first ? mixQ(Q_DOT, Q_CAP, k1) : mixQ(Q_CAP, Q_CAM, k2);
      if (!first) {
        h.E = circD(h.L.cx, h.L.cy, 60 * smooth(seg(k2, 0.45, 1)));
        h.cam = { ring: 96 * smooth(seg(k2, 0.2, 0.85)), small: seg(k2, 0.75, 1), hump: smooth(seg(k2, 0.25, 0.9)) };
      }
      break;
    case 1:   // the camera narrows into an upright pill and the slash swells into the same one; the pill parts into two braces
      h.L = first ? mixQ(Q_CAM, Q_PILL, k1) : partS(S_PILL, S_BAR, BRACE, k2, B_L);
      h.R = first ? mixS(SLASH, S_PILL, k1, B_R) : partS(S_PILL, S_BAR_R, BRACE_R, k2, B_R);
      h.E = first ? circD(0, lerp(LENS[1], 12, k1), lerp(60, 36, k1)) : circD(0, lerp(12, 0, k2), lerp(36, 24, k2));
      if (first) { h.cam = { ring: 96 * (1 - smooth(seg(k1, 0, 0.5))), small: 1 - seg(k1, 0, 0.3), hump: 1 - smooth(seg(k1, 0, 0.5)) }; h.knock = 30 * (1 - seg(k1, 0, 0.3)); }
      break;
    case 2:   // the braces pull straight into two bars; the bars widen into the two halves of a film frame
      h.L = first ? mixS(BRACE, S_BAR, k1, B_L) : barToHalf(-1, k2);
      h.R = first ? mixS(BRACE_R, S_BAR_R, k1, B_R) : barToHalf(1, k2);
      h.E = first ? circD(0, 0, lerp(24, 30, k1)) : mixQ(Q_EYE3, Q_WIN, k2);
      if (!first) h.film = { creep: 0, perf: seg(k2, 0.45, 1), split: ease.outCubic(seg(k2, 0.4, 1)) };
      break;
    case 3: { // the film frame rounds off while its lit frame grows to fill it: one circle. The circle draws in to the play triangle and leaves the disc
      const creep = filmCreep(lb) * (1 - k1);
      h.L = first ? mixQ(Q_STRIP, Q_MID4, k1) : mixQ(Q_MID4, Q_DISC, k2);
      h.E = first ? mixQ({ ...Q_WIN, cy: -creep }, Q_EYE4, Math.min(1, k1 * 1.15)) : mixR(C186, TRI.R, k2, [0, 0], TRI.c, B_E);
      if (first && k1 < 1) h.film = { creep, perf: 1 - seg(k1, 0, 0.5), split: 1 - ease.inCubic(seg(k1, 0, 0.6)) };
      break;
    }
    case 4:   // the triangle swells to a circle as the disc closes onto it; the circle is the speaker, the waves come out from behind it
      h.L = first ? mixQ(Q_DISC, Q_MID5, Math.min(1, k1 * 1.2)) : mixS(S_MID5, ARC1, k2, B_L, true);
      h.R = first ? null : mixS(S_MID5, ARC2, k2, B_R, true);
      h.E = first ? mixR(TRI.R, C112, k1, TRI.c, [0, 0], B_E) : mixR(C112, SPK.R, k2, [0, 0], SPK.c, B_E);
      break;
    case 5:   // the speaker rounds into a circle and the waves fly into it; the circle is the drop, the waves its shine
      h.E = first ? mixR(SPK.R, C122, k1, SPK.c, [0, 24], B_E) : mixR(C122, DROPF.R, k2, [0, 24], DROPF.c, B_E);
      h.L = wave(ARC1, SHINE1, P_SH1, k1, k2, B_L);
      h.R = wave(ARC2, SHINE2, P_SH2, k1, k2, B_R);
      break;
    default:  // an icon, held
      if (s === 0) h.L = mixQ(Q_DOT, Q_DOT, 0);
      else if (s === 1) { h.L = mixQ(Q_CAM, Q_CAM, 0); h.E = circD(LENS[0], LENS[1], 60); h.cam = { ring: 96, small: 1, hump: 1 }; }
      else if (s === 2) { h.L = holdS(BRACE); h.R = holdS(BRACE_R); h.E = circD(0, 0, 24); }
      else if (s === 3) { const creep = filmCreep(lb); h.L = barToHalf(-1, 1); h.R = barToHalf(1, 1); h.E = mixQ({ ...Q_WIN, cy: -creep }, Q_WIN, 0); h.film = { creep, perf: 1, split: 1 }; }
      else if (s === 4) { h.L = mixQ(Q_DISC, Q_DISC, 0); h.E = holdR(TRI); h.E.cx += 13 * Math.exp(-tau * 6) * Math.sin((TAU * tau) / 0.4); }   // play: pressed
      else if (s === 5) {
        h.E = holdR(SPK);
        for (const [key, F, buf, d] of [['L', ARC1, B_L, 0.02], ['R', ARC2, B_R, 0.1]]) {                // the waves ring
          const t2 = Math.max(0, tau - d), k = 1 + 0.11 * Math.exp(-t2 * 5.5) * Math.sin((TAU * t2) / 0.42);
          h[key] = { k: 's', w: F.w, pts: F.pts.map((p, i) => { buf.pts[i][0] = 10 + (p[0] - 10) * k; buf.pts[i][1] = p[1] * k; return buf.pts[i]; }) };
        }
      } else { h.E = holdR(DROPF); h.L = holdS(SHINE1); h.R = holdS(SHINE2); }
  }
  // the slash: out of the lens both ways, across the camera exactly on beat 2
  if ((mi === 0 || (s === 1 && mi < 0)) && lb >= STRIKE) {
    const t2 = lb - LAND[1], cx = h.L.cx, cy = h.L.cy;
    const len = t2 < 0 ? SLASH_LEN * ease.inCubic(seg(lb, STRIKE, LAND[1])) : SLASH_LEN * (1 + 0.085 * Math.exp(-t2 * 8) * Math.sin((TAU * t2) / 0.36));
    const pts = B_R.pts;
    for (let i = 0; i < M; i++) { const v = (i / (M - 1)) * 2 - 1; pts[i][0] = cx + SLASH_D[0] * len * v; pts[i][1] = cy + SLASH_D[1] * len * v; }
    h.R = { k: 's', pts, w: lerp(8, SLASH_W, seg(lb, STRIKE, LAND[1])) };
    h.knock = 30 * seg(lb, STRIKE + 0.03, LAND[1]);
  }
  if (h.cam) { h.cam.cx = h.L.cx; h.cam.cy = h.L.cy; h.cam.rot = h.L.rot; h.cam.up = h.L.h / 2; h.cam.bw = h.L.w / Q_CAM.w; }   // its small parts ride on the body

  // ---- where the hero stands ----
  let m = mul(mT(HC.x, HC.y), mS(HS, HS));
  if (mi >= 0) {
    // it arcs to its next place, turns into the in-between and back, and the in-between is stretched along its own axis
    const a = POS[s], b = POS[s + 1], c = [(a[0] + b[0]) / 2 + ARC[mi][0], (a[1] + b[1]) / 2 + ARC[mi][1]], p = smooth(u), v = 1 - p;
    const at = k1 - k2, phi = AXIS[mi] * RAD, k = 1 + STRETCH * at;
    m = mul(mul(m, mT(v * v * a[0] + 2 * v * p * c[0] + p * p * b[0], v * v * a[1] + 2 * v * p * c[1] + p * p * b[1])), mR(TURN[mi] * RAD * at));
    m = mul(mul(mul(m, mR(phi)), mS(k, 1 / k)), mR(-phi));
  } else {
    m = mul(m, mT(POS[s][0], POS[s][1]));
    if (s > 0 && tau < 1.2) {
      // the landing: a squash that rings out
      const q = 0.1 * Math.exp(-tau * 7) * Math.sin((TAU * tau) / 0.36);
      m = mul(m, mS(1 + q, 1 - q));
      if (s === 1) { const sh = 10 * Math.exp(-tau * 9) * Math.sin((TAU * tau) / 0.3); m = mul(m, mT(SLASH_D[0] * sh, SLASH_D[1] * sh)); }   // struck
    }
  }
  if (s === 0 && lb >= ARRIVE) {
    // the dot arrives still shrinking, is smallest exactly on beat 1, springs back, and hops: up tall, down flat; it
    // comes down as its change begins, and the flatness it lands with goes on into the capsule
    const t = lb - ARRIVE, sc = 1 - 0.14 * Math.sin((TAU * t) / 0.28) * Math.exp(-6 * t), t1 = LAND[1] - MD + 0.05;
    const hp = seg(lb, 1.05, t1), st = 1 + 0.08 * Math.sin(1.5 * Math.PI * hp) * (1 - smooth(seg(lb, t1, t1 + 0.15)));
    m = mul(mul(m, mT(0, -56 * Math.sin(Math.PI * hp))), mS(sc / st, sc * st));
  }
  if (s === 6) {
    // the drop hangs heavier and heavier from its tip, lets go, and falls
    const tr = lb - REL;
    const sag = tr < 0 ? ease.inOutCubic(seg(lb, 7.08, REL)) : Math.exp(-tr * 9) * Math.cos((TAU * tr) / 0.3);
    const fall = tr > 0 ? 0.5 * GRAV * tr * tr : 0, v = tr > 0 ? GRAV * tr : 0, ks = 1 + 0.15 * smooth(v / 1400);
    const tip0 = mAt(m, DROP_TIP);                              // where it hung from
    // hanging, it stretches down from its tip; once it has let go the belly keeps its place and the tip snaps down into it
    const hgt = DROP_C[1] + DROP_R - DROP_TIP[1], sx = 1 - 0.06 * sag, sy = 1 + SAG * sag;
    const hang = tr < 0 ? mS(sx, sy, DROP_TIP[0], DROP_TIP[1]) : mul(mT(0, hgt * SAG), mS(sx, sy, 0, DROP_C[1] + DROP_R));
    m = mul(mul(mul(mT(0, fall), m), hang), mS(1 / Math.sqrt(ks), ks, 0, 30));
    h.vy = v;
    // the last of it: a small droplet is left where the drop let go, and follows a moment later
    if (tr > 0) { const td = Math.max(0, tr - 0.12); h.droplet = { x: tip0[0], y: tip0[1] + 22 + 0.5 * GRAV * td * td, r: 17 * ease.outBack(seg(tr, 0, 0.1)), vy: GRAV * td }; }
  }
  h.m = m;
  return h;
}
/** The film creeps upward while it is on screen, so its holes are never still. */
const filmCreep = (lb) => 64 * clamp(lb - 3.92, 0, LAND[4] - MD - 3.92);

export default async function make(ctx) {
  await ctx.font('RH Mono', '/assets/morph/RedHatMono-wght.ttf', { weight: '300 700' });
  const CLEAR = ctx.cues.typing?.clear ?? 1;
  const scratch = ctx.makeCanvas(W, H), sg = scratch.getContext('2d');
  const COS = new Float32Array(N), SIN = new Float32Array(N);
  for (let i = 0; i < N; i++) { COS[i] = Math.cos((i / N) * TAU); SIN[i] = Math.sin((i / N) * TAU); }

  // ---- drawing outlines ----
  function pathR(g, d) {
    const cr = Math.cos(d.rot), sr = Math.sin(d.rot), R = d.R;
    g.moveTo(d.cx + R[0] * cr, d.cy + R[0] * sr);
    for (let i = 1; i < N; i++) g.lineTo(d.cx + R[i] * (COS[i] * cr - SIN[i] * sr), d.cy + R[i] * (SIN[i] * cr + COS[i] * sr));
    g.closePath();
  }
  function fillD(g, d, color, grow = 0) {
    if (!d) return;
    if (d.k === 'r') { g.beginPath(); pathR(g, d); g.fillStyle = color; g.fill(); return; }
    if (d.k === 'q') {
      g.fillStyle = color; g.beginPath();
      if (d.rot) { g.save(); g.translate(d.cx, d.cy); g.rotate(d.rot); g.roundRect(-d.w / 2, -d.h / 2, d.w, d.h, d.rr); g.restore(); } else g.roundRect(d.x, d.y, d.w, d.h, d.rr);
      g.fill();
      return;
    }
    if (d.k === 'c') { if (d.r + grow / 2 <= 0.2) return; g.beginPath(); g.arc(d.cx, d.cy, d.r + grow / 2, 0, TAU); g.fillStyle = color; g.fill(); return; }
    const p = d.pts, w = d.w + grow;
    if (w <= 0.4) return;
    let len = 0;
    for (let i = 1; i < M; i++) len += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (len < 0.75) { g.beginPath(); g.arc(p[0][0], p[0][1], w / 2, 0, TAU); g.fillStyle = color; g.fill(); return; }
    g.beginPath(); g.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < M; i++) g.lineTo(p[i][0], p[i][1]);
    g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
  }

  function drawHero(g, h, P) {
    g.save();
    g.transform(h.m[0], h.m[1], h.m[2], h.m[3], h.m[4], h.m[5]);
    if (h.order === 'drop') {
      fillD(g, h.E, P.eye); fillD(g, h.L, P.L); fillD(g, h.R, P.R);
      g.restore();
      if (h.droplet) { const d = h.droplet, k = 1 + 0.2 * smooth(d.vy / 1200); g.fillStyle = P.eye; g.beginPath(); g.ellipse(d.x, d.y, d.r / Math.sqrt(k), d.r * k, 0, 0, TAU); g.fill(); }
      return;
    }
    fillD(g, h.L, P.L);
    if (h.order === 'film') {
      fillD(g, h.R, P.R);
      if (h.film && h.L.k !== 's' && (!h.R || h.R.k !== 's')) {
        const f = h.film;
        g.save();
        g.beginPath();
        for (const d of [h.L, h.R]) { if (!d) continue; if (d.k === 'q') g.roundRect(d.x, d.y, d.w, d.h, d.rr); else pathR(g, d); }
        g.clip();
        g.fillStyle = P.G;
        for (const sx of [-1, 1]) for (let k = -4; k <= 4; k++) {
          const a = clamp(f.perf * 1.7 - (k + 4) * 0.08);
          if (a <= 0) continue;
          const w = 32 * a, hh = 42 * a, cx = sx * 150, cy = (k + 0.5) * PITCH - f.creep;
          g.beginPath(); g.roundRect(cx - w / 2, cy - hh / 2, w, hh, 9 * a); g.fill();
        }
        if (f.split > 0.01) {
          // the frames above and below run in from outside the strip (and out again)
          g.fillStyle = P.eye;
          for (const sy of [-1, 1]) { g.beginPath(); g.roundRect(-116, sy * (220 + 190 * (1 - f.split)) - 88 - f.creep, 232, 176, 14); g.fill(); }
        }
        g.restore();
      }
      fillD(g, h.E, P.eye);
      g.restore();
      return;
    }
    // the camera's order: body, lens ring, lens, glint, flash window, then the slash on top with a clear edge round it
    if (h.cam) {
      const c = h.cam;
      if (c.hump > 0.02) {
        g.save();
        g.translate(c.cx, c.cy); g.rotate(c.rot); g.translate(0, -c.up); g.scale(c.bw, c.hump);
        g.beginPath(); g.moveTo(HUMP[0][0], HUMP[0][1]);
        for (let i = 1; i < HUMP.length; i++) g.lineTo(HUMP[i][0], HUMP[i][1]);
        g.closePath(); g.fillStyle = P.L; g.fill();
        g.restore();
      }
      if (c.ring > 0.3) { g.beginPath(); g.arc(c.cx, c.cy, c.ring, 0, TAU); g.fillStyle = P.ring; g.fill(); }
    }
    fillD(g, h.E, P.eye);
    if (h.cam && h.cam.small > 0.01) {
      const c = h.cam, a = c.small;
      g.save();
      g.translate(c.cx, c.cy); g.rotate(c.rot);
      g.fillStyle = P.glint;
      g.beginPath(); g.arc(-25, -25, 15 * a, 0, TAU); g.fill();
      g.fillStyle = P.ring;
      g.beginPath(); g.roundRect(156 - 27 * a, -97 - 14 * a, 54 * a, 28 * a, 10 * a); g.fill();
      g.restore();
    }
    if (h.knock > 0.2) fillD(g, h.R, P.G, h.knock);
    fillD(g, h.R, P.R);
    g.restore();
  }

  // ---- lettering: a geometric mono, every letter centred in its cell ----
  const setFont = (g, size, weight) => { g.font = `${weight} ${size}px ${FAM}`; g.textBaseline = 'alphabetic'; g.textAlign = 'center'; };
  function chars(g, s, x, y, size, pitch, color, weight = 500) {
    setFont(g, size, weight);
    g.fillStyle = color;
    for (let i = 0; i < s.length; i++) if (s[i] !== ' ') g.fillText(s[i], x + i * pitch + pitch / 2, y);
  }
  /** One letter, scaled about the middle of its cell (the font and fill are already set). */
  function pop(g, ch, x, y, size, pitch, sc) {
    if (sc <= 0.02) return;
    if (sc === 1) { g.fillText(ch, x + pitch / 2, y); return; }
    g.save();
    g.translate(x + pitch / 2, y - size * 0.3); g.scale(sc, sc);
    g.fillText(ch, 0, size * 0.3);
    g.restore();
  }
  const disc = (g, x, y, r, color, sx = 1) => { if (r <= 0.2) return; g.fillStyle = color; g.beginPath(); g.ellipse(x, y, r * sx, r / sx, 0, 0, TAU); g.fill(); };

  /** The terminal's two rows in one palette. */
  function dockPal(g, env, part, P) {
    const m = env.term, lb = env.lb, A = DOCK.adv, S = DOCK.size;
    if (part !== 'C' && m.last) {
      const o = m.last, x = DOCK.x, y = DOCK.rowB, res = o.kind === 'result';
      const shown = o.kind === 'say' ? o.text.slice(0, o.chars) : o.text, k = o.kind === 'tool' ? o.text.indexOf('(') : 0;
      if (res) {
        g.strokeStyle = P.dim; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(x + 2 * A + 18, y - 44); g.lineTo(x + 2 * A + 18, y - 8); g.lineTo(x + 2 * A + 46, y - 8); g.stroke();
      } else disc(g, x + A / 2, y - 20, 13 * ease.outBack(seg(o.age, 0, 0.22)) * (1 - seg(lb, REL + 0.17, REL + 0.27)), P.cur);     // the bullet is a small dot of the hero's kind
      g.fillStyle = res ? P.dim : P.T;
      const x0 = x + (res ? 5 : 2) * A;
      let wgt = 0;
      for (let i = 0; i < shown.length; i++) {
        if (shown[i] === ' ') continue;
        // each letter grows out of a point, one after another
        // ...and the line leaves the same way, last letter first, as the drop lets go: the drop falls through an empty row
        const gone = (shown.length - 1 - i) * 0.007;
        const a = (o.kind === 'say' ? 1 : seg(o.age, 0.03 + i * 0.011, 0.17 + i * 0.011)) * (1 - seg(lb, REL + gone, REL + 0.1 + gone));
        if (a <= 0) continue;
        const want = i < k ? 600 : 500;
        if (want !== wgt) { setFont(g, S, want); wgt = want; }
        pop(g, shown[i], x0 + i * A, y, S, A, a >= 1 ? 1 : 0.35 + 0.65 * ease.outBack(a));
      }
    }
    if (part === 'B') return;
    const c = m.rowC, x = DOCK.x, y = DOCK.rowC, tx = x + 2 * A, cyc = y - 21;
    const cell = (i) => tx + i * A + A / 2;
    chars(g, '>', x, y, S, A, P.dim, 600);
    setFont(g, S, 500);
    g.fillStyle = P.T;
    if (c.mode === 'cmd') {
      // before the next prompt, the old one's full stop swells into the cursor, which rolls home and takes the letters with it
      const clearAt = m.typing ? m.typing.start - CLEAR : Infinity;
      const e = EM(seg(lb, clearAt - 0.62, clearAt - 0.04)), len = c.text.length;
      const xs = lerp(cell(len - 1), cell(0), e);
      for (let i = 0; i < len; i++) {
        if (c.text[i] === ' ') continue;
        const sc = e <= 0 ? 1 : i === len - 1 ? 0 : clamp((xs - cell(i) - 6) / 30);
        pop(g, c.text[i], tx + i * A, y, S, A, sc);
      }
      if (e > 0) { const k = seg(e, 0, 0.1); disc(g, xs, lerp(y - 6, cyc, k), lerp(6, 14, k), P.cur, 1 + 0.35 * Math.sin(Math.PI * e)); }
    } else {
      for (let i = 0; i < c.n; i++) {
        if (c.text[i] === ' ') continue;
        const a = seg(c.keyAge(i), 0, 0.17);                    // each letter grows out of the cursor as its key is struck
        pop(g, c.text[i], tx + i * A, y, S, A, a >= 1 ? 1 : 0.3 + 0.7 * ease.outBack(a));
      }
      if (c.cursor) {
        // the cursor is a small circle: it hops a cell at every key, and breathes on the beat when the hands are still
        const age = c.n > 0 ? c.keyAge(c.n - 1) : Infinity, hop = c.n > 0 ? EOUT(seg(age, 0, 0.14)) : 1;
        const f = m.ab - Math.floor(m.ab), lit = age < 0.75 ? 1 : smooth(seg(f, 0, 0.07)) * (1 - smooth(seg(f, 0.5, 0.57)));
        disc(g, lerp(cell(Math.max(0, c.n - 1)), cell(c.n), hop), cyc, lerp(6, 14, lit), P.cur, 1 + 0.4 * Math.sin(Math.PI * hop) * (hop < 1 ? 1 : 0));
      }
    }
  }

  /** The flood's circle for a hand-over: Flat Vector's dot, or the default. */
  const dotOf = (env) => {
    const d = env.other && env.otherImpl && env.otherImpl.handoff ? env.otherImpl.handoff(env.otherEnv) : null;
    const o = d && d.dot ? { ...DOT0, ...d.dot, bg: d.bg || DOT0.bg } : DOT0;
    return typeof o.color === 'string' && /^#[0-9a-f]{6}$/i.test(o.color) && typeof o.bg === 'string' && /^#[0-9a-f]{6}$/i.test(o.bg) ? o : { ...o, color: DOT0.color, bg: DOT0.bg };
  };
  /** Palette number to palette. -1 is the picture before this shot; the flood and the dot take the old dot's colour. */
  function palette(i, dot) {
    if (i === -1) { const T = luma(dot.bg) > 0.5 ? C.ink : C.cream; return { pre: true, G: dot.bg, T, L: dot.color, R: dot.color, eye: dot.color, ring: dot.bg, glint: C.cream, cur: dot.color, chrome: false, dim: mixHex(dot.bg, T, 0.62) }; }
    if (dot.color === C.coral) return PAL[i];
    if (i === 0) return { ...PAL[0], G: dot.color, L: dot.color, R: dot.color, T: luma(dot.color) > 0.5 ? C.ink : C.cream, cur: luma(dot.color) > 0.5 ? C.ink : C.cream };
    if (i === 1) return { ...PAL[1], L: dot.color, R: dot.color, eye: dot.color, cur: dot.color };
    return PAL[i];
  }
  /**
   * The beat a wipe's edge is drawn at. Within one frame the director asks for several instants and averages them
   * (motion blur); a colour block's edge takes less than half of that blur, so it stays an edge. Time is slowed to
   * 0.4 around each frame's middle (where a film frame's instants lie) and made up between frames, so the edge's place
   * is still one unbroken function of time. The flood keeps all of its blur.
   */
  const edgeLb = (env, w) => {
    if (w.kind === 'swell' || w.kind === 'shrink' || !env.fps || !env.spb) return env.lb;
    const y = env.t * env.fps, n = Math.round(y), d = y - n, a = Math.abs(d);
    const dw = Math.sign(d) * (a <= 0.25 ? a * 0.4 : 0.1 + (a - 0.25) * 1.6);
    return env.lb + (dw - d) / env.fps / env.spb;
  };
  /** Run draw(palette) once, or once for each side of a wipe's edge. */
  function split(g, env, draw) {
    const st = wipeAt(env.lb), dot = dotOf(env);
    if (!st.w) { draw(palette(st.a, dot)); return; }
    for (const side of [0, 1]) {
      g.save();
      g.beginPath();
      const inside = traceWipe(g, st.w, edgeLb(env, st.w), dot);
      const wantInside = side === 1 ? inside : !inside;
      if (wantInside) g.clip();
      else { g.rect(-2000, -2000, W + 4000, H + 4000); g.clip('evenodd'); }
      draw(palette(side === 1 ? st.b : st.a, dot));
      g.restore();
    }
  }
  function dock(g, env, part) { split(g, env, (P) => dockPal(g, env, part, P)); }

  // ---- the tag, the icon's name and the chain's seven pips ----
  function chrome(g, env, P) {
    const lb = env.lb;
    if (env.tag) chars(g, `${env.tag.num}/${env.tag.of}  ${env.tag.name}`, DOCK.x - 6, 150, 40, 24, P.T, 600);
    let s = 0;
    while (s < 6 && lb >= LAND[s + 1] - 0.16) s++;
    const e = s > 0 ? EM(seg(lb, LAND[s] - 0.16, LAND[s] + 0.14)) : 1;
    const right = 1752, name = (i, dy) => chars(g, NAMES[i], right - NAMES[i].length * 24 + 2, 150 + dy, 40, 24, P.T, 600);
    g.save();
    g.beginPath(); g.rect(1200, 108, 620, 56); g.clip();
    if (e < 1 && s > 0) name(s - 1, -58 * e);
    name(s, 58 * (1 - e));
    g.restore();
    const act = s === 0 ? 0 : s - 1 + e;
    let xr = right - 7;
    for (let k = 6; k >= 0; k--) {
      const wgt = Math.max(0, 1 - Math.abs(k - act)), len = 30 * EM(wgt);
      g.fillStyle = wgt > 0.5 ? P.T : P.dim;
      g.beginPath(); g.roundRect(xr - len - 7, 186, len + 14, 14, 7); g.fill();
      xr -= len + 26;
    }
  }

  /** The whole picture in one palette (without the terminal's rows). */
  function layer(g, env, h, P) {
    const lb = env.lb;
    if (P.pre) {
      if (env.other) { g.drawImage(env.other, 0, 0); return; }
      const dot = dotOf(env);                                    // before the bar line, on its own: the dot waits
      g.fillStyle = P.G; g.fillRect(0, 0, W, H);
      disc(g, dot.x, dot.y, dot.r, dot.color);
      return;
    }
    g.fillStyle = P.G;
    g.fillRect(0, 0, W, H);
    if (!P.chrome) return;
    // every landing knocks one short ring out of the ground, tone on tone
    for (let i = 0; i < LAND.length; i++) {
      const t = (lb - LAND[i]) / 0.34;
      if (t <= 0 || t >= 1) continue;
      g.save();
      g.globalAlpha = Math.min(1, (1 - t) * 2.2);              // it goes while it is still a band, never down to a hairline
      g.strokeStyle = P.rip; g.lineWidth = 12 + 34 * (1 - t);
      g.beginPath(); g.arc(HC.x + POS[i][0] * HS, HC.y + POS[i][1] * HS, Math.min(290, RING0[i] * HS + 24) + 62 * EOUT(t), 0, TAU); g.stroke();
      g.restore();
    }
    drawHero(g, h, P);
    chrome(g, env, P);
  }

  function render(g, env) {
    const lb = env.lb, st = wipeAt(lb), dot = dotOf(env), h = heroAt(Math.max(0, lb));
    layer(g, env, h, palette(st.a, dot));
    if (st.w) {
      sg.setTransform(1, 0, 0, 1, 0, 0);
      layer(sg, env, h, palette(st.b, dot));
      g.save();
      g.beginPath();
      const inside = traceWipe(g, st.w, edgeLb(env, st.w), dot);
      if (inside) g.clip();
      else { g.rect(-2000, -2000, W + 4000, H + 4000); g.clip('evenodd'); }
      g.drawImage(scratch, 0, 0);
      g.restore();
    }
    if (env.noDock) return;
    if (env.other && env.role === 'in' && env.otherImpl && env.otherImpl.dock) swapDock(g, env, dock, seg(lb, 0.04, 1.0));
    else dock(g, env);
  }

  /**
   * For Liquid: the drop every frame, also past the bar line. drop.x, drop.y: the centre of its round belly in frame
   * pixels; drop.r: the belly's radius; drop.tip: its point; drop.vy: its speed down, px a beat. It lets go at local
   * beat `release` and falls at `gravity` px a beat squared; on the bar line (lb 8) the belly's lowest point is on the
   * prompt row's baseline (y 960), centre about (960, 809). `droplet` is the small one that follows it.
   */
  function handoff(env) {
    const lb = env.lb, h = heroAt(Math.max(0, lb)), st = wipeAt(lb), P = palette(st.b ?? st.a, DOT0);
    const sc = Math.sqrt(Math.abs(h.m[0] * h.m[3] - h.m[1] * h.m[2]));
    let c = [0, 0], r = R_DOT;
    if (h.s === 6) { c = DROP_C; r = DROP_R; } else if (h.E) { c = [h.E.cx, h.E.cy]; r = h.E.k === 'c' ? h.E.r : h.E.k === 'q' ? Math.min(h.E.w, h.E.h) / 2 : h.E.R.reduce((a, b) => a + b, 0) / N; }
    const p = mAt(h.m, c), tip = h.s === 6 ? mAt(h.m, DROP_TIP) : null;
    return { drop: { x: p[0], y: p[1], r: r * sc, color: P.eye, shine: P.L, vy: h.vy || 0, tip, released: lb >= REL }, droplet: h.droplet || null, bg: P.G, ink: P.T, release: REL, gravity: GRAV };
  }

  return {
    render, dock, handoff,
    samples(env) {
      const lb = env.lb;
      if (lb < 0 || lb > 9) return 1;
      if (lb < ARRIVE) return 20;                               // the flood's edge crosses the frame in a few frames
      if (lb < LAND[1] - MD) return 8;                          // the dot springs and hops
      if (lb >= REL) return 12;
      for (const b of LAND) { if (lb > b - MD && lb < b) return 20; if (lb >= b && lb < b + 0.3) return 6; }
      return 2;
    },
    sfx: [
      { b: 0, s: 'morph_swell', g: 0.8 },                 // the dot floods the frame and draws back: a soft whoosh out and in, one beat
      { b: 1, s: 'morph_pop1', g: 0.7, a: 'peak' },       // the dot lands
      { b: 2, s: 'morph_pop2', g: 0.8, a: 'peak' },       // camera (and the slash across it)
      { b: 3, s: 'morph_pop3', g: 0.8, a: 'peak' },       // braces
      { b: 4, s: 'morph_pop4', g: 0.8, a: 'peak' },       // film frame
      { b: 5, s: 'morph_pop5', g: 0.85, a: 'peak' },      // play
      { b: 6, s: 'morph_pop6', g: 0.9, a: 'peak' },       // speaker
      { b: 7, s: 'morph_pop7', g: 0.9, a: 'peak' },       // the drop forms
      { b: REL, s: 'morph_drip', g: 0.7, a: 'peak' },                // it lets go
    ],
  };
}
