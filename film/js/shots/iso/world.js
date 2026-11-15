// The Isometric shot's world: palette, the true-isometric camera, the solids it is built from, the city plan and its
// fifteen buildings. Everything is drawn on a 2D canvas with matrices, one face at a time (the classic "SSR" way:
// each face is a flat drawing sheared into place), and sorted back to front by where it stands on the ground.
//
// Units: one tile. The ground is the plane y = 0, x runs right-and-down on screen, z left-and-down, y up.
// The sheet the city stands on is 16 x 9 tiles: exactly the 1920 x 1080 frame at 120 px a tile, seen from above.

import { clamp, lerp, seg, ease, hash } from '../../util.js';

export const TILE = 120;                 // px of the flat poster to one tile
export const NX = 16, NZ = 9;
export const ISO_A = Math.PI / 4, ISO_E = Math.atan(Math.SQRT1_2);   // 45 degrees round, 35.264 degrees up: true isometric

// ---------------------------------------------------------------------------------------------------------------------
// Colour

export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const css = (c, a = 1) => (a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
export const toHex = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

export const PAL = {
  void0: hex('#FFEFE4'), voidM: hex('#EEE5FD'), void1: hex('#CDC1F6'),   // the pastel void: warm light top left, periwinkle bottom right
  ground: hex('#7669CC'), tileHi: hex('#8175D3'), road: hex('#CFC7F6'), pad: hex('#E7E2FC'), lawn: hex('#86D9B6'),
  slabL: hex('#8577DC'), slabR: hex('#5F52BE'), under: hex('#4A3F8F'),
  white: hex('#F8F5FF'), mint: hex('#7ADAB4'), peach: hex('#FFB28F'), sky: hex('#7FBAF7'), lilac: hex('#BBA7F4'),
  butter: hex('#FFD873'), pink: hex('#F6A4C9'), coral: hex('#FF7557'),
  shade: hex('#4A3F8F'),                                  // what shadows are tinted with: never grey
  ink: hex('#262068'), glass: hex('#4858C6'), lit: hex('#FFF0BD'),
  leaf: hex('#5CC99C'), leaf2: hex('#8BE2BD'), trunk: hex('#8E74C4'),
};
const WHITE = [255, 255, 255], AMBER = hex('#F2BE7C');

/** The three tones of one solid: top (lit most), the face toward the light (+z), the face away from it (+x). */
export function tones(base) {
  return { top: mixc(base, WHITE, 0.4), left: mixc(base, PAL.shade, 0.15), right: mixc(base, PAL.shade, 0.76), deep: mixc(base, PAL.shade, 0.86) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Camera: orthographic, turned `a` round the vertical and looking down by `e`. No perspective anywhere.

export function camera(a, e, S, fx, fz, atx, aty) {
  const ca = Math.cos(a), sa = Math.sin(a), se = Math.sin(e), ce = Math.cos(e);
  const ax = ca * S, az = -sa * S, bx = sa * se * S, bz = ca * se * S, by = -ce * S;
  const ox = atx - (ax * fx + az * fz), oy = aty - (bx * fx + bz * fz);
  return {
    a, e, S, ax, az, bx, bz, by, ox, oy, sa, ca,
    X: (x, z) => ax * x + az * z + ox,
    Y: (x, y, z) => bx * x + bz * z + by * y + oy,
    P: (x, y, z) => [ax * x + az * z + ox, bx * x + bz * z + by * y + oy],
    key: (x, z) => sa * x + ca * z,                    // bigger = nearer the camera = drawn later
    walls: ce > 0.02,                                  // seen from straight above there are no walls to draw
  };
}

/** Draw in the ground plane (or a plane at height y): one unit = one tile, x right, z down. */
export const onTop = (g, c, x = 0, y = 0, z = 0) => g.setTransform(c.ax, c.bx, c.az, c.bz, c.X(x, z), c.Y(x, y, z));
/** Draw on a wall that faces +z (the lit face): u along x from the wall's left end, v up. */
export const onLeft = (g, c, x, y, z) => g.setTransform(c.ax, c.bx, 0, c.by, c.X(x, z), c.Y(x, y, z));
/** Draw on a wall that faces +x (the shaded face): u from the near corner back along -z, v up. */
export const onRight = (g, c, x, y, z) => g.setTransform(-c.az, -c.bz, 0, c.by, c.X(x, z), c.Y(x, y, z));
export const offPlane = (g) => g.setTransform(1, 0, 0, 1, 0, 0);

function poly(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
}

// ---------------------------------------------------------------------------------------------------------------------
// Solids

/**
 * A box. o: { tn (tones), win (windows spec), lit(i) -> 0..1, roofY (a roof that lags below the wall tops),
 * roof(g) (draw on the roof, in tiles, origin at its back corner), glow }.
 */
export function box(g, c, x, z, w, d, y, h, o) {
  const tn = o.tn;
  if (h <= 0.001 && !o.flatOK) return;
  const top = y + h, roofY = o.roofY === undefined ? top : Math.min(top, o.roofY);
  if (c.walls) {
    // one dark shape under everything, so no light shows through where two faces meet
    offPlane(g);
    poly(g, [c.P(x, top, z + d), c.P(x, top, z), c.P(x + w, top, z), c.P(x + w, y, z), c.P(x + w, y, z + d), c.P(x, y, z + d)]);
    g.fillStyle = css(tn.right); g.fill();
    if (roofY < top - 0.004) {
      // the roof has not caught up with the walls yet: we look into an open box
      onRight(g, c, x, roofY, z + d); g.fillStyle = css(mixc(tn.deep, PAL.shade, 0.35)); g.fillRect(0, 0, d, top - roofY);
      onLeft(g, c, x, roofY, z); g.fillStyle = css(mixc(tn.deep, PAL.shade, 0.12)); g.fillRect(0, 0, w, top - roofY);
    }
  }
  // roof
  onTop(g, c, x, roofY, z);
  g.fillStyle = css(tn.top); g.fillRect(0, 0, w, d);
  if (o.rim !== false && w > 0.5 && d > 0.5) {         // a low parapet: an inset line of shade and light
    const r = o.rim || 0.09;
    g.fillStyle = css(mixc(tn.top, tn.left, 0.55)); g.fillRect(r, r, w - 2 * r, d - 2 * r);
    g.fillStyle = css(mixc(tn.top, WHITE, 0.25)); g.fillRect(r + 0.035, r + 0.035, w - 2 * r - 0.035, d - 2 * r - 0.035);
  }
  if (o.roof) o.roof(g, w, d);
  if (!c.walls) return;
  // lit wall (+z)
  onLeft(g, c, x, y, z + d);
  let gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, css(mixc(tn.left, PAL.shade, 0.4))); gr.addColorStop(Math.min(0.4, 0.2 / Math.max(h, 0.3)), css(mixc(tn.left, PAL.shade, 0.2))); gr.addColorStop(Math.min(0.9, 1.3 / Math.max(h, 0.3)), css(tn.left)); gr.addColorStop(1, css(mixc(tn.left, WHITE, 0.12)));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  if (o.win) windows(g, w, h, o.win, o, 0, tn.left);
  // shaded wall (+x)
  if (c.sa > 0.02) {
    onRight(g, c, x + w, y, z + d);
    gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, css(mixc(tn.right, PAL.shade, 0.5))); gr.addColorStop(Math.min(0.4, 0.2 / Math.max(h, 0.3)), css(mixc(tn.right, PAL.shade, 0.26))); gr.addColorStop(Math.min(0.9, 1.3 / Math.max(h, 0.3)), css(tn.right)); gr.addColorStop(1, css(mixc(tn.right, tn.left, 0.12)));
    g.fillStyle = gr; g.fillRect(0, 0, d, h);
    if (o.win) windows(g, d, h, o.win, o, 1, tn.right);
  }
  // a bright edge where the roof meets the lit wall
  offPlane(g);
  const a = c.P(x, top, z + d), b = c.P(x + w, top, z + d), e2 = c.P(x + w, top, z);
  g.strokeStyle = css(WHITE, 0.6); g.lineWidth = Math.max(1, c.S * 0.014); g.lineCap = 'round';
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  g.strokeStyle = css(WHITE, 0.28);
  g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(e2[0], e2[1]); g.stroke();
}

/** Rows of windows on a wall w x h (already in the wall's own space). Each one is glass until it is lit. */
function windows(g, w, h, win, o, side, wall) {
  const mx = win.mx ?? 0.16, my = win.my ?? 0.2, gap = win.gap ?? 0.1, wh = win.h ?? 0.3;
  const cols = Math.max(1, Math.round((w - 2 * mx + gap) / ((win.w ?? 0.24) + gap)));
  const ww = (w - 2 * mx - (cols - 1) * gap) / cols;
  const rows = win.rows ?? Math.max(1, Math.floor((h * (o.full ?? 1) - my - 0.08) / (wh + (win.vgap ?? 0.16))));
  const pitch = (h - my - (win.topM ?? 0.16) - wh) / Math.max(1, rows - 1);
  const glass = side ? mixc(PAL.glass, PAL.shade, 0.4) : mixc(PAL.glass, wall, 0.1), litc = side ? AMBER : PAL.lit;
  for (let r = 0; r < rows; r++) {
    const v = rows === 1 ? (h - wh) / 2 : my + r * pitch;
    for (let i = 0; i < cols; i++) {
      const id = (o.id || 0) * 97 + side * 31 + r * 7 + i;
      const on = o.lit ? o.lit(r, i, side, id) : 0;
      const dark = hash(id * 1.37) < (win.off ?? (side ? 0.52 : 0.4));
      const k = dark ? 0 : on;
      g.fillStyle = css(mixc(glass, litc, k));
      const u = mx + i * (ww + gap);
      if (g.roundRect) { g.beginPath(); g.roundRect(u, v, ww, wh, Math.min(ww, wh) * 0.22); g.fill(); } else g.fillRect(u, v, ww, wh);
      if (k < 0.5) { g.fillStyle = css(WHITE, 0.2); g.fillRect(u + ww * 0.12, v + wh * 0.6, ww * 0.3, wh * 0.22); }   // a glint on dark glass
    }
  }
}

/** An upright cylinder: two ellipses and the wall between them, lit from the left. */
export function cyl(g, c, cx, cz, r, y, h, o) {
  const tn = o.tn, X = c.X(cx, cz), Y0 = c.Y(cx, y, cz), Y1 = c.Y(cx, y + h, cz);
  const rx = r * c.S, ry = r * c.S * Math.sin(c.e);
  offPlane(g);
  if (c.walls && h > 0.001) {
    const gr = g.createLinearGradient(X - rx, 0, X + rx, 0);
    gr.addColorStop(0, css(mixc(tn.left, WHITE, 0.16))); gr.addColorStop(0.28, css(tn.left)); gr.addColorStop(0.74, css(tn.right)); gr.addColorStop(1, css(mixc(tn.right, PAL.shade, 0.32)));
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(X, Y0, rx, ry, 0, 0, Math.PI); g.lineTo(X - rx, Y1); g.ellipse(X, Y1, rx, ry, 0, Math.PI, 0, true); g.closePath(); g.fill();
    // contact shade at the foot
    const gv = g.createLinearGradient(0, Y0 + ry, 0, Y0 + ry - Math.min(0.5, h) * -c.by);
    gv.addColorStop(0, css(PAL.shade, 0.4)); gv.addColorStop(1, css(PAL.shade, 0));
    g.fillStyle = gv; g.fill();
    if (o.bands) {
      // ring windows: bands that wrap the wall
      const n = o.bands, lit = o.lit;
      for (let i = 0; i < n; i++) {
        const v = y + h * ((i + 0.7) / (n + 0.6)), Yb = c.Y(cx, v, cz), bh = Math.min(0.26, (h / n) * 0.42) * -c.by;
        const k = lit ? lit(i, 0, 0, (o.id || 0) * 97 + i) : 0;
        const gb = g.createLinearGradient(X - rx, 0, X + rx, 0);
        const a0 = mixc(PAL.glass, PAL.lit, k), a1 = mixc(mixc(PAL.glass, tn.right, 0.35), mixc(PAL.lit, PAL.peach, 0.4), k);
        gb.addColorStop(0, css(a0)); gb.addColorStop(0.45, css(a0)); gb.addColorStop(1, css(a1));
        g.fillStyle = gb;
        g.beginPath(); g.ellipse(X, Yb, rx * 0.985, ry * 0.985, 0, 0.12, Math.PI - 0.12); g.ellipse(X, Yb - bh, rx * 0.985, ry * 0.985, 0, Math.PI - 0.12, 0.12, true); g.closePath(); g.fill();
      }
    }
  }
  const Yr = o.roofY === undefined ? Y1 : c.Y(cx, Math.min(y + h, o.roofY), cz);
  if (Yr > Y1 + 0.5) {                                 // looking into the open top
    g.fillStyle = css(tn.deep); g.beginPath(); g.ellipse(X, Y1, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.ellipse(X, Y1, rx, ry, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = css(tn.top); g.beginPath(); g.ellipse(X, Yr, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  } else {
    g.fillStyle = css(tn.top); g.beginPath(); g.ellipse(X, Y1, rx, ry, 0, 0, Math.PI * 2); g.fill();
    if (o.rim !== false && r > 0.3) {
      g.fillStyle = css(mixc(tn.top, tn.left, 0.55)); g.beginPath(); g.ellipse(X, Y1, rx * 0.84, ry * 0.84, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = css(mixc(tn.top, WHITE, 0.25)); g.beginPath(); g.ellipse(X + rx * 0.03, Y1 + ry * 0.05, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2); g.fill();
    }
  }
  g.strokeStyle = css(WHITE, 0.55); g.lineWidth = Math.max(1, c.S * 0.014);
  g.beginPath(); g.ellipse(X, Y1, rx, ry, 0, Math.PI * 0.55, Math.PI * 1.02); g.stroke();
}

/** A dome: half a ball standing on height y. A ball looks like a circle from every side. */
export function dome(g, c, cx, cz, r, y, o, k = 1) {
  const tn = o.tn, X = c.X(cx, cz), Y = c.Y(cx, y, cz), R = r * c.S, ry = R * Math.sin(c.e);
  if (!c.walls || k <= 0.01) return;
  offPlane(g);
  const up = R * Math.cos(c.e) * k;                     // how far the crown stands above the base on screen
  g.beginPath();
  g.ellipse(X, Y, R, ry, 0, 0, Math.PI);
  g.ellipse(X, Y, R, Math.max(ry, up), 0, Math.PI, 0);
  g.closePath();
  const gr = g.createRadialGradient(X - R * 0.38, Y - up * 0.62, R * 0.05, X, Y - up * 0.2, R * 1.25);
  gr.addColorStop(0, css(mixc(tn.top, WHITE, 0.6))); gr.addColorStop(0.45, css(tn.left)); gr.addColorStop(1, css(tn.right));
  g.fillStyle = gr; g.fill();
  if (o.slit) {                                        // an observatory's slit
    g.strokeStyle = css(mixc(PAL.glass, PAL.lit, o.slit)); g.lineWidth = R * 0.14; g.lineCap = 'round';
    g.beginPath(); g.moveTo(X - R * 0.1, Y - up * 0.96); g.quadraticCurveTo(X - R * 0.42, Y - up * 0.7, X - R * 0.5, Y - up * 0.12 + ry * 0.7); g.stroke();
  }
}

/** A pitched roof over a box footprint, ridge along x. */
export function gable(g, c, x, z, w, d, y, h, tn) {
  if (!c.walls || h <= 0.001) return;
  offPlane(g);
  const zr = z + d / 2;
  poly(g, [c.P(x, y, z + d), c.P(x + w, y, z + d), c.P(x + w, y + h, zr), c.P(x, y + h, zr)]);
  const a = c.P(x, y, z + d), b = c.P(x, y + h, zr);
  const gr = g.createLinearGradient(a[0], a[1], b[0] + (a[0] - b[0]), b[1]);
  gr.addColorStop(0, css(mixc(tn.left, PAL.shade, 0.12))); gr.addColorStop(1, css(mixc(tn.left, WHITE, 0.22)));
  g.fillStyle = gr; g.fill();
  poly(g, [c.P(x + w, y, z + d), c.P(x + w, y, z), c.P(x + w, y + h, zr)]);
  g.fillStyle = css(tn.right); g.fill();
  const r0 = c.P(x, y + h, zr), r1 = c.P(x + w, y + h, zr);
  g.strokeStyle = css(WHITE, 0.6); g.lineWidth = Math.max(1, c.S * 0.016); g.lineCap = 'round';
  g.beginPath(); g.moveTo(r0[0], r0[1]); g.lineTo(r1[0], r1[1]); g.stroke();
}

/** A little cube (the cursor, packets, crates): centre of its foot at (x, y, z), edge s tiles. */
export function cube(g, c, x, y, z, s, base, alpha = 1, h = s) {
  const tn = { top: mixc(base, WHITE, 0.38), left: base, right: mixc(base, PAL.shade, 0.34) };
  const x0 = x - s / 2, z0 = z - s / 2;
  offPlane(g);
  g.globalAlpha *= alpha;
  poly(g, [c.P(x0, y + h, z0 + s), c.P(x0, y + h, z0), c.P(x0 + s, y + h, z0), c.P(x0 + s, y, z0), c.P(x0 + s, y, z0 + s), c.P(x0, y, z0 + s)]); g.fillStyle = css(tn.right); g.fill();
  poly(g, [c.P(x0, y + h, z0), c.P(x0 + s, y + h, z0), c.P(x0 + s, y + h, z0 + s), c.P(x0, y + h, z0 + s)]); g.fillStyle = css(tn.top); g.fill();
  poly(g, [c.P(x0, y, z0 + s), c.P(x0 + s, y, z0 + s), c.P(x0 + s, y + h, z0 + s), c.P(x0, y + h, z0 + s)]); g.fillStyle = css(tn.left); g.fill();
  g.globalAlpha /= alpha || 1;
}

/** A tree: a trunk and a ball of leaves, popped up by k (0..1 and a little over). */
export function tree(g, c, x, z, s, k, kind = 0) {
  if (k <= 0.01) return;
  offPlane(g);
  const X = c.X(x, z), Y = c.Y(x, 0, z), up = -c.by, R = s * 0.34 * c.S * k;
  g.fillStyle = css(PAL.trunk);
  g.fillRect(X - c.S * 0.035, Y - s * 0.42 * up * k, c.S * 0.07, s * 0.42 * up * k);
  if (kind === 1) {
    // a cone
    const h = s * 1.05 * up * k, by = Y - s * 0.22 * up * k, w = s * 0.3 * c.S * k;
    const gr = g.createLinearGradient(X - w, 0, X + w, 0);
    gr.addColorStop(0, css(PAL.leaf2)); gr.addColorStop(0.5, css(PAL.leaf)); gr.addColorStop(1, css(mixc(PAL.leaf, PAL.shade, 0.5)));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(X, by - h); g.lineTo(X + w, by); g.ellipse(X, by, w, w * Math.sin(c.e), 0, 0, Math.PI); g.closePath(); g.fill();
    return;
  }
  const cy = Y - (s * 0.42 * up + R * 0.72) * (k > 1 ? 1 : k);
  const gr = g.createRadialGradient(X - R * 0.4, cy - R * 0.45, R * 0.05, X, cy, R * 1.1);
  gr.addColorStop(0, css(mixc(PAL.leaf2, WHITE, 0.35))); gr.addColorStop(0.45, css(PAL.leaf)); gr.addColorStop(1, css(mixc(PAL.leaf, PAL.shade, 0.55)));
  g.fillStyle = gr;
  g.beginPath(); g.arc(X, cy, R, 0, Math.PI * 2); g.fill();
}

// ---------------------------------------------------------------------------------------------------------------------
// The plan: five columns of three lots, streets between them, a railway along the front edge.

export const LOT = 2;
export const COLS = [1, 4, 7, 10, 13], ROWS = [0.3, 3.1, 5.9];
export const STREETS_NS = [3.5, 6.5, 9.5, 12.5];          // centre lines (x), 1 tile wide, running along z
export const STREETS_EW = [2.7, 5.5];                      // centre lines (z), 0.8 wide, running along x
export const RAIL_Z = 8.48;
export const SHADOW = { x: 0.78, z: -0.4 };               // where the top of a 1-tile post throws its shadow

const N = (i) => String(i).padStart(2, '0');

const B = (x, z, w, d, h, col, win = null, extra = {}) => ({ kind: 'box', x, z, w, d, h, col, win, ...extra });
const C = (cx, cz, r, h, col, bands = 0) => ({ kind: 'cyl', cx, cz, r, h, col, bands });
const WIN = { w: 0.24, h: 0.3 }, WIN1 = { rows: 1, w: 0.26, h: 0.34, my: 0.3 };

/**
 * The fifteen buildings, in the order they are written: column by column, back row to front, so each new one rises
 * in front of the last. parts are in the lot's own coordinates (0..2, 0..2); solids stack bottom to top, things
 * marked `on` stand on the solid with that index. num says where the building's number is painted.
 */
const DEFS = [
  // 01 line: a slender white tower with one thin mast
  { c: 'white', parts: [B(0.4, 0.4, 1.2, 1.2, 3.5, 'white', { w: 0.2, h: 0.26 }), { kind: 'mast', cx: 0.62, cz: 0.62, h: 0.8, on: 0 }], num: { on: 0, x: 1.03, z: 1.08, cap: 0.56 }, trees: [[0.2, 1.8, 0.8, 1]] },
  // 02 boil: a warm block with a penthouse
  { c: 'peach', parts: [B(0.2, 0.25, 1.6, 1.5, 1.9, 'peach', WIN), B(0.32, 0.36, 0.62, 0.5, 0.45, 'white', { rows: 1, w: 0.2, h: 0.2, my: 0.12 }, { on: 0 })], num: { on: 0, x: 1.05, z: 1.32, cap: 0.56 }, trees: [[1.9, 1.9, 0.62, 0]] },
  // 03 bauhaus: a low hall and a drum, two pure solids side by side
  { c: 'butter', parts: [B(0.1, 0.3, 1.22, 1.45, 0.95, 'butter', WIN1), { ...C(1.6, 0.78, 0.34, 1.55, 'sky', 3), on: -1 }], num: { on: 0, x: 0.71, z: 1.03, cap: 0.56 }, trees: [[1.75, 1.75, 0.7, 0]] },
  // 04 iso: a stepped tower, three boxes
  { c: 'mint', parts: [B(0.12, 0.12, 1.76, 1.76, 1.5, 'mint', WIN), B(0.28, 0.28, 1.44, 1.44, 1.3, 'white', { w: 0.22, h: 0.3 }), B(0.44, 0.44, 1.12, 1.12, 1.2, 'mint', { w: 0.2, h: 0.28 })], num: { on: 2, x: 1.0, z: 1.02, cap: 0.56 }, trees: [] },
  // 05 flat: a thin slab with a roof garden at one end
  { c: 'sky', parts: [B(0.15, 0.45, 1.7, 1.1, 2.5, 'sky', { w: 0.22, h: 0.3 }), { kind: 'garden', x: 0.25, z: 0.56, w: 0.46, d: 0.88, on: 0 }], num: { on: 0, x: 1.27, z: 1.0, cap: 0.56 }, trees: [[0.3, 1.84, 0.66, 0], [1.2, 1.86, 0.58, 0]] },
  // 06 morph: a drum with a small dome
  { c: 'lilac', parts: [C(1, 1, 0.86, 1.2, 'lilac', 2), { kind: 'dome', cx: 0.62, cz: 0.6, r: 0.28, col: 'pink', on: 0 }], num: { on: 0, x: 1.08, z: 1.2, cap: 0.54 }, trees: [[0.14, 0.2, 0.56, 1]] },
  // 07 liquid: a tall round tower
  { c: 'sky', parts: [C(1, 1, 0.74, 4.6, 'sky', 8), { kind: 'mast', cx: 0.66, cz: 0.6, h: 0.7, on: 0 }], num: { on: 0, x: 1.03, z: 1.06, cap: 0.54 }, trees: [[0.15, 1.85, 0.74, 0]] },
  // 08 sticker: a white block with a sign along the back of its roof
  { c: 'white', parts: [B(0.2, 0.2, 1.6, 1.6, 2.2, 'white', { w: 0.26, h: 0.32 }), B(0.36, 0.3, 1.28, 0.12, 0.6, 'coral', null, { on: 0, tag: 'sign' })], num: { on: 0, x: 1.02, z: 1.2, cap: 0.56 }, trees: [] },
  // 09 pixel: a small house with a pitched roof
  { c: 'white', parts: [B(0.2, 0.3, 1.6, 1.5, 0.75, 'white', { rows: 1, w: 0.24, h: 0.3, my: 0.22 }), { kind: 'gable', x: 0.14, z: 0.24, w: 1.72, d: 1.62, h: 0.72, col: 'coral' }], num: { slope: 1, cap: 0.52 }, trees: [[1.9, 1.9, 0.5, 1]] },
  // 10 synth: the hero. The tallest tower, three tiers, a striped sun on its spire and its number on the wall
  { c: 'peach', hero: true, parts: [B(0.2, 0.2, 1.6, 1.6, 3.35, 'peach', { w: 0.24, h: 0.3, topM: 1.0 }), B(0.44, 0.44, 1.12, 1.12, 2.0, 'pink', { w: 0.2, h: 0.28 }), B(0.68, 0.68, 0.64, 0.64, 0.7, 'butter'), { kind: 'sun', cx: 1, cz: 1, h: 1.1, on: 2 }], num: { wall: 0, cap: 0.56 }, trees: [] },
  // 11 hud: an observatory
  { c: 'mint', parts: [B(0.2, 0.2, 1.6, 1.6, 1.3, 'mint', { w: 0.24, h: 0.3, my: 0.24 }), { kind: 'dome', cx: 0.74, cz: 0.72, r: 0.46, col: 'white', slit: true, on: 0 }, { kind: 'mast', cx: 1.6, cz: 0.4, h: 0.9, on: 0 }], num: { on: 0, x: 1.2, z: 1.46, cap: 0.54 }, trees: [[0.16, 1.86, 0.58, 0]] },
  // 12 collage: two boxes of different stock, side by side
  { c: 'peach', parts: [B(0.1, 0.2, 1.16, 1.5, 1.5, 'peach', WIN), { ...B(1.26, 0.62, 0.62, 1.2, 0.95, 'sky', { rows: 1, w: 0.22, h: 0.3, my: 0.3 }), on: -1 }], num: { on: 0, x: 0.69, z: 0.98, cap: 0.56 }, trees: [[1.84, 0.26, 0.56, 1]] },
  // 13 soft: a lilac tower with a white crown
  { c: 'lilac', parts: [B(0.28, 0.28, 1.44, 1.44, 3.2, 'lilac', WIN), B(0.44, 0.44, 1.12, 1.12, 0.5, 'white', { rows: 1, w: 0.18, h: 0.2, my: 0.15 })], num: { on: 1, x: 1.01, z: 1.03, cap: 0.56 }, trees: [[0.16, 1.86, 0.66, 0]] },
  // 14 aurora: a glass slab
  { c: 'mint', parts: [B(0.42, 0.14, 1.16, 1.72, 2.8, 'mint', { w: 0.34, h: 0.4, gap: 0.07, vgap: 0.1, mx: 0.1, off: 0, aurora: true })], num: { on: 0, x: 1.01, z: 1.02, cap: 0.56 }, trees: [[0.18, 1.82, 0.6, 0], [0.16, 0.9, 0.5, 1]] },
  // 15 variety: a low hall with a phone standing on its roof
  { c: 'peach', parts: [B(0.16, 0.24, 1.68, 1.52, 1.1, 'peach', { rows: 1, w: 0.26, h: 0.36, my: 0.36 }), B(0.36, 0.36, 0.62, 0.12, 1.05, 'white', null, { on: 0, tag: 'phone' })], num: { on: 0, x: 1.12, z: 1.3, cap: 0.56 }, trees: [[1.87, 1.88, 0.56, 0]] },
];

const isSolid = (p) => (p.kind === 'box' || p.kind === 'cyl' || p.kind === 'gable') && p.on === undefined;

export const BUILDINGS = DEFS.map((d, i) => {
  const col = Math.floor(i / 3), row = i % 3;
  const x0 = COLS[4 - col], z0 = ROWS[row];      // 01 stands at the right-hand end: the city is built toward the far corner, up and to the left
  let y = 0;
  for (const p of d.parts) { if (isSolid(p)) { p.y = y; y += p.h; } }
  const ext = (p) => (p.kind === 'cyl' ? [p.cx - p.r, p.cx + p.r, p.cz - p.r, p.cz + p.r] : [p.x, p.x + p.w, p.z, p.z + p.d]);
  const grounded = d.parts.filter((p) => isSolid(p) || p.on === -1).map(ext);
  return {
    i, num: N(i + 1), numAt: d.num, col, row, x0, z0, cx: x0 + 1, cz: z0 + 1, base: PAL[d.c], colName: d.c, parts: d.parts, H: y, hero: !!d.hero,
    foot: { x0: x0 + Math.min(...grounded.map((e) => e[0])), x1: x0 + Math.max(...grounded.map((e) => e[1])), z0: z0 + Math.min(...grounded.map((e) => e[2])), z1: z0 + Math.max(...grounded.map((e) => e[3])) },
    trees: d.trees.map(([tx, tz, s, kind], k) => ({ x: x0 + tx, z: z0 + tz, s, kind, k })),
  };
});

/** Trees and bushes that belong to no lot: the lawns at both ends and the strip by the railway. */
export const PARK = (() => {
  const out = [];
  let n = 0;
  for (let z = 0.75; z < 7.6; z += 0.98) { const j = hash(n * 3.3); out.push({ x: 0.36 + j * 0.3, z: z + hash(n * 5.1) * 0.3, s: 0.72 + hash(n * 7.7) * 0.3, kind: n % 3 === 1 ? 1 : 0, n: n++ }); }
  for (let z = 3.1; z < 7.6; z += 1.05) { out.push({ x: 15.4 + hash(n * 3.3) * 0.25, z: z + hash(n * 5.1) * 0.3, s: 0.7 + hash(n * 7.7) * 0.3, kind: n % 2, n: n++ }); }
  for (const x of [1.5, 5.2, 5.8, 8.6, 11.3, 11.9, 14.5]) out.push({ x, z: 8.0 + hash(n * 2.1) * 0.06, s: 0.5 + hash(n * 7.7) * 0.14, kind: 0, n: n++ });
  return out;
})();
export const TURBINE = { x: 15.5, z: 1.7, h: 2.8, r: 1.05 };

export const ROOF_LAG = 0.16;            // beats: about five frames of sixty, the roof's "two or three frames later"

/**
 * How a building stands at g beats after its first frame: the walls shoot up and overshoot, each tier a touch after
 * the one below, the roof follows a few frames behind, then the roof furniture pops and the windows light in turn.
 */
export function grow(b, g) {
  const tiers = [];
  let y = 0, k = 0;
  for (const p of b.parts) {
    if (!isSolid(p) && p.on !== -1) { tiers.push(null); continue; }
    const d = p.on === -1 ? 0.1 : k * 0.07;
    const s = ease.outBack(seg(g, 0.05 + d, 0.47 + d), 1.9);
    const sr = ease.outBack(seg(g, 0.05 + d + ROOF_LAG, 0.47 + d + ROOF_LAG), 1.9);
    if (p.on === -1) { tiers.push({ y: 0, h: p.h * s, roofY: p.h * Math.min(s, sr), s }); continue; }
    tiers.push({ y, h: p.h * s, roofY: y + p.h * Math.min(s, sr), s });
    y += p.h * s; k++;
  }
  const done = 0.47 + Math.max(0, k - 1) * 0.07 + ROOF_LAG;
  return { tiers, top: y, pop: (j = 0) => ease.outBack(seg(g, done - 0.04 + j * 0.06, done + 0.24 + j * 0.06), 2.6), lightsFrom: done + 0.02, done };
}

/** Text lying on a horizontal plane at height y: baseline along +x, centred on (x, z). cap = capital height in tiles. */
export function topText(g, c, text, x, y, z, cap, color, weight = 700, family = 'Outfit', track = 0) {
  onTop(g, c, x, y, z);
  g.scale(1 / 200, 1 / 200);
  g.font = `${weight} ${(cap / 0.7) * 200}px "${family}"`;
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  if (track) g.letterSpacing = `${track * 200}px`;
  g.fillStyle = color;
  g.fillText(text, 0, cap * 100);
  if (track) g.letterSpacing = '0px';
}

/** Draw in the ground plane turned a quarter: u runs along -z (up and to the right on screen), v along +x. */
export const onTopZ = (g, c, x = 0, y = 0, z = 0) => g.setTransform(-c.az, -c.bz, c.ax, c.bx, c.X(x, z), c.Y(x, y, z));

/** Draw one building at growth time gt (beats). o: { beat, pulse(b, row) } */
export function building(g, c, b, gt, o) {
  if (gt <= 0) return;
  const G = grow(b, gt);
  const lit = (r, i, side) => {
    const t0 = G.lightsFrom + r * 0.07 + i * 0.022 + side * 0.05;
    let k = clamp((gt - t0) / 0.06);
    if (o.pulse) k *= 1 - 0.5 * o.pulse(b, r);         // a ripple of dimming that crosses the city on the beat
    return k;
  };
  const numK = G.pop(0);
  const drawNum = (pi) => {
    const n = b.numAt, T = G.tiers[pi], p = b.parts[pi];
    if (numK <= 0.02) return;
    const col = css(PAL.ink, 0.78 * Math.min(1, numK));
    if (n.on === pi) topText(g, c, b.num, b.x0 + n.x, T.roofY + 0.012, b.z0 + n.z, n.cap * Math.min(1.12, numK), col);
    else if (n.wall === pi && c.walls) {
      // the hero wears its number on its lit wall, near the top
      onLeft(g, c, b.x0 + p.x, T.y, b.z0 + p.z + p.d);
      g.scale(1 / 200, -1 / 200);
      g.font = `800 ${(n.cap / 0.7) * 200 * Math.min(1.1, numK)}px "Outfit"`;
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillStyle = css(PAL.white, Math.min(1, numK));
      g.fillText(b.num, p.w * 100, -(T.h - 0.3 - n.cap) * 200);
    } else if (n.slope === pi && c.walls) {
      // on the front slope of a pitched roof: one more flat sheet, leaning
      const d2 = p.d / 2, h = T.h, L = Math.hypot(h, d2);
      const x = b.x0 + p.x, zr = b.z0 + p.z + d2;
      g.setTransform(c.ax, c.bx, (c.az * d2) / L, (c.bz * d2 - c.by * h) / L, c.X(x, zr), c.Y(x, T.y + h, zr));
      g.scale(1 / 200, 1 / 200);
      g.font = `700 ${(n.cap / 0.7) * 200}px "Outfit"`;
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillStyle = css(PAL.white, Math.min(1, numK));
      g.fillText(b.num, p.w * 100, (L / 2 + n.cap / 2) * 200);
    }
  };
  // ground-standing extras behind the main solid first, then the stack bottom to top, then extras in front of it
  const main = b.parts[0], mk = (main.cx ?? main.x + main.w / 2) + (main.cz ?? main.z + main.d / 2);
  const idx = b.parts.map((p, pi) => pi), ek = (p) => (p.cx ?? p.x + p.w / 2) + (p.cz ?? p.z + p.d / 2);
  const order = [...idx.filter((i) => b.parts[i].on === -1 && ek(b.parts[i]) <= mk), ...idx.filter((i) => b.parts[i].on !== -1), ...idx.filter((i) => b.parts[i].on === -1 && ek(b.parts[i]) > mk)];
  for (const pi of order) {
    const p = b.parts[pi], T = G.tiers[pi];
    if (T) {
      const tn = tones(PAL[p.col]);
      if (p.kind === 'box') {
        const aur = p.win && p.win.aurora;
        box(g, c, b.x0 + p.x, b.z0 + p.z, p.w, p.d, T.y, T.h, {
          tn, win: p.win && T.h > 0.2 ? p.win : null, id: b.i * 10 + pi, roofY: T.roofY,
          lit: aur ? (r, i, side) => lit(r, i, side) * (0.72 + 0.28 * Math.sin(o.beat * 1.6 + r * 0.9 + i * 0.5)) : lit,
        });
      } else if (p.kind === 'cyl') {
        cyl(g, c, b.x0 + p.cx, b.z0 + p.cz, p.r, T.y, T.h, { tn, bands: T.h > 0.3 ? p.bands : 0, lit, id: b.i * 10 + pi, roofY: T.roofY });
      } else if (p.kind === 'gable') {
        gable(g, c, b.x0 + p.x, b.z0 + p.z, p.w, p.d, T.y, T.h, tn);
      }
      if (o.casters && c.walls && p.kind !== 'gable' && T.roofY >= T.y + T.h - 0.01 && T.h > 0.05) roofShade(g, c, b, pi, p, T, o.casters);
      drawNum(pi);
      continue;
    }
    // roof furniture: it pops once the building is up
    const S0 = G.tiers[p.on];
    const yTop = S0 ? S0.y + S0.h : 0;
    const k = G.pop(1 + (pi % 3));
    if (k <= 0.01) continue;
    if (p.kind === 'garden') {
      onTop(g, c, b.x0 + p.x + (p.w * (1 - k)) / 2, yTop + 0.02, b.z0 + p.z + (p.d * (1 - k)) / 2);
      g.fillStyle = css(PAL.leaf2);
      g.beginPath(); g.roundRect(0, 0, p.w * k, p.d * k, 0.1); g.fill();
      const cc = { ...c, Y: (x, y, z) => c.Y(x, y + yTop, z) };
      for (let j = 0; j < 2; j++) tree(g, cc, b.x0 + p.x + p.w * 0.5, b.z0 + p.z + p.d * (0.28 + j * 0.44), 0.4, k, 0);
    } else if (p.kind === 'mast') {
      offPlane(g);
      const X = c.X(b.x0 + p.cx, b.z0 + p.cz), Y = c.Y(b.x0 + p.cx, yTop, b.z0 + p.cz), h = p.h * -c.by * k;
      g.strokeStyle = css(PAL.white); g.lineWidth = Math.max(1.5, c.S * 0.032); g.lineCap = 'round';
      g.beginPath(); g.moveTo(X, Y); g.lineTo(X, Y - h); g.stroke();
      g.fillStyle = css(PAL.coral); g.beginPath(); g.arc(X, Y - h, c.S * (0.05 + 0.025 * Math.max(0, Math.sin(o.beat * Math.PI))), 0, Math.PI * 2); g.fill();
    } else if (p.kind === 'dome') {
      dome(g, c, b.x0 + p.cx, b.z0 + p.cz, p.r, yTop, { tn: tones(PAL[p.col]), slit: p.slit ? clamp((gt - G.lightsFrom) / 0.2) : 0 }, Math.min(1.1, k));
    } else if (p.kind === 'sun') {
      // the hero's crown: a small striped sun on a spire
      offPlane(g);
      const X = c.X(b.x0 + p.cx, b.z0 + p.cz), Y = c.Y(b.x0 + p.cx, yTop, b.z0 + p.cz), h = p.h * -c.by * k, R = c.S * 0.44 * k;
      g.strokeStyle = css(PAL.white); g.lineWidth = Math.max(1.5, c.S * 0.035); g.lineCap = 'round';
      g.beginPath(); g.moveTo(X, Y); g.lineTo(X, Y - h * 0.5); g.stroke();
      const cy = Y - h * 0.5 - R * 0.9;
      const tg = gt - G.done - 0.1;
      if (tg > 0 && tg < 0.9) {                         // its arrival: a ring of warm light opening out
        const q = tg / 0.9, rr = c.S * (0.5 + 2.2 * ease.outCubic(q));
        const gl = g.createRadialGradient(X, cy, rr * 0.55, X, cy, rr);
        gl.addColorStop(0, css(PAL.peach, 0)); gl.addColorStop(0.8, css(PAL.butter, 0.55 * (1 - q))); gl.addColorStop(1, css(PAL.butter, 0));
        g.fillStyle = gl; g.beginPath(); g.arc(X, cy, rr, 0, Math.PI * 2); g.fill();
      }
      g.save();
      g.beginPath(); g.arc(X, cy, R, 0, Math.PI * 2); g.clip();
      const gr = g.createLinearGradient(0, cy - R, 0, cy + R);
      gr.addColorStop(0, css(PAL.butter)); gr.addColorStop(0.55, css(PAL.peach)); gr.addColorStop(1, css(PAL.coral));
      g.fillStyle = gr; g.fillRect(X - R, cy - R, 2 * R, 2 * R);
      g.fillStyle = css(PAL.void0);
      for (let j = 0; j < 4; j++) { const yy = cy + R * (0.14 + j * 0.23); g.fillRect(X - R, yy, 2 * R, R * (0.05 + j * 0.024)); }
      g.restore();
    } else if (p.kind === 'box') {
      // a sign or a phone: a thin slab standing on the roof
      const tn = tones(PAL[p.col]), hh = p.h * k;
      box(g, c, b.x0 + p.x, b.z0 + p.z, p.w, p.d, yTop, hh, { tn, rim: false });
      if (hh > 0.05 && c.walls) {
        onLeft(g, c, b.x0 + p.x, yTop, b.z0 + p.z + p.d);
        if (p.tag === 'phone') {
          g.fillStyle = css(PAL.sky); g.beginPath(); g.roundRect(0.06, 0.07 * k, p.w - 0.12, hh - 0.14 * k, 0.05); g.fill();
          g.fillStyle = css(PAL.pink); g.fillRect(0.13, hh * 0.56, p.w - 0.26, hh * 0.1);
          g.fillStyle = css(PAL.butter); g.fillRect(0.13, hh * 0.36, (p.w - 0.26) * 0.7, hh * 0.1);
        } else if (p.tag === 'sign') {
          g.fillStyle = css(PAL.white);
          for (let j = 0; j < 4; j++) g.fillRect(0.14 + j * 0.27, hh * 0.3, 0.17, hh * 0.4);
        }
      }
    }
  }
}

/**
 * Everything of a building that throws a shadow at growth time gt: boxes and drums with their heights now (tiles,
 * measured from the top of the plot the building stands on).
 */
export function casters(b, gt, out) {
  if (gt <= 0) return;
  const G = grow(b, gt);
  b.parts.forEach((p, pi) => {
    const T = G.tiers[pi];
    let y0, y1;
    if (T) { y0 = T.y; y1 = T.y + T.h; }
    else if (p.kind === 'box' && p.on >= 0) {                 // a penthouse, a sign, a phone: it stands on a roof
      const S0 = G.tiers[p.on], k = clamp(G.pop(1 + (pi % 3)));
      if (!S0 || k <= 0.05) return;
      y0 = S0.y + S0.h; y1 = y0 + p.h * k;
    } else return;
    if (y1 - y0 < 0.02) return;
    if (p.kind === 'cyl') out.push({ b: b.i, pi, r: p.r, cx: b.x0 + p.cx, cz: b.z0 + p.cz, y0, y1 });
    else if (p.kind === 'box' || p.kind === 'gable') out.push({ b: b.i, pi, x: b.x0 + p.x, z: b.z0 + p.z, w: p.w, d: p.d, y0, y1: p.kind === 'gable' ? y0 + (y1 - y0) * 0.6 : y1 });
  });
}

/** The shadow one caster throws on the level plane at height Y: a polygon in tiles (always wound the same way), or null. */
export function shadowAt(k, Y) {
  if (k.y1 <= Y + 0.03) return null;
  const a = Math.max(k.y0, Y) - Y, t = k.y1 - Y, sx = SHADOW.x, sz = SHADOW.z;
  if (k.r) {
    const n = 12, pts = [], ang = Math.atan2(sz, sx);
    for (let i = 0; i <= n; i++) { const q = ang + Math.PI / 2 + (i / n) * Math.PI; pts.push([k.cx + sx * a + Math.cos(q) * k.r, k.cz + sz * a + Math.sin(q) * k.r]); }
    for (let i = 0; i <= n; i++) { const q = ang - Math.PI / 2 + (i / n) * Math.PI; pts.push([k.cx + sx * t + Math.cos(q) * k.r, k.cz + sz * t + Math.sin(q) * k.r]); }
    return pts;
  }
  const x0 = k.x + sx * a, z0 = k.z + sz * a, x1 = x0 + k.w, z1 = z0 + k.d, ox = sx * (t - a), oz = sz * (t - a);
  // the same turn as the drum's outline, so shapes drawn into one path add up instead of cutting holes
  return [[x0, z0], [x0 + ox, z0 + oz], [x1 + ox, z0 + oz], [x1 + ox, z1 + oz], [x1, z1], [x0, z1]];
}

/** Shade on a roof: what taller neighbours, and this building's own upper storeys, throw onto it. */
function roofShade(g, c, b, pi, p, T, list) {
  const Y = T.y + T.h;
  const round = p.kind === 'cyl';
  const rx0 = b.x0 + (round ? p.cx - p.r : p.x), rz0 = b.z0 + (round ? p.cz - p.r : p.z), rw = round ? 2 * p.r : p.w, rd = round ? 2 * p.r : p.d;
  let path = null;
  for (const k of list) {
    if ((k.b === b.i && k.pi === pi) || k.y1 <= Y + 0.03) continue;
    // too far to reach this roof?
    const reach = SHADOW.x * (k.y1 - Y), kx0 = k.r ? k.cx - k.r : k.x, kx1 = k.r ? k.cx + k.r : k.x + k.w, kz0 = k.r ? k.cz - k.r : k.z, kz1 = k.r ? k.cz + k.r : k.z + k.d;
    if (kx0 > rx0 + rw || kx1 + reach < rx0 || kz1 < rz0 || kz0 + SHADOW.z * (k.y1 - Y) > rz0 + rd) continue;
    const poly = shadowAt(k, Y);
    if (!poly) continue;
    if (!path) { path = new Path2D(); }
    path.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) path.lineTo(poly[i][0], poly[i][1]);
    path.closePath();
  }
  if (!path) return;
  g.save();
  onTop(g, c, 0, Y + 0.004, 0);
  g.beginPath();
  if (round) g.arc(b.x0 + p.cx, b.z0 + p.cz, p.r, 0, Math.PI * 2); else g.rect(rx0, rz0, rw, rd);
  g.clip();
  g.fillStyle = css(PAL.shade, 0.36);
  g.fill(path, 'nonzero');
  g.restore();
}

// ---------------------------------------------------------------------------------------------------------------------
// The ground, painted once, flat, at 120 px a tile: the same sheet the poster was printed on.

export function paintGround(canvas) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height, T = TILE;
  g.fillStyle = css(PAL.ground); g.fillRect(0, 0, W, H);
  // tiles: a faint chequer and joints
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
    if ((i + j) % 2 === 0) { g.fillStyle = css(PAL.tileHi, 0.45); g.fillRect(i * T, j * T, T, T); }
  }
  g.strokeStyle = css(PAL.tileHi, 0.9); g.lineWidth = 2;
  g.beginPath();
  for (let i = 1; i < NX; i++) { g.moveTo(i * T, 0); g.lineTo(i * T, H); }
  for (let j = 1; j < NZ; j++) { g.moveTo(0, j * T); g.lineTo(W, j * T); }
  g.stroke();
  // lawns at both ends and by the railway
  g.fillStyle = css(PAL.lawn);
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x * T, y * T, w * T, h * T, r * T); g.fill(); };
  rr(0.14, 0.3, 0.76, 7.4, 0.2); rr(15.1, 0.3, 0.76, 7.4, 0.2);
  // streets
  g.fillStyle = css(PAL.road);
  for (const x of STREETS_NS) g.fillRect((x - 0.5) * T, 0, T, 7.92 * T);
  for (const z of STREETS_EW) g.fillRect(0, (z - 0.4) * T, W, 0.8 * T);
  g.fillRect(0, 7.72 * T, W, 0.34 * T);
  // kerbs
  g.strokeStyle = css(mixc(PAL.road, PAL.ground, 0.7)); g.lineWidth = 3;
  // centre dashes
  g.strokeStyle = css(WHITE, 0.95); g.lineWidth = 5; g.setLineDash([0.2 * T, 0.2 * T]);
  g.beginPath();
  for (const x of STREETS_NS) { g.moveTo(x * T, 0.1 * T); g.lineTo(x * T, 7.7 * T); }
  for (const z of STREETS_EW) { g.moveTo(0.1 * T, z * T); g.lineTo(W - 0.1 * T, z * T); }
  g.stroke();
  g.setLineDash([]);
  // crossings: where streets meet, the dashes give way to a plain square with zebra bars on its four sides
  for (const x of STREETS_NS) for (const z of STREETS_EW) {
    g.fillStyle = css(PAL.road); g.fillRect((x - 0.5) * T, (z - 0.4) * T, T, 0.8 * T);
    g.fillStyle = css(WHITE, 0.9);
    for (let k = 0; k < 4; k++) {
      g.fillRect((x - 0.42 + k * 0.23) * T, (z - 0.62) * T, 0.12 * T, 0.18 * T);
      g.fillRect((x - 0.42 + k * 0.23) * T, (z + 0.44) * T, 0.12 * T, 0.18 * T);
    }
    for (let k = 0; k < 3; k++) {
      g.fillRect((x - 0.72) * T, (z - 0.32 + k * 0.24) * T, 0.18 * T, 0.12 * T);
      g.fillRect((x + 0.54) * T, (z - 0.32 + k * 0.24) * T, 0.18 * T, 0.12 * T);
    }
  }
  // lots: pale pads the buildings stand on
  for (const x of COLS) for (const z of ROWS) {
    g.fillStyle = css(mixc(PAL.pad, PAL.ground, 0.5)); rr(x - 0.06, z - 0.06, LOT + 0.12, LOT + 0.12, 0.2);
    g.fillStyle = css(PAL.pad); rr(x, z, LOT, LOT, 0.16);
  }
  // the railway: a pale bed, sleepers, two rails
  g.fillStyle = css(mixc(PAL.pad, PAL.ground, 0.25)); g.fillRect(0, (RAIL_Z - 0.3) * T, W, 0.6 * T);
  g.fillStyle = css(mixc(PAL.lilac, PAL.shade, 0.18));
  for (let x = 0.1; x < NX; x += 0.25) g.fillRect(x * T, (RAIL_Z - 0.2) * T, 0.09 * T, 0.4 * T);
  g.fillStyle = css(PAL.white);
  g.fillRect(0, (RAIL_Z - 0.14) * T, W, 0.045 * T); g.fillRect(0, (RAIL_Z + 0.1) * T, W, 0.045 * T);
  // a soft inner edge all round, like a tray's lip
  g.strokeStyle = css(WHITE, 0.55); g.lineWidth = 10; g.strokeRect(5, 5, W - 10, H - 10);
}

