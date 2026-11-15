// Spread 3: "Sam does not build it. Sam's AI makes the promo." A film set at night. Sam naps in a deck chair with
// his feet on the closed toolbox; his AI (the terminal window, in a beret, with its name hung under it) types one
// command and directs the coin robot on a little stage.

import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { PAL, LAYER as L, rr, circ, ell, poly, star, piece, stack, printed } from '../paper.js';
import { cutText, cutSign } from '../type.js';
import * as art from '../art.js';
import { spring, clamp, lerp, seg, ease, tw } from '../util.js';

// the command line is cut from a terminal typeface (a local file, like every other font in the film)
const TERM = new Font(await new TTFLoader().loadAsync('/assets/fonts/VT323-Regular.ttf'));

const D = Math.PI / 180;
const WALL = '#47568f', WALL_DARK = '#232b4f', BEAM = '#f3e2a0', BEAM_EDGE = '#d6c078', CURTAIN = '#cf3f2b', CURTAIN_DARK = '#a83022';
const WIRE = '#e6dcc6';
const COMMAND = '> make a promo';

/** A ribbon of constant width along a polyline (for cables on the floor). */
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

/** Diagonal black and white stripes, as on a clapperboard arm. */
function stripes(c, w, h) {
  c.fillStyle = PAL.white; c.fillRect(0, 0, w, h);
  c.fillStyle = PAL.charcoal;
  const s = h * 1.15;
  for (let x = -h; x < w + h; x += s * 2) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + s, h); c.lineTo(x + s + h * 0.7, 0); c.lineTo(x + h * 0.7, 0); c.closePath(); c.fill(); }
}

/** A paper light cone: a flat pale-yellow cut-out with a slightly darker sheet showing round its edge. */
function cone(g, top, bottom, len, z) {
  g.put(poly([[-top - 0.02, 0.012], [top + 0.02, 0.012], [bottom + 0.035, -len - 0.02], [-bottom - 0.035, -len - 0.02]], 0), BEAM_EDGE, { z });
  g.put(poly([[-top, 0], [top, 0], [bottom, -len], [-bottom, -len]], 0), BEAM, { z: z + 0.004 });
}

/** Front layers fold first: a fold's art sinks into the page over the first few degrees of a page turn (and stands up
 *  as the page lands), before it can lean back through the wall behind it. open: 0 shut .. 1 flat. */
const sink = (open) => { const u = Math.min(1, Math.max(0, (open - 0.9) / 0.095)); return Math.max(0.002, u * u * (3 - 2 * u)); };

