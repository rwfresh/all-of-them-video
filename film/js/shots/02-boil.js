// 02/15 Frame-by-Frame / Line Boil. "sketch it first.": an opaque sheet of animation paper slides in from above over
// the gold line (see-through only at its leading edge) and lands on the bar line with Enter; on the light table the
// line is seen through it, grey, and the cursor it passes over is a matchstick on the paper. From the next frame the
// same drawing is traced by hand, and again on a new sheet slapped down on every
// half-beat, rougher every time, until it is wobbling ink. A fresh sheet: three storyboard frames are sketched in on
// beats 2, 3 and 4 (a rough in red pencil first, then ink): thumbnails of this film's own hardest shots. Then the
// cursor, a matchstick, leaves the prompt row and is struck across the page above them (a smear frame); a flame spirit
// jumps out and hops frame to frame on beats 6, 7 and 8, and each still starts to move, in colour, as the flame lands
// on it. The burnt match goes home and sweeps the old prompt off the row. On beat 10 the flame leaps to the middle
// frame and bursts into cel effects; it holds there, arms up. In the last half-beat the drawing gets ready for
// Bauhaus: the smoke and sparkles are gone, the flame gathers itself into a crouch, and over the last eight frames the
// boil stops, the lines relax straight and the colour slides into register (see calmAt, and handoff).
//
// Time is drawn in steps, as a hand would: on twos (6 drawings a beat, about 12 a second), on ones for the fast
// actions, on threes for the last hold. What exists at an instant is exact (a typed letter appears on its key); how it
// is drawn changes only with the drawing number. Every line is redrawn with a small error each drawing: the boil.

import { DOCK, swapDock, cursorRect } from '../term.js';
import { clamp, smooth, ease } from '../util.js';
import { ink, fill, path, ring, smoothPath, xf, xmul, hash, setCalm, calm, INK, RED, YEL, PAPER, GREY } from './boil/ink.js';
import { letter } from './boil/letters.js';
import { PW, PH, SKETCH, frame, travel } from './boil/panels.js';
import { makeActors } from './boil/actors.js';

// the timeline, in local beats
const T = {
  sheets: [0, 0.5, 1, 1.5], board: 2,                    // a sheet of paper lands (the first slides in); the storyboard sheet
  panel: [2, 3, 4], sketch: 0.82,                        // each frame is sketched in, and how long the pen takes
  go: 4 + 1 / 3, jump: 4.5, smear: 4 + 5 / 6, strike: 5, // the match: crouch, leap, the swipe (one drawing, two frames: set in make), fire
  leap: 5.5, land: [6, 7, 8],                            // the flame leaves the match; lands on each frame
  hop: 6 + 1 / 6, back: 6 + 5 / 6, zip0: 7.5, zip1: 7.75, // the match hops back to the row; it sweeps the old prompt away
  burst0: 9.5, burst: 10, hold: 10 + 5 / 6,              // the last leap, the burst, the hold (on threes)
};

const PANELS = [
  { cx: 386, cy: 500, rot: -0.03 },
  { cx: 960, cy: 486, rot: 0.02 },
  { cx: 1534, cy: 498, rot: -0.016 },
];
const SHEET_A = [0.4, 0.55, 0.62, 0.72];                  // how much each sheet hides of what is under it
const SLIDE = 1 / 3;                                     // the first sheet's slide in, in beats (about ten frames)
const TRACE = [
  { w: 2.8, rough: 1.0, boil: 0.5 },
  { w: 3.8, rough: 2.6, boil: 0.9 },
  { w: 5.2, rough: 4.6, boil: 1.3 },
  { w: 7.2, rough: 7.5, boil: 1.9 },
];

