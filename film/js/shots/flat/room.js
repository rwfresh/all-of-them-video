// Behind the one lit window: a room, and you. A geometric figure at a desk, typing the very prompt that is being typed
// in the row below; its terminal shows the letters as they land. Out of the tall window in the middle, the same city
// and the dot, now the sun, at rest. Side view, limbs turning on their joints, flat colour only.
//
// The figure is not a loop: it types on the real keystrokes, and in the pause of the prompt ("don't cut." ... "morph.")
// it has the idea: the head dips, comes up to look out of the window at the dot, blinks, leans in and types the rest.
// When the line is done it sits back, lifts a hand, and brings it down on Enter on the bar line.
//
// The room is drawn in a frame of 1920 x 772 (the picture above the terminal's band).

import { C, TAU, clamp, lerp, seg, smooth, hit, wobS, BACK, rect, rr, disc, bar, poly, about, elbow } from './kit.js';

export const RW = 1920, RH = 772;
export const WINDOW = { x: 790, y: 180, w: 340, h: 504 };
export const RSUN = { x: 960, y: 432, r: 128 };          // the dot at rest: what Shape Morph takes over
// The figure was drawn facing right around a desk leg at x = 652; it is set down mirrored, facing the window, larger.
const FIG = { ax: 1290, s: 1.3 };
const SCREEN = { x: 1200, y: 313, w: 240, h: 132, cols: 19, pad: 13 };   // the terminal's screen

const SKYLINE = [
  [790, 52, 60, 'mint'], [842, 44, 92, 'ink'], [886, 58, 46, 'cream'], [944, 50, 78, 'mint'], [994, 56, 52, 'ink'],
  [1050, 44, 88, 'cream'], [1094, 36, 58, 'mint'],
];
const bump = (x, a, b) => Math.sin(Math.PI * seg(x, a, b));           // 0, up to 1, back to 0

/**
 * st: { lb, beat (absolute beat), n (letters typed), keyAge(i), text (the prompt being typed), entered,
 *       gap: [a, b] | null (the long pause inside the prompt, local beats), type1 (the last key), enterAt,
 *       arrive (beats since the room filled the frame), font, size (px of that font for a 36 px advance) }
 */
