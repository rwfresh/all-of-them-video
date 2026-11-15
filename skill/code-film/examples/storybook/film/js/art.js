// The cast and the props, each built from layered paper pieces. Coordinates are a wing's: x across, y up, z toward
// the reader. Every builder takes { clip } so a piece that crosses a fold can be cut at the crease.

import * as THREE from 'three';
import { PAL, LAYER as L, rr, circ, ell, poly, star, heart, hole, piece, stack, printed } from './paper.js';

/** A curved strip: part of a ring centred on (cx, cy). Smiles, brows, steam. */
export function band(cx, cy, r, a0, a1, w, n = 14) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push([cx + Math.cos(a) * (r + w / 2), cy + Math.sin(a) * (r + w / 2)]); }
  for (let i = n; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / n; pts.push([cx + Math.cos(a) * (r - w / 2), cy + Math.sin(a) * (r - w / 2)]); }
  return poly(pts, 0);
}
const D = Math.PI / 180;

/** A ring (annulus). */
export function ring(ro, ri, cx = 0, cy = 0) { return hole(circ(ro, cx, cy), circ(ri, cx, cy)); }

/**
 * A person from the waist up, origin at the middle of the waist. About 1.45 tall at scale 1.
 * o: skin, shirt, hair, style ('sam' | 'kim'), glasses, clip, x, y, s.
 * Returns the group; userData has browL, browR, mouth, eyes for acting.
 */
export function person(o = {}) {
  const g = stack(o);
  const skin = o.skin ?? PAL.tan, shirt = o.shirt ?? PAL.teal, hair = o.hair ?? PAL.umber, style = o.style ?? 'sam';
  const hy = 1.08;                                     // head centre
  // torso and a T-shirt collar
  g.put(poly([[-0.46, 0], [0.46, 0], [0.37, 0.72], [-0.37, 0.72]], [0.02, 0.02, 0.2, 0.2]), shirt, { z: 0 });
  g.put(rr(0.18, 0.26, 0.06, 0, 0.78), skin, { z: L * 0.6 });
  g.put(poly([[-0.17, 0.725], [0.17, 0.725], [0, 0.57]], 0.03), o.collar ?? PAL.white, { z: L * 0.9 });
  // hair behind the head
  if (style === 'kim') {
    g.put(rr(0.76, 0.6, [0.3, 0.3, 0.1, 0.1], 0, hy + 0.035), hair, { z: L * 1.2 });        // a bob that stops at the jaw
    g.put(circ(0.16, 0, hy + 0.4), hair, { z: L * 1.1 });               // bun
  }
  // ears, head
  g.put(circ(0.065, -0.285, hy - 0.03), skin, { z: L * 1.6 });
  g.put(circ(0.065, 0.285, hy - 0.03), skin, { z: L * 1.6 });
  g.put(ell(0.29, 0.31, 0, hy), skin, { z: L * 2 });
  // hair on top
  if (style === 'sam') {
    g.put(poly([[-0.31, hy + 0.02], [-0.32, hy + 0.17], [-0.2, hy + 0.31], [0.02, hy + 0.37], [0.22, hy + 0.3], [0.33, hy + 0.14], [0.31, hy + 0.0],
      [0.24, hy + 0.13], [0.1, hy + 0.19], [-0.04, hy + 0.13], [-0.16, hy + 0.2], [-0.25, hy + 0.12]], 0.05), hair, { z: L * 3 });
    g.put(poly([[0.0, hy + 0.34], [0.1, hy + 0.47], [0.2, hy + 0.33]], 0.04), hair, { z: L * 2.8 });   // a tuft
  } else {
    g.put(poly([[-0.33, hy - 0.1], [-0.33, hy + 0.16], [-0.2, hy + 0.31], [0.0, hy + 0.35], [0.2, hy + 0.31], [0.33, hy + 0.16], [0.33, hy - 0.1],
      [0.25, hy + 0.1], [0.1, hy + 0.2], [-0.25, hy + 0.14]], 0.06), hair, { z: L * 3 });
  }
  // face
  const eyes = [g.put(circ(0.033, -0.11, hy - 0.01), PAL.ink, { z: L * 3.2 }), g.put(circ(0.033, 0.11, hy - 0.01), PAL.ink, { z: L * 3.2 })];
  g.put(circ(0.05, -0.2, hy - 0.11), PAL.pink, { z: L * 2.6 });
  g.put(circ(0.05, 0.2, hy - 0.11), PAL.pink, { z: L * 2.6 });
  const mouth = g.put(band(0, hy - 0.06, 0.085, 215 * D, 325 * D, 0.026), PAL.ink, { z: L * 3.2 });
  const browL = g.put(rr(0.11, 0.024, 0.012), PAL.ink, { x: -0.11, y: hy + 0.105, z: L * 3.6 });
  const browR = g.put(rr(0.11, 0.024, 0.012), PAL.ink, { x: 0.11, y: hy + 0.105, z: L * 3.6 });
  if (o.glasses ?? style === 'sam') {
    g.put(ring(0.1, 0.078, -0.11, hy - 0.01), PAL.charcoal, { z: L * 3.4 });
    g.put(ring(0.1, 0.078, 0.11, hy - 0.01), PAL.charcoal, { z: L * 3.4 });
    g.put(rr(0.05, 0.022, 0.01, 0, hy + 0.0), PAL.charcoal, { z: L * 3.4 });
  }
  g.userData = { ...g.userData, eyes, mouth, browL, browR };
  return g;
}