export default async function make(ctx) {
  const { W, H, cues, util } = ctx;
  // the old prompt leaves the row one beat before the next is typed (term.js); the match's sweep ends exactly then
  const S = ctx.script.shots[ctx.shot.name];
  if (S && S.next) { T.zip1 = S.next.keys[0] - S.b0 - ctx.script.T.clear; T.zip0 = T.zip1 - 0.25; }
  const F = 1 / (ctx.fps * ctx.clock.spb), END = ctx.shot.beats;       // one frame, in beats; the shot's last beat
  T.smear = T.strike - 2 * F;
  // The first sheet lands on the bar line if the cue sheet lets this shot paint before it (enter.pre of 0.35 or more);
  // with less, the slide starts as early as it may and the sheet lands that much after the bar line.
  const PRE = (ctx.shot.enter && ctx.shot.enter.pre) || 0, LAND = PRE >= SLIDE - 1e-6 ? 0 : SLIDE - PRE;
  T.sheets = [LAND, ...[0.5, 1, 1.5].filter((b) => b >= LAND + 0.5 - 1e-6)];
  const LEVEL = T.sheets.length === 4 ? [0, 1, 2, 3] : [0, 2, 3].slice(0, T.sheets.length);   // which tracing each sheet carries
  // The last eight frames: the hand goes out of the line (see ink.js setCalm) and everything that moved stands still.
  const CALM0 = END - 8 * F;
  const calmAt = (lb) => (lb <= CALM0 ? 1 : lb >= END ? 0 : 1 - smooth((lb - CALM0) / (END - CALM0)));

  // ---- drawing numbers ----
  const twos = (lb) => Math.floor(lb * 6 + 1e-6);
  /** The boil's drawing number at lb: on twos, on threes in the last hold. Four drawings, cycled. */
  const drawing = (lb) => { lb = Math.min(lb, CALM0); return (lb >= T.hold ? Math.floor(lb * 4 + 1e-6) : twos(lb)) & 3; };

  // ---- paper: one sheet, made once ----
  const paper = (() => {
    const c = ctx.makeCanvas(W, H), g = c.getContext('2d'), R = util.rng(20251);
    g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = R() * W, y = R() * H, r = 160 + R() * 380, dark = R() < 0.5, a = 0.03 + R() * 0.035;
      const gr = g.createRadialGradient(x, y, 0, x, y, r), col = dark ? '204,186,150' : '255,253,244';
      gr.addColorStop(0, `rgba(${col},${dark ? a : a * 1.5})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    g.lineCap = 'round';
    for (let i = 0; i < 4600; i++) {
      const x = R() * W, y = R() * H, a = R() * Math.PI * 2, l = 6 + R() * 36, b = (R() - 0.5) * 0.9;
      g.strokeStyle = R() < 0.55 ? `rgba(118,94,60,${0.04 + R() * 0.07})` : `rgba(255,255,250,${0.12 + R() * 0.2})`;
      g.lineWidth = 0.6 + R() * 0.9;
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a + b) * l * 0.5, y + Math.sin(a + b) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    return c;
  })();
  // grain that sits over everything (multiplied), and the paper's tooth showing through the ink
  const TILE = 512;
  const [grain, tooth] = (() => {
    const R = util.rng(977), mk = () => { const c = ctx.makeCanvas(TILE, TILE); return [c, c.getContext('2d')]; };
    const [c1, g1] = mk(), [c2, g2] = mk();
    const d1 = g1.createImageData(TILE, TILE), d2 = g2.createImageData(TILE, TILE);
    for (let i = 0; i < TILE * TILE; i++) {
      const r = R(), v = 255 - Math.pow(r, 2.6) * 58;
      d1.data[i * 4] = v; d1.data[i * 4 + 1] = v - 1; d1.data[i * 4 + 2] = v - 3; d1.data[i * 4 + 3] = 255;
      const q = R();
      d2.data[i * 4] = 244; d2.data[i * 4 + 1] = 236; d2.data[i * 4 + 2] = 220; d2.data[i * 4 + 3] = q > 0.9 ? 30 + (q - 0.9) * 900 : 0;
    }
    g1.putImageData(d1, 0, 0); g2.putImageData(d2, 0, 0);
    return [c1, c2];
  })();
  function texture(g, n) {
    const ox = Math.floor(hash(n * 1.37 + 3) * TILE), oy = Math.floor(hash(n * 2.11 + 7) * TILE);
    g.save();
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5;
    for (let y = -oy; y < H; y += TILE) for (let x = -ox; x < W; x += TILE) g.drawImage(grain, x, y);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.55;
    for (let y = -oy; y < H; y += TILE) for (let x = -ox; x < W; x += TILE) g.drawImage(tooth, x, y);
    g.restore();
  }
  /** The peg holes punched in every sheet of animation paper: along its bottom edge, which leads when a sheet slides in. */
  function pegs(g) {
    const y = H - 32;
    g.fillStyle = '#2A2521';
    g.beginPath(); g.arc(960, y, 13, 0, Math.PI * 2); g.fill();
    for (const x of [520, 1400]) { g.beginPath(); g.roundRect(x - 25, y - 7, 50, 14, 7); g.fill(); }
    g.strokeStyle = 'rgba(255,252,240,0.5)'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(960, y, 13.5, 0.2, 1.9); g.stroke();
    for (const x of [520, 1400]) { g.beginPath(); g.moveTo(x - 18, y + 7.5); g.lineTo(x + 20, y + 7.5); g.stroke(); }
  }
  /** The shadow a sheet throws while it lies askew: only what shows past its own edge. */
  function shadow(g) {
    g.fillStyle = 'rgba(40,30,16,0.3)';
    g.beginPath(); g.rect(-46, -46, W + 120, H + 124); g.rect(-60, -60, W + 120, H + 120); g.fill('evenodd');
  }

  // ---- the drawing we inherit: the Line Art shot's curve, to be traced by hand ----
  let GEO = null;
  try { GEO = (await (await import('./01-line.js')).default(ctx)).geometry; } catch { /* without it the sheets are blank */ }
  const TR = GEO && (() => {
    const C = GEO.curve, M = C.marks;
    const pts = (a, b) => { const o = []; for (let s = a; s < b; s += 6) o.push(C.at(s)); o.push(C.at(b)); return o; };
    const cuts = [[46, M.hook + 5], [M.hook - 3, M.mid + 12], [M.mid - 10, M.loop0 + 5], [M.loop1 - 5, M.dip + 14], [M.dip - 10, C.len]];
    const S = GEO.sun;
    return {
      strokes: cuts.map(([a, b]) => path(pts(a, b), 6)),
      sun: ring(S.x, S.y, S.r, S.r, Math.PI / 2, 0.3, 5),
      play: path([[S.x - 16, S.y - 29], [S.x + 34, S.y], [S.x - 16, S.y + 29], [S.x - 16, S.y - 29]], 4),
      labels: GEO.labels.map(([word, x, y, align]) => { const w = word.length * 38; return [word, align === 'c' ? x - w / 2 : align === 'r' ? x - w + 7 : x, y]; }),
    };
  })();
  /** Tracing k of the inherited drawing; f (0 to 1) is how far along it the pen has got. */
  function tracing(g, k, v, alpha = 1, f = 1) {
    if (!TR) return;
    const s = TRACE[k], n = TR.strokes.length;
    g.save(); g.globalAlpha *= alpha;
    if (f * n >= 3) {
      if (k >= 2) fill(g, TR.sun, { color: YEL, seed: 60 + k, v, rough: s.rough * 0.5, dx: 6, dy: 5 });
      ink(g, TR.sun, { w: s.w, seed: 61 + k * 7, v, rough: s.rough * 0.5, boil: s.boil, taper: 20 });
      if (k >= 2) fill(g, TR.play, { color: INK, seed: 62 + k, v, rough: s.rough * 0.4, boil: s.boil });
      else ink(g, TR.play, { w: s.w, seed: 63 + k, v, rough: s.rough * 0.4, boil: s.boil });
    }
    TR.strokes.forEach((P, i) => {
      const to = clamp(f * n - i);
      if (to <= 0) return;
      ink(g, P, { w: s.w, seed: 70 + k * 13 + i, v, rough: s.rough, boil: s.boil, taper: 26, press: 0.25, to });
      if (k === 3) ink(g, P, { w: 2.6, seed: 170 + i, v, rough: s.rough * 1.5, boil: s.boil, taper: 30, dry: 0.3, from: 0.04, to: to * 0.93 });
    });
    if (k >= 1) TR.labels.forEach(([word, x, y], i) => { if (f >= [0.2, 0.45, 0.62, 0.8, 0.96][i]) letter(g, word, x, y, { u: 2.6, adv: 38, wide: 1.1, w: [0, 3, 4.2, 5.4][k], v, seed: 80 + k * 9 + i, wob: 0.6 + 0.4 * k }); });
    g.restore();
  }
  /** The Line Art poster as it stood, for when this shot is looked at on its own. */
  function standIn(g) {
    g.fillStyle = '#0B1320'; g.fillRect(0, 0, W, H);
    if (!GEO) return;
    const C = GEO.curve, S = GEO.sun;
    g.strokeStyle = '#E9D7A5'; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    for (let s = 40; s <= C.len; s += 6) { const p = C.at(s); if (s === 40) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); }
    g.stroke();
    g.fillStyle = '#E9D7A5'; g.beginPath(); g.arc(S.x, S.y, S.r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0B1320'; g.beginPath(); g.moveTo(S.x - 16, S.y - 29); g.lineTo(S.x + 34, S.y); g.lineTo(S.x - 16, S.y + 29); g.closePath(); g.fill();
  }

  // The picture this shot arrives over (the shot before, with its prompt rows), painted afresh for every frame that
  // needs it: seen through the first sheet, and then, once the light table is on, as grey lines through the paper.
  const under = ctx.makeCanvas(W, H), ug = under.getContext('2d');
  const sheet = ctx.makeCanvas(W, H), sg = sheet.getContext('2d');    // the first sheet while it slides in
  const EXT = 130, BAND = 120;          // the sliding sheet runs EXT px past the frame's bottom; its last BAND px are see-through
  function paintUnder(env, rowB, fromX = 0) {
    ug.setTransform(1, 0, 0, 1, 0, 0); ug.globalAlpha = 1; ug.globalCompositeOperation = 'source-over'; ug.filter = 'none';
    if (env.other) ug.drawImage(env.other, 0, 0); else standIn(ug);
    const od = env.other && env.otherImpl && env.otherImpl.dock;
    if (!od) return;
    if (rowB) { ug.save(); od(ug, env.otherEnv, 'B'); ug.restore(); }
    // its prompt row, but only the columns this shot has not yet rewritten in its own hand
    ug.save(); ug.beginPath(); ug.rect(fromX, DOCK.rowC - 96, W - fromX, 170); ug.clip(); od(ug, env.otherEnv, 'C'); ug.restore();
  }
  /** The picture underneath as the light table shows it: its light lines dark, its dark ground gone. */
  function through(g, a, clip) {
    g.save();
    if (clip) { g.beginPath(); g.rect(...clip); g.clip(); }
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = a; g.filter = 'invert(1) grayscale(1) contrast(1.2)';
    g.drawImage(under, 0, 0);
    g.restore();
  }

  // ---- the storyboard ----
  const STILL = SKETCH.map((fn, i) => { const items = [...frame(500 + i * 40), ...fn(0, false)]; return { items, len: travel(items) }; });
  const CAPTION = ['iso', 'synth', 'variety'].map((name) => { const s = cues.shots.find((x) => x.name === name); return s ? `${String(s.num).padStart(2, '0')} ${s.style}` : ''; });
  const panelTf = (p) => xf(p.cx, p.cy, p.rot);

  /** Draw a list of sketch items through transform tf; `upto` is how far the pen has travelled (px), colour only when alive. */
  function drawItems(g, items, tf, v, o = {}) {
    const upto = o.upto ?? Infinity, sd = o.seed || 0;
    for (const it of items) {
      if (it.s0 !== undefined && it.s0 >= upto) break;
      if (it.k === 'mask') fill(g, it.P, { color: PAPER, seed: 1, boil: 0, tf });
      else if (it.k === 'fill') {
        if (!o.colour) continue;
        g.save(); g.globalCompositeOperation = 'multiply';
        fill(g, it.P, { color: it.color, seed: it.seed + sd, v, boil: 1.8, tf, dx: o.reg ?? 6, dy: (o.reg ?? 6) * 0.8, alpha: it.alpha });
        g.restore();
      } else if (it.k === 'ink') {
        const to = it.s1 > upto ? (upto - it.s0) / (it.s1 - it.s0) : 1;
        ink(g, it.P, { w: it.w * (o.fat || 1), seed: it.seed + sd, v, rough: it.rough || 0, boil: (it.boil ?? 1.15) * (o.shake || 1), taper: it.taper ?? 12, tf, to, color: it.red ? RED : INK, alpha: it.under ? (o.colour ? 0.3 : 0.55) : it.red ? 0.86 : 1, dry: it.under ? 0.34 : it.red ? 0.16 : 0, press: 0.18 });
      } else if (it.k === 'text') {
        const to = it.s1 > upto ? (upto - it.s0) / (it.s1 - it.s0) : 1;
        const u = it.u * (it.pulse || 1), adv = (it.adv || it.u * 11.25) * (it.pulse || 1), x0 = it.x - (it.s.length * adv) / 2;
        const m = it.rot ? xmul(tf, xmul(xf(it.x, it.y, it.rot), xf(-it.x, -it.y))) : tf;
        const opt = { u, adv, heavy: it.heavy, slant: it.slant, v, seed: it.seed + sd, xf: m, drawn: to < 1 ? (i) => clamp(to * it.s.length - i) : null };
        if (it.shadow && o.colour && calm() > 0.02) letter(g, it.s, x0 + 5 * calm(), it.y + 5 * calm(), { ...opt, color: it.shadow });
        letter(g, it.s, x0, it.y, opt);
      }
    }
  }

  // ---- the cast: the match and the flame, and the effects they throw off ----
  const cast = makeActors({ T, PANELS, PH, DOCK, twos, cmdLen: (ctx.shot.prompt || '').length, F, END });

  // ---- the terminal's two rows, lettered by hand ----
  const ROW = { u: 3.2, w: 5.6 };
  function dock(g, env, part, noMatch = false) {
    const m = env.term, lb = env.lb, v = drawing(lb);
    setCalm(calmAt(lb));
    if (part !== 'C' && m.last) {
      const o = m.last, x = DOCK.x, y = DOCK.rowB, wr = clamp(o.age / 0.55);
      if (o.kind === 'result') {
        ink(g, path([[x + 2 * DOCK.adv + 18, y - 46], [x + 2 * DOCK.adv + 18, y - 9], [x + 2 * DOCK.adv + 48, y - 9]], 4), { w: 4.6, seed: 31, v, color: GREY, taper: 6, to: clamp(o.age / 0.2) });
        letter(g, o.text, x + 5 * DOCK.adv, y, { ...ROW, v, seed: 32, color: GREY, drawn: (i) => clamp(wr * o.text.length - i) });
      } else {
        const cx = x + 18, cy = y - 19, done = o.kind !== 'tool' || o.age >= 0.35;
        const dot = ring(cx, cy, 11, 11, -2.2, 0.5, 3);
        if (done) fill(g, dot, { color: o.kind === 'tool' ? RED : INK, seed: 33, v, boil: 1, dx: o.kind === 'tool' ? 3 : 0, dy: o.kind === 'tool' ? 2 : 0 });
        ink(g, dot, { w: 4, seed: 34, v, boil: 0.9, taper: 6 });
        const shown = o.kind === 'say' ? o.text.slice(0, o.chars) : o.text, k = o.kind === 'tool' ? o.text.indexOf('(') : 0;
        const drawn = o.kind === 'say' ? null : (i) => clamp(wr * shown.length - i);
        if (k > 0) {
          letter(g, shown.slice(0, k), x + 2 * DOCK.adv, y, { ...ROW, v, seed: 35, heavy: true, drawn });
          letter(g, shown.slice(k), x + (2 + k) * DOCK.adv, y, { ...ROW, v, seed: 36, drawn: (i) => clamp(wr * shown.length - i - k) });
        } else letter(g, shown, x + 2 * DOCK.adv, y, { ...ROW, v, seed: 35, drawn });
      }
    }
    if (part === 'B') return;
    const c = m.rowC, x = DOCK.x, y = DOCK.rowC, tx = x + 2 * DOCK.adv;
    letter(g, '>', x, y, { ...ROW, v, seed: 40, color: GREY });
    const home = cast.matchHome(env);                    // the column the match stands in, or null while it is away
    if (c.mode === 'cmd') {
      // the match sweeps the old prompt off the row, right to left
      const left = cast.swept(lb, c.text.length);
      letter(g, c.text, tx, y, { ...ROW, v, seed: 41, n: left });
    } else {
      const q = (i) => Math.floor(c.keyAge(i) * 12 + 1e-6);          // drawings (on ones) since the key was struck
      letter(g, c.text, tx, y, { ...ROW, v, seed: 42, n: c.n, pop: (i) => [1.3, 1.14, 1.05][q(i)] || 1 });
    }
    if (home && !noMatch) cast.matchAtHome(g, home, env, v);
  }

  // ---- the frame ----
  function render(g, env) {
    const lb = env.lb, L = Math.max(0, lb), v = drawing(L), n2 = twos(L);
    const grainAt = Math.min(lb, CALM0), grain = grainAt >= T.hold ? Math.floor(grainAt * 4) : twos(Math.max(0, grainAt));
    setCalm(calmAt(lb));

    // ---- the first sheet slides in over the picture before: from above, turning square as it comes ----
    // It is an opaque sheet, the same paper as the landed one; only its leading edge (the last BAND px) lets the picture
    // under it through, so the gold line is a pencil ghost there. Behind the edge the light table already shows the
    // drawing as grey lines, exactly as on the landed sheet, and the cursor is the match: the sheet changes it as it passes.
    if (lb < LAND) {
      paintUnder(env, true);
      g.drawImage(under, 0, 0);
      const u = clamp((lb - (LAND - SLIDE)) / SLIDE), e = u + 0.18 * u * (1 - u);    // nearly even: it covers the frame at a steady rate
      if (u > 0) {
        const oy = -(H + EXT + 10) * (1 - e), rot = -0.026 * (1 - e);
        const place = (c) => { c.translate(W / 2, H / 2 + oy); c.rotate(rot); c.translate(-W / 2, -H / 2); };
        // its shadow runs ahead of its leading edge, on the picture it is about to cover
        g.save(); place(g);
        const sh = g.createLinearGradient(0, H + EXT, 0, H + EXT + 56);
        sh.addColorStop(0, 'rgba(0,2,8,0.55)'); sh.addColorStop(1, 'rgba(0,2,8,0)');
        g.fillStyle = sh; g.fillRect(-80, H + EXT, W + 160, 56);
        g.restore();
        // the sheet, painted whole on its own canvas, then cut to its shape
        sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalAlpha = 1; sg.globalCompositeOperation = 'source-over'; sg.filter = 'none';
        sg.clearRect(0, 0, W, H);
        sg.save(); place(sg);
        sg.fillStyle = PAPER; sg.fillRect(-80, -80, W + 160, H + EXT + 80);
        sg.drawImage(paper, 0, 0);
        sg.drawImage(paper, 0, H - EXT, W, EXT, 0, H, W, EXT);                    // the paper past the frame's bottom
        sg.restore();
        // the light table: the drawing under it, fixed on screen; not the old cursor, which on the paper is the match
        const home = cast.matchHome(env), V0 = drawing(0);
        sg.save();
        if (home) { const c = cursorRect(DOCK.x + home.col * DOCK.adv, DOCK.rowC, DOCK.size); sg.beginPath(); sg.rect(0, 0, W, H); sg.rect(c.x - 10, c.y - 10, c.w + 20, c.h + 20); sg.clip('evenodd'); }
        through(sg, 0.3);
        sg.restore();
        sg.save(); place(sg); pegs(sg); sg.restore();
        if (home && !env.noDock) cast.matchAtHome(sg, home, env, V0);
        texture(sg, 0);
        // cut to its shape: paper behind the edge, see-through more and more over the last BAND px to the edge
        sg.save(); place(sg); sg.globalCompositeOperation = 'destination-in';
        const m = sg.createLinearGradient(0, H + EXT - BAND, 0, H + EXT);
        m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.55, 'rgba(0,0,0,0.72)'); m.addColorStop(1, 'rgba(0,0,0,0.3)');
        sg.fillStyle = m; sg.fillRect(-80, -80, W + 160, H + EXT + 80);
        sg.restore();
        g.drawImage(sheet, 0, 0);
      }
      return;
    }

    // ---- the ground: the sheet on the light table, then more sheets are slapped down ----
    const handing = !!(env.other && env.role === 'in' && env.otherImpl && env.otherImpl.dock);
    const lit = n2 - twos(LAND);                                    // drawings since the sheet landed
    // the prompt row changes hands a column at a time: seen through the paper (the old skin), then inked on it
    const rowSwap = L < T.board && handing ? (lit < 1 ? 0 : clamp((L - LAND - 1 / 6) / 0.8)) : null;
    const xk = rowSwap ? DOCK.x - DOCK.adv + Math.floor(rowSwap * (DOCK.cols + 4)) * DOCK.adv : 0;
    if (L < T.board) {
      paintUnder(env, lit < 1, xk);
      g.drawImage(paper, 0, 0);
      through(g, 0.3);
      pegs(g);
      // traced in three drawings, on twos, from the frame after the sheet lands: the pen runs along it
      const tr = L - LAND - F;
      if (tr >= 0) tracing(g, 0, v, 1, [0.34, 0.78][Math.floor(tr * 6 + 1e-6)] ?? 1);
      T.sheets.forEach((at, k) => {
        if (k === 0 || L < at) return;
        const landing = n2 === twos(at), dir = k % 2 ? -1 : 1, lv = LEVEL[k];
        g.save();
        if (landing) { g.translate(W / 2 + dir * 52, H / 2 - 44); g.rotate(dir * 0.045); g.translate(-W / 2, -H / 2); }
        if (landing) shadow(g);
        g.globalAlpha = SHEET_A[lv];
        g.drawImage(paper, -60, -60, W + 120, H + 120);
        g.globalAlpha = 1;
        pegs(g);
        tracing(g, lv, v, 1, [0.34, 0.78][n2 - twos(at)] ?? 1);
        g.restore();
      });
    } else {
      const landing = n2 === twos(T.board);
      g.save();
      if (landing) {
        g.drawImage(paper, 0, 0); pegs(g); tracing(g, 3, v);
        g.translate(W / 2 + 52, H / 2 - 44); g.rotate(0.045); g.translate(-W / 2, -H / 2);
        shadow(g);
        g.globalAlpha = 0.86; g.drawImage(paper, -60, -60, W + 120, H + 120); g.globalAlpha = 1;
      } else {
        g.drawImage(paper, 0, 0);
        const ghost = [0.14, 0.14, 0.1, 0.07, 0.04][n2 - twos(T.board)] || 0;      // the sheet before shows through, then is gone
        if (ghost) tracing(g, 3, 0, ghost);
      }
      pegs(g);
      storyboard(g, env, L, v);
      g.restore();
    }

    cast.draw(g, env, L, v);

    // ---- the terminal's two rows ----
    if (!env.noDock) {
      if (rowSwap === null) dock(g, env);
      else {
        if (rowSwap > 0) {
          const top = DOCK.rowC - 96, h = 170;
          through(g, 0.3, [xk, top, W - xk, h]);                    // not yet rewritten: keep it readable under the new sheets
          g.save(); g.beginPath(); g.rect(0, top, xk, h); g.clip(); dock(g, env, 'C', true); g.restore();
          dock(g, env, 'B');
        }
        // the cursor is the match from the moment the sheet is down; it never waits for the row to be rewritten
        const home = cast.matchHome(env);
        if (home) cast.matchAtHome(g, home, env, v);
      }
    }
    texture(g, grain);
  }

  /** Motion blur for the one thing in this shot that slides: the first sheet. Drawings are never blurred. */
  function samples(env) {
    return env.lb > LAND - SLIDE && env.lb < LAND ? 12 : 1;
  }

  function storyboard(g, env, L, v) {
    // the tag, lettered as the sheet lands
    if (env.tag) {
      const s = `${env.tag.num}/${env.tag.of} ${env.tag.name}`, wr = (L - T.board - 0.1) / 0.55 * s.length;
      letter(g, s.slice(0, 5), DOCK.x - 4, 116, { u: 2.35, adv: 28, w: 4.6, v, seed: 20, color: RED, drawn: (i) => clamp(wr - i) });
      letter(g, s.slice(5), DOCK.x - 4 + 5 * 28, 116, { u: 2.35, adv: 28, w: 4.6, v, seed: 21, drawn: (i) => clamp(wr - i - 5) });
    }
    PANELS.forEach((p, i) => {
      const at = T.panel[i];
      if (L < at) return;
      const tf = panelTf(p), aliveAt = T.land[i], alive = L >= aliveAt;
      // drawn in on ones, the pen moving at an even speed; once drawn it is a still, until the flame lands on it
      const upto = L < at + T.sketch ? ((Math.floor((L - at) * 12 + 1e-6) + 1) / 12 / T.sketch) * STILL[i].len : Infinity;
      if (!alive) drawItems(g, STILL[i].items, tf, v, { upto, seed: 0 });
      else {
        const per = L >= T.hold ? 4 : 6;                                  // the drawing moves on twos; on threes in the last hold
        const t = Math.floor((Math.min(L, CALM0) - aliveAt) * per + 1e-6) / per, hit = twos(L) - twos(aliveAt);    // and stands still at the end
        drawItems(g, [...STILL[i].items.slice(0, 4), ...SKETCH[i](t, true)], tf, v, { colour: true, reg: hit === 0 ? 11 : 6, shake: hit < 2 ? 2.2 : 1, fat: hit === 0 ? 1.15 : 1 });
      }
      // an arrow in the gutter: this frame follows that one
      if (i > 0) {
        const gx = (PANELS[i - 1].cx + p.cx) / 2, gy = (PANELS[i - 1].cy + p.cy) / 2 + 6, to = clamp((L - at + 0.05) / 0.2);
        ink(g, smoothPath([[gx - 21, gy + 3], [gx - 2, gy - 4], [gx + 19, gy]], false, 3), { w: 3.6, seed: 47 + i, v, color: RED, alpha: 0.86, dry: 0.14, taper: 6, to });
        if (to >= 1) ink(g, path([[gx + 8, gy - 11], [gx + 21, gy], [gx + 9, gy + 11]], 3), { w: 3.6, seed: 49 + i, v, color: RED, alpha: 0.86, dry: 0.14, taper: 4 });
      }
      // its caption, in the animator's hand
      const cap = CAPTION[i], cw = (L - at - T.sketch * 0.8) / 0.3 * cap.length;
      if (cw > 0) letter(g, cap, p.cx - (cap.length * 23) / 2, p.cy + PH / 2 + 50 + (i === 1 ? -4 : 0), { u: 1.95, adv: 23, w: 3.8, v, seed: 25 + i, xf: null, drawn: (k) => clamp(cw - k) });
    });
  }

  /** What is on screen, for the shot that takes this one over. */
  function handoff(env) {
    const f = cast.flameAt(Math.max(0, env.lb));
    return {
      panels: PANELS.map((p) => ({ x: p.cx - PW / 2, y: p.cy - PH / 2, w: PW, h: PH, rot: p.rot })),
      flame: { x: f.x, y: f.y, r: f.r },
      paper: PAPER, ink: INK, red: RED, yellow: YEL,
      captions: CAPTION.map((s, i) => ({ text: s, x: PANELS[i].cx, y: PANELS[i].cy + PH / 2 + 50 })),
    };
  }

  return { dock, render, samples, handoff, sfx: cast.sfx };
}
