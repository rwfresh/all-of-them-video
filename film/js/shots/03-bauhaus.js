// 03/15 Geometric Bauhaus. "put it on the beat."
//
// The way in is a move that lands on the bar line, not a cut. For one beat before it this shot only shows
// Frame-by-Frame's own picture (which stops boiling and crouches its flame). Over the last twelve frames the three
// storyboard frames slide and square up onto the 120 px grid, still carrying their drawings; a ruled bar grows
// through each caption and through the old tag, covers it and squares up into a block; the flame springs out of its
// crouch and rounds into a red disc that is in its place exactly on the bar line.
//
// From there one move lands on every half-beat, each a whole number of modules, each ending on a grid line:
//   0 to 1  the grid draws itself on; three register marks are stamped, one a sixteenth
//   0.5, 1, 1.5, 2  one module of the storyboard at a time squares up and is printed: the colour wipes across it
//   2.5  the caption bars spread into the film's cue sheet        4.5  a semicircle slides one module out of its block
//   3    a quarter circle fans open about its corner              5    the triangle flips
//   3.5  blocks slide out from under blocks, one grows a module   5.75 the hero bar is flagged
//   4    the playhead steps to the next bar                       6    the title swings in about the frame's centre
// From 4.75 the three register marks become small squares that tumble down the streets, corner over corner, one of
// them landing on every sixteenth. After the title's hit the blocks turn a quarter about their own centres, a column
// a sixteenth, and back again (the middle one turns about the centre of the frame). So the three pivots follow one
// another: a corner, the frame's centre, a shape's own centre.
// The red disc is a bar clock: its black quarter jumps a quarter turn on every beat, once round for each bar, so the
// beat can be seen with the sound off. There are no drums under this shot; these moves are the percussion.
//
// The poster: four columns of blocks on 240 px plots with 120 px streets, the film's cue sheet under them (38 bars,
// one block a shot, the playhead on this bar), and the title standing the height of the sheet in the right-hand third.
// Isometric tips that plane back and stands a building on every plot (see handoff at the end).
//
// Grid: x = 120 i, y = 60 + 120 j (16 x 8 modules). Easing is linear or power-2 in-out; nothing overshoots.
// Inks are laid one plate at a time (yellow, red, blue multiplied on the paper, then black), each a little out of
// register. Things that simply appear on a beat are gated on the frame's own time, so motion-blur samples never
// straddle them.

import { DOCK, swapDock, termModel } from '../term.js';
import { lerp, seg } from '../util.js';

const U = 120;
const PAPER = '#F1E9DA', RED = '#E03C31', YEL = '#F2B705', BLU = '#1E4FA3', BLK = '#111111';
const INK = { Y: YEL, R: RED, B: BLU, K: BLK, P: PAPER };
const COL = { A: 120, B: 480, C: 840, D: 1200 }, ROW = [60, 420, 780], CELL = 240;
const HALF = Math.PI / 2;
const io2 = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);      // power-2 in-out

// the cue sheet of this shot, in local beats: when each move LANDS
const T = {
  cross: [0.25, 0.5, 0.75],                    // a register mark is stamped
  fill: { A: 0.5, B: 1, C: 1.5, D: 2 },        // a module squares up and its colour wipes across it
  strip: 2.5,        // the caption bars spread into the 38-bar cue strip
  fan: 3,            // the quarter circle fans open about its corner
  twin: 3.5,         // blocks slide out from under blocks; the red block grows one module
  step: 4,           // the playhead steps to the next bar
  rise: 4.5,         // a semicircle slides one module out of its block
  flip: 5,           // the triangle flips
  tumble: [4.75, 5, 5.25], every: 0.75,        // each register mark becomes a square; it tumbles one step every 0.75
  flag: 5.75,        // the hero bar is marked
  title: 6,          // the title swings in about the frame's centre
  set: 6.5,          // its two small lines are set
  wave1: { B: 6.25, C: 6.5, D: 6.75 },         // quarter turns about each block's own centre, a column a sixteenth
  wave2: { D: 7.25, C: 7.5, B: 7.75 },         // ... and back
  on: 8,             // the playhead moves on to the next shot's first bar as Enter is pressed
};
const PRE_FRAMES = 12;  // frames the squaring-up takes, ending on the bar line
const MOVE = 0.25;      // beats a move takes
const TURN = 0.4;       // beats a quarter turn of the waves takes
const TICK = 0.2;       // beats the clock's quarter takes to jump

const FRAME_X = [120, 720, 1320], FRAME_W = 480;                     // where the three storyboard frames land
const STRIP = { x0: 120, x1: 1440, y: 702, h: 36, gap: 12 };
const TITLE_BOX = { x0: 1440, x1: 1800, y0: 60, y1: 780, cap: 198 };  // the title's column, three modules wide
const STREETS = [420, 780, 1140];                                     // centre lines of the streets between the columns
// misregistration: how far each colour plate sits from the black, px
const OFF = { Y: [-2, 1.6], R: [1.6, -1.2], B: [1.9, 1.7], K: [0, 0], P: [0, 0] };