/**
 * A stand-in for the Bauhaus poster, used only until that shot exists: cream paper, primaries, squares on the 240 px
 * grid. Returns the fifteen squares the buildings rise from.
 */
export function paintPoster(canvas) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  const paper = '#F1E9DA', red = '#E03C31', yellow = '#F2B705', blue = '#1E4FA3', black = '#111111';
  g.fillStyle = paper; g.fillRect(0, 0, W, H);
  const cols = [red, yellow, blue, black];
  const cells = [[0, 0], [1, 1], [0, 3], [2, 0], [2, 2], [3, 3], [3, 0], [4, 1], [3, 2], [5, 0], [5, 2], [4, 3], [6, 0], [7, 1], [6, 3]];
  const order = [2, 0, 1, 2, 3, 0, 2, 3, 1, 0, 2, 1, 3, 2, 0];
  const modules = cells.map(([cx, cy], i) => ({ x: cx * 240, y: 60 + cy * 240, w: 240, h: 240, color: cols[order[i]] }));
  // a few shapes that are not modules: they stay on the paper and go over with the tiles
  g.fillStyle = yellow; g.beginPath(); g.moveTo(1680, 540); g.arc(1680, 540, 240, Math.PI, Math.PI * 1.5); g.closePath(); g.fill();
  g.fillStyle = red; g.beginPath(); g.arc(360, 660, 120, 0, Math.PI * 2); g.fill();
  g.fillStyle = blue; g.beginPath(); g.moveTo(1200, 300); g.arc(1320, 300, 120, Math.PI, 0); g.closePath(); g.fill();
  g.fillStyle = black;
  for (let i = 0; i < 38; i++) g.fillRect(246 + i * 12, 30, i === 24 ? 8 : 4, 18);
  for (const m of modules) { g.fillStyle = m.color; g.fillRect(m.x, m.y, m.w, m.h); }
  return { modules, paper };
}
