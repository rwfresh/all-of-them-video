// 07/15 Liquid Motion: sound. "pour in the sound." + Enter, and the music's full beat arrives with it.
//
// Shape Morph's orange drop lands on the prompt row on the bar line. The hit sends one thick wave up through the frame,
// four bulges on its leading edge, each on its own clock: cream above it, deep plum below. A crown of jets bursts out
// of the impact behind it and the frame fills from below. The crown then IS the sound: fifteen columns of thick glossy
// liquid standing in a pool, low notes on the left and the hats on the right, every one riding its own band of the
// film's real soundtrack (ctx.music), so no two beats look alike. On the beats the columns pass blobs to each other:
// a neck stretches and snaps, both ends rebound, the blob arcs over and is swallowed by the column it lands on.
// Far behind, two ranges of hills repeat what the columns did a moment ago. On beat 3 ("mix") the hot colour pours down.
// When the mix reports (the result line, beat 4.5) every column throws a drop upward and the drops settle into that
// line, set large above the crown: the text is the cue sheet's. A drip or two falls back from it.
// The way out starts on beat 7: three waves, hot to deep, one behind the other, each edge with five bulges. They wash
// the frame and carry the prompt; beads come up on the last of them and run together; the trailing edges follow, and
// around the bar line the last one uncovers the Sticker shot, where the prompt changes hands.
//
// Picture: one fragment shader (liquid/shader.js) on the shared renderer: a 2D distance field joined by smooth minimum,
// lit from its own gradient. Motion blur is done here (sub-frames added in a float target), so samples() stays 1.
// Lettering is the same stuff: glyphs blurred into a height field. The rows' letters are lit once in make() into an
// atlas of beads; the big result line is a live field in the shader, so drops can run into it.

import * as THREE from 'three';
import { Pass } from '../post.js';
import { DOCK } from '../term.js';
import { clamp, lerp, seg, smooth, ease, rng } from '../util.js';
import { LIQUID_FRAG, PRESENT_FRAG, GLYPH_FRAG, NC, NB, NR, NN, BLOBS } from './liquid/shader.js';

const W = 1920, H = 1080, TAU = Math.PI * 2;

/** cubic-bezier(x1, y1, x2, y2) as an easing function. */
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const fx = (t) => ((ax * t + bx) * t + cx) * t, fy = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 30; i++) { const v = fx(t); if (Math.abs(v - x) < 1e-6) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return fy(t);
  };
}
const FL = bezier(0.22, 1, 0.36, 1);        // liquid is flung: off at once, a long way to settle
const E_IN = bezier(0.2, 0.85, 0.35, 1);    // the first wave: flung too, but slow enough for its bulges to be seen

// ---- the timeline, in local beats --------------------------------------------------------------------------------------
const T = {
  flood: 0.85, floodEnd: 1.0,    // the first wave crosses the frame; it is gone
  full: 0.95,                    // from here the columns are the music's
  f1: [7.0, 7.8], f2: [7.1, 8.0], f3: [7.2, 8.3],        // the three waves' leading edges cross, one behind the other
  t3: [7.6, 8.4], t2: [7.72, 8.52], t1: [7.86, 8.66],    // their trailing edges, the last sheet first: there is always an edge in the frame
  swap: 7.8,                     // behind the first wave the ground is the next shot's, and the pool is gone
};
const X0 = -150, X1 = 2070;      // an edge starts and ends here: just outside the frame, bulges included
const IMPACT = { x: 960, y: 960 };
const POOL = 742;                // the pool's level, above the terminal's rows
const GRAV = 2250;               // px a beat squared: Shape Morph's drop falls at this, and so does everything here
const GLY = { base: 258, cap: 70, cx: 1010, box: [108, 272] };     // the big result line: baseline, capital height, the strip its mask covers (top, height)

// ---- colours of the lettering ------------------------------------------------------------------------------------------
const INK = { cream: '#FFF3E2', lilac: '#E3C4FF', orange: '#FF6A1C' };
const CREAM_BG = '#FFF6E9', DROP_ORANGE = '#FF6426', DROP_SHINE = '#FFD3BA', MORPH_INK = '#151433';

// ---- the columns: fifteen across the frame, low notes on the left, each a little different -------------------------
const MID = (NC - 1) / 2;
const COLS = (() => {
  const R = rng(88);
  return Array.from({ length: NC }, (_, j) => {
    const u = j / (NC - 1);
    return {
      j, u, f: u * 7, x: 148 + j * 116 + (R() - 0.5) * 26, r: lerp(38, 25, u) + (R() - 0.5) * 7,
      h0: lerp(96, 72, u), gain: lerp(400, 320, u) * (0.86 + 0.28 * R()), delay: j * 0.0045 + R() * 0.006,
      crown: (530 - 60 * Math.abs(j - MID)) * (0.84 + 0.3 * R()), sway: R() * TAU, bias: (R() - 0.5) * 16,
    };
  });
})();

// ---- what the columns pass to each other, and when (a fixed list, so every frame agrees) ----------------------------
const PASSES = [];
{
  const add = (from, to, t0, T_ = 0.6, apex = 150) => PASSES.push({ from, to, t0, T: T_, apex, us: 0.2 });
  add(1, 3, 1.04, 0.62, 170); add(8, 6, 1.07, 0.58, 150); add(13, 11, 1.5, 0.46, 110);
  add(3, 5, 2.04, 0.62, 160); add(10, 12, 2.08, 0.56, 140); add(14, 12, 2.52, 0.44, 100);
  add(5, 8, 3.04, 0.7, 210); add(0, 2, 3.06, 0.6, 150); add(12, 14, 3.5, 0.46, 110);
  add(2, 4, 4.04, 0.56, 150); add(9, 7, 4.06, 0.52, 130);
  add(4, 6, 5.56, 0.5, 120); add(11, 9, 5.52, 0.5, 120);
  add(6, 9, 6.04, 0.66, 150); add(1, 0, 6.06, 0.5, 130); add(12, 10, 6.08, 0.56, 130); add(14, 13, 6.5, 0.42, 100);
}