export function build(env) {
  const { fonts, mark, shot } = env;
  const at = (word) => mark('promo', word) - shot.t0;
  const tDoes = at('does'), tAI = at("Sam's AI"), tMakes = at('makes'), tPromo = at('promo');
  // the AI types its one command just before "makes the promo" is spoken
  const tCard = tAI - 0.5;                                              // the command card flips up
  const tType = tAI - 0.22, typeDur = Math.max(0.5, tMakes - 0.14 - tType);

  // ---------------------------------------------------------------- back wall: the stage curtain and Sam's sign
  const XS = 1.8;                                // centre of the stage opening on the back wall
  let beam = null;
  const lamps = [];
  const back = env.fold({ z: -1.02, beta: 68 });
  env.span(back, (g, side, clip) => {
    g.put(rr(6.2, 2.45, [0.3, 0.3, 0, 0], 0, 1.225), WALL, { z: 0 });
    g.put(rr(6.2, 0.12, 0, 0, 0.06), WALL_DARK, { z: L * 0.5 });
    // a lighting bar with two lamps, which come on with the spotlight
    g.put(rr(1.5, 0.05, 0.02, -0.14, 2.2), PAL.grey, { z: L * 0.6 });
    for (const x of [-0.62, 0.3]) {
      if ((side === 'R') !== (x > 0)) continue;
      g.put(rr(0.03, 0.2, 0, x, 2.1), PAL.grey, { z: L * 0.7 });
      g.put(poly([[x - 0.1, 2.02], [x + 0.1, 2.02], [x + 0.2, 1.76], [x - 0.2, 1.76]], 0.02), PAL.charcoal, { z: L * 0.9 });
      g.put(rr(0.36, 0.07, 0.03, x, 1.75), '#59607a', { z: L * 1.2 });
      const glow = stack({ clip, x, y: 1.75, z: L * 0.5 });
      glow.put(rr(0.36, 0.07, 0.03), PAL.yellow, { z: L * 0.9 });
      cone(glow, 0.16, 0.33, 0.6, 0);
      g.add(glow); lamps.push(glow);
    }
    if (side === 'R') {
      g.put(rr(1.9, 2.15, 0, XS, 1.075), WALL_DARK, { z: L * 0.4 });
      for (const [x, y, q] of [[XS - 0.5, 1.7, 0.03], [XS + 0.42, 1.5, 0.024], [XS + 0.55, 0.9, 0.03], [XS - 0.55, 0.75, 0.022], [XS + 0.1, 1.86, 0.02]]) g.put(circ(q, x, y), '#5d6aa3', { z: L * 0.6 });
      // the spotlight: a paper cone hinged at the lamp so it can snap open
      beam = stack({ clip, x: XS, y: 2.12, z: L * 0.8 });
      cone(beam, 0.13, 0.78, 2.1, 0);
      g.add(beam);
      // drapes, pulled to the sides
      for (const sg of [-1, 1]) {
        g.put(poly([[XS + sg * 1.12, 0], [XS + sg * 0.74, 0], [XS + sg * 0.64, 0.72], [XS + sg * 0.84, 1.36], [XS + sg * 0.52, 2.12], [XS + sg * 1.12, 2.12]], 0.07), CURTAIN, { z: L * 1.4 });
        g.put(rr(0.05, 1.86, 0.02, XS + sg * 1.0, 1.06), CURTAIN_DARK, { z: L * 1.7 });
        g.put(rr(0.045, 1.2, 0.02, XS + sg * 0.88, 0.62), CURTAIN_DARK, { z: L * 1.7 });
      }
      for (let i = 0; i < 9; i++) g.put(circ(0.155, XS - 1.1 + i * 0.275, 2.03), CURTAIN, { z: L * 2.0 });
      g.put(rr(2.5, 0.36, 0.05, XS, 2.2), CURTAIN_DARK, { z: L * 2.3 });
      g.put(rr(2.5, 0.06, 0.02, XS, 2.37), PAL.gold, { z: L * 2.6 });
    } else {
      // the sign over the deck chair
      const sx = -2.36;
      for (const dx of [-0.52, 0.52]) g.put(rr(0.022, 0.42, 0, sx + dx, 2.26), PAL.cream, { z: L * 0.6 });
      // letters cut from navy paper, on a cream card with a red edge
      const sign = stack({ clip, x: sx, y: 1.88, z: L * 1.2, rot: -0.03 });
      sign.put(rr(1.56, 0.48, 0.05), PAL.red, { z: 0 });
      sign.put(rr(1.49, 0.41, 0.035), PAL.cream, { z: L * 0.25 });
      sign.add(cutSign(fonts.anton, 'GENIUS AT WORK', 1.34, 0.21, PAL.navy, { clip, z: L * 0.6, seed: 4 }));
      g.add(sign);
    }
  });

  // ---------------------------------------------------------------- middle: the stage with its star, and Sam asleep
  let bot = null, pool = null;
  const zs = [], wires = [], sparkles = [];
  const BX = 1.72;
  const mid = env.fold({ z: -0.25, beta: 80 });
  const midG = env.span(mid, (g, side, clip) => {
    if (side === 'R') {
      g.put(rr(1.78, 0.3, [0.05, 0.05, 0, 0], BX, 0.15), '#b07f55', { z: 0 });
      for (const x of [-0.58, 0, 0.58]) g.put(rr(0.03, 0.26, 0, BX + x, 0.14), '#946843', { z: L * 0.4 });
      g.put(rr(1.86, 0.075, 0.03, BX, 0.31), '#dbb890', { z: L * 0.6 });
      pool = g.put(ell(0.7, 0.07, BX, 0.36), BEAM, { z: L * 0.9, cast: false });
      // the sparkles of the last beat, each on a paper stalk that springs out from behind the star of the show
      for (const [dx, dy, q, c] of [[-0.8, 1.0, 0.17, PAL.gold], [0.86, 0.62, 0.13, PAL.white], [-0.72, 0.24, 0.11, PAL.white], [0.66, 1.36, 0.15, PAL.gold]]) {
        const len = Math.hypot(dx, dy);
        const s = stack({ clip, x: BX, y: 0.34 + 0.72, z: L * 1.1, rot: Math.atan2(-dx, dy) });
        s.put(rr(0.028, len, 0, 0, len / 2), WIRE, { z: 0 });
        const tip = stack({ clip, x: 0, y: len, z: L * 0.5 });
        tip.put(star(4, q, q * 0.3, 0, 0, 0, 0), c, { z: 0 });
        s.add(tip); s.userData.tip = tip;
        g.add(s); sparkles.push(s);
      }
      bot = art.coinBot({ clip, x: BX, y: 0.34, z: L * 1.6, s: 1.0 });
      g.add(bot);
    } else {
      const SX = -2.5;
      const lounge = stack({ clip, x: SX, y: 0, z: L });
      // deck chair
      for (const sg of [-1, 1]) lounge.put(rr(0.075, 1.56, 0.03, sg * 0.56, 0.78), PAL.brown, { z: 0, rot: sg * 0.05 });
      lounge.put(rr(1.02, 1.3, 0.1, 0, 0.82), PAL.cream, { z: L * 0.4 });
      for (const x of [-0.36, -0.12, 0.12, 0.36]) lounge.put(rr(0.115, 1.3, 0, x, 0.82), PAL.orange, { z: L * 0.7 });
      // Sam, hands behind his head, eyes shut
      const sam = art.person({ clip, x: 0, y: 0.44, z: L * 1.3, s: 0.95, rot: 0.05, shirt: PAL.red, hair: PAL.umber, skin: PAL.tan });
      const hy = 1.08;
      for (const sg of [-1, 1]) sam.put(poly([[sg * 0.3, 0.66], [sg * 0.72, 1.12], [sg * 0.3, 1.22]], 0.06), PAL.red, { z: L * 1.2 });
      sam.userData.eyes.forEach((e) => { e.visible = false; });
      for (const sg of [-1, 1]) sam.put(art.band(sg * 0.11, hy + 0.02, 0.04, 200 * D, 340 * D, 0.02), PAL.ink, { z: L * 3.2 });
      sam.userData.browL.position.y += 0.02; sam.userData.browR.position.y += 0.02;
      lounge.add(sam);
      // the toolbox, shut, as a footstool; the soles of his shoes on top of it
      lounge.put(rr(0.36, 0.2, 0.07, 0, 0.4), PAL.grey, { z: L * 3.6 });
      lounge.put(rr(0.24, 0.1, 0.03, 0, 0.4), PAL.red, { z: L * 3.9 });
      lounge.put(rr(1.0, 0.36, 0.05, 0, 0.18), '#d9442f', { z: L * 4.0 });
      lounge.put(rr(1.0, 0.05, 0, 0, 0.26), '#b3301f', { z: L * 4.3 });
      lounge.put(rr(0.13, 0.11, 0.02, 0, 0.25), PAL.gold, { z: L * 4.6 });
      for (const sg of [-1, 1]) {
        const shoe = stack({ clip, x: sg * 0.27, y: 0.57, z: L * 5, rot: sg * -0.16 });
        shoe.put(rr(0.3, 0.44, 0.13), PAL.white, { z: 0 });
        shoe.put(rr(0.24, 0.38, 0.1), '#e9dcc3', { z: L * 0.4 });
        for (const y of [-0.1, 0, 0.1]) shoe.put(rr(0.16, 0.035, 0.015, 0, y), '#bfae8f', { z: L * 0.7 });
        lounge.add(shoe);
      }
      g.add(lounge);
      // z z Z, strung on a paper wire that grows out of the top of the deck chair
      const P = [[SX + 0.5, 1.5], [-1.76, 1.66], [-1.4, 1.9], [-1.0, 2.24]];
      [0.25, 0.33, 0.44].forEach((size, i) => {
        const a = P[i], b = P[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const w = stack({ clip, x: a[0], y: a[1], z: L * 3.4, rot: Math.atan2(b[1] - a[1], b[0] - a[0]) });
        w.put(rr(len, 0.028, 0, len / 2, 0), WIRE, { z: 0 });
        g.add(w); wires.push(w);
        const z = stack({ clip, x: b[0], y: b[1], z: L * 4 });
        const t = cutText(fonts.bookman, i === 2 ? 'Z' : 'z', size, PAL.cream, { clip, seed: 11 + i });
        t.position.y = -size * 0.3; t.rotation.z = -0.12;
        z.add(t);
        g.add(z); zs.push(z);
      });
    }
  });

  // ---------------------------------------------------------------- front: the director, the clapperboard, the camera
  let mega = null, clapArm = null, rec = null, bud = null, beret = null;
  const UPY = 0.24;                               // how much taller than an ordinary chair the director's is
  const front = env.fold({ z: 0.46, beta: 85 });
  const frontG = env.span(front, (g, side, clip) => {
    if (side === 'L') {
      // a tall director's chair, so the name tag under the window clears the command card in front of it
      const dir = stack({ clip, x: -0.95, y: 0, z: L });
      for (const sg of [-1, 1]) dir.put(rr(0.075, 1.16, 0.02, 0, 0.46), PAL.kraft, { z: sg > 0 ? 0 : 0.002, rot: sg * 0.5 });
      dir.put(rr(0.96, 0.085, 0.03, 0, 0.62 + UPY), PAL.brown, { z: L * 0.5 });
      // megaphone, hinged where a hand would be
      mega = stack({ clip, x: 0.53, y: 1.04 + UPY, z: L * 0.6, s: 0.82 });
      mega.put(rr(0.06, 0.2, 0.02, 0.13, -0.14), PAL.grey, { z: 0 });
      mega.put(poly([[0, -0.06], [0, 0.06], [0.4, 0.21], [0.4, -0.21]], 0.02), PAL.gold, { z: L * 0.3 });
      mega.put(rr(0.1, 0.17, 0.03, -0.02, 0), PAL.orange, { z: L * 0.6 });
      mega.put(rr(0.055, 0.48, 0.025, 0.41, 0), PAL.cream, { z: L * 0.6 });
      dir.add(mega);
      // a white edge, so the dark window reads against the dark set
      dir.put(rr(1.32, 1.04, 0.15, 0, 1.13 + UPY), PAL.white, { z: L * 0.9 });
      bud = art.buddy({ clip, x: 0, y: 0.67 + UPY, z: L * 1.3, s: 1.15 });
      dir.add(bud);
      beret = stack({ clip, x: -0.3, y: 1.62 + UPY, z: L * 2.4, rot: 0.2 });
      beret.put(ell(0.3, 0.115, 0, 0), PAL.lilac, { z: 0 });
      beret.put(rr(0.035, 0.1, 0.015, 0.02, 0.13), PAL.lilac, { z: -0.002 });
      dir.add(beret);
      // its name, on a tag hung under the window by two strings
      const TW = 1.42, TH = 0.5, TY = 0.28 + UPY;
      for (const x of [-0.52, 0.52]) dir.put(rr(0.022, 0.2, 0, x, TY + TH / 2 + 0.07), PAL.cream, { z: L * 1.4 });
      const tag = stack({ clip, x: 0, y: TY, z: L * 1.8, rot: -0.025 });
      tag.put(rr(TW, TH, 0.05), PAL.red, { z: 0 });
      tag.put(rr(TW - 0.07, TH - 0.07, 0.035), PAL.cream, { z: L * 0.25 });
      tag.add(cutSign(fonts.anton, "SAM'S AI", 1.16, 0.27, PAL.navy, { clip, z: L * 0.6, seed: 6 }));
      dir.add(tag);
      for (const x of [-0.52, 0.52]) dir.put(circ(0.03, x, TY + TH / 2 - 0.07), PAL.red, { z: L * 2.6 });
      g.add(dir);
    } else {
      // clapperboard on a stand
      const clap = stack({ clip, x: 0.6, y: 0, z: L });
      clap.put(rr(0.34, 0.06, 0.02, 0, 0.03), PAL.grey, { z: 0 });
      clap.put(rr(0.05, 0.6, 0, 0, 0.3), PAL.grey, { z: 0 });
      clap.put(rr(0.98, 0.84, 0.06, 0, 0.93), PAL.white, { z: L * 0.5 });
      clap.add(printed(0.9, 0.56, (c, w, h) => {
        c.fillStyle = PAL.charcoal; c.fillRect(0, 0, w, h);
        c.fillStyle = PAL.cream; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        c.font = `${h * 0.2}px "Anton"`; c.fillText('SCENE 1', w / 2, h * 0.27);
        c.fillRect(w * 0.08, h * 0.36, w * 0.84, h * 0.025);
        let size = h * 0.5; c.font = `${size}px "Anton"`;
        const m = c.measureText('TAKE 47').width; if (m > w * 0.86) { size *= (w * 0.86) / m; c.font = `${size}px "Anton"`; }
        c.fillText('TAKE 47', w / 2, h * 0.9);
      }, { clip, x: 0, y: 0.82, z: L * 0.9, shape: rr(0.9, 0.56, 0.03) }));
      clap.add(printed(0.9, 0.13, stripes, { clip, x: 0, y: 1.19, z: L * 0.9, shape: rr(0.9, 0.13, 0.02) }));
      clapArm = stack({ clip, x: -0.45, y: 1.27, z: L * 1.3 });
      clapArm.add(printed(0.9, 0.13, stripes, { clip, x: 0.45, y: 0.065, z: 0, shape: rr(0.9, 0.13, 0.02) }));
      clapArm.put(circ(0.04, 0.02, 0.03), PAL.grey, { z: L * 0.4 });
      clap.add(clapArm);
      g.add(clap);
      // camera on a tripod at the edge of the set, pointing at the stage
      const cam = stack({ clip, x: 2.93, y: 0, z: L, s: 0.86 });
      for (const r of [-0.34, 0, 0.34]) cam.put(rr(0.05, 0.86, 0.02, 0, 0.36), PAL.grey, { z: 0, rot: r });
      cam.put(rr(0.2, 0.08, 0.02, 0, 0.78), PAL.charcoal, { z: L * 0.3 });
      for (const x of [-0.13, 0.17]) { cam.put(circ(0.17, x, 1.3), '#c9ced6', { z: L * 0.3 }); cam.put(circ(0.05, x, 1.3), PAL.charcoal, { z: L * 0.6 }); }
      cam.put(rr(0.62, 0.4, 0.06, 0, 1.0), PAL.lightgrey, { z: L * 0.8 });
      cam.put(rr(0.22, 0.26, 0.03, -0.4, 1.0), PAL.charcoal, { z: L * 0.6 });
      cam.put(rr(0.07, 0.34, 0.02, -0.52, 1.0), PAL.grey, { z: L * 0.9 });
      cam.put(rr(0.2, 0.1, 0.02, 0.12, 0.92), PAL.grey, { z: L * 1.1 });
      rec = cam.put(circ(0.05, 0.19, 1.1), PAL.red, { z: L * 1.2 });
      g.add(cam);
    }
  });

  // ---------------------------------------------------------------- the command the AI types, on a card at the front
  let card = null, cursor = null;
  const typed = [];                               // [{ mesh, ci }]: each cut letter and its place in the line
  const CARD_H = 0.44, CAP = 0.24;                // card height and the height of the tall letters, in units
  const cmd = env.fold({ z: 0.99, beta: 87 });
  const cmdG = env.span(cmd, (g, side, clip) => {
    if (side !== 'L') return;
    const t = cutText(TERM, COMMAND, 1, PAL.mint, { clip, align: 'left', seed: 3 });
    // size the line by its tall letters: "k" stands as tall as a capital
    const kMesh = t.userData.letters[3], bb = kMesh.geometry.boundingBox;
    const k = Math.min(CAP / (bb.max.y - bb.min.y), 2.16 / t.userData.width);
    const lineW = t.userData.width * k, adv = lineW / COMMAND.length;
    const W = lineW + adv * 1.2 + 0.26, x0 = -0.2 - W;                     // the card ends just short of the fold
    card = stack({ clip, x: x0 + W / 2, y: 0, z: L });
    for (const x of [-W * 0.36, W * 0.36]) card.put(rr(0.05, 0.1, 0, x, 0.03), WIRE, { z: 0 });
    card.put(rr(W, CARD_H, 0.07, 0, 0.05 + CARD_H / 2), '#454b63', { z: L * 0.4 });
    card.put(rr(W - 0.07, CARD_H - 0.07, 0.05, 0, 0.05 + CARD_H / 2), PAL.charcoal, { z: L * 0.8 });
    t.scale.setScalar(k);
    const base = 0.05 + CARD_H / 2 - (CAP * 0.5 - 0.02);                   // baseline: tall letters centred, room for the "p" to hang
    t.position.set(-W / 2 + 0.13, base, L * 1.3);
    card.add(t);
    let li = 0;
    [...COMMAND].forEach((ch, ci) => { if (ch !== ' ') typed.push({ mesh: t.userData.letters[li++], ci }); });
    cursor = stack({ clip, x: -W / 2 + 0.13, y: base, z: L * 1.3 });
    cursor.put(rr(adv * 0.78, CAP * 0.92, 0.01, adv * 0.5, CAP * 0.42), PAL.mint, { z: 0 });
    cursor.userData.adv = adv; cursor.userData.x0 = -W / 2 + 0.13;
    card.add(cursor);
    g.add(card);
  });

  // ---------------------------------------------------------------- on the floor: a cable and tape marks
  const cable = (sg) => {
    const pts = [];
    for (let i = 0; i <= 26; i++) { const x = 0.05 + (i / 26) * 2.75; pts.push([sg * x, -0.62 + 0.07 * Math.sin(x * 2.6 * sg + 0.5) + (sg > 0 ? 0.0 : 0.03)]); }
    return ribbon(pts, 0.045);
  };
  env.pages.right.add(piece(cable(1), PAL.orange, { z: 0.004, cast: false }));
  env.pages.left.add(piece(cable(-1), PAL.orange, { z: 0.004, cast: false }));
  for (const [x, y, r] of [[1.4, -0.92, 0], [2.1, -0.92, 0]]) {
    env.pages.right.add(piece(rr(0.26, 0.05, 0), PAL.cream, { x, y, z: 0.004, rot: r, cast: false }));
    env.pages.right.add(piece(rr(0.05, 0.2, 0), PAL.cream, { x, y: y - 0.08, z: 0.004, rot: r, cast: false }));
  }

  // ---------------------------------------------------------------- camera: wide, a push toward the AI, then the stage
  const K_WIDE = { pos: [0.1, 6.35, 9.75], target: [0.1, 0.84, -0.12], focus: [0.6, 1.0, 0.0], aperture: 0.1 };
  const K_AI = { pos: [-0.3, 5.7, 8.57], target: [-0.3, 0.85, -0.12], focus: [-0.95, 0.9, 0.5], aperture: 0.1 };          // 12 percent closer
  const K_SET = { pos: [0.0, 5.93, 8.96], target: [0.0, 0.86, -0.12], focus: [0.6, 1.0, 0.2], aperture: 0.1 };            // a little wider again for the clap
  const mixKey = (a, b, u) => ({
    pos: a.pos.map((v, i) => lerp(v, b.pos[i], u)), target: a.target.map((v, i) => lerp(v, b.target[i], u)),
    focus: a.focus.map((v, i) => lerp(v, b.focus[i], u)), aperture: lerp(a.aperture, b.aperture, u),
  });

  return {
    key(lt) {
      const inn = ease.inOutCubic(seg(lt, tAI - 0.55, tAI + 0.35));
      const set = ease.inOutCubic(seg(lt, tMakes - 0.1, tPromo + 0.05));
      return mixKey(mixKey(K_WIDE, K_AI, inn), K_SET, set);
    },
    sfx: [
      { t: tDoes, s: 'snore_pop', g: 0.5 },
      { t: tCard, s: 'flap_flip', g: 0.6, a: 'peak' },
      { t: tType, s: 'typing', g: 0.55, len: typeDur },
      { t: tAI, s: 'megaphone_up', g: 0.6 },
      { t: tMakes, s: 'spotlight_on', a: 'peak' },
      { t: tMakes + 0.14, s: 'robot_tada', g: 0.8 },
      { t: tPromo, s: 'clapper', a: 'peak' },
    ],
    animate(lt, open) {
      const q = Math.floor(lt * 15 + 1e-4) / 15;                 // paper acts on twos
      for (const g of [midG.R, midG.L, frontG.R, frontG.L, cmdG.R, cmdG.L]) g.scale.y = sink(open);
      zs.forEach((z, i) => {
        const t0 = tDoes + i * 0.26;
        const s = spring(q - t0, 3, 0.5);
        z.visible = s > 0.02; z.scale.setScalar(Math.max(0.001, s));
        z.rotation.z = 0.1 * Math.sin(q * 2.4 + i);
        const w = tw(q, t0 - 0.16, t0 + 0.02, ease.outCubic);      // its length of wire runs out just ahead of it
        wires[i].visible = w > 0.02; wires[i].scale.set(Math.max(0.001, w), 1, 1);
      });
      // the director: its command card flips up, it types, lifts its megaphone, and never stops blinking its cursor
      { const v = clamp(spring(q - tCard, 3.0, 0.45), 0, 1.2); card.visible = v > 0.02; card.scale.set(1, Math.max(0.001, v), 1); }
      const count = q < tType ? 0 : Math.min(COMMAND.length, Math.floor(((q - tType) / typeDur) * COMMAND.length) + 1);
      for (const t of typed) t.mesh.visible = t.ci < count;
      cursor.position.x = cursor.userData.x0 + count * cursor.userData.adv;
      cursor.visible = count < COMMAND.length || Math.floor(q * 3) % 2 === 0;
      mega.rotation.z = lerp(-1.2, 0.16, clamp(spring(q - tAI, 2.8, 0.5), 0, 1.2));
      bud.userData.cursor.visible = Math.floor(q * 3) % 2 === 0;
      bud.position.y = 0.67 + UPY + 0.035 * clamp(spring(q - tAI, 3.4, 0.35), 0, 1.4) * (q < tAI ? 0 : 1);
      beret.rotation.z = 0.2 + 0.25 * (1 - clamp(spring(q - tAI, 3, 0.4), 0, 1.3)) * (q < tAI ? 0 : 1);
      // lights
      const on = q >= tMakes;
      beam.visible = on; pool.visible = on;
      lamps.forEach((l, i) => { l.visible = q >= tMakes - 0.2 + i * 0.07; });
      if (on) beam.scale.set(clamp(spring(q - tMakes, 4.5, 0.55), 0.05, 1.2), 1, 1);
      // the star strikes a pose
      const p = clamp(spring(q - (tMakes + 0.14), 2.8, 0.45), 0, 1.25);
      bot.userData.armR.rotation.z = lerp(0.3, 2.5, p);
      bot.userData.armL.rotation.z = lerp(-0.3, -2.5, p);
      bot.userData.head.rotation.z = lerp(0, -0.1, p);
      bot.position.y = 0.34 + 0.05 * Math.max(0, Math.sin(Math.min(1, Math.max(0, (q - tMakes - 0.14) / 0.3)) * Math.PI));
      bot.userData.dots.forEach((d, i) => { d.visible = !on || Math.floor(q * 6 + i) % 3 !== 0; });
      // and... action
      const c = q - tPromo;
      clapArm.rotation.z = c < -0.2 ? 0.5 : c < 0 ? 0.5 + 0.16 * (1 + c / 0.2) : c < 0.07 ? 0 : c < 0.14 ? 0.07 : 0;
      sparkles.forEach((s, i) => {
        const k = clamp(spring(c - 0.05 - i * 0.07, 3.4, 0.4), 0, 1.3);
        s.visible = k > 0.02; s.scale.setScalar(Math.max(0.001, k));
        s.userData.tip.rotation.z = (1 - Math.min(1, k)) * 0.9 - s.rotation.z;
      });
      rec.visible = c >= 0 && Math.floor(c * 3) % 2 === 0;
    },
  };
}
