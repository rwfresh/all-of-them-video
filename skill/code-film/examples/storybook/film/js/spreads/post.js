// Spread 4: "Sam posts it on X. The likes are real." A big paper phone with Sam's post on it; a finger presses the
// big Post button; hearts spring up all around; real people pop up over the hills, and one big heart gets a REAL tag.

import { PAL, LAYER as L, rr, circ, ell, poly, heart, piece, stack, printed, ink } from '../paper.js';
import { cutText, cutSign } from '../type.js';
import * as art from '../art.js';
import { spring, clamp, lerp, tw, ease, seg, rng } from '../util.js';

const SKY = '#c8ebfa', HILL_A = '#86c79a', HILL_B = '#6db787', ICON = '#9aa3b2', BLUE = '#3a7ad6';
const HAND_ROT = 1.05;                            // the finger points up and to the left
const PS = 1.14;                                  // the phone is built at 1 and stood up 14 % bigger

/** A paper spring: a zigzag strip of height h standing on y = 0. */
function zigzag(h, a = 0.05, w = 0.032) {
  const n = Math.max(4, Math.round(h / 0.11)), up = [], down = [];
  for (let i = 0; i <= n; i++) { const x = i === 0 || i === n ? 0 : (i % 2 ? a : -a), y = (h * i) / n; up.push([x + w / 2, y]); down.push([x - w / 2, y]); }
  return poly([...up, ...down.reverse()], 0);
}

/** A strip of schoolbook type printed straight onto the phone's screen. lines: [text, weight]. */
function typed(w, h, lines, o = {}) {
  return ink(w, h, (c, W, H) => {
    c.fillStyle = PAL.ink; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    const lh = H / lines.length;
    lines.forEach(([text, weight], i) => {
      let size = lh * 0.8;
      c.font = `${weight} ${size}px "Schoolbook"`;
      const tw_ = c.measureText(text).width;
      if (tw_ > W * 0.98) { size *= (W * 0.98) / tw_; c.font = `${weight} ${size}px "Schoolbook"`; }
      c.fillText(text, W * 0.01, lh * i + lh * 0.5 + size * 0.34);
    });
  }, o);
}

/** Front layers fold first: a fold's art sinks into the page over the first few degrees of a page turn (and stands up
 *  as the page lands), before it can lean back through the wall behind it. open: 0 shut .. 1 flat. */
const sink = (open) => { const u = Math.min(1, Math.max(0, (open - 0.9) / 0.095)); return Math.max(0.002, u * u * (3 - 2 * u)); };

