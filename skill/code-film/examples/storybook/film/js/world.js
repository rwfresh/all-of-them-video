// The whole paper world: table, lights, the book and every spread in it. One object, posed for any time T.
// Shots in cues.json are the spreads; each shot starts by turning its page.

import * as THREE from 'three';
import { Rig } from './rig.js';
import { Book } from './book.js';
import { PAL, rr, piece, stack } from './paper.js';
import { ease, tw, seg, lerp } from './util.js';
import { BUILDERS } from './spreads/index.js';

const TABLE = '#f5bb3c';
export const TURN = 0.95;                // seconds for a page to turn
const TURNS = { empire: 0.72 };            // spreads that turn at their own speed
const turnOf = (name) => TURNS[name] ?? TURN;
export const SPREADS = ['sam', 'idea', 'promo', 'post', 'game', 'empire', 'kim', 'end'];    // spread k = index + 1
const PAGE = { sam: '#f6ecd8', idea: '#e7def4', promo: '#27304f', post: '#d8eef8', game: '#fbe0da', empire: '#1f2a4a', kim: '#e2f0da', end: '#f6ecd8' };

let WORLD = null;
export function getWorld(ctx) { return (WORLD ??= build(ctx)); }

function build(ctx) {
  const { fonts, tl, renderer } = ctx;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(TABLE);
  const table = piece(rr(240, 240, 0), TABLE, { cast: false, bump: 0.7, plain: true });
  table.rotation.x = -Math.PI / 2;
  scene.add(table);

  const rig = new Rig(scene, { ground: TABLE });
  rig.keyDir.set(-0.42, 0.66, 0.62).normalize();

  const W = 3.2, D = 2.6;
  const leaves = [{ th: 0.055, board: PAL.navy, front: PAL.navy, back: PAGE.sam, w: W + 0.1, d: D + 0.14, r: 0.1 }];
  for (let k = 1; k < SPREADS.length; k++) leaves.push({ th: 0.02, board: PAL.white, front: PAGE[SPREADS[k - 1]], back: PAGE[SPREADS[k]] });
  const book = new Book({ pageW: W, pageD: D, leaves, base: { th: 0.055, board: PAL.navy, front: PAGE.end, w: W + 0.1, d: D + 0.14, r: 0.1 }, spine: '#1a2b47' });
  scene.add(book.group);

  const spreads = {};
  const KEYS = {};
  const v = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  SPREADS.forEach((name, i) => { spreads[name] = { k: i + 1, folds: [], animate: null }; });

  /** What a spread builder gets: the book, its own pages, and helpers that register what it adds. */
  const env = (name) => {
    const sp = spreads[name];
    return {
      book, fonts, W, D, name, tl, shot: tl.shot[name], mark: tl.mark, lines: tl.lines, keys: KEYS, turn: turnOf(name),
      pages: name === 'cover' ? { right: book.leaves[0].front } : book.pages(sp.k),
      fold: (o) => { const f = book.vfold(sp.k, o); sp.folds.push(f); return f; },
      /** Build art once per wing of a fold, cut at the crease. fn(g, side, clip) adds pieces to the stack g. */
      span: (f, fn) => {
        const out = {};
        for (const side of ['R', 'L']) {
          const clip = side === 'R' ? f.clipR : f.clipL;
          const g = stack({ clip });
          fn(g, side, clip);
          f[side].add(g);
          out[side] = g;
        }
        return out;
      },
    };
  };

  const SFX = {}, OVER = {}, LOOK = {}, CLOSE = {};
  let coverAnimate = null;
  for (const name of ['cover', ...SPREADS]) {
    if (!BUILDERS[name]) continue;
    try {
      const r = BUILDERS[name](env(name)) || {};
      if (spreads[name]) spreads[name].animate = r.animate || null;
      if (r.key) KEYS[name] = r.key;
      SFX[name] = r.sfx || [];
      OVER[name] = r.overlay || null; LOOK[name] = r.look || null;
      if (r.close) CLOSE[name] = r.close;                      // { at, dur }: the whole book shuts, back to its front cover
      if (r.endKey) KEYS.coverEnd = r.endKey;
      if (name === 'cover') coverAnimate = r.animate || null;
    } catch (e) { console.error(`[spread ${name}] failed to build: ${e.stack || e}`); }
  }
  const DEFAULT_KEY = { pos: [0, 6.3, 9.4], target: [0, 0.78, -0.1], focus: [0, 1.2, -0.25], aperture: 0.11 };

  const shots = tl.shots;
  const shotAt = (T) => shots.find((s) => T >= s.t0 && T < s.t1) || shots[shots.length - 1];
  const keyOf = (name, lt) => { const k = KEYS[name] || DEFAULT_KEY; return typeof k === 'function' ? k(lt) : k; };

  function pose(T) {
    // page turns: spread k opens at the start of its shot. A spread may also shut the whole book (the ending).
    const phi = new Array(book.n).fill(0);
    let closeU = 0, tClose = Infinity;
    for (const name of SPREADS) {
      const c = CLOSE[name], s = tl.shot[name];
      if (c && s) { tClose = s.t0 + c.at; closeU = tw(T, tClose, tClose + (c.dur ?? 0.9), ease.inOutCubic); }
    }
    SPREADS.forEach((name, i) => {
      const s = tl.shot[name];
      if (s) phi[i] = Math.PI * tw(T, s.t0, s.t0 + turnOf(name), ease.inOutCubic) * (1 - closeU);
    });
    // before it opens, the cover is bumped twice from inside
    const bump = (t0) => Math.sin(Math.PI * seg(T, t0, t0 + 0.1));
    phi[0] += 0.05 * bump(0.12) + 0.085 * bump(0.33);
    book.setTurns(phi);
    for (const name of SPREADS) {
      const sp = spreads[name], open = book.openAngle(sp.k), s = tl.shot[name];
      // pop-ups show once the spread is a few degrees open: flat inside a shut book they would poke past its edge
      for (const f of sp.folds) { f.R.visible = f.L.visible = open > 0.14; }
      if (sp.animate && s) sp.animate(T - s.t0, open / Math.PI);
    }
    if (coverAnimate) coverAnimate(T, { closeU, tClose });
    // camera: ease from the previous shot's key during the page turn
    const s = shotAt(T), i = shots.indexOf(s);
    const k1 = keyOf(s.name, T - s.t0), k0 = i > 0 ? keyOf(shots[i - 1].name, T - shots[i - 1].t0) : k1;
    const u = tw(T, s.t0, s.t0 + turnOf(s.name) * 1.25, ease.inOutCubic);
    rig.pos.lerpVectors(v(k0.pos), v(k1.pos), u);
    rig.target.lerpVectors(v(k0.target), v(k1.target), u);
    rig.focus.lerpVectors(v(k0.focus), v(k1.focus), u);
    rig.aperture = lerp(k0.aperture, k1.aperture, u);
    rig.pos.lerp(rig.target, seg(T, s.t0, s.t1) * 0.03);        // a slow push through every shot
    rig.keyTarget.set(0, 0, 0);
  }

  let lastT = null;
  return {
    scene, rig, book, spreads,
    sfx: (name) => SFX[name] || [],
    /** A spread may draw flat pictures over its shot (overlay(g, lt), on the 1920x1080 canvas) and adjust the look. */
    overlay: (name, g, lt) => (OVER[name] ? OVER[name](g, lt) === true : false),
    look: (name, lt) => (LOOK[name] ? LOOK[name](lt) : null),
    render(T, post, renderer_, i, K) {
      if (T !== lastT) { pose(T); lastT = T; }
      rig.sample(i ?? 0, K ?? 1, post.W, post.H);
      renderer_.setRenderTarget(post.scene);
      renderer_.render(scene, rig.cam);
    },
  };
}
