// The flat city: the fifteen buildings Isometric has just built, one for every shot of this film, now seen from the
// front and standing on the terminal's band, each with its number on its wall. Every one is a rectangle of one colour
// with a roof piece and a grid of windows; nothing has a side, a shadow or a gradient. Some keep what they had in the
// isometric city: 06 and 11 their domes, 07 its stripes, 09 its pitched roof, and 10, the hero shot, is the tallest.

import { C, TAU, clamp, lerp, seg, BACK, rect, rr, disc, bar, poly, about } from './kit.js';

export const GY = 772;                                  // the ground line: the top edge of the terminal's band
export const SUN = { x: 960, y: 255, r: 105 };          // where the dot rests as the sun
export const ROOF8 = GY - 172;                          // the roof the sun bounces on

// Left to right, 01 to 15. layer 0 stands behind layer 1. win: a grid of windows { col, cols, rows, w, h, top, gap,
// x0, x1 } (x0..x1: the part of the wall the grid is set in, for walls half hidden by a neighbour), or { stripes }.
export const BUILDINGS = [
  { n: 1, x: -30, w: 220, h: 240, col: 'sun', layer: 1, roof: 'tank', win: { col: 'ink', cols: 2, rows: 2, w: 34, h: 40, x0: 110, x1: 212 }, nx: 161, rx: 92 },
  { n: 2, x: 120, w: 150, h: 430, col: 'ink', layer: 0, roof: 'antenna', win: { col: 'cream', cols: 2, rows: 2, w: 28, h: 32, x0: 8, x1: 92 } },
  { n: 3, x: 215, w: 180, h: 320, col: 'cream', layer: 1, roof: 'step', win: { col: 'ultra', cols: 3, rows: 3, w: 30, h: 40 } },
  { n: 4, x: 385, w: 150, h: 450, col: 'mint', layer: 0, roof: 'cap', win: { col: 'ink', cols: 2, rows: 6, w: 36, h: 36 } },
  { n: 5, x: 505, w: 185, h: 275, col: 'ink', layer: 1, roof: 'flat', win: { col: 'cream', cols: 2, rows: 3, w: 62, h: 24.93, gap: 22 }, numCol: 'sun' },
  { n: 6, x: 670, w: 120, h: 360, col: 'sun', layer: 0, roof: 'dome', win: { col: 'ink', cols: 1, rows: 4, w: 40, h: 36, x0: 20, x1: 75 } },
  { n: 7, x: 745, w: 130, h: 150, col: 'cream', layer: 1, roof: 'flat', win: { col: 'ultra', stripes: 2 } },
  { n: 8, x: 860, w: 200, h: 172, col: 'mint', layer: 1, roof: 'flat', win: { col: 'ink', cols: 4, rows: 1, w: 28, h: 36 } },
  { n: 9, x: 1045, w: 105, h: 130, col: 'sun', layer: 1, roof: 'gable', win: { col: 'ink', cols: 2, rows: 1, w: 26, h: 30 } },
  { n: 10, x: 1135, w: 115, h: 540, col: 'ink', layer: 0, roof: 'spire', win: { col: 'cream', cols: 2, rows: 8, w: 26, h: 34, x0: 12, x1: 90 } },
  { n: 11, x: 1225, w: 175, h: 300, col: 'cream', layer: 1, roof: 'dome', win: { col: 'ultra', cols: 3, rows: 3, w: 30, h: 38 } },
  { n: 12, x: 1385, w: 145, h: 410, col: 'mint', layer: 0, roof: 'cap', win: { col: 'ink', cols: 2, rows: 5, w: 36, h: 38 } },
  { n: 13, x: 1500, w: 160, h: 255, col: 'sun', layer: 1, roof: 'tank', win: { col: 'ink', cols: 3, rows: 2, w: 28, h: 38 } },
  { n: 14, x: 1640, w: 150, h: 410, col: 'ink', layer: 0, roof: 'antenna', win: { col: 'cream', cols: 2, rows: 5, w: 26, h: 34, x0: 16, x1: 92 } },
  { n: 15, x: 1730, w: 220, h: 290, col: 'mint', layer: 1, roof: 'flat', win: { col: 'ink', cols: 2, rows: 3, w: 30, h: 36, x0: 8, x1: 110 }, nx: 59 },
];
export const B5 = BUILDINGS[4];
const NUM_BASE = 62, WIN_TOP = 82;                      // the number stands at the top of the wall, the windows under it

