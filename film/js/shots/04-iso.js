// 04 Isometric 2.5D: "build the shots."
// The Bauhaus poster is a sheet of paper lying flat. On Enter it tips back to true isometric (the one camera rotation
// in the shot), its tiles turn over in a wave, cream to lavender; fifteen of its squares slide to their places, turn
// over too and become numbered building plots. The cursor, a small cube, jumps off the prompt row and bounces from
// plot to plot; every plot it lands on grows a building (base, walls with overshoot, roof a few frames later, windows
// lighting in turn) exactly as that shot's Write(...) line is printed. 01 stands at the right-hand end and the city
// is built up and to the left, so what is finished stays in view while the camera slides along the island without
// turning, clouds passing at 1 : 0.8 : 0.6. Then it pulls back: the whole island floating in a pastel void, its title
// lying on the same plane.
//
// Everything is 2D canvas: each face is a flat drawing sheared into place with a matrix, sorted back to front.
// Timing comes from cues.json (this shot's `out` lines), so the picture follows if those beats are changed.
// For the shot before: handoff().modules = [{ x, y, w, h, color }] in frame px. Any fifteen will do (each plot takes
// the nearest and the square slides and resizes to it); squares already on the plots do not move at all:
// 240 px squares at x = 120, 480, 840, 1200, 1560 and y = 36, 372, 708.
// For the shot after: handoff() gives each building's box on screen, see the end of this file.

import { DOCK, swapDock } from '../term.js';
import { clamp, lerp, seg, smooth, ease, decay, hash, TAU } from '../util.js';
import {
  PAL, css, mixc, hex, toHex, camera, onTop, onTopZ, onLeft, onRight, offPlane, box, cube, tree, tones, topText,
  BUILDINGS, PARK, TURBINE, building, grow, casters, shadowAt, paintGround, paintPoster,
  TILE, NX, NZ, ISO_A, ISO_E, LOT, STREETS_NS, STREETS_EW, RAIL_Z, SHADOW,
} from './iso/world.js';

const WHITE = [255, 255, 255];
const PLATE_H = 0.1;                     // how thick a building plot stands
const CUBE = 0.62;                       // the cursor cube's edge in the world, tiles
const DOCK_SC = 27;                      // ...and on the prompt row (px to one cube edge before foreshortening)