/** A crown for whoever is winning. */
export function crown(o = {}) {
  const g = stack(o);
  const pts = [[-0.2, 0], [0.2, 0], [0.26, 0.24], [0.11, 0.12], [0, 0.28], [-0.11, 0.12], [-0.26, 0.24]];
  // o.outline: a dark keyline behind the crown, for when it flies over something as yellow as itself
  if (o.outline) g.put(poly(pts.map(([x, y]) => [x * 1.24, (y - 0.1) * 1.42 + 0.1]), 0.03), o.outline, { z: -L * 0.5 });
  g.put(poly(pts, 0.02), PAL.gold, { z: 0 });
  g.put(rr(0.4, 0.07, 0.02, 0, 0.035), PAL.orange, { z: L * 0.5 });
  for (const x of [-0.12, 0, 0.12]) g.put(circ(0.022, x, 0.035), PAL.white, { z: L });
  return g;
}

export function desk(o = {}) {
  const g = stack(o), w = o.w ?? 3.5;
  g.put(rr(w - 0.2, 0.58, [0, 0, 0.05, 0.05], 0, 0.29), PAL.kraft, { z: 0 });
  g.put(rr(w, 0.13, 0.05, 0, 0.6), PAL.brown, { z: L });
  for (const x of [-1.05, 1.05]) {
    g.put(rr(0.86, 0.26, 0.04, x, 0.31), '#d8b48e', { z: L * 0.7 });
    g.put(rr(0.2, 0.045, 0.02, x, 0.31), PAL.brown, { z: L * 1.4 });
  }
  return g;
}

/** A laptop seen from behind, lid up, with stickers. Origin: middle of its base. */
export function laptop(o = {}) {
  const g = stack(o);
  g.put(rr(0.98, 0.06, 0.025, 0, 0.03), PAL.grey, { z: 0 });
  g.put(rr(0.9, 0.6, 0.06, 0, 0.36), PAL.lightgrey, { z: L });
  g.put(circ(0.075, 0, 0.38), PAL.white, { z: L * 1.6 });
  g.put(heart(0.13, -0.27, 0.5), PAL.rose, { z: L * 1.6, rot: 0.2 });
  g.put(star(5, 0.085, 0.04, 0.29, 0.21, 0.3, 0.01), PAL.gold, { z: L * 1.6 });
  g.put(rr(0.2, 0.09, 0.03, 0.25, 0.52), PAL.teal, { z: L * 1.6, rot: -0.12 });
  g.put(circ(0.05, -0.3, 0.2), PAL.orange, { z: L * 1.6 });
  return g;
}