/** A building's window rectangles in its own space: x from the left wall, y down from the roof. */
export function windowsOf(b) {
  const w = b.win, out = [];
  if (w.stripes) { for (let r = 0; r < w.stripes; r++) out.push({ r, c: 0, x: 16, y: WIN_TOP + r * 30, w: b.w - 32, h: 14 }); return out; }
  const x0 = w.x0 ?? 0, x1 = w.x1 ?? b.w, gx = (x1 - x0 - w.cols * w.w) / (w.cols + 1), top = w.top ?? WIN_TOP, gy = w.gap ?? 20;
  for (let r = 0; r < w.rows; r++) for (let c = 0; c < w.cols; c++) out.push({ r, c, x: x0 + gx + c * (w.w + gx), y: top + r * (w.h + gy), w: w.w, h: w.h });
  return out;
}
/** The one lit window of building 05 in the picture's own coordinates: it is what opens onto the room. */
export const LIT = (() => {
  const q = windowsOf(B5).find((k) => k.r === 1 && k.c === 0);
  return { x: B5.x + q.x, y: GY - B5.h + q.y, w: q.w, h: q.h, r: 1, c: 0 };
})();

/**
 * How a building arrives, over about fourteen frames: up past its height on the style's own curve,
 * cubic-bezier(0.34, 1.56, 0.64, 1), to 1.08, down through 1 to 0.97, and to rest. u is progress 0..1.
 */
export function rise(u) {
  if (u <= 0) return { sx: 0, sy: 0 };
  u = Math.min(1, u);
  let sy;
  if (u < 0.6) { const v = BACK(u / 0.6); sy = v < 1 ? v : 1 + (v - 1) * 0.8; }
  else sy = 1 - 0.03 * Math.sin((Math.PI * (u - 0.6)) / 0.4);
  // a wide sliver at first, a touch thin at the top, a touch wide in the dip
  const sx = sy < 0.9 ? lerp(1.2, 1.05, sy / 0.9) : 1 - 0.5 * (sy - 1);
  return { sx, sy };
}

function roof(g, b, k, blink) {
  // drawn standing on the roof line (y = 0 here), scaled about it: it follows the walls a few frames late
  if (k <= 0.01 || b.roof === 'flat') return;
  const col = C[b.col], w = b.w, light = 10 * (1 + 0.5 * (blink || 0));
  g.save(); g.scale(lerp(1.2, 1, clamp(k)), k);
  switch (b.roof) {
    case 'tank': {
      const x = (b.rx ?? w / 2) - w / 2;
      bar(g, x - 22, 0, x - 22, -22, 6, C.ink); bar(g, x + 22, 0, x + 22, -22, 6, C.ink);
      rr(g, x - 34, -64, 68, 44, 10, b.col === 'cream' ? C.ink : C.cream);
      break;
    }
    case 'antenna':
      bar(g, w * 0.2, 0, w * 0.2, -78, 7, col); disc(g, w * 0.2, -84, light, C.sun);
      rect(g, -w * 0.32, -22, w * 0.3, 23, col);
      break;
    case 'step':
      rect(g, -w * 0.3, -40, w * 0.6, 41, col); rect(g, -w * 0.14, -74, w * 0.28, 35, col);
      break;
    case 'spire':
      rect(g, -w * 0.32, -36, w * 0.64, 37, col); rect(g, -w * 0.16, -66, w * 0.32, 31, col);
      bar(g, 0, -66, 0, -128, 7, col); disc(g, 0, -134, light, C.sun);
      break;
    case 'cap':
      rect(g, -w * 0.28, -34, w * 0.56, 35, col); bar(g, 0, -34, 0, -74, 7, col);
      break;
    case 'gable':
      poly(g, [[-w / 2 - 10, 0], [0, -66], [w / 2 + 10, 0]], C.ink);
      break;
    case 'dome':
      g.fillStyle = b.col === 'cream' ? C.mint : C.cream; g.beginPath(); g.arc(0, 0, w * 0.34, Math.PI, TAU); g.fill();
      break;
    default:
  }
  g.restore();
}

/**
 * One building. st: { u (arrival 0..1), win (0..1, windows popping in turn), roof (0..1.x), sq (extra squash on its
 * height, 1 = none), litPulse (the lit window's swell), blink (mast light), font, label (its number, as printed) }.
 */