export default async function make(ctx) {
  const { W, H, font, makeCanvas, shot, script } = ctx;
  const TEST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('isotest');
  await Promise.all([
    font('DM Mono', '/assets/iso/DMMono-Medium.ttf', { weight: '500' }),
    font('DM Mono', '/assets/iso/DMMono-Regular.ttf', { weight: '400' }),
    font('Outfit', '/assets/iso/Outfit-Variable.ttf', { weight: '100 900' }),
  ]);

  // ---- the cue sheet: when each Write(...) line is printed, when the result arrives, when typing starts ----
  const outs = shot.out || [];
  const T = outs.filter((o) => o.kind === 'tool').map((o) => o.at).slice(0, 15);
  while (T.length < 15) T.push((T[T.length - 1] ?? 0.2) + 0.3);
  const RES = outs.find((o) => o.kind === 'result') || { at: T[14] + 0.7, text: '15 shots' };
  const T_RES = RES.at;
  const NEXT = script.shots[shot.name].next;
  const TYPE0 = NEXT ? NEXT.keys[0] - shot.b0 : shot.beats - 3;      // the first key of the next prompt, local beat
  const HOME = TYPE0 - 0.05;                                           // the cube must be back on its row by then
  const CMD_LEN = (shot.prompt || '').length;
  // the cube visits every plot it can reach and still be home in time; the rest rise on their own line
  let LAST = 0;
  for (let i = 0; i < 15; i++) if (T[i] <= HOME - 0.28) LAST = i;
  const TITLE = RES.text.toUpperCase();                                // "15 SHOTS", from the cue sheet

  // ---- things painted once ----
  const GT = makeCanvas(W, H); paintGround(GT);
  const POSTER = makeCanvas(W, H); const STAND = paintPoster(POSTER);
  const PATCH = makeCanvas(W, H), pg = PATCH.getContext('2d');
  const SH = makeCanvas(W / 2, H / 2), sg = SH.getContext('2d');

  const BG = makeCanvas(W, H);
  {
    const b = BG.getContext('2d');
    const gr = b.createLinearGradient(0, 0, W * 0.62, H);
    gr.addColorStop(0, css(PAL.void0)); gr.addColorStop(0.45, css(PAL.voidM)); gr.addColorStop(1, css(PAL.void1));
    b.fillStyle = gr; b.fillRect(0, 0, W, H);
    const rg = b.createRadialGradient(1020, 430, 60, 1020, 430, 900);
    rg.addColorStop(0, 'rgba(255,255,255,0.08)'); rg.addColorStop(1, 'rgba(255,255,255,0)');   // a breath of light behind the island, no more: it must not wash the frame
    b.fillStyle = rg; b.fillRect(0, 0, W, H);
    // the backdrop falls off toward its corners, as a studio sweep does
    const vg = b.createRadialGradient(W * 0.5, H * 0.46, H * 0.5, W * 0.5, H * 0.46, H * 1.12);
    vg.addColorStop(0, css(PAL.shade, 0)); vg.addColorStop(1, css(PAL.shade, 0.1));
    b.fillStyle = vg; b.fillRect(0, 0, W, H);
    // a breath of noise so the soft gradient does not band when it is compressed
    const n = makeCanvas(256, 256), ng = n.getContext('2d'), id = ng.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) { const v = 128 + (hash(i * 0.731 + 3.1) - 0.5) * 255; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    ng.putImageData(id, 0, 0);
    b.globalAlpha = 0.03; b.globalCompositeOperation = 'overlay'; b.fillStyle = b.createPattern(n, 'repeat'); b.fillRect(0, 0, W, H);
  }

  /** A cloud in the flat way: capsules laid one on another. */
  function makeCloud(parts, w, h) {
    const c = makeCanvas(w, h), b = c.getContext('2d');
    const gr = b.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, css(mixc(PAL.void1, WHITE, 0.35)));
    b.fillStyle = gr;
    for (const [x, y, ww, hh] of parts) { b.beginPath(); b.roundRect(x, y, ww, hh, hh / 2); b.fill(); }
    return c;
  }
  const CLOUDS = [
    makeCloud([[40, 70, 380, 78], [120, 20, 210, 84], [0, 122, 300, 60]], 440, 190),
    makeCloud([[0, 60, 300, 66], [70, 12, 160, 76], [150, 104, 230, 54]], 390, 164),
    makeCloud([[20, 40, 250, 60], [0, 84, 170, 46]], 280, 134),
  ];
  // [sprite, x, y, scale, parallax, alpha, drift px a beat], placed for the last frame
  const SKY = [
    [0, 1420, 150, 1.0, 0.6, 0.85, 3], [2, 250, 470, 1.0, 0.6, 0.8, 2], [1, 1700, 610, 0.8, 0.6, 0.75, 2.5], [2, 760, 60, 0.8, 0.6, 0.7, 2],
    [1, 1180, 40, 1.0, 0.8, 0.95, 5], [0, 40, 250, 0.9, 0.8, 0.92, 4], [2, 1560, 330, 1.1, 0.8, 0.95, 4.5], [1, 330, 690, 0.7, 0.8, 0.9, 4],
  ];
  const FRONT = [[0, 1560, 930, 1.5, 1.3, 0.96, 9], [1, -160, -40, 1.5, 1.3, 0.96, 8]];

  // DM Mono set so one letter takes exactly one 36 px cell
  const mg = makeCanvas(8, 8).getContext('2d');
  mg.font = '500 100px "DM Mono"';
  const MONO = DOCK.adv / (mg.measureText('M').width / 100);

  // title letters: where each sits along the plinth (tiles), measured once
  const TCAP = 1.15, TEM = TCAP / 0.7, TZ = 4.2;
  mg.font = '800 100px "Outfit"';
  const TLET = (() => {
    const out = []; let x = 0;
    for (const ch of TITLE) { const w = (mg.measureText(ch).width / 100) * TEM; out.push({ ch, x, w }); x += w + (ch === ' ' ? 0 : 0.07 * TEM); }
    const total = x - 0.07 * TEM;
    return out.map((l) => ({ ...l, x: l.x - total / 2 + l.w / 2, total }));
  })();
  // the plinth lies along the island's short near side; the title reads up and to the right along it
  const PLINTH = { x0: 16.7, x1: 18.85, z0: TZ - TLET[0].total / 2 - 0.7, z1: TZ + TLET[0].total / 2 + 0.7, y: -0.14, th: 0.3 };

  // ---- the camera ----
  const S_FLAT = TILE, S_SLIDE = 88, S_END = 64;
  const A_SLIDE = [1165, 462], A_END = [1005, 586];
  const tipE = (x) => 1 - Math.pow(1 - clamp(x), 3);
  function camAt(lb) {
    const k = tipE(lb / 1.55), kf = tipE(lb / 1.1);
    const a = ISO_A * k, e = Math.PI / 2 - (Math.PI / 2 - ISO_E) * k;
    // the slide: along the island's long side, never turning, keeping pace with the column being built
    const u = seg(lb, T[0] + 0.05, T[14] + 0.05), su = lerp(u, smooth(u), 0.5);
    const fx = lerp(13.6, 2.4, su), fz = 4.1;
    const pull = ease.inOutCubic(seg(lb, T_RES - 0.2, T_RES + 1.3));
    const after = Math.max(0, lb - (T_RES + 1.3));
    let S = lerp(S_FLAT, S_SLIDE, k);
    S = lerp(S, S_END, pull);
    const Fx = lerp(lerp(8, fx, kf), 8 + after * 0.02, pull), Fz = lerp(lerp(4.5, fz, kf), 4.5, pull);
    const Ax = lerp(lerp(960, A_SLIDE[0], kf), A_END[0], pull), Ay = lerp(lerp(540, A_SLIDE[1], kf), A_END[1], pull) + pull * 4 * Math.sin(((lb - T_RES) * TAU) / 4);
    const c = camera(a, e, S, Fx, Fz, Ax, Ay);
    c.k = k; c.pull = pull;
    return c;
  }
  const CAM_END = camera(ISO_A, ISO_E, S_END, 8, 4.5, A_END[0], A_END[1]);
  const O_END = CAM_END.P(8, 0, 4.5);

  // ---- the tiles that turn over ----
  const TILES = [];
  // the wave starts under the first plot, where the cube is about to land, and runs ahead of the building
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const d = Math.hypot(i + 0.5 - BUILDINGS[0].cx, j + 0.5 - BUILDINGS[0].cz); TILES.push({ i, j, t0: 0.05 + d * 0.06 + hash(i * 7.1 + j * 3.3) * 0.04 }); }
  const FLIP = 0.4, WAVE_END = Math.max(...TILES.map((t) => t.t0)) + FLIP + 0.02;

  // ---- plots ----
  const LOTS = BUILDINGS.map((b) => ({ x: b.x0, z: b.z0, w: LOT, d: LOT }));
  const plateTop = (b) => mixc(b.base, WHITE, 0.5);
  /** Give each plot the nearest square of the poster (in px of the flat sheet). */
  function match(mods) {
    const pairs = [];
    LOTS.forEach((l, li) => mods.forEach((m, mi) => pairs.push([Math.hypot(m.x + m.w / 2 - (l.x + 1) * TILE, m.y + m.h / 2 - (l.z + 1) * TILE), li, mi])));
    pairs.sort((p, q) => p[0] - q[0]);
    const of = new Array(15).fill(-1), used = new Set();
    for (const [, li, mi] of pairs) if (of[li] < 0 && !used.has(mi)) { of[li] = mi; used.add(mi); }
    return of;
  }
  const parseCol = (s) => { try { if (/^#[0-9a-f]{6}$/i.test(s)) return hex(s); if (/^#[0-9a-f]{3}$/i.test(s)) return hex('#' + [...s.slice(1)].map((c) => c + c).join('')); const m = /rgba?\(([^)]+)\)/.exec(s); if (m) return m[1].split(',').slice(0, 3).map(Number); } catch { /* fall through */ } return hex('#E03C31'); };

  /**
   * A plot at beat lb: the poster's square slides to its place, then turns over like the tiles around it, primary
   * colour down, the building's pastel up, and thickens into a base.
   */
  const FLIP0 = BUILDINGS.map((b, i) => Math.min(0.05 + Math.hypot(b.cx - BUILDINGS[0].cx, b.cz - BUILDINGS[0].cz) * 0.06 + 0.26, T[i] - 0.42));
  function plate(i, lb, mods, of) {
    const l = LOTS[i], b = BUILDINGS[i], m = of[i] >= 0 ? mods[of[i]] : null;
    const sl = ease.inOutCubic(seg(lb, 0.03 + 0.012 * i, Math.max(0.2, FLIP0[i])));
    const from = m ? { x: m.x / TILE, z: m.y / TILE, w: m.w / TILE, d: m.h / TILE } : { x: l.x + 1, z: l.z + 1, w: 0, d: 0 };
    const fp = seg(lb, FLIP0[i], FLIP0[i] + 0.36), over = fp >= 0.5;
    const sq = Math.max(0.03, Math.abs(Math.cos(Math.PI * ease.outBack(fp, 1.1))));
    const top = over ? plateTop(b) : m ? parseCol(m.color) : hex('#F1E9DA');
    const g = lb - T[i];
    const press = g >= 0 ? decay(g, 0.035) : 0;                    // the landing: the plot gives, then springs back
    const w = lerp(from.w, l.w, sl), d = lerp(from.d, l.d, sl), z = lerp(from.z, l.z, sl);
    return {
      x: lerp(from.x, l.x, sl), z: z + (d * (1 - sq)) / 2, w, d: d * sq, y: 0.4 * Math.sin(Math.PI * fp),
      h: (over ? PLATE_H * smooth(seg(fp, 0.5, 1)) : 0.02 * sl) * (1 - 0.6 * press),
      tn: { top: mixc(top, over ? WHITE : [0, 0, 0], 0.25 * (1 - sq)), left: mixc(top, PAL.shade, 0.22), right: mixc(top, PAL.shade, 0.42), deep: mixc(top, PAL.shade, 0.5) },
      flip: fp, mod: m,
    };
  }

  // ---- the cursor cube ----
  const cellX = (n) => DOCK.x + (2 + n) * DOCK.adv + DOCK.adv / 2;
  const CUBE_Y = DOCK.rowC - 9;                                       // where the cube's foot rests on the prompt row
  const lotC = (i) => [BUILDINGS[i].cx, BUILDINGS[i].cz];
  const CT = 0.07;                                                    // beats the cube stays down on a plot
  const roofUnder = (i, lb) => PLATE_H + grow(BUILDINGS[i], lb - T[i]).top;
  /** Where the cube is at beat lb, for camera c. { p: [sx, sy] of its foot, sc: px a cube edge, h: height factor, home } */
  function cubeAt(lb, c) {
    if (lb >= HOME) return { home: true, land: lb - HOME };
    if (lb < T[0]) {
      const p = seg(lb, 0.04, T[0]), q = ease.inOutQuad ? ease.inOutQuad(p) : smooth(p);
      const a = [cellX(CMD_LEN), CUBE_Y], b = c.P(...[lotC(0)[0], PLATE_H, lotC(0)[1]]);
      const pre = seg(lb, 0, 0.04);
      return { p: [lerp(a[0], b[0], smooth(p)), lerp(a[1], b[1], p * p * (3 - 2 * p)) - 300 * Math.sin(Math.PI * p)], sc: lerp(DOCK_SC, c.S * CUBE, smooth(p)), h: 1 - 0.3 * Math.sin(Math.PI * pre) * (pre < 1 ? 1 : 0), air: p > 0 && p < 1 };
    }
    let i = 0;
    while (i < LAST && lb >= T[i + 1]) i++;
    const g = lb - T[i];
    const y0 = roofUnder(i, Math.min(lb, T[i] + CT));
    if (g < CT) {
      const [x, z] = lotC(i);
      return { p: c.P(x, roofUnder(i, lb), z), sc: c.S * CUBE, h: lerp(0.5, 1.12, g / CT), w: lerp(1.3, 0.94, g / CT) };
    }
    if (i < LAST) {
      const s = seg(lb, T[i] + CT, T[i + 1]);
      const [x0, z0] = lotC(i), [x1, z1] = lotC(i + 1);
      const dist = Math.hypot(x1 - x0, z1 - z0);
      const x = lerp(x0, x1, s), z = lerp(z0, z1, s), y = lerp(y0, PLATE_H, s) + (1.1 + 0.26 * dist) * 4 * s * (1 - s);
      return { p: c.P(x, y, z), sc: c.S * CUBE, h: 1 + 0.12 * Math.sin(Math.PI * s), air: true, world: [x, y, z] };
    }
    // the way home: one long leap back to the prompt row
    const p = seg(lb, T[LAST] + CT, HOME), [x, z] = lotC(LAST);
    const a = c.P(x, y0, z), b = [cellX(0), CUBE_Y];
    return { p: [lerp(a[0], b[0], smooth(p)), lerp(a[1], b[1], p * p) - 230 * Math.sin(Math.PI * p)], sc: lerp(c.S * CUBE, DOCK_SC, smooth(p)), h: 1 + 0.1 * Math.sin(Math.PI * p), air: true };
  }
  /** The cube drawn where its foot stands on screen, seen with camera c's angle. col: [r,g,b]. */
  function drawCube(g, c, p, sc, col, alpha = 1, hk = 1, wk = 1) {
    const cc = camera(c.a, c.e, sc, 0, 0, p[0], p[1]);
    cube(g, cc, 0, 0, 0, wk, col, alpha, hk);
    offPlane(g);
  }
  const cubeCol = (lb) => mixc(hex('#E03C31'), PAL.coral, smooth(seg(lb, 0.05, 0.6)));

  // ---- small helpers for drawing on the ground ----
  const sheetXf = (g, c) => g.setTransform(c.ax / TILE, c.bx / TILE, c.az / TILE, c.bz / TILE, c.ox, c.oy);
  function islandTop(g, c) {
    offPlane(g);
    g.beginPath();
    const a = c.P(0, 0, 0), b = c.P(NX, 0, 0), d = c.P(NX, 0, NZ), e = c.P(0, 0, NZ);
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(d[0], d[1]); g.lineTo(e[0], e[1]); g.closePath();
  }

  /** The body of the island under the sheet: stepped tiers, each smaller and darker than the one above. */
  function slab(g, c, soft) {
    if (!c.walls) return;
    const paper = hex('#D9CFBB');
    // a light lip, then a deep underside that steps in and darkens: the weight the island floats on
    const tiers = [[0, 0.42, mixc(paper, mixc(PAL.white, PAL.slabL, 0.55), soft), 0], [0.45, 0.85 * soft, PAL.slabL, 0.42], [1.2, 0.75 * soft, mixc(PAL.slabL, PAL.shade, 0.4), 1.27], [2.2, 0.65 * soft, mixc(PAL.slabL, PAL.shade, 0.7), 2.02], [3.3, 0.5 * soft, PAL.shade, 2.67]];
    for (let k = tiers.length - 1; k >= 0; k--) {
      const [inset, th, col, y] = tiers[k];
      if (th <= 0.01) continue;
      const l = col, r = mixc(col, PAL.shade, 0.5), yb = -(y * (k ? soft : 1)) - th;
      onLeft(g, c, inset, yb, NZ - inset);
      let gr = g.createLinearGradient(0, 0, 0, th);
      gr.addColorStop(0, css(mixc(l, PAL.shade, 0.22))); gr.addColorStop(1, css(l));
      g.fillStyle = gr; g.fillRect(0, 0, NX - 2 * inset, th);
      onRight(g, c, NX - inset, yb, NZ - inset);
      gr = g.createLinearGradient(0, 0, 0, th);
      gr.addColorStop(0, css(mixc(r, PAL.shade, 0.25))); gr.addColorStop(1, css(r));
      g.fillStyle = gr; g.fillRect(0, 0, NZ - 2 * inset, th);
    }
    offPlane(g);
  }

  function clouds(g, c, lb, list) {
    const o = c.P(8, 0, 4.5), sx = o[0] - O_END[0], sy = o[1] - O_END[1], zoom = c.S / S_END;
    for (const [k, x, y, sc, par, al, drift] of list) {
      const s = sc * Math.pow(zoom, par), im = CLOUDS[k];
      // layers nearer than the island move faster than it; farther ones slower (1 : 0.8 : 0.6)
      const px = 960 + (x - 960) * Math.pow(zoom, par) + sx * par + (lb - 8) * drift, py = 540 + (y - 540) * Math.pow(zoom, par) + sy * par;
      g.globalAlpha = al * smooth(seg(c.k, 0.15, 0.7));
      g.drawImage(im, px, py, im.width * s, im.height * s);
    }
    g.globalAlpha = 1;
  }

  // ---- life ----
  const PK = [];
  STREETS_EW.forEach((z, k) => { for (let n = 0; n < 5; n++) PK.push({ ew: true, at: z + (n % 2 ? 0.17 : -0.17), dir: n % 2 ? 1 : -1, ph: hash(k * 9.1 + n * 3.7), v: 0.11 + 0.05 * hash(n * 1.9 + k), col: ['sky', 'white', 'coral', 'mint', 'butter'][(n + k * 2) % 5] }); });
  STREETS_NS.forEach((x, k) => { for (let n = 0; n < 3; n++) PK.push({ ew: false, at: x + (n % 2 ? 0.2 : -0.2), dir: n % 2 ? 1 : -1, ph: hash(k * 5.3 + n * 7.7 + 2), v: 0.13 + 0.05 * hash(n * 2.9 + k), col: ['white', 'sky', 'mint', 'coral'][(n + k) % 4] }); });
  const DRONES = [{ cx: 5.4, cz: 4.3, rx: 3.2, rz: 1.5, y: 4.3, w: 0.21, ph: 0.1, col: 'coral', t0: 1.9 }, { cx: 10.6, cz: 5.0, rx: 2.9, rz: 1.9, y: 3.6, w: -0.17, ph: 2.2, col: 'mint', t0: 2.9 }, { cx: 13.2, cz: 2.4, rx: 1.9, rz: 1.4, y: 5.6, w: 0.24, ph: 4.0, col: 'sky', t0: 4.1 }];
  const droneAt = (d, lb) => { const a = d.ph + lb * d.w * TAU * 0.25; return [d.cx + Math.cos(a) * d.rx, d.y + 0.16 * Math.sin(lb * 1.7 + d.ph), d.cz + Math.sin(a) * d.rz]; };
  const TRAIN = { cars: 5, len: 0.86, gap: 0.12, v: 2.3, t0: 1.5 };

  function drone(g, c, d, lb) {
    const k = ease.outBack(seg(lb, d.t0, d.t0 + 0.5));
    if (k <= 0.01) return;
    const [x, y, z] = droneAt(d, lb);
    offPlane(g);
    const P = c.P(x, y, z), u = c.S * k * 1.5;
    // the parcel it carries
    g.strokeStyle = css(PAL.white, 0.9); g.lineWidth = Math.max(1, u * 0.014);
    g.beginPath(); g.moveTo(P[0], P[1]); g.lineTo(P[0], P[1] + u * 0.36); g.stroke();
    drawCube(g, c, [P[0], P[1] + u * 0.52], u * 0.2, PAL[d.col]);
    // arms and rotors
    const arms = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    g.strokeStyle = css(PAL.white); g.lineWidth = Math.max(1.5, u * 0.035); g.lineCap = 'round';
    for (const [ax, az] of arms) { const q = c.P(x + ax * 0.3 * k, y, z + az * 0.3 * k); g.beginPath(); g.moveTo(P[0], P[1]); g.lineTo(q[0], q[1]); g.stroke(); }
    drawCube(g, c, [P[0], P[1] + u * 0.06], u * 0.17, PAL.white, 1, 0.6);
    for (const [ax, az] of arms) {
      const q = c.P(x + ax * 0.3 * k, y + 0.07, z + az * 0.3 * k);
      g.fillStyle = css(mixc(PAL.lilac, PAL.shade, 0.25), 0.6); g.beginPath(); g.ellipse(q[0], q[1], u * 0.13, u * 0.13 * Math.sin(c.e), 0, 0, TAU); g.fill();
      g.strokeStyle = css(WHITE, 0.9); g.lineWidth = Math.max(1, u * 0.012);
      const ang = lb * 9 + ax * 2 + az;
      g.beginPath(); g.ellipse(q[0], q[1], u * 0.13, u * 0.13 * Math.sin(c.e), 0, ang, ang + 1.1); g.stroke();
    }
  }

  function turbine(g, c, lb) {
    const t = TURBINE, k = ease.outBack(seg(lb, T[1] - 0.1, T[1] + 0.45), 1.4);
    if (k <= 0.01 || !c.walls) return;
    offPlane(g);
    const X = c.X(t.x, t.z), Y0 = c.Y(t.x, 0, t.z), Y1 = c.Y(t.x, t.h * k, t.z), w0 = c.S * 0.09, w1 = c.S * 0.045;
    const gr = g.createLinearGradient(X - w0, 0, X + w0, 0);
    gr.addColorStop(0, css(PAL.white)); gr.addColorStop(1, css(mixc(PAL.white, PAL.shade, 0.3)));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(X - w0, Y0); g.lineTo(X + w0, Y0); g.lineTo(X + w1, Y1); g.lineTo(X - w1, Y1); g.closePath(); g.fill();
    // three blades turning in the upright plane that faces the lit side
    const hub = [t.x, t.h * k, t.z + 0.12], ang = lb * 1.9;
    const bk = ease.outBack(seg(lb, T[1] + 0.3, T[1] + 0.8));
    for (let i = 0; i < 3; i++) {
      const a = ang + (i * TAU) / 3, r = t.r * bk;
      const tip = c.P(hub[0] + Math.cos(a) * r, hub[1] + Math.sin(a) * r, hub[2]);
      const s1 = c.P(hub[0] + Math.cos(a + 0.55) * r * 0.24, hub[1] + Math.sin(a + 0.55) * r * 0.24, hub[2]);
      const s2 = c.P(hub[0] + Math.cos(a - 0.3) * r * 0.26, hub[1] + Math.sin(a - 0.3) * r * 0.26, hub[2]);
      const h0 = c.P(...hub);
      g.fillStyle = css(PAL.white); g.strokeStyle = css(mixc(PAL.lilac, PAL.shade, 0.45)); g.lineWidth = Math.max(1.5, c.S * 0.022); g.lineJoin = 'round';
      g.beginPath(); g.moveTo(h0[0], h0[1]); g.lineTo(s1[0], s1[1]); g.lineTo(tip[0], tip[1]); g.lineTo(s2[0], s2[1]); g.closePath(); g.fill(); g.stroke();
    }
    const h0 = c.P(...hub);
    g.fillStyle = css(PAL.coral); g.beginPath(); g.arc(h0[0], h0[1], c.S * 0.075 * k, 0, TAU); g.fill();
  }

  // two small islands adrift in the void, so the big one has company and the space has depth
  const ISLETS = [{ x: -4.4, z: 9.6, s: 2.2, y: -1.3, ph: 1.3, trees: [[0.6, 0.7, 0.8, 0], [1.5, 1.3, 0.62, 1], [0.7, 1.6, 0.5, 0]] }, { x: 8.3, z: -7.6, s: 1.5, y: 1.0, ph: 3.1, trees: [[0.75, 0.8, 0.7, 1]] }];
  function islet(g, c, it, lb) {
    if (!c.walls) return;
    const y = it.y + 0.09 * Math.sin(lb * 0.9 + it.ph), s = it.s;
    const cc = { ...c, Y: (x, yy, z) => c.Y(x, yy + y, z), P: (x, yy, z) => c.P(x, yy + y, z) };
    box(g, cc, it.x + s * 0.32, it.z + s * 0.32, s * 0.36, s * 0.36, -1.12, 0.38, { tn: tones(mixc(PAL.slabL, PAL.shade, 0.4)), rim: false });
    box(g, cc, it.x + s * 0.16, it.z + s * 0.16, s * 0.68, s * 0.68, -0.74, 0.4, { tn: tones(mixc(PAL.slabL, PAL.shade, 0.15)), rim: false });
    box(g, cc, it.x, it.z, s, s, -0.34, 0.34, { tn: { top: PAL.pad, left: PAL.white, right: mixc(PAL.white, PAL.shade, 0.3), deep: PAL.slabR }, rim: false });
    onTop(g, cc, it.x, 0.005, it.z);
    g.fillStyle = css(PAL.lawn); g.beginPath(); g.roundRect(s * 0.1, s * 0.1, s * 0.8, s * 0.8, s * 0.12); g.fill();
    for (const [tx, tz, ts, kind] of it.trees) tree(g, cc, it.x + tx, it.z + tz, ts, 1, kind);
    offPlane(g);
  }

  function trainCar(g, c, x, n, lb) {
    const z = RAIL_Z, w = TRAIN.len, d = 0.42, h = 0.4, loco = n === 0;
    const base = loco ? PAL.coral : [PAL.white, PAL.mint, PAL.sky, PAL.butter][n % 4];
    box(g, c, x, z - d / 2, w, d, 0.07, h, { tn: tones(base), rim: false });
    onLeft(g, c, x, 0.07, z + d / 2);
    g.fillStyle = css(mixc(PAL.glass, PAL.lit, 0.75));
    for (let i = 0; i < 3; i++) { g.beginPath(); g.roundRect(0.1 + i * 0.24, 0.16, 0.16, 0.15, 0.03); g.fill(); }
    
    offPlane(g);
  }

  // ---- the terminal's two rows: label plates with a soft shadow ----
  const INK = css(PAL.ink), INK2 = css(mixc(PAL.ink, PAL.lilac, 0.42));
  const maxTool = Math.max(...outs.filter((o) => o.kind === 'tool').map((o) => o.text.length), 8);
  function plateUI(g, x0, x1, yb, k = 1) {
    if (k <= 0.01 || x1 - x0 < 8) return;
    const y = yb - 62, h = 86, w = (x1 - x0) * k;
    g.save();
    g.shadowColor = css(PAL.shade, 0.3); g.shadowBlur = 30; g.shadowOffsetY = 12;
    g.fillStyle = '#FBFAFF';
    g.beginPath(); g.roundRect(x0, y, w, h, 22); g.fill();
    g.restore();
    g.fillStyle = css(PAL.lilac, 0.35);                                // a lip along the bottom: the plate has an edge
    g.save(); g.beginPath(); g.roundRect(x0, y, w, h, 22); g.clip(); g.fillRect(x0, y + h - 5, w, 5); g.restore();
  }
  function letters(g, s, col0, x, y, color, weight = 500, each = null) {
    g.font = `${weight} ${MONO}px "DM Mono"`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (let i = 0; i < s.length; i++) {
      if (s[i] === ' ') continue;
      const cx = x + (col0 + i) * DOCK.adv + DOCK.adv / 2;
      if (each) { const e = each(i); if (e.a <= 0) continue; g.save(); g.globalAlpha *= e.a; g.translate(cx, y + (e.dy || 0)); g.scale(e.s || 1, e.s || 1); g.fillStyle = e.color || color; g.fillText(s[i], 0, 0); g.restore(); } else { g.fillStyle = color; g.fillText(s[i], cx, y); }
    }
  }
  // Row B: fifteen files being written. "Write(shots/" stands still and only the file name ticks over, whole, on its
  // sixteenth, with a counter on a tab above (01/15 ... 15/15 and one pip a file). What is shown is decided once a
  // frame, so no frame (and no motion-blur sample) can catch a line half changed.
  const TOOLS = outs.filter((o) => o.kind === 'tool');
  const PRE = (() => {
    if (!TOOLS.length) return '';
    let pre = TOOLS[0].text;
    for (const o of TOOLS) { let i = 0; while (i < pre.length && pre[i] === o.text[i]) i++; pre = pre.slice(0, i); }
    return pre;                                                        // what every line starts with: "Write(shots/"
  })();
  const RESULT = outs.find((o) => o.kind === 'result');
  const TAB = { h: 68, font: 56, pip: 14, gap: 4 };
  function rowB(g, env) {
    if (!TOOLS.length) return;
    const fps = ctx.fps, frame = env.frame ?? Math.round(env.t * fps);
    const lbq = ctx.clock.beat(frame / fps) - shot.b0;                  // this frame's beat, the same for every blur sample
    const fr = (b) => (lbq - b) * env.spb * fps;                        // frames since local beat b
    let ti = -1;
    for (let i = 0; i < TOOLS.length; i++) if (TOOLS[i].at <= lbq + 1e-6) ti = i;
    if (ti < 0) return;
    const x = DOCK.x, y = DOCK.rowB, top = y - 62;
    const res = RESULT && RESULT.at <= lbq + 1e-6 ? RESULT : null;
    const n = TOOLS.length, last = ti === n - 1, done = last && lbq >= TOOLS[ti].at + 0.25;
    const wide = x + (2 + maxTool) * DOCK.adv + 26;
    const x1 = res ? lerp(wide, x + (5 + res.text.length) * DOCK.adv + 26, ease.outBack(seg(lbq - res.at, 0, 0.45), 1.2)) : wide;
    // the whole label arrives in one frame, complete, with a small spring
    const pop = 1 - 0.07 * (1 - ease.outBack(seg(fr(TOOLS[0].at), 0, 5), 2));
    g.save();
    g.translate(DOCK.left, y - 19); g.scale(pop, pop); g.translate(-DOCK.left, -(y - 19));
    // the counter's tab: it rises from behind the plate with the first file and tucks away when the result is printed
    const up = res ? 1 - ease.inCubic(seg(lbq - res.at, 0, 0.3)) : ease.outBack(seg(fr(TOOLS[0].at), 0, 7), 1.5);
    if (up > 0.01) {
      const num = String(ti + 1).padStart(2, '0'), tot = `/${String(n).padStart(2, '0')}`;
      const adv = TAB.font * (DOCK.adv / MONO), tw = 26 + (num.length + tot.length) * adv + 20 + n * (TAB.pip + TAB.gap) - TAB.gap + 22;
      const ty = top - TAB.h * up;
      g.save();
      g.beginPath(); g.rect(0, 0, W, top + 30); g.clip();
      g.shadowColor = css(PAL.shade, 0.26); g.shadowBlur = 22; g.shadowOffsetY = 8;
      g.fillStyle = '#FBFAFF'; g.beginPath(); g.roundRect(DOCK.left, ty, tw, TAB.h + 40, 18); g.fill();
      g.shadowColor = 'transparent';
      g.font = `500 ${TAB.font}px "DM Mono"`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      const a = fr(TOOLS[ti].at), by = ty + 52;
      g.fillStyle = css(done ? mixc(PAL.leaf, PAL.ink, 0.25) : PAL.coral); g.fillText(num, DOCK.left + 26, by - 5 * (1 - seg(a, 0, 2)));
      g.fillStyle = INK2; g.fillText(tot, DOCK.left + 26 + num.length * adv, by);
      const px = DOCK.left + 26 + (num.length + tot.length) * adv + 20;
      for (let k = 0; k < n; k++) {
        const cur = k === ti && !done, sz = TAB.pip + (cur ? 3 * (1 - seg(a, 0, 4)) : 0);
        g.fillStyle = css(k < ti || (k === ti && done) ? PAL.leaf : cur ? PAL.coral : mixc(PAL.lilac, WHITE, 0.45));
        g.beginPath(); g.roundRect(px + k * (TAB.pip + TAB.gap) + (TAB.pip - sz) / 2, by - 19 - sz / 2, sz, sz, 3.5); g.fill();
      }
      g.restore();
    }
    plateUI(g, DOCK.left, x1, y);
    if (res) {
      const a = fr(res.at), dy = -6 * (1 - seg(a, 0, 3));
      g.strokeStyle = INK2; g.lineWidth = 4.5; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(x + 2 * DOCK.adv + 18, y - 44 + dy); g.lineTo(x + 2 * DOCK.adv + 18, y - 12 + dy); g.lineTo(x + 2 * DOCK.adv + 46, y - 12 + dy); g.stroke();
      letters(g, res.text, 5, x, y + dy, INK2, 500);
    } else {
      const text = TOOLS[ti].text, a = fr(TOOLS[ti].at);
      // the bullet is a tiny cube: coral while files are being written, mint when the last one is down
      drawCube(g, CAM_END, [x + 18, y - 10], 17, done ? PAL.leaf : PAL.coral, 1, lerp(0.5, 1, seg(a, 0, 3)));
      const k = PRE.indexOf('('), rest = text.slice(PRE.length), close = rest.endsWith(')') ? 1 : 0, name = rest.slice(0, rest.length - close);
      letters(g, PRE.slice(0, k < 0 ? PRE.length : k), 2, x, y, INK, 500);
      if (k >= 0) letters(g, PRE.slice(k), 2 + k, x, y, INK2, 400);
      // the part that changes: always whole and opaque; it lands from a few pixels up, coral for a blink, then ink
      const tick = { a: 1, dy: -7 * (1 - seg(a, 0, 2)), color: css(mixc(PAL.coral, PAL.ink, seg(a, 1, 4))) };
      letters(g, name, 2 + PRE.length, x, y, INK, 500, () => tick);
      if (close) letters(g, ')', 2 + PRE.length + name.length, x, y, INK2, 400);
    }
    g.restore();
  }

  function dock(g, env, part) {
    const m = env.term, lb = env.lb, x = DOCK.x;
    const c = camAt(Math.max(0, lb));
    if (part !== 'C') rowB(g, env);
    if (part === 'B') return;
    const r = m.rowC, y = DOCK.rowC;
    const clearAt = m.typing ? m.typing.start - 1 : Infinity;
    const gone = r.mode === 'cmd' ? ease.inOutCubic(seg(lb, clearAt - 0.75, clearAt - 0.05)) : 0;
    const shownN = r.mode === 'cmd' ? Math.round(r.text.length * (1 - gone)) : r.n;
    // the plate follows the text: it grows a cell with every key
    let cols = 2 + shownN + 1.6;
    if (r.mode === 'typing' && r.n > 0) cols -= 1 - clamp(r.keyAge(r.n - 1) / 0.08);
    plateUI(g, DOCK.left, x + Math.max(4.4, cols) * DOCK.adv + 26, y);
    g.font = `500 ${MONO}px "DM Mono"`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = css(PAL.coral); g.fillText('>', x + DOCK.adv / 2, y);
    if (r.mode === 'cmd') letters(g, r.text.slice(0, shownN), 2, x, y, INK2, 500);
    else {
      letters(g, r.text.slice(0, r.n), 2, x, y, INK, 500, (i) => { const age = r.keyAge(i), d = decay(age, 0.05); return { a: 1, s: 1 + 0.14 * d, dy: -6 * d, color: css(mixc(PAL.ink, PAL.coral, d)) }; });
      // the cursor is the cube. Off beat it sits down flat; while it is away in the city only its footprint is left
      const cu = cubeAt(Math.max(0, lb), c), n = r.n, fx = cellX(n);
      if (r.cursor) {
        if (lb >= 0 && !cu.home) {
          g.fillStyle = css(PAL.lilac, 0.6);
          g.beginPath(); g.ellipse(fx, CUBE_Y, 15, 8, 0, 0, TAU); g.fill();
        } else {
          const f = env.ab - Math.floor(env.ab);
          const typing = n > 0 && r.keyAge(n - 1) < 0.75;
          let up = typing ? 1 : f < 0.5 ? smooth(f / 0.07) : 1 - smooth((f - 0.5) / 0.07);
          let hk = lerp(0.2, 1, up), dy = 0;
          if (lb >= 0 && cu.home && cu.land < 0.5) { hk *= 1 - 0.45 * decay(cu.land, 0.04) + 0.12 * Math.sin(cu.land * 20) * decay(cu.land, 0.1); }
          if (typing) dy = -9 * decay(r.keyAge(n - 1), 0.04);
          drawCube(g, lb < 0 ? CAM_END : c.walls ? c : CAM_END, [fx, CUBE_Y + dy], DOCK_SC, PAL.coral, 1, hk);
        }
      }
    }
  }

  // ---- the frame ----
  function render(g, env) {
    const lb = Math.max(0, env.lb);
    const c = camAt(lb);
    let ho = env.other && env.role === 'in' && env.otherImpl && env.otherImpl.handoff ? env.otherImpl.handoff(env.otherEnv) : null;
    if (TEST && env.other && env.role === 'in') ho = { paper: '#F1E9DA', modules: Array.from({ length: 18 }, (_, i) => ({ x: (i % 8) * 240, y: 60 + ((i * 3) % 4) * 240, w: 240, h: 240, color: ['#E03C31', '#F2B705', '#1E4FA3', '#111'][i % 4] })) };
    const real = !!(ho && Array.isArray(ho.modules) && ho.modules.length);
    // a built shot before this one is always used as the sheet, even if it names no squares (the plots then grow from nothing);
    // only a placeholder card is swapped for the stand-in poster
    const theirs = !!(env.other && env.role === 'in' && env.otherImpl && !env.otherImpl.placeholder) || real;
    const mods = real ? ho.modules : theirs ? [] : STAND.modules, paperCol = ho && ho.paper ? ho.paper : STAND.paper;
    const of = match(mods);
    const soft = smooth(seg(lb, 0.25, 1.35));

    // 1. the void and the far clouds
    offPlane(g);
    g.drawImage(BG, 0, 0);
    clouds(g, c, lb, SKY);

    // 2. the island's body, and the small islands beyond it
    for (const it of ISLETS) islet(g, c, it, lb);
    slab(g, c, soft);

    // 3. the sheet: ground where the tiles have turned, poster where they have not
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const waving = lb < WAVE_END;
    let sheet = null;
    if (waving) {
      // the poster with the fifteen squares lifted off it (they are drawn as plots, and may slide)
      pg.setTransform(1, 0, 0, 1, 0, 0);
      pg.drawImage(theirs ? env.other : POSTER, 0, 0);
      pg.fillStyle = paperCol;
      for (let i = 0; i < 15; i++) if (of[i] >= 0) { const m = mods[of[i]]; pg.fillRect(m.x, m.y, m.w, m.h); }
      sheet = PATCH;
    }
    sheetXf(g, c); g.drawImage(GT, 0, 0);
    if (waving) {
      g.save();
      g.beginPath();
      let any = false;
      for (const t of TILES) if (lb < t.t0) { g.rect(t.i * TILE - 0.6, t.j * TILE - 0.6, TILE + 1.2, TILE + 1.2); any = true; }
      if (any) { g.clip(); g.drawImage(sheet, 0, 0); }
      g.restore();
      // tiles in the air, far ones first
      const fl = TILES.filter((t) => lb >= t.t0 && lb < t.t0 + FLIP).sort((p, q) => c.key(p.i, p.j) - c.key(q.i, q.j));
      for (const t of fl) {
        sheetXf(g, c);
        g.fillStyle = css(mixc(PAL.ground, PAL.shade, 0.35)); g.fillRect(t.i * TILE, t.j * TILE, TILE, TILE);
      }
      for (const t of fl) {
        const p = (lb - t.t0) / FLIP, th = Math.PI * ease.outBack(p, 1.1), lift = 0.42 * Math.sin(Math.PI * p);
        const cs = Math.cos(th), sn = Math.sin(th), front = cs > 0, sgn = front ? 1 : -1;
        const cx = t.i + 0.5, cz = t.j + 0.5;
        g.setTransform(c.ax, c.bx, sgn * c.az * cs, sgn * (c.bz * cs + c.by * sn), c.X(cx, cz), c.Y(cx, lift, cz));
        g.drawImage(front ? sheet : GT, t.i * TILE, t.j * TILE, TILE, TILE, -0.5, -0.5, 1, 1);
        g.fillStyle = front ? css(PAL.shade, 0.3 * Math.abs(sn)) : css(WHITE, 0.35 * Math.abs(sn)); g.fillRect(-0.5, -0.5, 1, 1);
      }
    }

    // 4. soft shadows and contact shade, drawn small and blurred, tinted lavender
    const cast = [];
    if (c.walls) BUILDINGS.forEach((b, i) => casters(b, lb - T[i], cast));
    const cubeW = (() => { const q = cubeAt(lb, c); return q.world || null; })();
    if (c.walls && lb > 0.3) {
      const polys = cast.map((k) => shadowAt(k, -PLATE_H)).filter(Boolean);
      const drawPolys = (extra) => {
        sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, SH.width, SH.height);
        sg.setTransform(c.ax / 2, c.bx / 2, c.az / 2, c.bz / 2, c.ox / 2, c.oy / 2);
        sg.fillStyle = css(PAL.shade);
        extra();
      };
      drawPolys(() => {
        for (const p of polys) { sg.beginPath(); sg.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) sg.lineTo(p[i][0], p[i][1]); sg.closePath(); sg.fill(); }
        for (const t of PARK) { const k = treeK(t, lb); if (k > 0.05) { sg.beginPath(); sg.ellipse(t.x + 0.16 * t.s, t.z - 0.08 * t.s, 0.34 * t.s * k, 0.2 * t.s * k, 0, 0, TAU); sg.fill(); } }
        BUILDINGS.forEach((b, i) => { const k = grow(b, lb - T[i]).pop(2); for (const t of b.trees) if (k > 0.05) { sg.beginPath(); sg.ellipse(t.x + 0.16 * t.s, t.z - 0.08 * t.s, 0.34 * t.s * k, 0.2 * t.s * k, 0, 0, TAU); sg.fill(); } });
        const tk = seg(lb, T[1] - 0.1, T[1] + 0.45);
        if (tk > 0) { sg.beginPath(); sg.moveTo(TURBINE.x - 0.07, TURBINE.z); sg.lineTo(TURBINE.x + 0.07, TURBINE.z); sg.lineTo(TURBINE.x + SHADOW.x * TURBINE.h * tk + 0.04, TURBINE.z + SHADOW.z * TURBINE.h * tk); sg.lineTo(TURBINE.x + SHADOW.x * TURBINE.h * tk - 0.04, TURBINE.z + SHADOW.z * TURBINE.h * tk); sg.closePath(); sg.fill(); }
        // the train
        trainCars(lb).forEach((x) => { if (x !== null) sg.fillRect(x + 0.04, RAIL_Z - 0.3, TRAIN.len + 0.2, 0.46); });
        if (cubeW) { sg.beginPath(); sg.ellipse(cubeW[0] + SHADOW.x * cubeW[1] * 0.4, cubeW[2] + SHADOW.z * cubeW[1] * 0.4, 0.42, 0.3, 0, 0, TAU); sg.fill(); }
        for (const d of DRONES) { const k = seg(lb, d.t0, d.t0 + 0.5); if (k > 0) { const [x, y, z] = droneAt(d, lb); sg.beginPath(); sg.ellipse(x + SHADOW.x * y * 0.5, z + SHADOW.z * y * 0.5, 0.26 * k, 0.18 * k, 0, 0, TAU); sg.fill(); } }
      });
      g.save(); islandTop(g, c); g.clip();
      g.globalAlpha = 0.78; g.filter = `blur(${(c.S * 0.06).toFixed(1)}px)`;
      g.drawImage(SH, 0, 0, W, H);
      g.restore();
      // contact shade: a tight dark rim where each thing meets the ground
      drawPolys(() => {
        BUILDINGS.forEach((b, i) => { const gt = lb - T[i]; if (gt > 0.05) { const f = b.foot, e = 0.07, k = clamp(gt / 0.3); sg.globalAlpha = k; sg.fillRect(f.x0 - e, f.z0 - e, f.x1 - f.x0 + 2 * e + 0.08, f.z1 - f.z0 + 2 * e); } });
        sg.globalAlpha = 1;
      });
      g.save(); islandTop(g, c); g.clip();
      g.globalAlpha = 0.5; g.filter = `blur(${(c.S * 0.04).toFixed(1)}px)`;
      g.drawImage(SH, 0, 0, W, H);
      g.restore();
      g.filter = 'none';
    }

    // rings: a soft pop spreading from every plot the moment its building starts
    for (let i = 0; i < 15; i++) {
      const q = (lb - T[i]) / 0.55;
      if (q <= 0 || q >= 1) continue;
      const l = LOTS[i], e = 0.75 * ease.outCubic(q);
      onTop(g, c, 0, 0.01, 0);
      g.strokeStyle = css(WHITE, 0.9 * (1 - q)); g.lineWidth = 0.09 * (1 - q) + 0.02;
      g.beginPath(); g.roundRect(l.x - e, l.z - e, l.w + 2 * e, l.d + 2 * e, 0.16 + e * 0.5); g.stroke();
    }

    // 5. everything that stands up, far to near
    const objs = [];
    const beat = lb;
    const pulse = lb > T[14] + 0.8 ? (b, r) => { const p = (lb - Math.floor(lb)) - b.cx * 0.02 - r * 0.012; return p > 0 && p < 0.16 ? Math.sin((Math.PI * p) / 0.16) : 0; } : null;
    BUILDINGS.forEach((b, i) => {
      const gt = lb - T[i];
      objs.push({ k: c.key(b.cx, b.cz), d: () => {
        const pl = plate(i, lb, mods, of);
        if (pl.w > 0.02) {
          box(g, c, pl.x, pl.z, pl.w, pl.d, pl.y, pl.h, { tn: pl.tn, rim: false, flatOK: true });
          // the plot's number is printed on its pastel side; the building covers it
          const na = seg(pl.flip, 0.86, 1) * (1 - seg(gt, -0.02, 0.12));
          if (na > 0.01) topText(g, c, b.num, pl.x + pl.w / 2, pl.h + 0.01, pl.z + pl.d / 2, 0.62, css(PAL.ink, 0.5 * na), 700);
        }
        if (gt > 0) {
          const cc = { ...c, Y: (x, y, z) => c.Y(x, y + PLATE_H, z), P: (x, y, z) => c.P(x, y + PLATE_H, z) };
          building(g, cc, b, gt, { beat, pulse, casters: cast });
        }
        offPlane(g);
      } });
      const tk = gt > 0 ? grow(b, gt).pop(2) : 0;
      for (const t of b.trees) if (tk > 0.01) objs.push({ k: c.key(t.x, t.z) + 0.35, d: () => tree(g, c, t.x, t.z, t.s, tk, t.kind) });
    });
    for (const t of PARK) { const k = treeK(t, lb); if (k > 0.01) objs.push({ k: c.key(t.x, t.z), d: () => tree(g, c, t.x, t.z, t.s, k, t.kind) }); }
    // packets running the streets: a small bright cube and the streak it leaves
    const pkA = smooth(seg(lb, WAVE_END - 0.2, WAVE_END + 0.5));
    if (pkA > 0.01 && c.walls) for (const p of PK) {
      const len = p.ew ? NX : 7.6, u = (((p.ph + lb * p.v * p.dir) % 1) + 1) % 1, s = 0.15 + u * (len - 0.3);
      const x = p.ew ? s : p.at, z = p.ew ? p.at : s, fade = Math.min(1, u / 0.05, (1 - u) / 0.05) * pkA;
      objs.push({ k: c.key(x, z) - 0.2, d: () => {
        const tail = 0.95 * p.dir, a = c.P(x, 0.02, z), b2 = c.P(p.ew ? x - tail : x, 0.02, p.ew ? z : z - tail);
        offPlane(g);
        const gr = g.createLinearGradient(a[0], a[1], b2[0], b2[1]);
        gr.addColorStop(0, css(WHITE, 0.95 * fade)); gr.addColorStop(1, css(WHITE, 0));
        g.strokeStyle = gr; g.lineWidth = c.S * 0.1; g.lineCap = 'round';
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b2[0], b2[1]); g.stroke();
        g.globalAlpha = fade; cube(g, c, x, 0.06, z, 0.21, PAL[p.col]); offPlane(g); g.globalAlpha = 1;
      } });
    }
    trainCars(lb).forEach((x, n) => { if (x !== null) objs.push({ k: c.key(x + TRAIN.len / 2, RAIL_Z) + 0.6, d: () => trainCar(g, c, x, n, lb) }); });
    objs.push({ k: c.key(TURBINE.x, TURBINE.z), d: () => turbine(g, c, lb) });
    for (const d of DRONES) { const [x, , z] = droneAt(d, lb); objs.push({ k: c.key(x, z) + 1.2, d: () => drone(g, c, d, lb) }); }
    objs.sort((p, q) => p.k - q.k);
    for (const o of objs) o.d();
    offPlane(g);
    // a bright lip along the sheet's two near edges
    if (c.walls) {
      const a = c.P(0, 0, NZ), b = c.P(NX, 0, NZ), d = c.P(NX, 0, 0);
      g.strokeStyle = css(WHITE, 0.7 * soft); g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(d[0], d[1]); g.stroke();
    }

    // 6. the title, lying on the same plane: a plinth rises beside the island and the letters drop onto it
    titleCard(g, c, lb);

    // 7. the cursor cube, out in the world
    const cu = cubeAt(lb, c);
    if (!cu.home && env.lb >= 0) {
      const col = cubeCol(lb);
      if (cu.air) for (let j = 4; j >= 1; j--) { const q = cubeAt(lb - j * 0.028, c); if (!q.home && q.p) drawCube(g, c, q.p, q.sc, col, 0.3 * (1 - j / 5), q.h || 1, q.w || 1); }
      drawCube(g, c, cu.p, cu.sc, col, 1, cu.h || 1, cu.w || 1);
    }

    // 8. clouds nearer than the island
    clouds(g, c, lb, FRONT);

    // 9. the tag and the terminal's rows
    const tagK = ease.outBack(seg(lb, 0.9, 1.35), 1.5);
    if (env.tag && tagK > 0.01) {
      const s1 = `${env.tag.num}/${env.tag.of}`, s2 = env.tag.name;
      g.save();
      g.translate(DOCK.left, 132); g.scale(tagK, tagK); g.globalAlpha = Math.min(1, tagK);
      g.font = '700 42px "Outfit"'; g.letterSpacing = '1px';
      const w1 = g.measureText(s1).width;
      g.font = '600 42px "Outfit"'; g.letterSpacing = '5px';
      const w2 = g.measureText(s2).width;
      g.shadowColor = css(PAL.shade, 0.28); g.shadowBlur = 26; g.shadowOffsetY = 10;
      g.fillStyle = '#FBFAFF'; g.beginPath(); g.roundRect(0, -42, 62 + w1 + 30 + w2 + 22, 76, 22); g.fill();
      g.shadowColor = 'transparent';
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      g.font = '700 42px "Outfit"'; g.letterSpacing = '1px'; g.fillStyle = css(PAL.coral); g.fillText(s1, 62, 12);
      g.font = '600 42px "Outfit"'; g.letterSpacing = '5px'; g.fillStyle = INK; g.fillText(s2, 62 + w1 + 30, 12);
      g.letterSpacing = '0px';
      g.restore();
      g.save(); g.globalAlpha = Math.min(1, tagK);
      drawCube(g, CAM_END, [DOCK.left + 33 * tagK, 132 + 9 * tagK], 21 * tagK, PAL.mint);
      g.restore();
    }
    offPlane(g);
    if (TEST) { const hf = handoff(env); g.lineWidth = 2; for (const b of hf.buildings) { g.strokeStyle = b.color; g.strokeRect(b.x, b.y, b.w, b.h); g.strokeStyle = '#000'; g.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4); } }
    if (env.noDock) return;
    if (env.other && env.role === 'in' && env.otherImpl && env.otherImpl.dock) swapDock(g, env, dock, lb / 0.8);
    else dock(g, env);
  }

  const treeK = (t, lb) => ease.outBack(seg(lb, 0.9 + (NX - t.x) * 0.24 + hash(t.n) * 0.2, 1.3 + (NX - t.x) * 0.24 + hash(t.n) * 0.2), 2.2);
  function trainCars(lb) {
    if (lb < TRAIN.t0) return [];
    const car = TRAIN.len + TRAIN.gap, span = NX + TRAIN.cars * car + 4, head = NX - (((lb - TRAIN.t0) * TRAIN.v) % span), out = [];
    for (let n = 0; n < TRAIN.cars; n++) { const x = head + n * car; out.push(x > 0.05 && x < NX - TRAIN.len - 0.05 ? x : null); }
    return out;
  }

  function titleCard(g, c, lb) {
    const k = ease.outBack(seg(lb, T_RES + 0.2, T_RES + 0.95), 1.3);
    if (k <= 0.001 || !c.walls) return;
    const p = PLINTH, y = p.y - 6 * (1 - k);
    g.save(); g.globalAlpha = clamp(k * 3);
    box(g, c, p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0, y - p.th, p.th, { tn: { top: PAL.white, left: PAL.lilac, right: mixc(PAL.lilac, PAL.shade, 0.3), deep: PAL.slabR }, rim: 0.12 });
    g.restore();
    const xc = (p.x0 + p.x1) / 2;
    TLET.forEach((l, i) => {
      if (l.ch === ' ') return;
      const t0 = T_RES + 0.8 + i * 0.075, q = seg(lb, t0, t0 + 0.26);
      if (q <= 0) return;
      const fall = (1 - q * q) * 3.2, land = lb - (t0 + 0.26);
      const sq = land > 0 ? 1 - 0.3 * decay(land, 0.035) + 0.08 * Math.sin(land * 22) * decay(land, 0.09) : 1.08;
      const digit = /[0-9]/.test(l.ch);
      const top = digit ? PAL.coral : PAL.ink, side = mixc(top, digit ? PAL.shade : [20, 14, 70], 0.45);
      const th = 0.2 * sq, n = Math.max(3, Math.ceil((th * -c.by) / 1.2));
      for (let s = 0; s <= n; s++) {
        onTopZ(g, c, xc, y + fall + (th * s) / n, TZ - l.x);
        g.scale(1 / 200, 1 / 200);
        g.font = `800 ${TEM * 200}px "Outfit"`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.globalAlpha = clamp(q * 4);
        g.fillStyle = css(s === n ? top : side);
        g.fillText(l.ch, 0, TCAP * 100);
      }
      g.globalAlpha = 1;
    });
    offPlane(g);
  }

  /** What stands where, for the shot that takes this picture over: each building's box on screen. */
  function handoff(env) {
    const lb = Math.max(0, env.lb), c = camAt(lb);
    const buildings = BUILDINGS.map((b, i) => {
      const G = grow(b, lb - T[i]), f = b.foot, top = PLATE_H + G.top;
      const pts = [c.P(f.x0, 0, f.z0), c.P(f.x1, 0, f.z0), c.P(f.x1, 0, f.z1), c.P(f.x0, 0, f.z1), c.P(f.x0, top, f.z0), c.P(f.x1, top, f.z0), c.P(f.x1, top, f.z1), c.P(f.x0, top, f.z1)];
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, color: toHex(b.base), num: b.num, height: G.top, tone: b.colName };
    });
    return {
      buildings, ground: toHex(PAL.ground), sky: [toHex(PAL.void0), toHex(PAL.void1)],
      island: [c.P(0, 0, 0), c.P(NX, 0, 0), c.P(NX, 0, NZ), c.P(0, 0, NZ)],
      title: { text: TITLE, at: c.P((PLINTH.x0 + PLINTH.x1) / 2, PLINTH.y, TZ) }, ink: toHex(PAL.ink), accent: toHex(PAL.coral),
      cursor: { x: cellX(env.term && env.term.rowC ? env.term.rowC.n : 0), y: CUBE_Y, color: toHex(PAL.coral) },
    };
  }

  const pops = ['iso_pop1', 'iso_pop2', 'iso_pop3'];
  return {
    dock,
    render,
    handoff,
    // real motion blur while things fly, rise and turn over; none in the hold, where everything is slow
    samples: (env) => (env.lb < -0.05 || env.lb >= T[14] + 0.75 ? 1 : env.lb < 0.9 ? 8 : 5),
    sfx: [
      { b: 0, s: 'iso_tip', g: 0.8 },                                  // the sheet tips back: a soft airy swoosh with a paper flutter
      { b: 0.08, s: 'iso_flip', g: 0.5 },                              // the tiles turn over in a wave: a ripple of light clicks, 0.7 s
      // one pluck for every building. Three to a column, back to front: low, middle, high, so each column is a rising triplet
      ...T.map((t, i) => ({ b: t, s: pops[i % 3], g: +(0.6 + 0.2 * (i / 14)).toFixed(2), a: 'peak' })),
      { b: T[9] + 0.8, s: 'iso_hero', g: 0.7, a: 'peak' },             // the tallest tower gets its sun: one bright glassy chime
      { b: HOME, s: 'iso_home', g: 0.6, a: 'peak' },                   // the cube lands back on the prompt row: a small wooden tock
      { b: T_RES - 0.15, s: 'iso_pull', g: 0.7 },                      // the pull back: a long airy whoosh opening out
      // the title's letters dropping onto the plinth: one soft thud as each lands (see the title's timing in render), the last firmer
      ...[...TITLE].flatMap((ch, i) => (ch === ' ' ? [] : [{ b: T_RES + 1.06 + i * 0.075, s: 'iso_title', g: i === TITLE.length - 1 ? 0.8 : +(0.42 + 0.03 * i).toFixed(2), a: 'peak' }])),
    ],
  };
}
