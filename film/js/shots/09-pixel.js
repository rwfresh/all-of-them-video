// 09 Pixel Art: the render.
//
// `render it.` The picture before this one turns to mosaic on the three crunches: its colours snap to this shot's 24
// with ordered dither in blocks of 3, then blocks of 6 (the shot's own grid, and the tube's scan lines), then 12. From
// the third crunch its pale paper turns into this shot's world from the top down, a dithered band a few rows deep,
// while everything that stood on the paper stays where it stood; the blocks come back down to 6: 320 x 180, a
// side-scroller. Then the old things become this shot's things, where they are: the big frame count shrinks and is
// carried into the counter as its target, the wall's frame tiles leave it as gold frames (nine settle on the path as
// pick-ups), the prompt's label (in its own skin, never cut up) is taken over by the dialogue box a column at a time,
// every other sticker comes unstuck as the world reaches it and drops behind the film strip, and the cursor beams out
// of the prompt and comes down as the player:
// Claude Code's own block mascot, which was pixel art all along.
// It runs along a film strip, exposing a frame of this film in every cell it crosses, while the counter races to the
// film's real frame count. Day turns to sunset in palette steps on the beats; the run gets faster. `play it.` is typed
// (its first keys take pick-ups); the count sticks one frame short for a beat while the last frame, the one with the
// play triangle on it, comes closer. Half a beat before the bar line it is taken: the player holds it up, rays stand
// out from it, DONE!, and that picture is held for whatever comes next.
//
// Everything is drawn on a 320 x 180 canvas at whole-dot positions and scaled by 6 with no smoothing. The world moves
// on a 30-a-second tick, sprites change 12.4 times a second (six a beat), the palette changes in steps.

import { DOCK, MASCOT, cursorRect } from '../term.js';
import { SMALL, glyph, text, bigNum } from './pixel/font.js';

const LW = 320, LH = 180, SC = 6;

// ---- the palette: PICO-8's sixteen, seven of its hidden sixteen, and the mascot's own orange ----
const C = {
  black: '#000000', navy: '#1D2B53', plum: '#7E2553', dgreen: '#008751', brown: '#AB5236', dgrey: '#5F574F',
  lgrey: '#C2C3C7', white: '#FFF1E8', red: '#FF004D', orange: '#FFA300', yellow: '#FFEC27', green: '#00E436',
  blue: '#29ADFF', lav: '#83769C', pink: '#FF77A8', peach: '#FFCCAA',
  night: '#111D35', dusk: '#422136', teal: '#125359', dblue: '#065AB5', salmon: '#FF9D81', fire: '#FF6C24', mauve: '#754665',
  claude: '#D97757',
};
const PAL = Object.values(C).map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

// ---- the look of each time of day (the palette steps, on beats 3 to 7) ----
const STAGES = [
  { at: -99, sky: [C.dblue, C.blue, C.blue, C.white],   mt: [C.lgrey, C.lav, C.white],   fo: [C.dgreen, C.green],  cl: [C.white, C.lgrey],  sun: [C.white, C.yellow],  edge: C.white,  sunY: 46, sunR: 12 },
  { at: 3,   sky: [C.dblue, C.blue, C.white, C.peach],  mt: [C.lgrey, C.lav, C.white],   fo: [C.dgreen, C.green],  cl: [C.white, C.peach],  sun: [C.yellow, C.white],  edge: C.peach,  sunY: 52, sunR: 13 },
  { at: 4,   sky: [C.dblue, C.lav, C.pink, C.peach],    mt: [C.pink, C.plum, C.peach],   fo: [C.teal, C.dgreen],   cl: [C.peach, C.pink],   sun: [C.yellow, C.orange], edge: C.pink,   sunY: 58, sunR: 14 },
  { at: 5,   sky: [C.navy, C.lav, C.pink, C.orange],    mt: [C.mauve, C.plum, C.pink],   fo: [C.teal, C.dgreen],   cl: [C.pink, C.plum],    sun: [C.orange, C.yellow], edge: C.orange, sunY: 64, sunR: 15 },
  { at: 6,   sky: [C.night, C.plum, C.fire, C.orange],  mt: [C.plum, C.dusk, C.mauve],   fo: [C.navy, C.teal],     cl: [C.plum, C.dusk],    sun: [C.fire, C.orange],   edge: C.fire,   sunY: 70, sunR: 16 },
  { at: 7,   sky: [C.black, C.navy, C.plum, C.fire],    mt: [C.dusk, C.night, C.plum],   fo: [C.night, C.navy],    cl: [C.dusk, C.night],   sun: [C.red, C.fire],      edge: C.red,    sunY: 76, sunR: 17 },
];
const stageAt = (lb) => { let i = 0; for (let k = 0; k < STAGES.length; k++) if (lb >= STAGES[k].at) i = k; return i; };

// ---- the layout, in dots ----
const GROUND = 100;                                  // top of the film strip the player runs on
const STRIP = 22, CELL = 24;                         // the strip's height; one frame cell's width
const MU = 3;                                        // the player: dots to a quarter-block across (twice that down)
const MX = 58, MW = MASCOT.cols * MU, MH = MASCOT.rows * 2 * MU;   // its left edge; its size, 51 x 30
const GRAB = MX + MW - 5;                            // a pick-up is taken when its middle reaches this
const BOX = { x: 22, y: 128, w: 276, h: 40 };        // the dialogue box: the film's two rows live in it
const ROW_B = 135, ROW_C = 153, COL0 = DOCK.x / SC;  // the top of each row's letter cell; the ">" column (dot 28)
const HUD = { x: 224, y: 13, w: 74, h: 37 };
const SUN_X = 160;

// ---- time, in local beats ----
const T = {
  mosaic: 0,                 // the old picture, its colours cut to the palette, in blocks of 3 screen pixels
  step: 0.25,                // blocks of 6, and the tube's scan lines
  swap: 0.5,                 // blocks of 12; the paper starts to turn into this shot's world from the top
  clear: 0.625,              // blocks of 6: the picture's own grid. The old things start to become this shot's
  fall: 0.75,                // the old stickers come unstuck and drop as the world reaches them (the run's middle)
  go: 1.5,                   // the player is here and runs; the counter starts
  stuck: 6.5,                // the count sticks one short
  done: 7.5,                 // the last frame is taken, and held up until the bar line and after
};
// how fast the ground goes by, in dots a beat
const SPEED = [[1.5, 36], [4, 44], [4, 60], [6, 66], [6, 84], [7, 100], [7, 108], [7.5, 108], [7.5, 0], [12, 0]];       // it stops dead on the take
// jumps: [take-off, length in beats, height in dots]; the second comes down on the bug
const J1 = [3, 0.5, 30], J2 = [4, 0.5, 28], J3 = [4.5, 0.25, 10], BUG_TOP = 9, BOP = 4.5;
// the local beat each pick-up is taken on (the keys typed before the count sticks add theirs)
const PICKS = [2, 2.5, 3.25, 3.75, 4.25, 5];