export function building(g, b, st) {
  const p = rise(st.u);
  if (p.sy <= 0.001) return;
  const sq = st.sq ?? 1, sy = p.sy * sq, sx = p.sx * (1 + 0.5 * (1 - sq));
  g.save();
  g.translate(b.x + b.w / 2, GY);
  g.scale(sx, sy);
  rect(g, -b.w / 2, -b.h, b.w, b.h + 2, C[b.col]);
  g.save(); g.translate(0, -b.h); roof(g, b, st.roof ?? 1, st.blink); g.restore();
  // its number: which shot of the film it is
  g.fillStyle = C[b.numCol || b.win.col]; g.font = `800 46px ${st.font || 'sans-serif'}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText(st.label ?? String(b.n).padStart(2, '0'), -b.w / 2 + (b.nx ?? b.w / 2), -b.h + NUM_BASE);
  const wins = windowsOf(b), N = wins.length, wk = st.win ?? 1;
  if (wk > 0) wins.forEach((q, i) => {
    const isLit = b === B5 && q.r === LIT.r && q.c === LIT.c;
    // from the top row down, one after another, each with its own small overshoot
    const u = clamp((wk * (N + 4) - i) / 4), s = BACK(u);
    if (s <= 0.01) return;
    const cx = -b.w / 2 + q.x + q.w / 2, cy = -b.h + q.y + q.h / 2;
    let k = s, col = C[b.win.col];
    if (isLit) { col = C.sun; k = s * (1 + 0.5 * (st.litPulse || 0)); }
    rect(g, cx - (q.w / 2) * (b.win.stripes ? 1 : k), cy - (q.h / 2) * k, q.w * (b.win.stripes ? Math.min(1, k) : k), q.h * k, col);
  });
  // a door, on the buildings wide enough to have one
  if (b.layer === 1 && b.w >= 150 && b !== B5) rr(g, -b.w / 2 + (b.nx ?? b.w / 2) - 17, -46 * clamp(wk * 2), 34, 48, [10, 10, 0, 0], C[b.win.col]);
  g.restore();
}

/** Street trees, the simplest there are: a round crown on a stem, one colour. They come up after the buildings. */
export const TREES = [
  { x: 206, s: 1.0, col: 'mint' }, { x: 356, s: 0.8, col: 'mint' }, { x: 548, s: 0.9, col: 'mint' }, { x: 712, s: 1.05, col: 'mint' },
  { x: 1176, s: 0.85, col: 'mint' }, { x: 1262, s: 1.0, col: 'mint' }, { x: 1372, s: 0.8, col: 'mint' }, { x: 1632, s: 1.0, col: 'cream' }, { x: 1706, s: 0.85, col: 'mint' },
];
export function tree(g, t, k, lean = 0) {
  if (k <= 0.01) return;
  g.save(); g.translate(t.x, GY); g.rotate(lean); g.scale(t.s * lerp(1.25, 1, clamp(k)), t.s * k);
  rect(g, -4, -46, 8, 48, C[t.col]); disc(g, 0, -62, 27, C[t.col]);
  g.restore();
}

/** A cloud in the flat way: capsules laid on one another. (x, y) is its left end; s scales it. */
export function cloud(g, x, y, s = 1, col = C.cream) {
  rr(g, x, y + 34 * s, 250 * s, 46 * s, 23 * s, col);
  rr(g, x + 46 * s, y, 150 * s, 60 * s, 30 * s, col);
  rr(g, x + 120 * s, y + 18 * s, 96 * s, 44 * s, 22 * s, col);
}
// each comes in just behind the run of buildings as it passes below
export const CLOUDS = [
  { x: 520, y: 236, s: 0.8, from: -1, t0: 1.8, drift: 5 },
  { x: 1296, y: 196, s: 0.55, from: 1, t0: 2.3, drift: 9 },
  { x: 1450, y: 96, s: 1.0, from: 1, t0: 2.55, drift: 7 },
];
/** A bird: two wings on one joint, beating. */
export function bird(g, x, y, s, flap, col = C.ink) {
  const a = 0.25 + 0.6 * flap;
  bar(g, x, y, x - 26 * s * Math.cos(a), y - 26 * s * Math.sin(a), 6 * s, col);
  bar(g, x, y, x + 26 * s * Math.cos(a), y - 26 * s * Math.sin(a), 6 * s, col);
}
export { about, seg };
