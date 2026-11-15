// 14/15 Aurora & Glass: "slower. let it breathe." The film's quietest moment; the music falls away on its first beat.
//
// The way in is a pull of focus. The 3D picture before this shot lets its focus go and its light goes down; every
// highlight in it (soft's handoff().lights) opens into a disc with an edge, as highlights do out of focus. The first
// glass card rises over the picture while it is still there, frosting it. Then the discs lose their edges, cool from
// pink to violet, blue and cyan and drift apart: each of the aurora's lights was one of those highlights. One disc
// keeps its edge instead and becomes a lens of liquid glass. The rows change one skin at a time: the old letters
// leave, column by column, before this shot's letters come.
// Then frosted cards float up: the finished film in the middle (file, length, format, and the jury's second score when
// row B prints it), sound and output behind it. The lens glides across the film's still, looks in on the jury at work,
// and is at rest in the open before the score lands on beat 5, so the score is read plain. By the bar line the main
// card is at rest, facing the viewer, for Variety Captions to stand up.
//
// Everything is drawn in 2D onto one picture: glass is a real blur of what is behind it at that instant (frost()).
// That picture then goes once through the shared WebGL renderer for the lens's refraction and for grain (aurora/lens.js).
// Nothing here moves fast; every ease is a sine.

import { DOCK } from '../term.js';
import { clamp, lerp, seg, smooth, smoother, rng, TAU } from '../util.js';
import { makeLensPass } from './aurora/lens.js';

const DEG = Math.PI / 180;
const sine = (x) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x));            // the one ease of this shot: breathing in, breathing out
const arrive = (lb, t0, dur = 0.7) => { const a = sine((lb - t0) / dur); return { a, dy: 8 * (1 - a) }; };   // opacity and an 8 px rise
const mixRGB = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const WHITE = (a) => `rgba(255,255,255,${a})`;
const ONE = { a: 1, dy: 0 };

// ---- when (local beats) ---------------------------------------------------------------------------------------------
const T = {
  rack: [0.08, 1.0],                          // the focus is pulled: highlights open into discs
  melt: [0.9, 2.0],                           // the discs lose their edges and become the aurora (done inside the hand-over)
  rowsOut: [0.02, 0.24],                      // the old rows leave under a wipe; each new letter comes as the wipe clears it
  main: 0.35, left: 0.95, right: 1.2,         // the cards float up; the first is in by 0.85
  tag: 0.8,
  lensGlass: 1.0, lensOn: 2.0,                // one disc keeps its edge, becomes glass, reaches the still
  lensBead: [2.8, 3.3], lensThere: 3.85, lensSwell: [3.4, 3.9],   // it draws itself into a bead to cross to the gauge, and opens again over it
  score: 5.0,                                 // row B prints the score: it lands in the open, seen plain
  lensLeaves: 4.0, lensRest: 4.95,            // the lens leaves the jury at work and is at rest, over nothing, before the score lands
  flat: [5.6, 7.2],                           // the main card turns to face the viewer
  toggles: [2.75, 3.25, 3.75],
};
const ROW_IN = 0.1;                           // how long a new letter takes to rise into its column (about 3 frames)
const rackAt = (lb) => sine(seg(lb, T.rack[0], T.rack[1]));

// ---- where (frame pixels) -------------------------------------------------------------------------------------------
const MAIN = { w: 888, h: 499, r: 46, cx: 960, cy: 452, u: 888 / 840 };   // drawn from an 840 x 472 layout, a little larger
const LEFT = { w: 380, h: 236, r: 36, cx: 378, cy: 584, u: 1 };
const RIGHT = { w: 430, h: 316, r: 36, cx: 1576, cy: 376, u: 1 };   // its labels start clear of the main card's edge
const STILL = { x: 30, y: 30, w: 480, h: 270, r: 24 };            // on the main card
const GAUGE = { x: 676, y: 158, r: 84 };
const LENS_R = 160;
const LENS_REST = { x: 1616, y: 676 };      // the open aurora right of the main card and under the side card: no label within reach
const FIELD = { x: DOCK.left, y: 890, w: DOCK.right - DOCK.left, h: 116, r: 34 };   // the prompt's glass
const BUBBLE = { x: DOCK.left, y: 794, h: 84, r: 30 };                               // what Claude says, above it
const ROWS_Y = 760, ROWS_H = 320;

// ---- the aurora: five lights in neighbouring hues, each on its own slow path ----------------------------------------
const BASE = ['#0d0a36', '#06051c'];
const BLOBS = [
  // colour, alpha, centre, radii, drift (px), periods (s), phase; `from`: what it was in the picture before
  { c: hex('#7a45ff'), a: 0.88, x: 560, y: 380, rx: 640, ry: 500, dx: 150, dy: 90, px: 8.1, py: 10.5, ph: 0.4, from: 'button' },
  { c: hex('#2c63ff'), a: 0.80, x: 1430, y: 240, rx: 660, ry: 470, dx: 130, dy: 100, px: 9.9, py: 7.4, ph: 2.1 },
  { c: hex('#e03bd8'), a: 0.60, x: 330, y: 930, rx: 580, ry: 380, dx: 140, dy: 70, px: 6.8, py: 9.3, ph: 4.0 },
  { c: hex('#1fd6e8'), a: 0.52, x: 1600, y: 800, rx: 540, ry: 380, dx: 120, dy: 80, px: 8.7, py: 6.2, ph: 5.2 },
  { c: hex('#5a68ff'), a: 0.46, x: 990, y: 640, rx: 720, ry: 420, dx: 110, dy: 60, px: 11.2, py: 8.1, ph: 1.3 },
];
const PINK = hex('#ff6fb4'), WARM = hex('#ffe6ea'), BUTTON = { x: 956, y: 448, r: 330, c: hex('#f4718f') };
const DIM = hex('#1b1463');                                         // what the studio's light falls to