export default async function make(ctx) {
  const { W, H, util } = ctx;
  const { clamp, seg, rng, hash } = util;
  const FRAMES = Math.round(ctx.clock.duration * ctx.fps);
  const TOT = String(FRAMES);
  const spb = ctx.clock.spb;
  const shots = ctx.clock.shots;

  const lo = ctx.makeCanvas(LW, LH), lg = lo.getContext('2d');
  const px = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const bits = (g, rows, x, y, col) => { g.fillStyle = col; rows.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === '#') g.fillRect(x + c, y + r, 1, 1); }); };

  // nearest palette colour for any 15-bit colour
  const LUT = new Uint8Array(32768);
  for (let i = 0; i < 32768; i++) {
    const r = ((i >> 10) & 31) * 8 + 4, g = ((i >> 5) & 31) * 8 + 4, b = (i & 31) * 8 + 4;
    let best = 0, bd = 1e9;
    for (let k = 0; k < PAL.length; k++) { const p = PAL[k], d = (r - p[0]) * (r - p[0]) * 0.9 + (g - p[1]) * (g - p[1]) * 1.2 + (b - p[2]) * (b - p[2]) * 0.8; if (d < bd) { bd = d; best = k; } }
    LUT[i] = best;
  }
  /** Cut an ImageData's colours to the palette, with ordered dither. Returns it. */
  function cutColours(img, spread = 26) {
    const d = img.data, w = img.width, h = img.height;
    for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
      if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
      const o = (bayer(x, y) / 16 - 0.47) * spread;
      const r = clamp(d[i] + o, 0, 255), g = clamp(d[i + 1] + o, 0, 255), b = clamp(d[i + 2] + o, 0, 255);
      const p = PAL[LUT[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)]];
      d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = 255;
    }
    return img;
  }

  // ---- this film's own frames, tiny: one for each shot, for the strip's cells and the pick-ups ----
  const cellPic = [], coinPic = [];
  await Promise.all(shots.map(async (s, i) => {
    let im = null;
    try { im = await ctx.image(`/assets/thumbs/${s.name}.png`); } catch { /* not made yet: a flat colour stands in */ }
    const mk = (w, h) => {
      const c = ctx.makeCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
      if (im) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, w, h); }
      else { g.fillStyle = `hsl(${(i * 47) % 360} 45% 40%)`; g.fillRect(0, 0, w, h); }
      g.putImageData(cutColours(g.getImageData(0, 0, w, h), 18), 0, 0);
      return c;
    };
    cellPic[i] = mk(22, 12); coinPic[i] = mk(10, 8);
  }));

  // ---- how far the ground has gone by each beat (the integral of SPEED), and its inverse ----
  const STEP = 1 / 64, DIST = [];
  {
    let d = 0;
    const speed = (lb) => {
      if (lb < SPEED[0][0]) return 0;
      for (let k = 0; k < SPEED.length - 1; k++) { const [a, va] = SPEED[k], [b, vb] = SPEED[k + 1]; if (lb >= a && lb < b) return va + ((vb - va) * (lb - a)) / (b - a); }
      return SPEED[SPEED.length - 1][1];
    };
    for (let i = 0; i <= 12 / STEP; i++) { DIST.push(d); d += speed((i + 0.5) * STEP) * STEP; }
  }
  const dist = (lb) => { const f = clamp(lb, 0, 11.99) / STEP, i = Math.floor(f); return DIST[i] + (DIST[i + 1] - DIST[i]) * (f - i); };
  const whenDist = (d) => { let a = 0, b = 11.99; for (let k = 0; k < 24; k++) { const m = (a + b) / 2; if (dist(m) < d) a = m; else b = m; } return a; };

  // ---- the counter ----
  const frameAt = (lb) => (lb < T.go ? 0 : lb >= T.done ? FRAMES : Math.min(FRAMES - 1, 1 + Math.floor((FRAMES - 2) * Math.pow(seg(lb, T.go, T.stuck), 1.7))));
  const shotOfFrame = (f) => { const t = f / ctx.fps; let i = shots.findIndex((s) => t >= s.t0 && t < s.t1); if (i < 0) i = shots.length - 1; return i; };
  // which of the film's shots each cell of the strip shows, once the player has crossed it
  const cellShot = [], cellWhen = [];
  for (let c = 0; c < 60; c++) { const d = c * CELL + CELL / 2 - (MX + MW / 2); cellWhen[c] = d < 0 ? -1 : whenDist(d); cellShot[c] = d < 0 ? -1 : shotOfFrame(frameAt(cellWhen[c])); }

  // ---- pick-ups ----
  const keyBeats = (() => { const S = ctx.script.shots[ctx.shot.name]; return S && S.next ? S.next.keys.map((b) => b - ctx.shot.b0) : []; })();
  const jumpY = (lb) => {
    let y = 0;
    { const [t0, d, h] = J1, u = (lb - t0) / d; if (u > 0 && u < 1) y = Math.max(y, h * 4 * u * (1 - u)); }
    { const [t0, d, h] = J2, u = (lb - t0) / d; if (u > 0 && u <= 1) y = Math.max(y, u < 0.5 ? h * 4 * u * (1 - u) : Math.max(BUG_TOP, h * 4 * u * (1 - u))); }
    { const [t0, d, h] = J3, u = (lb - t0) / d; if (u > 0 && u < 1) y = Math.max(y, BUG_TOP * (1 - u) + h * 4 * u * (1 - u)); }
    return Math.round(y);
  };
  const pickBeats = [...PICKS, ...keyBeats.filter((b) => b < T.stuck - 1e-6)];
  const picks = pickBeats.map((t) => ({ t, wx: dist(t) + GRAB, y: GROUND - 21 - jumpY(t), shot: shotOfFrame(frameAt(t)) }));
  const LAST = { t: T.done, wx: dist(T.done) + GRAB + 4, y: GROUND - 25 };       // the frame with the play triangle
  const ticksSince = (lb, a) => Math.floor((lb - a) * spb * 30 + 1e-6);
  /** Where the last frame is once it is taken: it hops from where it was met to over the player's head in three ticks. */
  const heldAt = (lb, sc) => {
    const u = clamp((ticksSince(lb, T.done) + 1) / 4), x0 = Math.round(LAST.wx) - sc - 11, hx = MX + (MW >> 1) - 11, hy = GROUND - MH - 24;
    return { x: Math.round(x0 + (hx - x0) * u), y: Math.round(LAST.y + (hy - LAST.y) * u - Math.sin(u * Math.PI) * 8) };
  };
  const BUG = { wx: dist(BOP) + MX + MW / 2, walk: 5 };                           // it walks toward the player, 5 dots a beat

  // =====================================================================================================================
  // Layers painted once for each time of day

  function skyOf(st) {
    const c = ctx.makeCanvas(LW, GROUND + 2), g = c.getContext('2d');
    const ys = [0, 22, 48, 72, GROUND + 2];
    for (let y = 0; y < GROUND + 2; y++) {
      let k = 0; while (k < 3 && y >= ys[k + 1]) k++;
      // each band holds its colour for its first third, then dithers into the next
      const f = k >= 3 ? 0 : clamp(((y - ys[k]) / (ys[k + 1] - ys[k]) - 0.34) / 0.66);
      for (let x = 0; x < LW; x++) px(g, x, y, 1, 1, k < 3 && f * 16 > bayer(x, y) + 0.5 ? st.sky[k + 1] : st.sky[k]);
    }
    return c;
  }
  const MT_P = 256, MT_H = 50;
  const PEAKS = (() => { const R = rng(907), a = []; for (let i = 0; i < 7; i++) a.push({ x: Math.round(i * (MT_P / 7) + R() * 22), h: Math.round(20 + R() * 28), s: R() < 0.5 ? 1 : 0.75 }); return a; })();
  function mountainsOf(st) {
    const c = ctx.makeCanvas(MT_P, MT_H), g = c.getContext('2d');
    for (let x = 0; x < MT_P; x++) {
      let best = null, top = 0, bx = 0;
      for (const p of PEAKS) for (const o of [-MT_P, 0, MT_P]) { const h = Math.floor(p.h - Math.abs(x - (p.x + o)) * p.s); if (h > top) { top = h; best = p; bx = p.x + o; } }
      if (top <= 0) continue;
      for (let y = MT_H - top; y < MT_H; y++) {
        const depth = y - (MT_H - top), side = x - bx;                    // dots below this column's top; right of the summit is in shade
        let col = side > 0 ? st.mt[1] : st.mt[0];
        if (side === 0 || (side === 1 && (y & 1))) col = st.mt[1];
        if (side < 0 && side > -3 && ((x + y) & 1) && depth > 2) col = st.mt[1];              // a dithered edge to the shade
        const dy = y - (MT_H - best.h);                                   // dots below the summit
        if (best.h > 33 && dy < 7 + ((x * 7 + 3) % 5 < 2 ? 2 : 0) - (Math.abs(side) % 4 === 3 ? 2 : 0)) col = side > 0 ? st.mt[0] : st.mt[2];   // snow
        px(g, x, y, 1, 1, col);
      }
    }
    return c;
  }
  const FO_P = 160, FO_H = 26;
  function forestOf(st) {
    const c = ctx.makeCanvas(FO_P, FO_H), g = c.getContext('2d');
    const hill = (x) => Math.floor(8 + 3.5 * Math.sin((x / FO_P) * Math.PI * 2) + 2 * Math.sin((x / FO_P) * Math.PI * 6 + 1));
    for (let x = 0; x < FO_P; x++) { const h = hill(x); px(g, x, FO_H - h, 1, h, st.fo[0]); if ((x & 3) === 0) px(g, x, FO_H - h, 1, 1, st.fo[1]); }
    const R = rng(4411);
    for (let x = 3; x < FO_P - 4; x += 6 + Math.floor(R() * 6)) {
      const th = 6 + Math.floor(R() * 6), base = FO_H - hill(x) + 1;
      for (let r = 0; r < th; r++) { const w = 1 + 2 * Math.floor((r + 1) / 2.4); px(g, x - (w >> 1), base - th + r, w, 1, st.fo[0]); if (r % 3 === 1) px(g, x - (w >> 1), base - th + r, 1, 1, st.fo[1]); }
    }
    return c;
  }
  const CLOUDS = [{ x: 40, y: 50, r: [[0, 0, 6], [8, -3, 8], [18, 0, 6], [26, 2, 4]] }, { x: 130, y: 24, r: [[0, 0, 5], [7, -2, 6], [15, 1, 4]] }, { x: 262, y: 62, r: [[0, 0, 5], [8, -3, 7], [17, -1, 6], [26, 1, 4]] }, { x: 370, y: 40, r: [[0, 0, 4], [6, -2, 5], [13, 0, 4]] }];
  function cloudOf(st, cl) {
    const c = ctx.makeCanvas(40, 22), g = c.getContext('2d');
    for (let y = 0; y < 22; y++) for (let x = 0; x < 40; x++) {
      const X = x - 7, Y = y - 12;
      if (Y > 3) continue;
      if (!cl.r.some(([cx, cy, r]) => (X - cx) * (X - cx) + (Y - cy) * (Y - cy) <= r * r)) continue;
      px(g, x, y, 1, 1, Y >= 2 || (Y === 1 && (x & 1)) ? st.cl[1] : st.cl[0]);
    }
    return c;
  }
  const LAYERS = STAGES.map((st) => ({ sky: skyOf(st), mt: mountainsOf(st), fo: forestOf(st), cl: CLOUDS.map((cl) => cloudOf(st, cl)) }));
  const STARS = (() => { const R = rng(88), a = []; for (let i = 0; i < 34; i++) a.push([Math.floor(R() * LW), Math.floor(R() * 46), Math.floor(R() * 4)]); return a; })();

  // =====================================================================================================================
  // Sprites

  /**
   * Claude Code's mascot. Its shape is exactly term.js's (17 x 5 quarter-blocks); here a quarter-block is u dots
   * across and 2u down, so the player (u = 3) is 51 x 30 and the portrait (u = 2) is 34 x 20. The feet step, the arms
   * swing, the eyes look where it is going.
   * pose: { feet: [[dx, lift] x4], arms: [dyLeft, dyRight], look, blink, bob, mono (one flat colour) }
   */
  function drawMascot(g, x, y, pose = {}, u = MU) {
    const q = u, r = 2 * u;
    const body = pose.mono || C.claude, hi = pose.mono || C.salmon, sh = pose.mono || C.brown, eye = pose.mono ? null : C.navy;
    const feet = pose.feet || [[0, 0], [0, 0], [0, 0], [0, 0]], arms = pose.arms || [0, 0], look = pose.look || 0, bob = pose.bob || 0;
    y += bob;
    px(g, x + 3 * q, y, 12 * q, 4 * r, body);                       // head, the bar between the arms, body
    px(g, x + 3 * q, y, 12 * q, 1, hi);
    px(g, x + 3 * q, y + 4 * r - 1, 12 * q, 1, sh);
    [[1, arms[0]], [15, arms[1]]].forEach(([c, dy]) => {            // the two arms
      px(g, x + c * q, y + 2 * r + dy, 2 * q, r, body);
      px(g, x + c * q, y + 2 * r + dy, 2 * q, 1, hi);
      px(g, x + c * q, y + 3 * r + dy - 1, 2 * q, 1, sh);
    });
    if (eye) [5, 12].forEach((c) => { if (pose.blink) px(g, x + c * q + look, y + 2 * r - 2, q, 1, eye); else px(g, x + c * q + look, y + r, q, r, eye); });
    [4, 6, 11, 13].forEach((c, i) => { const [dx, lift] = feet[i]; px(g, x + c * q + dx, y + 4 * r, q, Math.max(1, r - lift - bob), body); });
  }
  // the cycles: [dx, lift] for one pair of feet (the first and third) and the other (second and fourth)
  const JOG = [[3, 0], [0, 0], [-3, 0], [-2, 3], [0, 4], [3, 2]];
  const DASH = [[[4, 0], [-4, 2]], [[1, 0], [-1, 4]], [[-4, 2], [4, 0]], [[-1, 4], [1, 0]]];
  const AIR = { feet: [[2, 3], [-2, 2], [2, 3], [-2, 2]], arms: [-3, -3], look: 1 };
  function runPose(lb) {
    const f = Math.floor(lb * 6);
    if (lb < 4) { const a = JOG[f % 6], b = JOG[(f + 3) % 6]; return { feet: [a, b, a, b], arms: [f % 6 < 3 ? 0 : -1, f % 6 < 3 ? -1 : 0], bob: f % 3 === 1 ? 1 : 0, look: 1 }; }
    const [a, b] = DASH[f % 4];
    return { feet: [a, b, a, b], arms: [f % 2 ? -1 : 1, f % 2 ? 1 : -1], bob: f % 2, look: 1 };
  }
  const ghost = ctx.makeCanvas(MW + 2, MH + 8), gg = ghost.getContext('2d');
  const checker = (() => { const c = ctx.makeCanvas(2, 2), g = c.getContext('2d'); px(g, 0, 0, 1, 1, '#000'); px(g, 1, 1, 1, 1, '#000'); return c; })();
  let checkPat = null;
  /** The player's after-image when it is fast: its shape in one colour, every other dot. */
  function drawGhost(g, x, y, pose, col, phase) {
    gg.setTransform(1, 0, 0, 1, 0, 0); gg.globalCompositeOperation = 'source-over'; gg.clearRect(0, 0, MW + 2, MH + 8);
    drawMascot(gg, 0, 4, { ...pose, mono: col });
    gg.globalCompositeOperation = 'destination-in';
    checkPat ||= gg.createPattern(checker, 'repeat');
    gg.fillStyle = checkPat; gg.translate(phase, 0); gg.fillRect(-2, -2, MW + 6, MH + 12);
    gg.setTransform(1, 0, 0, 1, 0, 0); gg.globalCompositeOperation = 'source-over';
    g.drawImage(ghost, x, y - 4);
  }

  /** A frame of film to pick up, 12 x 10: a gold border, a picture of the shot being rendered; it turns like a coin. */
  function drawCoin(g, x, y, shot, turn) {
    const w = [12, 8, 2, 8][turn & 3], x0 = x + ((12 - w) >> 1);
    px(g, x0 - 1, y - 1, w + 2, 12, C.black);
    px(g, x0, y, w, 10, C.yellow);
    if (w > 2) { px(g, x0, y + 9, w, 1, C.orange); px(g, x0 + w - 1, y + 1, 1, 9, C.orange); px(g, x0, y, 1, 1, C.white); }
    if (w === 12) { if (coinPic[shot]) g.drawImage(coinPic[shot], x0 + 1, y + 1); else px(g, x0 + 1, y + 1, 10, 8, C.navy); px(g, x0 + 1, y + 1, 3, 1, C.white); px(g, x0 + 1, y + 2, 1, 2, C.white); }
    else if (w === 8) { g.imageSmoothingEnabled = false; if (coinPic[shot]) g.drawImage(coinPic[shot], 0, 0, 10, 8, x0 + 1, y + 1, 6, 8); px(g, x0 + 1, y + 1, 1, 3, C.white); }
    else px(g, x0, y, 1, 10, C.white);
  }
  /** The last frame, 22 x 16: gold, with the play triangle. */
  function drawLast(g, x, y, lit) {
    px(g, x - 1, y - 1, 24, 18, C.black);
    px(g, x, y, 22, 16, lit ? C.white : C.yellow);
    px(g, x, y + 15, 22, 1, C.orange); px(g, x + 21, y + 1, 1, 15, C.orange);
    px(g, x + 2, y + 3, 18, 10, C.navy);
    for (let i = 0; i < 5; i++) { px(g, x + 2 + i * 4, y + 1, 2, 1, C.black); px(g, x + 2 + i * 4, y + 14, 2, 1, C.black); }      // sprocket holes
    for (let r = -3; r <= 3; r++) px(g, x + 9, y + 8 + r, 4 - Math.abs(r), 1, C.white);
  }
  const SPARK = [['.#.', '###', '.#.'], ['..#..', '..#..', '##.##', '..#..', '..#..'], ['...#...', '.#...#.', '.......', '#.....#', '.......', '.#...#.', '...#...'], ['#.....#', '.......', '.......', '.......', '.......', '.......', '#.....#']];
  function drawSpark(g, cx, cy, f, col) { const s = SPARK[f]; if (s) bits(g, s, cx - ((s.length - 1) >> 1), cy - ((s.length - 1) >> 1), col); }
  const BUGS = [
    ['...#........#...', '....#......#....', '...##########...', '..############..', '.##..######..##.', '.##############.', '.##############.', '..############..', '.#..#..##..#..#.', '#...#......#...#'],
    ['....#......#....', '....#......#....', '...##########...', '..############..', '.##..######..##.', '.##############.', '.##############.', '..############..', '..#..#.##.#..#..', '..#.#......#.#..'],
  ];
  function drawBug(g, x, y, f) {
    const rows = BUGS[f & 1];
    rows.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === '#') { px(g, x + c - 1, y + r, 3, 1, C.black); px(g, x + c, y + r - 1, 1, 3, C.black); } });
    rows.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === '#') px(g, x + c, y + r, 1, 1, r < 2 || r > 7 ? C.dusk : r === 3 ? C.pink : C.red); });
    px(g, x + 3, y + 4, 2, 1, C.white); px(g, x + 11, y + 4, 2, 1, C.white); px(g, x + 3, y + 4, 1, 1, C.black); px(g, x + 11, y + 4, 1, 1, C.black);
  }
  const PUFF = [['.##.', '####', '.##.'], ['.#..#.', '#....#', '.#..#.'], ['#.....#', '...#...', '.#...#.']];
  function drawPuff(g, x, y, f, col) { const s = PUFF[f]; if (s) bits(g, s, x, y - s.length, col); }

  const shadowText = (g, s, x, y, col) => { text(g, s, x + 1, y + 1, C.black); text(g, s, x, y, col); };
  /** A panel like a game's menus: a black line, a white line, navy inside, the corners nicked. */
  function panel(g, x, y, w, h, thick = 1) {
    px(g, x, y - 1, w, h + 2, C.black); px(g, x - 1, y, w + 2, h, C.black);
    px(g, x + 1, y, w - 2, h, C.white); px(g, x, y + 1, w, h - 2, C.white);
    px(g, x + thick, y + thick, w - 2 * thick, h - 2 * thick, C.navy);
    [[x + thick, y + thick], [x + w - thick - 1, y + thick], [x + thick, y + h - thick - 1], [x + w - thick - 1, y + h - thick - 1]].forEach(([a, b]) => px(g, a, b, 1, 1, C.white));
  }

  // =====================================================================================================================
  // The world

  /** Sky, sun, clouds, mountains, forest, then the ground. `behind`, if given, paints between the two. */
  function drawWorld(g, lb, lt, behind) {
    const tk = Math.floor(lt * 30 + 1e-6), lbq = (tk / 30) / spb;   // the world moves on a 30-a-second tick
    const sc = Math.floor(dist(lbq)), si = stageAt(lb), st = STAGES[si], L = LAYERS[si];
    g.drawImage(L.sky, 0, 0);
    if (si >= 4) STARS.forEach(([x, y, p]) => { if ((si === 5 || p < 2) && ((tk >> 3) + p) % 4 !== 0) px(g, x, y, 1, 1, p === 0 ? C.white : C.lav); });

    // the sun: a ring of dither round it, and at the very end the first dark bands across its foot
    const sy = st.sunY, r = st.sunR;
    for (let y = -r - 3; y <= r + 3; y++) for (let x = -r - 3; x <= r + 3; x++) {
      const d2 = x * x + y * y;
      if (sy + y >= GROUND) continue;
      if (d2 <= r * r + r * 0.6) { if (!(si === 5 && y > 2 && (y % 5 === 4 || (y > 8 && y % 5 === 3)))) px(g, SUN_X + x, sy + y, 1, 1, d2 > (r - 2) * (r - 2) ? st.sun[1] : st.sun[0]); }
      else if (d2 <= (r + 3) * (r + 3) && ((x + y) & 1) === 0) px(g, SUN_X + x, sy + y, 1, 1, st.sun[1]);
    }
    CLOUDS.forEach((cl, i) => { const x = ((cl.x - Math.floor(sc * 0.07 + (tk / 30) * 3)) % 440 + 440) % 440 - 50; g.drawImage(L.cl[i], x, cl.y - 12); });
    { const o = Math.floor(sc * 0.18) % MT_P; for (let x = -o; x < LW; x += MT_P) g.drawImage(L.mt, x, GROUND - MT_H + 1); }
    { const o = Math.floor(sc * 0.45) % FO_P; for (let x = -o; x < LW; x += FO_P) g.drawImage(L.fo, x, GROUND - FO_H + 1); }

    if (behind) behind();

    // the film strip: every cell the player has crossed holds a frame of this film
    px(g, 0, GROUND, LW, STRIP, C.black);
    px(g, 0, GROUND, LW, 1, st.edge);
    px(g, 0, GROUND + STRIP - 1, LW, 1, C.dgrey);
    px(g, 0, GROUND + STRIP, LW, LH - GROUND - STRIP, si >= 4 ? C.black : C.night);
    for (let x = -(sc % 4); x < LW; x += 4) { px(g, x + 1, GROUND + 2, 2, 2, C.lgrey); px(g, x + 1, GROUND + 18, 2, 2, C.lgrey); }
    // the ground under the strip: stones going by at the ground's speed, above and below the dialogue box
    for (let wx = Math.floor(sc / 6) * 6; wx - sc < LW; wx += 6) {
      const h1 = hash(wx * 0.37 + 1), h2 = hash(wx * 0.91 + 7), col = si >= 4 ? C.night : C.navy;
      if (h1 < 0.55) px(g, wx - sc + Math.floor(h2 * 4), GROUND + STRIP + 1 + Math.floor(h1 * 9), h2 < 0.3 ? 3 : 2, 1, col);
      if (h2 < 0.6) px(g, wx - sc + Math.floor(h1 * 4), BOX.y + BOX.h + 2 + Math.floor(h2 * 14), h1 < 0.3 ? 3 : 2, 1, col);
    }
    for (let c = Math.floor(sc / CELL); c * CELL - sc < LW; c++) {
      const x = c * CELL - sc + 1, shot = cellShot[c] ?? -1, age = shot >= 0 ? (lbq - cellWhen[c]) * spb : -1;      // seconds since the player crossed it
      if (age >= 0) {
        g.drawImage(cellPic[shot], x, GROUND + 5);
        if (age < 0.034) px(g, x, GROUND + 5, 22, 12, C.white);                           // just exposed: a flash for one tick, then a bright edge
        else if (age < 0.17) { px(g, x, GROUND + 5, 22, 1, C.white); px(g, x, GROUND + 16, 22, 1, C.white); px(g, x, GROUND + 5, 1, 12, C.white); px(g, x + 21, GROUND + 5, 1, 12, C.white); }
      } else { px(g, x, GROUND + 5, 22, 12, C.night); px(g, x, GROUND + 5, 22, 1, C.navy); px(g, x, GROUND + 5, 1, 12, C.navy); }
    }
    return { sc, tk, lbq, st, si };
  }

  /** Things in the world: pick-ups, the bug, the last frame, sparkles, dust, the player. o.part 'far' or 'near' paints half. */
  function drawThings(g, lb, lt, wv, o = {}) {
    const { sc, tk, lbq } = wv;
    const turn = Math.floor(lt * 8);
    if (o.part !== 'far') picks.forEach((p, i) => {
      if (lb >= p.t) {                                               // taken: a sparkle, left behind
        const f = Math.floor((lb - p.t) * spb * 15);
        drawSpark(g, GRAB - Math.floor(dist(lbq) - dist(p.t)), p.y + 5 - f, f, f % 2 ? C.yellow : C.white);
        return;
      }
      if (o.hide && o.hide(i)) return;
      const x = Math.round(p.wx) - sc - 6;
      if (x > LW + 2) return;
      drawCoin(g, x, p.y + ((turn + i) % 4 === 0 ? -1 : 0), p.shot, turn + i);
    });
    // the bug: it walks toward the player and is jumped on
    if (o.part !== 'near') {
      const x = Math.round(BUG.wx + Math.max(0, BOP - lbq) * BUG.walk) - sc - 8;
      if (lb < BOP) { if (x < LW + 2) drawBug(g, x, GROUND - 10, Math.floor(lt * 6)); }
      else {
        const f = Math.floor((lb - BOP) * spb * 15), bx = Math.round(BUG.wx) - Math.floor(dist(lbq)) - 8;
        if (f < 2) { px(g, bx - 2, GROUND - 4, 20, 4, C.black); px(g, bx - 1, GROUND - 3, 18, 2, C.red); }               // flat
        else if (f < 8) for (let k = 0; k < 7; k++) { const a = Math.PI * (0.1 + 0.8 * (k / 6)), d = (f - 1) * 4; px(g, Math.round(bx + 8 - Math.cos(a) * d), Math.round(GROUND - 4 - Math.sin(a) * d + (f - 1) * (f - 1) * 0.5), 2, 2, k % 2 ? C.red : C.pink); }
      }
    }
    // the last frame, with the play triangle: it bobs and twinkles while it waits to be reached
    if (o.part !== 'near') {
      const x = Math.round(LAST.wx) - sc - 11;
      if (lb < T.done) {
        if (x < LW + 2) {
          const bob = Math.floor(lt * 4) % 2, tw = Math.floor(lt * 8) % 4;
          drawLast(g, x, LAST.y - bob, lb >= T.stuck && Math.floor(lt * 8) % 2 === 0);
          drawSpark(g, x - 4, LAST.y - 3 + bob, tw === 0 ? 0 : tw === 1 ? 1 : -1, C.white);
          drawSpark(g, x + 25, LAST.y + 14, tw === 2 ? 0 : tw === 3 ? 1 : -1, C.yellow);
        }
      } else {
        // taken: it hops up over the player's head and is held there, and rays stand out from it, turning in steps
        const H_ = heldAt(lb, sc), n = ticksSince(lb, T.done), ph = (tk >> 2) & 1, cx = H_.x + 11, cy = H_.y + 8;
        for (let k = 0; k < 12; k++) {
          const a = ((k + ph * 0.5) / 12) * Math.PI * 2, r1 = Math.min(14 + n * 9, (k + ph) % 2 ? 46 : 32);
          for (let r = 16; r < r1; r += 3) px(g, Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r * 0.85) - 1, 2, 2, ((r - 16) / 3 + ph) % 2 ? C.yellow : C.white);
        }
        drawLast(g, H_.x, H_.y, n < 6 && n % 2 === 0);
        const tw = Math.floor(lt * 8) % 4;
        drawSpark(g, H_.x - 5, H_.y - 2, tw === 0 ? 0 : tw === 1 ? 1 : -1, C.white);
        drawSpark(g, H_.x + 27, H_.y + 13, tw === 2 ? 0 : tw === 3 ? 1 : -1, C.yellow);
      }
    }
    if (o.noPlayer || o.part === 'far') return;
    const up = jumpY(lbq), tick = 1 / (30 * spb);
    // it gathers itself for two ticks before a jump, and sinks for two on landing
    const before = [J1[0], J2[0]].some((t) => lbq >= t - 2 * tick - 1e-6 && lbq < t - 1e-6);
    const landed = [J1[0] + J1[1], J3[0] + J3[1]].find((t) => lbq >= t - 1e-6 && lbq < t + 2 * tick - 1e-6);
    const won = lb >= T.done, wonHop = won ? [3, 6, 7, 6, 3, 1][ticksSince(lb, T.done)] ?? 0 : 0;      // a little jump for joy, then it stands
    const pose = lb < T.go ? { blink: Math.floor(lt * 4) % 8 === 5, bob: Math.floor(lt * 4) % 2 }
      : won ? { arms: [-6, -6], blink: true, bob: wonHop ? 0 : Math.floor(lt * 4) % 2 }                  // both arms up, eyes shut tight
      : up > 0 ? AIR : before || landed !== undefined ? { arms: [1, 1], bob: 2, look: 1 } : runPose(lb);
    const y = GROUND - MH - up - wonHop;
    [J1[0] + J1[1], J3[0] + J3[1]].forEach((t) => {                 // dust thrown both ways on landing
      const f = Math.floor((lb - t) * spb * 12);
      if (lb >= t && f < 3) { drawPuff(g, MX - 2 - f * 3, GROUND, f, wv.si >= 4 ? C.mauve : C.white); drawPuff(g, MX + MW - 4 + f * 3, GROUND, f, wv.si >= 4 ? C.mauve : C.white); }
    });
    // dust at each footfall, left behind on the ground
    if (lb >= T.go) for (let k = 0; k < 3; k++) {
      const step = lb < 4 ? 0.5 : 0.25, b = Math.floor(lb / step + 1e-6) * step - k * step;
      if (b < T.go || b >= T.done || jumpY(b) > 0) continue;
      drawPuff(g, MX + 8 - Math.floor(dist(lbq) - dist(b)), GROUND, Math.floor((lb - b) * spb * 12), wv.si >= 4 ? C.mauve : C.white);
    }
    if (won) { /* standing: no after-image */ }
    else if (lb >= 6) { const ph = tk & 1; drawGhost(g, MX - 18, y, pose, wv.si >= 5 ? C.plum : C.fire, ph); drawGhost(g, MX - 9, y, pose, C.salmon, 1 - ph); }
    else if (lb >= 4) drawGhost(g, MX - 8, y, pose, C.salmon, tk & 1);
    drawMascot(g, MX, y, o.flash ? { ...pose, mono: C.white } : pose);
  }

  /** Lines of speed across the sky once the run is fast. */
  function drawSpeed(g, lb, wv) {
    if (lb < 4 || lb >= T.done) return;
    const n = lb < 6 ? 5 : lb < 7 ? 9 : 14, tk = wv.tk;
    for (let i = 0; i < n; i++) {
      const y = 30 + Math.floor(hash(i * 3.7 + 1) * 64), len = 10 + Math.floor(hash(i * 9.1) * 22), v = 9 + Math.floor(hash(i * 5.3) * 8);
      const x = LW - ((tk * v + Math.floor(hash(i * 2.2) * 400)) % (LW + 80));
      px(g, x, y, len, 1, C.white);
      if (i % 2) px(g, x + len + 2, y, 3, 1, wv.si >= 4 ? C.pink : C.white);
    }
  }

  /** The counter, top right: a label, the number, its target, a bar of 21 lamps. o.target false leaves the target out. */
  function drawHud(g, lb, lt, o = {}) {
    const { x, y, w, h } = HUD;
    const f = frameAt(lb), stuck = lb >= T.stuck && lb < T.done, done = lb >= T.done;
    const s = String(f).padStart(TOT.length, '0');
    let hot = false;
    for (const p of picks) { const a = (lb - p.t) * spb; if (a >= 0 && a < 0.09) hot = true; }
    const blink = Math.floor(lt * 8) % 2 === 0;
    const fresh = done && ticksSince(lb, T.done) < 8;                // the first quarter second of DONE! blinks, then it is still to be read
    panel(g, x, y, w, h);
    text(g, done ? 'DONE!' : stuck ? '1 TO GO' : 'FRAME', x + 5, y + 4, done ? C.green : stuck ? C.yellow : C.lgrey);
    bigNum(g, s, x + 5, y + 13 - (hot ? 1 : 0), done ? (fresh && blink ? C.green : C.white) : stuck ? (blink ? C.white : C.yellow) : hot ? C.yellow : C.white);
    if (o.target !== false) text(g, '/' + TOT, x + 5 + TOT.length * 8 + 1, y + 17, o.landed !== undefined && o.landed < 4 ? (o.landed % 2 ? C.yellow : C.white) : done ? C.green : C.fire);
    const n = 21, lit = done ? n : Math.min(n - 1, Math.floor((n * f) / FRAMES));
    px(g, x + 4, y + 27, n * 3 + 2, 6, C.black);
    for (let i = 0; i < n; i++) {
      const c = i < lit ? (done ? C.green : i === lit - 1 ? C.white : C.yellow) : stuck && i === lit && blink ? C.fire : C.night;
      px(g, x + 5 + i * 3, y + 28, 2, 4, c);
    }
  }
  const TARGET = { x: HUD.x + 5 + TOT.length * 8 + 1, y: HUD.y + 17, w: (TOT.length + 1) * 6 - 1, h: 7 };

  /** The style tag, top left, with a shine that crosses its name once a bar. */
  function drawTag(g, env) {
    if (!env.tag) return;
    const num = `${env.tag.num}/${env.tag.of}`, x = COL0, y = 18, name = env.tag.name;
    px(g, x - 3, y - 4, num.length * 6 + 5, 15, C.black);
    px(g, x - 2, y - 3, num.length * 6 + 3, 13, C.yellow);
    px(g, x - 2, y + 9, num.length * 6 + 3, 1, C.orange);
    text(g, num, x, y, C.black);
    const nx = x + num.length * 6 + 7;
    px(g, nx - 4, y - 4, name.length * 6 + 7, 15, C.black);
    px(g, nx - 3, y - 3, name.length * 6 + 5, 13, C.navy);
    text(g, name, nx, y, C.white);
    const p = ((env.lb % 4) + 4) % 4, sx = nx - 8 + Math.floor(p * 24) * 3;      // the shine: a slanted band, three dots a step
    if (p < 1.2) { let i = 0; g.fillStyle = C.yellow; for (const ch of name) { const rows = SMALL[ch]; if (rows) rows.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === '#') { const X = nx + i * 6 + c, d = X + (6 - r) - sx; if (d >= 0 && d < 4) g.fillRect(X, y + r, 1, 1); } }); i++; } }
  }

  // =====================================================================================================================
  // The dialogue box and the two rows

  function drawBox(g, env, x1 = BOX.x + BOX.w + 1) {
    const { x, y, w, h } = BOX;
    g.save(); g.beginPath(); g.rect(x - 1, y - 1, x1 - x + 1, h + 2); g.clip();
    panel(g, x, y, w, h, 2);
    px(g, x + 3, y + 3, w - 6, 1, C.dblue); px(g, x + 3, y + 3, 1, h - 6, C.dblue);
    for (let yy = y + h - 9; yy < y + h - 2; yy++) for (let xx = x + 2; xx < x + w - 2; xx++) if ((yy - (y + h - 9)) * 2.4 > bayer(xx, yy) + 1) px(g, xx, yy, 1, 1, C.night);
    // who is speaking: the mascot's portrait, breathing and blinking (left out if a line is long enough to reach it)
    const m = env.term, long = Math.max(m.last ? m.last.text.length + 2 : 0, m.rowC.text.length + 3) > 35;
    if (!long) {
      const fx = x + w - 47, fy = y + 5, t4 = Math.floor(env.lt * 4);
      px(g, fx, fy, 42, 30, C.black); px(g, fx + 1, fy + 1, 40, 28, C.dblue);
      for (let yy = 0; yy < 28; yy++) for (let xx = 0; xx < 40; xx++) if (yy * 0.6 > bayer(xx, yy) + 2) px(g, fx + 1 + xx, fy + 1 + yy, 1, 1, C.blue);
      const excited = env.lb >= T.stuck && env.lb < T.done, won = env.lb >= T.done;
      drawMascot(g, fx + 4, fy + 6, won ? { bob: ((t4 % 2) + 2) % 2, blink: true, arms: [-4, -4] }
        : { bob: excited ? (Math.floor(env.lt * 8) % 2) * -2 : ((t4 % 2) + 2) % 2, blink: !excited && ((t4 % 9) + 9) % 9 === 6, look: env.lb >= T.go ? 1 : 0, arms: excited ? [-2, -2] : [0, 0] }, 2);
    }
    g.restore();
  }
  const cellX = (i) => COL0 + i * 6;
  const STAR = [['..#..', '..#..', '##.##', '..#..', '..#..'], ['#...#', '.#.#.', '.....', '.#.#.', '#...#'], ['..#..', '.###.', '#####', '.###.', '..#..'], ['.....', '..#..', '.#.#.', '..#..', '.....']];
  const DOT = ['.###.', '#####', '#####', '#####', '.###.'];
  function drawRows(g, env, part) {
    const m = env.term, lb = env.lb;
    if (part !== 'C' && m.last) {
      const l = m.last, y = ROW_B, n = l.kind === 'say' ? l.chars : l.text.length;
      if (l.kind === 'tool') {
        const k = Math.max(0, l.text.indexOf('('));
        bits(g, DOT, cellX(0), y + 1, l.age < 0.35 ? C.lav : C.green);
        text(g, l.text.slice(0, k), cellX(2), y, C.white);
        text(g, l.text.slice(k), cellX(2 + k), y, C.lgrey);
      } else if (l.kind === 'spin' && lb >= T.done) {               // the work is done: the star stops and is a green dot, as a finished tool's is
        bits(g, DOT, cellX(0), y + 1, C.green);
        text(g, l.text, cellX(2), y, C.lgrey);
      } else if (l.kind === 'spin') {
        bits(g, STAR[Math.floor(env.ab * 4) % 4], cellX(0), y + 1, C.orange);
        text(g, l.text, cellX(2), y, C.orange);
      } else if (l.kind === 'result') {
        text(g, '⎿', cellX(2), y, C.lav); text(g, l.text, cellX(5), y, C.lgrey);
      } else {
        bits(g, DOT, cellX(0), y + 1, C.white);
        text(g, l.text.slice(0, n), cellX(2), y, C.white);
      }
    }
    if (part === 'B') return;
    const c = m.rowC, y = ROW_C;
    let n = c.n;
    // the old prompt is rubbed out from its end before the next one is typed
    if (c.mode === 'cmd' && m.typing) { const clearAt = m.typing.start - (ctx.script.T.clear ?? 1); n = Math.ceil(c.n * (1 - seg(lb, clearAt - 0.5, clearAt - 0.05))); }
    // the prompt sign is a menu's pointer; it nudges on the off-beat while it waits for a key
    const nudge = c.mode !== 'cmd' && Math.floor(env.ab * 2) % 2 === 1 ? 1 : 0;
    g.fillStyle = C.yellow; glyph(g, SMALL, '▶', cellX(0) + nudge, y);
    let i = 0;
    for (const ch of c.text.slice(0, n)) {
      const fresh = c.mode === 'typing' && c.keyAge(i) < 0.12;
      g.fillStyle = fresh ? C.yellow : c.mode === 'cmd' ? C.lgrey : C.white;
      glyph(g, SMALL, ch, cellX(2 + i), y - (fresh ? 1 : 0));
      i++;
    }
    if (c.cursor && m.blink) px(g, cellX(2 + n), y - 1, 5, 10, C.claude);
  }

  // rows for another shot's hand-over: on a clear 320 x 180 sheet, then onto its canvas at six times
  const sheet = ctx.makeCanvas(LW, LH), sh = sheet.getContext('2d');
  function dock(g, env, part) {
    sh.setTransform(1, 0, 0, 1, 0, 0); sh.clearRect(0, 0, LW, LH);
    drawRows(sh, env, part);
    g.save(); g.imageSmoothingEnabled = false; g.drawImage(sheet, 0, 0, W, H); g.restore();
  }

  // =====================================================================================================================
  // The way in: the picture before this one becomes pixel art (the three steps are in the note at the top)

  const full = ctx.makeCanvas(W, H), fg = full.getContext('2d');
  const small = {};                                                  // one canvas for each block size
  const smallOf = (b) => (small[b] ||= (() => { const c = ctx.makeCanvas(Math.round(W / b), Math.round(H / b)); return { c, g: c.getContext('2d', { willReadFrequently: b === 6 || b === 3 }) }; })());
  const fallen = ctx.makeCanvas(LW, LH), fag = fallen.getContext('2d');          // the old stickers that drop, where they are now
  const low = ctx.makeCanvas(LW, LH), lwg = low.getContext('2d');                // what stood where the dialogue box will be
  const oldWhole = ctx.makeCanvas(LW, LH), owg = oldWhole.getContext('2d');      // all that stood on the paper, where it stood: flying pieces are cut from this
  const half = ctx.makeCanvas(LW / 2, LH / 2), hg = half.getContext('2d');       // this shot's picture in blocks of 12
  const oldp = ctx.makeCanvas(LW, LH), opg = oldp.getContext('2d');             // the old paper with the old things on it
  const rev = ctx.makeCanvas(LW, LH), rvg = rev.getContext('2d');                // where the paper still shows (the world comes in from the top)
  const paper = ctx.makeCanvas(LW, LH), ppg = paper.getContext('2d', { willReadFrequently: true });
  const N = LW * LH, LOW_Y = BOX.y - 4;
  const isThing = new Uint8Array(N), mask = new Uint8Array(N), grown = new Uint8Array(N), label = new Int32Array(N), stack = new Int32Array(N);
  const imgWhole = owg.createImageData(LW, LH), imgLow = lwg.createImageData(LW, LH), imgFall = fag.createImageData(LW, LH), imgRev = rvg.createImageData(LW, LH);
  const toDots = (r) => ({ x: Math.round(r.x / SC), y: Math.round(r.y / SC), w: Math.max(1, Math.round(r.w / SC)), h: Math.max(1, Math.round(r.h / SC)) });
  const CUR = { x: cellX(2 + (ctx.shot.prompt || '').length), y: ROW_C - 1 };     // where the cursor stood when Enter was pressed
  const SWEEP = [T.clear, T.clear + 0.375];                                       // the dialogue box takes the old label's place
  const sweepX = (lb) => { const p = seg(lb, SWEEP[0], SWEEP[1]); return p <= 0 ? -1 : Math.min(BOX.x + Math.floor(p * 47) * 6, BOX.x + BOX.w + 1); };
  const beamTick = (lb) => Math.floor((lb - T.go) * spb * 30 - 1e-6);             // ticks before the run: -1 is the last
  // the paper turns into the world from the top: a band FD dots deep, dithered, going down the frame over FRONT
  const FRONT = [T.swap, 1], FD = 16;
  const frontAt = (y) => FRONT[0] + ((FRONT[1] - FRONT[0]) * (y + FD / 2)) / (LH + FD);   // when the band's middle reaches row y

  /** Paint the old picture into `full`, without its rows (they are drawn whole, on top). Returns what the old shot hands over. */
  function paintOld(env) {
    fg.setTransform(1, 0, 0, 1, 0, 0); fg.globalAlpha = 1; fg.globalCompositeOperation = 'source-over';
    fg.drawImage(env.other, 0, 0);
    return env.otherImpl && env.otherImpl.handoff ? env.otherImpl.handoff(env.otherEnv) : null;
  }
  /**
   * The old prompt row, in the old skin and at full size, so no letter is ever cut up: right of the dialogue box's
   * edge while the box takes its place a column at a time. The cursor stays lit on it until it flares into the beam.
   */
  function oldRow(g, env, h, lb) {
    const x1 = sweepX(lb), od = env.otherImpl && env.otherImpl.dock;
    if (x1 >= BOX.x + BOX.w + 1) return;
    const xc = x1 < 0 ? 0 : x1 * SC;
    g.save(); g.beginPath(); g.rect(xc, DOCK.rowC - 120, W - xc, 220); g.clip();
    if (od) { g.save(); od(g, env.otherEnv, 'C'); g.restore(); }
    if (beamTick(lb) < -11) {
      const c = cursorRect(DOCK.x + (2 + (ctx.shot.prompt || '').length) * DOCK.adv, DOCK.rowC, DOCK.size);
      g.fillStyle = (h && h.accent) || C.fire; g.beginPath(); g.roundRect(c.x, c.y, c.w, c.h, 5); g.fill();
    }
    g.restore();
  }
  /** The old paper cut to the palette (one flat colour, dithered), for the colour given. */
  let paperKey = '';
  function paperOf(rgb) {
    const k = rgb.join(',');
    if (k !== paperKey) {
      ppg.fillStyle = `rgb(${k})`; ppg.fillRect(0, 0, LW, LH);
      ppg.putImageData(cutColours(ppg.getImageData(0, 0, LW, LH)), 0, 0);
      paperKey = k;
    }
    return paper;
  }
  /** Fill `rev`: opaque where the old paper still shows at lb, clear where the world has come in. */
  function paperLeft(lb) {
    const F = seg(lb, FRONT[0], FRONT[1]) * (LH + FD), a = imgRev.data;
    for (let y = 0, i = 3; y < LH; y++) {
      const f = clamp((F - y) / FD) * 16;
      for (let x = 0; x < LW; x++, i += 4) a[i] = f > bayer(x, y) + 0.5 ? 0 : 255;
    }
    rvg.putImageData(imgRev, 0, 0);
  }
  /**
   * The old picture in blocks of b screen pixels. Half-way between averaging each block (soft, reads as blur) and
   * taking one dot from it (harsh, loses thin lines): average to half-blocks, then take one dot in four.
   */
  function blocks(b) {
    const s = smallOf(b), m = smallOf(b / 2);
    m.g.imageSmoothingEnabled = true; m.g.imageSmoothingQuality = 'high';
    m.g.drawImage(full, 0, 0, m.c.width, m.c.height);
    s.g.imageSmoothingEnabled = false;
    s.g.drawImage(m.c, 0, 0, s.c.width, s.c.height);
    return s;
  }

  // The pick-ups in sight at the start are old frame tiles. The wall empties from its right-hand column: each tile
  // leaves as a gold frame; nine of them, spread across the wall, arc to the path and are the pick-ups; the rest run
  // off ahead.
  const inSight = picks.map((p, i) => ({ p, i })).filter(({ p }) => Math.round(p.wx) - 6 < LW);
  const FLIGHT = 0.3;

  /**
   * Part the old picture (at 320 x 180, cut to the palette) into what this shot does with it. Fills `oldWhole`, `low`
   * and `fallen`, and returns { tiles, number, leaves(i), pickOf(i), arrives(pick index) }.
   */
  function partOld(lb, h) {
    const d = cutPaper(h);
    const number = h && h.number ? toDots(h.number) : null;
    const tiles = h && h.tiles ? h.tiles.filter((t) => t.kind === 'wall').map(toDots).sort((a, b) => a.x - b.x || a.y - b.y) : [];
    const n = tiles.length, x0 = n ? tiles[0].x : 0, x1 = n ? tiles[n - 1].x : 1;
    const leaves = (i) => T.clear + (1 - (tiles[i].x - x0) / Math.max(1, x1 - x0)) * 0.22 + (i % 5) * 0.006;
    const chosen = new Map();                                        // tile index -> which pick-up in sight it becomes
    if (n) inSight.forEach((q, j) => chosen.set(clamp(Math.round((j + 0.5) * (n / inSight.length) - 0.5), 0, n - 1), j));
    const tileOfPick = new Map([...chosen].map(([ti, j]) => [inSight[j].i, ti]));
    const arrives = (i) => (tileOfPick.has(i) ? leaves(tileOfPick.get(i)) + FLIGHT : T.clear);

    // everything that stood on the paper, where it stood
    const w = imgWhole.data, l = imgLow.data;
    for (let p = 0, i = 0; p < N; p++, i += 4) {
      const t = isThing[p], lowRow = p >= LOW_Y * LW;
      w[i] = d[i]; w[i + 1] = d[i + 1]; w[i + 2] = d[i + 2]; w[i + 3] = t ? 255 : 0;
      // what stood below the film strip stays on its paper until the dialogue box's edge or the world takes it
      l[i] = d[i]; l[i + 1] = d[i + 1]; l[i + 2] = d[i + 2]; l[i + 3] = t && lowRow ? 255 : 0;
      mask[p] = t && !lowRow ? 1 : 0;
    }
    if (number) for (let y = Math.max(LOW_Y, number.y - 3); y < Math.min(LH, number.y + number.h + 6); y++) for (let x = Math.max(0, number.x - 3); x < Math.min(LW, number.x + number.w + 3); x++) l[(y * LW + x) * 4 + 3] = 0;
    owg.putImageData(imgWhole, 0, 0); lwg.putImageData(imgLow, 0, 0);

    // the stickers that will drop: everything above the box, but for what has another part to play
    const cut = (x, y, ww, hh) => { for (let yy = Math.max(0, y); yy < Math.min(LOW_Y, y + hh); yy++) mask.fill(0, yy * LW + Math.max(0, x), yy * LW + Math.min(LW, x + ww)); };
    if (number) cut(number.x - 3, number.y - 3, number.w + 6, number.h + 9);       // the big number: it is carried to the counter
    cut(COL0 - 5, 12, 104, 18);                                                    // the old tag: this shot's tag comes in over it
    tiles.forEach((t) => cut(t.x, t.y, t.w, t.h));                                 // the wall's tiles: each stays put until it leaves the wall

    // Which pixels belong together: grow the mask sideways so letters join into words, and label what touches.
    grown.fill(0);
    for (let y = 0; y < LOW_Y; y++) for (let x = 0; x < LW; x++) {
      if (!mask[y * LW + x]) continue;
      for (let yy = Math.max(0, y - 2); yy <= Math.min(LOW_Y - 1, y + 2); yy++) grown.fill(1, yy * LW + Math.max(0, x - 3), yy * LW + Math.min(LW, x + 4));   // lines join into paragraphs
    }
    label.fill(0);
    const minX = [0], maxX = [0], minY = [0];
    for (let p0 = 0, c = 0; p0 < LOW_Y * LW; p0++) {
      if (!grown[p0] || label[p0]) continue;
      c++; let sp = 0, lo_ = LW, hi_ = 0;
      minY[c] = Math.floor(p0 / LW);                                 // found in reading order, so this is its top row
      stack[sp++] = p0; label[p0] = c;
      while (sp) {
        const q = stack[--sp], x = q % LW;
        if (x < lo_) lo_ = x; if (x > hi_) hi_ = x;
        if (x > 0 && grown[q - 1] && !label[q - 1]) { label[q - 1] = c; stack[sp++] = q - 1; }
        if (x < LW - 1 && grown[q + 1] && !label[q + 1]) { label[q + 1] = c; stack[sp++] = q + 1; }
        if (q >= LW && grown[q - LW] && !label[q - LW]) { label[q - LW] = c; stack[sp++] = q - LW; }
        if (q + LW < LOW_Y * LW && grown[q + LW] && !label[q + LW]) { label[q + LW] = c; stack[sp++] = q + LW; }
      }
      minX[c] = lo_; maxX[c] = hi_;
    }
    // Each sticker comes unstuck, whole, just before the world reaches its top (a hop of one dot), then falls faster
    // and faster and is hidden by the film strip.
    const f = imgFall.data; f.fill(0);
    for (let y = 0, p = 0; y < LOW_Y; y++) for (let x = 0; x < LW; x++, p++) {
      if (!mask[p]) continue;
      const c = label[p];
      const k = ticksSince(lb, frontAt(minY[c]) - 0.06), dy = k < 0 ? 0 : k === 0 ? -1 : 4 * (k - 1) * k;
      const ny = y + dy;
      if (ny < 0 || ny >= LOW_Y) continue;
      const i = p * 4, o = (ny * LW + x) * 4;
      f[o] = d[i]; f[o + 1] = d[i + 1]; f[o + 2] = d[i + 2]; f[o + 3] = 255;
    }
    // the wall's tiles that have not left yet, where they stand
    tiles.forEach((t, j) => {
      if (lb >= leaves(j)) return;
      for (let y = Math.max(0, t.y); y < Math.min(LOW_Y, t.y + t.h); y++) for (let x = Math.max(0, t.x); x < Math.min(LW, t.x + t.w); x++) {
        const p = y * LW + x, i = p * 4;
        if (isThing[p]) { f[i] = d[i]; f[i + 1] = d[i + 1]; f[i + 2] = d[i + 2]; f[i + 3] = 255; }
      }
    });
    fag.putImageData(imgFall, 0, 0);
    return { tiles, number, leaves, chosen, arrives, bg: oldBg };
  }
  /** The old picture at 320 x 180 with its colours cut to the palette; marks in `isThing` what is not its paper. */
  let oldBg = [233, 238, 242];
  function cutPaper(h) {
    const img = blocks(6).g.getImageData(0, 0, LW, LH), d = img.data;
    const bg = h && h.bg ? [parseInt(h.bg.slice(1, 3), 16), parseInt(h.bg.slice(3, 5), 16), parseInt(h.bg.slice(5, 7), 16)] : [d[0], d[1], d[2]];
    oldBg = bg;
    for (let i = 0, p = 0; p < N; i += 4, p++) isThing[p] = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) < 26 ? 0 : 1;
    cutColours(img);
    return d;
  }

  /** The wall's tiles on their way: nine arc to the path as the pick-ups, the others shoot off ahead as small gold frames. */
  function flyTiles(g, lb, old) {
    old.tiles.forEach((t, i) => {
      const k = ticksSince(lb, old.leaves(i));
      if (k < 0) return;
      if (old.chosen.has(i)) {
        const { p } = inSight[old.chosen.get(i)], steps = Math.max(1, ticksSince(old.leaves(i) + FLIGHT, old.leaves(i)));
        if (k >= steps) return;                                      // it has arrived: it is a pick-up now
        const u = (k + 1) / (steps + 1), tx = Math.round(p.wx) - 6, ty = p.y;
        drawCoin(g, Math.round(t.x - 2 + (tx - t.x + 2) * u), Math.round(t.y - 2 + (ty - t.y + 2) * u - Math.sin(u * Math.PI) * 14), p.shot, k);
      } else {
        const x = t.x + 2 * k * k + 5 * k, y = t.y - Math.min(2, k);
        if (x > LW + 2) return;
        px(g, x - 1, y - 1, t.w + 2, t.h + 2, C.black); px(g, x, y, t.w, t.h, C.yellow); px(g, x + 1, y + 1, t.w - 2, t.h - 2, k % 2 ? C.navy : C.dblue); px(g, x, y, 1, 1, C.white);
      }
    });
  }
  /**
   * The old picture's big number: it stands where it stood until the blocks are back to 6, then is carried to the
   * counter in four hops, smaller each time, and lands as the counter's target. Only ever one of it.
   */
  const HOPS = [[0, 1], [0.14, 0.86], [0.4, 0.66], [0.7, 0.46], [1, 0.27]];      // [how far along, how big]; the last is in the target's own place
  function flyNumber(g, lb, r) {
    const n = ticksSince(lb, T.clear);
    if (n >= HOPS.length - 1) return;
    const [u, sc] = HOPS[clamp(n + 1, 0, HOPS.length - 1)], w = Math.round(r.w * sc), h = Math.round((r.h + 2) * sc);
    const cx = r.x + r.w / 2 + (TARGET.x + TARGET.w / 2 - (r.x + r.w / 2)) * u, cy = r.y + r.h / 2 + (TARGET.y + 3 - (r.y + r.h / 2)) * u;
    g.save(); g.imageSmoothingEnabled = false;
    g.drawImage(oldWhole, r.x, r.y, r.w, r.h + 2, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
    g.restore();
  }
  // the cursor leaves its row as a beam and comes down as the player
  function beam(g, lb) {
    const k = beamTick(lb);
    const mx = MX + (MW >> 1);
    const col = (x, y0, y1, w) => { px(g, x - (w >> 1) - 1, y0, w + 2, y1 - y0, C.fire); px(g, x - (w >> 1), y0, w, y1 - y0, C.yellow); px(g, x - 1, y0, 2, y1 - y0, C.white); };
    if (k < -11) return false;
    if (k < -9) px(g, CUR.x - 1, CUR.y - 1, 7, 12, C.white);                                // it flares
    else if (k === -9) col(CUR.x + 2, CUR.y - 50, CUR.y + 10, 4);                           // goes up
    else if (k === -8) col(CUR.x + 2, 0, CUR.y - 36, 4);
    else if (k === -7) { col(CUR.x + 2, 0, 26, 2); col(mx, 0, 20, 2); }                     // across the top
    else if (k === -6) col(mx, 0, 58, 4);                                                   // comes down
    else if (k === -5) col(mx, 0, GROUND, 4);
    else if (k === -4) { col(mx, 36, GROUND, 12); px(g, mx - 13, GROUND - 3, 26, 3, C.white); }
    else if (k === -3) { px(g, MX + 4, GROUND - 12, MW - 8, 12, C.white); px(g, MX - 3, GROUND - 5, MW + 6, 5, C.yellow); }     // a low wide shape
    else if (k === -2) drawMascot(g, MX, GROUND - MH, { mono: C.white });
    else drawMascot(g, MX, GROUND - MH, {});
    return true;
  }

  // =====================================================================================================================

  const pat = (() => {                                               // scan lines: the foot of every dot row is dimmer
    const c = ctx.makeCanvas(1, SC), g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.11)'; g.fillRect(0, SC - 2, 1, 1);
    g.fillStyle = 'rgba(0,0,0,0.24)'; g.fillRect(0, SC - 1, 1, 1);
    return c;
  })();
  let scan = null, vign = null;
  /** The tube: a soft glow of the same picture screened over the hard dots, scan lines, darker corners. */
  function crt(g, src = lo) {
    g.save();
    g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.2; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.filter = 'blur(5px)';
    g.drawImage(src, 0, 0, W, H);
    g.filter = 'none';
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    scan ||= g.createPattern(pat, 'repeat');
    g.fillStyle = scan; g.fillRect(0, 0, W, H);
    if (!vign) { vign = g.createRadialGradient(W / 2, H / 2, H * 0.62, W / 2, H / 2, H * 1.1); vign.addColorStop(0, 'rgba(0,0,0,0)'); vign.addColorStop(1, 'rgba(0,0,0,0.34)'); }
    g.fillStyle = vign; g.fillRect(0, 0, W, H);
    g.restore();
  }

  function render(g, env) {
    const lb = env.lb, lt = env.lt;
    const handing = !!(env.other && env.role === 'in' && lb < 2);
    lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over'; lg.imageSmoothingEnabled = false;

    // ---- mosaic out: still the old picture, cut to the palette, in blocks of 3 and then 6 ----
    if (handing && lb < T.swap) {
      const h = paintOld(env), s = blocks(lb < T.step ? 3 : 6);
      s.g.putImageData(cutColours(s.g.getImageData(0, 0, s.c.width, s.c.height)), 0, 0);
      g.imageSmoothingEnabled = false;
      g.drawImage(s.c, 0, 0, W, H);
      if (lb >= T.step) crt(g, s.c);
      oldRow(g, env, h, lb);
      return;
    }
    // ---- from here it is this shot's world; in the hand-over the old picture's things are still on it ----
    const h = handing ? paintOld(env) : null, old = handing ? partOld(lb, h) : null;

    const wv = drawWorld(lg, lb, lt, old ? () => lg.drawImage(fallen, 0, 0) : null);      // the old stickers drop behind the film strip
    // the player blinks white on the two hits: landing on the bug, and taking the last frame
    const flash = (lb >= T.done && (lb - T.done) * spb < 0.07) || (lb >= BOP && (lb - BOP) * spb < 0.07);

    drawSpeed(lg, lb, wv);
    drawThings(lg, lb, lt, wv, { part: 'far' });

    // ---- pick-ups and the player ----
    drawThings(lg, lb, lt, wv, { part: 'near', hide: (i) => old && lb < old.arrives(i), noPlayer: lb >= 0 && lb < T.go, flash });
    if (old) flyTiles(lg, lb, old);

    // ---- counter and tag ----
    const landed = old && old.number ? flyNumberTicks(lb) : undefined;
    drawHud(lg, lb, lt, { target: landed === undefined || landed >= 0, landed });
    if (old && old.number && landed < 0) flyNumber(lg, lb, old.number);
    drawTag(lg, env);

    // ---- the box and the rows: in the hand-over they take the old label's place a column at a time ----
    if (handing) boxSweep(lg, env, lb);
    else {
      drawBox(lg, env);
      if (!env.noDock) drawRows(lg, env);
    }
    if (lb >= 0 && lb < T.go) beam(lg, lb);                          // over the box: the beam starts on the prompt row

    // ---- where the world has not come in yet, the old paper, with the same old things on it ----
    if (old && lb < FRONT[1]) {
      opg.setTransform(1, 0, 0, 1, 0, 0); opg.globalAlpha = 1; opg.globalCompositeOperation = 'source-over'; opg.imageSmoothingEnabled = false;
      opg.drawImage(paperOf(old.bg), 0, 0);
      opg.save(); opg.beginPath(); opg.rect(COL0 - 5, 12, 104, 18); opg.clip(); opg.drawImage(oldWhole, 0, 0); opg.restore();   // the old tag
      opg.drawImage(fallen, 0, 0);
      opg.drawImage(low, 0, 0);                                      // what stood below the strip goes with its paper
      flyTiles(opg, lb, old);
      if (old.number && landed < 0) flyNumber(opg, lb, old.number);
      boxSweep(opg, env, lb);
      if (lb >= 0 && lb < T.go) beam(opg, lb);
      paperLeft(lb);
      opg.globalCompositeOperation = 'destination-in'; opg.drawImage(rev, 0, 0); opg.globalCompositeOperation = 'source-over';
      lg.drawImage(oldp, 0, 0);
    }

    g.imageSmoothingEnabled = false;
    if (handing && lb < T.clear) {                                   // this picture in blocks of 12, one dot in four
      hg.imageSmoothingEnabled = false;
      hg.drawImage(lo, 0, 0, LW / 2, LH / 2);
      g.drawImage(half, 0, 0, W, H);
      crt(g, half);
    } else {
      g.drawImage(lo, 0, 0, W, H);
      crt(g);
    }
    if (handing) oldRow(g, env, h, lb);
  }
  /** The dialogue box and its rows, as far as its edge has come across the old prompt label (a column at a time). */
  function boxSweep(g, env, lb) {
    const x1 = sweepX(lb);
    if (x1 < 0) return;
    drawBox(g, env, x1);
    g.save(); g.beginPath(); g.rect(0, BOX.y, x1 - 1, BOX.h); g.clip();
    drawRows(g, env);
    g.restore();
    if (x1 < BOX.x + BOX.w + 1) px(g, x1 - 1, BOX.y - 1, 1, BOX.h + 2, C.white);            // the edge that eats the old label
  }
  const flyNumberTicks = (lb) => ticksSince(lb, T.clear) - (HOPS.length - 1);     // ticks since the big number landed in the counter

  function handoff(env) {
    const lbq = (Math.floor(env.lt * 30 + 1e-6) / 30) / spb, f = frameAt(env.lb);
    return {
      sprite: { x: MX * SC, y: (GROUND - MH - jumpY(lbq)) * SC, w: MW * SC, h: MH * SC },
      counter: { x: HUD.x * SC, y: HUD.y * SC, w: HUD.w * SC, h: HUD.h * SC, text: `${String(f).padStart(TOT.length, '0')}/${TOT}` },
      last: env.lb >= T.done ? { x: heldAt(env.lb, Math.floor(dist(lbq))).x * SC, y: heldAt(env.lb, Math.floor(dist(lbq))).y * SC, w: 22 * SC, h: 16 * SC }
        : { x: (Math.round(LAST.wx) - Math.floor(dist(lbq)) - 11) * SC, y: LAST.y * SC, w: 22 * SC, h: 16 * SC },
      box: { x: BOX.x * SC, y: BOX.y * SC, w: BOX.w * SC, h: BOX.h * SC },
      palette: Object.values(C),
    };
  }

  return {
    render, dock, handoff,
    samples: () => 1,                                                // pixel art is never blurred
    sfx: [
      { b: T.mosaic, s: 'pixel_crush', g: 0.7 },                     // the mosaic's steps: a short bit-crushed crunch (blocks of 3)
      { b: T.mosaic + 0.25, s: 'pixel_crush', g: 0.8 },              // blocks of 12
      { b: T.swap, s: 'pixel_crush', g: 0.9 },                       // and the world is under them
      { b: +(T.clear + (HOPS.length - 1) / (30 * spb)).toFixed(3), s: 'pixel_coin', g: 0.6 },      // the big number lands in the counter
      { b: T.fall, s: 'pixel_tiles', g: 0.6 },                       // the old stickers drop, one after another: a quick falling run of blips
      { b: 1.1, s: 'pixel_beam', g: 0.7 },                           // the cursor beams down as the player
      { b: T.go, s: 'pixel_start', g: 0.7 },                         // the run starts
      ...pickBeats.map((b, i) => ({ b, s: 'pixel_coin', g: i < PICKS.length ? 0.55 : 0.5 })),      // a frame is picked up
      { b: J1[0], s: 'pixel_jump', g: 0.6 },
      { b: J2[0], s: 'pixel_jump', g: 0.6 },
      { b: BOP, s: 'pixel_bop', g: 0.8 },                            // the bug is squashed
      { b: T.stuck, s: 'pixel_wait', g: 0.4 },                       // one frame to go: a tense held trill
      { b: T.done, s: 'pixel_get', g: 0.9 },                         // the last frame is taken and held up
    ],
  };
}
