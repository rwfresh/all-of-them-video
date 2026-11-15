// Spread 5: "The game turns them into users and money. Those are not real."
// Read left to right: a crate of real likes, a belt that carries the hearts up into a funnel, the BUILDER WARS
// machine, and out of its other side a little crowd of users and a stack of coins. A sign rises out of the page
// beside each as it arrives, and both nod on "not real".

import * as THREE from 'three';
import { PAL, LAYER as L, rr, circ, ell, poly, star, heart, hole, piece, stack } from '../paper.js';
import { cutText, cutSign } from '../type.js';
import * as art from '../art.js';
import { rng, spring, tw, ease, seg, lerp, clamp, smooth } from '../util.js';

const twos = (t) => Math.floor(t * 15 + 1e-4) / 15;

/** A gear with n flat teeth, centred on the origin. */
function gearShape(n, ro, ri) {
  const pts = [], step = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const a = i * step;
    pts.push([Math.cos(a - step * 0.3) * ri, Math.sin(a - step * 0.3) * ri]);
    pts.push([Math.cos(a - step * 0.17) * ro, Math.sin(a - step * 0.17) * ro]);
    pts.push([Math.cos(a + step * 0.17) * ro, Math.sin(a + step * 0.17) * ro]);
    pts.push([Math.cos(a + step * 0.3) * ri, Math.sin(a + step * 0.3) * ri]);
  }
  return poly(pts, 0.008);
}

/** Front layers fold first: a fold's art sinks into the page over the first few degrees of a page turn (and stands up
 *  as the page lands), before it can lean back through the wall behind it. open: 0 shut .. 1 flat. */
const sink = (open) => { const u = Math.min(1, Math.max(0, (open - 0.9) / 0.095)); return Math.max(0.002, u * u * (3 - 2 * u)); };

