// Spread 2: "Sam made up an app. It is an AI that flips a coin. It thinks for forty seconds. Then it says: It depends.
// His app sucks." Sam on the left, the app (a coin-flipping robot in an app window) on the right, a stopwatch
// between them, and the answer in a speech bubble that flips up over the fold.

import { PAL, LAYER as L, rr, circ, ell, poly, star, heart, piece, stack, printed } from '../paper.js';
import { cutText } from '../type.js';
import * as art from '../art.js';
import { spring, tw, ease, seg, lerp, clamp, rng } from '../util.js';

const D = Math.PI / 180;
const WALL = '#b9a3dc', WALL_DARK = '#a48dcc', RUG = '#d5c6ee', KEYLINE = '#4b3b78';

/** A strip of constant width along a polyline: paper wire, springs, the slot the thoughts ride in. */
function ribbon(pts, w) {
  const up = [], down = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
    up.push([pts[i][0] - (dy / n) * w / 2, pts[i][1] + (dx / n) * w / 2]);
    down.push([pts[i][0] + (dy / n) * w / 2, pts[i][1] - (dx / n) * w / 2]);
  }
  return poly([...up, ...down.reverse()], 0);
}

/** A flap hinged along its bottom edge, seen head-on: it grows upward from the hinge. */
function flap(obj, s) {
  obj.visible = s > 0.02;
  obj.scale.set(0.9 + 0.1 * Math.min(1, s), Math.max(0.001, s), 1);
}

const STALK = '#d8ccb6';

/** Scale a group in and out; hidden when it is (almost) nothing, so it never z-fights or casts a speck of shadow. */
function pop(obj, s, base = 1) {
  obj.visible = s > 0.02;
  obj.scale.setScalar(Math.max(0.001, s) * base);
}

/** Front layers fold first: a fold's art sinks into the page over the first few degrees of a page turn (and stands up
 *  as the page lands), before it can lean back through the wall behind it. open: 0 shut .. 1 flat. */
const sink = (open) => { const u = Math.min(1, Math.max(0, (open - 0.9) / 0.095)); return Math.max(0.002, u * u * (3 - 2 * u)); };