export function mug(o = {}) {
  const g = stack(o);
  g.put(ring(0.075, 0.042, 0.13, 0.12), o.color ?? PAL.white, { z: 0 });
  g.put(rr(0.22, 0.24, [0.02, 0.02, 0.07, 0.07], 0, 0.12), o.color ?? PAL.white, { z: L * 0.6 });
  g.put(rr(0.22, 0.05, 0, 0, 0.14), o.stripe ?? PAL.red, { z: L });
  g.put(band(-0.03, 0.36, 0.06, -70 * D, 70 * D, 0.022), PAL.white, { z: L * 0.4 });
  g.put(band(0.05, 0.46, 0.06, 110 * D, 250 * D, 0.022), PAL.white, { z: L * 0.4 });
  return g;
}

export function plant(o = {}) {
  const g = stack(o);
  const leaves = [[-0.2, 0.42, 0.5], [0.2, 0.44, -0.5], [-0.09, 0.56, 0.18], [0.1, 0.58, -0.2], [0, 0.66, 0]];
  leaves.forEach(([x, y, rot], i) => g.put(ell(0.075, 0.2, 0, 0), i % 2 ? PAL.green : PAL.leaf, { x, y, rot, z: L * (0.3 + i * 0.25) }));
  g.put(poly([[-0.16, 0.26], [0.16, 0.26], [0.12, 0], [-0.12, 0]], 0.03), '#cf7448', { z: L * 1.8 });
  g.put(rr(0.38, 0.07, 0.03, 0, 0.27), '#b85f38', { z: L * 2.3 });
  return g;
}

/** A pile of books lying flat. */
export function books(o = {}) {
  const g = stack(o);
  const cols = o.colors ?? [PAL.plum, PAL.gold, PAL.rose];
  cols.forEach((c, i) => {
    g.put(rr(0.5 - i * 0.04, 0.085, 0.015, (i % 2 ? 0.02 : -0.02), 0.045 + i * 0.09), c, { z: L * i * 0.3 });
    g.put(rr(0.05, 0.085, 0, -0.12 + i * 0.03, 0.045 + i * 0.09), PAL.white, { z: L * (i * 0.3 + 0.5) });
  });
  return g;
}

/** A window with sky and a cloud. Origin: centre. */
export function windowPane(o = {}) {
  const g = stack(o), w = o.w ?? 1.0, h = o.h ?? 0.96;
  g.put(rr(w, h, 0.07), PAL.white, { z: 0 });
  g.put(rr(w - 0.16, h - 0.16, 0.03), o.sky ?? PAL.sky, { z: L * 0.5 });
  for (const [x, y, r] of [[-0.12, 0.12, 0.1], [0.0, 0.17, 0.13], [0.13, 0.12, 0.09]]) g.put(circ(r, x, y), PAL.white, { z: L * 0.9 });
  g.put(rr(0.34, 0.1, 0.04, 0.0, 0.08), PAL.white, { z: L * 0.9 });
  g.put(circ(0.09, -0.2, -0.16), PAL.yellow, { z: L * 0.8 });
  g.put(rr(0.045, h - 0.1, 0), PAL.white, { z: L * 1.3 });
  g.put(rr(w - 0.1, 0.045, 0), PAL.white, { z: L * 1.3 });
  g.put(rr(w + 0.14, 0.085, 0.03, 0, -h / 2), PAL.white, { z: L * 1.8 });
  return g;
}

/** A small rocket. Origin: centre. Points up. */
export function rocket(o = {}) {
  const g = stack(o);
  g.put(poly([[-0.16, -0.3], [-0.02, -0.12], [-0.02, -0.34]], 0.02), PAL.red, { z: 0 });
  g.put(poly([[0.16, -0.3], [0.02, -0.12], [0.02, -0.34]], 0.02), PAL.red, { z: 0 });
  g.put(poly([[-0.07, -0.34], [0.07, -0.34], [0, -0.52]], 0.02), PAL.gold, { z: L * 0.2 });
  g.put(ell(0.105, 0.3, 0, -0.02), PAL.white, { z: L * 0.6 });
  g.put(poly([[-0.085, 0.14], [0.085, 0.14], [0, 0.3]], [0, 0, 0.05]), PAL.red, { z: L });
  g.put(circ(0.05, 0, 0.02), PAL.sky, { z: L * 1.2 });
  g.put(ring(0.062, 0.046, 0, 0.02), PAL.charcoal, { z: L * 1.5 });
  return g;
}