const DROPS = (() => {
  const R = rng(707), out = [];
  for (let j = 0; j < 12; j++) {
    const side = j % 2 ? 1 : -1, vy = 1180 + 780 * R(), r = 13 + 21 * Math.pow(R(), 1.6), t0 = 0.008 + 0.05 * R();
    const tl = (vy + Math.sqrt(vy * vy - 2 * GRAV * (IMPACT.y - 12 - POOL))) / GRAV;      // beats until it is back at the pool
    const xl = 960 + side * (110 + 690 * Math.pow(R(), 0.8));
    out.push({ t0, vy, vx: (xl - 960) / tl, r, tl, xl, off: (R() - 0.5) * 18 });
  }
  return out;
})();
const FIZZ = (() => {
  const R = rng(4411), out = [];
  for (let n = 0; n <= 6; n++) for (let k = 0; k < 2; k++) out.push({ t0: n + 0.5 + 0.05 * R(), x: 1150 + 640 * R(), apex: 46 + 60 * R(), T: 0.3 + 0.16 * R(), r: 7 + 5 * R() });   // the hats spit, off the beat
  return out;
})();
const TAILERS = (() => {                                        // beads that follow the last trailing edge, a little late
  const R = rng(93), out = [];
  for (let j = 0; j < 5; j++) out.push({ y: 120 + j * 205 + 80 * R(), lag: 0.03 + 0.04 * R(), r: 15 + 15 * R(), back: 30 + 40 * R() });
  return out;
})();
const SPRAY = (() => {                                          // beads that come up on the last wave; some drift together and join
  const R = rng(271), out = [];
  for (let j = 0; j < 14; j++) {
    const pair = j >= 8, k = j - 8;
    const x = pair ? 380 + Math.floor(k / 2) * 430 + (k % 2) * 86 : 150 + 1500 * R(), y = pair ? 300 + Math.floor(k / 2) * 150 + (k % 2) * 30 : 90 + 620 * R();
    out.push({ x, y, r: pair ? 36 - 10 * (k % 2) : 16 + 26 * R(), vx: pair ? (k % 2 ? -110 : 70) : 30 + 50 * R(), vy: (R() - 0.5) * 60, ph: R() * TAU });
  }
  return out;
})();
const BUBBLES = (() => {                                        // in the pool, clear of the terminal's rows
  const R = rng(1203), out = [];
  for (let j = 0; j < 10; j++) out.push({ x: j < 7 ? 1440 + 400 * R() : 30 + 80 * R() + (j - 7) * 20, r: 5 + 9 * R(), v: 150 + 170 * R(), ph: R(), sway: 6 + 10 * R() });
  return out;
})();
const RIPPLES = [
  { x: 960, amp: 52, t: 0, decay: 2.4 },
  ...DROPS.filter((d) => d.r > 17).map((d) => ({ x: d.xl, amp: 7 + d.r * 0.55, t: d.t0 + d.tl, decay: 3.4 })),
  ...PASSES.map((p) => ({ x: COLS[p.to].x, amp: 11, t: p.t0 + p.T, decay: 4 })),
];

/** The waves' edge, exactly as the shader draws it. */
function edgeX(y, base, ph, seed, amp) {
  let x = base;
  for (let j = 0; j < 5; j++) {
    const yc = 108 + 216 * j + 46 * Math.sin(seed * 3.1 + j * 2.7 + ph * 0.6), a = amp * (0.5 + 0.5 * Math.sin(ph * 1.7 + j * 2.399 + seed * 1.9)), u = (y - yc) / 112;
    x += a * Math.exp(-u * u);
  }
  return x + 16 * Math.sin(y * 0.021 + ph * 2.3 + seed) - amp * 0.55;
}
const frontX = (y, base, ph, seed) => edgeX(y, base, ph, seed, 190);
const tailX = (y, base, ph, seed) => 2 * base - edgeX(y, base, ph * 0.8 + 2, seed + 5, 170);
const sweep = (lb, [a, b]) => X0 + (X1 - X0) * FL(seg(lb, a, b));
const wavePh = (lb) => (lb - 7) * 3.2;
/** The first wave (the way in), exactly as the shader draws it: its leading edge and its trailing edge, as y for an x. */
const floodAt = (lb) => { const u = seg(lb, 0, T.flood); return { F: 1290 - 1760 * E_IN(u), th: 34 + 150 * Math.pow(1 - u, 0.7), ph: 1.3 + lb * 4.2 }; };
function floodF(x, fl) {
  let y = fl.F;
  for (let j = 0; j < 4; j++) { const xc = 240 + 480 * j + 70 * Math.sin(fl.ph * 0.7 + j * 2.1), a = 190 * (0.5 + 0.5 * Math.sin(fl.ph * 1.9 + j * 2.4 + 0.6)), u = (x - xc) / 190; y -= a * Math.exp(-u * u); }
  return y + 14 * Math.sin(x * 0.017 + fl.ph * 2.1);
}
const floodT = (x, fl) => floodF(x + 90, fl) + fl.th * (0.75 + 0.25 * Math.sin(x * 0.006 + fl.ph));

