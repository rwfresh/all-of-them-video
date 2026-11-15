// Spread 7: "This is Kim. Kim earns more. Sam is fine. Sam is totally fine."
// A sports-day podium. Kim springs up on the left, the MONTHLY INCOME board flips to put her first (by one dollar),
// one last coin lands on her stack, the crown rides a paper track from Sam's head to hers and a LEADERBOARD tag drops
// under the board. "Sam is fine.": Sam cries. "Sam is totally fine.": he shuts his eyes and a dream swells out of
// his head: the same board the other way up, and Sam crowned on top of his tower. The camera rises with it. It
// bursts just before the page turns.

import * as THREE from 'three';
import { PAL, LAYER as L, rr, circ, ell, poly, star, hole, piece, stack, printed } from '../paper.js';
import { cutText, cutSign } from '../type.js';
import * as art from '../art.js';
import { rng, spring, tw, ease, seg, lerp, clamp, smooth } from '../util.js';

const twos = (t) => Math.floor(t * 15 + 1e-4) / 15;
const D2R = Math.PI / 180;
const BOARD = '#22355c', ROW1 = '#35558f', ROW2 = '#2b416e';

/** Set `text` at `size` px in Anton, shrinking it to fit `room` px. Returns the size used. */
function fit(c, text, size, room) {
  c.font = `${size}px "Anton"`;
  const w = c.measureText(text).width;
  if (w > room) { size *= room / w; c.font = `${size}px "Anton"`; }
  return size;
}

/** One half of a board row, printed. kind 'L': rank badge and name; kind 'R': the amount, right-aligned. */
function rowCard(w, h, kind, o) {
  return printed(w, h, (c, W, H) => {
    c.fillStyle = o.bg; c.fillRect(0, 0, W, H);
    c.textBaseline = 'alphabetic';
    const size = H * 0.66;
    if (kind === 'L') {
      c.fillStyle = o.first ? PAL.gold : '#9fb2dc';
      c.beginPath(); c.arc(H * 0.56, H * 0.5, H * 0.34, 0, 7); c.fill();
      c.fillStyle = BOARD; c.textAlign = 'center'; c.font = `${H * 0.5}px "Anton"`; c.fillText(String(o.rank), H * 0.56, H * 0.5 + H * 0.5 * 0.37);
      c.fillStyle = o.name ? PAL.cream : '#6f84b5'; c.textAlign = 'left'; c.font = `${size}px "Anton"`;
      c.fillText(o.name || '· · ·', H * 1.14, H * 0.5 + size * 0.37);
    } else {
      const text = o.amount || '· · ·', pad = H * 0.3;
      const s = fit(c, text, size, W - pad - H * 0.16), y = H * 0.5 + s * 0.37;
      c.textAlign = 'right';
      if (o.amount && o.first) {
        // the winning amount: gold, with the one dollar that decides it picked out in white
        const last = text.slice(-1), head = text.slice(0, -1), lw = c.measureText(last).width;
        c.fillStyle = PAL.white; c.fillText(last, W - pad, y);
        c.fillRect(W - pad - lw, y + s * 0.09, lw, Math.max(2, s * 0.07));
        c.fillStyle = PAL.gold; c.fillText(head, W - pad - lw, y);
      } else {
        c.fillStyle = o.amount ? PAL.cream : '#6f84b5'; c.fillText(text, W - pad, y);
      }
    }
  }, { ...o, bump: 0.6 });
}

/** One word of the board's heading. */
function headCard(w, h, text, align, o) {
  return printed(w, h, (c, W, H) => {
    c.fillStyle = BOARD; c.fillRect(0, 0, W, H);
    c.fillStyle = PAL.cream; c.textBaseline = 'alphabetic'; c.textAlign = align;
    const size = H * 0.86; c.font = `${size}px "Anton"`;
    c.fillText(text, align === 'right' ? W - H * 0.2 : H * 0.2, H * 0.5 + size * 0.37);
  }, { ...o, bump: 0.6 });
}