export default async function make(ctx) {
  const { W, H, fps, shot, cues, script, makeCanvas, useGL, blitGL, music } = ctx;
  const HAND = (shot.enter && shot.enter.post) || 2;

  await Promise.all([
    ctx.font('Outfit', '/assets/aurora/Outfit-Variable.ttf', { weight: '100 900' }),
    ctx.font('Geist Mono', '/assets/aurora/GeistMono-Variable.ttf', { weight: '100 900' }),
  ]);
  const SANS = '"Outfit", sans-serif', MONO = '"Geist Mono", monospace';

  // ---- what the cards say: all of it read from the cue sheet or the film's own clock ---------------------------------
  const cue = (name) => cues.shots.find((s) => s.name === name) || {};
  const outOf = (name, kind) => ((cue(name).out || []).filter((o) => o.kind === kind).pop() || {}).text || '';
  // the cut the second jury round scores: named in this shot's own cue entry (else the file Synthwave played)
  const FILE = shot.file || (outOf('synth', 'tool').match(/\(\s*\S+\s+([^\s)]+)\s*\)/) || [])[1] || `${shot.name}.mp4`;
  const clockOf = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const LENGTH = clockOf(ctx.clock.duration);
  const FORMAT = `${H}p${fps}`;
  const OUTPUTS = outOf('soft', 'result').split('·').map((s) => s.trim()).filter(Boolean).slice(0, 3);           // what the polish wrote
  const LUFS = ((outOf('liquid', 'result').match(/-?\d+(?:\.\d+)?\s*LUFS/) || [''])[0]).replace(/^-/, '−');   // the mix's loudness
  const JURY = ((outOf(shot.name, 'tool').match(/\((.*)\)/) || [])[1] || 'jury').replace(/,\s*/, ' · ');
  const scoreOf = (text) => { const m = (text || '').match(/([\d.]+)\s*\/\s*([\d.]+)/); return m ? { text: m[1], of: m[2], k: clamp(+m[1] / +m[2]) } : null; };

  let still = null;
  // the card names the second cut, so it shows the second cut: this still is the hero frame taken from that very file
  // (all-of-them_v2.mp4 at 47.18 s); the film's current still is the fallback
  try { still = await ctx.image('/assets/aurora/hero_v2.png'); }
  catch { try { still = await ctx.image('/assets/thumbs/synth.png'); } catch { /* no still yet: the card shows a plain field */ } }

  // ---- canvases ------------------------------------------------------------------------------------------------------
  const scene = makeCanvas(), sg = scene.getContext('2d');                    // the whole picture, before the lens
  const dimC = makeCanvas(), dg = dimC.getContext('2d');                      // the picture before this shot, out of focus and with the light going down
  const CM = 6;                                                               // a card's margin on its own canvas
  const cc = makeCanvas(MAIN.w + 2 * CM, MAIN.h + 2 * CM), cg = cc.getContext('2d');
  const tc = makeCanvas(MAIN.w + 260, MAIN.h + 140), tg = tc.getContext('2d');   // a card turned in depth, before it is laid in
  const fa = makeCanvas(640, 320), fag = fa.getContext('2d'), fb = makeCanvas(640, 320), fbg = fb.getContext('2d');
  const lay = makeCanvas(W, ROWS_H), lg = lay.getContext('2d'), old = makeCanvas(W, ROWS_H), og = old.getContext('2d');
  const lensPass = makeLensPass(scene, W, H);

  // ---- glass ---------------------------------------------------------------------------------------------------------
  const FQ = 4, FPAD = 44;
  /**
   * Frost: paint into g, inside the rounded box (x, y, w, h, r), what `src` shows around (sx, sy) at this instant,
   * blurred by `blur` px. k is the box's scale on src (a card drawn at 0.93 sees 0.93 of its own size).
   */
  function frost(g, x, y, w, h, r, src, sx, sy, k = 1, blur = 30) {
    const sw = w * k + 2 * FPAD, sh = h * k + 2 * FPAD, qw = Math.ceil(sw / FQ), qh = Math.ceil(sh / FQ);
    fag.setTransform(1, 0, 0, 1, 0, 0); fag.globalAlpha = 1; fag.globalCompositeOperation = 'source-over';
    fag.clearRect(0, 0, fa.width, fa.height);
    fag.imageSmoothingEnabled = true; fag.imageSmoothingQuality = 'high';
    fag.drawImage(src, sx - FPAD, sy - FPAD, sw, sh, 0, 0, qw, qh);
    fbg.clearRect(0, 0, fb.width, fb.height);
    fbg.filter = `blur(${(blur / FQ).toFixed(2)}px) saturate(1.3)`;
    fbg.drawImage(fa, 0, 0);
    fbg.filter = 'none';
    g.save();
    g.beginPath(); g.roundRect(x, y, w, h, r); g.clip();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(fb, 0, 0, qw, qh, x - FPAD / k, y - FPAD / k, sw / k, sh / k);
    g.restore();
  }

  /** The rest of the recipe: a few per cent of white, a soft light from above, and the 1 px line of light inside the edge. */
  function glaze(g, x, y, w, h, r, o = {}) {
    g.save();
    g.beginPath(); g.roundRect(x, y, w, h, r); g.clip();
    g.fillStyle = o.tint || WHITE(0.07); g.fillRect(x, y, w, h);
    const top = g.createLinearGradient(0, y, 0, y + h);
    top.addColorStop(0, WHITE(0.11)); top.addColorStop(0.42, WHITE(0)); top.addColorStop(1, WHITE(0.035));
    g.fillStyle = top; g.fillRect(x, y, w, h);
    if (o.sheen != null) {
      // a band of light that wanders slowly over the glass
      const bx = x + (o.sheen * 1.6 - 0.3) * w, bw = Math.max(160, w * 0.3);
      const band = g.createLinearGradient(bx - bw, 0, bx + bw, 0);
      band.addColorStop(0, WHITE(0)); band.addColorStop(0.5, WHITE(0.055)); band.addColorStop(1, WHITE(0));
      g.transform(1, 0, -0.5, 1, 0.5 * (y + h / 2), 0);
      g.fillStyle = band; g.fillRect(x - w, y, w * 3, h);
    }
    g.restore();
    const ln = g.createLinearGradient(x, y, x + w, y + h);
    ln.addColorStop(0, WHITE(0.6)); ln.addColorStop(0.45, WHITE(0.15)); ln.addColorStop(1, WHITE(0.34));
    g.strokeStyle = ln; g.lineWidth = o.line || 1.25;
    g.beginPath(); g.roundRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, Math.max(0, r - 0.75)); g.stroke();
  }

  /** A flat picture turned about its upright axis by ry and seen in perspective: drawn in upright strips, centred on 0,0. */
  function drawTurned(g, src, sw, sh, ry) {
    if (Math.abs(ry) < 0.0015) { g.drawImage(src, 0, 0, sw, sh, -sw / 2, -sh / 2, sw, sh); return; }
    const D = 1700, c = Math.cos(ry), s = Math.sin(ry), STEP = 2;
    const at = (u) => { const k = D / (D + u * s); return [u * c * k, k]; };
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    for (let u0 = 0; u0 < sw; u0 += STEP) {
      const n = Math.min(STEP, sw - u0), [xa, ka] = at(u0 - sw / 2), [xb, kb] = at(u0 + n - sw / 2), k = (ka + kb) / 2;
      g.drawImage(src, u0, 0, n, sh, xa, (-sh * k) / 2, xb - xa + 0.7, sh * k);
    }
  }

  /** One glass card: frost of what is behind it, its shadow, the glaze, what is on it; laid into the scene at its pose. */
  function card(C, P, content, t) {
    if (P.a <= 0.003) return;
    const { w, h, r } = C;
    cg.setTransform(1, 0, 0, 1, 0, 0); cg.globalAlpha = 1; cg.clearRect(0, 0, cc.width, cc.height);
    cg.translate(CM, CM);
    frost(cg, 0, 0, w, h, r, scene, P.x - (w * P.s) / 2, P.y - (h * P.s) / 2, P.s, 30);   // taken before its own shadow falls
    glaze(cg, 0, 0, w, h, r, { sheen: 0.5 + 0.5 * Math.sin(t * 0.55 + C.cx * 0.004) });
    cg.save(); cg.beginPath(); cg.roundRect(0, 0, w, h, r); cg.clip();
    cg.scale(C.u || 1, C.u || 1);
    content(cg);
    cg.restore();
    // its shadow on what is behind (drawn from far off to the left, so that only the shadow lands in the frame)
    sg.save();
    sg.globalAlpha = P.a;
    sg.setTransform(P.s, 0, 0, P.s, P.x - 30000, P.y);
    sg.shadowColor = 'rgba(4,2,26,0.5)'; sg.shadowBlur = 90 * P.s; sg.shadowOffsetX = 30000; sg.shadowOffsetY = 40 * P.s;
    sg.fillStyle = '#000';
    sg.beginPath(); sg.roundRect(-w / 2, -h / 2, w, h, r); sg.fill();
    sg.restore();
    // the card
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, tc.width, tc.height);
    tg.translate(tc.width / 2, tc.height / 2);
    drawTurned(tg, cc, w + 2 * CM, h + 2 * CM, P.ry || 0);
    sg.save();
    sg.globalAlpha = P.a;
    sg.translate(P.x, P.y); sg.rotate(P.rz || 0); sg.scale(P.s, P.s);
    sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = 'high';
    sg.drawImage(tc, -tc.width / 2, -tc.height / 2);
    sg.restore();
  }

  // ---- type on the cards -----------------------------------------------------------------------------------------------
  function text(g, s, x, y, o = {}) {
    g.font = `${o.w || 300} ${o.size || 28}px ${SANS}`;
    g.textAlign = o.align || 'left'; g.textBaseline = 'alphabetic';
    g.letterSpacing = `${o.track || 0}px`;
    g.fillStyle = WHITE((o.a ?? 0.94) * (o.k ?? 1));
    g.fillText(s, x, y + (o.dy || 0));
    g.letterSpacing = '0px';
  }
  const GRAD = [hex('#62ecff'), hex('#8d7cff'), hex('#f06fe6')];          // cyan, violet, magenta: the gauge and the lit toggles
  const gradAt = (u) => (u < 0.5 ? mixRGB(GRAD[0], GRAD[1], u * 2) : mixRGB(GRAD[1], GRAD[2], u * 2 - 1));

  // ---- the three cards' poses ---------------------------------------------------------------------------------------
  function poseMain(lb, t) {
    const e = sine((lb - T.main) / 1.5), rest = smoother(seg(lb, T.flat[0], T.flat[1]));
    return {
      x: MAIN.cx, y: MAIN.cy + 40 * (1 - e) + 2.5 * Math.sin(t * 0.9 + 1), s: lerp(0.93, 1, e),
      ry: (lerp(-12, -3.4, e) + 0.4 * Math.sin(t * 0.8)) * DEG * (1 - rest), rz: 0, a: sine((lb - T.main) / 0.5),
    };
  }
  function poseLeft(lb, t) {
    const e = sine((lb - T.left) / 1.5);
    return { x: LEFT.cx - 30 * (1 - e), y: LEFT.cy + 28 * (1 - e) + 5 * Math.sin(t * 0.7 + 2.1), s: lerp(0.86, 0.94, e), ry: (lerp(17, 7.5, e) + 0.8 * Math.sin(t * 0.6)) * DEG, rz: -1.1 * DEG, a: 0.94 * sine((lb - T.left) / 1.0) };
  }
  function poseRight(lb, t) {
    const e = sine((lb - T.right) / 1.5);
    return { x: RIGHT.cx + 30 * (1 - e), y: RIGHT.cy + 24 * (1 - e) + 5 * Math.sin(t * 0.75 + 4), s: lerp(0.86, 0.94, e), ry: (lerp(-18, -8.5, e) + 0.8 * Math.sin(t * 0.65 + 1)) * DEG, rz: 0.9 * DEG, a: 0.94 * sine((lb - T.right) / 1.0) };
  }

  // ---- what is on them ------------------------------------------------------------------------------------------------
  function mainContent(g, env) {
    const lb = env.lb, t = env.t;
    // the film's still
    const st = arrive(lb, T.main + 0.2, 0.6);
    g.save();
    g.globalAlpha = st.a; g.translate(0, st.dy);
    g.beginPath(); g.roundRect(STILL.x, STILL.y, STILL.w, STILL.h, STILL.r); g.clip();
    if (still) {
      const z = 1.07 - 0.05 * sine(lb / 8);                           // it settles, very slowly
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(still, STILL.x + STILL.w / 2 - (STILL.w * z) / 2, STILL.y + STILL.h / 2 - (STILL.h * z) / 2, STILL.w * z, STILL.h * z);
    } else { g.fillStyle = WHITE(0.08); g.fillRect(STILL.x, STILL.y, STILL.w, STILL.h); }
    const gl = g.createLinearGradient(STILL.x, STILL.y, STILL.x + STILL.w * 0.7, STILL.y + STILL.h);
    gl.addColorStop(0, WHITE(0.16)); gl.addColorStop(0.5, WHITE(0));
    g.fillStyle = gl; g.fillRect(STILL.x, STILL.y, STILL.w, STILL.h);
    g.restore();
    g.save(); g.globalAlpha = st.a * 0.5; g.translate(0, st.dy);
    g.strokeStyle = WHITE(0.5); g.lineWidth = 1;
    g.beginPath(); g.roundRect(STILL.x + 0.5, STILL.y + 0.5, STILL.w - 1, STILL.h - 1, STILL.r); g.stroke();
    g.restore();

    // its name, its length and format
    const a1 = arrive(lb, T.main + 0.6), a2 = arrive(lb, T.main + 0.8), a3 = arrive(lb, T.main + 1.0);
    text(g, FILE, 34, 354, { size: 44, w: 300, k: a1.a, dy: a1.dy, track: 0.4 });
    text(g, `${LENGTH}   ·   ${FORMAT}`, 34, 404, { size: 40, w: 400, a: 0.85, k: a2.a, dy: a2.dy, track: 0.6 });
    // where this very film is now
    const p = clamp(t / ctx.clock.duration);
    text(g, `${clockOf(t)} / ${LENGTH}`, 840 - 34, 404, { size: 40, w: 400, a: 0.85, k: a3.a, dy: a3.dy, align: 'right', track: 0.8 });
    g.save(); g.globalAlpha = a3.a; g.translate(0, a3.dy);
    const x0 = 34, x1 = 840 - 34, y = 436;
    g.fillStyle = WHITE(0.16); g.beginPath(); g.roundRect(x0, y - 1.5, x1 - x0, 3, 1.5); g.fill();
    const pg2 = g.createLinearGradient(x0, 0, x1, 0);
    pg2.addColorStop(0, rgb(GRAD[0], 0.95)); pg2.addColorStop(0.6, rgb(GRAD[1], 0.95)); pg2.addColorStop(1, rgb(GRAD[2], 0.95));
    g.fillStyle = pg2; g.beginPath(); g.roundRect(x0, y - 1.5, (x1 - x0) * p, 3, 1.5); g.fill();
    const kx = x0 + (x1 - x0) * p, br = 0.5 + 0.5 * Math.cos((env.ab - Math.floor(env.ab)) * TAU);
    g.shadowColor = rgb(GRAD[2], 0.9); g.shadowBlur = 10 + 8 * br;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(kx, y, 7, 0, TAU); g.fill();
    g.restore();

    // the jury's gauge
    const res = env.term.out.find((o) => o.kind === 'result'), sc = res ? scoreOf(res.text) : null;
    const tool = env.term.out.find((o) => o.kind === 'tool');
    const gA = arrive(lb, tool ? tool.at : 99, 0.8);
    if (gA.a > 0) {
      g.save(); g.globalAlpha = gA.a; g.translate(0, gA.dy);
      g.lineCap = 'round';
      g.strokeStyle = WHITE(0.13); g.lineWidth = 7;
      g.beginPath(); g.arc(GAUGE.x, GAUGE.y, GAUGE.r, 0, TAU); g.stroke();
      // while the jury looks, a short arc goes round, one turn in two beats, and is at the top exactly when the score comes
      const tS = res ? res.at : T.score, grow = sc ? sine((lb - tS) / 1.3) : 0;
      const a0 = -90 * DEG + (lb < tS ? ((lb - tS) / 2) * TAU : 0), span = lerp(64 * DEG, Math.max(64 * DEG, (sc ? sc.k : 0) * TAU), grow);
      const N = 48;
      g.shadowColor = rgb(GRAD[1], 0.8); g.shadowBlur = 16;
      for (let i = 0; i < N; i++) {
        const u0 = i / N, u1 = (i + 1.4) / N;
        g.strokeStyle = rgb(gradAt(sc ? u0 * (span / TAU) / Math.max(0.2, sc.k) : u0), 1);
        g.beginPath(); g.arc(GAUGE.x, GAUGE.y, GAUGE.r, a0 + span * u0, a0 + span * Math.min(1, u1)); g.stroke();
        if (i === 0) g.shadowBlur = 0;
      }
      g.restore();
      const lA = arrive(lb, (tool ? tool.at : 99) + 0.2);
      text(g, JURY, GAUGE.x, 345, { size: 40, w: 400, a: 0.85, k: lA.a, dy: lA.dy, align: 'center', track: 0.6 });
      if (sc) {
        const sA = arrive(lb, tS, 0.6), oA = arrive(lb, tS + 0.2, 0.6);
        text(g, sc.text, GAUGE.x, GAUGE.y + 18, { size: 78, w: 200, k: sA.a, dy: sA.dy, align: 'center', track: -1 });
        text(g, `/ ${sc.of}`, GAUGE.x, GAUGE.y + 58, { size: 40, w: 400, a: 0.85, k: oA.a, dy: oA.dy, align: 'center', track: 1 });
      }
      // three dots that breathe in turn, until the score takes their place
      const dA = arrive(lb, (tool ? tool.at : 99) + 0.4).a * (sc ? 1 - sine((lb - tS + 0.25) / 0.4) : 1);
      if (dA > 0) for (let i = 0; i < 3; i++) {
        const b = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos((env.ab - i * 0.33) * Math.PI));
        g.fillStyle = WHITE(dA * b);
        g.beginPath(); g.arc(GAUGE.x + (i - 1) * 26, GAUGE.y + 4, 5.5, 0, TAU); g.fill();
      }
    }
  }

  function leftContent(g, env) {
    const lb = env.lb, t = env.t;
    const a1 = arrive(lb, T.left + 0.45), a2 = arrive(lb, T.left + 0.65), a3 = arrive(lb, T.left + 0.9);
    text(g, 'sound', 32, 64, { size: 44, w: 400, a: 0.85, k: a1.a, dy: a1.dy, track: 0.8 });
    // the real track, as it has just been
    g.save(); g.globalAlpha = a2.a; g.translate(0, a2.dy);
    const N = 22;
    for (let i = 0; i < N; i++) {
      const tt = t - (N - 1 - i) * 0.05;
      const v = music.ready ? music.at(tt).rms : 0.3 + 0.2 * Math.sin(tt * 5 + i);
      const hh = 5 + 42 * Math.pow(clamp(v), 0.7) * (0.75 + 0.25 * Math.sin(i * 1.7 + tt * 3));
      g.fillStyle = rgb(gradAt(i / (N - 1)), 0.92);
      g.beginPath(); g.roundRect(32 + i * 12, 128 - hh, 5, hh * 2, 2.5); g.fill();
    }
    g.restore();
    if (LUFS) text(g, LUFS, 32, 210, { size: 44, w: 400, k: a3.a, dy: a3.dy, track: 0.4 });
  }

  function rightContent(g, env) {
    const lb = env.lb;
    // labels set as large as the widest lets them be beside its toggle (48 px at most: capitals of 28 px or more on screen)
    g.font = `400 44px ${SANS}`; g.letterSpacing = '0.3px';
    const fit = Math.min(48, ...OUTPUTS.map((l) => (44 * (358 - 16 - 66)) / Math.max(1, g.measureText(l).width)));
    g.letterSpacing = '0px';
    OUTPUTS.forEach((label, i) => {
      const y = 88 + i * 72, a = arrive(lb, T.right + 0.5 + i * 0.2);
      text(g, label, 66, y + fit * 0.36, { size: fit, w: 400, k: a.a, dy: a.dy, track: 0.3 });
      const on = sine((lb - T.toggles[i]) / 0.6), tx = 358, tw = 52, th = 32;
      g.save(); g.globalAlpha = a.a; g.translate(0, a.dy);
      g.fillStyle = WHITE(0.14); g.beginPath(); g.roundRect(tx, y - th / 2, tw, th, th / 2); g.fill();
      if (on > 0) {
        const tgd = g.createLinearGradient(tx, 0, tx + tw, 0);
        tgd.addColorStop(0, rgb(GRAD[0], on)); tgd.addColorStop(1, rgb(GRAD[1], on));
        g.fillStyle = tgd; g.beginPath(); g.roundRect(tx, y - th / 2, tw, th, th / 2); g.fill();
      }
      g.shadowColor = 'rgba(10,5,40,0.45)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
      g.fillStyle = '#fff'; g.beginPath(); g.arc(tx + th / 2 + (tw - th) * on, y, th / 2 - 3.5, 0, TAU); g.fill();
      g.restore();
    });
  }

  // ---- the tag, on its own small piece of glass ------------------------------------------------------------------------
  function tag(env) {
    if (!env.tag) return;
    const a = arrive(env.lb, T.tag, 0.9);
    if (a.a <= 0) return;
    const num = `${env.tag.num}/${env.tag.of}`, name = env.tag.name;
    sg.font = `500 34px ${SANS}`; sg.letterSpacing = '1px';
    const wn = sg.measureText(num).width;
    sg.font = `300 34px ${SANS}`; sg.letterSpacing = '6px';
    const ww = sg.measureText(name).width;
    sg.letterSpacing = '0px';
    const x = DOCK.left, y = 98 + a.dy, w = 30 + wn + 22 + ww + 24, h = 66;
    sg.save(); sg.globalAlpha = a.a;
    frost(sg, x, y, w, h, h / 2, scene, x, y, 1, 26);
    glaze(sg, x, y, w, h, h / 2);
    sg.textBaseline = 'alphabetic'; sg.textAlign = 'left';
    sg.font = `500 34px ${SANS}`; sg.letterSpacing = '1px'; sg.fillStyle = WHITE(0.96); sg.fillText(num, x + 30, y + 45);
    sg.font = `300 34px ${SANS}`; sg.letterSpacing = '6px'; sg.fillStyle = WHITE(0.82); sg.fillText(name, x + 30 + wn + 22, y + 45);
    sg.letterSpacing = '0px';
    sg.restore();
  }

  // ---- the aurora -------------------------------------------------------------------------------------------------------
  // A light seen through a lens. In focus it is a point; out of focus a disc with an edge (s = 0); and far enough
  // out, only a glow (s = 1). One gradient does all of it, so a highlight can become a disc and a disc the aurora.
  const DISC_U = [0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.7, 0.78, 0.84, 0.88, 0.91, 0.935, 0.955, 0.972, 0.986, 1];
  const glowAt = (u) => { const f = Math.exp(-4.6 * u * u), f1 = Math.exp(-4.6); return (f - f1) / (1 - f1); };
  const discAt = (u) => (0.7 + 0.3 * Math.exp(-(((u - 0.95) / 0.04) ** 2))) * clamp((1 - u) / 0.028);
  function light(g, x, y, rx, ry, rot, c, a, s = 1) {
    if (a <= 0.002) return;
    g.save();
    g.translate(x, y); g.rotate(rot); g.scale(rx, ry);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    for (const u of DISC_U) gr.addColorStop(u, rgb(c, a * (s >= 1 ? glowAt(u) : lerp(discAt(u), glowAt(u), s))));
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill();
    g.restore();
  }
  const blobAt = (b, t) => ({ x: b.x + b.dx * Math.sin((t / b.px) * TAU + b.ph), y: b.y + b.dy * Math.cos((t / b.py) * TAU + b.ph * 1.7), rot: 0.25 * Math.sin((t / 12) * TAU + b.ph) });

  // fine points of light adrift in front of it: sharp in the open, soft wherever glass is between them and the eye
  const R1 = rng(1433);
  const MOTES = Array.from({ length: 30 }, () => ({ x: R1() * (W + 200) - 100, y: R1() * (H + 200) - 100, z: 0.3 + R1() * 0.7, r: 0.8 + R1() * R1() * 1.8, ph: R1() * TAU, c: R1() < 0.5 ? [255, 255, 255] : R1() < 0.5 ? [170, 235, 255] : [222, 190, 255], halo: R1() < 0.5 }));
  function motes(g, t, k) {
    if (k <= 0) return;
    g.save(); g.globalCompositeOperation = 'screen';
    for (const m of MOTES) {
      const x = ((m.x + t * 16 * m.z + 100) % (W + 200) + (W + 200)) % (W + 200) - 100, y = ((m.y - t * 9 * m.z + 100) % (H + 200) + (H + 200)) % (H + 200) - 100;
      const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * (0.9 + m.z) + m.ph)), a = k * tw * (0.2 + 0.45 * m.z);
      if (m.halo) light(g, x, y, m.r * 12, m.r * 12, 0, m.c, a * 0.3);
      g.fillStyle = rgb(m.c, a);
      g.beginPath(); g.arc(x, y, m.r, 0, TAU); g.fill();
    }
    g.restore();
  }

  // ---- the picture before this shot, going out of focus ----------------------------------------------------------------
  const BL = [1, 2, 4, 8, 16].map((f) => { const pad = 40, w = Math.ceil(W / f) + 2 * pad, h = Math.ceil(H / f) + 2 * pad; const a = makeCanvas(w, h), b = makeCanvas(w, h); return { f, pad, w, h, a, ag: a.getContext('2d'), b, bg: b.getContext('2d') }; });
  /** src blurred by rho px, drawn over the whole of g. Large blurs are done small: the result is the same and it is quick. */
  function defocus(g, src, rho, sat = 1) {
    if (rho < 0.35) { g.drawImage(src, 0, 0); return; }
    const L = BL[rho < 4 ? 0 : rho < 12 ? 1 : rho < 30 ? 2 : rho < 70 ? 3 : 4], { f, pad, w, h, a, ag, b, bg } = L;
    const iw = W / f, ih = H / f;
    ag.imageSmoothingEnabled = true; ag.imageSmoothingQuality = 'high';
    ag.drawImage(src, 0, 0, W, H, 0, 0, w, h);                         // the edges carried outward, roughly, so they do not darken
    ag.drawImage(src, 0, 0, W, H, pad, pad, iw, ih);
    bg.clearRect(0, 0, w, h);
    bg.filter = `blur(${(rho / f).toFixed(2)}px) saturate(${sat.toFixed(2)})`;
    bg.drawImage(a, 0, 0);
    bg.filter = 'none';
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(b, pad, pad, iw, ih, 0, 0, W, H);
  }

  // ---- the highlights the picture before leaves behind ---------------------------------------------------------------
  const TRACK = 0.6;                                 // they are followed this long past the bar line, then taken as they lie
  const LENS_HOME = { x: 468, y: 118, r: 40, c: WARM };   // where the lens is born if no highlight is handed over
  const tint = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? hex(c) : WARM);
  /** The picture before's highlights `past` beats after its bar line: [{ x, y, r, c }], or null if it hands none over. */
  function lightsOf(env, past) {
    const o = env.otherEnv;
    if (!(env.otherImpl && env.otherImpl.handoff && o)) return null;
    const d = o.beats + past - o.lb;
    try {
      const h = env.otherImpl.handoff({ ...o, lb: o.beats + past, ab: o.ab + d, t: o.t + d * o.spb, lt: o.lt + d * o.spb, frame: Math.round((o.t + d * o.spb) * o.fps) });
      if (h && Array.isArray(h.lights)) return h.lights.filter((l) => l && isFinite(l.x) && isFinite(l.y)).slice(0, 12).map((l) => ({ x: l.x, y: l.y, r: clamp(l.r || 40, 18, 80), c: tint(l.color) }));
    } catch { /* it hands nothing over */ }
    return null;
  }
  // Which highlight becomes what is decided once, from the highlights as they lie on the bar line: the same for every
  // frame, whichever frame asks first.
  let plan = null, held = null;
  function origins(env, lb) {
    if (!plan) {
      const at0 = lightsOf(env, 0);
      if (at0 && at0.length) {
        const free = at0.map((_, i) => i);
        const take = (x, y) => {
          if (!free.length) return -1;
          let bi = 0, bd = Infinity;
          free.forEach((j, i) => { const d = Math.hypot(at0[j].x - x, at0[j].y - y); if (d < bd) { bd = d; bi = i; } });
          return free.splice(bi, 1)[0];
        };
        const blob = BLOBS.map((b) => take(b.x, b.y)), lens = take(LENS_HOME.x, LENS_HOME.y);
        plan = { at0, blob, lens, extra: free.slice() };
      }
    }
    if (!plan) return { real: false, lens: LENS_HOME, blobs: BLOBS.map((b) => ({ x: b.x, y: b.y, r: 60, c: b.c })), extra: [] };
    // where each of them is now: the picture before is still moving under this shot for a while
    let now = null;
    if (lb < TRACK) now = lightsOf(env, lb);
    else { if (!held) held = lightsOf(env, TRACK); now = held; }
    const z = 1 + 0.045 * rackAt(lb);                 // the picture grows a little as the focus moves, and they with it
    const where = (j) => {
      if (j < 0) return null;
      let l = plan.at0[j];
      if (now) { let bd = 150, hit = null; for (const q of now) { const d = Math.hypot(q.x - l.x, q.y - l.y); if (d < bd) { bd = d; hit = q; } } if (hit) l = { ...l, x: hit.x, y: hit.y }; }
      return { x: W / 2 + (l.x - W / 2) * z, y: H / 2 + (l.y - H / 2) * z, r: l.r, c: l.c };
    };
    return {
      real: true, lens: where(plan.lens) || LENS_HOME,
      blobs: plan.blob.map((j, i) => where(j) || (BLOBS[i].from === 'button' ? BUTTON : { x: BLOBS[i].x, y: BLOBS[i].y, r: 60, c: WARM })),
      extra: plan.extra.map(where),
    };
  }

  // ---- the lens's way ---------------------------------------------------------------------------------------------------
  const MAIN0 = { x: MAIN.cx - MAIN.w / 2, y: MAIN.cy - MAIN.h / 2 };
  const onMain = (x, y) => ({ x: MAIN0.x + x * MAIN.u, y: MAIN0.y + y * MAIN.u });
  function lensWay(lb, org) {
    // over the still it stays inside the still, and over the gauge clear of it: the still's edge never cuts the lens in two
    const P0 = org.lens, P1 = onMain(STILL.x + 164, STILL.y + 132), P1b = onMain(STILL.x + 272, STILL.y + 140);
    const P2 = onMain(GAUGE.x, GAUGE.y), P3 = LENS_REST;
    const leg = (A, B, u, bow) => { const e = sine(u), nx = -(B.y - A.y), ny = B.x - A.x, nl = Math.hypot(nx, ny) || 1, k = Math.sin(Math.PI * e) * bow; return { x: lerp(A.x, B.x, e) + (nx / nl) * k, y: lerp(A.y, B.y, e) + (ny / nl) * k }; };
    if (lb < T.lensOn) return leg(P0, P1, seg(lb, T.lensGlass - 0.2, T.lensOn), -26);
    if (lb < T.lensBead[0]) return leg(P1, P1b, seg(lb, T.lensOn, T.lensBead[0]), 0);
    if (lb < T.lensLeaves) return leg(P1b, P2, seg(lb, T.lensBead[0], T.lensThere), 14);
    return leg(P2, P3, seg(lb, T.lensLeaves, T.lensRest), -40);
  }
  function lensAt(env, org) {
    const lb = env.lb, t = env.t, p = lensWay(lb, org), q = lensWay(lb - 0.04, org);
    const k = sine((lb - T.lensGlass) / 1.0), grow = sine((lb - T.lensGlass + 0.1) / 1.1);   // both complete by beat 2
    // liquid: to cross from the still to the gauge it draws itself into a bead, and opens again when it is there
    const bead = sine(seg(lb, T.lensBead[0], T.lensBead[1])) * (1 - sine(seg(lb, T.lensSwell[0], T.lensSwell[1])));
    const r = lerp((org.lens.r || 40) * lerp(1, 3.3, rackAt(lb)), LENS_R, grow) * (1 - 0.72 * bead) * (1 + 0.012 * Math.sin(t * 1.7));
    const a = sine(seg(lb, 0.02, 0.22));
    // and is drawn out a little along its way while it moves
    const vx = (p.x - q.x) / 0.04, vy = (p.y - q.y) / 0.04, v = Math.hypot(vx, vy), amt = Math.min(0.05 + 0.09 * bead, v / 8000) * k;
    return { x: p.x + 3 * Math.sin(t * 0.8 + 1) * k, y: p.y + 3 * Math.cos(t * 0.7) * k, r, k, a, tint: org.lens.c || WARM, sx: v > 1 ? (vx / v) * amt : 0, sy: v > 1 ? (vy / v) * amt : 0 };
  }

  // ---- the terminal's rows ----------------------------------------------------------------------------------------------
  const cellX = (col) => DOCK.x + col * DOCK.adv + DOCK.adv / 2;
  function letter(g, ch, col, y, o = {}) {
    if (ch === ' ' || (o.a ?? 1) <= 0.004) return;
    g.font = `${o.w || 300} ${DOCK.size}px ${MONO}`;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = o.c || WHITE((o.a ?? 1) * 0.96);
    g.fillText(ch, cellX(col), y + (o.dy || 0));
  }
  /** A piece of glass for the rows: frost of whatever is on g's own canvas there. */
  function glassOn(g, x, y, w, h, r, o) {
    frost(g, x, y, w, h, r, g.canvas, x, y, 1, 28);
    glaze(g, x, y, w, h, r, o);
  }

  /**
   * The rows. o.gate(col) -> { a, dy } holds each column's letter back (the way in uses it). o.collapse (or
   * env.collapse), 0 to 1, draws the prompt's glass shrunk toward the left until it is only as wide as the prompt:
   * for a shot that takes these rows over and does not want an empty bar left behind.
   */
  function dock(g, env, part, o = {}) {
    const m = env.term, lb = env.lb;
    const gate = o.gate || (() => ONE), fold = clamp(o.collapse ?? env.collapse ?? 0);
    g.save();
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.filter = 'none';
    // row B: what Claude says, in a bubble of glass that takes each line's width
    if (part !== 'C' && m.last) {
      const l = m.last, y = DOCK.rowB;
      const cols = (o) => (o.kind === 'result' ? 5 : 2) + o.text.length;
      const prev = m.out.length > 1 ? m.out[m.out.length - 2] : null;
      const e = sine(l.age / 0.7), wOf = (o) => DOCK.x + cols(o) * DOCK.adv + 34 - BUBBLE.x;
      const w = lerp(prev ? wOf(prev) : wOf(l) - 60, wOf(l), e), aB = prev ? 1 : sine(l.age / 0.6);
      g.save(); g.globalAlpha *= aB;
      glassOn(g, BUBBLE.x, BUBBLE.y + (prev ? 0 : 8 * (1 - aB)), w, BUBBLE.h, BUBBLE.r, { tint: 'rgba(170,150,255,0.10)' });
      g.restore();
      const line = (o, a) => {
        if (a.a <= 0.004) return;
        if (o.kind === 'result') {
          g.save(); g.globalAlpha *= a.a * 0.6;
          g.strokeStyle = '#fff'; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
          const ex = cellX(2), ey = y + a.dy;
          g.beginPath(); g.moveTo(ex - 6, ey - 40); g.lineTo(ex - 6, ey - 12); g.quadraticCurveTo(ex - 6, ey - 4, ex + 2, ey - 4); g.lineTo(ex + 18, ey - 4); g.stroke();
          g.restore();
          for (let i = 0; i < o.text.length; i++) letter(g, o.text[i], 5 + i, y, { a: a.a, dy: a.dy, w: 300 });
        } else {
          // the bullet: a small light. Dim while a tool runs, lit when it is done
          const done = o.kind !== 'tool' || o.age >= 0.35, lit = o.kind === 'tool' ? sine((o.age - 0.35) / 0.5) : 1;
          const bx = cellX(0), by = y - 19 + a.dy, col = mixRGB([200, 200, 230], GRAD[0], lit);
          g.save(); g.globalAlpha *= a.a;
          light(g, bx, by, 26, 26, 0, col, 0.35 * lit);
          g.fillStyle = rgb(col, done ? 1 : 0.6); g.beginPath(); g.arc(bx, by, 9, 0, TAU); g.fill();
          g.restore();
          const n = o.kind === 'say' ? o.chars : o.text.length, k = o.kind === 'tool' ? Math.max(0, o.text.indexOf('(')) : 0;
          for (let i = 0; i < n; i++) letter(g, o.text[i], 2 + i, y, { a: a.a, dy: a.dy, w: i < k ? 500 : 300 });
        }
      };
      // the line before leaves upward as the new one rises into its place
      if (prev) { const out = 1 - sine(l.age / 0.3); line(prev, { a: out, dy: -8 * (1 - out) }); }
      line(l, arrive(l.age, prev ? 0.2 : 0.1, 0.6));
    }
    if (part === 'B') { g.restore(); return; }

    // row C: the prompt, in its field of glass
    const c = m.rowC, y = DOCK.rowC, ty = m.typing;
    const fw = fold > 0 ? lerp(FIELD.w, Math.min(FIELD.w, cellX(2 + Math.max(1, c.n)) + 46 - FIELD.x), 1 - Math.cos((fold * Math.PI) / 2)) : FIELD.w;
    glassOn(g, FIELD.x, FIELD.y, fw, FIELD.h, FIELD.r, { tint: 'rgba(255,255,255,0.065)', sheen: 0.5 + 0.5 * Math.sin(env.t * 0.5) });
    const g0 = gate(0);
    letter(g, '>', 0, y, { c: rgb(mixRGB(GRAD[0], [255, 255, 255], 0.35), 0.9 * g0.a), a: g0.a, dy: g0.dy, w: 400 });
    // a sent prompt leaves by itself a little before the row is cleared for the next one
    const leave = c.mode === 'cmd' && ty ? sine(((ty.start - (script.T.clear ?? 1)) - lb) / 0.45) : 1;
    for (let i = 0; i < c.n; i++) {
      const age = c.keyAge(i), a = c.mode === 'typing' ? arrive(age, 0, 0.3) : ONE, q = gate(2 + i);
      letter(g, c.text[i], 2 + i, y, { a: a.a * q.a * (c.mode === 'cmd' ? 0.9 * leave : 1), dy: a.dy + q.dy - 8 * (1 - leave), w: 300 });
    }
    if (c.cursor) {
      // the cursor: a soft caret of light that breathes on the beat, and stays lit while letters come
      const ph = m.ab - Math.floor(m.ab), busy = c.n > 0 && c.keyAge(c.n - 1) < 0.75;
      const br = busy ? 1 : 0.34 + 0.66 * (0.5 + 0.5 * Math.cos(ph * TAU));
      const inA = ty && c.n === 0 ? sine((lb - (ty.start - (script.T.clear ?? 1))) / 0.5) : 1;
      // it glides to its next cell instead of jumping
      const last = c.n > 0 ? c.keyAge(c.n - 1) : Infinity, slide = c.n > 0 ? 1 - sine(last / 0.2) : 0;
      const cx = cellX(2 + c.n) - 11 - slide * DOCK.adv, cy = y - 22;
      g.save(); g.globalAlpha *= inA;
      light(g, cx, cy, 58, 70, 0, GRAD[0], 0.30 * br);
      g.shadowColor = rgb(GRAD[0], 0.95); g.shadowBlur = 22 * br + 4;
      g.fillStyle = WHITE(0.5 + 0.5 * br);
      g.beginPath(); g.roundRect(cx - 3.5, cy - 33, 7, 66, 3.5); g.fill();
      g.restore();
    }
    g.restore();
  }

  // ---- the frame --------------------------------------------------------------------------------------------------------
  function render(g, env) {
    const lb = Math.max(0, env.lb), t = env.t;
    const e = lb === env.lb ? env : { ...env, lb };
    const handing = !!(env.other && env.role === 'in');
    const x = handing ? clamp(env.x) : 1;
    const org = origins(env, lb);
    const rack = handing ? rackAt(lb) : 1;

    // 1 the ground
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalAlpha = 1; sg.globalCompositeOperation = 'source-over'; sg.filter = 'none';
    const bgd = sg.createLinearGradient(0, 0, W, H);
    bgd.addColorStop(0, BASE[0]); bgd.addColorStop(1, BASE[1]);
    sg.fillStyle = bgd; sg.fillRect(0, 0, W, H);

    // 2 the picture before: the focus is pulled off it, slowly at first so that what it is doing can be seen, and its
    //   light goes down. A lens breathes as its focus moves: the picture grows by a few per cent.
    const softA = handing ? 1 - smooth(seg(lb, 0.55, 1.75)) : 0;
    if (softA > 0) {
      const rho = 150 * Math.pow(smooth(seg(lb, 0.12, 1.5)), 1.6), d = sine(seg(lb, 0.05, 1.05)), z = 1 + 0.045 * rack;
      dg.setTransform(1, 0, 0, 1, 0, 0); dg.globalAlpha = 1; dg.globalCompositeOperation = 'source-over';
      defocus(dg, env.other, rho, 1 + 0.8 * d);
      if (d > 0) { dg.globalCompositeOperation = 'multiply'; dg.fillStyle = rgb(mixRGB([255, 255, 255], DIM, d)); dg.fillRect(0, 0, W, H); dg.globalCompositeOperation = 'source-over'; }
      sg.save(); sg.globalAlpha = softA;
      sg.translate(W / 2, H / 2); sg.scale(z, z);
      sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = 'high';
      sg.drawImage(dimC, -W / 2, -H / 2);
      sg.restore();
    }

    // 3 the lights. Out of focus, each highlight of the picture before opens into a disc with an edge. Then the discs
    //   lose their edges, cool and drift apart, and are the aurora: every one of its lights was one of those highlights.
    sg.save(); sg.globalCompositeOperation = 'screen';
    if (handing && org.real) {
      const appear = sine(seg(lb, 0.02, 0.22)), melt = smooth(seg(lb, T.melt[0], T.melt[1])), edge = smooth(seg(lb, 0.85, 1.7));
      for (const l of org.extra) { const r = l.r * lerp(1, 3.3, rack); light(sg, l.x, l.y, r, r, 0, mixRGB(l.c, PINK, 0.5 * edge), 0.4 * appear * (1 - smooth(seg(lb, 0.9, 1.6))), 0.6 * edge); }
      BLOBS.forEach((b, i) => {
        const to = blobAt(b, t), l = org.blobs[i], r0 = l.r * lerp(1, 3.3, rack), sw = smoother(melt);
        const mv = smoother(seg(lb, 0.7, 2.0)), hue = smooth(seg(lb, 0.45, 1.9));
        const c = hue < 0.5 ? mixRGB(l.c || WARM, PINK, hue * 2) : mixRGB(PINK, b.c, hue * 2 - 1);
        const breathe = 1 + 0.035 * Math.sin((t / 5.5) * TAU + b.ph);
        light(sg, lerp(l.x, to.x, mv), lerp(l.y, to.y, mv), lerp(r0, b.rx * breathe, sw), lerp(r0, b.ry * breathe, sw), to.rot * melt, c, lerp(0.42, b.a, melt) * appear, edge);
      });
    } else {
      // seen alone, or after a shot that hands no highlights over: the aurora is simply there, or simply comes up
      const up = handing ? smooth(seg(lb, 0.1, 1.4)) : 1;
      BLOBS.forEach((b) => {
        const to = blobAt(b, t), breathe = 1 + 0.035 * Math.sin((t / 5.5) * TAU + b.ph);
        light(sg, to.x, to.y, b.rx * breathe, b.ry * breathe, to.rot, b.c, b.a * up);
      });
    }
    sg.restore();
    motes(sg, t, (handing ? smooth(seg(lb, 0.9, 2)) : 1) * sine(lb / 2));

    // 4 glass, back to front; each piece frosts what is behind it at this instant
    card(LEFT, poseLeft(lb, t), (cgx) => leftContent(cgx, e), t);
    card(RIGHT, poseRight(lb, t), (cgx) => rightContent(cgx, e), t);
    card(MAIN, poseMain(lb, t), (cgx) => mainContent(cgx, e), t);
    tag(e);

    // 5 through the lens, and grain over everything
    const L = lensAt(e, org);
    const R = useGL();
    lensPass.draw(R, { x: L.x, y: L.y, r: L.a > 0 ? L.r : 0, k: L.k, a: L.a, tint: L.tint, sx: L.sx, sy: L.sy, seed: Math.floor(env.frame / 2) % 4096, grain: 0.028 * smooth(seg(x, 0, 0.4)), vig: 0.3 * smooth(seg(x, 0, 0.9)) });
    blitGL(g, R);

    // 6 the rows
    if (env.noDock) return;
    const od = handing && env.otherImpl && env.otherImpl.dock;
    if (!od || lb >= T.rowsOut[1] + ROW_IN + 0.02) { dock(g, e); return; }
    // The rows change hands one skin at a time, so the prompt is never in two faces at once. The rows as they were are
    // wiped away from the left under a short soft edge, a column at a time, and each of this shot's letters rises into
    // its column the moment the edge has cleared it: a letter is never gone for more than about two frames.
    const FE = 60, wipeAt = (x) => lerp(T.rowsOut[0], T.rowsOut[1], (x - (DOCK.left - FE)) / (DOCK.right - DOCK.left + 2 * FE));
    const gate = (col) => arrive(lb, wipeAt(cellX(col) + DOCK.adv / 2 + FE), ROW_IN);
    const p = seg(lb, T.rowsOut[0], T.rowsOut[1]);
    if (p >= 1) { dock(g, e, null, { gate }); return; }
    const sx = lerp(DOCK.left - FE, DOCK.right + FE, p);
    const keepRight = (c2) => {
      const mg = c2.createLinearGradient(sx - FE, 0, sx + FE, 0);
      mg.addColorStop(0, 'rgba(0,0,0,0)'); mg.addColorStop(1, '#000');
      c2.save(); c2.setTransform(1, 0, 0, 1, 0, 0); c2.globalCompositeOperation = 'destination-in'; c2.fillStyle = mg; c2.fillRect(0, 0, W, ROWS_H); c2.restore();
    };
    lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, W, ROWS_H);
    lg.drawImage(g.canvas, 0, ROWS_Y, W, ROWS_H, 0, 0, W, ROWS_H);
    dock(g, e, null, { gate });
    keepRight(lg);
    g.drawImage(lay, 0, ROWS_Y);                      // ahead of the edge the picture is as it was
    og.setTransform(1, 0, 0, 1, 0, 0); og.globalCompositeOperation = 'source-over'; og.globalAlpha = 1; og.clearRect(0, 0, W, ROWS_H);
    og.save(); og.translate(0, -ROWS_Y);
    try { env.otherImpl.dock(og, env.otherEnv); } catch { /* nothing to carry over */ }
    og.restore();
    keepRight(og);
    g.drawImage(old, 0, ROWS_Y);                      // with its rows on it
  }

  // the first frame through a new shader can come out black: draw two before the film asks for any
  {
    const env0 = { lb: 6, t: shot.t0 + 3, ab: shot.b0 + 6, frame: 0, spb: 60 / (cues.bpm || 120), term: { out: [], last: null, rowC: { mode: 'idle', text: '', n: 0, cursor: false, keyAge: () => Infinity }, typing: null, blink: true, ab: 0 }, tag: ctx.tag, noDock: true };
    const warm = makeCanvas(), wg = warm.getContext('2d');
    for (let i = 0; i < 2; i++) { render(wg, env0); useGL().getContext().finish(); await new Promise((r) => setTimeout(r, 30)); }
  }

  return {
    render,
    dock,
    /** For the shot that follows: the main card's box (and where the lens and the prompt's glass are). */
    handoff(env) {
      const lb = Math.max(0, env.lb), P = poseMain(lb, env.t), L = lensAt({ ...env, lb }, origins(env, lb));
      return {
        card: { x: P.x - (MAIN.w * P.s) / 2, y: P.y - (MAIN.h * P.s) / 2, w: MAIN.w * P.s, h: MAIN.h * P.s, r: MAIN.r * P.s },
        lens: { x: L.x, y: L.y, r: L.r },
        field: { ...FIELD },
      };
    },
    sfx: [
      { b: 0, s: 'aurora_exhale', g: 0.6 },                 // the lights go down: one long soft breath out
      { b: T.lensOn - 0.1, s: 'aurora_glass', g: 0.4 },     // the lens is glass
      { b: T.toggles[0], s: 'aurora_tick', g: 0.25 },
      { b: T.toggles[1], s: 'aurora_tick', g: 0.25 },
      { b: T.toggles[2], s: 'aurora_tick', g: 0.25 },
      { b: T.score, s: 'aurora_score', g: 0.6, a: 'peak' }, // the score arrives
    ],
  };
}