export function room(g, st) {
  const { lb, n } = st;
  rect(g, -40, -40, RW + 80, RH + 80, C.sun);

  // ---- what the figure does, and when ----
  const lastAge = n > 0 ? st.keyAge(n - 1) : 9, typing = n > 0 && lastAge < 0.45 && !st.entered;
  const gap = st.gap, done = lb - st.type1, ent = lb - st.enterAt;
  const dip = gap ? bump(lb, gap[0] + 0.02, gap[0] + 0.16) : 0;                      // first a little the other way
  const lookW = (gap ? smooth(seg(lb, gap[0] + 0.12, gap[0] + 0.28)) * (1 - smooth(seg(lb, gap[1] - 0.2, gap[1] - 0.05))) : 0)
    + smooth(seg(ent, 0.02, 0.18));                                                  // ...then up, out of the window; and again on Enter
  const leanIn = gap ? smooth(seg(lb, gap[1] - 0.2, gap[1] - 0.02)) * (1 - smooth(seg(done, 0.05, 0.3))) : 0;
  const back = smooth(seg(done, 0.08, 0.36)) * (1 - 0.5 * smooth(seg(ent, -0.1, 0))) + 0.8 * smooth(seg(ent, 0.02, 0.2));
  const raised = smooth(seg(done, 0.14, 0.36)), armUp = raised * (1 - Math.pow(seg(ent, -0.085, 0), 2));   // a hand over Enter, then down on the bar line
  const struck = ent >= 0 ? hit(ent, 0.05) : 0;
  const blink = Math.max(gap ? bump(lb, gap[0] + 0.32, gap[0] + 0.42) : 0, bump(lb, 5.78, 5.87), bump(ent, 0.3, 0.4));
  // every key is one hand: even letters the near hand, odd the far one
  const press = (hand) => {
    let last = -1;
    for (let i = n - 1; i >= 0; i--) if (i % 2 === hand) { last = i; break; }
    return last < 0 || st.entered ? 0 : hit(st.keyAge(last), 0.04);
  };
  const nod = typing ? hit(lastAge - 0.03, 0.06) : 0;                                // the head follows the hands a moment later
  const e8 = (st.beat * 2) % 1, bob = typing ? hit(e8 / 2, 0.06) * seg(e8, 0, 0.1) : 0;   // and the shoulders keep the eighths

  // ---- the tall window: it opens once the room is the picture, then the dot comes up into it and rests ----
  const arr = st.arrive ?? 9, w = WINDOW, open = BACK(seg(arr, 0.02, 0.3));
  if (open > 0.01) {
    g.save(); g.translate(RSUN.x, RSUN.y); g.scale(open, open); g.translate(-RSUN.x, -RSUN.y);
    rect(g, w.x - 16, w.y - 16, w.w + 32, w.h + 32, C.ink);
    rect(g, w.x, w.y, w.w, w.h, C.ultra);
    g.save(); g.beginPath(); g.rect(w.x, w.y, w.w, w.h); g.clip();
    const cx = w.x + 14 + (lb - 6) * 5;
    rr(g, cx, w.y + 54, 124, 26, 13, C.cream); rr(g, cx + 26, w.y + 34, 70, 36, 18, C.cream);
    disc(g, RSUN.x, lerp(RSUN.y + 330, RSUN.y, BACK(seg(arr, 0.2, 0.64))), RSUN.r, C.coral);
    for (const [x, ww, h, col] of SKYLINE) rect(g, x, w.y + w.h - h, ww + 1, h, C[col]);
    g.restore();
    rect(g, w.x - 38, w.y + w.h + 16, w.w + 76, 18, C.ink);            // the sill
    g.restore();
  }

  // ---- a shelf and a plant, still swinging from the arrival ----
  rect(g, 176, 384, 372, 16, C.ink);
  rect(g, 200, 288, 36, 96, C.ultra); rect(g, 240, 312, 30, 72, C.mint); rect(g, 274, 300, 34, 84, C.cream);
  about(g, 324, 384, 1, 1, () => rect(g, 324, 294, 30, 90, C.ink), 0.2 + 0.08 * wobS(arr, 1.8, 0.18));
  rr(g, 444, 332, 70, 52, [26, 26, 0, 0], C.cream);
  for (const a of [-0.5, 0, 0.5]) about(g, 479, 332, 1, 1, () => rr(g, 471, 276, 16, 60, 8, C.mint), a + 0.05 * Math.sin(lb * 1.3 + a) + 0.2 * wobS(arr, 1.9, 0.2));
  const sway = (k) => 0.045 * Math.sin(lb * 1.1 + k * 1.7) + 0.16 * wobS(arr - 0.02 * k, 1.6, 0.22);
  [[-0.95, 170], [-0.5, 228], [0, 262], [0.5, 222], [0.95, 176]].forEach(([a, len], k) => {
    about(g, 300, 690, 1, 1, () => { g.fillStyle = C.mint; g.beginPath(); g.ellipse(300, 690 - len / 2, 34, len / 2, 0, 0, TAU); g.fill(); }, a + sway(k));
  });
  poly(g, [[244, 684], [356, 684], [342, 776], [258, 776]], C.ink);

  // ---- the figure: drawn facing right, set down mirrored ----
  const fig = (fn) => { g.save(); g.translate(FIG.ax, RH); g.scale(-FIG.s, FIG.s); g.translate(-652, -RH); fn(); g.restore(); };
  const lean = 0.075 * leanIn - 0.07 * back + 0.012 * Math.sin(lb * 2.1) + 0.012 * bob;   // forward is positive
  const P = [286, 600];                                              // the hip: everything above turns on it
  const up = (x, y) => { const c = Math.cos(lean), s = Math.sin(lean), dx = x - P[0], dy = y - P[1] + 2.5 * bob; return [P[0] + dx * c - dy * s, P[1] + dx * s + dy * c]; };
  const reach = 16 * leanIn;                                         // leaning in brings the hands on

  fig(() => {
    // the chair
    rr(g, 190, 448, 22, 176, 9, C.ultra);
    rr(g, 202, 604, 152, 22, 9, C.ultra);
    bar(g, 280, 626, 280, 734, 13, C.ultra); bar(g, 222, 746, 338, 746, 13, C.ultra);
    disc(g, 224, 758, 9, C.ink); disc(g, 336, 758, 9, C.ink);
    // the far leg and its foot, tapping the beat (the heel stays, the toe comes down)
    const fb = st.beat - Math.floor(st.beat), tap = st.entered ? 0 : 0.34 * (1 - hit(fb, 0.09)) * seg(fb, 0, 0.12);
    bar(g, 300, 612, 424, 620, 38, C.ink); bar(g, 424, 620, 432, 736, 32, C.ink);
    about(g, 424, 748, 1, 1, () => rr(g, 414, 730, 72, 28, 13, C.ink), -tap);
    // the near leg
    bar(g, 290, 608, 398, 616, 40, C.ink); bar(g, 398, 616, 404, 736, 34, C.ink);
    rr(g, 388, 732, 74, 28, 13, C.ink);
  });

  // ---- the desk, the keyboard, the terminal (not mirrored: its letters read the right way) ----
  rect(g, 1180, 507, 446, 26, C.ultra);
  bar(g, 1205, 533, 1205, 772, 18, C.ultra); bar(g, 1605, 533, 1605, 772, 18, C.ultra);
  rr(g, 1470, 488, 122, 19, 7, C.ink);
  rect(g, 1290, 493, 60, 15, C.ink);
  rr(g, 1186, 299, 268, 196, 22, C.cream);
  const sc = SCREEN;
  rr(g, sc.x, sc.y, sc.w, sc.h, 10, C.ink);
  rr(g, 1206, 464, 84, 9, 4.5, C.ink);
  disc(g, 1432, 469, 6, typing && lastAge < 0.12 ? C.sun : C.mint);
  // on its screen: the prompt, letter for letter as it is typed below
  const adv = (sc.w - 2 * sc.pad) / sc.cols, fs = (st.size || 60) * (adv / 36), ty = sc.y + sc.h / 2 + fs * 0.34;
  g.font = `700 ${fs}px ${st.font || 'monospace'}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = C.mint; g.fillText('>', sc.x + sc.pad + adv / 2, ty);
  const text = (st.text || '').slice(0, n);
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') continue;
    const k = lerp(0.4, 1, BACK(clamp(st.keyAge(i) / 0.14)));
    g.save(); g.translate(sc.x + sc.pad + (2.5 + i) * adv, ty); g.scale(k, k); g.fillStyle = C.cream; g.fillText(text[i], 0, 0); g.restore();
  }
  if (!st.entered && (typing || st.beat % 1 < 0.5)) rect(g, sc.x + sc.pad + (2 + n) * adv + 1.5, ty - fs * 0.74, adv - 3, fs * 0.9, C.mint);

  fig(() => {
    // the far arm
    const S2 = up(300, 478), H2 = [486 + reach, 546 - 18 * (1 - press(1)) * (1 - raised)];
    const E2 = elbow(S2[0], S2[1], H2[0], H2[1], 92, 100, 1);
    bar(g, S2[0], S2[1], E2[0], E2[1], 30, C.mint); bar(g, E2[0], E2[1], H2[0], H2[1], 26, C.mint); disc(g, H2[0], H2[1], 15, C.cream);
    // the body, turning on the hip
    const T0 = up(288, 594), T1 = up(300, 470);
    bar(g, T0[0], T0[1], T1[0], T1[1], 104, C.mint);
    const N0 = up(306, 432), N1 = up(310, 404);
    bar(g, N0[0], N0[1], N1[0], N1[1], 28, C.cream);
    // the head: nods with the keys, dips, then comes up to look out of the window
    const HC = up(318, 366), ha = lean * 0.6 + 0.07 + 0.06 * nod + 0.1 * dip - 0.3 * lookW;
    about(g, HC[0], HC[1] + 30, 1, 1, () => {
      const hx = HC[0], hy = HC[1] + 5 * nod;
      disc(g, hx - 7, hy - 8, 53, C.ink);                               // hair: what the face leaves uncovered
      disc(g, hx + 4, hy + 4, 46, C.cream);
      g.strokeStyle = C.ultra; g.lineWidth = 10; g.lineCap = 'round';   // headphones
      g.beginPath(); g.arc(hx - 4, hy - 4, 57, Math.PI * 1.08, Math.PI * 1.62); g.stroke();
      rr(g, hx - 30, hy - 12, 26, 40, 12, C.ultra);
      const wide = 1 + 0.35 * Math.min(1, lookW);                       // the eye opens at what it sees
      about(g, hx + 26, hy - 2, wide, wide * (1 - 0.92 * blink), () => disc(g, hx + 26, hy - 2, 6, C.ink));
      g.strokeStyle = C.ink; g.lineWidth = 4.5; g.lineCap = 'round';    // a small smile, wider once it has the idea
      const smile = Math.min(1, lookW + leanIn + back);
      g.beginPath(); g.arc(hx + 26, hy + 16, 10 + 4 * smile, 0.25 * Math.PI, (0.72 + 0.12 * smile) * Math.PI); g.stroke();
    }, ha);
    // the near arm, over everything: shoulder, elbow, hand on the keys; at the end it rises over Enter and comes down
    const S1 = up(312, 474);
    const H1 = [452 + reach + 40 * raised, 546 - 18 * (1 - press(0)) * (1 - raised) - 64 * armUp - (ent >= 0 ? 7 * (1 - struck) : 0)];
    const E1 = elbow(S1[0], S1[1], H1[0], H1[1], 92, 100, 1);
    bar(g, S1[0], S1[1], E1[0], E1[1], 32, C.mint); bar(g, E1[0], E1[1], H1[0], H1[1], 28, C.mint); disc(g, H1[0], H1[1], 16, C.cream);
  });
}
