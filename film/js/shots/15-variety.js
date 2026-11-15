// 15 Variety Captions: posting. "post it." / "That part is yours."
// The calm glass card of the shot before stands up into a phone, the beat comes back, and the film plays on the phone
// (stills of its own shots, one a beat, flicked up like a feed under a thumb, in a shaking hand) while loud captions
// react to it from all sides: WAIT—, ???, IT'S ALL CODE?! in a burst, a small aside, a stamp. The phone is the talent:
// it sweats, crouches and jumps. Every caption arrives a few frames after the thing it reacts to.
//
// The style's home is a 9:16 film; here the 9:16 lives in the phone and the captions own the wide frame, over the
// phone's own picture blown up and blurred (the way a wide screen shows an upright clip) and graded to two loud colours.
// After the shot's last bar line (lb 8) the captions pop away by themselves; the phone and the field stay.
//
// For the shot that follows: handoff(env) gives the phone's box, layers() paints chosen parts, drawPhone() paints the
// phone anywhere with any picture on its screen.

import { DOCK } from '../term.js';
import { clamp, lerp, seg, smooth, ease, tw, spring, decay, rng, hash, noise1, TAU, deg } from '../util.js';

const POPF = '"Mochiy Pop One"', ROWF = '"Rounded Mplus Black"', HANDF = '"Yusei Magic"';
const C = {
  pink: '#FF3D8B', hot: '#FF2468', yellow: '#FFE53B', gold: '#FFB21E', cyan: '#2BD9FF', blue: '#1479FF',
  white: '#FFFFFF', ink: '#27124F', red: '#FF2B4E', sweat: '#8FE9FF', body: '#17122B',
};
const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

// Local beats. A "moment" is on a beat or half-beat (so is its sound); the caption for it pops LATE beats after.
const LATE = 0.15;
const T = { play: 0.5, wait: 0.5, what: 2, sweat: 2.5, clear: 3.5, hero: 4, code: 4.5, aside: 5, spark: 5.5, stamp: 6, out: 8 };

// the wide frame's two colours [dark, light]; they change on the big moments only, not on every cut
const VIO = ['#4B21C8', '#FF8FD2'], BLU = ['#0F52DA', '#86ECFF'], PNK = ['#DE2270', '#FFE56B'];
// The film on the phone: one still a beat at most, flicked up like a feed under a thumb, never cut.
// [local beat, shot, zoom, pan x, pan y, drift x a second] (pans in still pixels; a still is 960 x 540)
const FEED = [
  [-99, 'aurora', 1.12, 0, 0, 0],          // stands in for the card's own picture when the shot is seen alone
  [0.5, 'open', 1.36, 0, -112, 0],         // held while the reply is read
  [2, 'iso', 1.05, 10, 0, 14],
  [3, 'morph', 1.0, 0, 0, 0],
  [4, 'synth', 1.0, -34, 0, 56],           // the hero, on the big caption
  [5, 'collage', 1.0, 48, 0, -12],
  [6, 'soft', 1.0, 0, 0, 0],
  [7, 'aurora', 1.05, 88, 0, 0],
  [8, 'end', 1.36, 0, -112, 0],
];
const FLICK = 0.15, GUTTER = 14;           // seconds a flick takes; the gap between two posts

// The rows' hand-over (local beats): the letters change costume over four frames; the old prompt's bar winds up and
// snaps in onto the new prompt over eight.
const HAND = { swap0: 0.03, swap1: 0.17, bar0: 0.07, bar1: 0.345 };

const PH = { w: 428, h: 760, r: 50, bezel: 13 };          // the phone, upright
const HOME = { x: 960, y: 424 };                          // where it stands at first
const SIDE = { x: 632, y: 428, rot: deg(5) };             // where it lands when the big caption needs the room
const CARD = { x: 580, y: 206, w: 760, h: 428, r: 40 };   // the glass card it stands up from, if the shot before gives none

const POP = (t) => (t <= 0 ? 0 : spring(t, 4.2, 0.52));   // 0 to 1.15 to 1 in about eight frames of thirty
const GONE = (t) => (t <= 0 ? 1 : Math.max(0, 1 - ease.inBack(clamp(t / 0.13), 2.4)));   // swells a little, then pops away

function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }

/** A spiky burst, drawn by hand: uneven points. */
function burstPath(g, cx, cy, rx, ry, n, inner, seed, rot = 0, jit = 0.14, add = false) {
  const R = rng(seed);
  if (!add) g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * TAU + (R() - 0.5) * (TAU / (n * 2)) * 0.45;
    const k = i % 2 ? inner * (1 + (R() - 0.5) * jit) : 1 + (R() - 0.5) * jit * 2;
    const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.closePath();
}

/** Lines that rush in on a point from outside an ellipse (manga concentration lines). */
function rushLines(g, cx, cy, rx, ry, n, seed) {
  const R = rng(seed), far = 2600;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = ((i + R() * 0.9) / n) * TAU, wd = (0.0035 + R() * R() * 0.02), r0 = 1 + R() * 0.32;
    g.moveTo(cx + Math.cos(a) * rx * r0, cy + Math.sin(a) * ry * r0);
    g.lineTo(cx + Math.cos(a - wd) * far, cy + Math.sin(a - wd) * far);
    g.lineTo(cx + Math.cos(a + wd) * far, cy + Math.sin(a + wd) * far);
    g.closePath();
  }
}

function sparklePath(g, r) {
  const k = r * 0.17;
  g.beginPath();
  g.moveTo(0, -r); g.quadraticCurveTo(k, -k, r * 0.78, 0); g.quadraticCurveTo(k, k, 0, r);
  g.quadraticCurveTo(-k, k, -r * 0.78, 0); g.quadraticCurveTo(-k, -k, 0, -r);
  g.closePath();
}

function dropPath(g, r) {
  g.beginPath();
  g.moveTo(0, -r * 1.75);
  g.bezierCurveTo(r * 0.35, -r * 0.9, r, -r * 0.35, r, 0.12 * r);
  g.arc(0, 0.12 * r, r, 0, Math.PI);
  g.bezierCurveTo(-r, -r * 0.35, -r * 0.35, -r * 0.9, 0, -r * 1.75);
  g.closePath();
}