/** A pinned poster with a rocket. */
export function poster(o = {}) {
  const g = stack(o);
  g.put(rr(0.72, 0.94, 0.03), PAL.cream, { z: 0 });
  g.put(rr(0.6, 0.82, 0.02), PAL.navy, { z: L * 0.5 });
  for (const [x, y, r] of [[-0.2, 0.28, 0.018], [0.18, 0.18, 0.014], [-0.14, -0.26, 0.014], [0.21, -0.2, 0.02], [0.05, 0.33, 0.012]]) g.put(circ(r, x, y), PAL.yellow, { z: L * 0.9 });
  g.add(rocket({ clip: o.clip, x: 0, y: 0.04, z: L, rot: 0.35, s: 0.95 }));
  g.put(rr(0.2, 0.07, 0.01, -0.3, 0.45), PAL.pink, { z: L * 1.6, rot: 0.5 });
  g.put(rr(0.2, 0.07, 0.01, 0.3, 0.45), PAL.pink, { z: L * 1.6, rot: -0.5 });
  return g;
}

/** A shelf with books and a cactus. Origin: middle of the plank. */
export function shelf(o = {}) {
  const g = stack(o);
  g.put(rr(1.0, 0.07, 0.02, 0, 0), PAL.brown, { z: L });
  const cols = [PAL.red, PAL.gold, PAL.teal, PAL.plum, PAL.orange];
  let x = -0.42;
  cols.forEach((c, i) => {
    const w = 0.075 + (i % 3) * 0.015, h = 0.3 + ((i * 7) % 4) * 0.035;
    g.put(rr(w, h, 0.012, x + w / 2, 0.035 + h / 2), c, { z: L * 0.5, rot: i === 4 ? -0.16 : 0 });
    x += w + 0.012;
  });
  g.put(ell(0.07, 0.13, 0.28, 0.2), PAL.green, { z: L * 0.4 });
  g.put(ell(0.04, 0.07, 0.36, 0.2), PAL.leaf, { z: L * 0.3, rot: -0.5 });
  g.put(poly([[0.2, 0.13], [0.36, 0.13], [0.33, 0.035], [0.23, 0.035]], 0.015), '#cf7448', { z: L * 0.8 });
  return g;
}

/** A coin. o.face: a letter or symbol printed on it. */
export function coin(o = {}) {
  const g = stack(o), r = o.r ?? 0.12;
  g.put(circ(r), o.rim ?? PAL.orange, { z: 0 });
  g.put(circ(r * 0.8), o.color ?? PAL.gold, { z: L * 0.4 });
  if (o.star !== false) g.put(star(5, r * 0.46, r * 0.2, 0, 0, 0, 0.004), o.rim ?? PAL.orange, { z: L * 0.8 });
  return g;
}

export { THREE };

// ---------------------------------------------------------------- the two machines in the story

/**
 * The app Sam made up: an AI that flips a coin. A small boxy robot, about 1.75 tall, origin between its feet.
 * userData: head, eyes [l, r], mouth, armL, armR (groups hinged at the shoulder), coin (group in its right hand),
 * dots [3 thinking lights on its chest], antenna.
 */
