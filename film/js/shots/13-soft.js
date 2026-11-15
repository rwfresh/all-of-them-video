// 13/15 3D Render: "now polish it." The flat picture before this shot turns out to be a sheet lying on a studio floor.
// A soft wave leaves the centre; behind it the paper scraps puff into pillows and a field of glossy pills stands up on
// concentric rings, while the camera swings down off the vertical (four fifths of its move in the first fifth of the
// time) and then never stops: a slow push in on a small arc. On beat 2 a puffy play button drops in, squashes, jiggles,
// shoves the field aside and sends one clear wave rolling out through it; a second, smaller one leaves on beat 5, and
// small ones on the beats between. On beat 4 the softboxes sweep across everything: the polish.
// On the way out (the two beats the next shot takes this picture over) everything lets go: the button breathes out,
// the pills sink into the floor ring after ring, and the rose-gold pearls stay where they are, catching the light.
//
// The picture runs on 24 pictures a second with a half-open shutter, as this style does; the terminal's rows stay live.
// The rows are the film's mono, dark plum on cream plates, on the film's grid; the cursor is one of the pills.

import { Post } from '../post.js';
import { DOCK, MONO, swapDock } from '../term.js';
import { clamp, lerp, seg, smooth, ease, spring } from '../util.js';
import { makeStudio, TL, PEARL_R } from './soft/studio.js';
import { makeSprites, INK } from './soft/letters.js';

const CADENCE = 24;
const K_PASSES = 48;
const SHUTTER = 0.5 / CADENCE;       // seconds the shutter is open

// stand-ins for the collage's paper pieces, used until that shot hands over its own
const KRAFT = '#C9A77A';
const STAND_IN = [
  { x: 330, y: 250, w: 330, h: 230, rot: -0.14, color: '#D8362A' },
  { x: 700, y: 180, w: 250, h: 170, rot: 0.09, color: '#F1E8D4' },
  { x: 1090, y: 240, w: 300, h: 220, rot: -0.05, color: '#1D1B1A' },
  { x: 1500, y: 210, w: 280, h: 200, rot: 0.16, color: '#E3A92C' },
  { x: 250, y: 560, w: 260, h: 190, rot: 0.1, color: '#F1E8D4' },
  { x: 640, y: 520, w: 290, h: 210, rot: -0.2, color: '#E3A92C' },
  { x: 1010, y: 590, w: 240, h: 180, rot: 0.12, color: '#D8362A' },
  { x: 1380, y: 540, w: 310, h: 200, rot: -0.08, color: '#F1E8D4' },
  { x: 1700, y: 600, w: 220, h: 230, rot: 0.2, color: '#1D1B1A' },
];

// the prompt's plate
const PLATE = { x0: 132, x1: 1788, y0: 896, y1: 1006, r: 34 };
const TAG = { x: 168, y: 150, k: 0.72 };