export default async function make(ctx) {
  const { W, H, fps, clock, shot, font, makeCanvas, util } = ctx;
  await Promise.all([
    font('Jost', '/assets/bauhaus/Jost-Variable.ttf', { weight: '100 900' }),
    font('Space Mono', '/assets/bauhaus/SpaceMono-Regular.ttf', { weight: '400' }),
    font('Space Mono', '/assets/bauhaus/SpaceMono-Bold.ttf', { weight: '700' }),
  ]);

  // ---- type, measured once ----
  const mg = makeCanvas(8, 8).getContext('2d');
  const face = (w, s) => `${w} ${s}px "Jost"`;
  const capOf = (w) => { mg.font = face(w, 200); return mg.measureText('H').actualBoundingBoxAscent / 200; };
  const widths = new Map();
  const rowFace = (w, s) => `${w >= 600 ? 700 : 400} ${s}px "Space Mono"`;
  const widthOf = (ch, w, s) => { const k = w + ch; if (!widths.has(k)) { mg.font = rowFace(w, 200); widths.set(k, mg.measureText(ch).width / 200); } return widths.get(k) * s; };
  const ROWPX = DOCK.adv / 0.612;                          // Space Mono's advance is 0.612 em: one letter fills one 36 px cell

  // the title: capitals 198 px high, set up the right-hand third, tracked so its ink is exactly six modules long
  const TITLE = (() => {
    const text = 'CUES', size = TITLE_BOX.cap / capOf(900), long = TITLE_BOX.y1 - TITLE_BOX.y0;
    mg.font = face(900, size);
    const ms = [...text].map((ch) => mg.measureText(ch));
    const n = ms.length, lead = ms[0].actualBoundingBoxLeft;      // a letter drawn at x has ink from x - left to x + right
    const natural = lead + ms.slice(0, n - 1).reduce((s, m) => s + m.width, 0) + ms[n - 1].actualBoundingBoxRight;
    const track = (long - natural) / (n - 1);
    let x = lead;                                           // so the first letter's ink starts at 0
    const at = ms.map((m) => { const p = x; x += m.width + track; return p; });
    return { text, size, at, base: (TITLE_BOX.x0 + TITLE_BOX.x1) / 2 + TITLE_BOX.cap / 2 };
  })();
  /** The title where it ends up: read from the bottom, its baseline on the right. */
  function drawTitle(g) {
    g.save();
    g.translate(TITLE.base, TITLE_BOX.y1); g.rotate(-HALF);
    g.font = face(900, TITLE.size); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    [...TITLE.text].forEach((ch, i) => g.fillText(ch, TITLE.at[i], 0));
    g.restore();
  }
  const BARS = Math.round(clock.totalBeats / (clock.bpb || 4)), BEATS = Math.round(clock.totalBeats);
  // two upright lines under the title, capitals 32 px high, and a red square that leads them
  const CAPT = { a: `${BARS} BARS`, b: `${BEATS} BEATS`, size: 32 / capOf(700), track: 3, x: TITLE.base - TITLE_BOX.cap, mark: { x: TITLE.base - TITLE_BOX.cap, y: 812, s: 32 }, ya: 900, yb: 956 };

  // ---- squares of ink inside the title, for the two plots Isometric has under it ----
  const INSIDE = (() => {
    const bw = TITLE_BOX.x1 - TITLE_BOX.x0, bh = TITLE_BOX.y1 - TITLE_BOX.y0;
    const c = makeCanvas(W, H), g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#000'; drawTitle(g);
    const d = g.getImageData(TITLE_BOX.x0, TITLE_BOX.y0, bw, bh).data;
    const S = new Int32Array((bw + 1) * (bh + 1));          // how many inked pixels above and to the left
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) S[(y + 1) * (bw + 1) + x + 1] = (d[(y * bw + x) * 4 + 3] > 200 ? 1 : 0) + S[y * (bw + 1) + x + 1] + S[(y + 1) * (bw + 1) + x] - S[y * (bw + 1) + x];
    const inked = (x, y, s) => S[(y + s) * (bw + 1) + x + s] - S[y * (bw + 1) + x + s] - S[(y + s) * (bw + 1) + x] + S[y * (bw + 1) + x] === s * s;
    return (cx, cy) => {                                     // the biggest square of solid ink, then the nearest to (cx, cy)
      for (let s = 56; s >= 20; s -= 4) {
        let best = null;
        for (let y = 0; y + s <= bh; y += 2) for (let x = 0; x + s <= bw; x += 2) if (inked(x, y, s)) { const q = Math.hypot(TITLE_BOX.x0 + x + s / 2 - cx, TITLE_BOX.y0 + y + s / 2 - cy); if (!best || q < best.q) best = { x: TITLE_BOX.x0 + x, y: TITLE_BOX.y0 + y, w: s, h: s, q }; }
        if (best && best.q < 190) return best;
      }
      return { x: cx - 20, y: cy - 20, w: 40, h: 40 };
    };
  })();

  // ---- the cue strip: one block a shot, as long as its bars ----
  const PITCH = (STRIP.x1 - STRIP.x0) / BARS;
  const SEGS = (() => { let a = 0; return clock.shots.map((s) => { const o = { name: s.name, a, n: s.bars, shot: !!s.num }; a += s.bars; return o; }); })();
  const HERE = SEGS.find((s) => s.name === shot.name) || SEGS[3];
  const HERO = SEGS.find((s) => s.name === 'synth') || SEGS[10];
  const HERO_BAR = HERO.a + 1;                               // the bar the chrome title lands on (bar 25), counted from 0
  // which caption bar each block comes out of: split on shot boundaries nearest to thirds of the film
  const cut = (f) => SEGS.reduce((best, s) => (Math.abs(s.a - f * BARS) < Math.abs(best - f * BARS) ? s.a : best), 0);
  const CUTS = [0, cut(0.32), cut(0.68), BARS];

  // ---- paper tooth and salt, made once; SHEET is the bare paper as it is seen ----
  const TOOTH = (() => {
    const c = makeCanvas(W, H), g = c.getContext('2d'), id = g.createImageData(W, H), R = util.rng(1919);
    for (let i = 0; i < W * H; i++) { const v = 255 - Math.floor(R() * R() * 26); id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v - 2; id.data[i * 4 + 3] = 255; }
    g.putImageData(id, 0, 0);
    // slow unevenness in the sheet
    for (let i = 0; i < 46; i++) { const x = R() * W, y = R() * H, r = 180 + R() * 420; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(90,70,40,${0.008 + R() * 0.008})`); gr.addColorStop(1, 'rgba(90,70,40,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    return c;
  })();
  const SALT = (() => {
    const c = makeCanvas(W, H), g = c.getContext('2d'), R = util.rng(1923);
    g.fillStyle = PAPER;
    for (let i = 0; i < 15000; i++) { g.globalAlpha = 0.16 + R() * 0.5; const r = 0.5 + R() * R() * 1.5; g.beginPath(); g.arc(R() * W, R() * H, r, 0, 7); g.fill(); }
    for (let i = 0; i < 420; i++) { g.globalAlpha = 0.14 + R() * 0.26; g.fillRect(R() * W, R() * H, 4 + R() * 26, 0.8 + R() * 0.8); }    // fibres
    return c;
  })();
  const finish = (g) => { g.globalCompositeOperation = 'multiply'; g.drawImage(TOOTH, 0, 0); g.globalCompositeOperation = 'source-over'; g.drawImage(SALT, 0, 0); };
  const SHEET = (() => { const c = makeCanvas(W, H), g = c.getContext('2d'); g.fillStyle = PAPER; g.fillRect(0, 0, W, H); finish(g); return c; })();
  const printed = (hexInk) => { const a = [1, 3, 5].map((i) => parseInt(hexInk.slice(i, i + 2), 16)), p = [1, 3, 5].map((i) => parseInt(PAPER.slice(i, i + 2), 16)); return '#' + a.map((v, i) => Math.round((v * p[i]) / 255).toString(16).padStart(2, '0')).join(''); };
  const SEEN = { [RED]: printed(RED), [YEL]: printed(YEL), [BLU]: printed(BLU), [BLK]: BLK };      // an ink as it looks on the paper

  const lbFrame = (env) => clock.beat(env.frame / fps) - shot.b0;      // the frame's own beat, the same for every blur sample

  // ---- pieces, in a block's own space (centre 0,0; a 240 px block runs -120 to 120) ----
  const sq = (g, x, y, w, h) => g.fillRect(x, y, w, h);
  const poly = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };
  const inBlock = (g, cx, cy, rot, fn) => { g.save(); g.translate(cx, cy); if (rot) g.rotate(rot); fn(g); g.restore(); };
  const playTri = (f) => [[60 - 60 * f, -120], [60 - 60 * f, 120], [60 + 60 * f, 0]];            // in the right half; f 1 points right, -1 left

  /** A block's print, turned by rot. f is the triangle's flip, -1 to 1; e how far a piece has opened or slid, 0 to 1. */
  function solid(put, name, cx, cy, rot, f = 1, e = 1) {
    const B = (ink, fn) => put(ink, (g) => inBlock(g, cx, cy, rot, fn));
    if (name === 'B2') {
      B('Y', (g) => { sq(g, -120, -120, 120, 120); sq(g, 0, 0, 120, 120); });
      B('K', (g) => { sq(g, 0, -120, 120, 120); sq(g, -120, 0, 120, 120); });
    } else if (name === 'C2') {
      B('Y', (g) => { g.beginPath(); g.arc(0, 0, 120, Math.PI, 2 * Math.PI); g.closePath(); g.fill(); });
      B('B', (g) => sq(g, -120, 0, 240, 120));
    } else if (name === 'D2') {
      B('R', (g) => sq(g, -120, -120, 120, 240));
      B('K', (g) => { if (Math.abs(f) > 0.01) { poly(g, playTri(f)); g.fill(); } });
    } else if (name === 'D1') {
      B('Y', (g) => { if (e > 0) { g.beginPath(); g.moveTo(-120, 120); g.arc(-120, 120, 240, -HALF, -HALF + HALF * e); g.closePath(); g.fill(); } });
    } else if (name === 'B1') {
      B('B', (g) => {
        // one outline for both, so the ink is laid once: the half block, and what shows of the circle beyond its edge
        const dx = 120 * (1 - e), a = Math.acos(Math.min(1, dx / 120));
        g.beginPath(); g.moveTo(-120, -120); g.lineTo(0, -120);
        if (e > 0) g.arc(-dx, 0, 120, -a, a);
        g.lineTo(0, 120); g.lineTo(-120, 120); g.closePath(); g.fill();
      });
    }
  }
  const full = (put, ink, cx, cy, rot) => put(ink, (g) => inBlock(g, cx, cy, rot, (gg) => sq(gg, -120, -120, 240, 240)));
  /** Clip everything put since index `from` to a rectangle (or to a path, with a fill rule). */
  const clipTo = (L, from, path, rule) => { for (let i = from; i < L.length; i++) { const fn = L[i][1]; L[i][1] = (g) => { g.save(); g.beginPath(); path(g); g.clip(rule || 'nonzero'); fn(g); g.restore(); }; } };

  // ---- what Frame-by-Frame hands over, and where each thing goes ----
  const have = (ho) => !!(ho && Array.isArray(ho.panels) && ho.panels.length === 3 && ho.flame);
  function captionBars(ho) {
    const caps = ho && Array.isArray(ho.captions) && ho.captions.length === 3 ? ho.captions : [{ text: 'x'.repeat(12), x: 386, y: 693 }, { text: 'x'.repeat(12), x: 960, y: 679 }, { text: 'x'.repeat(19), x: 1534, y: 691 }];
    return caps.map((c) => { const w = (c.text || '').length * 23; return { b0: Math.round((c.x - w / 2) / 60) * 60, b1: Math.round((c.x + w / 2) / 60) * 60, x0: c.x - w / 2 - 6, x1: c.x + w / 2 + 6, y: (c.y ?? 690) - 16 }; });
  }
  /** Draw the picture before this one so that its panel p sits in the rectangle (cx, cy, w, h), turned by rot. */
  function panelImage(g, other, p, cx, cy, w, h, rot) {
    g.translate(cx, cy); g.rotate(rot); g.scale(w / p.w, h / p.h); g.rotate(-p.rot); g.translate(-(p.x + p.w / 2), -(p.y + p.h / 2));
    g.drawImage(other, 0, 0);
  }

  /**
   * The last twelve frames before the bar line: Frame-by-Frame's own picture, with its frames, captions, tag and
   * flame taken off the sheet and moved to where this shot begins. e runs 0 to 1 and is 1 on the bar line.
   */
  function squareUp(g, env, ho, e, tag) {
    const O = env.other, P = ho.panels, f = ho.flame, bars = captionBars(ho);
    // bare paper laid over a rectangle, its edge feathered over 12 px so the two papers' grain meet without a line
    const lay = (x, y, w, h) => { for (let k = 0; k < 4; k++) { const m = 12 - 4 * k; g.save(); g.globalAlpha = 1 / (4 - k); g.beginPath(); g.rect(x - m, y - m, w + 2 * m, h + 2 * m); g.clip(); g.drawImage(SHEET, 0, 0); g.restore(); } };
    const mid = (i) => [P[i].x + P[i].w / 2, P[i].y + P[i].h / 2];
    const TAGBOX = { x0: 150, x1: Math.min(900, 164 + ((env.otherEnv && env.otherEnv.tag ? `${env.otherEnv.tag.num}/${env.otherEnv.tag.of} ${env.otherEnv.tag.name}`.length : 20) + 1) * 28), y: 100 };
    const arrows = [1, 2].map((i) => [(mid(i - 1)[0] + mid(i)[0]) / 2, (mid(i - 1)[1] + mid(i)[1]) / 2 + 6]);
    const flameBox = { x: f.x - 150, y: f.y - 190, w: 300, h: Math.max(40, P[1].y - 4 - (f.y - 190)) };

    g.drawImage(O, 0, 0);
    // bare paper where the things that move were
    for (const p of P) lay(p.x - 22, p.y - 22, p.w + 44, p.h + 44);
    lay(flameBox.x, flameBox.y, flameBox.w, flameBox.h);
    lay(TAGBOX.x0, TAGBOX.y - 34, TAGBOX.x1 - TAGBOX.x0, 72);
    for (const b of bars) lay(b.x0, b.y - 26, b.x1 - b.x0, 56);
    for (const [ax, ay] of arrows) lay(ax - 32, ay - 24, 64, 48);
    lay(0, H - 64, W, 64); lay(0, 0, W, 56);

    g.globalCompositeOperation = 'darken';
    // the peg holes slide off the sheet; the arrows between the frames draw in to nothing
    g.drawImage(O, 0, H - 64, W, 64, 0, H - 64 + 80 * e, W, 64);
    g.drawImage(O, 0, 0, W, 56, 0, -70 * e, W, 56);
    for (const [ax, ay] of arrows) { const k = 1 - e; if (k > 0.02) g.drawImage(O, ax - 32, ay - 24, 64, 48, ax - 32 * k, ay - 24 * k, 64 * k, 48 * k); }
    // the old tag and the captions stay put until a ruled bar has grown over them
    const cover = seg(e, 0, 0.3), go = io2(seg(e, 0.3, 1));
    if (cover < 1) { g.drawImage(O, TAGBOX.x0, TAGBOX.y - 34, TAGBOX.x1 - TAGBOX.x0, 72, TAGBOX.x0, TAGBOX.y - 34, TAGBOX.x1 - TAGBOX.x0, 72); for (const b of bars) g.drawImage(O, b.x0, b.y - 26, b.x1 - b.x0, 56, b.x0, b.y - 26, b.x1 - b.x0, 56); }
    // the flame rides up with the disc that grows out of its middle, and is gone inside it
    const dc = [lerp(f.x, 960, e), lerp(f.y, ROW[0] + 120, e)], dr = 120 * Math.pow(e, 0.7), fs = 1 - 0.8 * e;
    g.save(); g.translate(dc[0], dc[1]); g.scale(fs, fs); g.drawImage(O, flameBox.x, flameBox.y, flameBox.w, flameBox.h, flameBox.x - f.x, flameBox.y - f.y, flameBox.w, flameBox.h); g.restore();
    // the three frames slide to the grid and square up, their drawings with them
    const R = P.map((p, i) => { const [sx, sy] = mid(i); return { cx: lerp(sx, FRAME_X[i] + FRAME_W / 2, e), cy: lerp(sy, ROW[1] + 120, e), w: lerp(p.w, FRAME_W, e), h: lerp(p.h, CELL, e), rot: p.rot * (1 - e) }; });
    R.forEach((r, i) => {
      const m = 6 * (1 - e);
      g.save(); g.translate(r.cx, r.cy); g.rotate(r.rot); g.beginPath(); g.rect(-r.w / 2 - m, -r.h / 2 - m, r.w + 2 * m, r.h + 2 * m); g.clip(); g.rotate(-r.rot); g.translate(-r.cx, -r.cy);
      panelImage(g, O, P[i], r.cx, r.cy, r.w, r.h, r.rot);
      g.restore();
    });
    g.globalCompositeOperation = 'source-over';

    // this shot's ink, firming up over the old lines
    g.fillStyle = BLK; g.strokeStyle = BLK; g.lineJoin = 'miter';
    R.forEach((r, i) => {
      const lw = lerp(4, 12, e);
      g.save(); g.translate(r.cx, r.cy); g.rotate(r.rot); g.lineWidth = lw; g.strokeRect(-r.w / 2 + lw / 2, -r.h / 2 + lw / 2, r.w - lw, r.h - lw);
      if (i === 0) g.fillRect(-lw, -r.h / 2, lw, r.h * e);                                       // the first frame is two modules: its dividing line is ruled down
      g.restore();
    });
    const bar = (x0, x1, y, tx, ty, tw, th) => { const hh = lerp(1.5, 24, cover); g.fillRect(lerp(x0, tx, go), lerp(y - hh, ty, go), lerp(x1 - x0, tw, go), lerp(2 * hh, th, go)); };
    bars.forEach((b) => bar(b.x0, b.x1, b.y, b.b0, STRIP.y, b.b1 - b.b0, STRIP.h));
    const tr = { x: lerp(TAGBOX.x0, COL.A, go), y: lerp(TAGBOX.y - lerp(1.5, 30, cover), ROW[0], go), w: lerp(TAGBOX.x1 - TAGBOX.x0, CELL, go), h: lerp(2 * lerp(1.5, 30, cover), CELL, go) };
    g.fillRect(tr.x, tr.y, tr.w, tr.h);
    if (tag) { g.save(); g.beginPath(); g.rect(tr.x, tr.y, tr.w, tr.h); g.clip(); g.fillStyle = PAPER; tagLetters(g, tag); g.restore(); }
    if (dr > 0.5) {
      g.fillStyle = SEEN[RED]; g.beginPath(); g.arc(dc[0], dc[1], dr, 0, 2 * Math.PI); g.fill();
      const open = HALF * seg(e, 0.45, 1);                                                      // its black quarter opens as it lands
      if (open > 0) { g.fillStyle = BLK; g.beginPath(); g.moveTo(dc[0], dc[1]); g.arc(dc[0], dc[1], dr, -HALF, -HALF + open); g.closePath(); g.fill(); }
    }
    g.globalAlpha = e; g.drawImage(SALT, 0, 0); g.globalAlpha = 1;                                // the print's salt comes up as the ink firms
  }

  function tagLetters(g, tag) {
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    const no = `${tag.num}/${tag.of}`;
    g.font = face(800, 100); const ns = Math.min(84, (196 / g.measureText(no).width) * 100);
    g.font = face(800, ns); g.fillText(no, COL.A + 22 - g.measureText(no).actualBoundingBoxLeft, ROW[0] + 24 + capOf(800) * ns);
    const size = 28 / capOf(700), name = tag.name;
    g.font = face(700, size);
    const nat = [...name].reduce((w, ch) => w + g.measureText(ch).width, 0), tr = Math.min(14, (196 - nat) / Math.max(1, name.length - 1));
    let x = COL.A + 22;
    for (const ch of name) { g.fillText(ch, x, ROW[0] + CELL - 24); x += g.measureText(ch).width + tr; }
  }

  /** Everything this shot prints at local beat lb: a list of [ink, draw], and the parts of the storyboard still showing. */
  function build(lb, lbF, ho, tag, halfFrame) {
    const L = [], sketch = [];
    const put = (ink, fn) => L.push([ink, fn]);
    const at = (b) => lbF >= b - halfFrame;                  // true from the frame nearest beat b
    const lin = (land, d = MOVE) => seg(lb, land - d, land);
    const mv = (land, d = MOVE) => io2(seg(lb, land - d, land));
    const going = (land, d = MOVE) => lb > land - d;         // the move has started
    const turn = (c) => HALF * (io2(seg(lb, T.wave1[c] - TURN, T.wave1[c])) - io2(seg(lb, T.wave2[c] - TURN, T.wave2[c])));

    // the grid draws itself on from the middle of the sheet during the first beat, then sinks back into the paper
    const gridA = 0.3 * (1 - seg(lb, 1.5, 2.5));
    if (gridA > 0) put('K', (g) => {
      g.save(); g.globalAlpha = gridA;
      for (let x = U; x < W; x += U) { const p = seg(lb, 0.5 * Math.abs(x - W / 2) / (W / 2), 0.5 * Math.abs(x - W / 2) / (W / 2) + 0.4) * H / 2; if (p > 0) g.fillRect(x - 1, H / 2 - p, 2, 2 * p); }
      for (let y = 60; y < H; y += U) { const p = seg(lb, 0.5 * Math.abs(y - H / 2) / (H / 2), 0.5 * Math.abs(y - H / 2) / (H / 2) + 0.4) * W / 2; if (p > 0) g.fillRect(W / 2 - p, y - 1, 2 * p, 2); }
      g.restore();
    });

    // three register marks are stamped where the streets cross, one a sixteenth. Later each becomes a small square
    // that tumbles down its street, turning about a lower corner: one of the three lands on every sixteenth.
    STREETS.forEach((cx, i) => {
      const s = T.tumble[i];
      if (!at(s)) { if (at(T.cross[i])) put('K', (g) => { g.fillRect(cx - 15, 360 - 1.5, 30, 3); g.fillRect(cx - 1.5, 360 - 15, 3, 30); }); return; }
      const n = Math.min(4, Math.max(0, Math.floor((lb - s) / T.every + 1e-9))), y = 330 + 60 * n;
      const u = n >= 4 ? 0 : io2(seg(lb, s + T.every * (n + 1) - 0.3, s + T.every * (n + 1)));
      const right = n % 2 === 0, px = cx + (right ? 30 : -30), py = y + 60;
      put('K', (g) => { g.save(); g.translate(px, py); g.rotate((right ? -1 : 1) * HALF * u); g.fillRect(cx - 30 - px, -60, 60, 60); g.restore(); });
    });

    // ---- the cue strip ----
    const bars = captionBars(ho), sp = lin(T.strip), landed = at(T.strip), flagged = at(T.flag);
    const edge = (k, right) => {                              // x of bar line k: in its caption bar, then in the strip
      let j = 0; while (j < 2 && (right ? k > CUTS[j + 1] : k >= CUTS[j + 1])) j++;
      const u = (k - CUTS[j]) / (CUTS[j + 1] - CUTS[j]);
      return lerp(lerp(bars[j].b0, bars[j].b1, u), STRIP.x0 + k * PITCH, sp);
    };
    if (sp <= 0) put('K', (g) => { for (const b of bars) g.fillRect(b.b0, STRIP.y, b.b1 - b.b0, STRIP.h); });
    else for (const s of SEGS) {
      const x0 = edge(s.a, false), x1 = edge(s.a + s.n, true) - STRIP.gap * sp;
      const ink = landed && s === HERE ? 'R' : flagged && s === HERO ? 'Y' : 'K';
      put(ink, (g) => g.fillRect(x0, STRIP.y, x1 - x0, STRIP.h));
      if (landed && !s.shot) put('P', (g) => g.fillRect(x0 + 5, STRIP.y + 5, x1 - x0 - 10, STRIP.h - 10));      // the opening and the ending are not shots: outlines
      if (landed) put('P', (g) => { for (let k = 1; k < s.n; k++) g.fillRect(STRIP.x0 + (s.a + k) * PITCH - STRIP.gap / 2 - 1, STRIP.y + STRIP.h - 12, 2, 12); });
    }
    const mark = (ink, bar) => put(ink, (g) => { const x = STRIP.x0 + (bar + 0.5) * PITCH; poly(g, [[x - 15, STRIP.y - 30], [x + 15, STRIP.y - 30], [x, STRIP.y - 6]]); g.fill(); });
    if (landed) mark('R', HERE.a + lin(T.step) + lin(T.on));  // the playhead: bar 9, bar 10 on beat 4, and on as Enter is pressed
    if (flagged) mark('K', HERO_BAR);

    // ---- row 2: the storyboard, one module at a time ----
    const cy2 = ROW[1] + 120, y0 = ROW[1];
    const frame = (x, w, sides = 'tlbr') => put('K', (g) => {                                   // a ruled frame, 12 px, inside (x, y0, w, 240)
      if (sides.includes('t')) g.fillRect(x, y0, w, 12); if (sides.includes('b')) g.fillRect(x, y0 + CELL - 12, w, 12);
      if (sides.includes('l')) g.fillRect(x, y0, 12, CELL); if (sides.includes('r')) g.fillRect(x + w - 12, y0, 12, CELL);
    });
    // A: the first frame's left module; red wipes across it from the left, and at 3.5 it grows one module upward
    const wA = lin(T.fill.A), topA = lerp(y0, y0 - U, lin(T.twin));
    if (wA < 1) { const i0 = L.length; frame(120, 240); clipTo(L, i0, (g) => g.rect(120 + 240 * wA, y0, 240, CELL)); sketch.push({ p: 0, dx: 0, clip: (g) => g.rect(120 + 240 * wA, y0, 240 * (1 - wA), CELL) }); }
    if (wA > 0) put('R', (g) => g.fillRect(120, topA, 240 * wA, y0 + CELL - topA));
    // B: its right module slides one module clear and the chequer wipes down it
    const sB = lin(T.fill.B), xB = lerp(360, 480, sB);
    if (sB < 1) { const i0 = L.length; frame(xB, 240, sB > 0 ? 'tlbr' : 'tbr'); clipTo(L, i0, (g) => g.rect(xB, y0 + CELL * sB, 240, CELL)); sketch.push({ p: 0, dx: xB - 360, clip: (g) => g.rect(xB, y0 + CELL * sB, 240, CELL * (1 - sB)) }); }
    if (sB > 0) { const i0 = L.length; solid(put, 'B2', xB + 120, cy2, turn('B')); if (sB < 1) clipTo(L, i0, (g) => g.rect(xB, y0, 240, CELL * sB)); }
    // C: the middle frame closes to one module while the sun and its horizon wipe up it
    const sC = lin(T.fill.C), lC = lerp(720, 840, sC), rC = lerp(1200, 1080, sC);
    if (sC < 1) {
      const hole = (g) => { g.rect(lC, y0, rC - lC, CELL); if (sC > 0) g.rect(840, y0 + CELL * (1 - sC), 240, CELL * sC); };
      const i0 = L.length; frame(lC, rC - lC); clipTo(L, i0, hole, 'evenodd');
      // what still shows of the drawing, as three plain rectangles (a blend mode does not draw through a clip with a hole in it)
      const yw = y0 + CELL * (1 - sC);
      sketch.push({ p: 1, dx: 0, clip: (g) => g.rect(lC, y0, rC - lC, yw - y0) });
      if (sC > 0 && lC < 840) sketch.push({ p: 1, dx: 0, clip: (g) => g.rect(lC, yw, 840 - lC, CELL * sC) }, { p: 1, dx: 0, clip: (g) => g.rect(1080, yw, rC - 1080, CELL * sC) });
    }
    if (sC > 0) { const i0 = L.length; solid(put, 'C2', 960, cy2, turn('C')); if (sC < 1) clipTo(L, i0, (g) => g.rect(840, y0 + CELL * (1 - sC), 240, CELL * sC)); }
    // D: the last frame slides a module left and closes to one, and its print wipes across from the left
    const sD = lin(T.fill.D), lD = lerp(1320, 1200, sD), rD = lerp(1800, 1440, sD), f = -Math.cos(Math.PI * mv(T.flip));
    if (sD < 1) { const i0 = L.length; frame(lD, rD - lD); clipTo(L, i0, (g) => g.rect(lD + 240 * sD, y0, rD - lD, CELL)); sketch.push({ p: 2, dx: lD - 1320, clip: (g) => g.rect(lD + 240 * sD, y0, rD - lD - 240 * sD, CELL) }); }
    if (sD > 0) { const i0 = L.length; solid(put, 'D2', lD + 120, cy2, turn('D'), f); if (sD < 1) clipTo(L, i0, (g) => g.rect(lD, y0, 240 * sD, CELL)); }

    // ---- row 1 ----
    const cy1 = ROW[0] + 120;
    // half a block slides out from under the tag's block; later a semicircle slides one module out of it
    if (going(T.twin)) { const i0 = L.length; solid(put, 'B1', lerp(240, 480, mv(T.twin)) + 120, cy1, turn('B'), 1, lin(T.rise)); clipTo(L, i0, (g) => g.rect(360, 0, W, H)); }
    put('K', (g) => g.fillRect(COL.A, ROW[0], CELL, CELL));                                     // the tag's block
    if (tag) put('P', (g) => tagLetters(g, tag));
    // the bar clock: a red disc whose black quarter jumps a quarter turn on every beat
    const beatNo = Math.max(0, Math.floor(lb)), hand = beatNo + io2(seg(lb - beatNo, 1 - TICK, 1));
    put('R', (g) => { g.beginPath(); g.arc(960, cy1, 120, 0, 2 * Math.PI); g.fill(); });
    put('K', (g) => { const a0 = -HALF + hand * HALF; g.beginPath(); g.moveTo(960, cy1); g.arc(960, cy1, 120, a0, a0 + HALF); g.closePath(); g.fill(); });
    // the quarter circle fans open about its corner
    if (going(T.fan)) solid(put, 'D1', COL.D + 120, cy1, turn('D'), 1, mv(T.fan));

    // ---- row 3: a block slides up into the sheet, three modules ----
    if (going(T.twin)) full(put, 'B', COL.D + 120, lerp(ROW[2] + 3 * U, ROW[2], lin(T.twin)) + 120, turn('D'));

    // ---- the title swings in about the centre of the frame; then its two small lines are set under it ----
    if (going(T.title, 0.5)) put('K', (g) => {
      const e = io2(seg(lb, T.title - 0.5, T.title));
      g.save(); g.translate(W / 2, H / 2); g.rotate(HALF * (1 - e)); g.translate(-W / 2, -H / 2); drawTitle(g); g.restore();
    });
    if (at(T.set)) {
      put('R', (g) => g.fillRect(CAPT.mark.x, CAPT.mark.y, CAPT.mark.s, CAPT.mark.s));
      put('K', (g) => {
        g.font = face(700, CAPT.size); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
        [[CAPT.a, CAPT.ya], [CAPT.b, CAPT.yb]].forEach(([text, y]) => { let px = CAPT.x - g.measureText(text[0]).actualBoundingBoxLeft; for (const ch of text) { g.fillText(ch, px, y); px += g.measureText(ch).width + CAPT.track; } });
      });
    }
    return { L, sketch };
  }

  // ---- the terminal's two rows: one letter a cell; the cursor is a red square module ----
  const cellX = (col) => DOCK.x + (col + 0.5) * DOCK.adv;
  function rowText(g, text, col0, y, weight, color, from = 0, to = Infinity) {
    g.font = rowFace(weight, ROWPX); g.textBaseline = 'alphabetic'; g.textAlign = 'center'; g.fillStyle = color;
    for (let i = Math.max(0, from); i < Math.min(text.length, to); i++) {
      const ch = text[i]; if (ch === ' ') continue;
      const w = widthOf(ch, weight, ROWPX), k = Math.min(1, 44 / w);
      if (k < 1) { g.save(); g.translate(cellX(col0 + i), y); g.scale(k, 1); g.fillText(ch, 0, 0); g.restore(); } else g.fillText(ch, cellX(col0 + i), y);
    }
  }
  // carriage return: the cursor runs back along the row taking the old prompt with it, and is home on the first
  // half-beat after the terminal clears the row
  const RET = (() => { const S = ctx.script.shots[shot.name]; return S && S.next ? Math.ceil((S.next.keys[0] - S.b0 - ctx.script.T.clear) * 2 - 1e-6) / 2 : Infinity; })();
  const OLD = shot.prompt || '';
  function dock(g, env, part) {
    // what the terminal says is read at the frame's own time, so a line or a letter appears whole on one frame
    // (blur samples of the same frame would otherwise show it half there); the carriage's run stays continuous
    const m = termModel(ctx.script, shot.name, clock.beat(env.frame / fps)), lb = env.lb, x = DOCK.x;
    g.save();
    if (part !== 'C' && m.last) {
      const o = m.last, y = DOCK.rowB;
      if (o.kind === 'result') {
        g.fillStyle = BLK; g.fillRect(x + 2 * DOCK.adv + 12, y - 46, 7, 40); g.fillRect(x + 2 * DOCK.adv + 12, y - 13, 36, 7);
        rowText(g, o.text, 5, y, 600, BLU);
      } else {
        const busy = o.kind === 'tool' && o.age < 0.35;
        g.fillStyle = busy ? RED : BLK; g.beginPath(); g.arc(x + 18, y - 20, 13, 0, 2 * Math.PI); g.fill();
        const shown = o.kind === 'say' ? o.text.slice(0, o.chars) : o.text, k = o.kind === 'tool' ? shown.indexOf('(') : 0;
        if (k > 0) { rowText(g, shown.slice(0, k), 2, y, 800, BLK); rowText(g, shown.slice(k), 2 + k, y, 500, BLK); } else rowText(g, shown, 2, y, o.kind === 'spin' ? 600 : 500, o.kind === 'spin' ? RED : BLK);
      }
    }
    if (part !== 'B') {
      const c = m.rowC, y = DOCK.rowC;
      // the prompt sign: a chevron cut from two bars
      g.strokeStyle = RED; g.lineWidth = 9; g.lineJoin = 'miter'; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(x + 5, y - 40); g.lineTo(x + 27, y - 21); g.lineTo(x + 5, y - 2); g.stroke();
      let col = 2 + c.n, shownTo = c.n, text = c.text;
      const returning = lb >= 0 && lb < RET && (c.mode === 'cmd' || (c.mode === 'typing' && c.n === 0));
      if (returning) {
        const back = seg(lb, RET - MOVE, RET);
        text = OLD; col = lerp(2 + OLD.length, 2, back); shownTo = Math.ceil(col - 2 - 1e-6);
      }
      rowText(g, text, 2, y, 600, BLK, 0, shownTo);
      if (c.mode === 'typing') for (let i = Math.max(0, c.n - 2); i < c.n; i++) {       // each key leaves a red rule that runs out
        const k = 1 - seg(c.keyAge(i), 0, 0.25);
        if (k > 0) { g.fillStyle = RED; g.fillRect(cellX(2 + i) - 18, y + 10, 36 * k, 7); }
      }
      const cx = x + col * DOCK.adv + 2, lit = (returning && lb >= RET - MOVE) || m.blink;
      if (lit) { g.fillStyle = RED; g.fillRect(cx, y - 42, 42, 42); } else { g.strokeStyle = RED; g.lineWidth = 5; g.strokeRect(cx + 2.5, y - 39.5, 37, 37); }
    }
    g.restore();
  }

  // ---- the frame ----
  function render(g, env) {
    const arriving = !!(env.other && env.role === 'in');
    const ho = arriving && env.otherImpl && env.otherImpl.handoff ? env.otherImpl.handoff(env.otherEnv) : null;
    const pre = PRE_FRAMES / (fps * env.spb), theirs = arriving && env.otherImpl && env.otherImpl.dock;
    if (arriving && env.lb < 0) {
      // before the bar line: the picture before, untouched, until the last twelve frames
      if (env.lb > -pre && have(ho)) squareUp(g, env, ho, io2(seg(env.lb, -pre, 0)), env.tag);
      else g.drawImage(env.other, 0, 0);
      if (!env.noDock) { if (theirs) swapDock(g, env, dock, 0); else dock(g, env); }
      return;
    }
    const lb = Math.max(0, env.lb), lbF = Math.max(0, lbFrame(env)), halfFrame = 0.5 / (fps * env.spb);
    g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
    const { L, sketch } = build(lb, lbF, ho, env.tag, halfFrame);
    for (const ink of ['Y', 'R', 'B', 'K', 'P']) {
      g.save();
      g.translate(OFF[ink][0], OFF[ink][1]);
      g.globalCompositeOperation = ink === 'K' || ink === 'P' ? 'source-over' : 'multiply';
      g.fillStyle = INK[ink]; g.strokeStyle = INK[ink];
      for (const [k, fn] of L) if (k === ink) fn(g);
      g.restore();
    }
    if (!env.noDock) {
      if (theirs) swapDock(g, env, dock, (env.lb - 0.04) / 1.4);
      else dock(g, env);
    }
    finish(g);
    // what is left of the storyboard, in the frames that are not printed yet
    if (arriving && have(ho)) for (const s of sketch) {
      g.save(); g.beginPath(); s.clip(g); g.clip();
      g.globalCompositeOperation = 'darken';
      panelImage(g, env.other, ho.panels[s.p], FRAME_X[s.p] + FRAME_W / 2 + s.dx, ROW[1] + 120, FRAME_W, CELL, 0);
      g.restore();
    }
  }

  /** Motion blur only while something is moving; the frame-exact events have none. */
  function samples(env) {
    const lb = env.lb;
    if (lb < 0.02) return 1;
    const moving = (land, d = MOVE) => lb > land - d && lb < land + 0.02;
    if (lb < 2.02) return Object.values(T.fill).some((b) => moving(b)) ? 4 : 1;                 // the picture before is painted for every sample here
    if (moving(T.strip) || moving(T.fan) || moving(T.twin) || moving(T.flip) || moving(T.step) || moving(T.rise)) return 8;
    if (moving(T.title, 0.5)) return 24;
    if (lb > T.wave1.B - TURN && lb < T.wave2.B + 0.02) return 8;
    if (lb > T.tumble[0]) return 6;
    if (lb > RET - MOVE && lb < RET + 0.02) return 8;
    const fr = lb - Math.floor(lb);
    return fr > 1 - TICK ? 6 : 1;
  }

  /**
   * For Isometric: fifteen plain rectangles it can lift off the sheet, each the colour of what is printed there.
   * Nine are in the blocks (whole squares, or a square hidden inside a round or slanted piece of the same colour);
   * three are blocks of the cue strip, which stand over the three plots the prompt rows cover; and the three plots
   * under the title take two squares of its own ink and the red square that leads its small lines.
   */
  const PLOT_1 = INSIDE(1680, 156), PLOT_2 = INSIDE(1680, 492);
  function handoff() {
    const seg3 = (name) => { const s = SEGS.find((q) => q.name === name) || SEGS[0]; return { x: STRIP.x0 + s.a * PITCH, y: STRIP.y, w: s.n * PITCH - STRIP.gap, h: STRIP.h }; };
    const modules = [
      { x: COL.A, y: ROW[0], w: 240, h: 240, color: BLK },
      { x: COL.B, y: ROW[0] + 60, w: 120, h: 120, color: BLU },               // inside the half block the semicircle sits on
      { x: 960 - 84, y: ROW[0] + 120, w: 84, h: 84, color: RED },             // inside the disc, clear of its black quarter
      { x: COL.D, y: ROW[0] + 240 - 168, w: 168, h: 168, color: YEL },        // inside the quarter circle
      { x: PLOT_1.x, y: PLOT_1.y, w: PLOT_1.w, h: PLOT_1.h, color: BLK },     // inside the title
      { x: COL.A, y: ROW[1], w: 240, h: 240, color: RED },
      { x: COL.B, y: ROW[1] + 120, w: 120, h: 120, color: BLK },
      { x: COL.C + 60, y: ROW[1] + 120, w: 120, h: 120, color: BLU },
      { x: COL.D, y: ROW[1], w: 120, h: 120, color: RED },
      { x: PLOT_2.x, y: PLOT_2.y, w: PLOT_2.w, h: PLOT_2.h, color: BLK },     // inside the title
      { x: COL.D, y: ROW[2], w: 240, h: 240, color: BLU },
      { x: CAPT.mark.x, y: CAPT.mark.y, w: CAPT.mark.s, h: CAPT.mark.s, color: RED },
      { ...seg3('line'), color: BLK },
      { ...seg3(shot.name), color: RED },
      { ...seg3('sticker'), color: BLK },
    ];
    for (const m of modules) m.color = SEEN[m.color];        // the colour as printed: the ink multiplied on the paper
    return { modules, paper: PAPER, ink: BLK, red: RED, yellow: YEL, blue: BLU, grid: { x0: 0, y0: 60, module: U }, streets: { x: [420, 780, 1140], y: [360, 720] } };
  }

  const tocks = [];
  T.tumble.forEach((s) => { for (let b = s; b < 7.9; b += T.every) tocks.push(b); });
  return {
    render, dock, samples, handoff,
    // one sound for every move, on the beat it lands
    sfx: [
      { b: 0, s: 'bauhaus_slide', g: 0.6, a: 'peak' },                // the frames slide to the grid: the slide's click is the bar line
      { b: 0, s: 'bauhaus_snap', g: 1, a: 'peak' },
      { b: T.cross[0], s: 'bauhaus_set', g: 0.3, a: 'peak' },
      { b: T.cross[2], s: 'bauhaus_set', g: 0.3, a: 'peak' },
      ...Object.values(T.fill).map((b, i) => ({ b, s: `bauhaus_blip${i + 1}`, g: 0.75, a: 'peak' })),      // a module is printed: four rising notes
      { b: T.strip - MOVE, s: 'bauhaus_ratchet', g: 0.6 },
      { b: T.fan, s: 'bauhaus_stamp', g: 0.8, a: 'peak' },
      { b: T.twin, s: 'bauhaus_clack', g: 0.8, a: 'peak' },
      { b: T.step, s: 'bauhaus_set', g: 0.7, a: 'peak' },
      { b: RET - MOVE, s: 'bauhaus_return', g: 0.45 },
      { b: T.rise, s: 'bauhaus_slide', g: 0.55, a: 'peak' },
      { b: T.flip, s: 'bauhaus_flip', g: 0.7, a: 'peak' },
      ...tocks.map((b) => ({ b, s: 'bauhaus_tock', g: 0.4, a: 'peak' })),                                   // a small square lands, corner over corner
      { b: T.flag, s: 'bauhaus_ping', g: 0.6, a: 'peak' },
      { b: T.title, s: 'bauhaus_title', g: 1, a: 'peak' },
      { b: T.set, s: 'bauhaus_set', g: 0.5, a: 'peak' },
      ...Object.values(T.wave1).map((b, i) => ({ b, s: `bauhaus_turn${i + 1}`, g: 0.7, a: 'peak' })),
      ...Object.values(T.wave2).map((b, i) => ({ b, s: `bauhaus_turn${3 - i}`, g: 0.6, a: 'peak' })),
      // the bar clock: a low wooden tick on every beat, quieter under the bigger hits
      ...[1, 2, 3, 4, 5, 6, 7].map((b) => ({ b, s: 'bauhaus_tick', g: b === 7 ? 0.6 : 0.4, a: 'peak' })),
    ],
  };
}
