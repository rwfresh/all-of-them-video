// 05 Flat Vector: "give it some bounce."
// The cursor rounds into ONE DOT, hops off the prompt row and out of the top of the frame, and comes down on the
// isometric city with a flat blue sky behind it: the picture is pressed flat under the dot, from the middle outward,
// until it is only the ground line. Then the city Isometric built comes back, strictly flat and seen from the front:
// its fifteen buildings, one for every shot, 01 to 15 from the left, three frames apart, each up past its height and
// back, each with its number on its wall. When the run reaches the middle, building 08 comes up under the dot and
// throws it into the sky on the beat: it is the sun. Row B's result names three things and the sun shows each as its
// word arrives: it jumps too far (overshoot), lands on a roof (squash), comes to rest (settle). Then building 05's one
// lit window opens: its rectangle grows until it is the whole picture, and behind it is a room, a figure typing the
// very prompt that is being typed below, and out of the far window the dot again, at rest: that is what Shape Morph
// takes. While the dot is away being the sun, the row's cursor is only its outline.
//
// Six colours, no gradients, no shadows. One hero moves at a time. All timing is in local beats.
// For the shot after: handoff(env) = { dot: { x, y, r, color }, bg } in frame pixels, valid for any beat.

import { DOCK, swapDock } from '../term.js';
import { C, TAU, clamp, lerp, seg, smooth, bezier, BACK, OUT, wob, wobS, hit, rect, rr, disc, bar } from './flat/kit.js';
import { GY, SUN, ROOF8, BUILDINGS, LIT, building, rise, cloud, CLOUDS, bird, TREES, tree } from './flat/city.js';
import { room, RSUN } from './flat/room.js';

const W = 1920, H = 1080;
const T = {
  squat: 0.12, off: 0.56,             // the dot gathers itself on the row, then leaves by the top of the frame
  fall: 0.6, hit: 1, rise: 1.07,      // comes down with the sky, lands on the beat, and comes to rest after one small bounce
  city: 1.2, step: 0.1,               // the fifteen buildings, 01 to 15 from the left, about three frames apart
  lift: 1.9, toss: 2, sun: 2.5,       // 08 comes up under the dot and throws it on the beat: it is the sun
  tag: 1.3,
  ant: 3.36, up: 3.5, apex: 3.74, splat: 4, off2: 4.09, set: 4.5,   // overshoot, squash, settle
  lit: 4.7, push: 5, in: 5.345,       // the lit window calls, then opens with the first key: ten frames
};
const POP = 0.48;                     // a building's arrival: about fourteen frames
const R0 = 16, RB = 92;               // the dot as a cursor, and as the thing that flattens a city
const HITX = 960;
const LAG = 0.2, SPREAD = 380;        // how late the far ends of the picture are pressed flat (beats), and how wide the dip is
const BIG = bezier(0.3, 2.3, 0.6, 1); // an overshoot nobody can miss, for the word that names it