export function build(env) {
  const { fonts } = env;
  const S = env.shot;
  const at = (word) => env.mark('game', word) - S.t0;
  const tTurns = at('turns'), tUsers = at('users'), tMoney = at('money'), tSay = at('not');
  // each sign rises as its pile arrives, and both are fully up a good second before the page turns
  const tSign = [Math.min(tUsers + 0.55, S.dur - 1.65), Math.min(tMoney + 0.45, S.dur - 1.45)];

  // ---------------------------------------------------------------- back wall: a calm backdrop with a burst behind the machine
  const cogs = [];
  const wall = env.fold({ z: -1.05, beta: 70 });
  env.span(wall, (g, side, clip) => {
    g.put(rr(6.1, 2.45, [0.3, 0.3, 0, 0], 0, 1.225), '#63b9ad', { z: 0 });
    g.put(rr(6.1, 0.14, 0, 0, 0.07), '#4a9c91', { z: L * 0.5 });
    // one big cog cut from a lighter sheet, standing proud of the wall: it turns slowly while the machine runs
    const cog = piece(hole(gearShape(14, 1.26, 1.04), circ(0.5)), '#82cdc2', { clip, x: 0, y: 1.3, z: L * 1.2 });
    g.add(cog); cogs.push(cog);
    const q = rng(side === 'R' ? 3 : 8);
    for (let i = 0; i < 6; i++) {
      const x = (side === 'R' ? 1 : -1) * (1.45 + q() * 1.45), y = 0.9 + q() * 1.35, s = 0.05 + q() * 0.06;
      g.put(star(4, s * 1.5, s * 0.5, x, y, 0, 0), PAL.cream, { z: L * 0.6 });
    }
  });

  // ---------------------------------------------------------------- the machine, with the belt that feeds it
  const mach = env.fold({ z: -0.18, beta: 81 });
  const hearts = [], gears = [], lights = [], puffs = [], needle = [], tokens = [], bodies = [], bulbs = [];
  const A = [-2.86, 0.62], B = [-1.72, 2.34];              // the belt runs from A up to B
  const blen = Math.hypot(B[0] - A[0], B[1] - A[1]), bang = Math.atan2(B[1] - A[1], B[0] - A[0]);
  const nx = -Math.sin(bang), ny = Math.cos(bang);          // the belt's upper side
  const FUN = [-0.92, 1.72];                                // where a heart ends, inside the funnel
  /** Where a heart is, s in 0..1: along the belt, then a short arc into the funnel. */
  const heartAt = (s) => {
    if (s < 0.7) { const u = s / 0.7; return [A[0] + (B[0] - A[0]) * u + nx * 0.2, A[1] + (B[1] - A[1]) * u + ny * 0.2, u * 0.0]; }
    const u = (s - 0.7) / 0.3, x0 = B[0] + nx * 0.2, y0 = B[1] + ny * 0.2;
    return [lerp(x0, FUN[0], u), lerp(y0, FUN[1], u * u) + 0.26 * Math.sin(Math.PI * Math.min(1, u * 1.25)) * (1 - u), u];
  };
  const NH = 6, HSPEED = 0.2;
  const machG = env.span(mach, (g, side, clip) => {
    const body = stack({ clip });
    g.add(body); bodies.push(body);
    // legs, body, trims
    for (const x of [-0.95, 0.95]) body.put(rr(0.3, 0.24, 0.03, x, 0.12), '#16233c', { z: 0 });
    body.put(rr(2.62, 1.3, 0.14, 0, 0.85), PAL.navy, { z: L * 0.3 });
    body.put(rr(2.74, 0.12, 0.05, 0, 1.5), '#3f62a3', { z: L * 0.7 });
    body.put(rr(2.74, 0.1, 0.04, 0, 0.21), '#3f62a3', { z: L * 0.7 });
    body.put(hole(rr(2.4, 0.52, 0.06, 0, 1.16), rr(2.32, 0.44, 0.04, 0, 1.16)), PAL.gold, { z: L * 0.8 });
    // the name: one word on each wing, like the cover
    const word = side === 'L' ? 'BUILDER' : 'WARS';
    const t = cutText(fonts.bookman, word, 1, side === 'L' ? PAL.cream : PAL.gold, { clip, wobble: 0.03, seed: side === 'L' ? 5 : 9 });
    const bb = t.userData.letters[0].geometry.boundingBox, cap = bb.max.y - bb.min.y;
    const k = Math.min(1.06 / t.userData.width, 0.215 / cap);
    t.scale.setScalar(k);
    t.position.set(side === 'L' ? -0.6 : 0.6, 1.16 - (cap * k) / 2, L * 1.4);
    body.add(t);
    for (const x of [-1.2, 1.2]) for (const y of [0.32, 1.38]) body.put(circ(0.028, x, y), '#8fa6d6', { z: L * 0.9 });
    if (side === 'L') {
      // two gears that mesh
      for (const [x, y, n, ro, ri, c, dir] of [[-0.86, 0.6, 11, 0.3, 0.235, PAL.gold, 1], [-0.34, 0.53, 8, 0.215, 0.16, PAL.orange, -11 / 8]]) {
        const gr = stack({ clip, x, y, z: L * 1.1 });
        gr.put(gearShape(n, ro, ri), c, { z: 0 });
        gr.put(circ(ri * 0.5), PAL.navy, { z: L * 0.4 });
        gr.put(circ(ri * 0.2), PAL.cream, { z: L * 0.8 });
        gr.userData.dir = dir; gr.userData.rot0 = dir < 0 ? Math.PI / 8 : 0;
        body.add(gr); gears.push(gr);
      }
      // the funnel on top: a dark throat behind, the cone in front, so hearts fall in between
      body.put(poly([[-1.42, 2.06], [-0.42, 2.06], [-0.74, 1.5], [-1.1, 1.5]], 0.02), '#16233c', { z: -L * 0.2 });
      body.put(poly([[-1.46, 2.0], [-0.38, 2.0], [-0.74, 1.5], [-1.1, 1.5]], 0.03), PAL.gold, { z: L * 1.3 });
      body.put(rr(1.2, 0.1, 0.045, -0.92, 2.01), PAL.orange, { z: L * 1.7 });
      // the belt: rollers, band, cleats, two posts
      const belt = stack({ clip, z: L * 0.1 });
      for (const [x, h] of [[-2.52, 0.95], [-1.98, 1.78]]) belt.put(rr(0.07, h, 0, x, h / 2), '#8f98a8', { z: 0 });
      const band = stack({ clip, x: (A[0] + B[0]) / 2, y: (A[1] + B[1]) / 2, z: L * 0.5, rot: bang });
      band.put(rr(blen + 0.26, 0.26, 0.13), '#3d4560', { z: 0 });
      band.put(rr(blen + 0.1, 0.1, 0.05), '#596381', { z: L * 0.3 });
      for (const sx of [-blen / 2, blen / 2]) { band.put(circ(0.085, sx, 0), '#c9cfda', { z: L * 0.6 }); band.put(circ(0.03, sx, 0), '#3d4560', { z: L * 0.9 }); }
      belt.add(band);
      g.add(belt);
      // hearts riding it
      for (let i = 0; i < NH; i++) {
        const h = piece(heart(0.3), [PAL.rose, PAL.red, '#f07f8f'][i % 3], { clip, z: L * 0.9 });
        g.add(h); hearts.push(h);
      }
    } else {
      // gauge, three lights, the hatch and the chute
      body.put(circ(0.235, 0.42, 0.6), PAL.cream, { z: L * 1.1 });
      body.put(hole(circ(0.26, 0.42, 0.6), circ(0.215, 0.42, 0.6)), '#8fa6d6', { z: L * 1.3 });
      for (let i = 0; i < 5; i++) { const a = Math.PI * (1 - i / 4); body.put(rr(0.022, 0.05, 0, 0.42 + Math.cos(a) * 0.17, 0.6 + Math.sin(a) * 0.17), PAL.navy, { z: L * 1.4, rot: a - Math.PI / 2 }); }
      const nd = stack({ clip, x: 0.42, y: 0.6, z: L * 1.6 });
      nd.put(poly([[-0.02, -0.03], [0.02, -0.03], [0, 0.18]], 0), PAL.red, { z: 0 });
      nd.put(circ(0.035), PAL.navy, { z: L * 0.3 });
      body.add(nd); needle.push(nd);
      [PAL.red, PAL.yellow, '#7ed08a'].forEach((c, i) => {
        body.put(circ(0.07, 0.82 + i * 0.17, 0.72), '#16233c', { z: L * 1.0 });
        const lt = body.put(circ(0.05, 0.82 + i * 0.17, 0.72), c, { z: L * 1.3 });
        lights.push(lt);
      });
      body.put(rr(0.5, 0.07, 0.02, 0.99, 0.5), '#3f62a3', { z: L * 1.0 });
      body.put(rr(0.34, 0.07, 0.02, 0.91, 0.38), '#3f62a3', { z: L * 1.0 });
      // a lamp on the roof and a little chimney
      body.put(rr(0.3, 0.08, 0.02, 0.36, 1.59), '#8f98a8', { z: L * 0.9 });
      const bulb = body.put(poly([[0.24, 1.62], [0.48, 1.62], [0.48, 1.74], [0.36, 1.86], [0.24, 1.74]], [0, 0, 0.1, 0.12, 0.1]), PAL.red, { z: L * 0.6 });
      const glow = body.put(star(10, 0.3, 0.2, 0.36, 1.74, 0, 0.004), PAL.yellow, { z: L * 0.2 });
      bulbs.push({ bulb, glow });
      body.put(rr(0.2, 0.34, 0, 0.98, 1.68), '#8f98a8', { z: L * 0.4 });
      body.put(rr(0.3, 0.08, 0.03, 0.98, 1.86), '#6f7a8c', { z: L * 0.8 });
      // smoke: three puffs glued along a bent paper stalk that stands in the chimney
      const stalk = [[0.98, 1.88], [1.0, 2.08], [1.13, 2.28], [0.97, 2.52]];
      for (let i = 0; i < stalk.length - 1; i++) {
        const [x0, y0] = stalk[i], [x1, y1] = stalk[i + 1];
        g.put(rr(Math.hypot(x1 - x0, y1 - y0) + 0.03, 0.03, 0.012), '#efeadc', { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: L * 0.3, rot: Math.atan2(y1 - y0, x1 - x0) });
      }
      for (const [x, y, r] of [[1.0, 2.08, 0.1], [1.13, 2.28, 0.13], [0.97, 2.52, 0.16]]) {
        const pf = stack({ clip, x, y, z: L * 0.6 });
        pf.put(circ(r), PAL.white, { z: 0 }); pf.put(circ(r * 0.7, r * 0.75, -r * 0.2), PAL.white, { z: 0.001 }); pf.put(circ(r * 0.6, -r * 0.7, -r * 0.3), PAL.white, { z: 0.002 });
        g.add(pf); puffs.push(pf);
      }
      // hatch on the side and the chute that leads to the front of the page
      body.put(rr(0.2, 0.42, 0.04, 1.25, 0.62), '#16233c', { z: L * 1.0 });
      const chute = stack({ clip, z: L * 0.6 });
      chute.put(poly([[1.2, 0.52], [1.2, 0.36], [2.02, 0.04], [2.16, 0.04], [2.16, 0.16]], 0.02), PAL.orange, { z: 0 });
      chute.put(poly([[1.2, 0.58], [1.2, 0.5], [2.16, 0.12], [2.16, 0.2]], 0.01), '#c9692a', { z: L * 0.5 });
      g.add(chute);
      for (let i = 0; i < 3; i++) { const tk = art.coin({ clip, r: 0.085, z: L * 1.0 }); g.add(tk); tokens.push(tk); }
    }
  });

  // ---------------------------------------------------------------- front: the crate of likes, the users and the coins
  const front = env.fold({ z: 0.56, beta: 86 });
  const users = [], coins = [], signs = [];
  const frontG = env.span(front, (g, side, clip) => {
    if (side === 'L') {
      const crate = stack({ clip, x: -2.42, y: 0, z: L });
      const q = rng(12);
      for (let i = 0; i < 9; i++) crate.put(heart(0.3 + q() * 0.08), [PAL.rose, PAL.red, '#f07f8f'][i % 3], { x: -0.56 + i * 0.14 + (q() - 0.5) * 0.05, y: 0.7 + q() * 0.14 + (i % 2) * 0.07, z: -L * (0.2 + (i % 3) * 0.3), rot: (q() - 0.5) * 0.7 });
      crate.put(rr(1.46, 0.66, 0.03, 0, 0.33), PAL.kraft, { z: 0 });
      for (const y of [0.22, 0.44]) crate.put(rr(1.46, 0.03, 0, 0, y), '#b08a62', { z: L * 0.3 });
      for (const x of [-0.68, 0.68]) crate.put(rr(0.1, 0.66, 0.01, x, 0.33), '#b08a62', { z: L * 0.6 });
      // its label: letters cut from red paper, on a cream card
      const tag = stack({ clip, x: 0, y: 0.33, z: L * 1.2, rot: -0.03 });
      tag.put(rr(1.26, 0.44, 0.03), PAL.cream, { z: 0 });
      tag.add(cutSign(fonts.anton, 'REAL LIKES', 1.1, 0.26, PAL.red, { clip, z: L * 0.5, seed: 3 }));
      crate.add(tag);
      g.add(crate);
    } else {
      // users rise from behind the platform's lip, one by one
      const defs = [[1.66, 0.2, PAL.yellow, PAL.peach], [2.02, 0.2, PAL.white, PAL.brown], [2.38, 0.2, PAL.lilac, PAL.tan], [1.84, 0.4, PAL.pink, PAL.tan], [2.2, 0.4, PAL.orange, PAL.peach]];
      defs.forEach(([x, y, c, skin], i) => {
        const u = art.user({ clip, x, y, z: L * (i < 3 ? 1.0 : 0.4), s: 1.7, color: c, skin });
        for (const ex of [-0.032, 0.032]) u.put(circ(0.013, ex, 0.268), PAL.ink, { z: L * 0.9 });
        u.userData.y = y; u.userData.i = [0, 2, 4, 1, 3][i];
        g.add(u); users.push(u);
      });
      // the stack of coins
      for (let i = 0; i < 9; i++) {
        const c = stack({ clip, x: 2.84 + ((i * 7) % 3 - 1) * 0.012, y: 0.26 + 0.036 + i * 0.072, z: L * 1.0 });
        c.put(rr(0.4, 0.072, 0.03), i % 2 ? PAL.gold : '#e9a52a', { z: 0 });
        c.put(rr(0.3, 0.014, 0), PAL.orange, { z: L * 0.3 });
        c.userData.y = c.position.y; c.userData.i = i;
        g.add(c); coins.push(c);
      }
      const top = art.coin({ clip, x: 2.84, y: 0.26 + 9 * 0.072 + 0.17, z: L * 1.2, s: 1.5 });
      top.userData.y = top.position.y; top.userData.i = 9.5;
      g.add(top); coins.push(top);
      // the platform they stand on
      g.put(rr(1.72, 0.26, [0.05, 0.05, 0, 0], 2.28, 0.13), '#e88668', { z: L * 1.6 });
      g.put(rr(1.72, 0.06, 0, 2.28, 0.03), '#c9644a', { z: L * 1.9 });
      g.put(rr(0.6, 0.05, 0.02, 2.84, 0.285), '#c9644a', { z: L * 1.7 });           // the tray the coins land on
      // two signs that rise out of the page: PRETEND USERS, PRETEND MONEY
      for (const [x, h, lines, rot, i] of [[1.62, 1.5, ['PRETEND', 'USERS'], 0.05, 0], [2.84, 2.16, ['PRETEND', 'MONEY'], -0.04, 1]]) {
        const sg = stack({ clip, x, y: 0, z: L * (i ? 0.2 : 0.1) });
        sg.put(rr(0.045, h, 0, 0, h / 2), PAL.white, { z: 0 });
        // a red card with a cream face, and the two words cut from red paper
        const card = stack({ clip, x: i ? -0.17 : 0.32, y: h - 0.2, z: L * 0.5, rot });
        card.put(rr(0.98, 0.64, 0.05), PAL.red, { z: 0 });
        card.put(rr(0.91, 0.57, 0.035), PAL.cream, { z: L * 0.25 });
        card.add(cutSign(fonts.anton, lines[0], 0.78, 0.19, PAL.red, { clip, y: 0.135, z: L * 0.6, seed: 5 + i }));
        card.add(cutSign(fonts.anton, lines[1], 0.78, 0.19, PAL.red, { clip, y: -0.135, z: L * 0.6, seed: 9 + i }));
        sg.add(card);
        sg.userData = { ...sg.userData, h, i, rot };
        g.add(sg); signs.push(sg);
      }
    }
  });

  // ---------------------------------------------------------------- flat on the page: arrows that say which way it runs
  const arrow = (cx, s) => poly([[cx - 0.42 * s, -0.86], [cx + 0.1 * s, -0.86], [cx + 0.1 * s, -0.74], [cx + 0.42 * s, -0.98], [cx + 0.1 * s, -1.22], [cx + 0.1 * s, -1.1], [cx - 0.42 * s, -1.1]], 0.025);
  env.pages.left.add(piece(arrow(-1.75, 1), '#f3b9ad', { z: 0.004, cast: false }));
  env.pages.left.add(piece(arrow(-0.62, 1), '#f3b9ad', { z: 0.004, cast: false }));
  env.pages.right.add(piece(arrow(0.62, 1), '#f3b9ad', { z: 0.004, cast: false }));
  env.pages.right.add(piece(arrow(1.75, 1), '#f3b9ad', { z: 0.004, cast: false }));

  // ---------------------------------------------------------------- sound
  const sfx = [
    { t: tTurns, s: 'machine_start', g: 0.8 },
    { t: tTurns + 0.25, s: 'gear_tick', g: 0.5 }, { t: tTurns + 0.65, s: 'gear_tick', g: 0.5 },
    { t: tMoney + 0.1, s: 'coin_clink', g: 0.7 }, { t: tMoney + 0.38, s: 'coin_clink', g: 0.7 }, { t: tMoney + 0.66, s: 'coin_clink', g: 0.8 },
    { t: tSign[0], s: 'flap_flip', g: 0.8 }, { t: tSign[1], s: 'flap_flip', g: 0.8 }, { t: tSay, s: 'paper_pop', g: 0.5 },
  ];
  for (let i = 0; i < 5; i++) sfx.push({ t: tUsers + i * 0.13, s: 'paper_pop', g: 0.6 });
  for (let i = 0; i < NH; i++) for (let k = 0; k < 3; k++) {
    const t = (0.92 - i / NH + k) / HSPEED;                 // a heart drops into the funnel when its s passes 0.92
    if (t > 1.0 && t < S.dur - 0.2) sfx.push({ t, s: 'heart_drop', g: 0.45 });
  }

  return {
    sfx,
    key(lt) {
      const u = smooth(seg(lt, 1.0, Math.max(2.5, tSign[1] + 0.4)));
      return { pos: [lerp(-0.28, 0.26, u), 6.25, 9.75], target: [lerp(-0.28, 0.26, u), 0.88, -0.1], focus: [0, 1.0, -0.1], aperture: 0.1 };
    },
    animate(lt, open) {
      const q = twos(lt);
      for (const g of [machG.R, machG.L, frontG.R, frontG.L]) g.scale.y = sink(open);
      // hearts ride the belt and drop into the funnel
      hearts.forEach((h, i) => {
        const s = (((i / NH + q * HSPEED) % 1) + 1) % 1;
        const [x, y, u] = heartAt(s);
        h.position.x = x; h.position.y = y;
        h.rotation.z = s < 0.7 ? bang * 0.35 + Math.sin(i * 2.3 + Math.floor(q * 7.5)) * 0.08 : bang * 0.35 - u * 1.4;
        h.scale.setScalar(s < 0.7 ? 1 : lerp(1, 0.72, u));
      });
      // the machine runs from "turns": gears, needle, lights, puffs, a small shake
      const run = clamp((q - tTurns) / 0.3), a = Math.max(0, q - tTurns + 0.4) * 2.6;
      for (const g of gears) g.rotation.z = g.userData.rot0 + a * g.userData.dir;
      for (const n of needle) n.rotation.z = lerp(1.25, -1.0, run) + (run > 0 ? Math.sin(q * 23) * 0.12 : 0);
      lights.forEach((l, i) => { l.visible = run > 0 ? Math.floor(q * 7.5 + i) % 3 !== 0 : i === 0; });
      for (const b of bulbs) { const lit = run > 0 && Math.floor(q * 7.5) % 2 === 0; b.glow.visible = lit; }
      puffs.forEach((p, i) => { const ph = (q - tTurns) * 1.6 - i * 0.33, f = ph - Math.floor(ph); p.scale.setScalar(run > 0 && ph > 0 ? 0.8 + 0.32 * Math.sin(Math.PI * f) : 0.66); });
      for (const c of cogs) c.rotation.z = a * 0.12;
      const shake = run > 0 ? (Math.floor(q * 15) % 2 ? 0.008 : -0.008) : 0;
      for (const b of bodies) b.position.y = shake;
      // coins slide down the chute once the machine is paying out
      tokens.forEach((tk, i) => {
        const ph = (q - tUsers) * 1.5 - i / 3, f = ph - Math.floor(ph);
        tk.visible = ph > 0;
        tk.position.x = lerp(1.3, 2.08, f); tk.position.y = lerp(0.66, 0.3, f);
        tk.rotation.z = -f * 5;
      });
      // users rise one by one, with a little bounce
      for (const u of users) {
        const s = spring(q - tUsers - u.userData.i * 0.13, 3.0, 0.42);
        u.position.y = u.userData.y - 0.75 * (1 - s);
        u.visible = q > tUsers + u.userData.i * 0.13 - 0.02;
      }
      // coins land on the stack one by one
      for (const c of coins) {
        const t0 = tMoney + c.userData.i * 0.075, d = seg(q, t0, t0 + 0.14);
        c.visible = q >= t0;
        c.position.y = c.userData.y + 0.3 * (1 - ease.outCubic(d));
      }
      // each sign rises out of the page as its pile arrives; both nod once more on "not real"
      for (const sg of signs) {
        const i = sg.userData.i, t0 = tSign[i], s = spring(q - t0, 2.6, 0.5), again = q - tSay - i * 0.07;
        const nod = again >= 0 ? Math.exp(-again * 6) : 0;
        sg.position.y = -(sg.userData.h + 0.3) * (1 - clamp(s, 0, 1.08)) + 0.07 * nod * Math.abs(Math.sin(again * 16));
        sg.rotation.z = ((1 - clamp(s, 0, 1.3)) * 0.25 + 0.09 * nod * Math.sin(again * 22)) * (i ? -1 : 1);
        sg.visible = q > t0 - 0.02;
      }
    },
  };
}