export default async function make(ctx) {
  const { W, H, font, image, makeCanvas } = ctx;
  await Promise.all([
    font('Mochiy Pop One', '/assets/variety/MochiyPopOne-Regular.ttf'),
    font('Rounded Mplus Black', '/assets/variety/MPLUSRounded1c-Black.ttf'),
    font('Yusei Magic', '/assets/variety/YuseiMagic-Regular.ttf'),
  ]);

  // ---- the film's own frames, and each one blown up and blurred for the wide frame behind the phone ----
  const names = [...new Set(FEED.map((c) => c[1]))];
  const STILL = {}, SOFT = {};
  await Promise.all(names.map(async (n, i) => {
    let im = null;
    try { im = await image(`/assets/thumbs/${n}.png`); } catch { /* not made yet: a plain card stands in */ }
    const c = makeCanvas(960, 540), s = c.getContext('2d');
    if (im) s.drawImage(im, 0, 0, 960, 540);
    else { s.fillStyle = `hsl(${(i * 47) % 360} 45% 30%)`; s.fillRect(0, 0, 960, 540); }
    STILL[n] = c;
    // blurred, turned to grey and levelled, so every still gives the same overall brightness (no flashing from cut
    // to cut) and takes whatever two colours the frame is wearing
    const b = makeCanvas(384, 216), q = b.getContext('2d', { willReadFrequently: true });
    q.filter = 'blur(10px)';
    q.drawImage(c, -38, -22, 460, 260);
    q.filter = 'none';
    const id = q.getImageData(0, 0, 384, 216), d = id.data, N = d.length / 4, lum = new Float32Array(N);
    let m = 0;
    for (let k = 0; k < N; k++) { lum[k] = (0.2126 * d[k * 4] + 0.7152 * d[k * 4 + 1] + 0.0722 * d[k * 4 + 2]) / 255; m += lum[k]; }
    m /= N;
    let sd = 0;
    for (let k = 0; k < N; k++) sd += (lum[k] - m) ** 2;
    sd = Math.sqrt(sd / N);
    const gain = Math.min(3, 0.2 / Math.max(sd, 0.02));
    for (let k = 0; k < N; k++) { const v = Math.round(255 * clamp(0.42 + (lum[k] - m) * gain)); d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v; d[k * 4 + 3] = 255; }
    q.putImageData(id, 0, 0);
    SOFT[n] = b;
  }));
  const DUOS = [[-99, PNK], [T.what, VIO], [T.hero, BLU], [T.stamp, VIO]];
  const duoAt = (lb) => { let d = DUOS[0][1]; for (const [at, duo] of DUOS) if (lb >= at) d = duo; return d; };
  const DOTS = (() => {
    const c = makeCanvas(38, 38), q = c.getContext('2d');
    q.fillStyle = '#fff'; q.beginPath(); q.arc(19, 19, 6.5, 0, TAU); q.fill();
    return q.createPattern(c, 'repeat');
  })();
  const feedAt = (lb) => { let k = 0; for (let i = 0; i < FEED.length; i++) if (lb >= FEED[i][0]) k = i; return k; };
  /** How far the flick to the still at lb has come: 0 as it starts, 1 once the still is in place. */
  const flickAt = (lb, spb) => { const i = feedAt(lb); return i > 0 ? ease.outQuart(clamp(((lb - FEED[i][0]) * spb) / FLICK)) : 1; };

  // ---- measuring ----
  const mg = makeCanvas(8, 8).getContext('2d');
  function lay(text, fam, size, track = 0) {
    mg.font = `${size}px ${fam}`;
    let x = 0;
    const chars = [...text].map((ch) => { const w = mg.measureText(ch).width; const o = { ch, x: x + w / 2, w }; x += w + track; return o; });
    const w = x - track;
    chars.forEach((o) => { o.x -= w / 2; });
    return { chars, w, size, fam };
  }

  /**
   * Layered lettering: fill, then strokes from the inside out (st.strokes: [{ w: distance from the letter's edge, c }]),
   * then a hard shadow of the whole shape. Drawn in passes so the strokes of neighbouring letters join up.
   * tf(i) gives letter i its own pose: { s, dx, dy, rot } or null to leave it out.
   */
  function layered(g, L, st, tf) {
    const P = [];
    for (let i = 0; i < L.chars.length; i++) {
      const o = L.chars[i];
      if (o.ch === ' ') continue;
      const p = tf ? tf(i, o) : { s: 1 };
      if (!p || p.s <= 0.001) continue;
      P.push({ o, i, s: p.s, x: o.x + (p.dx || 0), y: (p.dy || 0), rot: p.rot || 0, sx: p.sx || 1 });
    }
    if (!P.length) return;
    const piv = -L.size * (st.pivot ?? 0.36);
    g.font = `${L.size}px ${L.fam}`;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.lineCap = 'round';
    const each = (fn, ox = 0, oy = 0) => {
      for (const p of P) {
        g.save();
        g.translate(p.x + ox, p.y + oy + piv); g.rotate(p.rot); g.scale(p.s * p.sx, p.s); g.translate(0, -piv);
        fn(p);
        g.restore();
      }
    };
    const outer = st.strokes[st.strokes.length - 1];
    if (st.shadow) {
      g.strokeStyle = st.shadow.c; g.fillStyle = st.shadow.c; g.lineWidth = outer.w * 2;
      each((p) => { g.strokeText(p.o.ch, 0, 0); g.fillText(p.o.ch, 0, 0); }, st.shadow.dx, st.shadow.dy);
    }
    for (let k = st.strokes.length - 1; k >= 0; k--) {
      g.strokeStyle = st.strokes[k].c; g.lineWidth = st.strokes[k].w * 2;
      each((p) => g.strokeText(p.o.ch, 0, 0));
    }
    each((p) => { g.fillStyle = typeof st.fill === 'function' ? st.fill(g, p.i, L.size) : st.fill; g.fillText(p.o.ch, 0, 0); });
    if (st.shine) {
      // a small wet highlight on the upper left of every letter
      g.fillStyle = 'rgba(255,255,255,0.9)';
      each((p) => { g.beginPath(); g.ellipse(-p.o.w * 0.2, -L.size * 0.58, L.size * 0.035, L.size * 0.075, deg(35), 0, TAU); g.fill(); });
    }
  }
  const grad = (a, b, top = 0.78, bot = 0.02) => (g, i, size) => {
    const gr = g.createLinearGradient(0, -size * top, 0, -size * bot);
    gr.addColorStop(0, a); gr.addColorStop(0.5, a); gr.addColorStop(0.62, b); gr.addColorStop(1, b);
    return gr;
  };

  // ---- the captions ----
  const L_WAIT = lay('WAIT—', POPF, 130, 4);
  const L_Q = lay('?', POPF, 230);
  const L_ITS = lay("IT'S ALL", POPF, 132, 6);
  const L_CODE = lay('CODE?!', POPF, 200, 8);
  const L_ASIDE = lay('(no camera)', HANDF, 80, 2);
  const ST_WAIT = { fill: grad('#E8FBFF', C.cyan), strokes: [{ w: 4, c: C.ink }, { w: 15, c: C.white }, { w: 24, c: C.blue }], shadow: { dx: 9, dy: 12, c: C.ink }, shine: true };
  const ST_Q = { fill: grad('#FFF27A', C.gold), strokes: [{ w: 5, c: C.ink }, { w: 17, c: C.white }, { w: 27, c: C.pink }], shadow: { dx: 10, dy: 13, c: C.ink }, shine: true };
  const ST_ITS = { fill: grad(C.white, '#D8F6FF'), strokes: [{ w: 12, c: C.ink }, { w: 20, c: C.cyan }], shadow: { dx: 8, dy: 10, c: C.ink } };
  const ST_CODE = { fill: grad('#FF86B4', C.hot), strokes: [{ w: 6, c: C.ink }, { w: 20, c: C.white }, { w: 30, c: C.ink }], shadow: { dx: 12, dy: 15, c: C.ink }, shine: true };
  const ST_ASIDE = { fill: C.white, strokes: [{ w: 7, c: C.ink }], shadow: { dx: 4, dy: 5, c: C.ink }, pivot: 0.3 };
  const BURST = { x: 1270, y: 400, rx: 496, ry: 330 };

  // the stamp, inked once
  const STAMP = (() => {
    const w = 548, h = 222, pad = 40, c = makeCanvas(w + pad * 2, h + pad * 2), s = c.getContext('2d');
    s.translate(pad, pad);
    s.fillStyle = C.white; rr(s, -10, -10, w + 20, h + 20, 40); s.fill();
    const ink = makeCanvas(w, h), k = ink.getContext('2d');
    k.strokeStyle = C.red; k.fillStyle = C.red; k.lineJoin = 'round';
    k.lineWidth = 11; rr(k, 8, 8, w - 16, h - 16, 26); k.stroke();
    k.lineWidth = 3.5; rr(k, 24, 24, w - 48, h - 48, 14); k.stroke();
    k.textAlign = 'center'; k.textBaseline = 'alphabetic';
    const sm = lay('MADE IN A', ROWF, 44, 9);
    k.font = `44px ${ROWF}`;
    for (const o of sm.chars) k.fillText(o.ch, w / 2 + o.x, 82);
    for (const sx of [-1, 1]) { k.save(); k.translate(w / 2 + sx * (sm.w / 2 + 42), 66); sparklePath(k, 19); k.fill(); k.restore(); }
    const bs = Math.floor(100 * Math.min(1, (w - 84) / lay('TERMINAL', ROWF, 100, 5).w)), big = lay('TERMINAL', ROWF, bs, 5);
    k.font = `${bs}px ${ROWF}`;
    for (const o of big.chars) k.fillText(o.ch, w / 2 + o.x, 178);
    // the ink did not take everywhere
    const R = rng(1508);
    k.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 520; i++) { k.globalAlpha = 0.5 + R() * 0.5; k.beginPath(); k.arc(R() * w, R() * h, 0.6 + R() * R() * 3.2, 0, TAU); k.fill(); }
    for (let i = 0; i < 7; i++) { k.globalAlpha = 0.35; k.lineWidth = 1 + R() * 2; k.beginPath(); const y = R() * h, x = R() * w; k.moveTo(x, y); k.lineTo(x + 60 + R() * 160, y + (R() - 0.5) * 16); k.stroke(); }
    s.drawImage(ink, 0, 0);
    return { c, w, h, pad, x: -78, y: 182, rot: deg(-11) };      // where it sits on the phone, from the phone's centre
  })();

  // ---- the phone ----
  const cardOf = (env) => {
    const h = env && env.role === 'in' && env.otherImpl && env.otherImpl.handoff ? env.otherImpl.handoff(env.otherEnv) : null;
    return h && h.card ? { ...CARD, ...h.card } : CARD;
  };

  /** Where the phone is, and how it is bent, at this instant. */
  function phoneAt(env) {
    const lb = env.lb, spb = env.spb, card = cardOf(env), tt = env.lt;
    const up = lb <= 0 ? 0 : spring(lb * spb, 2.7, 0.55);                 // stands up, a little too far, settles
    const mv = tw(lb, 0, 0.7, ease.outCubic);
    let cx = lerp(card.x + card.w / 2, HOME.x, mv), cy = lerp(card.y + card.h / 2, HOME.y, mv);
    const w = lerp(card.h, PH.w, mv), h = lerp(card.w, PH.h, mv);
    let rot = (-Math.PI / 2) * (1 - up), sx = 1, sy = 1;
    const live = smooth(seg(lb, 0.5, 1.3));                              // held in a hand
    cx += (noise1(tt * 2.3 + 3.1) - 0.5) * 16 * live; cy += (noise1(tt * 1.9 + 11.7) - 0.5) * 14 * live;
    rot += (noise1(tt * 1.6 + 7.3) - 0.5) * 0.055 * live;
    if (lb >= 1) { const k = decay((lb - Math.floor(lb)) * spb, 0.05); sx *= 1 + 0.022 * k; sy *= 1 + 0.022 * k; }   // nods on the beat
    if (lb < T.hero) {                                                   // crouches before the jump
      const an = smooth(seg(lb, 3.5, 3.95));
      sy *= 1 - 0.075 * an; sx *= 1 + 0.05 * an; cx += 18 * an; rot -= 0.04 * an;
    } else {                                                             // jumps aside, lands, wobbles
      const hp = seg(lb, T.hero, T.hero + 0.55), e = ease.outCubic(hp), air = Math.sin(Math.PI * hp);
      cx += (SIDE.x - HOME.x) * e; cy += (SIDE.y - HOME.y) * e - 40 * air;
      rot += SIDE.rot * e - 0.2 * air;
      sy *= 1 + 0.05 * air; sx *= 1 - 0.035 * air;
      const land = (lb - T.hero - 0.55) * spb;
      if (land >= 0) { const q = Math.exp(-land * 8) * Math.cos(land * 27); sy *= 1 - 0.075 * q; sx *= 1 + 0.05 * q; }
    }
    const dt = (lb - T.what) * spb;                                      // a double take when it is turned down
    if (dt >= 0) rot -= 0.11 * Math.exp(-dt * 9) * Math.cos(dt * 24);
    const hit = (lb - T.stamp) * spb;                                    // the stamp jolts it
    if (hit >= 0) { const q = Math.exp(-hit * 9) * Math.cos(hit * 30); cy += 7 * q; rot += 0.012 * q; }
    return { cx, cy, w, h, rot, sx, sy, r: lerp(card.r, PH.r, mv), k: smooth(seg(lb, 0, 0.32)), card };
  }

  /**
   * The phone at P ({ cx, cy, w, h, rot, sx, sy, r, k }; k = 0 is a bare card, 1 the whole phone), with
   * screen(g, sw, sh) painting its picture around the origin.
   */
  function drawPhone(g, P, screen) {
    const { w, h } = P, k = P.k ?? 1, sx = P.sx ?? 1, sy = P.sy ?? 1;
    g.save();
    g.translate(P.cx, P.cy); g.rotate(P.rot || 0); g.translate(0, h / 2); g.scale(sx, sy); g.translate(0, -h / 2);
    g.lineJoin = 'round';
    if (k > 0) {
      const c = Math.cos(-(P.rot || 0)), s = Math.sin(-(P.rot || 0)), ox = 16 * k, oy = 20 * k;   // the shadow falls the same way however it leans
      g.fillStyle = rgba(C.ink, 0.5); g.strokeStyle = rgba(C.ink, 0.5); g.lineWidth = 24 * k;
      rr(g, -w / 2 + ox * c - oy * s, -h / 2 + ox * s + oy * c, w, h, P.r); g.fill(); g.stroke();
      g.strokeStyle = C.ink; g.lineWidth = 30 * k; rr(g, -w / 2, -h / 2, w, h, P.r); g.stroke();
      g.strokeStyle = C.white; g.lineWidth = 20 * k; rr(g, -w / 2, -h / 2, w, h, P.r); g.stroke();
    }
    g.fillStyle = C.body; rr(g, -w / 2, -h / 2, w, h, P.r); g.fill();
    const b = PH.bezel * k, sw = w - 2 * b, sh = h - 2 * b;
    g.save();
    rr(g, -sw / 2, -sh / 2, sw, sh, P.r - b); g.clip();
    screen(g, sw, sh);
    if (k > 0) {
      const gl = g.createLinearGradient(-sw / 2, -sh / 2, sw / 2, sh * 0.1);                      // glass
      gl.addColorStop(0, `rgba(255,255,255,${0.2 * k})`); gl.addColorStop(0.42, `rgba(255,255,255,${0.05 * k})`); gl.addColorStop(0.43, 'rgba(255,255,255,0)');
      g.fillStyle = gl; g.fillRect(-sw / 2, -sh / 2, sw, sh);
    }
    g.restore();
    if (k > 0.5) { g.fillStyle = rgba(C.body, (k - 0.5) * 2); rr(g, -44, -sh / 2 + 16, 88, 24, 12); g.fill(); }
    g.restore();
  }

  /** Still i of the feed, alive like footage: a slow push and drift, a shaking hand, one snap punch-in on the hero. */
  function still(g, env, i, sw, sh) {
    const lb = env.lb, [at, name, z0, px, py, dx] = FEED[i], tt = env.lt;
    const age = Math.max(0, (lb - at) * env.spb);
    const shock = decay((lb - T.hero) * env.spb, 0.16) * (lb >= T.hero ? 1 : 0);
    let z = z0 + 0.03 * Math.min(age, 2);
    if (name === 'synth') z += 0.26 * ease.outExpo(seg((lb - T.code) * env.spb, 0, 0.09));     // punches in with CODE?!
    z *= 1 + 0.02 * decay((lb - Math.floor(lb)) * env.spb, 0.05);
    const amp = 7 + 20 * shock;
    const ch = 540 / z, cw = ch * (sw / sh);
    const cx = clamp(480 + px + dx * Math.min(age, 1.5) + (noise1(tt * 3.1 + i * 9.7) - 0.5) * amp * 2, cw / 2, 960 - cw / 2);
    const cy = clamp(270 + py / z + (noise1(tt * 2.7 + i * 5.3 + 40) - 0.5) * amp * 2, ch / 2, 540 - ch / 2);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(STILL[name], cx - cw / 2, cy - ch / 2, cw, ch, -sw / 2, -sh / 2, sw, sh);
  }

  /**
   * The phone's screen at lb. A new still comes up from below as the one before leaves upward, the way a thumb flicks
   * a feed. first(g, sw, sh), if given, paints the feed's first post (the card the phone stood up from).
   */
  function footage(g, env, sw, sh, first) {
    const lb = env.lb, i = feedAt(lb), e = flickAt(lb, env.spb);
    const post = (k) => { if (k === 0 && first) first(g, sw, sh); else still(g, env, k, sw, sh); };
    if (e < 1) {
      const step = sh + GUTTER;
      g.save(); g.translate(0, -step * e); post(i - 1); g.restore();
      g.save(); g.translate(0, step * (1 - e)); post(i); g.restore();
      g.fillStyle = C.body; g.fillRect(-sw / 2, sh / 2 - step * e, sw, GUTTER);
    } else post(i);
    // a thin line of progress along the foot of the screen: it is a film, and it is nearly over
    const p = clamp((lb + 1) / 9.5);
    g.fillStyle = 'rgba(255,255,255,0.35)'; rr(g, -sw / 2 + 26, sh / 2 - 30, sw - 52, 6, 3); g.fill();
    g.fillStyle = C.white; rr(g, -sw / 2 + 26, sh / 2 - 30, (sw - 52) * p, 6, 3); g.fill();
    g.beginPath(); g.arc(-sw / 2 + 26 + (sw - 52) * p, sh / 2 - 27, 9, 0, TAU); g.fill();
  }

  /** The wide frame behind the phone: the same picture, huge and out of focus. */
  function backdrop(g, env) {
    const lb = env.lb, i = feedAt(lb), e = flickAt(lb, env.spb), tt = env.lt;
    const z = 1.24, cw = 384 / z, ch = 216 / z;
    const cx = 192 + (noise1(tt * 1.3 + 2) - 0.5) * 14, cy = 108 + (noise1(tt * 1.1 + 9) - 0.5) * 10;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    // It follows the phone: when the feed is flicked, the new still's light comes up the field from below, behind a
    // soft edge, so no line ever crosses the frame. y0, y1: the rows of the frame to paint.
    const DH = H + 16, soft = (k, y0 = -8, y1 = H + 8) => {
      if (y1 <= y0) return;
      g.drawImage(SOFT[FEED[k][1]], cx - cw / 2, cy - ch / 2 + ((y0 + 8) / DH) * ch, cw, ((y1 - y0) / DH) * ch, -8, y0, W + 16, y1 - y0);
    };
    if (e < 1) {
      const F = 320, N = 16, edge = (DH + F) * (1 - e) - F - 8;      // the top of the soft edge, from under the frame to over it
      soft(i - 1, -8, Math.min(H + 8, edge + F));
      for (let j = 0; j < N; j++) {
        const y0 = Math.max(-8, edge + (j / N) * F), y1 = Math.min(H + 8, edge + ((j + 1) / N) * F + 0.5);
        g.globalAlpha = (j + 0.5) / N; soft(i, y0, y1);
      }
      g.globalAlpha = 1;
      soft(i, Math.max(-8, edge + F), H + 8);
    } else soft(i);
    // the grey picture takes the frame's two colours: light where it is light, dark where it is dark
    const [dark, light] = duoAt(lb);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = light; g.fillRect(-8, -8, W + 16, H + 16);
    g.globalCompositeOperation = 'screen'; g.fillStyle = dark; g.fillRect(-8, -8, W + 16, H + 16);
    g.globalCompositeOperation = 'source-over';
    // printed dots, drifting
    DOTS.setTransform(new DOMMatrix().rotateSelf(-18).translateSelf((tt * 22) % 38, (tt * 9) % 38));
    g.globalAlpha = 0.11; g.fillStyle = DOTS; g.fillRect(-8, -8, W + 16, H + 16); g.globalAlpha = 1;
    const v = g.createRadialGradient(960, 480, 520, 960, 480, 1300);
    v.addColorStop(0, rgba(C.ink, 0)); v.addColorStop(1, rgba(C.ink, 0.34));
    g.fillStyle = v; g.fillRect(-8, -8, W + 16, H + 16);
  }

  // ---- the terminal's two rows, in layered lettering on the grid ----
  const ROW = 58, cellX = (col) => DOCK.x + (col + 0.5) * DOCK.adv;
  const rowW = (ch) => { mg.font = `${ROW}px ${ROWF}`; return mg.measureText(ch).width; };
  const ST_B = { fill: grad('#FFFBC4', C.yellow, 0.74, 0), strokes: [{ w: 3, c: C.ink }, { w: 8, c: C.white }, { w: 12, c: C.ink }], shadow: { dx: 4, dy: 6, c: C.ink } };
  const ST_C = { fill: C.white, strokes: [{ w: 4.5, c: C.ink }, { w: 9.5, c: C.pink }, { w: 13, c: C.ink }], shadow: { dx: 4, dy: 6, c: C.ink } };
  const ST_SIGN = { ...ST_C, fill: C.cyan };
  function rowText(g, text, col0, y, st, poseOf) {
    const L = { size: ROW, fam: ROWF, w: 0, chars: [...text].map((ch, i) => { const w = rowW(ch); return { ch, x: cellX(col0 + i), w, q: Math.min(1, 41 / w) }; }) };
    g.save(); g.translate(0, y);
    layered(g, L, st, (i, o) => { const p = poseOf ? poseOf(i) : { s: 1 }; return p && { ...p, sx: o.q }; });
    g.restore();
  }
  /** The cursor: a block the colour of a heart, jumping on every beat. */
  function cursor(g, env, col, y, hit = 0) {
    const f = env.lb - Math.floor(env.lb), up = f < 0.55 ? Math.sin((f / 0.55) * Math.PI) : 0, sq = decay((f - 0.55) * env.spb, 0.035) * (f >= 0.55 ? 1 : 0);
    const w = 32, h = 58, x = cellX(col), yb = y + 7;
    g.save();
    // hit: something has just run into it from the right (the old prompt's bar): it is pressed thin and springs back
    g.translate(x - 7 * hit, yb - 20 * up); g.scale((1 + 0.2 * sq - 0.08 * up) * (1 - 0.3 * hit), (1 - 0.22 * sq + 0.1 * up) * (1 + 0.2 * hit)); g.rotate(deg(-4) * up - deg(7) * hit);
    g.lineJoin = 'round';
    g.fillStyle = C.ink; g.strokeStyle = C.ink; g.lineWidth = 22; rr(g, -w / 2 + 4, -h + 6, w, h, 8); g.fill(); g.stroke();
    g.strokeStyle = C.ink; g.lineWidth = 22; rr(g, -w / 2, -h, w, h, 8); g.stroke();
    g.strokeStyle = C.white; g.lineWidth = 13; rr(g, -w / 2, -h, w, h, 8); g.stroke();
    const gr = g.createLinearGradient(0, -h, 0, 0); gr.addColorStop(0, '#FF7FB0'); gr.addColorStop(0.5, '#FF7FB0'); gr.addColorStop(0.6, C.hot); gr.addColorStop(1, C.hot);
    g.fillStyle = gr; rr(g, -w / 2, -h, w, h, 8); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(-7, -h + 13, 3.5, 7, deg(30), 0, TAU); g.fill();
    g.restore();
  }
  /** fx.land: seconds since the old prompt's bar landed on this one; the knock runs through the letters, right to left. */
  function dock(g, env, part, fx) {
    const m = env.term, spb = env.spb, wig = (i) => deg(1.6) * Math.sin(env.lb * Math.PI + i * 0.9);
    const land = fx && fx.land >= 0 ? fx.land : -1, knock = (stepsFromEnd) => (land < 0 ? 0 : decay(land - 0.012 * stepsFromEnd, 0.045));
    if (part !== 'C' && m.last) {
      const o = m.last, text = o.kind === 'say' ? o.text.slice(0, o.chars) : o.text;
      const col0 = o.kind === 'result' ? 5 : 2, rate = o.kind === 'say' ? 0.03 : 0;
      const k0 = POP(o.age * spb);
      // Claude's bullet
      g.save(); g.translate(cellX(0), DOCK.rowB - 21); g.scale(k0, k0); g.lineJoin = 'round';
      g.fillStyle = C.ink; g.beginPath(); g.arc(4, 6, 27, 0, TAU); g.fill();
      g.beginPath(); g.arc(0, 0, 27, 0, TAU); g.fill();
      g.fillStyle = C.white; g.beginPath(); g.arc(0, 0, 22.5, 0, TAU); g.fill();
      g.fillStyle = C.ink; g.beginPath(); g.arc(0, 0, 17, 0, TAU); g.fill();
      g.fillStyle = C.gold; g.beginPath(); g.arc(0, 0, 14, 0, TAU); g.fill();
      g.fillStyle = C.yellow; g.beginPath(); g.arc(0, -2.5, 11.5, 0, TAU); g.fill();
      g.restore();
      rowText(g, text, col0, DOCK.rowB, ST_B, (i) => { const a = (o.age - i * rate) * spb; return { s: POP(a), dy: -16 * (1 - spring(a, 3.6, 0.4)), rot: wig(i) }; });
    }
    if (part === 'B') return;
    const c = m.rowC;
    rowText(g, '>', 0, DOCK.rowC, ST_SIGN, () => ({ s: 1 + 0.16 * knock(c.n + 2), dy: -7 * knock(c.n + 2), rot: deg(-3) * Math.sin(env.lb * Math.PI) }));
    rowText(g, c.text.slice(0, c.n), 2, DOCK.rowC, ST_C, (i) => {
      const a = c.keyAge(i) * spb, kn = knock(c.n - i);
      return { s: (a === Infinity ? 1 : 0.6 + 0.4 * POP(a + 0.05)) * (1 + 0.16 * kn), dy: (a === Infinity ? 0 : -10 * decay(a, 0.05)) - 7 * kn, rot: wig(i + 3) };
    });
    if (c.mode === 'cmd' || (c.cursor && m.blink)) cursor(g, env, 2 + c.n, DOCK.rowC, knock(0));
  }

  /**
   * The rows change hands (this shot arriving). The letters change costume a column at a time, left to right, in four
   * frames. What the shot before last printed belongs to its picture and goes with it, wiped by the burst (iris:
   * { cx, cy, R, spin }, or null once the burst has covered the frame). The old prompt's bar, if that shot draws one
   * (Aurora's is a field of glass right across the frame), does not linger: it winds up, snaps in from its far end
   * onto the new prompt, and the new prompt takes the knock.
   */
  function handRows(g, env, iris) {
    const lb = env.lb, od = env.otherImpl.dock, oe = env.otherEnv, c = env.term.rowC;
    const top = DOCK.rowC - 96, hgt = 170;
    const K = 2 + c.n + 2;                                       // columns to change: the margin, the sign, the gap, the letters, the cursor's cell
    const k = Math.floor(seg(lb, HAND.swap0, HAND.swap1) * K + 1e-6);
    const xk = DOCK.left + k * DOCK.adv, xEnd = DOCK.left + K * DOCK.adv;
    if (iris) {
      g.save();
      g.beginPath(); g.rect(0, 0, W, H); burstPath(g, iris.cx, iris.cy, iris.R, iris.R, 13, 0.7, 31, iris.spin, 0.1, true); g.clip('evenodd');
      try { od(g, oe, 'B'); } catch { /* its rows are its own business */ }
      g.restore();
    }
    const u = seg(lb, HAND.bar0, HAND.bar1);
    if (u < 1) {
      let f = null;
      try { f = env.otherImpl.handoff ? env.otherImpl.handoff(oe).field : null; } catch { /* no field to speak of */ }
      const fx = f ? f.x : DOCK.left, fw = f ? f.w : DOCK.right - DOCK.left;
      const sc = lerp(1, (xEnd - fx) / fw, ease.inBack(u));
      g.save();
      g.beginPath(); g.rect(xk, top, W - xk, hgt); g.clip();
      g.translate(fx, 0); g.scale(sc, 1); g.translate(-fx, 0);
      try { od(g, oe, 'C'); } catch { /* its rows are its own business */ }
      g.restore();
    }
    dock(g, env, 'B');
    if (k < K) { g.save(); g.beginPath(); g.rect(0, top, xk, hgt); g.clip(); dock(g, env, 'C'); g.restore(); }
    else dock(g, env, 'C', { land: (lb - HAND.bar1) * env.spb });
  }

  // ---- the style's name: the show's corner mark ----
  const L_TAG1 = lay('VARIETY', ROWF, 40, 3), L_TAG2 = lay('CAPTIONS', ROWF, 40, 3);
  const ST_TAG = { fill: C.white, strokes: [{ w: 3, c: C.ink }, { w: 7, c: C.pink }, { w: 10, c: C.ink }], shadow: { dx: 3, dy: 4, c: C.ink } };
  function tag(g, env) {
    if (!env.tag) return;
    const a = (env.lb - 0.9) * env.spb, s = POP(a) * GONE((env.lb - T.out) * env.spb - 0.2);
    if (s <= 0) return;
    g.save();
    g.translate(292, 164); g.rotate(deg(-4) + deg(1.2) * Math.sin(env.lb * Math.PI * 0.5)); g.scale(s, s);
    // "15/15" on a pill
    const num = lay(`${env.tag.num}/${env.tag.of}`, ROWF, 46, 2), pw = num.w + 44, ph = 62;
    g.lineJoin = 'round';
    g.fillStyle = C.ink; g.strokeStyle = C.ink; g.lineWidth = 16; rr(g, -124 + 4, -70 + 5, pw, ph, 31); g.fill(); g.stroke();
    g.lineWidth = 16; rr(g, -124, -70, pw, ph, 31); g.stroke();
    g.strokeStyle = C.white; g.lineWidth = 9; rr(g, -124, -70, pw, ph, 31); g.stroke();
    g.fillStyle = C.hot; rr(g, -124, -70, pw, ph, 31); g.fill();
    g.save(); g.translate(-124 + pw / 2, -70 + 47); layered(g, num, { fill: C.white, strokes: [{ w: 3, c: C.ink }] }); g.restore();
    g.save(); g.translate(-124 + L_TAG1.w / 2 + 4, 44); layered(g, L_TAG1, ST_TAG, (i) => ({ s: POP(a - 0.1 - i * 0.02), rot: deg(1.5) * Math.sin(env.lb * Math.PI + i) })); g.restore();
    g.save(); g.translate(-124 + L_TAG2.w / 2 + 4, 92); layered(g, L_TAG2, ST_TAG, (i) => ({ s: POP(a - 0.2 - i * 0.02), rot: deg(1.5) * Math.sin(env.lb * Math.PI + i + 2) })); g.restore();
    g.restore();
  }

  /** One caption's letters: each pops with a hop, two frames after the one before; they wiggle while they stay. */
  const poser = (env, t0, t1, opt = {}) => {
    const spb = env.spb, lb = env.lb, gap = opt.gap ?? 0.034, wob = opt.wob ?? 1.8;
    return (i) => {
      const a = (lb - t0) * spb - i * gap;
      if (a <= 0) return null;
      const out = t1 === undefined ? 1 : GONE((lb - t1) * spb - i * 0.02);
      return {
        s: POP(a) * out,
        dy: -(opt.hop ?? 34) * (1 - spring(a, 3.4, 0.38)) + (opt.wave ?? 5) * Math.sin(lb * Math.PI + i * 0.8) * clamp(a * 3),
        rot: deg(wob) * Math.sin(lb * Math.PI + i * 1.3) + deg(opt.tilt ? opt.tilt(i) : 0),
      };
    };
  };

  function sparkle(g, x, y, r, t, phase, spb, lb) {
    const s = POP(t) * (0.82 + 0.18 * Math.sin(lb * TAU * 0.5 + phase)) * GONE((lb - T.out) * spb - 0.03 * phase);
    if (s <= 0) return;
    g.save(); g.translate(x, y); g.rotate(deg(8) * Math.sin(lb * Math.PI + phase)); g.scale(s, s); g.lineJoin = 'round';
    sparklePath(g, r); g.strokeStyle = C.ink; g.lineWidth = 20; g.stroke();
    sparklePath(g, r); g.strokeStyle = C.white; g.lineWidth = 11; g.stroke();
    sparklePath(g, r); g.fillStyle = C.yellow; g.fill();
    g.restore();
  }
  function drop(g, x, y, r, t, rot = 0) {
    // slides down, lets go, and the next one follows
    const cyc = 0.62, n = Math.floor(t / cyc), u = (t - n * cyc) / cyc;
    if (t <= 0) return;
    const s = POP(u * cyc) * (u > 0.82 ? 1 - (u - 0.82) / 0.18 : 1);
    g.save(); g.translate(x, y + 46 * ease.inQuad(u)); g.rotate(rot); g.scale(s * (1 - 0.1 * u), s * (1 + 0.22 * u)); g.lineJoin = 'round';
    dropPath(g, r); g.strokeStyle = C.ink; g.lineWidth = 16; g.stroke();
    dropPath(g, r); g.strokeStyle = C.white; g.lineWidth = 8; g.stroke();
    dropPath(g, r); g.fillStyle = C.sweat; g.fill();
    g.fillStyle = C.white; g.beginPath(); g.ellipse(-r * 0.36, -r * 0.1, r * 0.16, r * 0.34, deg(18), 0, TAU); g.fill();
    g.restore();
  }

  function captions(g, env, P) {
    const lb = env.lb, spb = env.spb, step = Math.floor(env.lt * 12);        // hand-drawn marks are redrawn twelve times a second
    const bye = (late = 0) => GONE((lb - T.out) * spb - late);               // after the shot's last bar line everything pops away

    // WAIT—
    if (lb > T.wait + LATE && lb < T.clear + 0.6) {
      const t0 = T.wait + LATE, a = (lb - t0) * spb, out = GONE((lb - T.clear) * spb);
      g.save(); g.translate(1484, 436); g.rotate(deg(7)); g.scale(out, out);
      layered(g, L_WAIT, ST_WAIT, poser(env, t0, undefined, { gap: 0.06 }));
      // three ticks of surprise off its corner
      const k = POP(a - 0.12);
      if (k > 0) {
        g.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const an = deg(-150 + i * 26 + (hash(step * 3.3 + i) - 0.5) * 6), r0 = 60, r1 = r0 + (46 + i * 8) * k;
          const x0 = -L_WAIT.w / 2 + 4 + Math.cos(an) * r0, y0 = -104 + Math.sin(an) * r0, x1 = -L_WAIT.w / 2 + 4 + Math.cos(an) * r1, y1 = -104 + Math.sin(an) * r1;
          g.strokeStyle = C.ink; g.lineWidth = 24; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
          g.strokeStyle = C.white; g.lineWidth = 15; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
          g.strokeStyle = C.yellow; g.lineWidth = 7; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        }
      }
      g.restore();
    }

    // ???
    if (lb > T.what + LATE && lb < T.clear + 0.6) {
      const t0 = T.what + LATE;
      [[1112, 934, 0.64, -13], [1256, 914, 0.8, 4], [1404, 940, 0.66, 15]].forEach(([x, y, sc, r], i) => {
        const a = (lb - t0) * spb - i * 0.067, out = GONE((lb - T.clear) * spb - i * 0.03);
        if (a <= 0) return;
        g.save(); g.translate(x, y + 9 * Math.sin(lb * TAU * 0.5 + i * 2.1)); g.rotate(deg(r + 4 * Math.sin(lb * Math.PI + i * 2))); g.scale(sc * out, sc * out);
        layered(g, L_Q, ST_Q, () => ({ s: POP(a), dy: -60 * (1 - spring(a, 3.2, 0.33)) }));
        g.restore();
      });
    }

    // sweat: on the prompt that was just turned down, and on the phone
    if (lb > T.sweat + LATE && lb < T.hero) {
      const t = (lb - T.sweat - LATE) * spb;
      drop(g, 640, 918, 17, t, deg(-10));
      drop(g, P.cx - P.w / 2 - 44, P.cy - P.h / 2 + 118, 26, t - 0.12, deg(-14));
    }

    // the stamp
    const st = (lb - T.stamp) * spb + 0.085;                              // it lands on the beat
    if (st > 0) {
      const fall = clamp(st / 0.085), s = st < 0.085 ? lerp(2.5, 0.93, ease.inCubic(fall)) : 1 - 0.07 * Math.exp(-(st - 0.085) * 14) * Math.cos((st - 0.085) * 34);
      const rot = STAMP.rot + deg(-12) * (1 - fall);
      const sb = s * bye(0.06);
      g.save(); g.translate(P.cx, P.cy); g.rotate(P.rot); g.translate(STAMP.x, STAMP.y); g.rotate(rot); g.scale(sb, sb);
      g.globalAlpha = clamp(st / 0.04);
      g.lineJoin = 'round';
      g.fillStyle = C.ink; g.strokeStyle = C.ink; g.lineWidth = 12;
      rr(g, -STAMP.w / 2 - 10 + 7, -STAMP.h / 2 - 10 + 9, STAMP.w + 20, STAMP.h + 20, 40); g.fill(); g.stroke();
      rr(g, -STAMP.w / 2 - 10, -STAMP.h / 2 - 10, STAMP.w + 20, STAMP.h + 20, 40); g.stroke();
      g.drawImage(STAMP.c, -STAMP.w / 2 - STAMP.pad, -STAMP.h / 2 - STAMP.pad);
      g.restore();
      // what the slam kicks up
      const d = st - 0.085;
      if (d > 0 && d < 0.3) {
        const u = d / 0.3;
        g.save(); g.translate(P.cx, P.cy); g.rotate(P.rot); g.translate(STAMP.x, STAMP.y); g.rotate(STAMP.rot);
        g.strokeStyle = rgba(C.white, 1 - u); g.lineWidth = 12 * (1 - u); g.lineCap = 'round';
        for (let i = 0; i < 14; i++) {
          const an = (i / 14) * TAU + hash(i) * 0.3, r0 = 1 + 0.5 * ease.outCubic(u), r1 = r0 + 0.16 * (1 - u);
          g.beginPath(); g.moveTo(Math.cos(an) * 320 * r0, Math.sin(an) * 140 * r0); g.lineTo(Math.cos(an) * 320 * r1, Math.sin(an) * 140 * r1); g.stroke();
        }
        g.restore();
      }
    }

    // IT'S ALL CODE?!
    if (lb >= T.hero && lb < T.out + 0.6) {
      const a = (lb - T.hero) * spb, k = POP(a) * (1 - ease.inCubic(clamp(((lb - T.out) * spb - 0.05) / 0.12))) * (1 + 0.018 * decay((lb - Math.floor(lb)) * spb, 0.07));
      // the burst
      g.save();
      g.translate(BURST.x, BURST.y); g.rotate(deg(-4) + deg(1.1) * Math.sin(lb * Math.PI * 0.5)); g.scale(k, k);
      g.lineJoin = 'round';
      // a second burst behind the first, a moment late
      const kb = POP(a - 0.05) / Math.max(POP(a), 0.001);
      g.save(); g.rotate(deg(12)); g.scale(1.02 * kb, 1.06 * kb);
      burstPath(g, 10, 13, BURST.rx, BURST.ry, 13, 0.8, 91); g.fillStyle = C.ink; g.strokeStyle = C.ink; g.lineWidth = 22; g.fill(); g.stroke();
      burstPath(g, 0, 0, BURST.rx, BURST.ry, 13, 0.8, 91); g.strokeStyle = C.ink; g.lineWidth = 22; g.stroke();
      burstPath(g, 0, 0, BURST.rx, BURST.ry, 13, 0.8, 91); g.fillStyle = C.pink; g.fill();
      g.restore();
      burstPath(g, 14, 18, BURST.rx, BURST.ry, 15, 0.76, 77); g.fillStyle = C.ink; g.strokeStyle = C.ink; g.lineWidth = 34; g.fill(); g.stroke();
      burstPath(g, 0, 0, BURST.rx, BURST.ry, 15, 0.76, 77); g.strokeStyle = C.ink; g.lineWidth = 34; g.stroke();
      burstPath(g, 0, 0, BURST.rx, BURST.ry, 15, 0.76, 77); g.strokeStyle = C.white; g.lineWidth = 20; g.stroke();
      const gr = g.createRadialGradient(0, 0, 60, 0, 0, BURST.rx);
      gr.addColorStop(0, '#FFF6A0'); gr.addColorStop(0.55, C.yellow); gr.addColorStop(1, C.gold);
      burstPath(g, 0, 0, BURST.rx, BURST.ry, 15, 0.76, 77); g.fillStyle = gr; g.fill();
      // rays inside it
      g.save(); burstPath(g, 0, 0, BURST.rx, BURST.ry, 15, 0.76, 77); g.clip();
      g.fillStyle = 'rgba(255,255,255,0.42)';
      rushLines(g, 0, 20, 230, 150, 34, 500 + Math.floor(env.lt * 6)); g.fill();
      g.restore();
      // the words
      g.save(); g.translate(-30, -104);
      layered(g, L_ITS, ST_ITS, poser(env, T.hero + LATE, T.out, { hop: 30, wob: 1.4, gap: 0.017 }));
      g.restore();
      g.save(); g.translate(6, 142);
      const big = 1 + 0.035 * decay((lb - Math.floor(lb)) * spb, 0.07) * (lb > T.code + 0.6 ? 1 : 0);
      g.scale(big, big);
      layered(g, L_CODE, ST_CODE, poser(env, T.code + LATE, T.out, { hop: 60, gap: 0.045, wob: 2.2, tilt: (i) => [-5, 3, -3, 4, -4, 7][i] }));
      g.restore();
      g.restore();
    }

    // (no camera)
    if (lb > T.aside + LATE) {
      g.save(); g.translate(1480, 800); g.rotate(deg(-5)); g.transform(1, 0, -0.14, 1, 0, 0);
      layered(g, L_ASIDE, ST_ASIDE, poser(env, T.aside + LATE, T.out, { hop: 10, gap: 0.02, wob: 0.8, wave: 2 }));
      g.restore();
    }

    // sparkles
    if (lb > T.spark + LATE) {
      const t = (lb - T.spark - LATE) * spb;
      sparkle(g, 862, 140, 44, t, 0, spb, lb);
      sparkle(g, 1770, 150, 34, t - 0.07, 2, spb, lb);
      sparkle(g, 1756, 652, 50, t - 0.14, 4, spb, lb);
      sparkle(g, 1010, 760, 28, t - 0.2, 1, spb, lb);
    }
  }

  // ---- the frame ----
  function layers(g, env, o = {}) {
    const lb = env.lb, spb = env.spb, P = phoneAt(env);
    const handing = !!(env.other && env.role === 'in');
    // a jolt on the two big hits
    const j1 = decay((lb - T.hero) * spb, 0.07) * (lb >= T.hero ? 1 : 0), j2 = decay((lb - T.stamp) * spb, 0.05) * (lb >= T.stamp ? 1 : 0);
    const jx = (hash(env.frame * 1.7) - 0.5) * (26 * j1 + 14 * j2), jy = (hash(env.frame * 2.3 + 5) - 0.5) * (22 * j1 + 16 * j2);

    // the burst that ends the calm: it opens from the card and the new world is inside it
    const open = tw(lb, 0, 0.95, ease.outCubic), R = 30 + 2300 * open, done = open >= 0.62 || !handing;
    const cx = P.card.x + P.card.w / 2, cy = P.card.y + P.card.h / 2, spin = deg(-12) + lb * 0.5;

    if (o.backdrop !== false) {
      if (!done) { g.drawImage(env.other, 0, 0); g.save(); burstPath(g, cx, cy, R, R, 13, 0.7, 31, spin, 0.1); g.clip(); }
      g.save(); g.translate(jx, jy); g.translate(960, 540); g.scale(1.03, 1.03); g.translate(-960, -540);
      backdrop(g, env);
      // rays: a fanfare as the phone stands, and rushing lines on the big caption
      const fan = 1 - smooth(seg(lb, 0.25, 1.5));
      if (fan > 0 && lb >= 0) {
        g.save(); g.translate(P.cx, P.cy); g.rotate(lb * 0.35);
        g.fillStyle = rgba(duoAt(lb)[1], 0.5 * fan);
        g.beginPath();
        for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; g.moveTo(0, 0); g.lineTo(Math.cos(a) * 2400, Math.sin(a) * 2400); g.lineTo(Math.cos(a + TAU / 28) * 2400, Math.sin(a + TAU / 28) * 2400); g.closePath(); }
        g.fill();
        g.restore();
      }
      if (lb >= T.hero) {
        const a = (lb - T.hero) * spb, flick = a < 0.5 ? Math.floor(env.lt * 30) : Math.floor(env.lt * 8);
        g.fillStyle = rgba(C.white, (0.26 + 0.6 * decay(a, 0.2)) * (1 - seg(lb, T.out, T.out + 0.5)));
        rushLines(g, BURST.x, BURST.y, BURST.rx * 1.12, BURST.ry * 1.2, 64, 900 + flick); g.fill();
      }
      g.restore();
      if (!done) {
        g.restore();
        g.lineJoin = 'round';
        burstPath(g, cx, cy, R, R, 13, 0.7, 31, spin, 0.1); g.strokeStyle = C.ink; g.lineWidth = 58; g.stroke();
        burstPath(g, cx, cy, R, R, 13, 0.7, 31, spin, 0.1); g.strokeStyle = C.pink; g.lineWidth = 46; g.stroke();
        burstPath(g, cx, cy, R, R, 13, 0.7, 31, spin, 0.1); g.strokeStyle = C.white; g.lineWidth = 24; g.stroke();
      }
    }

    if (o.phone !== false) {
      g.save(); g.translate(jx * 0.6, jy * 0.6);
      drawPhone(g, P, (gg, sw, sh) => footage(gg, env, sw, sh, (g2) => {
        // the feed's first post is still the card: its own picture, lying on its side as the phone comes upright
        // (seen alone, without the shot before, its still stands in)
        const c = P.card;
        g2.save(); g2.rotate(Math.PI / 2);
        if (handing) g2.drawImage(env.other, c.x, c.y, c.w, c.h, -sh / 2, -sw / 2, sh, sw);
        else g2.drawImage(STILL.aurora, 60, 34, 840, 472, -sh / 2, -sw / 2, sh, sw);
        g2.restore();
      }));
      g.restore();
    }

    if (o.captions !== false) {
      // the flash of the big hit, under the lettering
      const f = (lb - T.hero) * spb;
      if (f >= 0 && f < 0.08) { g.fillStyle = rgba(C.white, 0.8 * (1 - f / 0.08)); g.fillRect(0, 0, W, H); }
      g.save(); g.translate(jx * 0.35, jy * 0.35);
      captions(g, env, P);
      tag(g, env);
      g.restore();
    }

    if (o.dock === false || env.noDock) return;
    if (handing && env.otherImpl && env.otherImpl.dock) handRows(g, env, done ? null : { cx, cy, R, spin });
    else dock(g, env);
  }

  return {
    render: (g, env) => layers(g, env),
    // the fast moves get a little real blur: standing up, the jump, the stamp coming down, each flick of the feed
    samples: ({ lb }) => (FEED.some((f) => lb >= f[0] && lb < f[0] + 0.1) ? 12 : lb >= 0 && lb < 0.6 ? 10 : (lb >= T.hero && lb < T.hero + 0.6) || (lb >= T.stamp - 0.2 && lb < T.stamp + 0.05) || FEED.some((f) => lb >= f[0] + 0.1 && lb < f[0] + 0.2) ? 6 : 1),
    dock,
    layers,          // layers(g, env, { backdrop, phone, captions, dock }): pass false to leave a part out
    drawPhone,       // drawPhone(g, { cx, cy, w, h, rot, r }, (g, sw, sh) => paint the screen around 0,0)
    screen: (g, env, sw, sh) => footage(g, env, sw, sh),   // the phone's own picture at this instant, for the ending's last flick of the feed
    handoff(env) {
      const P = phoneAt(env);
      return { phone: { x: P.cx - P.w / 2, y: P.cy - P.h / 2, w: P.w, h: P.h, r: P.r, cx: P.cx, cy: P.cy, rot: P.rot, bezel: PH.bezel } };
    },
    sfx: [
      { b: 0, s: 'variety_boing', g: 0.9 },
      { b: T.wait, s: 'variety_pop', g: 0.7 },
      { b: T.what, s: 'variety_scratch', g: 0.8 },
      { b: T.sweat, s: 'variety_drip', g: 0.6, a: 'peak' },
      { b: T.hero, s: 'variety_shock', g: 1, a: 'peak' },
      { b: T.code, s: 'variety_pop', g: 0.9 },
      { b: T.aside, s: 'variety_whistle', g: 0.6 },
      { b: T.spark, s: 'variety_ding', g: 0.7 },
      { b: T.stamp, s: 'variety_stamp', g: 1, a: 'peak' },
    ],
  };
}