export default async function make(ctx) {
  const { W, H, shot, script, makeCanvas, useGL, blitGL } = ctx;
  const HAND = (shot.enter && shot.enter.post) || 2;

  const R0 = useGL();
  const post = new Post(R0, W, H);
  const studio = makeStudio(ctx, post, { end: shot.beats });

  const S = script.shots[shot.name];
  const L = await makeSprites(ctx, studio.scene.environment);
  const ADV = DOCK.adv;

  // ---- a stand-in sheet: kraft paper with nine scraps, for when the shot before is not built (or this one is seen alone) ----
  const standIn = makeCanvas(), sg = standIn.getContext('2d');
  sg.fillStyle = KRAFT; sg.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { const h = Math.sin(i * 127.1) * 43758.5453, r = h - Math.floor(h), h2 = Math.sin(i * 311.7) * 43758.5453, r2 = h2 - Math.floor(h2); sg.fillStyle = `rgba(${r > 0.5 ? 255 : 60},${r > 0.5 ? 240 : 40},${r > 0.5 ? 210 : 20},0.05)`; sg.fillRect(r * W, r2 * H, 2 + r * 26, 1.5); }
  for (const p of STAND_IN) {
    sg.save();
    sg.translate(p.x, p.y); sg.rotate(p.rot);
    sg.shadowColor = 'rgba(40,20,0,0.35)'; sg.shadowBlur = 14; sg.shadowOffsetY = 6;
    sg.fillStyle = '#fbf7ee'; sg.fillRect(-p.w / 2 - 7, -p.h / 2 - 7, p.w + 14, p.h + 14);
    sg.shadowColor = 'transparent';
    sg.fillStyle = p.color; sg.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    sg.restore();
  }

  let piecesOf = null;
  /** Take the collage's pieces if it hands any over; true when they are its own. */
  function usePieces(env) {
    let h = null;
    if (env && env.otherImpl && env.otherImpl.handoff && env.otherEnv) {
      // always as they lie on the bar line, whichever frame is being asked for
      const o = env.otherEnv, d = o.beats - o.lb;
      try { h = env.otherImpl.handoff({ ...o, lb: o.beats, ab: o.ab + d, t: o.t + d * o.spb, lt: o.lt + d * o.spb, frame: Math.round((o.t + d * o.spb) * o.fps) }); } catch { h = null; }
    }
    const own = !!(h && Array.isArray(h.pieces) && h.pieces.length);
    const list = own ? h.pieces.slice(0, 24) : STAND_IN;
    const key = JSON.stringify(list);
    if (key !== piecesOf) { studio.setPieces(list); piecesOf = key; }
    return own;
  }
  usePieces(null);

  const look = (lb) => ({
    paper: true, bloom: 0.24, streak: 0, thresh: 1.05, knee: 0.5,
    exposure: 1 + 0.06 * smooth(seg(lb, 0.1, 1.5)), sat: 1 + 0.1 * smooth(seg(lb, 0.1, 1.2)),   // the old picture arrives untouched
    grain: 0.014 * smooth(seg(lb, 0, 1.2)), vignette: 0.55 * smooth(seg(lb, 0.2, 1.8)),
  });

  /** The 3D picture for scene beat b onto g. */
  function picture(g, b, spb, K, sheet) {
    const R = useGL();
    post.begin();
    studio.draw(R, b, spb, K, SHUTTER / spb, sheet);
    post.finish(b * spb, look(b));
    blitGL(g, R);
  }

  // one held picture is asked for two or three times (24 into 60): keep the last one
  const held = makeCanvas(), hg = held.getContext('2d');
  let heldKey = null;

  // the first frames through a new chain come out black: draw two before the film asks for any
  for (let i = 0; i < 2; i++) { picture(hg, 6, 0.48, 2, i ? null : standIn); R0.getContext().finish(); await new Promise((r) => setTimeout(r, 30)); }

  // ---- the rows -------------------------------------------------------------------------------------------------------
  const cellX = (i) => DOCK.x + i * ADV;
  const swapP = (env) => seg(env.x, 0.04, 0.5);
  const PILL_SHADE = ['rgba(150,20,70,0.5)', 9, 5], DOT_SHADE = ['rgba(120,44,84,0.4)', 5, 3];

  /** A letter that has just arrived: it lands squashed and springs up. a = seconds since. */
  const pop = (a) => { if (!(a >= 0) || a > 0.6) return [1, 1]; const k = Math.exp(-a * 13) * Math.cos(a * 36); return [1 + 0.2 * k, 1 - 0.3 * k]; };

  /** One letter of the film's mono in its cell (left edge x, baseline y), squashed about its foot. */
  function glyph(g, ch, x, y, colour, sx = 1, sy = 1, bold = true) {
    g.fillStyle = colour;
    if (sx === 1 && sy === 1) { g.fillText(ch, x + ADV / 2, y); return; }
    g.save();
    g.translate(x + ADV / 2, y + 4);
    g.scale(sx, sy);
    g.fillText(ch, 0, -4);
    g.restore();
  }
  const setType = (g, bold = true) => { g.font = `${bold ? 700 : 400} ${DOCK.size}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; };

  /** A cream slab with a soft shadow: x0..x1, y0..y1. alpha is the face's own opacity; sweep is the polish bar (0..1) or -1. */
  function slab(g, x0, y0, x1, y1, r, alpha, sweep = -1) {
    g.save();
    // its shadow on the scene, then the slab's edge, then its face
    g.shadowColor = 'rgba(128,40,84,0.36)'; g.shadowBlur = 36; g.shadowOffsetY = 18;
    g.fillStyle = `rgba(231,191,192,${alpha})`;
    g.beginPath(); g.roundRect(x0, y0 + 7, x1 - x0, y1 - y0, r); g.fill();
    g.shadowColor = 'transparent';
    const face = g.createLinearGradient(0, y0, 0, y1);
    face.addColorStop(0, `rgba(255,251,244,${alpha})`); face.addColorStop(0.55, `rgba(253,243,232,${alpha})`); face.addColorStop(1, `rgba(248,228,218,${alpha})`);
    g.fillStyle = face;
    g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, r); g.fill();
    g.clip();
    // a softbox lies along its upper edge, and one bar of light crosses it on the polish
    const hh = Math.min(40, (y1 - y0) * 0.4);
    const top = g.createLinearGradient(0, y0, 0, y0 + hh);
    top.addColorStop(0, 'rgba(255,255,255,0.9)'); top.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = top;
    g.fillRect(x0, y0, x1 - x0, hh);
    if (sweep > 0 && sweep < 1) {
      const sx = lerp(PLATE.x0 - 320, PLATE.x1 + 60, sweep);
      const bar = g.createLinearGradient(sx, 0, sx + 300, 0);
      bar.addColorStop(0, 'rgba(255,255,255,0)'); bar.addColorStop(0.5, 'rgba(255,255,255,0.85)'); bar.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = bar;
      g.transform(1, 0, -0.45, 1, 0.45 * y1, 0);
      g.fillRect(sx, y0, 300, y1 - y0);
    }
    g.restore();
  }
  const sweepAt = (lb) => ease.inOutCubic(seg(lb, TL.SHEEN - 0.1, TL.SHEEN + 1.3));

  function plate(g, env) {
    const { x0, y0, y1, r } = PLATE;
    let x1 = PLATE.x1;
    if (env.other && env.role === 'in') { const k = Math.floor(swapP(env) * (DOCK.cols + 4)); x1 = Math.max(x0 + 2 * r, Math.min(x1, DOCK.x - ADV + k * ADV - 6)); if (k < 3) return; }
    slab(g, x0, y0, x1, y1, r, 1, sweepAt(env.lb));
  }

  /** The terminal's two rows: what Claude printed on a lighter plate that grows with the line, the prompt on its own. */
  function dock(g, env, part) {
    const m = env.term, spb = env.spb;
    if (part !== 'C' && m.last) {
      const l = m.last, y = DOCK.rowB;
      const say = l.kind === 'say', n = say ? l.chars : l.text.length;
      const k = l.kind === 'tool' ? Math.max(0, l.text.indexOf('(')) : say ? l.text.length : 0;
      const col0 = l.kind === 'result' ? 5 : 2;
      const RUN = 0.012;                                               // beats between letters as the line runs in
      const shown = say ? n : Math.min(n, Math.floor(l.age / RUN) + 1);
      // the plate reaches as far as the line has run
      const reach = clamp(l.age / RUN + 1.5, 0, n + 0.6);
      slab(g, PLATE.x0, y - 60, cellX(col0) + reach * ADV + 22, y + 26, 26, 0.85, sweepAt(env.lb));
      if (l.kind === 'result') {
        const [sx, sy] = pop(l.age * spb);
        g.save();
        g.translate(cellX(2) + ADV / 2, y + 4); g.scale(sx, sy);
        g.strokeStyle = INK.soft; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(0, -46); g.lineTo(0, -10); g.lineTo(24, -10); g.stroke();
        g.restore();
      } else {
        const done = l.kind === 'tool' && l.age >= 0.35;
        const [sx, sy] = pop((done ? l.age - 0.35 : l.age) * spb);
        L.put(g, say ? 'dotSay' : done ? 'dotDone' : 'dotRun', cellX(0), y, { sx, sy, shadow: DOT_SHADE });
      }
      for (let i = 0; i < shown; i++) {
        const ch = l.text[i];
        if (ch === ' ') continue;
        const [sx, sy] = pop((l.age - (say ? 0 : i * RUN)) * spb);
        setType(g, i < k || say);
        glyph(g, ch, cellX(col0 + i), y, i < k || say ? INK.plum : INK.soft, sx, sy);
      }
    }
    if (part === 'B') return;
    plate(g, env);
    const c = m.rowC, y = DOCK.rowC, sent = c.mode === 'cmd';
    // the prompt sign: always there, in the candy pink
    setType(g, true);
    glyph(g, '>', cellX(0), y, INK.pink);
    setType(g, !sent);
    for (let i = 0; i < c.n; i++) {
      const ch = c.text[i];
      if (ch === ' ') continue;
      const [sx, sy] = pop(c.keyAge(i) * spb);
      glyph(g, ch, cellX(2 + i), y, sent ? INK.soft : INK.plum, sx, sy);
    }
    if (c.cursor) {
      // the cursor is one of the pills: it stands up on the beat and ducks on the half, hops along as letters land,
      // and pops onto the plate when the row is cleared for the next prompt
      const ph = m.ab - Math.floor(m.ab), typing = c.n > 0 && c.keyAge(c.n - 1) < 0.75;
      let sy = typing || ph < 0.5 ? 1 + 0.1 * Math.exp(-ph * 10) * Math.cos(ph * 30) * (typing ? 0 : 1) : 0.62 + 0.38 * Math.exp(-(ph - 0.5) * 16);
      let sx = 1 + (1 - sy) * 0.45, dy = 0;
      if (c.n > 0) { const a = c.keyAge(c.n - 1) * spb; if (a < 0.1) dy = -9 * Math.sin((a / 0.1) * Math.PI); }
      const t = m.typing;
      if (t && c.n === 0) { const a = (m.lb - (t.start - (script.T.clear ?? 1))) * spb; const s2 = a < 0 ? 1 : clamp(spring(a, 3.6, 0.36), 0, 1.5); sx *= s2; sy *= s2; }
      L.put(g, 'pill', cellX(2 + c.n) + 3, y, { sx, sy, dy, shadow: PILL_SHADE });
    }
  }

  /** The style's tag, on its own small plate. */
  function tag(g, env) {
    if (!env.tag) return;
    const a = (env.lb - 1.25) * env.spb;
    if (a <= 0) return;
    const s2 = clamp(spring(a, 3.2, 0.42), 0, 1.4);
    const str = `${env.tag.num}/${env.tag.of} ${env.tag.name}`;
    const w = str.length * ADV * TAG.k;
    g.save();
    g.translate(TAG.x, TAG.y);
    g.scale(s2, s2);
    slab(g, -26, -48, w + 26, 24, 28, 0.9, sweepAt(env.lb));
    g.scale(TAG.k, TAG.k);
    setType(g, true);
    for (let i = 0; i < str.length; i++) {
      if (str[i] === ' ') continue;
      const [sx, sy] = pop(a - 0.06 - i * 0.012);
      glyph(g, str[i], i * ADV, 0, INK.plum, sx, sy);
    }
    g.restore();
  }

  // ---- out-of-focus highlights: the rose-gold pearls, where the lens has let go of them --------------------------------
  /** [{ x, y, r, color, a }] for scene beat b: frame pixels, blur radius, how strongly it shows. */
  function highlights(b, spb) {
    studio.pose(b, spb);
    studio.aim(0, 1);
    const out = [];
    for (const s of studio.slots) {
      if (s.kind !== 'pearl') continue;
      const p = studio.pearlAt(s);
      if (!p) continue;
      const [x, y] = studio.project(p[0] - 0.12, p[1] + PEARL_R * 0.55, p[2]);
      const coc = studio.blurOf(p[0], p[1], p[2]);
      if (x < -60 || x > W + 60 || y < -60 || y > H + 60 || coc < 4.5) continue;
      out.push({ x, y, r: coc * 2.6 + 6, color: y < 540 ? '#ffe3ea' : '#ffe9dc', a: smooth(seg(coc, 4.5, 12)) });
    }
    return out;
  }
  function bokeh(g, b, spb) {
    const list = highlights(b, spb);
    if (!list.length) return;
    g.save();
    g.globalCompositeOperation = 'screen';
    for (const h of list) {
      const gr = g.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r);
      gr.addColorStop(0, `rgba(255,240,232,${0.5 * h.a})`); gr.addColorStop(0.35, `rgba(255,226,222,${0.3 * h.a})`); gr.addColorStop(1, 'rgba(255,220,220,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(h.x, h.y, h.r, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  // the scene's own clock: 24 pictures a second, counted from the landing so that it starts a picture
  // the polish: two star glints where the softboxes' sweep crosses the button's shoulder and the triangle's tip
  const GLINTS = [[-2.7, 1.55, -1.9, TL.SHEEN + 0.5, 1], [2.05, 2.1, 0.1, TL.SHEEN + 1, 0.72]];
  function glints(g, env) {
    for (const [x, y, z, t0, size] of GLINTS) {
      const a = (env.lb - t0) * env.spb;
      if (a < -0.05 || a > 0.42) continue;
      const v = a < 0 ? (a + 0.05) / 0.05 : Math.exp(-a * 9);
      const [px, py] = studio.project(x, y, z);
      const r = 125 * size * (0.55 + 0.45 * v), w = 4.5 * size;
      g.save();
      g.globalCompositeOperation = 'screen';
      g.translate(px, py);
      g.rotate(0.3 + a * 1.2);
      const core = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.45);
      core.addColorStop(0, `rgba(255,255,255,${0.95 * v})`); core.addColorStop(0.25, `rgba(255,236,232,${0.4 * v})`); core.addColorStop(1, 'rgba(255,220,225,0)');
      g.fillStyle = core;
      g.beginPath(); g.arc(0, 0, r * 0.45, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 4; k++) {
        const len = k % 2 ? r * 0.55 : r;
        const ray = g.createLinearGradient(0, 0, len, 0);
        ray.addColorStop(0, `rgba(255,255,255,${0.95 * v})`); ray.addColorStop(1, 'rgba(255,240,240,0)');
        g.fillStyle = ray;
        g.beginPath(); g.moveTo(0, -w); g.lineTo(len, 0); g.lineTo(0, w); g.closePath(); g.fill();
        g.rotate(Math.PI / 2);
      }
      g.restore();
    }
  }

  const sceneBeat = (env) => { const lb = Math.max(0, env.lb); const q = Math.floor((lb - TL.DROP) * env.spb * CADENCE + 1e-6); return [q, TL.DROP + q / CADENCE / env.spb]; };

  const api = {
    dock,
    /** For the shot that follows: this picture's out-of-focus highlights, biggest first. */
    handoff(env) {
      const [, b] = sceneBeat(env);
      const lights = highlights(b + 0.5 * SHUTTER / env.spb, env.spb).sort((p, q) => q.r - p.r).slice(0, 8).map(({ x, y, r, color }) => ({ x, y, r, color }));
      return { lights };
    },
    sfx: [
      { b: 0, s: 'soft_inflate', g: 0.9 },
      { b: TL.DROP - 0.06, s: 'soft_fall', a: 'peak', g: 0.6 },
      { b: TL.DROP, s: 'soft_land', a: 'peak', g: 1.1 },
      { b: TL.DROP + 0.12, s: 'soft_pops', g: 0.7 },
      { b: 3, s: 'soft_press', a: 'peak', g: 0.55 },
      { b: TL.SHEEN, s: 'soft_shine', g: 0.8 },
      { b: TL.SHEEN + 0.5, s: 'soft_ting', a: 'peak', g: 0.5 },
      { b: TL.SHEEN + 1, s: 'soft_ting', a: 'peak', g: 0.4 },
      { b: 5, s: 'soft_press', a: 'peak', g: 0.45 },
      { b: 6, s: 'soft_press', a: 'peak', g: 0.4 },
      { b: 7, s: 'soft_press', a: 'peak', g: 0.35 },
    ],
    render(g, env) {
      const { spb } = env;
      const lb = Math.max(0, env.lb);
      const [q, b] = sceneBeat(env);
      const handing = lb < HAND + 0.6;
      if (handing) usePieces(env);
      // the sheet on the floor is the picture before this shot, unless that shot is not built yet
      const real = !!(env.other && env.otherImpl && !env.otherImpl.placeholder);
      const sheet = handing ? (real ? env.other : standIn) : null;
      if (sheet || heldKey !== q) {
        picture(hg, b, spb, K_PASSES, sheet);
        heldKey = sheet ? null : q;
      }
      g.drawImage(held, 0, 0);
      bokeh(g, b + 0.5 * SHUTTER / spb, spb);
      glints(g, env);
      tag(g, env);
      if (env.noDock) return;
      if (env.other && env.otherImpl && env.otherImpl.dock && env.role === 'in') swapDock(g, env, dock, swapP(env));
      else dock(g, env);
    },
  };
  return api;
}