export function build(env) {
  const { fonts, mark, shot } = env;
  const at = (line, word) => mark(line, word) - shot.t0;
  // every beat hangs on a spoken word
  const tMade = at('idea', 'made'), tAI = at('idea', 'AI'), tFlip = at('idea', 'flips');
  const tThink = at('thinks', 'thinks'), tSec = at('thinks', 'seconds'), tDep = at('thinks', 'It depends'), tSays = tDep - 0.2;      // the pause before the robot answers
  const tBad = at('bad', 'His'), tBadWord = at('bad', 'sucks');
  // the coin: up for UP seconds, hangs for HANG, comes down for DOWN, and is caught on the coin_catch cue
  const UP = 0.4, HANG = 2 / 15, DOWN = 0.4, FLIGHT = UP + HANG + DOWN;
  const WIND = 4 / 15;                                   // the wind-up before the throw
  // arm angles: holding the coin up, wound down for the throw, and reaching up for the catch
  const A_REST = 2.3, A_LOW = 1.45, A_HIGH = 2.75;
  // where the coin leaves the hand, turns at the top and lands, in the robot's own coordinates
  const SH = [0.44, 0.82], REACH = 0.55;
  const handAt = (th) => [SH[0] + REACH * Math.sin(th), SH[1] - REACH * Math.cos(th)];
  // the top of the flight is out to the right, clear of the window's title
  const P_OFF = handAt(A_LOW), P_TOP = [0.95, 1.98], P_LAND = handAt(A_HIGH);
  // one drawing per pose of the flight (15 a second): how open the coin is, and which face shows. Six times edge-on.
  const SPIN = [[0.5, 1], [0.13, 1], [1, 0], [0.13, 0], [1, 1], [0.13, 1], [1, 0], [1, 0], [0.13, 0], [1, 1], [0.13, 1], [1, 0], [0.13, 0], [0.62, 1]];
  // the thoughts ride in a slot cut in the wall, from Sam's head to the app
  const slotY = (x) => 1.81 - 0.236 * (x + 0.62) * (x + 0.62);
  const tSweep0 = tThink + 0.05, tSweep1 = Math.max(tSweep0 + 0.8, Math.min(tSec + 0.45, tSays - 0.05));

  // ---------------------------------------------------------------- back fold: the wall and the app window
  const wall = env.fold({ z: -1.0, beta: 66 });
  const thoughts = [];
  env.span(wall, (g, side, clip) => {
    g.put(rr(6.1, 2.3, [0.3, 0.3, 0, 0], 0, 1.15), WALL, { z: 0 });
    g.put(rr(6.1, 0.13, 0, 0, 0.065), WALL_DARK, { z: L * 0.6 });
    if (side === 'R') {
      // the app, as a window: title bar, three dots, its name, and a sun for the robot to stand in front of
      const w = stack({ clip, x: 1.42, y: 1.5, z: L });
      w.put(rr(2.36, 2.42, 0.13), KEYLINE, { z: 0 });
      w.put(rr(2.28, 2.34, 0.1), PAL.cream, { z: L * 0.4 });
      w.put(rr(2.28, 0.4, [0.1, 0.1, 0, 0], 0, 0.97), PAL.plum, { z: L * 0.8 });
      [PAL.red, PAL.gold, PAL.green].forEach((c, i) => w.put(circ(0.05, -1.0 + i * 0.14, 0.97), c, { z: L * 1.2 }));
      w.add(printed(1.2, 0.32, (c, cw, ch) => {
        c.fillStyle = PAL.plum; c.fillRect(0, 0, cw, ch);
        c.fillStyle = PAL.cream; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        let size = ch * 0.78; c.font = `600 ${size}px "Bookman"`;
        const m = c.measureText('Coin Flip AI').width; if (m > cw * 0.96) { size *= (cw * 0.96) / m; c.font = `600 ${size}px "Bookman"`; }
        c.fillText('Coin Flip AI', cw / 2, ch / 2 + size * 0.34);
      }, { clip, x: 0.0, y: 0.97, z: L * 1.1, cast: false, bump: 0.6 }));          // kept left: the coin flies up the right side
      w.put(star(16, 0.86, 0.7, 0, -0.45, 0, 0.01), '#fbe58f', { z: L * 0.8 });
      w.put(circ(0.66, 0, -0.45), PAL.yellow, { z: L * 1.1 });
      g.add(w);
    } else {
      // the thought that travels from Sam's head to the app: discs on tabs that flip up out of the slot
      for (const [x, q] of [[-1.72, 0.06], [-1.44, 0.085], [-1.1, 0.115], [-0.68, 0.15], [-0.2, 0.19]]) {
        const t = stack({ clip, x, y: slotY(x) - 0.01, z: L * 1.2 });
        t.put(rr(0.05, 0.08, 0, 0, 0.03), KEYLINE, { z: 0 });
        t.put(circ(q + 0.022, 0, q + 0.05), KEYLINE, { z: 0.001 });
        t.put(circ(q, 0, q + 0.05), PAL.white, { z: L * 0.4 });
        g.add(t); thoughts.push(t);
      }
    }
    // the slot itself, on both wings: it ends at the edge of the app window
    { const pts = []; for (let i = 0; i <= 30; i++) { const x = -2.02 + (2.26 * i) / 30; pts.push([x, slotY(x)]); }
      g.put(ribbon(pts, 0.05), WALL_DARK, { z: L * 0.5, cast: false }); }
  });

  // ---------------------------------------------------------------- middle fold: Sam, the stopwatch, the robot, the bubble
  const mid = env.fold({ z: -0.2, beta: 82 });
  const bubbles = [];
  let sam = null, samArms = [], samHearts = [], samGrin = [], bulb = null, bot = null, dial = null, hand = null, ding = null, stalk = null;
  const wedges = [], steam = [], stars = [];
  let botFlat = null, antenna = null, post = null, tails = null;
  const BX = -0.72, BY = 1.93;                              // bubble: bottom centre, in wing coordinates
  const midG = env.span(mid, (g, side, clip) => {
    // the speech bubble: built on both wings, so the fold runs through it
    const b = stack({ clip, x: BX, y: BY, z: L * 3 });
    const tail = [[0.72, 0.14], [1.34, -0.07], [1.0, 0.42]];
    b.put(rr(2.74, 1.14, 0.36, 0, 0.55), KEYLINE, { z: 0 });
    b.put(poly([[0.66, 0.1], [1.45, -0.13], [1.0, 0.5]], 0.02), KEYLINE, { z: 0 });
    b.put(rr(2.62, 1.02, 0.3, 0, 0.55), PAL.white, { z: L * 0.5 });
    b.put(poly(tail, 0.02), PAL.white, { z: L * 0.5 });
    const t = cutText(fonts.bookman, 'It depends.', 1, PAL.ink, { clip, wobble: 0.025, seed: 12 });
    const k = 2.16 / t.userData.width;
    t.scale.setScalar(k); t.position.set(0, 0.55 - 0.3 * k, L * 1.1);
    b.add(t);
    g.add(b); bubbles.push(b);

    if (side === 'L') {
      // Sam: legs, the waist-up figure, two arms that can point and cheer
      const s = stack({ clip, x: -2.15, y: 0, z: L });
      for (const x of [-0.13, 0.13]) { s.put(rr(0.17, 0.46, 0.04, x, 0.25), PAL.navy, { z: 0 }); s.put(rr(0.24, 0.1, [0.05, 0.05, 0, 0], x + 0.02, 0.05), PAL.charcoal, { z: L * 0.4 }); }
      const p = art.person({ clip, y: 0.42, z: L * 0.6, s: 0.84, shirt: PAL.red, hair: PAL.umber, skin: PAL.tan });
      const hy = 1.08;
      for (const sg of [-1, 1]) {
        const a = stack({ clip, x: sg * 0.38, y: 0.6, z: -L * 0.4 });
        a.put(rr(0.17, 0.52, 0.085, 0, 0.24), PAL.red, { z: 0 });
        a.put(circ(0.09, 0, 0.52), PAL.tan, { z: L * 0.3 });
        a.userData.sg = sg;
        p.add(a); samArms.push(a);
        samHearts.push(p.put(heart(0.17), PAL.rose, { x: sg * 0.11, y: hy - 0.005, z: L * 3.9 }));
      }
      // the grin he gets at the end
      const m = []; for (let i = 0; i <= 14; i++) { const a = Math.PI + (Math.PI * i) / 14; m.push([Math.cos(a) * 0.105, hy - 0.115 + Math.sin(a) * 0.085]); }
      samGrin.push(p.put(poly(m, 0), PAL.ink, { z: L * 3.2 }), p.put(rr(0.15, 0.03, 0.008, 0, hy - 0.128), PAL.white, { z: L * 3.5 }));
      s.add(p); g.add(s); sam = p;
      // the idea: a bulb on a paper spring that jumps out from behind his head
      bulb = stack({ clip, x: -2.15, y: 1.5, z: L * 0.6 });
      bulb.put(ribbon([[0, 0], [0.08, 0.07], [-0.08, 0.14], [0.08, 0.21], [-0.08, 0.28], [0.08, 0.35], [-0.08, 0.42], [0, 0.48]], 0.032), STALK, { z: 0 });
      { const b = stack({ clip, x: 0, y: 0.64, z: L });
        for (let i = 0; i < 7; i++) { const a = (-30 + i * 40) * D; b.put(rr(0.035, 0.13, 0.015), PAL.orange, { x: Math.cos(a) * 0.3, y: 0.04 + Math.sin(a) * 0.3, rot: a - Math.PI / 2, z: 0 }); }
        b.put(rr(0.13, 0.13, 0.02, 0, -0.17), PAL.grey, { z: L * 0.3 });
        b.put(circ(0.17, 0, 0.04), PAL.yellow, { z: L * 0.6 });
        b.put(circ(0.06, -0.05, 0.09), '#fff3b8', { z: L });
        bulb.add(b); }
      g.add(bulb);
      // stars for the ending, each on a paper stalk that shoots out from behind him
      for (const [dx, dy, q, c] of [[-0.57, 0.77, 0.15, PAL.gold], [0.53, 0.63, 0.12, PAL.pink], [-0.5, 0.2, 0.1, PAL.mint]]) {
        const len = Math.hypot(dx, dy);
        const st = stack({ clip, x: -2.15, y: 0.95, z: L * 0.4, rot: Math.atan2(-dx, dy) });
        st.put(rr(0.032, len, 0, 0, len / 2), STALK, { z: 0 });
        const tip = stack({ clip, x: 0, y: len, z: L * 0.5 });
        tip.put(star(5, q, q * 0.45, 0, 0, 0, 0.006), c, { z: 0 });
        st.add(tip); st.userData.tip = tip;
        g.add(st); stars.push(st);
      }
      // the stopwatch on its stalk
      stalk = stack({ clip, x: -0.78, y: 0, z: 0 });
      stalk.put(rr(0.075, 1.0, 0, 0, 0.5), '#d8ccb6', { z: 0 });
      g.add(stalk);
      dial = stack({ clip, x: -0.78, y: 1.0, z: L * 1.2 });
      dial.put(rr(0.16, 0.16, 0.03, 0, 0.55), PAL.charcoal, { z: 0 });
      dial.put(rr(0.26, 0.07, 0.03, 0, 0.64), PAL.charcoal, { z: 0 });
      dial.put(circ(0.5), PAL.charcoal, { z: L * 0.2 });
      dial.put(circ(0.42), PAL.white, { z: L * 0.6 });
      for (let i = 0; i < 8; i++) {
        const a0 = 90 - i * 30, pts = [[0, 0]];
        for (let j = 0; j <= 6; j++) { const a = (a0 - j * 5) * D; pts.push([Math.cos(a) * 0.36, Math.sin(a) * 0.36]); }
        wedges.push(dial.put(poly(pts, 0), i === 7 ? PAL.red : '#ee7a5f', { z: L * (0.9 + i * 0.01) }));
      }
      for (let i = 0; i < 12; i++) { const a = i * 30 * D; dial.put(rr(0.022, i % 3 ? 0.05 : 0.085, 0.008), PAL.charcoal, { x: Math.cos(a) * 0.375, y: Math.sin(a) * 0.375, rot: a - Math.PI / 2, z: L * 1.2 }); }
      hand = stack({ clip, z: L * 1.5 });
      hand.put(rr(0.05, 0.36, 0.02, 0, 0.14), PAL.ink, { z: 0 });
      dial.add(hand);
      dial.put(circ(0.055), PAL.ink, { z: L * 1.8 });
      ding = stack({ clip, x: 0.4, y: 0.46, z: L * 2.2 });
      ding.put(star(8, 0.2, 0.08, 0, 0, 0.2, 0.004), PAL.gold, { z: 0 });
      ding.put(circ(0.05), PAL.white, { z: L * 0.4 });
      dial.add(ding);
      g.add(dial);
    } else {
      // the post that holds the speech bubble up
      post = stack({ clip, x: 0.15, y: 0, z: L * 0.5 });
      post.put(rr(0.075, 1.96, 0, 0, 0.98), STALK, { z: 0 });
      post.put(rr(0.2, 0.06, 0.02, 0, 0.03), STALK, { z: L * 0.2 });
      g.add(post);
      // the robot on its little stage
      g.put(rr(1.56, 0.19, [0.07, 0.07, 0, 0], 1.42, 0.095), PAL.plum, { z: 0 });
      g.put(rr(1.56, 0.05, 0, 1.42, 0.165), '#8468b8', { z: L * 0.4 });
      bot = art.coinBot({ clip, x: 1.42, y: 0.19, z: L, s: 1.2 });
      botFlat = bot.userData.head.put(rr(0.17, 0.034, 0.014, 0, -0.07), PAL.white, { z: L });
      // the coin's other face, so a flip can be seen turning over
      tails = stack({ clip, z: L * 0.95 });
      tails.put(circ(0.12), '#e9a52a', { z: 0 });               // a plain back: the star face comes and goes as it turns
      bot.userData.coin.add(tails);
      // a shorter antenna than the stock one, so it stays under the window's title
      bot.userData.antenna.visible = false;
      antenna = stack({ clip, x: 0, y: 0.31, z: -L * 0.2 });
      antenna.put(rr(0.035, 0.12, 0, 0, 0.05), PAL.grey, { z: 0 });
      antenna.put(circ(0.07, 0, 0.13), PAL.gold, { z: L * 0.3 });
      bot.userData.head.add(antenna);
      // steam from one ear: two puffs that take turns, so it chugs upward
      for (const [x, y, k] of [[-0.6, 1.36, 0.8], [-0.7, 1.58, 1.1]]) {
        const st = stack({ clip, x, y, z: L * 0.3, s: k });
        st.put(circ(0.085, 0, 0), PAL.white, { z: 0 }); st.put(circ(0.07, -0.1, 0.09), PAL.white, { z: 0.001 }); st.put(circ(0.05, -0.19, 0.2), PAL.white, { z: 0.002 });
        bot.add(st); steam.push(st);
      }
      g.add(bot);
    }
  });

  // ---------------------------------------------------------------- front fold: the question, and Sam's laptop
  const front = env.fold({ z: 0.56, beta: 86 });
  let sign = null;
  const frontG = env.span(front, (g, side, clip) => {
    if (side === 'R') {
      sign = stack({ clip, x: 1.42, y: 0, z: 0 });
      for (const x of [-0.6, 0.6]) sign.put(rr(0.055, 0.3, 0, x, 0.15), '#d8ccb6', { z: 0 });
      sign.put(rr(1.86, 0.5, 0.06, 0, 0.42), KEYLINE, { z: L * 0.4 });
      sign.add(printed(1.76, 0.4, (c, cw, ch) => {
        c.fillStyle = PAL.cream; c.fillRect(0, 0, cw, ch);
        c.fillStyle = PAL.ink; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        let size = ch * 0.62; c.font = `600 ${size}px "Bookman"`;
        const m = c.measureText('Heads or tails?').width; if (m > cw * 0.92) { size *= (cw * 0.92) / m; c.font = `600 ${size}px "Bookman"`; }
        c.fillText('Heads or tails?', cw / 2, ch / 2 + size * 0.34);
      }, { clip, x: 0, y: 0.42, z: L * 0.8, shape: rr(1.76, 0.4, 0.04) }));
      g.add(sign);
    } else {
      const t = stack({ clip, x: -2.2, y: 0, z: 0 });
      t.put(rr(0.09, 0.5, 0, 0, 0.25), PAL.brown, { z: 0 });
      t.put(rr(0.5, 0.07, 0.02, 0, 0.035), PAL.brown, { z: L * 0.3 });
      t.put(rr(1.0, 0.09, 0.035, 0, 0.5), PAL.brown, { z: L * 0.5 });
      t.add(art.laptop({ clip, x: -0.02, y: 0.545, z: L, s: 0.62 }));
      t.add(art.mug({ clip, x: 0.4, y: 0.545, z: L * 1.2, s: 0.7 }));
      g.add(t);
    }
  });

  // ---------------------------------------------------------------- flat on the pages
  env.pages.right.add(piece(ell(1.35, 0.58, 1.42, -0.02), RUG, { z: 0.004, cast: false }));
  env.pages.left.add(piece(ell(0.95, 0.46, -2.12, -0.02), RUG, { z: 0.004, cast: false }));
  { const q = rng(23);
    for (let i = 0; i < 16; i++) {
      const left = i % 2 === 0, x = (left ? -1 : 1) * (0.35 + q() * 2.6), y = -1.12 + q() * 0.36;
      (left ? env.pages.left : env.pages.right).add(piece(circ(0.035 + q() * 0.03, x, y), [PAL.gold, PAL.pink, PAL.teal, PAL.plum][i % 4], { z: 0.004, cast: false }));
    } }

  const K_WIDE = { pos: [0.1, 6.0, 9.25], target: [0.1, 0.98, -0.15], focus: [0.5, 1.2, -0.2], aperture: 0.1 };
  // close on the robot for the flip: the robot and the coin's whole arc fill about 60 percent of the frame height
  const K_FLIP = { pos: [0.55, 5.39, 7.91], target: [0.55, 1.42, -0.05], focus: [1.6, 1.5, 0.0], aperture: 0.08 };      // Sam stays in, pointing at it
  const K_LEAN = { pos: [0.27, 5.72, 8.95], target: [0.25, 1.06, -0.2], focus: [0.6, 1.2, -0.2], aperture: 0.12 };       // a lean, with the whole book still in frame
  const K_ANSWER = { pos: [0.0, 6.0, 9.8], target: [0.0, 1.36, -0.2], focus: [0.2, 1.8, -0.2], aperture: 0.09 };
  const K_GLAD = { pos: [-0.2, 5.9, 9.55], target: [-0.2, 1.3, -0.2], focus: [-1.3, 1.4, -0.1], aperture: 0.1 };
  const mixKey = (a, b, u) => ({
    pos: a.pos.map((v, i) => lerp(v, b.pos[i], u)), target: a.target.map((v, i) => lerp(v, b.target[i], u)),
    focus: a.focus.map((v, i) => lerp(v, b.focus[i], u)), aperture: lerp(a.aperture, b.aperture, u),
  });

  return {
    // in close for the coin flip, a lean while it thinks, a jump back for the answer, then a drift over to Sam, who loves it
    key(lt) {
      const flipIn = ease.inOutCubic(seg(lt, tFlip - 0.95, tFlip - 0.25));
      const flipOut = ease.inOutCubic(seg(lt, tFlip + FLIGHT + 0.12, Math.max(tFlip + FLIGHT + 0.6, tThink + 0.05)));
      const lean = ease.inOutCubic(seg(lt, tThink - 0.3, tDep - 0.35));
      const back = ease.outCubic(seg(lt, tDep - 0.1, tDep + 0.4));
      const glad = ease.inOutCubic(seg(lt, tBad - 0.15, tBad + 0.75));
      return mixKey(mixKey(mixKey(mixKey(K_WIDE, K_FLIP, flipIn * (1 - flipOut)), K_LEAN, lean), K_ANSWER, back), K_GLAD, glad);
    },
    sfx: [
      { t: tMade, s: 'idea_ding', g: 0.8, a: 'peak' },
      ...[0, 1, 2, 3, 4].map((i) => ({ t: tMade + 0.28 + i * 0.13, s: 'paper_pop', g: 0.45, a: 'peak' })),
      { t: tAI, s: 'robot_boot', g: 0.7, a: 'peak' },
      { t: tFlip - 0.5, s: 'sign_flip', g: 0.55, a: 'peak' },
      { t: tFlip, s: 'coin_flip', g: 0.9, a: 'peak' },
      { t: tFlip + FLIGHT, s: 'coin_catch', g: 0.7, a: 'peak' },
      { t: tThink - 0.15, s: 'paper_pop', g: 0.6, a: 'peak' },
      { t: tSweep0, s: 'think_tick', g: 0.6, len: tSweep1 - tSweep0 },
      { t: tSweep1, s: 'timer_ding', g: 0.8, a: 'peak' },
      { t: tDep - 0.22, s: 'paper_pop', g: 0.4, a: 'peak' },
      { t: tDep, s: 'bubble_flip', g: 0.9, a: 'peak' },
      { t: tBad + 0.15, s: 'sparkle', g: 0.6, a: 'peak' },
    ],
    animate(lt, open) {
      const q = Math.floor(lt * 15 + 1e-4) / 15;             // paper acts on twos
      for (const g of [midG.R, midG.L, frontG.R, frontG.L]) g.scale.y = sink(open);
      const frame = Math.round(q * 15);
      const thinking = q >= tThink - 0.05 && q < tSays - 0.02;
      const answered = q >= tDep;
      const glad = clamp(spring(q - tBad - 0.12, 2.8, 0.42), 0, 1.3);

      // Sam: the idea lands, he points at it, and at the end he could not be happier
      pop(bulb, clamp(spring(q - tMade, 3.4, 0.4), 0, 1.3) * (1 - tw(q, tThink - 0.45, tThink - 0.25, ease.inCubic)));
      bulb.rotation.z = 0.12 * Math.sin(frame * 1.3) * (q > tMade ? 1 : 0);
      thoughts.forEach((t, i) => {
        const inn = clamp(spring(q - tMade - 0.28 - i * 0.13, 3.6, 0.45), 0, 1.25);
        const out = tw(q, tThink - 0.5 + (thoughts.length - 1 - i) * 0.05, tThink - 0.34 + (thoughts.length - 1 - i) * 0.05, ease.inCubic);
        flap(t, inn * (1 - out));
      });
      const point = clamp(spring(q - tMade - 0.2, 2.6, 0.5), 0, 1.2) * (1 - tw(q, tThink - 0.3, tThink, ease.inOutCubic));
      for (const a of samArms) {
        const rest = 2.86, up = 0.5;
        const aim = a.userData.sg > 0 ? lerp(rest, 1.22, point) : rest;        // his right hand shows us the app
        a.rotation.z = -a.userData.sg * lerp(aim, up, glad);
      }
      for (const h of samHearts) pop(h, glad);
      for (const m of samGrin) m.visible = glad > 0.3;
      sam.userData.mouth.visible = glad <= 0.3;
      sam.userData.browL.position.y = sam.userData.browR.position.y = 1.08 + 0.105 + 0.04 * Math.min(1, glad);
      sam.position.y = 0.42 + 0.07 * Math.max(0, Math.sin(clamp(q - tBad - 0.12, 0, 0.4) / 0.4 * Math.PI));     // a little hop
      stars.forEach((s, i) => { const v = clamp(spring(q - tBad - 0.22 - i * 0.1, 3.4, 0.4), 0, 1.3); pop(s, v); s.userData.tip.rotation.z = (1 - Math.min(1, v)) * 1.2 + 0.2 * i - s.rotation.z; });

      // the robot: asleep, switched on, flips, thinks, shrugs
      const u = bot.userData;
      const awake = q >= tAI;
      const bootPop = awake ? 1 + 0.35 * Math.max(0, 1 - (q - tAI) / 0.2) : 1;
      const tq = q - tFlip;                                   // time since the throw
      const flying = tq >= 0 && tq < FLIGHT - 1e-3;
      const pi = Math.max(0, Math.min(SPIN.length - 1, Math.floor(tq * 15 + 1e-3)));       // which drawing of the flight
      // the eyes and chest lights were cut with their place baked in, so a squash has to be put back on centre by hand
      const eyeY = awake ? bootPop : 0.14;
      for (const e of u.eyes) { e.scale.set(1, eyeY, 1); e.position.x = thinking ? -0.03 : flying ? 0.035 : 0; e.position.y = 0.04 * (1 - eyeY) + (thinking ? 0.05 : flying ? (pi >= 3 && pi <= 10 ? 0.07 : 0.03) : 0); }
      u.mouth.visible = awake && !thinking; botFlat.visible = !awake || thinking;
      antenna.rotation.z = thinking ? 0.22 * Math.sin(frame * 2.1) : awake ? 0.5 * Math.max(0, 1 - (q - tAI) / 0.3) * Math.sin(frame * 2.5) : 0;
      u.head.rotation.z = thinking ? 0.09 * (Math.floor(frame / 3) % 2 ? 1 : -1) : answered ? -0.1 * clamp(spring(q - tDep, 2.6, 0.5), 0, 1.2) : 0;
      u.dots.forEach((d, i) => {
        const k = !awake ? 0.55 : thinking ? (Math.floor(frame / 2) % 3 === i ? 1.5 : 0.65) : 1;
        d.scale.setScalar(k); d.position.x = (i - 1) * 0.15 * (1 - k); d.position.y = 0.52 * (1 - k);
      });
      steam.forEach((s, i) => { s.visible = thinking && q > tThink + 0.35 && Math.floor(frame / 2) % 2 === i; });
      // arms: wave hello, wind up, throw, reach for the catch, then the shrug
      const wave = awake && q < tAI + 0.5 ? 0.5 * Math.sin((q - tAI) * 16) : 0;
      const wind = tq >= -WIND && tq < 0 ? ease.inOutCubic(Math.min(1, (tq + WIND) / (WIND * 0.76))) : 0;
      let armTh = A_REST;
      if (tq >= -WIND && tq < 0) armTh = lerp(A_REST, A_LOW, wind);
      else if (tq >= 0 && tq < 2 / 15 - 1e-3) armTh = A_HIGH + 0.27;                              // the follow-through
      else if (tq >= 0 && tq < FLIGHT - 1e-3) armTh = A_HIGH;
      else if (tq >= FLIGHT - 1e-3 && tq < FLIGHT + 2 / 15 - 1e-3) armTh = A_HIGH - 0.2;           // the hand gives as the coin lands
      else if (tq >= FLIGHT) armTh = lerp(A_HIGH, A_REST, tw(tq, FLIGHT + 0.2, FLIGHT + 0.5, ease.inOutCubic));
      const shrug = clamp(spring(q - tDep - 0.02, 2.8, 0.42), 0, 1.25) * (1 - 0.45 * tw(q, tBad, tBad + 0.3, ease.inOutCubic));
      u.armL.rotation.z = lerp(-0.35 - Math.max(0, wave) * 1.6 - 0.5 * wind, -2.05, shrug);
      u.armR.rotation.z = lerp(armTh, 2.0, shrug);
      // the whole robot squashes as it winds up and stretches as it lets go
      const stretch = tq >= 0 && tq < 2 / 15 - 1e-3 ? 1 : 0;
      bot.scale.set(1.2 * (1 + 0.05 * wind - 0.03 * stretch), 1.2 * (1 - 0.09 * wind + 0.06 * stretch), 1.2);
      // the coin: off the low hand, up and over six times, a beat at the top, and down into the raised hand
      const th = u.armR.rotation.z;
      if (flying) {
        let x, y;
        if (pi < 6) { const k = 1 - Math.pow(1 - (pi + 1) / 6, 2); x = lerp(P_OFF[0], P_TOP[0], k); y = lerp(P_OFF[1], P_TOP[1], k); }
        else if (pi < 8) { x = P_TOP[0]; y = P_TOP[1]; }
        else { const k = Math.pow((pi - 7) / 6, 2); x = lerp(P_TOP[0], P_LAND[0], k); y = lerp(P_TOP[1], P_LAND[1], k); }
        const vx = x - SH[0], vy = y - SH[1];
        u.coin.position.set(vx * Math.cos(th) + vy * Math.sin(th), -vx * Math.sin(th) + vy * Math.cos(th), L * 3);
        u.coin.rotation.z = -th;                              // stays upright in the air
        const [open, heads] = SPIN[pi];
        u.coin.scale.set(1.25 * 1.5, 1.25 * 1.5 * open, 1);
        u.coin.children[2].visible = heads === 1; tails.visible = heads === 0;
      } else {
        const land = tq >= FLIGHT - 1e-3 && tq < FLIGHT + 2 / 15 - 1e-3 ? 0.78 : 1;                  // a squash as it is caught
        u.coin.position.set(0, -0.55, L * 0.7);
        u.coin.rotation.z = 0;
        u.coin.scale.set(1.25 * (land < 1 ? 1.12 : 1), 1.25 * land, 1);
        u.coin.children[2].visible = true; tails.visible = false;
      }

      // the question card flips up before the flip
      { const v = clamp(spring(q - (tFlip - 0.5), 3.0, 0.45), 0, 1.2); sign.visible = v > 0.02; sign.scale.set(1, Math.max(0.001, v), 1); }

      // the stopwatch: pops up, sweeps to forty, dings
      { const v = tw(q, tThink - 0.38, tThink - 0.14, ease.outCubic); stalk.visible = v > 0.02; stalk.scale.set(1, Math.max(0.001, v), 1); }
      pop(dial, clamp(spring(q - (tThink - 0.15), 3.2, 0.45), 0, 1.25));
      const secs = 40 * seg(q, tSweep0, tSweep1);
      hand.rotation.z = -(secs / 60) * Math.PI * 2;
      wedges.forEach((w, i) => { w.visible = secs >= (i + 1) * 5 - 0.01; });
      pop(ding, clamp(spring(q - tSweep1, 3.6, 0.38), 0, 1.3) * (1 - tw(q, tSweep1 + 0.5, tSweep1 + 0.7, ease.inCubic)));
      ding.rotation.z = frame * 0.4;

      // the answer flips up over the fold (a hinge seen head-on is a squash, so both halves stay joined at the crease)
      { const v = tw(q, tDep - 0.24, tDep - 0.04, ease.outCubic); post.visible = v > 0.02; post.scale.set(1, Math.max(0.001, v), 1); }
      const up = clamp(spring(q - tDep, 3.0, 0.4), 0, 1.3);
      for (const b of bubbles) { b.visible = up > 0.02; b.scale.set(0.9 + 0.1 * Math.min(1, up), Math.max(0.001, up), 1); }
    },
  };
}