export default async function make(ctx) {
  const { font, makeCanvas, shot, script } = ctx;
  const FILE = '/assets/flat/Sono-Variable.ttf';
  await Promise.all([
    font('Sono Mono', FILE, { weight: '200 800', variationSettings: '"MONO" 1' }),
    font('Sono Sans', FILE, { weight: '200 800', variationSettings: '"MONO" 0' }),
  ]);
  const MONO = '"Sono Mono"', SANS = '"Sono Sans"';
  const mg = makeCanvas(8, 8).getContext('2d');
  mg.font = `800 100px ${MONO}`;
  const SIZE = DOCK.adv / (mg.measureText('M').width / 100);          // one letter to a 36 px cell

  // ---- the cue sheet ----
  const CMD = shot.prompt || '';
  const NEXT = script.shots[shot.name].next;
  const KEYS = NEXT ? NEXT.keys.map((k) => k - shot.b0) : [];
  const TYPE0 = KEYS.length ? KEYS[0] : shot.beats - 3, TYPE1 = KEYS.length ? KEYS[KEYS.length - 1] : shot.beats - 0.5;
  const CLEAR = TYPE0 - (script.T.clear ?? 1);                         // the old prompt leaves the row here
  const RES = (shot.out || []).find((o) => o.kind === 'result');
  const T_RES = RES ? RES.at : T.up;
  // the three words arrive half a beat apart; the sun does what each one says as it lands
  const WORDS = RES ? [...RES.text.matchAll(/\+ \S+/g)].map((m, k) => ({ at: m.index, len: m[0].length, t: 0.5 * k })) : [];

  const cellX = (col) => DOCK.x + col * DOCK.adv + DOCK.adv / 2;
  const X0 = cellX(2 + CMD.length), FOOT = DOCK.rowC - 5;

  // ---- the dot ----
  /** The lowest point of the dot while it comes down on the picture (frame px). The picture is pressed by this. */
  function fallBottom(t) {
    if (t < T.fall) return -400;
    if (t >= T.hit) return GY;
    const q = (t - T.fall) / (T.hit - T.fall);
    return lerp(-70, GY, Math.pow(q, 1.8));
  }
  /** How far building 08 gives when the sun lands on it, and its neighbours after it: 1 = at rest. */
  function give(b, lb) {
    const d = Math.abs(b.x + b.w / 2 - HITX), t = lb - T.splat - d / 2600;
    if (t <= 0) return 1;
    return 1 - 0.17 * Math.exp(-d / 230) * smooth(t / 0.035) * Math.exp(-t * 6.5) * Math.cos(t * TAU * 2.1);
  }
  const B8 = BUILDINGS[7];
  const T8 = T.city + 7 * T.step;                                     // when 08 starts to come up (= T.lift)
  const roofAt = (lb) => GY - B8.h * rise((lb - T8) / POP).sy * give(B8, lb);

  /** The hero dot at beat lb: { x, y, rx, ry, k (0 = still square, 1 = round) } or null while it is out of the frame. */
  function heroAt(lb) {
    if (lb < T.squat) {
      const u = clamp(lb / T.squat), q = Math.sin((u * Math.PI) / 2), sy = 1 - 0.38 * q, sx = 1 + 0.3 * q;
      return { x: X0, y: FOOT - R0 * sy, rx: R0 * sx, ry: R0 * sy, k: smooth(u * 1.6) };
    }
    if (lb < T.off) {
      const u = seg(lb, T.squat, T.off), e = 1 - Math.pow(1 - u, 1.7), r = lerp(R0, RB, smooth(u));
      const sy = lerp(0.62, 1, clamp(u / 0.06)) + 0.3 * Math.sin(Math.PI * clamp(u / 0.5)) * (1 - u);
      return { x: lerp(X0, HITX, smooth(u)), y: lerp(FOOT - R0, -RB - 110, e), rx: r / Math.sqrt(sy), ry: r * sy, k: 1 };
    }
    if (lb < T.fall) return null;
    if (lb < T.hit) {
      const q = seg(lb, T.fall, T.hit), sy = 1 + 0.2 * q;
      return { x: HITX, y: fallBottom(lb) - RB * sy, rx: RB * (1 - 0.1 * q), ry: RB * sy, k: 1 };
    }
    if (lb < T.rise) {
      const u = seg(lb, T.hit, T.rise), sy = u < 0.4 ? lerp(1.2, 0.54, u / 0.4) : lerp(0.54, 0.76, (u - 0.4) / 0.6);
      return { x: HITX, y: GY - RB * sy, rx: RB / Math.pow(sy, 0.8), ry: RB * sy, k: 1 };
    }
    if (lb < T.lift) {
      // it comes to rest where it landed: one small bounce, then still, while the city starts at the far left
      const a = lb - T.rise, B1 = 0.2;
      if (a < B1) { const p = a / B1, sy = lerp(0.76, 1, clamp(a / 0.05)) + 0.1 * Math.sin(Math.PI * clamp(p / 0.4)) * (1 - p); return { x: HITX, y: GY - RB * sy - 44 * 4 * p * (1 - p), rx: RB / Math.sqrt(sy), ry: RB * sy, k: 1 }; }
      const q = Math.exp(-(a - B1) * 14) * Math.cos((a - B1) * TAU * 2.4), sy = 1 - 0.16 * q;
      return { x: HITX, y: GY - RB * sy, rx: RB / Math.pow(sy, 0.8), ry: RB * sy, k: 1 };
    }
    if (lb < T.toss) {
      // building 08 comes up underneath: the dot is pressed onto its roof as it is carried up
      const u = seg(lb, T.lift, T.toss), sy = 1 - 0.24 * Math.sin(Math.PI * Math.pow(u, 0.7));
      return { x: HITX, y: roofAt(lb) - RB * sy, rx: RB / Math.pow(sy, 0.8), ry: RB * sy, k: 1 };
    }
    // thrown off the roof on the beat: from here on it is the sun
    let x = SUN.x, y = SUN.y, r = SUN.r, sx = 1, sy = 1;
    if (lb < T.ant) {
      const u = seg(lb, T.toss, T.sun), e = BACK(u), a = lb - T.sun;
      r = lerp(RB, SUN.r, smooth(u));
      y = lerp(roofAt(T.toss) - RB, SUN.y, e);
      sy = 1 + 0.24 * Math.sin(Math.PI * clamp(u / 0.55)) * (1 - u) + 0.05 * wobS(a, 2.2, 0.1);
      sx = 1 / Math.sqrt(sy);
      // on its own once it is up: a small swell on the beat
      const f = lb - Math.floor(lb);
      if (lb >= T.sun + 0.3) { const p = 0.028 * hit(f, 0.07) * seg(f, 0, 0.04); sx += p; sy += p; }
    } else if (lb < T.up) {
      const a = Math.sin((seg(lb, T.ant, T.up) * Math.PI) / 2);
      sy = 1 - 0.17 * a; sx = 1 + 0.12 * a; y = SUN.y + 16 * a;
    } else if (lb < T.apex) {
      const u = seg(lb, T.up, T.apex);
      y = lerp(SUN.y + 16, 132, 1 - (1 - u) * (1 - u)); sy = lerp(0.83, 1.22, clamp(u / 0.12)) - 0.22 * u; sx = 1 / Math.sqrt(sy);
    } else if (lb < T.splat) {
      const q = seg(lb, T.apex, T.splat);
      sy = 1 + 0.18 * q * q; sx = 1 - 0.08 * q * q;
      y = lerp(132 + r, ROOF8, q * q) - r * sy;
    } else if (lb < T.off2) {
      const u = seg(lb, T.splat, T.off2);
      sy = u < 0.45 ? lerp(1.18, 0.55, u / 0.45) : lerp(0.55, 0.72, (u - 0.45) / 0.55); sx = 1 / Math.pow(sy, 0.8);
      y = roofAt(lb) - r * sy;
    } else {
      const u = seg(lb, T.off2, T.set), e = BACK(u), a = lb - T.set;
      y = lerp(roofAt(T.off2) - r * 0.72, SUN.y, e) + 8 * wobS(a, 2.3, 0.12);
      sy = 1 + 0.2 * Math.sin(Math.PI * clamp(u / 0.5)) * (1 - u) - 0.085 * wobS(a, 2.3, 0.12);
      sx = 1 / Math.sqrt(sy);
    }
    return { x, y, rx: r * sx, ry: r * sy, k: 1 };
  }
  function drawHero(g, h) {
    if (!h) return;
    g.fillStyle = C.coral; g.beginPath();
    if (h.k >= 1) g.ellipse(h.x, h.y, h.rx, h.ry, 0, 0, TAU);
    else g.roundRect(h.x - h.rx, h.y - h.ry, h.rx * 2, h.ry * 2, Math.min(h.rx, h.ry) * lerp(0.3, 1, h.k));
    g.fill();
  }

  // ---- the city's run: 01 to 15 from the left, a tenth of a beat apart (about three frames), so each is seen to arrive ----
  const T0 = BUILDINGS.map((b, i) => T.city + i * T.step);
  // each building is one shot of the film and carries its number, as the cue sheet numbers them
  const LABELS = ctx.cues.shots.filter((q) => q.num).map((q) => String(q.num).padStart(2, '0'));
  // a street tree comes up just after the building it stands by
  const TREE_T0 = TREES.map((t) => { let k = 0; BUILDINGS.forEach((b, i) => { if (Math.abs(b.x + b.w / 2 - t.x) < Math.abs(BUILDINGS[k].x + BUILDINGS[k].w / 2 - t.x)) k = i; }); return T0[k] + 0.34; });

  // the long pause inside the next prompt (between two words): where the figure in the room looks up
  let GAP = null;
  if (NEXT) {
    const ks = KEYS.filter((_, i) => NEXT.text[i] !== ' ');
    for (let i = 1; i < ks.length; i++) if (ks[i] - ks[i - 1] >= 0.45 && (!GAP || ks[i] - ks[i - 1] > GAP[1] - GAP[0])) GAP = [ks[i - 1], ks[i]];
  }
  const ENTER = NEXT ? NEXT.enterAt - shot.b0 : shot.beats;

  function roomState(env) {
    const lb = env.lb, r = env.term.rowC, typing = r.mode === 'typing' && lb >= CLEAR;
    return {
      lb, beat: env.ab, n: typing ? r.n : 0, keyAge: (i) => (typing ? r.keyAge(i) : 9), text: typing ? r.text : '',
      entered: env.term.typing ? env.term.typing.entered : false, gap: GAP, type1: TYPE1, enterAt: ENTER, arrive: lb - T.in,
      font: MONO, size: SIZE,
    };
  }

  /** Everything above the band: the city, then the room its lit window opens onto. */
  function scene(g, env) {
    const lb = env.lb;
    g.save(); g.beginPath(); g.rect(0, 0, W, GY); g.clip();
    if (lb >= T.in) { room(g, roomState(env)); g.restore(); return; }
    rect(g, 0, 0, W, GY, C.ultra);
    for (const c of CLOUDS) {
      const u = seg(lb, c.t0, c.t0 + 0.62);
      if (u > 0) cloud(g, c.x + c.from * (1 - BACK(u)) * 760 + (lb - 3) * c.drift, c.y, c.s);
    }
    for (const layer of [0, 1]) BUILDINGS.forEach((b, i) => {
      if (b.layer !== layer || lb < T0[i]) return;
      const t = lb - T0[i];
      building(g, b, {
        u: t / POP, roof: BACK(seg(t, 0.16, 0.5)), win: seg(t, 0.24, 0.62), sq: give(b, lb),
        litPulse: Math.max(0, wobS(lb - T.lit, 2.2, 0.1)), font: MONO, label: LABELS[i],
        blink: lb >= T.sun ? hit(lb - Math.floor(lb), 0.08) : 0,                 // the mast lights keep the beat
      });
    });
    // the street's trees follow the buildings up, and shiver when the sun lands
    TREES.forEach((t, i) => {
      const d = Math.abs(t.x - HITX), a = lb - T.splat - d / 2600;
      tree(g, t, BACK(seg(lb, TREE_T0[i], TREE_T0[i] + 0.34)), a > 0 ? 0.2 * Math.exp(-d / 420) * wobS(a, 2.2, 0.16) * Math.sign(t.x - HITX) : 0);
    });
    if (lb >= T.rise) drawHero(g, heroAt(lb));
    // two birds, beating time
    const bk = BACK(seg(lb, 2.9, 3.2));
    if (bk > 0.01) for (const [k, bx, by] of [[0, 668, 156], [1, 734, 124]]) {
      const flap = 0.5 + 0.5 * Math.sin(lb * TAU * 1.0 + k * 1.3);
      bird(g, bx + (lb - 2.9) * 30, by + 9 * Math.sin(lb * 1.7 + k * 2), bk * (k ? 0.8 : 1), flap, C.cream);
    }
    // the lit window opens: its rectangle grows, slowly and then all at once, until it is the picture.
    // What it is made of is the room behind it, already in place.
    if (lb >= T.push) {
      const e = Math.pow(seg(lb, T.push, T.in), 5);
      const x0 = lerp(LIT.x, 0, e), y0 = lerp(LIT.y, 0, e), x1 = lerp(LIT.x + LIT.w, W, e), y1 = lerp(LIT.y + LIT.h, GY, e);
      g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
      room(g, roomState(env));
      g.restore();
    }
    g.restore();
  }

  /**
   * The picture before this shot, pressed flat under the dot: every column of it is squeezed toward the ground line,
   * the middle first. Returns the edge of the sky coming down (tops[i] at x = i * SW); the band rises to meet it.
   */
  const STAND = makeCanvas(8, 8);
  { const s = STAND.getContext('2d'); s.fillStyle = C.mint; s.fillRect(0, 0, 8, 8); }
  const SW = 4;
  function pressed(g, env) {
    const lb = env.lb, src = env.other || STAND, sw = src.width / W, tops = [];
    for (let x = 0; x <= W; x += SW) { const dx = x - HITX, lag = (LAG * dx * dx) / (dx * dx + SPREAD * SPREAD); tops.push(clamp(fallBottom(lb - lag), 0, GY)); }
    for (let i = 0; i + 1 < tops.length; i++) {
      const top = Math.min(tops[i], tops[i + 1]), s = 1 - top / GY;
      if (s > 0.0015) g.drawImage(src, i * SW * sw, 0, SW * sw, src.height, i * SW, top, SW + 0.6, H * s);
    }
    return tops;
  }
  const skyPath = (g, tops) => { g.beginPath(); g.moveTo(0, -2); tops.forEach((t, i) => g.lineTo(i * SW, t)); g.lineTo(W, -2); g.closePath(); };
  const bandPath = (g, tops) => { g.beginPath(); g.moveTo(0, H + 2); tops.forEach((t, i) => g.lineTo(i * SW, GY + (H - GY) * (1 - t / GY))); g.lineTo(W, H + 2); g.closePath(); };
  /** How far from the middle the picture is already flat (px). */
  function flatReach(lb) {
    const t = lb - T.hit;
    if (t <= 0) return 0;
    return t >= LAG * 0.985 ? 4000 : SPREAD * Math.sqrt(t / (LAG - t));
  }

  // ---- the terminal's rows: bold rounded letters, ink on the cream band, one to a cell ----
  /** fx(i) -> { s, sx, sy, dy, rot, color } for letter i; s <= 0 hides it. */
  function letters(g, text, col0, y, color, weight, fx) {
    g.font = `${weight} ${SIZE}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === ' ') continue;
      const f = fx ? fx(i) : null, x = cellX(col0 + i);
      if (f && (f.s ?? 1) <= 0.01) continue;
      g.fillStyle = (f && f.color) || color;
      if (!f) { g.fillText(ch, x, y); continue; }
      g.save(); g.translate(x, y + (f.dy || 0)); if (f.rot) g.rotate(f.rot);
      g.scale((f.s ?? 1) * (f.sx ?? 1), (f.s ?? 1) * (f.sy ?? 1));
      g.fillText(ch, 0, 0); g.restore();
    }
  }
  /** What each of the three words does as it arrives: it is set the way its meaning moves. */
  function wordFx(k, t, i) {
    const a = t - i * 0.012;
    if (a <= 0) return { s: 0 };
    if (k === 0) return { s: BIG(clamp(a / 0.26)) };                                           // too big, and back
    if (k === 1) {                                                                             // dropped, flattened, restored
      const fall = clamp(a / 0.1), land = a - 0.1;
      const q = land > 0 ? smooth(land / 0.03) * Math.exp(-land * 9) * Math.cos(land * TAU * 2.0) : 0;
      return { dy: -52 * (1 - fall * fall), sy: 1 - 0.5 * q, sx: 1 + 0.32 * q };
    }
    return { s: clamp(a / 0.05), rot: 0.3 * wob(a, 2.6, 0.1), dy: -12 * wob(a, 2.6, 0.1) };    // swings, less and less
  }
  function rowB(g, env) {
    const o = env.term.last, y = DOCK.rowB, lb = env.lb;
    if (!o) return;
    if (o.kind === 'result') {
      g.strokeStyle = C.ultra; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
      const ex = cellX(2), k = BACK(clamp(o.age / 0.2));
      g.beginPath(); g.moveTo(ex, y - 46 * k); g.lineTo(ex, y - 13); g.lineTo(ex + 30 * k, y - 13); g.stroke();
      if (!WORDS.length) { letters(g, o.text, 5, y, C.ink, 700); return; }
      WORDS.forEach((w, k2) => {
        const t = o.age - w.t;
        letters(g, o.text.slice(w.at, w.at + w.len), 5 + w.at, y, C.ink, 700, (i) => ({ ...wordFx(k2, t, i), color: i === 0 ? C.ultra : C.ink }));
      });
      return;
    }
    const done = o.kind !== 'tool' || o.age > 0.3;
    const bk = BACK(clamp(o.age / 0.2)) * (1 + 0.35 * hit(o.age - 0.3, 0.05) * (o.age > 0.3 ? 1 : 0));
    disc(g, cellX(0), y - 21, 12 * bk, done ? C.mint : C.sun);
    disc(g, cellX(0), y - 21, 4.5 * bk, C.ink);
    const shown = o.kind === 'say' ? o.text.slice(0, o.chars) : o.text, par = o.kind === 'tool' ? shown.indexOf('(') : -1;
    const fx = (i0) => (i) => ({ s: BACK(clamp((o.age - (i + i0) * 0.01) / 0.16)) });
    if (par > 0) { letters(g, shown.slice(0, par), 2, y, C.ink, 800, fx(0)); letters(g, shown.slice(par), 2 + par, y, C.ink, 500, fx(par)); }
    else letters(g, shown, 2, y, C.ink, 700, fx(0));
  }
  function rowC(g, env) {
    const m = env.term, r = m.rowC, y = DOCK.rowC, lb = env.lb;
    g.font = `800 ${SIZE}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = C.ultra; g.fillText('>', cellX(0), y);
    if (r.mode === 'cmd') {
      // before the next prompt the old one is pressed out of the row, last letter first
      const L = r.text.length;
      letters(g, r.text, 2, y, C.ink, 700, (i) => { const t0 = CLEAR - 0.34 + (L - 1 - i) * 0.012, u = seg(lb, t0, t0 + 0.1); return u <= 0 ? null : { s: u >= 1 ? 0 : 1, sy: 1 - u, sx: 1 + 0.35 * u }; });
      return;
    }
    letters(g, r.text.slice(0, r.n), 2, y, C.ink, 700, (i) => { const a = r.keyAge(i); return a > 0.3 ? null : { s: lerp(0.35, 1, BACK(clamp(a / 0.17))), dy: -7 * hit(a, 0.04) }; });
    if (!r.cursor) return;
    // the dot is away being the sun, so the cursor is its outline, resting on the line: it swells on the beat and
    // hops a cell with every key
    const f = env.ab - Math.floor(env.ab), n = r.n;
    let x = cellX(2 + n), cy = y - R0, sx = 1, sy = 1;
    let k = m.blink ? 1 - 0.34 * seg(f, 0.44, 0.5) : 0.66 + 0.34 * seg(f, 0.94, 1);
    if (n > 0 && r.keyAge(n - 1) < 0.75) {
      const a = r.keyAge(n - 1), u = clamp(a / 0.1), land = a - 0.1;
      k = 1; x = lerp(cellX(1 + n), x, OUT(u)); cy -= 13 * Math.sin(Math.PI * u);
      if (land > 0) { const q = hit(land, 0.03); sy = 1 - 0.3 * q; sx = 1 + 0.24 * q; }
    } else if (lb >= CLEAR && lb < CLEAR + 0.4) k = BIG(clamp((lb - CLEAR) / 0.3));       // it is back on the cleared row with a pop
    else k += 0.16 * hit(f, 0.05);
    const lw = 7;
    g.strokeStyle = C.coral; g.lineWidth = lw; g.beginPath();
    g.ellipse(x, y - R0 * k * sy + (cy - (y - R0)), Math.max(0.5, R0 * k * sx - lw / 2), Math.max(0.5, R0 * k * sy - lw / 2), 0, 0, TAU); g.stroke();
  }
  function dock(g, env, part) {
    if (part !== 'C') rowB(g, env);
    if (part !== 'B') rowC(g, env);
  }

  function tag(g, env) {
    const k = BACK(seg(env.lb, T.tag, T.tag + 0.32));
    if (!env.tag || k <= 0.01) return;
    const s1 = `${env.tag.num}/${env.tag.of}`, s2 = env.tag.name;
    g.save();
    g.translate(DOCK.left, 142); g.scale(k, k);
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.font = `800 42px ${SANS}`; g.letterSpacing = '1px';
    const w1 = g.measureText(s1).width;
    g.letterSpacing = '4px';
    const w2 = g.measureText(s2).width;
    rr(g, 0, -38, 30 + w1 + 26 + w2 + 26, 76, 38, C.ink);
    g.letterSpacing = '1px'; g.fillStyle = C.mint; g.fillText(s1, 30, 15);
    g.letterSpacing = '4px'; g.fillStyle = C.cream; g.fillText(s2, 30 + w1 + 26, 15);
    g.letterSpacing = '0px';
    g.restore();
  }

  function render(g, env) {
    const lb = env.lb, handing = !!(env.other && env.role === 'in');
    if (lb < 0) {
      // before the bar line there is only the picture before this one (or, alone, the row and its cursor)
      if (env.other) g.drawImage(env.other, 0, 0);
      else { rect(g, 0, 0, W, H, C.mint); drawHero(g, heroAt(0)); }
      if (!env.noDock) dock(g, env);
      return;
    }
    const ground = () => {
      rect(g, 0, GY, W, H - GY, C.cream);
      // the ground line: all that is left of the third dimension
      const reach = flatReach(lb);
      if (reach > 0) rect(g, Math.max(0, HITX - reach), GY - 6, Math.min(W, 2 * reach), 6, C.ink);
    };
    if (lb < T.fall) { if (env.other) g.drawImage(env.other, 0, 0); else rect(g, 0, 0, W, H, C.mint); }
    else if (lb < T.hit + LAG + 0.02) {
      // the flat sky comes down with the dot and the band comes up to meet it: the old picture is what is left between
      const tops = pressed(g, env);
      g.save(); skyPath(g, tops); g.clip(); scene(g, env); g.restore();
      g.save(); bandPath(g, tops); g.clip(); ground(); g.restore();
    } else { scene(g, env); ground(); }
    // the landing throws a ring of short strokes up off the ground
    const bu = seg(lb, T.hit, T.hit + 0.3);
    if (bu > 0 && bu < 1) for (let i = 0; i < 9; i++) {
      const a = Math.PI * (1.08 + (0.84 * i) / 8), d0 = 150 + 230 * OUT(bu), len = 90 * (1 - bu);
      bar(g, HITX + Math.cos(a) * d0, GY - 12 + Math.sin(a) * d0 * 0.8, HITX + Math.cos(a) * (d0 + len), GY - 12 + Math.sin(a) * (d0 + len) * 0.8, 18 * (1 - bu), C.cream);
    }
    tag(g, env);
    if (!env.noDock) {
      if (handing && env.otherImpl && env.otherImpl.dock) swapDock(g, env, dock, seg(lb, 0.02, 0.6));
      else dock(g, env);
    }
    if (lb < T.rise) drawHero(g, heroAt(lb));                          // out in front of the rows while it leaves them
  }

  /** For Shape Morph: the dot, wherever it is. At the end it is the sun in the room's far window, at rest. */
  function handoff(env) {
    const lb = env.lb;
    let d;
    if (lb >= T.in + 0.64) d = { x: RSUN.x, y: RSUN.y, r: RSUN.r };                       // in the room's window, at rest
    else { const h = heroAt(lb) || { x: HITX, y: -RB - 110, rx: RB, ry: RB }; d = { x: h.x, y: h.y, r: (h.rx + h.ry) / 2 }; }
    return { dot: { ...d, color: C.coral }, bg: C.cream, sky: C.ultra, ink: C.ink, ground: GY };
  }

  return {
    render, dock, handoff,
    // real blur only where the dot crosses the frame in a few frames: its leap and fall, and its jump before the squash.
    // The window opens with hard edges: it is a shape, not a camera.
    samples: (env) => { const b = env.lb; return b > 0.1 && b < T.hit ? 8 : b > T.up && b < T.splat - 0.02 ? 6 : 1; },
    sfx: [
      { b: T.squat, s: 'flat_hop', g: 0.7 },                       // the dot leaves the row: a small rubbery boing, rising
      { b: T.fall + 0.04, s: 'flat_drop', g: 0.6 },               // it comes down with the sky: a quick falling whistle, 0.4 beat
      { b: T.hit, s: 'flat_thud', g: 1.0, a: 'peak' },             // it lands and the city is flat: one big soft thump
      // fifteen buildings come up one by one, 01 to 15, a tenth of a beat apart: one soft pop each as it shoots up,
      // three buildings to a step of the scale
      ...Array.from({ length: 15 }, (_, k) => ({ b: T.city + k * T.step + 0.07, s: `flat_pop${1 + Math.floor(k / 3)}`, g: +(0.34 + 0.02 * k).toFixed(2), a: 'peak' })),
      { b: T.toss, s: 'flat_hop', g: 0.55 },                       // building 08 throws the dot: the same rubbery boing as its first hop
      { b: T.toss + 0.25, s: 'flat_ding', g: 0.6, a: 'peak' },     // it reaches its place as the sun: one bright round ding
      { b: T.up, s: 'flat_boing', g: 0.8 },                        // overshoot: a springy boing upward
      { b: T.splat, s: 'flat_splat', g: 0.9, a: 'peak' },          // squash: a rubber ball flattening on a roof
      { b: T.set, s: 'flat_wobble', g: 0.6 },                      // settle: a short jelly wobble dying away
      { b: T.push, s: 'flat_zoom', g: 0.7 },                       // the lit window opens to fill the frame: a soft fast whoosh, 0.3 s
    ],
  };
}