export function coinBot(o = {}) {
  const g = stack(o), clip = o.clip, body = o.color ?? PAL.teal, dark = o.dark ?? '#157a74';
  // feet and legs
  for (const x of [-0.2, 0.2]) { g.put(rr(0.1, 0.2, 0.02, x, 0.16), PAL.grey, { z: 0 }); g.put(rr(0.26, 0.1, [0.05, 0.05, 0, 0], x, 0.05), PAL.charcoal, { z: L * 0.4 }); }
  // arms (behind the body), hinged at the shoulder
  const arm = (sg) => {
    const a = stack({ clip, x: sg * 0.44, y: 0.82, z: L * 0.2 });
    a.put(rr(0.12, 0.42, 0.06, 0, -0.17), PAL.grey, { z: 0 });
    a.put(circ(0.085, 0, -0.38), PAL.charcoal, { z: L * 0.3 });
    return a;
  };
  const armL = arm(-1), armR = arm(1);
  armL.rotation.z = -0.35; armR.rotation.z = 2.3;                       // right arm raised, holding the coin
  const cn = coin({ clip, x: 0, y: -0.55, z: L * 0.7, s: 1.25 });
  armR.add(cn);
  g.add(armL, armR);
  // body with a chest panel and three thinking lights
  g.put(rr(0.86, 0.72, 0.12, 0, 0.6), body, { z: L * 0.8 });
  g.put(rr(0.56, 0.3, 0.06, 0, 0.52), dark, { z: L * 1.2 });
  const dots = [-0.15, 0, 0.15].map((x) => g.put(circ(0.045, x, 0.52), PAL.yellow, { z: L * 1.6 }));
  g.put(rr(0.24, 0.05, 0.02, 0, 0.84), dark, { z: L * 1.2 });
  // neck, head with a screen for a face, antenna
  g.put(rr(0.16, 0.12, 0, 0, 1.0), PAL.grey, { z: L * 0.6 });
  const head = stack({ clip, x: 0, y: 1.32, z: L * 1.4 });
  head.put(rr(0.9, 0.62, 0.16), PAL.cream, { z: 0 });
  head.put(rr(0.72, 0.44, 0.1), PAL.navy, { z: L * 0.5 });
  const eyes = [head.put(circ(0.07, -0.17, 0.04), PAL.white, { z: L }), head.put(circ(0.07, 0.17, 0.04), PAL.white, { z: L })];
  const mouth = head.put(band(0, -0.03, 0.09, 215 * D, 325 * D, 0.03), PAL.white, { z: L });
  for (const x of [-0.5, 0.5]) head.put(rr(0.08, 0.2, 0.03, x, 0), PAL.grey, { z: -L * 0.3 });
  const antenna = stack({ clip, x: 0, y: 0.31, z: -L * 0.2 });
  antenna.put(rr(0.035, 0.26, 0, 0, 0.12), PAL.grey, { z: 0 });
  antenna.put(circ(0.07, 0, 0.28), PAL.gold, { z: L * 0.3 });
  head.add(antenna);
  g.add(head);
  g.userData = { ...g.userData, head, eyes, mouth, armL, armR, coin: cn, dots, antenna };
  return g;
}

/**
 * Sam's AI agent: a terminal window with a face. About 1.0 wide and 0.8 tall, origin at the middle of its bottom edge.
 * userData: eyes [l, r], prompt (the "> _" group), cursor.
 */
export function buddy(o = {}) {
  const g = stack(o), clip = o.clip;
  g.put(rr(1.06, 0.8, 0.09, 0, 0.4), PAL.charcoal, { z: 0 });
  g.put(rr(1.06, 0.17, [0.09, 0.09, 0, 0], 0, 0.715), '#444a61', { z: L * 0.4 });
  [PAL.red, PAL.gold, PAL.green].forEach((c, i) => g.put(circ(0.034, -0.42 + i * 0.1, 0.715), c, { z: L * 0.8 }));
  const eyes = [g.put(rr(0.09, 0.15, 0.045, -0.17, 0.44), PAL.white, { z: L * 0.8 }), g.put(rr(0.09, 0.15, 0.045, 0.17, 0.44), PAL.white, { z: L * 0.8 })];
  const prompt = stack({ clip, x: 0, y: 0.19, z: L * 0.8 });
  prompt.put(poly([[-0.2, 0.075], [-0.2, 0.025], [-0.105, -0.0], [-0.2, -0.025], [-0.2, -0.075], [-0.04, -0.0]], 0.006), PAL.mint, { z: 0 });
  const cursor = prompt.put(rr(0.17, 0.045, 0.01, 0.1, -0.055), PAL.mint, { z: 0 });
  g.add(prompt);
  g.userData = { ...g.userData, eyes, prompt, cursor };
  return g;
}

/** A tiny paper person, a "user": head and shoulders, about 0.34 tall. */
export function user(o = {}) {
  const g = stack(o), c = o.color ?? PAL.sky;
  g.put(rr(0.24, 0.2, [0.1, 0.1, 0.02, 0.02], 0, 0.1), c, { z: 0 });
  g.put(circ(0.085, 0, 0.26), o.skin ?? PAL.peach, { z: L * 0.5 });
  return g;
}