export function build(env) {
  const { fonts, mark, shot } = env;
  const at = (line, word) => mark(line, word) - shot.t0;
  const END = shot.dur;                                        // the next page starts to turn here
  // every beat hangs on a spoken word; the second half is also held clear of the page turn
  const tPosts = at('post', 'posts');                          // the finger presses Post
  const tCrowd = Math.min(at('post', 'on'), END - 2.3);        // people come up over the hills
  const tLike = Math.min(at('post', 'X'), END - 1.85);         // the first like; the counter tops out 0.76 s later
  const tBig = Math.min(at('likes', 'The') - 0.2, END - 1.6);  // the big heart
  const tTag = Math.min(at('likes', 'likes') - 0.1, END - 1.2); // its REAL tag: readable for a second before the turn
  const tReal = at('likes', 'real');                           // the tag bounces again on the word itself
  const r = rng(23);

  // ---------------------------------------------------------------- back: sky, hills, and the people behind them
  const hillTop = (x) => (x < 0 ? 0.12 + 1.1 * Math.sqrt(Math.max(0, 1 - Math.pow((x + 1.95) / 2.3, 2))) : 0.08 + 1.22 * Math.sqrt(Math.max(0, 1 - Math.pow((x - 1.85) / 2.5, 2))));
  const crowdDefs = [-2.74, -2.16, -1.54, 1.54, 2.16, 2.74].map((x, i) => ({
    x, i, shirt: [PAL.orange, PAL.teal, PAL.plum, PAL.gold, PAL.blue, PAL.rose][i],
    skin: [PAL.tan, '#8a5b3d', PAL.peach, '#c98d5e', PAL.tan, '#c98d5e'][i], s: 1.75 + r() * 0.3,
  }));
  const crowd = [];
  const back = env.fold({ z: -1.1, beta: 70 });
  env.span(back, (g, side, clip) => {
    g.put(rr(6.3, 2.95, [0.35, 0.35, 0, 0], 0, 1.475), SKY, { z: 0 });
    for (const [x, y, k] of [[-2.2, 2.35, 1], [1.72, 2.6, 0.8], [2.75, 2.05, 0.65]]) {
      if ((side === 'R') !== (x > 0)) continue;
      const c = stack({ clip, x, y, z: L * 0.5, s: k });
      for (const [cx, cy, q] of [[-0.24, 0, 0.17], [0, 0.09, 0.24], [0.26, 0.01, 0.18]]) c.put(circ(q, cx, cy), PAL.white, { z: 0 });
      c.put(rr(0.74, 0.2, 0.1, 0.01, -0.07), PAL.white, { z: 0.001 });
      g.add(c);
    }
    for (const p of crowdDefs) {
      if ((side === 'R') !== (p.x > 0)) continue;
      const u = stack({ clip, x: p.x, z: L * 1.2 });
      u.add(art.user({ clip, s: p.s, color: p.shirt, skin: p.skin }));
      u.put(heart(0.2 * p.s * 0.62, 0.06 * p.s, 0.2 * p.s), p.i % 2 ? PAL.rose : PAL.red, { z: L * 0.8, rot: -0.15 });
      u.userData.up = hillTop(p.x) - 0.14; u.userData.i = p.i;
      g.add(u); crowd.push(u);
    }
    // hills, cut to the width of the sky card
    const hill = (sg) => {
      const pts = [[sg * 3.15, 0], [0, 0]];
      for (let i = 0; i <= 28; i++) { const x = sg * (3.15 * i) / 28; pts.push([x, Math.max(0.2, hillTop(x))]); }
      return poly(pts, 0);
    };
    g.put(hill(side === 'R' ? 1 : -1), side === 'R' ? HILL_B : HILL_A, { z: L * 2.4 });
  });

  // ---------------------------------------------------------------- the phone
  const springs = [], counts = [];
  let hand = null, likeIcon = null, likedIcon = null, sent = null;
  const buttons = [], actions = [], taps = [];
  const addSprings = (g, clip, defs) => {
    for (const [x, h, w, c, d] of defs) {
      const root = stack({ clip, x, z: L * 0.6 });
      const spr = root.put(zigzag(h), PAL.white, { z: 0 });
      const hd = stack({ clip, z: L * 0.5 });
      hd.put(heart(w), c, { z: 0 });
      hd.put(ell(w * 0.09, w * 0.14, -w * 0.22, w * 0.14, 0.5), PAL.white, { z: L * 0.4 });
      root.add(hd);
      root.userData = { ...root.userData, spr, hd, h, d, k: springs.length };
      g.add(root); springs.push(root);
    }
  };
  const BY = 0.57;                                  // the button's (and later the icon row's) height on the phone
  const phone = env.fold({ z: -0.15, beta: 86 });
  const phoneG = env.span(phone, (g, side, clip) => {
    const ph = stack({ clip, s: PS });
    g.add(ph);
    ph.put(rr(1.76, 2.82, 0.2, 0, 1.46), PAL.charcoal, { z: L });
    ph.put(rr(1.56, 2.52, 0.1, 0, 1.47), PAL.white, { z: L * 1.5 });
    ph.put(rr(0.34, 0.05, 0.025, 0, 2.8), '#59607a', { z: L * 1.6 });
    // the post: Sam's face and name, what he wrote, and the promo
    const card = stack({ clip, z: L * 2 });
    if (side === 'L') {
      card.put(circ(0.17, -0.52, 2.46), PAL.tan, { z: 0 });
      card.put(poly([[-0.69, 2.48], [-0.66, 2.6], [-0.52, 2.66], [-0.38, 2.6], [-0.35, 2.48], [-0.44, 2.54], [-0.6, 2.54]], 0.03), PAL.umber, { z: L * 0.4 });
      for (const sx of [-0.585, -0.455]) card.put(circ(0.022, sx, 2.45), PAL.ink, { z: L * 0.4 });
      card.put(art.band(-0.52, 2.43, 0.06, (215 * Math.PI) / 180, (325 * Math.PI) / 180, 0.02), PAL.ink, { z: L * 0.4 });
      // Sam's round glasses, so the face on the post is plainly his
      for (const sx of [-0.585, -0.455]) card.put(art.ring(0.062, 0.047, sx, 2.45), PAL.charcoal, { z: L * 0.6, core: false, cut: false });
      card.put(rr(0.026, 0.014, 0.005, -0.52, 2.455), PAL.charcoal, { z: L * 0.6, core: false, cut: false });
    }
    card.add(typed(0.5, 0.27, [['Sam', 700]], { clip, x: -0.05, y: 2.46, z: 0.003 }));
    card.add(typed(1.4, 0.56, [['Coin Flip AI.', 700], ['It depends.', 700]], { clip, x: 0, y: 1.98, z: 0.003 }));
    // the promo's thumbnail: the coin robot on the left, a play button on the right
    card.put(rr(1.38, 0.8, 0.09, 0, 1.26), PAL.navy, { z: 0 });
    card.put(circ(0.36, 0.34, 1.26), '#31497a', { z: L * 0.3 });
    if (side === 'L') card.add(art.coinBot({ clip, x: -0.34, y: 0.885, z: L * 0.5, s: 0.4 }));
    else {
      card.put(circ(0.19, 0.34, 1.26), PAL.white, { z: L * 0.8 });
      card.put(poly([[0.28, 1.155], [0.28, 1.365], [0.455, 1.26]], 0.02), PAL.red, { z: L * 1.2 });
    }
    ph.add(card);
    // before it is posted: a big Post button (Po | st, so no letter sits on the fold). After: reply, repost, like and a counter.
    const btn = stack({ clip, x: 0, y: BY, z: L * 2.4 });
    btn.put(rr(1.4, 0.46, 0.23), '#2b5fb0', { z: 0, y: -0.035 });           // the button's own thickness, seen when it is pressed
    const face = stack({ clip, z: L * 0.6 });
    face.put(rr(1.4, 0.46, 0.23), BLUE, { z: 0 });
    const half = cutText(fonts.bookman, side === 'L' ? 'Po' : 'st', 0.32, PAL.cream, { clip, align: 'left', seed: side === 'L' ? 3 : 6 });
    half.position.set(side === 'L' ? -half.userData.width - 0.014 : 0.014, -0.108, L * 0.5);
    face.add(half);
    btn.add(face);
    btn.userData.face = face;
    ph.add(btn); buttons.push(btn);
    if (side === 'R') {
      sent = stack({ clip, x: 0.88, y: 2.7, z: L * 3 });
      sent.put(circ(0.2), PAL.green, { z: 0 });
      sent.put(poly([[-0.11, 0.0], [-0.04, -0.08], [0.11, 0.07], [0.08, 0.1], [-0.04, -0.02], [-0.08, 0.03]], 0.008), PAL.white, { z: L * 0.5 });
      ph.add(sent);
      // little paper flecks that flick out from under the fingertip when it lands
      for (const [a, d] of [[2.9, 0.2], [2.2, 0.22], [1.5, 0.21], [-2.7, 0.2]]) {
        const fl = stack({ clip, x: 0.52 + Math.cos(a) * d, y: BY - 0.02 + Math.sin(a) * d, z: L * 3.2, rot: a - Math.PI / 2 });
        fl.put(poly([[-0.018, 0], [0.018, 0], [0, 0.13]], 0.004), PAL.yellow, { z: 0 });
        ph.add(fl); taps.push(fl);
      }
      // Sam's hand reaching in from the right: a red sleeve, a fist and one finger. Its origin is the fingertip.
      hand = stack({ clip, z: L * 5, rot: HAND_ROT, s: 1.35 });
      hand.put(rr(0.4, 0.7, 0.06, 0.04, -1.36), PAL.red, { z: 0 });
      hand.put(rr(0.46, 0.1, 0.04, 0.04, -1.0), PAL.white, { z: L * 0.3 });
      hand.put(rr(0.42, 0.42, 0.16, 0.06, -0.78), PAL.tan, { z: L * 0.5 });
      hand.put(rr(0.17, 0.62, 0.085, 0, -0.31), PAL.tan, { z: L * 0.8 });
      hand.put(rr(0.11, 0.1, 0.045, 0, -0.07), PAL.peach, { z: L * 1.1 });
      hand.put(rr(0.15, 0.3, 0.075, -0.2, -0.62), '#dfae84', { z: L * 0.9, rot: 0.6 });
      g.add(hand);
    }
    const row = stack({ clip, y: BY, z: L * 2.4 });
    if (side === 'L') {
      // reply and like; a repost icon is only a smudge at this size, so the row does without it
      row.put(rr(0.3, 0.22, 0.07, -0.5, 0.014), ICON, { z: 0 });
      row.put(poly([[-0.59, -0.08], [-0.45, -0.08], [-0.59, -0.18]], 0.01), ICON, { z: 0.001 });
      likeIcon = row.put(heart(0.25, -0.14, 0), ICON, { z: 0 });
      likedIcon = stack({ clip, x: -0.14, y: 0, z: L * 0.4 });
      likedIcon.put(heart(0.27), PAL.red, { z: 0 });
      row.add(likedIcon);
    } else {
      ['3', '17', '48', '126'].forEach((n) => {
        const t = cutText(fonts.school, n, 0.3, PAL.ink, { clip, align: 'left', seed: 2 });
        t.position.set(0.05, -0.104, 0);
        row.add(t); counts.push(t);
      });
    }
    ph.add(row); actions.push(row);

    // hearts on paper springs, either side of the phone; each stands between two of the people behind it
    const defs = side === 'L'
      ? [[-1.34, 0.95, 0.3, PAL.pink, 0.0], [-1.69, 2.36, 0.44, PAL.rose, 0.2], [-2.2, 2.66, 0.5, PAL.red, 0.42], [-2.74, 2.2, 0.4, PAL.pink, 0.66]]
      : [[1.34, 1.0, 0.3, PAL.rose, 0.1], [1.69, 2.46, 0.46, PAL.red, 0.3], [2.2, 2.2, 0.4, PAL.pink, 0.54], [2.74, 2.62, 0.5, PAL.rose, 0.78]];
    addSprings(g, clip, defs);
  });

  // ---------------------------------------------------------------- front: Sam with his own phone, and the big heart
  let big = null, tag = null;
  const front = env.fold({ z: 0.54, beta: 85 });
  const frontG = env.span(front, (g, side, clip) => {
    if (side === 'L') {
      const sam = art.person({ clip, x: -2.32, y: 0.0, z: L, s: 0.95, shirt: PAL.red, hair: PAL.umber, skin: PAL.tan });
      sam.put(rr(0.3, 0.46, 0.05, 0.02, 0.36), PAL.charcoal, { z: L * 4 });
      sam.put(rr(0.24, 0.36, 0.03, 0.02, 0.37), PAL.sky, { z: L * 4.4 });
      for (const sx of [-0.15, 0.19]) sam.put(circ(0.075, sx, 0.3), PAL.tan, { z: L * 4.8 });
      g.add(sam);
      addSprings(g, clip, [[-1.3, 0.72, 0.26, PAL.rose, 0.88], [-3.02, 1.0, 0.3, PAL.red, 1.0]]);
    } else {
      addSprings(g, clip, [[1.26, 0.76, 0.26, PAL.pink, 0.95], [3.04, 1.12, 0.3, PAL.rose, 1.05]]);
      big = stack({ clip, x: 2.2, y: 0, z: L });
      big.put(rr(0.05, 0.86, 0.02, 0, 0.43), PAL.white, { z: 0 });
      big.put(heart(1.0, 0, 1.2), PAL.rose, { z: L * 0.5 });
      big.put(heart(0.76, 0, 1.21), '#ee7f8f', { z: L * 0.9 });
      big.put(ell(0.07, 0.12, -0.2, 1.36, 0.5), PAL.white, { z: L * 1.3 });
      tag = stack({ clip, x: 0.3, y: 0.86, z: L * 1.8, rot: -0.14 });
      tag.put(rr(0.02, 0.22, 0, -0.34, 0.2), PAL.ink, { z: -0.002, rot: 0.3 });
      // a luggage tag: navy card, cream face, and the word cut from navy paper
      tag.put(poly([[-0.48, 0], [-0.35, 0.24], [0.48, 0.24], [0.48, -0.24], [-0.35, -0.24]], 0.02), PAL.navy, { z: 0 });
      tag.put(poly([[-0.435, 0], [-0.325, 0.2], [0.44, 0.2], [0.44, -0.2], [-0.325, -0.2]], 0.015), PAL.cream, { z: L * 0.25 });
      tag.add(cutSign(fonts.anton, 'REAL', 0.62, 0.26, PAL.navy, { clip, x: 0.07, z: L * 0.6, seed: 8 }));
      tag.put(circ(0.032, -0.35, 0), PAL.navy, { z: L * 0.7, core: false });
      big.add(tag);
      g.add(big);
    }
  });
  // a few hearts lying on the page
  const lay = (pg, x, y, w, c, rot) => pg.add(piece(heart(w), c, { x, y, z: 0.004, rot, cast: false }));
  lay(env.pages.left, -1.0, -0.86, 0.2, '#f6b9c1', 0.3); lay(env.pages.left, -1.75, -1.02, 0.14, '#f39aa5', -0.4); lay(env.pages.left, -0.45, -1.05, 0.12, '#f6b9c1', 0.1);
  lay(env.pages.right, 0.7, -0.95, 0.18, '#f39aa5', -0.2); lay(env.pages.right, 1.35, -0.8, 0.12, '#f6b9c1', 0.5); lay(env.pages.right, 2.85, -1.0, 0.16, '#f6b9c1', -0.3);

  const steps = [0.08, 0.3, 0.52, 0.76];        // when the counter flips, after the first like
  // where the fingertip lands on the button (wing units), and the way the finger points
  const TIP = [0.52 * PS, (BY - 0.02) * PS], AX = [-Math.sin(HAND_ROT), Math.cos(HAND_ROT)];
  return {
    // close on the phone for the tap, then back out to take in the hearts and the crowd
    key(lt) {
      const u = ease.inOutCubic(seg(lt, tPosts + 0.3, tPosts + 1.15));
      return { pos: [0, lerp(6.5, 6.75, u), lerp(9.75, 10.6, u)], target: [0, lerp(1.34, 1.12, u), -0.2], focus: [0, 1.4, -0.2], aperture: 0.1 };
    },
    sfx: [
      { t: tPosts, s: 'tap', a: 'peak' },
      { t: tPosts + 0.14, s: 'post_sent', g: 0.8 },
      { t: tCrowd, s: 'crowd_pop', g: 0.6 },
      ...[0, 0.2, 0.42, 0.62, 0.82].map((d) => ({ t: tLike + d, s: 'heart_pop', g: 0.5 })),
      { t: tBig, s: 'big_heart_pop', g: 0.8 },
      { t: tTag + 0.04, s: 'stamp', a: 'peak' },
      { t: tReal, s: 'paper_pop', g: 0.4 },
    ],
    animate(lt, open) {
      const q = Math.floor(lt * 15 + 1e-4) / 15;                 // paper acts on twos
      for (const g of [phoneG.R, phoneG.L, frontG.R, frontG.L]) g.scale.y = sink(open);
      // steps of two frames counted from the tap itself: -1 the finger hovers, 0 it presses, 1 the button springs back, 2 posted
      const k = Math.floor((lt - tPosts) * 15 + 1e-4);
      const rise = tw(q, tPosts - 0.5, tPosts - 0.14, ease.outCubic);
      const leave = k < 2 ? 0 : tw(lt, tPosts + 0.2, tPosts + 0.6, ease.inCubic);
      const off = k < 0 ? lerp(1.7, 0.1, rise) : k === 0 ? -0.04 : k === 1 ? 0.05 : lerp(0.1, 1.8, leave);      // how far back along the finger
      hand.position.set(TIP[0] - AX[0] * off, TIP[1] - AX[1] * off, L * 5);
      hand.visible = (k < 0 ? rise > 0.02 : leave < 0.98);
      const posted = k >= 2;
      for (const b of buttons) {
        b.visible = !posted;
        const f = b.userData.face;
        f.scale.set(k === 0 ? 1.05 : k === 1 ? 0.97 : 1, k === 0 ? 0.72 : k === 1 ? 1.1 : 1, 1);
        f.position.y = k === 0 ? -0.05 : 0;
      }
      taps.forEach((fl) => { fl.visible = k === 0 || k === 1; fl.scale.setScalar(k === 0 ? 0.7 : 1.15); });
      const tSent = tPosts + 2 / 15;
      for (const a of actions) { a.visible = posted; a.scale.setScalar(posted ? 0.72 + 0.28 * clamp(spring(Math.max(0, lt - tSent), 5, 0.4), 0, 1.5) : 1); }
      sent.scale.setScalar(posted ? Math.max(0.001, spring(q - tSent - 0.06, 3.2, 0.4)) : 0.001);
      // likes
      const liked = q >= tLike;
      likeIcon.visible = !liked;
      likedIcon.visible = liked;
      likedIcon.scale.setScalar(liked ? clamp(spring(q - tLike, 3.6, 0.35), 0.3, 1.5) : 1);
      let shown = -1;
      steps.forEach((s, i) => { if (q >= tLike + s) shown = i; });
      counts.forEach((c, i) => { c.visible = i === shown; c.scale.setScalar(i === shown ? 1 + 0.25 * Math.max(0, 1 - (q - tLike - steps[i]) / 0.14) : 1); });
      for (const s of springs) {
        const { spr, hd, h, d, k: n } = s.userData;
        const a = q - (tLike + d * 0.8);
        const u = a < 0 ? 0 : clamp(spring(a, 2.6, 0.5), 0, 1.1);
        s.visible = a >= 0;
        spr.scale.y = Math.max(0.02, u);
        hd.position.y = h * u + (a > 0.5 ? 0.035 * Math.sin(q * 5 + n * 1.7) : 0);
        hd.rotation.z = 0.16 * Math.sin(q * 3.6 + n * 2.1) * Math.min(1, u);
        hd.scale.setScalar(Math.max(0.05, Math.min(1.15, u * 1.1)));
      }
      // real people come up over the hills
      for (const u of crowd) {
        const a = q - (tCrowd + (u.userData.i % 3) * 0.1 + (u.userData.i >= 3 ? 0.05 : 0));
        const m = a < 0 ? 0 : clamp(spring(a, 2.6, 0.5), 0, 1.2);
        u.visible = a >= -0.02;                          // tucked away, so nothing pokes out under the fold while the page turns
        u.position.y = lerp(u.userData.up - 1.02, u.userData.up, m) + (m > 0.95 ? 0.03 * Math.sin(q * 6 + u.userData.i * 1.3) : 0);
      }
      // the big heart, then its tag, which bounces once more on the word "real"
      const b = q - tBig;
      big.scale.setScalar(b < 0 ? 0.001 : clamp(spring(b, 2.8, 0.42), 0.001, 1.3));
      const t = q - tTag, again = q - tReal;
      tag.visible = t >= 0;
      tag.scale.setScalar((t < 0 ? 1 : 1 + 0.9 * Math.max(0, 1 - t / 0.14)) * (again >= 0 ? 1 + 0.22 * Math.max(0, 1 - again / 0.2) : 1));
      tag.rotation.z = -0.14 + (t >= 0.14 ? 0.1 * Math.exp(-(t - 0.14) * 5) * Math.sin((t - 0.14) * 22) : 0) + (again >= 0 ? 0.12 * Math.exp(-again * 6) * Math.sin(again * 24) : 0);
    },
  };
}
