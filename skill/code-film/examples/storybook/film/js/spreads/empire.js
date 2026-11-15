// Spread 6, the hero: "Sam is now a pretend millionaire." The book outgrows itself: a skyline that pops up building by
// building, a tower, a night sky that slides up behind it, four pipes (the four ways to earn) pouring coins onto a
// pile that grows under Sam, and panels that pull out of the page edges. Nothing here is ever still.

import * as THREE from 'three';
import { PAL, LAYER as L, rr, circ, ell, poly, star, stack, printed } from '../paper.js';
import { cutText, cutSign } from '../type.js';
import * as art from '../art.js';
import { rng, spring, tw, ease, seg, lerp, clamp, smooth } from '../util.js';

export function build(env) {
  const { fonts, book, W } = env;
  const r = rng(41);
  const cards = [], bursts = [], streams = [], arms = [], crowns = [], beams = [], houses = [], towers = [], signs = [], bulbs = [];
  const sams = [], mounds = [], pile = [], ribbons = [];

  /** A card printed with one word in the condensed poster face, sized to fit. */
  const word = (w, h, text, bg, fg, o = {}) => printed(w, h, (c, cw, ch) => {
    c.fillStyle = bg; c.fillRect(0, 0, cw, ch);
    c.fillStyle = fg; c.textAlign = o.align ?? 'center'; c.textBaseline = 'alphabetic';
    let size = ch * (o.fill ?? 0.86); c.font = `${size}px "Anton"`;
    const room = cw * (o.room ?? 0.94), tw_ = c.measureText(text).width;
    if (tw_ > room) { size *= room / tw_; c.font = `${size}px "Anton"`; }
    const x = o.align === 'left' ? cw * 0.04 : o.align === 'right' ? cw * 0.96 : cw / 2;
    c.fillText(text, x, ch / 2 + size * 0.36);
  }, o);

  // ---------------------------------------------------------------- back fold: skyline, and the sky that rises behind it
  const sky = env.fold({ z: -1.08, beta: 68 });
  const skylineDefs = [];
  for (let x = -3.02; x < 3.0;) {
    const w = 0.42 + r() * 0.3, h = 0.85 + r() * 1.05;
    skylineDefs.push({ x: x + w / 2, w, h, c: ['#5167b0', '#6d82c8', '#3f8f9e', '#7a5aa6', '#4a5fa8'][Math.floor(r() * 5)], seed: Math.floor(r() * 1e6), top: r() });
    x += w + 0.03;
  }
  const starDefs = [];
  for (let i = 0; i < 34; i++) starDefs.push({ x: -3.0 + r() * 6.0, y: 1.05 + r() * 1.8, s: 0.03 + r() * 0.05, kind: r() < 0.45 });
  env.span(sky, (g, side, clip) => {
    const card = stack({ clip, z: -L * 1.5 });
    card.put(rr(6.5, 3.0, [0.4, 0.4, 0, 0], 0, 1.5), '#19224c', { z: 0 });
    // two searchlights: cones of paler paper, each on its own pivot so it can sway
    for (const [x0, lean] of [[-2.3, 0.44], [2.3, -0.44]]) {
      const b = stack({ clip, x: x0, y: 0.2, z: L * 0.3 });
      b.put(poly([[-0.12, 0], [0.12, 0], [0.46, 2.95], [-0.46, 2.95]], 0), '#2a377a', { z: 0, core: false });
      b.rotation.z = -lean; b.userData.lean = -lean; b.userData.ph = x0 > 0 ? 1.7 : 0;
      card.add(b); beams.push(b);
    }
    card.put(circ(0.36, -2.0, 2.35), PAL.cream, { z: L * 0.8 });
    for (const [x, y, q] of [[-2.1, 2.45, 0.07], [-1.86, 2.3, 0.05], [-2.05, 2.2, 0.04]]) card.put(circ(q, x, y), '#e2d6b5', { z: L * 1.1, core: false });
    for (const s of starDefs) {
      if (Math.hypot(s.x + 2.0, s.y - 2.35) < 0.55 || Math.abs(s.x) < 0.12) continue;
      card.put(s.kind ? star(4, s.s * 1.5, s.s * 0.5, s.x, s.y, 0, 0) : circ(s.s * 0.5, s.x, s.y), s.kind ? PAL.yellow : PAL.white, { z: L * 0.7 });
    }
    // fireworks: paper bursts on thin paper stalks glued to the sky
    const fw = [[-1.25, 2.55, 0.34, PAL.pink, 0], [1.3, 2.7, 0.4, PAL.gold, 1], [2.45, 2.1, 0.3, PAL.sky, 2], [-2.75, 1.55, 0.26, PAL.mint, 3], [0.55, 2.2, 0.22, PAL.rose, 4]];
    for (const [x, y, q, c, i] of fw) {
      if ((side === 'R') !== (x > 0)) continue;
      card.put(rr(0.022, 0.5, 0, x, y - 0.3), '#c9cfe6', { z: L * 0.9, core: false, cut: false });
      const b = stack({ clip, x, y, z: L * 1.4 });
      b.put(star(12, q, q * 0.42, 0, 0, 0.1 * i, 0.004), c, { z: 0 });
      b.put(star(12, q * 0.55, q * 0.22, 0, 0, 0.36, 0.004), PAL.white, { z: L * 0.5 });
      b.put(circ(q * 0.13), c, { z: L });
      b.userData.i = i;
      card.add(b); bursts.push(b);
    }
    g.add(card); cards.push(card);

    g.put(rr(6.2, 1.0, [0.2, 0.2, 0, 0], 0, 0.5), '#34467f', { z: 0 });
    for (const b of skylineDefs) {
      const q = rng(b.seed);
      const s = stack({ clip, x: b.x, z: L * (0.5 + q() * 0.8) });
      s.put(rr(b.w, b.h, [0.04, 0.04, 0, 0], 0, b.h / 2), b.c, { z: 0 });
      const cols = Math.max(2, Math.floor(b.w / 0.17)), rows = Math.floor((b.h - 0.25) / 0.21);
      for (let cx = 0; cx < cols; cx++) for (let ry = 0; ry < rows; ry++) {
        const lit = q() < 0.62;
        s.put(rr(0.075, 0.1, 0.01, (cx - (cols - 1) / 2) * (b.w / (cols + 0.4)), 0.3 + ry * 0.21), lit ? PAL.yellow : '#2b3970', { z: L * 0.4, core: false, cut: false });
      }
      if (b.top < 0.3) s.put(rr(0.035, 0.34, 0, b.w * 0.2, b.h + 0.17), PAL.lightgrey, { z: -L * 0.2, core: false });
      else if (b.top < 0.55) s.put(rr(b.w * 0.5, 0.14, [0.03, 0.03, 0, 0], 0, b.h + 0.07), b.c, { z: -L * 0.1 });
      s.userData.rank = Math.abs(b.x);
      g.add(s); houses.push(s);
    }
  });

  // ---------------------------------------------------------------- the tower
  const tower = env.fold({ z: -0.5, beta: 78 });
  env.span(tower, (g, side, clip) => {
    const t = stack({ clip });
    t.put(rr(1.56, 3.2, [0.06, 0.06, 0, 0], 0, 1.6), '#6a4f9c', { z: 0 });
    for (const x of [-0.72, 0.72]) t.put(rr(0.1, 3.2, 0, x, 1.6), '#8468b8', { z: L * 0.3, core: false });
    const q = rng(77);
    for (let c = 0; c < 6; c++) for (let row = 0; row < 8; row++) {
      const lit = q() < 0.4;
      t.put(rr(0.135, 0.17, 0.02, (c - 2.5) * 0.215, 0.62 + row * 0.25), lit ? PAL.yellow : '#463272', { z: L * 0.5, core: false, cut: false });
    }
    t.put(rr(0.4, 0.42, [0.2, 0.2, 0, 0], 0, 0.21), '#463272', { z: L * 0.5 });
    t.put(rr(1.12, 0.34, [0.06, 0.06, 0, 0], 0, 3.37), PAL.orange, { z: L * 0.2 });
    t.put(rr(0.62, 0.3, [0.06, 0.06, 0, 0], 0, 3.69), PAL.gold, { z: L * 0.1 });
    t.put(rr(0.05, 0.56, 0, 0, 4.1), PAL.white, { z: -L * 0.2, core: false });
    t.put(star(5, 0.17, 0.075, 0, 4.42, 0, 0.004), PAL.red, { z: L * 0.2 });
    g.add(t); towers.push(t);
    // the sign: SAM on one wing, INC. on the other, so no letter sits on the fold
    const sg = stack({ clip, x: 0, y: 2.72, z: L * 1.6 });
    sg.put(rr(2.56, 0.6, 0.07), '#b93a22', { z: 0 });
    sg.put(rr(2.44, 0.48, 0.05), PAL.red, { z: L * 0.4, core: false });
    const txt = cutText(fonts.bookman, side === 'L' ? 'SAM' : 'INC.', 1, PAL.cream, { clip, wobble: 0.03, seed: side === 'L' ? 4 : 8 });
    const k = Math.min(1.02 / txt.userData.width, 0.3 / 0.68);          // fit the wing; cap height 0.3 at most
    txt.scale.setScalar(k);
    txt.position.set(side === 'L' ? -0.62 : 0.62, -0.34 * k, L);
    sg.add(txt);
    for (let i = 0; i < 15; i++) for (const y of [0.26, -0.26]) {
      sg.put(circ(0.03, -1.19 + i * 0.17, y), PAL.yellow, { z: L * 0.9, core: false, cut: false });
      bulbs.push({ on: sg.put(circ(0.03, -1.19 + i * 0.17, y), PAL.white, { z: L * 0.95, core: false, cut: false }), i });
    }
    g.add(sg); signs.push(sg);
  });

  // ---------------------------------------------------------------- four pipes, one per way to earn
  const pipes = env.fold({ z: 0.02, beta: 80 });
  const PIPE = [
    { side: 'L', y: 2.15, mouth: 1.0, label: 'PRODUCTS', c: PAL.teal, d: '#157a74' },
    { side: 'L', y: 1.42, mouth: 1.42, label: 'SUBSCRIPTIONS', c: PAL.rose, d: '#c14a5e' },
    { side: 'R', y: 2.15, mouth: 1.0, label: 'CONTENT PAYOUTS', c: PAL.green, d: '#447d3e' },
    { side: 'R', y: 1.42, mouth: 1.42, label: 'SPONSOR DEALS', c: '#8f78c4', d: '#6f5aa3' },
  ];
  env.span(pipes, (g, side, clip) => {
    for (const p of PIPE) {
      if (p.side !== side) continue;
      const sg = side === 'R' ? 1 : -1, T = 0.44, x0 = p.mouth - T / 2, x1 = 3.12;
      const s = stack({ clip, z: 0 });
      // one piece of card: the run, its rounded shoulder and the drop to the mouth
      const o = [[x1, p.y + T / 2], [x0, p.y + T / 2], [x0, p.y - T / 2 - 0.37], [x0 + T, p.y - T / 2 - 0.37], [x0 + T, p.y - T / 2], [x1, p.y - T / 2]].map(([x, y]) => [sg * x, y]);
      s.put(poly(o, [0, T / 2, 0, 0, 0.04, 0]), p.c, { z: 0 });
      s.put(rr(T + 0.14, 0.12, 0.04, sg * p.mouth, p.y - T / 2 - 0.4), p.d, { z: L * 0.5 });
      s.put(rr(0.09, T + 0.06, 0.03, sg * (x1 - 0.045), p.y), p.d, { z: L * 0.5 });
      const lx0 = p.mouth + T / 2 + 0.06, lw = x1 - 0.12 - lx0;
      s.add(cutSign(fonts.anton, p.label, lw * 0.95, T * 0.52, PAL.white, { clip, x: sg * (lx0 + lw / 2), y: p.y, z: L * 0.45, seed: p.label.length }));
      g.add(s);
      // the coins that fall from it, the whole time
      const fall = stack({ clip, x: sg * p.mouth, y: p.y - T / 2 - 0.46, z: L * 0.3 });
      const coins = [];
      for (let i = 0; i < 6; i++) { const cn = art.coin({ clip, r: 0.115 }); fall.add(cn); coins.push(cn); }
      fall.userData = { coins, drop: p.y - 0.9, phase: r() };
      g.add(fall); streams.push(fall);
    }
  });

  // ---------------------------------------------------------------- front: Sam on a pile that grows
  const front = env.fold({ z: 0.62, beta: 86 });
  const moundH = (x) => 0.86 * Math.max(0, 1 - Math.pow(Math.abs(x) / 2.0, 2.2));
  const coinDefs = [];
  { const q = rng(5); for (let i = 0; i < 86; i++) { const x = (q() * 2 - 1) * 1.85, y = q() * moundH(x) * 0.96; coinDefs.push({ x, y: y + 0.02, s: 0.75 + q() * 0.45, rot: q() * 6, z: q(), j: q() }); } }
  env.span(front, (g, side, clip) => {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const x = -2.0 + (4.0 * i) / 24; pts.push([x, moundH(x) + 0.03]); }
    mounds.push(g.put(poly([[2.0, 0], [-2.0, 0], ...pts], 0), '#dc9d22', { z: 0 }));
    const drop = (c, z) => { const cn = art.coin({ clip, x: c.x, y: c.y, z, s: c.s, rot: c.rot }); cn.userData = { ...cn.userData, at: (c.y / 0.86) * 1.5 + c.j * 0.25, s: c.s }; g.add(cn); pile.push(cn); };
    for (const c of coinDefs) if (c.y < 0.5 || Math.abs(c.x) > 0.55) drop(c, L * (0.3 + c.z * 0.6));
    // Sam, in sunglasses, grinning
    const p = art.person({ clip, y: 0.66, z: L * 1.4, s: 1.2, shirt: PAL.red, glasses: false });
    const hy = 1.08;
    for (const x of [-0.115, 0.115]) p.put(rr(0.21, 0.135, [0.03, 0.03, 0.07, 0.07], x, hy - 0.005), PAL.black, { z: L * 3.6, core: false });
    p.put(rr(0.1, 0.03, 0.01, 0, hy + 0.03), PAL.black, { z: L * 3.6, core: false, cut: false });
    p.userData.mouth.visible = false;
    { const m = []; for (let i = 0; i <= 14; i++) { const a = Math.PI + (Math.PI * i) / 14; m.push([Math.cos(a) * 0.105, hy - 0.115 + Math.sin(a) * 0.085]); }
      p.put(poly(m, 0), PAL.ink, { z: L * 3.2, core: false }); p.put(rr(0.15, 0.03, 0.008, 0, hy - 0.128), PAL.white, { z: L * 3.5, core: false, cut: false }); }
    p.userData.browL.visible = p.userData.browR.visible = false;
    g.add(p); sams.push(p);
    // an arm on this side, hinged at the shoulder, holding a coin
    const sg = side === 'R' ? 1 : -1;
    const arm = stack({ clip, x: sg * 0.37, y: 0.6, z: -L * 0.4 });
    arm.put(rr(0.19, 0.66, 0.09, 0, 0.3), PAL.red, { z: 0 });
    arm.put(circ(0.1, 0, 0.66), PAL.tan, { z: L * 0.3 });
    arm.add(art.coin({ clip, x: 0, y: 0.82, z: L * 0.6, s: 1.15 }));
    arm.userData.sg = sg;
    p.add(arm); arms.push(arm);
    const cr = art.crown({ clip, x: 0, y: hy + 0.33, z: L * 3.4, s: 1.25 });
    p.add(cr); crowns.push(cr);
    for (const c of coinDefs) if (c.y < 0.5 && Math.abs(c.x) <= 0.55) drop(c, L * (4.6 + c.z * 0.5));
    // the small print, now large: a ribbon across the pile, one word on each wing
    const rb = stack({ clip, x: sg * 0.74, y: 0.3, z: L * 6.2 });
    rb.put(rr(1.6, 0.5, 0.03), '#b93a22', { z: 0 });
    rb.put(rr(1.48, 0.4, 0.02), PAL.red, { z: L * 0.3, core: false });
    rb.add(cutSign(fonts.anton, side === 'L' ? '100%' : 'PRETEND', 1.3, 0.27, PAL.cream, { clip, x: 0, y: 0, z: L * 0.7, align: side === 'L' ? 'right' : 'left', seed: 12 }));
    g.add(rb); ribbons.push(rb);
    if (side === 'L') {
      const bag = stack({ clip, x: -1.62, y: 0.52, z: L * 1.2, rot: 0.12 });
      bag.put(ell(0.3, 0.3, 0, 0.26), PAL.kraft, { z: 0 });
      bag.put(poly([[-0.1, 0.5], [0.1, 0.5], [0.17, 0.7], [-0.17, 0.7]], 0.03), PAL.kraft, { z: 0 });
      bag.put(rr(0.26, 0.05, 0.02, 0, 0.52), PAL.brown, { z: L * 0.5, core: false });
      bag.put(star(5, 0.13, 0.06, 0, 0.25, 0, 0.004), PAL.brown, { z: L * 0.5, core: false });
      g.add(bag);
    }
  });

  // ---------------------------------------------------------------- pull-out panels at the page edges
  const panels = [];
  for (const sg of [1, -1]) {
    const page = sg > 0 ? env.pages.right : env.pages.left;
    const pn = stack({ z: -0.012 });
    pn.put(rr(1.7, 2.2, 0.12, 0, 0), '#2b3a6b', { z: 0 });
    pn.put(rr(1.4, 0.5, 0.25, 0, -0.55), '#394c85', { z: 0.004, cast: false, core: false });
    // the tab you would pull it out by
    pn.put(rr(0.3, 0.56, 0.1, sg * 0.66, 0.62), PAL.cream, { z: 0.004 });
    pn.put(poly([[sg * 0.6, 0.74], [sg * 0.6, 0.5], [sg * 0.75, 0.62]], 0.01), PAL.red, { z: 0.008, core: false });
    const hinge = new THREE.Group();
    hinge.position.set(sg * 0.02, -0.1, 0.006);
    const up = stack({});
    if (sg > 0) {
      up.put(rr(1.2, 0.9, 0, 0, 0.45), PAL.cream, { z: 0 });
      up.put(poly([[-0.72, 0.9], [0.72, 0.9], [0, 1.32]], 0.03), PAL.cream, { z: 0 });
      up.put(rr(1.36, 0.1, 0.02, 0, 0.92), PAL.lightgrey, { z: L * 0.5 });
      for (const x of [-0.42, -0.14, 0.14, 0.42]) up.put(rr(0.11, 0.5, 0.02, x, 0.42), PAL.lightgrey, { z: L * 0.5, core: false });
      up.put(rr(1.3, 0.14, 0.02, 0, 0.09), PAL.grey, { z: L * 0.8 });
      up.add(art.coin({ x: 0, y: 1.08, z: L * 1.2, s: 1.1 }));
      up.scale.setScalar(1.25);
    } else {
      up.put(rr(0.9, 0.12, 0.03, 0, 0.06), PAL.grey, { z: 0 });
      up.put(poly([[-0.34, 0.12], [-0.2, 0.12], [-0.05, 0.62], [-0.12, 0.62]], 0.01), PAL.lightgrey, { z: 0 });
      up.put(poly([[0.34, 0.12], [0.2, 0.12], [0.05, 0.62], [0.12, 0.62]], 0.01), PAL.lightgrey, { z: 0 });
      up.add(art.rocket({ x: 0, y: 0.98, z: L, s: 1.7 }));
      up.scale.setScalar(1.12);
    }
    hinge.add(up); pn.add(hinge); page.add(pn);
    panels.push({ pn, hinge, sg });
  }

  // when things happen (local shot time; the page lands at env.turn)
  const T0 = env.turn;
  const tSky = T0 - 0.1, tTower = T0 - 0.05, tSign = T0 + 0.62, tPanels = T0 + 0.12, tUp = T0 + 0.55, tArms = T0 + 0.25, tCrown = T0 + 0.7, tRibbon = T0 + 1.2, tFire = T0 + 0.55;
  const tEnd = env.lines.rich.end - env.shot.t0;                // the narrator finishes: one more burst of fireworks
  const houseOrder = [...new Set(houses.map((h) => h.userData.rank))].sort((a, b) => a - b);

  return {
    sfx: [
      { t: T0 - 0.28, s: 'paper_pop', g: 0.5 }, { t: T0 - 0.12, s: 'paper_pop', g: 0.5 }, { t: T0 + 0.04, s: 'paper_pop', g: 0.55 },
      { t: tSky, s: 'paper_slide', g: 0.7 }, { t: T0 + 0.1, s: 'coin_shower', g: 0.5, len: 2.7 }, { t: tPanels, s: 'paper_slide', g: 0.5 },
      { t: tSign, s: 'flap_flip', g: 0.7 }, { t: tUp, s: 'paper_pop', g: 0.7 },
      { t: tFire, s: 'firework_pop', g: 0.6 }, { t: tFire + 0.34, s: 'firework_pop', g: 0.5 }, { t: tFire + 0.68, s: 'firework_pop', g: 0.5 },
      { t: tCrown + 0.6, s: 'crown_ding', g: 0.8, a: 'peak' }, { t: tRibbon, s: 'flap_flip', g: 0.75 },
      { t: tEnd + 0.1, s: 'firework_pop', g: 0.7 }, { t: tEnd + 0.22, s: 'sparkle', g: 0.7 }, { t: tEnd + 0.3, s: 'firework_pop', g: 0.55 },
    ],
    // wide from the first frame, low like a stage, then craning up as the sky rises
    key(lt) {
      const u = ease.inOutCubic(seg(lt, 0.15, 2.7));
      return { pos: [0, lerp(4.0, 6.6, u), lerp(15.6, 14.9, u)], target: [0, lerp(2.1, 1.95, u), -0.45], focus: [0, 1.4, 0.3], aperture: 0.085 };
    },
    animate(lt, open) {
      const q = Math.floor(lt * 15 + 1e-4) / 15;            // paper acts on twos
      const beat = Math.floor(q * 7.5);                     // a count that ticks every other frame

      // the skyline pops up from the middle outward, the tower last and tallest
      for (const h of houses) { const k = houseOrder.indexOf(h.userData.rank); h.scale.y = Math.max(0.02, clamp(spring(q - (T0 - 0.42) - k * 0.035, 3.4, 0.42), 0, 1.25)); }
      for (const t of towers) t.scale.y = lerp(0.3, 1, clamp(spring(q - tTower, 2.4, 0.5), 0, 1.15));
      for (const s of signs) { const k = clamp(spring(q - tSign, 3.2, 0.42), 0, 1.25); s.scale.setScalar(Math.max(0.001, k)); s.visible = k > 0.002; s.rotation.z = (1 - k) * 0.25; }
      for (const b of bulbs) b.on.visible = (b.i + beat) % 2 === 0;

      // the sky slides up behind it; searchlights sway; fireworks pop and keep twinkling
      const rise = clamp(spring(q - tSky, 2.2, 0.62), 0, 1.2);
      for (const c of cards) c.position.y = lerp(-0.85, 1.95, rise);
      for (const b of beams) b.rotation.z = b.userData.lean + 0.07 * Math.sin(q * 2.1 + b.userData.ph);
      for (const b of bursts) {
        const s = spring(q - tFire - b.userData.i * 0.17, 3.2, 0.4);
        const flick = s > 0.9 ? 1 + 0.08 * ((beat + b.userData.i) % 2 ? 1 : -1) : 1;
        const again = Math.max(0, 1 - Math.abs(q - tEnd - 0.12 - b.userData.i * 0.05) / 0.2);
        b.scale.setScalar(Math.max(0.001, s * flick * (1 + 0.45 * again))); b.rotation.z = (1 - Math.min(1, s)) * 0.8 + (s > 0.9 ? 0.12 * ((beat + b.userData.i) % 2) : 0);
      }

      // the panels pull out and their buildings stand; they tuck back in as the spread starts to close
      const held = clamp((open - 0.72) / 0.28);
      for (const p of panels) {
        const out = tw(q, tPanels, tPanels + 0.45, ease.outCubic) * held;
        p.pn.position.x = p.sg * (book.gap + W - 0.88 + out * 1.5);
        p.hinge.visible = out > 0.03;                         // lying flat inside the book it would poke past the page edge
        p.hinge.rotation.x = (Math.PI / 2) * clamp(spring(q - tUp, 2.6, 0.5), 0, 1.15) * clamp((open - 0.86) / 0.14);
      }

      // coins pour from all four pipes and the pile grows under Sam
      for (const s of streams) {
        const { coins, drop, phase } = s.userData, n = coins.length, ph = (q * 3.2 + phase) % 1;
        coins.forEach((cn, i) => { const u = (i + ph) / n; cn.position.y = -u * drop; cn.rotation.z = (i + Math.floor(q * 3.2 + phase)) * 1.3; cn.visible = open > 0.9 && q > T0 - 0.05; });
      }
      const grow = smooth(seg(q, T0 + 0.05, T0 + 1.75));
      for (const m of mounds) m.scale.y = lerp(0.6, 1, grow);
      for (const cn of pile) { const k = clamp(spring(q - T0 - cn.userData.at, 3.6, 0.45), 0, 1.25); cn.visible = k > 0.01; cn.scale.setScalar(Math.max(0.001, k * cn.userData.s)); }
      const pump = q > tArms + 0.6 ? 0.09 * (beat % 2 ? 1 : -1) : 0;
      for (const p of sams) p.position.y = 0.66 - 0.3 * (1 - grow) + (pump > 0 ? 0.012 : 0);
      for (const a of arms) a.rotation.z = -a.userData.sg * (lerp(2.7, 0.62, clamp(spring(q - tArms, 2.6, 0.45), 0, 1.25)) + pump);
      for (const c of crowns) { c.visible = q >= tCrown; c.position.y = 1.08 + 0.33 + 1.3 * (1 - ease.outBounce(seg(q, tCrown, tCrown + 0.6))); }
      for (const rb of ribbons) { const k = clamp(spring(q - tRibbon, 3.0, 0.42), 0, 1.25); rb.scale.set(1, Math.max(0.001, k), 1); rb.visible = k > 0.002; }
    },
  };
}