export default async function make(ctx) {
  const { fps, shot, makeCanvas, useGL, blitGL, music, clock } = ctx;
  const spb = clock.spb;
  await ctx.font('Fredoka Liq', '/assets/liquid/Fredoka-wdth-wght.ttf', { weight: '300 700', stretch: '75% 125%' });
  const FAM = '"Fredoka Liq"';
  await document.fonts.load(`600 64px ${FAM}`);

  // ---- how the music moves the liquid: each band's level drives a sprung mass, so heights overshoot and settle ------
  // resp: quick (the pool's pulse). col: held a little longer, so a column is still standing when the next hit comes.
  // slow: smoothed, for the hills far behind.
  const SR = 240, tA = shot.t0 - 2, nS = Math.ceil((shot.dur + 4) * SR) + 2;
  const mk = () => Array.from({ length: 8 }, () => new Float32Array(nS));
  const resp = mk(), col = mk(), slow = mk();
  {
    const dt = 1 / SR, z = () => new Float64Array(8);
    const h1 = z(), x1 = z(), v1 = z(), h2 = z(), x2 = z(), v2 = z(), sl = z();
    const o1 = TAU * 4.6, z1 = 0.46, o2 = TAU * 4.0, z2 = 0.42;
    for (let s = 0; s < nS; s++) {
      const b = music.at(tA + s * dt).bands;
      for (let k = 0; k < 8; k++) {
        h1[k] = Math.max(b[k], h1[k] * Math.exp(-dt / 0.1));
        v1[k] += (o1 * o1 * (h1[k] - x1[k]) - 2 * z1 * o1 * v1[k]) * dt; x1[k] += v1[k] * dt; resp[k][s] = x1[k];
        h2[k] = Math.max(b[k], h2[k] * Math.exp(-dt / 0.2));
        v2[k] += (o2 * o2 * (h2[k] - x2[k]) - 2 * z2 * o2 * v2[k]) * dt; x2[k] += v2[k] * dt; col[k][s] = x2[k];
        sl[k] += (Math.min(1.1, x1[k]) - sl[k]) * (1 - Math.exp(-dt / 0.11)); slow[k][s] = sl[k];
      }
    }
  }
  const at = (arr) => (k, t) => { const f = clamp((t - tA) * SR, 0, nS - 1.001), i = Math.floor(f); return Math.max(0, arr[k][i] + (arr[k][i + 1] - arr[k][i]) * (f - i)); };
  const respAt = at(resp), slowAt = at(slow), colAt = at(col);
  /** A column's drive: its place between two bands (f from 0, the lowest, to 7). */
  const bandAt = (f, t) => { const i = Math.min(6, Math.floor(f)), u = f - i; return colAt(i, t) * (1 - u) + colAt(i + 1, t) * u; };

  // ---- the picture's passes --------------------------------------------------------------------------------------------
  const V4 = (n) => Array.from({ length: n }, () => new THREE.Vector4());
  const U = {
    uRes: { value: new THREE.Vector2(W, H) }, uWeight: { value: 1 }, uBeat: { value: 0 }, uSec: { value: 0 },
    tOther: { value: null }, uOther: { value: 0 }, uHit: { value: new THREE.Vector2(IMPACT.x, IMPACT.y) }, uFlood: { value: new THREE.Vector3() }, uFloodOn: { value: 0 }, uFlash: { value: 0 },
    uNeckA: { value: V4(NN) }, uNeckR: { value: new Float32Array(NN) }, tGlyph: { value: null }, uGlyphBox: { value: new THREE.Vector2(GLY.box[0], GLY.box[1]) }, uTextOn: { value: 0 },
    uLevel: { value: POOL }, uSwell: { value: 1 }, uPoolOn: { value: 1 }, uRip: { value: V4(NR) },
    uColA: { value: V4(NC) }, uColB: { value: V4(NC) }, uBlobA: { value: V4(NB) }, uBlobB: { value: Array.from({ length: NB }, () => new THREE.Vector2(1, 0)) },
    uFront: { value: new THREE.Vector3() }, uTail: { value: new THREE.Vector3() }, uWaveOn: { value: 0 }, uWavePh: { value: 0 }, uRamp: { value: 1 }, uGlow: { value: 1 }, uPulse: { value: 0 }, uBackA: { value: new Float32Array(8) }, uBackB: { value: new Float32Array(8) }, uMix: { value: 0 }, uBub: { value: V4(10) },
  };
  const liquid = new Pass(LIQUID_FRAG, U, { transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
  const present = new Pass(PRESENT_FRAG, { tAcc: { value: null }, uSeed: { value: 0 } });
  const acc = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
  present.uniforms.tAcc.value = acc.texture;
  const blank = new THREE.DataTexture(new Uint8Array([255, 246, 233, 255]), 1, 1); blank.needsUpdate = true;
  const texes = new Map();
  const texOf = (canvas) => {
    if (!texes.has(canvas)) { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; texes.set(canvas, t); }
    return texes.get(canvas);
  };

  // ---- lettering: an atlas of glossy beads, lit once ------------------------------------------------------------------
  const FS = 62, CW = 88, CH = 120, BASE = 86, NS = 5, PER = Math.floor(W / CW), ROWS_PER = Math.floor(H / CH);
  const mg = makeCanvas(8, 8).getContext('2d');
  const fontOf = (size) => `600 semi-condensed ${size}px ${FAM}`;
  const texts = [shot.prompt || '', ctx.script.shots[shot.name].next ? ctx.script.shots[shot.name].next.text : '', ...(shot.out || []).map((o) => o.text), ctx.tag ? `${ctx.tag.num}/${ctx.tag.of} ${ctx.tag.name}` : '', '>0123456789'];
  const chars = [...new Set(texts.join('').split(''))].filter((c) => c !== ' ');
  const SPECIAL = {
    bullet: (g, k) => { g.beginPath(); g.arc(0, -21, 5 + 9 * k, 0, TAU); g.fill(); },
    elbow: (g, k) => { g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-8, -44 + 30 * (1 - k)); g.lineTo(-8, -9); g.lineTo(-8 + 26 * k, -9); g.stroke(); },
    drop: (g, k) => { const r = 6 + 9 * k; g.beginPath(); g.moveTo(0, -24 - r * 2.3); g.bezierCurveTo(r * 0.3, -24 - r * 1.2, r, -24 - r * 0.75, r, -24); g.arc(0, -24, r, 0, Math.PI); g.bezierCurveTo(-r, -24 - r * 0.75, -r * 0.3, -24 - r * 1.2, 0, -24 - r * 2.3); g.fill(); },
  };
  const entries = [];
  for (const tint of ['cream', 'lilac']) for (const ch of chars) for (let s = 0; s < NS; s++) entries.push({ key: `${tint}|${ch}|${s}`, tint, ch, s });
  for (const [name, tint] of [['bullet', 'orange'], ['elbow', 'lilac'], ['drop', 'orange']]) for (let s = 0; s < NS; s++) entries.push({ key: `${tint}|${name}|${s}`, tint, special: name, s });
  const sprites = new Map(), pages = [];
  {
    const mask = makeCanvas(), kg = mask.getContext('2d'), crisp = makeCanvas(), cg = crisp.getContext('2d');
    const glyph = new Pass(GLYPH_FRAG, { tMask: { value: texOf(mask) }, uRes: { value: new THREE.Vector2(W, H) } });
    const perPage = PER * ROWS_PER;
    for (let p0 = 0; p0 < entries.length; p0 += perPage) {
      const page = makeCanvas(), pg = page.getContext('2d'), list = entries.slice(p0, p0 + perPage);
      kg.setTransform(1, 0, 0, 1, 0, 0); kg.filter = 'none'; kg.clearRect(0, 0, W, H);
      for (let s = 0; s < NS; s++) {
        const k = s / (NS - 1);
        cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, W, H);
        list.forEach((e, n) => {
          if (e.s !== s) return;
          const x = (n % PER) * CW + CW / 2, y = Math.floor(n / PER) * CH + BASE;
          sprites.set(e.key, { page, x: x - CW / 2, y: y - BASE });
          cg.save();
          cg.translate(x, y);
          cg.fillStyle = cg.strokeStyle = INK[e.tint];
          if (e.special) SPECIAL[e.special](cg, k);
          else {
            // a blob that settles into its letter: the letter grows out of a ball, and the ball goes
            const sc = 0.5 + 0.5 * k, rb = 20 * Math.pow(1 - k, 0.8);
            if (rb > 0.5) { cg.beginPath(); cg.arc(0, -21, rb, 0, TAU); cg.fill(); }
            cg.font = fontOf(FS); cg.textAlign = 'center'; cg.textBaseline = 'alphabetic';
            const w = cg.measureText(e.ch).width, q = Math.min(1, 37 / w);
            cg.translate(0, -21); cg.scale(sc * q, sc); cg.translate(0, 21);
            cg.fillText(e.ch, 0, 0);
          }
          cg.restore();
        });
        kg.filter = `blur(${lerp(5.5, 2.3, k).toFixed(2)}px)`;
        kg.drawImage(crisp, 0, 0);
      }
      kg.filter = 'none';
      const R = useGL();
      glyph.uniforms.tMask.value.needsUpdate = true;
      for (let i = 0; i < 2; i++) { glyph.render(R, null); R.getContext().finish(); }     // the first picture through a new program can come out black
      blitGL(pg, R, { alpha: true });
      pages.push(page);
    }
  }
  /** One bead: a letter (or 'bullet', 'elbow', 'drop') centred on cx with its baseline on y. settle 0 (a blob) to 1. */
  function bead(g, ch, tint, cx, y, settle = 1, scale = 1, alpha = 1) {
    if (ch === ' ' || alpha <= 0.01 || scale <= 0.02) return;
    const s = sprites.get(`${tint}|${ch}|${Math.round(clamp(settle) * (NS - 1))}`);
    if (!s) return;
    if (alpha < 1) g.globalAlpha *= alpha;
    // scaled about the middle of the letter, not its baseline
    g.drawImage(s.page, s.x, s.y, CW, CH, cx - (CW / 2) * scale, y - 21 - (BASE - 21) * scale, CW * scale, CH * scale);
    if (alpha < 1) g.globalAlpha /= alpha;
  }
  const cellX = (col) => DOCK.x + col * DOCK.adv + DOCK.adv / 2;
  const CLEAR = ctx.script.T.clear ?? 1;

  /** The terminal's two rows as beads on the grid. The cursor is a drop. */
  function dock(g, env, part) {
    const m = env.term, lb = env.lb;
    if (part !== 'C' && m.last) {
      const o = m.last, res = o.kind === 'result', tint = res ? 'lilac' : 'cream';
      const shown = o.kind === 'say' ? o.text.slice(0, o.chars) : o.text, c0 = res ? 5 : 2;
      if (res) bead(g, 'elbow', 'lilac', cellX(2), DOCK.rowB, seg(o.age, 0, 0.2));
      else { const k = seg(o.age, 0, 0.22); bead(g, 'bullet', 'orange', cellX(0), DOCK.rowB, k, 0.7 + 0.3 * ease.outBack(k)); }
      for (let i = 0; i < shown.length; i++) {
        // the line runs in from the left, a letter every few milliseconds; each is a letter from its first frame
        // (a fat one that slims), never a dot waiting to become one
        const a = o.kind === 'say' ? 1 : seg(o.age, i * 0.005, 0.09 + i * 0.005);
        if (a > 0) bead(g, shown[i], tint, cellX(c0 + i), DOCK.rowB, 0.75 + 0.25 * a, 0.8 + 0.2 * a + 0.14 * Math.sin(Math.PI * a));
      }
    }
    if (part === 'B') return;
    const c = m.rowC, y = DOCK.rowC;
    bead(g, '>', 'lilac', cellX(0), y);
    let curCol = null, hop = 1;
    if (c.mode === 'cmd') {
      // before the next prompt the old one sinks away, last letter first, and its full stop becomes the cursor and runs home
      const clearAt = m.typing ? m.typing.start - CLEAR : Infinity, e = seg(lb, clearAt - 0.6, clearAt - 0.04), len = c.text.length;
      for (let i = 0; i < len; i++) {
        const ei = seg(e, ((len - 1 - i) / len) * 0.6, ((len - 1 - i) / len) * 0.6 + 0.3);
        bead(g, c.text[i], 'cream', cellX(2 + i), y + 22 * ei * ei, 1, 1 - 0.55 * ei, 1 - smooth(seg(ei, 0.3, 1)));
      }
      if (e > 0) { curCol = lerp(2 + len - 1, 2, FL(seg(e, 0.08, 1))); hop = seg(e, 0.08, 1); }
    } else {
      for (let i = 0; i < c.n; i++) {
        const a = seg(c.keyAge(i), 0, 0.12);
        bead(g, c.text[i], 'cream', cellX(2 + i), y, 0.62 + 0.38 * a, 1 + 0.26 * Math.sin(Math.PI * a));
      }
      if (c.cursor) {
        const age = c.n > 0 ? c.keyAge(c.n - 1) : Infinity;
        hop = c.n > 0 ? FL(seg(age, 0, 0.16)) : 1;
        curCol = 2 + lerp(Math.max(0, c.n - 1), c.n, hop);
      }
    }
    if (curCol !== null) {
      // the cursor: a drop that leans into each hop and swells on the beat when the hands are still
      const f = m.ab - Math.floor(m.ab), beat = Math.exp(-f * 5);
      const moving = hop > 0 && hop < 1 ? Math.sin(Math.PI * hop) : 0;
      const sc = 0.9 + 0.2 * beat + 0.1 * moving;
      g.save();
      g.translate(DOCK.x + curCol * DOCK.adv + DOCK.adv / 2, y - 14);
      g.rotate(0.5 * moving);
      bead(g, 'drop', 'orange', 0, 14, 1, sc);
      g.restore();
    }
  }

  function drawTag(g, env) {
    if (!env.tag || env.lb < 0) return;
    const s = `${env.tag.num}/${env.tag.of} ${env.tag.name}`, lb = env.lb, sc = 0.84, adv = 31;
    const wash = lb >= T.f1[0] ? (y) => frontX(y, sweep(lb, T.f1), wavePh(lb), 0) : null;
    for (let i = 0; i < s.length; i++) {
      const x = DOCK.x + 12 + i * adv;
      let a = seg(lb, 0.36 + i * 0.012, 0.48 + i * 0.012);          // once the first wave has gone by
      if (wash) a = Math.min(a, clamp((x - 20 - wash(134)) / 90));   // the way out takes it
      if (a > 0) bead(g, s[i], i < 5 ? 'lilac' : 'cream', x, 152, 0.75 + 0.25 * a, sc * (0.8 + 0.2 * a + 0.14 * Math.sin(Math.PI * a)));
    }
  }

  // ---- the result line, large: where each letter stands, which column throws it, and when --------------------------
  const RES = (shot.out || []).find((o) => o.kind === 'result') || null;
  const gmask = makeCanvas(W, GLY.box[1]), gk = gmask.getContext('2d'), gcrisp = makeCanvas(W, GLY.box[1]), gc = gcrisp.getContext('2d');
  const gtex = texOf(gmask);
  U.tGlyph.value = gtex;
  let GS = 100, LETTERS = [], DRIPS = [], TX = [960, 960];
  if (RES) {
    mg.font = `600 100px ${FAM}`;
    const capH = mg.measureText('H').actualBoundingBoxAscent || 68;
    GS = (GLY.cap / capH) * 100;
    const font = `600 ${GS.toFixed(2)}px ${FAM}`;
    mg.font = font;
    const track = 7, ws = [...RES.text].map((ch) => (ch === ' ' ? GS * 0.3 : mg.measureText(ch).width) + track);
    const total = ws.reduce((a, b) => a + b, 0) - track;
    let x = GLY.cx - total / 2;                                       // a little right of centre, clear of the tag
    TX = [x, x + total];
    const R = rng(502);
    [...RES.text].forEach((ch, i) => { if (ch !== ' ') LETTERS.push({ ch, x: x + (ws[i] - track) / 2, y: GLY.base - GLY.cap / 2, font }); x += ws[i]; });
    LETTERS.forEach((L, i) => {
      L.c = Math.round((i / Math.max(1, LETTERS.length - 1)) * (NC - 1));      // the column that throws it, left to right
      L.td = RES.at + i * 0.016 + 0.01 * R();                                  // it leaves as the line is printed
      L.Tf = 0.5 + 0.06 * R(); L.ta = L.td + L.Tf;                             // and lands half a beat later
      L.bend = (R() - 0.5) * 120; L.r = 23 + 5 * R();
    });
    // a drop or two lets go of the line later on, and falls back into the crown
    const pick = (f) => LETTERS[Math.round(f * (LETTERS.length - 1))];
    if (LETTERS.length > 3) DRIPS = [{ L: pick(0.72), t0: 5.75, rel: 6.2 }, { L: pick(0.2), t0: 6.2, rel: 6.62 }];
    for (const d of DRIPS) { d.c = COLS.reduce((b, c) => (Math.abs(c.x - d.L.x) < Math.abs(b.x - d.L.x) ? c : b), COLS[0]); d.land = d.rel + Math.sqrt((2 * (POOL - 250 - (GLY.base + 34))) / GRAV); }
  }
  const TEXT_T = RES ? [RES.at, T.f1[1]] : [99, 99];     // while the big line (or a drop on its way to it) is on screen
  /** The letters' mask for this instant: each grows out of the ball its drop arrived as. */
  function drawLetters(lb, pulse) {
    gc.setTransform(1, 0, 0, 1, 0, 0); gc.clearRect(0, 0, W, GLY.box[1]);
    gc.fillStyle = '#fff'; gc.textAlign = 'center'; gc.textBaseline = 'alphabetic';
    for (const L of LETTERS) {
      const tau = lb - L.ta;
      if (tau <= 0) continue;
      const s = seg(tau, 0, 0.24), q = tau - 0.24;
      const y = L.y - GLY.box[0];
      const rb = L.r * Math.pow(1 - s, 1.2);
      if (rb > 0.6) { gc.beginPath(); gc.arc(L.x, y, rb, 0, TAU); gc.fill(); }
      // out of the ball, a little too big, then it rings like jelly; the second drop makes it swell once more
      let sc = 0.42 + 0.58 * ease.outBack(s);
      if (q > 0) sc *= 1 + 0.07 * Math.exp(-q * 6) * Math.cos((TAU * q) / 0.26);
      const q2 = tau - 0.16;
      if (q2 > 0) sc *= 1 + 0.09 * Math.exp(-q2 * 9);
      sc *= 1 + 0.03 * pulse;
      gc.save();
      gc.translate(L.x, y); gc.scale(sc, sc);
      gc.font = L.font;
      gc.fillText(L.ch, 0, GLY.cap / 2);
      gc.restore();
    }
    gk.setTransform(1, 0, 0, 1, 0, 0); gk.clearRect(0, 0, W, GLY.box[1]);
    gk.filter = 'blur(5px)'; gk.drawImage(gcrisp, 0, 0); gk.filter = 'none';
    gtex.needsUpdate = true;
  }

  // ---- everything that moves, for one instant --------------------------------------------------------------------------
  const used = { fused: 0, front: 0, text: 0, hot: 0 };
  /** One blob in a group: 'fused' with pool and columns, 'front' of them, the result line's 'text', the first wave's 'hot'. */
  const blob = (group, x, y, r, s = 1, dx = 0, dy = -1) => {
    const [a, b] = BLOBS[group], n = a + used[group];
    if (n >= b || r <= 0.5) return;
    U.uBlobA.value[n].set(x, y, r, s);
    const l = Math.hypot(dx, dy) || 1;
    U.uBlobB.value[n].set(dx / l, dy / l);
    used[group]++;
  };
  let necks = 0;
  const neck = (ax, ay, bx, by, r) => { if (necks >= NN || r <= 0.6) return; U.uNeckA.value[necks].set(ax, ay, bx, by); U.uNeckR.value[necks] = r; necks++; };

  function levelAt(lb, t) {
    if (lb < 0) return H + 200;
    const rise = FL(seg(lb, 0, 0.45));
    return POOL + (IMPACT.y + 150 - POOL) * (1 - rise) - 24 * Math.sin(Math.PI * seg(lb, 0.18, 0.8)) * (1 - seg(lb, 0.18, 0.8)) - 9 * respAt(0, t) * smooth(seg(lb, 0.4, 0.9));
  }

  /** How tall a column stands: the crown of the splash at first, then its band of the music, growing a little as the shot goes. */
  function heightAt(c, lb, t) {
    const lc = lb - Math.abs(c.j - MID) * 0.012;
    const crown = c.crown * FL(seg(lc, 0, 0.3)) * (1 + 0.2 * Math.sin(Math.PI * seg(lc, 0.1, 0.66)));
    let band = c.h0 + c.gain * bandAt(c.f, t - c.delay) * (0.9 + 0.035 * clamp(lb, 0, 7));
    band -= 0.8 * Math.max(0, band - 470);                         // nothing reaches the tag
    // once the big line is on its way the columns keep clear of it
    if (RES) band -= 0.68 * Math.max(0, band - 290) * smooth(seg(lb, RES.at - 0.25, RES.at + 0.25));     // (a soft knee: tall ones are still the tallest)
    return lerp(crown, band, smooth(seg(lb, 0.45, T.full)));
  }

  const ST = COLS.map(() => ({ x: 0, top: 0, r: 0, lean: 0, hx: 0, head: 1.14, squash: 1 }));
  /** The path of something passed from one point to another: there by u = 1, over an arc. */
  const arc = (ax, ay, bx, by, u, apex) => [lerp(ax, bx, u * u * (3 - 2 * u)), lerp(ay, by, u) - apex * 4 * u * (1 - u)];

  function setState(lb, t) {
    const level = levelAt(lb, t), waveOn = lb >= T.f1[0];
    U.uBeat.value = lb; U.uSec.value = t;
    U.uLevel.value = level; U.uPoolOn.value = lb >= 0 && lb < T.swap ? 1 : 0;
    U.uPulse.value = clamp(respAt(0, t), 0, 1.2) * smooth(seg(lb, 0.3, 0.9));
    // behind everything, the same bands a little late (and later still): hills that follow the columns like an echo
    for (let k = 0; k < 8; k++) { U.uBackA.value[k] = 0.3 + 0.7 * slowAt(k, t - 0.16); U.uBackB.value[k] = 0.36 + 0.64 * slowAt(k, t - 0.34); }
    U.uSwell.value = smooth(seg(lb, 0.5, 1.2));
    U.uRamp.value = FL(seg(lb, 0.04, 1.2));
    U.uGlow.value = smooth(seg(lb, 0.1, 0.8));
    const fl = floodAt(lb);
    U.uFlood.value.set(fl.F, fl.th, fl.ph);
    U.uFloodOn.value = lb > 0 && lb < T.floodEnd ? 1 : 0;
    U.uFlash.value = lb >= 0 && lb < 0.4 ? 0.95 * Math.pow(0.5, (lb * spb) / 0.03) : 0;
    U.uTextOn.value = lb >= TEXT_T[0] && lb < TEXT_T[1] ? 1 : 0;

    // "mix": on beat 3 the hot colour pours down through the columns and comes back up, once
    { const tau = lb - 3; U.uMix.value = (tau > 0 ? 300 * Math.sin(Math.PI * clamp(tau / 1.5)) * Math.exp(-tau * 1.1) * (1 + 0.25 * Math.sin(tau * 9)) : 0) + 26 * U.uPulse.value; }
    for (let j = 0; j < 10; j++) {
      const b = BUBBLES[j], span = H + 30 - level, u = ((lb * b.v) / span + b.ph) % 1, y = H + 20 - u * span;
      U.uBub.value[j].set(b.x + b.sway * Math.sin(lb * 2.1 + j * 1.7), y, b.r * (0.7 + 0.3 * u), lb > 0.5 ? smooth(seg(u, 0, 0.12)) * (1 - smooth(seg(u, 0.86, 0.97))) * smooth(seg(lb, 0.5, 1.2)) : 0);
    }

    // ripples: the eight that are biggest right now
    const live = [];
    for (const r of RIPPLES) { const tau = lb - r.t; if (tau >= 0) { const a = r.amp * Math.exp(-tau * r.decay); if (a > 0.4) live.push([a, r, tau]); } }
    live.sort((a, b) => b[0] - a[0]);
    for (let i = 0; i < NR; i++) { const e = live[i]; if (e) U.uRip.value[i].set(e[1].x, e[1].amp, e[2], e[1].decay); else U.uRip.value[i].set(0, 0, 0, 0); }

    used.fused = used.front = used.text = used.hot = 0; necks = 0;

    // ---- the columns as the music has them ----
    const fan = FL(seg(lb, 0, 0.42)), splay = 1 - smooth(seg(lb, 0.12, 0.85));
    for (let n = 0; n < NC; n++) {
      const c = COLS[n], S = ST[n];
      S.x = 960 + (c.x - 960) * fan;
      S.r = c.r * (0.5 + 0.5 * FL(seg(lb, 0, 0.3)));
      S.top = level - heightAt(c, lb, t);
      S.lean = Math.sign(c.j - MID) * (30 + 12 * Math.abs(c.j - MID)) * splay + (c.bias + 9 * Math.sin(lb * 1.3 + c.sway)) * (1 - splay);
      S.head = 1.1; S.squash = 1;
    }

    // ---- what they pass to each other: a neck, a snap, a flight, and the blob is swallowed where it lands ----
    if (lb > 0) for (const p of PASSES) {
      const tau = lb - p.t0;
      if (tau < 0 || tau > p.T + 0.6) continue;
      const A = ST[p.from], B = ST[p.to];
      if (tau >= p.T) {                                             // landed: the column swells with it and rings
        const q = tau - p.T;
        B.head += 0.3 * Math.exp(-q * 4);
        B.top += 16 * Math.exp(-q * 10) * Math.cos((TAU * q) / 0.24);
        B.squash *= 1 - 0.2 * Math.exp(-q * 12) * Math.cos((TAU * q) / 0.2);
        A.head -= 0.2 * (1 - seg(tau, p.T, p.T + 0.6));              // the giver grows its head back
        continue;
      }
      const u = tau / p.T, ax = A.x + A.lean, ay = A.top, bx = B.x + B.lean, by = B.top - B.r * 0.4;
      const apex = RES && p.t0 > RES.at - 0.6 ? Math.min(p.apex, 44) : p.apex;      // under the big line the passes fly low
      const [x, y] = arc(ax, ay, bx, by, u, apex), [x2, y2] = arc(ax, ay, bx, by, u + 0.01, apex);
      const r = A.r * (apex < p.apex ? 0.8 : 0.92);
      let stretch = 1 + Math.min(0.45, Math.hypot(x2 - x, y2 - y) / (0.01 * p.T) / 2600);
      A.head -= 0.2 * seg(u, 0, p.us);
      if (u < p.us) {
        const k = u / p.us;                                         // the neck: fat, then a thread
        neck(ax, ay - 4, x, y, 14 * Math.pow(1 - k, 0.55) + 2.5);
        A.top -= 12 * k;
      } else {
        const q = tau - p.us * p.T;                                 // snapped: both ends spring back for a few frames
        A.top += 20 * Math.exp(-q * 13) * Math.cos((TAU * q) / 0.2);
        stretch *= 1 + 0.3 * Math.exp(-q * 9) * Math.cos((TAU * q) / 0.17);
        // and a bead from the broken neck follows, a little late (in front: joined on again it would undo the snap)
        const ud = (tau - 0.09) / p.T;
        if (ud > p.us && ud < 0.8) { const [sx, sy] = arc(ax, ay, bx, by, ud, apex * 0.86); blob('front', sx, sy + 6, (r * 0.16 + 2.5) * smooth(seg(q, 0.05, 0.11)) * (1 - seg(ud, 0.6, 0.8)), 1.25, x - sx, y - sy); }
      }
      if (u > 0.84) neck(bx, by, x, y, 9 * seg(u, 0.84, 1));        // it reaches for the column it is about to join
      blob('fused', x, y, r, Math.max(1, stretch), x2 - x, y2 - y);
    }

    // ---- the result line: every column throws a drop up, and a smaller one after it ----
    if (RES && lb >= RES.at && lb < TEXT_T[1]) {
      for (const L of LETTERS) {
        const S = ST[L.c], sx = S.x + S.lean, sy = S.top - 6;
        for (const [lag, k] of [[0, 1], [0.16, 0.56]]) {
          const tau = lb - L.td - lag;
          if (tau <= 0 || tau >= L.Tf) continue;
          const u = tau / L.Tf, e = 1 - Math.pow(1 - u, 2.3), e2 = 1 - Math.pow(Math.max(0, 0.99 - u), 2.3);     // thrown: fast off the column, slow into its place
          const pos = (ee) => [lerp(sx, L.x, ee) + L.bend * Math.sin(Math.PI * ee), lerp(sy, L.y, ee)];
          const [x, y] = pos(e), [x2, y2] = pos(e2);
          blob('text', x, y, L.r * k * (0.75 + 0.25 * seg(u, 0, 0.3)), 1 + Math.min(0.7, Math.hypot(x2 - x, y2 - y) / (0.01 * L.Tf) / 3200), x2 - x, y2 - y);
          if (!lag) {
            if (u < 0.16) { const kk = u / 0.16; neck(sx, sy, x, y, 12 * Math.pow(1 - kk, 0.55) + 2); S.top -= 14 * kk; }
            else { const q = tau - 0.16 * L.Tf; S.top += 18 * Math.exp(-q * 13) * Math.cos((TAU * q) / 0.2); }
          }
        }
      }
      for (const d of DRIPS) {
        if (lb < d.t0) continue;
        if (lb < d.rel) { const e = seg(lb, d.t0, d.rel); blob('text', d.L.x, GLY.base + 2 + 30 * e * e, 4 + 10 * e, 1 + 0.5 * e, 0, 1); }   // it gathers under the letter
        else {
          const tau = lb - d.rel, y = GLY.base + 34 + 0.5 * GRAV * tau * tau, S = ST[d.c.j];
          if (y < S.top - 4) blob('text', d.L.x, y, 13, 1 + Math.min(0.6, (GRAV * tau) / 2600), 0, 1);       // and falls
        }
      }
    }
    for (const d of DRIPS) { const q = lb - d.land; if (q > 0 && q < 0.8) { const S = ST[d.c.j]; S.head += 0.22 * Math.exp(-q * 4); S.top += 12 * Math.exp(-q * 10) * Math.cos((TAU * q) / 0.24); } }

    for (let n = 0; n < NC; n++) {
      const S = ST[n];
      if (lb < 0) { U.uColA.value[n].set(0, 0, 0, 0); continue; }
      U.uColA.value[n].set(S.x, S.top, S.r, S.lean);
      U.uColB.value[n].set(S.top, S.r * Math.max(0.86, S.head), 0, S.squash);
    }

    // ---- what the hit throws up ----
    if (lb >= 0 && lb < 2.6) {
      for (const d of DROPS) {
        for (const [lag, k, ox] of [[0, 1, 0], [0.13, 0.44, d.off]]) {
          const tau = lb - d.t0 - lag;
          if (tau < 0) continue;
          if (tau < d.tl) {
            const vy = -d.vy + GRAV * tau, y = IMPACT.y - 12 - d.vy * tau + 0.5 * GRAV * tau * tau, sp = Math.hypot(d.vx, vy);
            blob('front', 960 + d.vx * tau + ox, y, d.r * k * smooth(seg(level - y, 6, 80)) * smooth(seg(tau, 0.09, 0.2)), 1 + Math.min(0.8, sp / 2400), d.vx, vy);   // it comes out of the surface as it clears it
          } else if (tau < d.tl + 0.12) {
            const q = (tau - d.tl) / 0.12;                           // lands flat, and is gone into the pool
            blob('fused', d.xl + ox, level + d.r * k * (0.1 + 0.9 * q), d.r * k * (1 - 0.5 * q), 1 + 0.9 * (1 - q), 1, 0);
          }
        }
      }
    }
    if (lb >= 0.4) for (const f of FIZZ) {
      const tau = lb - f.t0;
      if (tau < 0 || tau > f.T) continue;
      const u = tau / f.T;
      blob('fused', f.x, level + f.r - (f.apex + 2 * f.r) * 4 * u * (1 - u), f.r, 1 + 0.5 * Math.abs(1 - 2 * u), 0, 1);
    }

    // ---- the way out ----
    U.uWaveOn.value = waveOn ? 1 : 0;
    if (waveOn) {
      const ph = wavePh(lb), f3 = sweep(lb, T.f3), t3 = sweep(lb, T.t3);
      U.uWavePh.value = ph;
      U.uFront.value.set(sweep(lb, T.f1), sweep(lb, T.f2), f3);
      U.uTail.value.set(sweep(lb, T.t1), sweep(lb, T.t2), t3);
      // beads come up on the last wave once it has gone by, drift, run together, and go when its trailing edge reaches them
      for (const b of SPRAY) {
        const tau = lb - T.f3[0], x = b.x + b.vx * tau, y = b.y + b.vy * tau + 6 * Math.sin(lb * 5 + b.ph);
        const up = smooth(seg(frontX(y, f3, ph, 23) - x, 70, 230)), gone = smooth(seg(x - tailX(y, t3, ph, 23), 110, 10));
        blob('front', x, y, b.r * ease.outBack(up) * (1 - gone), 1, 1, 0);
      }
      if (lb > T.t1[0]) {
        // beads left behind the last trailing edge: they form as it slows, hang on a neck, and are drawn back in
        const v = (sweep(lb, T.t1) - sweep(lb - 0.02, T.t1)) / 0.02, slowed = 1 - smooth(seg(v, 1500, 5200));
        for (const b of TAILERS) {
          const l2 = lb - b.lag, x = tailX(b.y, sweep(l2, T.t1), wavePh(l2), 0) - b.back * (1 - seg(lb, T.t1[0] + 0.45, T.t1[1] - 0.1));
          if (x > -60 && x < W + 80) blob('hot', x, b.y + 8 * Math.sin(lb * 9 + b.y), b.r * slowed * (1 - seg(lb, T.t1[0] + 0.28, T.t1[0] + 0.5)), 1 + Math.min(0.3, v / 9000), 1, 0);
        }
      }
    }
    for (const g of ['fused', 'front', 'text', 'hot']) for (let j = BLOBS[g][0] + used[g]; j < BLOBS[g][1]; j++) U.uBlobA.value[j].set(0, 0, 0, 1);
    for (let i = necks; i < NN; i++) U.uNeckR.value[i] = 0;
  }

  /** How many sub-frames an instant needs: more while something crosses the frame in a few frames. */
  function subframes(lb) {
    if (lb < 0) return 1;
    if (lb < 0.5) return 24;
    if (lb < 1) return 12;
    if ((lb >= T.f1[0] - 0.02 && lb < T.f3[0] + 0.45) || (lb >= T.t3[0] - 0.02 && lb < T.t1[0] + 0.45)) return 24;
    return 8;
  }

  // ---- before the bar line, alone: the drop still falling on cream (the director never asks, but nothing is blank) ----
  function before(g, env) {
    const tr = env.lb + 0.5;                                        // beats since Morph's drop let go
    g.fillStyle = CREAM_BG; g.fillRect(0, 0, W, H);
    const cy = 809 - 0.5 * GRAV * 0.25 + 0.5 * GRAV * Math.max(0, tr) * Math.max(0, tr), r = 147;
    g.fillStyle = DROP_ORANGE;
    g.beginPath(); g.moveTo(960, cy - r * 2.4); g.bezierCurveTo(960 + r * 0.35, cy - r * 1.3, 960 + r, cy - r * 0.8, 960 + r, cy); g.arc(960, cy, r, 0, Math.PI);
    g.bezierCurveTo(960 - r, cy - r * 0.8, 960 - r * 0.35, cy - r * 1.3, 960, cy - r * 2.4); g.fill();
    g.strokeStyle = DROP_SHINE; g.lineWidth = 28; g.lineCap = 'round';
    g.beginPath(); g.arc(960, cy, r * 0.62, Math.PI * 0.68, Math.PI * 0.92); g.stroke();
    const c = env.term.rowC;
    g.fillStyle = MORPH_INK; g.font = `500 ${DOCK.size}px "JetBrains Mono"`; g.textBaseline = 'alphabetic'; g.textAlign = 'center';
    g.fillText('>', cellX(0), DOCK.rowC);
    for (let i = 0; i < c.n; i++) g.fillText(c.text[i], cellX(2 + i), DOCK.rowC);
  }

  function paint(g, env) {
    const lb = env.lb, R = useGL();
    const handIn = !!(env.other && env.role === 'in'), handOut = !!(env.other && env.role === 'out');
    let tex = blank, mode = 0;
    if (handIn && lb < T.floodEnd) { tex = texOf(env.other); tex.needsUpdate = true; mode = 1; }
    else if (handOut && lb >= T.swap) { tex = texOf(env.other); tex.needsUpdate = true; mode = 2; }
    U.tOther.value = tex; U.uOther.value = mode;
    if (lb >= TEXT_T[0] - 0.05 && lb < TEXT_T[1]) drawLetters(lb, clamp(respAt(0, env.t), 0, 1.2));

    const K = subframes(lb), shutter = (lb < 0.7 ? 0.13 : 0.22) / fps;       // a short shutter while the first wave goes up: its bulges must read
    R.setRenderTarget(acc);
    R.setClearColor(0x000000, 0);
    R.clear();
    R.autoClear = false;
    U.uWeight.value = 1 / K;
    for (let k = 0; k < K; k++) {
      const dt = K === 1 ? 0 : ((k + 0.5) / K - 0.5) * shutter;
      setState(lb + dt / spb, env.t + dt);
      liquid.render(R, acc);
    }
    R.autoClear = true;
    present.uniforms.uSeed.value = (env.frame % 97) * 13.7;
    present.render(R, null);
    blitGL(g, R);
  }

  function render(g, env) {
    const lb = env.lb;
    if (lb < 0 && !env.other) { before(g, env); return; }
    paint(g, env);
    drawTag(g, env);
    if (env.noDock) return;
    const od = env.otherImpl && env.otherImpl.dock;

    // the way in: Morph's rows are still there above the first wave, these below it
    if (lb < T.floodEnd) {
      const fl = floodAt(lb);
      const part = (edge, above) => {
        g.beginPath();
        g.moveTo(-10, above ? -10 : H + 10);
        for (let x = -10; x <= W + 10; x += 16) g.lineTo(x, edge(x));
        g.lineTo(W + 10, above ? -10 : H + 10);
        g.closePath();
      };
      if (env.other && env.role === 'in' && od) { g.save(); part((x) => floodF(x, fl) - 12, true); g.clip(); od(g, env.otherEnv); g.restore(); }
      g.save(); part((x) => floodT(x, fl) + 6, false); g.clip(); dock(g, env); g.restore();
      return;
    }
    // the way out: the first wave washes row B away; the prompt rides all three, and changes hands at the last trailing edge
    if (lb >= T.f1[0]) {
      const ph = wavePh(lb), f1 = sweep(lb, T.f1), t1 = sweep(lb, T.t1);
      const side = (edge, left) => {
        g.beginPath();
        g.moveTo(left ? -10 : W + 10, 700);
        for (let y = 700; y <= H; y += 12) g.lineTo(edge(y), y);
        g.lineTo(left ? -10 : W + 10, H);
        g.closePath();
      };
      g.save(); side((y) => frontX(y, f1, ph, 0) + 30, false); g.clip(); dock(g, env, 'B'); g.restore();
      const tail = (y) => tailX(y, t1, ph, 0) + 8;
      g.save(); side(tail, false); g.clip(); dock(g, env, 'C'); g.restore();
      if (env.other && env.role === 'out' && od && lb >= T.t1[0]) { g.save(); side(tail, true); g.clip(); od(g, env.otherEnv); g.restore(); }
      return;
    }
    dock(g, env);
  }

  // The first picture through a new chain can come out black: draw two before the film asks for any.
  for (let i = 0; i < 2; i++) {
    const R = useGL();
    U.tOther.value = blank; U.uOther.value = 0;
    drawLetters(5.6, 0);
    R.setRenderTarget(acc); R.clear(); R.autoClear = false;
    setState(5.6 + i, shot.t0 + 2.6); U.uWeight.value = 1;
    liquid.render(R, acc);
    R.autoClear = true;
    present.render(R, null);
    R.getContext().finish();
    await new Promise((r) => setTimeout(r, 30));
  }

  const onBeat = PASSES.filter((p) => Math.abs(p.t0 - Math.round(p.t0)) < 0.2);
  return {
    render, dock,
    /** For notes and neighbours: the pool's level, the columns' tops and the waves' edges at this instant (frame pixels). */
    handoff(env) {
      const lb = env.lb, level = levelAt(lb, env.t);
      return {
        level, bg: '#2A0B36',
        columns: COLS.map((c) => ({ x: c.x, y: level - heightAt(c, lb, env.t), r: c.r })),
        wave: lb >= T.f1[0] ? { front: [sweep(lb, T.f1), sweep(lb, T.f2), sweep(lb, T.f3)], tail: [sweep(lb, T.t1), sweep(lb, T.t2), sweep(lb, T.t3)] } : null,
      };
    },
    sfx: [
      { b: 0, s: 'liquid_splash', g: 1.1, a: 'peak' },            // the drop lands: one big wet splash on the downbeat
      { b: 0.05, s: 'liquid_surge', g: 0.7 },                     // the first wave goes up through the frame
      // a neck snaps, once a beat (the first pass of each beat)
      ...[1, 2, 3, 4, 6].map((n) => onBeat.find((p) => Math.round(p.t0) === n)).filter(Boolean).map((p) => ({ b: +(p.t0 + p.T * p.us).toFixed(3), s: 'liquid_snap', g: 0.4, a: 'peak' })),
      ...[1.5, 3.5, 5.5].map((b) => ({ b, s: 'liquid_plip', g: 0.4 })),   // the hats spit, off the beat
      { b: 3, s: 'liquid_pour', g: 0.6 },                         // "mix": the hot colour pours down through the columns
      ...(RES ? [{ b: RES.at, s: 'liquid_gather', g: 0.8 },       // every column throws a drop up: a run of wet plops, climbing
        { b: +(RES.at + 0.82).toFixed(2), s: 'liquid_set', g: 0.7, a: 'peak' }] : []),   // and the line sets
      ...DRIPS.slice(0, 1).map((d) => ({ b: +d.land.toFixed(2), s: 'liquid_plip', g: 0.5 })),   // a drop falls back from it
      { b: T.f1[0], s: 'liquid_wave', g: 0.9 },                   // the three waves come across
      { b: T.t1[0], s: 'liquid_drain', g: 0.8 },                  // and pull away from the next shot
    ],
  };
}