export function build(env) {
  const { fonts } = env;
  const S = env.shot;
  const at = (word) => env.mark('kim', word) - S.t0;
  // every beat hangs on a spoken word of "This is Kim. Kim earns more. Sam is fine. Sam is totally fine."
  const tKim = Math.max(at('This'), 0.8);                   // Kim springs up (after the page has landed)
  const tSwap = at('Kim earns');                            // the board flips as her sentence starts
  const tCrown = at('earns');                               // the crown leaves Sam
  const tMore = at('more');                                 // the one coin that decides it
  const tDream = at('Sam is totally');                      // "Sam is totally fine.": he shuts his eyes and the dream swells out of his head
  const KW = env.lines.kim.words, kAt = (i) => env.lines.kim.at + KW[i].t0 - S.t0;
  const tCloud = tDream + 0.2;                              // the cloud itself
  const tFlip = Math.max(tCloud + 0.3, kAt(KW.length - 2)); // "totally": the board in the dream flips his way
  const tDCrown = Math.max(tFlip + 0.34, kAt(KW.length - 1) + 0.08);   // "fine.": the crown lands on the Sam in the dream
  const tPop = Math.max(tDCrown + 0.5, S.dur - 0.2);        // it bursts just before the page turns
  const UP = 0.27, HANG = 2 / 30, DOWN = 0.27, CROWN = UP + HANG + DOWN;      // the crown's flight: up, a two-frame hang, down
  const tLand = tCrown + CROWN;
  const tSad = Math.min(tCrown + 0.4, tDream - 0.2);        // the crown is gone: he cries all through "Sam is fine."
  /** How far along the track the crown is, `t` seconds after it leaves. */
  const H = Math.PI / 2;
  const flight = (t) => (t <= 0 ? 0 : t < UP ? 0.5 * Math.sin(H * (t / UP)) : t < UP + HANG ? 0.5 : t < CROWN ? 1 - 0.5 * Math.cos(H * ((t - UP - HANG) / DOWN)) : 1);

  // ---------------------------------------------------------------- back wall: sky and bunting
  const wall = env.fold({ z: -1.05, beta: 70 });
  env.span(wall, (g, side, clip) => {
    const sg = side === 'R' ? 1 : -1;
    g.put(rr(6.1, 2.5, [0.3, 0.3, 0, 0], 0, 1.25), PAL.sky, { z: 0 });
    g.put(rr(6.1, 0.34, 0, 0, 0.17), '#7fb86a', { z: L * 0.5 });
    for (let i = 0; i < 9; i++) g.put(poly([[sg * (0.2 + i * 0.34) - 0.1, 0.34], [sg * (0.2 + i * 0.34) + 0.1, 0.34], [sg * (0.2 + i * 0.34), 0.5]], 0.01), '#7fb86a', { z: L * 0.5 });
    // bunting along a sagging string
    const cols = [PAL.red, PAL.gold, PAL.teal, PAL.plum, PAL.pink, PAL.orange];
    const line = (u) => [sg * (0.12 + u * 2.86), 2.28 - 0.2 * Math.sin(Math.PI * u)];
    const pts = [];
    for (let i = 0; i <= 16; i++) { const [x, y] = line(i / 16); pts.push([x, y + 0.012]); }
    for (let i = 16; i >= 0; i--) { const [x, y] = line(i / 16); pts.push([x, y - 0.012]); }
    g.put(poly(pts, 0), PAL.white, { z: L * 0.9 });
    for (let i = 0; i < 9; i++) {
      const [x, y] = line((i + 0.5) / 9);
      g.put(poly([[x - 0.13, y], [x + 0.13, y], [x, y - 0.27]], 0.01), cols[(i + (side === 'R' ? 3 : 0)) % cols.length], { z: L * 1.2 });
    }
  });

  // ---------------------------------------------------------------- the board: ranked by monthly income
  const board = env.fold({ z: -0.42, beta: 79 });
  const rows = [], tags = [];
  const RW = 1.42, RH = 0.42;                               // one half of a row
  env.span(board, (g, side, clip) => {
    const sg = side === 'R' ? 1 : -1;
    g.put(rr(0.1, 1.2, 0, sg * 1.18, 0.6), PAL.brown, { z: 0 });
    g.put(rr(3.14, 1.62, 0.09, 0, 1.62), PAL.gold, { z: L * 0.5 });
    g.put(rr(3.02, 1.5, 0.06, 0, 1.62), BOARD, { z: L * 0.9 });
    g.add(headCard(1.3, 0.3, side === 'L' ? 'MONTHLY' : 'INCOME', side === 'L' ? 'right' : 'left', { clip, x: sg * 0.67, y: 2.15, z: L * 1.2, cast: false }));
    g.put(rr(2.86, 0.03, 0, 0, 1.96), PAL.gold, { z: L * 1.2 });
    // two rows, each with a before and an after card: Sam alone, then Kim above Sam by one dollar
    const defs = [
      { y: 1.68, before: { rank: 1, name: 'SAM', amount: '$1,000,000', first: false, bg: ROW1 }, after: { rank: 1, name: 'KIM', amount: '$1,000,001', first: true, bg: ROW1 } },
      { y: 1.18, before: { rank: 2, name: '', amount: '', first: false, bg: ROW2 }, after: { rank: 2, name: 'SAM', amount: '$1,000,000', first: false, bg: ROW2 } },
    ];
    // what this is, hung under the board when the crown lands: LEADER on one wing, BOARD on the other
    const tag = stack({ clip, x: sg * 0.57, y: 0.84, z: L * 0.7 });
    for (const x of [-0.36, 0.36]) tag.put(rr(0.025, 0.16, 0, x, -0.05), PAL.cream, { z: -L * 0.2, core: false, cut: false });
    tag.put(rr(1.14, 0.46, [side === 'L' ? 0.05 : 0, side === 'L' ? 0 : 0.05, side === 'L' ? 0 : 0.05, side === 'L' ? 0.05 : 0], 0, -0.34), '#b93a22', { z: 0 });
    tag.put(rr(1.04, 0.36, 0.02, 0, -0.34), PAL.red, { z: L * 0.3, core: false });
    tag.add(cutSign(env.fonts.anton, side === 'L' ? 'LEADER' : 'BOARD', 0.92, 0.25, PAL.cream, { clip, x: 0, y: -0.34, z: L * 0.7, align: side === 'L' ? 'right' : 'left', seed: 3 }));
    g.add(tag); tags.push(tag);
    defs.forEach((d, i) => {
      const row = stack({ clip, x: sg * (0.02 + RW / 2), y: d.y, z: L * 1.3 });
      const shape = () => (side === 'L' ? rr(RW, RH, [0.06, 0, 0, 0.06]) : rr(RW, RH, [0, 0.06, 0.06, 0]));
      const a = rowCard(RW, RH, side, { clip, ...d.before, cast: false, shape: shape() });
      const b = rowCard(RW, RH, side, { clip, ...d.after, cast: false, shape: shape() });
      row.add(a, b);
      row.userData = { ...row.userData, a, b, i };
      g.add(row); rows.push(row);
    });
  });

  // ---------------------------------------------------------------- the podium, Kim and Sam, the crown and its track
  const cast = env.fold({ z: 0.34, beta: 85 });
  const KX = -2.02, SX = 2.02, KB = 0.68, SB = 0.38;       // where each stands, and how tall each block is
  const SC = 0.92, HY = 1.08, ARC = 0.95;                   // high enough that the track clears the board's heading
  const crownAt = (u) => [lerp(SX, KX, u), lerp(SB + 0.3 + (HY + 0.33) * SC, KB + 0.3 + (HY + 0.33) * SC, u) + ARC * Math.pow(Math.sin(Math.PI * clamp(u)), 0.45)];
  const crowns = [], plates = [], stacksK = [], stacksS = [];
  let kim = null, sam = null, kimRoot = null, samRoot = null, burst = null, frown = null, gasp = null, waveArm = null;
  let dreamRoot = null, dreamTower = null, dreamSam = null, dreamCrown = null, dreamPop = null;
  const dreamRows = [], dreamArms = [], puffs = [], sparks = [], shut = [], streams = [], drops = [];
  let rosette = null, lastCoin = null;
  const samArms = [];
  const COINS = 12, CX = 2.9, CH = 0.072;                   // both have twelve coins; Kim gets one more

  const legs = (root, c) => {
    for (const x of [-0.13, 0.13]) { root.put(rr(0.17, 0.36, 0.03, x, 0.16), c, { z: 0 }); root.put(rr(0.24, 0.085, [0.04, 0.04, 0.01, 0.01], x + (x < 0 ? -0.02 : 0.02), 0.04), PAL.charcoal, { z: L * 0.4 }); }
  };
  const arm = (person, sgn, shirt, skin, rot) => {
    const a = stack({ clip: person.userData.clip, x: sgn * 0.37, y: 0.6, z: -L * 0.4 });
    a.put(rr(0.17, 0.6, 0.085, 0, 0.27), shirt, { z: 0 });
    a.put(circ(0.092, 0, 0.6), skin, { z: L * 0.3 });
    a.rotation.z = rot;
    person.add(a);
    return a;
  };

  env.span(cast, (g, side, clip) => {
    // the track the crown slides along: a card arch from one head to the other, part of the set from the start
    const up = [], dn = [], mid = [], N = 60, TW = 0.05;
    for (let i = 1; i < N; i++) {
      const u = i / N, [x, y] = crownAt(u), [xa, ya] = crownAt(u - 0.004), [xb, yb] = crownAt(u + 0.004);
      const tx = xb - xa, ty = yb - ya, tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
      up.push([x + nx * TW, y - 0.12 + ny * TW]); dn.push([x - nx * TW, y - 0.12 - ny * TW]);
      mid.push([[x + nx * 0.008, y - 0.12 + ny * 0.008], [x - nx * 0.008, y - 0.12 - ny * 0.008]]);
    }
    g.put(poly([...up, ...dn.slice().reverse()], 0), PAL.cream, { z: -L * 0.6 });
    g.put(poly([...mid.map((m) => m[0]), ...mid.map((m) => m[1]).reverse()], 0), '#c9a27a', { z: -L * 0.45, cast: false });      // the slot
    // the crown, with a dark keyline: gold alone is lost against the yellow table
    const cr = art.crown({ clip, z: L * 5.6, s: 1.18, outline: PAL.navy });
    g.add(cr); crowns.push(cr);

    if (side === 'L') {
      burst = stack({ clip, x: KX, y: KB + 1.42, z: -L * 0.3 });
      burst.put(star(16, 0.8, 0.6, 0, 0, 0, 0.01), PAL.pink, { z: 0 });
      burst.put(circ(0.5), '#fbd9dc', { z: L * 0.3 });
      g.add(burst);
      kimRoot = stack({ clip, x: KX, y: KB, z: L });
      legs(kimRoot, PAL.navy);
      kim = art.person({ clip, y: 0.3, z: L * 0.4, s: SC, style: 'kim', skin: '#b9794f', hair: PAL.black, shirt: PAL.teal, glasses: false });
      kim.userData.browL.position.y += 0.03; kim.userData.browR.position.y += 0.03;
      waveArm = arm(kim, -1, PAL.teal, '#b9794f', 0.8);
      arm(kim, 1, PAL.teal, '#b9794f', Math.PI + 0.12);
      kimRoot.add(kim);
      g.add(kimRoot);
      // her block
      g.put(rr(1.02, KB, [0.05, 0.05, 0, 0], KX, KB / 2), PAL.cream, { z: L * 2.4 });
      g.put(rr(1.14, 0.09, 0.03, KX, KB), PAL.white, { z: L * 2.8 });
      rosette = stack({ clip });                               // (the rosette became the tag under the board)
      kimRoot.add(rosette);
    } else {
      samRoot = stack({ clip, x: SX, y: SB, z: L });
      legs(samRoot, PAL.navy);
      sam = art.person({ clip, y: 0.3, z: L * 0.4, s: SC, shirt: PAL.red, hair: PAL.umber, skin: PAL.tan });
      samArms.push(arm(sam, -1, PAL.red, PAL.tan, Math.PI - 0.1), arm(sam, 1, PAL.red, PAL.tan, Math.PI + 0.1));
      frown = sam.put(art.band(0, HY - 0.215, 0.085, 40 * D2R, 140 * D2R, 0.028), PAL.ink, { z: L * 3.2 });
      gasp = sam.put(ell(0.04, 0.05, 0, HY - 0.125), PAL.ink, { z: L * 3.2 });
      samRoot.add(sam);
      g.add(samRoot);
      g.put(rr(1.02, SB, [0.05, 0.05, 0, 0], SX, SB / 2), PAL.cream, { z: L * 2.4 });
      g.put(rr(1.14, 0.09, 0.03, SX, SB), PAL.white, { z: L * 2.8 });
      // his face for the sad beat and for dreaming. Crying has to read on a phone: a stream down each cheek and drops
      // flying off to both sides, clear of his head. Then eyes shut in two happy arcs.
      for (const x of [-0.11, 0.11]) streams.push(sam.put(rr(0.055, 0.2, 0.025), '#7fb4f0', { x, y: HY - 0.2, z: L * 3.75, cast: false, core: false }));
      for (const sg2 of [-1, 1]) for (let i = 0; i < 3; i++) {
        const d = sam.put(poly([[0, 0.075], [0.046, -0.01], [0.03, -0.05], [-0.03, -0.05], [-0.046, -0.01]], 0.02), '#4f8fe0', { x: 0, y: 0, z: L * 4.2, cast: false });
        d.userData.sg = sg2; d.userData.i = i; drops.push(d);
      }
      for (const x of [-0.11, 0.11]) shut.push(sam.put(art.band(x, HY - 0.04, 0.042, 25 * D2R, 155 * D2R, 0.022), PAL.ink, { z: L * 3.3 }));
      // ---- the dream: three puffs, then a cloud that swells out of his head
      const DX = SX - 0.12, DY = 3.24, AX = 0.2, AY = -0.92;         // the cloud's middle, and where it grows from (toward his head)
      [[SX + 0.2, 2.17, 0.05], [SX + 0.3, 2.29, 0.075]].forEach(([x, y, r], i) => {
        const pf = stack({ clip, x, y, z: L * 6.2 });
        pf.put(circ(r + 0.022), '#a9bfe6', { z: 0, core: false });
        pf.put(circ(r), PAL.white, { z: L * 0.3, core: false });
        pf.userData.i = i; g.add(pf); puffs.push(pf);
      });
      const cloudShape = (ax, by, n, k) => {
        const pts = [];
        for (let i = 0; i < 240; i++) { const th = (i / 240) * Math.PI * 2, sc = 1 + k * Math.abs(Math.sin((n * th) / 2 + 0.4)); pts.push([ax * sc * Math.cos(th), by * sc * Math.sin(th)]); }
        return poly(pts, 0);
      };
      dreamRoot = stack({ clip, x: DX + AX, y: DY + AY, z: L * 6.6 });
      const dream = stack({ clip, x: -AX, y: -AY, z: 0 });
      dreamRoot.add(dream);
      dream.put(cloudShape(1.185, 0.805, 11, 0.15), '#a9bfe6', { z: 0, core: false });
      dream.put(cloudShape(1.13, 0.75, 11, 0.15), PAL.white, { z: L * 0.3 });
      // in the dream the board is the other way up
      const mb = stack({ clip, x: -0.5, y: 0.03, z: L * 0.7 });
      mb.put(rr(0.98, 0.7, 0.06), PAL.gold, { z: 0 });
      mb.put(rr(0.9, 0.62, 0.04), BOARD, { z: L * 0.3, core: false });
      [[0.145, { rank: 1, name: 'KIM', first: true, bg: ROW1 }, { rank: 1, name: 'SAM', first: true, bg: ROW1 }],
        [-0.145, { rank: 2, name: 'SAM', first: false, bg: ROW2 }, { rank: 2, name: 'KIM', first: false, bg: ROW2 }]].forEach(([y, before, after], i) => {
        const row = stack({ clip, x: 0, y, z: L * 0.6 });
        const ra = rowCard(0.84, 0.25, 'L', { clip, ...before, cast: false, ppu: 640, shape: rr(0.84, 0.25, 0.04) });
        const rb = rowCard(0.84, 0.25, 'L', { clip, ...after, cast: false, ppu: 640, shape: rr(0.84, 0.25, 0.04) });
        row.add(ra, rb); row.userData = { ...row.userData, a: ra, b: rb, i };
        mb.add(row); dreamRows.push(row);
      });
      dream.add(mb);
      // and Sam stands on top of his tower, between two stacks of coins taller than Kim's
      const TB = -0.5, TH = 0.56, DS = 0.31;                         // the tower's foot and height, and how big he is up there
      dreamTower = stack({ clip, x: 0.5, y: TB, z: L * 0.7 });
      dreamTower.put(rr(0.44, TH, [0.03, 0.03, 0, 0], 0, TH / 2), '#6a4f9c', { z: 0 });
      for (const x of [-0.19, 0.19]) dreamTower.put(rr(0.045, TH, 0, x, TH / 2), '#8468b8', { z: L * 0.2, core: false, cut: false });
      for (let c = 0; c < 3; c++) for (let row = 0; row < 3; row++) dreamTower.put(rr(0.075, 0.095, 0.012, (c - 1) * 0.115, 0.1 + row * 0.145), (c * 2 + row) % 3 ? PAL.yellow : '#463272', { z: L * 0.3, core: false, cut: false });
      dreamTower.put(rr(0.56, 0.075, 0.025, 0, TH), PAL.orange, { z: L * 0.5 });
      dreamSam = art.person({ clip, x: 0, y: TH, z: L * 0.2, s: DS, shirt: PAL.red, hair: PAL.umber, skin: PAL.tan });
      dreamArms.push(arm(dreamSam, -1, PAL.red, PAL.tan, Math.PI - 0.1), arm(dreamSam, 1, PAL.red, PAL.tan, Math.PI + 0.1));
      dreamTower.add(dreamSam);
      dream.add(dreamTower);
      [[0.13, TB, 7], [0.83, TB + 0.07, 5]].forEach(([x, y0, n]) => {
        for (let i = 0; i < n; i++) {
          const c = stack({ clip, x: x + ((i * 5) % 3 - 1) * 0.008, y: y0 + 0.022 + i * 0.044, z: L * 1.2 });
          c.put(rr(0.2, 0.044, 0.018), i % 2 ? PAL.gold : '#e9a52a', { z: 0, core: false });
          c.put(rr(0.15, 0.009, 0), PAL.orange, { z: L * 0.3, core: false, cut: false, cast: false });
          dream.add(c);
        }
      });
      dreamCrown = art.crown({ clip, x: 0.5, y: 0, z: L * 2.4, s: 0.56, outline: PAL.navy });
      dreamCrown.userData.y = TB + TH + (HY + 0.3) * DS;             // on his head
      dream.add(dreamCrown);
      [[-0.92, 0.47, 0.085], [0.04, 0.58, 0.07], [1.0, 0.24, 0.08], [0.2, -0.02, 0.055], [-0.75, -0.52, 0.06]].forEach(([x, y, r], i) => {
        const sp = dream.put(star(4, r, r * 0.3, 0, 0, 0, 0.004), i % 2 ? PAL.gold : PAL.yellow, { x, y, z: L * 2.0, cast: false });
        sp.userData.i = i; sparks.push(sp);
      });
      g.add(dreamRoot);
      // the burst it leaves when it pops
      dreamPop = stack({ clip, x: DX, y: DY, z: L * 6.8 });
      dreamPop.put(star(14, 1.12, 0.66, 0, 0, 0.1, 0.01), PAL.white, { z: 0, cast: false });
      g.add(dreamPop);
    }
    // number plates on the blocks, and the coin stacks at the outside edges
    const sg = side === 'R' ? 1 : -1, bx = side === 'R' ? SX : KX, bh = side === 'R' ? SB : KB;
    const num = cutText(fonts.bookman, side === 'R' ? '2' : '1', 1, side === 'R' ? '#5d74ad' : '#e9a52a', { clip, seed: 2 });
    const bb = num.userData.letters[0].geometry.boundingBox, cap = bb.max.y - bb.min.y, k = (side === 'R' ? 0.24 : 0.4) / cap;
    const plate = stack({ clip, x: bx, y: bh / 2, z: L * 3.0 });
    num.scale.setScalar(k); num.position.set(0, -(cap * k) / 2, 0);
    plate.add(num);
    g.add(plate); plates.push(plate);
    for (let i = 0; i < COINS; i++) {
      const c = stack({ clip, x: sg * CX + ((i * 5) % 3 - 1) * 0.012, y: CH / 2 + i * CH, z: L * 1.5 });
      c.put(rr(0.4, CH, 0.03), i % 2 ? PAL.gold : '#e9a52a', { z: 0 });
      c.put(rr(0.3, 0.014, 0), PAL.orange, { z: L * 0.3 });
      c.userData.y = c.position.y; c.userData.i = i;
      g.add(c); (side === 'R' ? stacksS : stacksK).push(c);
    }
    if (side === 'L') {
      // the one coin more: face on, so it can be seen landing
      lastCoin = art.coin({ clip, x: -CX, y: COINS * CH + 0.2, z: L * 1.9, r: 0.2 });
      lastCoin.userData.y = lastCoin.position.y;
      g.add(lastCoin);
    }
  });

  // ---------------------------------------------------------------- flat on the page: lawn stripes and confetti
  const lawn = (s) => poly([[0.035 * s, -1.05], [2.7 * s, -1.05], [3.0 * s, -0.8], [3.0 * s, -0.3], [2.7 * s, -0.05], [0.035 * s, -0.05]], [0, 0.2, 0.2, 0.2, 0.2, 0]);
  env.pages.right.add(piece(lawn(1), '#cfe6c2', { z: 0.004, cast: false }));
  env.pages.left.add(piece(lawn(-1), '#cfe6c2', { z: 0.004, cast: false }));
  const q0 = rng(31);
  for (let i = 0; i < 16; i++) {
    const x = -2.9 + q0() * 2.2, y = -1.1 + q0() * 1.0, c = [PAL.red, PAL.gold, PAL.teal, PAL.plum, PAL.pink][i % 5];
    env.pages.left.add(piece(i % 3 ? rr(0.09, 0.045, 0.01) : circ(0.035), c, { x, y, z: 0.006, rot: q0() * 3, cast: false }));
  }

  // ---------------------------------------------------------------- sound
  const sfx = [
    { t: tKim, s: 'paper_pop', g: 0.9 },
    { t: tSwap, s: 'flap_flip', g: 0.8 }, { t: tSwap + 0.14, s: 'flap_flip', g: 0.8 },
    { t: tSwap + 0.1, s: 'coin_clink', g: 0.5 }, { t: tSwap + 0.35, s: 'coin_clink', g: 0.5 },
    { t: tCrown, s: 'slide_whistle_up', g: 0.7 },
    { t: tMore + 0.1, s: 'coin_clink', g: 0.85, a: 'peak' },
    { t: tLand, s: 'crown_ding', g: 0.9, a: 'peak' },
    { t: tLand + 0.1, s: 'paper_pop', g: 0.8 },
    { t: tDream - 0.05, s: 'dream_harp', g: 0.85 },
    { t: tDream, s: 'bubble_pop', g: 0.45 }, { t: tDream + 0.09, s: 'bubble_pop', g: 0.55 },
    { t: tCloud, s: 'paper_pop', g: 0.85 },
    { t: tFlip, s: 'flap_flip', g: 0.75 }, { t: tFlip + 0.1, s: 'flap_flip', g: 0.75 },
    { t: tDCrown + 0.2, s: 'crown_ding', g: 0.8, a: 'peak' },
    { t: tDCrown + 0.3, s: 'sparkle', g: 0.6 },
    { t: tPop, s: 'bubble_pop', g: 1.0, a: 'peak' },
  ];

  const CRY = { pos: [2.55, 4.9, 7.7], target: [1.2, 1.55] };            // in on Sam for "Sam is fine."
  const CAM = { pos: [2.1, 5.5, 10.3], target: [0.55, 2.12] };          // where the camera ends up for the dream
  return {
    sfx,
    // seen from the right, a little closer than the other spreads: the board and Kim take the middle, Sam the near corner
    key(lt) {
      // two moves: in toward Sam while he cries, then up with the dream, so the cloud, Sam and the real board share the frame
      const c = smooth(seg(lt, tSad - 0.05, tSad + 0.75)), u = smooth(seg(lt, tDream - 0.1, tDream + 0.95));
      const mix3 = (a, b, d) => lerp(lerp(a, b, c), d, u);
      return {
        pos: [mix3(1.75, CRY.pos[0], CAM.pos[0]), mix3(5.9, CRY.pos[1], CAM.pos[1]), mix3(10.0, CRY.pos[2], CAM.pos[2])],
        target: [mix3(-0.12, CRY.target[0], CAM.target[0]), mix3(1.3, CRY.target[1], CAM.target[1]), -0.1],
        focus: [mix3(0, 1.9, 1.4), mix3(1.5, 1.7, 2.4), mix3(0.2, 0.4, 0.4)], aperture: 0.09,
      };
    },
    animate(lt, open) {
      const q = twos(lt);
      // Kim springs up from behind her block, and waves
      const up = spring(q - tKim, 2.7, 0.45);
      kimRoot.position.y = KB - 2.5 * (1 - clamp(up, 0, 1.12));
      kimRoot.visible = q > tKim - 0.02;
      burst.scale.setScalar(Math.max(0.001, clamp(spring(q - tKim - 0.1, 3.0, 0.42), 0, 1.2)));
      burst.rotation.z = Math.floor(q * 7.5) * 0.06;
      burst.visible = q > tKim + 0.08;
      const waving = q > tKim + 0.2 && q < tDream + 0.1;
      waveArm.rotation.z = waving ? 0.72 + 0.26 * Math.sin(q * 11) : 0.72;
      // the board flips: Kim takes the first row, Sam drops to the second
      for (const r of rows) {
        const p = seg(q, tSwap + r.userData.i * 0.14, tSwap + r.userData.i * 0.14 + 0.27);
        r.scale.y = Math.max(0.04, Math.abs(Math.cos(Math.PI * p)));
        r.userData.a.visible = p < 0.5; r.userData.b.visible = p >= 0.5;
      }
      // number plates appear; Kim's coins stack up level with Sam's, and then one more lands
      for (const p of plates) { const s = clamp(spring(q - tSwap - 0.1, 3.0, 0.45), 0, 1.25); p.scale.setScalar(Math.max(0.001, s)); p.visible = q > tSwap + 0.08; }
      for (const c of stacksS) { c.visible = true; }
      for (const c of stacksK) {
        const t0 = tSwap + 0.05 + c.userData.i * 0.04, d = seg(q, t0, t0 + 0.14);
        c.visible = q >= t0;
        c.position.y = c.userData.y + 0.3 * (1 - ease.outCubic(d));
      }
      const fall = q - tMore, lc = fall - 0.1;
      lastCoin.visible = fall >= -0.14;
      const drop = clamp(1 + lc / 0.24);                       // 0 when it appears, 1 when it lands: it falls faster and faster
      lastCoin.position.y = lastCoin.userData.y + (lc < 0 ? 1.5 * (1 - drop * drop) : Math.exp(-lc * 8) * Math.abs(Math.sin(lc * 17)) * 0.1);
      lastCoin.rotation.z = lc < 0 ? lc * 5 : 0.12;
      // the crown rides the track from Sam to Kim: up, a two-frame hang at the top, down, then a small bounce
      const u = flight(q - tCrown);
      const [cx, cy] = crownAt(u);
      const land = q - tLand, bounce = land > 0 ? Math.exp(-land * 7) * Math.abs(Math.sin(land * 16)) * 0.1 : 0;
      for (const c of crowns) {
        c.position.x = cx; c.position.y = cy + bounce;
        c.rotation.z = Math.sin(Math.PI * u) * 0.35 + (u >= 1 ? -0.1 : u <= 0 ? 0.06 : 0);
        c.scale.setScalar(1.18 * (1 + 0.28 * Math.sin(Math.PI * u)));                // bigger in the air, so the flight reads
      }
      // LEADERBOARD: the tag drops down from the board as the crown lands
      for (const t of tags) { const k = clamp(spring(q - tLand - 0.06, 3.0, 0.42), 0, 1.25); t.visible = q > tLand + 0.04; t.scale.set(1, Math.max(0.001, k), 1); }
      // (the old rosette is an empty group now)
      const rs = clamp(spring(q - tLand - 0.06, 3.0, 0.4), 0, 1.25);
      rosette.visible = q > tLand + 0.04;
      rosette.scale.setScalar(Math.max(0.001, 0.84 * rs));
      rosette.rotation.z = -0.07 + (1 - Math.min(1, rs)) * 0.7;
      // Sam takes it badly: a gasp, tears, and then he shuts his eyes and dreams
      const b = sam.userData;
      const dreaming = q >= tDream && q < tPop, awake = q >= tPop;
      const shock = (q > tCrown + 0.08 && q < tSad) || awake;
      const sad = q >= tSad && q < tDream;
      b.browL.rotation.z = sad ? 0.45 : 0; b.browR.rotation.z = sad ? -0.45 : 0;
      b.browL.position.y = b.browR.position.y = HY + 0.105 + (shock ? 0.035 : dreaming ? 0.02 : 0);
      b.mouth.visible = !shock && !sad; gasp.visible = shock; frown.visible = sad;
      for (const e of b.eyes) e.visible = !dreaming;
      for (const e of shut) e.visible = dreaming;
      // he cries until he shuts his eyes: the streams flicker, the drops arc away from his head, and he shakes with it
      const crying = q >= tSad + 0.06 && q < tDream + 0.05;
      streams.forEach((st, i) => { st.visible = crying; st.scale.x = (Math.floor(q * 7.5) + i) % 2 ? 1 : 0.72; });
      for (const d of drops) {
        const ph = (((q - tSad - 0.06) / 0.48 + d.userData.i / 3) % 1 + 1) % 1;
        d.visible = crying && q - tSad - 0.06 > d.userData.i * 0.16;
        d.position.set(d.userData.sg * (0.22 + 0.5 * ph), HY - 0.02 + 0.3 * Math.sin(Math.PI * ph) - 0.22 * ph, d.position.z);
        d.rotation.z = -d.userData.sg * (0.5 + 1.6 * ph);
        d.scale.setScalar(1.15 + 0.75 * Math.sin(Math.PI * Math.min(1, ph * 1.4)));
      }
      sam.position.y = 0.3 + (crying ? 0.016 * (Math.floor(q * 7.5) % 2) : 0);
      sam.rotation.z = dreaming ? 0.035 * Math.sin(q * 3.2) : 0;
      samArms.forEach((a, i) => { a.rotation.z = Math.PI + (i ? 1 : -1) * (sad ? 0.03 : 0.1); });
      // the dream: two puffs, the cloud swells, the board in it flips his way, the crown lands on him, stars twinkle
      for (const pf of puffs) { const t0 = tDream + pf.userData.i * 0.09; pf.visible = q >= t0 && q < tPop; pf.scale.setScalar(Math.max(0.001, clamp(spring(q - t0, 3.2, 0.4), 0, 1.25))); }
      const sw = clamp(spring(q - tCloud, 2.6, 0.5), 0, 1.1);
      dreamRoot.visible = q >= tCloud && q < tPop;
      dreamRoot.scale.setScalar(Math.max(0.001, sw));
      dreamRoot.rotation.z = (1 - Math.min(1, sw)) * -0.25;
      for (const r of dreamRows) {
        const p = seg(q, tFlip + r.userData.i * 0.1, tFlip + r.userData.i * 0.1 + 0.27);
        r.scale.y = Math.max(0.04, Math.abs(Math.cos(Math.PI * p)));
        r.userData.a.visible = p < 0.5; r.userData.b.visible = p >= 0.5;
      }
      dreamTower.scale.y = lerp(0.2, 1, clamp(spring(q - tCloud - 0.12, 2.6, 0.5), 0, 1.12));
      const dc = q - tDCrown, dl = dc - 0.2;                         // it drops for 0.2 s, then bounces
      dreamCrown.visible = dc >= 0;
      const dd = clamp(dc / 0.2);
      // it grows as it comes down, from just above his head: a longer drop would start outside the cloud
      dreamCrown.position.y = dreamCrown.userData.y + (dl < 0 ? 0.15 * (1 - dd * dd) : Math.exp(-dl * 7) * Math.abs(Math.sin(dl * 16)) * 0.07);
      dreamCrown.scale.setScalar(0.56 * (dl < 0 ? 0.35 + 0.65 * dd : 1));
      dreamCrown.rotation.z = dl < 0 ? 0.3 * (1 - dd) : -0.08;
      const won = clamp(dl / 0.13);
      dreamArms.forEach((a, i) => { a.rotation.z = i ? lerp(Math.PI + 0.1, 2 * Math.PI - 0.5, won) : lerp(Math.PI - 0.1, 0.5, won); });
      for (const sp of sparks) {
        const on = dl > sp.userData.i * 0.05, ph = Math.floor(q * 7.5 + sp.userData.i * 1.7) % 3;
        sp.visible = on; sp.scale.setScalar(ph === 0 ? 1.15 : ph === 1 ? 0.75 : 0.45); sp.rotation.z = ph * 0.3;
      }
      // and it bursts as the page turns
      const pop = q - tPop;
      dreamPop.visible = pop >= 0 && pop < 0.1;
      dreamPop.scale.setScalar(1 + pop * 3);
    },
  };
}
